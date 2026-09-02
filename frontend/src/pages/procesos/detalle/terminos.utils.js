/**
 * Cálculos del semáforo de términos judiciales.
 *
 * Son funciones puras: no leen estado ni tocan la API. Viven fuera del
 * componente para poder razonar sobre ellas —y algún día probarlas— sin montar
 * 3 000 líneas de interfaz.
 *
 * El umbral de 48 horas para el ámbar no es arbitrario: es la antelación con la
 * que el sistema considera que un término está "por vencer" (RN05).
 */

const HORAS_AVISO = 48;

/** Horas que faltan para el vencimiento. Negativo si ya venció. */
function horasRestantes(fechaVencimiento, ahora = new Date()) {
  return (new Date(fechaVencimiento) - ahora) / (1000 * 60 * 60);
}

/** Reparto de términos en rojo (vencido), ámbar (≤48 h) y verde. */
export function getSemaforoStats(terminos) {
  let rojos = 0;
  let amarillos = 0;
  let verdes = 0;
  const now = new Date();

  terminos.forEach((t) => {
    if (t.estado !== 'PENDIENTE') {
      verdes++;
      return;
    }
    const diffHours = horasRestantes(t.fecha_vencimiento, now);
    if (diffHours <= 0) rojos++;
    else if (diffHours <= HORAS_AVISO) amarillos++;
    else verdes++;
  });

  return { rojos, amarillos, verdes };
}

/** Clases de Tailwind del semáforo. Los colores son los del diseño original. */
export function getTerminoAlertColor(t) {
  const VERDE = 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
  if (t.estado !== 'PENDIENTE') return VERDE;

  const diffHours = horasRestantes(t.fecha_vencimiento);
  if (diffHours <= 0) return 'border-rose-500/20 bg-rose-500/5 text-rose-400';
  if (diffHours <= HORAS_AVISO) return 'border-amber-500/20 bg-amber-500/5 text-amber-400';
  return VERDE;
}

/** Texto de cuenta atrás: "Vence en 3d 4h", "Vence en 5h 20m", "Vencido". */
export function getRemainingTimeText(vencimiento, estado) {
  if (estado !== 'PENDIENTE') return 'Completado';

  const diffMs = new Date(vencimiento) - new Date();
  if (diffMs <= 0) return 'Vencido 🚨';

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) return `Vence en ${days}d ${remainingHours}h`;
  if (hours > 0) return `Vence en ${hours}h ${mins}m`;
  return `Vence en ${mins}m`;
}

/** Tamaño de archivo legible. */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
