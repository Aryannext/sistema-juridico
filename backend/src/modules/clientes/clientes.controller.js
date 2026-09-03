const prisma = require('../../config/prisma');
const { triggerWebhook } = require('../../config/webhook');
const { validarCliente } = require('./validacion');

exports.createCliente = async (req, res) => {
  try {
    const { tipo, nombre, razon_social, tipo_documento, numero_documento, nit, representante, telefono, email, direccion, fecha_nacimiento } = req.body;

    // RF06: los campos obligatorios se comprueban aquí, no solo en el
    // navegador. Sin esto, una petición directa a la API llegaba hasta Prisma y
    // devolvía un 500 opaco en vez de decir qué faltaba.
    const { valido, error } = validarCliente(req.body);
    if (!valido) return res.status(400).json({ error });

    // Limitado al consultorio en sesión: una misma persona puede ser cliente de
    // dos oficinas distintas, y el mensaje de error no debe revelar que otro
    // consultorio ya la tiene registrada.
    const existingDoc = await prisma.cliente.findFirst({
      where: { numero_documento, tenant_id: req.tenant_id }
    });
    if (existingDoc) {
      return res.status(400).json({ error: 'Su consultorio ya tiene un cliente con ese número de documento' });
    }

    const cliente = await prisma.cliente.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        tipo,
        nombre,
        razon_social,
        tipo_documento,
        numero_documento,
        nit,
        representante,
        telefono,
        email,
        direccion,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
      }
    });

    // Disparar automatización en n8n sin bloquear la respuesta
    triggerWebhook('NUEVO_CLIENTE', { cliente, usuario_creador: req.user.nombre });

    res.status(201).json({ message: 'Cliente registrado exitosamente', cliente });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error registrando cliente' });
  }
};

exports.getClientes = async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { tenant_id: req.tenant_id },
      orderBy: { create_at: 'desc' }
    });
    res.json(clientes);
  } catch (error) {
    console.error('Error en getClientes:', error);
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
};

exports.getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente: id, tenant_id: req.tenant_id },
      include: {
        procesos: true // Incluye los procesos asociados (HU-06)
      }
    });

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    // Verificar si el cliente ya tiene un usuario creado
    const userAccess = await prisma.usuario.findUnique({
      where: { email: cliente.email }
    });

    res.json({
      ...cliente,
      tiene_acceso_portal: !!userAccess
    });
  } catch (error) {
    console.error('Error en getClienteById:', error);
    res.status(500).json({ error: 'Error obteniendo cliente' });
  }
};

// Campos que el usuario puede modificar. Todo lo demás que venga en el cuerpo
// se descarta. Antes se volcaba `req.body` entero en Prisma, de modo que enviar
// {"tenant_id": "<otro>"} movía el cliente al consultorio ajeno; también se
// podían reescribir `id_usuario` y `create_at`.
const CAMPOS_EDITABLES_CLIENTE = [
  'tipo', 'nombre', 'razon_social', 'tipo_documento', 'numero_documento',
  'nit', 'representante', 'telefono', 'email', 'direccion', 'fecha_nacimiento'
];

exports.updateCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = {};
    for (const campo of CAMPOS_EDITABLES_CLIENTE) {
      if (req.body[campo] !== undefined) updateData[campo] = req.body[campo];
    }
    if (updateData.fecha_nacimiento) {
      updateData.fecha_nacimiento = new Date(updateData.fecha_nacimiento);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No se envió ningún campo modificable' });
    }

    // El documento sigue siendo único dentro del consultorio: hay que verificar
    // que el nuevo valor no choque con otro cliente de la misma oficina.
    if (updateData.numero_documento) {
      const duplicado = await prisma.cliente.findFirst({
        where: {
          numero_documento: updateData.numero_documento,
          tenant_id: req.tenant_id,
          NOT: { id_cliente: id }
        }
      });
      if (duplicado) {
        return res.status(400).json({ error: 'Su consultorio ya tiene un cliente con ese número de documento' });
      }
    }

    const cliente = await prisma.cliente.update({
      where: { id_cliente: id, tenant_id: req.tenant_id },
      data: updateData
    });

    res.json({ message: 'Cliente actualizado', cliente });
  } catch (error) {
    // P2025: el cliente no existe o es de otro consultorio. No es un 500.
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    console.error('Error en updateCliente:', error);
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
};

const crypto = require('crypto');
const { hashPassword } = require('../../utils/bcrypt');
const { generateVerificationToken } = require('../../utils/jwt');
// El correo de primer acceso vive con los demás correos de credenciales, en el
// módulo de recuperación: son la misma plantilla y el mismo mecanismo de enlace
// con token, y tenerlos separados los haría divergir en cuanto alguien toque uno.
const { enviarCorreoPrimerAcceso } = require('../auth/recuperacion.controller');

