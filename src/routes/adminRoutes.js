/**
 * Admin-only routes: changing branch/restaurant settings, and reading the
 * one config payload that includes PINs (never exposed on the public
 * /api/config route).
 */

const express = require('express');
const configService = require('../services/configService');
const { requireStaffAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireStaffAuth, requireAdmin);

router.get('/config', async (req, res) => {
  try {
    const fullConfig = await configService.getRestaurantConfig({ includeSecrets: true });
    res.json(fullConfig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/branches/:id', async (req, res) => {
  try {
    await configService.updateBranchSettings(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    await configService.updateGlobalSettings(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
