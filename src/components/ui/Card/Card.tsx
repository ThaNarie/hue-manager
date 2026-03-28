import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-700/70 bg-slate-900/60 p-4 text-slate-100 shadow-sm backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
