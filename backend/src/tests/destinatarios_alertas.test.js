/**
 * A quién llega cada alerta, y por qué canal — RF29.2, RF37.2, RF47.1, RF48.2.
 *
 * Tres criterios que figuraban como cumplidos y no lo estaban. Salieron al
 * revisar el catálogo contra el código antes de desplegar, y los tres viven en
 * la función que el propio diagrama de descomposición llama «el corazón del
 * sistema»: avisar a tiempo. Las otras cinco existen para que esta sea posible.
 *
 *   · **RF29.2** — «el recordatorio llega también a los colaboradores
 *     asignados». No llegaba: el cron escribía al responsable y al cliente, y
 *     a nadie más. Quien trabajaba el expediente sin ser su titular no se
 *     enteraba de la audiencia.
 *
 *   · **RF37.2** — «un término crítico alerta también al Administrador». Se
 *     cumplía al **crear** el término y faltaba en el recordatorio, que es
 *     cuando importa: el aviso de creación llega semanas antes; el del
 *     recordatorio, con el plazo encima.
 *
 *   · **RF47.1** — «el canal de notificación es configurable por usuario». Se
 *     podía configurar y no servía de nada: el envío era siempre por correo y
 *     la prioridad estaba escrita a mano en el código. Una preferencia que no
 *     se respeta es peor que no ofrecerla.
 */
const fs = require('node:fs');
const path = require('node:path');
const { prioridadPara, canalesPara } = require('../utils/preferencias-alerta');

const job = fs.readFileSync(
  path.join(__dirname, '..', 'jobs', 'recordatorios.job.js'), 'utf8'
);

const bloqueAudiencias = job.slice(0, job.indexOf('PROCESAR RECORDATORIOS DE TÉRMINOS'));
const bloqueTerminos = job.slice(job.indexOf('PROCESAR RECORDATORIOS DE TÉRMINOS'));

describe('RF47.1 · El canal que elige cada persona se respeta', () => {
  it('«Solo correo» no crea notificación en plataforma', () => {
    expect(canalesPara({ preferencia_canal: 'EMAIL' })).toEqual({ correo: true, plataforma: false });
  });

  it('«Solo plataforma» no envía correo', () => {
    expect(canalesPara({ preferencia_canal: 'PLATAFORMA' })).toEqual({ correo: false, plataforma: true });
  });

  it('«Ambos» usa los dos canales', () => {
    expect(canalesPara({ preferencia_canal: 'AMBOS' })).toEqual({ correo: true, plataforma: true });
  });

  it('Ante una preferencia ausente o corrupta, avisa por los dos', () => {
    // En un sistema de plazos judiciales, equivocarse avisando de más es
    // recuperable; equivocarse callando, no.
    for (const raro of [undefined, null, {}, { preferencia_canal: 'LO_QUE_SEA' }]) {
      const u = typeof raro === 'object' && raro !== null ? raro : {};
      expect(canalesPara(u)).toEqual({ correo: true, plataforma: true });
    }
  });
});

describe('RF48.2 · Las alertas de prioridad alta no se silencian', () => {
  it('Un término crítico es ALTA aunque el usuario prefiera BAJA', () => {
    // Es la regla que sostiene el criterio: si la preferencia pudiera bajarla,
    // se podría silenciar justo la alerta que no debe silenciarse.
    const u = { pref_prioridad_termino: 'BAJA' };
    expect(prioridadPara(u, 'TERMINO', true)).toBe('ALTA');
  });

  it('Fuera de lo crítico, manda la preferencia', () => {
    expect(prioridadPara({ pref_prioridad_termino: 'BAJA' }, 'TERMINO', false)).toBe('BAJA');
    expect(prioridadPara({ pref_prioridad_audiencia: 'ALTA' }, 'AUDIENCIA')).toBe('ALTA');
  });

  it('Sin preferencia, MEDIA', () => {
    expect(prioridadPara({}, 'TERMINO')).toBe('MEDIA');
    expect(prioridadPara({ pref_prioridad_termino: 'INVENTADA' }, 'TERMINO')).toBe('MEDIA');
  });
});

describe('RF29.2 · El recordatorio de audiencia llega a los colaboradores', () => {
  it('La consulta trae a los colaboradores del expediente', () => {
    // Sin incluirlos, no hay a quién avisar por mucho que el código lo intente.
    expect(bloqueAudiencias).toMatch(/abogados:\s*\{/);
  });

  it('Trae además sus preferencias, no solo el correo', () => {
    // Sin `preferencia_canal`, cada colaborador recibiría el valor por defecto
    // y la preferencia volvería a no servir de nada.
    const include = bloqueAudiencias.slice(bloqueAudiencias.indexOf('abogados:'));
    expect(include).toMatch(/preferencia_canal: true/);
    expect(include).toMatch(/pref_prioridad_audiencia: true/);
  });

  it('Se avisa al responsable y a los colaboradores en la misma lista', () => {
    expect(bloqueAudiencias).toMatch(/const destinatarios = \[/);
    expect(bloqueAudiencias).toMatch(/abogado_resp,/);
    expect(bloqueAudiencias).toMatch(/\.map\(\(a\) => a\.usuario\)/);
  });

  it('No se avisa dos veces a quien sea responsable y colaborador a la vez', () => {
    expect(bloqueAudiencias).toMatch(/vistos\.has\(usuario\.id_usuario\)/);
  });

  it('No se avisa a quien tenga la cuenta inactiva', () => {
    // Avisar a alguien que ya no puede entrar no es avisar a nadie.
    expect(bloqueAudiencias).toMatch(/u\.activo !== false/);
  });
});

describe('RF37.2 · El término crítico alerta al Administrador en el recordatorio', () => {
  it('Solo cuando el término es crítico', () => {
    // Hacerlo con todos convertiría su bandeja en ruido, y el requisito lo
    // reserva a los críticos justamente por eso.
    expect(bloqueTerminos).toMatch(/if \(esCritico\) \{/);
  });

  it('Busca a los administradores del consultorio del término', () => {
    // Del consultorio del término, no del de quien ejecuta: el cron corre sin
    // sesión y recorre todos los consultorios a la vez.
    expect(bloqueTerminos).toMatch(/tenant_id: alert\.termino\.tenant_id/);
    expect(bloqueTerminos).toMatch(/rol: 'ADMINISTRADOR'/);
    expect(bloqueTerminos).toMatch(/activo: true/);
  });

  it('El responsable siempre está entre los receptores', () => {
    expect(bloqueTerminos).toMatch(/const receptores = \[alert\.termino\.proceso\.abogado_resp\]/);
  });

  it('No se avisa dos veces si el Administrador es el propio responsable', () => {
    expect(bloqueTerminos).toMatch(/avisados\.has\(usuario\.id_usuario\)/);
  });

  it('La criticidad viaja al emisor, para que fuerce la prioridad ALTA', () => {
    const trozo = bloqueTerminos.slice(bloqueTerminos.indexOf('await avisar('));
    expect(trozo).toMatch(/esCritico,/);
  });
});

describe('Un aviso que falla no se lleva por delante a los demás', () => {
  it('El correo y la notificación van cada uno en su propio try', () => {
    // Un correo rebotado no puede impedir que el resto de destinatarios reciba
    // el recordatorio, ni que quede constancia en la plataforma.
    const emisor = job.slice(job.indexOf('async function avisar'), job.indexOf('// Function that executes'));

    expect((emisor.match(/try \{/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((emisor.match(/catch/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
