import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('이메일을 입력하세요.');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.error || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#0073ea] rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h1 className="text-xl font-bold text-[#1a1a1a]">비밀번호 찾기</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="font-bold text-[#1a1a1a] mb-2">이메일을 확인하세요</h2>
              <p className="text-sm text-gray-500 mb-6">
                <span className="font-medium text-[#1a1a1a]">{email}</span>로<br />
                비밀번호 재설정 링크를 발송했습니다.<br />
                링크는 30분간 유효합니다.
              </p>
              <Link to="/login" className="block w-full text-center bg-[#0073ea] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#0060c0]">
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6">
                가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
                    />
                  </div>
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {loading ? '발송 중...' : '재설정 링크 발송'}
                </button>
              </form>
            </>
          )}
        </div>

        <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600 mt-4">
          <ArrowLeft size={14} /> 로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
