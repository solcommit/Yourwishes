"use client";
// Aceternity UI LoaderOne, Manu Arora. Source: https://ui.aceternity.com/registry/loader.json
// Adapted only for reduced motion and the existing accessible Loader API.
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import "./loader.css";
export const LoaderOne = () => {
  const reduceMotion = useReducedMotion();
  const transition = (x: number) => {
    return {
      duration: 1,
      repeat: Infinity,
      repeatType: "loop" as const,
      delay: x * 0.2,
      ease: "easeInOut" as const,
    };
  };
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}><div className="flex items-center gap-2">
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: reduceMotion ? 0 : [0, 10, 0],
        }}
        transition={transition(0)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: reduceMotion ? 0 : [0, 10, 0],
        }}
        transition={transition(1)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: reduceMotion ? 0 : [0, 10, 0],
        }}
        transition={transition(2)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
    </div></MotionConfig>
  );
};


export function Loader({ label = "Loading…", compact = false, showLabel = false, announce = true, className = "" }: {
  label?: string; compact?: boolean; showLabel?: boolean; announce?: boolean; className?: string;
}) {
  return <span className={`app-loader ${compact ? "app-loader-compact" : ""} ${className}`}
    role={announce ? "status" : undefined} aria-label={announce ? label : undefined} aria-hidden={announce ? undefined : true}>
    <span aria-hidden="true"><LoaderOne /></span>
    {showLabel && <span className="app-loader-label" aria-hidden="true">{label}</span>}
  </span>;
}
