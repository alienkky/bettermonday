import { useState, useEffect, useCallback } from 'react';
import { marketPricesApi, itemsApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, RefreshCw, Download, Database,
  Search, ArrowUpDown, ArrowUp, ArrowDown, X, Zap, BarChart3, List,
  Plus, Edit2, Trash2, GitCompare, Link2, Unlink, ChevronRight, AlertTriangle,
  Inbox, CheckSquare, Square,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const BRANDS = ['전체', '먼데이커피', '스토리오브라망', '공통'];
const CATEGORIES = ['전체', '도장', '필름', '타일', '패브릭', '조명', '손잡이', '인조대리석', '금속유리', '설비', '목공자재', '인건비'];
const BRAND_COLORS = { '먼데이커피': '#f06060', '스토리오브라망': '#60a0f0', '공통': '#a0a0a0' };

export default function MarketPricePage({ readOnly = false }) {
  const { user } = useAuthStore();
  const isMaster = user?.role === 'master';
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [brand, setBrand] = useState('전체');
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forceSyncing, setForceSyncing] = useState(false);
  const [tab, setTab] = useState('list');
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [linkModal, setLinkModal] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingSelected, setPendingSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (brand !== '전체') params.brand = brand;
      if (category !== '전체') params.category = category;
      if (search) params.search = search;
      const res = await marketPricesApi.list(params);
      setItems(res.data.items);
      setSummary(res.data.summary);
    } catch { toast.error('시세 데이터 로드 실패'); }
    finally { setLoading(false); }
  }, [brand, category, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load all items for linking
  useEffect(() => { itemsApi.listAll().then(r => setAllItems(r.data)).catch(() => {}); }, []);

  const sorted = [...items].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleSeed = async () => {
    if (!window.confirm('시세 데이터를 초기화하시겠습니까?')) return;
    try {
      const res = await marketPricesApi.seed(true);
      toast.success(res.data.message);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || '초기화 실패'); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await marketPricesApi.refresh();
      toast.success(res.data.message);
      loadData();
      if (tab === 'compare') loadCompare();
      // Reload items list for compare tab
      itemsApi.listAll().then(r => setAllItems(r.data)).catch(() => {});
    } catch { toast.error('시세 갱신 실패'); }
    finally { setRefreshing(false); }
  };

  const handleForceSyncAll = async () => {
    if (!window.confirm('모든 연결된 시세를 아이템 단가에 강제 반영하시겠습니까?\n이 작업은 업체의 아이템 가격도 함께 변경됩니다.')) return;
    setForceSyncing(true);
    try {
      const res = await marketPricesApi.forceSyncAll({ priceType: 'avg' });
      toast.success(res.data.message);
      loadData();
      if (tab === 'compare') loadCompare();
      itemsApi.listAll().then(r => setAllItems(r.data)).catch(() => {});
    } catch (err) { toast.error(err.response?.data?.error || '강제 반영 실패'); }
    finally { setForceSyncing(false); }
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (brand !== '전체') params.brand = brand;
      if (category !== '전체') params.category = category;
      const res = await marketPricesApi.exportExcel(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.setAttribute('download', `market_prices_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('엑셀 다운로드 완료');
    } catch { toast.error('엑셀 다운로드 실패'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    try { await marketPricesApi.delete(id); toast.success('삭제됨'); loadData(); } catch { toast.error('삭제 실패'); }
  };

  const handleLink = async (mpId, itemId) => {
    try {
      await marketPricesApi.link(mpId, itemId);
      toast.success('아이템 연결 완료');
      loadData();
      if (tab === 'compare') loadCompare();
    } catch { toast.error('연결 실패'); }
  };

  const handleUnlink = async (mpId) => {
    try {
      await marketPricesApi.unlink(mpId);
      toast.success('연결 해제됨');
      loadData();
      if (tab === 'compare') loadCompare();
    } catch { toast.error('연결 해제 실패'); }
  };

  const loadCompare = async () => {
    setCompareLoading(true);
    try {
      const res = await marketPricesApi.compare();
      setCompareData(res.data);
    } catch { toast.error('비교 데이터 로드 실패'); }
    finally { setCompareLoading(false); }
  };

  useEffect(() => { if (tab === 'compare') loadCompare(); }, [tab]);

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const res = await marketPricesApi.pendingItems();
      setPendingItems(res.data);
      setPendingSelected(new Set());
    } catch (err) { toast.error(err.response?.data?.error || '미등록 아이템 로드 실패'); }
    finally { setPendingLoading(false); }
  };

  useEffect(() => { if (tab === 'pending' && isMaster) loadPending(); }, [tab, isMaster]);

  const togglePendingAll = () => {
    if (pendingSelected.size === pendingItems.length) setPendingSelected(new Set());
    else setPendingSelected(new Set(pendingItems.map(i => i.id)));
  };
  const togglePendingOne = (id) => {
    const next = new Set(pendingSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPendingSelected(next);
  };

  const handleImportSelected = async () => {
    if (pendingSelected.size === 0) { toast.error('가져올 아이템을 선택하세요.'); return; }
    if (!window.confirm(`선택한 ${pendingSelected.size}개 아이템을 시세 목록으로 가져오시겠습니까?`)) return;
    setImporting(true);
    try {
      const res = await marketPricesApi.importFromItems({ itemIds: Array.from(pendingSelected) });
      toast.success(res.data.message);
      loadPending();
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || '가져오기 실패'); }
    finally { setImporting(false); }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-500" /> : <ArrowDown size={12} className="text-blue-500" />;
  };

  const linkedCount = items.filter(i => i.linkedItemId).length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{readOnly ? '자재 시세 조회' : '자재 시세 관리'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{readOnly ? '실시간 자재 단가 트래킹 (읽기 전용)' : '실시간 자재 단가 트래킹 & 견적 단가 연동'}</p>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                <button onClick={handleSeed} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <Database size={14} /> 초기화
                </button>
                <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> 시세 갱신
                </button>
                {isMaster && (
                  <button onClick={handleForceSyncAll} disabled={forceSyncing}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">
                    <AlertTriangle size={14} /> {forceSyncing ? '반영 중...' : '강제 일괄 반영'}
                  </button>
                )}
              </>
            )}
            <button onClick={handleExport} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              <Download size={14} /> 엑셀
            </button>
            {!readOnly && (
              <button onClick={() => setEditModal('create')} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#0073ea] text-white font-medium hover:bg-[#0060c0]">
                <Plus size={14} /> 추가
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button onClick={() => setTab('list')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'list' ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <List size={15} /> 시세 목록
          </button>
          {!readOnly && (
            <button onClick={() => setTab('compare')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'compare' ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <GitCompare size={15} /> 단가 비교 & 반영
              {linkedCount > 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{linkedCount}연결</span>}
            </button>
          )}
          {isMaster && !readOnly && (
            <button onClick={() => setTab('pending')} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'pending' ? 'border-[#0073ea] text-[#0073ea]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Inbox size={15} /> 업체 추가 아이템 검토
              {pendingItems.length > 0 && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{pendingItems.length}</span>}
            </button>
          )}
        </div>

        {tab === 'list' ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <StatCard label="조회 품목" value={summary.totalCount || 0} icon={<BarChart3 size={18} />} color="#0073ea" />
              <StatCard label="평균 전월比" value={`${summary.avgChange > 0 ? '+' : ''}${summary.avgChange || 0}%`} icon={summary.avgChange >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} color={summary.avgChange >= 0 ? '#00c875' : '#f06060'} />
              <StatCard label="가격 상승" value={summary.upCount || 0} icon={<TrendingUp size={18} />} color="#f0a040" />
              <StatCard label="아이템 연결" value={linkedCount} icon={<Link2 size={18} />} color="#7c3aed" />
              <StatCard label="최종 업데이트" value={summary.latestDate || '-'} icon={<RefreshCw size={18} />} color="#666" />
            </div>

            {/* Brand Tabs */}
            <div className="flex gap-2 mb-4">
              {BRANDS.map(b => (
                <button key={b} onClick={() => setBrand(b)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${brand === b ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  style={brand === b ? { backgroundColor: BRAND_COLORS[b] || '#0073ea' } : {}}>
                  {b}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap items-center">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="자재명 검색..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0073ea]/20 focus:outline-none" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
              </div>
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === c ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {loading ? <div className="text-center py-16 text-gray-400">로딩 중...</div>
            : items.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Database size={40} className="mx-auto mb-3 text-gray-300" />
                <p>시세 데이터가 없습니다.</p>
                {!readOnly && <button onClick={handleSeed} className="mt-3 text-sm text-[#0073ea] hover:underline">데이터 초기화하기</button>}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                        <Th label="브랜드" k="brand" onSort={handleSort}><SortIcon k="brand" /></Th>
                        <Th label="자재명" k="name" onSort={handleSort}><SortIcon k="name" /></Th>
                        <th className="px-3 py-3 text-left">규격</th>
                        <Th label="카테고리" k="category" onSort={handleSort}><SortIcon k="category" /></Th>
                        <Th label="평균가" k="avgPrice" onSort={handleSort} right><SortIcon k="avgPrice" /></Th>
                        <th className="px-3 py-3 text-center">단위</th>
                        <Th label="전월比" k="changePct" onSort={handleSort} center><SortIcon k="changePct" /></Th>
                        <th className="px-3 py-3 text-left">연결 아이템</th>
                        {!readOnly && <th className="px-3 py-3 text-center w-20"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sorted.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: BRAND_COLORS[item.brand] || '#888' }}>
                              {item.brand === '먼데이커피' ? 'MC' : item.brand === '스토리오브라망' ? 'LM' : '공통'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">{item.name}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={item.spec}>{item.spec}</td>
                          <td className="px-3 py-2.5 text-gray-500">{item.category}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{item.avgPrice.toLocaleString()}<span className="text-xs text-gray-400 ml-0.5">원</span></td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{item.unit}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs font-medium ${item.changePct > 0 ? 'text-red-500' : item.changePct < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                              {item.changePct > 0 ? '+' : ''}{item.changePct}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {item.linkedItem ? (
                              <div className="flex items-center gap-1.5">
                                <Link2 size={12} className="text-green-500 shrink-0" />
                                <span className="text-xs text-gray-700 truncate max-w-[120px]" title={item.linkedItem.name}>{item.linkedItem.name}</span>
                                <span className="text-xs text-gray-400">({item.linkedItem.unitPrice?.toLocaleString()}원)</span>
                                {!readOnly && <button onClick={() => handleUnlink(item.id)} className="text-gray-300 hover:text-red-500 shrink-0" title="연결 해제"><Unlink size={11} /></button>}
                              </div>
                            ) : (
                              !readOnly ? (
                                <button onClick={() => setLinkModal(item)} className="text-xs text-gray-400 hover:text-[#0073ea] flex items-center gap-1">
                                  <Link2 size={11} /> 연결하기
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )
                            )}
                          </td>
                          {!readOnly && (
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setEditModal(item)} className="text-gray-400 hover:text-[#0073ea] p-1"><Edit2 size={13} /></button>
                                <button onClick={() => handleDelete(item.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400 border-t flex justify-between">
                  <span>총 {items.length}개 품목</span>
                  <span>{linkedCount}개 아이템 연결됨</span>
                </div>
              </div>
            )}
          </>
        ) : tab === 'compare' ? (
          <CompareTab data={compareData} loading={compareLoading} allItems={allItems}
            onLink={handleLink} onUnlink={handleUnlink}
            onReload={() => { loadCompare(); loadData(); }} />
        ) : (
          <PendingItemsTab
            items={pendingItems}
            loading={pendingLoading}
            selected={pendingSelected}
            onToggleAll={togglePendingAll}
            onToggleOne={togglePendingOne}
            onImport={handleImportSelected}
            onReload={loadPending}
            importing={importing}
          />
        )}
      </div>

      {editModal && (
        <MarketPriceModal item={editModal === 'create' ? null : editModal}
          onClose={() => setEditModal(null)} onSaved={() => { setEditModal(null); loadData(); }} />
      )}

      {linkModal && (
        <LinkModal marketPrice={linkModal} allItems={allItems}
          onClose={() => setLinkModal(null)}
          onLink={(itemId) => { handleLink(linkModal.id, itemId); setLinkModal(null); }} />
      )}
    </Layout>
  );
}

// ── Sub-components ──

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15', color }}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function Th({ label, k, onSort, children, right, center }) {
  return (
    <th className={`px-3 py-3 cursor-pointer select-none hover:bg-gray-100 transition-colors ${right ? 'text-right' : center ? 'text-center' : 'text-left'}`} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">{label} {children}</span>
    </th>
  );
}

// ── Link Modal ──

function LinkModal({ marketPrice, allItems, onClose, onLink }) {
  const [search, setSearch] = useState('');
  const filtered = allItems.filter(i => {
    if (!search) return true;
    return i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.category?.name && i.category.name.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">아이템 연결</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-sm font-medium text-gray-900">{marketPrice.name}</p>
          <p className="text-xs text-gray-500">{marketPrice.brand} · {marketPrice.category} · 평균 {marketPrice.avgPrice.toLocaleString()}원</p>
        </div>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="아이템 검색..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0073ea]/20 focus:outline-none" autoFocus />
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
          ) : filtered.map(item => (
            <button key={item.id} onClick={() => onLink(item.id)}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.category?.name} · {item.unitPrice.toLocaleString()}원/{item.unit}</p>
              </div>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Compare Tab ──

function CompareTab({ data, loading, allItems, onLink, onUnlink, onReload }) {
  const [filter, setFilter] = useState('all');
  const [priceType, setPriceType] = useState('avg');
  const [syncing, setSyncing] = useState(false);

  if (loading || !data) return <div className="text-center py-16 text-gray-400">비교 데이터 로딩 중...</div>;

  const { comparisons, totalLinked, totalUnlinked } = data;
  const filtered = comparisons.filter(c => {
    if (filter === 'linked') return c.linked;
    if (filter === 'unlinked') return !c.linked;
    if (filter === 'diff') return c.linked && c.diff !== null && c.diff !== 0;
    return true;
  });
  const diffCount = comparisons.filter(c => c.linked && c.diff !== null && c.diff !== 0).length;

  const handleBulkSync = async () => {
    const toSync = comparisons.filter(c => c.linked && c.diff !== null && c.diff !== 0);
    if (toSync.length === 0) return toast.error('반영할 항목이 없습니다.');
    if (!window.confirm(`${toSync.length}개 연결 항목의 단가를 시세 ${priceType === 'min' ? '최저가' : priceType === 'max' ? '최대가' : '평균가'}로 일괄 반영하시겠습니까?`)) return;
    setSyncing(true);
    try {
      const ids = toSync.map(c => c.marketPrice.id);
      const res = await marketPricesApi.syncToItems({ marketPriceIds: ids, priceType });
      toast.success(res.data.message);
      onReload();
    } catch (err) { toast.error(err.response?.data?.error || '반영 실패'); }
    finally { setSyncing(false); }
  };

  const handleSingleSync = async (mpId) => {
    try {
      const res = await marketPricesApi.syncToItems({ marketPriceIds: [mpId], priceType });
      toast.success(res.data.message);
      onReload();
    } catch (err) { toast.error(err.response?.data?.error || '반영 실패'); }
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>전체 ({comparisons.length})</button>
          <button onClick={() => setFilter('linked')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'linked' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <span className="inline-flex items-center gap-1"><Link2 size={11} /> 연결됨 ({totalLinked})</span>
          </button>
          <button onClick={() => setFilter('unlinked')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'unlinked' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            <span className="inline-flex items-center gap-1"><Unlink size={11} /> 미연결 ({totalUnlinked})</span>
          </button>
          {diffCount > 0 && (
            <button onClick={() => setFilter('diff')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'diff' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              차이 있음 ({diffCount})
            </button>
          )}
        </div>

        {diffCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">기준:</span>
            <div className="flex gap-1">
              {[['min', '최저가'], ['avg', '평균가'], ['max', '최대가']].map(([v, l]) => (
                <button key={v} onClick={() => setPriceType(v)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${priceType === v ? 'bg-[#0073ea] text-white' : 'bg-gray-100 text-gray-500'}`}>{l}</button>
              ))}
            </div>
            <button onClick={handleBulkSync} disabled={syncing}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50">
              <Zap size={13} /> 일괄 반영 ({diffCount}건)
            </button>
          </div>
        )}
      </div>

      {/* Compare Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 uppercase">
              <th className="px-4 py-3 text-center w-10">상태</th>
              <th className="px-4 py-3 text-left">시세 자재</th>
              <th className="px-4 py-3 text-right">시세가</th>
              <th className="px-4 py-3 text-center w-8"></th>
              <th className="px-4 py-3 text-left">견적 아이템</th>
              <th className="px-4 py-3 text-right">견적 단가</th>
              <th className="px-4 py-3 text-center">차이</th>
              <th className="px-4 py-3 text-center w-24">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((c, i) => {
              const mp = c.marketPrice;
              const targetPrice = priceType === 'min' ? mp.minPrice : priceType === 'max' ? mp.maxPrice : mp.avgPrice;
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-center">
                    {c.linked ? <Link2 size={14} className="text-green-500 mx-auto" /> : <Unlink size={14} className="text-gray-300 mx-auto" />}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{mp.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: BRAND_COLORS[mp.brand] || '#888' }} />
                      {mp.brand} · {mp.category}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="font-semibold">{targetPrice.toLocaleString()}<span className="text-xs text-gray-400">원</span></div>
                    <div className="text-xs text-gray-400">{mp.minPrice.toLocaleString()} ~ {mp.maxPrice.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-300"><ChevronRight size={14} /></td>
                  <td className="px-4 py-2.5">
                    {c.linked ? (
                      <div>
                        <div className="text-gray-900">{c.linked.name}</div>
                        <div className="text-xs text-gray-400">{c.linked.category} · v{c.linked.version}</div>
                      </div>
                    ) : c.suggestions?.length > 0 ? (
                      <div className="space-y-1">
                        {c.suggestions.map(s => (
                          <button key={s.id} onClick={() => onLink(mp.id, s.id)}
                            className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <Link2 size={10} /> {s.name} ({s.unitPrice.toLocaleString()}원)
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">매칭 없음</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.linked ? <span className="font-semibold">{c.linked.unitPrice.toLocaleString()}<span className="text-xs text-gray-400">원</span></span> : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.diff !== null ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.diff > 5 ? 'bg-red-100 text-red-600' : c.diff > 0 ? 'bg-red-50 text-red-500' : c.diff < -5 ? 'bg-blue-100 text-blue-600' : c.diff < 0 ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'}`}>
                        {c.diff === 0 ? '일치' : `${c.diff > 0 ? '+' : ''}${c.diff}%`}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {c.linked ? (
                      <div className="flex items-center gap-1 justify-center">
                        {c.diff !== 0 && c.diff !== null && (
                          <button onClick={() => handleSingleSync(mp.id)} className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded font-medium">반영</button>
                        )}
                        <button onClick={() => onUnlink(mp.id)} className="text-gray-300 hover:text-red-400 p-1" title="연결 해제"><Unlink size={12} /></button>
                      </div>
                    ) : (
                      <LinkDropdown mpId={mp.id} allItems={allItems} onLink={onLink} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinkDropdown({ mpId, allItems, onLink }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = allItems.filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="text-xs text-gray-400 hover:text-[#0073ea] flex items-center gap-0.5">
        <Link2 size={11} /> 연결
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="아이템 검색..." autoFocus
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs mb-1 focus:outline-none focus:ring-1 focus:ring-[#0073ea]/30" />
            <div className="max-h-40 overflow-y-auto">
              {filtered.map(item => (
                <button key={item.id} onClick={() => { onLink(mpId, item.id); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 hover:bg-blue-50 rounded text-xs transition-colors">
                  <div className="font-medium text-gray-800">{item.name}</div>
                  <div className="text-gray-400">{item.unitPrice.toLocaleString()}원/{item.unit}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Edit/Create Modal ──

function MarketPriceModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    brand: item?.brand || '먼데이커피',
    name: item?.name || '',
    spec: item?.spec || '',
    category: item?.category || '도장',
    unit: item?.unit || '㎡',
    minPrice: item?.minPrice || '',
    maxPrice: item?.maxPrice || '',
    changePct: item?.changePct || 0,
    source: item?.source || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.minPrice || !form.maxPrice) return toast.error('필수 항목을 입력하세요.');
    setSaving(true);
    try {
      if (item) {
        const res = await marketPricesApi.update(item.id, form);
        if (res.data.syncResult) {
          toast.success(`수정됨 → 아이템 "${res.data.syncResult.itemName}" 단가 ${res.data.syncResult.oldPrice.toLocaleString()}→${res.data.syncResult.newPrice.toLocaleString()}원 자동 반영`, { duration: 5000 });
        } else {
          toast.success('수정됨');
        }
      } else {
        await marketPricesApi.create(form);
        toast.success('추가됨');
      }
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || '저장 실패'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-4">{item ? '시세 항목 수정' : '새 시세 항목'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">브랜드 *</label>
              <select value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={inputCls}>
                <option value="먼데이커피">먼데이커피</option><option value="스토리오브라망">스토리오브라망</option><option value="공통">공통</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">카테고리 *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {CATEGORIES.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">자재명 *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">규격</label>
            <input value={form.spec} onChange={e => setForm(f => ({ ...f, spec: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">최저가 *</label>
              <input type="number" value={form.minPrice} onChange={e => setForm(f => ({ ...f, minPrice: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">최대가 *</label>
              <input type="number" value={form.maxPrice} onChange={e => setForm(f => ({ ...f, maxPrice: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">단위</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className={inputCls}>
                {['㎡', 'm', 'EA', '식', '인/일', '박스', '통', '매'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">전월比 (%)</label>
              <input type="number" step="0.1" value={form.changePct} onChange={e => setForm(f => ({ ...f, changePct: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">출처</label>
              <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">취소</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#0073ea] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#0060c0] disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]';

// ── Pending Items Tab (업체 추가 아이템 → 시세 역가져오기) ──
function PendingItemsTab({ items, loading, selected, onToggleAll, onToggleOne, onImport, onReload, importing }) {
  if (loading) return <div className="text-center py-16 text-gray-400">로딩 중...</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-orange-50">
        <div className="flex items-center gap-2 text-sm text-orange-700">
          <Inbox size={16} />
          <span className="font-medium">아직 시세에 등록되지 않은 아이템 {items.length}건</span>
          <span className="text-xs text-orange-500">— 업체가 등록한 아이템을 마스터가 시세 항목으로 가져올 수 있습니다.</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onReload} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white">
            <RefreshCw size={12} /> 새로고침
          </button>
          <button
            onClick={onImport}
            disabled={selected.size === 0 || importing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#0073ea] text-white font-medium hover:bg-[#0060c0] disabled:opacity-50"
          >
            <ChevronRight size={12} />
            {importing ? '가져오는 중...' : `선택 ${selected.size}개 시세로 가져오기`}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare size={40} className="mx-auto mb-3 text-gray-300" />
          <p>모든 아이템이 시세에 등록되어 있습니다.</p>
          <p className="text-xs text-gray-400 mt-1">업체에서 아이템을 새로 추가하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                <th className="px-3 py-3 w-10">
                  <button onClick={onToggleAll} className="text-gray-400 hover:text-gray-700">
                    {selected.size === items.length && items.length > 0
                      ? <CheckSquare size={16} className="text-[#0073ea]" />
                      : <Square size={16} />}
                  </button>
                </th>
                <th className="px-3 py-3 text-left">브랜드</th>
                <th className="px-3 py-3 text-left">아이템명</th>
                <th className="px-3 py-3 text-left">카테고리</th>
                <th className="px-3 py-3 text-left">단위</th>
                <th className="px-3 py-3 text-right">단가</th>
                <th className="px-3 py-3 text-left">설명/규격</th>
                <th className="px-3 py-3 text-center">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(it => {
                const checked = selected.has(it.id);
                return (
                  <tr
                    key={it.id}
                    className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${checked ? 'bg-blue-50/60' : ''}`}
                    onClick={() => onToggleOne(it.id)}
                  >
                    <td className="px-3 py-2.5">
                      {checked
                        ? <CheckSquare size={16} className="text-[#0073ea]" />
                        : <Square size={16} className="text-gray-300" />}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{it.brand || '공통'}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{it.name}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{it.category?.name || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{it.unit}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {Number(it.unitPrice).toLocaleString()}<span className="text-xs text-gray-400 ml-0.5">원</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[280px] truncate" title={it.description}>
                      {it.description || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400">
                      {it.createdAt ? new Date(it.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
