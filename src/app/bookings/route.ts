import {pool} from '@/lib/db';
import {createBooking, normalizeBooking, normalizeEmail} from '@/lib/booking';
import {unauthorized,serverFailure,jsonResult,error,requestBody} from '@/lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(req:Request):Promise<Response> {
  const notAllowed=unauthorized(req);
  if (notAllowed) return notAllowed;
  const body=await requestBody(req);
  if (body===undefined) return jsonResult(error(400,'invalid JSON'));
  try { return jsonResult(await createBooking(body,req.headers.get('idempotency-key'))); }
  catch (e) { return serverFailure(e); }
}

export async function GET(req:Request):Promise<Response> {
  const notAllowed=unauthorized(req);
  if (notAllowed) return notAllowed;
  const q=new URL(req.url).searchParams;
  const email=normalizeEmail(q.get('email'));
  if (!email) return jsonResult(error(400,'email is required'));
  const rawLimit=q.get('limit')??'10';
  if (!/^\d+$/.test(rawLimit) || +rawLimit<1 || +rawLimit>50) return jsonResult(error(400,'invalid limit'));
  const limit=Number(rawLimit);
  let cursorDate:string|null=null;
  let cursorId:string|null=null;
  const encoded=q.get('cursor');
  if (encoded) {
    try {
      const decoded=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
      if (!Array.isArray(decoded) || decoded.length!==2 || typeof decoded[0]!=='string' || typeof decoded[1]!=='string' ||
          Number.isNaN(Date.parse(decoded[0])) || !/^[0-9a-f-]{36}$/i.test(decoded[1])) throw new Error('bad cursor');
      cursorDate=decoded[0];cursorId=decoded[1];
    } catch { return jsonResult(error(400,'invalid cursor')); }
  }
  try {
    const result=await pool().query<Record<string,unknown>>(
      `SELECT *, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at FROM bookings WHERE email=$1
       AND ($2::timestamptz IS NULL OR (created_at,id)>($2::timestamptz,$3::uuid))
       ORDER BY created_at ASC,id ASC LIMIT $4`,[email,cursorDate,cursorId,limit+1]);
    const hasMore=result.rows.length>limit;
    const page=result.rows.slice(0,limit).map(normalizeBooking);
    const lastRaw=result.rows[Math.min(limit,result.rows.length)-1];
    // Preserve PostgreSQL microseconds. JS Date truncates to milliseconds and can repeat rows.
    const next_cursor=hasMore && lastRaw?Buffer.from(JSON.stringify([String(lastRaw.cursor_created_at),String(lastRaw.id)])).toString('base64url'):null;
    return Response.json({bookings:page,next_cursor},{headers:{'Cache-Control':'no-store'}});
  } catch (e) { return serverFailure(e); }
}
