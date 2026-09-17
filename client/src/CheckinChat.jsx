import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api.js';
import VoicePatternIndicator from './VoicePatternIndicator.jsx';
import { IconChat, IconAlert, IconCheck, IconClock } from './GovernmentBranding.jsx';

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
  { id: 'web', label: 'Web' },
];

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
  const [consentRecord, setConsentRecord] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [crisisActive, setCrisisActive] = useState(false);
  const [camouflaged, setCamouflaged] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState(null);
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

  // Load server-authoritative consent
  const fetchConsent = useCallback(async (caseId) => {
    if (!caseId) return;
    try {
      const { ok, body } = await api(`/consent?caseId=${caseId}`);
      if (ok && body.consent) {
        setConsentRecord(body.consent);
        if (body.consent.channels && body.consent.channels.length > 0) {
          if (body.consent.channels.includes(channel)) {
            // Keep active
          } else {
            setChannel(body.consent.channels[0]);
          }
        }
      }
    } catch { /* ignore */ }
  }, [channel]);

  useEffect(() => {
    if (selectedCase) {
      fetchConsent(selectedCase);
    }
  }, [selectedCase, fetchConsent]);

  const availableCases = user?.caseId
    ? CASES.filter((c) => c.caseId === user.caseId)
    : CASES;

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function selectCase(caseId) {
    const c = CASES.find((x) => x.caseId === caseId);
    setSelectedCase(caseId);
    setLocale(c?.locale ?? 'en');
    setMessages([]);
    setCrisisActive(false);
    setLastSubmittedAt(null);

    const initialPrompt = c?.locale === 'hi' ? INITIAL_PROMPTS_HI : INITIAL_PROMPTS_EN;
    setTimeout(() => {
      setMessages([{ speaker: 'system', text: initialPrompt, time: new Date().toISOString() }]);
    }, 500);
  }

  async function updateConsent(purposes, channels) {
    if (!selectedCase) return;
    try {
      const { ok, body } = await api('/consent', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          purposes,
          channels: channels || [channel],
        }),
      });
      if (ok && body.consent) {
        setConsentRecord(body.consent);
      }
    } catch { /* ignore */ }
  }

  async function revokeConsent() {
    if (!selectedCase) return;
    try {
      const { ok, body } = await api('/consent/revoke', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          reason: 'Victim requested consent revocation through portal',
        }),
      });
      if (ok && body.consent) {
        setConsentRecord(body.consent);
        setShowConsentModal(false);
      }
    } catch { /* ignore */ }
  }

  async function sendReply() {
    const text = input.trim();
    if (!text || busy || !selectedCase) return;

    setInput('');
    const userMsg = { speaker: 'person', text, time: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setBusy(true);

    const hasConsent = consentRecord?.status === 'active' && consentRecord?.purposes?.includes('monitoring');

    try {
      const { ok, body } = await api('/checkin', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          turns: newMessages.map(({ speaker, text }) => ({ speaker, text })),
          locale,
          channel,
          consentAcknowledged: hasConsent,
        }),
      });

      setLastSubmittedAt(new Date().toISOString());

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
        { speaker: 'system', text: locale === 'hi' ? 'कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।' : 'Something went wrong. Please try again.', time: new Date().toISOString() },
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

  // Camouflage Mode: instantly disguises screen as a weather bulletin
  if (camouflaged) {
    return (
      <div className="card" style={{ maxWidth: '42rem', margin: '2rem auto', padding: '2rem', animation: 'fadeIn 0.2s var(--ease-out)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line-faint)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.25rem' }}>National Agro-Meteorological Weather Advisory</h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>India Meteorological Department (IMD) · Agro Bulletin</span>
          </div>
          <span style={{ fontSize: '1.8rem' }}>⛅</span>
        </div>
        <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 'var(--radius)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 0.5rem' }}><strong>Regional Agro Bulletin:</strong> Normal rainfall distribution expected across the sub-district zone. Relative humidity 62%.</p>
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Farmers are advised to maintain drain channels in standing Kharif crops to prevent temporary waterlogging.</p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setCamouflaged(false)}
          >
            ↺ Refresh Advisory
          </button>
        </div>
      </div>
    );
  }

  // Case selection screen
  if (!selectedCase) {
    return (
      <div>
        <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Well-being Check-in</h1>
            <p>Connect with your designated welfare officer for periodic support and protective assistance.</p>
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
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Select your case record</h2>
          <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
            Choose your case profile to start your confidential dialogue.
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

  const isConsentRevoked = consentRecord?.status === 'revoked';
  const hasVoiceConsent = consentRecord?.status === 'active' && consentRecord?.purposes?.includes('voice_analysis');

  // Chat interface
  return (
    <div className="checkin-layout">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          className="back-link animate-in"
          onClick={() => { setSelectedCase(null); setMessages([]); setCrisisActive(false); }}
        >
          &larr; Change case
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setCamouflaged(true)}
            title="Instantly switch to neutral weather screen for privacy and safety"
            style={{
              background: 'var(--surface-sunken)',
              border: '1px solid var(--line)',
              color: 'var(--ink-muted)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            🛡️ Safe Exit
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
            Active Case: <strong style={{ color: 'var(--ink)' }}>{selectedCase}</strong> · {locale === 'hi' ? 'हिंदी' : 'English'}
          </span>
        </div>
      </div>

      {isConsentRevoked && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'var(--risk-moderate-bg)',
          borderLeft: '4px solid var(--risk-moderate)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div>
            <strong>Monitoring Consent Paused:</strong> You previously revoked routine well-being monitoring. Duty-of-care emergency support remains active.
          </div>
          <button
            className="btn btn-sm"
            onClick={() => updateConsent(['monitoring', 'communication', 'voice_analysis'], [channel])}
            style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
          >
            Resume Monitoring
          </button>
        </div>
      )}

      <div className="checkin-grid animate-in animate-in-delay-1">
        {/* Left column: Dignified Chat Interface */}
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
                      {channel.toUpperCase()} CHANNEL
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    {locale === 'hi' ? 'दैनिक संबल एवं कल्याण संवाद' : 'Confidential Well-being Dialogue'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', padding: '0.2rem 0.65rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', fontWeight: 500 }}>
                  {messages.filter((m) => m.speaker === 'person').length} check-in entries
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
                    {' '}Recording your check-in securely...
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {/* Quick response chips */}
            <div className="crisis-chips-row">
              <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', alignSelf: 'center', fontWeight: 600, flexShrink: 0 }}>
                {locale === 'hi' ? 'त्वरित उत्तर:' : 'Quick thoughts:'}
              </span>
              {(locale === 'hi'
                ? ['आज थोड़ा बेहतर लग रहा है', 'मैं सुरक्षित जगह पर हूँ', 'मुझे परामर्शदाता से बात करनी है']
                : ["Feeling a bit better today", "I'm in a safe place", "I would like to speak with my counsellor"]
              ).map((chipText) => (
                <button
                  key={chipText}
                  type="button"
                  className="crisis-chip-btn"
                  disabled={busy}
                  onClick={() => setInput(chipText)}
                >
                  {chipText}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="chat-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={locale === 'hi' ? 'अपनी बात यहाँ लिखें...' : 'Type your message at your own pace...'}
                disabled={busy}
                aria-label={locale === 'hi' ? 'अपना जवाब टाइप करें' : 'Type your reply'}
              />
              <button className="btn" onClick={sendReply} disabled={busy || !input.trim()} aria-label={locale === 'hi' ? 'भेजें' : 'Send reply'}>
                {locale === 'hi' ? 'भेजें' : 'Send'}
              </button>
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--ink-faint)', textAlign: 'center' }}>
              🔒 Confidential & Protected under SC/ST (PoA) Act · Reviewed by your designated welfare officer
            </div>
          </div>
        </div>

        {/* Right column: Supportive Care & Rights Suite */}
        <div className="checkin-sidebar-col">
          {/* Supportive Care Status Card */}
          <div className="card" style={{ padding: '1rem 1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🌿</span>
              <strong style={{ fontSize: '0.94rem', color: 'var(--ink)' }}>Your Supportive Care Plan</strong>
            </div>

            <p style={{ margin: '0 0 0.85rem', fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
              You are enrolled in active well-being monitoring under the District SC/ST Welfare Cell.
              Your entries are reviewed by your assigned welfare officer to ensure timely support and safety.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8rem', background: 'var(--surface-sunken)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Cadence:</span>
                <strong>Weekly check-in schedule</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Assigned Unit:</span>
                <strong>District Atrocity Welfare Cell</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Next Scheduled:</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Active window</span>
              </div>
              {lastSubmittedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--line)', paddingTop: '0.35rem', marginTop: '0.2rem' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Last Check-in:</span>
                  <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>✓ Logged {formatTime(lastSubmittedAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Preferred Communication Channel */}
          <div className="card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '0.45rem' }}>
              Preferred Outreach Channel
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', margin: '0 0 0.6rem', lineHeight: 1.4 }}>
              Choose how you prefer Sahara to send you gentle check-in reminders:
            </p>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setChannel(ch.id);
                    if (consentRecord?.status === 'active') {
                      updateConsent(consentRecord.purposes, [ch.id]);
                    }
                  }}
                  style={{
                    padding: '0.3rem 0.75rem', borderRadius: 'var(--radius-full)',
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
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '0.5rem' }}>
              {channel === 'sms' ? 'SMS Gateway: Check-in prompts delivered by text message.' : channel === 'ivrs' ? 'IVRS Voice: Automated scheduled voice call.' : channel === 'web' ? 'Web Portal: Browser-based check-in.' : 'Native App: Mobile application notifications.'}
            </div>
          </div>

          {/* Optional Voice Acoustic Check */}
          <VoicePatternIndicator
            caseId={selectedCase}
            enabled={channel === 'app' || channel === 'web'}
            hasVoiceConsent={hasVoiceConsent}
            onRequestConsent={() => setShowConsentModal(true)}
          />

          {/* Server-Synced Consent & Rights Management */}
          <div className="card" style={{ padding: '0.85rem 1rem', background: 'var(--warm-pale)', border: '1px solid rgba(184, 134, 11, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink)' }}>
                Consent & Victim Rights
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                background: isConsentRevoked ? 'var(--risk-high-bg)' : 'var(--risk-low-bg)',
                color: isConsentRevoked ? 'var(--risk-high)' : 'var(--risk-low)',
              }}>
                {isConsentRevoked ? 'Revoked' : 'Active'}
              </span>
            </div>

            <p style={{ margin: '0 0 0.65rem', fontSize: '0.76rem', color: 'var(--ink-soft)', lineHeight: 1.45 }}>
              Participation is voluntary. You retain the right to modify or revoke consent at any time without compromising your legal rights or statutory protections.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowConsentModal(true)}
                style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem' }}
              >
                ⚙️ Manage Consent
              </button>
              {!isConsentRevoked ? (
                <button
                  className="btn btn-sm"
                  onClick={revokeConsent}
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem', background: 'transparent', color: 'var(--risk-high)', border: '1px solid var(--risk-high)' }}
                >
                  Revoke Consent
                </button>
              ) : (
                <button
                  className="btn btn-sm"
                  onClick={() => updateConsent(['monitoring', 'communication', 'voice_analysis'], [channel])}
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem' }}
                >
                  Re-grant Consent
                </button>
              )}
            </div>
          </div>

          {/* Emergency / Crisis Helplines Card (Always Visible) */}
          <div className="card card-elevated" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid var(--risk-high)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🚨</span>
              <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>24/7 Crisis & Emergency Helplines</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                <div>
                  <strong>Tele-MANAS</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>National Mental Health Helpline</div>
                </div>
                <a href="tel:14416" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>14416</a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                <div>
                  <strong>National Emergency</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>Police, Medical, Fire</div>
                </div>
                <a href="tel:112" style={{ color: 'var(--risk-high)', fontWeight: 700, textDecoration: 'none' }}>112</a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                <div>
                  <strong>National SC/ST Helpline</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>PoA Act Assistance</div>
                </div>
                <a href="tel:14566" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>14566</a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                <div>
                  <strong>KIRAN Helpline</strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)' }}>Govt Mental Health Support</div>
                </div>
                <a href="tel:18005990019" style={{ color: 'var(--ink-soft)', fontWeight: 600, textDecoration: 'none' }}>1800-599-0019</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '32rem', width: '100%', padding: '1.5rem', animation: 'fadeIn 0.2s var(--ease-out)' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Consent & Privacy Preferences</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Under the SC/ST (Prevention of Atrocities) Protection framework, you control what data is processed and how Sahara interacts with you.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={consentRecord?.purposes?.includes('monitoring') ?? true}
                  onChange={(e) => {
                    const cur = consentRecord?.purposes || ['monitoring', 'communication'];
                    const next = e.target.checked ? [...new Set([...cur, 'monitoring'])] : cur.filter((p) => p !== 'monitoring');
                    updateConsent(next, [channel]);
                  }}
                  style={{ accentColor: 'var(--accent)', marginTop: '0.2rem' }}
                />
                <div>
                  <strong>Well-being Monitoring</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                    Allows designated welfare officers to review check-ins and coordinate support.
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={consentRecord?.purposes?.includes('communication') ?? true}
                  onChange={(e) => {
                    const cur = consentRecord?.purposes || ['monitoring', 'communication'];
                    const next = e.target.checked ? [...new Set([...cur, 'communication'])] : cur.filter((p) => p !== 'communication');
                    updateConsent(next, [channel]);
                  }}
                  style={{ accentColor: 'var(--accent)', marginTop: '0.2rem' }}
                />
                <div>
                  <strong>Periodic Outreach & Reminders</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                    Receive scheduled check-in reminders via your chosen channel (App, SMS, IVRS).
                  </div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={hasVoiceConsent}
                  onChange={(e) => {
                    const cur = consentRecord?.purposes || ['monitoring', 'communication'];
                    const next = e.target.checked ? [...new Set([...cur, 'voice_analysis'])] : cur.filter((p) => p !== 'voice_analysis');
                    updateConsent(next, [channel]);
                  }}
                  style={{ accentColor: 'var(--accent)', marginTop: '0.2rem' }}
                />
                <div>
                  <strong>Voice Acoustic Analysis (Optional)</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                    Allows on-device acoustic pattern check. Raw audio is never stored or transmitted.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-faint)', paddingTop: '1rem' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={revokeConsent}
                style={{ color: 'var(--risk-high)' }}
              >
                Revoke All Consent
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setShowConsentModal(false)}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
