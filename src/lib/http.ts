import type {ApiResult} from './types';

export function unauthorized(req:Request):Response|null {
  // A missing configuration must never accidentally allow a request.
  const key = process.env.BOOKING_API_KEY;
  if (!key || req.headers.get('x-api-key') !== key) return Response.json({error:'unauthorized'}, {status:401});
  return null;
}

export function jsonResult(result:ApiResult):Response {
  return Response.json(result.body, {status:result.status, headers:{'Cache-Control':'no-store',...result.headers}});
}

export function error(status:number, message:string, headers?:Record<string,string>):ApiResult {
  return {status, body:{error:message}, headers};
}

export async function requestBody(req:Request):Promise<unknown> {
  try { return await req.json(); } catch { return undefined; }
}

export function serverFailure(e:unknown):Response {
  console.error('Booking API error:', e instanceof Error?e.message:e);
  return Response.json({error:'internal server error'}, {status:500});
}
