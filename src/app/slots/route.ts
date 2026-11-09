import {pool} from '@/lib/db';
import {unauthorized,serverFailure} from '@/lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:Request):Promise<Response> {
  const notAllowed=unauthorized(req);
  if (notAllowed) return notAllowed;
  try {
    const provider=new URL(req.url).searchParams.get('provider');
    const query=`SELECT s.id,s.provider,s.start_text,s.end_text,
      NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id=s.id AND b.status='confirmed') AS available
      FROM slots s WHERE ($1::text IS NULL OR s.provider=$1) ORDER BY s.start_at ASC,s.id ASC`;
    const result=await pool().query(query,[provider]);
    return Response.json({slots:result.rows.map(r=>({id:r.id,provider:r.provider,
      start:r.start_text,end:r.end_text,available:r.available}))},
      {headers:{'Cache-Control':'no-store'}});
  } catch (e) { return serverFailure(e); }
}
