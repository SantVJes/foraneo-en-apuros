import { cn } from "@/lib/utils";

export function Marca({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span aria-hidden className="grid size-10 -rotate-[8deg] place-items-center rounded-full bg-mango font-display text-[0.95rem] font-extrabold text-mango-foreground shadow-[inset_0_0_0_2px_var(--foreground)]">
        FA
      </span>
      <span className="font-display text-[1.02rem] font-extrabold leading-[0.95] tracking-tight">
        foráneo
        <br />
        <span className="text-primary">en apuros</span>
      </span>
    </span>
  );
}
