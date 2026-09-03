const prisma = require('../../config/prisma');
const { hashPassword } = require('../../utils/bcrypt');
const { generateVerificationToken } = require('../../utils/jwt');
const { validarPassword } = require('../../utils/password');
const { sendEmail } = require('../../config/mailer');

/**
 * Recuperación de acceso: reenvío del correo de verificación (RF54) y
 * restablecimiento de contraseña (HU-01).
 *
 * Antes no existía ninguna de las dos. La consecuencia era que un correo
 * perdido —en spam, borrado sin querer— dejaba a esa persona **bloqueada sin
 * salida**: no podía activar su cuenta, no podía pedir otro mensaje y no podía
 * recuperar su contraseña. Solo se resolvía entrando al servidor a ejecutar un
 * UPDATE a mano por cada usuario afectado.
 *
 * Va en un archivo propio para no seguir engordando auth.controller.js, ya
 * señalado en docs/13-CALIDAD-DE-CODIGO.md como de responsabilidad excesiva.
 */

const HORAS_VIGENCIA_VERIFICACION = 24; // RF54
const MINUTOS_VIGENCIA_RECUPERACION = 60;

/**
 * Respuesta única para las solicitudes por correo.
 *
 * Se contesta EXACTAMENTE lo mismo exista o no la cuenta. Si se distinguiera,
 * cualquiera podría averiguar qué correos están registrados en la plataforma
 * probándolos uno a uno, que es el primer paso de un ataque dirigido. En un
 * sistema jurídico eso además revela quién trabaja con quién.
 */
const RESPUESTA_NEUTRA = {
  message:
    'Si el correo corresponde a una cuenta registrada, recibirás un mensaje en unos minutos. ' +
    'Revisa también la carpeta de spam.',
};

const enlace = (ruta, token) => {
  const base = process.env.FRONTEND_URL || 'https://proyectosena.online/sistema-juridico';
  return `${base}/${ruta}?token=${token}`;
};

