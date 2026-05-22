require('dotenv').config();
const app = require('./src/app');
const { initRecordatoriosJob } = require('./src/jobs/recordatorios.job');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start the background cron job for reminders
  initRecordatoriosJob();
});

