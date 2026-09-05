const cron = require('node-cron');
const prisma = require('../config/prisma');
const { sendEmail } = require('../config/mailer');
const { prioridadPara, canalesPara } = require('../utils/preferencias-alerta');

/**
 * Avisa a una persona respetando SU preferencia de canal — RF47.1.
 *
 * Antes el aviso salía siempre por correo, sin mirar los ajustes: quien
 * eligiera «solo plataforma» recibía correos igual. Y no existía aviso en
 * plataforma para los recordatorios, solo para la creación del término, así
 * que elegir ese canal equivalía a quedarse sin recordatorio.
 *
 * Un fallo al escribir no interrumpe nada: se traza y se sigue con el
 * siguiente destinatario. Perder un aviso por un correo rebotado sería
 * exactamente lo que este sistema existe para evitar.
 */
async function avisar({ usuario, tenantId, asunto, html, evento, esCritico, referencia }) {
  if (!usuario) return;

  const canales = canalesPara(usuario);
  const prioridad = prioridadPara(usuario, evento, esCritico);

  if (canales.correo && usuario.email) {
    try {
      await sendEmail({ to: usuario.email, subject: asunto, html });
      console.log(`[Cron Job] Aviso por correo a ${usuario.email}`);
    } catch (error) {
      console.error(`[Cron Job] No se pudo escribir a ${usuario.email}:`, error.message);
    }
  }

  if (canales.plataforma) {
    try {
      await prisma.notificacion.create({
        data: {
          tenant_id: tenantId,
          id_usuario: usuario.id_usuario,
          titulo: asunto,
          // El cuerpo del correo es HTML; en la plataforma se guarda el texto.
          mensaje: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
          prioridad,
          referencia_tipo: referencia?.tipo || null,
          id_referencia: referencia?.id || null,
        },
      });
    } catch (error) {
      console.error(`[Cron Job] No se pudo crear la notificación de ${usuario.id_usuario}:`, error.message);
    }
  }
}

