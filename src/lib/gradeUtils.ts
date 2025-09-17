import type { Course, CourseEnrollment } from './canvasClient';

export type CourseGradeSummary = {
  display: string;
  status: 'complete' | 'in-progress';
  grade?: string;
  score?: number;
};

function extractEnrollmentGrade(enrollment: CourseEnrollment) {
  const grade = enrollment.computed_current_grade ?? enrollment.grades?.current_grade ?? null;
  const scoreRaw = enrollment.computed_current_score ?? enrollment.grades?.current_score ?? null;
  const parsedScore = typeof scoreRaw === 'number' ? scoreRaw : scoreRaw != null ? Number(scoreRaw) : null;
  const score = typeof parsedScore === 'number' && !Number.isNaN(parsedScore) ? parsedScore : null;
  if (grade || typeof score === 'number') {
    return { grade: grade ?? undefined, score: typeof score === 'number' ? score : undefined };
  }
  const finalGrade = enrollment.computed_final_grade ?? enrollment.grades?.final_grade ?? null;
  const finalScoreRaw = enrollment.computed_final_score ?? enrollment.grades?.final_score ?? null;
  const parsedFinal = typeof finalScoreRaw === 'number' ? finalScoreRaw : finalScoreRaw != null ? Number(finalScoreRaw) : null;
  const finalScore = typeof parsedFinal === 'number' && !Number.isNaN(parsedFinal) ? parsedFinal : null;
  if (finalGrade || typeof finalScore === 'number') {
    return { grade: finalGrade ?? undefined, score: typeof finalScore === 'number' ? finalScore : undefined };
  }
  return null;
}

// PHASE 4: Normalise Canvas grade data for dashboard presentation.
export function deriveCourseGrade(course: Course): CourseGradeSummary {
  const enrollment = course.enrollments?.find((entry) => Boolean(extractEnrollmentGrade(entry)));
  if (!enrollment) {
    return { display: 'In Progress', status: 'in-progress' };
  }
  const extracted = extractEnrollmentGrade(enrollment);
  if (!extracted) {
    return { display: 'In Progress', status: 'in-progress' };
  }
  const { grade, score } = extracted;
  const scoreText = typeof score === 'number' ? `${score.toFixed(1)}%` : null;
  if (grade && scoreText) {
    return { display: `${grade} (${scoreText})`, status: 'complete', grade, score };
  }
  if (grade) {
    return { display: grade, status: 'complete', grade };
  }
  if (scoreText) {
    return { display: scoreText, status: 'complete', score };
  }
  return { display: 'In Progress', status: 'in-progress' };
}
