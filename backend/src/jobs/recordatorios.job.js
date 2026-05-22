const cron = require('node-cron');
const prisma = require('../config/prisma');
const { sendEmail } = require('../config/mailer');

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
                cliente: true
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
        const abogadoEmail = alert.audiencia.proceso.abogado_resp.email;
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
          await sendEmail({ to: abogadoEmail, subject, html });
          console.log(`[Cron Job] Email recordatorio audiencia enviado con éxito a abogado ${abogadoEmail}`);

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
        const abogadoEmail = alert.termino.proceso.abogado_resp.email;
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
          await sendEmail({ to: abogadoEmail, subject, html });
          console.log(`[Cron Job] Email alerta término enviado con éxito a abogado ${abogadoEmail}`);

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
