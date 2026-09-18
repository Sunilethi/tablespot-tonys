/**
 * Single mutable state object for the whole client-side app, plus a
 * couple of small helpers for reading it.
 *
 * There's no framework-level reactivity here — views mutate `state`
 * directly and then call `render()` (from render.js) themselves. That's
 * a deliberate, simple choice for an app this size; see render.js for
 * the rest of that story.
 */

export function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export const state = {
  // ui
  appMode: 'customer', // 'customer' | 'staff' — set once at boot from the URL path (see main.js)
  lang: 'en',
  view: 'customer', // 'customer' | 'staffLogin' | 'staffDash'
  config: null,
  loaded: false,
  toast: null, // transient success message, e.g. "Saved" after an admin setting change

  // customer booking wizard
  cStep: 1,
  cBranch: null,
  cDate: todayISO(),
  cGuests: 2,
  cTime: null,
  cSlots: null,
  cSlotsClosed: false,
  cSlotsLoading: false,
  cForm: { name: '', email: '', phone: '', notes: '', allergy: '', childSeat: false, consent: false, allergyConsent: false },
  cError: '',
  cSubmitting: false,
  cRef: null,

  // staff auth
  staffBranchId: null,
  staffToken: null,
  loggedIn: false,
  staffPinInput: '',
  staffLoginTarget: null,
  loginError: '',
  loginBusy: false,

  // staff dashboard
  dashDate: todayISO(),
  dashSearch: '',
  dashTab: 'today', // 'today' | 'floor' | 'admin'
  dashBookings: [],
  dashLoading: false,
  dashWeeklyActivity: null,
  calendarMonth: null, // { year, month } — lazily initialized from dashDate on first render
  selectedBookingId: null,

  // Floor plan
  floorBranchId: null,       // which branch's floor plan is being viewed/edited (admin picks; branch staff default to their own)
  floorTables: null,         // admin editor's raw table list
  floorStatus: null,         // staff view's live { tables, flagged }
  floorLoading: false,
  addTableForm: { name: '', capacity: 2, zone: 'indoor', shape: 'rect' },
  showAddForm: false,
  addFormError: '',
  addFormBusy: false,
};

/** Looks up a branch from the currently-loaded config by id. */
export function getBranch(id) {
  return state.config.branches.find((branch) => branch.id === id);
}
