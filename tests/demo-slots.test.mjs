import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/lib/demo-slots.ts',import.meta.url),'utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildDemoSlots,DEMO_DOCTOR_SCHEDULE}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(javascript));
const slots=buildDemoSlots(new Date('2026-11-09T12:00:00.000Z'));

test('six doctors create 36 appointments',()=>{
  assert.equal(DEMO_DOCTOR_SCHEDULE.length,6);
  assert.equal(slots.length,36);
  assert.equal(new Set(slots.map(s=>s.provider)).size,6);
});
test('slot IDs are unique and each lasts 30 minutes',()=>{
  assert.equal(new Set(slots.map(s=>s.id)).size,36);
  assert.ok(slots.every(s=>Date.parse(s.end)-Date.parse(s.start)===30*60*1000));
});
test('every demo appointment is in the future and slots are ordered',()=>{
  assert.ok(slots.every(s=>Date.parse(s.start)>Date.parse('2026-11-09T12:00:00.000Z')));
  assert.ok(slots.every((s,i)=>i===0||Date.parse(slots[i-1].start)<=Date.parse(s.start)));
});
test('there are three dates and two appointments per doctor per date',()=>{
  const grouped=new Map();
  for(const s of slots){const key=s.id.split('-').slice(2,5).join('-')+'|'+s.provider;grouped.set(key,(grouped.get(key)||0)+1);}
  assert.equal(grouped.size,18);
  assert.ok([...grouped.values()].every(count=>count===2));
});
test('Dr Ade and Dr Okafor partially overlap on the same date',()=>{
  const day=slots.filter(s=>s.id.includes('2026-11-11'));
  const a=day.find(s=>s.provider==='Dr Ade');
  const b=day.find(s=>s.provider==='Dr Okafor');
  assert.ok(a&&b&&Date.parse(a.start)<Date.parse(b.end)&&Date.parse(a.end)>Date.parse(b.start));
});
test('Dr Hassan starts exactly when Dr Ade ends',()=>{
  const day=slots.filter(s=>s.id.includes('2026-11-11'));
  assert.equal(day.find(s=>s.provider==='Dr Ade').end,day.find(s=>s.provider==='Dr Hassan').start);
});
test('9am WAT is serialized as 8am UTC',()=>{
  assert.equal(new Date(slots.find(s=>s.provider==='Dr Ade').start).getUTCHours(),8);
});
test('demo generator does not change the Koya API contract',()=>{
  assert.doesNotMatch(readFileSync(new URL('../src/lib/booking.ts',import.meta.url),'utf8'),/buildDemoSlots/);
});
