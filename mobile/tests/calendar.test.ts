import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDay, hasWokenToday } from '../src/features/daily/calendar.ts';
test('uses padded local calendar components', () => assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05'));
test('a new local day requires a new wake', () => {
  assert.equal(hasWokenToday('2026-10-24', new Date(2026, 9, 24, 23, 59)), true);
  assert.equal(hasWokenToday('2026-10-24', new Date(2026, 9, 25, 0, 0)), false);
  assert.equal(hasWokenToday(null, new Date()), false);
});
