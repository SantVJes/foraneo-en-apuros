# Cartwise web (Next.js + shadcn/ui)

Web de Cartwise: Next.js 16, Tailwind 4 y componentes de shadcn/ui (en `src/components/ui`), con login de Supabase.
Se exporta como sitio estático (`out/`) y habla con la API de Django.

```bash
cp .env.example .env.local   # pon la URL de la API y, si ya tienes, las llaves de Supabase
npm install
npm run dev                  # http://localhost:3000
```

Sin las variables de Supabase la web entra con el correo y contraseña de Django (útil para probar en tu compu).

Pantallas: `/` entrar, `/semana/` menú, `/alacena/`, `/lista/` lista de compras, `/yo/` perfil.

## Publicar en Cloudflare Pages (gratis)

Workers & Pages > Create > Pages > conecta el repositorio:
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `out`
- Variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
