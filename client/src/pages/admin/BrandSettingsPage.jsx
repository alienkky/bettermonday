import { useState, useEffect, useRef } from 'react';
import { brandApi } from '../../api/client';
import useBrandStore from '../../store/brandStore';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Upload, X, RotateCcw, Save, Eye, Palette, Type, Image } from 'lucide-react';

const DEFAULTS = {
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

export default function BrandSettingsPage() {
  const [form, setForm] = useState({ ...DEFAULTS });
  const [logoFile, setLogoFile] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeFavicon, setRemoveFavicon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoRef = useRef();
  const faviconRef = useRef();
  const setBrand = useBrandStore(s => s.setBrand);

  useEffect(() => {
    brandApi.get().then(res => {
      const b = res.data;
      setForm({
        brandName: b.brandName || DEFAULTS.brandName,
        primaryColor: b.primaryColor || DEFAULTS.primaryColor,
        secondaryColor: b.secondaryColor || DEFAULTS.secondaryColor,
        accentColor: b.accentColor || DEFAULTS.accentColor,
        dangerColor: b.dangerColor || DEFAULTS.dangerColor,
        headerBg: b.headerBg || DEFAULTS.headerBg,
        headerTextColor: b.headerTextColor || DEFAULTS.headerTextColor,
        bodyBg: b.bodyBg || DEFAULTS.bodyBg,
        fontFamily: b.fontFamily || DEFAULTS.fontFamily,
        borderRadius: b.borderRadius || DEFAULTS.borderRadius,
      });
      if (b.logoUrl) setLogoPreview(b.logoUrl);
      if (b.faviconUrl) setFaviconPreview(b.faviconUrl);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleFaviconChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconFile(file);
    setRemoveFavicon(false);
    setFaviconPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const handleRemoveFavicon = () => {
    setFaviconFile(null);
    setFaviconPreview(null);
    setRemoveFavicon(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (logoFile) fd.append('logo', logoFile);
      if (faviconFile) fd.append('favicon', faviconFile);
      if (removeLogo) fd.append('removeLogo', 'true');
      if (removeFavicon) fd.append('removeFavicon', 'true');

      const res = await brandApi.update(fd);
      setBrand(res.data);
      // Update previews from server URLs so they persist after ObjectURL is revoked
      if (res.data.logoUrl) {
        setLogoPreview(res.data.logoUrl);
        setLogoFile(null);
      } else {
        setLogoPreview(null);
        setLogoFile(null);
      }
      if (res.data.faviconUrl) {
        setFaviconPreview(res.data.faviconUrl);
        setFaviconFile(null);
      } else {
        setFaviconPreview(null);
        setFaviconFile(null);
      }
      setRemoveLogo(false);
      setRemoveFavicon(false);
      toast.success('브랜드 설정이 저장되었습니다.');
    } catch (err) {
      toast.error('저장 실패: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULTS });
    setLogoFile(null);
    setFaviconFile(null);
    setLogoPreview(null);
    setFaviconPreview(null);
    setRemoveLogo(true);
    setRemoveFavicon(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">브랜드 설정</h1>
            <p className="text-sm text-gray-500 mt-1">프랜차이즈 시뮬레이터의 로고, 컬러, 스타일을 커스텀하세요.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <RotateCcw size={14} /> 기본값 복원
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: form.primaryColor }}>
              <Save size={14} /> {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Settings */}
          <div className="lg:col-span-2 space-y-6">

            {/* Brand Name */}
            <Section icon={<Type size={16} />} title="브랜드 이름">
              <input
                type="text"
                value={form.brandName}
                onChange={e => handleChange('brandName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                placeholder="브랜드 이름을 입력하세요"
              />
            </Section>

            {/* Logo & Favicon */}
            <Section icon={<Image size={16} />} title="로고 & 파비콘">
              <div className="grid grid-cols-2 gap-4">
                {/* Logo */}
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-2">로고</label>
                  {logoPreview ? (
                    <div>
                      <div className="relative border border-gray-200 rounded-lg p-3 flex items-center justify-center h-24" style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}>
                        <img src={logoPreview} alt="Logo" className="max-h-16 max-w-full object-contain" />
                        <button onClick={handleRemoveLogo}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                          <X size={10} />
                        </button>
                      </div>
                      {logoFile && <p className="text-xs text-gray-500 mt-1 truncate">{logoFile.name}</p>}
                      <button onClick={() => logoRef.current?.click()} className="text-xs text-blue-500 hover:underline mt-1">이미지 변경</button>
                    </div>
                  ) : (
                    <button onClick={() => logoRef.current?.click()}
                      className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
                      <Upload size={18} />
                      <span className="text-xs">로고 업로드</span>
                    </button>
                  )}
                  <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                </div>
                {/* Favicon */}
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-2">파비콘</label>
                  {faviconPreview ? (
                    <div className="relative border border-gray-200 rounded-lg p-3 flex items-center justify-center h-24" style={{ background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 16px 16px' }}>
                      <img src={faviconPreview} alt="Favicon" className="max-h-12 max-w-full object-contain" />
                      <button onClick={handleRemoveFavicon}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => faviconRef.current?.click()}
                      className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors">
                      <Upload size={18} />
                      <span className="text-xs">파비콘 업로드</span>
                    </button>
                  )}
                  <input ref={faviconRef} type="file" accept="image/*,.ico" onChange={handleFaviconChange} className="hidden" />
                </div>
              </div>
            </Section>

            {/* Colors */}
            <Section icon={<Palette size={16} />} title="컬러 설정">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ColorInput label="메인 컬러" value={form.primaryColor} onChange={v => handleChange('primaryColor', v)} />
                <ColorInput label="보조 컬러" value={form.secondaryColor} onChange={v => handleChange('secondaryColor', v)} />
                <ColorInput label="강조 컬러" value={form.accentColor} onChange={v => handleChange('accentColor', v)} />
                <ColorInput label="경고 컬러" value={form.dangerColor} onChange={v => handleChange('dangerColor', v)} />
                <ColorInput label="헤더 배경" value={form.headerBg} onChange={v => handleChange('headerBg', v)} />
                <ColorInput label="헤더 텍스트" value={form.headerTextColor} onChange={v => handleChange('headerTextColor', v)} />
                <ColorInput label="페이지 배경" value={form.bodyBg} onChange={v => handleChange('bodyBg', v)} />
              </div>
            </Section>

            {/* Typography & Style */}
            <Section icon={<Type size={16} />} title="스타일">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">폰트</label>
                  <select value={form.fontFamily} onChange={e => handleChange('fontFamily', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none">
                    <option value="Pretendard, sans-serif">Pretendard</option>
                    <option value="'Noto Sans KR', sans-serif">Noto Sans KR</option>
                    <option value="'Spoqa Han Sans Neo', sans-serif">Spoqa Han Sans Neo</option>
                    <option value="Inter, sans-serif">Inter</option>
                    <option value="system-ui, sans-serif">System UI</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">모서리 둥글기 (px)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="24" value={form.borderRadius}
                      onChange={e => handleChange('borderRadius', e.target.value)}
                      className="flex-1" />
                    <span className="text-sm font-mono text-gray-500 w-8 text-right">{form.borderRadius}</span>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* Right Column — Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
                <Eye size={14} /> 실시간 미리보기
              </div>
              <PreviewCard form={form} logoPreview={logoPreview} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
        <span className="text-gray-400">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 text-xs font-mono text-gray-600 outline-none bg-transparent uppercase"
          maxLength={7} />
      </div>
    </div>
  );
}

function PreviewCard({ form, logoPreview }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ fontFamily: form.fontFamily }}>
      {/* Header preview */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: form.headerBg }}>
        {logoPreview ? (
          <img src={logoPreview} alt="logo" className="h-5 object-contain" />
        ) : (
          <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold"
            style={{ backgroundColor: form.primaryColor }}>
            {form.brandName?.[0] || 'F'}
          </div>
        )}
        <span className="text-xs font-semibold" style={{ color: form.headerTextColor }}>{form.brandName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: form.primaryColor + '22', color: form.headerTextColor }}>메뉴1</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: form.headerTextColor + '88' }}>메뉴2</span>
        </div>
      </div>

      {/* Body preview */}
      <div className="p-3 space-y-2" style={{ backgroundColor: form.bodyBg }}>
        {/* Card */}
        <div className="bg-white p-3 border border-gray-100 shadow-sm" style={{ borderRadius: form.borderRadius + 'px' }}>
          <div className="text-xs font-semibold text-gray-800 mb-2">견적 요약</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: form.primaryColor + '33' }}>
              <div className="h-full rounded-full w-3/4" style={{ backgroundColor: form.primaryColor }} />
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className="text-[10px] px-2 py-1 rounded text-white font-medium"
              style={{ backgroundColor: form.primaryColor, borderRadius: form.borderRadius * 0.6 + 'px' }}>
              저장
            </button>
            <button className="text-[10px] px-2 py-1 rounded text-white font-medium"
              style={{ backgroundColor: form.secondaryColor, borderRadius: form.borderRadius * 0.6 + 'px' }}>
              확인
            </button>
            <button className="text-[10px] px-2 py-1 rounded text-white font-medium"
              style={{ backgroundColor: form.accentColor, borderRadius: form.borderRadius * 0.6 + 'px' }}>
              편집
            </button>
            <button className="text-[10px] px-2 py-1 rounded text-white font-medium"
              style={{ backgroundColor: form.dangerColor, borderRadius: form.borderRadius * 0.6 + 'px' }}>
              삭제
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-1.5">
          <div className="flex-1 bg-white p-2 border border-gray-100 text-center" style={{ borderRadius: form.borderRadius * 0.8 + 'px' }}>
            <div className="text-sm font-bold" style={{ color: form.primaryColor }}>128</div>
            <div className="text-[9px] text-gray-400">견적</div>
          </div>
          <div className="flex-1 bg-white p-2 border border-gray-100 text-center" style={{ borderRadius: form.borderRadius * 0.8 + 'px' }}>
            <div className="text-sm font-bold" style={{ color: form.secondaryColor }}>45</div>
            <div className="text-[9px] text-gray-400">고객</div>
          </div>
          <div className="flex-1 bg-white p-2 border border-gray-100 text-center" style={{ borderRadius: form.borderRadius * 0.8 + 'px' }}>
            <div className="text-sm font-bold" style={{ color: form.accentColor }}>12</div>
            <div className="text-[9px] text-gray-400">상담</div>
          </div>
        </div>
      </div>
    </div>
  );
}
