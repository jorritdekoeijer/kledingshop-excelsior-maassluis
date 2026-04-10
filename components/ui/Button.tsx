import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-3 py-1.5 text-sm" : "px-3.5 py-2 text-sm";
  const variants =
    variant === "primary"
      ? "bg-brand-blue text-white hover:bg-[#031c49]"
      : variant === "danger"
        ? "bg-brand-red text-white hover:bg-[#a91416]"
        : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50";

  return <button {...props} className={[base, sizes, variants, className].filter(Boolean).join(" ")} />;
}

