"use client";

import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export function StepIndicator({
  currentStep,
  totalSteps,
  labels,
}: StepIndicatorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          return (
            <div
              key={index}
              className="flex items-center flex-1 last:flex-none"
            >
              {/* Step circle + label */}
              <div className="flex flex-col items-center relative">
                <div
                  className={[
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ease-in-out",
                    isCompleted ? "border-blue-600 bg-blue-600 scale-100" : "",
                    isCurrent
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-900/40 scale-110 shadow-md shadow-blue-200 dark:shadow-blue-900/50"
                      : "",
                    isFuture
                      ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      : "",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" strokeWidth={3} />
                  ) : (
                    <span
                      className={[
                        "text-sm font-semibold transition-colors duration-300",
                        isCurrent
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-gray-500",
                      ].join(" ")}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Label — hidden on mobile, visible on sm+ */}
                {labels[index] && (
                  <span
                    className={[
                      "hidden sm:block absolute top-12 text-xs font-medium text-center whitespace-nowrap transition-colors duration-300",
                      isCompleted ? "text-blue-600 dark:text-blue-400" : "",
                      isCurrent
                        ? "text-blue-600 dark:text-blue-400 font-semibold"
                        : "",
                      isFuture ? "text-gray-400 dark:text-gray-500" : "",
                    ].join(" ")}
                  >
                    {labels[index]}
                  </span>
                )}
              </div>

              {/* Connector line (not after last step) */}
              {index < totalSteps - 1 && (
                <div className="flex-1 mx-2 h-0.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: isCompleted ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
