import * as React from "react";
type P = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; replace?: boolean; scroll?: boolean };
const Link = React.forwardRef<HTMLAnchorElement, P>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...resto }, ref) {
  void _p; void _r; void _s;
  const destino = href.startsWith("/") ? "#" + href : href;
  return <a ref={ref} href={destino} {...resto} />;
});
export default Link;
