const nodemailer = require('nodemailer');

/**
 * Envío de correo.
 *
 * Admite dos configuraciones, y la elección importa para que los mensajes NO
 * acaben en la carpeta de spam:
 *
 * 1. **SMTP del propio dominio** (recomendado). Se activa definiendo SMTP_HOST.
 *    El remitente es entonces algo@proyectosena.online, un dominio cuyos
 *    registros SPF, DKIM y DMARC lo respaldan.
 *
 * 2. **Gmail** (respaldo, y lo que había hasta ahora). El remitente es una
 *    cuenta @gmail.com. Funciona, pero los servidores que reciben ven correo
 *    automático de una plataforma saliendo de una cuenta personal gratuita, con
 *    un nombre visible ("SGPA Notificaciones") que no coincide con el dominio
 *    que firma. Es la causa habitual de que la verificación de cuenta llegue a
 *    spam, y NO se arregla con registros DNS en el dominio propio: esos
 *    autentican a quien envía, y aquí quien envía es gmail.com.
 *
 * Detalle en docs/16-CORREO-Y-ENTREGABILIDAD.md
 */

/** true si hay configuración de SMTP propio. */
const usaSmtpPropio = () => Boolean(process.env.SMTP_HOST);

function crearTransporte() {
  if (usaSmtpPropio()) {
    const puerto = Number(process.env.SMTP_PORT || 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      // 465 es SMTPS (cifrado desde el principio); 587 usa STARTTLS.
      secure: puerto === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

/**
 * Dirección del remitente.
 *
 * MAIL_FROM permite escribirla entera, con nombre visible:
 *   MAIL_FROM="SGPA · Sistema Jurídico <no-responder@proyectosena.online>"
 */
function construirRemitente(env = process.env) {
  // Con Gmail, el remitente DEBE ser la cuenta autenticada: Gmail reescribe o
  // rechaza cualquier otra dirección. Por eso MAIL_FROM se ignora aquí.
  //
  // Sin esta comprobación, un MAIL_FROM del dominio propio —puesto para el SMTP
  // propio— dejaba el respaldo inservible justo cuando hace falta: al volver a
  // Gmail porque el otro proveedor falla, el envío seguiría roto.
  if (!env.SMTP_HOST) return `"SGPA Notificaciones" <${env.GMAIL_USER}>`;

  if (env.MAIL_FROM) return env.MAIL_FROM;
  if (env.SMTP_USER) return `"SGPA" <${env.SMTP_USER}>`;
  return `"SGPA Notificaciones" <${env.GMAIL_USER}>`;
}

/**
 * Dirección a la que van las respuestas.
 *
 * Hace falta porque enviar desde el propio dominio NO exige tener un buzón allí:
 * un servicio de correo transaccional firma en nombre del dominio sin que exista
 * ninguna cuenta que reciba. Si alguien contesta al aviso, esa respuesta caería
 * en el vacío. MAIL_REPLY_TO la redirige a una dirección real.
 *
 * Devuelve undefined si no está configurada, y entonces nodemailer no añade la
 * cabecera: el comportamiento es el de siempre.
 */
function construirRespuesta(env = process.env) {
  return env.MAIL_REPLY_TO || undefined;
}

// Aviso único al arrancar. No es un error: el envío funciona. Es para que quede
// claro en los registros por qué los correos pueden ir a spam.
if (process.env.NODE_ENV === 'production' && !usaSmtpPropio()) {
  console.warn(
    '[Correo] Enviando desde una cuenta de Gmail. Los mensajes pueden acabar en spam ' +
    'porque el remitente no pertenece al dominio del sistema. Para corregirlo, ' +
    'configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM. ' +
    'Ver docs/16-CORREO-Y-ENTREGABILIDAD.md'
  );
}

const transporter = crearTransporte();

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: construirRemitente(),
      replyTo: construirRespuesta(),
      to,
      subject,
      html,
      text, // La versión en texto plano cuenta como señal antispam
    });
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = { sendEmail, construirRemitente, construirRespuesta, usaSmtpPropio };
