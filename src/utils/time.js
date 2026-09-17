/**
 * Small, pure time helpers. No dependencies, easy to unit test in
 * isolation if that's ever added.
 */

/** '19:30' -> 1170 (minutes since midnight) */
function toMinutes(hhmm) {
  const [hours, minutes] = String(hhmm).split(':').map(Number);
  return hours * 60 + minutes;
}

/** 1170 -> '19:30' */
function minutesToHHMM(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

const RESTAURANT_TIMEZONE = 'Europe/Berlin';

/**
 * The current moment, expressed in Europe/Berlin wall-clock time —
 * regardless of what timezone the server process itself is actually
 * running in (cloud hosts commonly default to UTC). Every "is this slot
 * in the past" / "what's today's date" check in the app should go
 * through this, not through the server's raw system clock.
 */
function getRestaurantNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());

  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    // Some environments format midnight as "24" instead of "00" — normalize it.
    hours: map.hour === '24' ? 0 : Number(map.hour),
    minutes: Number(map.minute),
  };
}

/** Today's date as 'YYYY-MM-DD', in the restaurant's own timezone. */
function todayISODate() {
  return getRestaurantNow().date;
}

module.exports = { toMinutes, minutesToHHMM, todayISODate, getRestaurantNow };
