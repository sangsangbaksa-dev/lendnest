/* Lendnest core: pure logic, no DOM. Works in the browser (window.LN) and in Node (require). */
(function (root) {
  'use strict';
  var MAX_AMOUNT = 1e12, ID_RE0 = /^[A-Za-z0-9_-]{1,40}$/, ID_RE = { test: function (x) { return typeof x === 'string' && ID_RE0.test(x) && ['__proto__', 'constructor', 'prototype'].indexOf(x) < 0; } }, DAY = 86400000, MAX_PHOTO = 150000, MAX = { people: 20000, entries: 100000, text: 200, note: 1000 };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today(now) { return ymd(now || new Date()); }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parse(s)) === s; }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((parse(a) - parse(b)) / DAY); } /* a - b */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function round2(x) { return Math.round(x * 100 + (x >= 0 ? 1e-9 : -1e-9)) / 100; }
  function str(v, max) { return typeof v === 'string' ? Array.from(v.trim().replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\ufffd')).slice(0, max || MAX.text).join('') : ''; }

  function newState() { return { v: 1, people: [], entries: [], settings: { lang: '', currency: 'USD', days: 14, tone: 'gentle' } }; }

  /* ---- entry model ----
     { id, dir:'out'|'in', kind:'item'|'money', title, personId, amount, currency, date, due,
       repayments:[{id,date,amount}], returnedAt, writtenOff, extended:[{date,due}], note, photo, created } */
  function paid(e) { return round2((e.repayments || []).reduce(function (s, r) { return s + r.amount; }, 0)); }
  function remaining(e) { return e.kind === 'money' ? Math.max(0, round2(e.amount - paid(e))) : 0; }
  function isClosed(e) { return !!(e.returnedAt || e.writtenOff); }
  function status(e, now) {
    var t = now || today();
    if (e.writtenOff) return 'written';
    if (e.returnedAt) return 'returned';
    if (!e.due) return 'open';
    var left = diffDays(e.due, t);
    if (left < 0) return 'overdue';
    if (left <= 3) return 'soon';
    return 'open';
  }
  function daysLate(e, now) { return e.due && !isClosed(e) ? Math.max(0, diffDays(now || today(), e.due)) : 0; }
  function daysLeft(e, now) { return e.due ? diffDays(e.due, now || today()) : null; }

  /* installment plan: the due date follows the next unpaid monthly installment */
  function applyPlan(e) {
    if (e.kind !== 'money' || !e.plan || isClosed(e) || !(e.amount > 0)) return;
    var k = Math.min(e.plan.n - 1, Math.floor(paid(e) / (e.amount / e.plan.n) + 1e-9)); var d = addDays(e.date, e.plan.every * (k + 1)); var ex = e.extended && e.extended.length ? e.extended[e.extended.length - 1].due : ''; e.due = ex && ex > d ? ex : d;
  }
  function installment(e) {
    if (e.kind !== 'money' || !e.plan) return null;
    var each = round2(e.amount / e.plan.n), k = Math.min(e.plan.n - 1, Math.floor(paid(e) / (e.amount / e.plan.n) + 1e-9));
    return { k: k + 1, n: e.plan.n, each: each, due: addDays(e.date, e.plan.every * (k + 1)) };
  }
  function repay(e, amount, date) {
    if (e.kind !== 'money' || isClosed(e)) return false;
    var a = round2(Number(amount)); if (!(a > 0) || !isFinite(a) || !isDate(date)) return false;
    a = Math.min(a, remaining(e));
    e.repayments.push({ id: uid(), date: date, amount: a });
    if (remaining(e) === 0) { e.returnedAt = date; e.reopened = false; }
    applyPlan(e);
    return true;
  }
  function markReturned(e, date) {
    if (isClosed(e) || !isDate(date)) return false;
    if (e.kind === 'money') { var r = remaining(e); if (r > 0) e.repayments.push({ id: uid(), date: date, amount: r, auto: true }); }
    e.returnedAt = date; e.reopened = false; return true;
  }
  function writeOff(e) { if (isClosed(e)) return false; e.writtenOff = true; e.reopened = false; return true; }
  function reopen(e) {
    if (!isClosed(e)) return false;
    if (e.kind === 'money' && e.returnedAt) { if (round2(e.amount - e.repayments.filter(function (r) { return !r.auto; }).reduce(function (a, r) { return a + r.amount; }, 0)) <= 0) return false; e.gone = (e.gone || []).concat(e.repayments.filter(function (r) { return r.auto; }).map(function (r) { return r.id; })).slice(-200); e.repayments = e.repayments.filter(function (r) { return !r.auto; }); if (remaining(e) === 0) return false; }
    e.returnedAt = null; e.writtenOff = false; e.reopened = true; return true;
  }
  /* after an edit: keep the closed flag consistent with the money left */
  function normalize(e) {
    if (e.kind !== 'money') { e.repayments = []; e.amount = 0; return; }
    if (e.writtenOff) return;
    var autos = e.repayments.filter(function (r) { return r.auto; });
    if (autos.length && e.returnedAt) { /* a settled loan stays settled: keep manual + settlement equal to the amount */
      var manual = round2(e.repayments.filter(function (r) { return !r.auto; }).reduce(function (a, r) { return a + r.amount; }, 0)), rem = round2(e.amount - manual);
      e.repayments = e.repayments.filter(function (r) { return !r.auto; }); if (rem > 0) e.repayments.push({ id: autos[0].id, date: autos[0].date, amount: rem, auto: true });
    }
    if (remaining(e) > 0) { if (e.returnedAt) { e.gone = (e.gone || []).concat(e.repayments.filter(function (r) { return r.auto; }).map(function (r) { return r.id; })).slice(-200); e.repayments = e.repayments.filter(function (r) { return !r.auto; }); } e.returnedAt = null; } else if (e.amount > 0 && !e.returnedAt) e.returnedAt = e.repayments.length ? e.repayments[e.repayments.length - 1].date : today();
    applyPlan(e);
  }
  function upcoming(st, n, now) {
    return sortOpen(st.entries.filter(function (e) { return !isClosed(e) && e.due; }), now).slice(0, n);
  }
  function extend(e, newDue, now) {
    if (isClosed(e) || !isDate(newDue) || newDue < e.date || (e.due && newDue < e.due)) return false;
    e.extended = e.extended || []; e.extended.push({ date: now || today(), due: newDue }); e.due = newDue; return true;
  }
  function makeEntry(o) {
    var kind = o.kind === 'money' ? 'money' : 'item';
    var e = { id: o.id || uid(), dir: o.dir === 'in' ? 'in' : 'out', kind: kind, title: str(o.title), personId: o.personId || '',
      amount: kind === 'money' ? (round2(Number(o.amount)) > 0 && Number(o.amount) <= MAX_AMOUNT ? round2(Number(o.amount)) : 0) : 0, currency: str(o.currency, 8).toUpperCase() || 'USD',
      date: isDate(o.date) ? o.date : today(), due: isDate(o.due) ? o.due : '', repayments: [], returnedAt: null, writtenOff: false, extended: [], gone: [], reopened: false, plan: (kind === 'money' && o.plan && Number.isInteger(o.plan.n) && o.plan.n >= 2 && o.plan.n <= 60) ? { n: o.plan.n, every: 30 } : null,
      note: str(o.note, MAX.note), photo: typeof o.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(o.photo) && o.photo.length <= MAX_PHOTO ? o.photo : '', created: Number.isFinite(o.created) ? o.created : Date.now() };
    return e;
  }
  function validEntry(o) {
    if (!o.title) return 'title'; if (!o.personId) return 'person';
    if (o.kind === 'money' && !(round2(Number(o.amount)) > 0 && Number(o.amount) <= MAX_AMOUNT)) return 'amount';
    if (o.due && isDate(o.date) && o.due < o.date) return 'due';
    return '';
  }

  /* ---- people ---- */
  function findPerson(st, id) { return st.people.find(function (p) { return p.id === id; }); }
  function personByName(st, name) { var n = name.trim().toLowerCase(); return st.people.find(function (p) { return p.name.toLowerCase() === n; }); }
  function addPerson(st, name) {
    name = str(name, 60); if (!name) return null;
    var ex = personByName(st, name); if (ex) return ex;
    var p = { id: uid(), name: name, note: '' }; st.people.push(p); return p;
  }
  function removePerson(st, id) { if (st.entries.some(function (e) { return e.personId === id; })) return false; st.people = st.people.filter(function (p) { return p.id !== id; }); return true; }

  /* Score, lateness and the loan check only look at what you LENT to the person (dir 'out'). Borrowing from them says nothing about their reliability. */
  function personStats(st, id, now) {
    var t = now || today(), list = st.entries.filter(function (e) { return e.personId === id; });
    var s = { total: list.length, open: 0, overdue: 0, lOpen: 0, lOverdue: 0, onTime: 0, late: 0, writtenOff: 0, avgKept: null, avgLate: 0, score: null, owedToMe: {}, iOwe: {}, itemsOut: 0, itemsIn: 0 };
    var kept = [], lateDays = [];
    list.forEach(function (e) {
      var lent = e.dir === 'out';
      if (e.writtenOff) { if (lent) s.writtenOff++; return; }
      if (e.returnedAt) {
        if (!lent) return;
        kept.push(diffDays(e.returnedAt, e.date));
        if (e.due && e.returnedAt > e.due) { s.late++; lateDays.push(diffDays(e.returnedAt, e.due)); } else s.onTime++;
        return;
      }
      var over = status(e, t) === 'overdue'; s.open++; if (over) s.overdue++; if (lent) { s.lOpen++; if (over) s.lOverdue++; }
      if (e.kind === 'money') { var m = lent ? s.owedToMe : s.iOwe; m[e.currency] = round2((m[e.currency] || 0) + remaining(e)); }
      else if (lent) s.itemsOut++; else s.itemsIn++;
    });
    if (kept.length) s.avgKept = Math.round(kept.reduce(function (a, b) { return a + b; }, 0) / kept.length);
    if (lateDays.length) s.avgLate = Math.round(lateDays.reduce(function (a, b) { return a + b; }, 0) / lateDays.length);
    var closed = s.onTime + s.late + s.writtenOff;
    if (closed >= 2) s.score = Math.round(100 * s.onTime / closed);
    return s;
  }

  /* ---- summary & insights ---- */
  function summary(st, now) {
    var t = now || today(), r = { owedToMe: {}, iOwe: {}, itemsOut: 0, itemsIn: 0, overdue: 0, soon: 0, openOut: 0, openIn: 0 };
    st.entries.forEach(function (e) {
      if (isClosed(e)) return;
      var s = status(e, t); if (s === 'overdue') r.overdue++; else if (s === 'soon') r.soon++;
      if (e.dir === 'out') r.openOut++; else r.openIn++;
      if (e.kind === 'money') { var m = e.dir === 'out' ? r.owedToMe : r.iOwe; m[e.currency] = round2((m[e.currency] || 0) + remaining(e)); }
      else if (e.dir === 'out') r.itemsOut++; else r.itemsIn++;
    });
    return r;
  }
  function monthKey(s) { return s.slice(0, 7); }
  function monthlySeries(st, n, now) {
    var t = parse(today(now)), out = [], i, d, k;
    for (i = n - 1; i >= 0; i--) { d = new Date(t.getFullYear(), t.getMonth() - i, 1, 12); out.push({ key: d.getFullYear() + '-' + pad(d.getMonth() + 1), lent: 0, back: 0 }); }
    var idx = {}; out.forEach(function (m, j) { idx[m.key] = j; });
    st.entries.forEach(function (e) {
      k = monthKey(e.date); if (e.dir === 'out' && k in idx) out[idx[k]].lent++;
      if (e.dir === 'out' && e.returnedAt) { k = monthKey(e.returnedAt); if (k in idx) out[idx[k]].back++; }
    });
    return out;
  }
  function rankPeople(st, now) {
    return st.people.map(function (p) { return { person: p, s: personStats(st, p.id, now) }; })
      .sort(function (a, b) { return b.s.open - a.s.open || b.s.total - a.s.total || a.person.name.localeCompare(b.person.name); });
  }
  function longestOut(st, now) {
    var t = now || today(), best = null;
    st.entries.forEach(function (e) { if (e.dir === 'out' && !isClosed(e)) { var d = diffDays(t, e.date); if (!best || d > best.days) best = { entry: e, days: d }; } });
    return best;
  }

  /* ---- list helpers ---- */
  function sortOpen(list, now) {
    var rank = { overdue: 0, soon: 1, open: 2 };
    return list.slice().sort(function (a, b) {
      var sa = rank[status(a, now)], sb = rank[status(b, now)]; if (sa !== sb) return sa - sb;
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1; if (!!a.due !== !!b.due) return a.due ? -1 : 1;
      return b.created - a.created;
    });
  }
  function match(e, p, q) {
    q = q.trim().toLowerCase(); if (!q) return true;
    return (e.title + ' ' + e.note + ' ' + (p ? p.name : '')).toLowerCase().indexOf(q) >= 0;
  }

  /* ---- loan check before lending ---- */
  function loanCheck(st, personId, now) {
    var s = personStats(st, personId, now), level = 'new';
    if (s.total === 0 || (s.lOpen === 0 && s.onTime + s.late + s.writtenOff === 0)) level = 'new';
    else if (s.lOverdue > 0) level = 'warn';
    else if (s.score !== null && s.score < 60) level = 'warn';
    else if (s.lOpen >= 3) level = 'busy';
    else level = 'good';
    return { level: level, s: s };
  }

  /* ---- templates ---- */
  function fill(tpl, v) { return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; }); }

  /* ---- export ---- */
  function csvCell(v) {
    v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCSV(st, now) {
    var head = ['direction', 'kind', 'title', 'person', 'amount', 'repaid', 'currency', 'date', 'due', 'status', 'returned', 'note'];
    var rows = st.entries.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).map(function (e) {
      var p = findPerson(st, e.personId);
      return [e.dir === 'out' ? 'lent' : 'borrowed', e.kind, e.title, p ? p.name : '', e.kind === 'money' ? e.amount : '', e.kind === 'money' ? paid(e) : '', e.kind === 'money' ? e.currency : '', e.date, e.due, status(e, now), e.returnedAt || '', e.note].map(csvCell).join(',');
    });
    return '\ufeff' + [head.join(',')].concat(rows).join('\r\n') + '\r\n';
  }
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''); }
  function fold(line) { /* RFC 5545: lines of at most 75 octets, never splitting a character */
    var out = [], cur = '', bytes = 0, limit = 74;
    Array.from(line).forEach(function (ch) {
      var cp = ch.codePointAt(0), n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (bytes + n > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 74; }
      cur += ch; bytes += n;
    });
    out.push(cur); return out.join('\r\n');
  }
  function toICS(st, labels, now) {
    var stamp = (now ? new Date(now) : new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var ev = st.entries.filter(function (e) { return e.due && !isClosed(e); }).map(function (e) {
      var p = findPerson(st, e.personId), nm = p ? p.name : '', d = e.due.replace(/-/g, ''), nx = addDays(e.due, 1).replace(/-/g, '');
      var what = e.kind === 'money' ? e.currency + ' ' + remaining(e) : e.title;
      var sum = (e.dir === 'out' ? labels.out : labels.in) + ': ' + what + ' · ' + nm;
      return ['BEGIN:VEVENT', 'UID:' + e.id + '@lendnest', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + nx, fold('SUMMARY:' + icsEsc(sum)),
        'BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + icsEsc(sum)), 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT'].join('\r\n');
    });
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lendnest//EN', 'CALSCALE:GREGORIAN'].concat(ev, ['END:VCALENDAR']).join('\r\n') + '\r\n';
  }

  /* ---- import (sanitises everything) ---- */
  function sanitize(obj) {
    var st = newState(); if (!obj || typeof obj !== 'object' || !Array.isArray(obj.people) || !Array.isArray(obj.entries)) return null;
    var pmap = Object.create(null), seenP = Object.create(null);
    obj.people.slice(0, MAX.people).forEach(function (p) {
      if (!p || typeof p.id !== 'string' || !str(p.name, 60) || pmap[p.id]) return;
      var id = ID_RE.test(p.id) && !seenP[p.id] ? p.id : uid(); seenP[id] = 1; pmap[p.id] = id; st.people.push({ id: id, name: str(p.name, 60), note: str(p.note, MAX.note) });
    });
    var seen = Object.create(null);
    obj.entries.slice(0, MAX.entries).forEach(function (o) {
      if (!o || typeof o.id !== 'string' || !o.id || seen[o.id] || !pmap[o.personId] || !str(o.title)) return; seen[o.id] = 1;
      var e = makeEntry(o); e.personId = pmap[o.personId]; e.id = ID_RE.test(o.id) ? o.id : uid();
      e.repayments = (Array.isArray(o.repayments) ? o.repayments : []).filter(function (r) { return r && isDate(r.date) && Number(r.amount) > 0 && Number(r.amount) <= MAX_AMOUNT; }).map(function (r) { var x = { id: ID_RE.test(r.id) ? r.id : uid(), date: r.date, amount: round2(Number(r.amount)) }; if (r.auto) x.auto = true; return x; });
      if (e.kind === 'money') { var sum = 0; e.repayments = e.repayments.map(function (r) { var a = Math.min(r.amount, round2(e.amount - sum)); sum = round2(sum + a); return a > 0 ? Object.assign(r, { amount: a }) : null; }).filter(Boolean); }
      e.returnedAt = isDate(o.returnedAt) ? o.returnedAt : null; e.writtenOff = !!o.writtenOff;
      e.extended = (Array.isArray(o.extended) ? o.extended : []).filter(function (x) { return x && isDate(x.date) && isDate(x.due); }).map(function (x) { return { date: x.date, due: x.due }; });
      if (Number.isFinite(o.created)) e.created = o.created;
      e.reopened = !!o.reopened; if (e.kind === 'money' && e.plan === null && o.plan) e.plan = makeEntry({ kind: 'money', amount: 1, title: 'x', plan: o.plan }).plan; e.gone = (Array.isArray(o.gone) ? o.gone : []).filter(function (g) { return typeof g === 'string' && ID_RE.test(g); }).slice(-200);
      if (e.kind === 'money' && !(e.amount > 0)) return; normalize(e);
      st.entries.push(e);
    });
    var s = obj.settings || {};
    st.settings = { lang: ['en', 'ko', 'ja', 'zh', 'es'].indexOf(s.lang) >= 0 ? s.lang : '', currency: str(s.currency, 8).toUpperCase() || 'USD',
      days: Math.min(365, Math.max(1, parseInt(s.days, 10) || 14)), tone: ['gentle', 'firm', 'final'].indexOf(s.tone) >= 0 ? s.tone : 'gentle' };
    return st;
  }
  /* merge: keep current data, add what is new; same entry id keeps the more advanced version */
  function merge(cur, imp) {
    var out = JSON.parse(JSON.stringify(cur)), map = Object.create(null), added = 0;
    imp.people.forEach(function (p) { var ex = out.people.find(function (q) { return q.id === p.id; }) || personByName(out, p.name); if (ex) map[p.id] = ex.id; else { out.people.push(p); map[p.id] = p.id; } });
    imp.entries.forEach(function (e) {
      e.personId = map[e.personId] || e.personId; var ex = out.entries.find(function (q) { return q.id === e.id; });
      if (!ex) { out.entries.push(e); added++; }
      else { /* field-level: keep local edits, only add what the backup knows more about */
        var changed = false, have = Object.create(null); ex.repayments.forEach(function (r) { have[r.id] = 1; });
        ex.gone = ex.gone || []; (e.gone || []).forEach(function (g) { if (ex.gone.indexOf(g) < 0) ex.gone.push(g); });
        if (ex.kind === 'money' && e.kind === 'money') e.repayments.forEach(function (r) { if (!have[r.id] && ex.gone.indexOf(r.id) < 0) { ex.repayments.push(r); changed = true; } });
        e.extended.forEach(function (x) { if (!ex.extended.some(function (y) { return y.date === x.date && y.due === x.due; })) { ex.extended.push(x); changed = true; } });
        if (e.returnedAt && !ex.returnedAt && ex.kind === e.kind && !ex.reopened) { ex.returnedAt = e.returnedAt; changed = true; }
        if (e.writtenOff && !ex.writtenOff && !ex.returnedAt && !ex.reopened) { ex.writtenOff = true; changed = true; }
        if (ex.kind !== 'money') normalize(ex); else { var sm = 0; ex.repayments = ex.repayments.map(function (r) { var a = Math.min(r.amount, round2(ex.amount - sm)); sm = round2(sm + a); return a > 0 ? Object.assign(r, { amount: a }) : null; }).filter(Boolean); normalize(ex); }
        if (changed) added++;
      }
    });
    return { state: out, added: added };
  }

  var api = { applyPlan: applyPlan, installment: installment, upcoming: upcoming, str: str, normalize: normalize, DAY: DAY, ymd: ymd, today: today, isDate: isDate, parse: parse, addDays: addDays, diffDays: diffDays, uid: uid, round2: round2, newState: newState,
    paid: paid, remaining: remaining, isClosed: isClosed, status: status, daysLate: daysLate, daysLeft: daysLeft, repay: repay, markReturned: markReturned,
    writeOff: writeOff, reopen: reopen, extend: extend, makeEntry: makeEntry, validEntry: validEntry, findPerson: findPerson, personByName: personByName,
    addPerson: addPerson, removePerson: removePerson, personStats: personStats, summary: summary, monthlySeries: monthlySeries, rankPeople: rankPeople,
    longestOut: longestOut, sortOpen: sortOpen, match: match, loanCheck: loanCheck, fill: fill, toCSV: toCSV, toICS: toICS, sanitize: sanitize, merge: merge, MAX_PHOTO: MAX_PHOTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LN = api;
})(typeof window !== 'undefined' ? window : globalThis);
