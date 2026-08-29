import { useState, useRef, useEffect } from 'react';
import { api } from './api.js';

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

const INITIAL_PROMPTS_EN = 'How have things been since we last checked in?';
const INITIAL_PROMPTS_HI = 'पिछली बार बात होने के बाद से चीज़ें कैसी रहीं?';

const FALLBACK_FOLLOW_UP_EN = 'Thank you for sharing that. Is there anything else you would like to talk about?';
const FALLBACK_FOLLOW_UP_HI = 'आपने जो बताया उसके लिए धन्यवाद। क्या और कुछ है जो आप बताना चाहेंगे?';

export default function CheckinChat() {
  const [selectedCase, setSelectedCase] = useState(null);
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState('app');
  const [lastAssessment, setLastAssessment] = useState(null);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function selectCase(caseId) {
    const c = CASES.find((x) => x.caseId === caseId);
    setSelectedCase(caseId);
    setLocale(c?.locale ?? 'en');
    setMessages([]);
    setLastAssessment(null);

    const initialPrompt = c?.locale === 'hi' ? INITIAL_PROMPTS_HI : INITIAL_PROMPTS_EN;
    setTimeout(() => {
      setMessages([{ speaker: 'system', text: initialPrompt }]);
    }, 500);
  }

  async function sendReply() {
    const text = input.trim();
    if (!text || busy || !selectedCase) return;

    setInput('');
    const userMsg = { speaker: 'person', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setBusy(true);

    try {      const { ok, body } = await api('/checkin', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          turns: newMessages,
          locale,
          channel,
        }),
      });

      if (ok && body.assessment) {
        setLastAssessment(body.assessment);
      }

      // Use the server-generated follow-up grounded in the person's last reply.
      const followUp = body.followUp
        || (locale === 'hi' ? FALLBACK_FOLLOW_UP_HI : FALLBACK_FOLLOW_UP_EN);

      setTimeout(() => {
        setMessages((prev) => [...prev, { speaker: 'system', text: followUp }]);
      }, 300);
    } catch {
      setMessages((prev) => [
        ...prev,
        { speaker: 'system', text: 'Something went wrong. Please try again.' },
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
        <div className="page-header animate-in">
          <h1>Check-in</h1>
          <p>Submit a check-in conversation. The system analyses each reply for support signals.</p>
        </div>

        <div className="card card-elevated animate-in animate-in-delay-1" style={{ maxWidth: '48rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Select a case</h2>
          <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
            In production this would be the victim's own session. For the demo, pick any case.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {CASES.map((c, i) => (
              <button
                key={c.caseId}
                className="card"
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  cursor: 'pointer',
                  border: '1.5px solid var(--line)',
                  animation: `fadeIn 0.3s var(--ease-out) ${i * 0.05}s both`,
                  transition: 'all var(--duration) var(--ease-out)',
                }}
                onClick={() => selectCase(c.caseId)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-light)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius)',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#fff',
                  }}>
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
    <div style={{ maxWidth: '48rem' }}>
      <button className="back-link animate-in" onClick={() => { setSelectedCase(null); setMessages([]); setLastAssessment(null); }}>
        &larr; Change case
      </button>

      <div className="card card-elevated animate-in animate-in-delay-1 chat-container" style={{ height: 'calc(100vh - 10rem)' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--line-faint)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#fff',
            }}>
              {locale === 'hi' ? 'अ' : 'En'}
            </div>
            <div>
          <strong style={{ fontSize: '0.9rem' }}>{selectedCase}</strong>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>
            {locale === 'hi' ? 'Hindi' : 'English'}
          </span>
          <span style={{
            fontSize: '0.72rem',
            padding: '0.15rem 0.5rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--accent-pale)',
            color: 'var(--accent)',
            fontWeight: 600,
            marginLeft: '0.25rem',
          }}>
            {channel.toUpperCase()}
          </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', padding: '0.2rem 0.6rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)' }}>
              {messages.filter((m) => m.speaker === 'person').length} replies
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
              Starting check-in conversation...
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.speaker}`}>
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="chat-bubble system" style={{ opacity: 0.7 }}>
              <span style={{ display: 'inline-flex', gap: '0.25rem' }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
              </span>
              {' '}Analysing...
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Assessment summary */}
        {lastAssessment && (
          <div style={{
            padding: '0.65rem 0.85rem',
            margin: '0.5rem 0',
            background: lastAssessment.escalation?.triggered ? 'var(--risk-high-bg)' : 'var(--surface-sunken)',
            borderRadius: 'var(--radius)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            flexWrap: 'wrap',
            border: lastAssessment.escalation?.triggered ? '1px solid var(--risk-elevated)' : 'none',
            animation: 'fadeIn 0.3s var(--ease-out)',
          }}>
            <span style={{ fontWeight: 700 }}>Score: {lastAssessment.score}</span>
            <span className={`band-badge band-${lastAssessment.band}`} style={{ fontSize: '0.72rem' }}>
              {lastAssessment.band}
            </span>
            {lastAssessment.escalation?.triggered && (
              <span style={{ color: 'var(--risk-high)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                ⚠ Escalated
              </span>
            )}
            <span style={{ color: 'var(--ink-muted)', marginLeft: 'auto', fontSize: '0.75rem' }}>
              {lastAssessment.provenance?.source === 'live' ? '🟢 Live' : '📋 Cached'}
            </span>
          </div>
        )}

        {/* Channel selector */}
        <div style={{ display: 'flex', gap: '0.3rem', padding: '0.5rem 0', borderTop: '1px solid var(--line-faint)' }}>
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-full)',
                border: channel === ch.id ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
                background: channel === ch.id ? 'var(--accent-pale)' : 'transparent',
                color: channel === ch.id ? 'var(--accent)' : 'var(--ink-muted)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--duration-fast)',
                font: 'inherit',
              }}
            >
              {ch.label}
            </button>
          ))}
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', alignSelf: 'center', marginLeft: '0.5rem' }}>
            {channel === 'sms' ? 'Simulated — no real gateway' : channel === 'ivrs' ? 'Simulated — no live telephony' : 'Live channel'}
          </span>
        </div>

        {/* Input */}
        <div className="chat-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={locale === 'hi' ? 'अपना जवाब लिखें...' : 'Type your reply...'}
            disabled={busy}
          />
          <button className="btn" onClick={sendReply} disabled={busy || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
