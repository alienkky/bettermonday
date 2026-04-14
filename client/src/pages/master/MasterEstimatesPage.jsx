import { useEffect, useState, useCallback } from 'react';
import { masterApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_KO = { draft: '임시저장', submitted: '본사확인', approved: '승인완료' };
const STATUS_COLOR = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-50 text-amber-600',
  approved: 'bg-green-50 text-green-600',
};

export default function MasterEstimatesPage() {
  const [estimates, setEstimates] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const limit = 20;

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filter) params.status = filter;
      const res = await masterApi.estimates(params);
      setEstimates(res.data.estimates);
      setTotal(res.data.total);
    } catch {
      toast.error('견적 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  const handleStatusChange = async (id, newStatus) => {
    try {
      await masterApi.updateEstimate(id, { status: newStatus });
      toast.success('상태가 변경되었습니다.');
      fetchEstimates();
    } catch {
      toast.error('상태 변경 실패');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">전체 견적 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {total}건</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: '', label: '전체' },
            { key: 'draft', label: '임시저장' },
            { key: 'submitted', label: '본사확인' },
            { key: 'approved', label: '승인완료' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setFilter(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-3 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : estimates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">견적이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">고객</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">공간</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">브랜드</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">견적금액</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">날짜</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {estimates.map((e) => (
                  <>
                    <tr key={e.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{e.customer?.name || '(삭제됨)'}</p>
                        <p className="text-xs text-gray-400">{e.customer?.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{e.space?.name}</p>
                        <p className="text-xs text-gray-400">{e.space?.areaSqm}m²</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          e.space?.brand === '먼데이커피' ? 'bg-amber-50 text-amber-600' :
                          e.space?.brand === '스토리오브라망' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {e.space?.brand || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {(e.totalCostVat || 0).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={e.status}
                          onChange={(ev) => handleStatusChange(e.id, ev.target.value)}
                          className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLOR[e.status]}`}
                        >
                          <option value="draft">임시저장</option>
                          <option value="submitted">본사확인</option>
                          <option value="approved">승인완료</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(e.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                          className="p-1 rounded text-gray-400 hover:text-violet-600"
                        >
                          {expandedId === e.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === e.id && (
                      <tr key={`${e.id}-detail`}>
                        <td colSpan={7} className="px-4 py-4 bg-gray-50/80">
                          <EstimateDetail estimate={e} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  page === p ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function EstimateDetail({ estimate }) {
  const snapshot = estimate.itemsSnapshot;
  if (!snapshot) return <p className="text-sm text-gray-400">상세 내역 없음</p>;

  // snapshot can be an object with categories or an array
  const items = Array.isArray(snapshot)
    ? snapshot
    : Object.values(snapshot).flatMap((cat) =>
        Array.isArray(cat.items) ? cat.items : []
      );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-gray-400">버전:</span>{' '}
          <span className="font-medium">{estimate.versionLabel}</span>
        </div>
        <div>
          <span className="text-gray-400">공간:</span>{' '}
          <span className="font-medium">{estimate.space?.widthM}m x {estimate.space?.depthM}m</span>
        </div>
        <div>
          <span className="text-gray-400">연락처:</span>{' '}
          <span className="font-medium">{estimate.contactPhone || estimate.customer?.phone || '-'}</span>
        </div>
        <div>
          <span className="text-gray-400">관리자 메모:</span>{' '}
          <span className="font-medium">{estimate.adminNote || '-'}</span>
        </div>
      </div>
      {items.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-500">
                <th className="text-left px-3 py-2">아이템</th>
                <th className="text-right px-3 py-2">단가</th>
                <th className="text-right px-3 py-2">수량</th>
                <th className="text-right px-3 py-2">소계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.slice(0, 20).map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5 text-gray-700">{item.name || item.itemName || '-'}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{(item.unitPrice || 0).toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{item.qty ?? item.computedQty ?? item.quantity ?? '-'}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{(item.lineTotal || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-4 text-sm">
        <span className="text-gray-400">공급가: <strong className="text-gray-700">{(estimate.totalCost || 0).toLocaleString()}원</strong></span>
        <span className="text-gray-400">VAT 포함: <strong className="text-gray-900">{(estimate.totalCostVat || 0).toLocaleString()}원</strong></span>
      </div>
    </div>
  );
}
