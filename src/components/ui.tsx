import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant = "main" | "secondary" | "accent" | "lime" | "grape" | "ink" | "white";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  // Light backgrounds set an explicit dark text colour so they stay readable
  // even inside dark containers (e.g. the admin header) instead of inheriting.
  main: "bg-main text-ink",
  secondary: "bg-secondary text-white",
  accent: "bg-accent text-ink",
  lime: "bg-lime text-ink",
  grape: "bg-grape text-white",
  ink: "bg-ink text-white",
  white: "bg-white text-ink",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-7 py-3.5 text-lg",
};

export function buttonStyles(variant: Variant = "main", size: Size = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 border-3 border-ink font-bold uppercase tracking-wide",
    "shadow-brutal transition-all select-none",
    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-lg",
    "active:translate-x-0 active:translate-y-0 active:shadow-brutal-sm",
    "disabled:opacity-50 disabled:pointer-events-none disabled:shadow-brutal",
    variantClasses[variant],
    sizeClasses[size],
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "main",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={cn(buttonStyles(variant, size), className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-3 border-ink bg-white shadow-brutal", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input + Label + Textarea + Select                                   */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("brutal-input", className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea ref={ref} className={cn("brutal-input resize-y", className)} {...props} />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn("brutal-input cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-bold uppercase tracking-wide", className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

export function Badge({
  className,
  variant = "main",
  children,
}: {
  className?: string;
  variant?: Variant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap border-3 border-ink px-2 py-0.5 text-xs font-bold uppercase",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Alert (for form errors / success)                                   */
/* ------------------------------------------------------------------ */

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    error: "bg-secondary text-white",
    success: "bg-lime",
    info: "bg-accent",
  };
  if (!children) return null;
  return (
    <div className={cn("border-3 border-ink px-4 py-3 font-bold", tones[tone])}>
      {children}
    </div>
  );
}
