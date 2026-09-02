/**
 * Datos de prueba para desarrollo local.
 *
 * NO ejecutar contra la base de datos de producción.
 * Solo crea registros si la base está vacía, para no duplicar nada.
 *
 * Uso:  node prisma/seed-dev.js
 */
require('dotenv').config();
const prisma = require('../src/config/prisma');
const { hashPassword } = require('../src/utils/bcrypt');

const EMAIL = 'admin@demo.local';
const PASSWORD = 'Demo1234*';

async function main() {
  const yaHayDatos = await prisma.tenant.count();
  if (yaHayDatos > 0) {
    console.log('La base ya tiene datos. No se siembra nada.');
    return;
  }

  const tenant = await prisma.tenant.create({
    data: {
      nombre: 'Consultorio Jurídico Demo',
      tipo: 'CONSULTORIO',
      email_admin: EMAIL,
      ciudad: 'Neiva',
      activo: true
    }
  });

  const admin = await prisma.usuario.create({
    data: {
      tenant_id: tenant.id_tenant,
      nombre: 'Administrador Demo',
      email: EMAIL,
      password_hash: await hashPassword(PASSWORD),
      rol: 'ADMINISTRADOR',
      activo: true
    }
  });

  const cliente = await prisma.cliente.create({
    data: {
      tenant_id: tenant.id_tenant,
      tipo: 'NATURAL',
      nombre: 'María Fernanda Rojas',
      tipo_documento: 'CC',
      numero_documento: '1075123456',
      telefono: '3001234567',
      email: 'maria.rojas@demo.local',
      id_usuario: admin.id_usuario
    }
  });

  const proceso = await prisma.proceso.create({
    data: {
      tenant_id: tenant.id_tenant,
      numero_radicado: '41001310300120260014500',
      juzgado: 'JUZGADO 001 CIVIL DEL CIRCUITO DE NEIVA',
      tipo_proceso: 'ORDINARIO',
      clase_proceso: 'CIVIL',
      area_derecho: 'Civil',
      estado: 'ACTIVO',
      fecha_radicado: new Date('2026-03-10'),
      id_cliente: cliente.id_cliente,
      id_abogado_resp: admin.id_usuario
    }
  });

  console.log('Datos de prueba creados:');
  console.log('  correo      :', EMAIL);
  console.log('  contraseña  :', PASSWORD);
  console.log('  id_proceso  :', proceso.id_proceso);
  console.log('  radicado    :', proceso.numero_radicado);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