/** Plantilla común, para que los dos correos se vean igual que el de registro. */
function plantilla({ titulo, saludo, cuerpo, textoBoton, url, aviso }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h1 style="color: #DFB971; text-align: center;">${titulo}</h1>
      <p>${saludo}</p>
      <p>${cuerpo}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background-color: #DFB971; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 5px;">${textoBoton}</a>
      </div>
      <p style="color: #666; font-size: 12px; text-align: center;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${url}</p>
      <p style="color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 12px;">${aviso}</p>
    </div>`;
}

// ── 1. Reenviar el correo de verificación (RF54) ───────────────────────
exports.reenviarVerificacion = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Indica tu correo electrónico' });

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Se responde lo mismo si no existe, si ya está activa o si se envió: no se
    // confirma ni se desmiente nada sobre esa dirección.
    if (!usuario || usuario.activo) return res.json(RESPUESTA_NEUTRA);

    // Token NUEVO en cada reenvío. Reutilizar el anterior alargaría la vida de
    // un enlace que quizá lleva semanas circulando por un buzón.
    const token = generateVerificationToken();
    const expira = new Date(Date.now() + HORAS_VIGENCIA_VERIFICACION * 3600 * 1000);

    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { token_verificacion: token, token_verificacion_expira: expira },
    });

    const url = enlace('verificacion', token);

    await sendEmail({
      to: usuario.email,
      subject: 'Activa tu cuenta en SGPA',
      text:
        `Hola ${usuario.nombre},\n\n` +
        `Para activar tu cuenta, abre este enlace:\n\n${url}\n\n` +
        `El enlace caduca en ${HORAS_VIGENCIA_VERIFICACION} horas.\n\n` +
        `Si no solicitaste esto, puedes ignorar el mensaje.\n\nEl equipo de SGPA.`,
      html: plantilla({
        titulo: 'Activa tu cuenta',
        saludo: `Hola ${usuario.nombre},`,
        cuerpo: 'Pulsa el botón para activar tu cuenta y poder iniciar sesión.',
        textoBoton: 'Activar mi cuenta',
        url,
        aviso: `El enlace caduca en ${HORAS_VIGENCIA_VERIFICACION} horas. Si no solicitaste esto, ignora el mensaje.`,
      }),
    });

    res.json(RESPUESTA_NEUTRA);
  } catch (error) {
    console.error('Error reenviando la verificación:', error);
    // Tampoco aquí se cambia la respuesta: un 500 revelaría que el correo sí
    // existe y que el fallo ocurrió al intentar enviarle algo.
    res.json(RESPUESTA_NEUTRA);
  }
};

// ── 2. Solicitar el restablecimiento de contraseña (HU-01) ─────────────
exports.solicitarRecuperacion = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Indica tu correo electrónico' });

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { tenant: { select: { activo: true } } },
    });

    // Una cuenta sin verificar no restablece contraseña: primero debe activarse.
    // Un consultorio suspendido tampoco, o el enlace serviría para recuperar el
    // acceso a algo que está deliberadamente cerrado.
    const puedeRecuperar = usuario && usuario.activo && usuario.tenant.activo;
    if (!puedeRecuperar) return res.json(RESPUESTA_NEUTRA);

    const token = generateVerificationToken();
    const expira = new Date(Date.now() + MINUTOS_VIGENCIA_RECUPERACION * 60 * 1000);

    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: { token_recuperacion: token, token_recuperacion_expira: expira },
    });

    const url = enlace('restablecer', token);

    await sendEmail({
      to: usuario.email,
      subject: 'Restablece tu contraseña de SGPA',
      text:
        `Hola ${usuario.nombre},\n\n` +
        `Recibimos una solicitud para restablecer tu contraseña. Abre este enlace:\n\n${url}\n\n` +
        `El enlace caduca en ${MINUTOS_VIGENCIA_RECUPERACION} minutos y solo puede usarse una vez.\n\n` +
        `Si no lo solicitaste, ignora este mensaje: tu contraseña no ha cambiado.\n\nEl equipo de SGPA.`,
      html: plantilla({
        titulo: 'Restablece tu contraseña',
        saludo: `Hola ${usuario.nombre},`,
        cuerpo: 'Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón para elegir una nueva.',
        textoBoton: 'Elegir contraseña nueva',
        url,
        aviso:
          `El enlace caduca en ${MINUTOS_VIGENCIA_RECUPERACION} minutos y solo puede usarse una vez. ` +
          'Si no solicitaste el cambio, ignora este mensaje: tu contraseña no ha cambiado.',
      }),
    });

    res.json(RESPUESTA_NEUTRA);
  } catch (error) {
    console.error('Error solicitando la recuperación:', error);
    res.json(RESPUESTA_NEUTRA);
  }
};

// ── 3. Fijar la contraseña nueva ───────────────────────────────────────
exports.restablecerPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) return res.status(400).json({ error: 'Falta el enlace de recuperación' });

    const { valida, error } = validarPassword(password);
    if (!valida) return res.status(400).json({ error });

    const usuario = await prisma.usuario.findFirst({
      where: { token_recuperacion: token },
    });

    // Mensaje idéntico para "no existe" y "caducado": quien tenga un enlace
    // viejo no debe poder deducir si alguna vez fue válido.
    const invalido = () =>
      res.status(400).json({
        error: 'El enlace no es válido o ya caducó. Solicita uno nuevo.',
        tokenInvalido: true,
      });

    if (!usuario) return invalido();
    if (!usuario.token_recuperacion_expira || usuario.token_recuperacion_expira < new Date()) {
      return invalido();
    }

    await prisma.usuario.update({
      where: { id_usuario: usuario.id_usuario },
      data: {
        password_hash: await hashPassword(password),
        // El token se quema: un solo uso.
        token_recuperacion: null,
        token_recuperacion_expira: null,
        // Quien recupera su contraseña debe poder entrar de inmediato, aunque
        // se hubiera bloqueado a sí mismo probando la que no recordaba.
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      },
    });

    // Queda en la bitácora del consultorio: es un cambio de credenciales y
    // tiene que ser rastreable (RNF03).
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: usuario.tenant_id,
        id_usuario: usuario.id_usuario,
        accion: 'RESTABLECER_CONTRASENA',
        modulo: 'AUTENTICACION',
        detalle: `${usuario.nombre} restableció su contraseña mediante el enlace enviado por correo`,
        ip_adress: req.ip || '127.0.0.1',
      },
    });

    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error restableciendo la contraseña:', error);
    res.status(500).json({ error: 'No se pudo restablecer la contraseña' });
  }
};
