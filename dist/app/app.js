(function () {
  'use strict';
  var C = window.LN, I = window.LNI, KEY = 'lendnest.v1';
  var st, lang, T, tab = 'out', q = '', showClosed = false, saveFailed = false, toastTimer;

  /* ---------- storage ---------- */
  var corrupt = false, saveSeq = 0, corruptRaw = '', rawSafe = true, copyKept = true;
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); if (raw) { var obj = JSON.parse(raw), s = C.sanitize(obj); if (s) { if (s.entries.length !== obj.entries.length || s.people.length !== obj.people.length) { corrupt = true; corruptRaw = raw; rawSafe = false; copyKept = false; var k0 = KEY + '.corrupt'; try { var has = Object.keys(localStorage).some(function (k) { return k.indexOf(k0) === 0 && localStorage.getItem(k) === raw; }); if (!has) localStorage.setItem(localStorage.getItem(k0) ? k0 + '.' + Date.now() : k0, raw); rawSafe = copyKept = Object.keys(localStorage).some(function (k) { return k.indexOf(k0) === 0 && localStorage.getItem(k) === raw; }); } catch (e2) {} } return s; } } } catch (e) {}
    if (raw) { corrupt = true; corruptRaw = raw; rawSafe = false; copyKept = false; try { var dup = Object.keys(localStorage).some(function (k) { return k.indexOf(KEY + '.corrupt') === 0 && localStorage.getItem(k) === raw; }); if (!dup) localStorage.setItem(KEY + '.corrupt' + (localStorage.getItem(KEY + '.corrupt') ? '.' + Date.now() : ''), raw); rawSafe = copyKept = Object.keys(localStorage).some(function (k) { return k.indexOf(KEY + '.corrupt') === 0 && localStorage.getItem(k) === raw; }); } catch (e) {} }
    return C.newState();
  }
  function save() { saveSeq++; hideToast();  if (stale) { stale = false; var other = storedState(); if (other) { st = other; conflict = true; setTimeout(function () { conflict = false; }, 0); setTimeout(render, 0); return; } } try { localStorage.setItem(KEY, JSON.stringify(st)); saveFailed = false; } catch (e) { saveFailed = true; } }
  var stale = false, conflict = false;
  function storedState() { try { var raw = localStorage.getItem(KEY); return raw ? C.sanitize(JSON.parse(raw)) : null; } catch (e) { return null; } }
  window.addEventListener('storage', function (ev) {
    if (ev.key !== KEY) return; var s = storedState(); if (!s) return;
    if (document.querySelector('dialog[open]')) { stale = true; return; }
    st = s; setLang(st.settings.lang || lang); render();
  });
  function setLang(l) { lang = l; T = I.L[l]; document.documentElement.lang = l; document.title = T.app; document.getElementById('skip').textContent = T.skip; }
  function t(k, v) { var s = T[k] != null ? T[k] : I.L.en[k]; return v ? C.fill(s, v) : s; }

  /* ---------- dom helpers (textContent only, never innerHTML) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag), i, c;
    if (attrs) for (var k in attrs) { var v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else if (v === true) el.setAttribute(k, ''); else el.setAttribute(k, v); }
    for (i = 2; i < arguments.length; i++) { c = arguments[i]; if (c == null || c === false) continue; if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }); else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return el;
  }
  function svgIcon(path) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path); s.appendChild(p); return s; }
  var ICON = { out: 'M7 17L17 7M9 7h8v8', in: 'M17 7L7 17M15 17H7V9', people: 'M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M16 5.2a3 3 0 0 1 0 5.6', ins: 'M4 20V10M10 20V4M16 20v-7M22 20H2', set: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' };

  function fmtDate(s) { try { return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(C.parse(s)); } catch (e) { return s; } }
  function fmtMoney(a, cur) { try { return new Intl.NumberFormat(lang, { style: 'currency', currency: cur }).format(a); } catch (e) { return a + ' ' + cur; } }
  function moneyMap(m) { return Object.keys(m).filter(function (k) { return m[k] > 0; }).map(function (k) { return fmtMoney(m[k], k); }).join(' · '); }
  function whatOf(e) { return e.kind === 'money' ? fmtMoney(C.remaining(e) || e.amount, e.currency) : e.title; }

  /* ---------- toast ---------- */
  function toast(msg, undo) {
    if (conflict) { conflict = false; msg = t('conflict'); undo = null; } else if (saveFailed) msg = t('storageErr');
    var el = document.getElementById('toast'), sr = document.getElementById('sr-status'); sr.textContent = ''; setTimeout(function () { sr.textContent = msg; }, 30); el.textContent = ''; el.appendChild(document.createTextNode(msg));
    if (undo) el.appendChild(h('button', { type: 'button', text: t('undo'), onclick: function () { hideToast(); undo(); } }));
    el.classList.add('on'); try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch (e) {} clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, undo ? 6000 : 2600);
  }
  function hideToast() { var el = document.getElementById('toast'); el.classList.remove('on'); try { if (el.matches(':popover-open')) el.hidePopover(); } catch (e) {} }

  /* ---------- dialogs ---------- */
  /* after a dialog closes, focus goes back to what opened it (or the main heading if that is gone). Not while another dialog is open. */
  function restoreFocus(el) { if (document.querySelector('dialog[open]')) return; var target = el && el.isConnected ? el : document.getElementById('main'); if (target && target.focus) { try { target.focus({ preventScroll: true }); } catch (e) {} } }
  var dlgN = 0;
  function dialog(content, onClose) {
    var opener = document.activeElement;
    var d = h('dialog', null, h('div', { class: 'in' }, content)), hh = d.querySelector('h2'); if (hh) { hh.id = 'dlg' + (++dlgN); d.setAttribute('aria-labelledby', hh.id); }
    d.addEventListener('close', function () { d.remove(); if (onClose) onClose(); if (stale && !document.querySelector('dialog[open]')) { stale = false; var fresh = storedState(); if (fresh) { st = fresh; render(); } } restoreFocus(opener); });
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
    document.body.appendChild(d); d.showModal(); return d;
  }
  function confirmBox(msg, label, danger) {
    return new Promise(function (res) {
      var ok = false, d = dialog([h('h2', { text: msg }), h('div', { class: 'row' },
        h('button', { type: 'button', text: t('cancel'), onclick: function () { d.close(); } }),
        h('button', { type: 'button', class: danger ? 'danger' : 'pri', id: 'confirm-ok', text: label, onclick: function () { ok = true; d.close(); } }))], function () { res(ok); });
    });
  }
  function askText(title, label, value, type) {
    return new Promise(function (res) {
      var out = null, inp = h('input', { type: type || 'text', id: 'ask-in', value: value || '', step: type === 'number' ? 'any' : null, inputmode: type === 'number' ? 'decimal' : null });
      var d = dialog([h('form', { onsubmit: function (ev) { ev.preventDefault(); out = inp.value; d.close(); } }, h('h2', { text: title }), h('label', { for: 'ask-in', text: label }), inp,
        h('div', { class: 'row' }, h('button', { type: 'button', text: t('cancel'), onclick: function () { d.close(); } }), h('button', { type: 'submit', class: 'pri', text: t('save') })))], function () { res(out); });
      inp.focus();
    });
  }

  /* ---------- entry form ---------- */
  function resizePhoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 480, quality = 0.72, out = '';
        for (var tries = 0; tries < 5 && (!out || out.length > C.MAX_PHOTO); tries++) {
          var sc = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); out = cv.toDataURL('image/jpeg', quality); max = Math.round(max * 0.75); quality -= 0.08;
        }
        URL.revokeObjectURL(url); out && out.length <= C.MAX_PHOTO ? res(out) : rej(new Error('big'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad')); }; img.src = url;
    });
  }
  function entryForm(existing, preset) {
    var base = existing || {}, today = C.today(), photo = base.photo || '';
    var dirV = base.dir || (preset && preset.dir) || (tab === 'in' ? 'in' : 'out'), kindV = base.kind || 'item';
    function radio(name, val, label, checked) { return h('label', null, h('input', { type: 'radio', name: name, value: val, checked: checked }), h('span', { text: label })); }
    var title = h('input', { type: 'text', id: 'f-title', maxlength: 200, placeholder: t('whatPh'), value: base.title || '', autocomplete: 'off', required: true });
    var dl = h('datalist', { id: 'f-people' }, st.people.map(function (p) { return h('option', { value: p.name }); }));
    var pn = base.personId ? (C.findPerson(st, base.personId) || {}).name : '';
    var person = h('input', { type: 'text', id: 'f-person', maxlength: 60, list: 'f-people', placeholder: t('whoPh'), value: pn || '', autocomplete: 'off', required: true });
    var amount = h('input', { type: 'number', id: 'f-amount', placeholder: '0.00', min: '0', step: 'any', inputmode: 'decimal', value: base.amount || '' });
    var cur = h('input', { type: 'text', id: 'f-cur', maxlength: 8, value: base.currency || st.settings.currency, autocapitalize: 'characters' });
    var date = h('input', { type: 'date', id: 'f-date', value: base.date || today });
    var due = h('input', { type: 'date', id: 'f-due', value: base.due !== undefined ? base.due : (existing ? '' : C.addDays(today, st.settings.days)) });
    var note = h('textarea', { id: 'f-note', maxlength: 1000, placeholder: t('notePh') }); note.value = base.note || '';
    var tags = h('input', { type: 'text', id: 'f-tags', maxlength: 140, placeholder: t('tagsPh'), value: (base.tags || []).join(', '), autocomplete: 'off' });
    var remind = h('input', { type: 'date', id: 'f-remind', value: base.remindOn || '' });
    var err = h('div', { class: 'err', id: 'f-err', role: 'alert' }), hint = h('div', { id: 'f-hint', role: 'status' });
    var moneyBox = h('div', { class: 'two' }, h('div', null, h('label', { for: 'f-amount', text: t('amount') }), amount), h('div', null, h('label', { for: 'f-cur', text: t('currency') }), cur));
    var photoBox = h('div'), file = h('input', { type: 'file', accept: 'image/*', id: 'f-photo', hidden: true });
    var planSel = h('select', { id: 'f-plan' }, [0, 2, 3, 4, 6, 12].map(function (n) { return h('option', { value: String(n), text: n ? t('planN', { n: n }) : t('planNone'), selected: (base.plan ? base.plan.n : 0) === n }); }));
    var planBox = h('div', null, h('label', { for: 'f-plan', text: t('planLabel') }), planSel);
    var quick = h('div', { class: 'chips' }, [7, 14, 30].map(function (n) { return h('button', { type: 'button', class: 'sm', text: '+' + n + (/^[a-z]/i.test(t('daysUnit')) ? ' ' : '') + t('daysUnit'), onclick: function () { due.value = C.addDays(date.value || today, n); } }); }),
      h('button', { type: 'button', class: 'sm', text: t('noDue'), onclick: function () { due.value = ''; } }));
    function drawPhoto() {
      photoBox.textContent = '';
      if (photo) photoBox.appendChild(h('img', { class: 'thumb', src: photo, alt: '' }));
      photoBox.appendChild(h('div', { class: 'chips' }, h('button', { type: 'button', class: 'sm', text: photo ? t('removePhoto') : t('addPhoto'), onclick: function () { if (photo) { photo = ''; drawPhoto(); } else file.click(); } })));
    }
    file.addEventListener('change', function () { var f = file.files[0]; if (!f) return; resizePhoto(f).then(function (u) { photo = u; drawPhoto(); }, function () { err.textContent = t('photoBig'); }); file.value = ''; });
    drawPhoto();
    var form = h('form', { novalidate: true }), d, dirty = false;
    function dirVal() { return form.querySelector('input[name=dir]:checked').value; }
    function kindVal() { return form.querySelector('input[name=kind]:checked').value; }
    function sync() {
      moneyBox.hidden = planBox.hidden = kindVal() !== 'money'; 
      hint.textContent = ''; hint.className = '';
      var p = C.personByName(st, person.value);
      if (dirVal() === 'out' && person.value.trim() && !existing) {
        var lc = p ? C.loanCheck(st, p.id) : { level: 'new', s: {} }, nm = person.value.trim(), m;
        if (lc.level === 'new') m = t('lcNew', { name: nm }); else if (lc.level === 'good') m = t('lcGood', { name: nm, p: lc.s.score == null ? 100 : lc.s.score });
        else if (lc.s.lOverdue > 0) m = t('lcOverdue', { name: nm }); else if (lc.level === 'busy') m = t('lcBusy', { name: nm, n: lc.s.lOpen }); else m = t('lcLow', { name: nm, p: lc.s.score });
        if (lc.level === 'good' && lc.s.score == null) m = null;
        if (m) { hint.textContent = m; hint.className = 'hint' + (lc.level === 'warn' || lc.level === 'busy' ? ' warn' : ''); }
      }
    }
    form.appendChild(h('h2', { text: existing ? t('edit') : t('add') }));
    form.appendChild(h('div', { class: 'seg', style: 'margin-top:12px', role: 'group', 'aria-label': t('dirOut') + ' / ' + t('dirIn') }, radio('dir', 'out', t('dirOut'), dirV === 'out'), radio('dir', 'in', t('dirIn'), dirV === 'in')));
    form.appendChild(h('div', { class: 'seg', style: 'margin-top:8px', role: 'group', 'aria-label': t('kindItem') + ' / ' + t('kindMoney') }, radio('kind', 'item', t('kindItem'), kindV === 'item'), radio('kind', 'money', t('kindMoney'), kindV === 'money')));
    form.appendChild(h('label', { for: 'f-title', text: t('what') })); form.appendChild(title);
    form.appendChild(moneyBox); form.appendChild(planBox);
    form.appendChild(h('label', { for: 'f-person', text: t('who') })); form.appendChild(person); form.appendChild(dl); form.appendChild(hint);
    form.appendChild(h('div', { class: 'two' }, h('div', null, h('label', { for: 'f-date', text: t('lentOn') }), date), h('div', null, h('label', { for: 'f-due', text: t('dueOn') }), due)));
    form.appendChild(quick);
    form.appendChild(h('label', { for: 'f-tags', text: t('tags') })); form.appendChild(tags);
    form.appendChild(h('label', { for: 'f-remind', text: t('remindOn') })); form.appendChild(remind);
    form.appendChild(h('label', { for: 'f-note', text: t('note') })); form.appendChild(note);
    form.appendChild(photoBox); form.appendChild(file); form.appendChild(err);
    form.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', text: t('cancel'), onclick: function () { if (!dirty) { d.close(); return; } confirmBox(t('discard'), t('discardBtn'), true).then(function (ok) { if (ok) d.close(); }); } }), h('button', { type: 'submit', class: 'pri', id: 'f-save', text: t('save') })));
    form.addEventListener('change', sync); person.addEventListener('input', sync);
    function setErr(msg, el) { err.textContent = msg; [title, person, amount, due].forEach(function (x) { x.removeAttribute('aria-invalid'); }); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      /* another tab changed the data while this form was open: reload, keep the typed text, and let the user save again */
      if (stale) { stale = false; var fresh = storedState(); if (fresh) { st = fresh; if (existing) { var still = fresh.entries.find(function (x) { return x.id === existing.id; }); if (!still) { d.close(); toast(t('conflict')); return; } existing = still; } } render(); setErr(t('conflict'), null); return; }
      var o = { dir: dirVal(), kind: kindVal(), title: title.value, amount: amount.value, currency: cur.value.trim() || st.settings.currency, date: date.value, due: due.value, note: note.value, tags: tags.value, remindOn: remind.value, photo: photo, plan: kindVal() === 'money' && +planSel.value >= 2 ? { n: +planSel.value } : null };
      var name = person.value.trim(); if (!o.title.trim()) { setErr(t('needTitle'), title); return; }
      if (!name) { setErr(t('needPerson'), person); return; }
      if (o.kind === 'money' && !(Math.round(Number(o.amount) * 100) > 0 && Number(o.amount) <= 1e12)) { setErr(t('needAmount'), amount); return; }
      if (o.due && o.date && o.due < o.date) { setErr(t('needDue'), due); return; }
      if (existing && o.kind !== existing.kind && (existing.repayments.length || C.isClosed(existing))) { setErr(t('kindLocked'), null); return; }
      if (existing && o.kind === 'money' && Number(o.amount) < C.round2(C.paid(existing) - existing.repayments.filter(function (r) { return r.auto; }).reduce(function (a, r) { return a + r.amount; }, 0)) - 0.000001) { setErr(t('amountBelowPaid'), amount); return; }
      var p = C.addPerson(st, name); o.personId = p.id;
      if (existing) {
        var prevPerson = existing.personId;
        var n = C.makeEntry(o); ['dir', 'kind', 'title', 'personId', 'amount', 'currency', 'date', 'due', 'note', 'tags', 'remindOn', 'photo', 'plan'].forEach(function (k) { existing[k] = n[k]; }); C.applyPlan(existing);
        C.normalize(existing);
        var old = C.findPerson(st, prevPerson); if (old && old.id !== existing.personId && !old.note && !st.entries.some(function (x) { return x.personId === old.id; })) C.removePerson(st, old.id);
      } else { var ne = C.makeEntry(o); C.applyPlan(ne); st.entries.push(ne); }
      q = '';  tab = o.dir; save(); d.close(); render(); toast(saveFailed ? t('storageErr') : t('saved'));
    });
    d = dialog([form]); sync(); title.focus();
    form.addEventListener('input', function () { dirty = true; }); form.addEventListener('change', function () { dirty = true; });
    d.addEventListener('cancel', function (ev) { if (dirty) { ev.preventDefault(); confirmBox(t('discard'), t('discardBtn'), true).then(function (ok) { if (ok) d.close(); }); } });
    d.addEventListener('click', function (ev) { if (ev.target === d && dirty) ev.stopImmediatePropagation(); }, true);
    return d;
  }

  /* ---------- actions ---------- */
  function snapshot() { return JSON.stringify(st); }
  function rawNow() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function undoable(msg, fn) { var before = snapshot(); fn(); save(); var mine = saveSeq, after = rawNow(); render(); toast(msg, function () { if (saveSeq !== mine) return; if (rawNow() !== after) { var f = storedState(); if (f) st = f; render(); toast(t('conflict')); return; } st = C.sanitize(JSON.parse(before)); save(); render(); }); }
  function doReturned(e) { undoable(t('returnedToast'), function () { C.markReturned(e, C.today()); }); }
  function doRepay(e) {
    var maxD = e.date > C.today() ? e.date : C.today();
    var amt = h('input', { type: 'number', id: 'rp-amt', step: 'any', inputmode: 'decimal', value: C.remaining(e) }), dt = h('input', { type: 'date', id: 'rp-date', value: C.today(), min: e.date, max: maxD }), out = null;
    var err = h('p', { id: 'rp-err', class: 'hint warn', role: 'alert' });
    var d = dialog([h('form', { onsubmit: function (ev) {
        ev.preventDefault(); var a = Number(amt.value), dv = dt.value;
        if (!isFinite(a) || !(Math.round(a * 100) > 0)) { err.textContent = t('needAmount'); amt.setAttribute('aria-invalid', 'true'); amt.focus(); return; }
        /* a date outside the loan's range is refused, not replaced with today */
        if (!C.isDate(dv) || dv < e.date || dv > maxD) { err.textContent = t('repayRange', { from: fmtDate(e.date), to: fmtDate(maxD) }); dt.setAttribute('aria-invalid', 'true'); dt.focus(); return; }
        out = { a: a, date: dv }; d.close();
      } }, h('h2', { text: t('repay') }),
      h('label', { for: 'rp-amt', text: t('repayAmt') + ' (' + e.currency + ')' }), amt, h('label', { for: 'rp-date', text: t('repayDate') }), dt, err,
      h('div', { class: 'row' }, h('button', { type: 'button', text: t('cancel'), onclick: function () { d.close(); } }), h('button', { type: 'submit', class: 'pri', text: t('save') })))], function () {
      if (!out) return; var a = out.a, date = out.date;
      var capped = a > C.remaining(e); undoable(capped ? t('capped', { a: fmtMoney(C.remaining(e), e.currency) }) : t('saved'), function () { C.repay(e, a, date); });
    }); amt.focus(); amt.select();
  }
  function doReturnedOn(e) {
    askText(t('markReturned'), t('repayDate'), C.today(), 'date').then(function (v) {
      if (v == null) return; if (!C.isDate(v) || v < e.date || v > C.today()) { toast(t('needDue')); return; }
      undoable(t('returnedToast'), function () { C.markReturned(e, v); });
    });
  }
  function doExtend(e) {
    askText(t('extend'), t('dueOn'), C.addDays(e.due && e.due > C.today() ? e.due : C.today(), 7), 'date').then(function (v) {
      if (v == null) return; if (!C.isDate(v) || v < e.date) { toast(t('needDue')); return; } if (e.due && v < e.due) { toast(t('extendEarlier')); return; } undoable(t('extended', { date: fmtDate(v) }), function () { C.extend(e, v, C.today()); });
    });
  }
  function doDelete(e) { confirmBox(t('delConfirm'), t('del'), true).then(function (ok) { if (ok) undoable(t('deleted'), function () { st.entries = st.entries.filter(function (x) { return x.id !== e.id; }); }); }); }
  function doWriteOff(e) { confirmBox(t('writeOffConfirm'), t('writeOff'), true).then(function (ok) { if (ok) undoable(t('saved'), function () { C.writeOff(e); }); }); }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }
  function dayPhrase(n) { return lang === 'en' ? n + (n === 1 ? ' day' : ' days') : lang === 'es' ? n + (n === 1 ? ' día' : ' días') : String(n); }
  function copyOrShow(title, text, okMsg) {
    copy(text).then(function (ok) {
      if (ok) { toast(okMsg || t('nudgeCopied')); return; }
      var ta = h('textarea', { id: 'cp-text', rows: 5 }); ta.value = text;
      var d = dialog([h('h2', { text: title }), ta, h('div', { class: 'row' }, h('button', { type: 'button', class: 'pri', text: t('close'), onclick: function () { d.close(); } }))]); ta.focus(); ta.select();
    });
  }
  function nudgeText(e, tone) {
    var p = C.findPerson(st, e.personId) || { name: '' }, today = C.today();
    var v = { name: p.name, what: whatOf(e), due: e.due ? fmtDate(e.due) : '', date: fmtDate(e.date), days: dayPhrase(C.daysLate(e, today)), by: fmtDate(C.addDays(today, 3)) };
    if (e.dir === 'in') return C.fill(!e.due ? T.nInNoDue : C.daysLate(e, today) > 0 ? T.nInLate : T.nIn, v);
    if (!e.due) return C.fill(T.nNoDue, v);
    if (C.daysLate(e, today) === 0) return C.fill(C.daysLeft(e, today) === 0 ? T.nGentle : T.nBefore, v);
    return C.fill(tone === 'final' ? T.nFinal : tone === 'firm' ? T.nFirm : T.nGentle, v);
  }
  function logNudge(e, tone) { if (C.recordNudge(e, tone, C.today())) save(); }
  function nudgeDialog(e) {
    var tone = st.settings.tone, p = C.findPerson(st, e.personId) || { name: '' };
    var edited = false, ta = h('textarea', { id: 'n-text', rows: 6, oninput: function () { edited = true; } }); ta.value = nudgeText(e, tone);
    var late = e.dir === 'out' && C.daysLate(e) > 0;
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('nudgeTone') }, ['gentle', 'firm', 'final'].map(function (k) {
      return h('label', null, h('input', { type: 'radio', name: 'tone', value: k, checked: k === tone, onchange: function () { tone = k; if (!edited) ta.value = nudgeText(e, tone); } }), h('span', { text: t({ gentle: 'tGentle', firm: 'tFirm', final: 'tFinal' }[k]) }));
    }));
    var row = h('div', { class: 'row' }, h('button', { type: 'button', text: t('close'), onclick: function () { d.close(); } }));
    if (navigator.share) row.appendChild(h('button', { type: 'button', text: t('nudgeShare'), onclick: function () { navigator.share({ text: ta.value }).then(function () { logNudge(e, tone); }, function () {}); } }));
    row.appendChild(h('button', { type: 'button', class: 'pri', id: 'n-copy', text: t('nudgeCopy'), onclick: function () { copy(ta.value).then(function (ok) { if (!ok) ta.select(); else logNudge(e, tone); toast(ok ? t('nudgeCopied') : t('copyFail')); }); } }));
    var d = dialog([h('h2', { text: t('nudge') + ' · ' + p.name }), late ? h('div', { style: 'margin-top:12px' }, seg) : null, h('label', { for: 'n-text', text: t('nudgeNote') }), ta, row]);
  }
  function drawCard(e) {
    var p = C.findPerson(st, e.personId) || { name: '' }, cv = document.createElement('canvas'), W = 720, H = 400; cv.width = W; cv.height = H; var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0f766e'); g.addColorStop(1, '#0b5d56'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f6f3ec'; c.beginPath(); c.roundRect ? c.roundRect(24, 24, W - 48, H - 48, 24) : c.rect(24, 24, W - 48, H - 48); c.fill();
    var ink = '#1f2a2e', mute = '#55636a', font = 'system-ui,-apple-system,"Segoe UI","Noto Sans KR","Noto Sans JP","Noto Sans SC",sans-serif';
    function line(txt, x, y, size, weight, col, max) { c.font = weight + ' ' + size + 'px ' + font; c.fillStyle = col; c.textBaseline = 'alphabetic'; var s2 = txt; while (c.measureText(s2).width > max && s2.length > 1) s2 = s2.slice(0, -2); c.fillText(s2 === txt ? txt : s2 + '…', x, y); }
    line(t('cardTitle'), 56, 84, 30, '800', '#0f766e', W - 112);
    line(e.kind === 'money' ? fmtMoney(e.amount, e.currency) : e.title, 56, 160, 48, '800', ink, W - 112);
    if (e.kind === 'money' && e.title) line(e.title, 56, 196, 24, '500', mute, W - 112);
    line((e.dir === 'out' ? t('toPerson', { name: p.name }) : t('fromPerson', { name: p.name })), 56, 244, 30, '600', ink, W - 112);
    line(t('lentOn') + ': ' + fmtDate(e.date), 56, 292, 24, '500', mute, W - 112);
    line(t('dueOn') + ': ' + (e.due ? fmtDate(e.due) : t('noDue')), 56, 328, 24, '600', ink, W - 112);
    line(t('cardFooter'), 56, 364, 18, '500', mute, W - 112);
    cv.toBlob(function (b) { if (!b) return; var url = URL.createObjectURL(b), a = h('a', { href: url, download: 'lendnest-note.png' }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000); });
  }
  function receiptText(e) {
    var p = C.findPerson(st, e.personId) || { name: '' };
    return C.fill(e.due ? T.receiptDue : T.receiptNoDue, { what: e.kind === 'money' ? fmtMoney(e.amount, e.currency) : e.title, name: p.name, date: fmtDate(e.date), due: e.due ? fmtDate(e.due) : '' });
  }

  /* ---------- detail ---------- */
  function history(e, onDel) {
    var rows = [[e.date, t(e.dir === 'out' ? 'hLent' : 'hBorrowed')]];
    (e.repayments || []).forEach(function (r) { rows.push([r.date, t(r.auto ? 'hSettled' : 'hRepaid', { a: fmtMoney(r.amount, e.currency) }), r]); });
    (e.extended || []).forEach(function (x) { rows.push([x.date, t('hExtended', { due: fmtDate(x.due) })]); });
    (e.nudges || []).forEach(function (n) { rows.push([n.date, t('hNudged', { tone: t({ gentle: 'tGentle', firm: 'tFirm', final: 'tFinal' }[n.tone]) })]); });
    if (e.returnedAt) rows.push([e.returnedAt, t('hReturned')]); if (e.writtenOff) rows.push(['', t('hWritten')]);
    return h('ul', { class: 'tl' }, rows.sort(function (a, b) { if (!a[0] || !b[0]) return a[0] ? -1 : b[0] ? 1 : 0; return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }).map(function (r) {
      return h('li', null, r[0] ? h('time', { text: fmtDate(r[0]) }) : null, r[1], r[2] ? h('button', { type: 'button', class: 'link', 'data-del-repay': r[2].id, 'aria-label': t('del') + ': ' + r[1], text: '×', onclick: function () { onDel(r[2]); } }) : null);
    }));
  }
  function detail(e) {
    var p = C.findPerson(st, e.personId) || { name: '?' }, s = C.status(e), closed = C.isClosed(e);
    function act(label, fn, cls) { return h('button', { type: 'button', class: cls || '', text: label, onclick: function () { d.close(); fn(); } }); }
    var acts = h('div', { class: 'actions' });
    if (!closed) {
      acts.appendChild(act(e.kind === 'money' ? t('repay') : t('markReturned'), function () { e.kind === 'money' ? doRepay(e) : doReturned(e); }, 'pri'));
      acts.appendChild(act(t('markReturnedOn'), function () { doReturnedOn(e); }));
      if (e.kind === 'money') acts.appendChild(act(t('markReturned'), function () { doReturned(e); }));
      acts.appendChild(act(t('nudge'), function () { nudgeDialog(e); }));
      acts.appendChild(act(t('extend'), function () { doExtend(e); }));
      acts.appendChild(h('button', { type: 'button', id: 'd-card', text: t('cardSave'), onclick: function () { drawCard(e); } }));
      if (e.dir === 'out') acts.appendChild(h('button', { type: 'button', text: t('receipt'), onclick: function () { copyOrShow(t('receipt'), receiptText(e), t('receiptCopied')); } }));
      if (e.dir === 'out') acts.appendChild(act(t('writeOff'), function () { doWriteOff(e); }, 'danger'));
    } else if (!(e.kind === 'money' && !e.writtenOff && !e.repayments.some(function (r) { return r.auto; }))) acts.appendChild(act(t('reopen'), function () { var before = snapshot(), ok = C.reopen(e); if (!ok) { st = C.sanitize(JSON.parse(before)); render(); toast(t('reopenFull')); return; } save(); var mine = saveSeq, after = rawNow(); render(); toast(t('saved'), function () { if (saveSeq !== mine) return; if (rawNow() !== after) { var f = storedState(); if (f) st = f; render(); toast(t('conflict')); return; } st = C.sanitize(JSON.parse(before)); save(); render(); }); }));
    acts.appendChild(act(t('edit'), function () { entryForm(e); })); acts.appendChild(act(t('del'), function () { doDelete(e); }, 'danger'));
    var d = dialog([h('h2', { text: e.kind === 'money' ? fmtMoney(e.amount, e.currency) + (e.title ? ' · ' + e.title : '') : e.title }),
      h('div', { class: 'sub', text: (e.dir === 'out' ? t('toPerson', { name: p.name }) : t('fromPerson', { name: p.name })) + ' · ' + statusText(e) }),
      e.photo ? h('img', { class: 'thumb', src: e.photo, alt: e.title }) : null, e.kind === 'money' ? progress(e) : null,
      e.note ? h('p', { text: e.note, style: 'white-space:pre-wrap;overflow-wrap:anywhere' }) : null, h('h2', { class: 'sec', text: t('history') }), history(e, function (r) { d.close(); undoable(t('repayRemoved'), function () { e.repayments = e.repayments.filter(function (x) { return x !== r; }); e.gone = (e.gone || []).concat(r.id).slice(-200); C.normalize(e); }); }), acts,
      h('div', { class: 'row' }, h('button', { type: 'button', text: t('close'), onclick: function () { d.close(); } }))]);
  }

  /* ---------- views ---------- */
  function statusText(e) {
    var s = C.status(e);
    if (s === 'returned') return t('returnedOn', { date: fmtDate(e.returnedAt) }); if (s === 'written') return t('sWritten');
    if (!e.due) return t('noDueShort'); var l = C.daysLeft(e);
    if (l < 0) return l === -1 ? t('lateOne') : t('late', { n: -l }); if (l === 0) return t('dueToday'); if (l === 1) return t('dueTomorrow'); return t('dueIn', { n: l });
  }
  function instLine(e) { var i = C.installment(e); return i && !C.isClosed(e) ? h('div', { class: 'sub', text: t('instNext', { k: i.k, n: i.n, a: fmtMoney(Math.min(i.each, C.remaining(e)), e.currency), date: fmtDate(i.due) }) }) : null; }
  function progress(e) {
    var pct = e.amount ? Math.min(100, Math.round(C.paid(e) / e.amount * 100)) : 0;
    return h('div', null, instLine(e), h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': t('repaid', { a: fmtMoney(C.paid(e), e.currency), t: fmtMoney(e.amount, e.currency) }) }, h('i', { style: 'width:' + pct + '%' })),
      h('div', { class: 'sub', text: C.paid(e) > 0 ? t('repaid', { a: fmtMoney(C.paid(e), e.currency), t: fmtMoney(e.amount, e.currency) }) : t('leftAmt', { a: fmtMoney(e.amount, e.currency) }) }));
  }
  function entryCard(e) {
    var p = C.findPerson(st, e.personId) || { name: '?' }, s = C.status(e);
    var head = h('button', { type: 'button', class: 'head', 'data-id': e.id, onclick: function () { detail(e); } },
      h('span', { class: 'avatar', 'aria-hidden': 'true', text: Array.from(p.name)[0] ? Array.from(p.name)[0].toUpperCase() : '?' }),
      h('span', { class: 'grow' }, h('span', { class: 'title', text: e.kind === 'money' ? fmtMoney(e.amount, e.currency) + (e.title ? ' · ' + e.title : '') : e.title }), h('br'),
        h('span', { class: 'sub', text: (e.dir === 'out' ? t('toPerson', { name: p.name }) : t('fromPerson', { name: p.name })) + ' · ' + (e.dir === 'out' ? t('sinceLent', { date: fmtDate(e.date) }) : t('sinceBorrowed', { date: fmtDate(e.date) })) })),
      h('span', { class: 'chip ' + s, text: statusText(e) }));
    var card = h('div', { class: 'card ' + s + (C.isClosed(e) ? ' closed' : ''), 'data-status': s }, head, e.kind === 'money' && !C.isClosed(e) ? progress(e) : null);
    if (e.tags && e.tags.length) card.appendChild(h('div', { class: 'chips', 'aria-label': t('tags') }, e.tags.map(function (x) { return h('span', { class: 'chip', text: '#' + x }); })));
    var ln = C.lastNudge(e); if (ln && e.dir === 'out' && !C.isClosed(e)) card.appendChild(h('p', { class: 'sub', style: 'margin:6px 0 0', text: t('lastNudged', { date: fmtDate(ln.date) }) }));
    if (!C.isClosed(e)) {
      var a = h('div', { class: 'actions' }, h('button', { type: 'button', class: 'pri sm', 'data-id': e.id, 'data-act': 'p', 'aria-label': (e.kind === 'money' ? t('repay') : t('markReturned')) + ': ' + (e.title || fmtMoney(e.amount, e.currency)), text: e.kind === 'money' ? t('repay') : t('markReturned'), onclick: function () { e.kind === 'money' ? doRepay(e) : doReturned(e); } }),
        h('button', { type: 'button', class: 'sm', 'data-id': e.id, 'data-act': 's', 'aria-label': (e.dir === 'out' ? t('nudge') : t('extend')) + ': ' + (e.title || fmtMoney(e.amount, e.currency)), text: e.dir === 'out' ? t('nudge') : t('extend'), onclick: function () { e.dir === 'out' ? nudgeDialog(e) : doExtend(e); } }));
      card.appendChild(a);
    }
    return card;
  }
  var tagFilter = '';
  function tagChips(dir) {
    var list = C.allTags({ entries: st.entries.filter(function (e) { return e.dir === dir; }) }).slice(0, 12);
    if (!list.length) return null;
    if (tagFilter && !list.some(function (x) { return x.tag.toLowerCase() === tagFilter.toLowerCase(); })) tagFilter = '';
    return h('div', { class: 'chips', role: 'group', 'aria-label': t('tags') }, [h('button', { type: 'button', class: 'sm', 'aria-pressed': String(!tagFilter), text: t('tagAll'), onclick: function () { tagFilter = ''; render(); } })].concat(list.map(function (x) {
      var on = tagFilter.toLowerCase() === x.tag.toLowerCase();
      return h('button', { type: 'button', class: 'sm', 'aria-pressed': String(on), text: '#' + x.tag + ' · ' + x.count, onclick: function () { tagFilter = on ? '' : x.tag; render(); } });
    })));
  }
  /* reminders that are due today or earlier, with Open and a 3-day snooze */
  function remindBanner() {
    var all = C.remindersDue(st), due = all.slice(0, 3);
    if (!all.length) return null;
    return h('section', { class: 'banner remind', 'aria-label': t('remindH') }, h('p', { text: t('remindDue', { n: all.length }) }),
      due.map(function (e) {
        var p = C.findPerson(st, e.personId) || { name: '' };
        return h('div', { class: 'row remind-row' }, h('span', { class: 'grow', text: whatOf(e) + ' · ' + p.name }),
          h('button', { type: 'button', class: 'sm', text: t('remindOpen'), onclick: function () { detail(e); } }),
          h('button', { type: 'button', class: 'sm', text: t('remindLater'), onclick: function () { C.snoozeReminder(e, 3); save(); render(); } }));
      }));
  }
  function viewList(dir) {
    var list = st.entries.filter(function (e) { return e.dir === dir && C.match(e, C.findPerson(st, e.personId), q) && (!tagFilter || C.hasTag(e, tagFilter)); });
    var open = C.sortOpen(list.filter(function (e) { return !C.isClosed(e); })), closed = list.filter(C.isClosed).sort(function (a, b) { return (b.returnedAt || '') < (a.returnedAt || '') ? -1 : (b.returnedAt || '') > (a.returnedAt || '') ? 1 : 0; });
    var out = h('div'), sm = C.summary(st);
    if (!st.entries.some(function (e) { return e.dir === dir; })) return h('div', { class: 'empty' }, h('h2', { text: t(dir === 'out' ? 'emptyOutH' : 'emptyInH') }), h('p', { text: t(dir === 'out' ? 'emptyOutB' : 'emptyInB') }), h('button', { class: 'pri', type: 'button', text: t('add'), onclick: function () { entryForm(null); } }));
    var allOpen = st.entries.filter(function (e) { return e.dir === dir && !C.isClosed(e); }), bad = allOpen.filter(function (e) { return C.status(e) === 'overdue'; }).length;
    var tc = tagChips(dir); if (tc) out.appendChild(tc);
    if (bad) out.appendChild(h('div', { class: 'banner bad', text: t('attn', { n: bad }) })); else if (allOpen.length && !allOpen.some(function (e) { return C.status(e) === 'soon'; })) out.appendChild(h('div', { class: 'banner good', text: t('allGood') }));
    var money = moneyMap(dir === 'out' ? sm.owedToMe : sm.iOwe);
    if (money) out.appendChild(h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('b', { text: money }), h('span', { text: dir === 'out' ? t('owedToMe') : t('iOwe') }))));
    open.forEach(function (e) { out.appendChild(entryCard(e)); });
    if (!list.length) out.appendChild(h('div', { class: 'empty', text: t('noMatch') }));
    if (closed.length) {
      out.appendChild(h('button', { type: 'button', class: 'link', id: 'toggle-closed', text: (showClosed ? t('hideClosed') : t('showClosed')) + ' (' + closed.length + ')', onclick: function () { showClosed = !showClosed; render(); } }));
      if (showClosed) closed.forEach(function (e) { out.appendChild(entryCard(e)); });
    }
    return out;
  }
  function scoreChip(s) { return h('span', { class: 'chip ' + (s.score == null ? 'returned' : s.score >= 80 ? '' : s.score >= 60 ? 'soon' : 'overdue'), text: s.score == null ? t('pNoScore') : t('pOnTime', { p: s.score }) }); }
  function viewPeople() {
    var ranked = C.rankPeople(st);
    if (!ranked.length) return h('div', { class: 'empty' }, h('h2', { text: t('emptyPeopleH') }), h('p', { text: t('emptyPeopleB') }));
    var out = h('div'), shown = ranked.filter(function (x) { return C.match({ title: '', note: '' }, x.person, q); });
    if (!shown.length) out.appendChild(h('div', { class: 'empty', text: t('noMatch') }));
    shown.forEach(function (x) {
      var s = x.s, lines = [];
      if (Object.keys(s.owedToMe).length && moneyMap(s.owedToMe)) lines.push(t('pOwes', { a: moneyMap(s.owedToMe) })); if (moneyMap(s.iOwe)) lines.push(t('pYouOwe', { a: moneyMap(s.iOwe) }));
      out.appendChild(h('div', { class: 'card' }, h('button', { type: 'button', class: 'head', 'data-person': x.person.id, onclick: function () { personDialog(x.person); } },
        h('span', { class: 'avatar', 'aria-hidden': 'true', text: Array.from(x.person.name)[0].toUpperCase() }), h('span', { class: 'grow' }, h('span', { class: 'title', text: x.person.name }), h('br'),
          h('span', { class: 'sub', text: [t('pOpen', { n: s.open }), t('pTotal', { n: s.total })].concat(lines).join(' · ') })), scoreChip(s))));
    });
    return out;
  }
  function statementText(p) {
    var list = C.sortOpen(st.entries.filter(function (e) { return e.personId === p.id && !C.isClosed(e); }));
    if (!list.length) return t('stmtNone', { name: p.name });
    var lines = list.map(function (e) { var i = C.installment(e); return '• ' + (e.dir === 'out' ? t('dirOut') : t('dirIn')) + ': ' + (e.kind === 'money' ? fmtMoney(C.remaining(e), e.currency) + (e.title ? ' (' + e.title + ')' : '') : e.title) + ' – ' + statusText(e) + (i ? ' · ' + t('instNext', { k: i.k, n: i.n, a: fmtMoney(Math.min(i.each, C.remaining(e)), e.currency), date: fmtDate(i.due) }) : ''); });
    var sm = C.personStats(st, p.id), tot = []; if (moneyMap(sm.owedToMe)) tot.push(t('pOwes', { a: moneyMap(sm.owedToMe) })); if (moneyMap(sm.iOwe)) tot.push(t('pYouOwe', { a: moneyMap(sm.iOwe) }));
    return [t('stmtHead', { name: p.name, date: fmtDate(C.today()) })].concat(lines, tot).join('\n');
  }
  function personDialog(p) {
    var s = C.personStats(st, p.id), list = C.sortOpen(st.entries.filter(function (e) { return e.personId === p.id && !C.isClosed(e); }));
    var facts = []; if (s.avgKept != null) facts.push(t('pKept', { n: s.avgKept })); if (s.late) facts.push(t('pLate', { n: s.avgLate }));
    var note = h('textarea', { id: 'p-note', maxlength: 1000 }); note.value = p.note || '';
    var d = dialog([h('h2', { text: p.name }), h('div', { class: 'pill-row' }, scoreChip(s)), facts.length ? h('p', { class: 'sub', text: facts.join(' · ') }) : null,
      list.length ? h('div', null, list.map(function (e) { return h('p', { style: 'margin:6px 0' }, h('span', { class: 'chip ' + C.status(e), text: statusText(e) }), ' ' + (e.kind === 'money' ? fmtMoney(C.remaining(e), e.currency) : e.title)); })) : null,
      h('div', { class: 'actions' }, h('button', { type: 'button', id: 'p-stmt', text: t('statement'), onclick: function () { copyOrShow(t('statement'), statementText(p), t('nudgeCopied')); } })),
      h('label', { for: 'p-note', text: t('pNote') }), note,
      h('div', { class: 'row' }, h('button', { type: 'button', text: t('close'), onclick: function () { d.close(); } }), h('button', { type: 'button', class: 'danger', text: t('delPerson'), onclick: function () { if (st.entries.some(function (x) { return x.personId === p.id; })) { toast(t('delPersonBlocked')); return; } d.close(); confirmBox(t('delPerson') + ': ' + p.name + '?' + (p.note ? ' ' + t('pNote') + '!' : ''), t('delPerson'), true).then(function (ok) { if (ok) undoable(t('deleted'), function () { C.removePerson(st, p.id); }); }); } }),
        h('button', { type: 'button', text: t('renamePerson'), onclick: function () { d.close(); askText(t('renamePerson'), t('renamePrompt'), p.name).then(function (v) { if (!v || !v.trim()) return; var o = C.personByName(st, v); if (o && o.id !== p.id) { toast(t('nameTaken')); return; } p.name = C.str(v, 60); save(); render(); }); } }),
        h('button', { type: 'button', class: 'pri', text: t('save'), onclick: function () { p.note = note.value.slice(0, 1000); save(); d.close(); toast(t('saved')); } }))]);
  }
  function monthName(k) { try { return new Intl.DateTimeFormat(lang, { month: 'short' }).format(new Date(+k.slice(0, 4), +k.slice(5) - 1, 1)) + (k.slice(5) === '01' ? ' ' + k.slice(2, 4) : ''); } catch (e) { return k.slice(5); } }
  function chartSvg(series) {
    var W = 320, H = 130, base = 104, max = Math.max(1, Math.max.apply(null, series.map(function (m) { return Math.max(m.lent, m.back); }))), ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('chart') + ': ' + series.map(function (m) { return m.key + ' ' + m.lent + '/' + m.back; }).join(', '));
    function el(n, a, txt) { var x = document.createElementNS(ns, n); for (var k in a) x.setAttribute(k, a[k]); if (txt != null) x.textContent = txt; svg.appendChild(x); }
    var step = W / series.length;
    series.forEach(function (m, i) {
      var x = i * step + step / 2, hl = m.lent / max * 80, hb = m.back / max * 80;
      el('rect', { x: x - 14, y: base - hl, width: 12, height: hl, rx: 3, style: 'fill:var(--c1)' }); el('rect', { x: x + 2, y: base - hb, width: 12, height: hb, rx: 3, style: 'fill:var(--c2)' });
      if (m.lent) el('text', { x: x - 8, y: base - hl - 3, 'text-anchor': 'middle' }, m.lent); if (m.back) el('text', { x: x + 8, y: base - hb - 3, 'text-anchor': 'middle' }, m.back);
      el('text', { x: x, y: 122, 'text-anchor': 'middle' }, monthName(m.key));
    });
    return svg;
  }
  function viewInsights() {
    if (!st.entries.length) return h('div', { class: 'empty' }, h('h2', { text: t('emptyInsH') }), h('p', { text: t('emptyInsB') }));
    var sm = C.summary(st), out = h('div'), stats = h('div', { class: 'stats' });
    function stat(v, l) { stats.appendChild(h('div', { class: 'stat' }, h('b', { text: v }), h('span', { text: l }))); }
    if (moneyMap(sm.owedToMe)) stat(moneyMap(sm.owedToMe), t('owedToMe')); if (moneyMap(sm.iOwe)) stat(moneyMap(sm.iOwe), t('iOwe'));
    stat(String(sm.itemsOut), t('itemsOut')); stat(String(sm.itemsIn), t('itemsIn')); stat(String(sm.overdue), t('overdueN')); stat(String(sm.soon), t('soonN'));
    out.appendChild(stats);
    var up = C.upcoming(st, 5); out.appendChild(h('h2', { class: 'sec', text: t('upcoming') }));
    if (!up.length) out.appendChild(h('div', { class: 'sub', text: t('upNone') }));
    up.forEach(function (e) { var pp = C.findPerson(st, e.personId) || { name: '?' }; out.appendChild(h('div', { class: 'card', style: 'margin:6px 0' }, h('button', { type: 'button', class: 'head', 'data-id': e.id, onclick: function () { detail(e); } },
      h('span', { class: 'grow' }, h('span', { class: 'title', text: whatOf(e) }), h('br'), h('span', { class: 'sub', text: (e.dir === 'out' ? t('toPerson', { name: pp.name }) : t('fromPerson', { name: pp.name })) })), h('span', { class: 'chip ' + C.status(e), text: statusText(e) })))); });
    var lo = C.longestOut(st); if (lo && lo.days >= 1) out.appendChild(h('div', { class: 'banner', text: t('longest', { what: lo.entry.kind === 'money' ? fmtMoney(C.remaining(lo.entry), lo.entry.currency) : lo.entry.title, name: (C.findPerson(st, lo.entry.personId) || {}).name, n: lo.days }) }));
    out.appendChild(h('div', { class: 'card' }, h('h2', { text: t('chart') }), chartSvg(C.monthlySeries(st, 6)), h('div', { class: 'legend' }, h('span', null, h('i', { style: 'background:var(--c1)' }), t('cLent')), h('span', null, h('i', { style: 'background:var(--c2)' }), t('cBack')))));
    var ts = C.tagSummary(st);
    if (ts.length) {
      out.appendChild(h('h2', { class: 'sec', text: t('tagSumH') }));
      ts.slice(0, 10).forEach(function (r) {
        var money = moneyMap(r.money);
        out.appendChild(h('div', { class: 'card', style: 'margin:6px 0' }, h('div', { class: 'head' }, h('span', { class: 'grow title', text: '#' + r.tag }), h('span', { class: 'sub', text: t('tagCounts', { o: r.open, c: r.closed }) })), money ? h('p', { class: 'sub', style: 'margin:6px 0 0', text: t('tagOwed', { a: money }) }) : null));
      });
    }
    var rk = C.rankPeople(st).filter(function (x) { return x.s.open > 0; }).slice(0, 5);
    if (rk.length) { out.appendChild(h('h2', { class: 'sec', text: t('ranking') })); rk.forEach(function (x) { out.appendChild(h('div', { class: 'card' }, h('div', { class: 'head' }, h('span', { class: 'grow title', text: x.person.name }), h('span', { class: 'sub', text: t('pOpen', { n: x.s.open }) }), scoreChip(x.s)))); }); }
    return out;
  }
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type })), a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function viewSettings() {
    var out = h('div', { class: 'set' });
    var sel = h('select', { id: 's-lang', onchange: function () { st.settings.lang = this.value; try { localStorage.setItem('lendnest.lang', this.value); } catch (e) {} save(); setLang(this.value); render(); } }, I.langs.map(function (l) { return h('option', { value: l, text: I.L[l].name, selected: l === lang }); }));
    var cur = h('input', { type: 'text', id: 's-cur', maxlength: 8, value: st.settings.currency, onchange: function () { st.settings.currency = (this.value.trim().toUpperCase() || 'USD').slice(0, 8); save(); } });
    var days = h('input', { type: 'number', id: 's-days', min: 1, max: 365, value: st.settings.days, onchange: function () { st.settings.days = Math.min(365, Math.max(1, parseInt(this.value, 10) || 14)); this.value = st.settings.days; save(); } });
    var tone = h('select', { id: 's-tone', onchange: function () { st.settings.tone = this.value; save(); } }, [['gentle', 'tGentle'], ['firm', 'tFirm'], ['final', 'tFinal']].map(function (x) { return h('option', { value: x[0], text: t(x[1]), selected: st.settings.tone === x[0] }); }));
    var file = h('input', { type: 'file', accept: 'application/json,.json', id: 's-file', hidden: true });
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return; var r = new FileReader();
      r.onload = function () { try { var raw = JSON.parse(r.result), imp = C.sanitize(raw); if (!imp) throw 0; var skipped = raw.entries.length - imp.entries.length, m = C.merge(st, imp); st = m.state; save(); render(); toast(t('restored', { n: m.added }) + (skipped > 0 ? ' ' + t('skipped', { n: skipped }) : '')); } catch (e) { toast(t('badFile')); } };
      r.onerror = function () { toast(t('badFile')); }; r.readAsText(f); file.value = '';
    });
    out.appendChild(h('div', { class: 'card' }, h('label', { for: 's-lang', text: t('language') }), sel, h('label', { for: 's-cur', text: t('defCur') }), cur, h('label', { for: 's-days', text: t('defDays') }), days, h('label', { for: 's-tone', text: t('defTone') }), tone));
    out.appendChild(h('div', { class: 'card' }, h('div', { class: 'actions', style: 'margin-top:0' },
      h('button', { type: 'button', id: 's-backup', text: t('backup'), onclick: function () { download('lendnest-' + C.today() + '.json', JSON.stringify(st, null, 1), 'application/json'); toast(t('backupDone')); } }),
      h('button', { type: 'button', id: 's-restore', text: t('restore'), onclick: function () { file.click(); } }),
      h('button', { type: 'button', id: 's-csv', text: t('exportCsv'), onclick: function () { download('lendnest-' + C.today() + '.csv', C.toCSV(st), 'text/csv'); } }),
      h('button', { type: 'button', id: 's-ics', text: t('exportIcs'), onclick: function () { if (!st.entries.some(function (e) { return e.due && !C.isClosed(e); })) { toast(t('icsEmpty')); return; } download('lendnest-reminders.ics', C.toICS(st, { out: t('ics_out'), in: t('ics_in') }), 'text/calendar'); } })),
      h('p', { text: t('icsHint') }), file));
    out.appendChild(h('div', { class: 'card' }, h('button', { type: 'button', class: 'danger', id: 's-wipe', text: t('wipe'), onclick: function () { confirmBox(t('wipeConfirm') + ' ' + t('wipeNote'), t('wipe'), true).then(function (ok) { if (ok) eraseAll(); }); } }),
      h('p', { text: t('privacy') }), h('p', { text: t('installHint') })));
    out.appendChild(h('section', { class: 'card', style: 'margin-top:16px', 'aria-labelledby': 'lic-h' }, h('h3', { id: 'lic-h', text: t('payLicH') }),
      h('p', { class: 'sub', text: licensed() ? t('payLicensed') : '' }),
      h('button', { type: 'button', class: 'danger', id: 'lic-remove', text: t('payRemove'), onclick: function () { setLicence(null); render(); toast(t('payRemoved')); } })));
    return out;
  }

  /* ---------- shell ---------- */
  var TABS = [['out', 'tabOut'], ['in', 'tabIn'], ['people', 'tabPeople'], ['ins', 'tabIns'], ['set', 'tabSet']];
  function buildView() { return tab === 'out' || tab === 'in' ? viewList(tab) : tab === 'people' ? viewPeople() : tab === 'ins' ? viewInsights() : viewSettings(); }
  function eraseAll() {
    var keep = st.settings; try { Object.keys(localStorage).filter(function (k) { return k.indexOf(KEY + '.corrupt') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); localStorage.removeItem(KEY); } catch (e) {}
    corrupt = false; corruptRaw = ''; rawSafe = true; copyKept = true; st = C.newState(); st.settings = keep; save(); render(); toast(t('wiped'));
  }
  function lockedView() {
    var root = document.getElementById('root'); root.textContent = '';
    root.appendChild(h('main', { id: 'main', class: 'wrap', style: 'padding-top:24px' }, h('h1', { class: 'brand', text: t('app') }), h('div', { class: 'banner bad', role: 'alert', text: t('corruptNoCopy') }),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'pri', id: 'dl-corrupt', text: t('downloadRaw'), onclick: function () { download('lendnest-unreadable.txt', corruptRaw, 'text/plain'); rawSafe = true; render(); } }),
        h('button', { type: 'button', class: 'danger', id: 's-wipe', text: t('wipe'), onclick: function () { confirmBox(t('wipeConfirm') + ' ' + t('wipeNote'), t('wipe'), true).then(function (ok) { if (ok) eraseAll(); }); } }))));
  }
  function render() {
    if (!licensed()) return renderPaywall();
    if (corruptRaw && !rawSafe) { lockedView(); return; }
    var root = document.getElementById('root'), keepScroll = window.scrollY, view, ae = document.activeElement, sel = ae && ae !== document.body ? (ae.getAttribute('data-tab') ? '[data-tab="' + ae.getAttribute('data-tab') + '"]' : ae.getAttribute('data-act') ? '[data-id="' + ae.getAttribute('data-id') + '"][data-act="' + ae.getAttribute('data-act') + '"]' : ae.getAttribute('data-id') ? '[data-id="' + ae.getAttribute('data-id') + '"]' : ae.id ? '#' + ae.id : '') : '';
    var search = (tab === 'out' || tab === 'in' || tab === 'people') && st.entries.length ? h('div', { class: 'search' }, h('input', { type: 'search', id: 'q', value: q, placeholder: t('search'), 'aria-label': t('search'), oninput: function () { q = this.value; var w = document.getElementById('listwrap'); if (w) { w.textContent = ''; w.appendChild(buildView()); } } })) : null;
    view = h('div', { id: 'listwrap' }, buildView());
    root.textContent = '';
    root.appendChild(h('header', { class: 'top' }, h('div', { class: 'wrap' }, h('h1', { class: 'brand' }, logo(), h('span', { text: t('app') })))));
    var rb = remindBanner(); if (rb) root.appendChild(rb);
    root.appendChild(h('main', { id: 'main', class: 'wrap', tabindex: '-1' }, saveFailed ? h('div', { class: 'banner bad', role: 'alert', text: t('storageErr') }) : null, corrupt ? h('div', { class: 'banner bad', role: 'alert' }, t(copyKept ? 'corrupt' : 'corruptFile') + ' ', h('button', { type: 'button', class: 'link', id: 'dl-corrupt', text: t('downloadRaw'), onclick: function () { var txt = corruptRaw; try { if (!txt) { var k = Object.keys(localStorage).filter(function (x) { return x.indexOf(KEY + '.corrupt') === 0; })[0]; txt = k ? localStorage.getItem(k) : ''; } } catch (e) {} if (!txt) return; download('lendnest-unreadable.txt', txt, 'text/plain'); rawSafe = true; saveFailed = false; render(); } })) : null, search, view));
    if (tab !== 'set') root.appendChild(h('button', { type: 'button', class: 'pri fab', id: 'fab', text: '+ ' + t('add'), onclick: function () { entryForm(null); } }));
    root.appendChild(h('nav', { class: 'tabs', 'aria-label': t('app') }, h('div', { class: 'wrap' }, TABS.map(function (x) {
      return h('button', { type: 'button', 'data-tab': x[0], 'aria-current': tab === x[0] ? 'page' : null, onclick: function () { if (tab !== x[0]) { tab = x[0]; q = ''; render(); window.scrollTo(0, 0); } } }, svgIcon(ICON[x[0]]), h('span', { text: t(x[1]) }));
    }))));
    window.scrollTo(0, keepScroll);
    if (sel && sel !== '#q') { var nf = root.querySelector(sel); if (!nf && ae.getAttribute('data-act')) nf = root.querySelector('.head[data-id="' + ae.getAttribute('data-id') + '"]'); if (nf) nf.focus({ preventScroll: true }); }
  }
  function logo() { var s = svgIcon('M7 8.5h8.2M13 5.5l3 3-3 3M17 15.5H8.8M11 12.5l-3 3 3 3'); s.setAttribute('style', 'stroke:var(--pri);fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round'); return s; }

  /* ---------- licence (paid app): the app is locked until a key is activated on this device ---------- */
  var LIC_KEY = 'lendnest.licence', WEEK = 7 * 86400000, payMsg = '', payBusy = false;
  function licence() { try { var o = JSON.parse(localStorage.getItem(LIC_KEY) || 'null'); return o && typeof o.key === 'string' && o.key ? o : null; } catch (e) { return null; } }
  function licensed() { return !!licence(); }
  function setLicence(o) { try { if (o) localStorage.setItem(LIC_KEY, JSON.stringify(o)); else localStorage.removeItem(LIC_KEY); } catch (e) {} }
  function callLicense(body) {
    var ctl = window.AbortController ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : 0;
    return fetch('/api/license', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }, function () { return { status: r.status, j: null }; }); })
      .then(function (x) { clearTimeout(timer); return x; }, function (e) { clearTimeout(timer); throw e; });
  }
  function activate(raw) {
    var key = String(raw || '').trim(); if (!key) { payMsg = 'payBadKey'; return render(); }
    payBusy = true; payMsg = ''; render();
    callLicense({ action: 'activate', key: key }).then(function (r) {
      payBusy = false;
      if (r.j && r.j.configured === true) {
        if (r.status === 502 || r.j.reason === 'unreachable') { payMsg = 'payNetErr'; return render(); }
        if (r.j.ok) { setLicence({ key: key, checked: Date.now() }); render(); toast(t('payOk')); return; }
        payMsg = 'payBadKey'; return render();
      }
      payMsg = 'payNotReady'; render();
    }, function () { payBusy = false; payMsg = 'payNetErr'; render(); });
  }
  /* once a week a licence is checked again; only an explicit "invalid" or "refunded" from the server removes it */
  function recheck() {
    var L = licence(); if (!L || Date.now() - (L.checked || 0) < WEEK) return;
    callLicense({ action: 'validate', key: L.key }).then(function (r) {
      if (!r.j || r.j.configured !== true || r.status === 502) return;
      if (r.j.ok) { L.checked = Date.now(); setLicence(L); }
      else if (r.j.reason === 'invalid' || r.j.reason === 'refunded') { setLicence(null); payMsg = 'payBadKey'; render(); }
    }, function () {});
  }
  function renderPaywall() {
    var root = document.getElementById('root'), site = window.LN_SITE || {}, ae = document.activeElement, keyVal = '';
    var keyEl = document.getElementById('pay-key'); if (keyEl) keyVal = keyEl.value;
    root.textContent = '';
    var key = h('input', { type: 'text', id: 'pay-key', value: keyVal, placeholder: t('payKeyPh'), autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' });
    var form = h('form', { onsubmit: function (ev) { ev.preventDefault(); if (!payBusy) activate(key.value); } },
      h('label', { for: 'pay-key', text: t('payKeyLbl') }), key,
      h('div', { class: 'row' }, h('button', Object.assign({ type: 'submit', class: 'pri', id: 'pay-act', text: t('payActivate') }, payBusy ? { disabled: '' } : {}))),
      h('p', { id: 'pay-msg', role: 'status', class: 'hint', text: payMsg ? t(payMsg) : '' }));
    var buy = site.checkoutUrl ? h('p', null, h('a', { class: 'btn', id: 'pay-buy', href: site.checkoutUrl, rel: 'noopener', target: '_blank', text: t('payBuy') })) : h('p', { class: 'hint', text: t('payNotSale') });
    root.appendChild(h('header', { class: 'top' }, h('div', { class: 'wrap' }, h('h1', { class: 'brand' }, logo(), h('span', { text: t('app') })))));
    root.appendChild(h('main', { id: 'main', class: 'wrap', tabindex: '-1', style: 'padding-top:24px' },
      h('section', { class: 'card', 'aria-labelledby': 'pay-h' }, h('h2', { id: 'pay-h', text: t('payTitle') }), h('p', { class: 'sub', text: t('payLede') }),
        h('p', { style: 'font-size:28px;font-weight:700;margin:12px 0 4px', text: t('payPrice', { price: site.price || '' }) }),
        h('h3', { text: t('payIncl') }), h('ul', null, [t('payB1'), t('payB2'), t('payB3')].map(function (x) { return h('li', { text: x }); })), buy),
      h('section', { class: 'card', style: 'margin-top:16px' }, h('h3', { text: t('payHave') }), form),
      h('p', { class: 'hint', style: 'margin-top:16px', text: t('payFoot') })));
    if (ae && ae.id === 'pay-key') key.focus();
  }

  /* ---------- boot ---------- */
  st = load(); var landLang = ''; try { landLang = localStorage.getItem('lendnest.lang') || ''; } catch (e) {} setLang(st.settings.lang || (I.L[landLang] ? landLang : I.detect(navigator))); render(); if (!corrupt) save();
  recheck();
  window.__ln = { get state() { return st; } };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !document.querySelector('dialog[open]')) render(); });
})();
