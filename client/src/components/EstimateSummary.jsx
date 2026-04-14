import { useState, useRef, useEffect } from 'react';
import usePlannerStore from '../store/plannerStore';
import { Save, MessageCircle, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Trash2, RotateCcw, Pencil, Minus, Plus } from 'lucide-react';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const UNIT_LABELS = { m2: 'm²', m: 'm', ea: '개', set: '세트', day: '인/일', box: '박스', unit: '매' };

export default function EstimateSummary({ onSave, onConsult, saving }) {
  const { showVat, toggleVat, getEstimate, updatePlacement, removePlacement } = usePlannerStore();
  const [expanded, setExpanded] = useState({});
  const est = getEstimate();

  const toggle = (name) => setExpanded((e) => ({ ...e, [name]: !e[name] }));

  return (
    <div className="w-80 bg-white border-l border-gray-100 flex flex-col h-full">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#1a1a1a] text-sm">실시간 견적</h3>
          <button
            onClick={toggleVat}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0073ea] transition-colors"
          >
            {showVat ? <ToggleRight size={18} className="text-[#0073ea]" /> : <ToggleLeft size={18} />}
            VAT {showVat ? '포함' : '별도'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {est.categories.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <div className="text-3xl mb-2">📋</div>
            아이템을 추가하면<br />견적이 계산됩니다
          </div>
        ) : (
          est.categories.map((cat) => (
            <div key={cat.name} className="rounded-lg border border-gray-100 overflow-hidden">
              <button
                onClick={() => toggle(cat.name)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-600">{cat.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1a1a1a]">{fmt(cat.subtotal)}원</span>
                  {expanded[cat.name] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              </button>
              {expanded[cat.name] && (
                <div className="border-t border-gray-50 bg-gray-50/50 px-2 py-1 space-y-0.5">
                  {cat.items.map((p) => (
                    <EstimateRow key={p.id} p={p} onUpdate={updatePlacement} onRemove={removePlacement} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-100 p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>소계</span>
          <span>{fmt(est.subtotal)}원</span>
        </div>
        {showVat && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>VAT (10%)</span>
            <span>{fmt(est.vat)}원</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-[#1a1a1a] pt-2 border-t border-gray-100">
          <span>합계</span>
          <span className="text-[#0073ea]">{fmt(est.total)}원</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-4 space-y-2 border-t border-gray-100">
        <button
          onClick={onSave}
          disabled={saving || est.subtotal === 0}
          className="w-full bg-[#0073ea] hover:bg-[#0060c0] text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <Save size={15} />
          {saving ? '저장 중...' : '견적 저장'}
        </button>
        <button
          onClick={onConsult}
          disabled={est.subtotal === 0}
          className="w-full border border-[#0073ea] text-[#0073ea] hover:bg-blue-50 font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
        >
          <MessageCircle size={15} />
          상담 신청
        </button>
      </div>
    </div>
  );
}

/* ── Editable row for each item ─────────────────── */
function EstimateRow({ p, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const unitLabel = UNIT_LABELS[p.item.unit] || p.item.unit;
  const isAutoCalc = p.autoQty != null;
  const isOverridden = p.qtyOverride != null;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setValue(p.computedQty % 1 === 0 ? String(p.computedQty) : p.computedQty.toFixed(1));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    if (isAutoCalc && Math.abs(num - p.autoQty) < 0.01) {
      onUpdate(p.id, { qtyOverride: null });
    } else {
      onUpdate(p.id, { qtyOverride: num });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  };

  const resetToAuto = (e) => {
    e.stopPropagation();
    onUpdate(p.id, { qtyOverride: null });
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(p.id);
  };

  const stepQty = (delta) => {
    const current = p.computedQty;
    const step = p.item.unit === 'm2' || p.item.unit === 'm' ? 1 : 1;
    const next = Math.max(step, current + delta * step);
    onUpdate(p.id, { qtyOverride: next });
  };

  const displayQty = p.computedQty % 1 === 0 ? p.computedQty : p.computedQty.toFixed(1);

  return (
    <div className="group rounded-lg bg-white border border-gray-100 px-2.5 py-2 hover:border-gray-200 transition-all mb-1 last:mb-0">
      {/* Row 1: name + line total + delete */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-xs text-gray-800 font-medium truncate flex-1">{p.item.name}</span>
        <span className="text-xs font-semibold text-[#1a1a1a] whitespace-nowrap ml-1">{fmt(p.lineTotal)}원</span>
        <button
          onClick={handleRemove}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 ml-0.5 shrink-0"
          title="삭제"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Row 2: editable qty area */}
      <div className="flex items-center gap-1.5">
        {editing ? (
          /* ── edit mode ── */
          <div className="flex items-center gap-1 flex-1">
            <input
              ref={inputRef}
              type="number"
              step="any"
              min="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="w-20 text-xs border-2 border-[#0073ea] rounded-md px-2 py-1 text-right font-semibold text-[#0073ea] focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 bg-blue-50"
            />
            <span className="text-[10px] text-gray-400 shrink-0">{unitLabel}</span>
          </div>
        ) : (
          /* ── display mode ── */
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {/* Stepper: minus */}
            <button
              onClick={() => stepQty(-1)}
              className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors shrink-0"
            >
              <Minus size={10} strokeWidth={2.5} />
            </button>

            {/* Clickable qty */}
            <button
              onClick={startEdit}
              className={`relative flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-all cursor-text min-w-[48px] justify-center
                ${isOverridden
                  ? 'bg-blue-50 text-[#0073ea] border border-blue-300 hover:bg-blue-100 ring-1 ring-blue-100'
                  : 'bg-gray-50 text-gray-700 border border-dashed border-gray-300 hover:border-[#0073ea] hover:bg-blue-50 hover:text-[#0073ea]'
                }`}
              title="클릭하여 수량 직접 입력"
            >
              {displayQty}
              <Pencil size={9} className={`shrink-0 ${isOverridden ? 'text-blue-400' : 'text-gray-400'}`} />
            </button>

            {/* Stepper: plus */}
            <button
              onClick={() => stepQty(1)}
              className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors shrink-0"
            >
              <Plus size={10} strokeWidth={2.5} />
            </button>

            <span className="text-[10px] text-gray-400 shrink-0">{unitLabel}</span>
            <span className="text-[10px] text-gray-300 shrink-0">×</span>
            <span className="text-[10px] text-gray-400 shrink-0">{p.item.unitPrice.toLocaleString()}</span>

            {/* Reset button for overridden auto-calc items */}
            {isAutoCalc && isOverridden && (
              <button
                onClick={resetToAuto}
                className="ml-auto flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-[#0073ea] transition-colors px-1 py-0.5 rounded hover:bg-blue-50 shrink-0"
                title={`자동값 (${p.autoQty.toFixed(1)}${unitLabel})으로 복원`}
              >
                <RotateCcw size={9} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Auto-calc label */}
      {isAutoCalc && !isOverridden && !editing && (
        <div className="flex items-center gap-1 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          <span className="text-[9px] text-green-600">면적 자동계산</span>
        </div>
      )}
      {isAutoCalc && isOverridden && !editing && (
        <div className="flex items-center gap-1 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <span className="text-[9px] text-blue-500">수동 입력 (자동: {p.autoQty.toFixed(1)}{unitLabel})</span>
        </div>
      )}
    </div>
  );
}
