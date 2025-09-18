import { Link, useParams } from 'react-router-dom';
import { getClassById } from '../data/classes';

type Params = {
  classId?: string;
};

export default function ClassPage() {
  const { classId } = useParams<Params>();
  const classData = getClassById(classId);

  if (!classData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Class</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          We couldn&apos;t find a class with ID <strong>{classId ?? 'unknown'}</strong>.
        </p>
        <p style={{ margin: 0, color: '#94a3b8' }}>
          Try selecting a class from the navigation to explore its assignments.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0 }}>{classData.label}</h1>
        <p style={{ margin: '8px 0 0', color: '#475569' }}>
          Binder preview uses color accents to distinguish classes. Assignments inherit the same tone
          for quick recognition.
        </p>
      </div>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: '16px 0 0', fontSize: 18 }}>Assignments</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {classData.assignments.map((assignment) => (
            <li key={assignment.id} style={{
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '12px 16px',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>{assignment.label}</span>
                <Link
                  to={`/class/${classData.id}/assignment/${assignment.id}`}
                  style={{ color: '#4338ca', fontWeight: 500 }}
                >
                  Open binder assignment view
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
