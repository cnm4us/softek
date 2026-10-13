import type { ReactNode } from 'react';
export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface card ${className}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Alert({ message }: { message: string }) {
  return message ? (
    <p className="alert" role="alert">
      {message}
    </p>
  ) : null;
}
export function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="feature-title">{title}</h2>
      {children && <p className="lead">{children}</p>}
    </div>
  );
}

export function BannerPlaceholder() {
  return (
    <section
      className="surface banner-placeholder"
      aria-label="Banner placeholder"
      data-testid="banner-placeholder"
    >
      <span>More ways to bank</span>
    </section>
  );
}
