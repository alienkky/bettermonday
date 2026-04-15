import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { estimatesApi, spacesApi } from '../../api/client';
import Layout from '../../components/Layout';
import { Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Trash2, FileText, LayoutGrid, ArrowRight, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

const STATUS_BADGE = {
  draft: <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"><Clock size={10} />임시저장</span>,
  submitted: <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600"><AlertCircle size={10} />상담신청</span>,
  approved: <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 size={10} />승인완료</span>,
};

const TAB_STORAGE_KEY = 'mypage_tab';

export default function MyPage() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem(TAB_STORAGE_KEY) || 'estimates'; } catch { return 'estimates'; }
  });

  useEffect(() => {
    try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch {}
  }, [tab]);

  useEffect(() => {
    Promise.all([estimatesApi.list(), spacesApi.list()])
      .then(([est, spc]) => { setEstimates(est.data); setSpaces(spc.data); })
      .catch(() => toast.error('데이터 로드 실패'))
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteSpace = async (id) => {
    if (!confirm('공간을 삭제하시겠습니까? 관련 배치 정보도 삭제됩니다.')) return;
    try {
      await spacesApi.delete(id);
      setSpaces((s) => s.filter((sp) => sp.id !== id));
      toast.success('삭제되었습니다.');
    } catch {
      toast.error('삭제 실패');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#1a1a1a]">내 견적 관리</h1>
          <button
            onClick={() => navigate('/start')}
            className="flex items-center gap-2 bg-[#0073ea] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0060c0] transition-colors shadow-sm"
          >
            <Plus size={16} /> 새 공간 만들기
          </button>
        </div>

        {/* Tabs with count badges */}
        <div className="flex gap-1 bg-[#f5f6f8] p-1 rounded-lg w-fit mb-6">
          <TabButton active={tab === 'estimates'} onClick={() => setTab('estimates')}
            icon={<FileText size={14} />} label="견적 목록" count={estimates.length} />
          <TabButton active={tab === 'spaces'} onClick={() => setTab('spaces')}
            icon={<LayoutGrid size={14} />} label="내 공간" count={spaces.length} />
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-8 h-8 border-2 border-[#0073ea] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        ) : tab === 'estimates' ? (
          <EstimateList estimates={estimates} navigate={navigate} />
        ) : (
          <SpaceList spaces={spaces} navigate={navigate} onDelete={handleDeleteSpace} />
        )}
      </div>
    </Layout>
  );
}

function TabButton({ active, onClick, icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-md transition-all ${
        active ? 'bg-white shadow text-[#1a1a1a] font-semibold' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
          active ? 'bg-[#0073ea] text-white' : 'bg-gray-200 text-gray-600'
        }`}>{count}</span>
      )}
    </button>
  );
}

function EstimateList({ estimates, navigate }) {
  if (estimates.length === 0) return (
    <EmptyState
      icon={<FileText size={36} className="text-gray-300" />}
      title="저장된 견적이 없습니다"
      sub="공간을 만들고 인테리어 견적을 시뮬레이션해보세요."
      ctaLabel="첫 공간 만들기"
      onCta={() => navigate('/start')}
    />
  );

  return (
    <div className="space-y-3">
      {estimates.map((est) => (
        <div
          key={est.id}
          onClick={() => navigate(`/estimate/${est.id}`)}
          className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:border-[#0073ea]/30 hover:shadow-sm transition-all flex items-center justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-[#1a1a1a] truncate">{est.space?.name || '공간'}</span>
              {STATUS_BADGE[est.status]}
            </div>
            <div className="text-sm text-gray-400">
              {new Date(est.createdAt).toLocaleDateString('ko-KR')} · v{est.versionLabel}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-bold text-[#0073ea]">{fmt(est.totalCostVat)}원</div>
              <div className="text-xs text-gray-400">VAT 포함</div>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SpaceList({ spaces, navigate, onDelete }) {
  if (spaces.length === 0) return (
    <EmptyState
      icon={<LayoutGrid size={36} className="text-gray-300" />}
      title="생성된 공간이 없습니다"
      sub="도면을 업로드하거나 크기를 입력해 첫 공간을 만들어보세요."
      ctaLabel="새 공간 만들기"
      onCta={() => navigate('/start')}
    />
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {spaces.map((sp) => {
        const hasEstimate = sp.estimates?.length > 0;
        return (
          <div key={sp.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:border-[#0073ea]/30 transition-all flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[#1a1a1a] truncate">{sp.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <MapPin size={10} />
                  {sp.address || '주소 없음'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(sp.id); }}
                title="공간 삭제"
                className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="text-sm text-gray-500 mb-4 flex-1">
              {sp.widthM}m × {sp.depthM}m · <strong className="text-[#1a1a1a]">{sp.areaSqm.toFixed(1)}m²</strong>
              <span className="text-xs text-gray-400 ml-1">({(sp.areaSqm / 3.305785).toFixed(1)}평)</span>
            </div>
            <div className="flex gap-2">
              {/* Primary CTA: open planner */}
              <button
                onClick={() => navigate(`/planner/${sp.id}`)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#0073ea] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#0060c0] transition-colors shadow-sm"
              >
                플래너 열기 <ArrowRight size={14} />
              </button>
              {hasEstimate && (
                <button
                  onClick={() => navigate(`/estimate/${sp.estimates[0].id}`)}
                  className="px-3 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 hover:border-gray-300 whitespace-nowrap"
                >
                  견적서
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ icon, title, sub, ctaLabel, onCta }) {
  return (
    <div className="text-center py-16 px-6 bg-white rounded-2xl border border-gray-100">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="font-semibold text-[#1a1a1a] text-lg">{title}</h3>
      <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto">{sub}</p>
      {ctaLabel && (
        <button
          onClick={onCta}
          className="mt-6 inline-flex items-center gap-2 bg-[#0073ea] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0060c0] transition-colors shadow-sm"
        >
          <Plus size={16} /> {ctaLabel}
        </button>
      )}
    </div>
  );
}
