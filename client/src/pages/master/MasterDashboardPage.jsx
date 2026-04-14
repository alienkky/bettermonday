import { useEffect, useState } from 'react';
import { masterApi } from '../../api/client';
import Layout from '../../components/Layout';
import { Building2, Users, FileText, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function MasterDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    masterApi.dashboard()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-500">데이터를 불러올 수 없습니다.</div>
      </Layout>
    );
  }

  const STATUS_KO = { draft: '임시저장', submitted: '상담요청', approved: '승인' };
  const STATUS_COLOR = {
    draft: 'bg-gray-100 text-gray-600',
    submitted: 'bg-amber-50 text-amber-600',
    approved: 'bg-green-50 text-green-600',
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">마스터 대시보드</h1>
          <p className="text-sm text-gray-400 mt-1">전체 시스템 현황</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Building2 size={20} />} label="전체 업체" value={data.totalCompanies} color="violet" />
          <StatCard icon={<CheckCircle size={20} />} label="활성 업체" value={data.activeCompanies} color="green" />
          <StatCard icon={<Users size={20} />} label="전체 고객" value={data.totalCustomers} color="blue" />
          <StatCard icon={<FileText size={20} />} label="전체 견적" value={data.totalEstimates} color="amber" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={<TrendingUp size={20} />} label="이번 달 견적" value={data.monthEstimates} color="indigo" />
          <StatCard icon={<Clock size={20} />} label="상담 대기" value={data.submittedEstimates} color="orange" />
          <StatCard icon={<Building2 size={20} />} label="승인 대기 업체" value={data.pendingCompanies} color="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Estimates */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-[#1a1a1a]">최근 견적</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {data.recentEstimates?.map((e) => (
                <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.customer?.name || '(삭제됨)'}</p>
                    <p className="text-xs text-gray-400">{e.space?.name} &middot; {e.space?.brand}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[e.status]}`}>
                      {STATUS_KO[e.status]}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">{(e.totalCostVat || 0).toLocaleString()}원</p>
                  </div>
                </div>
              ))}
              {(!data.recentEstimates || data.recentEstimates.length === 0) && (
                <p className="px-5 py-4 text-sm text-gray-400 text-center">견적이 없습니다.</p>
              )}
            </div>
          </div>

          {/* Recent Companies */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-[#1a1a1a]">최근 등록 업체</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {data.recentCompanies?.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.email}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                      {c.isActive ? '활성' : '비활성'}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      로그인 {c.loginCount || 0}회
                    </p>
                  </div>
                </div>
              ))}
              {(!data.recentCompanies || data.recentCompanies.length === 0) && (
                <p className="px-5 py-4 text-sm text-gray-400 text-center">등록된 업체가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

const COLOR_MAP = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
  red: { bg: 'bg-red-50', text: 'text-red-500' },
};

function StatCard({ icon, label, value, color = 'blue' }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${c.bg} ${c.text} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold text-[#1a1a1a]">{value ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
