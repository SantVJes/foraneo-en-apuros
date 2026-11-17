import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-wide",
  {
    variants: {
      variant: {
        facil: "bg-accent text-accent-texto before:size-1.5 before:rounded-full before:bg-current",
        intermedio: "bg-mango/25 text-mango-text before:size-1.5 before:rounded-full before:bg-current",
        complicado: "bg-destructive-soft text-[#9c1747] dark:text-destructive before:size-1.5 before:rounded-full before:bg-current",
        neutro: "bg-secondary text-muted-foreground",
        mango: "bg-mango text-mango-foreground -rotate-3 rounded-md",
      },
    },
    defaultVariants: { variant: "neutro" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
