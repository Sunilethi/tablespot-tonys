/**
 * All user-facing text for the customer booking flow, in English and
 * German, plus the t(key) lookup helper. Keeping every string in one
 * place (rather than scattered inline in the view files) is what makes
 * it realistic for a non-developer to update wording later without
 * touching rendering logic.
 *
 * Note: the staff/admin dashboard is intentionally English-only for now
 * (see README.md) — only the customer-facing flow is translated.
 */

import { state } from './state.js';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Day-of-week abbreviation in the current customer-facing language. */
export function dayName(index) {
  return (state.lang === 'de' ? DAY_NAMES_DE : DAY_NAMES)[index];
}

export const STATUS_LABELS = [
  'waitlisted', 'pending', 'confirmed', 'arrived', 'seated',
  'completed', 'cancelled', 'no_show',
];

export const T = {
  en: {
    reserve: 'Reserve a table', staff: 'Staff & admin',
    heroEyebrow: "Tony’s — three locations, one table", heroTitle: 'Reserve your table',
    heroBody: "Pick a location, choose a time that works, and you’re booked in seconds.",
    stepBranch: 'Location', stepTime: 'Date & time', stepDetails: 'Your details', stepDone: 'Confirmed',
    chooseBranch: 'Choose a location', chooseBranchHint: 'Availability and opening hours differ by location.',
    closedOn: 'Closed', capacityLabel: 'Seats', hoursLabel: 'Hours',
    dateGuests: 'Date & party size', date: 'Date', guests: 'Guests',
    availableTimes: 'Available times', noTimes: 'No tables available for this date and party size. Try another date or a smaller party.',
    seatsLeft: 'left', full: 'Waitlist',
    yourDetails: 'Your details', name: 'Full name', email: 'Email address', phone: 'Phone number',
    notes: 'Special requests', allergy: 'Allergy / dietary information', childSeat: 'I need a child seat',
    consent: 'I agree to the privacy policy and consent to my details being used to process this reservation.',
    allergyConsent: 'I explicitly consent to the allergy/dietary information above being processed by the kitchen team, solely to prepare my meal safely.',
    allergyConsentRequired: 'Please confirm consent to process the allergy information you entered, or clear that field.',
    privacyPolicyLink: 'Privacy policy',
    back: 'Back', next: 'Continue', confirmBooking: 'Confirm reservation',
    nameRequired: 'Please enter a name.', consentRequired: 'Please accept the privacy policy to continue.',
    slotTaken: 'Sorry — that time just filled up. Please choose another.',
    connectionError: 'Something went wrong reaching the reservation system. Please try again.',
    confirmedTitle: "You’re booked!", confirmedBody: 'A confirmation has been sent to your email. Please keep your reference number for any changes.',
    waitlistedTitle: "You’re on the waitlist", waitlistedBody: "That time was fully booked, so this isn't confirmed yet. If a table frees up you'll be confirmed automatically and emailed right away — no need to do anything.",
    newBooking: 'Make another reservation', loading: 'Checking availability…',
    summaryLocation: 'Location', summaryDate: 'Date', summaryTime: 'Time', summaryGuests: 'Guests', summaryName: 'Name',
    editSelection: 'Edit',
  },
  de: {
    reserve: 'Tisch reservieren', staff: 'Personal & Admin',
    heroEyebrow: 'Tony’s — drei Standorte, ein Tisch', heroTitle: 'Reservieren Sie Ihren Tisch',
    heroBody: 'Wählen Sie einen Standort und eine passende Uhrzeit — in wenigen Sekunden gebucht.',
    stepBranch: 'Standort', stepTime: 'Datum & Uhrzeit', stepDetails: 'Ihre Angaben', stepDone: 'Bestätigt',
    chooseBranch: 'Standort wählen', chooseBranchHint: 'Verfügbarkeit und Öffnungszeiten variieren je Standort.',
    closedOn: 'Geschlossen', capacityLabel: 'Plätze', hoursLabel: 'Öffnungszeiten',
    dateGuests: 'Datum & Personenzahl', date: 'Datum', guests: 'Personen',
    availableTimes: 'Verfügbare Uhrzeiten', noTimes: 'Für dieses Datum und diese Personenzahl ist kein Tisch verfügbar. Bitte anderes Datum oder kleinere Gruppe wählen.',
    seatsLeft: 'frei', full: 'Warteliste',
    yourDetails: 'Ihre Angaben', name: 'Name', email: 'E-Mail-Adresse', phone: 'Telefonnummer',
    notes: 'Besondere Wünsche', allergy: 'Allergien / Ernährungshinweise', childSeat: 'Ich benötige einen Kindersitz',
    consent: 'Ich stimme der Datenschutzerklärung zu und der Verwendung meiner Daten zur Bearbeitung dieser Reservierung.',
    allergyConsent: 'Ich willige ausdrücklich ein, dass die oben angegebenen Allergie-/Ernährungshinweise vom Küchenteam ausschließlich zur sicheren Zubereitung meiner Mahlzeit verarbeitet werden.',
    allergyConsentRequired: 'Bitte bestätigen Sie die Einwilligung zur Verarbeitung der angegebenen Allergiehinweise, oder leeren Sie dieses Feld.',
    privacyPolicyLink: 'Datenschutzerklärung',
    back: 'Zurück', next: 'Weiter', confirmBooking: 'Reservierung bestätigen',
    nameRequired: 'Bitte geben Sie einen Namen ein.', consentRequired: 'Bitte akzeptieren Sie die Datenschutzerklärung.',
    slotTaken: 'Diese Uhrzeit ist leider gerade ausgebucht. Bitte wählen Sie eine andere.',
    connectionError: 'Verbindung zum Reservierungssystem fehlgeschlagen. Bitte erneut versuchen.',
    confirmedTitle: 'Reserviert!', confirmedBody: 'Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet. Bitte bewahren Sie Ihre Referenznummer für Änderungen auf.',
    waitlistedTitle: 'Sie stehen auf der Warteliste', waitlistedBody: 'Diese Uhrzeit war ausgebucht, daher ist dies noch keine Bestätigung. Sobald ein Tisch frei wird, werden Sie automatisch bestätigt und per E-Mail informiert — Sie müssen nichts weiter tun.',
    newBooking: 'Weitere Reservierung', loading: 'Verfügbarkeit wird geprüft…',
    summaryLocation: 'Standort', summaryDate: 'Datum', summaryTime: 'Uhrzeit', summaryGuests: 'Personen', summaryName: 'Name',
    editSelection: 'Ändern',
  },
};

/** Looks up a string in the current UI language, falling back to the key itself. */
export function t(key) {
  return T[state.lang][key] || key;
}
