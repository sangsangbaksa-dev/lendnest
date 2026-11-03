const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../app/core.js'), I = require('../app/i18n.js');
const mk = () => { const s = C.newState(); const p = C.addPerson(s, 'Mina'); return { s, p }; };

test('dates: addDays/diffDays across month and DST-safe', () => {
  assert.equal(C.addDays('2026-01-31', 1), '2026-02-01'); assert.equal(C.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(C.diffDays('2026-11-02', '2026-10-25'), 8); assert.equal(C.diffDays('2026-03-30', '2026-03-28'), 2);
  assert.ok(!C.isDate('2026-13-01') && !C.isDate('x') && C.isDate('2026-02-28'));
});
test('status: open, soon, overdue, returned, written', () => {
  const { s, p } = mk(); const e = C.makeEntry({ title: 'Drill', personId: p.id, date: '2026-10-01', due: '2026-10-10' }); s.entries.push(e);
  assert.equal(C.status(e, '2026-10-05'), 'open'); assert.equal(C.status(e, '2026-10-08'), 'soon'); assert.equal(C.status(e, '2026-10-10'), 'soon');
  assert.equal(C.status(e, '2026-10-11'), 'overdue'); assert.equal(C.daysLate(e, '2026-10-14'), 4);
  C.markReturned(e, '2026-10-12'); assert.equal(C.status(e, '2026-10-20'), 'returned'); assert.equal(C.daysLate(e, '2026-10-20'), 0);
  assert.ok(C.reopen(e)); assert.equal(C.status(e, '2026-10-20'), 'overdue'); C.writeOff(e); assert.equal(C.status(e, '2026-10-20'), 'written');
  assert.equal(C.status(C.makeEntry({ title: 'x', personId: p.id }), '2030-01-01'), 'open', 'no due date never overdue');
});
test('money: partial repayment, clamp, floats, auto close, reopen', () => {
  const { p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 0.3, title: '', personId: p.id, date: '2026-10-01' });
  C.repay(e, 0.1, '2026-10-02'); C.repay(e, 0.1, '2026-10-03'); assert.equal(C.remaining(e), 0.1);
  assert.ok(C.repay(e, 99, '2026-10-04')); assert.equal(C.paid(e), 0.3); assert.equal(e.returnedAt, '2026-10-04');
  assert.ok(!C.repay(e, 1, '2026-10-05'), 'closed entries refuse repayment'); assert.ok(!C.reopen(e), 'a real payment is never deleted'); assert.equal(C.paid(e), 0.3); e.amount = 1; C.normalize(e); assert.equal(e.returnedAt, null); assert.equal(C.remaining(e), 0.7);
  assert.ok(!C.repay(e, -5, '2026-10-05') && !C.repay(e, 'abc', '2026-10-05') && !C.repay(e, 5, 'bad'));
  const f = C.makeEntry({ kind: 'money', amount: 50, title: '', personId: p.id }); C.markReturned(f, '2026-10-09'); assert.equal(C.paid(f), 50);
});
test('makeEntry sanitises input', () => {
  const e = C.makeEntry({ title: '  ' + 'x'.repeat(500), personId: 'p', amount: -5, kind: 'money', photo: 'javascript:alert(1)', due: 'junk', currency: 'eur' });
  assert.equal(e.title.length, 200); assert.equal(e.amount, 0); assert.equal(e.photo, ''); assert.equal(e.due, ''); assert.equal(e.currency, 'EUR');
  assert.equal(C.validEntry({ title: '', personId: 'p' }), 'title'); assert.equal(C.validEntry({ title: 'a', personId: '' }), 'person');
  assert.equal(C.validEntry({ title: 'a', personId: 'p', kind: 'money', amount: 0 }), 'amount'); assert.equal(C.validEntry({ title: 'a', personId: 'p', date: '2026-10-05', due: '2026-10-01' }), 'due');
});
test('extend logs history and moves due', () => {
  const { p } = mk(); const e = C.makeEntry({ title: 'a', personId: p.id, date: '2026-10-01', due: '2026-10-05' });
  assert.ok(C.extend(e, '2026-10-20', '2026-10-06')); assert.equal(e.due, '2026-10-20'); assert.equal(e.extended.length, 1); assert.ok(!C.extend(e, 'nope'));
});
test('people: dedupe, remove guard, stats and score', () => {
  const { s, p } = mk(); assert.equal(C.addPerson(s, ' mina '), p); assert.equal(C.addPerson(s, '  '), null);
  const add = (o) => { const e = C.makeEntry(Object.assign({ title: 't', personId: p.id, date: '2026-09-01' }, o)); s.entries.push(e); return e; };
  const a = add({ due: '2026-09-10' }); C.markReturned(a, '2026-09-09'); const b = add({ due: '2026-09-10' }); C.markReturned(b, '2026-09-20'); add({ due: '2026-10-01' });
  add({ kind: 'money', amount: 40, currency: 'USD', dir: 'in' });
  const st = C.personStats(s, p.id, '2026-10-05'); assert.equal(st.onTime, 1); assert.equal(st.late, 1); assert.equal(st.score, 50); assert.equal(st.open, 2); assert.equal(st.overdue, 1); assert.equal(st.avgLate, 10);
  assert.equal(st.iOwe.USD, 40); assert.equal(st.itemsOut, 1); assert.equal(C.removePerson(s, p.id), false);
  assert.equal(C.loanCheck(s, p.id, '2026-10-05').level, 'warn');
  const q = C.addPerson(s, 'Fresh'); assert.equal(C.loanCheck(s, q.id).level, 'new'); assert.equal(C.personStats(s, q.id).score, null); assert.ok(C.removePerson(s, q.id));
});
test('summary & series & longest', () => {
  const { s, p } = mk();
  s.entries.push(C.makeEntry({ kind: 'money', amount: 100, currency: 'USD', title: '', personId: p.id, date: '2026-10-01', due: '2026-10-03' }));
  s.entries.push(C.makeEntry({ kind: 'money', amount: 5000, currency: 'KRW', title: '', personId: p.id, date: '2026-08-01' }));
  s.entries.push(C.makeEntry({ title: 'Tent', personId: p.id, date: '2026-07-15', due: '2026-10-07' }));
  const sm = C.summary(s, '2026-10-05'); assert.deepEqual(sm.owedToMe, { USD: 100, KRW: 5000 }); assert.equal(sm.overdue, 1); assert.equal(sm.soon, 1); assert.equal(sm.itemsOut, 1);
  const ser = C.monthlySeries(s, 6, new Date(2026, 9, 5)); assert.equal(ser.length, 6); assert.equal(ser[5].key, '2026-10'); assert.equal(ser[5].lent, 1); assert.equal(ser[2].key, '2026-07'); assert.equal(ser[2].lent, 1);
  assert.equal(C.longestOut(s, '2026-10-05').entry.title, 'Tent'); assert.equal(C.longestOut(s, '2026-10-05').days, 82);
});
test('sort: overdue first, then soonest due, then no-due', () => {
  const { p } = mk(); const m = (t, due) => C.makeEntry({ title: t, personId: p.id, date: '2026-10-01', due, created: t.charCodeAt(0) });
  const r = C.sortOpen([m('c', ''), m('b', '2026-10-20'), m('a', '2026-10-02'), m('d', '2026-10-09')], '2026-10-08').map(e => e.title); assert.deepEqual(r, ['a', 'd', 'b', 'c']);
});
test('match searches title, note and person', () => {
  const { p } = mk(); const e = C.makeEntry({ title: 'Camping tent', note: 'green bag', personId: p.id });
  assert.ok(C.match(e, p, 'TENT') && C.match(e, p, 'green') && C.match(e, p, 'min') && C.match(e, p, '') && !C.match(e, p, 'zzz'));
});
test('CSV neutralises formulas and escapes quotes', () => {
  const { s, p } = mk(); s.entries.push(C.makeEntry({ title: '=HYPERLINK("x")', note: 'a,b\n"c"', personId: p.id, date: '2026-10-01' }));
  const csv = C.toCSV(s, '2026-10-02'); assert.ok(csv.startsWith('﻿direction,')); assert.ok(csv.includes('"\'=HYPERLINK(""x"")"')); assert.ok(csv.includes('"a,b\n""c"""'));
});
test('ICS has open dated entries only, escapes text, folds', () => {
  const { s, p } = mk(); s.people[0].name = 'Mi;na,'; s.entries.push(C.makeEntry({ title: 'Long ' + 'y'.repeat(120), personId: p.id, due: '2026-10-09', date: '2026-10-01' }));
  const done = C.makeEntry({ title: 'done', personId: p.id, due: '2026-10-09', date: '2026-10-01' }); C.markReturned(done, '2026-10-02'); s.entries.push(done); s.entries.push(C.makeEntry({ title: 'nodue', personId: p.id }));
  const ics = C.toICS(s, { out: 'Get back', in: 'Give back' }, '2026-10-02T00:00:00Z'); assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261009') && ics.includes('Mi\\;na\\,') && ics.includes('TRIGGER:-PT15H')); ics.split('\r\n').forEach(l => assert.ok(l.length <= 75));
});
test('sanitize rejects junk and orphan entries; merge unions by id', () => {
  assert.equal(C.sanitize(null), null); assert.equal(C.sanitize({ people: 1 }), null);
  const { s, p } = mk(); const e = C.makeEntry({ title: 'A', personId: p.id }); s.entries.push(e);
  const evil = JSON.parse(JSON.stringify(s)); evil.entries.push({ id: 'z', title: 'orphan', personId: 'nope' }, { id: e.id, title: 'dup', personId: p.id }, null); evil.settings = { lang: 'xx', days: 9999, tone: '<b>' };
  const clean = C.sanitize(evil); assert.equal(clean.entries.length, 1); assert.equal(clean.settings.lang, ''); assert.equal(clean.settings.days, 365); assert.equal(clean.settings.tone, 'gentle');
  const imp = JSON.parse(JSON.stringify(s)); imp.entries[0].returnedAt = '2026-10-03'; imp.entries.push(Object.assign(C.makeEntry({ title: 'B', personId: p.id }), { id: 'b1' }));
  const m = C.merge(s, C.sanitize(imp)); assert.equal(m.state.entries.length, 2); assert.equal(m.added, 2); assert.equal(m.state.entries[0].returnedAt, '2026-10-03');
  const same = C.merge(m.state, C.sanitize(JSON.parse(JSON.stringify(m.state)))); assert.equal(same.added, 0); assert.equal(same.state.people.length, 1);
});
test('i18n: every language has every key, placeholders match', () => {
  const en = I.L.en, ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const l of I.langs) {
    assert.deepEqual(Object.keys(I.L[l]).sort(), Object.keys(en).sort(), l);
    for (const k of Object.keys(en)) { assert.ok(I.L[l][k].trim(), `${l}.${k} empty`); assert.equal(ph(I.L[l][k]), ph(en[k]), `${l}.${k} placeholders`); }
    assert.deepEqual(Object.keys(I.LAND[l]).sort(), Object.keys(I.LAND.en).sort());
  }
  assert.equal(I.detect({ language: 'ko-KR' }), 'ko'); assert.equal(I.detect({ language: 'fr' }), 'en'); assert.equal(I.detect({ language: 'zh-TW' }), 'zh');
});
test('nudge templates render without leftover placeholders', () => {
  for (const l of I.langs) for (const k of ['nBefore', 'nGentle', 'nFirm', 'nFinal', 'nIn', 'nNoDue', 'receiptDue', 'receiptNoDue']) {
    const out = C.fill(I.L[l][k], { name: 'A', what: 'B', due: 'C', date: 'D', days: 3, by: 'E' }); assert.ok(!/\{\w+\}/.test(out), `${l}.${k}`);
  }
});

