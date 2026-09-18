/**
 * Government branding components — national emblem, ministry header, footer,
 * and unified accessible SVG icon library.
 *
 * Provides the official identity layer for the SIH26094 prototype.
 * All text is factual and adheres to institutional public-sector standards.
 */
import { useI18n } from './i18n.jsx';

/**
 * Ashoka Chakra — simplified SVG representation.
 * Used in the nav and login page as the national identity mark.
 */
export function AshokaChakra({ size = 32, color = 'currentColor', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ashoka Chakra"
      role="img"
    >
      <circle cx="50" cy="50" r="46" stroke={color} strokeWidth="3" fill="none" />
      <circle cx="50" cy="50" r="12" fill={color} />
      {Array.from({ length: 24 }, (_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        const x1 = 50 + 14 * Math.cos(angle);
        const y1 = 50 + 14 * Math.sin(angle);
        const x2 = 50 + 44 * Math.cos(angle);
        const y2 = 50 + 44 * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

/**
 * Government header bar — Sahara trust strip.
 * Displays confidentiality assurance and counsellor availability.
 */
export function GovernmentHeader() {
  const { locale, setLocale } = useI18n();
  return (
    <header className="gov-header" role="banner">
      <div className="gov-header-inner">
        <div className="gov-header-left">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2.2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="gov-header-portal">
            {locale === 'hi'
              ? 'पूर्णतः गोपनीय व सुरक्षित संबल मंच · राष्ट्रीय अनुसूचित जाति/जनजाति सुरक्षा ढाँचा'
              : 'All communications are confidential & human-reviewed · SC/ST (PoA) Act, 1989 Framework'}
          </span>
        </div>
        <div className="gov-header-right">
          <button
            className="gov-header-lang"
            onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
            aria-label={locale === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
          >
            {locale === 'en' ? 'हिंदी' : 'English'}
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Government footer — shown at the bottom of every page.
 * Standard government portal footer with disclaimer and links.
 */
export function GovernmentFooter() {
  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="gov-footer-inner">
        <div className="gov-footer-left">
          <div className="gov-footer-text">
            <span><strong>सहारा (Sahara)</strong> — Decision-support & dynamic well-being triage platform · Smart India Hackathon 2026.</span>
            <span className="gov-footer-sub">
              Statutory support coordination under the SC/ST (Prevention of Atrocities) Act, 1989.
              Dedicated National Helplines: <strong style={{ color: 'var(--accent)' }}>14566</strong> (Toll-free) | Tele-MANAS: <strong style={{ color: 'var(--accent)' }}>14416</strong> | Emergency: <strong style={{ color: 'var(--risk-high)' }}>112</strong>
            </span>
          </div>
        </div>
        <div className="gov-footer-right">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)', display: 'inline-block' }} />
            सत्यापित डेटा एन्क्रिप्शन (Encrypted local session active)
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Institutional SVG icons — replacing emoji with accessible line-art style.
 */

export function IconCase({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function IconAlert({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconChart({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function IconChat({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconShield({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconUser({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconSearch({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconClock({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function IconCheck({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconCheckCircle({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 10 11 15 8 12" />
    </svg>
  );
}

export function IconFile({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export function IconPhone({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function IconArrowLeft({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconLock({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
