import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useBrandStore from '../store/brandStore';
import { versionsApi } from '../api/client';
import { Tag, ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ModeSelectorPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { brand, fetchBrand } = useBrandStore();

  const [versions, setVersions] = useState([]);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    fetchBrand();
    versionsApi.public(5).then((res) => setVersions(res.data || [])).catch(() => {});
  }, [fetchBrand]);

  // Redirect already-authenticated users
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'master') {
        navigate('/master/dashboard', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/my', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const brandName = brand?.brandName || 'FranchiseSim';
  const logoUrl = brand?.logoUrl;
  const primaryColor = brand?.primaryColor || '#0073ea';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Logo / Brand */}
        <div className="text-center mb-12">
          <div className="inline-flex flex-col items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-14 w-14 object-contain rounded-xl" />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <span className="text-white font-bold text-2xl">
                  {brandName.charAt(0)}
                </span>
              </div>
            )}
            <h1 className="text-3xl font-bold text-[#1a1a1a]">{brandName}</h1>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            프랜차이즈 인테리어 비용 시뮬레이터
          </p>
        </div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 - Customer Mode */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 p-8 flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <span className="text-3xl">🏪</span>
              </div>
              <h2 className="text-xl font-bold text-[#1a1a1a]">고객 모드</h2>
              <p className="text-sm text-gray-400 mt-1">
                프랜차이즈 점주 / 예비 창업자
              </p>
            </div>

            <ul className="space-y-3 text-sm text-gray-600 mb-8 flex-1">
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                브랜드 선택 후 인테리어 견적
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                2D 도면에 자재 배치
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                실시간 비용 시뮬레이션
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                상담 신청
              </li>
            </ul>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-block w-full text-white font-semibold py-3 rounded-xl transition-colors text-center"
                style={{ backgroundColor: primaryColor }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                고객 로그인
              </Link>
              <p className="text-xs text-gray-400 mt-3">
                계정이 없으신가요?{' '}
                <Link to="/register" className="text-gray-500 hover:underline" style={{ color: primaryColor }}>
                  회원가입
                </Link>
              </p>
            </div>
          </div>

          {/* Card 2 - Interior Company Mode */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 p-8 flex flex-col">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-[#2d2d2d]/10 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🏗️</span>
              </div>
              <h2 className="text-xl font-bold text-[#1a1a1a]">인테리어 업체 모드</h2>
              <p className="text-sm text-gray-400 mt-1">
                시공사 / 인테리어 관리자
              </p>
            </div>

            <ul className="space-y-3 text-sm text-gray-600 mb-8 flex-1">
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                자재 단가 및 시세 관리
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                고객 견적 조회 및 승인
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                브랜드별 견적 시뮬레이션
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-300 mt-0.5">&#8226;</span>
                대시보드 및 고객 관리
              </li>
            </ul>

            <div className="text-center">
              <Link
                to="/admin/login"
                className="inline-block w-full bg-[#2d2d2d] hover:bg-[#1a1a1a] text-white font-semibold py-3 rounded-xl transition-colors text-center"
              >
                업체 로그인
              </Link>
              <p className="text-xs text-gray-400 mt-3">
                관리자 계정은 시스템 관리자에게 문의하세요
              </p>
            </div>
          </div>
        </div>

        {/* ── Version + Changelog ───────────────────────────── */}
        {versions.length > 0 && (
          <div className="mt-10 bg-white/70 backdrop-blur rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setChangelogOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Sparkles size={16} style={{ color: primaryColor }} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#1a1a1a]">현재 버전</span>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Tag size={10} /> v{versions.find((v) => v.isCurrent)?.version || versions[0]?.version}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    최근 개선 로그 {versions.length}건 · 클릭하여 {changelogOpen ? '접기' : '펼치기'}
                  </p>
                </div>
              </div>
              {changelogOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {changelogOpen && (
              <div className="border-t border-gray-100 px-5 py-4 max-h-80 overflow-y-auto">
                <ul className="space-y-4">
                  {versions.map((v) => (
                    <li key={v.version} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            v.isCurrent ? 'text-white' : 'bg-gray-100 text-gray-400'
                          }`}
                          style={v.isCurrent ? { backgroundColor: primaryColor } : {}}
                        >
                          {v.isCurrent ? <CheckCircle2 size={14} /> : <Tag size={12} />}
                        </div>
                        <div className="w-px flex-1 bg-gray-200 my-1" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#1a1a1a]">v{v.version}</span>
                          {v.isCurrent && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-semibold"
                              style={{ backgroundColor: primaryColor }}
                            >
                              최신
                            </span>
                          )}
                          <span className="text-[11px] text-gray-400">
                            {new Date(v.releasedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          </span>
                        </div>
                        {v.changelog && (
                          <p className="text-xs text-gray-600 mt-1 whitespace-pre-line leading-relaxed">{v.changelog}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Master login — subtle link */}
        <p className="text-center text-[10px] text-gray-300 mt-8">
          <Link to="/master/login" className="hover:text-gray-400 transition-colors">
            시스템 관리
          </Link>
        </p>
      </div>
    </div>
  );
}
