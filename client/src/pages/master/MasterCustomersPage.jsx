import { useEffect, useState, useCallback } from 'react';
import { masterApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';

export default function MasterCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterApi.customers({ page, limit });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
    } catch {
      toast.error('고객 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">전체 고객 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {total}명</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-3 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">고객이 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이름</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이메일</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">연락처</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">공간</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">견적</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      {c.region && <p className="text-xs text-gray-400">{c.region}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{c._count?.spaces || 0}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{c._count?.estimates || 0}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                        c.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {c.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
