/**
 * Comprueba que el almacenamiento de archivos (Cloudflare R2) funciona.
 *
 *   npm run probar-almacenamiento
 *
 * En el VPS:
 *   docker compose exec backend node -r dotenv/config scripts/probar-almacenamiento.js
 *
 * Sube un archivo diminuto, lo lee y lo borra. Sirve para saber en segundos si
 * se pueden adjuntar documentos a un expediente, en lugar de descubrirlo
 * intentándolo desde la interfaz y recibiendo un error genérico.
 */
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const r2 = require('../src/config/cloudflare');

const CLAVE = `pruebas/conexion-${Date.now()}.txt`;
const CONTENIDO = 'Prueba de conexion del SGPA';

const faltantes = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
  .filter((v) => !process.env[v]);

console.log('\n  Configuración en uso');
console.log(`    Endpoint: ${process.env.R2_ENDPOINT || '(sin definir)'}`);
console.log(`    Bucket:   ${process.env.R2_BUCKET_NAME || '(sin definir)'}`);
console.log(`    Llave:    ${process.env.R2_ACCESS_KEY_ID ? process.env.R2_ACCESS_KEY_ID.slice(0, 6) + '…' : '(sin definir)'}`);
console.log(`    Dominio público: ${process.env.R2_PUBLIC_DOMAIN || '(sin definir)'}\n`);

if (faltantes.length > 0) {
  console.error(`  Faltan variables en backend/.env: ${faltantes.join(', ')}\n`);
  process.exit(1);
}

const Bucket = process.env.R2_BUCKET_NAME;

function explicar(error) {
  const codigo = error.Code || error.name;
  console.error(`\n  FALLÓ: ${codigo} — ${error.message}`);

  if (/AccessDenied/i.test(codigo)) {
    console.error('\n  CAUSA: Cloudflare rechaza las credenciales.');
    console.error('  Casi siempre es una de estas tres:');
    console.error('    1. La llave fue revocada o sustituida y el .env conserva la antigua.');
    console.error('    2. El token no tiene permiso de ESCRITURA sobre este bucket');
    console.error('       (en Cloudflare debe ser "Object Read & Write", no solo lectura).');
    console.error('    3. El token está limitado a otro bucket distinto del configurado.');
    console.error('\n  Se arregla en Cloudflare → R2 → Manage API Tokens, generando un token');
    console.error('  nuevo y copiando sus dos valores a R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY.');
  } else if (/NoSuchBucket/i.test(codigo)) {
    console.error(`\n  CAUSA: el bucket "${Bucket}" no existe en esta cuenta.`);
    console.error('  Revisa R2_BUCKET_NAME, o que el endpoint sea el de la cuenta correcta.');
  } else if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(codigo)) {
    console.error('\n  CAUSA: no se pudo alcanzar el endpoint. Revisa R2_ENDPOINT y la red.');
  }
  console.error('');
}

(async () => {
  try {
    process.stdout.write('  1/3 Subiendo un archivo de prueba… ');
    await r2.send(new PutObjectCommand({
      Bucket, Key: CLAVE, Body: CONTENIDO, ContentType: 'text/plain',
    }));
    console.log('bien');

    process.stdout.write('  2/3 Leyéndolo de vuelta…          ');
    const leido = await r2.send(new GetObjectCommand({ Bucket, Key: CLAVE }));
    const texto = await leido.Body.transformToString();
    if (texto !== CONTENIDO) throw new Error('El contenido leído no coincide con el escrito');
    console.log('bien');

    process.stdout.write('  3/3 Borrándolo…                   ');
    await r2.send(new DeleteObjectCommand({ Bucket, Key: CLAVE }));
    console.log('bien');

    console.log('\n  El almacenamiento funciona: se pueden subir documentos y logotipos.\n');
    process.exit(0);
  } catch (error) {
    explicar(error);
    process.exit(1);
  }
})();
