const prisma = require('../../config/prisma');

/**
 * Registro de sesión en la bitácora — RF05 y RNF03.
 *
 * El requisito exige que la bitácora responda «quién entró y cuándo», que es
 * la pregunta más básica de cualquier auditoría de seguridad. Hasta ahora el
 * código llevaba un `// Todo: Record audit login` sin implementar: se auditaba
 * todo lo que ocurre DENTRO del sistema, pero no la entrada al sistema.
 *
 * Vive en su propio archivo, y no dentro de `auth.controller.js`, porque ese
 * archivo ya estaba señalado por responsabilidad excesiva en
 * docs/13-CALIDAD-DE-CODIGO.md.
 */

const ACCIONES = {
  EXITO: 'INICIO_SESION',
  FALLIDO: 'INTENTO_FALLIDO_SESION',
  BLOQUEO: 'BLOQUEO_POR_INTENTOS',
  CIERRE: 'CIERRE_SESION',
};

/**
 * Escribe una entrada de sesión.
 *
 * **Nunca lanza.** Un fallo al auditar no puede impedir que alguien entre —o
 * salga— del sistema: dejaría la plataforma inaccesible por un problema de
 * registro. Se traza el error y se continúa.
 *
 * @param {object} usuario Debe traer `id_usuario` y `tenant_id`.
 */
async function registrarSesion(usuario, accion, detalle, ip) {
  try {
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: usuario.tenant_id,
        id_usuario: usuario.id_usuario,
        accion,
        modulo: 'AUTENTICACION',
        detalle,
        ip_adress: ip || '127.0.0.1',
      },
    });
  } catch (error) {
    console.error('No se pudo registrar la sesión en la bitácora:', error.message);
  }
}

/** Entrada correcta. */
const registrarEntrada = (usuario, req, con2FA) =>
  registrarSesion(
    usuario,
    ACCIONES.EXITO,
    `${usuario.nombre} inició sesión${con2FA ? ' con verificación en dos pasos' : ''}`,
    req.ip
  );

/**
 * Contraseña incorrecta.
 *
 * Solo se registra cuando el usuario EXISTE. Un intento contra un correo que no
 * está registrado no tiene consultorio al que atribuirlo, y crear una entrada
 * para él exigiría inventar un `tenant_id`. Además, la bitácora de un
 * consultorio no debe llenarse de intentos ajenos.
 */
const registrarIntentoFallido = (usuario, req, intentos) =>
  registrarSesion(
    usuario,
    ACCIONES.FALLIDO,
    `Intento de acceso fallido para ${usuario.email} (intento ${intentos})`,
    req.ip
  );

/** Bloqueo por acumulación de intentos. */
const registrarBloqueo = (usuario, req, minutos) =>
  registrarSesion(
    usuario,
    ACCIONES.BLOQUEO,
    `La cuenta de ${usuario.email} quedó bloqueada ${minutos} minuto(s) por intentos fallidos`,
    req.ip
  );

/** Cierre de sesión. */
const registrarSalida = (usuario, req) =>
  registrarSesion(usuario, ACCIONES.CIERRE, `${usuario.nombre} cerró sesión`, req.ip);

module.exports = {
  ACCIONES,
  registrarEntrada,
  registrarIntentoFallido,
  registrarBloqueo,
  registrarSalida,
};
