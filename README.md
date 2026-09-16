# Tablespot — Tony's Ristorante

Table reservation system: customer booking flow + staff/admin dashboard.
Node.js/Express backend, Supabase (Postgres) database, Resend for email.

Full deployment walkthrough: see `SETUP_GUIDE.md`.

## Architecture

```
server.js                        Entry point — loads config, starts the server.
                                  Deliberately thin; all real logic is in src/.

src/
  app.js                         Builds the Express app: middleware, static
                                  file serving, route mounting.

  config/
    env.js                       Every environment variable the app needs,
                                  read and validated in one place. Fails
                                  loudly at startup if something's missing,
                                  rather than failing confusingly mid-request.

  db/
    supabaseClient.js             The one shared Supabase client instance.

  services/                      Business logic — no HTTP concerns here at
                                  all, just plain functions.
    configService.js              Reads/writes restaurant + branch settings.
    bookingService.js             The heart of the app: capacity checks,
                                   overlap detection, waitlist promotion.
    emailService.js                Every outgoing email, as named template
                                    functions (sendBookingConfirmation,
                                    sendWaitlistNotice, etc.)
    authService.js                  Staff PIN login, JWT issuing/verification.

  middleware/
    auth.js                       requireStaffAuth, requireAdmin, and
                                   assertBranchAccess (branch-level staff
                                   can only touch their own branch's data).

  routes/                        HTTP layer — thin, delegates to services.
    publicRoutes.js               No auth required: config, availability,
                                   booking creation, staff login.
    staffRoutes.js                 Requires staff/admin auth: view/update/
                                    delete bookings.
    adminRoutes.js                  Requires admin auth: branch/restaurant
                                     settings, full config (incl. PINs).

  utils/
    time.js                       Pure helpers: HH:MM <-> minutes conversion.
    ref.js                        Booking reference/id generation.

public/
  index.html                     Minimal HTML shell — structure only, no
                                  inline styles or scripts.
  css/
    styles.css                    All styling, as CSS custom properties
                                   (design tokens) + component styles.
  js/
    main.js                       Entry point, loaded as a native ES module
                                   (no build step / bundler needed).
    state.js                      The single mutable app state object.
    api.js                        The only module that calls fetch() —
                                   every network request goes through here.
    i18n.js                       English/German text for the customer flow.
    dom.js                        Tiny helper for building DOM trees.
    render.js                     Root render dispatcher — decides which
                                   top-level view to show.
    views/
      topbar.js                   Shared nav bar.
      customerView.js              The 4-step customer booking wizard.
      staffLoginView.js             PIN login screen.
      staffDashboardView.js          Reservations list, status changes,
                                      add booking modal.
      adminSettingsView.js            Branch/restaurant settings screen.

supabase_schema.sql              Run once in Supabase's SQL Editor to
                                  create the database tables.
.env.example                     Documents required environment variables
                                  (copy values into your hosting provider,
                                  never commit a real .env file).
```

## Design notes worth knowing

- **Single-tenant by design, for now.** Every table has a `restaurant_id`
  column and the code reads it from one constant
  (`config.restaurantId = 'tonys'`) rather than hardcoding "tonys" all
  over the place — so adding a second restaurant later means adding a row
  and a constant, not restructuring the schema. Actually *serving* two
  restaurants from one deployment (resolving the restaurant from a
  subdomain, say) is a deliberate next step, not a gap.

- **No build tooling.** The frontend uses native ES modules
  (`<script type="module">`) instead of a bundler — modern browsers
  support this natively. That keeps the deployment story simple (upload
  files, done) at the cost of not having automatic code-splitting or a
  dev server with hot reload. Worth revisiting if the frontend grows
  significantly.

- **Staff auth is intentionally simple.** PIN + JWT, no user accounts,
  no password reset flow. Right-sized for a small internal tool used by
  restaurant staff, not a general-purpose auth system.

- **The staff/admin dashboard is English-only.** Only the customer-facing
  booking flow is translated (see `public/js/i18n.js`).

## Local development

```
npm install
cp .env.example .env    # then fill in real values
npm start
```

Visit `http://localhost:3000`.
