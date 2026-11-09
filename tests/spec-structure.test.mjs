import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all six assessment routes exist',()=>{
 for(const path of ['src/app/reset/route.ts','src/app/slots/route.ts','src/app/bookings/route.ts','src/app/bookings/[id]/route.ts'])
 assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
test('database enforces exclusive confirmed slot',()=>{
 assert.match(read('db/schema.sql'),/CREATE UNIQUE INDEX IF NOT EXISTS only_one_confirmed_booking_per_slot/);
 assert.match(read('db/schema.sql'),/WHERE status = 'confirmed'/);
});
test('credential secret never hardcoded into public frontend',()=>{
 const source=read('src/app/page.tsx');
 assert.doesNotMatch(source,/process\.env\.BOOKING_API_KEY/);
 assert.match(source,/sessionStorage/);
});
