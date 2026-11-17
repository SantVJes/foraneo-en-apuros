import { Badge } from "@/components/ui/badge";
import { DIF } from "@/lib/formato";

export function PillDificultad({ d }: { d: string }) {
  const v = (["facil", "intermedio", "complicado"].includes(d) ? d : "neutro") as "facil" | "intermedio" | "complicado" | "neutro";
  return <Badge variant={v}>{DIF[d] || d}</Badge>;
}
