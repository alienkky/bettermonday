import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { spacesApi, uploadApi } from '../../api/client';
import Layout from '../../components/Layout';
import TraceModal from '../../components/TraceModal';
import toast from 'react-hot-toast';
import { MapPin, ArrowRight, Upload, FileText, AlertCircle, X, Maximize2, PenTool, Grid3X3, Coffee, Croissant, Edit3, Check } from 'lucide-react';

export default function StartPage() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', heightM: '2.8', brand: '' });

  // Parsed floorplan from uploaded file
  const [parsedPlan, setParsedPlan] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [fileName, setFileName] = useState(null);

  // Input method: 'upload' | 'manual' | 'draw'
  const [inputMethod, setInputMethod] = useState('upload');
  const [manual, setManual] = useState({ widthM: '', depthM: '' });
  const [drawSize, setDrawSize] = useState({ widthM: '', depthM: '' });

  // Manual trace modal
  const [traceOpen, setTraceOpen] = useState(false);
  const [tracedManually, setTracedManually] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  /* ── file upload ────────────────────────────────── */
  const handleFileUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['dxf', 'svg', 'dwg', 'eps'].includes(ext)) {
      setUploadError('지원 형식: DXF, SVG (DWG/EPS는 변환 필요)');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setParsedPlan(null);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadApi.parseFloorplan(fd);
      setParsedPlan(res.data);
      setTracedManually(false);
      setInputMethod('upload');
    } catch (err) {
      setUploadError(err.response?.data?.error || '파일 파싱 실패');
      setParsedPlan(null);
    } finally {
      setUploading(false);
    }
  };

  const handleTraceComplete = (result) => {
    // Replace auto-detected polygon with the manually traced one
    setParsedPlan((prev) => ({
      ...prev,
      polygon: result.polygon,
      widthM: result.widthM,
      depthM: result.depthM,
      areaSqm: result.areaSqm,
    }));
    setTracedManually(true);
    setTraceOpen(false);
    toast.success('직접 그린 외곽선이 적용되었습니다.');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-[#0073ea]', 'bg-[#f5faff]');
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-[#0073ea]', 'bg-[#f5faff]');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('border-[#0073ea]', 'bg-[#f5faff]');
  };

  const clearFile = () => { setParsedPlan(null); setFileName(null); setUploadError(null); };

  /* ── submit ─────────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.brand) return toast.error('브랜드를 선택하세요.');
    if (!form.name) return toast.error('가게 이름을 입력하세요.');

    let widthM, depthM, areaSqm, layoutJson, shape;

    if (inputMethod === 'manual') {
      widthM = parseFloat(manual.widthM);
      depthM = parseFloat(manual.depthM);
      if (!widthM || !depthM) return toast.error('가로/세로를 입력하세요.');
      areaSqm = widthM * depthM;
      layoutJson = null;
      shape = 'rectangle';
    } else if (inputMethod === 'draw') {
      widthM = parseFloat(drawSize.widthM);
      depthM = parseFloat(drawSize.depthM);
      if (!widthM || !depthM) return toast.error('기준 가로/세로를 입력하세요.');
      areaSqm = widthM * depthM;
      layoutJson = null;
      shape = 'custom';
    } else if (parsedPlan) {
      widthM = parsedPlan.widthM;
      depthM = parsedPlan.depthM;
      areaSqm = parsedPlan.areaSqm;
      layoutJson = { polygon: parsedPlan.polygon };
      shape = 'custom';
    } else {
      return toast.error('도면 파일을 업로드하거나 입력 방식을 선택하세요.');
    }

    setLoading(true);
    try {
      const res = await spacesApi.create({
        name: form.name,
        address: form.address,
        brand: form.brand,
        widthM,
        depthM,
        heightM: parseFloat(form.heightM),
        shape,
        layoutJson,
        areaSqm,
      });
      toast.success('공간이 생성되었습니다!');
      navigate(`/planner/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || '공간 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const manualArea = manual.widthM && manual.depthM
    ? (parseFloat(manual.widthM) * parseFloat(manual.depthM)).toFixed(1)
    : null;

  // ── Step completion for progress indicator ──
  const spaceDone = inputMethod === 'upload'
    ? !!parsedPlan
    : inputMethod === 'manual'
    ? !!(manual.widthM && manual.depthM)
    : !!(drawSize.widthM && drawSize.depthM);

  const steps = [
    { n: 1, label: '브랜드', done: !!form.brand },
    { n: 2, label: '기본 정보', done: !!form.name },
    { n: 3, label: '공간', done: spaceDone },
    { n: 4, label: '높이', done: !!form.heightM },
  ];
  const completedCount = steps.filter((s) => s.done).length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a1a]">공간 정보 입력</h1>
          <p className="text-gray-500 mt-1 text-sm">실측 도면을 업로드하거나 크기를 직접 입력해 공간을 만드세요.</p>
        </div>

        {/* ── Progress stepper ────────────────────── */}
        <div className="mb-6 bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-500">진행 상황</span>
            <span className="font-semibold text-[#0073ea]">{completedCount} / {steps.length} 완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 transition-colors ${s.done ? 'text-[#0073ea]' : 'text-gray-400'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    s.done ? 'bg-[#0073ea] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {s.done ? <Check size={12} /> : s.n}
                  </div>
                  <span className="text-[11px] font-medium whitespace-nowrap hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full ${s.done ? 'bg-[#0073ea]/40' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── 브랜드 선택 ────────────────────────── */}
          <Card title="브랜드 선택">
            <p className="text-xs text-gray-400 mb-3">견적을 낼 브랜드를 선택하세요.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, brand: '먼데이커피' }))}
                className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                  form.brand === '먼데이커피'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                  form.brand === '먼데이커피' ? 'bg-amber-100' : 'bg-gray-100'
                }`}>☕</div>
                <span className="text-sm font-semibold">먼데이커피</span>
                <span className="text-[10px] opacity-60">Monday Coffee</span>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, brand: '스토리오브라망' }))}
                className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                  form.brand === '스토리오브라망'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                  form.brand === '스토리오브라망' ? 'bg-purple-100' : 'bg-gray-100'
                }`}>🥐</div>
                <span className="text-sm font-semibold">스토리오브라망</span>
                <span className="text-[10px] opacity-60">Story of Ramang</span>
              </button>
            </div>
          </Card>

          {/* ── 기본 정보 ────────────────────────── */}
          <Card title="기본 정보">
            <div className="space-y-4">
              <FormField label="가게 이름 *" icon={<span className="text-[#0073ea]">📍</span>}>
                <input name="name" value={form.name} onChange={handleChange}
                  placeholder="예: 홍길동 카페 강남점" className={inputCls} />
              </FormField>
              <FormField label="주소 (선택)" icon={<MapPin size={16} className="text-gray-400" />}>
                <input name="address" value={form.address} onChange={handleChange}
                  placeholder="서울시 강남구 ..." className={inputCls} />
              </FormField>
            </div>
          </Card>

          {/* ── 공간 입력 방법 ────────────────────── */}
          <Card title="공간 입력">
            {/* Method tabs */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <MethodTab
                active={inputMethod === 'upload'}
                onClick={() => setInputMethod('upload')}
                icon={<Upload size={18} />}
                label="도면 업로드"
                desc="DXF / SVG"
              />
              <MethodTab
                active={inputMethod === 'manual'}
                onClick={() => setInputMethod('manual')}
                icon={<Grid3X3 size={18} />}
                label="직접 입력"
                desc="가로 × 세로"
              />
              <MethodTab
                active={inputMethod === 'draw'}
                onClick={() => setInputMethod('draw')}
                icon={<PenTool size={18} />}
                label="도면 그리기"
                desc="자유 다각형"
              />
            </div>

            {/* ── 1) 도면 업로드 ───── */}
            {inputMethod === 'upload' && (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#0073ea] hover:bg-[#f5faff] transition-all"
                >
                  <input ref={fileRef} type="file" accept=".dxf,.svg,.dwg,.eps"
                    className="hidden" onChange={(e) => handleFileUpload(e.target.files[0])} />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-[#0073ea]">
                      <div className="w-8 h-8 border-2 border-[#0073ea] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium">도면 분석 중...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto mb-3 text-gray-400" size={32} />
                      <p className="text-sm text-gray-600 font-medium">
                        실측 도면 파일을 끌어다 놓거나 클릭하세요
                      </p>
                      <p className="text-xs text-gray-400 mt-1">DXF, SVG 파일 지원</p>
                      <p className="text-xs text-gray-400">DWG → DXF, EPS → SVG 변환 후 업로드</p>
                    </>
                  )}
                </div>

                {uploadError && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg mt-3">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {parsedPlan && (
                  <div className="mt-4 bg-[#f5faff] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-[#0073ea]" />
                        <span className="text-sm font-medium text-[#1a1a1a]">{fileName}</span>
                        {tracedManually && (
                          <span className="text-[10px] bg-[#0073ea] text-white px-2 py-0.5 rounded-full">직접 그림</span>
                        )}
                      </div>
                      <button type="button" onClick={clearFile}
                        className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <InfoBox label="가로" value={`${parsedPlan.widthM}m`} />
                      <InfoBox label="세로" value={`${parsedPlan.depthM}m`} />
                      <InfoBox label="면적" value={`${parsedPlan.areaSqm}m²`}
                        sub={`${(parsedPlan.areaSqm / 3.305785).toFixed(1)}평`} highlight />
                    </div>
                    <MiniPreview polygon={parsedPlan.polygon} />

                    {/* Manual trace CTA — only if backend returned a preview */}
                    {parsedPlan.preview && (
                      <div className="mt-3 pt-3 border-t border-blue-100">
                        <button
                          type="button"
                          onClick={() => setTraceOpen(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#0073ea] bg-white hover:bg-blue-50 border border-[#0073ea] rounded-lg transition-colors"
                        >
                          <Edit3 size={14} />
                          {tracedManually ? '외곽선 다시 그리기' : '자동 인식이 부정확하면 직접 그리기'}
                        </button>
                        <p className="text-[10px] text-gray-400 text-center mt-1.5">
                          도면 위에 꼭짓점을 찍어 외곽선을 직접 그립니다
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── 2) 직접 입력 (사각형) ───── */}
            {inputMethod === 'manual' && (
              <>
                <p className="text-xs text-gray-400 mb-3">가로 × 세로 크기를 입력하면 사각형 공간이 생성됩니다.</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="가로 (m)">
                    <input type="number" step="0.1" min="1" value={manual.widthM}
                      onChange={(e) => setManual((f) => ({ ...f, widthM: e.target.value }))}
                      placeholder="예: 8.5" className={inputCls} />
                  </FormField>
                  <FormField label="세로 (m)">
                    <input type="number" step="0.1" min="1" value={manual.depthM}
                      onChange={(e) => setManual((f) => ({ ...f, depthM: e.target.value }))}
                      placeholder="예: 12" className={inputCls} />
                  </FormField>
                </div>
                {manualArea && (
                  <div className="flex items-center gap-2 text-sm bg-[#e6f3ff] text-[#0073ea] px-4 py-2.5 rounded-lg mt-3">
                    <Maximize2 size={15} />
                    <span>면적: <strong>{manualArea} m²</strong> ({(parseFloat(manualArea) / 3.305785).toFixed(1)}평)</span>
                  </div>
                )}
              </>
            )}

            {/* ── 3) 직접 도면 그리기 ───── */}
            {inputMethod === 'draw' && (
              <>
                <div className="bg-[#f0fdf4] rounded-xl p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <PenTool size={20} className="text-[#10b981] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-[#1a1a1a]">캔버스에서 직접 도면을 그립니다</p>
                      <p className="text-xs text-gray-500 mt-1">
                        기준 크기를 입력한 뒤 공간을 만들면, 캔버스에서 클릭으로 꼭짓점을 찍어 자유로운 형태의 도면을 그릴 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3">기준 사각형 크기 (도면 그리기 영역)</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="기준 가로 (m)">
                    <input type="number" step="0.1" min="1" value={drawSize.widthM}
                      onChange={(e) => setDrawSize((f) => ({ ...f, widthM: e.target.value }))}
                      placeholder="예: 10" className={inputCls} />
                  </FormField>
                  <FormField label="기준 세로 (m)">
                    <input type="number" step="0.1" min="1" value={drawSize.depthM}
                      onChange={(e) => setDrawSize((f) => ({ ...f, depthM: e.target.value }))}
                      placeholder="예: 15" className={inputCls} />
                  </FormField>
                </div>
                {drawSize.widthM && drawSize.depthM && (
                  <div className="flex items-center gap-2 text-sm bg-[#f0fdf4] text-[#10b981] px-4 py-2.5 rounded-lg mt-3">
                    <PenTool size={15} />
                    <span>기준 영역: <strong>{drawSize.widthM} × {drawSize.depthM} m</strong> — 생성 후 자유롭게 도면을 그립니다</span>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* ── 천장 높이 ────────────────────────── */}
          <Card title="천장 높이">
            <FormField label="천장 높이 (m)">
              <input name="heightM" type="number" step="0.1" min="2"
                value={form.heightM} onChange={handleChange} placeholder="2.8" className={inputCls} />
            </FormField>
          </Card>

          <button type="submit" disabled={loading}
            className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            {loading ? '생성 중...' : <>공간 만들기 <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>

      {/* Manual trace modal */}
      <TraceModal
        open={traceOpen}
        preview={parsedPlan?.preview}
        fileName={fileName}
        onComplete={handleTraceComplete}
        onClose={() => setTraceOpen(false)}
      />
    </Layout>
  );
}

/* ── Mini SVG preview of the parsed polygon ────────── */
function MiniPreview({ polygon }) {
  if (!polygon || polygon.length < 3) return null;
  const maxX = Math.max(...polygon.map((p) => p.x));
  const maxY = Math.max(...polygon.map((p) => p.y));
  const pad = Math.max(maxX, maxY) * 0.08;
  const vbW = maxX + pad * 2;
  const vbH = maxY + pad * 2;
  const pts = polygon.map((p) => `${p.x + pad},${p.y + pad}`).join(' ');

  return (
    <div className="mt-3 flex justify-center">
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full max-w-[260px] h-auto border border-gray-200 rounded-lg bg-white p-2">
        <polygon points={pts} fill="#e6f3ff" stroke="#0073ea"
          strokeWidth={Math.max(vbW, vbH) * 0.008} strokeLinejoin="round" />
        {/* vertex dots */}
        {polygon.map((p, i) => (
          <circle key={i} cx={p.x + pad} cy={p.y + pad}
            r={Math.max(vbW, vbH) * 0.012} fill="#0073ea" />
        ))}
      </svg>
    </div>
  );
}

/* ── small reusable components ─────────────────────── */
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea] transition-all';

function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-semibold text-[#1a1a1a] mb-4">{title}</h2>
      {children}
    </div>
  );
}

function FormField({ label, icon, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
        {icon}{label}
      </label>
      {children}
    </div>
  );
}

function MethodTab({ active, onClick, icon, label, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all text-center ${
        active
          ? 'border-[#0073ea] bg-[#f5faff] text-[#0073ea]'
          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] opacity-60">{desc}</span>
    </button>
  );
}

function InfoBox({ label, value, sub, highlight }) {
  return (
    <div className="bg-white rounded-lg p-3 text-center">
      <div className="text-gray-400 text-xs">{label}</div>
      <div className={`font-semibold ${highlight ? 'text-[#0073ea]' : 'text-[#1a1a1a]'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
