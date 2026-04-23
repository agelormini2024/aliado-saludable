/**
 * todayLocal — fecha de hoy en formato YYYY-MM-DD según la hora local del cliente.
 *
 * NO usar new Date().toISOString().split("T")[0]: toISOString() devuelve UTC,
 * así que a las 22:11 en Buenos Aires (UTC-3) ya devuelve la fecha del día siguiente.
 *
 * getFullYear / getMonth / getDate usan la zona horaria local del dispositivo.
 */
export function todayLocal(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
