/**
 * All outgoing email lives here. Each email "type" is a named function
 * that builds its own subject/body in the guest's language — makes it
 * easy to find and edit the wording for any specific message without
 * hunting through route logic.
 *
 * Language: every booking stores which language the guest used on the
 * website (`lang`, 'en' or 'de'), and every email to that guest is sent
 * in that same language — including the waitlist-promotion email, which
 * may go out days later, which is why `lang` is persisted on the booking
 * row rather than just passed around in memory.
 */

const config = require('../config/env');
const { buildCalendarAssets } = require('../utils/calendar');

async function sendEmail({ to, subject, text, replyTo, attachments }) {
  if (!config.resendApiKey || !to) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.resendApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [to],
        subject,
        text,
        reply_to: replyTo || undefined,
        attachments: attachments || undefined,
      }),
    });
  } catch (err) {
    // Email delivery must never block or fail a booking — log and move on.
    console.error('Email send failed:', err.message);
  }
}

function isGerman(lang) {
  return lang === 'de';
}

// ---------- Booking confirmed (fits within capacity) ----------

function confirmationText(lang, booking, branch, calendarLink, replyTo) {
  const contactLine = isGerman(lang)
    ? `Fragen zu Ihrer Reservierung? Rufen Sie uns an: ${branch.phone || '—'} oder schreiben Sie an ${replyTo}.\n\n`
    : `Questions about your reservation? Call us on ${branch.phone || '—'} or email ${replyTo}.\n\n`;

  if (isGerman(lang)) {
    return (
      `Hallo ${booking.name},\n\n` +
      `Ihr Tisch ist reserviert:\n\n` +
      `${branch.name} (${branch.city})\n` +
      `Datum: ${booking.date}\n` +
      `Uhrzeit: ${booking.time}\n` +
      `Personen: ${booking.guests}\n` +
      `Referenz: ${booking.ref}\n\n` +
      `Zum Kalender hinzufügen: ${calendarLink}\n` +
      `(Die .ics-Datei im Anhang funktioniert auch mit Apple Kalender und Outlook.)\n\n` +
      contactLine +
      `Bis bald!\nTony's`
    );
  }
  return (
    `Hi ${booking.name},\n\n` +
    `Your table is booked:\n\n` +
    `${branch.name} (${branch.city})\n` +
    `Date: ${booking.date}\n` +
    `Time: ${booking.time}\n` +
    `Guests: ${booking.guests}\n` +
    `Reference: ${booking.ref}\n\n` +
    `Add to calendar: ${calendarLink}\n` +
    `(The attached .ics file also works with Apple Calendar and Outlook.)\n\n` +
    contactLine +
    `See you soon!\nTony's`
  );
}

async function sendBookingConfirmation({ booking, branch, replyTo, durationMinutes }) {
  if (!booking.email) return;
  const { googleCalendarLink, icsAttachment } = buildCalendarAssets({ booking, branch, durationMinutes });
  const subject = isGerman(booking.lang)
    ? `Ihre Reservierung bei ${branch.name} — ${booking.date} ${booking.time}`
    : `Your reservation at ${branch.name} — ${booking.date} ${booking.time}`;
  await sendEmail({
    to: booking.email,
    replyTo,
    subject,
    text: confirmationText(booking.lang, booking, branch, googleCalendarLink, replyTo),
    attachments: [icsAttachment],
  });
}

// ---------- Waitlisted (over capacity when booked) ----------

function waitlistText(lang, booking, branch) {
  if (isGerman(lang)) {
    return (
      `Hallo ${booking.name},\n\n` +
      `Diese Uhrzeit ist derzeit ausgebucht, daher wurden Sie auf die Warteliste gesetzt — dies ist NOCH KEINE Bestätigung:\n\n` +
      `${branch.name} (${branch.city})\n` +
      `Datum: ${booking.date}\n` +
      `Gewünschte Uhrzeit: ${booking.time}\n` +
      `Personen: ${booking.guests}\n` +
      `Referenz: ${booking.ref}\n\n` +
      `Sobald ein Tisch frei wird, werden Sie automatisch bestätigt und erhalten eine weitere E-Mail — Sie müssen nichts weiter tun.\n\n` +
      `Tony's`
    );
  }
  return (
    `Hi ${booking.name},\n\n` +
    `That time is fully booked right now, so you've been added to the waitlist — this is NOT a confirmed table yet:\n\n` +
    `${branch.name} (${branch.city})\n` +
    `Date: ${booking.date}\n` +
    `Requested time: ${booking.time}\n` +
    `Guests: ${booking.guests}\n` +
    `Reference: ${booking.ref}\n\n` +
    `If a table frees up, you'll be confirmed automatically and get a follow-up email — no need to do anything.\n\n` +
    `Tony's`
  );
}

