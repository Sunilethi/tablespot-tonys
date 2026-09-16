/**
 * All outgoing email lives here. Each email "type" is a named function
 * that builds its own subject/body — makes it easy to find and edit the
 * wording for any specific message without hunting through route logic.
 */

const config = require('../config/env');

async function sendEmail({ to, subject, text, replyTo }) {
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
      }),
    });
  } catch (err) {
    // Email delivery must never block or fail a booking — log and move on.
    console.error('Email send failed:', err.message);
  }
}

async function sendBookingConfirmation({ booking, branch, replyTo }) {
  if (!booking.email) return;
  await sendEmail({
    to: booking.email,
    replyTo,
    subject: `Your reservation at ${branch.name} — ${booking.date} ${booking.time}`,
    text:
      `Hi ${booking.name},\n\n` +
      `Your table is booked:\n\n` +
      `${branch.name} (${branch.city})\n` +
      `Date: ${booking.date}\n` +
      `Time: ${booking.time}\n` +
      `Guests: ${booking.guests}\n` +
      `Reference: ${booking.ref}\n\n` +
      `Need to change or cancel? Reply to this email or call the restaurant, quoting your reference.\n\n` +
      `See you soon!\nTony's`,
  });
}

async function sendWaitlistNotice({ booking, branch, replyTo }) {
  if (!booking.email) return;
  await sendEmail({
    to: booking.email,
    replyTo,
    subject: `You're on the waitlist at ${branch.name} — ${booking.date} ${booking.time}`,
    text:
      `Hi ${booking.name},\n\n` +
      `That time is fully booked right now, so you've been added to the waitlist — this is NOT a confirmed table yet:\n\n` +
      `${branch.name} (${branch.city})\n` +
      `Date: ${booking.date}\n` +
      `Requested time: ${booking.time}\n` +
      `Guests: ${booking.guests}\n` +
      `Reference: ${booking.ref}\n\n` +
      `If a table frees up, you'll be confirmed automatically and get a follow-up email — no need to do anything.\n\n` +
      `Tony's`,
  });
}

async function sendWaitlistPromotion({ booking, branch, replyTo }) {
  if (!booking.email) return;
  await sendEmail({
    to: booking.email,
    replyTo,
    subject: `Good news — your table at ${branch.name} is confirmed`,
    text:
      `Hi ${booking.name},\n\n` +
      `A table just opened up and your waitlisted reservation is now confirmed:\n\n` +
      `${branch.name} (${branch.city})\n` +
      `Date: ${booking.date}\n` +
      `Time: ${booking.time}\n` +
      `Guests: ${booking.guests}\n` +
      `Reference: ${booking.ref}\n\n` +
      `See you soon!\nTony's`,
  });
}

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
