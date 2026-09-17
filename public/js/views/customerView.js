/**
 * The customer-facing booking flow: one screen with branch (dropdown),
 * date, party size, and available times together — then a details
 * screen, then confirmation. Two real steps, not four, closer to the
 * simple single-screen widget pattern (branch dropdown, calendar, times
 * below) than a long wizard.
 */

import { el } from '../dom.js';
import { state, getBranch, todayISO } from '../state.js';
import { t, dayName } from '../i18n.js';
import { apiFetch } from '../api.js';
import { render } from '../render.js';

export function renderCustomer() {
  const wrap = el('div', {});
  wrap.appendChild(el('div', { class: 'hero' }, [
    el('h1', {}, [t('heroTitle')]),
    el('p', {}, [t('heroBody')]),
    el('div', { class: 'hero-rule' }),
  ]));

  if (state.cStep === 3) {
    wrap.appendChild(renderConfirmStep());
    return wrap;
  }

  const stepsBar = el('div', { class: 'steps' });
  [[1, t('stepBranch')], [2, t('stepDetails')]].forEach(([n, label]) => {
    const stepClass = n === state.cStep ? 'current' : (n < state.cStep ? 'done' : '');
    stepsBar.appendChild(el('div', { class: 'step-pill ' + stepClass }, [n + '. ' + label]));
  });
  wrap.appendChild(stepsBar);

  if (state.cStep === 1) wrap.appendChild(renderBookingForm());
  if (state.cStep === 2) wrap.appendChild(renderStepDetails());

  return wrap;
}

// ---------- Step 1: branch + date + guests + times, all on one screen ----------

function renderBookingForm() {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, [t('chooseBranch')]));
  card.appendChild(el('div', { class: 'hint' }, [t('chooseBranchHint')]));

  const row = el('div', { class: 'field-row' });

  // Branch — a plain dropdown, not a card grid.
  const branchField = el('div', { class: 'field' }, [el('label', { for: 'bf-branch' }, [t('stepBranch')])]);
  const branchSelect = el('select', {
    id: 'bf-branch', name: 'branch',
    onChange: (e) => {
      state.cBranch = e.target.value || null;
      state.cTime = null;
      fetchSlots();
    },
  });
  branchSelect.appendChild(el('option', { value: '' }, ['— ' + t('chooseBranch') + ' —']));
  state.config.branches.forEach((branch) => {
    const option = el('option', { value: branch.id }, [branch.name + ' — ' + branch.city]);
    if (state.cBranch === branch.id) option.setAttribute('selected', 'selected');
    branchSelect.appendChild(option);
  });
  branchField.appendChild(branchSelect);
  row.appendChild(branchField);

  // Date
  row.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'bf-date' }, [t('date')]),
    el('input', {
      type: 'date', id: 'bf-date', name: 'date', value: state.cDate, min: todayISO(),
      onChange: (e) => { state.cDate = e.target.value; state.cTime = null; fetchSlots(); },
    }),
  ]));

  // Guests
  const guestsField = el('div', { class: 'field' }, [el('label', {}, [t('guests')])]);
  const stepper = el('div', { class: 'stepper' });
  stepper.appendChild(el('button', {
    onClick: () => { if (state.cGuests > 1) { state.cGuests--; state.cTime = null; fetchSlots(); } },
  }, ['–']));
  stepper.appendChild(el('span', { class: 'val' }, [String(state.cGuests)]));
  stepper.appendChild(el('button', {
    onClick: () => { state.cGuests++; state.cTime = null; fetchSlots(); },
  }, ['+']));
  guestsField.appendChild(stepper);
  row.appendChild(guestsField);

  card.appendChild(row);

  // Branch detail line (hours / capacity / closed day) once one is picked.
  if (state.cBranch) {
    const branch = getBranch(state.cBranch);
    const closedLine = branch.closedDay !== null ? (' · ' + t('closedOn') + ': ' + dayName(branch.closedDay)) : '';
    card.appendChild(el('div', { class: 'hint', style: 'margin-top:-8px;margin-bottom:16px;' }, [
      t('hoursLabel') + ': ' + state.config.openTime + '–' + state.config.closeTime + closedLine,
    ]));
  }

  card.appendChild(el('h2', { style: 'margin-top:8px;' }, [t('availableTimes')]));

  if (!state.cBranch) {
    card.appendChild(el('div', { class: 'hint' }, [t('chooseBranchHint')]));
  } else if (state.cSlotsLoading) {
    card.appendChild(el('div', { class: 'spinner-row' }, [el('div', { class: 'spinner' }), el('span', {}, [t('loading')])]));
  } else if (state.cSlotsClosed) {
    card.appendChild(el('div', { class: 'msg error' }, [getBranch(state.cBranch).name + ' — ' + t('closedOn') + ' (' + state.cDate + ').']));
  } else if (state.cSlots) {
    if (state.cSlots.length === 0) {
      card.appendChild(el('div', { class: 'msg error' }, [t('noTimes')]));
    } else {
      const grid = el('div', { class: 'slot-grid' });
      state.cSlots.forEach((slot) => {
        const selected = state.cTime === slot.time;
        // Deliberately never disabled: a "full" slot still offers a
        // waitlist join rather than blocking the customer outright.
        const btn = el('button', {
          class: 'slot' + (selected ? ' selected' : '') + (slot.full ? ' waitlist' : ''),
          'aria-pressed': selected ? 'true' : 'false',
          onClick: () => { state.cTime = slot.time; render(); },
        }, [
          slot.time,
          el('span', { class: 'rem' }, [slot.full ? t('full') : (slot.remaining + ' ' + t('seatsLeft'))]),
        ]);
        grid.appendChild(btn);
      });
      card.appendChild(grid);
    }
  }

  card.appendChild(el('div', { class: 'btn-row' }, [
    el('button', {
      class: 'btn btn-primary', disabled: !state.cBranch || !state.cTime,
      onClick: () => { if (state.cBranch && state.cTime) { state.cStep = 2; render(); } },
    }, [t('next')]),
  ]));
  return card;
}

