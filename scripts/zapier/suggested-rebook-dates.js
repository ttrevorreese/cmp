const rawToken = String(inputData.airtableToken || "");
const airtableToken = rawToken.replace(/^Bearer\s+/i, "").trim();
const baseId = String(inputData.baseId || "").trim();

const schoolRecId = String(inputData.schoolRecId || inputData.schoolRecID || "").trim();
const fromYearRaw = String(inputData.fromYear || "").trim(); // 2025-2026
const toYearRaw   = String(inputData.toYear || "").trim();   // 2026-2027

const API = "https://api.airtable.com/v0";

const PICTURE_DATES_TABLE = "Picture Dates";
const SUGGESTIONS_TABLE  = "Rebook Suggestions";

// ----- Picture Dates field names
const PD_SCHOOL = "School Name";      // link to School Information
const PD_DATE   = "Picture Date";     // date
const PD_YEAR   = "School Year";      // short: 25-26, 26-27...
const PD_GROUP  = "Shoot Group ID";   // text/formula
const PD_TYPE   = "Type of Photo Day";// used for filtering + group type

// ----- Rebook Suggestions field names
const SUGG_SCHOOL   = "School Name";            // link to School Information
const SUGG_ORIGINAL = "Original Picture Date";  // link to Picture Dates (MUST allow multiple)
const SUGG_YEAR     = "Suggested School Year";  // short: 25-26, 26-27...
const SUGG_GROUPID  = "Shoot Group ID";
const SUGG_DATE     = "Suggested Date";         // group start date for sorting
const SUGG_LIST     = "Suggested Dates (List)"; // long text
const SUGG_RANGE    = "Suggested Date Range";   // single line text
const SUGG_TYPE     = "Type of Photo Day";      // <-- this will be filled again

function headers() {
  return { Authorization: `Bearer ${airtableToken}`, "Content-Type": "application/json" };
}

function toShortYear(raw) {
  const s = String(raw || "").trim();
  const mShort = s.match(/^(\d{2})\s*-\s*(\d{2})$/);
  if (mShort) return `${mShort[1]}-${mShort[2]}`;
  const mFull = s.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (mFull) return `${mFull[1].slice(-2)}-${mFull[2].slice(-2)}`;
  throw new Error(`Unrecognized school year format: "${s}"`);
}

function ymd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function md(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}
function dow(d) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[d.getDay()];
}

function parseDate(v) { return v ? new Date(v) : null; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function dayDiff(a, b) {
  const ms = 86400000;
  const aa = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aa - bb) / ms);
}
function addOneYearKeepWeekday(original) {
  const o = new Date(original);
  const targetDow = o.getDay();
  const c = new Date(original);
  c.setFullYear(c.getFullYear() + 1);
  while (c.getDay() !== targetDow) c.setDate(c.getDate() + 1);
  return c;
}
function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function adjustAnchorToAvoidWeekends(anchorNext, offsets) {
  let a = new Date(anchorNext);
  for (let i = 0; i < 14; i++) {
    const anyWeekend = offsets.some(off => isWeekend(addDays(a, off)));
    if (!anyWeekend) return a;
    a = addDays(a, 1);
  }
  return a;
}

function cleanType(v) {
  // Handles values like CANCELED or "CANCELED"
  return String(v || "").trim().replace(/^"+|"+$/g, "");
}
function normType(v) {
  return cleanType(v).toUpperCase();
}

async function airtableGetAll(tableName, { filterByFormula, fields, pageSize } = {}) {
  let out = [];
  let offset;

  do {
    const url = new URL(`${API}/${baseId}/${encodeURIComponent(tableName)}`);
    if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
    if (pageSize) url.searchParams.set("pageSize", String(pageSize));
    if (offset) url.searchParams.set("offset", offset);

    if (Array.isArray(fields)) {
      for (const f of fields) url.searchParams.append("fields[]", f);
    }

    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) throw new Error(`GET ${tableName} failed: ${res.status} ${await res.text()}`);

    const json = await res.json();
    out = out.concat(json.records || []);
    offset = json.offset;
  } while (offset);

  return out;
}

async function airtableCreateMany(tableName, records) {
  let created = 0;
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const res = await fetch(`${API}/${baseId}/${encodeURIComponent(tableName)}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ records: chunk }),
    });
    if (!res.ok) throw new Error(`CREATE ${tableName} failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    created += (json.records || []).length;
  }
  return created;
}

