import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha SIN hora (columnas `@db.Date` de Prisma):
 * fecha_radicado, fecha_actuacion, fecha_nacimiento.
 *
 * Estas columnas guardan un día del calendario, no un instante. Prisma las
 * devuelve como medianoche UTC (`2026-06-20T00:00:00.000Z`). Si se formatean
 * con `toLocaleDateString()` a secas, el navegador las convierte a la zona
 * local: en Colombia (UTC-5) esa medianoche cae en las 19:00 del día ANTERIOR
 * y la fecha se muestra con un día menos.
 *
 * En un sistema jurídico eso no es cosmético: de estas fechas dependen los
 * términos procesales. Por eso se fuerza `timeZone: 'UTC'`.
 *
 * ⚠️ NO usar para fechas con hora real (fecha_hora de audiencias,
 * fecha_vencimiento de términos, created_at): esas sí deben mostrarse en la
 * zona horaria del usuario.
 */
export function formatFechaSinHora(valor, respaldo = 'No especificada') {
  if (!valor) return respaldo;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return respaldo;
  return fecha.toLocaleDateString('es-CO', { timeZone: 'UTC' });
}
