import { useEffect, useRef, useCallback, useState } from 'react';
import * as fabricLib from 'fabric';
import usePlannerStore from '../store/plannerStore';
import {
  ZoomIn, ZoomOut, Maximize2,
  Pencil, Check, RotateCcw, Edit3, Save, X,
} from 'lucide-react';
import IsometricPreview from './IsometricPreview';

const fabric    = fabricLib.fabric ?? fabricLib;
const GRID_SIZE = 40;   // px = 0.5 m  (visual grid)
const SNAP_PX   = 8;    // px = 0.1 m  (snap resolution)
const SCALE     = 80;   // px / m
const MIN_ZOOM  = 0.1;
const MAX_ZOOM  = 5;
const OFFSET    = 60;   // world-space margin around room (px)

/* ── helpers ──────────────────────────────────────────── */
const snapPx   = (v) => Math.round(v / SNAP_PX) * SNAP_PX;
const areaM2   = (pts) => {
  if (!pts || pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2);
};
const toPyeong = (m2) => (m2 / 3.305785).toFixed(1);
const byTag    = (c, tag) => c.getObjects().filter(o => o[tag]);
const clearTag = (c, tag) => byTag(c, tag).forEach(o => c.remove(o));

const getPolygonsFromLayout = (layoutJson) => {
  if (!layoutJson) return [];
  if (layoutJson.polygons?.length) return layoutJson.polygons;
  if (layoutJson.polygon?.length >= 3) return [{ id: 'main', name: '주 공간', vertices: layoutJson.polygon }];
  return [];
};
const POLY_COLORS = ['#1a1a1a', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/* ── silently raise all handles above everything else ─── */
// Direct _objects manipulation avoids renderAll conflicts during drag
function raiseHandles(canvas) {
  const objs = canvas._objects;
  const handles = [];
  const rest = [];
  for (const o of objs) {
    if (o._handle) handles.push(o);
    else rest.push(o);
  }
  if (handles.length === 0) return;
  objs.length = 0;
  objs.push(...rest, ...handles);
}

/* ── INFINITE GRID drawn in screen-space ──────────────── */
// Overrides Fabric's _renderBackground so the grid ALWAYS fills
// the entire canvas element regardless of pan / zoom.
function attachInfiniteGrid(canvas) {
  canvas._renderBackground = function (ctx) {
    const w = this.width, h = this.height;
    const z = this.getZoom();
    const [,, , , tx, ty] = this.viewportTransform;

    // Solid canvas background
    ctx.fillStyle = '#f5f6f8';
    ctx.fillRect(0, 0, w, h);

    const drawLines = (step, color, lw) => {
      const offX = ((tx % step) + step) % step;
      const offY = ((ty % step) + step) % step;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      for (let x = offX - step; x <= w + step; x += step) {
        const px = Math.round(x) + 0.5;
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = offY - step; y <= h + step; y += step) {
        const py = Math.round(y) + 0.5;
        ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
      ctx.restore();
    };

    // 0.5 m minor grid
    drawLines(GRID_SIZE * z, '#e8e9eb', 0.5);
    // 1 m major grid
    drawLines(GRID_SIZE * 2 * z, '#d1d5db', 1);
  };
}

/* ── room objects (floor + border + ruler labels) ─────── */
function buildRoom(canvas, roomW, roomH, widthM, depthM, isCustom, hasPoly) {
  const ox = OFFSET, oy = OFFSET;

  // Always draw rect floor as surface 0 (polygon overlays as surface 1)
  const floor = new fabric.Rect({
    left: ox, top: oy, width: roomW, height: roomH,
    fill: '#ffffff', strokeWidth: 0,
    selectable: false, evented: false,
  });
  floor._room = true;
  floor._floor = true;
  canvas.add(floor);

  // Room border (solid for non-custom rectangle spaces)
  if (!isCustom) {
    const border = new fabric.Rect({
      left: ox, top: oy, width: roomW, height: roomH,
      fill: 'rgba(0,0,0,0)',
      stroke: '#1a1a1a', strokeWidth: 2,
      selectable: false, evented: false,
    });
    border._room = true;
    canvas.add(border);
  } else if (hasPoly) {
    // For custom+polygon: draw dashed bounding border to show rect zone
    const border = new fabric.Rect({
      left: ox, top: oy, width: roomW, height: roomH,
      fill: 'rgba(0,0,0,0)',
      stroke: '#d1d5db', strokeWidth: 1, strokeDashArray: [6, 4],
      selectable: false, evented: false,
    });
    border._room = true;
    canvas.add(border);
  }

  // Ruler labels (inside the OFFSET margin)
  const xs = widthM > 20 ? 5 : widthM > 10 ? 2 : 1;
  const ys = depthM > 20 ? 5 : depthM > 10 ? 2 : 1;
  for (let i = 0; i <= widthM; i += xs) {
    const t = new fabric.Text(`${i}m`, {
      left: ox + i * SCALE - 10, top: oy - 18,
      fontSize: 9, fill: '#9ca3af', selectable: false, evented: false,
    });
    t._room = true; canvas.add(t);
  }
  for (let i = 0; i <= depthM; i += ys) {
    const t = new fabric.Text(`${i}m`, {
      left: ox - 30, top: oy + i * SCALE - 7,
      fontSize: 9, fill: '#9ca3af', selectable: false, evented: false,
    });
    t._room = true; canvas.add(t);
  }
}

/* ── polygon overlay ──────────────────────────────────── */
const renderPoly = (canvas, polygon, fillOverride) => {
  clearTag(canvas, '_poly');
  if (!polygon || polygon.length < 3) return;
  const pts = polygon.map(p => ({ x: p.x * SCALE + OFFSET, y: p.y * SCALE + OFFSET }));

  const addP = (opts) => {
    const o = new fabric.Polygon(pts, { selectable: false, evented: false, ...opts });
    o._poly = true;
    canvas.add(o);
  };
  addP({ fill: fillOverride || '#ffffff', stroke: '#1a1a1a', strokeWidth: 2.5 });

  polygon.forEach((pt, i) => {
    const nx  = polygon[(i + 1) % polygon.length];
    const len = Math.hypot(nx.x - pt.x, nx.y - pt.y);
    const mx  = (pt.x + nx.x) / 2 * SCALE + OFFSET;
    const my  = (pt.y + nx.y) / 2 * SCALE + OFFSET;
    const dx  = (nx.x - pt.x) * SCALE, dy = (nx.y - pt.y) * SCALE;
    const mag = Math.hypot(dx, dy) || 1;
    const lbl = new fabric.Text(`${len.toFixed(1)}m`, {
      left: mx + (-dy / mag) * 16 - 14, top: my + (dx / mag) * 16 - 9,
      fontSize: 11, fill: '#0073ea', fontWeight: 'bold',
      backgroundColor: 'rgba(255,255,255,0.9)', padding: 2,
      selectable: false, evented: false,
    });
    lbl._poly = true; canvas.add(lbl);
  });

  // Always keep handles above polygon + labels (silent reorder, no renderAll)
  raiseHandles(canvas);
};

/* ── vertex handles ───────────────────────────────────── */
const renderHandles = (canvas, polygon) => {
  clearTag(canvas, '_handle');
  polygon?.forEach((pt, idx) => {
    const cx = pt.x * SCALE + OFFSET, cy = pt.y * SCALE + OFFSET;
    const h  = new fabric.Circle({
      radius: 4, fill: '#ef4444', strokeWidth: 0,
      left: cx, top: cy,
      originX: 'center', originY: 'center',
      selectable: true, evented: true, hasControls: false, hasBorders: false,
      hoverCursor: 'move',
    });
    h._handle = true; h._idx = idx;
    canvas.add(h);
  });
  raiseHandles(canvas);
};

/* ── render editing polygon (non-main) — keeps _poly intact ── */
const renderEditPoly = (canvas, polygon) => {
  clearTag(canvas, '_editPoly');
  if (!polygon || polygon.length < 3) return;
  const pts = polygon.map(p => ({ x: p.x * SCALE + OFFSET, y: p.y * SCALE + OFFSET }));
  const shape = new fabric.Polygon(pts, {
    fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2.5,
    selectable: false, evented: false,
  });
  shape._editPoly = true;
  canvas.add(shape);
  polygon.forEach((pt, i) => {
    const nx = polygon[(i + 1) % polygon.length];
    const len = Math.hypot(nx.x - pt.x, nx.y - pt.y);
    const mx = (pt.x + nx.x) / 2 * SCALE + OFFSET;
    const my = (pt.y + nx.y) / 2 * SCALE + OFFSET;
    const dx = (nx.x - pt.x) * SCALE, dy = (nx.y - pt.y) * SCALE;
    const mag = Math.hypot(dx, dy) || 1;
    const lbl = new fabric.Text(`${len.toFixed(1)}m`, {
      left: mx + (-dy / mag) * 16 - 14, top: my + (dx / mag) * 16 - 9,
      fontSize: 11, fill: '#0073ea', fontWeight: 'bold',
      backgroundColor: 'rgba(255,255,255,0.9)', padding: 2,
      selectable: false, evented: false,
    });
    lbl._editPoly = true;
    canvas.add(lbl);
  });
  raiseHandles(canvas);
};

/* ── helper: pick correct render fn based on edit target ── */
const renderActivePoly = (canvas, polygon) => {
  if (byTag(canvas, '_editPoly').length > 0) renderEditPoly(canvas, polygon);
  else renderPoly(canvas, polygon);
};

/* ── render additional polygons ─────────────────────── */
const renderAdditionalPolys = (canvas, polygons) => {
  clearTag(canvas, '_addPoly');
  polygons.forEach((poly, idx) => {
    if (idx === 0) return; // main polygon rendered by renderPoly
    const verts = poly.vertices;
    if (!verts || verts.length < 3) return;
    const pts = verts.map(p => ({ x: p.x * SCALE + OFFSET, y: p.y * SCALE + OFFSET }));
    const shape = new fabric.Polygon(pts, {
      fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2.5,
      selectable: false, evented: false,
    });
    shape._addPoly = true;
    canvas.add(shape);
    // Edge length labels
    verts.forEach((pt, i) => {
      const nx = verts[(i + 1) % verts.length];
      const len = Math.hypot(nx.x - pt.x, nx.y - pt.y);
      const mx = (pt.x + nx.x) / 2 * SCALE + OFFSET;
      const my = (pt.y + nx.y) / 2 * SCALE + OFFSET;
      const dx = (nx.x - pt.x) * SCALE, dy = (nx.y - pt.y) * SCALE;
      const mag = Math.hypot(dx, dy) || 1;
      const lbl = new fabric.Text(`${len.toFixed(1)}m`, {
        left: mx + (-dy / mag) * 16 - 14, top: my + (dx / mag) * 16 - 9,
        fontSize: 11, fill: '#0073ea', fontWeight: 'bold',
        backgroundColor: 'rgba(255,255,255,0.9)', padding: 2,
        selectable: false, evented: false,
      });
      lbl._addPoly = true;
      canvas.add(lbl);
    });
    // Name + area label at centroid
    const cx = verts.reduce((s, p) => s + p.x, 0) / verts.length;
    const cy = verts.reduce((s, p) => s + p.y, 0) / verts.length;
    const polyArea = areaM2(verts);
    const aLabel = new fabric.Text(`${poly.name}\n${polyArea.toFixed(1)}m²`, {
      left: cx * SCALE + OFFSET - 20, top: cy * SCALE + OFFSET - 12,
      fontSize: 11, fill: '#1a1a1a', fontWeight: 'bold', textAlign: 'center',
      lineHeight: 1.3,
      backgroundColor: 'rgba(255,255,255,0.9)', padding: 3,
      selectable: false, evented: false,
    });
    aLabel._addPoly = true;
    canvas.add(aLabel);
  });
};

/* ── zone helpers ─────────────────────────────────────── */
const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const renderZones = (canvas, zones, savedPoly) => {
  // Remove all zone-related objects cleanly
  canvas.getObjects().filter(o => o._zone || o._zoneLabel || o._zonePreview).forEach(o => canvas.remove(o));

  // Build clip path from polygon (so zones don't extend outside floor)
  let clipPath;
  if (savedPoly && savedPoly.length >= 3) {
    const pts = savedPoly.map(p => ({ x: p.x * SCALE + OFFSET, y: p.y * SCALE + OFFSET }));
    clipPath = new fabric.Polygon(pts, { absolutePositioned: true });
  }

  zones.forEach((z, i) => {
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    const left = z.x * SCALE + OFFSET;
    const top = z.y * SCALE + OFFSET;
    const w = z.w * SCALE;
    const h = z.h * SCALE;
    const rect = new fabric.Rect({
      left, top, width: w, height: h,
      fill: 'transparent',
      stroke: color, strokeWidth: 2, strokeDashArray: [8, 4],
      selectable: false, evented: false, rx: 2, ry: 2,
      ...(clipPath && { clipPath }),
    });
    rect._zone = true; rect._zoneId = z.id;
    canvas.add(rect);
    const lbl = new fabric.Text(z.name, {
      left: left + 6, top: top + 4,
      fontSize: 11, fill: color, fontWeight: 'bold',
      backgroundColor: 'rgba(255,255,255,0.85)', padding: 2,
      selectable: false, evented: false,
      ...(clipPath && { clipPath }),
    });
    lbl._zone = true; lbl._zoneId = z.id;
    canvas.add(lbl);
  });
};

/* ── editable zones (selectable / movable / resizable) ── */
const renderEditableZones = (canvas, zones, savedPoly) => {
  // Remove all zone-related objects cleanly
  const toRemove = canvas.getObjects().filter(o => o._zone || o._zoneLabel || o._zonePreview);
  toRemove.forEach(o => canvas.remove(o));

  let clipPath;
  if (savedPoly && savedPoly.length >= 3) {
    const pts = savedPoly.map(p => ({ x: p.x * SCALE + OFFSET, y: p.y * SCALE + OFFSET }));
    clipPath = new fabric.Polygon(pts, { absolutePositioned: true });
  }

  zones.forEach((z, i) => {
    const color = ZONE_COLORS[i % ZONE_COLORS.length];
    const left = z.x * SCALE + OFFSET;
    const top = z.y * SCALE + OFFSET;
    const w = z.w * SCALE;
    const h = z.h * SCALE;
    const rect = new fabric.Rect({
      left, top, width: w, height: h,
      fill: color + '20',
      stroke: color, strokeWidth: 2.5, strokeDashArray: [8, 4],
      selectable: true, evented: true,
      hasControls: true, hasBorders: true,
      lockRotation: true,
      cornerColor: color, borderColor: color,
      transparentCorners: false,
      cornerSize: 8, cornerStyle: 'circle',
      hoverCursor: 'move',
      rx: 2, ry: 2,
      ...(clipPath && { clipPath }),
    });
    rect._zone = true;
    rect._zoneId = z.id;
    rect._editableZone = true;
    rect.setControlsVisibility({ mtr: false });
    canvas.add(rect);

    // Zone label: name + dimensions + area
    const area = (z.w * z.h).toFixed(1);
    const lblText = `${z.name}\n${z.w.toFixed(1)}×${z.h.toFixed(1)}m  ${area}m²`;
    const lbl = new fabric.Text(lblText, {
      left: left + 6, top: top + 4,
      fontSize: 11, fill: color, fontWeight: 'bold',
      lineHeight: 1.3,
      backgroundColor: 'rgba(255,255,255,0.88)', padding: 3,
      selectable: false, evented: false,
      ...(clipPath && { clipPath }),
    });
    lbl._zone = true;
    lbl._zoneId = z.id;
    lbl._zoneLabel = true;
    canvas.add(lbl);
  });

  canvas.requestRenderAll();
};

/* ── build polygon clip path for zone fills ─────────── */
const buildPolyClip = (savedPoly) => {
  if (!savedPoly || savedPoly.length < 3) return null;
  const pts = savedPoly.map(p => ({ x: p.x * SCALE + OFFSET, y: p.y * SCALE + OFFSET }));
  return new fabric.Polygon(pts, { absolutePositioned: true });
};

/* ── build rect clip path for standard rooms ────────── */
const buildRoomClip = (widthM, depthM) => {
  return new fabric.Rect({
    left: OFFSET, top: OFFSET,
    width: widthM * SCALE, height: depthM * SCALE,
    absolutePositioned: true,
  });
};

/* ── apply zone tile fills (per-zone rects clipped to floor) ── */
const applyZoneTileFills = (canvas, zones, placements, savedPoly, space) => {
  // Remove old zone fills
  canvas.getObjects().filter(o => o._zoneFill).forEach(o => canvas.remove(o));

  const zoneTiles = placements.filter(p => p.item?.tileSize && p.item?.imageUrl && p.zoneId);
  const zonelessTile = placements.find(p => p.item?.tileSize && p.item?.imageUrl && !p.zoneId);
  if (zoneTiles.length === 0 && !zonelessTile) return;

  // Build clip path: polygon or room rect
  const clipPath = savedPoly ? buildPolyClip(savedPoly) : buildRoomClip(space.widthM, space.depthM);

  // Helper: create a fill rect with tile pattern
  const addTileFill = (left, top, w, h, ft, zoneId) => {
    const fillRect = new fabric.Rect({
      left, top, width: w, height: h,
      fill: '#ffffff',
      selectable: false, evented: false,
      clipPath,
    });
    fillRect._zoneFill = true;
    if (zoneId) fillRect._zoneId = zoneId;
    canvas.add(fillRect);

    const tilePx = (ft.item.tileSize / 1000) * SCALE;
    const imgUrl = ft.item.imageUrl.startsWith('http')
      ? ft.item.imageUrl
      : `${window.location.origin}${ft.item.imageUrl}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const pc = document.createElement('canvas');
      pc.width = tilePx; pc.height = tilePx;
      const ctx = pc.getContext('2d');
      ctx.drawImage(img, 0, 0, tilePx, tilePx);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0, 0, tilePx, tilePx);
      fillRect.set('fill', new fabric.Pattern({ source: pc, repeat: 'repeat' }));
      canvas.renderAll();
    };
    img.src = imgUrl;
  };

  // Zone-less tile: covers entire floor
  if (zonelessTile) {
    if (savedPoly) {
      const xs = savedPoly.map(p => p.x), ys = savedPoly.map(p => p.y);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const maxX = Math.max(...xs), maxY = Math.max(...ys);
      addTileFill(
        minX * SCALE + OFFSET, minY * SCALE + OFFSET,
        (maxX - minX) * SCALE, (maxY - minY) * SCALE,
        zonelessTile, null
      );
    } else {
      addTileFill(OFFSET, OFFSET, space.widthM * SCALE, space.depthM * SCALE, zonelessTile, null);
    }
  }

  // Per-zone tiles on top
  const zoneMap = {};
  zoneTiles.forEach(ft => { zoneMap[ft.zoneId] = ft; });

  zones.forEach((z) => {
    const ft = zoneMap[z.id];
    if (!ft) return;
    addTileFill(z.x * SCALE + OFFSET, z.y * SCALE + OFFSET, z.w * SCALE, z.h * SCALE, ft, z.id);
  });
};

const CAT_COLORS = {
  painting: '#fef9c3', film: '#dbeafe', tile: '#dcfce7', fabric: '#fce7f3',
  lighting: '#fef3c7', hardware: '#e0e7ff', stone: '#f3e8ff', metalwork: '#ffedd5',
  plumbing: '#e0e7ff', woodwork: '#fef3c7', labor: '#f1f5f9',
};

/* ════════════════════════════════════════════════════════ */
export default function Canvas2D({ onSelect, onDrawComplete, facadeMode = false }) {
  const canvasRef    = useRef(null);
  const fabricRef    = useRef(null);
  const containerRef = useRef(null);
  const panRef       = useRef({ active: false, lastX: 0, lastY: 0 });
  const drawRef      = useRef({ points: [], objs: [], preview: null });
  const editPolyRef  = useRef(null);
  const roRef        = useRef(null);

  const [zoom,       setZoom]       = useState(1);
  const [mode,       setMode]       = useState('normal');
  const [drawCount,  setDrawCount]  = useState(0);
  const [previewLen, setPreviewLen] = useState(null);
  const [area,       setArea]       = useState(null);
  const [ctxMenu,    setCtxMenu]    = useState(null);
  const [moveInput,  setMoveInput]  = useState(null);
  const { space, placements, zones, addZone, removeZone, updateZone, addPlacement, updatePlacement, removePlacement, setSelectedId, unlockedIds } = usePlannerStore();

  const isCustom  = space?.shape === 'custom';
  const floorPolygons = getPolygonsFromLayout(space?.layoutJson);
  const facadePolygonsData = getPolygonsFromLayout(space?.layoutJson?.facade);
  const savedPolygons = facadeMode ? facadePolygonsData : floorPolygons;
  const savedPoly = savedPolygons[0]?.vertices ?? null;
  const totalPolyArea = savedPolygons.reduce((sum, p) => sum + areaM2(p.vertices), 0);
  const [drawTarget, setDrawTarget] = useState(null); // null | 'new' | number (edit index)
  const depthVal = facadeMode ? (space?.heightM || 3) : space?.depthM;

  /* ── compute fit viewport (centers room in canvas) ─── */
  const computeFit = useCallback((ctrW, ctrH, roomW, roomH) => {
    const worldW = roomW + OFFSET * 2;
    const worldH = roomH + OFFSET * 2;
    const fz = Math.min(ctrW / worldW, ctrH / worldH, 1);
    const z  = Math.max(MIN_ZOOM, fz);
    // Center the room in the canvas
    const tx = ctrW  / 2 - (OFFSET + roomW / 2) * z;
    const ty = ctrH / 2 - (OFFSET + roomH / 2) * z;
    return { z, tx, ty };
  }, []);

  /* ── init canvas ──────────────────────────────────── */
  useEffect(() => {
    if (!space || !canvasRef.current) return;

    const roomW = Math.round(space.widthM * SCALE);
    const roomH = Math.round(depthVal * SCALE);

    const init = (ctrW, ctrH) => {
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: ctrW, height: ctrH,
        backgroundColor: '#f5f6f8',
        selection: true,
      });
      fabricRef.current = canvas;

      // Attach infinite grid (drawn in screen-space on every render)
      attachInfiniteGrid(canvas);

      // Build room objects (floor + border + labels)
      buildRoom(canvas, roomW, roomH, space.widthM, depthVal, isCustom || facadeMode, !!savedPoly);
      if (savedPoly) { renderPoly(canvas, savedPoly); setArea(areaM2(savedPoly)); }
      if (savedPolygons.length > 1) renderAdditionalPolys(canvas, savedPolygons);
      if (savedPolygons.length > 0) setArea(totalPolyArea);

      // Render zones (floor plan only)
      if (!facadeMode) {
        const currentZones = usePlannerStore.getState().zones;
        if (currentZones.length > 0) renderZones(canvas, currentZones, savedPoly);
      }

      // Center room in canvas
      const { z, tx, ty } = computeFit(ctrW, ctrH, roomW, roomH);
      canvas.setViewportTransform([z, 0, 0, z, tx, ty]);
      setZoom(Math.round(z * 100));

      /* ── events ─────────────────────────────────── */
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let z2 = canvas.getZoom();
        z2 *= 0.999 ** delta;
        z2 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z2));
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z2);
        setZoom(Math.round(z2 * 100));
        opt.e.preventDefault(); opt.e.stopPropagation();
      });

      canvas.on('object:moving', (e) => {
        const obj = e.target; if (!obj._handle) return;
        const snX = snapPx(obj.left), snY = snapPx(obj.top);
        obj.set({ left: snX, top: snY });
        const np = editPolyRef.current.map((p, i) =>
          i === obj._idx ? { x: (snX - OFFSET) / SCALE, y: (snY - OFFSET) / SCALE } : p
        );
        editPolyRef.current = np;
        renderActivePoly(canvas, np);
        setArea(areaM2(np));
      });

      canvas.on('object:modified', (e) => {
        const obj = e.target;
        if (obj._handle) {
          const snX = snapPx(obj.left), snY = snapPx(obj.top);
          obj.set({ left: snX, top: snY });
          const np  = editPolyRef.current.map((p, i) =>
            i === obj._idx ? { x: (snX - OFFSET) / SCALE, y: (snY - OFFSET) / SCALE } : p
          );
          editPolyRef.current = np; setArea(areaM2(np));
          renderActivePoly(canvas, np);
          canvas.renderAll(); return;
        }
        if (obj?.placementId) {
          updatePlacement(obj.placementId, {
            x: Math.round((obj.left - OFFSET) / SCALE * 100) / 100,
            y: Math.round((obj.top  - OFFSET) / SCALE * 100) / 100,
            rotation: obj.angle || 0,
          });
        }
      });

      // dblclick handled via React onDoubleClick on wrapper div (see handleWrapDblClick)

      canvas.on('selection:created', (e) => {
        const obj = e.selected?.[0];
        if (obj?.placementId) { setSelectedId(obj.placementId); onSelect?.(obj.placementId); }
      });
      canvas.on('selection:cleared', () => { setSelectedId(null); onSelect?.(null); });
    };

    // Use ResizeObserver to wait for container dimensions AND handle resize
    let inited = false;
    roRef.current = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width < 10 || height < 10) return;

      const w = Math.floor(width), h = Math.floor(height);
      if (!inited) {
        inited = true;
        init(w, h);
        return;
      }

      // Resize existing canvas to match new container size
      const canvas = fabricRef.current;
      if (!canvas) return;
      canvas.setWidth(w);
      canvas.setHeight(h);
      canvas.renderAll();
    });
    roRef.current.observe(containerRef.current);

    // Also try immediately (in case already sized)
    const el = containerRef.current;
    if (el && el.clientWidth > 10 && el.clientHeight > 10) {
      inited = true;
      init(el.clientWidth, el.clientHeight);
    }

    return () => {
      roRef.current?.disconnect();
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    };
  }, [space]); // eslint-disable-line — facadeMode handled via key-based remount

  // Auto-enter draw mode for new custom space or facade without polygon
  useEffect(() => {
    const shouldAutoDraw = facadeMode ? !savedPoly : (isCustom && !savedPoly);
    if (shouldAutoDraw && fabricRef.current) {
      drawRef.current = { points: [], objs: [], preview: null };
      setMode('drawing'); setDrawCount(0);
    }
  }, [isCustom, savedPoly]); // eslint-disable-line — facadeMode stable per mount

  /* ── world coords from mouse ──────────────────────── */
  const toWorld = useCallback((cx, cy) => {
    const canvas = fabricRef.current; if (!canvas) return { x: 0, y: 0 };
    const rect   = canvas.getElement().getBoundingClientRect();
    const z      = canvas.getZoom(), vpt = canvas.viewportTransform;
    return { x: (cx - rect.left - vpt[4]) / z, y: (cy - rect.top - vpt[5]) / z };
  }, []);

  /* ── finalize polygon ─────────────────────────────── */
  const finalizeDrawing = useCallback(() => {
    const canvas = fabricRef.current, state = drawRef.current;
    if (!canvas || state.points.length < 3) return;
    if (state.preview) canvas.remove(state.preview);
    state.objs.forEach(o => canvas.remove(o));
    drawRef.current = { points: [], objs: [], preview: null };
    const poly = state.points.map(p => p.meterPos);
    const isNew = drawTarget === 'new';
    if (!isNew) {
      renderPoly(canvas, poly);
    }
    setMode('normal'); setDrawCount(0); setPreviewLen(null); setDrawTarget(null);
    canvas.renderAll();
    onDrawComplete?.(poly, isNew ? -1 : 0);
  }, [onDrawComplete, drawTarget]);

  /* ── add draw vertex ──────────────────────────────── */
  const addDrawPoint = useCallback((cx, cy) => {
    const canvas = fabricRef.current; if (!canvas) return;
    const state  = drawRef.current;
    const raw    = toWorld(cx, cy);
    const wx     = snapPx(raw.x), wy = snapPx(raw.y);

    if (state.points.length >= 3) {
      const f = state.points[0].canvasPos;
      if (Math.hypot(wx - f.x, wy - f.y) < 20) { finalizeDrawing(); return; }
    }
    const isFirst = state.points.length === 0;
    const dot = new fabric.Circle({
      radius: isFirst ? 8 : 5,
      fill: isFirst ? '#0073ea' : '#fff', stroke: '#0073ea', strokeWidth: 2,
      left: wx - (isFirst ? 8 : 5), top: wy - (isFirst ? 8 : 5),
      selectable: false, evented: false,
    });
    dot._drawObj = true; canvas.add(dot); state.objs.push(dot);

    if (state.points.length > 0) {
      const last = state.points[state.points.length - 1].canvasPos;
      const ln   = new fabric.Line([last.x, last.y, wx, wy], {
        stroke: '#0073ea', strokeWidth: 2, selectable: false, evented: false,
      });
      ln._drawObj = true; canvas.add(ln); state.objs.push(ln);
      const lenM = Math.hypot((wx - last.x) / SCALE, (wy - last.y) / SCALE);
      const lbl  = new fabric.Text(`${lenM.toFixed(1)}m`, {
        left: (last.x + wx) / 2 - 12, top: (last.y + wy) / 2 - 18,
        fontSize: 11, fill: '#0073ea', fontWeight: 'bold',
        backgroundColor: 'rgba(255,255,255,0.9)', padding: 2,
        selectable: false, evented: false,
      });
      lbl._drawObj = true; canvas.add(lbl); state.objs.push(lbl);
    }
    state.points.push({
      canvasPos: { x: wx, y: wy },
      meterPos:  { x: (wx - OFFSET) / SCALE, y: (wy - OFFSET) / SCALE },
    });
    setDrawCount(state.points.length); canvas.renderAll();
  }, [toWorld, finalizeDrawing]);

  const updatePreview = useCallback((cx, cy) => {
    const canvas = fabricRef.current, state = drawRef.current;
    if (!canvas || state.points.length === 0) return;
    const raw  = toWorld(cx, cy);
    const wx   = snapPx(raw.x), wy = snapPx(raw.y);
    if (state.preview) canvas.remove(state.preview);
    const last = state.points[state.points.length - 1].canvasPos;
    setPreviewLen(Math.hypot((wx - last.x) / SCALE, (wy - last.y) / SCALE).toFixed(1));
    state.preview = new fabric.Line([last.x, last.y, wx, wy], {
      stroke: '#0073ea', strokeWidth: 1.5, strokeDashArray: [6, 4],
      selectable: false, evented: false,
    });
    canvas.add(state.preview); canvas.renderAll();
  }, [toWorld]);

  const resetDraw = useCallback(() => {
    const canvas = fabricRef.current, state = drawRef.current;
    if (canvas) {
      if (state.preview) canvas.remove(state.preview);
      state.objs.forEach(o => canvas.remove(o)); canvas.renderAll();
    }
    drawRef.current = { points: [], objs: [], preview: null };
    setDrawCount(0); setPreviewLen(null);
    setMode('normal'); setTimeout(() => setMode('drawing'), 20);
  }, []);

  const startNewPolygonDraw = useCallback(() => {
    drawRef.current = { points: [], objs: [], preview: null };
    setDrawTarget('new');
    setMode('drawing');
    setDrawCount(0);
  }, []);

  const deletePolygon = useCallback((polyIdx) => {
    if (polyIdx === 0) return; // can't delete main polygon
    onDrawComplete?.(null, polyIdx); // null signals deletion
  }, [onDrawComplete]);

  /* ── edit mode ────────────────────────────────────── */
  const enterEditMode = useCallback((polyIdx = 0) => {
    const canvas = fabricRef.current;
    const targetVerts = savedPolygons[polyIdx]?.vertices;
    if (!canvas || !targetVerts) return;
    editPolyRef.current = targetVerts.map(p => ({ ...p }));
    setDrawTarget(polyIdx);
    setArea(areaM2(editPolyRef.current));
    setMode('editing'); canvas.selection = false;
    if (polyIdx === 0) {
      // Edit main polygon — uses _poly tag
      renderPoly(canvas, editPolyRef.current);
    } else {
      // Edit additional polygon — keep main (_poly) intact, use _editPoly
      clearTag(canvas, '_addPoly');
      renderEditPoly(canvas, editPolyRef.current);
    }
    renderHandles(canvas, editPolyRef.current); canvas.renderAll();
  }, [savedPolygons]);

  const exitEditMode = useCallback((save) => {
    const canvas = fabricRef.current; if (!canvas) return;
    clearTag(canvas, '_handle');
    clearTag(canvas, '_editPoly');
    canvas.selection = true; setMode('normal'); setCtxMenu(null);
    const editIdx = typeof drawTarget === 'number' ? drawTarget : 0;
    if (save) {
      const poly = editPolyRef.current;
      if (editIdx === 0) renderPoly(canvas, poly);
      // Re-render additional polygons (they were cleared during edit)
      if (editIdx > 0 && savedPolygons.length > 1) renderAdditionalPolys(canvas, savedPolygons);
      setArea(totalPolyArea - areaM2(savedPolygons[editIdx]?.vertices || []) + areaM2(poly));
      canvas.renderAll();
      onDrawComplete?.(poly, editIdx);
    } else {
      if (editIdx === 0) renderPoly(canvas, savedPoly);
      // Restore additional polygons on cancel
      if (editIdx > 0 && savedPolygons.length > 1) renderAdditionalPolys(canvas, savedPolygons);
      setArea(totalPolyArea);
      editPolyRef.current = savedPolygons[editIdx]?.vertices ?? savedPoly;
      canvas.renderAll();
    }
    setDrawTarget(null);
  }, [savedPoly, savedPolygons, totalPolyArea, onDrawComplete, drawTarget]);

  /* ── context menu ─────────────────────────────────── */
  const ctxDelete = useCallback(() => {
    const canvas = fabricRef.current; if (!canvas || ctxMenu == null) return;
    const poly = editPolyRef.current; if (poly.length <= 3) { setCtxMenu(null); return; }
    const np = poly.filter((_, i) => i !== ctxMenu.idx);
    editPolyRef.current = np; setArea(areaM2(np));
    renderActivePoly(canvas, np); renderHandles(canvas, np); canvas.renderAll(); setCtxMenu(null);
  }, [ctxMenu]);

  const ctxAddMid = useCallback(() => {
    const canvas = fabricRef.current; if (!canvas || ctxMenu == null) return;
    const poly = editPolyRef.current, idx = ctxMenu.idx, nx = (idx + 1) % poly.length;
    const mid  = {
      x: Math.round((poly[idx].x + poly[nx].x) / 2 * 2) / 2,
      y: Math.round((poly[idx].y + poly[nx].y) / 2 * 2) / 2,
    };
    const np = [...poly.slice(0, nx), mid, ...poly.slice(nx)];
    editPolyRef.current = np; setArea(areaM2(np));
    renderActivePoly(canvas, np); renderHandles(canvas, np); canvas.renderAll(); setCtxMenu(null);
  }, [ctxMenu]);

  const ctxOpenMove = useCallback(() => {
    if (!ctxMenu) return;
    const pt = editPolyRef.current[ctxMenu.idx];
    setMoveInput({ idx: ctxMenu.idx, x: pt.x.toFixed(2), y: pt.y.toFixed(2) });
    setCtxMenu(null);
  }, [ctxMenu]);

  const applyMove = useCallback(() => {
    const canvas = fabricRef.current; if (!canvas || !moveInput) return;
    const nx = parseFloat(moveInput.x), ny = parseFloat(moveInput.y);
    if (isNaN(nx) || isNaN(ny)) return;
    const np = editPolyRef.current.map((p, i) => i === moveInput.idx ? { x: nx, y: ny } : p);
    editPolyRef.current = np; setArea(areaM2(np));
    renderActivePoly(canvas, np); renderHandles(canvas, np); canvas.renderAll(); setMoveInput(null);
  }, [moveInput]);

  const onContextMenu = useCallback((e) => {
    e.preventDefault(); if (mode !== 'editing') return;
    const raw = toWorld(e.clientX, e.clientY), poly = editPolyRef.current;
    let minVD = Infinity, minVIdx = -1;
    poly.forEach((pt, i) => {
      const d = Math.hypot(raw.x - (pt.x * SCALE + OFFSET), raw.y - (pt.y * SCALE + OFFSET));
      if (d < minVD) { minVD = d; minVIdx = i; }
    });
    if (minVD < 22) { setCtxMenu({ x: e.clientX, y: e.clientY, idx: minVIdx }); return; }
    let minED = Infinity, minEIdx = -1;
    poly.forEach((pt, i) => {
      const nxt = poly[(i + 1) % poly.length];
      const ax  = pt.x * SCALE + OFFSET, ay = pt.y * SCALE + OFFSET;
      const bx  = nxt.x * SCALE + OFFSET, by = nxt.y * SCALE + OFFSET;
      const dx  = bx - ax, dy = by - ay;
      const t   = Math.max(0, Math.min(1, ((raw.x - ax) * dx + (raw.y - ay) * dy) / (dx * dx + dy * dy)));
      const d   = Math.hypot(raw.x - ax - t * dx, raw.y - ay - t * dy);
      if (d < minED) { minED = d; minEIdx = i; }
    });
    if (minED < 14) setCtxMenu({ x: e.clientX, y: e.clientY, idx: minEIdx, isEdge: true });
  }, [mode, toWorld]);

  /* ── pan (right-click drag) ───────────────────────── */
  const startPan = useCallback((x, y) => { panRef.current = { active: true, lastX: x, lastY: y }; }, []);
  const doPan    = useCallback((x, y) => {
    if (!panRef.current.active) return;
    const canvas = fabricRef.current; if (!canvas) return;
    const vpt = canvas.viewportTransform;
    vpt[4] += x - panRef.current.lastX; vpt[5] += y - panRef.current.lastY;
    canvas.requestRenderAll();
    panRef.current.lastX = x; panRef.current.lastY = y;
  }, []);
  const stopPan  = useCallback(() => { panRef.current.active = false; }, []);

  const onOverlayDown = useCallback((e) => {
    if (e.button === 2) { e.preventDefault(); startPan(e.clientX, e.clientY); }
    else if (e.button === 0) addDrawPoint(e.clientX, e.clientY);
  }, [startPan, addDrawPoint]);
  const onOverlayMove = useCallback((e) => {
    if (panRef.current.active) { doPan(e.clientX, e.clientY); return; }
    updatePreview(e.clientX, e.clientY);
  }, [doPan, updatePreview]);
  const onOverlayUp   = useCallback((e) => { if (e.button === 2) stopPan(); }, [stopPan]);

  const onWrapDown = useCallback((e) => {
    if (e.button === 2) { e.preventDefault(); startPan(e.clientX, e.clientY); }
  }, [startPan]);
  const onWrapMove = useCallback((e) => { doPan(e.clientX, e.clientY); }, [doPan]);
  const onWrapUp   = useCallback((e) => { if (e.button === 2) stopPan(); }, [stopPan]);

  /* ── double-click on edge → add vertex ───────────── */
  const handleWrapDblClick = useCallback((e) => {
    const canvas = fabricRef.current;
    const poly = editPolyRef.current;
    if (!canvas || !poly || byTag(canvas, '_handle').length === 0) return;

    // Use Fabric's getPointer for correct world coords (handles DPR + CSS scaling)
    const pointer = canvas.getPointer(e.nativeEvent || e);
    const z = canvas.getZoom();

    // Check if a handle is under cursor → delete vertex
    const handleHitR = 15 / z;
    for (const h of byTag(canvas, '_handle')) {
      if (Math.hypot(pointer.x - h.left, pointer.y - h.top) < handleHitR) {
        if (poly.length <= 3) return;
        const np = poly.filter((_, i) => i !== h._idx);
        editPolyRef.current = np; setArea(areaM2(np));
        renderActivePoly(canvas, np); renderHandles(canvas, np); canvas.renderAll();
        return;
      }
    }

    // Find closest edge
    const threshold = 30 / z;
    let minD = Infinity, bestEdge = -1, bestT = 0;

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ax = a.x * SCALE + OFFSET, ay = a.y * SCALE + OFFSET;
      const bx = b.x * SCALE + OFFSET, by = b.y * SCALE + OFFSET;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((pointer.x - ax) * dx + (pointer.y - ay) * dy) / len2));
      const px = ax + t * dx, py = ay + t * dy;
      const d = Math.hypot(pointer.x - px, pointer.y - py);
      if (d < minD) { minD = d; bestEdge = i; bestT = t; }
    }

    if (bestEdge < 0 || minD > threshold) return;

    const a = poly[bestEdge], b = poly[(bestEdge + 1) % poly.length];
    const snX = snapPx((a.x + bestT * (b.x - a.x)) * SCALE + OFFSET);
    const snY = snapPx((a.y + bestT * (b.y - a.y)) * SCALE + OFFSET);
    const newPt = { x: (snX - OFFSET) / SCALE, y: (snY - OFFSET) / SCALE };

    const np = [...poly.slice(0, bestEdge + 1), newPt, ...poly.slice(bestEdge + 1)];
    editPolyRef.current = np; setArea(areaM2(np));
    renderActivePoly(canvas, np); renderHandles(canvas, np); canvas.renderAll();
  }, []);

  /* ── drop ─────────────────────────────────────────── */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const canvas = fabricRef.current; if (!canvas || mode !== 'normal') return;
    const itemStr = e.dataTransfer.getData('application/json'); if (!itemStr) return;
    const item = JSON.parse(itemStr);
    const rect = canvas.getElement().getBoundingClientRect();
    const z    = canvas.getZoom(), vpt = canvas.viewportTransform;
    const worldX = (e.clientX - rect.left - vpt[4]) / z;
    const worldY = (e.clientY - rect.top  - vpt[5]) / z;
    const x    = Math.max(0, worldX / SCALE);
    const y    = Math.max(0, worldY / SCALE);

    const px = parseFloat(x.toFixed(2)), py = parseFloat(y.toFixed(2));

    // For floor tiles, detect which zone was dropped onto
    if (item.tileSize && (item.imageUrl || item.isoImageUrl)) {
      const currentZones = usePlannerStore.getState().zones;
      if (currentZones.length > 0) {
        // Convert to room-relative meters (zones use room-relative coords)
        const roomX = (worldX - OFFSET) / SCALE;
        const roomY = (worldY - OFFSET) / SCALE;
        const targetZone = currentZones.find(z =>
          roomX >= z.x && roomX <= z.x + z.w && roomY >= z.y && roomY <= z.y + z.h
        );
        addPlacement(item, px, py, targetZone ? targetZone.id : currentZones[0].id);
        return;
      }
    }
    addPlacement(item, px, py);
  }, [addPlacement, mode]);

  /* ── keyboard delete ──────────────────────────────── */
  const handleKeyDown = useCallback((e) => {
    const canvas = fabricRef.current; if (!canvas) return;
    const active = canvas.getActiveObject(); if (!active?.placementId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      removePlacement(active.placementId); canvas.remove(active); canvas.renderAll();
    }
  }, [removePlacement]);
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ── placements sync ──────────────────────────────── */
  useEffect(() => {
    const canvas = fabricRef.current; if (!canvas || !space) return;

    // Discard any active selection before re-rendering to prevent stale references
    canvas.discardActiveObject();

    // Remove old zone previews (ghost rects from interrupted drawing)
    canvas.getObjects().filter(o => o._zonePreview).forEach(o => canvas.remove(o));

    canvas.getObjects().filter(o => o.placementId).forEach(o => canvas.remove(o));

    // Render additional polygons
    if (savedPolygons.length > 1) renderAdditionalPolys(canvas, savedPolygons);

    // Facade mode: only render polygons, skip zones/placements
    if (facadeMode) { canvas.renderAll(); return; }

    // Render zones (editable in zone drawing mode, static otherwise)
    const currentZones = usePlannerStore.getState().zones;
    const isZoneMode = mode === 'zoneDrawing';
    if (isZoneMode) {
      renderEditableZones(canvas, currentZones, savedPoly);
    } else {
      renderZones(canvas, currentZones, savedPoly);
    }

    // Apply per-zone tile fills (each clipped to floor polygon/rect boundary)
    applyZoneTileFills(canvas, currentZones, placements, savedPoly, space);

    placements.forEach((p) => {
      const item    = p.item, catName = item?.category?.name || 'tile';
      // Skip rendering tile items as rectangles — they fill the surface
      if (item.tileSize && (item.imageUrl || item.isoImageUrl)) return;

      const color   = CAT_COLORS[catName] || '#e2e8f0';
      const w = item.width  ? Math.round(item.width  * SCALE) : GRID_SIZE;
      const h = item.height ? Math.round(item.height * SCALE) : GRID_SIZE;
      const rect  = new fabric.Rect({ width: w, height: h, fill: color, stroke: '#94a3b8', strokeWidth: 1.5, rx: 4, ry: 4 });
      const lbl   = new fabric.Text(item.name.length > 6 ? item.name.slice(0, 6) + '…' : item.name, {
        fontSize: 10, fill: '#1a1a1a', originX: 'center', originY: 'center',
        left: w / 2, top: h / 2, selectable: false,
      });
      const group = new fabric.Group([rect, lbl], {
        left: Math.round(p.x * SCALE) + OFFSET, top: Math.round(p.y * SCALE) + OFFSET,
        angle: p.rotation || 0, hasControls: true, hasBorders: true,
        placementId: p.id, cornerSize: 8, cornerColor: '#0073ea', borderColor: '#0073ea',
      });
      const locked = item.isRequired && !unlockedIds.includes(item.id);
      if (locked) group.set({ lockMovementX: true, lockMovementY: true, lockRotation: true, hasControls: false, opacity: 0.85 });
      if (isZoneMode) group.set({ selectable: false, evented: false, opacity: 0.4 });
      canvas.add(group);
    });
    canvas.renderAll();
  }, [placements, space, unlockedIds, savedPoly, zones, mode]); // eslint-disable-line

  /* ── zoom controls ────────────────────────────────── */
  const handleZoom = useCallback((dir) => {
    const canvas = fabricRef.current; if (!canvas) return;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    let z = canvas.getZoom();
    z = dir === 'in' ? z * 1.2 : z / 1.2;
    z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    canvas.zoomToPoint(center, z); setZoom(Math.round(z * 100));
  }, []);

  const handleFit = useCallback(() => {
    const canvas = fabricRef.current; if (!canvas || !space) return;
    const roomW = Math.round(space.widthM * SCALE), roomH = Math.round(depthVal * SCALE);
    const { z, tx, ty } = computeFit(canvas.width, canvas.height, roomW, roomH);
    canvas.setViewportTransform([z, 0, 0, z, tx, ty]); setZoom(Math.round(z * 100));
  }, [space, depthVal, computeFit]);

  /* ── zone drawing ─────────────────────────────────── */
  const ZONE_NAMES = ['구역 A', '구역 B', '구역 C', '구역 D', '구역 E', '구역 F'];
  const ROOM_PRESETS = [
    { name: '좌석 공간', icon: '🪑', w: 3, h: 3 },
    { name: '주방',     icon: '🍳', w: 2.5, h: 2 },
    { name: '화장실',   icon: '🚻', w: 1.5, h: 1.5 },
    { name: '창고',     icon: '📦', w: 2, h: 1.5 },
    { name: '카운터',   icon: '💳', w: 2, h: 1 },
    { name: '홀',       icon: '🏠', w: 4, h: 3 },
  ];
  const isZoneDrawing = mode === 'zoneDrawing';

  const addPresetZone = useCallback((preset) => {
    const currentZones = usePlannerStore.getState().zones;
    const sp = usePlannerStore.getState().space;
    const maxW = sp ? sp.widthM : 10;
    const maxH = sp ? sp.depthM : 10;

    // Find a non-overlapping position by testing grid slots
    const isOverlapping = (x, y, w, h) =>
      currentZones.some(z =>
        x < z.x + z.w && x + w > z.x && y < z.y + z.h && y + h > z.y
      );

    let x = 0.5, y = 0.5;
    let placed = false;
    // Try grid positions until we find one that doesn't overlap
    for (let row = 0; row < 10 && !placed; row++) {
      for (let col = 0; col < 5 && !placed; col++) {
        const tx = 0.5 + col * (preset.w + 0.3);
        const ty = 0.5 + row * (preset.h + 0.3);
        if (tx + preset.w <= maxW && ty + preset.h <= maxH && !isOverlapping(tx, ty, preset.w, preset.h)) {
          x = tx; y = ty; placed = true;
        }
      }
    }
    // Fallback: clamp inside room
    if (!placed) {
      x = Math.max(0.2, Math.min(x, maxW - preset.w - 0.2));
      y = Math.max(0.2, Math.min(y, maxH - preset.h - 0.2));
    }

    addZone({
      id: `zone-${Date.now()}`,
      name: preset.name,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      w: preset.w,
      h: preset.h,
    });
  }, [addZone]);

  /* ── zone drawing mode: edit existing + draw new via fabric events ─── */
  useEffect(() => {
    if (mode !== 'zoneDrawing') return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const prevCursor = canvas.defaultCursor;
    canvas.defaultCursor = 'crosshair';
    canvas.selection = false;

    let isDrawingNew = false;
    let drawStartX = 0, drawStartY = 0;
    let drawPreview = null;
    let drawLabel = null;   // live dimension label while drawing

    // Snap to 0.1m grid (same as vertex snapping: SNAP_PX=8, SCALE=80 → 0.1m)
    const SNAP_M = 0.1;
    const snapGrid = (v) => Math.round(v / SNAP_M) * SNAP_M;

    const handleMouseDown = (opt) => {
      if (opt.e.button !== 0) return;
      if (opt.target && (opt.target._editableZone || opt.target._zone || opt.target._zoneLabel)) return;
      if (opt.e.target && opt.e.target !== canvas.upperCanvasEl && opt.e.target !== canvas.lowerCanvasEl) return;
      const pointer = canvas.getPointer(opt.e);
      drawStartX = snapGrid((pointer.x - OFFSET) / SCALE);
      drawStartY = snapGrid((pointer.y - OFFSET) / SCALE);
      isDrawingNew = true;
    };

    const handleMouseMove = (opt) => {
      if (!isDrawingNew) return;
      const pointer = canvas.getPointer(opt.e);
      const rawMx = (pointer.x - OFFSET) / SCALE;
      const rawMy = (pointer.y - OFFSET) / SCALE;
      const mx = snapGrid(rawMx);
      const my = snapGrid(rawMy);

      if (drawPreview) canvas.remove(drawPreview);
      if (drawLabel) canvas.remove(drawLabel);

      const x = Math.min(drawStartX, mx), y = Math.min(drawStartY, my);
      const w = Math.abs(mx - drawStartX), h = Math.abs(my - drawStartY);
      if (w < 0.1 || h < 0.1) return;

      drawPreview = new fabric.Rect({
        left: x * SCALE + OFFSET, top: y * SCALE + OFFSET,
        width: w * SCALE, height: h * SCALE,
        fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6',
        strokeWidth: 2, strokeDashArray: [6, 3],
        selectable: false, evented: false,
      });
      drawPreview._zonePreview = true;
      canvas.add(drawPreview);

      // Live dimension label
      const area = (w * h).toFixed(1);
      drawLabel = new fabric.Text(`${w.toFixed(1)} × ${h.toFixed(1)}m\n${area}m²`, {
        left: x * SCALE + OFFSET + 6,
        top: y * SCALE + OFFSET + 6,
        fontSize: 12, fill: '#3b82f6', fontWeight: 'bold',
        lineHeight: 1.3,
        backgroundColor: 'rgba(255,255,255,0.92)', padding: 4,
        selectable: false, evented: false,
      });
      drawLabel._zonePreview = true;
      canvas.add(drawLabel);
      canvas.renderAll();
    };

    const handleMouseUp = (opt) => {
      if (!isDrawingNew) return;
      isDrawingNew = false;
      if (drawPreview) { canvas.remove(drawPreview); drawPreview = null; }
      if (drawLabel) { canvas.remove(drawLabel); drawLabel = null; }
      const pointer = canvas.getPointer(opt.e);
      const mx = snapGrid((pointer.x - OFFSET) / SCALE);
      const my = snapGrid((pointer.y - OFFSET) / SCALE);
      const x = Math.min(drawStartX, mx);
      const y = Math.min(drawStartY, my);
      const w = Math.abs(mx - drawStartX);
      const h = Math.abs(my - drawStartY);
      if (w < 0.3 || h < 0.3) { canvas.renderAll(); return; }
      const currentZones = usePlannerStore.getState().zones;
      const name = ZONE_NAMES[currentZones.length] || `구역 ${currentZones.length + 1}`;
      addZone({ id: `zone-${Date.now()}`, name, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 });
    };

    const handleModified = (e) => {
      const obj = e.target;
      if (!obj._editableZone) return;
      // Snap to grid on modify
      const newX = snapGrid(((obj.left - OFFSET) / SCALE));
      const newY = snapGrid(((obj.top - OFFSET) / SCALE));
      const newW = Math.max(SNAP_M, snapGrid((obj.width * (obj.scaleX || 1) / SCALE)));
      const newH = Math.max(SNAP_M, snapGrid((obj.height * (obj.scaleY || 1) / SCALE)));
      // Reset scale to 1 (dimensions are baked into width/height)
      obj.set({ scaleX: 1, scaleY: 1 });
      updateZone(obj._zoneId, { x: newX, y: newY, w: newW, h: newH });
    };

    const handleMoving = (e) => {
      const obj = e.target;
      if (!obj._editableZone) return;
      // Snap position while moving
      obj.set({
        left: snapGrid((obj.left - OFFSET) / SCALE) * SCALE + OFFSET,
        top: snapGrid((obj.top - OFFSET) / SCALE) * SCALE + OFFSET,
      });
      // Update label position & text with live dimensions
      const lbl = canvas.getObjects().find(o => o._zoneLabel && o._zoneId === obj._zoneId);
      if (lbl) {
        const mx = snapGrid((obj.left - OFFSET) / SCALE);
        const my = snapGrid((obj.top - OFFSET) / SCALE);
        const zone = usePlannerStore.getState().zones.find(z => z.id === obj._zoneId);
        const zw = zone ? zone.w : (obj.width / SCALE);
        const zh = zone ? zone.h : (obj.height / SCALE);
        lbl.set({
          left: obj.left + 6, top: obj.top + 4,
          text: `${zone?.name || ''}\n${zw.toFixed(1)}×${zh.toFixed(1)}m  ${(zw * zh).toFixed(1)}m²\n(${mx.toFixed(1)}, ${my.toFixed(1)})`,
        });
      }
    };

    const handleScaling = (e) => {
      const obj = e.target;
      if (!obj._editableZone) return;
      // Calculate snapped dimensions during scaling
      const newW = Math.max(SNAP_M, snapGrid(obj.width * (obj.scaleX || 1) / SCALE));
      const newH = Math.max(SNAP_M, snapGrid(obj.height * (obj.scaleY || 1) / SCALE));
      const lbl = canvas.getObjects().find(o => o._zoneLabel && o._zoneId === obj._zoneId);
      if (lbl) {
        const zone = usePlannerStore.getState().zones.find(z => z.id === obj._zoneId);
        const area = (newW * newH).toFixed(1);
        lbl.set({
          left: obj.left + 6, top: obj.top + 4,
          text: `${zone?.name || ''}\n${newW.toFixed(1)}×${newH.toFixed(1)}m  ${area}m²`,
        });
      }
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('object:modified', handleModified);
    canvas.on('object:moving', handleMoving);
    canvas.on('object:scaling', handleScaling);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('object:modified', handleModified);
      canvas.off('object:moving', handleMoving);
      canvas.off('object:scaling', handleScaling);
      canvas.selection = true;
      canvas.defaultCursor = prevCursor;
      if (drawPreview) canvas.remove(drawPreview);
      if (drawLabel) canvas.remove(drawLabel);
    };
  }, [mode, addZone, updateZone]);

  /* ── render ───────────────────────────────────────── */
  const isDrawing = mode === 'drawing';
  const isEditing = mode === 'editing';

  return (
    <div
      ref={containerRef}
      className="relative bg-[#f5f6f8] rounded-xl border border-gray-200 flex-1 min-h-0"
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {/* Drawing overlay */}
      {isDrawing && (
        <div className="absolute inset-0 z-[5]" style={{ cursor: 'crosshair' }}
          onMouseDown={onOverlayDown} onMouseMove={onOverlayMove} onMouseUp={onOverlayUp}
          onContextMenu={e => e.preventDefault()} />
      )}

      {/* Drawing banner */}
      {isDrawing && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#0073ea] text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap pointer-events-auto">
          <Pencil size={12} />
          {drawTarget === 'new' ? '추가 도면 그리기' : facadeMode ? '파사드 꼭짓점 추가' : '클릭으로 꼭짓점 추가'} ({drawCount}점)
          {previewLen && drawCount > 0 && <span className="opacity-80 ml-1">→ {previewLen}m</span>}
          {drawCount >= 3 ? ' · 첫 점 클릭으로 완성' : ' · 최소 3개'}
          {drawCount >= 3 && (
            <button onClick={finalizeDrawing} className="ml-2 bg-white text-[#0073ea] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 hover:bg-blue-50">
              <Check size={11} /> 완료
            </button>
          )}
          <button onClick={resetDraw} className="opacity-70 hover:opacity-100"><RotateCcw size={12} /></button>
        </div>
      )}

      {/* Edit banner */}
      {isEditing && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#7c3aed] text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap pointer-events-auto">
          <Edit3 size={12} />
          드래그=이동 · 선 더블클릭=점 추가 · 점 더블클릭=삭제
          {area != null && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">
              {area.toFixed(1)} m² / {toPyeong(area)}평
            </span>
          )}
          <button onClick={() => exitEditMode(true)} className="ml-1 bg-white text-[#7c3aed] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 hover:bg-purple-50">
            <Save size={11} /> 저장
          </button>
          <button onClick={() => exitEditMode(false)} className="opacity-70 hover:opacity-100 flex items-center gap-1">
            <X size={12} /> 취소
          </button>
        </div>
      )}

      {/* Zone drawing banner */}
      {isZoneDrawing && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#10b981] text-white text-xs px-4 py-2 rounded-full shadow-lg whitespace-nowrap pointer-events-auto">
          빈 공간 드래그=새 구역 · 구역 클릭=이동/크기 조정 ({zones.length}개)
          <button onClick={() => setMode('normal')} className="ml-2 bg-white text-[#10b981] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 hover:bg-green-50">
            <Check size={11} /> 완료
          </button>
        </div>
      )}

      {/* Area info bar */}
      {!isDrawing && !isEditing && (isCustom || facadeMode) && savedPoly && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 text-xs bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
          {facadeMode && <span className="font-semibold text-gray-600">파사드</span>}
          <span className="font-bold text-[#0073ea]">{area?.toFixed(1)} m²</span>
          {savedPolygons.length > 1 && <span className="text-gray-400">({savedPolygons.length}개 도면)</span>}
          <span className="text-gray-300">|</span>
          <span className="text-gray-600">{area ? toPyeong(area) : '-'} 평</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">기준 {space.widthM}×{depthVal}m</span>
          <span className="text-gray-300">|</span>
          <button onClick={() => enterEditMode(0)} className="flex items-center gap-1 text-[#7c3aed] font-medium hover:underline">
            <Edit3 size={11} /> 편집
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={startNewPolygonDraw} className="flex items-center gap-1 text-[#10b981] font-medium hover:underline">
            <Pencil size={11} /> 도면추가
          </button>
        </div>
      )}

      {/* Normal hint */}
      {!isDrawing && !isEditing && !isZoneDrawing && !((isCustom || facadeMode) && savedPoly) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 text-xs text-gray-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-100">
          <span>🖱️ 휠 = 줌</span><span>·</span>
          <span>우클릭 드래그 = 이동</span><span>·</span>
          <span>Del = 삭제</span>
        </div>
      )}

      {/* Isometric 3D preview (floor plan only) */}
      {!facadeMode && <IsometricPreview />}

      {/* Polygon list — visible in both floor plan and facade modes */}
      {!isDrawing && !isEditing && savedPolygons.length > 1 && (
        <div className="absolute bottom-4 left-4 z-10"
          onMouseDown={e => e.stopPropagation()}
          onMouseUp={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 w-[220px]">
            <div className="text-[10px] text-gray-400 font-medium mb-1 px-0.5">{facadeMode ? '파사드 도면 목록' : '도면 목록'}</div>
            {savedPolygons.map((poly, i) => (
              <div key={poly.id} className="flex items-center gap-1 px-1.5 py-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: '#1a1a1a' }} />
                <span className="flex-1 truncate text-gray-700">{poly.name}</span>
                <span className="text-gray-500 font-medium whitespace-nowrap">{areaM2(poly.vertices).toFixed(1)}m²</span>
                <button onClick={(e) => { e.stopPropagation(); enterEditMode(i); }} className="text-gray-400 hover:text-[#7c3aed]">
                  <Edit3 size={10} />
                </button>
                {i > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); deletePolygon(i); }} className="text-gray-300 hover:text-red-500">
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zone controls — stopPropagation prevents canvas mouse events from firing */}
      {!isDrawing && !isEditing && !facadeMode && (
        <div className={`absolute ${savedPolygons.length > 1 ? 'bottom-28' : 'bottom-4'} left-4 z-10 flex flex-col gap-1.5`}
          onMouseDown={e => e.stopPropagation()}
          onMouseUp={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => setMode(isZoneDrawing ? 'normal' : 'zoneDrawing')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border shadow-sm transition-colors ${
              isZoneDrawing
                ? 'bg-[#10b981] text-white border-[#10b981]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#10b981] hover:text-[#10b981]'
            }`}
          >
            <span className="text-sm">{isZoneDrawing ? '✓' : '▦'}</span>
            {isZoneDrawing ? '구역 그리기 완료' : '구역 나누기'}
          </button>
          {/* Room preset buttons — visible in zone drawing mode */}
          {isZoneDrawing && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 w-[220px]">
              <div className="text-[10px] text-gray-400 font-medium mb-1.5 px-0.5">공간 영역 추가</div>
              <div className="grid grid-cols-2 gap-1">
                {ROOM_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={(e) => { e.stopPropagation(); addPresetZone(preset); }}
                    className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md border border-gray-100 bg-gray-50 hover:bg-[#10b981]/10 hover:border-[#10b981]/30 hover:text-[#10b981] transition-colors text-gray-600"
                  >
                    <span className="text-sm">{preset.icon}</span>
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {zones.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-1.5 w-[220px]">
              {zones.map((z, i) => (
                <div key={z.id} className="flex items-center gap-1 px-1.5 py-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                  <span className="flex-1 truncate text-gray-700">{z.name}</span>
                  <span className="text-gray-400 whitespace-nowrap">{z.w.toFixed(1)}×{z.h.toFixed(1)}</span>
                  <span className="text-gray-500 font-medium whitespace-nowrap">{(z.w * z.h).toFixed(1)}m²</span>
                  <button onClick={(e) => {
                    e.stopPropagation();
                    // Deselect zone on canvas before removing
                    const canvas = fabricRef.current;
                    if (canvas) {
                      const sel = canvas.getActiveObject();
                      if (sel && sel._zoneId === z.id) canvas.discardActiveObject();
                    }
                    removeZone(z.id);
                  }} className="text-gray-300 hover:text-red-500 ml-0.5">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-1.5">
        <button onClick={() => handleZoom('out')} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#0073ea] rounded-lg transition-colors"><ZoomOut size={15} /></button>
        <span className="text-xs font-medium text-gray-500 w-10 text-center">{zoom}%</span>
        <button onClick={() => handleZoom('in')}  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#0073ea] rounded-lg transition-colors"><ZoomIn size={15} /></button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button onClick={handleFit} className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-[#0073ea] rounded-lg transition-colors"><Maximize2 size={14} /></button>
      </div>

      {/* Canvas fills container absolutely */}
      <div className="absolute inset-0"
        onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onMouseDown={!isDrawing ? onWrapDown   : undefined}
        onMouseMove={!isDrawing ? onWrapMove   : undefined}
        onMouseUp={  !isDrawing ? onWrapUp     : undefined}
        onDoubleClick={isEditing ? handleWrapDblClick : undefined}
        onContextMenu={isEditing ? onContextMenu : e => e.preventDefault()}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 w-48 text-sm"
          style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 font-medium">
            {ctxMenu.isEdge ? `변 #${ctxMenu.idx + 1}` : `꼭짓점 #${ctxMenu.idx + 1}`}
          </div>
          <button onClick={ctxAddMid} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
            <span className="text-[#0073ea]">＋</span> 변 중간에 점 추가
          </button>
          {!ctxMenu.isEdge && (
            <>
              <button onClick={ctxOpenMove} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                <span>📐</span> 좌표로 이동
              </button>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button onClick={ctxDelete}
                  disabled={(editPolyRef.current?.length ?? 0) <= 3}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-500 disabled:opacity-30">
                  <span>🗑</span> 꼭짓점 삭제
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Coordinate input */}
      {moveInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setMoveInput(null)}>
          <div className="bg-white rounded-2xl p-5 shadow-xl w-72" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1a1a1a] mb-3">꼭짓점 #{moveInput.idx + 1} 좌표</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">X (m)</label>
                <input type="number" step="0.5" value={moveInput.x}
                  onChange={e => setMoveInput(m => ({ ...m, x: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
                  autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Y (m)</label>
                <input type="number" step="0.5" value={moveInput.y}
                  onChange={e => setMoveInput(m => ({ ...m, y: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
                  onKeyDown={e => e.key === 'Enter' && applyMove()} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setMoveInput(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button onClick={applyMove} className="flex-1 bg-[#0073ea] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#0060c0]">이동</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
