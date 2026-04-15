import { useEffect, useState, useCallback, useRef } from 'react';
import { masterApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Search, CheckCircle, XCircle, Clock,
  RotateCcw, Trash2, X, Eye, EyeOff, KeyRound,
  Palette, Upload, Save, Image, Type,
} from 'lucide-react';

export default function CompanyManagementPage() {
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [resetPwModal, setResetPwModal] = useState(null);
  const [brandModal, setBrandModal] = useState(null);

  const limit = 20;

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filter !== 'all') params.status = filter;
      const res = await masterApi.companies(params);
      setCompanies(res.data.companies);
      setTotal(res.data.total);
    } catch {
      toast.error('업체 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleToggleActive = async (company) => {
    const newActive = !company.isActive;
    const action = newActive ? '활성화' : '비활성화';
    if (!window.confirm(`${company.name} 업체를 ${action}하시겠습니까?`)) return;
    try {
      await masterApi.updateCompany(company.id, { isActive: newActive });
      toast.success(`${company.name} 업체가 ${action}되었습니다.`);
      fetchCompanies();
    } catch {
      toast.error('업체 상태 변경 실패');
    }
  };

  const handleDelete = async (company) => {
    if (!window.confirm(`${company.name} 업체를 비활성화(삭제)하시겠습니까?`)) return;
    try {
      await masterApi.deleteCompany(company.id);
      toast.success('업체가 비활성화되었습니다.');
      fetchCompanies();
    } catch {
      toast.error('업체 삭제 실패');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a1a]">인테리어 업체 관리</h1>
            <p className="text-sm text-gray-400 mt-0.5">총 {total}개 업체</p>
          </div>
          <button
            onClick={() => { setEditCompany(null); setShowModal(true); }}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={16} />
            업체 추가
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: 'all', label: '전체' },
            { key: 'active', label: '활성' },
            { key: 'inactive', label: '승인 대기 / 비활성' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => { setFilter(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin w-6 h-6 border-3 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Building2 size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">등록된 업체가 없습니다.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">업체명</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">이메일</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">연락처</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">상태</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">로그인</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">등록일</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.region && <p className="text-xs text-gray-400">{c.region}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                          <CheckCircle size={12} /> 활성
                        </span>
                      ) : c.loginCount === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                          <Clock size={12} /> 승인 대기
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                          <XCircle size={12} /> 비활성
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">
                      {c.loginCount || 0}회
                      {c.lastLoginAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(c.lastLoginAt).toLocaleDateString('ko-KR')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {!c.isActive && c.loginCount === 0 ? (
                          <button
                            onClick={() => handleToggleActive(c)}
                            title="승인"
                            className="px-2 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            승인
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(c)}
                            title={c.isActive ? '비활성화' : '활성화'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              c.isActive
                                ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {c.isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                          </button>
                        )}
                        <button
                          onClick={() => setResetPwModal(c)}
                          title="비밀번호 초기화"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => setBrandModal(c)}
                          title="브랜드 설정"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Palette size={16} />
                        </button>
                        <button
                          onClick={() => { setEditCompany(c); setShowModal(true); }}
                          title="편집"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  page === p ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <CompanyModal
          company={editCompany}
          onClose={() => { setShowModal(false); setEditCompany(null); }}
          onSaved={() => { setShowModal(false); setEditCompany(null); fetchCompanies(); }}
        />
      )}

      {/* Reset Password Modal */}
      {resetPwModal && (
        <ResetPwModal
          company={resetPwModal}
          onClose={() => setResetPwModal(null)}
        />
      )}

      {/* Brand Settings Modal */}
      {brandModal && (
        <BrandModal
          company={brandModal}
          onClose={() => setBrandModal(null)}
          onSaved={() => { setBrandModal(null); fetchCompanies(); }}
        />
      )}
    </Layout>
  );
}

/* ── Company Create/Edit Modal ─────────────────── */

function CompanyModal({ company, onClose, onSaved }) {
  const isEdit = !!company;
  const [form, setForm] = useState({
    name: company?.name || '',
    email: company?.email || '',
    password: '',
    phone: company?.phone || '',
    region: company?.region || '',
    note: company?.note || '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        const { password, email, ...data } = form;
        await masterApi.updateCompany(company.id, data);
        toast.success('업체 정보가 수정되었습니다.');
      } else {
        if (!form.password) return toast.error('비밀번호를 입력하세요.');
        await masterApi.createCompany(form);
        toast.success('새 업체가 생성되었습니다.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || '저장 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a1a1a]">{isEdit ? '업체 수정' : '새 업체 추가'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="업체명 *" name="name" value={form.name} onChange={handleChange} placeholder="인테리어 업체명" />
          {!isEdit && (
            <Field label="이메일 *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="admin@company.com" />
          )}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2.5">{company.email}</p>
            </div>
          )}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초기 비밀번호 *</label>
              <div className="relative">
                <input
                  name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange}
                  placeholder="8자 이상 (영문+숫자)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 pr-10"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}
          <Field label="연락처" name="phone" value={form.phone} onChange={handleChange} placeholder="010-0000-0000" />
          <Field label="지역" name="region" value={form.region} onChange={handleChange} placeholder="서울 / 경기 / 등" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea
              name="note" value={form.note} onChange={handleChange}
              rows={2}
              placeholder="내부 메모 (선택)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : isEdit ? '수정 저장' : '업체 생성'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Reset Password Modal ─────────────────── */

