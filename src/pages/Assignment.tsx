import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourseData } from '../App';
import { rendererLog } from '../lib/logger';

type AssignmentRouteParams = {
  assignmentId?: string;
};

function formatDueDate(dueAt: string | null | undefined) {
  if (!dueAt) return 'No due date';
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AssignmentPage() {
  const { assignmentId } = useParams<AssignmentRouteParams>();
  const navigate = useNavigate();
  const { assignmentIndex, ensureAssignment, courses } = useCourseData();

  const numericId = assignmentId ? Number(assignmentId) : NaN;
  const assignment = React.useMemo(() => {
    if (!assignmentId) return undefined;
    const parsed = Number(assignmentId);
    if (Number.isNaN(parsed)) return undefined;
    return assignmentIndex[parsed];
  }, [assignmentId, assignmentIndex]);

  const course = React.useMemo(() => {
    if (!assignment) return undefined;
    return courses.find((item) => item.id === assignment.course_id);
  }, [assignment, courses]);

  const [hasRequested, setHasRequested] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [hasLoggedNav, setHasLoggedNav] = React.useState(false);
  const [dropAcknowledgement, setDropAcknowledgement] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);

  React.useEffect(() => {
    setHasLoggedNav(false);
    setDropAcknowledgement(null);
    setIsDragOver(false);
    setHasRequested(false);
    setLoading(false);
  }, [assignmentId]);

  React.useEffect(() => {
    if (!assignmentId || Number.isNaN(numericId)) return;

    if (assignment && !hasLoggedNav) {
      rendererLog('nav:assignment_open', {
        assignmentId: assignment.id,
        courseId: assignment.course_id
      });
      setHasLoggedNav(true);
      return;
    }

    if (assignment || hasRequested) {
      return;
    }

    let active = true;
    setHasRequested(true);
    setLoading(true);
    ensureAssignment(numericId).finally(() => {
      if (!active) return;
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [assignment, assignmentId, ensureAssignment, hasLoggedNav, hasRequested, numericId]);

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      const [file] = Array.from(event.dataTransfer.files ?? []);
      if (file) {
        setDropAcknowledgement(`Ready to use ${file.name}`);
        rendererLog('assignment:file_drop', {
          assignmentId: assignment?.id ?? numericId,
          fileName: file.name
        });
      } else {
        setDropAcknowledgement('Drop detected, but no file was provided.');
      }
    },
    [assignment?.id, numericId]
  );

  const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleSolve = React.useCallback(() => {
    if (!assignment) return;
    rendererLog('assignment:solve_click', { assignmentId: assignment.id });
  }, [assignment]);

  const handleAnalyze = React.useCallback(() => {
    if (!assignment) return;
    rendererLog('assignment:analyze_click', { assignmentId: assignment.id });
  }, [assignment]);

  const backDestination = React.useMemo(() => {
    if (assignment) {
      return `/course/${assignment.course_id}`;
    }
    if (!Number.isNaN(numericId)) {
      return '/';
    }
    return '/';
  }, [assignment, numericId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button
        type="button"
        onClick={() => navigate(backDestination)}
        style={{
          alignSelf: 'flex-start',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '6px 12px',
          background: '#ffffff',
          cursor: 'pointer'
        }}
      >
        ← Back
      </button>

      {assignment ? (
        <>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ margin: 0 }}>{assignment.name}</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#475569' }}>
              <span>{course ? course.name : 'Course overview'}</span>
              <span>Due {formatDueDate(assignment.due_at)}</span>
              <span>Status: {assignment.status ?? 'Open'}</span>
            </div>
          </header>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Attachments</h2>
            <p style={{ margin: 0, color: '#64748b' }}>Attachments will appear here when available.</p>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Upload work</h2>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                border: '2px dashed #cbd5f5',
                borderRadius: 16,
                padding: '32px',
                textAlign: 'center',
                background: isDragOver ? '#eef2ff' : '#f8fafc',
                color: '#475569',
                transition: 'background 0.2s ease-in-out'
              }}
            >
              {dropAcknowledgement ? (
                <strong>{dropAcknowledgement}</strong>
              ) : (
                <span>Drag and drop files here to stage them for solving.</span>
              )}
            </div>
          </section>

          <section style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={handleSolve}
              style={{
                border: '1px solid #4338ca',
                background: '#4338ca',
                color: '#f8fafc',
                padding: '10px 16px',
                borderRadius: 10,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Solve
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              style={{
                border: '1px solid #4338ca',
                background: '#ffffff',
                color: '#4338ca',
                padding: '10px 16px',
                borderRadius: 10,
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Analyze
            </button>
          </section>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0 }}>Assignment {Number.isNaN(numericId) ? '' : `#${numericId}`} not found</h1>
          <p style={{ margin: 0, color: '#64748b' }}>
            {loading
              ? 'Loading assignment details...'
              : 'We could not locate this assignment. Try returning to your course to pick another one.'}
          </p>
        </div>
      )}
    </div>
  );
}
