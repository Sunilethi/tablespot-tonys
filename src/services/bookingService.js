/**
 * The core domain logic of the whole product: does a booking fit, and if
 * not, does it belong on the waitlist. Everything here is pure business
 * logic — no HTTP, no request/response objects — so it can be read (and
 * tested) on its own terms.
 */

const supabase = require('../db/supabaseClient');
const config = require('../config/env');
const { toMinutes, minutesToHHMM, getRestaurantNow } = require('../utils/time');
const { generateBookingId, generateBookingRef } = require('../utils/ref');
const configService = require('./configService');
const emailService = require('./emailService');

/**
 * Total guests already booked (in an active, capacity-counting status)
 * whose stay overlaps the given start time, for one branch/date.
 *
 * "Overlap" means: two bookings whose [start, start+duration) windows
 * intersect at all. A booking that started 15 minutes before this one
 * and hasn't finished yet still occupies real seats right now.
 */
async function guestsOverlappingSlot(branchId, date, startMinutes, durationMinutes, excludeBookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,time,guests')
    .eq('restaurant_id', config.restaurantId)
    .eq('branch_id', branchId)
    .eq('date', date)
    .in('status', config.activeBookingStatuses);
  if (error) throw new Error(error.message);

  const endMinutes = startMinutes + durationMinutes;

  return data.reduce((totalGuests, existingBooking) => {
    if (excludeBookingId && existingBooking.id === excludeBookingId) return totalGuests;
    const existingStart = toMinutes(existingBooking.time);
    const existingEnd = existingStart + durationMinutes;
    const overlaps = existingStart < endMinutes && existingEnd > startMinutes;
    return overlaps ? totalGuests + Number(existingBooking.guests || 0) : totalGuests;
  }, 0);
}

/**
 * Every bookable time slot for a branch/date/party-size, with remaining
 * capacity at each one. A slot with `full: true` isn't hidden — the
 * frontend offers it as a waitlist option instead of refusing it outright.
 */
async function getAvailability(branchId, date, partySize) {
  const restaurantConfig = await configService.getRestaurantConfig();
  const branch = configService.findBranch(restaurantConfig, branchId);
  if (!branch) return { closed: true, slots: [] };

  if (configService.isBranchClosedOnDate(branch, date)) {
    return { closed: true, slots: [] };
  }

  const openMinutes = toMinutes(restaurantConfig.openTime);
  const closeMinutes = toMinutes(restaurantConfig.closeTime);
  const durationMinutes = restaurantConfig.bookingDurationMinutes;
  const intervalMinutes = restaurantConfig.slotIntervalMinutes;

  const restaurantNow = getRestaurantNow();
  const isToday = date === restaurantNow.date;
  const nowMinutes = restaurantNow.hours * 60 + restaurantNow.minutes;

  const slots = [];
  for (let slotStart = openMinutes; slotStart + durationMinutes <= closeMinutes; slotStart += intervalMinutes) {
    if (isToday && slotStart < nowMinutes) continue;
    const capacity = configService.capacityForSlot(branch, date, slotStart);
    const bookedGuests = await guestsOverlappingSlot(branchId, date, slotStart, durationMinutes, null);
    const remaining = capacity - bookedGuests;
    slots.push({
      time: minutesToHHMM(slotStart),
      remaining,
      full: remaining < Number(partySize || 1),
    });
  }

  return { closed: false, slots };
}

/**
 * Creates a booking. If it doesn't fit within capacity, it's saved with
 * status "waitlisted" instead of being rejected — see promoteWaitlist().
 *
 * @param {object} bookingInput - branch, date, time, guests, name, email,
 *   phone, notes, allergy, childSeat, and consent metadata.
 * @param {{ isStaffBooking?: boolean, source?: string }} options
 */
