/**
 * Filter deadlines to those that occur on the provided date (local time).
 * @param {Array<{ dueAtIso: string }>} deadlines
 * @param {Date|null|undefined} selectedDate
 * @returns {Array}
 */
function filterDeadlinesByDate(deadlines, selectedDate) {
  if (!selectedDate) {
    return deadlines;
  }
  const target = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  ).getTime();
  return deadlines.filter((deadline) => {
    if (!deadline || !deadline.dueAtIso) return false;
    const due = new Date(deadline.dueAtIso);
    const current = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    return current === target;
  });
}

module.exports = {
  filterDeadlinesByDate
};
