/**
 * Floor plan: individual tables that admin positions visually, and that
 * the booking service auto-assigns reservations to.
 *
 * Deliberately decoupled from the booking/capacity logic in two
 * directions:
 *   - Table POSITION (pos_x/pos_y/width/height) is purely cosmetic —
 *     nothing in the booking engine ever reads it. A dragging glitch on
 *     the admin's screen can never corrupt a reservation.
 *   - Table ASSIGNMENT is a best-effort layer on top of the existing,
 *     already-proven capacity/waitlist math (see bookingService.js) —
 *     it never blocks or waitlists a guest by itself. If no single table
 *     fits, the booking still goes through; it's just flagged for staff
 *     to sort out by hand (needs_table_attention).
 */

const supabase = require('../db/supabaseClient');
const config = require('../config/env');
const { toMinutes } = require('../utils/time');

function toTableDTO(row) {
  return {
    id: row.id,
    branch: row.branch_id,
    name: row.name,
    capacity: Number(row.capacity),
    zone: row.zone,
    shape: row.shape,
    x: Number(row.pos_x),
    y: Number(row.pos_y),
    width: Number(row.width),
    height: Number(row.height),
    active: !!row.active,
  };
}

async function listTables(branchId) {
  const { data, error } = await supabase
    .from('restaurant_tables').select('*')
    .eq('restaurant_id', config.restaurantId).eq('branch_id', branchId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map(toTableDTO);
}

async function createTable(branchId, { name, capacity, zone, shape }) {
  const id = 'tbl_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  const { error } = await supabase.from('restaurant_tables').insert({
    id,
    restaurant_id: config.restaurantId,
    branch_id: branchId,
    name: name || 'Table',
    capacity: Number(capacity) || 2,
    zone: zone === 'outdoor' ? 'outdoor' : 'indoor',
    shape: shape === 'round' ? 'round' : 'rect',
    pos_x: 20,
    pos_y: 20,
    width: shape === 'round' ? 70 : 90,
    height: 70,
    active: true,
  });
  if (error) throw new Error(error.message);
  return { ok: true, id };
}

/** Position/size updates (from dragging) and active/zone/capacity edits
 *  all go through this one PATCH — only the fields actually provided are
 *  touched. */
