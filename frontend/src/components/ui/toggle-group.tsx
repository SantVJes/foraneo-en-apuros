"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("grid w-full auto-cols-fr grid-flow-col gap-1 rounded-full bg-secondary p-1 sm:inline-grid sm:w-fit", className)}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "min-h-10 rounded-full px-2.5 text-sm font-semibold leading-tight text-muted-foreground outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
