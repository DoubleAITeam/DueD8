import React from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import Course from './pages/Course';
import Dashboard from './pages/Dashboard';
import AssignmentPage from './pages/Assignment';
import type { Assignment as CanvasAssignment, Course as CanvasCourse } from './lib/canvasClient';
import { getAssignments, getCourses } from './lib/canvasClient';
import { rendererError, rendererLog } from './lib/logger';
import { useUIStore } from './state/uiStore';

type AssignmentSummary = CanvasAssignment & { status?: string };
type CourseDataSource = 'canvas' | 'mock';

type CourseDataContextValue = {
  courses: CanvasCourse[];
  loadingCourses: boolean;
  assignmentsByCourse: Record<number, AssignmentSummary[]>;
  assignmentsLoading: Record<number, boolean>;
  assignmentIndex: Record<number, AssignmentSummary>;
  loadAssignments: (courseId: number) => Promise<AssignmentSummary[]>;
  ensureAssignment: (assignmentId: number) => Promise<AssignmentSummary | undefined>;
};

const CourseDataContext = React.createContext<CourseDataContextValue | undefined>(undefined);

export function useCourseData() {
  const context = React.useContext(CourseDataContext);
  if (!context) {
    throw new Error('useCourseData must be used within a CourseDataProvider');
  }
  return context;
}

const MOCK_COURSES: CanvasCourse[] = [
  {
    id: 101,
    name: 'Introduction to Calculus',
    course_code: 'MATH 101'
  },
  {
    id: 202,
    name: 'Modern Literature Seminar',
    course_code: 'ENG 202'
  }
];

const MOCK_ASSIGNMENTS: Record<number, AssignmentSummary[]> = {
  101: [
    {
      id: 1001,
      name: 'Derivative Practice Set',
      course_id: 101,
      due_at: '2024-03-01T21:00:00.000Z',
      status: 'Not started'
    },
    {
      id: 1002,
      name: 'Limits Reflection',
      course_id: 101,
      due_at: '2024-03-05T21:00:00.000Z',
      status: 'In progress'
    }
  ],
  202: [
    {
      id: 2001,
      name: 'Poetry Analysis Essay',
      course_id: 202,
      due_at: '2024-03-08T23:59:00.000Z',
      status: 'Not started'
    },
    {
      id: 2002,
      name: 'Discussion Post: Magical Realism',
      course_id: 202,
      due_at: '2024-02-28T16:00:00.000Z',
      status: 'Submitted'
    }
  ]
};

function cloneAssignments(source: Record<number, AssignmentSummary[]>) {
  return Object.entries(source).reduce<Record<number, AssignmentSummary[]>>((acc, [courseId, list]) => {
    acc[Number(courseId)] = list.map((item) => ({ ...item }));
    return acc;
  }, {});
}

function buildAssignmentIndex(source: Record<number, AssignmentSummary[]>) {
  return Object.values(source).reduce<Record<number, AssignmentSummary>>((acc, list) => {
    list.forEach((assignment) => {
      acc[assignment.id] = assignment;
    });
    return acc;
  }, {});
}

function mergeAssignmentIndex(
  previous: Record<number, AssignmentSummary>,
  list: AssignmentSummary[]
) {
  const next = { ...previous };
  list.forEach((assignment) => {
    next[assignment.id] = assignment;
  });
  return next;
}

function deriveAssignmentStatus(
  assignment: CanvasAssignment & {
    workflow_state?: string;
    has_submitted_submissions?: boolean;
    submission?: { workflow_state?: string } | null;
  }
) {
  if (assignment.submission?.workflow_state) {
    return assignment.submission.workflow_state;
  }
  if (assignment.has_submitted_submissions) {
    return 'submitted';
  }
  if (assignment.workflow_state) {
    return assignment.workflow_state;
  }
  return 'open';
}

function CourseDataProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = React.useState<CanvasCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState(true);
  const [assignmentsByCourse, setAssignmentsByCourse] = React.useState<
    Record<number, AssignmentSummary[]>
  >({});
  const [assignmentIndex, setAssignmentIndex] = React.useState<Record<number, AssignmentSummary>>({});
  const [assignmentsLoading, setAssignmentsLoading] = React.useState<Record<number, boolean>>({});
  const [dataSource, setDataSource] = React.useState<CourseDataSource>('mock');

  const assignmentsByCourseRef = React.useRef<Record<number, AssignmentSummary[]>>({});
  const assignmentIndexRef = React.useRef<Record<number, AssignmentSummary>>({});
  const coursesRef = React.useRef<CanvasCourse[]>([]);

  React.useEffect(() => {
    assignmentsByCourseRef.current = assignmentsByCourse;
  }, [assignmentsByCourse]);

  React.useEffect(() => {
    assignmentIndexRef.current = assignmentIndex;
  }, [assignmentIndex]);

  React.useEffect(() => {
    coursesRef.current = courses;
  }, [courses]);

  const loadCourses = React.useCallback(async () => {
    setLoadingCourses(true);
    try {
      let loaded: CanvasCourse[] = [];
      let source: CourseDataSource = 'mock';

      try {
        if (typeof window !== 'undefined' && window.dued8) {
          const response = await getCourses();
          if (response.ok && Array.isArray(response.data) && response.data.length > 0) {
            loaded = response.data;
            source = 'canvas';
            rendererLog('Loaded courses from Canvas', response.data.length);
          } else if (response.error) {
            rendererError('Canvas course request failed, falling back to mock data', response.error);
          }
        }
      } catch (error) {
        rendererError('Unable to reach Canvas courses, using mock data', error);
      }

      if (!loaded.length) {
        loaded = MOCK_COURSES.map((course) => ({ ...course }));
        source = 'mock';
        rendererLog('Using mock course data', loaded.length);
      }

      setDataSource(source);
      setCourses(loaded);
      setAssignmentsLoading({});

      if (source === 'mock') {
        const cloned = cloneAssignments(MOCK_ASSIGNMENTS);
        setAssignmentsByCourse(cloned);
        setAssignmentIndex(buildAssignmentIndex(cloned));
      } else {
        setAssignmentsByCourse({});
        setAssignmentIndex({});
      }
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  React.useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const loadAssignments = React.useCallback(
    async (courseId: number) => {
      if (!courseId) return [];

      if (dataSource === 'mock') {
        const existing = assignmentsByCourseRef.current[courseId];
        if (existing) {
          return existing;
        }
        const fallback = cloneAssignments({ [courseId]: MOCK_ASSIGNMENTS[courseId] ?? [] })[courseId] ?? [];
        setAssignmentsByCourse((prev) => ({ ...prev, [courseId]: fallback }));
        setAssignmentIndex((prev) => mergeAssignmentIndex(prev, fallback));
        return fallback;
      }

      const cached = assignmentsByCourseRef.current[courseId];
      if (cached) {
        return cached;
      }

      setAssignmentsLoading((prev) => ({ ...prev, [courseId]: true }));

      let assignments: AssignmentSummary[] = [];
      try {
        const response = await getAssignments(courseId);
        if (response.ok && Array.isArray(response.data)) {
          assignments = response.data.map((item) => ({
            ...item,
            status: deriveAssignmentStatus(item as Parameters<typeof deriveAssignmentStatus>[0])
          }));
          rendererLog('Loaded assignments from Canvas', courseId, assignments.length);
        } else if (response.error) {
          rendererError('Canvas assignments request failed, falling back to mock data', response.error);
        }
      } catch (error) {
        rendererError('Unable to load Canvas assignments, using mock data', error);
      }

      if (!assignments.length) {
        const fallback = cloneAssignments({ [courseId]: MOCK_ASSIGNMENTS[courseId] ?? [] })[courseId] ?? [];
        assignments = fallback;
      }

      setAssignmentsByCourse((prev) => ({ ...prev, [courseId]: assignments }));
      setAssignmentIndex((prev) => mergeAssignmentIndex(prev, assignments));

      setAssignmentsLoading((prev) => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });

      return assignments;
    },
    [dataSource]
  );

  React.useEffect(() => {
    if (!courses.length || dataSource === 'mock') {
      return;
    }
    courses.forEach((course) => {
      loadAssignments(course.id);
    });
  }, [courses, dataSource, loadAssignments]);

  const ensureAssignment = React.useCallback(
    async (assignmentId: number) => {
      if (!assignmentId) return undefined;
      const existing = assignmentIndexRef.current[assignmentId];
      if (existing) {
        return existing;
      }

      const courseList = coursesRef.current;
      for (const course of courseList) {
        await loadAssignments(course.id);
        const updated = assignmentIndexRef.current[assignmentId];
        if (updated) {
          return updated;
        }
      }
      return undefined;
    },
    [loadAssignments]
  );

  const value = React.useMemo(
    () => ({
      courses,
      loadingCourses,
      assignmentsByCourse,
      assignmentsLoading,
      assignmentIndex,
      loadAssignments,
      ensureAssignment
    }),
    [
      courses,
      loadingCourses,
      assignmentsByCourse,
      assignmentsLoading,
      assignmentIndex,
      loadAssignments,
      ensureAssignment
    ]
  );

  return <CourseDataContext.Provider value={value}>{children}</CourseDataContext.Provider>;
}

const linkStyles: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  textDecoration: 'none'
};

