/**
 * Crea un administrador de la plataforma.
 *
 * Es la ÚNICA forma de crear uno: no existe ninguna ruta web de registro, para
 * no exponer a internet la cuenta de mayor privilegio del sistema.
 *
 *   node -r dotenv/config scripts/crear-admin-plataforma.js "Nombre" correo@dominio "contraseña"
 *
 * En el VPS, dentro del contenedor:
 *
 *   docker compose exec backend node -r dotenv/config \
 *     scripts/crear-admin-plataforma.js "Nombre" correo@dominio "contraseña"
 *
 * Si el correo ya existe, actualiza la contraseña en lugar de fallar: así
 * también sirve para recuperar el acceso si se olvida.
 */
const prisma = require('../src/config/prisma');
const { hashPassword } = require('../src/utils/bcrypt');

const [, , nombre, email, password] = process.argv;

function salir(mensaje) {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

if (!nombre || !email || !password) {
  salir(
    'Faltan datos.\n\n' +
    '  Uso: node -r dotenv/config scripts/crear-admin-plataforma.js "Nombre" correo@dominio "contraseña"'
  );
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  salir(`"${email}" no parece un correo válido.`);
}

// Esta cuenta puede suspender y eliminar consultorios enteros. La exigencia es
// más alta que para un usuario normal a propósito.
const problemas = [];
if (password.length < 12) problemas.push('al menos 12 caracteres');
if (!/[A-Z]/.test(password)) problemas.push('una mayúscula');
if (!/[a-z]/.test(password)) problemas.push('una minúscula');
if (!/[0-9]/.test(password)) problemas.push('un número');
if (!/[^A-Za-z0-9]/.test(password)) problemas.push('un carácter especial');

if (problemas.length > 0) {
  salir(
    'La contraseña es demasiado débil para una cuenta de plataforma.\n' +
    `  Le falta: ${problemas.join(', ')}.`
  );
}

(async () => {
  try {
    const hash = await hashPassword(password);

    const existente = await prisma.adminPlataforma.findUnique({ where: { email } });

    if (existente) {
      await prisma.adminPlataforma.update({
        where: { email },
        data: { nombre, password_hash: hash, activo: true },
      });
      console.log(`\n  Ya existía un administrador con ${email}: se actualizó su contraseña y quedó activo.\n`);
    } else {
      await prisma.adminPlataforma.create({
        data: { nombre, email, password_hash: hash },
      });
      console.log(`\n  Administrador de plataforma creado: ${nombre} <${email}>\n`);
    }

    const total = await prisma.adminPlataforma.count({ where: { activo: true } });
    console.log(`  Administradores activos en total: ${total}`);
    console.log('  Entra por la pantalla de acceso de siempre, con este correo:');
    console.log('    https://<tu-dominio>/sistema-juridico/login\n');
  } catch (error) {
    console.error('\n  Error creando el administrador:', error.message, '\n');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
