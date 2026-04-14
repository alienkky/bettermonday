export default function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  done
                    ? 'bg-[#00c875] text-white'
                    : active
                    ? 'bg-[#0073ea] text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {done ? '✓' : step}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  active ? 'text-[#0073ea] font-medium' : done ? 'text-[#00c875]' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all ${done ? 'bg-[#00c875]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
