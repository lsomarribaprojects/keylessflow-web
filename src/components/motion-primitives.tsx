"use client";

/**
 * Motion primitives — the "wow" layer on top of the Hallmark-disciplined base.
 *
 * Everything here honours `prefers-reduced-motion` via `useReducedMotion()`.
 * Animations stay on transform/opacity/filter only. No layout properties.
 */

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  animate,
  type MotionValue,
} from "motion/react";
import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------- Words: per-word reveal */

export function Words({
  children,
  start = 0,
  className = "",
}: {
  children: string;
  start?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const words = children.split(" ");

  return (
    <span ref={ref} className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block will-change-transform"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.5em", filter: "blur(8px)" }}
          animate={
            inView
              ? reduced
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
              : undefined
          }
          transition={{
            duration: reduced ? 0.2 : 0.7,
            delay: reduced ? 0 : start + i * 0.08,
            ease: EASE,
          }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------- Magnetic: pointer-attracted wrapper */

export function Magnetic({
  children,
  strength = 0.25,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });

  if (reduced) return <span className={className}>{children}</span>;

  return (
    <motion.span
      onPointerMove={(e) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x: sx, y: sy, display: "inline-block" }}
      className={className}
    >
      {children}
    </motion.span>
  );
}

/* ------------------------------------------------------- ParallaxFloat: scroll-linked translate */

export function ParallaxFloat({
  children,
  strength = 70,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yRaw = useTransform(scrollYProgress, [0, 1], [strength, -strength]);
  const y = useSpring(yRaw, { stiffness: 80, damping: 24, mass: 0.4 });

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------- AmbientGlow: cursor-tracked spotlight */

export function AmbientGlow() {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.25);
  const sx = useSpring(mx, { stiffness: 35, damping: 22, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 35, damping: 22, mass: 0.5 });

  // Build the background string from both motion values reactively
  const bg = useTransform([sx, sy] as unknown as MotionValue<number>[], (raw) => {
    const [x, y] = raw as unknown as [number, number];
    return (
      `radial-gradient(45% 50% at ${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%, oklch(0.72 0.12 233 / 0.20), transparent 70%),` +
      `radial-gradient(35% 35% at ${((1 - x) * 100).toFixed(1)}% ${((y + 0.15) * 100).toFixed(1)}%, oklch(0.83 0.13 184 / 0.14), transparent 65%)`
    );
  });

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, mx, my]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{ background: reduced ? undefined : bg }}
    />
  );
}

/* ------------------------------------------------------- Counter: in-view number animation */

export function Counter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.4,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, { duration, ease: EASE });
    return () => controls.stop();
  }, [inView, reduced, to, duration, value]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/* ------------------------------------------------------- Stagger: container + child reveal */

export function Stagger({
  children,
  className = "",
  delay = 0,
  step = 0.08,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  step?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10%" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduced ? 0 : step, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 22 },
        show: reduced
          ? { opacity: 1, transition: { duration: 0.2 } }
          : { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}
