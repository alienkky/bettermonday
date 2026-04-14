import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import useAuthStore from '../store/authStore';
import useBrandStore from '../store/brandStore';
import toast from 'react-hot-toast';
import StepIndicator from '../components/auth/StepIndicator';
import PasswordStrengthMeter, { getPasswordStrength } from '../components/auth/PasswordStrengthMeter';
import PrivacyConsentBox from '../components/auth/PrivacyConsentBox';

const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const STEPS = ['기본정보', '약관동의', '가입완료'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { brand, fetchBrand } = useBrandStore();
  const [step, setStep] = useState(1);

  useEffect(() => { fetchBrand(); }, [fetchBrand]);

  const brandName = brand?.brandName || 'FranchiseSim';
  const logoUrl = brand?.logoUrl;
  const primaryColor = brand?.primaryColor || '#0073ea';
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', passwordConfirm: '',
    phone: '', region: '',
  });
  const [consent, setConsent] = useState({
    terms: false, privacy: false, marketing: false,
  });
  const [registeredUser, setRegisteredUser] = useState(null);

  const handleChange = (e) => {
    let val = e.target.value;
    // Auto-format phone
    if (e.target.name === 'phone') {
      val = val.replace(/\D/g, '').slice(0, 11);
      if (val.length > 7) val = val.slice(0, 3) + '-' + val.slice(3, 7) + '-' + val.slice(7);
      else if (val.length > 3) val = val.slice(0, 3) + '-' + val.slice(3);
    }
    setForm((f) => ({ ...f, [e.target.name]: val }));
  };

  const toggleAll = (checked) => setConsent({ terms: checked, privacy: checked, marketing: checked });

  // ── Step 1 validation ──────────────────────────────────────────────
  const validateStep1 = () => {
    if (!form.name.trim()) return '이름을 입력하세요.';
    if (!form.email) return '이메일을 입력하세요.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return '올바른 이메일 형식이 아닙니다.';
    if (getPasswordStrength(form.password) < 4) return '비밀번호 조건을 모두 충족해야 합니다.';
    if (form.password !== form.passwordConfirm) return '비밀번호가 일치하지 않습니다.';
    if (form.phone && !/^010-\d{4}-\d{4}$/.test(form.phone)) return '연락처 형식이 올바르지 않습니다.';
    return null;
  };

  const goToStep2 = () => {
    const err = validateStep1();
    if (err) return toast.error(err);
    setStep(2);
  };

  // ── Submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!consent.terms || !consent.privacy) return toast.error('필수 약관에 동의해야 합니다.');
    setLoading(true);
    try {
      const res = await authApi.register({
        ...form,
        consentTerms: String(consent.terms),
        consentPrivacy: String(consent.privacy),
        consentMarketing: String(consent.marketing),
      });
      login(res.data.token, res.data.user);
      setRegisteredUser(res.data.user);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.error || '가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const allRequired = consent.terms && consent.privacy;
  const allChecked = consent.terms && consent.privacy && consent.marketing;

  return (
    <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-10 w-10 object-contain rounded-xl" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                <span className="text-white font-bold text-lg">{brandName[0]}</span>
              </div>
            )}
            <span className="text-xl font-bold text-[#1a1a1a]">{brandName}</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <StepIndicator current={step} steps={STEPS} />

          {/* ── Step 1: Basic Info ─────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-[#1a1a1a] mb-1">기본 정보 입력</h2>
              <p className="text-sm text-gray-400 mb-6">서비스 이용을 위한 기본 정보를 입력하세요.</p>

              <div className="space-y-4">
                <Field label="이름 (실명) *" name="name" value={form.name} onChange={handleChange} placeholder="홍길동" />
                <Field label="이메일 *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />

                <div>
                  <Field label="비밀번호 *" name="password" type="password" value={form.password} onChange={handleChange} placeholder="영문+숫자+특수문자 8자 이상" />
                  <PasswordStrengthMeter password={form.password} />
                </div>

                <Field label="비밀번호 확인 *" name="passwordConfirm" type="password" value={form.passwordConfirm} onChange={handleChange} placeholder="비밀번호 재입력"
                  extra={form.passwordConfirm && (
                    <span className={`text-xs mt-1 block ${form.password === form.passwordConfirm ? 'text-green-600' : 'text-red-500'}`}>
                      {form.password === form.passwordConfirm ? '✓ 비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
                    </span>
                  )}
                />

                <Field label="연락처 (선택)" name="phone" value={form.phone} onChange={handleChange} placeholder="010-0000-0000" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">거주 지역 (선택)</label>
                  <select name="region" value={form.region} onChange={handleChange} className={inputCls}>
                    <option value="">시/도 선택</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={goToStep2} className="w-full mt-6 bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 rounded-xl transition-colors">
                다음
              </button>

              <p className="text-center text-sm text-gray-400 mt-4">
                이미 계정이 있으신가요?{' '}
                <Link to="/login" className="text-[#0073ea] hover:underline">로그인</Link>
              </p>
            </div>
          )}

          {/* ── Step 2: Consent ─────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold text-[#1a1a1a] mb-1">약관 동의</h2>
              <p className="text-sm text-gray-400 mb-6">서비스 이용을 위한 약관에 동의해 주세요.</p>

              {/* All agree */}
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-[#0073ea]/20 bg-blue-50/50 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 text-[#0073ea] rounded"
                />
                <span className="font-semibold text-[#1a1a1a]">전체 동의 (필수 + 선택 포함)</span>
              </label>

              <div className="space-y-3">
                <PrivacyConsentBox type="privacy" checked={consent.privacy} onChange={(v) => setConsent((c) => ({ ...c, privacy: v }))} />
                <PrivacyConsentBox type="terms" checked={consent.terms} onChange={(v) => setConsent((c) => ({ ...c, terms: v }))} />
                <PrivacyConsentBox type="marketing" checked={consent.marketing} onChange={(v) => setConsent((c) => ({ ...c, marketing: v }))} />
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm hover:bg-gray-50">
                  이전
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!allRequired || loading}
                  className="flex-1 bg-[#0073ea] hover:bg-[#0060c0] disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {loading ? '처리 중...' : '가입 완료'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Complete ────────────────────────────────────── */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">가입이 완료되었습니다!</h2>
              <p className="text-gray-500 mb-1">
                <span className="font-semibold text-[#1a1a1a]">{registeredUser?.name}</span>님, 환영합니다!
              </p>
              <p className="text-sm text-gray-400 mb-8">
                이메일 인증 링크를 발송했습니다. 인증 후 모든 기능을 이용할 수 있습니다.
              </p>
              <button
                onClick={() => navigate('/start')}
                className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 rounded-xl transition-colors"
              >
                공간 견적 시작하기 →
              </button>
              <button
                onClick={() => navigate('/my')}
                className="w-full mt-2 text-gray-400 hover:text-gray-600 py-2 text-sm"
              >
                내 견적 목록으로 이동
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea] transition-all';

function Field({ label, name, type = 'text', value, onChange, placeholder, extra }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className={inputCls} />
      {extra}
    </div>
  );
}
