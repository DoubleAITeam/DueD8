export type DeadlineLike = {
  dueAtIso?: string;
};

export function filterDeadlinesByDate<T extends DeadlineLike>(
  deadlines: T[],
  selectedDate: Date | null | undefined
): T[] {
  if (!selectedDate) {
    return deadlines;
  }
  const target = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  ).getTime();

  return deadlines.filter((deadline) => {
    if (!deadline?.dueAtIso) return false;
    const due = new Date(deadline.dueAtIso);
    const current = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    return current === target;
  });
}
