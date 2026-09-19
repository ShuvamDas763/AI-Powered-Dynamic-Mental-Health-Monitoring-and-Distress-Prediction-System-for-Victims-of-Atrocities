/**
 * LoginPage — The Sahara Public & Entry Experience.
 *
 * Implements Sections 18–26 & Creative Quality Gate:
 * Narrative rhythm as ONE continuous editorial story:
 * 1. THE REACH (Hero with 3D sculpted connection)
 * 2. YOU DON'T HAVE TO START OVER (Longitudinal continuity)
 * 3. ONE JOURNEY. NOT ONE MOMENT. (Case lifecycle line)
 * 4. WHEN A PATTERN CHANGES (Explainable multi-signal breakdown)
 * 5. WHAT HAPPENS NEXT (Uncertainty-reducing horizon)
 * 6. AI DOES NOT DECIDE ALONE (The Support Thread)
 * 7. REACHING PEOPLE WHERE THEY ARE (Channels: App, Web, SMS, IVRS)
 * 8. TRUST (Statutory & privacy safeguards)
 * Followed by Citizen Sanctuary & Professional Portals.
 */

import { useState, useRef } from 'react';
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
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);

  const narrativeRef = useRef(null);
  const entryRef = useRef(null);

  function scrollToStory() {
    narrativeRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollToEntry() {
    entryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) {
      setError(locale === 'hi' ? 'कृपया अपना उपयोगकर्ता नाम या केस आईडी दर्ज करें।' : 'Please enter your username or Case ID.');
      return;
    }
    if (!passcode.trim()) {
      setError(locale === 'hi' ? 'कृपया अपना पासकोड दर्ज करें।' : 'Please enter your passcode.');
      return;
    }
    setError('');
    onSignIn(username.trim(), passcode.trim());
  }

  function fillDemo(user) {
    setUsername(user);
    setPasscode('demo');
    setError('');
    onSignIn(user, 'demo');
  }

  return (
    <div className="app-shell">
      <GovernmentHeader />

      <main className="main-content" style={{ maxWidth: '78rem', padding: '1.75rem 1.5rem 4rem' }}>
        {/* ═══ SECTION 1: THE REACH ═════════════════════════════════════════ */}
        <TheReach
          onBeginCheckin={() => onSignIn('victim', 'demo')}
          onExploreHowItWorks={scrollToStory}
        />

        {/* ═══ CONTINUOUS EDITORIAL NARRATIVE STORY ════════════════════════ */}
        <div ref={narrativeRef} style={{ marginTop: '3.5rem', marginBottom: '4rem' }}>
          {/* Section Divider & Narrative Header */}
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent)',
              display: 'block',
              marginBottom: '0.5rem',
            }}>
              {locale === 'hi' ? 'सहारा की रूपरेखा' : 'How Sahara Carries Support'}
            </span>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.6rem, 3vw, 2.3rem)',
              color: 'var(--ink)',
              margin: 0,
            }}>
              {locale === 'hi' ? 'एक अखंड संबल यात्रा' : 'One continuous journey of care.'}
            </h2>
          </div>

          {/* ═══ SECTION 2: YOU DON'T HAVE TO START OVER ════════════════════ */}
          <div className="card card-elevated" style={{
            marginBottom: '2.5rem',
            padding: '2rem',
            borderLeft: '4px solid var(--accent)',
            background: 'var(--surface)',
          }}>
            <div style={{ maxWidth: '44rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {locale === 'hi' ? 'निरंतरता' : 'Continuity Over Time'}
              </div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.65rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? 'आपको कभी शून्य से शुरू नहीं करना पड़ता।' : "You don't have to start over."}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {locale === 'hi'
                  ? 'प्रत्येक संवाद आपकी यात्रा की एक कड़ी बन जाता है। सहारा याद रखता है कि आपने कहाँ छोड़ा था, ताकि आपको अपनी व्यथा बार-बार दोहराने का कष्ट न उठाना पड़े।'
                  : 'Each check-in becomes part of your ongoing journey. Sahara remembers where you left off, so you never have to repeat your distress or start from scratch.'}
              </p>
            </div>

            {/* Subtle horizontal continuity timeline */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              paddingTop: '1rem',
              borderTop: '1px dashed var(--line-faint)',
            }}>
              {[
                { step: '1', title: locale === 'hi' ? 'पिछला संवाद' : 'Previous Check-in', desc: locale === 'hi' ? 'सुरक्षित रूप से दर्ज आधार' : 'Recorded baseline' },
                { step: '2', title: locale === 'hi' ? 'वर्तमान संवाद' : 'Current Check-in', desc: locale === 'hi' ? 'आज की मनोदशा व स्थिति' : 'Today’s thoughts & state' },
                { step: '3', title: locale === 'hi' ? 'समय के साथ परिवर्तन' : 'Change Over Time', desc: locale === 'hi' ? 'उभार या सुधार का संकेत' : 'Longitudinal shift' },
                { step: '4', title: locale === 'hi' ? 'संबल संदर्भ' : 'Support Context', desc: locale === 'hi' ? 'कल्याण अधिकारी को सूचना' : 'Welfare officer context' },
              ].map(({ step, title, desc }) => (
                <div key={step} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--accent-pale)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {step}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{title}</strong>
                    <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 3: ONE JOURNEY. NOT ONE MOMENT. ════════════════════ */}
          <div className="card" style={{ marginBottom: '2.5rem', padding: '2rem' }}>
            <div style={{ maxWidth: '44rem', marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {locale === 'hi' ? 'विधिक एवं सामाजिक पड़ाव' : 'Statutory Lifecycle'}
              </div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.65rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? 'एक पूरी यात्रा। केवल एक पल नहीं।' : 'One journey. Not one moment.'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {locale === 'hi'
                  ? 'अत्याचार निवारण अधिनियम के अंतर्गत प्राथमिकी से लेकर पुनर्वास तक हर पड़ाव पर मानसिक स्थिति बदलती है। सहारा पूरी प्रक्रिया के दौरान आपके साथ रहता है।'
                  : 'Under the SC/ST Protection Act, well-being evolves through FIR, investigation, court proceedings, relief disbursal, and community rehabilitation.'}
              </p>
            </div>

            {/* Case Journey Line */}
            <div style={{ display: 'flex', justifyContent: 'space-between', overflowX: 'auto', paddingBottom: '0.5rem', gap: '0.5rem' }}>
              {[
                { stage: locale === 'hi' ? 'पंजीकरण' : 'Registration', sub: 'FIR & Onboarding' },
                { stage: locale === 'hi' ? 'जाँच' : 'Investigation', sub: 'DySP Inquiry' },
                { stage: locale === 'hi' ? 'न्यायालय विचारण' : 'Proceedings', sub: 'Special Court' },
                { stage: locale === 'hi' ? 'राहत व मुआवजा' : 'Compensation', sub: 'Statutory Relief' },
                { stage: locale === 'hi' ? 'पुनर्वास' : 'Rehabilitation', sub: 'Socio-economic' },
                { stage: locale === 'hi' ? 'निपटारा' : 'Closure', sub: 'Long-term Stability' },
              ].map(({ stage, sub }, idx) => (
                <div key={stage} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 105, textAlign: 'center' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: idx === 2 ? 'var(--accent)' : 'var(--surface-sunken)',
                    color: idx === 2 ? '#FFFFFF' : 'var(--ink-soft)',
                    border: idx === 2 ? '2px solid var(--surface)' : '1px solid var(--line)',
                    boxShadow: idx === 2 ? '0 0 0 2px var(--accent)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    marginBottom: '0.45rem',
                  }}>
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

          {/* ═══ SECTION 4: WHEN A PATTERN CHANGES (Explainable Convergence) ══ */}
          <div className="card" style={{ marginBottom: '2.5rem', padding: '2rem', background: 'var(--surface-sunken)', border: '1px solid var(--line)' }}>
            <div style={{ maxWidth: '44rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {locale === 'hi' ? 'पारदर्शी संकेत' : 'Explainable Pattern Recognition'}
              </div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.65rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? 'जब कोई बदलाव उभरता है' : 'When a pattern changes'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {locale === 'hi'
                  ? 'सहारा किसी गुप्त एल्गोरिदम पर नहीं, बल्कि स्पष्ट, पारदर्शी मानवीय संकेतों के मिलान से यह समझता है कि कब किसी व्यक्ति को परामर्शदाता की सहायता की आवश्यकता है।'
                  : 'Multiple human observations converge into a priority support review — without black-box mystery or clinical labelling.'}
              </p>
            </div>

            {/* Explainable Convergence Equation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              padding: '1.25rem',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--line-faint)',
            }}>
              {[
                { title: 'Check-in', sub: 'Words & tone' },
                { title: 'Participation', sub: 'Engagement continuity' },
                { title: 'Language', sub: 'Expressed concerns' },
                { title: 'Case Context', sub: 'Court dates & threats' },
                { title: 'Longitudinal Trend', sub: 'Multi-week shift' },
              ].map(({ title, sub }, i) => (
                <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    padding: '0.65rem 0.95rem',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'center',
                    border: '1px solid var(--line-faint)',
                  }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--ink)', display: 'block' }}>{title}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>{sub}</span>
                  </div>
                  {i < 4 && <span style={{ color: 'var(--ink-faint)', fontWeight: 700, fontSize: '1.1rem' }}>+</span>}
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.3rem' }}>→</span>
                <div style={{
                  padding: '0.65rem 1.15rem',
                  background: 'var(--accent-pale)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--accent)',
                  textAlign: 'center',
                }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--accent)', display: 'block' }}>
                    {locale === 'hi' ? 'संबल समीक्षा अनुरोध' : 'Human Support Review'}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>
                    {locale === 'hi' ? 'कल्याण अधिकारी को सूचना' : 'Assigned to welfare officer'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 5 & 6: AI DOES NOT DECIDE ALONE (Support Thread) ═════ */}
          <div className="card" style={{ marginBottom: '2.5rem', padding: '2rem' }}>
            <div style={{ maxWidth: '44rem', marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {locale === 'hi' ? 'मानवीय नियंत्रण' : 'Human-in-the-Loop'}
              </div>
              <h3 style={{ fontSize: '1.35rem', margin: '0 0 0.65rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? 'प्रणाली केवल संकेत देती है। निर्णय मनुष्य लेते हैं।' : 'AI can notice a pattern. People decide what happens next.'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                {locale === 'hi'
                  ? 'सहारा कभी भी स्वचालित कानूनी या चिकित्सकीय निर्णय नहीं लेता। प्रत्येक संकेत सीधे एक प्रशिक्षित मानवीय परामर्शदाता के पास जाता है, जो संवेदनशीलता से संपर्क करता है।'
                  : 'Automated heuristics never execute clinical or legal actions alone. A dedicated district welfare officer reviews the context, speaks with the person, and oversees support.'}
              </p>
            </div>

            {/* Support Thread Visual Sequence */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              padding: '1.25rem 0.5rem',
              overflowX: 'auto',
              gap: '1rem',
            }}>
              {[
                { icon: '1', title: 'Signal Detected', desc: 'Pattern noticed' },
                { icon: '2', title: 'Human Review', desc: 'Officer assesses' },
                { icon: '3', title: 'Support Action', desc: 'Protection / Care' },
                { icon: '4', title: 'Follow-up', desc: 'Continuous contact' },
                { icon: '5', title: 'Resolution', desc: 'Documented outcome' },
              ].map(({ icon, title, desc }, idx) => (
                <div key={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 120, textAlign: 'center' }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: idx === 1 ? 'var(--accent)' : 'var(--surface-sunken)',
                    color: idx === 1 ? '#FFFFFF' : 'var(--ink)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    marginBottom: '0.45rem',
                    boxShadow: idx === 1 ? '0 0 0 3px var(--accent-pale)' : 'none',
                  }}>
                    {icon}
                  </div>
                  <strong style={{ fontSize: '0.84rem', color: 'var(--ink)' }}>{title}</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 7: REACHING PEOPLE WHERE THEY ARE ═══════════════════ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2.5rem',
          }}>
            {[
              { channel: 'Web Portal', badge: 'Active', desc: 'Private, browser-based check-in on any computer or smartphone with zero footprint.' },
              { channel: 'Mobile App', badge: 'Active', desc: 'Quiet background push reminders at scheduled intervals with discreet notifications.' },
              { channel: 'Discreet SMS', badge: 'Simulated Channel', desc: 'Simple text prompts for areas with limited data connectivity; voluntary opt-in.' },
              { channel: 'IVRS Voice', badge: 'Simulated Channel', desc: 'Automated scheduled audio calls in vernacular language with consent enforcement.' },
            ].map(({ channel, badge, desc }) => (
              <div key={channel} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>{channel}</strong>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.45rem',
                    borderRadius: 'var(--radius-full)',
                    background: badge === 'Active' ? 'var(--risk-low-bg)' : 'var(--surface-sunken)',
                    color: badge === 'Active' ? 'var(--risk-low)' : 'var(--ink-muted)',
                  }}>
                    {badge}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>

          {/* ═══ SECTION 8: TRUST & STATUTORY SAFEGUARDS ═════════════════════ */}
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Statutory Shield
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.2rem' }}>
                SC/ST (PoA) Act, 1989
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '0.25rem 0 0', lineHeight: 1.45 }}>
                Protected rights, mandatory witness assistance, and relief tracking.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Privacy Segregation
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.2rem' }}>
                DPDP Act & k &lt; 5 Privacy
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '0.25rem 0 0', lineHeight: 1.45 }}>
                Small-cell suppression protects identities from administrative view.
              </p>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Voluntary Consent
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.2rem' }}>
                Revocable at Any Time
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '0.25rem 0 0', lineHeight: 1.45 }}>
                Pause or resume support whenever you wish without legal penalty.
              </p>
            </div>
          </div>
        </div>

        {/* ═══ SANCTUARY & ACCESS TIERS (CITIZEN + PROFESSIONAL) ════════════ */}
        <div ref={entryRef} style={{ marginTop: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {locale === 'hi' ? 'सुरक्षित पोर्टल प्रवेश' : 'Secure Portal Entry'}
            </span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--ink)', margin: '0.25rem 0 0' }}>
              {locale === 'hi' ? 'अपनी भूमिका के अनुसार प्रवेश करें' : 'Select your support entrance'}
            </h2>
          </div>

          {/* Priority Citizen Sanctuary Card */}
          <div className="card card-hero animate-in" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            borderLeft: '5px solid var(--accent)',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            padding: '1.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem', minWidth: 280, flex: 1 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--accent-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--accent)',
              }}>
                <IconShield size={28} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  {locale === 'hi' ? 'नागरिक संबल प्रवेश' : 'Citizen Sanctuary & Check-in'}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 700 }}>
                  {t('sahara.citizenTitle')}
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  {t('sahara.citizenDesc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onSignIn('victim', 'demo')}
              disabled={busy}
              className="btn btn-primary-lg"
              style={{ fontWeight: 700, flexShrink: 0 }}
            >
              {t('sahara.citizenCta')}
            </button>
          </div>

          {/* Dual Caseworker & Administrative Portals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            {/* Counsellor Workspace */}
            <div className="card card-elevated" style={{ borderTop: '4px solid var(--accent)', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {t('sahara.tier1')}
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.45rem' }}>
                {t('sahara.tier1Title')}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                {t('sahara.tier1Desc')}
              </p>
              <button
                onClick={() => onSignIn('counsellor', 'demo')}
                disabled={busy}
                className="btn btn-secondary"
                style={{ width: '100%', fontWeight: 700 }}
              >
                {t('sahara.tier1Cta')}
              </button>
            </div>

            {/* Admin Directorate */}
            <div className="card card-elevated" style={{ borderTop: '4px solid var(--secondary)', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                {t('sahara.tier2')}
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.45rem' }}>
                {t('sahara.tier2Title')}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                {t('sahara.tier2Desc')}
              </p>
              <button
                onClick={() => onSignIn('admin', 'demo')}
                disabled={busy}
                className="btn btn-secondary"
                style={{ width: '100%', fontWeight: 700 }}
              >
                {t('sahara.tier2Cta')}
              </button>
            </div>
          </div>

          {/* Quick Demonstration Personas Accordion (A–H) */}
          <div style={{
            padding: '1.25rem 1.4rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--line-strong)',
            background: 'var(--surface)',
            marginBottom: '1.75rem',
          }}>
            <button
              onClick={() => setShowDemo(!showDemo)}
              style={{
                background: 'none',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: 0,
                font: 'inherit',
              }}
              aria-expanded={showDemo}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink)' }}>
                🧪 {locale === 'hi' ? 'मूल्यांकन परीक्षण: 8 विशेष केस प्रोफाइल' : 'Evaluation Testbench: 8 Synthetic Personas (A–H)'}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600 }}>
                {showDemo ? '▴ Hide personas' : '▾ View all 8 personas'}
              </span>
            </button>

            {showDemo && (
              <div style={{
                marginTop: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}>
                {DEMO_ACCOUNTS.map(({ user, labelHi, labelEn, desc }) => (
                  <button
                    key={user}
                    onClick={() => fillDemo(user)}
                    disabled={busy}
                    className="card card-interactive"
                    style={{
                      padding: '0.85rem',
                      textAlign: 'left',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--line-faint)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--ink)' }}>
                      {locale === 'hi' ? labelHi : labelEn}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', lineHeight: 1.35 }}>
                      {desc}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.25rem' }}>
                      Sign in as {user}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional Manual Credential Entry Accordion */}
          <div style={{ marginBottom: '1.75rem' }}>
            <button
              onClick={() => setShowManualLogin(!showManualLogin)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-muted)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                padding: '0.35rem 0',
                textDecoration: 'underline',
              }}
            >
              {showManualLogin ? 'Hide manual sign-in form' : 'Sign in with custom username and passcode'}
            </button>

            {showManualLogin && (
              <form onSubmit={handleSubmit} className="card" style={{ padding: '1.5rem', marginTop: '0.85rem', maxWidth: '32rem' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.75rem' }}>
                  {t('sahara.manualLogin')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label htmlFor="login-username" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('sahara.manualUsername')}
                    </label>
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(''); }}
                      placeholder="e.g. counsellor, admin, victim, case-b"
                      disabled={busy}
                      className="chat-input-row"
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}
                    />
                  </div>

                  <div>
                    <label htmlFor="login-passcode" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t('sahara.manualPasscode')}
                    </label>
                    <input
                      id="login-passcode"
                      type="password"
                      value={passcode}
                      onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                      placeholder="demo"
                      disabled={busy}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}
                    />
                  </div>

                  {error && (
                    <div role="alert" style={{ padding: '0.65rem 0.95rem', background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--risk-high)', fontWeight: 600 }}>
                      ⚠ {error}
                    </div>
                  )}

                  <button type="submit" disabled={busy} className="btn btn-primary-lg" style={{ marginTop: '0.45rem' }}>
                    {busy ? t('login.signing') : t('sahara.manualCta')}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* DevPersonaSwitcher (Maintained for Evaluator Rehearsals) */}
          <DevPersonaSwitcher onSignIn={onSignIn} onDevLogin={onDevLogin} busy={busy} />
        </div>
      </main>

      <GovernmentFooter />
    </div>
  );
}
