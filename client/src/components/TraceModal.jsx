import { useState, useRef, useEffect } from 'react';
import { X, Undo2, Trash2, Check, Info, ZoomIn, ZoomOut, Move } from 'lucide-react';

/**
 * TraceModal — 사용자가 DXF 프리뷰 위에 직접 외곽선을 찍어 폴리곤을 만드는 모달
 *
 * Props:
 *   open: boolean
 *   preview: { svgInner, viewBoxW, viewBoxH }
 *   fileName: string
 *   onComplete: ({ polygon, widthM, depthM, areaSqm }) => void
 *   onClose: () => void
 */
export default function TraceModal({ open, preview, fileName, onComplete, onClose }) {
  const svgRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPoints([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open]);

  if (!open || !preview) return null;

  const { svgInner, viewBoxW, viewBoxH } = preview;

  /* convert mouse event → SVG viewBox coords (meters) */
  const svgCoordsFromEvent = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  };

  const handleClick = (e) => {
    if (panning) return;  // don't add point during pan
    const p = svgCoordsFromEvent(e);
    if (!p) return;
    // snap to 10cm grid
    const snapped = {
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
    };
    setPoints((prev) => [...prev, snapped]);
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || e.shiftKey) {
      setPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      e.preventDefault();
    }
  };
  const handleMouseMove = (e) => {
    if (panning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }
  };
  const handleMouseUp = () => {
    if (panning) {
      setTimeout(() => setPanning(false), 50);   // avoid immediate click-through
      panStartRef.current = null;
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.3, Math.min(8, z + delta)));
  };

  const undo = () => setPoints((p) => p.slice(0, -1));
  const reset = () => setPoints([]);

  /* live stats */
  const stats = computeStats(points);

  const handleComplete = () => {
    if (points.length < 3) {
      alert('최소 3개 이상의 점을 찍어주세요.');
      return;
    }
    // Normalize: shift so min=0
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const poly = points.map((p) => ({
      x: parseFloat((p.x - minX).toFixed(3)),
      y: parseFloat((p.y - minY).toFixed(3)),
    }));
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    const w = Math.max(...xs);
    const h = Math.max(...ys);
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    onComplete({
      polygon: poly,
      widthM: parseFloat(w.toFixed(2)),
      depthM: parseFloat(h.toFixed(2)),
      areaSqm: parseFloat((Math.abs(a) / 2).toFixed(2)),
    });
  };

  // Compute the effective viewBox with zoom/pan applied
  const vbW = viewBoxW / zoom;
  const vbH = viewBoxH / zoom;
  const vbX = (viewBoxW - vbW) / 2 - (pan.x / 400) * viewBoxW;
  const vbY = (viewBoxH - vbH) / 2 - (pan.y / 400) * viewBoxH;

  // Radii / stroke-widths in world-coord space (meters). Scale inversely with zoom.
  const dotR = Math.max(0.02, Math.min(viewBoxW, viewBoxH) * 0.008 / zoom);
  const strokeW = Math.max(0.02, Math.min(viewBoxW, viewBoxH) * 0.004 / zoom);

  const polygonClosed = points.length >= 3;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-lg text-[#1a1a1a]">도면 위에 직접 그리기</h3>
            <p className="text-xs text-gray-500 mt-0.5">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
          <Info size={16} className="text-[#0073ea] shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700 leading-relaxed">
            도면의 <strong>외곽 꼭짓점</strong>을 순서대로 클릭하여 폴리곤을 그리세요.
            <span className="text-gray-500"> · Shift+드래그: 이동 · 휠: 확대/축소 · 10cm 단위 스냅</span>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden bg-gray-50 min-h-[500px]">
          <svg
            ref={svgRef}
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ cursor: panning ? 'grabbing' : 'crosshair' }}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Background: DXF preview (dim opacity) */}
            <g opacity="0.55" pointerEvents="none"
               dangerouslySetInnerHTML={{ __html: svgInner }} />

            {/* User polygon (filled if closed) */}
            {polygonClosed && (
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(0,115,234,0.15)"
                stroke="#0073ea"
                strokeWidth={strokeW}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}

            {/* User polyline (when not yet closed) */}
            {points.length === 2 && (
              <line
                x1={points[0].x} y1={points[0].y}
                x2={points[1].x} y2={points[1].y}
                stroke="#0073ea" strokeWidth={strokeW}
                pointerEvents="none"
              />
            )}

            {/* Vertex dots (with order numbers) */}
            {points.map((p, i) => (
              <g key={i} pointerEvents="none">
                <circle cx={p.x} cy={p.y} r={dotR} fill="#0073ea" stroke="white" strokeWidth={strokeW * 0.5} />
              </g>
            ))}
          </svg>

          {/* Zoom controls overlay */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-white rounded-lg shadow-lg p-1 border border-gray-200">
            <button onClick={() => setZoom(z => Math.min(8, z * 1.25))}
              className="p-2 hover:bg-gray-100 rounded"><ZoomIn size={16} /></button>
            <button onClick={() => setZoom(z => Math.max(0.3, z / 1.25))}
              className="p-2 hover:bg-gray-100 rounded"><ZoomOut size={16} /></button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-2 hover:bg-gray-100 rounded text-xs" title="원래대로"><Move size={16} /></button>
          </div>

          {/* Top-right stats */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md px-4 py-2 text-xs border border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-gray-500">점 <strong className="text-[#0073ea]">{points.length}</strong></span>
              {stats && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">{stats.widthM}m × {stats.depthM}m</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-700 font-semibold">{stats.areaSqm}㎡</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button" onClick={undo} disabled={points.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 size={14} /> 되돌리기
            </button>
            <button
              type="button" onClick={reset} disabled={points.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} /> 초기화
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">
              취소
            </button>
            <button
              type="button" onClick={handleComplete} disabled={points.length < 3}
              className="flex items-center gap-1.5 px-5 py-2 text-sm rounded-lg bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={14} /> 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function computeStats(points) {
  if (points.length < 2) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  let a = 0;
  if (points.length >= 3) {
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      a += points[i].x * points[j].y - points[j].x * points[i].y;
    }
  }
  return {
    widthM: w.toFixed(2),
    depthM: h.toFixed(2),
    areaSqm: (Math.abs(a) / 2).toFixed(2),
  };
}