async function fetchSlots() {
  if (!state.cBranch) { state.cSlots = null; render(); return; }
  state.cSlotsLoading = true;
  state.cSlots = null;
  render();
  try {
    const url = '/api/availability?branch=' + encodeURIComponent(state.cBranch) +
      '&date=' + encodeURIComponent(state.cDate) + '&guests=' + encodeURIComponent(state.cGuests);
    const result = await apiFetch('GET', url);
    state.cSlotsClosed = result.closed;
    state.cSlots = result.slots;
  } catch (err) {
    state.cSlots = [];
    state.cSlotsClosed = false;
  }
  state.cSlotsLoading = false;
  render();
}

// ---------- Step 2: guest details ----------

function renderStepDetails() {
  const card = el('div', { class: 'card' });
  card.appendChild(el('h2', {}, [t('yourDetails')]));
  if (state.cError) card.appendChild(el('div', { class: 'msg error' }, [state.cError]));

  // Booking summary — lets the customer verify (or fix) their selection
  // before typing out their details, rather than discovering a mistake
  // only after confirming.
  const branch = getBranch(state.cBranch);
  const summary = el('div', { class: 'summary-list', style: 'border:1px solid var(--line);border-radius:8px;padding:4px 14px;margin-bottom:20px;' }, [
    el('li', {}, [el('span', {}, [t('summaryLocation')]), el('span', {}, [branch.name + ' — ' + branch.city])]),
    el('li', {}, [el('span', {}, [t('summaryDate')]), el('span', {}, [state.cDate])]),
    el('li', {}, [el('span', {}, [t('summaryTime')]), el('span', {}, [state.cTime])]),
    el('li', { style: 'border-bottom:none;' }, [
      el('span', {}, [t('summaryGuests')]), el('span', {}, [String(state.cGuests)]),
    ]),
  ]);
  card.appendChild(summary);
  card.appendChild(el('div', { class: 'btn-row', style: 'margin:-14px 0 18px;justify-content:flex-start;' }, [
    el('button', {
      class: 'btn btn-ghost', style: 'padding:6px 14px;font-size:12.5px;',
      onClick: () => { state.cStep = 1; render(); },
    }, [t('editSelection')]),
  ]));

  // The confirm button's enabled state needs to react to every
  // keystroke in the name field (a required field) — but text inputs
  // deliberately don't call the global render() on every keystroke,
  // since that would rebuild the input and steal focus (see dom.js).
  // syncConfirmButton() updates just the one button directly instead.
  let confirmBtn;
  function isFormValid() {
    return !!state.cForm.name.trim() && !!state.cForm.consent &&
      (!state.cForm.allergy.trim() || !!state.cForm.allergyConsent);
  }
  function syncConfirmButton() {
    if (confirmBtn) confirmBtn.disabled = !isFormValid() || state.cSubmitting;
  }

  const row1 = el('div', { class: 'field-row' });
  row1.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'cf-name' }, [t('name') + ' *']),
    el('input', {
      type: 'text', id: 'cf-name', name: 'name', autocomplete: 'name', required: 'required',
      value: state.cForm.name,
      onInput: (e) => { state.cForm.name = e.target.value; syncConfirmButton(); },
    }),
  ]));
  row1.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'cf-phone' }, [t('phone')]),
    el('input', {
      type: 'tel', id: 'cf-phone', name: 'tel', autocomplete: 'tel',
      value: state.cForm.phone,
      onInput: (e) => { state.cForm.phone = e.target.value; },
    }),
  ]));
  card.appendChild(row1);

  const row2 = el('div', { class: 'field-row' });
  row2.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'cf-email' }, [t('email')]),
    el('input', {
      type: 'email', id: 'cf-email', name: 'email', autocomplete: 'email',
      value: state.cForm.email,
      onInput: (e) => { state.cForm.email = e.target.value; },
    }),
  ]));
  row2.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'cf-allergy' }, [t('allergy')]),
    el('input', {
      type: 'text', id: 'cf-allergy', name: 'allergy',
      value: state.cForm.allergy,
      onInput: (e) => { state.cForm.allergy = e.target.value; syncConfirmButton(); },
    }),
    // Allergy/dietary data can qualify as health data under GDPR Art. 9,
    // so it gets its own explicit consent, separate from the general
    // privacy-policy acknowledgment below. See Datenschutzerklaerung.md.
    el('label', { class: 'checkline', style: 'margin-top:8px;', for: 'cf-allergy-consent' }, [
      el('input', {
        type: 'checkbox', id: 'cf-allergy-consent', checked: state.cForm.allergyConsent || undefined,
        onChange: (e) => { state.cForm.allergyConsent = e.target.checked; syncConfirmButton(); render(); },
      }),
      el('span', { style: 'font-size:12px;color:#6b7770;' }, [t('allergyConsent')]),
    ]),
  ]));
  card.appendChild(row2);

  card.appendChild(el('div', { class: 'field' }, [
    el('label', { for: 'cf-notes' }, [t('notes')]),
    el('textarea', {
      id: 'cf-notes', name: 'notes',
      onInput: (e) => { state.cForm.notes = e.target.value; },
    }, []),
  ]));

  card.appendChild(el('label', { class: 'checkline', for: 'cf-child-seat' }, [
    el('input', {
      type: 'checkbox', id: 'cf-child-seat', checked: state.cForm.childSeat || undefined,
      onChange: (e) => { state.cForm.childSeat = e.target.checked; },
    }),
    el('span', {}, [t('childSeat')]),
  ]));

  const consentLine = el('label', { class: 'checkline', for: 'cf-consent' }, [
    el('input', {
      type: 'checkbox', id: 'cf-consent', required: 'required',
      checked: state.cForm.consent || undefined,
      onChange: (e) => { state.cForm.consent = e.target.checked; syncConfirmButton(); render(); },
    }),
  ]);
  const consentTextWrap = el('span', {});
  consentTextWrap.appendChild(document.createTextNode(t('consent') + ' * '));
  if (state.config.privacyPolicyUrl) {
    consentTextWrap.appendChild(el('a', {
      href: state.config.privacyPolicyUrl, target: '_blank', rel: 'noopener',
      style: 'color:var(--basil);text-decoration:underline;',
    }, ['(' + t('privacyPolicyLink') + ')']));
  }
  consentLine.appendChild(consentTextWrap);
  card.appendChild(consentLine);

  confirmBtn = el('button', {
    class: 'btn btn-primary', disabled: !isFormValid() || state.cSubmitting, onClick: submitBooking,
  }, [state.cSubmitting ? '…' : t('confirmBooking')]);

  card.appendChild(el('div', { class: 'btn-row split' }, [
    el('button', { class: 'btn btn-ghost', onClick: () => { state.cStep = 1; render(); } }, [t('back')]),
    confirmBtn,
  ]));
  return card;
}

