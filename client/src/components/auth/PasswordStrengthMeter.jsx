const checks = [
  { label: '8자 이상', test: (p) => p.length >= 8 },
  { label: '영문 포함', test: (p) => /[a-zA-Z]/.test(p) },
  { label: '숫자 포함', test: (p) => /[0-9]/.test(p) },
  { label: '특수문자 포함', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

export function getPasswordStrength(password) {
  if (!password) return 0;
  return checks.filter((c) => c.test(password)).length;
}

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const score = getPasswordStrength(password);
  const label = ['', '약함', '보통', '좋음', '강함'][score];
  const colors = ['', 'bg-red-500', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];
  const textColors = ['', 'text-red-500', 'text-yellow-500', 'text-blue-500', 'text-green-600'];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i <= score ? colors[score] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      {score > 0 && (
        <p className={`text-xs font-medium ${textColors[score]}`}>비밀번호 강도: {label}</p>
      )}

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => {
          const passed = c.test(password);
          return (
            <div key={c.label} className={`flex items-center gap-1 text-xs ${passed ? 'text-green-600' : 'text-gray-400'}`}>
              <span>{passed ? '✓' : '○'}</span>
              <span>{c.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
