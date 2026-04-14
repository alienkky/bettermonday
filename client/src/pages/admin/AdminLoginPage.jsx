import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/client';
import useAuthStore from '../../store/authStore';
import useBrandStore from '../../store/brandStore';
import toast from 'react-hot-toast';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { brand, fetchBrand } = useBrandStore();
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => { fetchBrand(); }, [fetchBrand]);

  const brandName = brand?.brandName || 'FranchiseSim';
  const logoUrl = brand?.logoUrl;
  const primaryColor = brand?.primaryColor || '#0073ea';
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.adminLogin({ email: form.email, password: form.password });
      login(res.data.token, res.data.user);
      toast.success('관리자로 로그인했습니다.');

      if (res.data.user.forcePasswordChange) {
        toast('첫 로그인입니다. 비밀번호를 변경해 주세요.', { icon: '⚠️' });
      }

      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-16 w-16 object-contain rounded-2xl mx-auto mb-4" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: primaryColor }}>
              <span className="text-white font-bold text-2xl">{brandName[0]}</span>
            </div>
          )}
          <h1 className="text-white text-2xl font-bold">{brandName}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-gray-400 text-sm">
            <Shield size={14} />
            <span>인테리어 업체 로그인</span>
          </div>
        </div>

        <div className="bg-[#242424] rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">이메일</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="admin@example.com"
                className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange}
                  placeholder="비밀번호 입력"
                  className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all pr-10"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-200">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? '로그인 중...' : '업체 로그인'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-[#1a1a1a] rounded-lg text-center">
            <p className="text-xs text-gray-500">
              아직 계정이 없으신가요?{' '}
              <Link to="/admin/register" className="text-[#0073ea] hover:underline">업체 가입 신청</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          <Link to="/" className="hover:text-gray-400 transition-colors">← 모드 선택으로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}
