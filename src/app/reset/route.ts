import {transaction} from '@/lib/db';
import {unauthorized,serverFailure} from '@/lib/http';

export const runtime='nodejs';

export async function POST(req:Request):Promise<Response> {
  const notAllowed=unauthorized(req);
  if (notAllowed) return notAllowed;
  let body:unknown;
  try { body=await req.json(); } catch {return Response.json({error:'invalid JSON'}, {status:400});}
  const slots=(body && typeof body==='object' && !Array.isArray(body))?(body as Record<string,unknown>).slots:null;
  if (!Array.isArray(slots)) return Response.json({error:'slots must be an array'}, {status:400});
  const seen=new Set<string>();
  const validated:{id:string;provider:string;start:string;end:string}[]=[];
  for (const item of slots) {
    if (!item || typeof item!=='object') return Response.json({error:'invalid slot'}, {status:400});
    const s=item as Record<string,unknown>;
    if (typeof s.id!=='string' || !s.id || typeof s.provider!=='string' || !s.provider ||
        typeof s.start!=='string' || typeof s.end!=='string' ||
        Number.isNaN(Date.parse(s.start)) || Number.isNaN(Date.parse(s.end)) ||
        new Date(s.end).getTime() <= new Date(s.start).getTime() || seen.has(s.id))
      return Response.json({error:'invalid or duplicate slot'}, {status:400});
    seen.add(s.id);
    validated.push({id:s.id,provider:s.provider,start:s.start,end:s.end});
  }
  try {
    await transaction(async c=>{
      // Serialize resets; deletes and inserts all happen in one transaction.
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended('reset',0))");
      await c.query('DELETE FROM bookings');
      await c.query('DELETE FROM slots');
      await c.query('DELETE FROM idempotency_results');
      await c.query('DELETE FROM booking_attempts');
      for (const s of validated) {
        await c.query('INSERT INTO slots(id,provider,start_text,end_text,start_at,end_at) VALUES($1,$2,$3,$4,$5,$6)',
          [s.id,s.provider,s.start,s.end,s.start,s.end]);
      }
    });
    return Response.json({ok:true});
  } catch (e) {return serverFailure(e);}
}
