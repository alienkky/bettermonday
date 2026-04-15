import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { inquiriesApi } from '../api/client';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { MessageSquareText, Send, Trash2, Clock, Loader2, CheckCircle2, AlertCircle, Sparkles, Bug, HelpCircle, MoreHorizontal, Plus } from 'lucide-react';

const CATEGORIES = [
  { value: 'improvement', label: '기능 개선 제안', icon: Sparkles, color: 'text-[#0073ea] bg-[#e6f3ff]' },
  { value: 'bug', label: '버그/오류 신고', icon: Bug, color: 'text-red-600 bg-red-50' },
  { value: 'question', label: '이용 문의', icon: HelpCircle, color: 'text-emerald-600 bg-emerald-50' },
  { value: 'other', label: '기타', icon: MoreHorizontal, color: 'text-gray-600 bg-gray-100' },
];

const CAT_META = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const STATUS_META = {
  open: { label: '접수됨', icon: Clock, color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '검토 중', icon: Loader2, color: 'bg-orange-100 text-orange-600' },
  resolved: { label: '답변 완료', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
};

export default function InquiryPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ category: 'improvement', title: '', content: '' });

  const load = () => {
    setLoading(true);
    inquiriesApi.mine()
      .then((res) => setItems(res.data))
      .catch(() => toast.error('문의 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('제목을 입력하세요.');
    if (!form.content.trim()) return toast.error('내용을 입력하세요.');
    setSubmitting(true);
    try {
      await inquiriesApi.create(form);
      toast.success('문의가 접수되었습니다.');
      setForm({ category: 'improvement', title: '', content: '' });
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || '문의 등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    try {
      await inquiriesApi.remove(id);
      toast.success('삭제되었습니다.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || '삭제 실패');
    }
  };

  const roleLabel = user?.role === 'admin' ? '업체' : '고객';

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a] flex items-center gap-2">
              <MessageSquareText size={22} className="text-[#0073ea]" />
              본사 개선 문의
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              서비스 개선 제안, 버그 신고, 이용 문의를 본사에 직접 전달하세요.
            </p>
          </div>
          <button
            onClick={() => setFormOpen((o) => !o)}
            className="flex items-center gap-2 bg-[#0073ea] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#0060c0] transition-colors shadow-sm"
          >
            <Plus size={16} /> {formOpen ? '작성 취소' : '새 문의 작성'}
          </button>
        </div>

        {/* ── Form (collapsible) ────────────────────── */}
        {formOpen && (
          <form onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">분류</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = form.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        active ? 'border-[#0073ea] bg-[#f5faff]' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon size={16} className={active ? 'text-[#0073ea]' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${active ? 'text-[#0073ea]' : 'text-gray-500'}`}>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">제목 *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={100}
                placeholder="예) 자재 단가 일괄 수정 기능이 있으면 좋겠습니다"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">내용 *</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                maxLength={2000}
                rows={6}
                placeholder="상황, 기대 동작, 재현 방법 등을 구체적으로 적어주세요."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea] resize-none"
              />
              <div className="text-[10px] text-gray-400 text-right mt-1">{form.content.length} / 2000</div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">
                작성자: <strong className="text-gray-600">{user?.name}</strong> ({roleLabel})
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 bg-[#0073ea] hover:bg-[#0060c0] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
              >
                <Send size={14} />
                {submitting ? '등록 중…' : '문의 등록'}
              </button>
            </div>
          </form>
        )}

        {/* ── Inquiry list ──────────────────────────── */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">내가 보낸 문의 <span className="text-gray-400">({items.length})</span></h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#0073ea] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 text-center py-12 px-6">
              <MessageSquareText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-[#1a1a1a]">아직 문의 내역이 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">개선 아이디어가 있다면 언제든 알려주세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <InquiryCard key={it.id} inquiry={it} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function InquiryCard({ inquiry, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const cat = CAT_META[inquiry.category] || CAT_META.other;
  const CatIcon = cat.icon;
  const st = STATUS_META[inquiry.status] || STATUS_META.open;
  const StIcon = st.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-[#0073ea]/30 transition-colors">
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
          </div>
          <h3 className="font-semibold text-sm text-[#1a1a1a] mt-1 truncate">{inquiry.title}</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {new Date(inquiry.createdAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="px-5 py-4">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{inquiry.content}</p>
          </div>
          {inquiry.response && (
            <div className="border-t border-gray-100 px-5 py-4 bg-[#f5faff]">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={14} className="text-[#0073ea]" />
                <span className="text-xs font-semibold text-[#0073ea]">본사 답변</span>
                {inquiry.respondedAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(inquiry.respondedAt).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{inquiry.response}</p>
            </div>
          )}
          {inquiry.status === 'open' && (
            <div className="border-t border-gray-100 px-5 py-2 flex justify-end">
              <button
                onClick={() => onDelete(inquiry.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 px-2 py-1"
              >
                <Trash2 size={12} /> 삭제
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
