import React, { useState } from 'react';
import {
  AlertCircleIcon,
  BarChartIcon,
  BookOpenIcon,
  BrainCircuitIcon,
  BrainIcon,
  CalendarIcon,
  GradesIcon,
  PencilIcon,
  LightningBoltIcon,
  SparklesIcon,
  Wand2Icon,
  NotebookIcon
} from '../icons';
import { Link, useNavigate } from '../../routes/router';
import { calculateProgressPercent } from '../../utils/progress';
import { useAiTokenStore } from '../../state/dashboard';
import ProgressBar from '../ui/ProgressBar';
import dued8Logo from '../../../assets/dued8-logos/dued8-purple-logo.png';

const classesIcon = BookOpenIcon;

const primaryNav = [
  { label: 'Dashboard', path: '/dashboard', icon: SparklesIcon },
  { label: 'Assignments', path: '/assignments', icon: AlertCircleIcon },
  { label: 'Classes', path: '/classes', icon: classesIcon },
  { label: 'Grades', path: '/grades', icon: GradesIcon },
  { label: 'Calendar / Events', path: '/calendar', icon: CalendarIcon },
  { label: 'Analytics', path: '/analytics', icon: BarChartIcon }
];

const studyTools = [
  { label: 'Chatbot', path: '/chatbot', icon: BrainCircuitIcon },
  { label: 'AI Writer', path: '/study-tools/ai-writer', icon: Wand2Icon },
  { label: 'AI Notes', path: '/study-tools/notes', icon: NotebookIcon },
  { label: 'Flashcards', path: '/study-tools/flashcards', icon: BookOpenIcon },
  { label: 'Quiz Generator', path: '/study-tools/quiz-generator', icon: PencilIcon }
];

const secondaryNav: Array<{ label: string; path: string; icon: typeof BrainIcon }> = [];

type SidebarProps = {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
};

function isActivePath(currentPath: string, targetPath: string) {
  const normalisedCurrent = currentPath.toLowerCase();
  const normalisedTarget = targetPath.toLowerCase();
  if (normalisedTarget === '/') {
    return normalisedCurrent === '/';
  }
  if (normalisedTarget === '/dashboard') {
    return (
      normalisedCurrent === '/' ||
      normalisedCurrent === '/dashboard' ||
      normalisedCurrent.startsWith('/dashboard/')
    );
  }
  return normalisedCurrent === normalisedTarget || normalisedCurrent.startsWith(`${normalisedTarget}/`);
}

export default function Sidebar({ currentPath, isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const aiTokens = useAiTokenStore();
  const percent = calculateProgressPercent(aiTokens.used, aiTokens.limit);
  const nearingLimit = percent >= 80;
  const [studyOpen, setStudyOpen] = useState(true);

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} aria-label="Main navigation">
        <div className="sidebar__inner">
          <div className="sidebar__brand">
            <img className="sidebar__logo" src={dued8Logo} alt="DueD8" />
            <span className="sidebar__title">DueD8</span>
          </div>
          <div className="sidebar__sections">
            <div className="sidebar__section" role="navigation">
              {primaryNav.map((item) => {
                const ItemIcon = item.icon;
                const active = isActivePath(currentPath, item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
                    onClick={onClose}
                  >
                    <ItemIcon className="sidebar__icon" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="sidebar__section">
              <button
                type="button"
                className="sidebar__section-toggle"
                aria-expanded={studyOpen}
                onClick={() => setStudyOpen((value) => !value)}
              >
                <span>Study Tools</span>
                <span
                  className={`sidebar__section-arrow ${studyOpen ? '' : 'sidebar__section-arrow--collapsed'}`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              <div className={`sidebar__submenu ${studyOpen ? '' : 'sidebar__submenu--collapsed'}`}>
                {studyTools.map((tool) => {
                  const ToolIcon = tool.icon;
                  const active = isActivePath(currentPath, tool.path);
                  return (
                    <Link
                      key={tool.path}
                      to={tool.path}
                      className={`sidebar__sublink ${active ? 'sidebar__sublink--active' : ''}`}
                      onClick={onClose}
                    >
                      <ToolIcon className="sidebar__icon" />
                      <span>{tool.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {secondaryNav.length > 0 ? (
              <div className="sidebar__section" role="navigation">
                {secondaryNav.map((item) => {
                  const ItemIcon = item.icon;
                  const active = isActivePath(currentPath, item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`sidebar__link ${active ? 'sidebar__link--active' : ''}`}
                      onClick={onClose}
                    >
                      <ItemIcon className="sidebar__icon" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="sidebar__footer">
            <div className={`token-card ${nearingLimit ? 'token-card--warning' : ''}`}>
              <div className="token-card__header">
                <LightningBoltIcon className="token-card__icon" />
                <div>
                  <p className="token-card__title">Token Usage</p>
                  <p className="token-card__subtitle">
                    {aiTokens.used.toLocaleString()} / {aiTokens.limit.toLocaleString()} tokens
                  </p>
                </div>
              </div>
              <ProgressBar value={percent} color={nearingLimit ? 'warning' : 'primary'} />
              <button
                type="button"
                className="token-card__button"
                onClick={() => {
                  onClose();
                  navigate('/pricing');
                }}
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      </aside>
      {isOpen ? <button type="button" className="sidebar__overlay" aria-label="Close navigation" onClick={onClose} /> : null}
    </>
  );
}
