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

/** Today's date as 'YYYY-MM-DD', in the server's local timezone. */
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { toMinutes, minutesToHHMM, todayISODate };