// Function that executes the reminder check
const runReminderChecks = async () => {
  const now = new Date();
  console.log(`[Cron Job] Ejecutando verificación de recordatorios judiciales a las: ${now.toLocaleString()}`);

  try {
    // -------------------------------------------------------------
    // 1. PROCESAR RECORDATORIOS DE AUDIENCIAS
    // -------------------------------------------------------------
    const pendingAudienciaAlerts = await prisma.recordatorioAudiencia.findMany({
      where: { enviado: false },
      include: {
        audiencia: {
          include: {
            proceso: {
              include: {
                abogado_resp: true,
                cliente: true,
                // RF29.2: el recordatorio llega TAMBIÉN a los colaboradores
                // asignados. Faltaba: el aviso salía solo para el responsable y
                // el cliente, de modo que quien trabajaba el expediente sin ser
                // su titular no se enteraba de la audiencia. Se descubrió
                // revisando el catálogo contra el código antes de desplegar.
                // Los campos que necesita `avisar`: sin `preferencia_canal` ni
                // las prioridades, cada colaborador recibiría el valor por
                // defecto y la preferencia volvería a no servir de nada.
                abogados: {
                  include: {
                    usuario: {
                      select: {
                        id_usuario: true, email: true, activo: true,
                        preferencia_canal: true,
                        pref_prioridad_audiencia: true,
                        pref_prioridad_termino: true,
                        pref_prioridad_tarea: true,
                      },
                    },
                  },
                }
              }
            }
          }
        }
      }
    });

    for (const alert of pendingAudienciaAlerts) {
      if (!alert.audiencia || !alert.audiencia.proceso) continue;

      const hearingTime = new Date(alert.audiencia.fecha_hora);
      // alertTime = hearingTime - minutos_antes
      const alertTime = new Date(hearingTime.getTime() - alert.minutos_antes * 60 * 1000);

      if (now >= alertTime) {
        // El correo del responsable ya no se usa suelto: los destinatarios se
        // recorren abajo respetando la preferencia de canal de cada uno.
        const clienteEmail = alert.audiencia.proceso.cliente.email;
        const radicado = alert.audiencia.proceso.numero_radicado;
        const hearingName = alert.audiencia.nombre;
        const hearingPlace = alert.audiencia.lugar;
        const hearingType = alert.audiencia.tipo;

        const subject = `🔔 RECORDATORIO: Audiencia Judicial - ${hearingName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
            <h2 style="color: #1a73e8; margin-top: 0;">Recordatorio de Audiencia Judicial</h2>
            <p>Estimado(a) <strong>${alert.audiencia.proceso.abogado_resp.nombre}</strong>,</p>
            <p>Le recordamos que tiene una audiencia programada próximamente:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1; width: 35%;">Expediente / Radicado:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1;">${radicado}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Audiencia:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1;">${hearingName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Tipo:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1;">${hearingType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Fecha y Hora:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1; font-weight: bold; color: #d93025;">${hearingTime.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Lugar / Enlace virtual:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1; color: #1a73e8;">${hearingPlace}</td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #777777; margin-top: 30px;">Este es un mensaje automático generado por el Sistema de Gestión de Procesos de Abogados (SGPA).</p>
          </div>
        `;

        try {
          // Despachar correo a abogado responsable
          // RF29.1 y RF29.2 — al responsable y a los colaboradores asignados.
          // RF47.1 — cada uno por el canal que haya elegido.
          const destinatarios = [
            alert.audiencia.proceso.abogado_resp,
            ...(alert.audiencia.proceso.abogados || []).map((a) => a.usuario),
          ].filter((u) => u && u.activo !== false);

          // Sin repetir a quien figure como responsable y colaborador a la vez.
          const vistos = new Set();
          for (const usuario of destinatarios) {
            if (vistos.has(usuario.id_usuario)) continue;
            vistos.add(usuario.id_usuario);

            await avisar({
              usuario,
              tenantId: alert.audiencia.tenant_id,
              asunto: subject,
              html,
              evento: 'AUDIENCIA',
              referencia: { tipo: 'AUDIENCIA', id: alert.audiencia.id_audiencia },
            });
          }

          // Despachar también a cliente si corresponde
          if (alert.canal === 'AMBOS' || alert.canal === 'EMAIL') {
            try {
              const htmlCliente = html.replace(
                `Estimado(a) <strong>${alert.audiencia.proceso.abogado_resp.nombre}</strong>`,
                `Estimado(a) cliente <strong>${alert.audiencia.proceso.cliente.nombre}</strong>`
              );
              await sendEmail({
                to: clienteEmail,
                subject: `🔔 recordatorio de Audiencia Judicial - ${hearingName}`,
                html: htmlCliente
              });
              console.log(`[Cron Job] Email recordatorio audiencia enviado con éxito a cliente ${clienteEmail}`);
            } catch (errClient) {
              console.error(`[Cron Job] Error al enviar correo de audiencia al cliente ${clienteEmail}:`, errClient.message);
            }
          }

          // Marcar como enviado
          await prisma.recordatorioAudiencia.update({
            where: { id_recordatorio: alert.id_recordatorio },
            data: { enviado: true, fecha_envio: new Date() }
          });
        } catch (emailErr) {
          console.error(`[Cron Job] Error al despachar correo de audiencia ${alert.id_recordatorio}:`, emailErr.message);
        }
      }
    }

    // -------------------------------------------------------------
    // 2. PROCESAR RECORDATORIOS DE TÉRMINOS JUDICIALES
    // -------------------------------------------------------------
    const pendingTerminoAlerts = await prisma.recordatorioTermino.findMany({
      where: { enviado: false },
      include: {
        termino: {
          include: {
            proceso: {
              include: {
                abogado_resp: true,
                cliente: true
              }
            }
          }
        }
      }
    });

    for (const alert of pendingTerminoAlerts) {
      if (!alert.termino || !alert.termino.proceso) continue;

      const alertTime = new Date(alert.fecha_hora_envio);

      if (now >= alertTime) {
        // El correo del responsable ya no se usa suelto: los destinatarios se
        // recorren abajo respetando la preferencia de canal de cada uno.
        const radicado = alert.termino.proceso.numero_radicado;
        const termName = alert.termino.nombre;
        const vDate = new Date(alert.termino.fecha_vencimiento);
        const esCritico = alert.termino.es_critico;

        const subject = `${esCritico ? '🔥 ALERTA CRÍTICA' : '⚠️ ALERTA'}: Vencimiento de Término - ${termName}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; border: 2px solid ${esCritico ? '#d93025' : '#f9ab00'}; padding: 20px; border-radius: 8px;">
            <h2 style="color: ${esCritico ? '#d93025' : '#e67c73'}; margin-top: 0;">Alerta de Término Judicial</h2>
            <p>Estimado(a) <strong>${alert.termino.proceso.abogado_resp.nombre}</strong>,</p>
            <p>Se le notifica que el siguiente plazo o término judicial se encuentra en alerta de vencimiento:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1; width: 35%;">Expediente / Radicado:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1;">${radicado}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Término / Plazo:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1;">${termName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Fecha de Vencimiento:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1; font-weight: bold; color: #d93025;">${vDate.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #f1f1f1;">Prioridad:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f1f1f1;">
                  <span style="background-color: ${esCritico ? '#feecd0' : '#f1f3f4'}; color: ${esCritico ? '#d93025' : '#5f6368'}; font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${esCritico ? 'CRÍTICA / ALTA PRIORIDAD 🔥' : 'NORMAL ⚠️'}
                  </span>
                </td>
              </tr>
            </table>
            <p>Por favor, ingrese lo antes posible al sistema SGPA para gestionar y registrar la resolución correspondiente de este término para evitar sanciones procesales.</p>
            <p style="font-size: 12px; color: #777777; margin-top: 30px;">Este es un mensaje automático de alerta crítica de su sistema SGPA.</p>
          </div>
        `;

        try {
          // RF37.2 — un término CRÍTICO alerta también al Administrador.
          //
          // Se cumplía solo al crear el término, con una notificación en la
          // plataforma. Faltaba aquí, que es cuando importa: el aviso de
          // creación se da semanas antes; el del recordatorio llega con el
          // plazo encima. Un término crítico es aquel cuyo incumplimiento tiene
          // consecuencias procesales, y por eso el requisito quiere un segundo
          // par de ojos justo en ese momento.
          const receptores = [alert.termino.proceso.abogado_resp];

          if (esCritico) {
            const administradores = await prisma.usuario.findMany({
              where: { tenant_id: alert.termino.tenant_id, rol: 'ADMINISTRADOR', activo: true },
              select: {
                id_usuario: true, email: true, activo: true,
                preferencia_canal: true,
                pref_prioridad_audiencia: true,
                pref_prioridad_termino: true,
                pref_prioridad_tarea: true,
              },
            });
            receptores.push(...administradores);
          }

          // RF47.1 — cada uno por su canal. Y `esCritico` fuerza la prioridad
          // ALTA por encima de la preferencia: RF48.2 dice que esas no se
          // silencian, y bajarla sería silenciarla.
          const avisados = new Set();
          for (const usuario of receptores) {
            if (!usuario || avisados.has(usuario.id_usuario)) continue;
            avisados.add(usuario.id_usuario);

            await avisar({
              usuario,
              tenantId: alert.termino.tenant_id,
              asunto: subject,
              html,
              evento: 'TERMINO',
              esCritico,
              referencia: { tipo: 'TERMINO', id: alert.termino.id_termino },
            });
          }

          // Marcar como enviado
          await prisma.recordatorioTermino.update({
            where: { id_recordatorio: alert.id_recordatorio },
            data: { enviado: true, fecha_envio_real: new Date() }
          });
        } catch (emailErr) {
          console.error(`[Cron Job] Error al despachar correo de término ${alert.id_recordatorio}:`, emailErr.message);
        }
      }
    }
  } catch (error) {
    console.error('[Cron Job] Error crítico ejecutando verificador de recordatorios:', error);
  }
};

// Initialize Cron Job
// Run every 15 minutes by default: */15 * * * *
// For dev environment, we schedule it every 15 minutes, but let's expose a function to start it
const initRecordatoriosJob = () => {
  console.log('[Cron Job] Inicializando rutina de alertas y recordatorios cada 15 minutos.');
  cron.schedule('*/15 * * * *', runReminderChecks);
  
  // Run once immediately on start for local testing so developers don't wait 15 minutes!
  setTimeout(() => {
    console.log('[Cron Job] Ejecución de prueba inicial inmediata (Local Dev helper)');
    runReminderChecks();
  }, 5000);
};

module.exports = {
  initRecordatoriosJob,
  runReminderChecks
};
