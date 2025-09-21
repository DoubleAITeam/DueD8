import React, { useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import AssignmentsList from '../components/AssignmentsList';
import {
  useDashboardData,
  useRawCourses,
  useUpcomingAssignments,
  usePastAssignments
} from '../state/dashboard';
import { useStore } from '../state/store';
import { useNavigate } from '../routes/router';
import type { Assignment } from '../../lib/canvasClient';

function groupAssignments(assignments: Assignment[], courseId: number | 'all') {
  if (courseId === 'all') return assignments;
  return assignments.filter((assignment) => assignment.course_id === courseId);
}

export default function AssignmentsPage() {
  const { status } = useDashboardData();
  const rawCourses = useRawCourses();
  const upcomingAssignments = useUpcomingAssignments();
  const pastAssignments = usePastAssignments();
  const setView = useStore((state) => state.setView);
  const navigate = useNavigate();

  const [filterCourse, setFilterCourse] = useState<'all' | number>('all');

  const courseLookup = useMemo(
    () =>
      rawCourses.reduce<Record<number, string>>((acc, course) => {
        acc[course.id] = course.course_code || course.name;
        return acc;
      }, {}),
    [rawCourses]
  );

  const filteredUpcoming = useMemo(
    () => groupAssignments(upcomingAssignments, filterCourse),
    [upcomingAssignments, filterCourse]
  );

  const filteredPast = useMemo(
    () => groupAssignments(pastAssignments, filterCourse),
    [pastAssignments, filterCourse]
  );

  const loadingUpcoming = status === 'loading' && upcomingAssignments.length === 0;
  const loadingPast = status === 'loading' && pastAssignments.length === 0;

  const totalUpcoming = filteredUpcoming.length;
  const totalPast = filteredPast.length;

  function handleAssignmentSelect(assignment: Assignment) {
    setView({
      screen: 'assignment',
      courseId: assignment.course_id,
      assignmentId: assignment.id
    });
    navigate('/workspace/assignment');
  }

  return (
    <AppShell pageTitle="Assignments">
      <div className="page-stack">
        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <h3>Overview</h3>
          </div>
          <div className="assignments-overview">
            <div className="assignments-overview__metric">
              <span className="assignments-overview__label">Upcoming</span>
              <strong className="assignments-overview__value">{totalUpcoming}</strong>
            </div>
            <div className="assignments-overview__metric">
              <span className="assignments-overview__label">Completed / Past</span>
              <strong className="assignments-overview__value">{totalPast}</strong>
            </div>
            <label className="assignments-overview__filter">
              <span>Filter by course</span>
              <select
                value={filterCourse}
                onChange={(event) =>
                  setFilterCourse(
                    event.target.value === 'all' ? 'all' : Number(event.target.value)
                  )
                }
              >
                <option value="all">All courses</option>
                {rawCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code || course.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <h3>Upcoming assignments</h3>
          </div>
          <AssignmentsList
            assignments={filteredUpcoming}
            courseLookup={courseLookup}
            loading={loadingUpcoming}
            emptyMessage={status === 'loading' ? 'Loading assignments…' : 'No assignments due soon.'}
            onSelect={handleAssignmentSelect}
          />
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card__header">
            <h3>Past assignments</h3>
          </div>
          <AssignmentsList
            assignments={filteredPast}
            courseLookup={courseLookup}
            loading={loadingPast}
            emptyMessage={status === 'loading' ? 'Loading assignments…' : 'No past assignments available.'}
            onSelect={handleAssignmentSelect}
          />
        </section>
      </div>
    </AppShell>
  );
}
