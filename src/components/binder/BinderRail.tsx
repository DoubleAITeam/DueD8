import React from 'react';
import { BinderNode } from '../../types/binder';

type Props = {
  nodes: BinderNode[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  compact?: boolean;
  onOverflowScroll?: (direction: 'left' | 'right') => void;
};

export function BinderRail({ nodes, activeId, onActivate, onClose, onOverflowScroll }: Props) {
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = React.useState(() =>
    Math.max(0, nodes.findIndex((node) => node.id === activeId))
  );
  const lastScrollLeft = React.useRef(0);
  const lastDirection = React.useRef<'left' | 'right' | null>(null);

  React.useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, nodes.length);
  }, [nodes.length]);

  React.useEffect(() => {
    const activeIndex = nodes.findIndex((node) => node.id === activeId);
    if (activeIndex !== -1) {
      setFocusIndex(activeIndex);
    }
  }, [nodes, activeId]);

  React.useEffect(() => {
    const target = buttonRefs.current[focusIndex];
    if (target) {
      target.focus();
    }
  }, [focusIndex]);

  const moveFocus = React.useCallback(
    (direction: 1 | -1) => {
      if (nodes.length === 0) {
        return;
      }
      setFocusIndex((current) => {
        const next = (current + direction + nodes.length) % nodes.length;
        return next;
      });
    },
    [nodes.length]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number, node: BinderNode) => {
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveFocus(-1);
          break;
        case 'Enter':
        case ' ': {
          event.preventDefault();
          onActivate(node.id);
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (node.type !== 'main') {
            event.preventDefault();
            onClose(node.id);
          }
          break;
        }
        default:
          break;
      }
    },
    [moveFocus, onActivate, onClose]
  );

  const handleScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!onOverflowScroll) {
        return;
      }
      const nextLeft = event.currentTarget.scrollLeft;
      const prevLeft = lastScrollLeft.current;
      if (nextLeft === prevLeft) {
        return;
      }

      const direction: 'left' | 'right' = nextLeft > prevLeft ? 'right' : 'left';
      lastScrollLeft.current = nextLeft;
      if (direction !== lastDirection.current) {
        lastDirection.current = direction;
        onOverflowScroll(direction);
      }
    },
    [onOverflowScroll]
  );

  return (
    <div className="binder-rail-wrapper">
      <nav
        className="binder-rail"
        aria-label="Binder pathway"
        role="tablist"
        aria-orientation="horizontal"
        onScroll={handleScroll}
        data-compact={compact ? 'true' : 'false'}
      >
        {nodes.map((node, index) => {
          const isActive = node.id === activeId;
          const tabIndex = index === focusIndex ? 0 : -1;

          return (
            <button
              key={node.id}
              ref={(element) => {
                buttonRefs.current[index] = element;
              }}
              type="button"
              className={`binder-tab${isActive ? ' binder-tab--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-selected={isActive}
              aria-label={node.label}
              role="tab"
              tabIndex={tabIndex}
              onClick={() => onActivate(node.id)}
              onKeyDown={(event) => handleKeyDown(event, index, node)}
              onFocus={() => setFocusIndex(index)}
              title={node.label}
            >
              <span
                className="binder-tab__spine"
                style={{ background: node.color ?? 'var(--gray-300)' }}
                aria-hidden="true"
              />
              <span className="binder-tab__label">{node.label}</span>
              {node.type !== 'main' ? (
                <span
                  className="binder-tab__close"
                  role="button"
                  tabIndex={-1}
                  aria-label={`Close ${node.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(node.id);
                  }}
                >
                  ×
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
