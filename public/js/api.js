/**
 * Thin wrapper around fetch() for talking to the Tablespot API. Every
 * network call in the app goes through here, so this is the one place
 * that knows about HTTP status codes, JSON parsing, and auth headers —
 * views never call fetch() directly.
 */

import { state } from './state.js';

/**
 * @param {string} method - 'GET' | 'POST' | 'PATCH' | 'DELETE'
 * @param {string} url - relative API path, e.g. '/api/config'
 * @param {object} [body] - request body, JSON-encoded automatically
 * @param {boolean} [needsAuth] - attach the staff session token if present
 */
export async function apiFetch(method, url, body, needsAuth) {
  const headers = { 'Content-Type': 'application/json' };
  if (needsAuth && state.staffToken) headers.Authorization = 'Bearer ' + state.staffToken;

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await response.json(); } catch (err) { /* empty response body */ }

  if (!response.ok) {
    throw new Error((data && data.error) || `HTTP ${response.status}`);
  }
  return data;
}
