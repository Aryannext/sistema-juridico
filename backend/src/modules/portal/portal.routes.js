const express = require('express');
const router = express.Router();
const portalController = require('./portal.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');

// Ensure client authentication
router.use(authMiddleware);

router.get('/dashboard', portalController.getPortalDashboard);
router.get('/procesos/:id', portalController.getPortalProcesoDetalle);

module.exports = router;
