const {
  setup_location,
  schedule_breakdown,
  arrival_time,
  start_time,
  end_time,
  parking_info,
  expected_student_count,
  expected_staff_count,
  arrival_contact,
  school_name,
  photo_date,
  photo_day_type,
  data_contact,
  signature_html
} = inputData;

// Escape dynamic text (do NOT use on signature_html)
function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Track missing fields for the callout
const missing = [];

// Always render a row; if value is empty highlight it and record as missing
function row(label, value) {
  const hasValue = value != null && String(value).trim() !== "";
  if (!hasValue) missing.push(label);

  const cellStyles = hasValue
    ? "padding:8px 10px; vertical-align:top;"
    : "padding:8px 10px; vertical-align:top; background:#ffecec;";

  const cell = hasValue
    ? esc(value)
    : `<em style="color:#b00020;">(missing)</em>`;

  return `
    <tr>
      <td style="padding:8px 10px; width:220px; vertical-align:top; font-weight:600; background:#f7f7f7;">
        ${esc(label)}
      </td>
      <td style="${cellStyles}">
        ${cell}
      </td>
    </tr>`;
}

// Build table with ALL rows shown
const rows = [
  row("Set Up Location", setup_location),
  row("Schedule Breakdown", schedule_breakdown),
  row("Arrival Time", arrival_time),
  row("Start Time", start_time),
  row("End Time", end_time),
  row("Parking Info", parking_info),
  row("Expected Student Count", expected_student_count),
  row("Expected Staff Count (if applicable)", expected_staff_count),
  row("Arrival Contact", arrival_contact),
].join("");

const detailsTable = `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e5e5; border-collapse:collapse; font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#111;">
    ${rows}
  </table>`;

// Subject
const subject = `Please confirm photo day details${school_name ? ` – ${school_name}` : ""}${photo_date ? ` (${photo_date})` : ""}`;

// Header: "{School name} - {Type of photo day}, {Picture date}"
const headerLine = [
  school_name ? esc(school_name) : "",
  photo_day_type ? ` - ${esc(photo_day_type)}` : "",
  photo_date ? `${(school_name || photo_day_type) ? ", " : ""}${esc(photo_date)}` : ""
].join("");

const greetName = (data_contact && String(data_contact).trim()) ? esc(data_contact) : "there";

// Missing info callout (only renders if something is missing)
const missingCallout = missing.length
  ? `
    <div style="margin:14px 0; padding:10px 12px; border:1px solid #ffd0d0; background:#fff5f5; border-radius:6px; font-family:Arial, Helvetica, sans-serif; font-size:14px;">
      <strong style="color:#b00020;">Missing information:</strong>
      <ul style="margin:8px 0 0 18px; padding:0;">
        ${missing.map(i => `<li>${esc(i)}</li>`).join("")}
      </ul>
      <div style="margin-top:8px;">
        Please reply to this email with the missing details listed above.
      </div>
    </div>`
  : "";

// Signature block (raw HTML)
const signatureBlock = (signature_html && String(signature_html).trim())
  ? `<div style="margin-top:18px;">${signature_html}</div>`
  : "";

const html = `
<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#fafafa;">
    <div style="max-width:700px; margin:0 auto; padding:20px;">
      <div style="background:#ffffff; border:1px solid #eaeaea; border-radius:8px; padding:20px;">
        <h2 style="font-family:Arial, Helvetica, sans-serif; margin:0 0 8px; font-size:18px;">
          Please confirm your photo day details
        </h2>

        ${headerLine ? `
          <p style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#111; margin:0 0 14px;">
            <strong>${headerLine}</strong>
          </p>` : ""}

        <p style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#111; margin:0 0 16px;">
          Hi, ${greetName}! Could you please review the details below and confirm they’re correct? If anything needs to be updated, just reply to this email with the corrections.
        </p>

        ${detailsTable}

        ${missingCallout}

        <p style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#111; margin:16px 0 0;">
          Thank you!
        </p>

        ${signatureBlock}
      </div>

      <p style="font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#666; margin:12px 4px 0;">
        The content of this email is confidential and intended for the recipient specified only. If you received this by mistake, please reply and delete this message.
      </p>
    </div>
  </body>
</html>
`;

return { subject, html };
