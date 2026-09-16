/**
 * Express middleware for staff-protected routes.
 */

const authService = require('../services/authService');

/** Extracts and verifies the Bearer token, or returns null if absent/invalid. */
function tryAuthenticate(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return authService.verifyToken(token);
  } catch (err) {
    return null;
  }
}

/** Rejects the request unless a valid staff/admin token is present. */
function requireStaffAuth(req, res, next) {
  const staff = tryAuthenticate(req);
  if (!staff) return res.status(401).json({ error: 'UNAUTHORIZED' });
  req.staff = staff;
  next();
}

/** Rejects the request unless the authenticated staff member is an admin. */
function requireAdmin(req, res, next) {
  if (req.staff.role !== 'admin') return res.status(403).json({ error: 'FORBIDDEN' });
  next();
}

/**
 * Confirms the authenticated staff member may act on the given branch:
 * admins may act on any branch, branch-level staff only on their own.
 * Sends the 403 response itself and returns false if access is denied,
 * so callers can simply `if (!assertBranchAccess(...)) return;`.
 */
function assertBranchAccess(req, res, branchId) {
  if (req.staff.role === 'admin') return true;
  if (req.staff.role === 'branch' && req.staff.branchId === branchId) return true;
  res.status(403).json({ error: 'FORBIDDEN' });
  return false;
}

module.exports = { tryAuthenticate, requireStaffAuth, requireAdmin, assertBranchAccess };
