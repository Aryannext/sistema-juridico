const prisma = require('../../config/prisma');
const { construirCSV } = require('./exportacion');
const { generarInforme, describirPeriodo } = require('./exportacion-pdf');

// Helper to calculate date range based on filter
const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  let start = new Date(1970, 0, 1);
  let end = new Date(now.getFullYear() + 10, 11, 31); // Far future

  if (filter === 'mes') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (filter === 'trimestre') {
    start = new Date();
    start.setMonth(now.getMonth() - 3);
  } else if (filter === 'anio') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (filter === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
};

exports.getStats = async (req, res) => {
  try {
    const { filter, start_date, end_date } = req.query;
    const { start, end } = getDateRange(filter, start_date, end_date);

    // 1. Get process count by status
    const procesosPorEstado = await prisma.proceso.groupBy({
      by: ['estado'],
      where: {
        tenant_id: req.tenant_id,
        create_at: {
          gte: start,
          lte: end
        }
      },
      _count: {
        id_proceso: true
      }
    });

    // 2. Workload by responsible lawyer
    const abogadosTrabajo = await prisma.usuario.findMany({
      where: {
        tenant_id: req.tenant_id,
        rol: { in: ['ABOGADO', 'ADMINISTRADOR'] }
      },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        _count: {
          select: {
            procesos_resp: {
              where: {
                estado: 'ACTIVO',
                create_at: {
                  gte: start,
                  lte: end
                }
              }
            }
          }
        }
      }
    });

    const cargaTrabajo = abogadosTrabajo.map(abogado => ({
      id_usuario: abogado.id_usuario,
      nombre: abogado.nombre,
      email: abogado.email,
      procesos_activos: abogado._count.procesos_resp
    })).sort((a, b) => b.procesos_activos - a.procesos_activos);

    // 3. Semaphore stats (Deadlines / Terminos)
    const terminosPorEstado = await prisma.terminoJudicial.groupBy({
      by: ['estado'],
      where: {
        tenant_id: req.tenant_id,
        created_at: {
          gte: start,
          lte: end
        }
      },
      _count: {
        id_termino: true
      }
    });

    // Critical deadlines
    const terminosCriticos = await prisma.terminoJudicial.count({
      where: {
        tenant_id: req.tenant_id,
        es_critico: true,
        estado: 'PENDIENTE',
        created_at: {
          gte: start,
          lte: end
        }
      }
    });

    // 4. Overdue/Critical terms (under 24h)
    const limit24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const plazosCriticos24h = await prisma.terminoJudicial.count({
      where: {
        tenant_id: req.tenant_id,
        estado: 'PENDIENTE',
        fecha_vencimiento: {
          lte: limit24h,
          gte: new Date()
        }
      }
    });

    const plazosVencidos = await prisma.terminoJudicial.count({
      where: {
        tenant_id: req.tenant_id,
        estado: 'PENDIENTE',
        fecha_vencimiento: {
          lt: new Date()
        }
      }
    });

    // 5. Inactive processes (> 30 days without movement)
    // Find active processes
    const activeProcesos = await prisma.proceso.findMany({
      where: {
        tenant_id: req.tenant_id,
        estado: 'ACTIVO'
      },
      select: {
        id_proceso: true,
        numero_radicado: true,
        tipo_proceso: true,
        update_at: true,
        cliente: {
          select: {
            nombre: true
          }
        },
        abogado_resp: {
          select: {
            nombre: true
          }
        },
        historial: {
          orderBy: { created_at: 'desc' },
          take: 1
        },
        documentos: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });

    const limit30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const procesosInactivos = activeProcesos.filter(proceso => {
      let lastActivityDate = proceso.update_at;

      if (proceso.historial.length > 0 && proceso.historial[0].created_at > lastActivityDate) {
        lastActivityDate = proceso.historial[0].created_at;
      }
      if (proceso.documentos.length > 0 && proceso.documentos[0].created_at > lastActivityDate) {
        lastActivityDate = proceso.documentos[0].created_at;
      }

      return lastActivityDate < limit30Days;
    }).map(proceso => ({
      id_proceso: proceso.id_proceso,
      numero_radicado: proceso.numero_radicado,
      tipo_proceso: proceso.tipo_proceso,
      cliente: proceso.cliente.nombre,
      abogado: proceso.abogado_resp.nombre,
      dias_inactivo: Math.floor((Date.now() - new Date(proceso.update_at).getTime()) / (24 * 60 * 60 * 1000))
    }));

    res.json({
      procesosPorEstado,
      cargaTrabajo,
      terminosPorEstado,
      terminosCriticos,
      plazosCriticos24h,
      plazosVencidos,
      procesosInactivos
    });

  } catch (error) {
    console.error('Error en getStats:', error);
    res.status(500).json({ error: 'Error al generar estadísticas' });
  }
};


