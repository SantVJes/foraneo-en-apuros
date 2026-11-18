// Arma foraneo-en-apuros.html: un solo archivo con la app, los estilos y las imágenes 3D adentro.
// Uso: node local/build.mjs <carpeta-de-herramientas con esbuild y @tailwindcss/cli>
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const FRONT = path.resolve(AQUI, "..");
const HERR = path.resolve(process.argv[2] || ".");
const req = createRequire(path.join(HERR, "package.json"));
const esbuild = req("esbuild");
const SALIDA = path.join(AQUI, "dist");
fs.mkdirSync(SALIDA, { recursive: true });

// 1) imágenes 3D como data: URI (solo las que se usan en el código)
const fuente = execFileSync("grep", ["-rhoE", "[a-z0-9]+(-[a-z0-9]+)*", path.join(FRONT, "src")], { maxBuffer: 1 << 26 }).toString().split("\n");
const usadas = new Set(fuente);
const IMGS = {};
for (const f of fs.readdirSync(path.join(FRONT, "public/3d"))) {
  if (!f.endsWith(".webp")) continue;
  const n = f.slice(0, -5);
  if (usadas.has(n)) IMGS[n] = "data:image/webp;base64," + fs.readFileSync(path.join(FRONT, "public/3d", f)).toString("base64");
}

// 2) parches pequeños para que corra sin servidor
const parches = {
  name: "parches",
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(AQUI, "shims/next-link.tsx") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(AQUI, "shims/next-navigation.ts") }));
    b.onResolve({ filter: /^@\/lib\/(api|auth-store|supabase)$/ }, (a) => ({ path: path.join(AQUI, a.path.split("/").pop() + ".ts") }));
    b.onResolve({ filter: /^\.\/(api|auth-store|supabase)$/ }, (a) => a.importer.includes("/src/lib/") ? { path: path.join(AQUI, a.path.slice(2) + ".ts") } : undefined);
    b.onResolve({ filter: /^@\// }, async (a) => {
      const base = path.join(FRONT, "src", a.path.slice(2));
      for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
    });
    b.onLoad({ filter: /img-3d\.tsx$/ }, (a) => ({ loader: "tsx", contents: fs.readFileSync(a.path, "utf8")
      .replace("src={`/3d/${n}.webp`}", "src={IMGS_3D[n] || IMGS_3D['fork-and-knife-with-plate']}")
      + `\nconst IMGS_3D: Record<string, string> = ${JSON.stringify(IMGS)};\n` }));
    b.onLoad({ filter: /recetas\/page\.tsx$/ }, (a) => ({ loader: "tsx", contents: fs.readFileSync(a.path, "utf8")
      .replace("`${location.origin}${location.pathname.replace(/\\/recetas\\/?$/, \"\")}/recetas/?r=${codigo}`", "`${location.href.split(\"#\")[0]}#/recetas/?r=${codigo}`") }));
    b.onLoad({ filter: /yo\/page\.tsx$/ }, (a) => ({ loader: "tsx", contents: fs.readFileSync(a.path, "utf8")
      .replace('location.search.includes("nuevo")', 'location.hash.includes("nuevo")')
      .replace('<h2 className="text-2xl font-bold">Tu cuenta</h2>', '<h2 className="text-2xl font-bold">Tus datos</h2><p className="text-sm text-muted-foreground">Todo se guarda en este navegador, sin cuenta. Descarga un respaldo para pasarlo a otro celular o computadora.</p>')
      .replace(/<Button[^\n]*cerrarSesion\(\); router\.replace\("\/"\); \}\}><LogOut \/>Cerrar sesión<\/Button>/,
        '<Button size="lg" type="button" variant="outline" onClick={descargarRespaldo}>Descargar respaldo</Button>'
        + '<Button size="lg" type="button" variant="outline" onClick={async () => { try { await cargarRespaldo(); toast("Listo, cargamos tu respaldo."); setTimeout(() => location.reload(), 600); } catch (e) { toast((e as Error).message); } }}>Cargar respaldo</Button>')
      .replace('"Borramos tu cuenta y todos tus datos."', '"Borramos todos tus datos de este navegador."')
      .replace('"Borrar mi cuenta"', '"Borrar mis datos"')
      + '\nimport { descargarRespaldo, cargarRespaldo } from "' + path.join(AQUI, "api-local") + '";\n' }));
  },
};
const r = await esbuild.build({
  entryPoints: [path.join(AQUI, "entry.tsx")], bundle: true, minify: true, format: "iife", target: "es2020", write: false,
  jsx: "automatic", loader: { ".json": "json" }, plugins: [parches], nodePaths: [path.join(FRONT, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_API_URL": '""' }, logLevel: "warning", metafile: true, banner: { js: "var process={env:{NODE_ENV:\"production\"}};" },
});
const js = r.outputFiles[0].text;
for (const t of ['location.hash.includes("nuevo")', '#/recetas/?r=', "Descargar respaldo", "Borrar mis datos"]) if (!js.includes(t)) console.warn("ojo: falta el parche", t);

// 3) estilos con Tailwind (lee las clases de src/ y de local/)
const css = path.join(SALIDA, "app.css"), entrada = path.join(SALIDA, "entrada.css");
fs.writeFileSync(entrada, fs.readFileSync(path.join(FRONT, "src/app/globals.css"), "utf8")
  .replace('@import "tailwindcss";', `@import "tailwindcss" source(none);\n@source "${path.join(FRONT, "src")}";\n@source "${AQUI}";`));
execFileSync(path.join(HERR, "node_modules/.bin/tailwindcss"), ["-i", entrada, "-o", css, "--minify"], { cwd: FRONT, stdio: "inherit" });

// 4) el HTML
const lectura = fs.readFileSync(path.join(FRONT, "src/lib/lectura.ts"), "utf8");
const ctx = {};
const CLAVE = lectura.match(/const CLAVE = "(.+?)"/)[1], VERSION = lectura.match(/const VERSION = (\d+)/)[1];
const FUENTES = Object.fromEntries([...lectura.matchAll(/(dislexia|clara): "(https:[^"]+)"/g)].map((m) => [m[1], m[2]]));
const linea = lectura.split("\n").find((l) => l.startsWith("export const SCRIPT_LECTURA"));
const SCRIPT = new Function("CLAVE", "VERSION", "FUENTES", "return " + linea.replace("export const SCRIPT_LECTURA = ", "").replace(/;$/, ""))(CLAVE, VERSION, FUENTES);
void ctx;
const esc = (s) => s.replace(/<\/script/gi, "<\\/script");
const icono = IMGS["pot-of-food"] || "";
const html = `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#131f24">
<title>Foráneo en apuros</title>
<meta name="description" content="Arma tu semana de comidas, revisa tu alacena y sabe en qué súper te sale más barato. Funciona sin internet y sin cuenta: tus datos se quedan en este navegador.">
<link rel="icon" href="${icono}">
<script>try{document.documentElement.classList.add('dark')}catch(e){}</script>
<script>${SCRIPT}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>${fs.readFileSync(css, "utf8")}</style>
</head>
<body class="min-h-dvh">
<div id="app"></div>
<noscript><p style="padding:2rem;font-family:sans-serif">Activa JavaScript para usar Foráneo en apuros.</p></noscript>
<script>${esc(js)}</script>
</body>
</html>
`;
const destino = path.join(SALIDA, "foraneo-en-apuros.html");
fs.writeFileSync(destino, html);
console.log(destino, (html.length / 1024).toFixed(0) + " KB,", Object.keys(IMGS).length, "imágenes");
