const { recordId } = input.config();
if (!recordId) throw new Error("Missing input variable: recordId");

// === CONFIG ===
const GAP_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const GAP_MS = GAP_DAYS * MS_PER_DAY;

// === TABLES ===
const pictureDatesTable = base.getTable("Picture Dates");
const groupedShootsTable = base.getTable("Grouped Shoots");

// === FIELD NAMES ===
// Picture Dates
const PD = {
  shootGroupId: "Shoot Group ID",
  pictureDate: "Picture Date",
  linkedGroups: "Linked Groups",
};

// Grouped Shoots
const GS = {
  name: "Name", // primary field
  baseKey: "Base Shoot Group ID",
  runNum: "Run #",
  pictureDatesLink: "Picture Dates",
  earliest: "Earliest Picture Day",
  last: "Last Picture Day",
};

// === HELPERS ===
async function batchUpdate(table, updates) {
  const chunkSize = 50;
  for (let i = 0; i < updates.length; i += chunkSize) {
    await table.updateRecordsAsync(updates.slice(i, i + chunkSize));
  }
}

async function batchDelete(table, recordIds) {
  const chunkSize = 50;
  for (let i = 0; i < recordIds.length; i += chunkSize) {
    await table.deleteRecordsAsync(recordIds.slice(i, i + chunkSize));
  }
}

function toDate(val) {
  return val ? new Date(val) : null;
}

// Match rule:
// - date is inside group range OR within 14 days of either boundary
function groupMatchesDate(groupStartVal, groupEndVal, d) {
  const start = toDate(groupStartVal);
  const end = toDate(groupEndVal);
  if (!start || !end) return false;

  if (d >= start && d <= end) return true;

  const distToStart = Math.abs(d - start);
  const distToEnd = Math.abs(d - end);

  return distToStart <= GAP_MS || distToEnd <= GAP_MS;
}

function getMaxRun(groups) {
  let max = 0;
  for (const g of groups) {
    const v = g.getCellValue(GS.runNum);
    if (typeof v === "number" && v > max) max = v;
  }
  return max;
}

// Choose target group deterministically:
// lowest Run #, then earliest start date
function pickTarget(groups) {
  return groups
    .slice()
    .sort((a, b) => {
      const aRun = a.getCellValue(GS.runNum);
      const bRun = b.getCellValue(GS.runNum);

      const aRunNorm = typeof aRun === "number" ? aRun : 999999;
      const bRunNorm = typeof bRun === "number" ? bRun : 999999;

      if (aRunNorm !== bRunNorm) return aRunNorm - bRunNorm;

      const aStart = toDate(a.getCellValue(GS.earliest)) || new Date("2999-01-01");
      const bStart = toDate(b.getCellValue(GS.earliest)) || new Date("2999-01-01");
      return aStart - bStart;
    })[0];
}

async function deleteIfEmpty(groupIdsToCheck) {
  if (!groupIdsToCheck.length) return;

  const refreshed = await groupedShootsTable.selectRecordsAsync({
    fields: [GS.pictureDatesLink],
  });

  const toDelete = [];
  for (const gid of groupIdsToCheck) {
    const gr = refreshed.getRecord(gid);
    if (!gr) continue;

    const links = gr.getCellValue(GS.pictureDatesLink) || [];
    if (links.length === 0) toDelete.push(gid);
  }

  if (toDelete.length) await batchDelete(groupedShootsTable, toDelete);
}

// === MAIN ===

// Load triggering Picture Dates record
const pdRecord = await pictureDatesTable.selectRecordAsync(recordId);
if (!pdRecord) throw new Error("Picture Dates record not found.");

const baseKey = (pdRecord.getCellValueAsString(PD.shootGroupId) || "").trim();
const pdDateVal = pdRecord.getCellValue(PD.pictureDate);

if (!baseKey) throw new Error(`"${PD.shootGroupId}" is blank.`);
if (!pdDateVal) throw new Error(`"${PD.pictureDate}" is blank.`);

const pdDate = new Date(pdDateVal);

// Store old group links (for cleanup)
const oldLinks = pdRecord.getCellValue(PD.linkedGroups) || [];
const oldGroupIds = oldLinks.map(x => x.id);

// Clear current group link to allow re-evaluation
if (oldGroupIds.length) {
  await pictureDatesTable.updateRecordAsync(pdRecord.id, {
    [PD.linkedGroups]: [],
  });
}

// Load all groups
const gsQuery = await groupedShootsTable.selectRecordsAsync({
  fields: [GS.baseKey, GS.runNum, GS.earliest, GS.last, GS.pictureDatesLink, GS.name],
});

// Filter to groups with same base key
const sameKeyGroups = gsQuery.records.filter(r =>
  (r.getCellValueAsString(GS.baseKey) || "").trim() === baseKey
);

// Find groups that match this date (within threshold / inside range)
const matchingGroups = sameKeyGroups.filter(g => {
  const startVal = g.getCellValue(GS.earliest);
  const endVal = g.getCellValue(GS.last);
  return groupMatchesDate(startVal, endVal, pdDate);
});

let targetGroupId = null;

// CASE A: No match -> create a new run group
if (matchingGroups.length === 0) {
  const nextRun = getMaxRun(sameKeyGroups) + 1;

  // Name format: "<baseKey> (Run <n>)"
  const groupName = `${baseKey} (Run ${nextRun})`;

  targetGroupId = await groupedShootsTable.createRecordAsync({
    [GS.name]: groupName,
    [GS.baseKey]: baseKey,
    [GS.runNum]: nextRun,
  });

  await pictureDatesTable.updateRecordAsync(pdRecord.id, {
    [PD.linkedGroups]: [{ id: targetGroupId }],
  });
}

// CASE B: Exactly one match -> link to it
if (matchingGroups.length === 1) {
  targetGroupId = matchingGroups[0].id;

  await pictureDatesTable.updateRecordAsync(pdRecord.id, {
    [PD.linkedGroups]: [{ id: targetGroupId }],
  });
}

// CASE C: Multiple matches -> BRIDGE/MERGE
if (matchingGroups.length > 1) {
  const target = pickTarget(matchingGroups);
  targetGroupId = target.id;

  const mergeThese = matchingGroups.filter(g => g.id !== targetGroupId);

  // Move all Picture Dates from merge groups to target group
  const pdUpdates = [];
  const groupsToDelete = [];

  for (const g of mergeThese) {
    const linkedPDs = g.getCellValue(GS.pictureDatesLink) || [];
    for (const linked of linkedPDs) {
      pdUpdates.push({
        id: linked.id,
        fields: {
          [PD.linkedGroups]: [{ id: targetGroupId }],
        },
      });
    }
    groupsToDelete.push(g.id);
  }

  if (pdUpdates.length) await batchUpdate(pictureDatesTable, pdUpdates);

  // Ensure triggering record is linked to target
  await pictureDatesTable.updateRecordAsync(pdRecord.id, {
    [PD.linkedGroups]: [{ id: targetGroupId }],
  });

  // Delete merged groups
  if (groupsToDelete.length) await batchDelete(groupedShootsTable, groupsToDelete);
}

// Cleanup: delete any old groups that became empty due to this move
await deleteIfEmpty(oldGroupIds);
