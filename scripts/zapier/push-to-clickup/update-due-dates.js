try {
  const oldDueDate = Number(inputData.old_due_date); // already in ms
  const newDueDate = Number(inputData.new_due_date); // already in ms
  const timeDifference = newDueDate - oldDueDate;

  const subtasks = JSON.parse(inputData.subtasks);

  const TIME_SHIFT_MS = 7 * 60 * 60 * 1000; // 7 hours forward in ms

  function updateSubtaskDates(subtask) {
    const oldSubtaskDueDate = Number(subtask.due_date); // in ms
    const newSubtaskDueDate = oldSubtaskDueDate + timeDifference + TIME_SHIFT_MS;

    subtask.new_due_date = newSubtaskDueDate;

    if (subtask.subtasks && subtask.subtasks.length > 0) {
      subtask.subtasks = subtask.subtasks.map(updateSubtaskDates);
    }

    return subtask;
  }

  const updatedSubtasks = subtasks.map(updateSubtaskDates);

  return { updatedSubtasks };
} catch (error) {
  throw new Error(`Failed to parse input data: ${error.message}`);
}
