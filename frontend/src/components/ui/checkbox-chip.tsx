"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Chip que se prende y se apaga (checkbox o radio con estilo de píldora). */
function CheckboxChip({
  className,
  children,
  tono = "normal",
  ...props
}: React.ComponentProps<"input"> & { tono?: "normal" | "alerta" }) {
  return (
    <label className="max-w-full cursor-pointer">
      <input className="peer sr-only" {...props} />
      <span
        className={cn(
          "chip-3d inline-flex min-h-10 max-w-full items-center rounded-full border-2 border-transparent px-4 py-1 text-left text-sm font-semibold transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
          tono === "alerta"
            ? "peer-checked:border-destructive peer-checked:bg-destructive peer-checked:text-white dark:peer-checked:text-[#2a0714]"
            : "peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background",
          className,
        )}
      >
        {children}
      </span>
    </label>
  );
}

export { CheckboxChip };
