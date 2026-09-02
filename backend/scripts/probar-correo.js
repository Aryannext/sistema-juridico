/**
 * Envía un correo de prueba con la configuración actual.
 *
 *   npm run probar-correo -- tucorreo@ejemplo.com
 *
 * En el VPS:
 *   docker compose exec backend node -r dotenv/config \
 *     scripts/probar-correo.js tucorreo@ejemplo.com
 *
 * Sirve para comprobar el remitente sin tener que registrar un usuario, y para
 * ver EN QUÉ CARPETA cae el mensaje, que es lo que interesa averiguar.
 */
const { sendEmail, construirRemitente, construirRespuesta, usaSmtpPropio } = require('../src/config/mailer');

const destino = process.argv[2];

if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
  console.error('\n  Indica un correo de destino.');
  console.error('  Uso: npm run probar-correo -- tucorreo@ejemplo.com\n');
  process.exit(1);
}

const via = usaSmtpPropio() ? `SMTP propio (${process.env.SMTP_HOST})` : 'Gmail (respaldo)';

console.log('\n  Configuración en uso');
console.log(`    Vía:        ${via}`);
console.log(`    Remitente:  ${construirRemitente()}`);
console.log(`    Respuestas: ${construirRespuesta() || '(no configurada)'}`);
console.log(`    Destino:    ${destino}\n`);

if (!usaSmtpPropio()) {
  console.log('  AVISO: se está enviando desde una cuenta de Gmail, así que es probable');
  console.log('  que el mensaje acabe en spam. Ver docs/16-CORREO-Y-ENTREGABILIDAD.md\n');
}

const marca = new Date().toLocaleString('es-CO');

sendEmail({
  to: destino,
  subject: `Prueba de envío del SGPA · ${marca}`,
  text:
    `Este es un correo de prueba del Sistema de Gestión de Procesos de Abogados.\n\n` +
    `Enviado el ${marca} vía ${via}.\n` +
    `Remitente: ${construirRemitente()}\n\n` +
    `Si has recibido esto en la bandeja de entrada, la configuración es correcta.\n` +
    `Si ha caído en spam, revisa la verificación del dominio en tu proveedor de correo.`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color:#B8860B;">Prueba de envío del SGPA</h2>
      <p>Si estás leyendo esto, el sistema puede enviar correo correctamente.</p>
      <table style="font-size:14px; color:#444; border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;"><strong>Fecha</strong></td><td>${marca}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;"><strong>Vía</strong></td><td>${via}</td></tr>
      </table>
      <p style="color:#777; font-size:12px; margin-top:24px;">
        Lo importante no es que llegue, sino <strong>en qué carpeta</strong>. Comprueba si está
        en la bandeja de entrada o en spam.
      </p>
    </div>`,
})
  .then(() => {
    console.log('  Correo entregado al servidor de salida sin errores.');
    console.log('  Ahora comprueba EN QUÉ CARPETA llegó: bandeja de entrada o spam.\n');
    process.exit(0);
  })
  .catch((error) => {
    const respuesta = error.response || '';
    const codigo = error.responseCode;

    console.error('\n  No se pudo enviar:', error.message);

    // El orden de estas comprobaciones importa. La IP no autorizada llega como
    // un fallo de autenticación (EAUTH, "Invalid login"), así que si se mirase
    // primero el texto genérico de credenciales se daría un diagnóstico
    // equivocado y se perdería el tiempo revisando usuario y contraseña.
    if (/not yet activated|account is not activated/i.test(respuesta)) {
      console.error('\n  CAUSA: el proveedor todavía no ha activado la cuenta.');
      console.error('  NO es un fallo de configuración: credenciales, dominio e IP son correctos');
      console.error('  y el mensaje llegó hasta el último paso del envío.');
      console.error('\n  Brevo revisa a mano las cuentas nuevas antes de permitir enviar.');
      console.error('  1. Completa el perfil de la cuenta: empresa, sitio web y teléfono.');
      console.error('  2. Escribe a su soporte explicando que es correo transaccional:');
      console.error('     verificación de cuenta, códigos de acceso y avisos de vencimiento.');
      console.error('\n  MIENTRAS TANTO no dejes la plataforma sin correo: vacía SMTP_HOST en');
      console.error('  backend/.env y reconstruye. Volverá a enviar por Gmail.\n');
    } else if (codigo === 525 || /unauthorized ip/i.test(respuesta)) {
      console.error('\n  CAUSA: el proveedor no autoriza envíos desde la IP de este servidor.');
      console.error('  Las credenciales son correctas; lo que falta es dar de alta la IP.');
      console.error('\n  1. Averigua la IP pública:   curl -s https://api.ipify.org');
      console.error('  2. En Brevo, ajustes de la cuenta → Seguridad → Authorized IPs.');
      console.error('  3. Añádela y repite esta prueba.');
      console.error('\n  Brevo suele enviar además un correo con un enlace para autorizarla.\n');
    } else if (/sender|from address|domain|not verified/i.test(respuesta + error.message)) {
      console.error('\n  CAUSA: el remitente no está autorizado.');
      console.error('  Verifica el dominio en el panel del proveedor antes de enviar desde él.');
      console.error('  En Brevo: Senders, Domains & Dedicated IPs → Domains.\n');
    } else if (/auth|login|credential/i.test(error.message)) {
      console.error('\n  CAUSA probable: credenciales. Revisa SMTP_USER y SMTP_PASS.');
      console.error('  En Brevo, la contraseña es la CLAVE SMTP, no la del panel.\n');
    } else {
      console.error('');
    }
    process.exit(1);
  });
