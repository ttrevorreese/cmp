const tz = inputData.tz || 'America/Los_Angeles';

// --- helpers ---
function parseTime(text){
  if(!text) return null;
  let t = String(text).trim().toLowerCase().replace(/\s+/g,'');
  if(/^\d{3,4}(am|pm)$/.test(t)){
    const ap=t.slice(-2), body=t.slice(0,-2);
    const h=body.length===3?body.slice(0,1):body.slice(0,2);
    const m=body.slice(-2);
    t = `${parseInt(h,10)}:${m}${ap}`;
  }
  if(t==='noon') t='12:00pm';
  if(t==='midnight') t='12:00am';
  const m=t.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/i);
  if(!m) return null;
  let h=parseInt(m[1],10);
  const min=m[2]?parseInt(m[2],10):0;
  const ap=m[3]?m[3].toLowerCase():null;
  if(ap){ if(ap==='pm'&&h!==12) h+=12; if(ap==='am'&&h===12) h=0; }
  else { if(h===24) h=0; if(h<0||h>23) return null; }
  if(min<0||min>59) return null;
  return {h, min};
}

function pad2(n){ return String(n).padStart(2,'0'); }

function dateKeyInTZ(tz){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(new Date());
  const y = parts.find(p=>p.type==='year').value;
  const m = parts.find(p=>p.type==='month').value;
  const d = parts.find(p=>p.type==='day').value;
  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

function offsetForDateKey(tz, dateKey){
  // Midday avoids DST transition edges
  const middayUTC = new Date(`${dateKey}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, timeZoneName:'short'
  }).formatToParts(middayUTC);
  const tzName = parts.find(p=>p.type==='timeZoneName').value; // 'PDT' or 'PST'
  return tzName.includes('DT') ? '-07:00' : '-08:00';
}

// --- main ---
const startParsed = parseTime(inputData.start_time_text);
const dateKey = dateKeyInTZ(tz);
const offset = offsetForDateKey(tz, dateKey);

let out = {
  shouldSchedule:false,
  mode:'',
  reason:'',
  dedupeKey:`opening_notified_${inputData.record_id}_${dateKey}`,
  startISO:'',
  startLocal:'',
  notifyAtISO:'',
  notifyAtLocal:''
};

if(!startParsed){
  out.reason = `Unparseable Start Time: "${inputData.start_time_text}"`;
  return out;
}

const HH = pad2(startParsed.h);
const MM = pad2(startParsed.min);

// Build absolute instants with explicit PT/PDT offset
const start = new Date(`${dateKey}T${HH}:${MM}:00${offset}`);
const notifyAt = new Date(start.getTime() - 15*60000);
const now = new Date();

out.startISO   = start.toISOString();
out.startLocal = new Date(out.startISO).toLocaleString('en-US',{ timeZone: tz });

if (now < notifyAt){
  out.shouldSchedule = true;
  out.mode = 'scheduled';
  out.notifyAtISO   = notifyAt.toISOString();
  out.notifyAtLocal = new Date(out.notifyAtISO).toLocaleString('en-US',{ timeZone: tz });
  return out;
}

if (now >= notifyAt && now < start){
  // Catch-up if T−15 already passed but start hasn't
  out.shouldSchedule = true;
  out.mode = 'catchup';
  const soon = new Date(now.getTime() + 10*1000);
  out.notifyAtISO   = soon.toISOString();
  out.notifyAtLocal = new Date(out.notifyAtISO).toLocaleString('en-US',{ timeZone: tz });
  return out;
}

// Too late (past start)
out.reason = 'after start time';
return out;
