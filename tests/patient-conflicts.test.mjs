import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/lib/patient-conflicts.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {findPatientTimeConflict}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));

const start='2026-11-19T09:00:00.000Z';
const slots=[
  {id:'a',provider:'Dr Ade',start,end:'2026-11-19T09:30:00.000Z',available:false},
  {id:'b',provider:'Dr Okafor',start:'2026-11-19T09:15:00.000Z',end:'2026-11-19T09:45:00.000Z',available:true},
  {id:'c',provider:'Dr Hassan',start:'2026-11-19T09:30:00.000Z',end:'2026-11-19T10:00:00.000Z',available:true},
  {id:'d',provider:'Dr Bala',start:'2026-11-19T08:30:00.000Z',end:'2026-11-19T09:01:00.000Z',available:true}
];
const booking={id:'booking-a',slot_id:'a',name:'Ada',email:'ada@example.com',status:'confirmed',created_at:new Date().toISOString()};
test('different doctors with intersecting times produce a conflict',()=>{
  const found=findPatientTimeConflict([booking],slots,'b');
  assert.equal(found?.booking.id,'booking-a');
  assert.equal(found?.slot.provider,'Dr Ade');
});
test('back-to-back appointments are permitted',()=>{
  assert.equal(findPatientTimeConflict([booking],slots,'c'),null);
});
test('overlap one minute before prior appointment ends is detected',()=>{
  assert.equal(findPatientTimeConflict([booking],slots,'d')?.booking.id,'booking-a');
});
test('cancelled bookings do not produce conflicts',()=>{
  assert.equal(findPatientTimeConflict([{...booking,status:'cancelled'}],slots,'b'),null);
});
test('missing candidate is handled safely',()=>{
  assert.equal(findPatientTimeConflict([booking],slots,'missing'),null);
});
test('different day is allowed',()=>{
  const another={id:'e',provider:'Dr Ade',start:'2026-11-20T09:00:00.000Z',end:'2026-11-20T09:30:00.000Z',available:true};
  assert.equal(findPatientTimeConflict([booking],[...slots,another],'e'),null);
});
test('original Koya server booking behavior stays unchanged',()=>{
  const backend=readFileSync(new URL('../src/lib/booking.ts',import.meta.url),'utf8');
  assert.match(backend,/slot already booked/);
  assert.doesNotMatch(backend,/findPatientTimeConflict/);
});
