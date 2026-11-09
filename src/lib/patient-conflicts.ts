import type {Booking, Slot} from './types';

export type PatientTimeConflict = {booking:Booking;slot:Slot};

/**
 * Advisory-only overlap detection for the assessment website.
 * This never changes the Koya POST /bookings API contract.
 * [start, end) intervals are used: back-to-back appointments do not overlap.
 */
export function findPatientTimeConflict(
  bookings:readonly Booking[], slots:readonly Slot[], candidateSlotId:string
):PatientTimeConflict|null {
  const byId=new Map(slots.map(slot=>[slot.id,slot]));
  const candidate=byId.get(candidateSlotId);
  if (!candidate) return null;
  const wantedStart=Date.parse(candidate.start);
  const wantedEnd=Date.parse(candidate.end);
  if (!Number.isFinite(wantedStart)||!Number.isFinite(wantedEnd)||wantedEnd<=wantedStart) return null;

  for(const booking of bookings) {
    if(booking.status!=='confirmed') continue;
    const existing=byId.get(booking.slot_id);
    if (!existing) continue;
    const existingStart=Date.parse(existing.start);
    const existingEnd=Date.parse(existing.end);
    if (Number.isFinite(existingStart)&&Number.isFinite(existingEnd)&&
        wantedStart<existingEnd&&wantedEnd>existingStart) {
      return {booking,slot:existing};
    }
  }
  return null;
}
