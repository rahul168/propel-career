interface StepIndicatorProps {
  currentStep: number;
}

const STEPS = ["Upload Resume", "Job Description", "Analyzing", "Results", "Review", "Download"];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-center mb-8">
      {STEPS.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {isCompleted ? "✓" : stepNum}
              </div>
              <span
                className={`mt-1 text-xs text-center max-w-[64px] ${
                  isCurrent ? "text-blue-600 font-medium" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 mx-1 mt-4 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
