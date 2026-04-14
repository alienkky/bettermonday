import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useBrandStore from '../store/brandStore';

export default function ModeSelectorPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { brand, fetchBrand } = useBrandStore();

  useEffect(() => {
    fetchBrand();
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
