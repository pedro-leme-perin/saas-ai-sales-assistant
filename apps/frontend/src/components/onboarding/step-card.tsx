"use client";

import type { ReactNode } from "react";

interface StepCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}

export function StepCard({
  title,
  description,
  icon,
  children,
}: StepCardProps) {
  return (
    <div className="animate-step-enter">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {title}
        </h2>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-6 ml-[52px]">
        {description}
      </p>
      <div>{children}</div>

      {/* Keyframe styles injected via a style tag to avoid requiring tailwind config changes */}
      <style jsx>{`
        @keyframes step-enter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-step-enter {
          animation: step-enter 0.35s ease-out both;
        }
      `}</style>
    </div>
  );
}