test('reopen after markReturned removes only the auto record; normalize follows amount edits', () => {
  const { p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 100, title: 't', personId: p.id, date: '2026-10-01' });
  C.repay(e, 30, '2026-10-02'); C.markReturned(e, '2026-10-05'); assert.equal(C.paid(e), 100); assert.ok(C.reopen(e)); assert.equal(C.paid(e), 30); assert.equal(C.remaining(e), 70);
  C.repay(e, 70, '2026-10-06'); assert.ok(e.returnedAt); e.amount = 150; C.normalize(e); assert.equal(e.returnedAt, null); e.amount = 100; C.normalize(e); assert.equal(e.returnedAt, '2026-10-06');
  const it = C.makeEntry({ title: 'i', personId: p.id }); it.repayments = [{ id: 'x', date: '2026-10-01', amount: 1 }]; C.normalize(it); assert.equal(it.repayments.length, 0);
});
test('merge keeps local edits; sanitize rewrites unsafe ids', () => {
  const { s, p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 100, title: 'old', personId: p.id, due: '2026-10-09' }); s.entries.push(e);
  const bak = JSON.parse(JSON.stringify(s)); bak.entries[0].repayments.push({ id: 'r1', date: '2026-10-02', amount: 10 });
  e.due = '2026-12-01'; e.title = 'new'; const m = C.merge(s, C.sanitize(bak)); const x = m.state.entries[0]; assert.equal(x.due, '2026-12-01'); assert.equal(x.title, 'new'); assert.equal(C.paid(x), 10);
  const evil = JSON.parse(JSON.stringify(s)); evil.entries[0].id = 'a\r\nATTACH:x'; evil.people[0].id = '__proto__'; evil.entries[0].personId = '__proto__';
  const c = C.sanitize(evil); assert.match(c.entries[0].id, /^[\w-]+$/); assert.match(c.people[0].id, /^[\w-]+$/); assert.equal(c.entries[0].personId, c.people[0].id);
  assert.ok(!C.toICS(c, { out: 'a', in: 'b' }).includes('ATTACH'));
});