async function sendWaitlistNotice({ booking, branch, replyTo }) {
  if (!booking.email) return;
  const subject = isGerman(booking.lang)
    ? `Sie stehen auf der Warteliste bei ${branch.name} — ${booking.date} ${booking.time}`
    : `You're on the waitlist at ${branch.name} — ${booking.date} ${booking.time}`;
  await sendEmail({ to: booking.email, replyTo, subject, text: waitlistText(booking.lang, booking, branch) });
}

// ---------- Waitlist promoted to confirmed ----------

function promotionText(lang, booking, branch, calendarLink, replyTo) {
  const contactLine = isGerman(lang)
    ? `Fragen zu Ihrer Reservierung? Rufen Sie uns an: ${branch.phone || '—'} oder schreiben Sie an ${replyTo}.\n\n`
    : `Questions about your reservation? Call us on ${branch.phone || '—'} or email ${replyTo}.\n\n`;

  if (isGerman(lang)) {
    return (
      `Hallo ${booking.name},\n\n` +
      `Ein Tisch ist frei geworden — Ihre Reservierung von der Warteliste ist jetzt bestätigt:\n\n` +
      `${branch.name} (${branch.city})\n` +
      `Datum: ${booking.date}\n` +
      `Uhrzeit: ${booking.time}\n` +
      `Personen: ${booking.guests}\n` +
      `Referenz: ${booking.ref}\n\n` +
      `Zum Kalender hinzufügen: ${calendarLink}\n\n` +
      contactLine +
      `Bis bald!\nTony's`
    );
  }
  return (
    `Hi ${booking.name},\n\n` +
    `A table just opened up and your waitlisted reservation is now confirmed:\n\n` +
    `${branch.name} (${branch.city})\n` +
    `Date: ${booking.date}\n` +
    `Time: ${booking.time}\n` +
    `Guests: ${booking.guests}\n` +
    `Reference: ${booking.ref}\n\n` +
    `Add to calendar: ${calendarLink}\n\n` +
    contactLine +
    `See you soon!\nTony's`
  );
}

async function sendWaitlistPromotion({ booking, branch, replyTo, durationMinutes }) {
  if (!booking.email) return;
  const { googleCalendarLink, icsAttachment } = buildCalendarAssets({ booking, branch, durationMinutes });
  const subject = isGerman(booking.lang)
    ? `Gute Nachricht — Ihr Tisch bei ${branch.name} ist bestätigt`
    : `Good news — your table at ${branch.name} is confirmed`;
  await sendEmail({
    to: booking.email,
    replyTo,
    subject,
    text: promotionText(booking.lang, booking, branch, googleCalendarLink, replyTo),
    attachments: [icsAttachment],
  });
}

// ---------- Internal staff notification (always English — staff-facing) ----------

async function sendStaffNotification({ booking, branch, replyTo, isWaitlisted }) {
  const tag = isWaitlisted ? `[${branch.city} — WAITLIST]` : `[${branch.city}]`;
  await sendEmail({
    to: replyTo,
    replyTo,
    subject: `${tag} New reservation — ${booking.name}, ${booking.time}`,
    text:
      (isWaitlisted ? 'WAITLISTED (over capacity) — will auto-confirm if a table frees up.\n\n' : '') +
      `Branch: ${branch.name} (${branch.city})\n` +
      `Date: ${booking.date}\n` +
      `Time: ${booking.time}\n` +
      `Guests: ${booking.guests}\n` +
      `Name: ${booking.name}\n` +
      `Phone: ${booking.phone || '—'}\n` +
      `Email: ${booking.email || '—'}\n` +
      `Notes: ${booking.notes || '—'}\n` +
      `Allergy: ${booking.allergy || '—'}\n` +
      `Child seat: ${booking.childSeat ? 'Yes' : 'No'}\n` +
      `Reference: ${booking.ref}`,
  });
}

module.exports = {
  sendBookingConfirmation,
  sendWaitlistNotice,
  sendWaitlistPromotion,
  sendStaffNotification,
};
