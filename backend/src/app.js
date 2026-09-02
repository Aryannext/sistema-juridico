const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// En producción la aplicación corre detrás del Nginx del VPS. Sin esta línea,
// `req.ip` devuelve la dirección del proxy (127.0.0.1) en lugar de la del
// cliente, con dos consecuencias:
//   1. La bitácora de auditoría registraría siempre la misma IP, incumpliendo
//      RF05 y RNF03, que exigen la dirección real de quien realizó la acción.
//   2. El limitador de peticiones agruparía todo el tráfico bajo una sola IP,
//      de modo que un único usuario intensivo podría agotar el cupo de todos.
//
// El valor 1 significa "confía en un único salto de proxy", que es el Nginx
// del host. No se debe poner `true`: aceptaría cualquier X-Forwarded-For y
// permitiría falsear la IP registrada en la auditoría.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

app.use(helmet());
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` to avoid 429 in dev/testing
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const tenantRoutes = require('./modules/tenant/tenant.routes');
const clientesRoutes = require('./modules/clientes/clientes.routes');
const procesosRoutes = require('./modules/procesos/procesos.routes');
const actuacionesRoutes = require('./modules/actuaciones/actuaciones.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const documentosRoutes = require('./modules/documentos/documentos.routes');
const audienciasRoutes = require('./modules/audiencias/audiencias.routes');
const terminosRoutes = require('./modules/terminos/terminos.routes');
const notificacionesRoutes = require('./modules/notificaciones/notificaciones.routes');
const portalRoutes = require('./modules/portal/portal.routes');
const reportesRoutes = require('./modules/reportes/reportes.routes');
const plataformaRoutes = require('./modules/plataforma/plataforma.routes');

app.use('/api/auth', authRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/procesos', procesosRoutes);
app.use('/api/actuaciones', actuacionesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/audiencias', audienciasRoutes);
app.use('/api/terminos', terminosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/reportes', reportesRoutes);

// Administración de la plataforma, no de un consultorio. Va deliberadamente
// aparte: su middleware es otro y sus tokens no dan acceso a expedientes.
app.use('/api/plataforma', plataformaRoutes);




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
