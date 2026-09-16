/**
 * Centralized environment configuration.
 *
 * Every other module reads settings from here rather than touching
 * `process.env` directly — one place to see what the app needs, and one
 * place that fails loudly (at startup, not mid-request) if something
 * required is missing.
 */

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for the full list.`
    );
  }
  return value;
}

const config = {
  port: process.env.PORT || 3000,

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiry: '12h',

  resendApiKey: process.env.RESEND_API_KEY || null,
  fromEmail: process.env.FROM_EMAIL || 'onboarding@resend.dev',

  // Single-tenant for now: this app serves exactly one restaurant.
  // Multi-tenant support (resolving the restaurant from a subdomain or
  // path instead of a hardcoded constant) is a deliberate future step,
  // not an oversight — see README.md.
  restaurantId: 'tonys',

  activeBookingStatuses: ['pending', 'confirmed', 'arrived', 'seated'],
};

module.exports = config;
