/**
 * Webhook Service for n8n integration
 * Silently catches errors to prevent breaking the main application flow.
 */
const triggerWebhook = async (eventName, payload) => {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  
  if (!webhookUrl) {
    // If no webhook URL is configured, just silently return.
    return;
  }

  try {
    const data = {
      evento: eventName,
      timestamp: new Date().toISOString(),
      ...payload
    };

    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).catch(err => {
      // Catch async fetch errors silently in the background
      console.error(`[Webhook Error] Falló al enviar evento '${eventName}' a n8n:`, err.message);
    });

  } catch (error) {
    console.error(`[Webhook Error] Falló al preparar evento '${eventName}':`, error.message);
  }
};

module.exports = {
  triggerWebhook
};
