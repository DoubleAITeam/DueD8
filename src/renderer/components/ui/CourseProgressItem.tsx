import React from 'react';
import type { CourseProgress } from '../../state/dashboard';
import ProgressBar from './ProgressBar';
import { calculateProgressPercent } from '../../utils/progress.js';

type CourseProgressItemProps = {
  course: CourseProgress;
  onClick?: (course: CourseProgress) => void;
};

const colorMap: Record<CourseProgress['color'], 'blue' | 'green' | 'purple'> = {
  blue: 'blue',
  green: 'green',
  purple: 'purple'
};

export default function CourseProgressItem({ course, onClick }: CourseProgressItemProps) {
  const percent = calculateProgressPercent(course.completedAssignments, course.totalAssignments);
  return (
    <button type="button" className="course-progress" onClick={() => onClick?.(course)}>
      <div className="course-progress__meta">
        <p className="course-progress__name">{course.name}</p>
        <p className="course-progress__summary">
          {course.completedAssignments}/{course.totalAssignments} Assignments
        </p>
      </div>
      <ProgressBar value={percent} color={colorMap[course.color]} ariaLabel={`${course.name} progress`} />
    </button>
  );
}
