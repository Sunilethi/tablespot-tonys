/**
 * Routes for the staff dashboard. Every route here requires a valid staff
 * or admin token; branch-level staff are further restricted to their own
 * branch's data via assertBranchAccess().
 */

const express = require('express');
const supabase = require('../db/supabaseClient');
const config = require('../config/env');
const bookingService = require('../services/bookingService');
const tableService = require('../services/tableService');
const configService = require('../services/configService');
const { toMinutes } = require('../utils/time');
const { requireStaffAuth, assertBranchAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireStaffAuth);

router.get('/bookings', async (req, res) => {
  try {
    const { branchId, date, search } = req.query;

    if (branchId === 'all') {
      if (req.staff.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN' });
    } else if (!assertBranchAccess(req, res, branchId)) {
      return; // assertBranchAccess already sent the 403
    }

    let query = supabase
      .from('bookings')
      .select('*')
      .eq('restaurant_id', config.restaurantId)
      .eq('date', date);
    if (branchId !== 'all') query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const filtered = search ? filterBySearchTerm(data, search) : data;
    filtered.sort((a, b) => String(a.time).localeCompare(String(b.time)));

    res.json(filtered.map(toBookingDTO));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data: rows } = await supabase
      .from('bookings').select('branch_id,date').eq('id', id).eq('restaurant_id', config.restaurantId);
    if (!rows || !rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const { branch_id: branchId, date } = rows[0];
    if (!assertBranchAccess(req, res, branchId)) return;

    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);

    // Cancelling is the one status change that can free up capacity for
    // someone else, so it's the trigger point for waitlist promotion.
    if (status === 'cancelled') await bookingService.promoteWaitlist(branchId, date);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: rows } = await supabase
      .from('bookings').select('branch_id,date').eq('id', id).eq('restaurant_id', config.restaurantId);
    if (!rows || !rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const { branch_id: branchId, date } = rows[0];
    if (!assertBranchAccess(req, res, branchId)) return;

    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await bookingService.promoteWaitlist(branchId, date);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Floor plan (live status, read-only for staff) ----------

router.get('/floor', async (req, res) => {
  try {
    const { branchId, date } = req.query;
    if (!assertBranchAccess(req, res, branchId)) return;

    const restaurantConfig = await configService.getRestaurantConfig();
    const status = await tableService.getFloorStatus(branchId, date, restaurantConfig.bookingDurationMinutes);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lets staff manually retry auto-assignment for a booking that's flagged
// "needs table attention" — e.g. after they've physically rearranged
// tables to make room. Never fails the request if nothing fits; it just
// leaves the flag in place.
router.post('/bookings/:id/reassign-table', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: rows } = await supabase
      .from('bookings').select('*').eq('id', id).eq('restaurant_id', config.restaurantId);
    if (!rows || !rows.length) return res.status(404).json({ error: 'NOT_FOUND' });
    const booking = rows[0];
    if (!assertBranchAccess(req, res, booking.branch_id)) return;

    const restaurantConfig = await configService.getRestaurantConfig();
    const branch = configService.findBranch(restaurantConfig, booking.branch_id);
    const startMinutes = toMinutes(booking.time);

    const bestTable = await tableService.findBestFitTable(
      booking.branch_id, booking.date, startMinutes, restaurantConfig.bookingDurationMinutes,
      booking.guests, branch.outdoorActive
    );

    await supabase.from('bookings').update({
      table_id: bestTable ? bestTable.id : null,
      needs_table_attention: !bestTable,
    }).eq('id', id);

    res.json({ ok: true, assigned: !!bestTable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function filterBySearchTerm(bookings, searchTerm) {
  const term = String(searchTerm).toLowerCase();
  return bookings.filter((booking) =>
    (booking.name || '').toLowerCase().includes(term) ||
    (booking.phone || '').toLowerCase().includes(term) ||
    (booking.ref || '').toLowerCase().includes(term)
  );
}

/** Maps a raw database row (snake_case) to the shape the frontend expects (camelCase). */
function toBookingDTO(row) {
  return {
    id: row.id,
    ref: row.ref,
    branch: row.branch_id,
    date: row.date,
    time: row.time,
    guests: row.guests,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    allergy: row.allergy,
    childSeat: !!row.child_seat,
    status: row.status,
    source: row.source,
    staffNotes: row.staff_notes,
    tableId: row.table_id || null,
    needsTableAttention: !!row.needs_table_attention,
    createdAt: row.created_at,
  };
}

module.exports = router;
