/**
 * TheReach — Signature Hero Experience of Sahara.
 *
 * Implements Section 7, 18, 19:
 * "Support starts with reaching out."
 * "A quiet digital layer that helps notice changing well-being, connect people with human support, and carry that support through the journey."
 *
 * Generous breathing room, dignified presence, calm before reading.
 */

import SaharaHandsScene from './SaharaHandsScene.jsx';
import { IconPhone, IconShield, IconLock } from './GovernmentBranding.jsx';
import { useI18n } from './i18n.jsx';

export default function TheReach({ onBeginSecureCheckin, onOpenStaffLogin, onExploreHowItWorks }) {
  const { locale, t } = useI18n();

  return (
    <section className="reach-hero-section animate-in" aria-label="Sahara — The Reach">
      {/* 24/7 National Emergency Trust Ribbon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.65rem 1.15rem',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--line-faint)',
        boxShadow: 'var(--shadow-subtle)',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--accent-pale)',
            color: 'var(--accent)',
          }}>
            <IconLock size={13} color="var(--accent)" />
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', fontWeight: 600 }}>
            {locale === 'hi'
              ? 'राष्ट्रीय संबल मंच · पूर्णतः निःशुल्क, सुरक्षित एवं गोपनीय'
              : 'National Well-being Platform · Free, Confidential & Protected under SC/ST Act'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            <span>Tele-MANAS: <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>14416</strong></span>
            <span style={{ margin: '0 0.45rem' }}>·</span>
            <span>Helpline: <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>14566</strong></span>
          </div>
          <a
            href="tel:14416"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
          >
            <IconPhone size={12} /> {locale === 'hi' ? 'तुरंत कॉल करें' : 'Call 14416'}
          </a>
        </div>
      </div>

      {/* Main Narrative Hero Block */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '2.5rem',
        alignItems: 'center',
        marginBottom: '3rem',
      }}>
        {/* Left Column: Calm Editorial Narrative */}
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.3rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--secondary-container)',
            color: 'var(--secondary)',
            fontSize: '0.78rem',
            fontWeight: 700,
            marginBottom: '1rem',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary)' }} />
            <span>{locale === 'hi' ? 'मानवीय सहायता का शांत संबल' : 'Human Support When It Matters'}</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.15,
            margin: '0 0 1rem',
            letterSpacing: '-0.02em',
          }}>
            {locale === 'hi' ? (
              <>संबल की शुरुआत <span style={{ color: 'var(--accent)' }}>हाथ बढ़ाने</span> से होती है।</>
            ) : (
              <>Support starts with <span style={{ color: 'var(--accent)' }}>reaching out</span>.</>
            )}
          </h1>

          <p style={{
            fontSize: '1.05rem',
            color: 'var(--ink-soft)',
            lineHeight: 1.65,
            margin: '0 0 1.75rem',
            maxWidth: '34rem',
          }}>
            {locale === 'hi'
              ? 'एक शांत डिजिटल संबल जो बदलते मानसिक कल्याण को समझता है, लोगों को मानवीय सहायता से जोड़ता है, और पूरी कानूनी प्रक्रिया में उनके साथ चलता है।'
              : 'A quiet digital layer that helps notice changing well-being, connect people with human support, and carry that support through the journey.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                id="cta-begin-secure-checkin"
                onClick={onBeginSecureCheckin}
                className="btn btn-primary-lg"
                style={{ fontWeight: 700, gap: '0.65rem' }}
              >
                <IconShield size={18} />
                <span>{t('sahara.beginSecureCheckin')}</span>
              </button>

              <button
                onClick={onExploreHowItWorks}
                className="btn btn-secondary btn-primary-lg"
                style={{ fontWeight: 600 }}
              >
                <span>{locale === 'hi' ? 'सहारा कैसे कार्य करता है' : 'How Sahara Works'}</span>
              </button>
            </div>

            {/* Subtle trust statement directly beneath canonical CTA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.78rem',
                color: 'var(--ink-muted)',
                lineHeight: 1.4,
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: 'var(--accent-pale, #F9ECE8)',
                }}>
                  {t('sahara.privateCaseAccess')}
                </span>
                <span>{t('sahara.privateCaseAccessDesc')}</span>
              </div>
            </div>

            {/* Discreet Staff Entry Link */}
            <div style={{ marginTop: '0.25rem' }}>
              <button
                id="link-staff-signin"
                onClick={onOpenStaffLogin}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.25rem 0',
                  color: 'var(--ink-muted)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                <IconLock size={13} color="var(--ink-muted)" />
                <span>{t('sahara.staffSignIn')}</span>
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint, #999)', textDecoration: 'none' }}>
                  ({locale === 'hi' ? 'परामर्शदाता एवं प्रशासक' : 'Counsellors, Welfare Officers, Administrators'})
                </span>
              </button>
            </div>
          </div>

          {/* Quick Pillar assurances */}
          <div style={{
            display: 'flex',
            gap: '1.25rem',
            marginTop: '2rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--line-faint)',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              ✓ <strong>{locale === 'hi' ? 'मानवीय समीक्षा' : 'Human Review'}</strong> ({locale === 'hi' ? 'निर्णय केवल मनुष्य लेते हैं' : 'People decide next steps'})
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              ✓ <strong>{locale === 'hi' ? 'पूर्णतः स्वैच्छिक' : 'Voluntary'}</strong> ({locale === 'hi' ? 'आपकी गति, आपकी सहमति' : 'Your pace, your control'})
            </div>
          </div>
        </div>

        {/* Right Column: The Signature 3D Sculpted Composition */}
        <div>
          <SaharaHandsScene />
        </div>
      </div>
    </section>
  );
}
