import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronRight, Landmark, Menu, X } from 'lucide-react';

export function AppShell({
  title,
  area,
  authenticated,
  sections,
  children,
  actions,
  footer,
  greeting,
  onMenuOpen,
  onSelect,
}: {
  title: string | null;
  area: 'Admin' | 'Customer';
  authenticated: boolean;
  sections: { key: string; label: string; href: string }[];
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  greeting?: string;
  onMenuOpen?: () => void;
  onSelect?: (key: string) => void;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null);
  const returnFocus = useRef(false);
  const close = (restoreFocus = true) => {
    returnFocus.current = restoreFocus;
    setOpen(false);
  };
  useEffect(() => {
    close(false);
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    document.title = `${title ?? 'Sign in'} · Harbor Community Bank`;
  }, [title]);
  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);
  useEffect(() => {
    if (!open) return;
    const controls = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled)',
        ) ?? [],
      );
    controls()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
      if (event.key === 'Tab') {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keys);
      if (returnFocus.current) button.current?.focus();
    };
  }, [open]);
  return (
    <div data-clarity-mask={area === 'Admin' ? 'true' : undefined}>
      <div inert={open}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header
          className={`site-header ${title ? 'section-header' : 'login-header'}`}
        >
          {title ? (
            <div>
              <p className="section-eyebrow">
                HARBOR COMMUNITY BANK{area === 'Admin' && ' · ADMIN'}
              </p>
              <h1>{title}</h1>
            </div>
          ) : (
            <Link
              to="/"
              className="brand"
              aria-label="Harbor Community Bank home"
            >
              <span className="brand-mark">
                <Landmark size={26} />
              </span>
              <span>
                <strong>Harbor</strong>
                <span className="brand-subtitle">COMMUNITY BANK</span>
              </span>
            </Link>
          )}
          {authenticated && (
            <button
              ref={button}
              className="menu-button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="area-menu"
              onClick={() => {
                setOpen(true);
                onMenuOpen?.();
              }}
            >
              <Menu size={24} />
            </button>
          )}
        </header>
        <div className="app-layout">
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
        <footer className="site-footer">
          Harbor Community Bank · Fictional demonstration · No real money moves
          {footer}
        </footer>
      </div>
      {open && (
        <div className="menu-overlay">
          <button
            className="menu-backdrop"
            tabIndex={-1}
            aria-label="Close navigation"
            onClick={() => close()}
          />
          <nav
            ref={panel}
            id="area-menu"
            className="bank-menu"
            role="dialog"
            aria-modal="true"
            aria-label={`${area} Menu`}
          >
            <div className="menu-top">
              <strong>{area} Menu</strong>
              <button
                className="menu-button"
                aria-label="Close menu"
                onClick={() => close()}
              >
                <X size={22} />
              </button>
            </div>
            {greeting && (
              <p className="menu-greeting" data-clarity-mask="true">
                Welcome, {greeting}
              </p>
            )}
            {sections.map((section) => {
              const active =
                location.pathname === section.href ||
                (section.href !== '/' &&
                  location.pathname.startsWith(`${section.href}/`)) ||
                (section.key === 'goals' &&
                  ['/savings-goals', '/enroll'].includes(location.pathname));
              return (
                <Link
                  key={section.key}
                  to={section.href}
                  className={active ? 'active' : ''}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    onSelect?.(section.key);
                    close(false);
                  }}
                >
                  {section.label}
                  <ChevronRight size={16} />
                </Link>
              );
            })}
            <div className="menu-secondary" onClick={() => close()}>
              {actions}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
