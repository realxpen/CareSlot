/**
 * End-to-end API smoke test. Uses a dedicated/safe assessment database and resets its data.
 * Run with API_BASE_URL=https://... BOOKING_API_KEY=... node scripts/smoke.mjs
 * On PowerShell: $env:API_BASE_URL='http://localhost:3000'; $env:BOOKING_API_KEY='...'; node scripts/smoke.mjs
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=(process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/,'');
const secret=process.env.BOOKING_API_KEY;
if (!secret) {console.error('Set BOOKING_API_KEY first');process.exit(1);}
let checks=0;

async function call(path, method='GET',data,extra={},withKey=true) {
  const response=await fetch(base+path,{
    method,
    headers:{...(withKey?{'X-API-Key':secret}:{}),...extra,...(data?{'Content-Type':'application/json'}:{})},
    body:data?JSON.stringify(data):undefined
  });
  return {status:response.status,body:await response.json(),headers:response.headers};
}
function check(actual,expected,note) {
  assert.equal(actual,expected,note);
  checks++;console.log('✓ '+note);
}

const now=Date.now()+3*86400*1000;
const slots=Array.from({length:8},(_,i)=>({
  id:'s'+(i+1),provider:i%2===0?'Dr Ade':'Dr Okafor',
  start:new Date(now+i*3600000).toISOString(),end:new Date(now+i*3600000+1800000).toISOString()
}));
const tag=randomUUID().slice(0,8);

try {
  check((await call('/slots','GET',undefined,{},false)).status,401,'missing API key returns 401');
  check((await call('/reset','POST',{slots})).status,200,'reset succeeds');
  const listed=await call('/slots');
  check(listed.status,200,'list slots works');
  check(listed.body.slots.length,8,'all seeded slots listed');
  check((await call('/slots?provider=Dr%20Ade')).body.slots.length,4,'provider exact filter works');

  const bad=await call('/bookings','POST',{slot_id:'s1',name:'Ada',email:'invalid'});
  check(bad.status,400,'bad email rejected');
  check((await call('/bookings','POST',{slot_id:'not-here',name:'Ada',email:`missing-${tag}@example.com`})).status,404,'unknown slot returns 404');

  const a=await call('/bookings','POST',{slot_id:'s1',name:'  Ada Obi ',email:`  ADA-${tag}@EXAMPLE.COM `});
  check(a.status,201,'booking created');
  check(a.body.name,'Ada Obi','name trimmed');
  check(a.body.email,`ada-${tag}@example.com`,'email lowercased');
  check((await call('/bookings/'+a.body.id)).body.id,a.body.id,'retrieve booking by id');
  check((await call('/slots')).body.slots[0].available,false,'confirmed slot becomes unavailable');
  check((await call('/bookings','POST',{slot_id:'s1',name:'Second',email:`other-${tag}@example.com`})).status,409,'occupied slot returns 409');
  check((await call('/bookings/'+a.body.id,'DELETE')).status,200,'cancellation succeeds');
  check((await call('/bookings/'+a.body.id,'DELETE')).status,409,'second cancellation returns 409');
  check((await call('/slots')).body.slots[0].available,true,'cancelled slot becomes available');

  const idem='smoke-'+randomUUID();
  const body={slot_id:'s1',name:'Idem Patient',email:`idem-${tag}@example.com`};
  const b=await call('/bookings','POST',body,{'Idempotency-Key':idem});
  check(b.status,201,'idempotent booking created');
  const bAgain=await call('/bookings','POST',body,{'Idempotency-Key':idem});
  check(bAgain.status,201,'idempotent replay returns original status');
  check(bAgain.body.id,b.body.id,'idempotent replay returns same id');
  check((await call('/bookings','POST',{...body,name:'Different'},{'Idempotency-Key':idem})).status,422,'reused key with changed body returns 422');

  const pagingEmail=`page-${tag}@example.com`;
  for (const slot of ['s2','s3','s4']) {
    check((await call('/bookings','POST',{slot_id:slot,name:'Paged',email:pagingEmail})).status,201,'pagination setup booking '+slot);
  }
  const first=await call('/bookings?email='+encodeURIComponent(pagingEmail)+'&limit=2');
  check(first.body.bookings.length,2,'page one contains two bookings');
  check(typeof first.body.next_cursor,'string','page one provides cursor');
  const second=await call('/bookings?email='+encodeURIComponent(pagingEmail)+'&limit=2&cursor='+encodeURIComponent(first.body.next_cursor));
  check(second.body.bookings.length,1,'page two contains one booking');
  check(second.body.next_cursor,null,'final page cursor is null');
  check((await call('/bookings?email='+encodeURIComponent(pagingEmail)+'&limit=51')).status,400,'invalid pagination limit rejected');

  const race=await Promise.all(Array.from({length:10},(_,i)=>call('/bookings','POST',{
    slot_id:'s5',name:'Concurrent '+i,email:`racer${i}-${tag}@example.com`
  })));
  check(race.filter(x=>x.status===201).length,1,'concurrent booking has exactly one winner');
  check(race.filter(x=>x.status===409).length,9,'other concurrent bookings get 409');

  const spam=`spam-${tag}@example.com`;
  for (let i=0;i<5;i++) check((await call('/bookings','POST',{slot_id:'missing',name:'Spam',email:spam})).status,404,'failed attempt '+(i+1)+' counted');
  const limited=await call('/bookings','POST',{slot_id:'missing',name:'Spam',email:spam});
  check(limited.status,429,'sixth attempt returns 429');
  check(Number(limited.headers.get('retry-after'))>0,true,'Retry-After header present');
  console.log(`\nPASS: ${checks} checks. All tested API behaviors work.`);
} catch(e) {
  console.error('\nFAIL:',e);
  process.exitCode=1;
}
