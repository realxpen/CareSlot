import {createHash, randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {asISO, transaction} from './db';
import {error} from './http';
import type {ApiResult, Booking} from './types';

export function stableStringify(value:unknown):string {
  if (Array.isArray(value)) return '['+value.map(stableStringify).join(',')+']';
  if (value && typeof value === 'object') {
    const rec=value as Record<string,unknown>;
    return '{'+Object.keys(rec).sort().map(k=>JSON.stringify(k)+':'+stableStringify(rec[k])).join(',')+'}';
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function normalizeEmail(value:unknown):string {
  return typeof value==='string'?value.trim().toLowerCase():'';
}

export function validateBooking(value:unknown):{slot_id:string;name:string;email:string}|null {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  const b=value as Record<string,unknown>;
  if (typeof b.slot_id!=='string' || !b.slot_id.trim() || typeof b.name!=='string' || !b.name.trim() || typeof b.email!=='string') return null;
  const email=normalizeEmail(b.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return {slot_id:b.slot_id.trim(), name:b.name.trim(), email};
}

export function normalizeBooking(r:Record<string,unknown>):Booking {
  return {id:String(r.id),slot_id:String(r.slot_id),name:String(r.name),email:String(r.email),
    status:r.status as 'confirmed'|'cancelled',created_at:asISO(r.created_at as string|Date)};
}

// Used inside a database transaction so rate checks and booking creation are atomic.
async function reserveAttempt(c:PoolClient,email:string):Promise<ApiResult|null> {
  // Serializes checks for the same email, even across separate serverless instances.
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ['rate:'+email]);
  const now=Date.now();
  const all=await c.query<{attempted_at:Date}>(
    'SELECT attempted_at FROM booking_attempts WHERE email=$1 AND attempted_at > $2::timestamptz ORDER BY attempted_at',
    [email,new Date(now-60000).toISOString()]);
  await c.query('INSERT INTO booking_attempts (email) VALUES ($1)',[email]);
  if (all.rows.length<5) return null;
  const oldest=new Date(all.rows[0].attempted_at).getTime();
  const seconds=Math.max(1,Math.ceil((60000-(now-oldest))/1000));
  return error(429,'too many booking attempts',{'Retry-After':String(seconds)});
}

export async function createBooking(raw:unknown, idempotencyKey:string|null):Promise<ApiResult> {
  const fingerprint=createHash('sha256').update(stableStringify(raw)).digest('hex');
  const key=idempotencyKey?.trim() || null;
  return transaction(async c=>{
    if (key) {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',['idem:'+key]);
      const replay=await c.query<{
        request_hash:string; status_code:number;response_body:object;retry_after:number|null
      }>('SELECT request_hash,status_code,response_body,retry_after FROM idempotency_results WHERE key=$1',[key]);
      if (replay.rows.length) {
        const old=replay.rows[0];
        if (old.request_hash!==fingerprint) return error(422,'idempotency key reused with different body');
        return {status:old.status_code,body:old.response_body,
          headers:old.retry_after?{'Retry-After':String(old.retry_after)}:undefined};
      }
    }

    async function complete(result:ApiResult):Promise<ApiResult> {
      if (key) await c.query(
        'INSERT INTO idempotency_results(key,request_hash,status_code,response_body,retry_after) VALUES($1,$2,$3,$4::jsonb,$5)',
        [key,fingerprint,result.status,JSON.stringify(result.body),result.headers?.['Retry-After']??null]);
      return result;
    }

    // Failed requests count towards the level-5 limit whenever an email is supplied.
    const rawEmail=raw && typeof raw==='object' && !Array.isArray(raw)?normalizeEmail((raw as Record<string,unknown>).email):'';
    if (rawEmail) {
      const denied=await reserveAttempt(c,rawEmail);
      if (denied) return complete(denied);
    }
    const input=validateBooking(raw);
    if (!input) return complete(error(400,'invalid or missing booking details'));

    const slot=await c.query<{id:string;start_at:Date}>(
      'SELECT id,start_at FROM slots WHERE id=$1 FOR UPDATE',[input.slot_id]);
    if (!slot.rows.length) return complete(error(404,'slot not found'));
    if (new Date(slot.rows[0].start_at).getTime() <= Date.now()) return complete(error(400,'slot has already started'));

    const booked=await c.query('SELECT 1 FROM bookings WHERE slot_id=$1 AND status=$2 LIMIT 1',
      [input.slot_id,'confirmed']);
    if (booked.rows.length) return complete(error(409,'slot already booked'));

    const result=await c.query<Record<string,unknown>>(
      'INSERT INTO bookings (id,slot_id,name,email,status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [randomUUID(),input.slot_id,input.name,input.email,'confirmed']);
    return complete({status:201,body:normalizeBooking(result.rows[0])});
  });
}
