import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/client';
import useBrandStore from '../../store/brandStore';
import toast from 'react-hot-toast';
import { Building2, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function AdminRegisterPage() {
  const navigate = useNavigate();
  const { brand, fetchBrand } = useBrandStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', region: '' });

  useEffect(() => { fetchBrand(); }, [fetchBrand]);

  const brandName = brand?.brandName || 'FranchiseSim';
  const primaryColor = brand?.primaryColor || '#0073ea';
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      return toast.error('업체명, 이메일, 비밀번호는 필수입니다.');
    }
    if (form.password.length < 8) return toast.error('비밀번호는 8자 이상이어야 합니다.');

    setLoading(true);
    try {
      await authApi.adminRegister(form);
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || '가입 실패');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">가입 신청 완료</h2>
          <p className="text-gray-400 text-sm mb-6">
            시스템 관리자의 승인 후 로그인이 가능합니다.<br />
            승인이 완료되면 등록하신 이메일로 안내됩니다.
          </p>
          <Link
            to="/admin/login"
            className="inline-block bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            로그인 페이지로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0073ea] rounded-2xl mb-4">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">업체 가입 신청</h1>
          <p className="text-gray-400 text-sm mt-1.5">인테리어 업체 계정을 신청합니다</p>
        </div>

        <div className="bg-[#242424] rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">업체명 *</label>
              <input
                name="name" value={form.name} onChange={handleChange}
                placeholder="인테리어 업체명"
                className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">이메일 *</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="admin@company.com"
                className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">비밀번호 *</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange}
                  placeholder="8자 이상 (영문+숫자)"
                  className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all pr-10"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-200">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">연락처</label>
              <input
                name="phone" value={form.phone} onChange={handleChange}
                placeholder="010-0000-0000 (선택)"
                className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">지역</label>
              <input
                name="region" value={form.region} onChange={handleChange}
                placeholder="서울 / 경기 / 등 (선택)"
                className="w-full bg-[#2e2e2e] border border-white/10 text-white rounded-lg px-3 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0073ea]/40 focus:border-[#0073ea] transition-all"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? '신청 중...' : '가입 신청'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-[#1a1a1a] rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              가입 후 시스템 관리자의 승인이 필요합니다.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link to="/admin/login" className="text-[#0073ea] hover:underline">로그인</Link>
        </p>
        <p className="text-center text-xs text-gray-600 mt-2">
          <Link to="/" className="hover:text-gray-400 transition-colors">← 모드 선택으로 돌아가기</Link>
        </p>
      </div>
    </div>
  );
}
