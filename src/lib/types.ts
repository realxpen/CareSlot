export type Slot = {id:string;provider:string;start:string;end:string;available:boolean};
export type Booking = {id:string;slot_id:string;name:string;email:string;status:'confirmed'|'cancelled';created_at:string};
export type ApiResult = {status:number;body:object;headers?:Record<string,string>};
