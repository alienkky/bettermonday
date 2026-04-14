import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/client';
import toast from 'react-hot-toast';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/auth/PasswordStrengthMeter';
import { CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (getPasswordStrength(form.password) < 4) return toast.error('비밀번호 조건을 모두 충족해야 합니다.');
    if (form.password !== form.confirm) return toast.error('비밀번호가 일치하지 않습니다.');
    if (!token) return toast.error('유효하지 않은 링크입니다.');

    setLoading(true);
    try {
      await authApi.resetPassword({ token, password: form.password });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">유효하지 않은 링크입니다.</p>
          <Link to="/forgot-password" className="text-[#0073ea]">비밀번호 찾기로 이동</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#0073ea] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">새 비밀번호 설정</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          {done ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="font-bold text-[#1a1a1a] mb-2">비밀번호가 변경되었습니다</h2>
              <p className="text-sm text-gray-500 mb-6">새 비밀번호로 로그인하세요.</p>
              <button onClick={() => navigate('/login')} className="w-full bg-[#0073ea] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#0060c0]">
                로그인하기
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <input
                  name="password" type="password" value={form.password} onChange={handleChange}
                  placeholder="영문+숫자+특수문자 8자 이상"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
                />
                <PasswordStrengthMeter password={form.password} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                <input
                  name="confirm" type="password" value={form.confirm} onChange={handleChange}
                  placeholder="비밀번호 재입력"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
                />
                {form.confirm && (
                  <p className={`text-xs mt-1 ${form.password === form.confirm ? 'text-green-600' : 'text-red-500'}`}>
                    {form.password === form.confirm ? '✓ 비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
                  </p>
                )}
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
