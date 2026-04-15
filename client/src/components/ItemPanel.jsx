import { useState } from 'react';
import { Lock, Unlock, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import usePlannerStore from '../store/plannerStore';
import { itemsApi } from '../api/client';
import ItemModal from './ItemModal';

const CATEGORY_LABELS = {
  painting: '도장', film: '필름', tile: '타일', fabric: '패브릭',
  lighting: '조명', hardware: '손잡이', stone: '인조대리석', metalwork: '금속유리',
  plumbing: '설비/배관', woodwork: '목공자재', labor: '인건비',
};

const CAT_ICONS = {
  painting: '🎨', film: '📋', tile: '🪨', fabric: '🧵',
  lighting: '💡', hardware: '🔩', stone: '🏛️', metalwork: '⚙️',
  plumbing: '🔧', woodwork: '🪵', labor: '👷',
};

/**
 * 플래너 사이드 패널.
 *
 * - 모든 사용자: 카테고리별 아이템 목록 드래그/클릭 배치
 * - `canEdit = true` (admin/master): 카테고리별 “+추가” 버튼 + 개별 수정/삭제 버튼
 *
 * @param {Array}    props.categories  카테고리 + items
 * @param {boolean}  [props.canEdit]   true면 추가/수정/삭제 UI 노출
 * @param {Function} [props.onChanged] 저장/삭제 후 호출 (플래너가 카테고리 재로드)
 * @param {string}   [props.brand]     현재 공간 브랜드 (신규 생성 시 기본값)
 */
export default function ItemPanel({ categories, canEdit = false, onChanged, brand }) {
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null); // { mode: 'create' | 'edit', item?, categoryId? }
  usePlannerStore();

  const toggle = (name) => setExpanded((e) => ({ ...e, [name]: !e[name] }));

  // 항상 모든 카테고리를 노출 — 빈 카테고리에도 admin이 아이템을 추가할 수 있도록.
  const displayCats = canEdit
    ? (categories || [])
    : (categories || []).filter((c) => c.items?.length > 0);

  const handleDelete = async (item) => {
    if (item.isRequired) {
      return toast.error('필수 항목은 삭제할 수 없습니다.');
    }
    if (!window.confirm(`"${item.name}" 아이템을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await itemsApi.bulk({ ids: [item.id], action: 'delete' });
      toast.success('삭제되었습니다.');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || '삭제 실패');
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex items-start gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-[#1a1a1a] text-sm">인테리어 아이템</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {canEdit ? '드래그로 배치 · +버튼으로 추가' : '항목을 캔버스로 드래그하세요'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            title="아이템 추가"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[#0073ea] text-white hover:bg-[#0060c0]"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {displayCats.map((cat) => {
          const isOpen = expanded[cat.name] !== false; // default open
          return (
            <div key={cat.id}>
              <div className="group w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 transition-colors">
                <button onClick={() => toggle(cat.name)} className="flex items-center gap-2 flex-1">
                  <span>{CAT_ICONS[cat.name]}</span>
                  <span className="flex-1 text-left">{CATEGORY_LABELS[cat.name] || cat.label || cat.name}</span>
                  <span className="text-gray-300 text-[10px] normal-case font-normal">
                    {cat.items?.length || 0}
                  </span>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {canEdit && (
                  <button
                    onClick={() => setModal({ mode: 'create', categoryId: cat.id })}
                    title={`${CATEGORY_LABELS[cat.name] || cat.name} 아이템 추가`}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#0073ea] p-0.5 rounded transition-opacity"
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="pb-1">
                  {cat.items?.length === 0 && canEdit && (
                    <div className="mx-2 mb-1 px-3 py-2 text-xs text-gray-300 italic text-center">
                      아이템 없음
                    </div>
                  )}
                  {cat.items?.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      categoryName={cat.name}
                      categoryId={cat.id}
                      canEdit={canEdit}
                      onEdit={() => setModal({ mode: 'edit', item })}
                      onDelete={() => handleDelete(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <ItemModal
          item={modal.mode === 'edit' ? modal.item : null}
          categories={categories}
          defaultCategoryId={modal.categoryId}
          defaultBrand={brand}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function ItemCard({ item, categoryName, categoryId, canEdit, onEdit, onDelete }) {
  const { addPlacement, toggleLock, unlockedIds, zones, placements } = usePlannerStore();
  const locked = item.isRequired && !unlockedIds.includes(item.id);

  // Attach category info so getEstimate can auto-calc area
  const itemWithCategory = { ...item, category: { id: categoryId, name: categoryName } };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(itemWithCategory));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = () => {
    if (locked) return;
    if (item.tileSize && (item.imageUrl || item.isoImageUrl) && zones.length > 0) {
      const coveredZoneIds = new Set(
        placements.filter(p => p.item?.tileSize && (p.item?.imageUrl || p.item?.isoImageUrl) && p.zoneId).map(p => p.zoneId)
      );
      const targetZone = zones.find(z => !coveredZoneIds.has(z.id)) || zones[0];
      addPlacement(itemWithCategory, 1, 1, targetZone.id);
      return;
    }
    addPlacement(itemWithCategory, 1, 1);
  };

  const handleLockClick = (e) => {
    e.stopPropagation();
    toggleLock(item.id);
  };

  return (
    <div
      draggable={!locked}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={`group mx-2 mb-1 px-3 py-2 rounded-lg border transition-all ${
        locked
          ? 'border-orange-200 bg-orange-50 cursor-default'
          : 'border-gray-100 hover:border-[#0073ea]/30 hover:bg-blue-50 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-start gap-2">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-8 h-8 object-cover rounded" />
        ) : (
          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-base">
            {locked ? '🔒' : '📦'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-[#1a1a1a] truncate">{item.name}</span>
            {item.isRequired && (
              <button
                onClick={handleLockClick}
                className={`shrink-0 p-0.5 rounded transition-colors ${
                  locked
                    ? 'text-orange-500 hover:text-orange-700 hover:bg-orange-100'
                    : 'text-green-500 hover:text-green-700 hover:bg-green-100'
                }`}
                title={locked ? '잠금 해제' : '잠금'}
              >
                {locked ? <Lock size={10} /> : <Unlock size={10} />}
              </button>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <span>{item.unitPrice.toLocaleString()}원/{item.unit}</span>
            {item.brand && item.brand !== '공통' && (
              <span className="text-[10px] px-1 rounded bg-gray-100 text-gray-500 truncate">{item.brand}</span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              title="수정"
              className="p-1 rounded text-gray-400 hover:text-[#0073ea] hover:bg-blue-100"
            >
              <Pencil size={11} />
            </button>
            {!item.isRequired && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                title="삭제"
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
