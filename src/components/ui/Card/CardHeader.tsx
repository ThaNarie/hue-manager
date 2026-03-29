import type { HTMLAttributes } from "react";
import { cn } from "../../../lib/utils";

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3", className)} {...props} />;
}
