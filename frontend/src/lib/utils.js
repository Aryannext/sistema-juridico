import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha SIN hora (columnas `@db.Date` de Prisma):
 * fecha_radicado, fecha_actuacion, fecha_nacimiento.
 *
 * Estas columnas guardan un día del calendario, no un instante. Prisma las
 * devuelve como medianoche UTC (`2026-06-20T00:00:00.000Z`). Si se formatean
 * con `toLocaleDateString()` a secas, el navegador las convierte a la zona
 * local: en Colombia (UTC-5) esa medianoche cae en las 19:00 del día ANTERIOR
 * y la fecha se muestra con un día menos.
 *
 * En un sistema jurídico eso no es cosmético: de estas fechas dependen los
 * términos procesales. Por eso se fuerza `timeZone: 'UTC'`.
 *
 * ⚠️ NO usar para fechas con hora real (fecha_hora de audiencias,
 * fecha_vencimiento de términos, created_at): esas sí deben mostrarse en la
 * zona horaria del usuario.
 */
export function formatFechaSinHora(valor, respaldo = 'No especificada') {
  if (!valor) return respaldo;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return respaldo;
  return fecha.toLocaleDateString('es-CO', { timeZone: 'UTC' });
}

/** Roles que pueden figurar como abogado responsable de un expediente. */
const ROLES_RESPONSABLES = ['ADMINISTRADOR', 'ABOGADO'];

/**
 * Filtra la lista de usuarios del consultorio dejando solo a quienes pueden
 * ser abogado responsable de un expediente.
 *
 * Los desplegables de "Abogado Responsable" pintaban la lista completa que
 * devuelve `/admin/usuarios`, así que ofrecían también a los colaboradores
 * (ASISTENTE) y a los clientes con acceso al portal. Un asistente no puede
 * responder de un caso ante un juzgado.
 *
 * Los colaboradores sí pueden trabajar en el expediente: se añaden desde el
 * detalle, en Equipo de trabajo, que es una relación distinta.
 */
export function soloAbogadosResponsables(usuarios) {
  if (!Array.isArray(usuarios)) return [];
  return usuarios.filter(
    (u) => ROLES_RESPONSABLES.includes(u.rol) && u.activo !== false
  );
}

/** Nombre del rol tal como debe leerlo el usuario (ver ADR-004). */
export function nombreRol(rol) {
  const NOMBRES = {
    ADMINISTRADOR: 'Administrador',
    ABOGADO: 'Abogado',
    ASISTENTE: 'Colaborador',
    CLIENTE: 'Cliente',
  };
  return NOMBRES[rol] || rol;
}
