"use client";

import { useEffect, useState, type ReactNode } from "react";

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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
      }}
    >
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
    </div>
  );
}