test('ICS folds by octets and never splits characters', () => {
  const { s, p } = mk(); s.entries.push(C.makeEntry({ title: 'a'.repeat(58) + '😀' + '한'.repeat(40), personId: p.id, due: '2026-10-09', date: '2026-10-01' }));
  const ics = C.toICS(s, { out: 'o', in: 'i' }); const lines = ics.split('\r\n'); lines.forEach(l => assert.ok(Buffer.byteLength(l) <= 75, l));
  assert.ok(!ics.includes('�')); const sum = lines.reduce((a, l, i) => (l.startsWith('SUMMARY') || (a.on && l.startsWith(' '))) ? { on: true, t: a.t + l.replace(/^ /, '') } : { on: false, t: a.t }, { on: false, t: '' }).t; assert.ok(sum.includes('😀') && sum.includes('한'.repeat(40)));
});
test('import normalises: repaid money closes, zero money dropped, item loses repayments; extend rejects dates before lending', () => {
  const { s, p } = mk(); const a = C.makeEntry({ kind: 'money', amount: 10, title: 'a', personId: p.id }); a.repayments = [{ id: 'r', date: '2026-10-02', amount: 10 }];
  const b = C.makeEntry({ kind: 'money', amount: 0, title: 'b', personId: p.id }); const c = C.makeEntry({ title: 'c', personId: p.id }); c.repayments = [{ id: 'q', date: '2026-10-02', amount: 5 }];
  s.entries.push(a, b, c); const r = C.sanitize(JSON.parse(JSON.stringify(s))); assert.equal(r.entries.length, 2); assert.equal(r.entries[0].returnedAt, '2026-10-02'); assert.equal(r.entries[1].repayments.length, 0);
  const e = C.makeEntry({ title: 'x', personId: p.id, date: '2026-10-10', due: '2026-10-20' }); assert.ok(!C.extend(e, '2026-10-01')); assert.equal(e.due, '2026-10-20');
});
test('str never leaves lone surrogates, even when truncating', () => {
  assert.equal(C.str('😀'.repeat(70), 60).length, 120); assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(C.str('a😀b', 3)));
  const { s, p } = mk(); s.entries.push(C.makeEntry({ title: 'x' + '\ud83d', personId: p.id, due: '2026-10-09' })); assert.doesNotThrow(() => C.toICS(s, { out: 'o', in: 'i' }));
});
test('huge amounts are rejected; bare CR cannot inject ICS properties', () => {
  const { s, p } = mk(); assert.equal(C.makeEntry({ kind: 'money', amount: 1e308, title: 'x', personId: p.id }).amount, 0); assert.equal(C.validEntry({ title: 'x', personId: p.id, kind: 'money', amount: 1e308 }), 'amount');
  s.entries.push(C.makeEntry({ title: 'a\rDTSTART:X\u0001', personId: p.id, due: '2026-10-09' })); const ics = C.toICS(s, { out: 'o', in: 'i' }); assert.ok(!/\r(?!\n)/.test(ics)); assert.ok(!/\u0001/.test(ics));
});
test('amounts that round to zero are invalid', () => { const { p } = mk(); assert.equal(C.validEntry({ title: 'x', personId: p.id, kind: 'money', amount: 0.004 }), 'amount'); assert.equal(C.makeEntry({ kind: 'money', amount: 0.004, title: 'x', personId: p.id }).amount, 0); });
test('non-finite or absurd repayment amounts are dropped on import', () => {
  const { s, p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 100, title: 'x', personId: p.id }); s.entries.push(e);
  const raw = JSON.parse(JSON.stringify(s)); raw.entries[0].repayments = [{ id: 'a', date: '2026-10-01', amount: 1e999 }, { id: 'b', date: '2026-10-01', amount: 1e15 }, { id: 'c', date: '2026-10-01', amount: 5 }];
  const r = C.sanitize(JSON.parse(JSON.stringify(raw).replace('null', '1e999'))); assert.equal(r.entries[0].repayments.length, 1); assert.equal(r.entries[0].repayments[0].amount, 5);
});
test('loan check and score only look at what was lent, not what was borrowed from the person', () => {
  const { s, p } = mk(); const b = C.makeEntry({ dir: 'in', title: 'ladder', personId: p.id, date: '2026-09-01', due: '2026-09-10' }); s.entries.push(b);
  assert.equal(C.loanCheck(s, p.id, '2026-10-05').level, 'new'); assert.equal(C.personStats(s, p.id, '2026-10-05').lOverdue, 0);
  const c = C.makeEntry({ dir: 'in', title: 'drill', personId: p.id, date: '2026-09-01', due: '2026-09-10' }); s.entries.push(c); C.markReturned(b, '2026-09-30'); C.markReturned(c, '2026-09-30');
  assert.equal(C.personStats(s, p.id, '2026-10-05').score, null);
  const o = C.makeEntry({ title: 'saw', personId: p.id, date: '2026-09-01', due: '2026-09-10' }); s.entries.push(o); C.markReturned(o, '2026-09-09'); const o2 = C.makeEntry({ title: 'saw2', personId: p.id, date: '2026-09-01', due: '2026-09-10' }); s.entries.push(o2); C.markReturned(o2, '2026-09-09');
  assert.equal(C.loanCheck(s, p.id, '2026-10-05').level, 'good'); assert.equal(C.personStats(s, p.id).score, 100);
});
test('reopen is not undone by restoring an older backup; imports clamp repayments', () => {
  const { s, p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 50, title: 't', personId: p.id }); s.entries.push(e); C.repay(e, 20, '2026-10-02'); C.markReturned(e, '2026-10-05');
  const bak = JSON.parse(JSON.stringify(s)); assert.ok(C.reopen(e)); const m = C.merge(s, C.sanitize(bak)); assert.equal(m.state.entries[0].returnedAt, null); assert.equal(C.paid(m.state.entries[0]), 20);
  const w = C.makeEntry({ title: 'w', personId: p.id }); s.entries.push(w); C.writeOff(w); const bak2 = JSON.parse(JSON.stringify(s)); C.reopen(w); assert.equal(C.merge(s, C.sanitize(bak2)).state.entries[1].writtenOff, false);
  const raw = JSON.parse(JSON.stringify(s)); raw.entries[0].repayments = [{ id: 'z', date: '2026-10-01', amount: 500 }]; const r = C.sanitize(raw); assert.equal(C.paid(r.entries[0]), 50);
});
test('reserved ids cannot break import or merge; repayments get ids', () => {
  const { s, p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 10, title: 'a', personId: p.id }); s.entries.push(e);
  const raw = JSON.parse(JSON.stringify(s)); raw.people[0].id = '__proto__'; raw.entries[0].personId = '__proto__'; raw.entries[0].repayments = [{ date: '2026-10-01', amount: 1 }, { date: '2026-10-02', amount: 2 }];
  const imp = C.sanitize(raw); assert.equal(imp.entries.length, 1); assert.notEqual(imp.people[0].id, '__proto__'); const m = C.merge(C.newState(), imp); assert.equal(m.state.entries.length, 1); assert.equal(m.state.people.length, 1);
  assert.ok(imp.entries[0].repayments.every(r => typeof r.id === 'string')); assert.notEqual(imp.entries[0].repayments[0].id, imp.entries[0].repayments[1].id);
});
test('merge never puts money on an item; created must be numeric', () => {
  const { s, p } = mk(); const it = C.makeEntry({ title: 'Tent', personId: p.id }); s.entries.push(it);
  const bak = JSON.parse(JSON.stringify(s)); bak.entries[0].kind = 'money'; bak.entries[0].amount = 100; bak.entries[0].repayments = [{ id: 'r1', date: '2026-10-01', amount: 40 }];
  const m = C.merge(s, C.sanitize(bak)); const x = m.state.entries[0]; assert.equal(x.kind, 'item'); assert.equal(x.repayments.length, 0); assert.equal(x.amount, 0);
  assert.ok(Number.isFinite(C.makeEntry({ title: 'x', personId: p.id, created: { evil: 1 } }).created));
});
test('tombstones keep the newest 200 on import', () => {
  const { s, p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 5, title: 't', personId: p.id }); s.entries.push(e); const raw = JSON.parse(JSON.stringify(s)); raw.entries[0].gone = Array.from({ length: 250 }, (_, i) => 'g' + i);
  const g = C.sanitize(raw).entries[0].gone; assert.equal(g.length, 200); assert.equal(g[199], 'g249');
});
test('round2 handles half cents', () => { assert.equal(C.round2(1.005), 1.01); assert.equal(C.round2(0.1 + 0.2), 0.3); assert.equal(C.round2(-1.005), -1.01); });
test('settled loans stay consistent when the amount is lowered or a manual repayment is deleted; extend only moves forward', () => {
  const { p } = mk(); const mkSettled = () => { const e = C.makeEntry({ kind: 'money', amount: 100, title: 't', personId: p.id, date: '2026-10-01', due: '2026-11-30' }); C.repay(e, 30, '2026-10-02'); C.markReturned(e, '2026-10-05'); return e; };
  let e = mkSettled(); e.amount = 30; C.normalize(e); assert.equal(C.paid(e), 30); assert.equal(e.returnedAt, '2026-10-05');
  e = mkSettled(); e.repayments = e.repayments.filter(r => r.auto); C.normalize(e); assert.equal(C.paid(e), 100); assert.equal(C.remaining(e), 0);
  e = mkSettled(); e.amount = 150; C.normalize(e); assert.equal(C.paid(e), 150); assert.ok(e.returnedAt);
  const f = C.makeEntry({ title: 'x', personId: p.id, date: '2026-10-01', due: '2026-11-30' }); assert.ok(!C.extend(f, '2026-10-20')); assert.ok(C.extend(f, '2026-12-05'));
});
test('installment plan: due follows the next unpaid monthly installment', () => {
  const { s, p } = mk(); const e = C.makeEntry({ kind: 'money', amount: 300, title: 'Loan', personId: p.id, date: '2026-10-01', plan: { n: 3 } }); C.applyPlan(e);
  assert.equal(e.due, '2026-10-31'); assert.deepEqual([C.installment(e).k, C.installment(e).each], [1, 100]);
  C.repay(e, 100, '2026-10-20'); assert.equal(e.due, '2026-11-30'); assert.equal(C.installment(e).k, 2); C.repay(e, 50, '2026-11-20'); assert.equal(C.installment(e).k, 2); assert.equal(e.due, '2026-11-30');
  C.repay(e, 150, '2026-12-01'); assert.ok(e.returnedAt); assert.equal(C.installment(e).k, 3);
  s.entries.push(e); const r = C.sanitize(JSON.parse(JSON.stringify(s))); assert.equal(r.entries[0].plan.n, 3); assert.equal(C.makeEntry({ kind: 'item', title: 'x', personId: p.id, plan: { n: 3 } }).plan, null); assert.equal(C.makeEntry({ kind: 'money', amount: 5, title: 'x', personId: p.id, plan: { n: 1 } }).plan, null);
  const d = C.makeEntry({ title: 'soon', personId: p.id, date: '2026-10-01', due: '2026-10-05' }); s.entries.push(d); assert.equal(C.upcoming(s, 1, '2026-10-02')[0].title, 'soon');
});