exports.exportCSV = async (req, res) => {
  try {
    // Restricted to Admin check
    if (req.user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Permiso denegado. Solo administradores pueden exportar datos del consultorio.' });
    }

    const { filter, start_date, end_date } = req.query;
    const { start, end } = getDateRange(filter, start_date, end_date);
    const enRango = { gte: start, lte: end };

    // La consulta parte del CLIENTE, no del expediente. Antes partía del
    // expediente, y por eso un consultorio con clientes dados de alta pero sin
    // procesos abiertos se descargaba un archivo con solo la cabecera.
    const clientes = await prisma.cliente.findMany({
      where: {
        tenant_id: req.tenant_id,
        // El informe cubre el periodo elegido: entra el cliente que abrió algún
        // expediente dentro del rango, y también el que se dio de alta en el
        // rango aunque todavía no tenga ninguno. Sin esta segunda condición, un
        // consultorio con años de historia que exporta "este mes" recibiría
        // cientos de filas antiguas sin ninguna relación con el periodo.
        OR: [
          { create_at: enRango },
          { procesos: { some: { create_at: enRango } } }
        ]
      },
      select: {
        nombre: true,
        tipo_documento: true,
        numero_documento: true,
        create_at: true,
        procesos: {
          where: { create_at: enRango },
          select: {
            numero_radicado: true,
            tipo_proceso: true,
            estado: true,
            create_at: true,
            abogado_resp: { select: { nombre: true } },
            _count: {
              select: {
                terminos: { where: { estado: 'PENDIENTE' } },
                audiencias: true
              }
            }
          },
          orderBy: { create_at: 'desc' }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    const { csv, totalFilas } = construirCSV(clientes);

    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'EXPORTAR_REPORTES_CSV',
        modulo: 'REPORTES',
        detalle: `Exportó el reporte de clientes y expedientes a CSV (${totalFilas} ${totalFilas === 1 ? 'fila' : 'filas'})`,
        ip_adress: req.ip || '127.0.0.1'
      }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-clientes-expedientes.csv');
    res.status(200).send(csv);

  } catch (error) {
    console.error('Error en exportCSV:', error);
    res.status(500).json({ error: 'Error al exportar datos' });
  }
};

/**
 * Informe de expedientes en PDF — RF42.
 *
 * Reutiliza la misma consulta que la exportación a CSV: si los dos formatos
 * partieran de consultas distintas, podrían acabar diciendo cosas diferentes
 * sobre el mismo periodo.
 */
exports.exportPDF = async (req, res) => {
  try {
    if (req.user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Permiso denegado. Solo administradores pueden exportar datos del consultorio.' });
    }

    const { filter, start_date, end_date } = req.query;
    const { start, end } = getDateRange(filter, start_date, end_date);
    const enRango = { gte: start, lte: end };

    const [consultorio, clientes, porEstado, abogados] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id_tenant: req.tenant_id },
        select: { nombre: true },
      }),
      prisma.cliente.findMany({
        where: {
          tenant_id: req.tenant_id,
          OR: [{ create_at: enRango }, { procesos: { some: { create_at: enRango } } }],
        },
        select: {
          nombre: true,
          procesos: {
            where: { create_at: enRango },
            select: {
              numero_radicado: true,
              estado: true,
              abogado_resp: { select: { nombre: true } },
              _count: { select: { terminos: { where: { estado: 'PENDIENTE' } } } },
            },
            orderBy: { create_at: 'desc' },
          },
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.proceso.groupBy({
        by: ['estado'],
        where: { tenant_id: req.tenant_id, create_at: enRango },
        _count: { id_proceso: true },
      }),
      prisma.usuario.findMany({
        where: { tenant_id: req.tenant_id, rol: { in: ['ADMINISTRADOR', 'ABOGADO'] } },
        select: {
          nombre: true,
          rol: true,
          _count: { select: { procesos_resp: { where: { create_at: enRango } } } },
        },
      }),
    ]);

    // Una fila por expediente; los clientes sin expedientes también aparecen,
    // por la misma razón que en el CSV: tenerlos dados de alta es un dato.
    const filas = [];
    for (const cliente of clientes) {
      if (cliente.procesos.length === 0) {
        filas.push({ cliente: cliente.nombre, radicado: null, responsable: null, estado: 'SIN EXPEDIENTES' });
        continue;
      }
      for (const p of cliente.procesos) {
        filas.push({
          cliente: cliente.nombre,
          radicado: p.numero_radicado,
          responsable: p.abogado_resp ? p.abogado_resp.nombre : null,
          estado: p.estado,
          plazosPendientes: p._count.terminos,
        });
      }
    }

    await prisma.bitacoraAuditoria.create({
      data: {
        tenant_id: req.tenant_id,
        id_usuario: req.user.id_usuario,
        accion: 'EXPORTAR_REPORTES_PDF',
        modulo: 'REPORTES',
        detalle: `Exportó el informe de expedientes a PDF (${filas.length} ${filas.length === 1 ? 'fila' : 'filas'})`,
        ip_adress: req.ip || '127.0.0.1',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=informe-expedientes.pdf');

    generarInforme({
      consultorio: consultorio ? consultorio.nombre : 'Consultorio',
      periodo: describirPeriodo(filter, start_date, end_date),
      generadoPor: req.user.nombre,
      estados: porEstado.map((e) => ({ estado: e.estado, cantidad: e._count.id_proceso })),
      porAbogado: abogados
        .map((a) => ({ nombre: a.nombre, rol: a.rol, procesos: a._count.procesos_resp }))
        .filter((a) => a.procesos > 0),
      filas,
    }, res);
  } catch (error) {
    console.error('Error en exportPDF:', error);
    // Si ya se empezó a escribir el PDF no se puede devolver JSON: la respuesta
    // ya lleva cabeceras de PDF y el cliente recibiría un archivo corrupto.
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al generar el informe en PDF' });
    } else {
      res.end();
    }
  }
};
