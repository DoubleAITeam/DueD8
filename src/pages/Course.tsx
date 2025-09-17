import { useParams } from 'react-router-dom';

type CourseRouteParams = {
  id?: string;
};

export default function Course() {
  const { id } = useParams<CourseRouteParams>();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Course</h1>
      <p style={{ margin: 0, color: '#475569' }}>
        Viewing placeholder content for course <strong>{id ?? 'unknown'}</strong>.
      </p>
      <p style={{ margin: 0, color: '#94a3b8' }}>
        The course experience will grow with module outlines, files, and AI assistance in upcoming tasks.
      </p>
    </div>
  );
}
