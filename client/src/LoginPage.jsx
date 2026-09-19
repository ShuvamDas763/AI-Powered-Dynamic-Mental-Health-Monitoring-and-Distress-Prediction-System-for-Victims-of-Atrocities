/**
 * LoginPage — The Sahara Public & Entry Experience.
 *
 * Implements Sections 18–26 & Creative Quality Gate:
 * Narrative rhythm as ONE continuous editorial story:
 * REACH -> CONTINUITY -> JOURNEY -> SIGNAL -> HUMAN HANDOFF -> HORIZON -> TRUST
 *
 * Art Direction:
 * - Museum-quality editorial public service publication
 * - Visual calmness without emptiness
 * - Institutional credibility without bureaucratic coldness
 * - Humane respect without sentimental clutter
 * - Motion budget: 1-2 elements moving maximum
 * - No repetitive chunky boxed cards: seamless continuous narrative spine
 */

import { useState, useRef, useEffect } from 'react';
import TheReach from './TheReach.jsx';
import {
  GovernmentHeader,
  GovernmentFooter,
  IconLock,
  IconShield,
  IconPhone,
  IconUser,
  IconCase,
  IconClock,
  IconCheck,
  IconAlert,
  IconFile,
} from './GovernmentBranding.jsx';
import { useI18n } from './i18n.jsx';
import DevPersonaSwitcher from './DevPersonaSwitcher.jsx';

const DEMO_ACCOUNTS = [
  { user: 'victim', labelHi: 'शिकायतकर्ता A', labelEn: 'Complainant A', desc: 'Hindi · Investigation · Baseline monitor' },
  { user: 'case-b', labelHi: 'शिकायतकर्ता B', labelEn: 'Complainant B', desc: 'English · Trial · Intimidation risk' },
  { user: 'case-c', labelHi: 'शिकायतकर्ता C', labelEn: 'Complainant C', desc: 'English · Post-compensation · Resolving' },
  { user: 'case-d', labelHi: 'शिकायतकर्ता D', labelEn: 'Complainant D', desc: 'English · Chargesheet · Consent opt-out' },
  { user: 'case-e', labelHi: 'शिकायतकर्ता E', labelEn: 'Complainant E', desc: 'English · Trial pending · Deflection signal' },
  { user: 'case-f', labelHi: 'शिकायतकर्ता F', labelEn: 'Complainant F', desc: 'English · Investigation · Acute crisis trigger' },
  { user: 'case-g', labelHi: 'शिकायतकर्ता G', labelEn: 'Complainant G', desc: 'English · Investigation · Recovery trajectory' },
  { user: 'case-h', labelHi: 'शिकायतकर्ता H', labelEn: 'Complainant H', desc: 'English · Chargesheet · Outreach continuity' },
];

