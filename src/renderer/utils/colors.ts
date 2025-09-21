export const coursePalette = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f97316', '#9333ea', '#ec4899', '#92400e'];

export function getCourseColor(courseId: number, index: number) {
  const palette = coursePalette;
  if (palette.length === 0) return '#64748b';
  const targetIndex = index >= 0 ? index % palette.length : courseId % palette.length;
  return palette[targetIndex];
}
