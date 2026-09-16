/**
 * Routes that don't require authentication — the customer-facing booking
 * flow, plus the staff login endpoint itself.
 *
 * POST /bookings is the one exception worth noting: it's reachable
 * without auth (that's how customers book), but it also *recognizes* an
 * optional staff token, upgrading the request to a phone/walk-in booking
 * when one is present and valid. See the inline comment below.
 */

const express = require('express');
const configService = require('../services/configService');
const bookingService = require('../services/bookingService');
const authService = require('../services/authService');
const { tryAuthenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/config', async (req, res) => {
  try {
    const restaurantConfig = await configService.getRestaurantConfig({ includeSecrets: false });
    res.json(restaurantConfig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/availability', async (req, res) => {
  try {
    const { branch, date, guests } = req.query;
    const result = await bookingService.getAvailability(branch, date, Number(guests) || 1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookings', async (req, res) => {
  try {
    const staff = tryAuthenticate(req);
    const isStaffBooking = Boolean(staff);

    // A staff member creating a booking must be acting on their own
    // branch (or be an admin) — this check happens even though the route
    // itself is public, because staff auth here is optional, not absent.
    if (staff && staff.role !== 'admin' && staff.branchId !== req.body.branch) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const source = isStaffBooking
      ? (req.body.source === 'walk_in' ? 'walk_in' : 'phone')
      : 'website';

    const result = await bookingService.createBooking(req.body, { isStaffBooking, source });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/staff/login', async (req, res) => {
  try {
    const { target, pin } = req.body;
    const result = await authService.login(target, pin);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
