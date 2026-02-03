const rawTimestamp = Number(inputData.unix_created);
const date = new Date(rawTimestamp);

// Shift forward by 7 hours so it shows as May 7 in PT
date.setUTCHours(7, 0, 0, 0);

return {
  shifted_due_date: date.getTime()
};
