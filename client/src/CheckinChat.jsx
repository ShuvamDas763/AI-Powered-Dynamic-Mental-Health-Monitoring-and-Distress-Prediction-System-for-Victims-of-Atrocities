import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api.js';
import VoicePatternIndicator from './VoicePatternIndicator.jsx';
import { IconChat } from './GovernmentBranding.jsx';

const CASES = [
  { caseId: 'SIH-CASE-0001', label: 'Complainant A', desc: 'Hindi · Investigation · Rising distress', locale: 'hi' },
  { caseId: 'SIH-CASE-0002', label: 'Complainant B', desc: 'English · Trial · Intimidation risk', locale: 'en' },
  { caseId: 'SIH-CASE-0003', label: 'Complainant C', desc: 'English · Post-compensation · Improving', locale: 'en' },
  { caseId: 'SIH-CASE-0004', label: 'Complainant D', desc: 'English · Chargesheet · Social isolation', locale: 'en' },
  { caseId: 'SIH-CASE-0005', label: 'Complainant E', desc: 'English · Trial pending · Long-pending', locale: 'en' },
  { caseId: 'SIH-CASE-0006', label: 'Complainant F', desc: 'English · Investigation · Edge case', locale: 'en' },
  { caseId: 'SIH-CASE-0007', label: 'Complainant G', desc: 'English · Investigation · Sexual assault — withdrawal', locale: 'en' },
  { caseId: 'SIH-CASE-0008', label: 'Complainant H', desc: 'English · Chargesheet · Financial hardship', locale: 'en' },
];

const CHANNELS = [
  { id: 'app', label: 'App' },
  { id: 'sms', label: 'SMS' },
  { id: 'ivrs', label: 'IVRS' },
];

const CONSENT_KEY = 'freebuff_consent';

const INITIAL_PROMPTS_EN = 'How have things been since we last checked in?';
const INITIAL_PROMPTS_HI = 'पिछली बार बात होने के बाद से चीज़ें कैसी रहीं?';