function TopBar() {
  const chatOpen = useUIStore((state) => state.chatOpen);
  const unreadCount = useUIStore((state) => state.unreadCount);
  const openChat = useUIStore((state) => state.openChat);
  const minimizeChat = useUIStore((state) => state.minimizeChat);
  const clearUnread = useUIStore((state) => state.clearUnread);
  const { courses } = useCourseData();

  const primaryCourse = courses[0];

  const toggleChat = () => {
    if (chatOpen) {
      minimizeChat();
    } else {
      openChat();
      clearUnread();
    }
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}
    >
      <nav style={{ display: 'flex', gap: 12 }}>
        <NavLink
          to="/"
          style={({ isActive }) => ({
            ...linkStyles,
            color: isActive ? '#0f172a' : '#64748b',
            backgroundColor: isActive ? '#e2e8f0' : 'transparent',
            fontWeight: isActive ? 600 : 500
          })}
        >
          Dashboard
        </NavLink>
        {primaryCourse ? (
          <NavLink
            to={`/course/${primaryCourse.id}`}
            style={({ isActive }) => ({
              ...linkStyles,
              color: isActive ? '#0f172a' : '#64748b',
              backgroundColor: isActive ? '#e2e8f0' : 'transparent',
              fontWeight: isActive ? 600 : 500
            })}
          >
            {primaryCourse.course_code ?? 'Course'}
          </NavLink>
        ) : null}
      </nav>
      <button
        type="button"
        onClick={toggleChat}
        style={{
          border: '1px solid #cbd5f5',
          backgroundColor: chatOpen ? '#4338ca' : '#ffffff',
          color: chatOpen ? '#e2e8f0' : '#4338ca',
          borderRadius: 999,
          padding: '8px 16px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {chatOpen ? 'Hide Assistant' : 'Open Assistant'}
        {!chatOpen && unreadCount > 0 ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 22,
              padding: '2px 6px',
              borderRadius: 999,
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {unreadCount}
          </span>
        ) : null}
      </button>
    </header>
  );
}

function ContentArea() {
  return (
    <main
      style={{
        padding: '32px 24px',
        maxWidth: 960,
        margin: '0 auto',
        width: '100%'
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/course/:courseId" element={<Course />} />
        <Route path="/assignment/:assignmentId" element={<AssignmentPage />} />
      </Routes>
    </main>
  );
}

export default function App() {
  return (
    <CourseDataProvider>
      <BrowserRouter>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            color: '#0f172a'
          }}
        >
          <TopBar />
          <ContentArea />
        </div>
      </BrowserRouter>
    </CourseDataProvider>
  );
}
