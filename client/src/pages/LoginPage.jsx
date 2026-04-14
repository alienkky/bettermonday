import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import useAuthStore from '../store/authStore';
import useBrandStore from '../store/brandStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { brand, fetchBrand } = useBrandStore();
  const [form, setForm] = useState({ email: '', password: '', rememberMe: false });

  useEffect(() => { fetchBrand(); }, [fetchBrand]);

  const brandName = brand?.brandName || 'FranchiseSim';
  const logoUrl = brand?.logoUrl;
  const primaryColor = brand?.primaryColor || '#0073ea';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.customerLogin({
        email: form.email,
        password: form.password,
        rememberMe: form.rememberMe,
      });
      login(res.data.token, res.data.user);
      toast.success(`환영합니다, ${res.data.user.name}님!`);
      navigate('/my');
    } catch (err) {
      const msg = err.response?.data?.error || '로그인에 실패했습니다. 다시 시도해 주세요.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-12 w-12 object-contain rounded-xl" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                <span className="text-white font-bold text-xl">{brandName[0]}</span>
              </div>
            )}
            <span className="text-2xl font-bold text-[#1a1a1a]">{brandName}</span>
          </Link>
          <p className="text-gray-400 text-sm mt-2">프랜차이즈 인테리어 비용 시뮬레이터</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-bold text-[#1a1a1a] mb-6 text-center">로그인</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <Field label="이메일" name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />
            <Field label="비밀번호" name="password" type="password" value={form.password} onChange={handleChange} placeholder="비밀번호 입력" />

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" name="rememberMe" checked={form.rememberMe} onChange={handleChange} className="rounded text-[#0073ea]" />
              로그인 상태 유지 (30일)
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="flex items-center justify-between mt-4 text-sm">
            <Link to="/forgot-password" className="text-gray-400 hover:text-[#0073ea]">비밀번호 찾기</Link>
            <Link to="/register" className="text-[#0073ea] hover:underline">회원가입 →</Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <Link to="/" className="text-gray-500 hover:text-[#0073ea]">← 모드 선택으로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, name, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name} type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea] transition-all"
      />
    </div>
  );
}
