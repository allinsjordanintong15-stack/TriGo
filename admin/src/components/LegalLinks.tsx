import { Link } from 'react-router-dom';

/**
 * Footer links to the public Privacy Notice and Terms of Use (/privacy, /terms). On the
 * sidebar they open in a new tab so the admin keeps their place.
 */
export function LegalLinks({ className, newTab = false }: { className?: string; newTab?: boolean }) {
  const target = newTab ? { target: '_blank', rel: 'noopener' } : {};
  return (
    <nav className={`legal-links${className ? ` ${className}` : ''}`} aria-label="Legal">
      <Link to="/privacy" {...target}>
        Privacy Notice
      </Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms" {...target}>
        Terms of Use
      </Link>
    </nav>
  );
}
