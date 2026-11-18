# Versión en un solo HTML

Arma `dist/foraneo-en-apuros.html`: la misma app (mismas pantallas y diseño 3D) en un archivo que abre en cualquier navegador,
sin servidor y sin cuenta. Los datos se guardan en el navegador (localStorage) y se pueden pasar a otro con "Descargar respaldo" en Yo.

- `api-local.ts`: la lógica del API de Django pasada a TypeScript (plan semanal, ajuste al presupuesto, lista de compras, alacena, salud, nutrición, recetas).
- `catalogo.json`: ingredientes, platillos, supermercados y precios exportados de la base.
- `shims/`: reemplazos de `next/link` y `next/navigation` con rutas `#/`.
- Súper cercanos (Overpass) y búsqueda de direcciones (Nominatim) se piden directo desde el navegador.

```bash
mkdir -p /tmp/herr && cd /tmp/herr && npm init -y && npm i esbuild@0.25.10 @tailwindcss/cli@4.3.3
cd frontend && node local/build.mjs /tmp/herr
```
