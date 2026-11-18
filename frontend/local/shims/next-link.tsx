import * as React from "react";
import { ir } from "./router";
type P = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean };
const Link = React.forwardRef<HTMLAnchorElement, P>(function Link({ href, prefetch: _p, replace, scroll: _s, onClick, ...resto }, ref) {
  void _p; void _s;
  const interna = href.startsWith("/");
  return <a ref={ref} href={interna ? "#" + href : href} {...resto} onClick={(e) => {
    onClick?.(e);
    if (!interna || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); ir(href, !!replace);
  }} />;
});
export default Link;
