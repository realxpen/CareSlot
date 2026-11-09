import type {Slot} from './types';

export const DEMO_DOCTOR_SCHEDULE = [
  {provider:'Dr Ade',times:['09:00','13:00']},
  {provider:'Dr Okafor',times:['09:15','13:15']},
  {provider:'Dr Hassan',times:['09:30','13:30']},
  {provider:'Dr Balogun',times:['10:00','14:00']},
  {provider:'Dr Nwosu',times:['10:30','14:30']},
  {provider:'Dr Ibrahim',times:['11:00','15:00']}
] as const;

/**
 * Synthetic demo slots, not real provider availability.
 * WAT is UTC+01:00 year round. Slots are [start,end) intervals.
 */
export function buildDemoSlots(now:Date=new Date()):Omit<Slot,'available'>[] {
  const slots:Omit<Slot,'available'>[]=[];
  for(let day=0;day<3;day++){
    const dayUTC=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+2+day);
    const midnightWAT=dayUTC-60*60*1000;
    const dateKey=new Date(dayUTC).toISOString().slice(0,10);
    for(let doctor=0;doctor<DEMO_DOCTOR_SCHEDULE.length;doctor++){
      const schedule=DEMO_DOCTOR_SCHEDULE[doctor];
      for(let time=0;time<schedule.times.length;time++){
        const [hours,minutes]=schedule.times[time].split(':').map(Number);
        const start=new Date(midnightWAT+(hours*60+minutes)*60*1000);
        const end=new Date(start.getTime()+30*60*1000);
        slots.push({
          id:`demo-v2-${dateKey}-${doctor}-${time}`,
          provider:schedule.provider,start:start.toISOString(),end:end.toISOString()
        });
      }
    }
  }
  return slots.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.provider.localeCompare(b.provider));
}
