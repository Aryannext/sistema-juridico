const notificacionesController = require('../modules/notificaciones/notificaciones.controller');
const prisma = require('../config/prisma');

jest.mock('../config/prisma', () => ({
  notificacion: {
    findFirst: jest.fn(),
    update: jest.fn()
  },
  usuario: {
    findUnique: jest.fn()
  }
}));

describe('HU-30 y RN02: Gestión de Notificaciones y Cierre de Alertas Críticas', () => {
  let req, res;

  beforeEach(() => {
    req = { 
      params: { id: 'notif-123' }, 
      body: {},
      user: { id_usuario: 'abogado1', rol: 'ABOGADO' },
      tenant_id: 'tenant1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('Debe permitir al destinatario cerrar (gestionar) una alerta crítica (Prioridad ALTA)', async () => {
    prisma.notificacion.findFirst.mockResolvedValue({
      id_notificacion: 'notif-123',
      id_usuario: 'abogado1', // The user matches the recipient
      prioridad: 'ALTA'
    });

    prisma.notificacion.update.mockResolvedValue({ id_notificacion: 'notif-123', leida: true, gestionada: true });

    await notificacionesController.gestionarNotificacion(req, res);

    expect(prisma.notificacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_notificacion: 'notif-123' },
        data: expect.objectContaining({ gestionada: true })
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Alerta(s) gestionada(s)') })
    );
  });

  it('Debe bloquear a un ADMINISTRADOR de cerrar una alerta ALTA de un usuario ACTIVO', async () => {
    req.user.rol = 'ADMINISTRADOR';
    req.user.id_usuario = 'admin1'; // Different user

    prisma.notificacion.findFirst.mockResolvedValue({
      id_notificacion: 'notif-123',
      id_usuario: 'abogado1', // Destinatario original
      prioridad: 'ALTA'
    });

    // Simulamos que el usuario destinatario SÍ está activo
    prisma.usuario.findUnique.mockResolvedValue({ activo: true });

    await notificacionesController.gestionarNotificacion(req, res);

    expect(prisma.notificacion.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Las alertas críticas de prioridad alta solo pueden ser cerradas por su destinatario') })
    );
  });

  it('Debe PERMITIR a un ADMINISTRADOR cerrar una alerta ALTA si el usuario destino está INACTIVO', async () => {
    req.user.rol = 'ADMINISTRADOR';
    req.user.id_usuario = 'admin1';

    prisma.notificacion.findFirst.mockResolvedValue({
      id_notificacion: 'notif-123',
      id_usuario: 'abogadoInactivo',
      prioridad: 'ALTA'
    });

    // Simulamos que el destinatario está inactivo
    prisma.usuario.findUnique.mockResolvedValue({ activo: false });
    prisma.notificacion.update.mockResolvedValue({ id_notificacion: 'notif-123', gestionada: true });

    await notificacionesController.gestionarNotificacion(req, res);

    expect(prisma.notificacion.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Alerta(s) gestionada(s)') })
    );
  });
});
