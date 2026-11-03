const test = require('node:test'), assert = require('node:assert/strict');
const C = require('../app/core.js');

test('tags: trimmed, de-duplicated case-insensitively, at most 5, 24 chars', () => {
  assert.deepEqual(C.parseTags(' tools, Tools ,books，garden'), ['tools', 'books', 'garden']);
  assert.equal(C.parseTags(['a', 'b', 'c', 'd', 'e', 'f', 'g']).length, 5);
  assert.equal(C.parseTags('x'.repeat(60))[0].length, 24);
  assert.deepEqual(C.parseTags(undefined), []);
});
test('tags: allTags counts most-used first and hasTag ignores case', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  s.entries.push(C.makeEntry({ title: 'a', personId: p.id, tags: 'Tools' }), C.makeEntry({ title: 'b', personId: p.id, tags: 'tools, books' }));
  assert.deepEqual(C.allTags(s).map(x => [x.tag, x.count]), [['Tools', 2], ['books', 1]]);
  assert.ok(C.hasTag(s.entries[0], 'TOOLS')); assert.ok(!C.hasTag(s.entries[1], 'garden'));
});
test('search matches tags', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'Saw', personId: p.id, tags: 'workshop' });
  assert.ok(C.match(e, p, 'workshop')); assert.ok(!C.match(e, p, 'kitchen'));
});
test('reminder log: records valid tones and dates, keeps the newest 50', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'a', personId: p.id, dir: 'out' });
  assert.equal(C.recordNudge(e, 'shout', '2026-10-01'), false); assert.equal(C.recordNudge(e, 'firm', 'bad'), false);
  C.recordNudge(e, 'gentle', '2026-10-01'); C.recordNudge(e, 'final', '2026-10-05');
  assert.deepEqual(C.lastNudge(e), { date: '2026-10-05', tone: 'final' });
  for (let i = 0; i < 60; i++) C.recordNudge(e, 'firm', '2026-10-06');
  assert.equal(e.nudges.length, 50);
});
test('sanitize keeps tags and reminder log through a save and reload', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina'); const e = C.makeEntry({ title: 'a', personId: p.id, tags: 'x, y', dir: 'out' });
  C.recordNudge(e, 'gentle', '2026-10-01'); s.entries.push(e);
  const back = C.sanitize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.entries[0].tags, ['x', 'y']); assert.deepEqual(back.entries[0].nudges, [{ date: '2026-10-01', tone: 'gentle' }]);
});
test('sanitize drops malformed reminder entries', () => {
  const s = C.newState(); const p = C.addPerson(s, 'Mina');
  const raw = { people: [p], entries: [Object.assign(C.makeEntry({ title: 'a', personId: p.id }), { nudges: [{ date: 'nope', tone: 'gentle' }, { date: '2026-10-01', tone: 'x' }, null, { date: '2026-10-02', tone: 'firm' }] })], settings: {} };
  assert.deepEqual(C.sanitize(raw).entries[0].nudges, [{ date: '2026-10-02', tone: 'firm' }]);
});