async function submitBooking() {
  state.cError = '';
  if (!state.cForm.name.trim()) { state.cError = t('nameRequired'); render(); return; }
  if (!state.cForm.consent) { state.cError = t('consentRequired'); render(); return; }
  if (state.cForm.allergy.trim() && !state.cForm.allergyConsent) {
    state.cError = t('allergyConsentRequired'); render(); return;
  }

  state.cSubmitting = true;
  render();
  try {
    const result = await apiFetch('POST', '/api/bookings', {
      branch: state.cBranch, date: state.cDate, time: state.cTime, guests: state.cGuests,
      name: state.cForm.name.trim(), email: state.cForm.email.trim(), phone: state.cForm.phone.trim(),
      notes: state.cForm.notes.trim(), allergy: state.cForm.allergy.trim(), childSeat: state.cForm.childSeat,
      privacyConsentAt: new Date().toISOString(), allergyConsent: !!state.cForm.allergyConsent,
      policyVersion: 'v1-2026-09', lang: state.lang,
    });
    if (!result.ok) {
      state.cError = t('connectionError');
      state.cSubmitting = false;
      return;
    }
    state.cRef = {
      ref: result.ref, branch: state.cBranch, date: state.cDate, time: state.cTime,
      guests: state.cGuests, name: state.cForm.name.trim(), waitlisted: !!result.waitlisted,
    };
    state.cStep = 3;
  } catch (err) {
    state.cError = t('connectionError');
  }
  state.cSubmitting = false;
  render();
}

