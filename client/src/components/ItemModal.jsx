import { useState } from 'react';
import { itemsApi } from '../api/client';
import toast from 'react-hot-toast';
import { Plus, Upload } from 'lucide-react';

export const UNIT_LABELS = { m2: 'm²', m: 'm', ea: '개', set: '세트', day: '인/일', box: '박스', unit: '매' };
export const catLabel = (c) => c?.label || c?.displayName || c?.name || '';

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]';

function MF({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

/**
 * 공용 아이템 추가/수정 모달.
 * - `ItemsPage` (관리자 단가 관리)와 `ItemPanel` (플래너 사이드바)에서 함께 사용.
 */
export default function ItemModal({
  item,
  categories,
  isMaster,
  defaultCategoryId,
  defaultBrand,
  onOpenCategoryManager,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    categoryId: item?.categoryId || defaultCategoryId || '',
    name: item?.name || '',
    brand: item?.brand || defaultBrand || '공통',
    unit: item?.unit || 'm2',
    unitPrice: item?.unitPrice || '',
    description: item?.description || '',
    isRequired: item?.isRequired || false,
    width: item?.width || '',
    height: item?.height || '',
    tileSize: item?.tileSize || '',
    areaBasis: item?.areaBasis || '',
  });
  const [file, setFile] = useState(null);
  const [isoFile, setIsoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedCat = categories.find((c) => c.id === form.categoryId);
  const isFlooring = selectedCat?.name === 'tile';

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
  };

  const handleTileSizeChange = (e) => {
    const ts = e.target.value;
    const sizeM = ts ? parseInt(ts) / 1000 : '';
    setForm((f) => ({ ...f, tileSize: ts, width: sizeM, height: sizeM }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categoryId || !form.name || !form.unitPrice) return toast.error('필수 항목을 입력하세요.');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('image', file);
      if (isoFile) fd.append('isoImage', isoFile);

      const res = item
        ? await itemsApi.update(item.id, fd)
        : await itemsApi.create(fd);
      toast.success(item ? '수정되었습니다.' : '아이템이 추가되었습니다.');
      onSaved?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-[#1a1a1a] mb-4">{item ? '아이템 수정' : '새 아이템 추가'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">카테고리 *</label>
              {isMaster && onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="text-xs text-[#0073ea] hover:underline flex items-center gap-0.5"
                >
                  <Plus size={10} /> 카테고리 추가/관리
                </button>
              )}
            </div>
            <select name="categoryId" value={form.categoryId} onChange={handleChange} className={inputCls}>
              <option value="">선택하세요</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MF label="아이템 이름 *">
              <input name="name" value={form.name} onChange={handleChange} className={inputCls} />
            </MF>
            <MF label="브랜드">
              <select name="brand" value={form.brand} onChange={handleChange} className={inputCls}>
                <option value="공통">공통</option>
                <option value="먼데이커피">먼데이커피</option>
                <option value="스토리오브라망">스토리오브라망</option>
              </select>
            </MF>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MF label="단위 *">
              <select name="unit" value={form.unit} onChange={handleChange} className={inputCls}>
                <option value="m2">m² (면적)</option>
                <option value="m">m (길이)</option>
                <option value="ea">개 (수량)</option>
                <option value="set">세트/식</option>
                <option value="day">인/일</option>
                <option value="box">박스</option>
                <option value="unit">매/통</option>
              </select>
            </MF>
            <MF label="단가 (원) *">
              <input name="unitPrice" type="number" min="0" value={form.unitPrice} onChange={handleChange} className={inputCls} />
            </MF>
          </div>
          {form.unit === 'm2' && (
            <MF label="면적 자동계산 기준">
              <select name="areaBasis" value={form.areaBasis} onChange={handleChange} className={inputCls}>
                <option value="">수동 입력</option>
                <option value="floor">바닥 면적 (가로×세로)</option>
                <option value="wall">벽 면적 (둘레×높이)</option>
              </select>
            </MF>
          )}
          <MF label="설명">
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={inputCls} />
          </MF>
          {isFlooring && (
            <MF label="타일 크기">
              <select name="tileSize" value={form.tileSize} onChange={handleTileSizeChange} className={inputCls}>
                <option value="">선택 안 함</option>
                <option value="300">300×300 mm</option>
                <option value="600">600×600 mm</option>
              </select>
            </MF>
          )}
          <div className="grid grid-cols-2 gap-4">
            <MF label="가로 크기 (m, 선택)">
              <input
                name="width"
                type="number"
                step="0.1"
                value={form.width}
                onChange={handleChange}
                className={inputCls}
                placeholder="0.8"
                disabled={isFlooring && !!form.tileSize}
              />
            </MF>
            <MF label="세로 크기 (m, 선택)">
              <input
                name="height"
                type="number"
                step="0.1"
                value={form.height}
                onChange={handleChange}
                className={inputCls}
                placeholder="0.6"
                disabled={isFlooring && !!form.tileSize}
              />
            </MF>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MF label="평면도 이미지">
              <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                <Upload size={15} />
                <span className="truncate">{file ? file.name : item?.imageUrl ? '변경하기' : '2D 이미지'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
              </label>
              {!file && item?.imageUrl && <img src={item.imageUrl} alt="" className="mt-1 w-10 h-10 rounded object-cover border" />}
            </MF>
            <MF label="아이소메트릭 이미지">
              <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                <Upload size={15} />
                <span className="truncate">{isoFile ? isoFile.name : item?.isoImageUrl ? '변경하기' : '3D 이미지'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setIsoFile(e.target.files[0])} />
              </label>
              {!isoFile && item?.isoImageUrl && <img src={item.isoImageUrl} alt="" className="mt-1 w-10 h-10 rounded object-cover border" />}
            </MF>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isRequired" checked={form.isRequired} onChange={handleChange} className="rounded" />
            <span>필수 항목 (자동 배치, 삭제 불가)</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#0073ea] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#0060c0] disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
