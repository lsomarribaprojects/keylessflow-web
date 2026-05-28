"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * One orchestrated entrance per element, fired by IntersectionObserver
 * (never a scroll listener). Honours prefers-reduced-motion via the CSS in
 * globals.css. `i` staggers siblings by 60ms each, capped by the caller.
 */
export default function Reveal({
  children,
  i = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  i?: number;
  as?: "div" | "section" | "li" | "article";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref as never}
      className={`reveal ${shown ? "is-in" : ""} ${className}`}
      style={{ ["--i" as string]: i }}
    >
      {children}
    </Tag>
  );
}
