'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * CSS-based page transition — replaces framer-motion (~180KB) with pure CSS animations.
 * Animates opacity + translateY on route change (0.2s ease-in-out).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 200);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={isAnimating ? 'animate-fade-in-up' : ''}
      style={{
        animation: isAnimating ? 'fadeInUp 0.2s ease-in-out' : 'none',
      }}
    >
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {children}
    </div>
  );
}
