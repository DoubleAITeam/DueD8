import { Link } from 'react-router-dom';

export type Crumb = { id: string; label: string; href: string; current?: boolean };

export type BreadcrumbProps = { items: Crumb[] };

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const content = isLast ? (
          <span key={item.id} aria-current="page">
            {item.label}
          </span>
        ) : (
          <Link key={item.id} to={item.href} aria-current={item.current ? 'page' : undefined}>
            {item.label}
          </Link>
        );

        if (index === items.length - 1) {
          return content;
        }

        return (
          <span key={`${item.id}-${index}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {content}
            <span className="breadcrumb__separator" aria-hidden="true">
              /
            </span>
          </span>
        );
      })}
    </nav>
  );
}
