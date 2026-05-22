const express = require('express');
const router = express.Router();
const reportesController = require('./reportes.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const requirePermission = require('../../middlewares/roles.middleware');

router.use(authMiddleware);

router.get('/stats', requirePermission('REPORTES', 'LEER'), reportesController.getStats);
router.get('/export/csv', requirePermission('REPORTES', 'LEER'), reportesController.exportCSV);

module.exports = router;
