import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');

test('booking history uses the authenticated paginated API endpoint',()=>{
  assert.match(page,/\/bookings\?\$\{query\.toString\(\)\}/);
  assert.match(page,/findBookings\(true,historyCursor,historyEmail\)/);
  assert.match(page,/setHistoryCursor\(res\.data\.next_cursor\)/);
});

test('historical bookings can be cancelled after refreshing',()=>{
  assert.match(page,/cancelById\(item\.id\)/);
  assert.match(page,/setHistoryBookings\(previous=>previous\.map/);
});

test('assessment-only shared key limitations are disclosed',()=>{
  assert.match(page,/A real clinic would verify patient identity/);
  assert.doesNotMatch(page,/process\.env\.BOOKING_API_KEY/);
});
