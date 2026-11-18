import * as React from "react";
import { ir, useRuta } from "./router";
const router = { push: (h: string) => ir(h), replace: (h: string) => ir(h, true), back: () => history.back(), refresh: () => {}, prefetch: () => {} };
export function useRouter() { return router; }
export function usePathname() { return useRuta(); }
export function useSearchParams() { const h = useHash(); return React.useMemo(() => new URLSearchParams(h.split("?")[1] || ""), [h]); }
function useHash() { useRuta(); return location.hash; }
