import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({ value, className, tono = "ok" }: { value: number; className?: string; tono?: "ok" | "mal" }) {
  return (
    <div role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className={cn("crecer h-full rounded-full transition-[width] duration-700 ease-out", tono === "ok" ? "bg-primary" : "bg-destructive")}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export { Progress };
