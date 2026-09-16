/**
 * Staff authentication. Deliberately simple — PIN-based login issuing a
 * short-lived JWT — appropriate for a small internal tool, not intended
 * as a general-purpose auth system.
 */

const jwt = require('jsonwebtoken');
const supabase = require('../db/supabaseClient');
const config = require('../config/env');

/**
 * Verifies a staff or admin PIN and, if correct, issues a signed session
 * token. Returns { ok: false } on any mismatch — deliberately without
 * distinguishing "wrong branch" from "wrong PIN" in the response, so a
 * failed attempt doesn't leak which part was incorrect.
 */
async function login(target, pin) {
  if (target === 'admin') {
    const { data } = await supabase
      .from('restaurants')
      .select('admin_pin')
      .eq('id', config.restaurantId);
    const adminPin = data && data[0] ? data[0].admin_pin : null;
    if (adminPin && String(pin) === String(adminPin)) {
      return { ok: true, role: 'admin', token: issueToken({ role: 'admin' }) };
    }
    return { ok: false };
  }

  const { data } = await supabase
    .from('branches')
    .select('id,pin')
    .eq('id', target)
    .eq('restaurant_id', config.restaurantId);
  const branch = data && data[0];
  if (branch && String(pin) === String(branch.pin)) {
    return {
      ok: true,
      role: 'branch',
      branchId: branch.id,
      token: issueToken({ role: 'branch', branchId: branch.id }),
    };
  }
  return { ok: false };
}

function issueToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret); // throws if invalid/expired
}

module.exports = { login, verifyToken };
