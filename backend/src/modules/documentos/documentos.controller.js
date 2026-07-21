const prisma = require('../../config/prisma');
const r2Client = require('../../config/cloudflare');
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Helper to get file extension
const getFileExtension = (filename) => {
  return filename.split('.').pop() || '';
};

// 1. Cargar un nuevo documento (v1)
exports.uploadDocumento = async (req, res) => {
  try {
    const { id_proceso, nombre, categoria, visibilidad } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }

    // Verificar límite global de almacenamiento (9.5 GB)
    const MAX_STORAGE_BYTES = 9.5 * 1024 * 1024 * 1024;
    const currentStorage = await prisma.versionDocumento.aggregate({
      _sum: { tamano_bytes: true }
    });
    const totalStorageUsed = currentStorage._sum.tamano_bytes || 0;
    
    if (totalStorageUsed + req.file.size > MAX_STORAGE_BYTES) {
      return res.status(400).json({ error: 'Límite gratuito de almacenamiento alcanzado (9.5 GB). No se pueden subir más archivos.' });
    }

    const fileExt = getFileExtension(req.file.originalname);
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    // Path: tenant_id/id_proceso/filename
    const folderPath = id_proceso ? id_proceso : 'general';
    const filePath = `documentos-expedientes/${req.tenant_id}/${folderPath}/${fileName}`;

    // Subir archivo a Cloudflare R2
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });
      await r2Client.send(command);
    } catch (uploadError) {
      console.error('Error subiendo archivo a Cloudflare R2:', uploadError);
      return res.status(500).json({ error: 'Error al subir archivo al almacenamiento en la nube' });
    }

    // Crear registros en la base de datos usando transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear registro de Documento
      const doc = await tx.documento.create({
        data: {
          tenant_id: req.tenant_id,
          id_proceso: id_proceso || null,
          nombre: nombre || req.file.originalname,
          categoria: categoria || 'OTRO',
          visibilidad: visibilidad || 'PRIVADO',
          estado: 'ACTIVO',
          subido_por: req.user.id_usuario
        }
      });

      // Crear primer registro de versión (v1)
      const version = await tx.versionDocumento.create({
        data: {
          id_documento: doc.id_documento,
          numero_version: 1,
          url_archivo: filePath,
          nombre_archivo: req.file.originalname,
          tamano_bytes: req.file.size,
          formato: fileExt,
          subido_por: req.user.id_usuario
        }
      });

      // Actualizar id_version_actual
      const updatedDoc = await tx.documento.update({
        where: { id_documento: doc.id_documento },
        data: { id_version_actual: version.id_version },
        include: {
          version_actual: true,
          usuario: { select: { nombre: true } }
        }
      });

      return { documento: updatedDoc, version };
    });

    res.status(201).json({
      message: 'Documento subido y registrado con éxito',
      documento: result.documento
    });
  } catch (error) {
    console.error('Error en uploadDocumento:', error);
    res.status(500).json({ error: 'Error interno del servidor al registrar el documento' });
  }
};