async function run() {
  if (!airtableToken || airtableToken.length < 30) throw new Error("airtableToken missing/invalid");
  if (!baseId.startsWith("app")) throw new Error("baseId should start with 'app'");
  if (!schoolRecId.startsWith("rec")) throw new Error("schoolRecId should start with 'rec'");
  if (!fromYearRaw || !toYearRaw) throw new Error("Missing fromYear/toYear");

  const fromYearShort = toShortYear(fromYearRaw);
  const toYearShort   = toShortYear(toYearRaw);

  // 1) Get Picture Dates for fromYearShort
  const pdFilter = `{${PD_YEAR}} = "${fromYearShort.replace(/"/g, '\\"')}"`;

  const pdRaw = await airtableGetAll(PICTURE_DATES_TABLE, {
    filterByFormula: pdFilter,
    fields: [PD_SCHOOL, PD_DATE, PD_YEAR, PD_GROUP, PD_TYPE],
    pageSize: 100,
  });

  // 2) Filter to this school + exclude CANCELED
  const pictureDates = pdRaw
    .map(r => ({ id: r.id, fields: r.fields || {} }))
    .filter(r => {
      const schoolLinks = r.fields[PD_SCHOOL] || [];
      if (!(Array.isArray(schoolLinks) && schoolLinks.includes(schoolRecId))) return false;
      if (!r.fields[PD_DATE]) return false;

      const t = normType(r.fields[PD_TYPE]);
      if (t === "CANCELED" || t === "CANCELLED") return false;

      return true;
    });

  if (!pictureDates.length) {
    return { ok: true, createdGroups: 0, message: `No non-canceled Picture Dates for ${fromYearShort}.` };
  }

  // 3) Dedupe existing group records for this school + toYearShort
  const suggFilter = `{${SUGG_YEAR}} = "${toYearShort.replace(/"/g, '\\"')}"`;

  const existingRaw = await airtableGetAll(SUGGESTIONS_TABLE, {
    filterByFormula: suggFilter,
    fields: [SUGG_SCHOOL, SUGG_GROUPID, SUGG_YEAR],
    pageSize: 100,
  });

  const existingGroupIds = new Set();
  for (const s of existingRaw) {
    const f = s.fields || {};
    const schoolLinks = f[SUGG_SCHOOL] || [];
    if (!Array.isArray(schoolLinks) || !schoolLinks.includes(schoolRecId)) continue;
    const gid = (f[SUGG_GROUPID] && String(f[SUGG_GROUPID]).trim()) || "";
    if (gid) existingGroupIds.add(gid);
  }

  // 4) Group by Shoot Group ID (fallback: each record its own group)
  const groups = new Map();
  for (const r of pictureDates) {
    const gid = (r.fields[PD_GROUP] && String(r.fields[PD_GROUP]).trim()) || r.id;
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid).push(r);
  }

  const creates = [];

  for (const [gid, recs] of groups.entries()) {
    if (existingGroupIds.has(gid)) continue;

    recs.sort((a, b) => parseDate(a.fields[PD_DATE]) - parseDate(b.fields[PD_DATE]));
    const anchorThis = parseDate(recs[0].fields[PD_DATE]);
    const offsets = recs.map(r => dayDiff(parseDate(r.fields[PD_DATE]), anchorThis));

    let anchorNext = addOneYearKeepWeekday(anchorThis);
    anchorNext = adjustAnchorToAvoidWeekends(anchorNext, offsets);

    const suggestedPairs = recs.map(r => {
      const original = parseDate(r.fields[PD_DATE]);
      const off = dayDiff(original, anchorThis);
      const suggested = addDays(anchorNext, off);
      return {
        originalId: r.id,
        original,
        suggested,
        type: cleanType(r.fields[PD_TYPE]),
      };
    });

    const suggestedSorted = [...suggestedPairs].sort((a, b) => a.suggested - b.suggested);
    const groupStart = suggestedSorted[0].suggested;
    const groupEnd = suggestedSorted[suggestedSorted.length - 1].suggested;

    const startMD = md(groupStart);
    const endMD = md(groupEnd);
    const dateRange = (startMD === endMD) ? startMD : `${startMD}-${endMD}`;


    const listText = suggestedSorted
      .map(p => `${dow(p.suggested)} ${md(p.suggested)} (from ${dow(p.original)} ${md(p.original)})`)
      .join("\n");

    // Pick a single group type:
    // - If all non-empty types are the same -> that value
    // - Else -> use the anchor record's type (first record in the group)
    const types = suggestedPairs.map(p => p.type).filter(Boolean);
    const uniqueTypes = Array.from(new Set(types.map(t => t.trim())));

    let groupType = "";
    if (uniqueTypes.length === 1) groupType = uniqueTypes[0];
    else groupType = types[0] || "";

    const fields = {
      [SUGG_SCHOOL]:   [schoolRecId],
      [SUGG_YEAR]:     toYearShort,
      [SUGG_GROUPID]:  gid,
      [SUGG_DATE]:     ymd(groupStart),
      [SUGG_RANGE]:    dateRange,
      [SUGG_LIST]:     listText,
      [SUGG_ORIGINAL]: suggestedPairs.map(p => p.originalId),
    };

    if (groupType) fields[SUGG_TYPE] = groupType;

    creates.push({ fields });
  }

  const createdGroups = creates.length ? await airtableCreateMany(SUGGESTIONS_TABLE, creates) : 0;

  return {
    ok: true,
    schoolRecId,
    fromYearShort,
    toYearShort,
    pictureDatesFoundNonCanceled: pictureDates.length,
    groupsFound: groups.size,
    createdGroups,
    skippedExistingGroups: groups.size - createdGroups,
  };
}

output = await run();
