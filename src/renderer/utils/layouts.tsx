// Layout utility components for reducing component code duplication
import React from 'react';
import { SPACING } from './constants';

interface FlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  gap?: keyof typeof SPACING;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = 'row',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  style = {}
}) => (
  <div
    className={className}
    style={{
      display: 'flex',
      flexDirection: direction,
      gap: SPACING[gap],
      alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : align,
      justifyContent: justify === 'start' ? 'flex-start' : 
                     justify === 'end' ? 'flex-end' :
                     justify === 'between' ? 'space-between' :
                     justify === 'around' ? 'space-around' :
                     justify === 'evenly' ? 'space-evenly' : justify,
      flexWrap: wrap ? 'wrap' : 'nowrap',
      ...style
    }}
  >
    {children}
  </div>
);

interface GridProps {
  children: React.ReactNode;
  columns?: number | string;
  gap?: keyof typeof SPACING;
  className?: string;
  style?: React.CSSProperties;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 'auto-fit',
  gap = 'md',
  className = '',
  style = {}
}) => (
  <div
    className={className}
    style={{
      display: 'grid',
      gridTemplateColumns: typeof columns === 'number' 
        ? `repeat(${columns}, 1fr)` 
        : `repeat(${columns}, minmax(200px, 1fr))`,
      gap: SPACING[gap],
      ...style
    }}
  >
    {children}
  </div>
);

interface CardProps {
  children: React.ReactNode;
  padding?: keyof typeof SPACING;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'lg',
  className = '',
  style = {},
  interactive = false,
  onClick
}) => (
  <div
    className={`${className} ${interactive ? 'interactive' : ''}`}
    style={{
      padding: SPACING[padding],
      borderRadius: '12px',
      border: '1px solid var(--surface-border)',
      backgroundColor: 'var(--surface-card)',
      cursor: interactive ? 'pointer' : 'default',
      ...style
    }}
    onClick={onClick}
  >
    {children}
  </div>
);