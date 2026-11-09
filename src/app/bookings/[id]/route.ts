import {pool,transaction} from '@/lib/db';
import {normalizeBooking} from '@/lib/booking';
import {unauthorized,serverFailure} from '@/lib/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Context={params:Promise<{id:string}>};

export async function GET(req:Request,context:Context):Promise<Response> {
  const notAllowed=unauthorized(req);
  if (notAllowed) return notAllowed;
  const {id}=await context.params;
  try {
    const result=await pool().query<Record<string,unknown>>('SELECT * FROM bookings WHERE id::text=$1',[id]);
    if (!result.rows.length) return Response.json({error:'booking not found'}, {status:404});
    return Response.json(normalizeBooking(result.rows[0]),{headers:{'Cache-Control':'no-store'}});
  } catch (e) {return serverFailure(e);}
}

export async function DELETE(req:Request,context:Context):Promise<Response> {
  const notAllowed=unauthorized(req);
  if (notAllowed) return notAllowed;
  const {id}=await context.params;
  try {
    return await transaction(async c=>{
      const found=await c.query<Record<string,unknown>>('SELECT * FROM bookings WHERE id::text=$1 FOR UPDATE',[id]);
      if (!found.rows.length) return Response.json({error:'booking not found'},{status:404});
      if (found.rows[0].status==='cancelled') return Response.json({error:'booking already cancelled'},{status:409});
      const result=await c.query<Record<string,unknown>>(
        "UPDATE bookings SET status='cancelled' WHERE id::text=$1 RETURNING *",[id]);
      return Response.json(normalizeBooking(result.rows[0]));
    });
  } catch (e) {return serverFailure(e);}
}
