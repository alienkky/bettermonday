import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useBrandStore from '../store/brandStore';
import { LogOut, LayoutDashboard, Package, FileText, Settings, Users, ChevronDown, Palette, TrendingUp, PlusCircle, FolderOpen, Building2, ShieldCheck, Menu, X, MessageSquareText } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { brand, fetchBrand } = useBrandStore();

  useEffect(() => { fetchBrand(); }, [fetchBrand]);
  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [location.pathname]);

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

  // Build role-based nav item list (shared by desktop + mobile)
  const navItems = isMaster
    ? [
        { group: '관리', items: [
          { to: '/master/dashboard', icon: LayoutDashboard, label: '대시보드' },
          { to: '/master/companies', icon: Building2, label: '업체 관리' },
          { to: '/master/estimates', icon: FileText, label: '전체 견적' },
          { to: '/master/customers', icon: Users, label: '전체 고객' },
          { to: '/master/inquiries', icon: MessageSquareText, label: '개선 문의' },
        ]},
        { group: '설정', items: [
          { to: '/master/market-prices', icon: TrendingUp, label: '시세' },
          { to: '/master/items', icon: Package, label: '아이템' },
          { to: '/master/versions', icon: Settings, label: '버전' },
          { to: '/master/brand', icon: Palette, label: '브랜드' },
        ]},
      ]
    : isAdmin
    ? [
        { group: '메뉴', items: [
          { to: '/admin/dashboard', icon: LayoutDashboard, label: '대시보드' },
          { to: '/start', icon: PlusCircle, label: '공간 만들기', accent: true },
          { to: '/admin/estimates', icon: FileText, label: '견적' },
          { to: '/admin/items', icon: Package, label: '아이템' },
          { to: '/admin/market-prices', icon: TrendingUp, label: '시세' },
        ]},
        { group: '설정', items: [
          { to: '/admin/brand', icon: Palette, label: '브랜드' },
          { to: '/inquiry', icon: MessageSquareText, label: '본사 문의' },
        ]},
      ]
    : [
        { group: '', items: [
          { to: '/start', icon: PlusCircle, label: '공간 만들기', accent: true },
          { to: '/my', icon: FolderOpen, label: '내 견적' },
          { to: '/inquiry', icon: MessageSquareText, label: '본사 문의' },
        ]},
      ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: bodyBg }}>
      {/* Top nav */}
      <header className="h-14 flex items-center px-4 md:px-6 shrink-0 z-50 relative" style={{ backgroundColor: headerBg, color: headerText }}>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden p-2 -ml-2 mr-1 rounded hover:bg-white/10"
          aria-label="메뉴 열기"
          style={{ color: headerText }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

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
          <span className="font-semibold text-sm tracking-wide hidden sm:block" style={{ color: headerText }}>{isMaster ? 'Master Admin' : brandName}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map((grp, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <Divider headerText={headerText} />}
              {grp.items.map((it) => (
                <NavLink key={it.to} to={it.to} icon={it.icon ? <it.icon size={14} /> : null} label={it.label} current={location.pathname} headerText={headerText} accent={it.accent} primary={primary} />
              ))}
            </div>
          ))}
        </nav>

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

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 top-14 bg-black/40 z-40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="md:hidden absolute left-0 right-0 top-14 bg-white shadow-lg border-t border-gray-200 z-50 max-h-[80vh] overflow-y-auto">
              {navItems.map((grp, gi) => (
                <div key={gi} className="py-2 border-b last:border-b-0 border-gray-100">
                  {grp.group && (
                    <div className="px-4 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{grp.group}</div>
                  )}
                  {grp.items.map((it) => {
                    const Icon = it.icon;
                    const active = location.pathname === it.to || location.pathname.startsWith(it.to + '/');
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                          active ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                        } ${it.accent ? 'text-[#0073ea]' : ''}`}
                        style={it.accent ? { color: primary } : {}}
                      >
                        {Icon && <Icon size={16} />}
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

/* ── Nav sub-components ─────────────────────────── */

function Divider({ headerText }) {
  return <div className="w-px h-5 mx-1 shrink-0" style={{ backgroundColor: headerText + '20' }} />;
}

function NavLink({ to, icon, label, current, headerText = '#ffffff', accent = false, primary = '#0073ea' }) {
  const active = current === to || current.startsWith(to + '/');
  if (accent) {
    // Accent = primary call-to-action ("공간 만들기"). Pill-style, high contrast.
    return (
      <Link
        to={to}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap text-white shadow-sm hover:brightness-110"
        style={{ backgroundColor: primary }}
      >
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-white/15' : 'hover:bg-white/10'
      }`}
      style={{
        color: active ? headerText : headerText + 'b0',
      }}
    >
      {icon}
      {label}
    </Link>
  );
}
