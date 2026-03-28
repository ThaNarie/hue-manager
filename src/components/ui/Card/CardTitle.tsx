import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/utils";

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold text-slate-100", className)} {...props} />;
}
