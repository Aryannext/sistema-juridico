/**
 * Elección de remitente del correo.
 *
 * Importa porque de la dirección del remitente depende que los mensajes lleguen
 * a la bandeja de entrada o a spam: un remitente del propio dominio está
 * respaldado por SPF, DKIM y DMARC; una cuenta de Gmail, no.
 */
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

const { construirRemitente } = require('../config/mailer');

describe('Remitente del correo', () => {
  it('Usa MAIL_FROM cuando está definido, con su nombre visible', () => {
    const env = {
      MAIL_FROM: 'SGPA · Sistema Jurídico <no-responder@proyectosena.online>',
      SMTP_HOST: 'smtp.hostinger.com',
      SMTP_USER: 'otro@proyectosena.online',
      GMAIL_USER: 'alguien@gmail.com',
    };
    expect(construirRemitente(env)).toBe(
      'SGPA · Sistema Jurídico <no-responder@proyectosena.online>'
    );
  });

  it('Con SMTP propio y sin MAIL_FROM, usa la cuenta del dominio', () => {
    const env = {
      SMTP_HOST: 'smtp.hostinger.com',
      SMTP_USER: 'no-responder@proyectosena.online',
      GMAIL_USER: 'alguien@gmail.com',
    };
    expect(construirRemitente(env)).toBe('"SGPA" <no-responder@proyectosena.online>');
  });

  it('Sin configuración de dominio, cae en Gmail: el comportamiento de siempre', () => {
    const env = { GMAIL_USER: 'alguien@gmail.com' };
    expect(construirRemitente(env)).toBe('"SGPA Notificaciones" <alguien@gmail.com>');
  });

  it('Al caer en Gmail, IGNORA MAIL_FROM del dominio propio', () => {
    // Gmail solo puede firmar como la cuenta autenticada: reescribe o rechaza
    // cualquier otra dirección. Si se respetara MAIL_FROM aquí, el respaldo
    // quedaría inservible justo cuando hace falta —al volver a Gmail porque el
    // proveedor propio falla, el envío seguiría roto.
    const env = {
      MAIL_FROM: 'SGPA <no-responder@proyectosena.online>',
      GMAIL_USER: 'alguien@gmail.com',
      // sin SMTP_HOST: se está usando el respaldo
    };
    expect(construirRemitente(env)).toBe('"SGPA Notificaciones" <alguien@gmail.com>');
  });

  it('SMTP_HOST sin SMTP_USER no deja el remitente a medias', () => {
    // Configuración incompleta: mejor caer al respaldo conocido que construir
    // una dirección inválida y que fallen todos los envíos.
    const env = { SMTP_HOST: 'smtp.hostinger.com', GMAIL_USER: 'alguien@gmail.com' };
    expect(construirRemitente(env)).toBe('"SGPA Notificaciones" <alguien@gmail.com>');
  });
});

describe('Dirección de respuesta', () => {
  const { construirRespuesta } = require('../config/mailer');

  it('Devuelve MAIL_REPLY_TO cuando está definida', () => {
    expect(construirRespuesta({ MAIL_REPLY_TO: 'contacto@ejemplo.com' }))
      .toBe('contacto@ejemplo.com');
  });

  it('Sin configurar, no añade la cabecera', () => {
    // undefined hace que nodemailer omita replyTo: el comportamiento de siempre.
    expect(construirRespuesta({})).toBeUndefined();
  });
});
