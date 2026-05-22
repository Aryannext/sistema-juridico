const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const tenantRoutes = require('./modules/tenant/tenant.routes');
const clientesRoutes = require('./modules/clientes/clientes.routes');
const procesosRoutes = require('./modules/procesos/procesos.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const documentosRoutes = require('./modules/documentos/documentos.routes');
const audienciasRoutes = require('./modules/audiencias/audiencias.routes');
const terminosRoutes = require('./modules/terminos/terminos.routes');

app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/procesos', procesosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/audiencias', audienciasRoutes);
app.use('/api/terminos', terminosRoutes);




// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'SGPA API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

module.exports = app;
