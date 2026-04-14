import { useEffect, useState } from 'react';
import { versionsApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Tag, CheckCircle2, Clock, Plus, X } from 'lucide-react';

export default function VersionsPage() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [releaseForm, setReleaseForm] = useState({ type: 'minor', changelog: '' });
  const [releasing, setReleasing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await versionsApi.list();
      setVersions(res.data);
    } catch {
      toast.error('버전 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRelease = async () => {
    if (!releaseForm.changelog.trim()) return toast.error('변경 로그를 입력하세요.');
    setReleasing(true);
    try {
      await versionsApi.release(releaseForm);
      toast.success('새 버전이 릴리즈되었습니다.');
      setModal(false);
      load();
    } catch {
      toast.error('릴리즈 실패');
    } finally {
      setReleasing(false);
    }
  };

  const current = versions.find((v) => v.isCurrent);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a1a]">버전 관리</h1>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 bg-[#0073ea] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0060c0]"
          >
            <Plus size={15} /> 새 버전 릴리즈
          </button>
        </div>

        {/* Current version banner */}
        {current && (
          <div className="bg-gradient-to-r from-[#0073ea] to-[#0060c0] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={18} />
              <span className="text-sm font-medium text-blue-100">현재 활성 버전</span>
            </div>
            <div className="text-4xl font-bold">v{current.version}</div>
            <p className="text-blue-100 text-sm mt-2">{current.changelog || '변경 로그 없음'}</p>
            <p className="text-blue-200 text-xs mt-1">
              {new Date(current.releasedAt).toLocaleString('ko-KR')}
            </p>
          </div>
        )}

        {/* Version timeline */}
        {loading ? (
          <div className="text-center py-10 text-gray-400">로딩 중...</div>
        ) : (
          <div className="space-y-3">
            {versions.map((v, i) => (
              <div key={v.id} className={`bg-white rounded-xl border p-5 ${v.isCurrent ? 'border-[#0073ea]/30' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${v.isCurrent ? 'bg-[#0073ea] text-white' : 'bg-gray-100 text-gray-400'}`}>
                      <Tag size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1a1a1a]">v{v.version}</span>
                        {v.isCurrent && (
                          <span className="text-xs bg-[#0073ea]/10 text-[#0073ea] px-2 py-0.5 rounded-full font-medium">현재</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{v.changelog || '변경 로그 없음'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={12} />
                    {new Date(v.releasedAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Release modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#1a1a1a]">새 버전 릴리즈</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            {current && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-500">
                현재 버전: <span className="font-semibold text-[#1a1a1a]">v{current.version}</span>
                <span className="mx-2">→</span>
                <span className="font-semibold text-[#0073ea]">
                  {releaseForm.type === 'major'
                    ? `v${parseInt(current.version.split('.')[0]) + 1}.0.0`
                    : `v${current.version.split('.')[0]}.${parseInt(current.version.split('.')[1]) + 1}.0`
                  }
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">릴리즈 타입</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['minor', 'Minor (+0.1.0)', '가격 업데이트, 아이템 추가'],
                    ['major', 'Major (+1.0.0)', '대규모 구조 변경'],
                  ].map(([val, label, desc]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setReleaseForm((f) => ({ ...f, type: val }))}
                      className={`border-2 rounded-xl p-3 text-left transition-all ${
                        releaseForm.type === val ? 'border-[#0073ea] bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-sm text-[#1a1a1a]">{label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">변경 로그 *</label>
                <textarea
                  value={releaseForm.changelog}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, changelog: e.target.value }))}
                  rows={4}
                  placeholder="이번 버전에서 변경된 내용을 작성하세요..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0073ea]/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(false)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleRelease} disabled={releasing} className="flex-1 bg-[#0073ea] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#0060c0] disabled:opacity-50">
                {releasing ? '릴리즈 중...' : '릴리즈'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
