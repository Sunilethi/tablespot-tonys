/**
 * Generates a short, human-readable booking reference like "TNY-7K3PQR".
 * Excludes visually ambiguous characters (0/O, 1/I) on purpose, since
 * guests read these back over the phone.
 */

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REF_LENGTH = 6;
const REF_PREFIX = 'TNY-';

function generateBookingRef() {
  let ref = REF_PREFIX;
  for (let i = 0; i < REF_LENGTH; i++) {
    ref += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  }
  return ref;
}

/** Generates a unique-enough internal booking id (not shown to guests). */
function generateBookingId() {
  return 'b_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
}

module.exports = { generateBookingRef, generateBookingId };
