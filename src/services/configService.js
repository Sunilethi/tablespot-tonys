/**
 * Reads restaurant + branch configuration from the database and shapes it
 * into the format the rest of the app (and the frontend) expects.
 */

const supabase = require('../db/supabaseClient');
const config = require('../config/env');
const { toMinutes } = require('../utils/time');

/**
 * Full config for the restaurant, including every branch.
 * @param {{ includeSecrets?: boolean }} options - when true, includes PINs
 *   (admin_pin, branch pins). Only ever set this for authenticated admin
 *   requests — never for the public-facing config endpoint.
 */
async function getRestaurantConfig({ includeSecrets = false } = {}) {
  const { data: restaurants, error: restaurantError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', config.restaurantId);
  if (restaurantError) throw new Error(restaurantError.message);

  const restaurant = restaurants[0];
  if (!restaurant) {
    throw new Error(
      `Restaurant "${config.restaurantId}" not found — did you run supabase_schema.sql?`
    );
  }

  const { data: branchRows, error: branchError } = await supabase
    .from('branches')
    .select('*')
    .eq('restaurant_id', config.restaurantId)
    .order('name');
  if (branchError) throw new Error(branchError.message);

  const branches = branchRows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    phone: row.phone,
    closedDay: row.closed_day === null || row.closed_day === undefined ? null : Number(row.closed_day),
    capacity: Number(row.capacity),
    blockedDates: row.blocked_dates || [],
    // Each entry: { date, capacity, startTime?, endTime? }. When
    // startTime/endTime are omitted, the override applies to the whole
    // day; when present, it only applies within that time window (e.g.
    // a private event from 18:00-22:00 with a higher capacity, while
    // the rest of the day keeps the branch's normal limit).
    // Array.isArray guards against a branch whose stored value is still
    // in the old whole-day-object format ('{}') from before this schema
    // change — treats it as "no overrides" instead of crashing every
    // page that reads config, which is what happened before this guard
    // existed.
    capacityOverrides: Array.isArray(row.capacity_overrides) ? row.capacity_overrides : [],
    ...(includeSecrets ? { pin: String(row.pin) } : {}),
  }));

  return {
    restaurantName: restaurant.name,
    productBrand: restaurant.product_brand,
    openTime: restaurant.open_time,
    closeTime: restaurant.close_time,
    bookingDurationMinutes: Number(restaurant.booking_duration_minutes),
    slotIntervalMinutes: Number(restaurant.slot_interval_minutes),
    replyToEmail: restaurant.reply_to_email || '',
    privacyPolicyUrl: restaurant.privacy_policy_url || '',
    branches,
    ...(includeSecrets ? { adminPin: restaurant.admin_pin } : {}),
  };
}

function findBranch(restaurantConfig, branchId) {
  return restaurantConfig.branches.find((branch) => branch.id === branchId) || null;
}

/**
 * The effective seat capacity for a branch at a specific date + time
 * (given as minutes since midnight). Checks event overrides for that
 * date, preferring the most specific match: a time-windowed override
 * that actually covers this slot start time, falling back to a
 * whole-day override (one with no startTime/endTime), falling back to
 * the branch's normal standing capacity.
 */
function capacityForSlot(branch, date, slotStartMinutes) {
  const overridesForDate = (branch.capacityOverrides || []).filter((o) => o.date === date);

  const windowed = overridesForDate.find((o) => {
    if (!o.startTime || !o.endTime) return false;
    const start = toMinutes(o.startTime);
    const end = toMinutes(o.endTime);
    return slotStartMinutes >= start && slotStartMinutes < end;
  });
  if (windowed) return windowed.capacity;

  const wholeDay = overridesForDate.find((o) => !o.startTime || !o.endTime);
  if (wholeDay) return wholeDay.capacity;

  return branch.capacity;
}

function isBranchClosedOnDate(branch, date) {
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();
  // Number(...) on both sides guards against a stored value that's a
  // string ("2") instead of a number (2) — strict equality would treat
  // those as never matching, silently disabling the weekly closure.
  const closedByWeeklySchedule = branch.closedDay !== null && Number(branch.closedDay) === dayOfWeek;
  const closedByBlockedDate = branch.blockedDates.includes(date);
  return closedByWeeklySchedule || closedByBlockedDate;
}

async function updateBranchSettings(branchId, { capacity, closedDay, pin, blockedDates, capacityOverrides }) {
  const { error } = await supabase
    .from('branches')
    .update({
      capacity,
      closed_day: closedDay === null ? null : closedDay,
      pin,
      blocked_dates: blockedDates,
      capacity_overrides: capacityOverrides,
    })
    .eq('id', branchId)
    .eq('restaurant_id', config.restaurantId);
  if (error) throw new Error(error.message);
}

async function updateGlobalSettings({ openTime, closeTime, bookingDurationMinutes, slotIntervalMinutes, adminPin }) {
  const { error } = await supabase
    .from('restaurants')
    .update({
      open_time: openTime,
      close_time: closeTime,
      booking_duration_minutes: bookingDurationMinutes,
      slot_interval_minutes: slotIntervalMinutes,
      admin_pin: adminPin,
    })
    .eq('id', config.restaurantId);
  if (error) throw new Error(error.message);
}

module.exports = {
  getRestaurantConfig,
  findBranch,
  capacityForSlot,
  isBranchClosedOnDate,
  updateBranchSettings,
  updateGlobalSettings,
};
