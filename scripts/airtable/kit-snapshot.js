let table = base.getTable("Picture Dates");
let query = await table.selectRecordsAsync();
let updates = [];

// Maps each photographer role field to:
// 1. the lookup field containing their current kit
// 2. the text field where we want to snapshot the kit string
const roles = {
    "Photographer 1": {
        assignedKitField: "Photog. 1 Assigned Kit",
        snapshotField: "Photog. 1 Kit"
    },
    "Photographer 2": {
        assignedKitField: "Photog. 2 Assigned Kit",
        snapshotField: "Photog. 2 Kit"
    },
    "Photographer 3": {
        assignedKitField: "Photog. 3 Assigned Kit",
        snapshotField: "Photog. 3 Kit"
    },
    "Photographer 4": {
        assignedKitField: "Photog. 4 Assigned Kit",
        snapshotField: "Photog. 4 Kit"
    },
    "Photographer 5": {
        assignedKitField: "Photog. 5 Assigned Kit",
        snapshotField: "Photog. 5 Kit"
    },
    "Photographer 6": {
        assignedKitField: "Photog. 6 Assigned Kit",
        snapshotField: "Photog. 6 Kit"
    },
    "Photographer 7": {
        assignedKitField: "Photog. 7 Assigned Kit",
        snapshotField: "Photog. 7 Kit"
    },
    "Photographer 8": {
        assignedKitField: "Photog. 8 Assigned Kit",
        snapshotField: "Photog. 8 Kit"
    },
    "Photographer 9": {
        assignedKitField: "Photog. 9 Assigned Kit",
        snapshotField: "Photog. 9 Kit"
    },
    "Photographer 10": {
        assignedKitField: "Photog. 10 Assigned Kit",
        snapshotField: "Photog. 10 Kit"
    },
    "Team Leader": {
        assignedKitField: "Team Lead Assigned Kit",
        snapshotField: "Team Lead Kit"
    },
    "Team Leader/Photographer": {
        assignedKitField: "Team Lead/Photog. Assigned Kit",
        snapshotField: "Team Leader/Photog. Kit"
    }
};

for (let record of query.records) {
    // Skip if already snapshotted
    if (record.getCellValue("Kits Snapshotted")) continue;

    let fieldsToUpdate = {};
    let updated = false;

    for (let roleField in roles) {
        const { assignedKitField, snapshotField } = roles[roleField];

        const assignedKitArr = record.getCellValue(assignedKitField);
        const assignedKit = Array.isArray(assignedKitArr) ? assignedKitArr.join(", ") : assignedKitArr;
        const currentSnapshot = record.getCellValue(snapshotField);


        // Proceed only if a kit is available and hasn't been snapshotted yet
        if (assignedKit && !currentSnapshot) {
            fieldsToUpdate[snapshotField] = assignedKit;
            updated = true;
        }
    }

    if (updated) {
        fieldsToUpdate["Kits Snapshotted"] = true;
        updates.push({ id: record.id, fields: fieldsToUpdate });
    }
}

// Batch update (max 50 at a time)
while (updates.length > 0) {
    await table.updateRecordsAsync(updates.slice(0, 50));
    updates = updates.slice(50);
}
