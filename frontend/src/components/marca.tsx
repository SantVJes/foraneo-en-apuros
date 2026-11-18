import { cn } from "@/lib/utils";

export function Marca({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span aria-hidden className="sello-3d grid size-10 -rotate-[8deg] place-items-center rounded-[0.9rem] font-display text-[0.95rem] font-extrabold text-mango-foreground">
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
