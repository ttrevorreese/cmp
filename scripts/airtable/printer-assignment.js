let table = base.getTable("Printers, Routers");
let recordId = input.config().record;

// Fetch full record
let record = await table.selectRecordAsync(recordId);

// Get field values
let assignedTo = record.getCellValue("Assigned To");
let currentStatus = record.getCellValueAsString("Status");
let isBroken = record.getCellValue("Broken?");

let newStatus;

// Priority: if marked Broken, status = BROKEN
if (isBroken) {
    newStatus = "BROKEN";
} else {
    // If assigned, status = ASSIGNED; else, status = READY
    if (assignedTo && assignedTo.length > 0) {
        newStatus = "ASSIGNED";
    } else {
        newStatus = "READY";
    }
}

// Only update if there's a change
if (currentStatus !== newStatus) {
    await table.updateRecordAsync(record.id, {
        "Status": { name: newStatus }
    });
}