export default function LoginPage({ onSignIn, onDevLogin, busy }) {
  const { locale, t } = useI18n();
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffRole, setStaffRole] = useState('counsellor'); // 'counsellor' | 'admin' | 'custom'
  const [staffUsername, setStaffUsername] = useState('counsellor');
  const [staffPasscode, setStaffPasscode] = useState('demo');
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  // Evaluator Mode: strictly hidden from normal visitors unless explicitly requested
  const [isEvaluatorMode, setIsEvaluatorMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';
    return (
      urlParams.get('eval') === '1' ||
      urlParams.get('demo') === '1' ||
      urlParams.get('evaluator') === 'true' ||
      hash.includes('eval') ||
      hash.includes('demo') ||
      localStorage.getItem('sahara_eval_mode') === 'true'
    );
  });

  const digitRefs = useRef([]);
  const narrativeRef = useRef(null);
  const entryRef = useRef(null);

  function scrollToStory() {
    narrativeRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Keyboard accessibility and focus management for citizen access modal
  useEffect(() => {
    if (showAccessModal) {
      const timer = setTimeout(() => {
        digitRefs.current[0]?.focus();
      }, 150);
      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          setShowAccessModal(false);
          setCodeError('');
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showAccessModal]);

  // Keyboard accessibility for staff modal
  useEffect(() => {
    if (showStaffModal) {
      function handleKeyDown(e) {
        if (e.key === 'Escape') {
          setShowStaffModal(false);
          setStaffError('');
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showStaffModal]);

  function handleDigitChange(index, value) {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...codeDigits];
      next[index] = '';
      setCodeDigits(next);
      setCodeError('');
      return;
    }
    const char = clean.slice(-1);
    const next = [...codeDigits];
    next[index] = char;
    setCodeDigits(next);
    setCodeError('');

    if (index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index, e) {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleAccessSubmit();
    }
  }

  function handleDigitPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setCodeDigits(next);
    setCodeError('');
    const focusIndex = Math.min(pasted.length, 5);
    digitRefs.current[focusIndex]?.focus();
  }

  async function handleAccessSubmit(e) {
    if (e) e.preventDefault();
    const code = codeDigits.join('').trim();
    if (code.length !== 6) {
      setCodeError(locale === 'hi' ? 'कृपया अपना 6-अंकीय एक्सेस कोड दर्ज करें।' : 'Please enter your 6-digit access code.');
      return;
    }
    setCodeLoading(true);
    setCodeError('');
    try {
      const res = await onSignIn({ accessCode: code });
      if (!res?.ok) {
        setCodeError(locale === 'hi' ? 'हम इस एक्सेस कोड को सत्यापित नहीं कर सके।' : "We couldn't verify this access code.");
        digitRefs.current[0]?.focus();
      }
    } catch {
      setCodeError(locale === 'hi' ? 'हम इस एक्सेस कोड को सत्यापित नहीं कर सके।' : "We couldn't verify this access code.");
    } finally {
      setCodeLoading(false);
    }
  }

  function fillDemoCode(code = '741001') {
    const chars = code.split('').slice(0, 6);
    setCodeDigits(chars);
    setCodeError('');
    digitRefs.current[5]?.focus();
  }

  async function handleStaffSubmit(e) {
    e.preventDefault();
    setStaffLoading(true);
    setStaffError('');
    try {
      const res = await onSignIn(staffUsername.trim(), staffPasscode.trim());
      if (!res?.ok) {
        setStaffError(locale === 'hi' ? 'प्रवेश विवरण सत्यापित नहीं हो सके।' : 'Those sign-in details were not recognised.');
      }
    } catch {
      setStaffError(locale === 'hi' ? 'प्रवेश विवरण सत्यापित नहीं हो सके।' : 'Those sign-in details were not recognised.');
    } finally {
      setStaffLoading(false);
    }
  }

  function handleStaffRoleSelect(role) {
    setStaffRole(role);
    setStaffError('');
    if (role === 'counsellor') {
      setStaffUsername('counsellor');
      setStaffPasscode('demo');
    } else if (role === 'admin') {
      setStaffUsername('admin');
      setStaffPasscode('demo');
    } else {
      setStaffUsername('');
      setStaffPasscode('');
    }
  }

  return (
    <div className="app-shell">
      <GovernmentHeader />

      <main className="main-content" style={{ maxWidth: '78rem', padding: '1.75rem 1.5rem 4rem' }}>
        {/* ═══ 1. THE REACH — HERO EXPERIENCE ═════════════════════════════ */}
        <TheReach
          onBeginSecureCheckin={() => {
            setShowAccessModal(true);
            setCodeError('');
          }}
          onOpenStaffLogin={() => {
            setShowStaffModal(true);
            setStaffError('');
          }}
          onExploreHowItWorks={scrollToStory}
        />

        {/* ═══ ONE CONTINUOUS EDITORIAL NARRATIVE STORY ════════════════════ */}
        <section
          ref={narrativeRef}
          aria-label="How Sahara Carries Support"
          style={{
            marginTop: '4.5rem',
            marginBottom: '4.5rem',
            position: 'relative',
          }}
        >
          {/* Subtle connecting vertical guide thread behind story */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '4rem',
              bottom: '4rem',
              width: '1px',
              background: 'linear-gradient(to bottom, transparent, var(--line-strong, #E2DAD0) 10%, var(--line-strong, #E2DAD0) 90%, transparent)',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              opacity: 0.6,
            }}
          />

          {/* Section Narrative Header */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem', position: 'relative', zIndex: 1 }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--accent, #8B321D)',
                display: 'inline-block',
                padding: '0.2rem 0.6rem',
                background: 'var(--accent-pale, #F9ECE8)',
                borderRadius: 'var(--radius-full)',
                marginBottom: '0.65rem',
              }}
            >
              {locale === 'hi' ? 'अखंड संबल की रूपरेखा' : 'A Continuous Story of Care'}
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.75rem, 3.2vw, 2.4rem)',
                color: 'var(--ink, #1F1B18)',
                margin: '0 0 0.5rem',
                lineHeight: 1.2,
              }}
            >
              {locale === 'hi' ? 'संबल केवल एक क्षण नहीं, एक सतत यात्रा है।' : 'Support is not a moment. It is an ongoing journey.'}
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--ink-muted)', maxWidth: '36rem', margin: '0 auto', lineHeight: 1.55 }}>
              {locale === 'hi'
                ? 'न्यायिक प्रक्रिया के हर चरण में एक शांत, मानवीय संबल जो आपकी स्थिति को समझता है और कभी पीछे नहीं छूटने देता।'
                : 'A quiet, dignified companion through statutory proceedings, connecting noticed signals to verified human welfare.'}
            </p>
          </div>

          {/* ═══ 2. CONTINUITY: YOU DON'T HAVE TO START OVER ════════════════ */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg, 16px)',
              border: '1px solid var(--line-faint, #EDE8E1)',
              boxShadow: '0 4px 20px rgba(50, 35, 25, 0.04)',
              padding: '2.25rem',
              marginBottom: '2.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ maxWidth: '44rem', marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                {locale === 'hi' ? 'निरंतरता' : 'Continuity Over Time'}
              </div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.65rem', color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                {locale === 'hi' ? 'आपको कभी शून्य से शुरू नहीं करना पड़ता।' : "You don't have to start over."}
              </h3>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {locale === 'hi'
                  ? 'प्रत्येक संवाद आपकी यात्रा की एक कड़ी बन जाता है। सहारा याद रखता है कि आपने कहाँ छोड़ा था, ताकि आपको अपनी व्यथा बार-बार दोहराने का कष्ट न उठाना पड़े।'
                  : 'Each check-in builds upon the last. Sahara remembers where you left off, so you never have to re-explain traumatic events or restart your story from scratch.'}
              </p>
            </div>

            {/* Subtle horizontal continuity chain */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '1.25rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--line-faint)',
              }}
            >
              {[
                { step: '1', title: locale === 'hi' ? 'पिछला संवाद' : 'Prior Check-in', desc: locale === 'hi' ? 'सुरक्षित रूप से दर्ज आधार' : 'Preserved baseline context' },
                { step: '2', title: locale === 'hi' ? 'वर्तमान संवाद' : 'Current Check-in', desc: locale === 'hi' ? 'आज की मनोदशा व स्थिति' : 'Today’s state & concerns' },
                { step: '3', title: locale === 'hi' ? 'समय के साथ परिवर्तन' : 'Longitudinal Pattern', desc: locale === 'hi' ? 'उभार या सुधार का संकेत' : 'Gentle trajectory shift' },
                { step: '4', title: locale === 'hi' ? 'संबल संदर्भ' : 'Human Review', desc: locale === 'hi' ? 'कल्याण अधिकारी को सूचना' : 'Assigned welfare officer' },
              ].map(({ step, title, desc }) => (
                <div key={step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--accent-pale, #F9ECE8)',
                      color: 'var(--accent, #8B321D)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {step}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{title}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ 3. THE STATUTORY JOURNEY: ONE JOURNEY. NOT ONE MOMENT. ═════ */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg, 16px)',
              border: '1px solid var(--line-faint, #EDE8E1)',
              boxShadow: '0 4px 20px rgba(50, 35, 25, 0.04)',
              padding: '2.25rem',
              marginBottom: '2.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ maxWidth: '44rem', marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--secondary, #2D5A46)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                {locale === 'hi' ? 'विधिक एवं सामाजिक पड़ाव' : 'The Statutory Lifecycle'}
              </div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.65rem', color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                {locale === 'hi' ? 'एक पूरी यात्रा। केवल एक पल नहीं।' : 'One journey. Not one moment.'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {locale === 'hi'
                  ? 'अत्याचार निवारण अधिनियम के अंतर्गत प्राथमिकी से लेकर पुनर्वास तक हर पड़ाव पर मानसिक स्थिति बदलती है। सहारा पूरी प्रक्रिया के दौरान आपके साथ रहता है।'
                  : 'Under the SC/ST (Prevention of Atrocities) Act, well-being evolves through FIR, investigation, court proceedings, relief disbursal, and community rehabilitation.'}
              </p>
            </div>

            {/* Case Journey Line with subtle connecting bar */}
            <div style={{ position: 'relative', paddingTop: '0.5rem' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '23px',
                  left: '5%',
                  right: '5%',
                  height: '2px',
                  background: 'var(--line-faint, #EDE8E1)',
                  zIndex: 0,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', overflowX: 'auto', paddingBottom: '0.5rem', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                {[
                  { stage: locale === 'hi' ? 'पंजीकरण' : 'Registration', sub: 'FIR & Onboarding' },
                  { stage: locale === 'hi' ? 'जाँच' : 'Investigation', sub: 'DySP Inquiry' },
                  { stage: locale === 'hi' ? 'न्यायालय विचारण' : 'Proceedings', sub: 'Special Court' },
                  { stage: locale === 'hi' ? 'राहत व मुआवजा' : 'Compensation', sub: 'Statutory Relief' },
                  { stage: locale === 'hi' ? 'पुनर्वास' : 'Rehabilitation', sub: 'Socio-economic' },
                  { stage: locale === 'hi' ? 'निपटारा' : 'Closure', sub: 'Long-term Stability' },
                ].map(({ stage, sub }, idx) => (
                  <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 105, textAlign: 'center' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: idx === 2 ? 'var(--accent, #8B321D)' : '#FFFFFF',
                        color: idx === 2 ? '#FFFFFF' : 'var(--ink-soft)',
                        border: idx === 2 ? '2px solid #FFFFFF' : '2px solid var(--line-strong, #D8D0C5)',
                        boxShadow: idx === 2 ? '0 0 0 2px var(--accent)' : '0 2px 4px rgba(0,0,0,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        marginBottom: '0.55rem',
                      }}
                    >
                      {idx + 1}
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: idx === 2 ? 700 : 600, color: idx === 2 ? 'var(--accent)' : 'var(--ink)' }}>
                      {stage}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                      {sub}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ 4 & 5. EXPLAINABLE SIGNALS & HUMAN HANDOFF ═════════════════ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.75rem',
              marginBottom: '2.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* 4. When A Pattern Changes (Explainable Signals) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg, 16px)',
                border: '1px solid var(--line-faint, #EDE8E1)',
                boxShadow: '0 4px 20px rgba(50, 35, 25, 0.04)',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tertiary, #A34226)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                  {locale === 'hi' ? 'पारदर्शी संकेत' : 'Recent Signals & Patterns'}
                </div>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.65rem', color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                  {locale === 'hi' ? 'जब कोई बदलाव उभरता है' : 'When a pattern changes'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                  {locale === 'hi'
                    ? 'सहारा किसी गुप्त एल्गोरिदम पर नहीं, बल्कि पारदर्शी मानवीय संकेतों के मिलान से समझता है कि कब किसी व्यक्ति को परामर्शदाता की आवश्यकता है।'
                    : 'Transparent observations converge into a human support review — without opaque scores or clinical labelling.'}
                </p>
              </div>

              {/* Quiet signal pills */}
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { label: 'Check-in Language', note: 'Expressed concerns and natural emotional tone' },
                  { label: 'Participation Continuity', note: 'Regular contact vs sudden silence or withdrawal' },
                  { label: 'Case Context', note: 'Upcoming court hearings or reported intimidation' },
                  { label: 'Early-warning Trajectory', note: 'Multi-week longitudinal change over time' },
                ].map(({ label, note }) => (
                  <div
                    key={label}
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'var(--surface-sunken, #F8F5F0)',
                      borderRadius: 'var(--radius-sm, 8px)',
                      border: '1px solid var(--line-faint, #EDE8E1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <strong style={{ fontSize: '0.82rem', color: 'var(--ink)' }}>{label}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Human Handoff (People Decide Next Steps) */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-lg, 16px)',
                border: '1px solid var(--line-faint, #EDE8E1)',
                boxShadow: '0 4px 20px rgba(50, 35, 25, 0.04)',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent, #8B321D)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                  {locale === 'hi' ? 'मानवीय निर्णय' : 'Human Review'}
                </div>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.65rem', color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                  {locale === 'hi' ? 'प्रणाली संकेत देती है। निर्णय मनुष्य लेते हैं।' : 'People decide what happens next.'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                  {locale === 'hi'
                    ? 'सहारा कभी भी स्वचालित कानूनी या चिकित्सकीय निर्णय नहीं लेता। प्रत्येक संकेत सीधे एक अधिकृत मानवीय परामर्शदाता के पास जाता है।'
                    : 'Automated heuristics never execute clinical or legal actions alone. Dedicated district welfare officers review context and coordinate real support.'}
                </p>
              </div>

              {/* Support Thread Sequence */}
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', textAlign: 'center' }}>
                {[
                  { num: '1', title: 'Signal Noticed', sub: 'Subtle shift' },
                  { num: '2', title: 'Human Review', sub: 'Officer reads' },
                  { num: '3', title: 'Support Action', sub: 'Care / Relief' },
                  { num: '4', title: 'Verified Outcome', sub: 'Documented' },
                ].map(({ num, title, sub }, idx) => (
                  <div key={title} style={{ flex: 1 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: idx === 1 ? 'var(--accent)' : 'var(--surface-sunken)',
                        color: idx === 1 ? '#FFFFFF' : 'var(--ink-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 0.4rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {num}
                    </div>
                    <strong style={{ fontSize: '0.78rem', color: 'var(--ink)', display: 'block' }}>{title}</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ 6 & 7. HORIZON & STATUTORY TRUST PILLARS ═══════════════════ */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg, 16px)',
              border: '1px solid var(--line-faint, #EDE8E1)',
              boxShadow: '0 4px 20px rgba(50, 35, 25, 0.04)',
              padding: '1.75rem 2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.75rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Statutory Protection
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.25rem' }}>
                SC/ST (PoA) Act, 1989
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: '0.3rem 0 0', lineHeight: 1.45 }}>
                Mandatory witness protection, statutory relief tracking, and victim rights coordination.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Small-Cell Privacy
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.25rem' }}>
                DPDP Act & k &lt; 5 Privacy
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: '0.3rem 0 0', lineHeight: 1.45 }}>
                Small-cell suppression protects identities; administrators see only aggregate health metrics.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Voluntary Consent
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.25rem' }}>
                Revocable at Any Time
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: '0.3rem 0 0', lineHeight: 1.45 }}>
                Participation is entirely voluntary. Pause, resume, or opt out without affecting legal rights.
              </p>
            </div>
          </div>
        </section>

        {/* ═══ 8. YOUR SUPPORT SPACE — THREE SUBTLE STEPS ═════════════════ */}
        <section
          ref={entryRef}
          aria-label="Your Support Space"
          style={{
            marginTop: '3.5rem',
            padding: '2.5rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg, 16px)',
            border: '1px solid var(--line-faint, #EDE8E1)',
            boxShadow: '0 4px 24px rgba(50, 35, 25, 0.04)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--accent, #8B321D)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'inline-block',
                padding: '0.2rem 0.65rem',
                background: 'var(--accent-pale, #F9ECE8)',
                borderRadius: 'var(--radius-full)',
                marginBottom: '0.55rem',
              }}
            >
              {locale === 'hi' ? 'संबल प्रक्रिया की रूपरेखा' : 'Support Continuity'}
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
                color: 'var(--ink, #1F1B18)',
                margin: '0 0 0.45rem',
              }}
            >
              {t('sahara.supportSpaceTitle')}
            </h2>
            <p style={{ margin: '0 auto', fontSize: '0.92rem', color: 'var(--ink-muted)', maxWidth: '34rem', lineHeight: 1.55 }}>
              {locale === 'hi'
                ? 'आपका संबल कक्ष केवल सुरक्षित सत्यापन के बाद ही खुलता है। आपकी पहुंच सीधे आपके सत्यापित केस से जुड़ी है।'
                : 'Your Sahara space opens only after secure verification. Your access is linked to your verified case.'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Step 01: VERIFY */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--surface-sunken, #F8F5F0)',
                borderRadius: 'var(--radius-md, 12px)',
                border: '1px solid var(--line-faint, #EDE8E1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent-pale, #F9ECE8)',
                    color: 'var(--accent, #8B321D)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  01
                </span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--ink)', letterSpacing: '0.04em' }}>
                  {t('sahara.step1Title')}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                {t('sahara.step1Desc')}
              </p>
              <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: 'auto', paddingTop: '0.5rem' }}>
                🔒 {locale === 'hi' ? 'सत्यापित क्रेडेंशियल' : 'Verified case-bound credential'}
              </div>
            </div>

            {/* Step 02: CONNECT */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--surface-sunken, #F8F5F0)',
                borderRadius: 'var(--radius-md, 12px)',
                border: '1px solid var(--line-faint, #EDE8E1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--secondary-container, #E6EFEA)',
                    color: 'var(--secondary, #2D5A46)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  02
                </span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--ink)', letterSpacing: '0.04em' }}>
                  {t('sahara.step2Title')}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                {t('sahara.step2Desc')}
              </p>
              <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: 'auto', paddingTop: '0.5rem' }}>
                🛡️ {locale === 'hi' ? 'केवल आपका केस' : 'Your linked case opens exclusively'}
              </div>
            </div>

            {/* Step 03: CONTINUE */}
            <div
              style={{
                padding: '1.5rem',
                background: 'var(--surface-sunken, #F8F5F0)',
                borderRadius: 'var(--radius-md, 12px)',
                border: '1px solid var(--line-faint, #EDE8E1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#FDEEE6',
                    color: 'var(--tertiary, #A34226)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  03
                </span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--ink)', letterSpacing: '0.04em' }}>
                  {t('sahara.step3Title')}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                {t('sahara.step3Desc')}
              </p>
              <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: 'auto', paddingTop: '0.5rem' }}>
                🌿 {locale === 'hi' ? 'मानवीय सहायता से निरंतरता' : 'Continuous care & human review'}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CITIZEN SECURE ACCESS MODAL / PANEL ═════════════════════════ */}
        {showAccessModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-modal-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(25, 20, 15, 0.55)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              animation: 'fadeIn 250ms ease-out',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowAccessModal(false);
                setCodeError('');
              }
            }}
          >
            <div
              style={{
                background: '#FDFBF8',
                borderRadius: '16px',
                border: '1px solid var(--line-strong, #D8D0C5)',
                boxShadow: '0 20px 60px rgba(30, 20, 15, 0.18)',
                maxWidth: 440,
                width: '100%',
                padding: '2.25rem 2rem',
                position: 'relative',
                animation: 'slideUp 250ms ease-out',
              }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAccessModal(false);
                  setCodeError('');
                }}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: '1.25rem',
                  right: '1.25rem',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.35rem',
                  lineHeight: 1,
                  color: 'var(--ink-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                &times;
              </button>

              {/* Header Icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--accent-pale, #F9ECE8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                  margin: '0 auto 1.25rem',
                }}
              >
                <IconShield size={24} color="var(--accent)" />
              </div>

              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h3
                  id="access-modal-title"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.35rem',
                    color: 'var(--ink)',
                    margin: '0 0 0.45rem',
                    lineHeight: 1.3,
                  }}
                >
                  {t('sahara.accessModalHeadline')}
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {t('sahara.accessModalCopy')}
                </p>
              </div>

              {/* 6-Digit Segmented Code Input */}
              <form onSubmit={handleAccessSubmit}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label
                    htmlFor="access-digit-1"
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--ink-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '0.85rem',
                    }}
                  >
                    {t('sahara.accessCodeLabel')}
                  </label>

                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      justifyContent: 'center',
                    }}
                  >
                    {codeDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (digitRefs.current[idx] = el)}
                        id={`access-digit-${idx + 1}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete="one-time-code"
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        onPaste={handleDigitPaste}
                        disabled={codeLoading || busy}
                        aria-label={`Digit ${idx + 1} of 6`}
                        style={{
                          width: '46px',
                          height: '52px',
                          textAlign: 'center',
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          border: codeError
                            ? '2px solid var(--risk-high, #C23A22)'
                            : digit
                            ? '2px solid var(--accent, #8B321D)'
                            : '1.5px solid var(--line-strong, #D8D0C5)',
                          background: '#FFFFFF',
                          color: 'var(--ink)',
                          outline: 'none',
                          boxShadow: digit ? '0 0 0 3px var(--accent-pale)' : 'none',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Error Banner with reserved minHeight to avoid layout jump */}
                <div
                  style={{
                    minHeight: '1.6rem',
                    margin: '0.75rem 0 0.5rem',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {codeError && (
                    <div
                      role="alert"
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--risk-high, #C23A22)',
                        fontWeight: 600,
                      }}
                    >
                      ⚠ {codeError}
                    </div>
                  )}
                </div>

                <button
                  id="btn-continue-securely"
                  type="submit"
                  disabled={codeLoading || busy}
                  className="btn btn-primary-lg"
                  style={{
                    width: '100%',
                    fontWeight: 700,
                    padding: '0.75rem',
                  }}
                >
                  {codeLoading ? t('sahara.verifying') : t('sahara.continueSecurely')}
                </button>
              </form>

              {/* Trust statement inside modal */}
              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--line-faint, #EDE8E1)',
                  textAlign: 'center',
                  fontSize: '0.76rem',
                  color: 'var(--ink-muted)',
                  lineHeight: 1.45,
                }}
              >
                🔒 {locale === 'hi'
                  ? 'यह संबल स्पेस निजी है। आपका एक्सेस केवल आपके संबंधित केस से जुड़ा है।'
                  : 'Your support space is private. Your access is linked strictly to your verified case.'}
              </div>

              {/* EVALUATOR MODE ONLY: Helper for evaluation/testing */}
              {isEvaluatorMode && (
                <div
                  style={{
                    marginTop: '1.15rem',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-sm, 8px)',
                    background: 'var(--surface-sunken, #F8F5F0)',
                    border: '1px dashed var(--line-strong, #D8D0C5)',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    🧪 {locale === 'hi' ? 'मूल्यांकन मोड डेमो सहायता' : 'Evaluator Demo Credential'}
                  </div>
                  <div style={{ color: 'var(--ink-muted)', marginTop: '0.2rem' }}>
                    Demo code for Complainant A: <strong style={{ color: 'var(--accent)' }}>741001</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillDemoCode('741001')}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '0.45rem', fontSize: '0.74rem' }}
                  >
                    Fill Demo Code (741001)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ QUIET STAFF SIGN-IN MODAL ═══════════════════════════════════ */}
        {showStaffModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-modal-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(25, 20, 15, 0.55)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              animation: 'fadeIn 250ms ease-out',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowStaffModal(false);
                setStaffError('');
              }
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid var(--line-strong, #D8D0C5)',
                boxShadow: '0 20px 60px rgba(30, 20, 15, 0.18)',
                maxWidth: 460,
                width: '100%',
                padding: '2.25rem 2rem',
                position: 'relative',
                animation: 'slideUp 250ms ease-out',
              }}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setShowStaffModal(false);
                  setStaffError('');
                }}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: '1.25rem',
                  right: '1.25rem',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.35rem',
                  lineHeight: 1,
                  color: 'var(--ink-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                &times;
              </button>

              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--secondary, #2D5A46)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'inline-block',
                    padding: '0.2rem 0.6rem',
                    background: 'var(--secondary-container, #E6EFEA)',
                    borderRadius: 'var(--radius-full)',
                    marginBottom: '0.5rem',
                  }}
                >
                  {locale === 'hi' ? 'संस्थागत एवं कर्मचारी प्रवेश' : 'Institutional Access'}
                </span>
                <h3
                  id="staff-modal-title"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.35rem',
                    color: 'var(--ink)',
                    margin: '0 0 0.35rem',
                  }}
                >
                  {locale === 'hi' ? 'स्टाफ एवं अधिकारी साइन-इन' : 'Staff & Welfare Sign-In'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ink-muted)', lineHeight: 1.45 }}>
                  {locale === 'hi'
                    ? 'जिला परामर्शदाता, कल्याण अधिकारी एवं राज्य/राष्ट्रीय प्रशासक।'
                    : 'Authorized welfare officers, district counsellors, and administrators.'}
                </p>
              </div>

              {/* Role Quick Selector Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  background: 'var(--surface-sunken, #F8F5F0)',
                  padding: '0.35rem',
                  borderRadius: 'var(--radius-sm, 8px)',
                  marginBottom: '1.25rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleStaffRoleSelect('counsellor')}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '6px',
                    background: staffRole === 'counsellor' ? '#FFFFFF' : 'transparent',
                    color: staffRole === 'counsellor' ? 'var(--accent)' : 'var(--ink-muted)',
                    boxShadow: staffRole === 'counsellor' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {locale === 'hi' ? 'परामर्शदाता' : 'Counsellor'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffRoleSelect('admin')}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '6px',
                    background: staffRole === 'admin' ? '#FFFFFF' : 'transparent',
                    color: staffRole === 'admin' ? 'var(--secondary)' : 'var(--ink-muted)',
                    boxShadow: staffRole === 'admin' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {locale === 'hi' ? 'प्रशासक' : 'Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffRoleSelect('custom')}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '6px',
                    background: staffRole === 'custom' ? '#FFFFFF' : 'transparent',
                    color: staffRole === 'custom' ? 'var(--ink)' : 'var(--ink-muted)',
                    boxShadow: staffRole === 'custom' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {locale === 'hi' ? 'कस्टम' : 'Custom'}
                </button>
              </div>

              <form onSubmit={handleStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label
                    htmlFor="staff-username-input"
                    style={{
                      display: 'block',
                      fontSize: '0.74rem',
                      color: 'var(--ink-muted)',
                      marginBottom: '0.3rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t('sahara.manualUsername')}
                  </label>
                  <input
                    id="staff-username-input"
                    type="text"
                    value={staffUsername}
                    onChange={(e) => {
                      setStaffUsername(e.target.value);
                      setStaffError('');
                    }}
                    placeholder="counsellor or admin"
                    disabled={staffLoading || busy}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--line)',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="staff-passcode-input"
                    style={{
                      display: 'block',
                      fontSize: '0.74rem',
                      color: 'var(--ink-muted)',
                      marginBottom: '0.3rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t('sahara.manualPasscode')}
                  </label>
                  <input
                    id="staff-passcode-input"
                    type="password"
                    value={staffPasscode}
                    onChange={(e) => {
                      setStaffPasscode(e.target.value);
                      setStaffError('');
                    }}
                    placeholder="demo"
                    disabled={staffLoading || busy}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--line)',
                    }}
                  />
                </div>

                {staffError && (
                  <div
                    role="alert"
                    style={{
                      padding: '0.6rem 0.85rem',
                      background: 'var(--risk-high-bg)',
                      border: '1px solid var(--risk-high-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      color: 'var(--risk-high)',
                      fontWeight: 600,
                    }}
                  >
                    ⚠ {staffError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={staffLoading || busy}
                  className="btn btn-primary-lg"
                  style={{ marginTop: '0.45rem', width: '100%' }}
                >
                  {staffLoading || busy ? t('login.signing') : t('sahara.manualCta')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Discreet Evaluator Mode Toggle in bottom corner */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => {
              const next = !isEvaluatorMode;
              setIsEvaluatorMode(next);
              if (next) {
                localStorage.setItem('sahara_eval_mode', 'true');
              } else {
                localStorage.removeItem('sahara_eval_mode');
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-faint, #A8A095)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
              letterSpacing: '0.04em',
            }}
          >
            {isEvaluatorMode ? '🧪 Evaluator Mode: Active (Click to Hide)' : '⚙️ Evaluator Mode'}
          </button>
        </div>

        {/* Dev Persona Switcher: STRICTLY visible only in Evaluator Mode */}
        {isEvaluatorMode && (
          <DevPersonaSwitcher onSignIn={onSignIn} onDevLogin={onDevLogin} busy={busy} />
        )}
      </main>

      <GovernmentFooter />
    </div>
  );
}
