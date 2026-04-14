import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight,
  Shield, Megaphone, FileText, Eye, Trash2, X
} from 'lucide-react';

const ConsentBadge = ({ ok, label }) => (
  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
    {ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
    {label}
  </span>
);

const CONSENT_TYPE_LABELS = { terms: '이용약관', privacy: '개인정보', marketing: '마케팅' };
const CONSENT_ACTION_LABELS = { agree: '동의', withdraw: '철회' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | marketing
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [consentLogs, setConsentLogs] = useState([]);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [noteEdit, setNoteEdit] = useState({ id: null, value: '' });

  const limit = 20;

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await adminApi.customers({ page, limit });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch {
      toast.error('고객 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, [page]);

  const handleViewConsentLogs = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const res = await adminApi.customerConsentLogs(customer.id);
      setConsentLogs(res.data);
      setConsentModalOpen(true);
    } catch {
      toast.error('동의 이력 조회 실패');
    }
  };

  const handleAnonymize = async (customer) => {
    if (!confirm(`${customer.name}님의 개인정보를 익명화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await adminApi.anonymizeCustomer(customer.id);
      toast.success('개인정보가 익명화되었습니다.');
      loadCustomers();
    } catch {
      toast.error('익명화 처리 실패');
    }
  };

  const handleSaveNote = async (id) => {
    try {
      await adminApi.updateCustomer(id, { note: noteEdit.value });
      setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, note: noteEdit.value } : c));
      setNoteEdit({ id: null, value: '' });
      toast.success('메모가 저장되었습니다.');
    } catch {
      toast.error('저장 실패');
    }
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'marketing' && c.consentMarketing);
    return matchSearch && matchFilter;
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">고객 관리</h1>
            <p className="text-sm text-gray-400 mt-0.5">전체 {total}명</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter(filter === 'marketing' ? 'all' : 'marketing')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                filter === 'marketing' ? 'bg-[#0073ea] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Megaphone size={14} />
              마케팅 동의만
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일로 검색"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">고객</th>
                  <th className="px-4 py-3 text-left">연락처</th>
                  <th className="px-4 py-3 text-center">동의 현황</th>
                  <th className="px-4 py-3 text-center">동의 일시</th>
                  <th className="px-4 py-3 text-center">견적/공간</th>
                  <th className="px-4 py-3 text-left">메모</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">검색 결과가 없습니다.</td></tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.isActive ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#f5f6f8] rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                          {c.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-[#1a1a1a]">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 justify-center">
                        <ConsentBadge ok={c.consentPrivacy} label="개인정보" />
                        <ConsentBadge ok={c.consentTerms} label="약관" />
                        <ConsentBadge ok={c.consentMarketing} label="마케팅" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                      {c.consentAt ? new Date(c.consentAt).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {c._count?.estimates || 0}건 / {c._count?.spaces || 0}개
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      {noteEdit.id === c.id ? (
                        <div className="flex gap-1">
                          <input
                            value={noteEdit.value}
                            onChange={(e) => setNoteEdit((n) => ({ ...n, value: e.target.value }))}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#0073ea]"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveNote(c.id)}
                            autoFocus
                          />
                          <button onClick={() => handleSaveNote(c.id)} className="text-[#0073ea] text-xs px-1">저장</button>
                          <button onClick={() => setNoteEdit({ id: null, value: '' })} className="text-gray-400 text-xs px-1">취소</button>
                        </div>
                      ) : (
                        <span
                          onClick={() => setNoteEdit({ id: c.id, value: c.note || '' })}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer truncate block"
                          title={c.note || '메모 추가...'}
                        >
                          {c.note || <span className="italic">메모 추가...</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {c.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => handleViewConsentLogs(c)}
                          className="p-1.5 text-gray-400 hover:text-[#0073ea] rounded hover:bg-blue-50 transition-colors"
                          title="동의 이력"
                        >
                          <Shield size={14} />
                        </button>
                        {c.isActive && (
                          <button
                            onClick={() => handleAnonymize(c)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                            title="개인정보 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Consent Log Modal */}
      {consentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-[#1a1a1a]">동의 이력</h2>
                <p className="text-sm text-gray-400">{selectedCustomer.name} ({selectedCustomer.email})</p>
              </div>
              <button onClick={() => setConsentModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            {/* Current state */}
            <div className="bg-[#f5f6f8] rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">현재 동의 현황</p>
              <div className="flex gap-2 flex-wrap">
                <ConsentBadge ok={selectedCustomer.consentPrivacy} label="개인정보 수집" />
                <ConsentBadge ok={selectedCustomer.consentTerms} label="서비스 이용약관" />
                <ConsentBadge ok={selectedCustomer.consentMarketing} label="마케팅 수신" />
              </div>
              {selectedCustomer.consentAt && (
                <p className="text-xs text-gray-400 mt-2">
                  동의 일시: {new Date(selectedCustomer.consentAt).toLocaleString('ko-KR')}
                  {selectedCustomer.consentIp && ` · IP: ${selectedCustomer.consentIp}`}
                </p>
              )}
            </div>

            {/* Log table */}
            <p className="text-xs font-semibold text-gray-500 mb-2">변경 이력</p>
            {consentLogs.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">이력이 없습니다.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2">동의 유형</th>
                    <th className="text-left pb-2">액션</th>
                    <th className="text-left pb-2">IP</th>
                    <th className="text-left pb-2">일시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {consentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2">{CONSENT_TYPE_LABELS[log.consentType]}</td>
                      <td className="py-2">
                        <span className={`px-1.5 py-0.5 rounded-full ${log.action === 'agree' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {CONSENT_ACTION_LABELS[log.action]}
                        </span>
                      </td>
                      <td className="py-2 text-gray-400">{log.ipAddress || '-'}</td>
                      <td className="py-2 text-gray-400">{new Date(log.createdAt).toLocaleString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
