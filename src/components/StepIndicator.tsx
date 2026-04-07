interface StepIndicatorProps {
  currentStep: number;
  hasPaid: boolean;
}

const FREE_STEPS = ["Upload Resume", "Job Description", "Analyzing", "Results"];
const PAID_STEPS = ["Upload Resume", "Job Description", "Analyzing", "Results", "Download"];

export function StepIndicator({ currentStep, hasPaid }: StepIndicatorProps) {
  const steps = hasPaid ? PAID_STEPS : FREE_STEPS;

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={label} className="flex items-center">
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
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-12 mx-1 mb-4 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
