/**
 * Non-destructive, additive conflict demonstration slots.
 * Requires --yes and a separate DEVELOPMENT Neon database.
 * Does not modify existing slots/bookings or call /reset.
 */
import {randomUUID} from 'node:crypto';
import pg from 'pg';

if(!process.argv.includes('--yes')){
  console.error('Run only against an isolated DEVELOPMENT database: node --env-file=.env.local scripts/seed-conflict-demo.mjs --yes');
  process.exit(1);
}
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
const day=new Date();
day.setUTCDate(day.getUTCDate()+3);
day.setUTCHours(8,0,0,0); // 09:00 Lagos (WAT = UTC+1)
const seedTag=randomUUID().slice(0,8);
const definitions=[
  {id:`overlap-${seedTag}-a`,provider:'Dr Ade (overlap demo)',offset:0},
  {id:`overlap-${seedTag}-b`,provider:'Dr Okafor (overlap demo)',offset:15},
  {id:`overlap-${seedTag}-c`,provider:'Dr Hassan (adjacent demo)',offset:30}
];
try{
  await client.connect();
  for(const item of definitions) {
    const start=new Date(day.getTime()+item.offset*60000);
    const end=new Date(start.getTime()+30*60000);
    await client.query(
      'INSERT INTO slots(id,provider,start_text,end_text,start_at,end_at) VALUES($1,$2,$3,$4,$5,$6)',
      [item.id,item.provider,start.toISOString(),end.toISOString(),start.toISOString(),end.toISOString()]
    );
    console.log(`${item.provider}: ${start.toISOString()}–${end.toISOString()} (slot ${item.id})`);
  }
  console.log('Done. Existing bookings were not reset. Refresh local CareSlot to see these slots.');
}finally{await client.end();}
