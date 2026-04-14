import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { estimatesApi } from '../../api/client';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { Download, Share2, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

const STATUS_MAP = {
  draft: { label: '임시저장', icon: <Clock size={14} />, color: 'text-gray-500 bg-gray-100' },
  submitted: { label: '상담신청', icon: <AlertCircle size={14} />, color: 'text-orange-600 bg-orange-100' },
  approved: { label: '승인완료', icon: <CheckCircle2 size={14} />, color: 'text-green-700 bg-green-100' },
};

export default function EstimatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVat, setShowVat] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    estimatesApi.get(id)
      .then((res) => setEstimate(res.data))
      .catch(() => { toast.error('견적을 찾을 수 없습니다.'); navigate('/my'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크가 복사되었습니다!');
    } catch {
      toast.error('복사 실패');
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-gray-400">로딩 중...</div></Layout>;
  if (!estimate) return null;

  const snapshot = Array.isArray(estimate.itemsSnapshot) ? estimate.itemsSnapshot : [];
  const subtotal = estimate.totalCost;
  const vat = subtotal * 0.1;
  const total = showVat ? subtotal + vat : subtotal;

  // Group by category
  const byCategory = {};
  snapshot.forEach((item) => {
    const key = item.categoryLabel || item.category;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(item);
  });

  const statusInfo = STATUS_MAP[estimate.status] || STATUS_MAP.draft;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#0073ea]">
            <ArrowLeft size={15} /> 뒤로
          </button>
          <div className="flex gap-2">
            <button onClick={handleShare} className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              <Share2 size={15} /> 공유
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 bg-[#1a1a1a] text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800">
              <Download size={15} /> PDF 다운로드
            </button>
          </div>
        </div>

        <div ref={printRef} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1a] text-white px-8 py-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-[#0073ea] rounded flex items-center justify-center text-white font-bold text-xs">F</div>
                  <span className="font-semibold">FranchiseSim</span>
                </div>
                <h1 className="text-2xl font-bold mt-3">인테리어 견적서</h1>
                <p className="text-gray-400 text-sm mt-1">{estimate.space?.name}</p>
              </div>
              <div className="text-right text-sm text-gray-400">
                <p>버전 v{estimate.versionLabel}</p>
                <p>{new Date(estimate.createdAt).toLocaleDateString('ko-KR')}</p>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-2 ${statusInfo.color}`}>
                  {statusInfo.icon} {statusInfo.label}
                </div>
              </div>
            </div>
          </div>

          {/* Space info */}
          <div className="px-8 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-3 gap-4 text-sm">
            <Info label="공간명" value={estimate.space?.name} />
            <Info label="면적" value={`${estimate.space?.areaSqm?.toFixed(1)} m²`} />
            <Info label="고객" value={estimate.customer?.name} />
          </div>

          {/* Items table */}
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#1a1a1a]">견적 내역</h2>
              <button
                onClick={() => setShowVat((v) => !v)}
                className="text-xs text-gray-500 hover:text-[#0073ea] border border-gray-200 px-3 py-1 rounded-lg print:hidden"
              >
                VAT {showVat ? '포함' : '별도'}
              </button>
            </div>

            {Object.entries(byCategory).map(([cat, items]) => (
              <div key={cat} className="mb-6">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">{cat}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400">
                      <th className="text-left pb-1 font-medium">항목</th>
                      <th className="text-right pb-1 font-medium">단가</th>
                      <th className="text-right pb-1 font-medium">수량</th>
                      <th className="text-right pb-1 font-medium">단위</th>
                      <th className="text-right pb-1 font-medium">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="py-1.5 text-[#1a1a1a]">{item.itemName}</td>
                        <td className="py-1.5 text-right text-gray-600">{item.unitPrice?.toLocaleString()}</td>
                        <td className="py-1.5 text-right text-gray-600">{parseFloat(item.quantity).toFixed(1)}</td>
                        <td className="py-1.5 text-right text-gray-400">{item.unit}</td>
                        <td className="py-1.5 text-right font-medium">{fmt(item.lineTotal)}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Totals */}
            <div className="border-t-2 border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>소계</span><span>{fmt(subtotal)}원</span>
              </div>
              {showVat && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>부가세 (10%)</span><span>{fmt(vat)}원</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-[#1a1a1a] pt-2 border-t border-gray-200">
                <span>최종 합계</span>
                <span className="text-[#0073ea]">{fmt(total)}원</span>
              </div>
            </div>

            {estimate.adminNote && (
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 mb-1">관리자 메모</p>
                <p className="text-sm text-blue-800">{estimate.adminNote}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@media print { .print\\:hidden { display: none !important; } body { background: white; } }`}</style>
    </Layout>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-[#1a1a1a]">{value || '-'}</p>
    </div>
  );
}
