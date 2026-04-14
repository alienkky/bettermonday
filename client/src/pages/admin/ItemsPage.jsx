import { useEffect, useState } from 'react';
import { itemsApi, categoriesApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Plus, Edit2, ToggleLeft, ToggleRight, Upload, Trash2, Power, PowerOff, DollarSign, X, Download, FileSpreadsheet } from 'lucide-react';

const UNIT_LABELS = { m2: 'm²', m: 'm', ea: '개', set: '세트', day: '인/일', box: '박스', unit: '매' };
const CAT_LABELS = {
  painting: '도장', film: '필름', tile: '타일', fabric: '패브릭',
  lighting: '조명', hardware: '손잡이', stone: '인조대리석', metalwork: '금속유리',
  plumbing: '설비/배관', woodwork: '목공자재', labor: '인건비',
};

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState({ category: '', active: 'true' });
  const [selected, setSelected] = useState(new Set());
  const [bulkPrice, setBulkPrice] = useState(null); // null = hidden, '' = shown
  const [importModal, setImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadItems = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([itemsApi.listAll(), categoriesApi.list()]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
    } catch {
      toast.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const handleToggle = async (item) => {
    try {
      await itemsApi.toggle(item.id);
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
      toast.success(item.isActive ? '비활성화 되었습니다.' : '활성화 되었습니다.');
    } catch {
      toast.error('상태 변경 실패');
    }
  };

  const filtered = items.filter((item) => {
    if (filter.category && item.category?.name !== filter.category) return false;
    if (filter.active !== '' && String(item.isActive) !== filter.active) return false;
    return true;
  });

  // ── Selection helpers ──
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const clearSelection = () => { setSelected(new Set()); setBulkPrice(null); };

  // ── Bulk actions ──
  const handleBulk = async (action, unitPrice) => {
    const ids = [...selected];
    if (ids.length === 0) return;

    if (action === 'delete' && !window.confirm(`${ids.length}개 아이템을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const payload = { ids, action };
      if (action === 'price') payload.unitPrice = unitPrice;
      const res = await itemsApi.bulk(payload);
      toast.success(res.data.message);
      clearSelection();
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || '일괄 처리 실패');
    }
  };

  // ── Excel export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await itemsApi.exportExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `items_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('엑셀 다운로드 완료');
    } catch {
      toast.error('엑셀 다운로드 실패');
    } finally {
      setExporting(false);
    }
  };

  // ── Excel import ──
  const handleImport = async (file) => {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await itemsApi.importExcel(fd);
      setImportResult(res.data);
      toast.success(res.data.message);
      loadItems();
    } catch (err) {
      const msg = err.response?.data?.error || '엑셀 업로드 실패';
      setImportResult({ error: msg });
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const allChecked = filtered.length > 0 && selected.size === filtered.length;
  const someChecked = selected.size > 0;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a1a]">아이템 단가 관리</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={15} /> {exporting ? '다운로드 중...' : '엑셀 다운로드'}
            </button>
            <button
              onClick={() => { setImportModal(true); setImportResult(null); }}
              className="flex items-center gap-2 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50"
            >
              <FileSpreadsheet size={15} /> 엑셀 업로드
            </button>
            <button
              onClick={() => setModal('create')}
              className="flex items-center gap-2 bg-[#0073ea] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0060c0]"
            >
              <Plus size={15} /> 아이템 추가
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            value={filter.category}
            onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
          >
            <option value="">전체 카테고리</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{CAT_LABELS[c.name]}</option>)}
          </select>
          <select
            value={filter.active}
            onChange={(e) => setFilter((f) => ({ ...f, active: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
          >
            <option value="">전체</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {someChecked && (
          <div className="flex items-center gap-3 mb-4 bg-[#0073ea]/5 border border-[#0073ea]/20 rounded-xl px-4 py-3 flex-wrap">
            <span className="text-sm font-medium text-[#0073ea]">{selected.size}개 선택</span>
            <div className="w-px h-5 bg-[#0073ea]/20" />
            <button onClick={() => handleBulk('activate')} className="flex items-center gap-1.5 text-sm text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-colors">
              <Power size={14} /> 활성화
            </button>
            <button onClick={() => handleBulk('deactivate')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
              <PowerOff size={14} /> 비활성화
            </button>
            <button onClick={() => setBulkPrice(bulkPrice === null ? '' : null)} className="flex items-center gap-1.5 text-sm text-[#0073ea] hover:bg-[#0073ea]/10 px-3 py-1.5 rounded-lg transition-colors">
              <DollarSign size={14} /> 단가 변경
            </button>
            <button onClick={() => handleBulk('delete')} className="flex items-center gap-1.5 text-sm text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
              <Trash2 size={14} /> 삭제
            </button>

            {bulkPrice !== null && (
              <form
                onSubmit={(e) => { e.preventDefault(); if (bulkPrice) handleBulk('price', bulkPrice); }}
                className="flex items-center gap-2 ml-2"
              >
                <input
                  type="number" min="0" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
                  placeholder="변경할 단가 (원)"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
                  autoFocus
                />
                <button type="submit" disabled={!bulkPrice} className="bg-[#0073ea] text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-40">
                  적용
                </button>
              </form>
            )}

            <button onClick={clearSelection} className="ml-auto text-gray-400 hover:text-gray-600 p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-10">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll}
                      className="rounded border-gray-300 text-[#0073ea] focus:ring-[#0073ea]/30" />
                  </th>
                  <th className="px-4 py-3 text-left">브랜드</th>
                  <th className="px-4 py-3 text-left">카테고리</th>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-right">단가</th>
                  <th className="px-4 py-3 text-center">단위</th>
                  <th className="px-4 py-3 text-center">필수</th>
                  <th className="px-4 py-3 text-center">버전</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
                  <tr key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${!item.isActive ? 'opacity-50' : ''} ${selected.has(item.id) ? 'bg-[#0073ea]/5' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300 text-[#0073ea] focus:ring-[#0073ea]/30" />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.brand === '먼데이커피' ? 'bg-amber-50 text-amber-700' :
                        item.brand === '스토리오브라망' ? 'bg-purple-50 text-purple-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{item.brand || '공통'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{CAT_LABELS[item.category?.name] || item.category?.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.imageUrl && <img src={item.imageUrl} alt="" className="w-6 h-6 rounded object-cover" title="평면도" />}
                        {item.isoImageUrl && <img src={item.isoImageUrl} alt="" className="w-6 h-6 rounded object-cover border border-blue-200" title="아이소" />}
                        <span className="font-medium text-[#1a1a1a]">{item.name}</span>
                        {item.tileSize && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.tileSize}mm</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{item.unitPrice.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {UNIT_LABELS[item.unit]}
                      {item.areaBasis && (
                        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${item.areaBasis === 'wall' ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'}`}>
                          {item.areaBasis === 'wall' ? '벽' : '바닥'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.isRequired ? <span className="text-orange-500 text-xs bg-orange-50 px-2 py-0.5 rounded-full">필수</span> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">v{item.version}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(item)} className="text-gray-400 hover:text-[#0073ea]">
                        {item.isActive ? <ToggleRight size={20} className="text-[#0073ea]" /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setModal(item)} className="text-gray-400 hover:text-[#0073ea] p-1">
                        <Edit2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ItemModal
          item={modal === 'create' ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadItems(); }}
        />
      )}

      {importModal && (
        <ExcelImportModal
          importing={importing}
          importResult={importResult}
          onImport={handleImport}
          onClose={() => { setImportModal(false); setImportResult(null); }}
        />
      )}
    </Layout>
  );
}

function ItemModal({ item, categories, onClose, onSaved }) {
  const [form, setForm] = useState({
    categoryId: item?.categoryId || '',
    name: item?.name || '',
    brand: item?.brand || '공통',
    unit: item?.unit || 'm2',
    unitPrice: item?.unitPrice || '',
    description: item?.description || '',
    isRequired: item?.isRequired || false,
    width: item?.width || '',
    height: item?.height || '',
    tileSize: item?.tileSize || '',
    areaBasis: item?.areaBasis || '',
  });
  const [file, setFile] = useState(null);
  const [isoFile, setIsoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Determine if selected category is flooring
  const selectedCat = categories.find(c => c.id === form.categoryId);
  const isFlooring = selectedCat?.name === 'tile';

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
  };

  const handleTileSizeChange = (e) => {
    const ts = e.target.value;
    const sizeM = ts ? parseInt(ts) / 1000 : '';  // mm → m
    setForm((f) => ({ ...f, tileSize: ts, width: sizeM, height: sizeM }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categoryId || !form.name || !form.unitPrice) return toast.error('필수 항목을 입력하세요.');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('image', file);
      if (isoFile) fd.append('isoImage', isoFile);

      if (item) {
        await itemsApi.update(item.id, fd);
        toast.success('수정되었습니다.');
      } else {
        await itemsApi.create(fd);
        toast.success('아이템이 추가되었습니다.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-[#1a1a1a] mb-4">{item ? '아이템 수정' : '새 아이템 추가'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <MF label="카테고리 *">
            <select name="categoryId" value={form.categoryId} onChange={handleChange} className={inputCls}>
              <option value="">선택하세요</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{CAT_LABELS[c.name]}</option>)}
            </select>
          </MF>
          <div className="grid grid-cols-2 gap-4">
            <MF label="아이템 이름 *">
              <input name="name" value={form.name} onChange={handleChange} className={inputCls} />
            </MF>
            <MF label="브랜드">
              <select name="brand" value={form.brand} onChange={handleChange} className={inputCls}>
                <option value="공통">공통</option>
                <option value="먼데이커피">먼데이커피</option>
                <option value="스토리오브라망">스토리오브라망</option>
              </select>
            </MF>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MF label="단위 *">
              <select name="unit" value={form.unit} onChange={handleChange} className={inputCls}>
                <option value="m2">m² (면적)</option>
                <option value="m">m (길이)</option>
                <option value="ea">개 (수량)</option>
                <option value="set">세트/식</option>
                <option value="day">인/일</option>
                <option value="box">박스</option>
                <option value="unit">매/통</option>
              </select>
            </MF>
            <MF label="단가 (원) *">
              <input name="unitPrice" type="number" min="0" value={form.unitPrice} onChange={handleChange} className={inputCls} />
            </MF>
          </div>
          {form.unit === 'm2' && (
            <MF label="면적 자동계산 기준">
              <select name="areaBasis" value={form.areaBasis} onChange={handleChange} className={inputCls}>
                <option value="">수동 입력</option>
                <option value="floor">바닥 면적 (가로×세로)</option>
                <option value="wall">벽 면적 (둘레×높이)</option>
              </select>
            </MF>
          )}
          <MF label="설명">
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={inputCls} />
          </MF>
          {isFlooring && (
            <MF label="타일 크기">
              <select name="tileSize" value={form.tileSize} onChange={handleTileSizeChange} className={inputCls}>
                <option value="">선택 안 함</option>
                <option value="300">300×300 mm</option>
                <option value="600">600×600 mm</option>
              </select>
            </MF>
          )}
          <div className="grid grid-cols-2 gap-4">
            <MF label="가로 크기 (m, 선택)">
              <input name="width" type="number" step="0.1" value={form.width} onChange={handleChange} className={inputCls} placeholder="0.8" disabled={isFlooring && !!form.tileSize} />
            </MF>
            <MF label="세로 크기 (m, 선택)">
              <input name="height" type="number" step="0.1" value={form.height} onChange={handleChange} className={inputCls} placeholder="0.6" disabled={isFlooring && !!form.tileSize} />
            </MF>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MF label="평면도 이미지">
              <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                <Upload size={15} />
                <span className="truncate">{file ? file.name : (item?.imageUrl ? '변경하기' : '2D 이미지')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
              </label>
              {!file && item?.imageUrl && <img src={item.imageUrl} alt="" className="mt-1 w-10 h-10 rounded object-cover border" />}
            </MF>
            <MF label="아이소메트릭 이미지">
              <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                <Upload size={15} />
                <span className="truncate">{isoFile ? isoFile.name : (item?.isoImageUrl ? '변경하기' : '3D 이미지')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setIsoFile(e.target.files[0])} />
              </label>
              {!isoFile && item?.isoImageUrl && <img src={item.isoImageUrl} alt="" className="mt-1 w-10 h-10 rounded object-cover border" />}
            </MF>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isRequired" checked={form.isRequired} onChange={handleChange} className="rounded" />
            <span>필수 항목 (자동 배치, 삭제 불가)</span>
          </label>
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

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]';

function MF({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ExcelImportModal({ importing, importResult, onImport, onClose }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f);
    } else {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
    }
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#1a1a1a] flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-green-600" />
            엑셀 파일 업로드
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="text-sm text-gray-500 mb-4 bg-gray-50 rounded-lg p-3 space-y-1">
          <p>• 먼저 <strong>엑셀 다운로드</strong>로 현재 단가표를 받으세요.</p>
          <p>• 엑셀에서 단가를 수정한 후 이곳에 업로드하면 일괄 반영됩니다.</p>
          <p>• ID가 있는 행은 수정, ID가 없으면 신규 추가됩니다.</p>
          <p>• 가격 변경 시 버전이 자동으로 올라갑니다.</p>
        </div>

        {!importResult ? (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet size={32} className="text-green-600" />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={() => setFile(null)}
                    className="text-xs text-red-500 hover:underline mt-1"
                  >
                    파일 변경
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={32} className="text-gray-300" />
                  <p className="text-sm text-gray-500">엑셀 파일을 드래그하거나 클릭하여 선택</p>
                  <label className="mt-2 text-sm text-[#0073ea] hover:underline cursor-pointer">
                    파일 선택
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => file && onImport(file)}
                disabled={!file || importing}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg>
                    처리 중...
                  </>
                ) : '업로드 및 적용'}
              </button>
            </div>
          </>
        ) : importResult.error ? (
          <div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {importResult.error}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setFile(null); onClose(); }} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">닫기</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-green-800">{importResult.message}</p>
              <div className="flex gap-4 text-sm">
                <span className="text-blue-600">수정: <strong>{importResult.updated}</strong>개</span>
                <span className="text-green-600">신규: <strong>{importResult.created}</strong>개</span>
                <span className="text-gray-500">건너뜀: <strong>{importResult.skipped}</strong>개</span>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs font-medium text-yellow-700 mb-1">오류 상세 ({importResult.errors.length}건)</p>
                <ul className="text-xs text-yellow-600 space-y-0.5 max-h-32 overflow-y-auto">
                  {importResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="flex-1 bg-[#0073ea] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#0060c0]">확인</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