const FALLBACK_FOLLOW_UP_EN = 'Thank you for sharing that. Is there anything else you would like to talk about?';
const FALLBACK_FOLLOW_UP_HI = 'आपने जो बताया उसके लिए धन्यवाद। क्या और कुछ है जो आप बताना चाहेंगे?';

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CheckinChat({ user }) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState('app');
  const [lastAssessment, setLastAssessment] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [crisisActive, setCrisisActive] = useState(false);
  const messagesEnd = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { body } = await api('/notifications');
      setNotifications(body.notifications ?? []);
      setUnreadCount(body.unreadCount ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markRead() {
    try {
      await api('/notifications/read', { method: 'POST' });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!selectedCase) return;
    try {
      const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? '{}');
      setConsentGiven(stored[selectedCase] === true);
    } catch { setConsentGiven(false); }
  }, [selectedCase]);

  const availableCases = user?.caseId
    ? CASES.filter((c) => c.caseId === user.caseId)
    : [];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function selectCase(caseId) {
    const c = CASES.find((x) => x.caseId === caseId);
    setSelectedCase(caseId);
    setLocale(c?.locale ?? 'en');
    setMessages([]);
    setLastAssessment(null);
    setCrisisActive(false);

    const initialPrompt = c?.locale === 'hi' ? INITIAL_PROMPTS_HI : INITIAL_PROMPTS_EN;
    setTimeout(() => {
      setMessages([{ speaker: 'system', text: initialPrompt, time: new Date().toISOString() }]);
    }, 500);
  }

  async function sendReply() {
    const text = input.trim();
    if (!text || busy || !selectedCase) return;

    setInput('');
    const userMsg = { speaker: 'person', text, time: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setBusy(true);

    try {
      const { ok, body } = await api('/checkin', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          turns: newMessages.map(({ speaker, text }) => ({ speaker, text })),
          locale,
          channel,
          consentAcknowledged: consentGiven,
        }),
      });

      if (ok && body.assessment) {
        setLastAssessment(body.assessment);
      }

      const isCrisis = Boolean(body.crisisResponse?.triggered || body.assessment?.crisisDetected);
      if (isCrisis) {
        setCrisisActive(true);
      }

      const followUp = body.followUp
        || (locale === 'hi' ? FALLBACK_FOLLOW_UP_HI : FALLBACK_FOLLOW_UP_EN);

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            speaker: 'system',
            text: followUp,
            time: new Date().toISOString(),
            isCrisis,
          },
        ]);
      }, 300);
    } catch {
      setMessages((prev) => [
        ...prev,
        { speaker: 'system', text: 'Something went wrong. Please try again.', time: new Date().toISOString() },
      ]);
    }

    setBusy(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  // Case selection screen
  if (!selectedCase) {
    return (
      <div>
        <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Check-in</h1>
            <p>Submit a well-being check-in. Your responses are reviewed by a welfare officer.</p>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markRead(); }}
              className="notification-bell"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              style={{ background: unreadCount > 0 ? 'var(--risk-high-bg)' : 'var(--surface-sunken)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
            >
              <IconChat size={20} color={unreadCount > 0 ? 'var(--risk-high)' : 'var(--ink-muted)'} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="card" style={{ position: 'absolute', top: 48, right: 0, width: 320, maxHeight: 400, overflowY: 'auto', zIndex: 50, boxShadow: 'var(--shadow-lg)' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Notifications</h3>
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No notifications yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.map((n) => (
                      <div key={n.id} style={{
                        padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)',
                        background: n.readAt ? 'transparent' : 'var(--accent-pale)',
                        fontSize: '0.85rem', lineHeight: 1.5, borderLeft: n.readAt ? 'none' : '3px solid var(--accent)',
                      }}>
                        <p style={{ margin: 0 }}>{n.message}</p>
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card card-elevated animate-in animate-in-delay-1" style={{ maxWidth: '48rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Select a case</h2>
          <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
            Submit your well-being check-in below.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {availableCases.map((c, i) => (
              <button
                key={c.caseId}
                className="card login-role-card"
                style={{ textAlign: 'left', padding: '1rem', cursor: 'pointer', border: '1.5px solid var(--line)', animation: `fadeIn 0.3s var(--ease-out) ${i * 0.05}s both` }}
                onClick={() => selectCase(c.caseId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
                    {c.locale === 'hi' ? 'अ' : 'En'}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.9rem' }}>{c.label}</strong>
                    <br />
                    <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{c.desc}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="checkin-layout">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <button
          className="back-link animate-in"
          onClick={() => { setSelectedCase(null); setMessages([]); setLastAssessment(null); setCrisisActive(false); }}
        >
          &larr; Change case
        </button>
        <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
          Active Case: <strong style={{ color: 'var(--ink)' }}>{selectedCase}</strong> · {locale === 'hi' ? 'हिंदी सत्र' : 'English Session'}
        </span>
      </div>

      <div className="checkin-grid animate-in animate-in-delay-1">
        {/* Left column: The Chat Interface */}
        <div className="checkin-chat-col">
          <div className="chat-container">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line-faint)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#fff', boxShadow: 'var(--shadow-sm)' }}>
                  {locale === 'hi' ? 'अ' : 'En'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <strong style={{ fontSize: '0.94rem' }}>{selectedCase}</strong>
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-pale)', color: 'var(--accent)', fontWeight: 600 }}>
                      {channel.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    {locale === 'hi' ? 'दैनिक संबल एवं कल्याण संवाद' : 'Daily Well-being Check-in'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', padding: '0.2rem 0.65rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', fontWeight: 500 }}>
                  {messages.filter((m) => m.speaker === 'person').length} responses
                </span>
              </div>
            </div>

            {/* Pinned Emergency SOS Banner */}
            {crisisActive && (
              <div className="crisis-sos-banner" role="alert">
                <div className="crisis-sos-header">
                  <div className="crisis-sos-badge">
                    <span className="crisis-pulsing-dot" />
                    <span>{locale === 'hi' ? '🚨 संकट सहायता सक्रिय · परामर्शदाता को सूचित किया गया' : '🚨 Crisis Support Active · Counsellor Alerted'}</span>
                  </div>
                  <div className="crisis-sos-actions">
                    <a
                      href="tel:14416"
                      className="btn-sos"
                      aria-label={locale === 'hi' ? 'Tele-MANAS को 14416 पर कॉल करें' : 'Call Tele-MANAS at 14416'}
                    >
                      📞 {locale === 'hi' ? 'Tele-MANAS: 14416' : 'Call Tele-MANAS: 14416'}
                    </a>
                    <a
                      href="tel:18008914416"
                      className="btn-sos-secondary"
                      title="Toll-free 1-800-891-4416"
                    >
                      1-800-891-4416
                    </a>
                    <a
                      href="tel:112"
                      className="btn-sos-emergency"
                      title="National Emergency Helpline 112"
                    >
                      🚨 112
                    </a>
                  </div>
                </div>
                <p className="crisis-sos-desc">
                  {locale === 'hi'
                    ? 'हमारी सहायता टीम को सूचित कर दिया गया है। प्रशिक्षित परामर्शदाता 24/7 सहायता के लिए उपलब्ध हैं। आपको अकेले इससे नहीं गुज़रना है।'
                    : 'A dedicated welfare officer has received an immediate alert and will follow up. Tele-MANAS counsellors are available 24/7 in your language.'}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-muted)', fontSize: '0.92rem' }}>
                  Starting check-in conversation...
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i}>
                  <div className={`chat-bubble ${m.speaker} ${m.isCrisis ? 'crisis-system' : ''}`}>
                    {m.isCrisis && (
                      <div className="crisis-msg-tag">
                        🛡️ {locale === 'hi' ? 'सहायता एवं सुरक्षा' : 'Support & Safety'}
                      </div>
                    )}
                    {m.text}
                  </div>
                  {m.time && (
                    <div className={`msg-timestamp`} style={{ textAlign: m.speaker === 'system' ? 'left' : 'right' }}>
                      {formatTime(m.time)}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div>
                  <div className="chat-bubble system" style={{ opacity: 0.9 }}>
                    <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span className="typing-dot" style={{ animationDelay: '0s' }}>●</span>
                      <span className="typing-dot" style={{ animationDelay: '0.15s' }}>●</span>
                      <span className="typing-dot" style={{ animationDelay: '0.3s' }}>●</span>
                    </span>
                    {' '}Analysing response & checking well-being...
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {/* Quick crisis de-escalation chips (anchored directly above input) */}
            {crisisActive && (
              <div className="crisis-chips-row">
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', alignSelf: 'center', fontWeight: 600, flexShrink: 0 }}>
                  {locale === 'hi' ? 'त्वरित उत्तर:' : 'Quick reply:'}
                </span>
                {(locale === 'hi'
                  ? ['मैं अभी सुरक्षित जगह पर हूँ', 'मुझे बस कोई सुनने वाला चाहिए', 'मैं बहुत थका हुआ महसूस कर रहा हूँ']
                  : ["I'm in a safe place right now", 'I just need someone to listen', "I'm feeling completely exhausted"]
                ).map((chipText) => (
                  <button
                    key={chipText}
                    type="button"
                    className="crisis-chip-btn"
                    disabled={busy}
                    onClick={() => {
                      setInput(chipText);
                    }}
                  >
                    {chipText}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="chat-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={locale === 'hi' ? 'अपना जवाब लिखें...' : 'Type your reply...'}
                disabled={busy}
                aria-label={locale === 'hi' ? 'अपना जवाब टाइप करें' : 'Type your reply'}
              />
              <button className="btn" onClick={sendReply} disabled={busy || !input.trim()} aria-label={locale === 'hi' ? 'भेजें' : 'Send reply'}>
                {locale === 'hi' ? 'भेजें' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Monitoring, Voice & Check-in Controls */}
        <div className="checkin-sidebar-col">
          {/* Assessment summary — transparent scoring panel */}
          {lastAssessment ? (
            <AssessmentPanel assessment={lastAssessment} />
          ) : (
            <div className="card" style={{ padding: '1.25rem', background: 'var(--surface-sunken)', border: '1.5px dashed var(--line-strong)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>Live Distress Monitoring</strong>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {locale === 'hi'
                  ? 'जैसे ही आप चेक-इन संदेश भेजेंगे, सिस्टम लाइव संकट स्कोर और स्पष्टीकरण प्रस्तुत करेगा।'
                  : 'As you chat, the AI dynamically computes a distress score, emotional signals, and trajectory indicators.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                <span>🔒 Confidential & Triage-only</span>
              </div>
            </div>
          )}

          {/* Voice pattern */}
          <VoicePatternIndicator caseId={selectedCase} enabled={channel === 'app'} />

          {/* Channel selector */}
          <div className="card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-soft)', marginBottom: '0.45rem' }}>
              Check-in Channel
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setChannel(ch.id)}
                  style={{
                    padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-full)',
                    border: channel === ch.id ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                    background: channel === ch.id ? 'var(--accent-pale)' : 'transparent',
                    color: channel === ch.id ? 'var(--accent)' : 'var(--ink-muted)',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all var(--duration-fast)', font: 'inherit',
                  }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '0.45rem' }}>
              {channel === 'sms' ? 'Simulated SMS gateway' : channel === 'ivrs' ? 'Simulated IVRS voice telephony' : 'Native App channel (Web)'}
            </div>
          </div>

          {/* Consent acknowledgment */}
          {!consentGiven && (
            <label className="card" style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.85rem 1rem',
              background: 'var(--warm-pale)', borderRadius: 'var(--radius)', fontSize: '0.8rem', color: 'var(--ink-soft)',
              cursor: 'pointer', border: '1px solid rgba(184, 134, 11, 0.18)', lineHeight: 1.45,
            }}>
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={() => {
                  setConsentGiven(true);
                  try {
                    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? '{}');
                    stored[selectedCase] = true;
                    localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
                  } catch { /* ignore */ }
                }}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: '0.15rem' }}
              />
              <span>
                <strong>Confidentiality Consent:</strong> I understand this check-in connects me with support, and my responses are reviewed by my assigned welfare officer.
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Transparent scoring panel — shows WHY the score is what it is.
 * This is the key demo moment: victim types something, sees the score change,
 * and understands exactly what drove it.
 */
function AssessmentPanel({ assessment }) {
  const [expanded, setExpanded] = useState(true);
  if (!assessment) return null;
  const { score, band, explanation, emotions, prediction, escalation, signals, provenance } = assessment;
  const drivers = explanation?.drivers ?? [];
  const bandColors = { low: '#4a7c59', moderate: '#a0722e', elevated: '#c45d3a', high: '#8b2e23' };
  const bandBg = { low: 'rgba(74,124,89,0.12)', moderate: 'rgba(160,114,46,0.12)', elevated: 'rgba(196,93,58,0.12)', high: 'rgba(139,46,35,0.12)' };

  return (
    <div
      role="status"
      aria-live="polite"
      className="card card-elevated"
      style={{
        borderRadius: 'var(--radius)',
        border: escalation?.triggered ? '1.5px solid var(--risk-elevated)' : '1px solid var(--line-strong)',
        background: escalation?.triggered ? 'var(--risk-high-bg)' : 'var(--surface)',
        animation: 'fadeIn 0.3s var(--ease-out)',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Score header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '0.85rem 1.1rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          background: escalation?.triggered ? 'rgba(186, 26, 26, 0.06)' : 'transparent',
          borderBottom: expanded ? '1px solid var(--line-faint)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.4rem', color: bandColors[band] || 'var(--ink)' }}>{score}</span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
            padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
            background: bandBg[band] || 'var(--surface-sunken)', color: bandColors[band] || 'var(--ink)',
            letterSpacing: '0.04em',
          }}>{band}</span>
        </div>
        {escalation?.triggered && (
          <span style={{ color: 'var(--risk-high)', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            ⚠️ Escalated
          </span>
        )}
        {emotions?.primaryEmotion && (
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            Emotion: <strong>{emotions.primaryEmotion}</strong>
          </span>
        )}
        <span style={{ color: 'var(--ink-muted)', marginLeft: 'auto', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {provenance?.source === 'live' ? '🟢 Live LLM' : '📋 Cached'}
          <span style={{ marginLeft: '0.35rem', fontSize: '0.85rem' }}>{expanded ? '▴' : '▾'}</span>
        </span>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div style={{ padding: '0.85rem 1.1rem 1.1rem' }}>
          {/* Explanation headline */}
          {explanation?.headline && (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--ink-soft)', fontStyle: 'italic', lineHeight: 1.45 }}>
              "{explanation.headline}"
            </p>
          )}

          {/* Component breakdown bars */}
          {drivers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', margin: '0.5rem 0' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Score Drivers
              </span>
              {drivers.map((d) => (
                <div key={d.component}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>{d.label}</span>
                    <span style={{ color: 'var(--ink-muted)' }}>{d.contribution} pts ({d.sharePct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--line-faint)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${Math.min(100, d.sharePct)}%`,
                      background: bandColors[band] || 'var(--accent)', opacity: 0.8,
                      transition: 'width 0.5s ease-out',
                    }} />
                  </div>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--ink-muted)', lineHeight: 1.35 }}>
                    {d.detail}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Signal phrases — person's own words */}
          {explanation?.signalPhrases?.length > 0 && (
            <div style={{ margin: '0.75rem 0 0.5rem', padding: '0.6rem 0.85rem', background: 'var(--warm-pale)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.25rem' }}>
                Person's own words:
              </span>
              {explanation.signalPhrases.map((p, i) => (
                <span key={i} style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--ink-soft)', display: 'inline-block', marginRight: '0.4rem' }}>
                  "{p}"{i < explanation.signalPhrases.length - 1 ? ',' : ''}
                </span>
              ))}
            </div>
          )}

          {/* Prediction */}
          {prediction?.predicted && (
            <div style={{
              margin: '0.65rem 0 0.4rem', padding: '0.6rem 0.85rem',
              background: prediction.estimatedDaysToThreshold <= 14 ? 'var(--risk-high-bg)' : 'var(--risk-moderate-bg)',
              borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
            }}>
              <strong>Prediction:</strong> Escalation estimated in ~{prediction.estimatedDaysToThreshold} days ({prediction.estimatedDate}).
              {prediction.courtDateRisk && <span style={{ color: 'var(--risk-high)' }}> Court date within window.</span>}
            </div>
          )}

          {/* Escalation reasons */}
          {escalation?.triggered && escalation.triggerReasons?.length > 0 && (
            <div style={{ margin: '0.65rem 0 0', borderTop: '1px solid var(--line-faint)', paddingTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--risk-high)' }}>Escalation reasons:</span>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem' }}>
                {escalation.triggerReasons.map((r) => (
                  <li key={r.code} style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{r.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
