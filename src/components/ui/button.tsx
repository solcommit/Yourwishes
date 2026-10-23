import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = Omit<HTMLMotionProps<"button">, "children" | "size"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "default" | "small";
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <motion.button
      className={`app-button app-button-${variant} ${size === "small" ? "app-button-small" : ""} ${className}`}
      type={type}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 460, damping: 28 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

type IconButtonProps = Omit<HTMLMotionProps<"button">, "children" | "size" | "aria-label"> & {
  children: ReactNode;
  label: string;
  variant?: "surface" | "quiet";
};

export function IconButton({
  children,
  className = "",
  label,
  variant = "surface",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <motion.button
      aria-label={label}
      className={`icon-button icon-button-${variant} ${className}`}
      tabIndex={0}
      type={type}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 460, damping: 28 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
