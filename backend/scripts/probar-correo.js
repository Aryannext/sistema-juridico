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
    console.error('\n  No se pudo enviar:', error.message);
    if (/auth/i.test(error.message)) {
      console.error('  Parece un problema de credenciales: revisa SMTP_USER y SMTP_PASS.');
      console.error('  En Brevo, la contraseña es la CLAVE SMTP, no la del panel.\n');
    } else if (/sender|from|domain/i.test(error.message)) {
      console.error('  Parece que el remitente no está autorizado: verifica el dominio');
      console.error('  en el panel de tu proveedor antes de enviar desde él.\n');
    } else {
      console.error('');
    }
    process.exit(1);
  });
