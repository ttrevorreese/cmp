// Tables and views
let table = base.getTable("HR");
let view = table.getView("RESOURCE REQUESTS - OUTSTANDING");
let emailLogTable = base.getTable("Email Logs");

// Fetch records
let query = await view.selectRecordsAsync();
let assigneeTasks = {};

// List of statuses to include
const validStatuses = ["Submitted", "Pending Review"];

// Loop through records
for (let record of query.records) {
    let status = record.getCellValue("Resource Request Status");
    let assignee = record.getCellValue("Assignee");

    if (status && assignee && validStatuses.includes(status.name)) {
        let email = assignee.email;
        let name = assignee.name;

        // Pull fields
        let submittedBy = record.getCellValue("Submitted By Formatted") || "Unknown";
        let formattedDate = record.getCellValue("Formatted Date") || record.getCellValue("Date") || "No date";
        let resourceRequested = record.getCellValue("Resource Needed Formatted") || "Not specified";
        let toRegion = record.getCellValue("Region/Department Formatted") || "Unknown";
        let fromRegion = record.getCellValue("Region/Department Requesting From Formatted") || "Unknown";
        let requestDetails = record.getCellValue("Request Details") || "No additional details provided";

        if (!assigneeTasks[email]) {
            assigneeTasks[email] = {
                name,
                tasks: []
            };
        }

        // Format the task line with HTML line breaks
        assigneeTasks[email].tasks.push(
`<b>👤 Submitted By:</b> ${submittedBy}<br>
<b>📅 Date:</b> ${formattedDate}<br>
<b>📦 Resource:</b> ${resourceRequested}<br>
<b>📤 To:</b> ${toRegion} — <b>📥 From:</b> ${fromRegion}<br>
<b>📌 Status:</b> ${status.name}<br>
<b>📝 Details:</b> ${requestDetails}<br>
<hr>`
        );
    }
}

// Loop through each assignee and create a log
for (let [email, data] of Object.entries(assigneeTasks)) {
    let taskList = data.tasks.join("<br><br>");
    let body = `Hello ${data.name},<br><br>
Here is a list of your outstanding Resource Request tasks:<br><br>
${taskList}
<br><br>
Please refer to Constellation/Airtable for further details regarding these tasks. This is just a reminder to follow up with the resource requests assigned to you.<br><br>
If you have any questions, please reach out to Trevor, Alex, or Gaby.<br><br>
Best regards,<br>
CM Team`;

    try {
        await emailLogTable.createRecordAsync({
            "To": email,
            "Subject": "REMINDER: Outstanding Resource Requests Assigned to You",
            "Body": body
        });
        console.log(`✅ Email log created for ${email}`);
    } catch (error) {
        console.error(`❌ Failed to create email log for ${email}: ${error.message}`);
    }
}
