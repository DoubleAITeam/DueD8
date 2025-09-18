export type Assignment = {
  id: string;
  label: string;
  color: string;
};

export type ClassData = {
  id: string;
  label: string;
  color: string;
  assignments: Assignment[];
};

const classes: ClassData[] = [
  {
    id: 'it223',
    label: 'GMU-IT223',
    color: 'var(--accent-purple)',
    assignments: [
      { id: 'p1', label: 'Proj 1 Draft', color: 'var(--accent-purple)' },
      { id: 'p2', label: 'Proj 2 Brief', color: 'var(--accent-purple)' }
    ]
  },
  {
    id: 'eng310',
    label: 'ENG-310 Writing Lab',
    color: 'var(--accent-orange)',
    assignments: [
      { id: 'essay', label: 'Research Essay', color: 'var(--accent-orange)' },
      { id: 'peer-review', label: 'Peer Review', color: 'var(--accent-orange)' }
    ]
  },
  {
    id: 'math180',
    label: 'MATH-180 Calculus I',
    color: 'var(--accent-blue)',
    assignments: [
      { id: 'hw1', label: 'Limits Homework', color: 'var(--accent-blue)' },
      { id: 'quiz', label: 'Derivatives Quiz', color: 'var(--accent-blue)' }
    ]
  }
];

const classMap = new Map(classes.map((course) => [course.id, course] as const));

export function getAllClasses(): ClassData[] {
  return classes;
}

export function getClassById(id: string | undefined): ClassData | undefined {
  if (!id) {
    return undefined;
  }
  return classMap.get(id);
}

export function getAssignmentById(
  classId: string | undefined,
  assignmentId: string | undefined
): Assignment | undefined {
  if (!classId || !assignmentId) {
    return undefined;
  }
  const course = classMap.get(classId);
  return course?.assignments.find((assignment) => assignment.id === assignmentId);
}
