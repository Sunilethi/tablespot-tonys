/**
 * Builds the Express app: middleware, static file serving, and route
 * mounting. Kept separate from server.js so the app itself (useful for
 * future automated testing, e.g. with supertest) doesn't depend on
 * actually opening a network port.
 */

const express = require('express');
const path = require('path');

const publicRoutes = require('./routes/publicRoutes');
const staffRoutes = require('./routes/staffRoutes');
const adminRoutes = require('./routes/adminRoutes');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Route groups, from least to most privileged:
  //   /api            - public: config, availability, create booking, staff login
  //   /api            - staff-authenticated: list/update/delete bookings
  //   /api/admin      - admin-authenticated: settings, full config with PINs
  app.use('/api', publicRoutes);
  app.use('/api', staffRoutes);
  app.use('/api/admin', adminRoutes);

  // The staff/admin login+dashboard gets its own HTML shell (distinct
  // <title>, and noindex so it never turns up in search results — see
  // public/staff.html). The X-Robots-Tag header is the same directive
  // again, but readable by crawlers that don't parse HTML at all.
  app.get(['/staff', '/staff/*'], (req, res) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(__dirname, '..', 'public', 'staff.html'));
  });

  // Any other route falls back to the customer-facing app shell.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return app;
}

module.exports = createApp;
