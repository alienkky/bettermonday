import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import Layout from '../../components/Layout';
import { Users, FileText, MessageCircle, TrendingUp, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => Math.round(n || 0).toLocaleString('ko-KR');

const STATUS_COLOR = {
  draft: 'text-gray-500 bg-gray-100',
  submitted: 'text-orange-600 bg-orange-100',
  approved: 'text-green-700 bg-green-100',
};
const STATUS_LABEL = { draft: '임시', submitted: '상담신청', approved: '승인' };

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.dashboard()
      .then((res) => setData(res.data))
      .catch(() => toast.error('데이터 로드 실패'))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: '전체 견적', value: data?.totalEstimates || 0, icon: <FileText size={20} />, color: 'text-[#0073ea] bg-blue-100' },
    { label: '이번 달 견적', value: data?.monthEstimates || 0, icon: <TrendingUp size={20} />, color: 'text-[#00c875] bg-green-100' },
    { label: '상담 신청', value: data?.consultations || 0, icon: <MessageCircle size={20} />, color: 'text-[#e2445c] bg-red-100' },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">대시보드</h1>
            <p className="text-gray-400 text-sm mt-0.5">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {stats.map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-6">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 ${s.color}`}>{s.icon}</div>
                  <div className="text-3xl font-bold text-[#1a1a1a]">{s.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent estimates */}
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-[#1a1a1a]">최근 견적</h2>
                <button onClick={() => navigate('/admin/estimates')} className="text-sm text-[#0073ea] hover:underline flex items-center gap-1">
                  전체 보기 <ChevronRight size={14} />
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {data?.recentEstimates?.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">견적이 없습니다.</div>
                ) : (
                  data?.recentEstimates?.map((est) => (
                    <div
                      key={est.id}
                      onClick={() => navigate(`/admin/estimates`)}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="w-9 h-9 bg-[#f5f6f8] rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                        {est.customer?.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[#1a1a1a]">{est.customer?.name}</p>
                        <p className="text-xs text-gray-400 truncate">{est.space?.name} · {est.space?.areaSqm?.toFixed(1)}m²</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm text-[#1a1a1a]">{fmt(est.totalCostVat)}원</div>
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLOR[est.status]}`}>
                          {STATUS_LABEL[est.status]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">{new Date(est.createdAt).toLocaleDateString('ko-KR')}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
