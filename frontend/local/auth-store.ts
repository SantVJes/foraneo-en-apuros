/* Sin cuentas: tus datos viven en este navegador. */
export const usaSupabase = false;
export async function haySesion() { return true; }
export function alCambiarSesion(_f: () => void) { void _f; return () => {}; }
export async function obtenerToken() { return null; }
export async function entrarConGoogle() {}
export async function entrarConCorreo() { return null; }
export async function cerrarSesion() {}
