// Ensure inputData contains the necessary fields
if (!inputData.subtask_ids || !inputData.subtask_due_dates) {
  throw new Error("Missing subtask_ids or subtask_due_dates");
}

const subtaskIds = inputData.subtask_ids.split(",");
const subtaskDueDates = inputData.subtask_due_dates.split(",");

// Function to parse subtasks and their nested subtasks
function parseSubtasks(subtaskIds, subtaskDueDates, parentId = null) {
  let subtasks = [];
  let i = 0;
  while (i < subtaskIds.length) {
    let currentId = subtaskIds[i].trim();
    let parentCheck = parentId ? currentId.startsWith(parentId + "_") : true;

    if (parentCheck) {
      let subtask = {
        id: currentId,
        due_date: Number(subtaskDueDates[i].trim()),
        subtasks: []
      };
      i++;
      let nestedResult = parseSubtasks(subtaskIds.slice(i), subtaskDueDates.slice(i), currentId);
      subtask.subtasks = nestedResult.subtasks;
      i += nestedResult.length;
      subtasks.push(subtask);
    } else {
      break;
    }
  }
  return { subtasks, length: i };
}

// Parse the subtasks
const parsedSubtasks = parseSubtasks(subtaskIds, subtaskDueDates).subtasks;

// Return the subtasks JSON string
return { subtasks: JSON.stringify(parsedSubtasks) };
