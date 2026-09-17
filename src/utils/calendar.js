/**
 * "Add to calendar" support: a Google Calendar link (works instantly, no
 * attachment needed) plus a standard .ics file (works with Apple
 * Calendar, Outlook, and any other calendar app, as an email attachment).
 *
 * Known simplification: times are treated as "floating" (no timezone
 * conversion) rather than explicitly anchored to Europe/Berlin. For
 * guests whose device is already set to German time — true for the
 * overwhelming majority of Tony's customers — this displays correctly.
 * A guest viewing the invite from a different timezone (e.g. checking
 * their phone while traveling abroad) could see the wrong local time.
 * Fixing that properly needs a timezone library — worth adding later if
 * international guests become common, not necessary for launch.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' + 'HH:MM' + minutes duration -> { startStamp, endStamp } as 'YYYYMMDDTHHMMSS' */
function toFloatingStamps(date, time, durationMinutes) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const stamp = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  return { startStamp: stamp(start), endStamp: stamp(end) };
}

function buildGoogleCalendarLink({ booking, branch, durationMinutes }) {
  const { startStamp, endStamp } = toFloatingStamps(booking.date, booking.time, durationMinutes);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Table at ${branch.name}`,
    dates: `${startStamp}/${endStamp}`,
    details: `Reservation for ${booking.guests} guests. Reference: ${booking.ref}`,
    location: `${branch.address || branch.name}, ${branch.city || ''}`.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcsFile({ booking, branch, durationMinutes }) {
  const { startStamp, endStamp } = toFloatingStamps(booking.date, booking.time, durationMinutes);
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;

  const escapeText = (s) => String(s || '').replace(/[,;]/g, (m) => '\\' + m);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TableSpot//Reservation//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@tablespot`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${escapeText('Table at ' + branch.name)}`,
    `DESCRIPTION:${escapeText(`Reservation for ${booking.guests} guests. Reference: ${booking.ref}`)}`,
    `LOCATION:${escapeText(`${branch.address || branch.name}, ${branch.city || ''}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

/** Returns { googleCalendarLink, icsAttachment } ready to drop into an email. */
function buildCalendarAssets({ booking, branch, durationMinutes }) {
  return {
    googleCalendarLink: buildGoogleCalendarLink({ booking, branch, durationMinutes }),
    icsAttachment: {
      filename: 'reservation.ics',
      content: Buffer.from(buildIcsFile({ booking, branch, durationMinutes })).toString('base64'),
    },
  };
}

module.exports = { buildCalendarAssets };
