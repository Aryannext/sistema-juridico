/**
 * Redacción del detalle de la bitácora de auditoría.
 *
 * El texto lo lee el administrador de un consultorio, que es abogado y no
 * desarrollador. Antes se escribía la dirección interna de la API
 * ("Acción CREAR realizada en /api/clientes"), que no le dice nada.
 *
 * Estas pruebas fijan que el texto sea legible y que NUNCA reaparezca una ruta.
 */
const { construirDetalle } = require('../middlewares/audit.middleware');

jest.mock('../config/prisma', () => ({ bitacoraAuditoria: { create: jest.fn() } }));

/** Arma una petición como la que ve el middleware ya enrutada. */
function peticion(method, baseUrl, path, body = {}, params = {}) {
  return { method, baseUrl, route: { path }, body, params };
}

describe('Frases por acción', () => {
  it('Nombra al cliente registrado, tomándolo de la respuesta', () => {
    const detalle = construirDetalle(
      peticion('POST', '/api/clientes', '/'),
      'CREAR',
      'CLIENTES',
      { message: 'Cliente registrado exitosamente', cliente: { nombre: 'María Fernanda Rojas' } }
    );
    expect(detalle).toBe('Registró el cliente María Fernanda Rojas');
  });

  it('Usa el cuerpo de la petición cuando la respuesta no trae la entidad', () => {
    const detalle = construirDetalle(
      peticion('PUT', '/api/clientes', '/:id', { nombre: 'Construcciones del Huila' }),
      'EDITAR',
      'CLIENTES',
      { message: 'Cliente actualizado' }
    );
    expect(detalle).toBe('Actualizó los datos del cliente Construcciones del Huila');
  });

  it('Usa el radicado para el expediente, no un identificador interno', () => {
    const detalle = construirDetalle(
      peticion('POST', '/api/procesos', '/'),
      'CREAR',
      'PROCESOS',
      { proceso: { numero_radicado: '41001310300120260014500' } }
    );
    expect(detalle).toBe('Creó el expediente con radicado 41001310300120260014500');
  });

  it('Distingue una subruta de la ruta principal del mismo módulo', () => {
    const detalle = construirDetalle(
      peticion('POST', '/api/procesos', '/:id/partes', { nombre: 'Pedro Gómez', tipo: 'DEMANDADO' }),
      'CREAR',
      'PROCESOS',
      {}
    );
    // No debe confundirse con "creó un expediente"
    expect(detalle).toBe('Registró a Pedro Gómez como demandado en el expediente');
  });

  it('Describe el cambio de estado con el estado nuevo', () => {
    const detalle = construirDetalle(
      peticion('PUT', '/api/procesos', '/:id/estado', { estado: 'ARCHIVADO', justificacion: 'Terminado' }),
      'EDITAR',
      'PROCESOS',
      {}
    );
    expect(detalle).toBe('Cambió el estado del expediente a archivado');
  });

  it('Recorta las anotaciones largas de una actuación', () => {
    const larga = 'A'.repeat(200);
    const detalle = construirDetalle(
      peticion('POST', '/api/actuaciones', '/', { tipo: 'AUTO', anotacion: larga }),
      'CREAR',
      'ACTUACIONES',
      {}
    );
    expect(detalle).toContain('…');
    expect(detalle.length).toBeLessThan(120);
  });

  it('Redacta el borrado definitivo sin depender de ningún dato', () => {
    const detalle = construirDetalle(
      peticion('DELETE', '/api/procesos', '/:id'),
      'ELIMINAR',
      'PROCESOS',
      {}
    );
    expect(detalle).toBe('Eliminó definitivamente un expediente y toda su información');
  });
});

describe('Casos de reserva', () => {
  it('Una ruta sin frase definida sigue siendo legible', () => {
    const detalle = construirDetalle(
      peticion('POST', '/api/loquesea', '/nuevo'),
      'CREAR',
      'CLIENTES',
      {}
    );
    expect(detalle).toBe('Creó un registro en Clientes');
  });

  it('Sin datos identificativos, describe la acción en términos generales', () => {
    const detalle = construirDetalle(
      peticion('POST', '/api/clientes', '/'),
      'CREAR',
      'CLIENTES',
      {}
    );
    expect(detalle).toBe('Registró un cliente nuevo');
  });

  it('Funciona aunque Express no haya dejado la ruta en la petición', () => {
    const detalle = construirDetalle(
      { method: 'POST', baseUrl: '/api/clientes', body: {}, params: {} },
      'CREAR',
      'CLIENTES',
      {}
    );
    expect(detalle).toBe('Creó un registro en Clientes');
  });
});

describe('Ningún detalle puede filtrar rutas de la API', () => {
  const casos = [
    ['POST', '/api/clientes', '/', { nombre: 'Ana' }],
    ['PUT', '/api/procesos', '/:id', { juzgado: 'Juzgado 1' }],
    ['DELETE', '/api/documentos', '/:id/definitivo', {}],
    ['PATCH', '/api/documentos', '/:id/estado', { estado: 'INACTIVO' }],
    ['POST', '/api/terminos', '/', { nombre: 'Contestar demanda' }],
    ['POST', '/api/ruta/desconocida', '/x', {}],
  ];

  it.each(casos)('%s %s%s no menciona /api/', (method, baseUrl, path, body) => {
    const detalle = construirDetalle(
      peticion(method, baseUrl, path, body),
      'CREAR',
      'PROCESOS',
      {}
    );
    expect(detalle).not.toMatch(/\/api\//);
    expect(detalle).not.toMatch(/^Acción /);
  });
});
