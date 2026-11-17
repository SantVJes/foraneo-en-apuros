"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("relative flex w-full touch-none select-none items-center py-2", className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-6 rounded-full border-2 border-primary bg-card shadow outline-none focus-visible:ring-[4px] focus-visible:ring-ring/40" aria-label="Distancia" />
    </SliderPrimitive.Root>
  );
}

export { Slider };