async function updateTable(tableId, fields) {
  const patch = {};
  if (fields.x !== undefined) patch.pos_x = fields.x;
  if (fields.y !== undefined) patch.pos_y = fields.y;
  if (fields.width !== undefined) patch.width = fields.width;
  if (fields.height !== undefined) patch.height = fields.height;
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.capacity !== undefined) patch.capacity = Number(fields.capacity);
  if (fields.zone !== undefined) patch.zone = fields.zone === 'outdoor' ? 'outdoor' : 'indoor';
  if (fields.active !== undefined) patch.active = !!fields.active;

  const { error } = await supabase
    .from('restaurant_tables').update(patch)
    .eq('id', tableId).eq('restaurant_id', config.restaurantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function deleteTable(tableId) {
  const { error } = await supabase
    .from('restaurant_tables').delete()
    .eq('id', tableId).eq('restaurant_id', config.restaurantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * The branch's real seat capacity: the sum of every currently-active
 * table, with outdoor tables counted only when the branch's seasonal
 * "outdoor active" toggle is on. Zero if no tables are set up yet — see
 * the schema file's note on why that's intentional.
 */
async function effectiveCapacity(branchId, outdoorActive) {
  const { data, error } = await supabase
    .from('restaurant_tables').select('capacity,zone,active')
    .eq('restaurant_id', config.restaurantId).eq('branch_id', branchId);
  if (error) throw new Error(error.message);

  return data.reduce((sum, t) => {
    if (!t.active) return sum;
    if (t.zone === 'outdoor' && !outdoorActive) return sum;
    return sum + Number(t.capacity);
  }, 0);
}

/**
 * Finds the smallest active, currently-free table that fits partySize,
 * for a given branch/date/time window. Returns null if nothing fits —
 * callers treat that as "flag for staff," never as a booking failure.
 */
async function findBestFitTable(branchId, date, startMinutes, durationMinutes, partySize, outdoorActive) {
  const { data: tables, error: tablesError } = await supabase
    .from('restaurant_tables').select('*')
    .eq('restaurant_id', config.restaurantId).eq('branch_id', branchId)
    .eq('active', true);
  if (tablesError) throw new Error(tablesError.message);

  const eligibleTables = tables.filter((t) => t.zone !== 'outdoor' || outdoorActive);
  if (eligibleTables.length === 0) return null;

  const { data: bookedRows, error: bookingsError } = await supabase
    .from('bookings').select('time,table_id')
    .eq('restaurant_id', config.restaurantId).eq('branch_id', branchId).eq('date', date)
    .in('status', ['pending', 'confirmed', 'arrived', 'seated'])
    .not('table_id', 'is', null);
  if (bookingsError) throw new Error(bookingsError.message);

  const endMinutes = startMinutes + durationMinutes;
  const occupiedTableIds = new Set(
    bookedRows
      .filter((b) => {
        const bStart = toMinutes(b.time);
        const bEnd = bStart + durationMinutes;
        return bStart < endMinutes && bEnd > startMinutes;
      })
      .map((b) => b.table_id)
  );

  const candidates = eligibleTables
    .filter((t) => !occupiedTableIds.has(t.id) && Number(t.capacity) >= Number(partySize))
    .sort((a, b) => Number(a.capacity) - Number(b.capacity));

  return candidates.length ? toTableDTO(candidates[0]) : null;
}

/**
 * The live status of every table for one date — "free", "occupied" (with
 * which booking), or implicitly flaggable — used to render the staff
 * floor view. Occupancy is checked against every half-open time window
 * booked that day, so a table shows occupied only during its actual
 * booked window(s), not for the whole day.
 */
async function getFloorStatus(branchId, date, durationMinutes) {
  const [{ data: tables, error: tablesError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase.from('restaurant_tables').select('*')
      .eq('restaurant_id', config.restaurantId).eq('branch_id', branchId),
    supabase.from('bookings').select('id,ref,name,guests,time,table_id,status,needs_table_attention')
      .eq('restaurant_id', config.restaurantId).eq('branch_id', branchId).eq('date', date)
      .in('status', ['pending', 'confirmed', 'arrived', 'seated']),
  ]);
  if (tablesError) throw new Error(tablesError.message);
  if (bookingsError) throw new Error(bookingsError.message);

  const nowMinutes = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();

  const bookingsByTable = new Map();
  bookings.forEach((b) => {
    if (!b.table_id) return;
    const start = toMinutes(b.time);
    const end = start + durationMinutes;
    // "Currently occupied" for the live floor view means right now falls
    // inside that booking's held window — not just "booked at some point
    // today."
    if (nowMinutes >= start && nowMinutes < end) {
      bookingsByTable.set(b.table_id, b);
    }
  });

  const flaggedBookings = bookings.filter((b) => b.needs_table_attention);

  return {
    tables: tables.map((t) => {
      const dto = toTableDTO(t);
      const occupyingBooking = bookingsByTable.get(t.id);
      return {
        ...dto,
        status: occupyingBooking ? 'occupied' : 'free',
        booking: occupyingBooking
          ? { id: occupyingBooking.id, ref: occupyingBooking.ref, name: occupyingBooking.name, guests: occupyingBooking.guests, time: occupyingBooking.time }
          : null,
      };
    }),
    flagged: flaggedBookings.map((b) => ({ id: b.id, ref: b.ref, name: b.name, guests: b.guests, time: b.time })),
  };
}

module.exports = {
  listTables,
  createTable,
  updateTable,
  deleteTable,
  effectiveCapacity,
  findBestFitTable,
  getFloorStatus,
};
