require('dotenv').config();

// Antes de cargar nada más: con un JWT_SECRET ausente o conocido el servidor no
// debe llegar a escuchar. Ver src/config/entorno.js.
const { validarEntorno } = require('./src/config/entorno');
try {
  validarEntorno();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = require('./src/app');
const { initRecordatoriosJob } = require('./src/jobs/recordatorios.job');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Start the background cron job for reminders
  initRecordatoriosJob();
});
