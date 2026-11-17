"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{ classNames: { toast: "!rounded-full !bg-foreground !text-background !border-0 !font-semibold !justify-center dark:!bg-popover dark:!text-foreground dark:!shadow-[0_0_0_1px_var(--border),0_12px_30px_-10px_rgba(0,0,0,.8)]" } }}
      offset={{ bottom: 110 }}
      mobileOffset={{ bottom: 110 }}
      {...props}
    />
  );
}

export { Toaster };
