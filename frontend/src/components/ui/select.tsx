import * as React from "react";
import { CaretDown as ChevronDownIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/** Select nativo con el estilo de shadcn (funciona mejor en el celular). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full appearance-none rounded-lg border-2 border-input bg-secondary/60 pl-3 pr-9 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
