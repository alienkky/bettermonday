import { useEffect, useState } from 'react';
import { categoriesApi } from '../api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Edit2, Check, FolderOpen } from 'lucide-react';

/**
 * 카테고리 관리 모달 — 마스터 전용 (추가/수정/삭제)
 * props:
 *   - onClose: () => void
 *   - onChanged?: () => void  // 카테고리 변경 시 상위에서 목록 새로고침
 */
export default function CategoryManagerModal({ onClose, onChanged }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', displayName: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.list();
      setCategories(res.data);
    } catch { toast.error('카테고리 로드 실패'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return toast.error('카테고리명을 입력하세요.');
    setSaving(true);
    try {
      await categoriesApi.create({ name, displayName: newDisplay.trim() || null });
      toast.success(`"${name}" 추가됨`);
      setNewName(''); setNewDisplay('');
      await load();
      onChanged?.();
    } catch (err) { toast.error(err.response?.data?.error || '추가 실패'); }
    finally { setSaving(false); }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, displayName: cat.displayName || '' });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({ name: '', displayName: '' }); };

  const saveEdit = async (id) => {
    const name = editForm.name.trim();
    if (!name) return toast.error('카테고리명이 비어있습니다.');
    try {
      await categoriesApi.update(id, { name, displayName: editForm.displayName.trim() || null });
      toast.success('수정 완료');
      cancelEdit();
      await load();
      onChanged?.();
    } catch (err) { toast.error(err.response?.data?.error || '수정 실패'); }
  };

  const handleDelete = async (cat) => {
    const itemCount = cat.items?.length || 0;
    if (itemCount > 0) {
      if (!window.confirm(`"${cat.name}" 카테고리에 ${itemCount}개 아이템이 연결되어 있습니다.\n비활성화 처리하시겠습니까? (아이템은 유지됩니다)`)) return;
      try {
        await categoriesApi.delete(cat.id, true);
        toast.success('비활성화 완료');
        await load();
        onChanged?.();
      } catch (err) { toast.error(err.response?.data?.error || '처리 실패'); }
    } else {
      if (!window.confirm(`"${cat.name}" 카테고리를 삭제하시겠습니까?`)) return;
      try {
        await categoriesApi.delete(cat.id);
        toast.success('삭제 완료');
        await load();
        onChanged?.();
      } catch (err) { toast.error(err.response?.data?.error || '삭제 실패'); }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-[#0073ea]" />
            <h3 className="font-semibold text-gray-900">카테고리 관리</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="px-6 py-4 bg-blue-50/40 border-b border-gray-100">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">카테고리명 *</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="예: 조명, lighting..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">표시명 (선택)</label>
              <input
                value={newDisplay}
                onChange={e => setNewDisplay(e.target.value)}
                placeholder="예: 실내 조명"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0073ea] text-white text-sm font-medium hover:bg-[#0060c0] disabled:opacity-50"
              >
                <Plus size={14} /> 추가
              </button>
            </div>
          </div>
        </form>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">로딩 중...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">등록된 카테고리가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">카테고리명</th>
                  <th className="px-4 py-3 text-left">표시명</th>
                  <th className="px-4 py-3 text-center">아이템 수</th>
                  <th className="px-4 py-3 text-center w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.map(cat => {
                  const isEditing = editingId === cat.id;
                  const itemCount = cat.items?.length || 0;
                  return (
                    <tr key={cat.id} className={`${isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{cat.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {isEditing ? (
                          <input
                            value={editForm.displayName}
                            onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                            placeholder="(비워두면 카테고리명 사용)"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                          />
                        ) : (
                          cat.displayName || <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${itemCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {itemCount}개
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(cat.id)} className="text-emerald-600 hover:text-emerald-700 p-1" title="저장"><Check size={14} /></button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 p-1" title="취소"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(cat)} className="text-gray-400 hover:text-[#0073ea] p-1" title="수정"><Edit2 size={13} /></button>
                              <button onClick={() => handleDelete(cat)} className="text-gray-400 hover:text-red-500 p-1" title={itemCount > 0 ? '비활성화 (아이템 연결됨)' : '삭제'}>
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span>총 {categories.length}개 카테고리</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">닫기</button>
        </div>
      </div>
    </div>
  );
}
