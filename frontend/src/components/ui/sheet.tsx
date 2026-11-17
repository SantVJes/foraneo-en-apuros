"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X as XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(640px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-7 sm:data-[state=open]:slide-in-from-bottom-4",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-secondary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <XIcon className="size-4" />
          <span className="sr-only">Cerrar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("pr-10 text-2xl font-bold", className)} {...props} />;
}
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
