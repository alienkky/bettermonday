import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { inquiriesApi } from '../../api/client';
import toast from 'react-hot-toast';
import { MessageSquareText, Send, Clock, Loader2, CheckCircle2, Sparkles, Bug, HelpCircle, MoreHorizontal, User as UserIcon, Building2, Filter } from 'lucide-react';

const CAT_META = {
  improvement: { label: '기능 개선', icon: Sparkles, color: 'text-[#0073ea] bg-[#e6f3ff]' },
  bug: { label: '버그', icon: Bug, color: 'text-red-600 bg-red-50' },
  question: { label: '문의', icon: HelpCircle, color: 'text-emerald-600 bg-emerald-50' },
  other: { label: '기타', icon: MoreHorizontal, color: 'text-gray-600 bg-gray-100' },
};

const STATUS_META = {
  open: { label: '접수됨', icon: Clock, color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '검토 중', icon: Loader2, color: 'bg-orange-100 text-orange-600' },
  resolved: { label: '답변 완료', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
};

export default function MasterInquiriesPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [filter, setFilter] = useState({ status: '', category: '' });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filter.status) params.status = filter.status;
    if (filter.category) params.category = filter.category;
    Promise.all([inquiriesApi.list(params), inquiriesApi.stats()])
      .then(([list, summary]) => {
        setItems(list.data);
        setStats(summary.data);
      })
      .catch(() => toast.error('문의 목록 조회 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter.status, filter.category]);

  const handleUpdate = async (id, patch) => {
    try {
      await inquiriesApi.update(id, patch);
      toast.success('업데이트되었습니다.');
      load();
    } catch {
      toast.error('업데이트 실패');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a1a] flex items-center gap-2">
            <MessageSquareText size={22} className="text-[#7c3aed]" />
            본사 개선 문의 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">고객과 업체에서 접수된 개선 요청을 확인하고 답변합니다.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="전체" value={stats.total} color="bg-gray-100 text-gray-700" />
          <StatCard label="접수됨" value={stats.open} color="bg-gray-100 text-gray-700" />
          <StatCard label="검토 중" value={stats.inProgress} color="bg-orange-50 text-orange-700" />
          <StatCard label="답변 완료" value={stats.resolved} color="bg-green-50 text-green-700" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4 bg-white border border-gray-100 rounded-xl p-3">
          <Filter size={14} className="text-gray-400 ml-1" />
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#7c3aed]"
          >
            <option value="">상태 전체</option>
            <option value="open">접수됨</option>
            <option value="in_progress">검토 중</option>
            <option value="resolved">답변 완료</option>
          </select>
          <select
            value={filter.category}
            onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#7c3aed]"
          >
            <option value="">분류 전체</option>
            <option value="improvement">기능 개선</option>
            <option value="bug">버그</option>
            <option value="question">문의</option>
            <option value="other">기타</option>
          </select>
          {(filter.status || filter.category) && (
            <button
              onClick={() => setFilter({ status: '', category: '' })}
              className="text-xs text-gray-500 hover:text-gray-700 ml-auto px-2"
            >
              필터 초기화
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 text-center py-16 px-6">
            <MessageSquareText size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-[#1a1a1a]">접수된 문의가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <AdminInquiryCard key={it.id} inquiry={it} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
      <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${color}`}>{label}</div>
      <div className="text-2xl font-bold text-[#1a1a1a] mt-1">{value}</div>
    </div>
  );
}

function AdminInquiryCard({ inquiry, onUpdate }) {
  const [expanded, setExpanded] = useState(inquiry.status !== 'resolved');
  const [response, setResponse] = useState(inquiry.response || '');
  const [status, setStatus] = useState(inquiry.status);

  const cat = CAT_META[inquiry.category] || CAT_META.other;
  const CatIcon = cat.icon;
  const st = STATUS_META[inquiry.status] || STATUS_META.open;
  const StIcon = st.icon;

  const handleRespond = () => {
    if (!response.trim()) return;
    onUpdate(inquiry.id, { response, status: status === 'open' ? 'resolved' : status });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-gray-50/50"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
          <CatIcon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{cat.label}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
              <StIcon size={10} className={inquiry.status === 'in_progress' ? 'animate-spin' : ''} />
              {st.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
              {inquiry.role === 'admin' ? <Building2 size={10} /> : <UserIcon size={10} />}
              {inquiry.user?.name} ({inquiry.role === 'admin' ? '업체' : '고객'})
            </span>
          </div>
          <h3 className="font-semibold text-sm text-[#1a1a1a] mt-1 truncate">{inquiry.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {new Date(inquiry.createdAt).toLocaleString('ko-KR')}
            {inquiry.user?.email && <span className="ml-2">· {inquiry.user.email}</span>}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">문의 내용</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
          </div>

          <div className="border-t border-gray-100 px-5 py-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-semibold text-gray-600">상태:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#7c3aed]"
              >
                <option value="open">접수됨</option>
                <option value="in_progress">검토 중</option>
                <option value="resolved">답변 완료</option>
              </select>
              {status !== inquiry.status && (
                <button
                  onClick={() => onUpdate(inquiry.id, { status })}
                  className="text-xs bg-[#7c3aed] text-white px-2.5 py-1 rounded hover:bg-[#6d28d9]"
                >
                  상태 변경
                </button>
              )}
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1 mt-3">답변</label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
              placeholder="답변을 입력하면 해당 고객/업체의 마이페이지에 표시됩니다."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              {inquiry.respondedAt && (
                <p className="text-[10px] text-gray-400">
                  최근 답변: {new Date(inquiry.respondedAt).toLocaleString('ko-KR')}
                </p>
              )}
              <button
                onClick={handleRespond}
                disabled={!response.trim()}
                className="ml-auto flex items-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
              >
                <Send size={12} />
                답변 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