async function createBooking(bookingInput, { isStaffBooking = false, source = 'website' } = {}) {
  const restaurantConfig = await configService.getRestaurantConfig();
  const branch = configService.findBranch(restaurantConfig, bookingInput.branch);
  if (!branch) return { ok: false, error: 'UNKNOWN_BRANCH' };

  if (configService.isBranchClosedOnDate(branch, bookingInput.date)) {
    return { ok: false, error: 'CLOSED' };
  }

  const startMinutes = toMinutes(bookingInput.time);
  const capacity = configService.capacityForSlot(branch, bookingInput.date, startMinutes);
  const bookedGuests = await guestsOverlappingSlot(
    branch.id, bookingInput.date, startMinutes, restaurantConfig.bookingDurationMinutes, null
  );
  const fitsWithinCapacity = bookedGuests + Number(bookingInput.guests) <= capacity;

  const id = generateBookingId();
  const ref = generateBookingRef();
  const status = fitsWithinCapacity ? (isStaffBooking ? 'confirmed' : 'pending') : 'waitlisted';

  const { error: insertError } = await supabase.from('bookings').insert({
    id,
    restaurant_id: config.restaurantId,
    branch_id: branch.id,
    ref,
    date: bookingInput.date,
    time: bookingInput.time,
    guests: bookingInput.guests,
    name: bookingInput.name,
    email: bookingInput.email || '',
    phone: bookingInput.phone || '',
    notes: bookingInput.notes || '',
    allergy: bookingInput.allergy || '',
    child_seat: !!bookingInput.childSeat,
    status,
    source,
    lang: bookingInput.lang === 'de' ? 'de' : 'en',
    staff_notes: '',
    privacy_consent_at: bookingInput.privacyConsentAt || null,
    allergy_consent: !!bookingInput.allergyConsent,
    policy_version: bookingInput.policyVersion || '',
    created_at: new Date().toISOString(),
  });
  if (insertError) throw new Error(insertError.message);

  await notifyAboutNewBooking({
    booking: { ...bookingInput, id, ref, lang: bookingInput.lang === 'de' ? 'de' : 'en' },
    branch,
    replyTo: restaurantConfig.replyToEmail,
    durationMinutes: restaurantConfig.bookingDurationMinutes,
    isWaitlisted: !fitsWithinCapacity,
    notifyStaff: !isStaffBooking, // staff already know — they just created it
  });

  return { ok: true, ref, id, waitlisted: !fitsWithinCapacity };
}

async function notifyAboutNewBooking({ booking, branch, replyTo, durationMinutes, isWaitlisted, notifyStaff }) {
  try {
    if (isWaitlisted) {
      await emailService.sendWaitlistNotice({ booking, branch, replyTo });
    } else {
      await emailService.sendBookingConfirmation({ booking, branch, replyTo, durationMinutes });
    }
    if (notifyStaff) {
      await emailService.sendStaffNotification({ booking, branch, replyTo, isWaitlisted });
    }
  } catch (err) {
    // A failed email must never undo an otherwise-successful booking.
    console.error('Booking notification email failed:', err.message);
  }
}

/**
 * Called after any cancellation or deletion frees up capacity. Walks the
 * waitlist for that branch/date, oldest request first, and promotes
 * anyone who now genuinely fits — emailing them automatically.
 */
async function promoteWaitlist(branchId, date) {
  const restaurantConfig = await configService.getRestaurantConfig();
  const branch = configService.findBranch(restaurantConfig, branchId);
  if (!branch) return;

  const { data: waitlistedBookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('restaurant_id', config.restaurantId)
    .eq('branch_id', branchId)
    .eq('date', date)
    .eq('status', 'waitlisted')
    .order('created_at', { ascending: true });
  if (error || !waitlistedBookings) return;

  for (const booking of waitlistedBookings) {
    const startMinutes = toMinutes(booking.time);
    const capacity = configService.capacityForSlot(branch, date, startMinutes);
    const bookedGuests = await guestsOverlappingSlot(
      branchId, date, startMinutes, restaurantConfig.bookingDurationMinutes, booking.id
    );
    const nowFits = bookedGuests + Number(booking.guests) <= capacity;
    if (!nowFits) continue;

    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);
    try {
      await emailService.sendWaitlistPromotion({
        booking: {
          ref: booking.ref, date: booking.date, time: booking.time,
          guests: booking.guests, name: booking.name, email: booking.email,
          lang: booking.lang === 'de' ? 'de' : 'en',
        },
        branch,
        replyTo: restaurantConfig.replyToEmail,
        durationMinutes: restaurantConfig.bookingDurationMinutes,
      });
    } catch (err) {
      console.error('Waitlist promotion email failed:', err.message);
    }
  }
}

module.exports = {
  getAvailability,
  createBooking,
  promoteWaitlist,
};