function renderConfirmStep() {
  const booking = state.cRef;
  const branch = getBranch(booking.branch);
  const card = el('div', { class: 'card confirm-box', id: 'confirm-print-area' });

  card.appendChild(el('img', {
    src: '/images/tonys-logo.png', alt: "Tony's",
    style: 'height:34px;margin:0 auto 18px;display:block;',
  }));

  if (booking.waitlisted) {
    card.appendChild(el('h2', {}, [t('waitlistedTitle')]));
    card.appendChild(el('p', { style: 'color:#4B5850;' }, [t('waitlistedBody')]));
  } else {
    card.appendChild(el('h2', {}, [t('confirmedTitle')]));
    card.appendChild(el('p', { style: 'color:#4B5850;' }, [t('confirmedBody')]));
  }

  card.appendChild(el('div', { class: 'ref' }, [booking.ref]));
  card.appendChild(el('ul', { class: 'summary-list' }, [
    el('li', {}, [el('span', {}, [t('summaryLocation')]), el('span', {}, [branch.name + ' — ' + branch.city])]),
    el('li', {}, [el('span', {}, [t('summaryDate')]), el('span', {}, [booking.date])]),
    el('li', {}, [el('span', {}, [t('summaryTime')]), el('span', {}, [booking.time])]),
    el('li', {}, [el('span', {}, [t('summaryGuests')]), el('span', {}, [String(booking.guests)])]),
    el('li', {}, [el('span', {}, [t('summaryName')]), el('span', {}, [booking.name])]),
  ]));

  if (branch.phone) {
    card.appendChild(el('p', { style: 'color:#6b7770;font-size:13px;margin-top:10px;' }, [
      (state.lang === 'de' ? 'Fragen? Rufen Sie uns an: ' : 'Questions? Call us: ') + branch.phone,
    ]));
  }

  const actionsRow = el('div', { class: 'btn-row', style: 'justify-content:center;flex-wrap:wrap;', 'data-no-print': 'true' });
  actionsRow.appendChild(el('button', {
    class: 'btn btn-ghost',
    onClick: () => window.print(),
  }, [state.lang === 'de' ? 'Drucken / Als PDF speichern' : 'Print / Save as PDF']));

  if (navigator.share) {
    actionsRow.appendChild(el('button', {
      class: 'btn btn-ghost',
      onClick: () => {
        const shareText = `${branch.name} — ${booking.date} ${booking.time}, ${booking.guests} guests. Ref: ${booking.ref}`;
        navigator.share({ title: "Tony's reservation", text: shareText }).catch(() => {});
      },
    }, [state.lang === 'de' ? 'Teilen' : 'Share']));
  }
  card.appendChild(actionsRow);

  card.appendChild(el('div', { class: 'btn-row', style: 'justify-content:center;', 'data-no-print': 'true' }, [
    el('button', {
      class: 'btn btn-primary',
      onClick: () => {
        state.cStep = 1; state.cBranch = null; state.cTime = null; state.cGuests = 2;
        state.cDate = todayISO(); state.cSlots = null;
        state.cForm = { name: '', email: '', phone: '', notes: '', allergy: '', childSeat: false, consent: false, allergyConsent: false };
        state.cError = ''; state.cRef = null;
        render();
      },
    }, [t('newBooking')]),
  ]));
  return card;
}
