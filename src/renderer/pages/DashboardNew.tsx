import React, { useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import QuickAction from '../components/ui/QuickAction';
import CourseProgressItem from '../components/ui/CourseProgressItem';
import MiniCalendar from '../components/ui/MiniCalendar';
import DeadlinesList from '../components/ui/DeadlinesList';
import { useCourses, useDeadlines, useRecentlyLaunched, useUser } from '../state/dashboard';
import { SparklesIcon, Wand2Icon, BookOpenIcon } from '../components/icons';
import { useNavigate } from '../routes/router';
import { filterDeadlinesByDate } from '../utils/deadlines.js';
import { expectedDashboardLayout } from '../utils/dashboardLayout.js';

const heroChips = ['Generate Guide', 'Find Assignments', 'Study Flashcards'];

const quickActions = [
  {
    title: 'Generate Summary',
    description: 'Create class recaps instantly',
    path: '/study-tools/ai-writer',
    icon: SparklesIcon
  },
  {
    title: 'Study Guide',
    description: 'Build personalised outlines',
    path: '/study-tools/study-coach',
    icon: Wand2Icon
  },
  {
    title: 'Practice Quiz',
    description: 'Check your understanding',
    path: '/study-tools/quiz-generator',
    icon: BookOpenIcon
  }
];

const deadlineRoutes = {
  submit: '/assignments/submit',
  view: '/assignments',
  study: '/study-tools/study-coach'
} as const;

export default function DashboardNew() {
  const { name } = useUser();
  const courses = useCourses();
  const deadlines = useDeadlines();
  const recentlyLaunched = useRecentlyLaunched();
  const [prompt, setPrompt] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const navigate = useNavigate();

  const filteredDeadlines = useMemo(
    () => filterDeadlinesByDate(deadlines, selectedDate),
    [deadlines, selectedDate]
  );

  function submitPrompt(event: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    navigate(`/study-tools/study-coach?q=${encodeURIComponent(trimmed)}`);
  }

  const layout = expectedDashboardLayout();

  return (
    <AppShell>
      <div className="dashboard-grid" data-layout={JSON.stringify(layout.rows)}>
        <section className="dashboard-card dashboard-card--hero" data-area="hero">
          <p className="dashboard-card__eyebrow">Study Hub</p>
          <h2 className="dashboard-card__title">Hey {name}, how can I help you study today?</h2>
          <form className="dashboard-card__form" onSubmit={submitPrompt}>
            <input
              className="dashboard-card__input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Generate a study guide for my biology midterm..."
              aria-label="Describe what you need help with"
            />
            <button type="submit" className="dashboard-card__button">
              Ask Study Coach
            </button>
          </form>
          <div className="dashboard-card__chips" role="group" aria-label="Quick prompt suggestions">
            {heroChips.map((chip) => (
              <button
                type="button"
                key={chip}
                className="dashboard-chip"
                onClick={() => setPrompt(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>
        <section className="dashboard-card dashboard-card--actions" data-area="quick-actions">
          <div className="dashboard-card__header">
            <h3>AI Quick Actions</h3>
          </div>
          <div className="dashboard-card__actions">
            {quickActions.map((action) => (
              <QuickAction
                key={action.title}
                icon={action.icon}
                title={action.title}
                description={action.description}
                onClick={() => navigate(action.path)}
              />
            ))}
          </div>
        </section>
        <section className="dashboard-card" data-area="progress">
          <div className="dashboard-card__header">
            <h3>Course &amp; Assignment Progress</h3>
          </div>
          <div className="dashboard-card__list">
            {courses.map((course) => (
              <CourseProgressItem
                key={course.id}
                course={course}
                onClick={() => navigate(`/classes?course=${course.id}`)}
              />
            ))}
          </div>
        </section>
        <section className="dashboard-card dashboard-card--schedule" data-area="schedule">
          <div className="dashboard-card__header">
            <h3>Learning Schedule</h3>
          </div>
          <MiniCalendar selected={selectedDate} onSelect={setSelectedDate} />
          <DeadlinesList
            deadlines={filteredDeadlines}
            selectedDate={selectedDate}
            onClear={() => setSelectedDate(null)}
            onAction={(deadline) => {
              const target = deadlineRoutes[deadline.action?.intent ?? 'view'];
              navigate(target);
            }}
          />
        </section>
        <section className="dashboard-card dashboard-card--recent" data-area="recent">
          <div className="dashboard-card__header">
            <h3>Recently Launched</h3>
            <button type="button" className="dashboard-card__link" onClick={() => navigate('/study-tools')}>
              View all
            </button>
          </div>
          <div className="dashboard-card__recent-grid">
            {recentlyLaunched.map((item) => (
              <article key={item.id} className="dashboard-card__recent-item">
                <h4>{item.title}</h4>
                <p>{new Date(item.launchedAtIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
