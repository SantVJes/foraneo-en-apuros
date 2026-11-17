/** Cada vez que cambias de pantalla, la nueva entra suave desde abajo. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="entrar-pantalla">{children}</div>;
}
