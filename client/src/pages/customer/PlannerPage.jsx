import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { spacesApi, categoriesApi, placementsApi, estimatesApi } from '../../api/client';
import usePlannerStore from '../../store/plannerStore';
import useAuthStore from '../../store/authStore';
import Canvas2D from '../../components/Canvas2D';
import ItemPanel from '../../components/ItemPanel';
import EstimateSummary from '../../components/EstimateSummary';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { ArrowLeft, RotateCcw, Trash2, Save, Layers, Building2 } from 'lucide-react';

export default function PlannerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setSpace, setItems, setPlacements, setZones, addPlacement, placements, getEstimate, isDirty, markClean } = usePlannerStore();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPlacementId, setSelectedPlacementId] = useState(null);
  const [consultModal, setConsultModal] = useState(false);
  const [consultForm, setConsultForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [lastEstimateId, setLastEstimateId] = useState(null);
  // Track pending polygon save to prevent race conditions with handleSave
  const pendingDrawSaveRef = useRef(null);
  const [canvasView, setCanvasView] = useState('floor'); // 'floor' | 'facade'

  // admin/master 만 플래너에서 아이템 CRUD 허용 (itemsApi.create/update/delete는 requireAdmin).
  const canEditItems = user?.role === 'admin' || user?.role === 'master';

  // 아이템이 추가/수정/삭제되었을 때 카테고리와 items 스토어만 다시 로드 (placements는 유지).
  const reloadCategories = async () => {
    try {
      const spaceBrand = usePlannerStore.getState().space?.brand;
      const catsRes = await categoriesApi.list(spaceBrand ? { brand: spaceBrand } : {});
      setCategories(catsRes.data);
      const allItems = catsRes.data.flatMap((c) =>
        c.items.map((item) => ({ ...item, category: { id: c.id, name: c.name } }))
      );
      setItems(allItems);
    } catch {
      toast.error('아이템 목록 새로고침 실패');
    }
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  // Warn user if they try to close/reload page with unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleDrawComplete = (polygon, polygonIndex = 0) => {
    const savePromise = (async () => {
      try {
        const currentSpace = usePlannerStore.getState().space;
        const existingLayout = currentSpace?.layoutJson || {};
        const existingZones = existingLayout.zones || [];

        // Build polygons array from current layout (backward compatible)
        let currentPolygons;
        if (existingLayout.polygons?.length) {
          currentPolygons = existingLayout.polygons;
        } else if (existingLayout.polygon?.length >= 3) {
          currentPolygons = [{ id: 'main', name: '주 공간', vertices: existingLayout.polygon }];
        } else {
          currentPolygons = [];
        }

        let newPolygons;
        if (polygon === null && polygonIndex > 0) {
          // Delete polygon at index
          newPolygons = currentPolygons.filter((_, i) => i !== polygonIndex);
        } else if (!polygon || polygon.length < 3) {
          return;
        } else if (polygonIndex === -1) {
          // Add new polygon
          newPolygons = [...currentPolygons, {
            id: `poly-${Date.now()}`,
            name: `추가 공간 ${currentPolygons.length}`,
            vertices: polygon,
          }];
        } else if (polygonIndex >= currentPolygons.length) {
          // First polygon or index beyond current — create new entry
          newPolygons = [...currentPolygons, {
            id: polygonIndex === 0 ? 'main' : `poly-${Date.now()}`,
            name: polygonIndex === 0 ? '주 공간' : `추가 공간 ${currentPolygons.length}`,
            vertices: polygon,
          }];
        } else {
          // Update existing polygon at index
          newPolygons = currentPolygons.map((p, i) =>
            i === polygonIndex ? { ...p, vertices: polygon } : p
          );
        }

        // Calculate total area from all polygons
        const calcArea = (verts) => {
          if (!verts || verts.length < 3) return 0;
          let a = 0;
          for (let i = 0; i < verts.length; i++) {
            const j = (i + 1) % verts.length;
            a += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
          }
          return Math.abs(a / 2);
        };
        const areaSqm = parseFloat(newPolygons.reduce((sum, p) => sum + calcArea(p.vertices), 0).toFixed(2));

        // Preserve facade and other layout keys when saving polygons
        const res = await spacesApi.update(id, {
          layoutJson: { ...existingLayout, polygons: newPolygons, zones: existingZones },
          areaSqm,
        });
        console.debug('[PLANNER] handleDrawComplete — saved layoutJson:',
          JSON.stringify(res.data.layoutJson).slice(0, 300));
        setSpace(res.data);

        if (polygon === null) toast.success('도면이 삭제되었습니다.');
        else if (polygonIndex === -1) toast.success('추가 도면이 저장되었습니다!');
        else toast.success('공간 형태가 저장되었습니다!');
      } catch {
        toast.error('공간 형태 저장 실패');
      }
    })();
    pendingDrawSaveRef.current = savePromise;
    savePromise.finally(() => { pendingDrawSaveRef.current = null; });
  };

  const handleFacadeDrawComplete = (polygon, polygonIndex = 0) => {
    const savePromise = (async () => {
      try {
        const currentSpace = usePlannerStore.getState().space;
        const existingFacade = currentSpace?.layoutJson?.facade || {};

        let currentPolygons;
        if (existingFacade.polygons?.length) {
          currentPolygons = existingFacade.polygons;
        } else {
          currentPolygons = [];
        }

        let newPolygons;
        if (polygon === null && polygonIndex > 0) {
          newPolygons = currentPolygons.filter((_, i) => i !== polygonIndex);
        } else if (!polygon || polygon.length < 3) {
          return;
        } else if (polygonIndex === -1) {
          newPolygons = [...currentPolygons, {
            id: `facade-${Date.now()}`,
            name: `파사드 ${currentPolygons.length + 1}`,
            vertices: polygon,
          }];
        } else if (polygonIndex >= currentPolygons.length) {
          newPolygons = [...currentPolygons, {
            id: polygonIndex === 0 ? 'facade-main' : `facade-${Date.now()}`,
            name: polygonIndex === 0 ? '전면부' : `파사드 ${currentPolygons.length + 1}`,
            vertices: polygon,
          }];
        } else {
          newPolygons = currentPolygons.map((p, i) =>
            i === polygonIndex ? { ...p, vertices: polygon } : p
          );
        }

        const res = await spacesApi.update(id, {
          layoutJson: {
            ...currentSpace.layoutJson,
            facade: { polygons: newPolygons },
          },
        });
        setSpace(res.data);

        if (polygon === null) toast.success('파사드 도면이 삭제되었습니다.');
        else if (polygonIndex === -1) toast.success('파사드 도면이 추가되었습니다!');
        else toast.success('파사드가 저장되었습니다!');
      } catch {
        toast.error('파사드 저장 실패');
      }
    })();
    pendingDrawSaveRef.current = savePromise;
    savePromise.finally(() => { pendingDrawSaveRef.current = null; });
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const spaceRes = await spacesApi.get(id);
      const spaceBrand = spaceRes.data.brand || '먼데이커피';
      const [catsRes, placementsRes] = await Promise.all([
        categoriesApi.list({ brand: spaceBrand }),
        placementsApi.list(id),
      ]);

      console.debug('[PLANNER] loadAll — space.layoutJson:',
        JSON.stringify(spaceRes.data.layoutJson).slice(0, 300));
      setSpace(spaceRes.data);
      setCategories(catsRes.data);

      // Flatten items for store (attach category info to each item)
      const allItems = catsRes.data.flatMap((c) =>
        c.items.map((item) => ({ ...item, category: { id: c.id, name: c.name } }))
      );
      setItems(allItems);

      // Map existing placements
      const mapped = placementsRes.data.map((p) => ({
        id: p.id,
        itemId: p.itemId,
        item: p.item,
        quantity: p.quantity,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        zoneId: p.zoneId ?? undefined,
      }));

      // Add required items that aren't placed yet
      const requiredItems = allItems.filter((i) => i.isRequired);
      const placedItemIds = new Set(mapped.map((p) => p.itemId));
      const autoPlaced = [];
      let autoX = 0.5;
      requiredItems.forEach((item) => {
        if (!placedItemIds.has(item.id)) {
          autoPlaced.push({
            id: `req-${item.id}`,
            itemId: item.id,
            item,
            quantity: 1,
            x: autoX,
            y: 0.5,
            rotation: 0,
          });
          autoX += (item.width || 1) + 0.2;
        }
      });

      setPlacements([...autoPlaced, ...mapped]);

      // Load zones from layoutJson
      const savedZones = spaceRes.data.layoutJson?.zones || [];
      setZones(savedZones);
    } catch (err) {
      toast.error('공간 데이터 로드 실패');
      navigate('/my');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Wait for any in-flight polygon save to finish first (prevents race condition
      // where handleSave reads stale layoutJson before handleDrawComplete's setSpace)
      if (pendingDrawSaveRef.current) {
        await pendingDrawSaveRef.current;
      }

      // Sync placements
      const syncData = placements.map((p) => ({
        itemId: p.itemId,
        quantity: p.quantity,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        zoneId: p.zoneId ?? null,
      }));
      await placementsApi.sync(id, syncData);

      // Save zones to layoutJson (always merge — preserves polygons + facade)
      const currentZones = usePlannerStore.getState().zones;
      const currentSpace = usePlannerStore.getState().space;
      const layoutJson = { ...(currentSpace?.layoutJson || {}), zones: currentZones };
      const spaceUpd = await spacesApi.update(id, { layoutJson });
      setSpace(spaceUpd.data);

      // Create estimate
      const est = getEstimate();
      const snapshot = est.categories.flatMap((cat) =>
        cat.items.map((p) => ({
          itemId: p.itemId,
          itemName: p.item.name,
          category: cat.name,
          categoryLabel: cat.label,
          unit: p.item.unit,
          unitPrice: p.item.unitPrice,
          quantity: p.computedQty,
          lineTotal: p.lineTotal,
          version: p.item.version,
        }))
      );

      const estRes = await estimatesApi.create({
        spaceId: id,
        itemsSnapshot: snapshot,
        totalCost: est.subtotal,
        status: 'draft',
      });

      setLastEstimateId(estRes.data.id);
      markClean();
      toast.success('견적이 저장되었습니다!');
    } catch (err) {
      toast.error('저장 실패: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleConsult = async () => {
    if (!lastEstimateId) {
      // Save first
      await handleSave();
    }
    setConsultModal(true);
  };

  const submitConsult = async () => {
    if (!consultForm.name || !consultForm.phone) return toast.error('이름과 연락처를 입력하세요.');
    try {
      const eid = lastEstimateId;
      await estimatesApi.submit(eid, consultForm);
      toast.success('상담 신청이 완료되었습니다!');
      setConsultModal(false);
      navigate(`/estimate/${eid}`);
    } catch (err) {
      toast.error('상담 신청 실패');
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div></Layout>;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-56px)]">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/my')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#0073ea]">
            <ArrowLeft size={15} /> 목록
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-sm font-medium text-[#1a1a1a]">
            {usePlannerStore.getState().space?.name}
          </span>
          <SpaceInfo />
          <div className="ml-auto flex items-center gap-2">
            {saving ? (
              <span className="flex items-center gap-1.5 text-xs text-[#0073ea] bg-[#e6f3ff] px-2.5 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-[#0073ea] animate-pulse" />
                저장 중…
              </span>
            ) : isDirty ? (
              <span className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                저장 안됨
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                저장됨
              </span>
            )}
            <button onClick={loadAll} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0073ea] px-2 py-1 rounded hover:bg-gray-50">
              <RotateCcw size={13} /> 새로고침
            </button>
            {lastEstimateId && (
              <button
                onClick={() => navigate(`/estimate/${lastEstimateId}`)}
                className="text-xs text-[#0073ea] hover:underline px-2"
              >
                견적서 보기
              </button>
            )}
          </div>
        </div>

        {/* Main 3-panel layout */}
        <div className="flex flex-1 overflow-hidden">
          <ItemPanel
            categories={categories}
            canEdit={canEditItems}
            brand={usePlannerStore.getState().space?.brand}
            onChanged={reloadCategories}
          />
          <div className="flex-1 flex flex-col p-4 gap-2 overflow-auto">
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setCanvasView('floor')}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    canvasView === 'floor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Layers size={12} /> 평면도
                </button>
                <button
                  onClick={() => setCanvasView('facade')}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    canvasView === 'facade' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Building2 size={12} /> 파사드
                </button>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-3">
                <span>그리드 1칸 = 0.5m · 스냅 0.1m</span>
                <span className="text-gray-300">|</span>
                <span>{canvasView === 'facade' ? '매장 전면부(가로×높이) 도면 그리기' : '드래그앤드롭으로 배치 • Delete키로 삭제 • 드래그로 이동'}</span>
              </div>
            </div>
            {canvasView === 'floor' ? (
              <Canvas2D key="floor" onSelect={setSelectedPlacementId} onDrawComplete={handleDrawComplete} />
            ) : (
              <Canvas2D key="facade" facadeMode onSelect={setSelectedPlacementId} onDrawComplete={handleFacadeDrawComplete} />
            )}
          </div>
          <EstimateSummary onSave={handleSave} onConsult={handleConsult} saving={saving} />
        </div>
      </div>

      {/* Consult modal */}
      {consultModal && (
        <Modal title="인테리어 상담 신청" onClose={() => setConsultModal(false)}>
          <p className="text-sm text-gray-500 mb-4">
            현재 견적을 담당자에게 전달하고 <strong className="text-[#1a1a1a]">상세 상담</strong>을 요청합니다.
            <br />
            <span className="text-xs text-gray-400">영업일 기준 1-2일 내 연락드립니다.</span>
          </p>
          <div className="space-y-3">
            <ModalField label="이름 *" value={consultForm.name} onChange={(v) => setConsultForm((f) => ({ ...f, name: v }))} />
            <ModalField label="연락처 *" value={consultForm.phone} onChange={(v) => setConsultForm((f) => ({ ...f, phone: v }))} placeholder="010-0000-0000" />
          </div>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setConsultModal(false)} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
            <button onClick={submitConsult} className="flex-1 bg-[#0073ea] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#0060c0]">상담 신청하기</button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}

function SpaceInfo() {
  const space = usePlannerStore((s) => s.space);
  if (!space) return null;
  const brandColor = space.brand === '먼데이커피' ? 'text-amber-600 bg-amber-50' : space.brand === '스토리오브라망' ? 'text-purple-600 bg-purple-50' : 'text-gray-500 bg-gray-50';
  return (
    <span className="text-xs text-gray-400 flex items-center gap-2">
      {space.brand && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${brandColor}`}>{space.brand}</span>}
      {space.widthM}m × {space.depthM}m ({space.areaSqm.toFixed(1)}m²)
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="font-semibold text-[#1a1a1a] mb-1">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
      />
    </div>
  );
}