/**
 * Habilitar el acceso del cliente a su portal — RN02.3, HU-27.
 *
 * **Qué cambió y por qué.** Antes, quien habilitaba el acceso escribía la
 * contraseña del cliente y se la comunicaba. Eso dejaba abierta la prohibición
 * que RN02 declara: *el Administrador no puede suplantar a un cliente en el
 * portal*. El portal comprueba `rol === 'CLIENTE'`, lo que impide entrar con
 * una sesión de administrador, pero no impedía lo evidente —abrir el portal e
 * iniciar sesión con la contraseña que uno mismo acababa de fijar—. La regla se
 * daba por cumplida «de forma indirecta», y esa era exactamente la grieta.
 *
 * Ahora la cuenta nace **sin contraseña utilizable** y el cliente elige la suya
 * desde un enlace que solo llega a su correo. Nadie del despacho la conoce, ni
 * puede verla, ni puede fijarla.
 *
 * **Hasta dónde llega, dicho con precisión.** No impide que alguien con permiso
 * para editar clientes cambie el correo del cliente por el suyo antes de
 * habilitar el acceso. Eso no se cierra con código sino con rastro: las dos
 * operaciones quedan en la bitácora, que es inmutable (RN01). Lo que sí se
 * cierra —y era lo que faltaba— es que el sistema **entregue** una credencial
 * de cliente a alguien que no es el cliente.
 */
exports.createPortalAccess = async (req, res) => {
  try {
    const { id } = req.params;

    // Se rechaza explícitamente en vez de ignorarlo en silencio. Quien envíe
    // una contraseña cree que la está fijando, y podría comunicársela al
    // cliente como si funcionara. Un error ruidoso avisa de que la regla
    // cambió; uno silencioso deja a alguien dictando una clave que no existe.
    if (req.body && req.body.password !== undefined) {
      return res.status(400).json({
        error:
          'La contraseña del portal ya no la fija el despacho: la elige el cliente ' +
          'desde el enlace que recibe por correo. Vuelva a enviar la solicitud sin ese campo.',
        codigo: 'PASSWORD_NO_ADMITIDA'
      });
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id_cliente: id, tenant_id: req.tenant_id }
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Check if Usuario with this email already exists
    const existingUser = await prisma.usuario.findUnique({
      where: { email: cliente.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ya existe un usuario registrado con el correo de este cliente' });
    }

    // `password_hash` no admite nulo, así que la cuenta nace con el hash de un
    // secreto aleatorio que **no se guarda en ninguna parte y nadie llega a
    // ver**. No es una contraseña provisional que haya que comunicar: es una
    // contraseña que no existe. La cuenta no puede usarse hasta que el cliente
    // fije la suya por el enlace.
    const secretoIrrecuperable = crypto.randomBytes(32).toString('hex');
    const token = generateVerificationToken();
    const expira = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUsuario = await prisma.usuario.create({
      data: {
        tenant_id: req.tenant_id,
        nombre: cliente.nombre,
        email: cliente.email,
        password_hash: await hashPassword(secretoIrrecuperable),
        rol: 'CLIENTE',
        activo: true,
        // Se reutilizan los campos de recuperación, no los de verificación:
        // el enlace debe fijar una contraseña, que es lo que hace `restablecer`.
        token_recuperacion: token,
        token_recuperacion_expira: expira
      }
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id_tenant: req.tenant_id },
      select: { nombre: true }
    });

    const correoEnviado = await enviarCorreoPrimerAcceso({
      nombre: cliente.nombre,
      email: cliente.email,
      token,
      nombreConsultorio: tenant?.nombre
    });

    // Auditoria
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'CREAR_ACCESO_PORTAL_CLIENTE',
        modulo: 'CLIENTES',
        detalle:
          `Acceso al portal habilitado para el cliente: ${cliente.nombre} (${cliente.email}). ` +
          `Contraseña fijada por el propio cliente mediante enlace por correo. ` +
          `Envío del correo: ${correoEnviado ? 'correcto' : 'FALLÓ'}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    // La cuenta ya está creada. Si el correo falló NO se devuelve error ni se
    // deshace: el correo del cliente quedaría ocupado y no se podría reintentar
    // la habilitación (mismo defecto que H-28 en el registro). Se informa, y el
    // cliente tiene una segunda vía por su cuenta.
    res.status(201).json({
      message: correoEnviado
        ? `Acceso habilitado. ${cliente.nombre} recibirá un correo para elegir su contraseña.`
        : `Acceso habilitado, pero el correo no pudo enviarse. Pida a ${cliente.nombre} que use ` +
          '«¿Olvidaste tu contraseña?» en la pantalla de acceso.',
      correoEnviado,
      user: {
        id_usuario: newUsuario.id_usuario,
        email: newUsuario.email,
        nombre: newUsuario.nombre,
        rol: newUsuario.rol
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error habilitando acceso al portal del cliente' });
  }
};