// 2. Subir una nueva versión de un documento existente
exports.uploadNuevaVersion = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo para la nueva versión' });
    }

    // Verificar existencia del documento y pertenencia al tenant
    const doc = await prisma.documento.findFirst({
      where: { id_documento: id, tenant_id: req.tenant_id }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (doc.estado === 'INACTIVO' || doc.estado === 'REEMPLAZADO') {
      return res.status(400).json({ error: 'No se puede subir una nueva versión para un documento inactivo o reemplazado' });
    }

    // Verificar límite global de almacenamiento (9.5 GB)
    const MAX_STORAGE_BYTES = 9.5 * 1024 * 1024 * 1024;
    const currentStorage = await prisma.versionDocumento.aggregate({
      _sum: { tamano_bytes: true }
    });
    const totalStorageUsed = currentStorage._sum.tamano_bytes || 0;
    
    if (totalStorageUsed + req.file.size > MAX_STORAGE_BYTES) {
      return res.status(400).json({ error: 'Límite gratuito de almacenamiento alcanzado (9.5 GB). No se pueden subir más archivos.' });
    }

    // Obtener la última versión
    const ultimaVersion = await prisma.versionDocumento.findFirst({
      where: { id_documento: id },
      orderBy: { numero_version: 'desc' }
    });

    const nextVersionNum = ultimaVersion ? ultimaVersion.numero_version + 1 : 1;
    const fileExt = getFileExtension(req.file.originalname);
    const fileName = `${Date.now()}_v${nextVersionNum}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const folderPath = doc.id_proceso ? doc.id_proceso : 'general';
    const filePath = `documentos-expedientes/${req.tenant_id}/${folderPath}/${fileName}`;

    // Subir el nuevo archivo a Cloudflare R2
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filePath,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });
      await r2Client.send(command);
    } catch (uploadError) {
      console.error('Error subiendo nueva versión a Cloudflare R2:', uploadError);
      return res.status(500).json({ error: 'Error al subir la nueva versión del archivo' });
    }

    // Registrar nueva versión en la BD
    const result = await prisma.$transaction(async (tx) => {
      const version = await tx.versionDocumento.create({
        data: {
          id_documento: id,
          numero_version: nextVersionNum,
          url_archivo: filePath,
          nombre_archivo: req.file.originalname,
          tamano_bytes: req.file.size,
          formato: fileExt,
          subido_por: req.user.id_usuario
        }
      });

      const updatedDoc = await tx.documento.update({
        where: { id_documento: id },
        data: { id_version_actual: version.id_version },
        include: {
          version_actual: true,
          usuario: { select: { nombre: true } }
        }
      });

      return { documento: updatedDoc, version };
    });

    res.status(201).json({
      message: `Nueva versión v${nextVersionNum} subida exitosamente`,
      documento: result.documento
    });
  } catch (error) {
    console.error('Error en uploadNuevaVersion:', error);
    res.status(500).json({ error: 'Error interno al registrar la nueva versión del documento' });
  }
};

// 3. Listar documentos de un proceso específico (HU-14)
exports.getProcesoDocumentos = async (req, res) => {
  try {
    const { id_proceso } = req.params;

    // Verificar si el proceso pertenece al tenant
    const proceso = await prisma.proceso.findFirst({
      where: { id_proceso, tenant_id: req.tenant_id }
    });

    if (!proceso) {
      return res.status(404).json({ error: 'Proceso o expediente no encontrado' });
    }

    // Determinar nivel de acceso para el usuario actual:
    const asignadoAbogado = await prisma.procesoAbogado.findFirst({
      where: { id_proceso, id_usuario: req.user.id_usuario }
    });

    let allowedVisibilities = [];
    let isFullAccess = false;

    if (req.user.rol === 'ADMINISTRADOR' || proceso.id_abogado_resp === req.user.id_usuario) {
      isFullAccess = true;
    } else if (asignadoAbogado) {
      allowedVisibilities = ['VISIBLE_COLAB', 'COMPARTIDO_CLIENTE'];
    } else if (req.user.rol === 'CLIENTE') {
      if (proceso.id_cliente === req.user.id_usuario) {
        allowedVisibilities = ['COMPARTIDO_CLIENTE'];
      } else {
        return res.status(403).json({ error: 'No tienes acceso a los documentos de este expediente' });
      }
    } else {
      return res.status(403).json({ error: 'No tienes acceso a los documentos de este expediente' });
    }

    let queryConditions = {
      id_proceso,
      tenant_id: req.tenant_id,
      estado: { not: 'INACTIVO' }
    };

    if (!isFullAccess) {
      queryConditions.visibilidad = { in: allowedVisibilities };
    }

    const documentos = await prisma.documento.findMany({
      where: queryConditions,
      include: {
        version_actual: true,
        usuario: { select: { nombre: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(documentos);
  } catch (error) {
    console.error('Error en getProcesoDocumentos:', error);
    res.status(500).json({ error: 'Error al obtener los documentos del proceso' });
  }
};

// 4. Obtener historial completo de versiones de un documento
exports.getDocumentoVersiones = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar pertenencia del documento al tenant
    const doc = await prisma.documento.findFirst({
      where: { id_documento: id, tenant_id: req.tenant_id }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado o no pertenece a su consultorio' });
    }

    const versiones = await prisma.versionDocumento.findMany({
      where: { id_documento: id },
      include: {
        usuario: { select: { nombre: true } }
      },
      orderBy: { numero_version: 'desc' }
    });

    res.json(versiones);
  } catch (error) {
    console.error('Error en getDocumentoVersiones:', error);
    res.status(500).json({ error: 'Error al obtener el historial de versiones' });
  }
};

// 5. Descargar/Obtener URL firmada segura para una versión específica de un documento (HU-14)
exports.getVersionDownloadUrl = async (req, res) => {
  try {
    const { id_version } = req.params;

    const version = await prisma.versionDocumento.findFirst({
      where: { id_version },
      include: {
        documento: {
          include: {
            proceso: true
          }
        }
      }
    });

    if (!version || version.documento.tenant_id !== req.tenant_id) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const doc = version.documento;
    const proceso = doc.proceso;

    // Si el documento está asociado a un proceso, validar visibilidad y pertenencia
    if (proceso) {
      const asignadoAbogado = await prisma.procesoAbogado.findFirst({
        where: { id_proceso: proceso.id_proceso, id_usuario: req.user.id_usuario }
      });

      let isAuthorized = false;

      if (req.user.rol === 'ADMINISTRADOR' || proceso.id_abogado_resp === req.user.id_usuario) {
        isAuthorized = true;
      } else if (asignadoAbogado) {
        if (['VISIBLE_COLAB', 'COMPARTIDO_CLIENTE'].includes(doc.visibilidad)) {
          isAuthorized = true;
        }
      } else if (req.user.rol === 'CLIENTE') {
        const cliente = await prisma.cliente.findFirst({
          where: { email: req.user.email, tenant_id: req.tenant_id }
        });
        if (cliente && proceso.id_cliente === cliente.id_cliente) {
          if (doc.visibilidad === 'COMPARTIDO_CLIENTE') {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: 'No tienes autorización para acceder a esta versión de documento.' });
      }
    } else {
      if (req.user.rol === 'CLIENTE') {
        return res.status(403).json({ error: 'No tienes autorización para acceder a este documento general.' });
      }
    }

    // Registrar acción en la bitácora si es un cliente
    if (req.user.rol === 'CLIENTE') {
      await prisma.bitacoraAuditoria.create({
        data: {
          tenant_id: req.tenant_id,
          id_usuario: req.user.id_usuario,
          accion: 'DESCARGAR_DOCUMENTO_CLIENTE',
          modulo: 'PORTAL',
          detalle: `El cliente descargó la versión ${version.numero_version} del documento "${doc.nombre}"`,
          ip_adress: req.ip || '127.0.0.1'
        }
      });
    }

    // Generar URL firmada de 15 minutos en Cloudflare R2
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: version.url_archivo,
      });
      // 15 minutos de validez (900 segundos)
      const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
      res.json({ url: signedUrl, nombre_archivo: version.nombre_archivo });
    } catch (error) {
      console.error('Error generando URL firmada R2:', error);
      return res.status(500).json({ error: 'Error al generar la URL de descarga segura' });
    }
  } catch (error) {
    console.error('Error en getVersionDownloadUrl:', error);
    res.status(500).json({ error: 'Error al procesar la descarga' });
  }
};

// 6. Eliminación lógica de un documento
exports.deleteDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await prisma.documento.findFirst({
      where: { id_documento: id, tenant_id: req.tenant_id }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado o no pertenece a su consultorio' });
    }

    await prisma.documento.update({
      where: { id_documento: id },
      data: { estado: 'INACTIVO' }
    });

    res.json({ message: 'Documento eliminado lógicamente con éxito' });
  } catch (error) {
    console.error('Error en deleteDocumento:', error);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
};

// 7. Modificar el estado del documento (INACTIVO o REEMPLAZADO, bloquea reactivación)
exports.updateDocumentoEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const doc = await prisma.documento.findFirst({
      where: { id_documento: id, tenant_id: req.tenant_id }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado o no pertenece a su consultorio' });
    }

    // Validar estados válidos
    const estadosValidos = ['ACTIVO', 'INACTIVO', 'REEMPLAZADO'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado de documento inválido' });
    }

    // Bloquear reactivación
    if ((doc.estado === 'INACTIVO' || doc.estado === 'REEMPLAZADO') && estado === 'ACTIVO') {
      return res.status(400).json({ error: 'Un documento inactivo o reemplazado no puede ser reactivado' });
    }

    const updatedDoc = await prisma.documento.update({
      where: { id_documento: id },
      data: { estado },
      include: { version_actual: true }
    });

    res.json({
      message: `Estado del documento actualizado a ${estado} con éxito`,
      documento: updatedDoc
    });
  } catch (error) {
    console.error('Error en updateDocumentoEstado:', error);
    res.status(500).json({ error: 'Error al actualizar el estado del documento' });
  }
};

// 8. Eliminación definitiva de un documento (exclusivo Administrador con justificación)
exports.deleteDocumentoDefinitivo = async (req, res) => {
  try {
    const { id } = req.params;
    const { justificacion } = req.body;

    if (req.user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'No autorizado. Se requiere rol de Administrador para eliminación definitiva.' });
    }

    if (!justificacion || justificacion.trim() === '') {
      return res.status(400).json({ error: 'Debe proporcionar una justificación para la eliminación definitiva.' });
    }

    const doc = await prisma.documento.findFirst({
      where: { id_documento: id, tenant_id: req.tenant_id },
      include: { versiones: true }
    });

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado o no pertenece a su consultorio' });
    }

    // Verificar si ha sido utilizado en actuaciones procesales
    // Check 1: Parte procesal vinculada
    const usedInPartes = await prisma.parteProcesal.findFirst({
      where: { id_documento: id }
    });

    // Check 2: Más de 1 versión
    if (usedInPartes || doc.versiones.length > 1) {
      return res.status(400).json({
        error: 'No se permite eliminar definitivamente documentos utilizados en actuaciones procesales o con historial de versiones.'
      });
    }

    const filePaths = doc.versiones.map(v => v.url_archivo);

    // Eliminar archivos físicos de Cloudflare R2
    if (filePaths.length > 0) {
      for (const filePath of filePaths) {
        try {
          const command = new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: filePath,
          });
          await r2Client.send(command);
        } catch (storageError) {
          console.error(`Error eliminando archivo ${filePath} de Cloudflare R2:`, storageError);
          // Opcional: no retornar error aquí si queremos que la DB se borre de todos modos
        }
      }
    }

    // Eliminar registros de la DB en transacción
    await prisma.$transaction(async (tx) => {
      await tx.documento.update({
        where: { id_documento: id },
        data: { id_version_actual: null }
      });
      await tx.versionDocumento.deleteMany({
        where: { id_documento: id }
      });
      await tx.documento.delete({
        where: { id_documento: id }
      });
    });

    // Registrar acción en bitácora de auditoría
    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'ELIMINACION_DEFINITIVA_DOCUMENTO',
        modulo: 'DOCS',
        detalle: `Documento "${doc.nombre}" eliminado definitivamente de forma física. Justificación: ${justificacion}`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.json({ message: 'Documento y versiones eliminados de forma definitiva con éxito' });
  } catch (error) {
    console.error('Error en deleteDocumentoDefinitivo:', error);
    res.status(500).json({ error: 'Error al eliminar el documento definitivamente' });
  }
};
