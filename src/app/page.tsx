'use client';

import {useEffect,useState,type FormEvent} from 'react';
import type {Booking,Slot} from '@/lib/types';

type Reply<T>={ok:boolean;status:number;data:T & {error?:string}};

async function callApi<T extends object>(path:string,key:string,method='GET',body?:object):Promise<Reply<T>> {
  const res=await fetch(path,{
    method,headers:{'X-API-Key':key,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined,cache:'no-store'
  });
  const data=await res.json();
  return {ok:res.ok,status:res.status,data};
}

function demoSlots() {
  const slots=[];
  const physicians=['Dr Ade','Dr Okafor','Dr Hassan'];
  const startDay=new Date();startDay.setUTCDate(startDay.getUTCDate()+2);
  startDay.setUTCHours(0,0,0,0);
  for(let day=0;day<3;day++) for(let n=0;n<3;n++) {
    const begin=new Date(startDay.getTime()+day*86400000+(9+n*2)*3600000);
    const end=new Date(begin.getTime()+30*60000);
    slots.push({id:`demo-${day}-${n}`,provider:physicians[n],start:begin.toISOString(),end:end.toISOString()});
  }
  return slots;
}

export default function Home() {
  const [key,setKey]=useState('');
  const [connected,setConnected]=useState(false);
  const [slots,setSlots]=useState<Slot[]>([]);
  const [selected,setSelected]=useState('');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [booking,setBooking]=useState<Booking|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{const saved=sessionStorage.getItem('koya_demo_api_key');if(saved)setKey(saved);},[]);

  async function refresh(token=key) {
    setBusy(true);setMessage('');
    try {
      const res=await callApi<{slots:Slot[]}>('/slots',token);
      if (!res.ok) throw new Error(res.data.error||`Error ${res.status}`);
      setSlots(res.data.slots);
      setConnected(true);
      sessionStorage.setItem('koya_demo_api_key',token);
    } catch(e) {setConnected(false);setMessage(e instanceof Error?e.message:'Unable to connect');}
    finally {setBusy(false);}
  }

  async function seed() {
    if (!confirm('Replace ALL appointment slots and DELETE existing bookings? Use only for a fresh demo.')) return;
    setBusy(true);setMessage('');setBooking(null);
    try {
      const res=await callApi<{ok:boolean}>('/reset',key,'POST',{slots:demoSlots()});
      if(!res.ok)throw new Error(res.data.error||`Error ${res.status}`);
      await refresh();setMessage('Sample appointments created. Choose an available time.');
    } catch(e) {setMessage(e instanceof Error?e.message:'Could not create slots');}
    finally {setBusy(false);}
  }

  async function submit(e:FormEvent) {
    e.preventDefault();
    if(!selected){setMessage('Choose an appointment time.');return;}
    setBusy(true);setMessage('');
    try {
      const res=await callApi<Booking>('/bookings',key,'POST',{slot_id:selected,name,email});
      if(!res.ok)throw new Error(res.data.error||`Error ${res.status}`);
      setBooking(res.data);setMessage('Your appointment has been confirmed.');
      await refresh();
    } catch(e) {setMessage(e instanceof Error?e.message:'Could not book appointment');}
    finally {setBusy(false);}
  }

  async function cancelBooking() {
    if(!booking)return;
    setBusy(true);
    try {
      const res=await callApi<Booking>(`/bookings/${encodeURIComponent(booking.id)}`,key,'DELETE');
      if(!res.ok)throw new Error(res.data.error||`Error ${res.status}`);
      setBooking(res.data);await refresh();setMessage('Appointment cancelled. The slot is available again.');
    } catch(e) {setMessage(e instanceof Error?e.message:'Could not cancel');}
    finally {setBusy(false);}
  }

  const chosen=slots.find(s=>s.id===selected);
  const available=slots.filter(s=>s.available);

  return <main>
    <header className="topbar"><div className="logo"><span className="logoIcon">✳</span> CareSlot</div><span className="eyebrow">CLINIC APPOINTMENTS</span></header>
    <section className="hero">
      <div><p className="overline">YOUR HEALTH, YOUR TIME</p><h1>Care should fit<br/><em>your schedule.</em></h1>
      <p className="intro">Find an available appointment, book in a moment, and keep your confirmation handy.</p></div>
      <div className="heroDecor"><div className="bigCircle">✳</div><p>Simple appointments.<br/>Thoughtful care.</p></div>
    </section>
    <div className="content">
      <section className="panel setup">
        <div><p className="overline">STEP 01 · CONNECT</p><h2>Access your booking system</h2><p className="muted">Enter the assessment API key. It stays in this browser tab and is not embedded in the public website.</p></div>
        <form className="connectRow" onSubmit={e=>{e.preventDefault();void refresh();}}>
          <label className="srOnly" htmlFor="apiKey">Booking API key</label>
          <input id="apiKey" type="password" placeholder="Paste booking API key" value={key}
            onChange={e=>{setKey(e.target.value);setConnected(false);}} required/>
          <button type="submit" disabled={busy||!key}>{connected?'Refresh':'Connect'} <span aria-hidden="true">↗</span></button>
        </form>
        {connected&&<div className="connected">● Connected to the booking API</div>}
      </section>
      <section className="panel">
        <div className="sectionHeading"><div><p className="overline">STEP 02 · CHOOSE</p><h2>Available appointments</h2></div>
          <span className="count">{available.length} available</span></div>
        {!connected?<p className="empty">Enter your API key above to see available appointments.</p>:
          slots.length===0?<div className="empty">No slots are set up yet. <button className="linkButton" type="button" disabled={busy} onClick={()=>void seed()}>Create demo slots</button></div>:
          <><div className="slotGrid">{slots.map(slot=><button className={`slot ${selected===slot.id?'selected':''}`} type="button" key={slot.id}
            onClick={()=>setSelected(slot.id)} disabled={!slot.available||busy}>
            <span className="slotStatus">{slot.available?'● Available':'○ Booked'}</span>
            <strong>{slot.provider}</strong>
            <span>{new Date(slot.start).toLocaleDateString('en-NG',{weekday:'short',month:'short',day:'numeric'})}</span>
            <b>{new Date(slot.start).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'})} WAT</b>
          </button>)}</div><div className="resetHint">Need fresh sample data? <button className="linkButton" disabled={busy} type="button" onClick={()=>void seed()}>Reset demo slots</button> <span>(deletes current bookings)</span></div></>}
      </section>
      <section className="panel bookingPanel">
        <div><p className="overline">STEP 03 · CONFIRM</p><h2>Make it official</h2><p className="muted">Enter your details to reserve the selected appointment.</p>
          {chosen&&<p className="chosen">✳ {chosen.provider} · {new Date(chosen.start).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'})}</p>}</div>
        <form onSubmit={e=>void submit(e)} className="bookingForm">
          <label htmlFor="patientName">Full name</label><input id="patientName" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Ada Obi" required />
          <label htmlFor="patientEmail">Email address</label><input id="patientEmail" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ada@example.com" required />
          <button type="submit" disabled={busy||!connected||!chosen||!chosen.available}>{busy?'Working…':'Confirm appointment'} <span aria-hidden="true">↗</span></button>
        </form>
      </section>
      {message&&<div className="notice" role="status">{message}</div>}
      {booking&&<section className="confirmation" aria-label="Booking confirmation">
        <p className="overline">YOUR CONFIRMATION</p><h2>{booking.status==='confirmed'?'You’re booked.':'Booking cancelled.'}</h2>
        <p>Booking reference: <code>{booking.id}</code></p><p>Patient: {booking.name} · {booking.email}</p>
        <p>Status: <strong>{booking.status}</strong></p>
        {booking.status==='confirmed'&&<button type="button" disabled={busy} onClick={()=>void cancelBooking()} className="cancel">Cancel this appointment</button>}
      </section>}
    </div><footer>CareSlot · A technical assessment project · Built with care</footer>
  </main>;
}
