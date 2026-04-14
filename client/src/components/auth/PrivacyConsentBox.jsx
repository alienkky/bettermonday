import { useRef, useState, useEffect } from 'react';

const CONTENT = {
  privacy: {
    title: '[필수] 개인정보 수집 및 이용 동의',
    required: true,
    text: `■ 수집 항목
이름, 이메일, 연락처, 지역, 서비스 이용 기록, IP 주소

■ 수집 목적
- 서비스 제공 및 회원 관리
- 프랜차이즈 인테리어 견적 상담 연결
- 견적 내역 저장 및 관리

■ 보유 기간
회원 탈퇴 후 3년간 보관 후 파기
(단, 관련 법령에 따라 일정 기간 보관될 수 있습니다)

■ 개인정보 제3자 제공
원칙적으로 제3자에게 제공하지 않으며, 상담 연결 목적으로만 제한적으로 제공될 수 있습니다.

■ 동의 거부 권리
위 개인정보 수집에 동의하지 않으실 경우 서비스 이용이 제한됩니다.`,
  },
  terms: {
    title: '[필수] 서비스 이용약관 동의',
    required: true,
    text: `제1조 (목적)
본 약관은 베러먼데이(이하 "회사")가 제공하는 프랜차이즈 인테리어 시뮬레이터 서비스(이하 "서비스")의 이용에 관한 조건 및 절차, 이용자와 회사 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 회사가 제공하는 인테리어 견적 시뮬레이션 및 관련 부가 서비스를 의미합니다.
2. "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.
3. "회원"이란 회사와 서비스 이용 계약을 체결한 자를 의미합니다.

제3조 (서비스 이용)
1. 서비스는 연중무휴 24시간 제공됨을 원칙으로 합니다.
2. 정기점검, 시스템 오류 등의 경우 서비스 제공이 일시 중단될 수 있습니다.

제4조 (이용자의 의무)
1. 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.
2. 서비스를 이용하여 불법적인 활동을 해서는 안 됩니다.

제5조 (책임 제한)
제공되는 견적은 참고용이며 실제 시공 비용과 차이가 있을 수 있습니다. 회사는 견적 정보의 정확성을 보장하지 않습니다.`,
  },
  marketing: {
    title: '[선택] 마케팅 정보 수신 동의',
    required: false,
    text: `■ 수신 방법
이메일, SMS를 통한 마케팅 정보 발송

■ 내용
- 프랜차이즈 인테리어 트렌드 및 정보
- 서비스 업데이트 및 새로운 기능 안내
- 프로모션 및 할인 정보

■ 보유 기간
수신 동의 철회 시까지

■ 동의 거부 권리
마케팅 수신에 동의하지 않으셔도 서비스 이용에 제한이 없습니다.
동의 후에도 설정에서 언제든지 철회 가능합니다.`,
  },
};

export default function PrivacyConsentBox({ type, checked, onChange }) {
  const scrollRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const content = CONTENT[type];

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 10) setScrolled(true);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // If content is short enough, auto-enable
    if (el.scrollHeight <= el.clientHeight + 10) setScrolled(true);
  }, []);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <span className={`text-sm font-medium ${content.required ? 'text-[#1a1a1a]' : 'text-gray-600'}`}>
          {content.title}
        </span>
        {!content.required && (
          <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">선택</span>
        )}
      </div>

      {/* Scrollable text */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="px-4 py-3 max-h-[180px] overflow-y-auto bg-white text-xs text-gray-500 whitespace-pre-wrap leading-relaxed"
      >
        {content.text}
      </div>

      {/* Checkbox */}
      <div className={`px-4 py-3 border-t border-gray-100 ${!scrolled && content.required ? 'bg-gray-50' : 'bg-white'}`}>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={!scrolled}
            className="w-4 h-4 rounded border-gray-300 text-[#0073ea] cursor-pointer disabled:cursor-not-allowed"
          />
          <span className={`text-sm ${!scrolled ? 'text-gray-400' : 'text-gray-700'}`}>
            {content.required ? '위 내용에 동의합니다 (필수)' : '마케팅 정보 수신에 동의합니다 (선택)'}
          </span>
          {!scrolled && (
            <span className="text-xs text-gray-400 ml-auto">↓ 스크롤 후 동의 가능</span>
          )}
        </label>
      </div>
    </div>
  );
}
