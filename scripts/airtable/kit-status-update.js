let table = base.getTable("Master List");
let recordId = input.config().record;

// Fetch full record
let record = await table.selectRecordAsync(recordId);

// Get field values
let assignedTo = record.getCellValue("Assigned To (DO NOT USE)");
let currentStatus = record.getCellValueAsString("Status");
let isBroken = record.getCellValue("Broken?");

let newStatus;

// 1. Priority check — set to BROKEN if checkbox is checked
if (isBroken) {
    newStatus = "BROKEN";
} else {
    // 2. Otherwise, follow normal status rules
    if (assignedTo && assignedTo.length > 0) {
        newStatus = "ASSIGNED";
    } else {
        newStatus = "READY";
    }
}

// Only update if status actually changed
if (currentStatus !== newStatus) {
    await table.updateRecordAsync(record.id, {
        "Status": { name: newStatus }
    });
}
