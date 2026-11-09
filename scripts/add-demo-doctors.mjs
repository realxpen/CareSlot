/**
 * Inserts missing synthetic demo slots into an isolated development DB.
 * This does not call reset or delete existing bookings.
 */
import pg from 'pg';
import {buildDemoSlots} from '../src/lib/demo-slots.ts';
if(!process.argv.includes('--yes')){
  console.error('Use only on an isolated development DB. Pass --yes to add demo slots.');
  process.exit(1);
}
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not set');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
const slots=buildDemoSlots();
try{
  await client.connect();
  await client.query('BEGIN');
  let added=0;
  for(const slot of slots){
    const result=await client.query(
      'INSERT INTO slots(id,provider,start_text,end_text,start_at,end_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
      [slot.id,slot.provider,slot.start,slot.end,slot.start,slot.end]
    );
    added+=result.rowCount??0;
  }
  await client.query('COMMIT');
  console.log(`Added ${added} of ${slots.length} demo slots. No existing bookings or slots were deleted.`);
}catch(error){
  await client.query('ROLLBACK').catch(()=>{});
  console.error('Could not add demo slots:',error instanceof Error?error.message:error);
  process.exitCode=1;
}finally{await client.end();}
