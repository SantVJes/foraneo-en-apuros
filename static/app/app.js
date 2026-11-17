/* Cartwise: app web que usa la API de /api/ */
(function () {
  "use strict";

  const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const TIPOS = { desayuno: "Desayuno", comida: "Comida", cena: "Cena" };
  const DIF = { facil: "Fácil", intermedio: "Intermedio", complicado: "Complicado" };
  const FRACCION = { lleno: 1, tres_cuartos: .75, mitad: .5, un_tercio: .33, un_cuarto: .25, casi_nada: .1 };
  const vista = document.getElementById("vista");
  const estado = { usuario: null, opciones: null, ingredientes: null, supers: null };

  // ------------------------------------------------------------ utilidades
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dinero = (n) => "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function cantidad(n, unidad) {
    n = Number(n);
    if (unidad === "g" && n >= 1000) return (n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " kg";
    if (unidad === "ml" && n >= 1000) return (n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " L";
    const u = unidad === "pieza" ? (n === 1 ? " pieza" : " piezas") : " " + unidad;
    return n.toLocaleString("es-MX", { maximumFractionDigits: 1 }) + u;
  }
  const pill = (d) => `<span class="pill pill--${esc(d)}">${esc(DIF[d] || d)}</span>`;
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  let avisoTimer;
  function aviso(texto) {
    const el = document.getElementById("aviso");
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  const cargando = (texto) => { vista.innerHTML = `<div class="cargando">${esc(texto || "Cargando…")}</div>`; };

  function mensajeError(data) {
    if (!data) return "Algo salió mal. Intenta otra vez.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    const partes = [];
    for (const [k, v] of Object.entries(data)) partes.push(Array.isArray(v) ? v.join(" ") : (typeof v === "object" ? mensajeError(v) : v));
    return partes.join(" ") || "Algo salió mal. Intenta otra vez.";
  }

  // ------------------------------------------------------------ API
  async function api(ruta, opciones = {}, reintento = true) {
    const headers = { "Content-Type": "application/json" };
    const token = leer("fa_access");
    if (token) headers.Authorization = "Bearer " + token;
    const resp = await fetch("/api" + ruta, {
      method: opciones.method || "GET", headers,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
    if (resp.status === 401 && reintento && leer("fa_refresh")) {
      const r = await fetch("/api/auth/refresh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: leer("fa_refresh") }) });
      if (r.ok) { guardar("fa_access", (await r.json()).access); return api(ruta, opciones, false); }
    }
    if (resp.status === 401) { salir(); throw new Error("Tu sesión terminó. Entra otra vez."); }
    const data = resp.status === 204 ? null : await resp.json().catch(() => null);
    if (!resp.ok) { const e = new Error(mensajeError(data)); e.data = data; throw e; }
    return data;
  }
  async function todos(ruta) {
    let url = ruta, salida = [];
    while (url) {
      const data = await api(url);
      if (Array.isArray(data)) return data;
      salida = salida.concat(data.results);
      url = data.next ? data.next.replace(/^.*\/api/, "") : null;
    }
    return salida;
  }
  const proActivo = () => estado.opciones?.pro_activo !== false;
  async function cargarBase() {
    if (!estado.usuario) estado.usuario = await api("/auth/yo/");
    if (!estado.opciones) {
      estado.opciones = await api("/opciones/");
      const tab = document.querySelector('[data-tab="pro"]');
      if (tab) tab.hidden = !proActivo();
    }
    if (!estado.supers) estado.supers = await api("/supermercados/");
  }
  async function cargarIngredientes() {
    if (!estado.ingredientes) estado.ingredientes = await todos("/ingredientes/");
    return estado.ingredientes;
  }
  function entrarCon(data) {
    guardar("fa_access", data.access);
    guardar("fa_refresh", data.refresh);
    estado.usuario = data.usuario;
  }
  function salir() {
    guardar("fa_access", null); guardar("fa_refresh", null);
    Object.keys(estado).forEach((k) => { estado[k] = null; });
    location.hash = "#entrar";
  }

  // ------------------------------------------------------------ hoja (diálogo)
  const hoja = document.getElementById("hoja");
  function abrirHoja(html) {
    document.getElementById("hoja-contenido").innerHTML =
      `<div class="hoja__dentro"><button class="icono-btn hoja__cerrar" type="button" data-cerrar aria-label="Cerrar">×</button>${html}</div>`;
    if (!hoja.open) hoja.showModal();
  }
  hoja.addEventListener("click", (e) => { if (e.target === hoja || e.target.closest("[data-cerrar]")) hoja.close(); });

  // ------------------------------------------------------------ entrar
  function vistaEntrar() {
    let modo = "entrar";
    vista.innerHTML = `
      <section class="entrada">
        <div class="entrada__hero">
          <div class="marca"><span class="marca__sello" aria-hidden="true">FA</span><span class="marca__texto">foráneo<br>en apuros</span></div>
          <span class="etiqueta">Para el que vive lejos de casa · Come bien · Gasta poco</span>
          <h1>Come rico toda la semana <span>sin quebrarte</span></h1>
          <p>Eliges qué quieres comer, anotas lo que ya tienes en la alacena y te decimos qué comprar y en qué súper cerca de ti sale más barato.</p>
          <div class="ticket mini-ticket" aria-label="Ejemplo de lista de compras">
            <div class="ticket__tienda"><span class="ticket__punto" style="background:#1f7a3a"></span>Bodega Aurrera</div>
            <div class="ticket__meta"><span>Ejemplo · a 1.2 km de ti</span></div>
            <hr>
            <div class="ticket__linea"><span>Arroz bolsa 1 kg</span><span>$29.50</span></div>
            <div class="ticket__linea"><span>Jitomate 1 kg</span><span>$26.00</span></div>
            <div class="ticket__linea"><span>Huevo cartón 18</span><span>$57.50</span></div>
            <hr>
            <div class="ticket__total"><span>TOTAL</span><span>$113.00</span></div>
          </div>
        </div>
        <div class="panel pila">
          <div class="segmento" role="group" aria-label="Elige">
            <button type="button" data-modo="entrar" aria-pressed="true">Ya tengo cuenta</button>
            <button type="button" data-modo="registro" aria-pressed="false">Crear cuenta</button>
          </div>
          <form id="f-entrar" class="pila-s" novalidate>
            <label class="campo" data-solo="registro" hidden>Tu nombre
              <input id="e-nombre" type="text" autocomplete="given-name"></label>
            <label class="campo">Correo
              <input id="e-email" type="email" autocomplete="email" required></label>
            <label class="campo">Contraseña
              <input id="e-pass" type="password" autocomplete="current-password" required minlength="8"></label>
            <p class="chico suave" data-solo="registro" hidden>Mínimo 8 caracteres, que no sea solo números.</p>
            <button class="btn btn--grande" id="e-boton" type="submit">Entrar</button>
          </form>
          <div id="google-zona" hidden class="pila-s"><div class="sep">o</div><div id="google-boton"></div></div>
        </div>
      </section>`;

    vista.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => {
      modo = b.dataset.modo;
      vista.querySelectorAll("[data-modo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      vista.querySelectorAll("[data-solo]").forEach((x) => { x.hidden = modo !== "registro"; });
      document.getElementById("e-boton").textContent = modo === "registro" ? "Crear mi cuenta" : "Entrar";
      document.getElementById("e-pass").autocomplete = modo === "registro" ? "new-password" : "current-password";
    }));

    document.getElementById("f-entrar").addEventListener("submit", async (e) => {
      e.preventDefault();
      const boton = document.getElementById("e-boton");
      const email = document.getElementById("e-email").value.trim();
      const password = document.getElementById("e-pass").value;
      if (!email || !password) return aviso("Escribe tu correo y contraseña.");
      boton.disabled = true;
      try {
        if (modo === "registro") {
          entrarCon(await api("/auth/registro/", { method: "POST", body: { email, password, first_name: document.getElementById("e-nombre").value.trim() } }));
          location.hash = "#yo";
          aviso("¡Cuenta creada! Cuéntanos cómo compras.");
        } else {
          entrarCon(await api("/auth/login/", { method: "POST", body: { email, password } }));
          location.hash = "#menu";
        }
      } catch (err) { aviso(err.message); } finally { boton.disabled = false; }
    });

    const id = (window.FA_CONFIG || {}).googleClientId;
    if (id) {
      const iniciar = () => {
        if (!window.google || !google.accounts) return setTimeout(iniciar, 300);
        document.getElementById("google-zona").hidden = false;
        google.accounts.id.initialize({
          client_id: id,
          callback: async (r) => {
            try {
              const data = await api("/auth/google/", { method: "POST", body: { id_token: r.credential } });
              entrarCon(data);
              location.hash = data.nuevo ? "#yo" : "#menu";
            } catch (err) { aviso(err.message); }
          },
        });
        google.accounts.id.renderButton(document.getElementById("google-boton"), { theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "es" });
      };
      iniciar();
    }
  }

  // ------------------------------------------------------------ mi semana
  async function ultimoPlan() {
    const data = await api("/planes/?page_size=50");
    const planes = data.results || [];
    estado.planes = planes;
    estado.totalPlanes = data.count ?? planes.length;
    const elegido = planes.find((p) => String(p.id) === leer("cw_plan"));
    return elegido || planes[0] || null;
  }
  const fechaCorta = (f) => new Date(f + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  // ------------------------------------------------------------ Pro
  const SELLO_PRO = `<span class="sello-pro">PRO</span>`;
  function invitacionPro(titulo, texto) {
    return `<div class="invita-pro"><div class="pila-s">${SELLO_PRO}<h3>${esc(titulo)}</h3><p class="chico suave">${esc(texto)}</p></div>
      <a class="btn btn--chico" href="#pro">Ver Pro · $${esc(estado.opciones?.pro_mensual || 19)}/mes</a></div>`;
  }
  function hojaLimite() {
    abrirHoja(`<div class="pila-s">${SELLO_PRO}<h2>Ya guardaste 5 semanas</h2>
      <p class="suave">Con la cuenta gratis guardas hasta 5 semanas. Borra una en “Tus semanas” o pásate a Pro y guarda todas las que quieras.</p>
      <div class="fila"><a class="btn" href="#pro">Ver Plan Pro</a><button class="btn btn--borde" type="button" data-cerrar>Ahora no</button></div></div>`);
  }

  async function vistaMenu() {
    cargando("Cargando tu semana…");
    await cargarBase();
    const plan = await ultimoPlan();
    const u = estado.usuario;
    const comidas = plan ? plan.comidas : ["comida", "cena"];
    const difs = plan ? plan.dificultades : [];
    vista.innerHTML = `
      <div class="pila">
        <div class="cabeza">
          <span class="etiqueta">${plan ? "Semana del " + esc(new Date(plan.fecha_inicio + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" })) : "Arma tu semana"}</span>
          <h1>¿Qué se come esta semana${u.first_name ? ", " + esc(u.first_name) : ""}?</h1>
          <p>Elige qué comidas quieres hacer y qué tan complicado le quieres meter. Armamos el menú con platillos distintos cada día.</p>
        </div>
        <form id="f-plan" class="panel pila" novalidate>
          <div class="rejilla-2">
            <div class="pila-s"><span class="etiqueta">Comidas del día</span>
              <div class="chips">${Object.entries(TIPOS).map(([v, n]) => `<label class="chip"><input type="checkbox" name="comidas" value="${v}" ${comidas.includes(v) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
            <div class="pila-s"><span class="etiqueta">Dificultad (sin marcar = de todo)</span>
              <div class="chips">${Object.entries(DIF).map(([v, n]) => `<label class="chip"><input type="checkbox" name="dif" value="${v}" ${difs.includes(v) ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
          </div>
          <div class="rejilla-2">
            <label class="campo">Presupuesto de la semana (MXN)
              <input id="p-pres" type="number" min="0" step="50" inputmode="decimal" value="${esc(plan ? plan.presupuesto : u.presupuesto_semanal)}"></label>
            <label class="campo">¿Para cuántas personas?
              <input id="p-personas" type="number" min="1" max="12" inputmode="numeric" value="${esc(plan ? plan.personas : u.personas)}"></label>
          </div>
          <div class="fila">
            <button class="btn btn--grande" id="p-armar" type="submit">${plan ? "Armar otra semana" : "Armar mi semana"}</button>
            ${plan ? `<a class="btn btn--borde btn--grande" href="#lista">Ver lista de compras</a>` : ""}
          </div>
          ${(u.restricciones || []).length ? `<p class="chico suave">Sin platillos con: ${esc(u.restricciones.map(nombreRestriccion).join(", "))}. <a href="#yo">Cambiar</a></p>` : ""}
        </form>
        ${historial()}
        <div id="semana"></div>
        <div id="nutricion"></div>
      </div>`;

    vista.querySelectorAll("[data-ver-plan]").forEach((b) => b.addEventListener("click", () => { guardar("cw_plan", b.dataset.verPlan); vistaMenu(); }));
    vista.querySelectorAll("[data-borrar-plan]").forEach((b) => b.addEventListener("click", async () => {
      if (b.dataset.confirmar !== "1") { b.dataset.confirmar = "1"; b.textContent = "¿Seguro?"; return; }
      try { await api(`/planes/${b.dataset.borrarPlan}/`, { method: "DELETE" }); guardar("cw_plan", null); aviso("Semana borrada."); vistaMenu(); }
      catch (err) { aviso(err.message); }
    }));

    document.getElementById("f-plan").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const sel = [...f.querySelectorAll('[name="comidas"]:checked')].map((x) => x.value);
      if (!sel.length) return aviso("Elige al menos una comida del día.");
      const boton = document.getElementById("p-armar");
      boton.disabled = true; boton.textContent = "Armando…";
      try {
        await api("/planes/", { method: "POST", body: {
          comidas: sel, dificultades: [...f.querySelectorAll('[name="dif"]:checked')].map((x) => x.value),
          presupuesto: document.getElementById("p-pres").value || "0",
          personas: Number(document.getElementById("p-personas").value) || 1,
        } });
        guardar("cw_plan", null);
        aviso("Listo, tu semana está armada.");
        vistaMenu();
      } catch (err) {
        boton.disabled = false; boton.textContent = "Armar mi semana";
        if (err.data?.codigo === "limite_planes") hojaLimite(); else aviso(err.message);
      }
    });
    pintarSemana(plan);
    if (plan) pintarNutricion(plan);
  }

  function historial() {
    const planes = estado.planes || [];
    if (!planes.length) return "";
    const u = estado.usuario, limite = estado.opciones?.planes_gratis || 5;
    const actual = planes.find((p) => String(p.id) === leer("cw_plan")) || planes[0];
    return `<section class="panel pila-s">
      <div class="entre"><h3>Tus semanas</h3>
        <span class="chico suave">${!proActivo() ? `<b class="num">${estado.totalPlanes}</b> guardadas` : u.es_pro ? SELLO_PRO + " sin límite" : `<b class="num">${estado.totalPlanes}/${limite}</b> guardadas · <a href="#pro">guarda más con Pro</a>`}</span></div>
      <div class="semanas">${planes.map((p) => `<div class="semana-item ${p.id === actual.id ? "actual" : ""}">
        <button type="button" class="link" data-ver-plan="${p.id}" ${p.id === actual.id ? 'aria-current="true"' : ""}>${esc(p.nombre || "Semana del " + fechaCorta(p.fecha_inicio))}</button>
        <span class="chico suave num">${p.menu.filter((c) => c.platillo).length} comidas · ${dinero(p.presupuesto)}</span>
        <button type="button" class="link chico" data-borrar-plan="${p.id}">Borrar</button></div>`).join("")}</div>
    </section>`;
  }

  async function pintarNutricion(plan) {
    const cont = document.getElementById("nutricion");
    if (!proActivo()) return;
    if (!estado.usuario.es_pro) {
      cont.innerHTML = invitacionPro("¿Cuántas calorías y proteína trae tu semana?", "Con Pro ves tu plan de nutrición día por día, comparado con tu meta, y consejos para comer mejor sin gastar más.");
      return;
    }
    cont.innerHTML = `<div class="cargando">Sumando calorías…</div>`;
    try {
      const n = await api(`/planes/${plan.id}/nutricion/`);
      const max = Math.max(n.meta_kcal * 1.3, ...n.dias.map((d) => Number(d.kcal)));
      cont.innerHTML = `<section class="panel pila">
        <div class="entre"><div class="pila-s"><span class="etiqueta">${SELLO_PRO} Plan de nutrición · por persona</span><h2>Tu semana en calorías</h2></div>
          <a class="link chico" href="#yo">Meta: ${n.meta_kcal} kcal</a></div>
        <div class="resumen">
          <div class="dato"><span class="etiqueta">Calorías al día</span><b>${Math.round(n.promedio.kcal)}</b></div>
          <div class="dato"><span class="etiqueta">Proteína</span><b>${Math.round(n.promedio.proteina)} g</b></div>
          <div class="dato"><span class="etiqueta">Carbohidratos</span><b>${Math.round(n.promedio.carbohidratos)} g</b></div>
          <div class="dato"><span class="etiqueta">Grasa</span><b>${Math.round(n.promedio.grasa)} g</b></div>
        </div>
        <div class="kcal-dias" role="list">${n.dias.map((d) => `<div class="kcal-dia" role="listitem">
          <span class="chico">${esc(d.nombre_dia.slice(0, 3))}</span>
          <span class="kcal-barra" title="${esc(d.comidas.map((c) => c.platillo + ": " + Math.round(c.kcal) + " kcal").join("\n"))}">
            <i style="width:${(Number(d.kcal) / max) * 100}%" class="${d.pct_meta > 115 ? "alto" : d.pct_meta < 85 ? "bajo" : ""}"></i>
            <s style="left:${(n.meta_kcal / max) * 100}%" aria-hidden="true"></s></span>
          <span class="chico num">${Math.round(d.kcal)} kcal · ${Math.round(d.proteina)} g prot</span></div>`).join("")}</div>
        <ul class="consejos">${n.consejos.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        <p class="chico suave">${esc(n.nota)}</p>
      </section>`;
    } catch (err) { cont.innerHTML = `<p class="chico suave">${esc(err.message)}</p>`; }
  }

  function nombreRestriccion(v) {
    const o = (estado.opciones?.restricciones || []).find((x) => x.valor === v);
    return o ? o.nombre : v;
  }

  function pintarSemana(plan) {
    const cont = document.getElementById("semana");
    if (!plan || !plan.menu.length) {
      cont.innerHTML = `<div class="vacio"><h3>Todavía no hay menú</h3><p>Elige tus comidas arriba y dale a “Armar mi semana”.</p></div>`;
      return;
    }
    const porDia = DIAS.map(() => []);
    plan.menu.forEach((c) => porDia[c.dia].push(c));
    cont.innerHTML = `<div class="semana">${porDia.map((comidas, i) => `
      <section class="dia" aria-label="${DIAS[i]}">
        <div class="dia__nombre">${DIAS[i]}</div>
        ${comidas.map((c) => `
          <article class="comida">
            <span class="comida__tipo">${TIPOS[c.tipo_comida]}</span>
            ${c.platillo ? `<button class="comida__nombre" type="button" data-receta="${c.platillo.id}">${esc(c.platillo.nombre)}</button>` : `<span class="suave">Sin platillo</span>`}
            <div class="comida__pie">
              <span class="fila">${c.platillo ? pill(c.platillo.dificultad) + `<span class="chico suave num">${c.platillo.tiempo_minutos} min</span>` : ""}</span>
              <button class="link chico" type="button" data-cambiar="${c.dia}|${c.tipo_comida}">Cambiar</button>
            </div>
          </article>`).join("")}
      </section>`).join("")}</div>`;
    cont.querySelectorAll("[data-receta]").forEach((b) => b.addEventListener("click", () => verReceta(b.dataset.receta, plan.personas)));
    cont.querySelectorAll("[data-cambiar]").forEach((b) => b.addEventListener("click", () => {
      const [dia, tipo] = b.dataset.cambiar.split("|");
      elegirPlatillo(plan, Number(dia), tipo);
    }));
  }

  async function verReceta(id, personas) {
    abrirHoja(`<div class="cargando">Cargando receta…</div>`);
    try {
      const p = await api(`/platillos/${id}/`);
      const factor = (personas || p.porciones) / p.porciones;
      abrirHoja(`
        ${p.imagen_url ? `<img class="receta-img" src="${esc(p.imagen_url)}" alt="">` : ""}
        <div class="pila-s">
          <span class="etiqueta">${esc(TIPOS[p.tipo_comida])} · ${esc(p.estilo)}</span>
          <h2>${esc(p.nombre)}</h2>
          <div class="fila">${pill(p.dificultad)}<span class="chico suave num">${p.tiempo_minutos} min</span>
            ${p.contiene.length ? `<span class="chico suave">Contiene: ${esc(p.contiene.map(nombreRestriccion).join(", "))}</span>` : ""}</div>
          ${p.descripcion ? `<p class="suave">${esc(p.descripcion)}</p>` : ""}
        </div>
        <div class="pila-s">
          <h3>Ingredientes <span class="chico suave">(para ${personas || p.porciones} ${(personas || p.porciones) === 1 ? "persona" : "personas"})</span></h3>
          <ul class="ingredientes">${p.ingredientes.map((i) => `<li><span>${esc(i.nombre)}${i.es_basico ? '<span class="basico">básico</span>' : ""}</span><span class="num">${esc(cantidad(i.cantidad * factor, i.unidad))}</span></li>`).join("")}</ul>
        </div>
        <div class="pila-s"><h3>Cómo se hace</h3><p class="pasos">${esc(p.pasos)}</p></div>`);
    } catch (err) { abrirHoja(`<p>${esc(err.message)}</p>`); }
  }

  async function elegirPlatillo(plan, dia, tipo) {
    let dif = "";
    const pintar = async () => {
      abrirHoja(`<div class="cargando">Buscando platillos…</div>`);
      const lista = await todos(`/platillos/?tipo_comida=${tipo}&para_mi=1${dif ? "&dificultad=" + dif : ""}`);
      abrirHoja(`
        <div class="pila-s"><span class="etiqueta">${DIAS[dia]} · ${TIPOS[tipo]}</span><h2>Elige otro platillo</h2></div>
        <div class="segmento" role="group" aria-label="Dificultad">
          ${[["", "Todos"], ...Object.entries(DIF)].map(([v, n]) => `<button type="button" data-dif="${v}" aria-pressed="${dif === v}">${n}</button>`).join("")}
        </div>
        <div class="opciones">${lista.length ? lista.map((p) => `
          <button class="opcion" type="button" data-id="${p.id}">
            <span class="pila-s" style="gap:4px"><b>${esc(p.nombre)}</b><span class="chico suave">${esc(p.estilo)} · <span class="num">${p.tiempo_minutos} min</span></span></span>
            ${pill(p.dificultad)}
          </button>`).join("") : `<p class="suave">No hay platillos con esos filtros.</p>`}</div>`);
      document.querySelectorAll("#hoja [data-dif]").forEach((b) => b.addEventListener("click", () => { dif = b.dataset.dif; pintar(); }));
      document.querySelectorAll("#hoja [data-id]").forEach((b) => b.addEventListener("click", async () => {
        try {
          const nuevo = await api(`/planes/${plan.id}/cambiar-platillo/`, { method: "POST", body: { dia, tipo_comida: tipo, platillo_id: Number(b.dataset.id) } });
          hoja.close(); pintarSemana(nuevo); aviso("Platillo cambiado.");
        } catch (err) { aviso(err.message); }
      }));
    };
    pintar();
  }

  // ------------------------------------------------------------ alacena
  function nivelDe(item, ing) {
    if (item.fraccion) return FRACCION[item.fraccion] || 0;
    return ing ? Math.min(1, Number(item.cantidad_base) / Number(ing.tamano_paquete)) : 1;
  }
  const frascoSVG = (n) => `<span class="nivel" aria-hidden="true"><i style="height:${Math.round(n * 100)}%"></i></span>`;

  async function vistaAlacena() {
    cargando("Abriendo la alacena…");
    await cargarBase();
    const [items, ingredientes] = await Promise.all([api("/alacena/"), cargarIngredientes()]);
    const porId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));
    const tengo = new Set(items.map((i) => i.ingrediente_id));
    const basicosFaltan = ingredientes.filter((i) => i.es_basico && !tengo.has(i.id));
    vista.innerHTML = `
      <div class="pila">
        <div class="cabeza">
          <span class="etiqueta">Lo que ya tienes</span>
          <h1>Tu alacena</h1>
          <p>Anota lo que hay en casa para no comprarlo dos veces. Puedes poner la cantidad exacta o “más o menos”: media botella, un cuarto de bolsa.</p>
        </div>
        <form id="f-alacena" class="panel pila" novalidate>
          <h2>Agregar algo</h2>
          <label class="campo">¿Qué tienes?
            <input id="a-ing" type="search" list="a-lista" placeholder="Arroz, aceite, huevo…" autocomplete="off"></label>
          <datalist id="a-lista">${ingredientes.map((i) => `<option value="${esc(i.nombre)}"></option>`).join("")}</datalist>
          <div class="segmento" role="group" aria-label="Cómo medir">
            <button type="button" data-medida="aprox" aria-pressed="true">Más o menos</button>
            <button type="button" data-medida="exacta" aria-pressed="false">Cantidad exacta</button>
          </div>
          <div id="a-aprox" class="pila-s">
            <span class="etiqueta" id="a-aprox-txt">¿Cuánto le queda al paquete?</span>
            <div class="fracciones" role="radiogroup" aria-labelledby="a-aprox-txt">
              ${estado.opciones.fracciones.map((f, i) => `<label><input type="radio" name="fraccion" value="${f.valor}" ${f.valor === "mitad" ? "checked" : ""}>${frascoSVG(FRACCION[f.valor])}<span>${esc(f.nombre)}</span></label>`).join("")}
            </div>
            <label class="campo" style="max-width:220px">¿De cuántos paquetes?
              <input id="a-paquetes" type="number" min="1" step="1" value="1" inputmode="numeric"></label>
          </div>
          <div id="a-exacta" class="rejilla-2" hidden>
            <label class="campo">Cantidad <input id="a-cant" type="number" min="0" step="any" inputmode="decimal" placeholder="1"></label>
            <label class="campo">Unidad <select id="a-unidad"></select></label>
          </div>
          <div><button class="btn" id="a-guardar" type="submit">Guardar en la alacena</button></div>
        </form>
        ${basicosFaltan.length ? `
          <div class="panel panel--plano pila-s">
            <h3>¿Tienes estos básicos?</h3>
            <p class="chico suave">Las recetas llevan sal, aceite y especias. Si ya los tienes, tócalos para que no salgan en tu lista.</p>
            <div class="chips">${basicosFaltan.map((i) => `<button type="button" class="btn btn--sec btn--chico" data-basico="${i.id}">+ ${esc(i.nombre)}</button>`).join("")}</div>
          </div>` : ""}
        <section class="pila-s">
          <div class="entre"><h2>En casa</h2><span class="chico suave">${items.length} ${items.length === 1 ? "cosa" : "cosas"}</span></div>
          ${items.length ? `<div class="frascos">${items.map((it) => `
            <article class="frasco">
              ${frascoSVG(nivelDe(it, porId[it.ingrediente_id]))}
              <div class="pila-s" style="gap:2px;min-width:0"><span class="frasco__nombre">${esc(it.ingrediente)}</span><span class="chico suave">${esc(it.descripcion)}</span></div>
              <button class="icono-btn" type="button" data-quitar="${it.id}" aria-label="Quitar ${esc(it.ingrediente)}">×</button>
            </article>`).join("")}</div>` : `<div class="vacio"><p>Tu alacena está vacía. Agrega lo que tengas y te lo descontamos de la lista.</p></div>`}
        </section>
      </div>`;

    let medida = "aprox";
    const unidadesPara = (ing) => {
      const base = ing ? ing.unidad_base : "g";
      const mapa = { g: ["g", "kg"], ml: ["ml", "l"], pieza: ["pieza"] }[base];
      const nombres = Object.fromEntries(estado.opciones.unidades.map((u) => [u.valor, u.nombre]));
      return [...mapa, "paquete"].map((u) => `<option value="${u}">${esc(u === "paquete" && ing ? ing.nombre_paquete + "s" : nombres[u])}</option>`).join("");
    };
    const buscarIng = () => ingredientes.find((i) => i.nombre.toLowerCase() === document.getElementById("a-ing").value.trim().toLowerCase());
    const sel = document.getElementById("a-unidad");
    sel.innerHTML = unidadesPara(null);
    document.getElementById("a-ing").addEventListener("change", () => { sel.innerHTML = unidadesPara(buscarIng()); });
    vista.querySelectorAll("[data-medida]").forEach((b) => b.addEventListener("click", () => {
      medida = b.dataset.medida;
      vista.querySelectorAll("[data-medida]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      document.getElementById("a-aprox").hidden = medida !== "aprox";
      document.getElementById("a-exacta").hidden = medida !== "exacta";
    }));

    const guardarItem = async (ingId, cuerpo) => {
      const existente = items.find((i) => i.ingrediente_id === ingId);
      if (existente) await api(`/alacena/${existente.id}/`, { method: "PATCH", body: cuerpo });
      else await api("/alacena/", { method: "POST", body: { ingrediente_id: ingId, ...cuerpo } });
    };
    document.getElementById("f-alacena").addEventListener("submit", async (e) => {
      e.preventDefault();
      const ing = buscarIng();
      if (!ing) return aviso("Elige un ingrediente de la lista.");
      let cuerpo;
      if (medida === "aprox") {
        cuerpo = { fraccion: vista.querySelector('[name="fraccion"]:checked').value, unidad: "paquete", cantidad: document.getElementById("a-paquetes").value || "1" };
      } else {
        const cant = document.getElementById("a-cant").value;
        if (!cant) return aviso("Escribe la cantidad.");
        cuerpo = { fraccion: "", cantidad: cant, unidad: sel.value };
      }
      try { await guardarItem(ing.id, cuerpo); aviso(`${ing.nombre} guardado.`); vistaAlacena(); } catch (err) { aviso(err.message); }
    });
    vista.querySelectorAll("[data-basico]").forEach((b) => b.addEventListener("click", async () => {
      try { await guardarItem(Number(b.dataset.basico), { fraccion: "lleno", unidad: "paquete", cantidad: "1" }); vistaAlacena(); } catch (err) { aviso(err.message); }
    }));
    vista.querySelectorAll("[data-quitar]").forEach((b) => b.addEventListener("click", async () => {
      try { await api(`/alacena/${b.dataset.quitar}/`, { method: "DELETE" }); aviso("Quitado de la alacena."); vistaAlacena(); } catch (err) { aviso(err.message); }
    }));
  }

  // ------------------------------------------------------------ lista de compras
  async function vistaLista() {
    cargando("Comparando precios…");
    await cargarBase();
    const plan = await ultimoPlan();
    if (!plan) {
      vista.innerHTML = `<div class="pila"><div class="cabeza"><h1>Tu lista de compras</h1></div>
        <div class="vacio"><p>Primero arma tu semana y aquí te decimos qué comprar y dónde.</p><a class="btn" href="#menu">Armar mi semana</a></div></div>`;
      return;
    }
    let modo = estado.usuario.modo_compra || "varios";
    let superId = null;

    const pintar = async () => {
      const cont = document.getElementById("l-cuerpo");
      if (cont) cont.innerHTML = `<div class="cargando">Comparando precios…</div>`;
      const q = `?modo=${modo}${modo === "un_super" && superId ? "&supermercado=" + superId : ""}`;
      let l;
      try { l = await api(`/planes/${plan.id}/lista-compras/${q}`); } catch (err) { aviso(err.message); return; }
      const pasado = !l.dentro_del_presupuesto && Number(l.presupuesto) > 0;
      const pct = Number(l.presupuesto) > 0 ? Math.min(100, (Number(l.total) / Number(l.presupuesto)) * 100) : 0;
      const grupos = {};
      l.comprar.forEach((i) => { (grupos[i.comprar_en.supermercado] ||= []).push(i); });
      const infoTienda = Object.fromEntries(l.por_supermercado.map((t) => [t.supermercado, t]));

      vista.innerHTML = `
        <div class="pila">
          <div class="cabeza">
            <span class="etiqueta">Para tu semana · ${l.comprar.length} productos</span>
            <h1>Tu lista de compras</h1>
            <p>Lo que piden tus platillos, menos lo que ya tienes en la alacena, con el súper donde conviene comprar.</p>
          </div>
          <div class="panel pila">
            <div class="entre">
              <div class="segmento" role="group" aria-label="Cómo quieres comprar">
                <button type="button" data-modo="varios" aria-pressed="${modo === "varios"}">Lo más barato en varios súper</button>
                <button type="button" data-modo="un_super" aria-pressed="${modo === "un_super"}">Todo en un solo súper</button>
              </div>
              ${modo === "un_super" && l.todo_en_un_solo_supermercado.length ? `
                <label class="campo" style="min-width:min(100%,260px)">Súper
                  <select id="l-super">${l.todo_en_un_solo_supermercado.map((t) => `<option value="${t.supermercado_id}" ${t.supermercado === l.supermercado_elegido ? "selected" : ""}>${esc(t.supermercado)} · ${dinero(t.total)}${t.distancia_km != null ? " · " + t.distancia_km + " km" : ""}</option>`).join("")}</select>
                </label>` : ""}
            </div>
            <div class="resumen">
              <div class="dato"><span class="etiqueta">Total</span><b>${dinero(l.total)}</b></div>
              <div class="dato"><span class="etiqueta">Presupuesto</span><b>${dinero(l.presupuesto)}</b></div>
              <div class="dato"><span class="etiqueta">${Number(l.restante) >= 0 ? "Te sobra" : "Te pasas por"}</span><b style="color:${Number(l.restante) >= 0 ? "var(--ok)" : "var(--jamaica)"}">${dinero(Math.abs(l.restante))}</b></div>
            </div>
            ${Number(l.presupuesto) > 0 ? `<div class="barra-pres ${pasado ? "pasado" : ""}" role="img" aria-label="Llevas ${Math.round(pct)}% del presupuesto"><i style="width:${pct}%"></i></div>` : ""}
            ${pasado ? `<p class="alerta">Te pasas del presupuesto. Prueba “Armar otra semana” con platillos fáciles, o agrega a tu alacena lo que ya tengas.</p>` : ""}
            ${l.ubicacion.aviso ? `<p class="alerta">${esc(l.ubicacion.aviso)}</p>` : ""}
            ${!l.ubicacion.usa_ubicacion ? `<p class="nota">Comparamos todas las cadenas. <a href="#yo">Agrega tu ubicación</a> para ver solo los súper que te quedan cerca.</p>` : `<p class="chico suave">Súper a menos de ${l.ubicacion.radio_km} km de ti.</p>`}
          </div>

          <div class="tickets">${Object.entries(grupos).map(([tienda, lineas]) => {
            const t = infoTienda[tienda] || {};
            const subtotal = lineas.reduce((s, i) => s + Number(i.comprar_en.costo), 0);
            return `<article class="ticket">
              <div class="ticket__tienda"><span class="ticket__punto" style="background:${esc(t.color || "#888")}"></span>${esc(tienda)}</div>
              <div class="ticket__meta">
                ${t.distancia_km != null ? `<span>A ${t.distancia_km} km · ${esc(t.sucursal.nombre)}</span>${t.sucursal.direccion ? `<span>${esc(t.sucursal.direccion)}</span>` : ""}
                  <a href="https://www.google.com/maps/search/?api=1&query=${t.sucursal.lat},${t.sucursal.lng}" target="_blank" rel="noopener">Cómo llegar</a>` : `<span>${lineas.length} productos</span>`}
              </div>
              <hr>
              ${lineas.map((i) => `<div class="ticket__linea">
                  <span>${esc(i.comprar_en.producto)}${i.es_basico ? '<span class="basico">básico</span>' : ""}</span>
                  <span>${dinero(i.comprar_en.costo)}</span>
                  <small>${i.comprar_en.paquetes} × ${dinero(i.comprar_en.precio_unitario)} · te faltan ${esc(cantidad(i.falta, i.unidad))}${i.en_otro_super ? " · no lo hay en " + esc(l.supermercado_elegido) : ""}${i.es_basico ? ` · <button class="link" type="button" data-tengo="${i.ingrediente_id}">ya tengo</button>` : ""}</small>
                  <small class="comprar-links">${i.comprar_en.url_compra ? `<a href="${esc(i.comprar_en.url_compra)}" target="_blank" rel="noopener sponsored">Pedir en línea ↗</a>` : ""}${i.url_amazon ? `<a href="${esc(i.url_amazon)}" target="_blank" rel="noopener sponsored">Amazon ↗</a>` : ""}</small>
                </div>`).join("")}
              <hr>
              <div class="ticket__total"><span>TOTAL</span><span>${dinero(subtotal)}</span></div>
            </article>`;
          }).join("")}</div>

          ${l.todo_en_un_solo_supermercado.length > 1 ? `
          <section class="panel pila-s">
            <h2>¿Y si compras todo en un solo lugar?</h2>
            <div class="tabla-wrap"><table class="tabla">
              <thead><tr><th>Súper</th><th class="num">Distancia</th><th class="num">Productos</th><th class="num">Total</th></tr></thead>
              <tbody>${l.todo_en_un_solo_supermercado.map((t, n) => `<tr class="${n === 0 && t.tiene_todo ? "ganador" : ""}">
                <td><span class="fila" style="gap:8px"><span class="ticket__punto" style="background:${esc(t.color)}"></span>${esc(t.supermercado)}${t.requiere_membresia ? ' <span class="basico">membresía</span>' : ""}</span></td>
                <td class="num">${t.distancia_km != null ? t.distancia_km + " km" : "—"}</td>
                <td class="num">${t.productos_disponibles}/${l.comprar.length}</td>
                <td class="num">${dinero(t.total)}</td></tr>`).join("")}</tbody>
            </table></div>
          </section>` : ""}

          ${l.ya_tienes_en_alacena.length ? `<section class="pila-s"><h3>Ya lo tienes en casa</h3>
            <div class="chips">${l.ya_tienes_en_alacena.map((i) => `<span class="pill pill--facil">${esc(i.ingrediente)}</span>`).join("")}</div></section>` : ""}
          ${l.sin_precio.length ? `<section class="pila-s"><h3>Sin precio todavía</h3><p class="chico suave">No los encontramos en los súper que tienes cerca. Búscalos en el mercado o la tiendita.</p>
            <div class="chips">${l.sin_precio.map((i) => `<span class="pill pill--intermedio">${esc(i.ingrediente)} · ${esc(cantidad(i.falta, i.unidad))}</span>`).join("")}</div></section>` : ""}
          <div id="ofertas"></div>
          <p class="chico suave">Algunos links de compra son de afiliado: si compras ahí, Foráneo en apuros gana una pequeña comisión y a ti no te cuesta más.</p>
          <div id="l-cuerpo"></div>
        </div>`;
      pintarOfertas();

      vista.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => { modo = b.dataset.modo; superId = null; pintar(); }));
      const s = document.getElementById("l-super");
      if (s) s.addEventListener("change", () => { superId = s.value; pintar(); });
      vista.querySelectorAll("[data-tengo]").forEach((b) => b.addEventListener("click", async () => {
        try { await api("/alacena/", { method: "POST", body: { ingrediente_id: Number(b.dataset.tengo), fraccion: "lleno", unidad: "paquete", cantidad: "1" } }); aviso("Anotado en tu alacena."); pintar(); }
        catch (err) { aviso(err.message); }
      }));
    };
    pintar();
  }

  async function pintarOfertas() {
    const cont = document.getElementById("ofertas");
    if (!cont || !proActivo()) return;
    if (!estado.usuario.es_pro) {
      cont.innerHTML = invitacionPro("Ofertas en los súper que tienes cerca", "Con Pro te avisamos qué está en oferta esta semana cerca de ti, empezando por lo que vas a cocinar.");
      return;
    }
    try {
      const ofertas = await api("/ofertas/");
      cont.innerHTML = ofertas.length ? `<section class="pila-s">
        <div class="entre"><h2>Ofertas cerca ${SELLO_PRO}</h2><span class="chico suave">Te mandamos las mejores por correo cada semana</span></div>
        <div class="ofertas">${ofertas.slice(0, 9).map((o) => `<article class="oferta">
          <span class="oferta__pct num">-${o.ahorro_pct}%</span>
          <b>${esc(o.producto)}</b>
          <span class="fila" style="gap:8px"><span class="ticket__punto" style="background:${esc(o.color)}"></span><span class="chico">${esc(o.supermercado)}${o.distancia_km != null ? " · " + o.distancia_km + " km" : ""}</span></span>
          <span class="num"><b>${dinero(o.precio)}</b> <s class="suave">${dinero(o.precio_regular)}</s></span>
          ${o.para_tu_semana ? `<span class="pill pill--facil">Lo usas esta semana</span>` : ""}
        </article>`).join("")}</div></section>` : `<p class="chico suave">No hay ofertas cerca de ti esta semana.</p>`;
    } catch (err) { cont.innerHTML = ""; }
  }

  async function vistaPro() {
    cargando("Cargando…");
    await cargarBase();
    if (!proActivo()) { location.hash = "#menu"; return; }
    const [p, u] = await Promise.all([api("/pro/"), api("/auth/yo/")]);
    estado.usuario = u;
    const hasta = p.pro_hasta ? new Date(p.pro_hasta).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "";
    const ahorroAnual = p.precios.mensual * 12 - p.precios.anual;
    vista.innerHTML = `
      <div class="pila">
        <div class="cabeza">
          <span class="etiqueta">Foráneo Pro</span>
          <h1>Menos de lo que cuesta un taco <span class="resalta">al mes</span></h1>
          <p>Foráneo en apuros gratis te arma la semana y la lista. Pro te ayuda a ahorrar más y comer mejor, y con lo que pagas sostienes la app para todos los foráneos.</p>
        </div>
        ${p.es_pro ? `<div class="nota pila-s"><b>${SELLO_PRO} Ya eres Pro hasta el ${esc(hasta)}.</b> Gracias por apoyar a los foráneos.
          ${p.puede_administrar ? `<div><button class="btn btn--borde btn--chico" type="button" id="pro-portal">Administrar mi suscripción</button></div>` : ""}</div>` : ""}
        <div class="precios">
          <article class="precio-card">
            <span class="etiqueta">Mensual</span>
            <div class="precio-card__monto"><b class="num">$${p.precios.mensual}</b><span>MXN / mes</span></div>
            <p class="chico suave">Con tarjeta. Cancelas cuando quieras.</p>
            <button class="btn btn--borde" type="button" data-plan="mensual">Pagar $${p.precios.mensual} al mes</button>
          </article>
          <article class="precio-card precio-card--top">
            <span class="precio-card__cinta">Apoya a los foráneos</span>
            <span class="etiqueta">Anual</span>
            <div class="precio-card__monto"><b class="num">$${p.precios.anual}</b><span>MXN / año</span></div>
            <p class="chico suave">Te ahorras $${ahorroAnual} contra pagar mes a mes. Con tarjeta o en efectivo en OXXO.</p>
            <button class="btn" type="button" data-plan="anual">Pagar $${p.precios.anual} al año</button>
          </article>
        </div>
        <section class="panel pila-s">
          <h2>Qué incluye</h2>
          <ul class="beneficios">
            <li><b>Semanas sin límite.</b> Gratis guardas ${p.planes_gratis}; llevas ${p.planes_guardados}.</li>
            <li><b>Ofertas cerca de ti.</b> Las vemos en los súper de tu radio y te las mandamos por correo cada semana.</li>
            <li><b>Plan de nutrición.</b> Calorías, proteína, carbohidratos y grasa de cada día, contra tu meta.</li>
          </ul>
          <p class="chico suave">Lo gratis se queda gratis: menú, alacena, lista de compras y comparar precios.</p>
        </section>
        ${!p.pagos_configurados ? `<p class="alerta">Los pagos todavía no están activos en este servidor. Falta poner las claves de Stripe (mira el README).</p>` : ""}
      </div>`;
    vista.querySelectorAll("[data-plan]").forEach((b) => b.addEventListener("click", async () => {
      b.disabled = true;
      try { const r = await api("/pro/checkout/", { method: "POST", body: { plan: b.dataset.plan } }); estado.usuario = null; location.href = r.url; }
      catch (err) { aviso(err.message); b.disabled = false; }
    }));
    document.getElementById("pro-portal")?.addEventListener("click", async () => {
      try { location.href = (await api("/pro/portal/", { method: "POST" })).url; } catch (err) { aviso(err.message); }
    });
  }

  // ------------------------------------------------------------ yo / preferencias
  async function vistaYo() {
    cargando("Cargando tu perfil…");
    estado.usuario = await api("/auth/yo/");
    await cargarBase();
    const ingredientes = await cargarIngredientes();
    const u = estado.usuario;
    const porNombre = (n) => ingredientes.find((i) => i.nombre === n);
    const ubic = { lat: u.lat, lng: u.lng };
    const excluidos = new Set(u.ingredientes_excluidos);
    const cambio = (orig) => (u.sustituciones.find((s) => s.original === orig) || {}).reemplazo || "";
    const membresia = estado.supers.filter((s) => s.requiere_membresia);

    vista.innerHTML = `
      <div class="pila">
        <div class="cabeza">
          <span class="etiqueta">${esc(u.email)}</span>
          <h1>Cómo compras y qué comes</h1>
          <p>Con esto armamos menús que sí te laten y buscamos los súper que te quedan cerca.</p>
        </div>
        <form id="f-yo" class="pila" novalidate>
          <div class="rejilla-2">
            <section class="panel pila-s">
              <h2>Tu bolsillo</h2>
              <label class="campo">Presupuesto por semana (MXN)<input id="y-pres" type="number" min="0" step="50" inputmode="decimal" value="${esc(u.presupuesto_semanal)}"></label>
              <label class="campo">¿Para cuántas personas cocinas?<input id="y-personas" type="number" min="1" max="12" inputmode="numeric" value="${esc(u.personas)}"></label>
              <span class="etiqueta" style="margin-top:8px">¿Cómo prefieres comprar?</span>
              <div class="segmento" role="group" aria-label="Cómo prefieres comprar">
                <button type="button" data-compra="varios" aria-pressed="${u.modo_compra === "varios"}">Lo más barato en varios</button>
                <button type="button" data-compra="un_super" aria-pressed="${u.modo_compra === "un_super"}">Todo en un súper</button>
              </div>
              ${membresia.length ? `<span class="etiqueta" style="margin-top:8px">¿Tienes membresía?</span>
                <div class="chips">${membresia.map((s) => `<label class="chip"><input type="checkbox" name="membresia" value="${s.id}" ${u.membresias.includes(s.id) ? "checked" : ""}><span>${esc(s.nombre)}</span></label>`).join("")}</div>
                <p class="chico suave">Sin membresía no te mandamos a comprar ahí.</p>` : ""}
            </section>

            <section class="panel pila-s">
              <h2>¿Dónde estás?</h2>
              <p class="chico suave" id="y-ubic-txt">${ubic.lat != null ? "Ubicación guardada." : "Todavía no tenemos tu ubicación."}</p>
              <div class="fila"><button class="btn btn--sec" type="button" id="y-gps">Usar mi ubicación</button></div>
              <div class="fila" style="flex-wrap:nowrap">
                <input id="y-buscar" type="search" placeholder="O escribe tu colonia y ciudad" aria-label="Buscar colonia o ciudad">
                <button class="btn btn--borde" type="button" id="y-buscar-btn">Buscar</button>
              </div>
              <div id="y-resultados" class="opciones" style="max-height:200px"></div>
              <div class="radio">
                <label class="etiqueta" for="y-radio">Buscar súper a la redonda</label>
                <div class="entre"><input id="y-radio" type="range" min="1" max="30" step="0.5" value="${esc(u.radio_km)}"><output id="y-radio-out" class="num" for="y-radio">${esc(u.radio_km)} km</output></div>
              </div>
              <div id="y-supers" class="super-lista"></div>
            </section>
          </div>

          <section class="panel pila-s" ${proActivo() ? "" : "hidden"}>
            <div class="entre"><h2>Tu meta</h2>${u.es_pro ? "" : `<a class="chico" href="#pro">${SELLO_PRO} para ver tu nutrición</a>`}</div>
            <div class="rejilla-2">
              <label class="campo">Calorías al día<input id="y-kcal" type="number" min="1000" max="5000" step="50" inputmode="numeric" value="${esc(u.meta_kcal)}"></label>
              <div class="pila-s"><span class="etiqueta">Quiero</span>
                <div class="chips">${[["bajar", "Bajar de peso"], ["mantener", "Mantenerme"], ["subir", "Subir masa"]].map(([v, n]) => `<label class="chip"><input type="radio" name="objetivo" value="${v}" ${u.objetivo === v ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></div>
            </div>
          </section>

          <section class="panel pila-s">
            <h2>Alergias y dieta</h2>
            <p class="chico suave">No te sugerimos platillos que tengan esto.</p>
            <div class="chips">${estado.opciones.restricciones.map((r) => `<label class="chip chip--alerta"><input type="checkbox" name="restr" value="${r.valor}" ${u.restricciones.includes(r.valor) ? "checked" : ""}><span>${esc(r.nombre)}</span></label>`).join("")}</div>
          </section>

          <div class="rejilla-2">
            <section class="panel pila-s">
              <h2>Lo que no te gusta</h2>
              <div class="fila" style="flex-wrap:nowrap">
                <input id="y-excluir" type="search" list="y-lista" placeholder="Cebolla, champiñones…" aria-label="Ingrediente que no comes" autocomplete="off">
                <button class="btn btn--borde" type="button" id="y-excluir-btn">Agregar</button>
              </div>
              <datalist id="y-lista">${ingredientes.map((i) => `<option value="${esc(i.nombre)}"></option>`).join("")}</datalist>
              <div class="chips" id="y-excluidos"></div>
            </section>
            <section class="panel pila-s">
              <h2>Tus cambios</h2>
              <p class="chico suave">Cambiamos el ingrediente en todas las recetas y en tu lista.</p>
              <label class="chip"><input type="checkbox" id="y-oliva" ${cambio("Aceite") === "Aceite de oliva" ? "checked" : ""}><span>Cocino con aceite de oliva</span></label>
              <span class="etiqueta" style="margin-top:6px">Leche</span>
              <div class="chips">
                ${[["", "Normal"], ["Leche deslactosada", "Deslactosada"], ["Leche de almendra", "De almendra"]].map(([v, n]) => `<label class="chip"><input type="radio" name="leche" value="${esc(v)}" ${cambio("Leche") === v ? "checked" : ""}><span>${n}</span></label>`).join("")}
              </div>
            </section>
          </div>

          <div class="fila">
            <button class="btn btn--grande" id="y-guardar" type="submit">Guardar</button>
            <button class="btn btn--borde" type="button" id="y-salir">Cerrar sesión</button>
          </div>
        </form>
      </div>`;

    let modoCompra = u.modo_compra;
    vista.querySelectorAll("[data-compra]").forEach((b) => b.addEventListener("click", () => {
      modoCompra = b.dataset.compra;
      vista.querySelectorAll("[data-compra]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));

    const pintarExcluidos = () => {
      document.getElementById("y-excluidos").innerHTML = [...excluidos].map((id) => {
        const ing = ingredientes.find((i) => i.id === id);
        return ing ? `<button type="button" class="btn btn--sec btn--chico" data-sacar="${id}" aria-label="Quitar ${esc(ing.nombre)}">${esc(ing.nombre)} ×</button>` : "";
      }).join("") || `<span class="chico suave">Nada por ahora.</span>`;
      document.querySelectorAll("[data-sacar]").forEach((b) => b.addEventListener("click", () => { excluidos.delete(Number(b.dataset.sacar)); pintarExcluidos(); }));
    };
    pintarExcluidos();
    document.getElementById("y-excluir-btn").addEventListener("click", () => {
      const inp = document.getElementById("y-excluir");
      const ing = ingredientes.find((i) => i.nombre.toLowerCase() === inp.value.trim().toLowerCase());
      if (!ing) return aviso("Elige un ingrediente de la lista.");
      excluidos.add(ing.id); inp.value = ""; pintarExcluidos();
    });

    const radio = document.getElementById("y-radio");
    const salida = document.getElementById("y-radio-out");
    let espera;
    radio.addEventListener("input", () => {
      salida.textContent = radio.value + " km";
      clearTimeout(espera); espera = setTimeout(verCercanos, 600);
    });

    async function verCercanos() {
      const cont = document.getElementById("y-supers");
      if (ubic.lat == null) { cont.innerHTML = ""; return; }
      cont.innerHTML = `<div class="cargando">Buscando súper cerca…</div>`;
      try {
        const r = await api(`/supermercados/cercanos/?lat=${ubic.lat}&lng=${ubic.lng}&radio_km=${radio.value}`);
        const cerca = r.supermercados.filter((s) => s.cerca);
        cont.innerHTML = `<span class="etiqueta">${cerca.length ? cerca.length + " cadenas a menos de " + r.radio_km + " km" : "Ningún súper a menos de " + r.radio_km + " km"}</span>
          ${!r.mapa_consultado ? `<p class="chico suave">No pudimos consultar el mapa ahora; mostramos las sucursales que ya conocemos.</p>` : ""}
          ${r.supermercados.map((s) => `<div class="super-item ${s.cerca ? "" : "lejos"}">
            <span class="ticket__punto" style="background:${esc(s.color)}"></span>
            <span class="pila-s" style="gap:0;min-width:0"><b>${esc(s.nombre)}</b>${s.sucursal ? `<span class="chico suave">${esc(s.sucursal.nombre)}</span>` : ""}</span>
            <span class="chico num">${s.cerca ? s.distancia_km + " km" : "lejos"}${s.requiere_membresia && !s.tienes_membresia ? " · sin membresía" : ""}</span>
          </div>`).join("")}`;
      } catch (err) { cont.innerHTML = `<p class="chico suave">${esc(err.message)}</p>`; }
    }
    const ponerUbicacion = (lat, lng, texto) => {
      ubic.lat = Math.round(lat * 1e6) / 1e6; ubic.lng = Math.round(lng * 1e6) / 1e6;
      document.getElementById("y-ubic-txt").textContent = texto;
      verCercanos();
    };
    document.getElementById("y-gps").addEventListener("click", () => {
      if (!navigator.geolocation) return aviso("Tu navegador no comparte ubicación. Escribe tu colonia.");
      aviso("Pidiendo tu ubicación…");
      navigator.geolocation.getCurrentPosition(
        (p) => ponerUbicacion(p.coords.latitude, p.coords.longitude, "Usando tu ubicación actual. Dale a Guardar."),
        () => aviso("No nos dejaste ver tu ubicación. Escribe tu colonia y ciudad."),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
    });
    document.getElementById("y-buscar-btn").addEventListener("click", async () => {
      const q = document.getElementById("y-buscar").value.trim();
      const cont = document.getElementById("y-resultados");
      if (q.length < 3) return aviso("Escribe al menos 3 letras.");
      cont.innerHTML = `<div class="cargando">Buscando…</div>`;
      try {
        const res = await api(`/ubicacion/buscar/?q=${encodeURIComponent(q)}`);
        cont.innerHTML = res.length ? res.map((r, i) => `<button class="opcion" type="button" data-i="${i}"><span class="chico">${esc(r.nombre)}</span></button>`).join("") : `<p class="chico suave">No encontramos esa dirección.</p>`;
        cont.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
          const r = res[Number(b.dataset.i)];
          cont.innerHTML = "";
          ponerUbicacion(r.lat, r.lng, r.nombre.split(",").slice(0, 3).join(","));
        }));
      } catch (err) { cont.innerHTML = `<p class="chico suave">${esc(err.message)}</p>`; }
    });
    verCercanos();

    document.getElementById("y-salir").addEventListener("click", salir);
    document.getElementById("f-yo").addEventListener("submit", async (e) => {
      e.preventDefault();
      const cambios = [];
      const aceite = porNombre("Aceite"), oliva = porNombre("Aceite de oliva"), leche = porNombre("Leche");
      if (document.getElementById("y-oliva").checked && aceite && oliva) cambios.push({ original_id: aceite.id, reemplazo_id: oliva.id });
      const otraLeche = porNombre(vista.querySelector('[name="leche"]:checked')?.value || "");
      if (otraLeche && leche) cambios.push({ original_id: leche.id, reemplazo_id: otraLeche.id });
      const boton = document.getElementById("y-guardar");
      boton.disabled = true;
      try {
        estado.usuario = await api("/auth/yo/", { method: "PATCH", body: {
          presupuesto_semanal: document.getElementById("y-pres").value || "0",
          personas: Number(document.getElementById("y-personas").value) || 1,
          modo_compra: modoCompra, radio_km: radio.value, lat: ubic.lat, lng: ubic.lng,
          membresias: [...vista.querySelectorAll('[name="membresia"]:checked')].map((x) => Number(x.value)),
          restricciones: [...vista.querySelectorAll('[name="restr"]:checked')].map((x) => x.value),
          ingredientes_excluidos: [...excluidos], cambios,
          meta_kcal: Number(document.getElementById("y-kcal").value) || 2000,
          objetivo: vista.querySelector('[name="objetivo"]:checked')?.value || "mantener",
        } });
        aviso("Guardado. Ahora arma tu semana.");
        location.hash = "#menu";
      } catch (err) { aviso(err.message); } finally { boton.disabled = false; }
    });
  }

  // ------------------------------------------------------------ navegación
  const VISTAS = { menu: vistaMenu, alacena: vistaAlacena, lista: vistaLista, pro: vistaPro, yo: vistaYo };
  async function ir() {
    if (hoja.open) hoja.close();
    const conSesion = !!leer("fa_access");
    let nombre = location.hash.replace("#", "") || (conSesion ? "menu" : "entrar");
    if (!conSesion) nombre = "entrar";
    if (conSesion && nombre === "entrar") nombre = "menu";
    if (nombre !== "entrar" && !VISTAS[nombre]) nombre = "menu";
    document.getElementById("barra").hidden = nombre === "entrar";
    document.querySelectorAll("[data-tab]").forEach((a) => {
      if (a.dataset.tab === nombre) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
    try {
      if (nombre === "entrar") vistaEntrar(); else await VISTAS[nombre]();
    } catch (err) {
      vista.innerHTML = `<div class="vacio"><p>${esc(err.message)}</p><button class="btn" type="button" id="reintentar">Intentar otra vez</button></div>`;
      document.getElementById("reintentar")?.addEventListener("click", ir);
    }
  }
  window.addEventListener("hashchange", ir);
  ir();
})();