function ResetPwModal({ company, onClose }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) return toast.error('비밀번호는 8자 이상이어야 합니다.');
    setLoading(true);
    try {
      await masterApi.resetCompanyPassword(company.id, { password });
      toast.success(`${company.name} 비밀번호가 초기화되었습니다.`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || '비밀번호 초기화 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#1a1a1a]">비밀번호 초기화</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-700">
              <strong>{company.name}</strong> ({company.email}) 업체의 비밀번호를 초기화합니다.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상 (영문+숫자)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 pr-10"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">로그인 시 비밀번호 변경이 강제됩니다.</p>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? '처리 중...' : '비밀번호 초기화'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Brand Settings Modal ─────────────────── */

const BRAND_DEFAULTS = {
  brandName: 'FranchiseSim',
  primaryColor: '#0073ea',
  secondaryColor: '#00c875',
  accentColor: '#7c3aed',
  dangerColor: '#e2445c',
  headerBg: '#1a1a1a',
  headerTextColor: '#ffffff',
  bodyBg: '#f5f6f8',
  fontFamily: 'Pretendard, sans-serif',
  borderRadius: '12',
};

// 1 MB max — matches server BRAND_UPLOAD_MAX.
const MAX_BRAND_BYTES = 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function BrandModal({ company, onClose, onSaved }) {
  const [form, setForm] = useState({ ...BRAND_DEFAULTS });
  // Base64 data URLs — same representation we send to the server. Avoids the
  // Railway ephemeral-filesystem issue where uploaded files vanished on redeploy.
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [faviconDataUrl, setFaviconDataUrl] = useState(null);
  const [logoFileName, setLogoFileName] = useState(null);
  const [faviconFileName, setFaviconFileName] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoRef = useRef();
  const faviconRef = useRef();

  useEffect(() => {
    masterApi.getCompanyBrand(company.id).then((res) => {
      const b = res.data;
      setForm({
        brandName: b.brandName || BRAND_DEFAULTS.brandName,
        primaryColor: b.primaryColor || BRAND_DEFAULTS.primaryColor,
        secondaryColor: b.secondaryColor || BRAND_DEFAULTS.secondaryColor,
        accentColor: b.accentColor || BRAND_DEFAULTS.accentColor,
        dangerColor: b.dangerColor || BRAND_DEFAULTS.dangerColor,
        headerBg: b.headerBg || BRAND_DEFAULTS.headerBg,
        headerTextColor: b.headerTextColor || BRAND_DEFAULTS.headerTextColor,
        bodyBg: b.bodyBg || BRAND_DEFAULTS.bodyBg,
        fontFamily: b.fontFamily || BRAND_DEFAULTS.fontFamily,
        borderRadius: b.borderRadius || BRAND_DEFAULTS.borderRadius,
      });
      if (b.logoUrl) setLogoDataUrl(b.logoUrl);
      if (b.faviconUrl) setFaviconDataUrl(b.faviconUrl);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [company.id]);

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BRAND_BYTES) {
      toast.error(`로고 파일은 ${Math.floor(MAX_BRAND_BYTES / 1024)}KB 이하여야 합니다.`);
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoDataUrl(dataUrl);
      setLogoFileName(file.name);
    } catch {
      toast.error('로고를 읽을 수 없습니다.');
    }
  };

  const handleFaviconChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BRAND_BYTES) {
      toast.error(`파비콘 파일은 ${Math.floor(MAX_BRAND_BYTES / 1024)}KB 이하여야 합니다.`);
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setFaviconDataUrl(dataUrl);
      setFaviconFileName(file.name);
    } catch {
      toast.error('파비콘을 읽을 수 없습니다.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // JSON body. Empty string clears the field on the server.
      const payload = {
        ...form,
        logoUrl: logoDataUrl ?? '',
        faviconUrl: faviconDataUrl ?? '',
      };
      await masterApi.updateCompanyBrand(company.id, payload);
      toast.success(`브랜드 설정이 저장되었습니다.`);
      if (onSaved) onSaved();
      else onClose();
    } catch (err) {
      toast.error('저장 실패: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...BRAND_DEFAULTS });
    setLogoDataUrl(null);
    setFaviconDataUrl(null);
    setLogoFileName(null);
    setFaviconFileName(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-bold text-[#1a1a1a] flex items-center gap-2">
              <Palette size={18} className="text-indigo-500" />
              {company.name} — 브랜드 설정
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">이 업체가 로그인 시 보게 될 로고, 컬러, 스타일을 설정합니다.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-3 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {/* Brand Name */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">브랜드 이름</label>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => handleChange('brandName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                placeholder="브랜드 이름"
              />
            </div>

            {/* Logo & Favicon */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">로고 & 파비콘</label>
              <div className="grid grid-cols-2 gap-4">
                {/* Logo */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">로고</label>
                  {logoDataUrl ? (
                    <div className="relative border border-gray-200 rounded-lg p-3 flex items-center justify-center h-20" style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}>
                      <img src={logoDataUrl} alt="Logo" className="max-h-14 max-w-full object-contain" />
                      <button onClick={() => { setLogoDataUrl(null); setLogoFileName(null); }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => logoRef.current?.click()}
                      className="w-full h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors">
                      <Upload size={16} />
                      <span className="text-[10px]">로고 업로드</span>
                    </button>
                  )}
                  <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </div>
                {/* Favicon */}
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">파비콘</label>
                  {faviconDataUrl ? (
                    <div className="relative border border-gray-200 rounded-lg p-3 flex items-center justify-center h-20" style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}>
                      <img src={faviconDataUrl} alt="Favicon" className="max-h-10 max-w-full object-contain" />
                      <button onClick={() => { setFaviconDataUrl(null); setFaviconFileName(null); }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => faviconRef.current?.click()}
                      className="w-full h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors">
                      <Upload size={16} />
                      <span className="text-[10px]">파비콘 업로드</span>
                    </button>
                  )}
                  <input ref={faviconRef} type="file" accept="image/*,.ico" onChange={handleFaviconChange} className="hidden" />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">컬러 설정</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ColorInput label="메인 컬러" value={form.primaryColor} onChange={(v) => handleChange('primaryColor', v)} />
                <ColorInput label="보조 컬러" value={form.secondaryColor} onChange={(v) => handleChange('secondaryColor', v)} />
                <ColorInput label="강조 컬러" value={form.accentColor} onChange={(v) => handleChange('accentColor', v)} />
                <ColorInput label="경고 컬러" value={form.dangerColor} onChange={(v) => handleChange('dangerColor', v)} />
                <ColorInput label="헤더 배경" value={form.headerBg} onChange={(v) => handleChange('headerBg', v)} />
                <ColorInput label="헤더 텍스트" value={form.headerTextColor} onChange={(v) => handleChange('headerTextColor', v)} />
                <ColorInput label="페이지 배경" value={form.bodyBg} onChange={(v) => handleChange('bodyBg', v)} />
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">스타일</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">폰트</label>
                  <select value={form.fontFamily} onChange={(e) => handleChange('fontFamily', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none">
                    <option value="Pretendard, sans-serif">Pretendard</option>
                    <option value="'Noto Sans KR', sans-serif">Noto Sans KR</option>
                    <option value="'Spoqa Han Sans Neo', sans-serif">Spoqa Han Sans Neo</option>
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="system-ui, sans-serif">System UI</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">모서리 둥글기 (px)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="24" value={form.borderRadius}
                      onChange={(e) => handleChange('borderRadius', e.target.value)}
                      className="flex-1" />
                    <span className="text-sm font-mono text-gray-500 w-8 text-right">{form.borderRadius}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">미리보기</label>
              <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ fontFamily: form.fontFamily }}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: form.headerBg }}>
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="logo" className="h-4 object-contain" />
                  ) : (
                    <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-bold"
                      style={{ backgroundColor: form.primaryColor }}>
                      {form.brandName?.[0] || 'F'}
                    </div>
                  )}
                  <span className="text-[11px] font-semibold" style={{ color: form.headerTextColor }}>{form.brandName}</span>
                </div>
                <div className="p-3 flex gap-1.5" style={{ backgroundColor: form.bodyBg }}>
                  {[form.primaryColor, form.secondaryColor, form.accentColor, form.dangerColor].map((c, i) => (
                    <button key={i} className="text-[9px] px-2 py-1 text-white font-medium"
                      style={{ backgroundColor: c, borderRadius: form.borderRadius * 0.6 + 'px' }}>
                      {['저장', '확인', '편집', '삭제'][i]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
            <button onClick={handleReset}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              <RotateCcw size={13} /> 기본값 복원
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50">
                <Save size={14} /> {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[11px] text-gray-400 block mb-1">{label}</label>
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs font-mono text-gray-600 outline-none bg-transparent uppercase"
          maxLength={7} />
      </div>
    </div>
  );
}

/* ── Shared Field ─────────────────── */

function Field({ label, name, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name} type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
      />
    </div>
  );
}
