import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/client';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function MasterLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.masterLogin({ email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      toast.success('마스터 관리자로 로그인했습니다.');
      navigate('/master/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl mb-4 shadow-lg shadow-violet-900/30">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">FranchiseSim</h1>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-violet-300 text-sm">
            <ShieldCheck size={14} />
            <span>마스터 관리자</span>
          </div>
        </div>

        <div className="bg-[#1a1a2e] rounded-2xl border border-violet-500/20 p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">이메일</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="master@example.com"
                className="w-full bg-[#16213e] border border-violet-500/20 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange}
                  placeholder="비밀번호 입력"
                  className="w-full bg-[#16213e] border border-violet-500/20 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all pr-10"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-200">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 mt-2 shadow-lg shadow-violet-900/20"
            >
              {loading ? '로그인 중...' : '마스터 로그인'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-[#0f0f23] rounded-lg">
            <p className="text-xs text-gray-500 text-center">시스템 최고 관리자 전용</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          <Link to="/" className="hover:text-gray-400 transition-colors">&larr; 모드 선택으로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}
