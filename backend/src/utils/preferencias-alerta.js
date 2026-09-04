/**
 * Cómo avisar a cada persona — RF47.1, RF48.1 y RF48.2 (HU-29).
 *
 * ── El problema que resuelve ────────────────────────────────────────────
 *
 * La plataforma tenía una pantalla de preferencias de alertas —canal y
 * prioridad por tipo de evento— que **guardaba ajustes que nadie leía**. Los
 * campos existían en la base, el perfil los devolvía, la pantalla los
 * escribía… y a la hora de avisar no se consultaban: el envío era siempre por
 * correo y la prioridad estaba escrita a mano en el código (`'ALTA'`,
 * `'MEDIA'`).
 *
 * El efecto para quien usa el sistema: elegía «solo plataforma» y le seguían
 * llegando correos. Una preferencia que no se respeta es peor que no ofrecerla,
 * porque enseña que los ajustes de esta aplicación no sirven.
 *
 * Se detectó el 4 de septiembre de 2026 revisando el catálogo contra el código
 * antes de desplegar. Los criterios RF47.1 y RF48.1 figuraban como cumplidos.
 */

/** Qué preferencia gobierna cada tipo de evento. */
const CAMPO_POR_EVENTO = {
  AUDIENCIA: 'pref_prioridad_audiencia',
  TERMINO: 'pref_prioridad_termino',
  TAREA: 'pref_prioridad_tarea',
};

const PRIORIDADES = ['ALTA', 'MEDIA', 'BAJA'];

/**
 * Prioridad con la que avisar a esta persona de este evento.
 *
 * **La criticidad manda sobre la preferencia, y esa es la regla que importa.**
 * RF48.2 y HU-29.3 dicen que las alertas de prioridad alta no se pueden
 * silenciar: un término crítico es aquel cuyo incumplimiento tiene
 * consecuencias procesales, así que nadie —ni su propio destinatario— debería
 * poder bajarlo a «baja» y perderlo de vista. La preferencia decide el resto.
 */
function prioridadPara(usuario, evento, esCritico = false) {
  if (esCritico) return 'ALTA';

  const campo = CAMPO_POR_EVENTO[evento];
  const elegida = campo && usuario ? usuario[campo] : null;

  return PRIORIDADES.includes(elegida) ? elegida : 'MEDIA';
}

/**
 * Por dónde avisar. `AMBOS` es el valor por defecto del esquema, así que quien
 * no haya tocado nada sigue recibiendo lo mismo que antes.
 *
 * Ante un valor desconocido —una preferencia corrupta, un dato antiguo— se
 * avisa por los dos canales. En un sistema de plazos judiciales, equivocarse
 * avisando de más es recuperable; equivocarse callando, no.
 */
function canalesPara(usuario) {
  const canal = usuario?.preferencia_canal;

  if (canal === 'EMAIL') return { correo: true, plataforma: false };
  if (canal === 'PLATAFORMA') return { correo: false, plataforma: true };
  return { correo: true, plataforma: true };
}

module.exports = { prioridadPara, canalesPara, CAMPO_POR_EVENTO };
