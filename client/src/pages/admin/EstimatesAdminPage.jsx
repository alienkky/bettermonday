import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react';

const fmt = (n) => Math.round(n || 0).toLocaleString('ko-KR');

const STATUS_MAP = {
  draft: { label: '임시저장', color: 'text-gray-500 bg-gray-100', icon: <Clock size={12} /> },
  submitted: { label: '본사확인', color: 'text-orange-600 bg-orange-100', icon: <AlertCircle size={12} /> },
  approved: { label: '승인완료', color: 'text-green-700 bg-green-100', icon: <CheckCircle2 size={12} /> },
};

export default function EstimatesAdminPage() {
  const [estimates, setEstimates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [noteInput, setNoteInput] = useState('');
  const [statusInput, setStatusInput] = useState('');

  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.estimates({ page, limit, status: statusFilter || undefined });
      setEstimates(res.data.estimates);
      setTotal(res.data.total);
    } catch {
      toast.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const openEdit = (est) => {
    setEditModal(est);
    setNoteInput(est.adminNote || '');
    setStatusInput(est.status);
  };

  const handleSave = async () => {
    try {
      await adminApi.updateEstimate(editModal.id, { status: statusInput, adminNote: noteInput });
      toast.success('업데이트되었습니다.');
      setEditModal(null);
      load();
    } catch {
      toast.error('업데이트 실패');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">견적 관리</h1>
            <p className="text-sm text-gray-400 mt-0.5">전체 {total}건</p>
          </div>

          {/* Status filter */}
          <div className="flex gap-2">
            {[['', '전체'], ['draft', '임시저장'], ['submitted', '본사확인'], ['approved', '승인완료']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => { setStatusFilter(val); setPage(1); }}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  statusFilter === val ? 'bg-[#0073ea] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">업체</th>
                  <th className="px-4 py-3 text-left">공간</th>
                  <th className="px-4 py-3 text-right">견적 금액</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">버전</th>
                  <th className="px-4 py-3 text-center">일자</th>
                  <th className="px-4 py-3 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {estimates.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">견적이 없습니다.</td></tr>
                )}
                {estimates.map((est) => {
                  const s = STATUS_MAP[est.status];
                  return (
                    <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1a1a1a]">{est.customer?.name}</p>
                        <p className="text-xs text-gray-400">{est.customer?.email}</p>
                        {est.contactPhone && <p className="text-xs text-gray-400">{est.contactPhone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[#1a1a1a]">{est.space?.name}</p>
                        <p className="text-xs text-gray-400">{est.space?.areaSqm?.toFixed(1)}m²</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-[#1a1a1a]">{fmt(est.totalCostVat)}원</p>
                        <p className="text-xs text-gray-400">VAT포함</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.color}`}>
                          {s.icon} {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-400">v{est.versionLabel}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-400">
                        {new Date(est.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openEdit(est)} className="text-xs text-[#0073ea] hover:underline px-2 py-1 rounded hover:bg-blue-50">
                          관리
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-[#1a1a1a]">견적 관리</h2>
                <p className="text-sm text-gray-400">{editModal.customer?.name} · {editModal.space?.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태 변경</label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
                >
                  <option value="draft">임시저장</option>
                  <option value="submitted">본사확인</option>
                  <option value="approved" disabled>승인완료 (본사만 가능)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">관리자 메모</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  rows={3}
                  placeholder="내부 메모 작성..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditModal(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleSave} className="flex-1 bg-[#0073ea] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#0060c0]">저장</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
