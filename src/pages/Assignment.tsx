import { useParams } from 'react-router-dom';
import { getAssignmentById, getClassById } from '../data/classes';

type Params = {
  classId?: string;
  assignmentId?: string;
};

export default function AssignmentPage() {
  const { classId, assignmentId } = useParams<Params>();
  const classData = getClassById(classId);
  const assignment = getAssignmentById(classId, assignmentId);

  if (!classData || !assignment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Assignment</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          The requested assignment isn&apos;t available. Choose another assignment from the class list.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#64748b' }}>{classData.label}</span>
        <h1 style={{ margin: 0 }}>{assignment.label}</h1>
      </header>
      <p style={{ margin: 0, color: '#475569' }}>
        This is placeholder content for <strong>{assignment.label}</strong>. The binder navigation keeps the
        path visible above, and future iterations will bring in Canvas and AI assistance.
      </p>
      <div
        style={{
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          padding: '24px 20px',
          background: '#f8fafc'
        }}
      >
        <p style={{ margin: 0, color: '#1e293b', fontWeight: 500 }}>Assignment snapshot</p>
        <p style={{ margin: '8px 0 0', color: '#475569' }}>
          Due dates, rubric, and AI-generated study helpers will populate this area as the DueD8 preview
          continues.
        </p>
      </div>
    </div>
  );
}
