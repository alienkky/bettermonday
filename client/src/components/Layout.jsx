import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useBrandStore from '../store/brandStore';
import { LogOut, LayoutDashboard, Package, FileText, Settings, Users, ChevronDown, Palette, TrendingUp, PlusCircle, FolderOpen, Building2, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { brand, fetchBrand } = useBrandStore();

  useEffect(() => { fetchBrand(); }, [fetchBrand]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = user?.role === 'admin';
  const isMaster = user?.role === 'master';
  const headerBg = isMaster ? '#0f0f23' : (brand?.headerBg || '#1a1a1a');
  const headerText = isMaster ? '#e0e0ff' : (brand?.headerTextColor || '#ffffff');
  const primary = isMaster ? '#7c3aed' : (brand?.primaryColor || '#0073ea');
  const bodyBg = brand?.bodyBg || '#f5f6f8';
  const brandName = brand?.brandName || 'FranchiseSim';
  const logoUrl = brand?.logoUrl;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bodyBg }}>
      {/* Top nav */}
      <header className="h-14 flex items-center px-6 shrink-0 z-50" style={{ backgroundColor: headerBg, color: headerText }}>
        <Link to={isMaster ? '/master/dashboard' : isAdmin ? '/admin/dashboard' : '/my'} className="flex items-center gap-2 mr-6">
          {isMaster ? (
            <div className="w-7 h-7 rounded flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-700">
              <ShieldCheck size={16} className="text-white" />
            </div>
          ) : logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-7 object-contain" />
          ) : (
            <div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: primary }}>{brandName[0]}</div>
          )}
          <span className="font-semibold text-sm tracking-wide" style={{ color: headerText }}>{isMaster ? 'Master Admin' : brandName}</span>
        </Link>

        {isMaster ? (
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
            {/* ── 관리 ── */}
            <NavGroup label="관리" headerText={headerText}>
              <NavLink to="/master/dashboard" icon={<LayoutDashboard size={14} />} label="대시보드" current={location.pathname} headerText={headerText} />
              <NavLink to="/master/companies" icon={<Building2 size={14} />} label="업체 관리" current={location.pathname} headerText={headerText} />
              <NavLink to="/master/estimates" icon={<FileText size={14} />} label="전체 견적" current={location.pathname} headerText={headerText} />
              <NavLink to="/master/customers" icon={<Users size={14} />} label="전체 고객" current={location.pathname} headerText={headerText} />
            </NavGroup>

            <Divider headerText={headerText} />

            {/* ── 시세·아이템·설정 ── */}
            <NavGroup label="설정" headerText={headerText}>
              <NavLink to="/master/market-prices" icon={<TrendingUp size={14} />} label="시세" current={location.pathname} headerText={headerText} />
              <NavLink to="/master/items" icon={<Package size={14} />} label="아이템" current={location.pathname} headerText={headerText} />
              <NavLink to="/master/versions" icon={<Settings size={14} />} label="버전" current={location.pathname} headerText={headerText} />
              <NavLink to="/master/brand" icon={<Palette size={14} />} label="브랜드" current={location.pathname} headerText={headerText} />
            </NavGroup>
          </nav>
        ) : isAdmin ? (
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
            <NavGroup label="메뉴" headerText={headerText}>
              <NavLink to="/admin/dashboard" icon={<LayoutDashboard size={14} />} label="대시보드" current={location.pathname} headerText={headerText} />
              <NavLink to="/start" icon={<PlusCircle size={14} />} label="공간 만들기" current={location.pathname} headerText={headerText} accent />
              <NavLink to="/admin/estimates" icon={<FileText size={14} />} label="견적" current={location.pathname} headerText={headerText} />
              <NavLink to="/admin/items" icon={<Package size={14} />} label="아이템" current={location.pathname} headerText={headerText} />
              <NavLink to="/admin/market-prices" icon={<TrendingUp size={14} />} label="시세" current={location.pathname} headerText={headerText} />
            </NavGroup>

            <Divider headerText={headerText} />

            <NavGroup label="설정" headerText={headerText}>
              <NavLink to="/admin/brand" icon={<Palette size={14} />} label="브랜드" current={location.pathname} headerText={headerText} />
            </NavGroup>
          </nav>
        ) : (
          <nav className="flex items-center gap-1 flex-1">
            <NavLink to="/start" label="공간 만들기" current={location.pathname} headerText={headerText} />
            <NavLink to="/my" label="내 견적" current={location.pathname} headerText={headerText} />
          </nav>
        )}

        {/* User menu */}
        <div className="relative ml-auto shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 text-sm transition-colors px-2 py-1 rounded"
            style={{ color: headerText + 'bb' }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: primary }}>
              {user?.name?.[0] || 'U'}
            </div>
            <span className="hidden sm:block text-xs">
              {user?.name}
              {isMaster && <span className="ml-1 opacity-60 text-[10px]">마스터</span>}
              {isAdmin && !isMaster && <span className="ml-1 opacity-60 text-[10px]">업체</span>}
            </span>
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 w-44 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                {isMaster && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">마스터 관리자</span>
                )}
                {isAdmin && !isMaster && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">인테리어 업체</span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <LogOut size={14} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

/* ── Nav sub-components ─────────────────────────── */

function NavGroup({ label, headerText, children }) {
  return (
    <div className="flex items-center gap-0.5">
      {children}
    </div>
  );
}

function Divider({ headerText }) {
  return <div className="w-px h-5 mx-1.5 shrink-0" style={{ backgroundColor: headerText + '20' }} />;
}

function NavLink({ to, icon, label, current, headerText = '#ffffff', accent = false }) {
  const active = current === to || current.startsWith(to + '/');
  return (
    <Link
      to={to}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-white/15' : 'hover:bg-white/5'
      }`}
      style={{
        color: active
          ? headerText
          : accent
          ? '#7dd3fc'
          : headerText + '99',
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
