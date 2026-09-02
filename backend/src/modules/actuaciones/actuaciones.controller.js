const prisma = require('../../config/prisma');

// Catálogo cerrado de tipos de actuación (debe coincidir con el enum TipoActuacion)
const TIPOS_VALIDOS = [
  'AUTO', 'SENTENCIA', 'NOTIFICACION', 'AUDIENCIA', 'MEMORIAL',
  'DEMANDA', 'CONTESTACION', 'RECURSO', 'TRASLADO', 'OTRO'
];

// Verifica que el expediente exista y pertenezca al tenant del usuario en sesión
const getProcesoDelTenant = async (id_proceso, tenant_id) => {
  return prisma.proceso.findFirst({ where: { id_proceso, tenant_id } });
};

// 1. Registrar una actuación procesal en el expediente (HU-37)
exports.createActuacion = async (req, res) => {
  try {
    const { id_proceso, fecha_actuacion, tipo, anotacion } = req.body;

    if (!id_proceso || !fecha_actuacion || !tipo || !anotacion || !anotacion.trim()) {
      return res.status(400).json({
        error: 'El expediente, la fecha, el tipo de actuación y la anotación son obligatorios.'
      });
    }

    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo de actuación inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}.`
      });
    }

    const proceso = await getProcesoDelTenant(id_proceso, req.tenant_id);
    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado o no pertenece a su consultorio' });
    }

    const actuacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.actuacion.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso,
          fecha_actuacion: new Date(fecha_actuacion),
          tipo,
          anotacion: anotacion.trim(),
          registrado_por: req.user.id_usuario
        }
      });

      // La actuación es un hecho del expediente: queda en su historial (RF14)
      await tx.historialProceso.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso,
          campo_modificado: 'actuaciones',
          valor_nuevo: `${tipo}: ${anotacion.trim()}`,
          accion: 'REGISTRO_ACTUACION',
          realizado_por: req.user.id_usuario
        }
      });

      return creada;
    });

    res.status(201).json({ message: 'Actuación procesal registrada exitosamente', actuacion });
  } catch (error) {
    console.error('Error en createActuacion:', error);
    res.status(500).json({ error: 'Error al registrar la actuación procesal' });
  }
};

// 2. Listar las actuaciones de un expediente, en orden cronológico inverso (HU-37)
exports.getActuacionesProceso = async (req, res) => {
  try {
    const { id_proceso } = req.params;

    const proceso = await getProcesoDelTenant(id_proceso, req.tenant_id);
    if (!proceso) {
      return res.status(404).json({ error: 'Expediente no encontrado' });
    }

    const actuaciones = await prisma.actuacion.findMany({
      where: { id_proceso, tenant_id: req.tenant_id },
      include: {
        usuario: { select: { nombre: true } },
        // Términos que nacieron de cada actuación: cierra la cadena
        // actuación -> término -> alerta
        terminos: {
          select: {
            id_termino: true,
            nombre: true,
            fecha_vencimiento: true,
            estado: true,
            es_critico: true
          },
          orderBy: { fecha_vencimiento: 'asc' }
        }
      },
      orderBy: [{ fecha_actuacion: 'desc' }, { fecha_registro: 'desc' }]
    });

    res.json(actuaciones);
  } catch (error) {
    console.error('Error en getActuacionesProceso:', error);
    res.status(500).json({ error: 'Error al obtener las actuaciones del expediente' });
  }
};

// 3. Corregir una actuación mal digitada (HU-37)
exports.updateActuacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_actuacion, tipo, anotacion } = req.body;

    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({
        error: `Tipo de actuación inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}.`
      });
    }

    const existente = await prisma.actuacion.findFirst({
      where: { id_actuacion: id, tenant_id: req.tenant_id }
    });

    if (!existente) {
      return res.status(404).json({ error: 'Actuación no encontrada' });
    }

    const actuacion = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.actuacion.update({
        where: { id_actuacion: id },
        data: {
          ...(fecha_actuacion && { fecha_actuacion: new Date(fecha_actuacion) }),
          ...(tipo && { tipo }),
          ...(anotacion && anotacion.trim() && { anotacion: anotacion.trim() })
        }
      });

      await tx.historialProceso.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso: existente.id_proceso,
          campo_modificado: 'actuaciones',
          valor_anterior: `${existente.tipo}: ${existente.anotacion}`,
          valor_nuevo: `${actualizada.tipo}: ${actualizada.anotacion}`,
          accion: 'CORRECCION_ACTUACION',
          realizado_por: req.user.id_usuario
        }
      });

      return actualizada;
    });

    res.json({ message: 'Actuación actualizada', actuacion });
  } catch (error) {
    console.error('Error en updateActuacion:', error);
    res.status(500).json({ error: 'Error al actualizar la actuación procesal' });
  }
};

// 4. Eliminar una actuación (solo ADMINISTRADOR y sin términos asociados)
exports.deleteActuacion = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({
        error: 'Acceso denegado. Solo el Administrador puede eliminar una actuación procesal.'
      });
    }

    const existente = await prisma.actuacion.findFirst({
      where: { id_actuacion: id, tenant_id: req.tenant_id },
      include: { terminos: { select: { id_termino: true } } }
    });

    if (!existente) {
      return res.status(404).json({ error: 'Actuación no encontrada' });
    }

    // Integridad referencial (RNF10): no dejar términos huérfanos de su origen
    if (existente.terminos.length > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar la actuación: tiene términos judiciales asociados. Gestione o reasigne esos términos primero.',
        terminosAsociados: existente.terminos.length
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.actuacion.delete({ where: { id_actuacion: id } });

      await tx.historialProceso.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso: existente.id_proceso,
          campo_modificado: 'actuaciones',
          valor_anterior: `${existente.tipo}: ${existente.anotacion}`,
          accion: 'ELIMINACION_ACTUACION',
          realizado_por: req.user.id_usuario
        }
      });
    });

    res.json({ message: 'Actuación eliminada con éxito' });
  } catch (error) {
    console.error('Error en deleteActuacion:', error);
    res.status(500).json({ error: 'Error al eliminar la actuación procesal' });
  }
};
