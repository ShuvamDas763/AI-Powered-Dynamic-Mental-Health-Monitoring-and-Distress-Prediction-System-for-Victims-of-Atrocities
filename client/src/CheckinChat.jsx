/**
 * CheckinChat — The Sahara Victim & Complainant Sanctuary.
 *
 * Implements Sections 27–32 & Creative Quality Gate:
 * - Low density, trauma-informed calm, conversational warmth
 * - Zero internal AI jargon (no raw risk scores, vectors, or prediction confidences)
 * - Empathetic question-response conversational pacing
 * - What Happens Next uncertainty reduction
 * - Transparent voluntary consent with granular control
 * - Instant Camouflage Safe Exit (IMD Weather advisory)
 * - Deterministic, non-sensational Crisis SOS banner with Tele-MANAS (14416) & 112
 * - Strictly authoritative server state persistence
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api.js';
import VoicePatternIndicator from './VoicePatternIndicator.jsx';
import {
  IconChat,
  IconShield,
  IconLock,
  IconPhone,
  IconCheck,
  IconClock,
  IconAlert,
  IconCheckCircle,
} from './GovernmentBranding.jsx';

const CASES = [
  { caseId: 'SIH-CASE-0001', label: 'Complainant A', desc: 'Hindi · Investigation · Baseline monitor', locale: 'hi' },
  { caseId: 'SIH-CASE-0002', label: 'Complainant B', desc: 'English · Trial · Intimidation risk', locale: 'en' },
  { caseId: 'SIH-CASE-0003', label: 'Complainant C', desc: 'English · Post-compensation · Improving', locale: 'en' },
  { caseId: 'SIH-CASE-0004', label: 'Complainant D', desc: 'English · Chargesheet · Social isolation', locale: 'en' },
  { caseId: 'SIH-CASE-0005', label: 'Complainant E', desc: 'English · Trial pending · Long-pending', locale: 'en' },
  { caseId: 'SIH-CASE-0006', label: 'Complainant F', desc: 'English · Investigation · Edge case', locale: 'en' },
  { caseId: 'SIH-CASE-0007', label: 'Complainant G', desc: 'English · Investigation · Sexual assault — withdrawal', locale: 'en' },
  { caseId: 'SIH-CASE-0008', label: 'Complainant H', desc: 'English · Chargesheet · Financial hardship', locale: 'en' },
];

const CHANNELS = [
  { id: 'app', label: 'Mobile App', desc: 'Discreet background reminders' },
  { id: 'web', label: 'Web Portal', desc: 'Private browser check-in' },
  { id: 'sms', label: 'SMS Text', desc: 'Simple text prompts' },
  { id: 'ivrs', label: 'IVRS Voice', desc: 'Scheduled automated audio calls' },
];

const INITIAL_PROMPTS_EN = 'How are things feeling today since we last checked in? Take all the time you need.';
const INITIAL_PROMPTS_HI = 'पिछली बार बात होने के बाद से आज मन और स्थिति कैसी लग रही है? अपनी गति से बताएं।';

const FALLBACK_FOLLOW_UP_EN = 'Thank you for sharing that with me. Is there anything else you would like to talk about today?';
const FALLBACK_FOLLOW_UP_HI = 'अपनी बात साझा करने के लिए धन्यवाद। क्या आज आप किसी और विषय पर बात करना चाहेंगे?';

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CheckinChat({ user }) {
  const [selectedCase, setSelectedCase] = useState(() => user?.caseId || null);
  const [locale, setLocale] = useState(() => {
    const c = CASES.find((x) => x.caseId === user?.caseId);
    return c?.locale || 'en';
  });
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
  const [activeSidebarTab, setActiveSidebarTab] = useState('horizon'); // 'horizon' | 'rights' | 'emergency'

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
      if (ok && body) {
        const record = body.record || body.consent || null;
        setConsentRecord(record);
        const channels = record?.channelsAllowed || record?.channels || [];
        if (channels.length > 0 && !channels.includes(channel)) {
          setChannel(channels[0]);
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

  useEffect(() => {
    if (selectedCase && messages.length === 0) {
      const c = CASES.find((x) => x.caseId === selectedCase);
      const initialPrompt = (c?.locale || locale) === 'hi' ? INITIAL_PROMPTS_HI : INITIAL_PROMPTS_EN;
      setMessages([{ speaker: 'system', text: initialPrompt, time: new Date().toISOString() }]);
    }
  }, [selectedCase, locale]);

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
    }, 300);
  }

  async function updateConsent(purposesInput, channels) {
    if (!selectedCase) return;
    let purposesObj = {
      monitoring: false,
      communication: false,
      voice_analysis: false,
    };
    if (Array.isArray(purposesInput)) {
      purposesObj = {
        monitoring: purposesInput.includes('monitoring'),
        communication: purposesInput.includes('communication'),
        voice_analysis: purposesInput.includes('voice_analysis'),
      };
    } else if (purposesInput && typeof purposesInput === 'object') {
      purposesObj = {
        monitoring: Boolean(purposesInput.monitoring),
        communication: Boolean(purposesInput.communication),
        voice_analysis: Boolean(purposesInput.voice_analysis),
      };
    }

    const currentChannels = consentRecord?.channelsAllowed || consentRecord?.channels || [channel];
    const channelsAllowed = channels && channels.length > 0 ? channels : currentChannels;

    try {
      const { ok, body } = await api('/consent', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          purposes: purposesObj,
          channelsAllowed,
        }),
      });
      if (ok && (body.record || body.consent)) {
        setConsentRecord(body.record || body.consent);
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
          reason: 'Complainant requested voluntary pause in check-ins',
        }),
      });
      if (ok && (body.record || body.consent)) {
        setConsentRecord(body.record || body.consent);
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

    const isConsentActive = Boolean(consentRecord && !consentRecord.revokedAt);
    const hasMonitoringConsent = isConsentActive && (
      Array.isArray(consentRecord?.purposes)
        ? consentRecord.purposes.includes('monitoring')
        : Boolean(consentRecord?.purposes?.monitoring)
    );

    try {
      const { ok, status, body } = await api('/checkin', {
        method: 'POST',
        body: JSON.stringify({
          caseId: selectedCase,
          turns: newMessages.map(({ speaker, text }) => ({ speaker, text })),
          locale,
          channel,
          consentAcknowledged: hasMonitoringConsent,
        }),
      });

      if (!ok) {
        if (body?.consentRequired || status === 403) {
          setMessages((prev) => [
            ...prev,
            {
              speaker: 'system',
              text: locale === 'hi'
                ? 'नियमित संवाद के लिए आपकी सक्रिय सहमति आवश्यक है। जब भी आप तैयार हों, आप "सहमति एवं अधिकार" से संवाद पुनः शुरू कर सकते हैं।'
                : 'Active consent is required for routine well-being check-ins. You can resume dialogue whenever you are ready in Rights & Preferences.',
              time: new Date().toISOString(),
            },
          ]);
          setShowConsentModal(true);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              speaker: 'system',
              text: body?.error || (locale === 'hi' ? 'कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।' : 'Something went wrong. Please try again.'),
              time: new Date().toISOString(),
            },
          ]);
        }
        setBusy(false);
        return;
      }

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
        {
          speaker: 'system',
          text: locale === 'hi' ? 'कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।' : 'Something went wrong. Please try again.',
          time: new Date().toISOString(),
        },
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

  // Camouflage Mode: instantly disguises screen as neutral weather bulletin for safety
  if (camouflaged) {
    return (
      <div className="card animate-in" style={{ maxWidth: '44rem', margin: '2rem auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line-faint)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.25rem' }}>National Agro-Meteorological Weather Advisory</h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>India Meteorological Department (IMD) · Agricultural Services Division</span>
          </div>
          <span style={{ fontSize: '2rem' }} aria-hidden="true">⛅</span>
        </div>
        <div style={{ background: 'var(--surface-sunken)', padding: '1.25rem', borderRadius: 'var(--radius)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 0.65rem' }}><strong>Regional Agro Bulletin:</strong> Normal rainfall distribution expected across the sub-district zone. Relative humidity 62%.</p>
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Farmers are advised to maintain drain channels in standing Kharif crops to prevent temporary waterlogging during the evening hours.</p>
        </div>
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCamouflaged(false)}
          >
            ↺ Refresh Advisory
          </button>
        </div>
      </div>
    );
  }

  // Case Selection View (if no case selected)
  if (!selectedCase) {
    return (
      <div>
        <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
              {locale === 'hi' ? 'गोपनीय कल्याण एवं संबल संवाद' : 'Confidential Well-being & Support Sanctuary'}
            </h1>
            <p style={{ maxWidth: '42rem', color: 'var(--ink-soft)', marginTop: '0.35rem' }}>
              {locale === 'hi'
                ? 'अपने नामित कल्याण अधिकारी से जुड़ें। आपकी बात पूर्णतः सुरक्षित है और अनुसूचित जाति/जनजाति सुरक्षा अधिनियम के अंतर्गत संरक्षित है।'
                : 'Connect with your designated welfare officer for periodic support and protective assistance under SC/ST Act protections.'}
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications && unreadCount > 0) markRead(); }}
              className="btn btn-secondary btn-sm"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              style={{ position: 'relative' }}
            >
              <IconChat size={16} />
              <span>{locale === 'hi' ? 'सूचनाएँ' : 'Messages'}</span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--risk-high)',
                  color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="card animate-in" style={{ position: 'absolute', top: 44, right: 0, width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 60, boxShadow: 'var(--shadow-lg)' }}>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>{locale === 'hi' ? 'सूचनाएँ' : 'Notifications'}</h3>
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                    {locale === 'hi' ? 'कोई नई सूचना नहीं है।' : 'No notifications yet.'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.map((n) => (
                      <div key={n.id} style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: n.readAt ? 'transparent' : 'var(--accent-pale)',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        borderLeft: n.readAt ? 'none' : '3px solid var(--accent)',
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

        <div className="card card-elevated animate-in animate-in-delay-1" style={{ maxWidth: '56rem', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.4rem', color: 'var(--ink)' }}>
            {locale === 'hi' ? 'अपना केस प्रोफाइल चुनें' : 'Select your case record to begin'}
          </h2>
          <p style={{ color: 'var(--ink-muted)', margin: '0 0 1.5rem', fontSize: '0.88rem' }}>
            {locale === 'hi'
              ? 'संवाद प्रारंभ करने के लिए अपना विवरण चुनें:'
              : 'Choose your case profile to start your confidential dialogue:'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {availableCases.map((c) => (
              <button
                key={c.caseId}
                className="card card-interactive"
                style={{ textAlign: 'left', padding: '1.15rem' }}
                onClick={() => selectCase(c.caseId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {c.locale === 'hi' ? 'अ' : 'En'}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.96rem', color: 'var(--ink)' }}>{c.label}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>{c.desc}</div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.25rem', display: 'inline-block' }}>
                      {c.caseId}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isConsentActive = Boolean(consentRecord && !consentRecord.revokedAt);
  const isConsentRevoked = Boolean(consentRecord && consentRecord.revokedAt);

  const hasPurpose = (purposeKey) => {
    if (!consentRecord || consentRecord.revokedAt) return false;
    if (!consentRecord.purposes) return false;
    if (Array.isArray(consentRecord.purposes)) {
      return consentRecord.purposes.includes(purposeKey);
    }
    return consentRecord.purposes[purposeKey] === true;
  };

  const hasMonitoringConsent = isConsentActive && hasPurpose('monitoring');
  const hasCommunicationConsent = isConsentActive && hasPurpose('communication');
  const hasVoiceConsent = isConsentActive && hasPurpose('voice_analysis');
  const allowedChannels = consentRecord?.channelsAllowed || consentRecord?.channels || [channel];

  return (
    <div className="checkin-layout">
      {/* Top Header Strip: Safe Exit + Context */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <button
          className="back-link animate-in"
          onClick={() => { setSelectedCase(null); setMessages([]); setCrisisActive(false); }}
          style={{ margin: 0 }}
        >
          &larr; {locale === 'hi' ? 'केस बदलें' : 'Change case profile'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setCamouflaged(true)}
            title="Instantly switch to neutral weather screen for privacy and safety"
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 'var(--radius-full)', fontWeight: 600, gap: '0.4rem' }}
          >
            <IconShield size={14} />
            <span>{locale === 'hi' ? 'सुरक्षित निकास' : 'Safe Exit'}</span>
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
            Active Profile: <strong style={{ color: 'var(--ink)' }}>{selectedCase}</strong> · {locale === 'hi' ? 'हिंदी' : 'English'}
          </span>
        </div>
      </div>

      {/* Paused Check-ins Reassurance Banner (if consent paused) */}
      {isConsentRevoked && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'var(--surface-sunken)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          border: '1px solid var(--line)',
        }}>
          <div>
            <strong>{locale === 'hi' ? 'संवाद स्थगित है:' : 'Check-ins Paused:'}</strong>{' '}
            {locale === 'hi'
              ? 'सहारा याद रखता है कि आपने कहाँ छोड़ा था। जब भी आप तैयार महसूस करें, संवाद पुनः शुरू कर सकते हैं।'
              : 'Sahara remembers where you left off. You can resume check-ins whenever you feel ready. 24/7 confidential helpline support remains available.'}
          </div>
          <button
            className="btn btn-sm"
            onClick={() => updateConsent(['monitoring', 'communication', 'voice_analysis'], [channel])}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
          >
            {locale === 'hi' ? 'संवाद पुनः प्रारंभ करें' : 'Resume Check-ins'}
          </button>
        </div>
      )}

      {/* Main 2-Column Grid: Left is Conversational Sanctuary; Right is Supportive Suite */}
      <div className="checkin-grid animate-in animate-in-delay-1">
        {/* Left column: Dignified Conversational Interface */}
        <div className="checkin-chat-col">
          <div className="chat-container">
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.85rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--line-faint)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#fff',
                  boxShadow: 'var(--shadow-xs)',
                }}>
                  {locale === 'hi' ? 'अ' : 'En'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.98rem', color: 'var(--ink)' }}>{selectedCase}</strong>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-pale)', color: 'var(--accent)', fontWeight: 700 }}>
                      {channel.toUpperCase()} CHANNEL
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    {locale === 'hi' ? 'दैनिक संबल एवं कल्याण संवाद' : 'Confidential Well-being Dialogue'}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', padding: '0.25rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                  {messages.filter((m) => m.speaker === 'person').length} check-in entries
                </span>
              </div>
            </div>

            {/* Pinned Emergency SOS Banner (Calm, Non-Flashing, Direct Action) */}
            {crisisActive && (
              <div className="crisis-sos-banner" role="alert">
                <div className="crisis-sos-header">
                  <div className="crisis-sos-badge">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--risk-high)', display: 'inline-block' }} />
                    <span>
                      {locale === 'hi' ? 'आपको तुरंत सहायता की आवश्यकता हो सकती है' : 'You may need immediate support right now.'}
                    </span>
                  </div>
                  <div className="crisis-sos-actions">
                    <a
                      href="tel:14416"
                      className="btn-sos"
                      aria-label="Call Tele-MANAS at 14416"
                    >
                      <IconPhone size={13} color="#fff" />
                      <span>Tele-MANAS: 14416</span>
                    </a>
                    <a
                      href="tel:112"
                      className="btn-sos-emergency"
                      title="National Emergency Helpline 112"
                    >
                      Helpline 112
                    </a>
                  </div>
                </div>
                <p className="crisis-sos-desc">
                  {locale === 'hi'
                    ? 'आप अकेले नहीं हैं। आपके कल्याण दल को सूचित किया गया है। प्रशिक्षित परामर्शदाता 24/7 निःशुल्क सहायता के लिए उपलब्ध हैं।'
                    : 'You do not have to carry this alone. Dedicated counsellors are available right now in complete confidence, and your welfare officer has received a priority support request.'}
                </p>
              </div>
            )}

            {/* Messages Area */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--ink-muted)', fontSize: '0.9375rem' }}>
                  {locale === 'hi' ? 'संवाद शुरू हो रहा है...' : 'Starting check-in conversation...'}
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i}>
                  <div className={`chat-bubble ${m.speaker} ${m.isCrisis ? 'crisis-system' : ''}`}>
                    {m.isCrisis && (
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--risk-high)', marginBottom: '0.35rem' }}>
                        🛡️ {locale === 'hi' ? 'संबल एवं सुरक्षा' : 'Immediate Care & Safety'}
                      </div>
                    )}
                    {m.text}
                  </div>
                  {m.time && (
                    <div className="msg-timestamp" style={{ textAlign: m.speaker === 'system' ? 'left' : 'right' }}>
                      {formatTime(m.time)}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div>
                  <div className="chat-bubble system" style={{ opacity: 0.9 }}>
                    <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span className="loading-pulse">●</span>
                      <span className="loading-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                      <span className="loading-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                    </span>
                    {' '}{locale === 'hi' ? 'संवाद सुरक्षित रूप से दर्ज हो रहा है...' : 'Recording your thoughts securely...'}
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {/* Quick response thought chips */}
            <div className="crisis-chips-row">
              <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', alignSelf: 'center', fontWeight: 700, flexShrink: 0 }}>
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

            {/* Input Row */}
            <div className="chat-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={locale === 'hi' ? 'अपनी बात यहाँ लिखें...' : 'Type your thoughts at your own pace...'}
                disabled={busy}
                aria-label={locale === 'hi' ? 'अपना जवाब टाइप करें' : 'Type your reply'}
              />
              <button
                className="btn"
                onClick={sendReply}
                disabled={busy || !input.trim()}
                aria-label={locale === 'hi' ? 'भेजें' : 'Send reply'}
              >
                {locale === 'hi' ? 'भेजें' : 'Send'}
              </button>
            </div>

            <div style={{ marginTop: '0.65rem', fontSize: '0.74rem', color: 'var(--ink-faint)', textAlign: 'center' }}>
              🔒 Confidential & Protected under SC/ST (PoA) Act · Reviewed by your designated welfare officer
            </div>
          </div>
        </div>

        {/* Right column: Supportive Care & Rights Suite */}
        <div className="checkin-sidebar-col" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Supportive Tab Switcher */}
          <div style={{
            display: 'flex',
            gap: '0.35rem',
            background: 'var(--surface-sunken)',
            padding: '0.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line-faint)',
          }}>
            {[
              { id: 'horizon', label: locale === 'hi' ? 'आगे क्या होगा' : 'What Next' },
              { id: 'rights', label: locale === 'hi' ? 'अधिकार व माध्यम' : 'Preferences' },
              { id: 'emergency', label: locale === 'hi' ? 'हेल्पलाइन' : 'Helplines' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSidebarTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: activeSidebarTab === tab.id ? 700 : 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeSidebarTab === tab.id ? '#FFFFFF' : 'transparent',
                  color: activeSidebarTab === tab.id ? 'var(--accent)' : 'var(--ink-muted)',
                  boxShadow: activeSidebarTab === tab.id ? 'var(--shadow-xs)' : 'none',
                  cursor: 'pointer',
                  transition: 'all var(--duration-fast)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: WHAT HAPPENS NEXT (HORIZON) */}
          {activeSidebarTab === 'horizon' && (
            <div className="card animate-in" style={{ padding: '1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {locale === 'hi' ? 'आगे क्या होगा' : 'What Happens Next'}
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-pale)', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)' }}>
                  Support Path
                </span>
              </div>

              <p style={{ margin: '0 0 1.25rem', fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                {locale === 'hi'
                  ? 'सहारा याद रखता है कि आपने कहाँ छोड़ा था। आपकी जानकारी केवल आपके नामित अधिकारी के पास सुरक्षित रहती है।'
                  : 'Sahara remembers where you left off. Your responses remain confidential with your designated welfare officer.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Step 1: Today */}
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: lastSubmittedAt ? 'var(--risk-low)' : 'var(--accent)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '0.1rem',
                  }}>
                    {lastSubmittedAt ? '✓' : '1'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>
                      {locale === 'hi' ? 'आज: संवाद उपलब्ध' : 'Today: Check-in available'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.45, marginTop: '0.15rem' }}>
                      {lastSubmittedAt
                        ? (locale === 'hi' ? `संवाद दर्ज हुआ (${formatTime(lastSubmittedAt)})` : `Response recorded at ${formatTime(lastSubmittedAt)}`)
                        : (locale === 'hi' ? 'अपनी गति से उत्तर दें। कोई जल्दबाज़ी नहीं है।' : 'Share thoughts at your own pace. There is no rush.')}
                    </div>
                  </div>
                </div>

                {/* Step 2: Support follow-up */}
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--surface-sunken)',
                    color: 'var(--ink-soft)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '0.1rem',
                  }}>
                    2
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>
                      {locale === 'hi' ? 'आगामी: संबल समीक्षा' : 'Upcoming: Support follow-up'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.45, marginTop: '0.15rem' }}>
                      {locale === 'hi'
                        ? 'आपका कल्याण दल आपके समय के साथ आए परिवर्तनों की समीक्षा कर सकता है।'
                        : 'Your support team reviews trends over time and coordinates assistance.'}
                    </div>
                  </div>
                </div>

                {/* Step 3: Legal / Case Milestone */}
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--surface-sunken)',
                    color: 'var(--ink-soft)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: '0.1rem',
                  }}>
                    3
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>
                      {locale === 'hi' ? 'प्रक्रिया पड़ाव: नियत चरण' : 'Upcoming: Case milestone'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.45, marginTop: '0.15rem' }}>
                      {locale === 'hi'
                        ? 'विशेष न्यायालय व राहत योजना के अंतर्गत सुरक्षा एवं सहायता निरंतर है।'
                        : 'Statutory review & relief coordination under SC/ST PoA Act protections.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RIGHTS & COMMUNICATION PREFERENCES */}
          {activeSidebarTab === 'rights' && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Channel Preference Card */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--ink)', display: 'block', marginBottom: '0.35rem' }}>
                  {locale === 'hi' ? 'सहारा आपसे कैसे संवाद करे' : 'Choose how Sahara communicates with you'}
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '0 0 0.85rem', lineHeight: 1.45 }}>
                  {locale === 'hi'
                    ? 'चुनें कि आप किस माध्यम से सहजता और शांति से संदेश प्राप्त करना चाहते हैं:'
                    : 'Select the channel that feels safest and most comfortable for gentle check-in reminders:'}
                </p>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setChannel(ch.id);
                        if (isConsentActive) {
                          updateConsent({
                            monitoring: hasMonitoringConsent,
                            communication: hasCommunicationConsent,
                            voice_analysis: hasVoiceConsent,
                          }, [ch.id]);
                        }
                      }}
                      className={`btn btn-sm ${channel === ch.id ? '' : 'btn-secondary'}`}
                      style={{ borderRadius: 'var(--radius-full)' }}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginTop: '0.55rem' }}>
                  {CHANNELS.find((c) => c.id === channel)?.desc}
                </div>
              </div>

              {/* Optional Voice Acoustic Check */}
              <VoicePatternIndicator
                caseId={selectedCase}
                enabled={channel === 'app' || channel === 'web'}
                hasVoiceConsent={hasVoiceConsent}
                onRequestConsent={() => setShowConsentModal(true)}
              />

              {/* Voluntary Consent Card */}
              <div className="card" style={{ padding: '1.25rem', background: 'var(--surface-sunken)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
                    {locale === 'hi' ? 'सहमति एवं नागरिक अधिकार' : 'Consent & Citizen Rights'}
                  </strong>
                  <span className={`band-badge ${isConsentRevoked ? 'band-high' : 'band-low'}`}>
                    {isConsentRevoked ? (locale === 'hi' ? 'स्थगित' : 'Revoked') : (locale === 'hi' ? 'सक्रिय' : 'Active')}
                  </span>
                </div>

                <p style={{ margin: '0 0 0.85rem', fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  {locale === 'hi'
                    ? 'संबल संवाद में भागीदारी पूर्णतः स्वैच्छिक है। आप अपनी सहमति कभी भी बदल या वापस ले सकते हैं।'
                    : 'Participation is voluntary. You retain the right to modify or revoke consent at any time without compromising your legal rights or statutory protections.'}
                </p>

                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowConsentModal(true)}
                  >
                    ⚙️ {locale === 'hi' ? 'सहमति प्रबंधित करें' : 'Manage Consent'}
                  </button>
                  {!isConsentRevoked ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={revokeConsent}
                      style={{ color: 'var(--risk-high)', borderColor: 'var(--risk-high)' }}
                    >
                      {locale === 'hi' ? 'सहमति वापस लें' : 'Pause Check-ins'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm"
                      onClick={() => updateConsent({ monitoring: true, communication: true, voice_analysis: false }, allowedChannels)}
                    >
                      {locale === 'hi' ? 'सहमति पुनः दें' : 'Re-grant Consent'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EMERGENCY HELPLINES */}
          {activeSidebarTab === 'emergency' && (
            <div className="card animate-in" style={{ padding: '1.4rem', borderLeft: '4px solid var(--risk-high)' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--ink)', display: 'block', marginBottom: '0.65rem' }}>
                {locale === 'hi' ? '24/7 आपातकालीन एवं संकट हेल्पलाइन' : '24/7 Crisis & Emergency Helplines'}
              </strong>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                  <div>
                    <strong style={{ display: 'block' }}>Tele-MANAS</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>National Mental Health Support (24x7)</span>
                  </div>
                  <a href="tel:14416" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none' }}>14416</a>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                  <div>
                    <strong style={{ display: 'block' }}>National Emergency</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>Police, Medical, Immediate Rescue</span>
                  </div>
                  <a href="tel:112" style={{ color: 'var(--risk-high)', fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none' }}>112</a>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0' }}>
                  <div>
                    <strong style={{ display: 'block' }}>National SC/ST Helpline</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>PoA Act Protections & Assistance</span>
                  </div>
                  <a href="tel:14566" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none' }}>14566</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progressive Consent Modal — Centered on Citizen Agency */}
      {showConsentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(28, 25, 23, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem', backdropFilter: 'blur(3px)',
        }}>
          <div className="card animate-in" style={{ maxWidth: '42rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? 'आपकी सहमति एवं गोपनीयता नियंत्रण' : 'Your Consent & Privacy Controls'}
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent)', background: 'var(--accent-pale)', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                {locale === 'hi' ? 'पूर्णतः स्वैच्छिक' : 'Voluntary & In Your Control'}
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1.5rem', lineHeight: 1.55 }}>
              {locale === 'hi'
                ? 'अनुसूचित जाति एवं अनुसूचित जनजाति (अत्याचार निवारण) अधिनियम के अंतर्गत आप पूर्ण नियंत्रण में हैं। सहमति का उपयोग केवल आपको समय पर मानवीय सहायता पहुँचाने के लिए किया जाता है।'
                : 'Under the SC/ST (Prevention of Atrocities) Protection framework, you remain in complete control. Your participation is voluntary, and these controls determine how Sahara supports you.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Question 1: WHY & WHAT */}
              <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-faint)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={hasMonitoringConsent}
                    onChange={(e) => {
                      updateConsent({
                        monitoring: e.target.checked,
                        communication: hasCommunicationConsent,
                        voice_analysis: hasVoiceConsent,
                      }, allowedChannels);
                    }}
                    style={{ accentColor: 'var(--accent)', marginTop: '0.25rem', width: 16, height: 16 }}
                  />
                  <div>
                    <strong style={{ color: 'var(--ink)' }}>{locale === 'hi' ? 'संबल संवाद एवं कल्याण समीक्षा' : 'Well-being Dialogue & Support Review'}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.45rem', lineHeight: 1.5 }}>
                      <div>• <strong>WHY:</strong> {locale === 'hi' ? 'ताकि आपका नामित कल्याण दल आपकी सहायता कर सके।' : 'So your designated district welfare officer can coordinate timely human support.'}</div>
                      <div>• <strong>WHAT:</strong> {locale === 'hi' ? 'संवाद में आपके द्वारा साझा किए गए विचार। कोई स्वचालित दंडात्मक अंकन नहीं।' : 'The thoughts and messages you choose to share. No automated punishments.'}</div>
                      <div>• <strong>WHO:</strong> {locale === 'hi' ? 'केवल आपके अधिकृत कल्याण अधिकारी को।' : 'Only your assigned welfare officer.'}</div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Question 2: CHANNELS & OUTREACH */}
              <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-faint)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={hasCommunicationConsent}
                    onChange={(e) => {
                      updateConsent({
                        monitoring: hasMonitoringConsent,
                        communication: e.target.checked,
                        voice_analysis: hasVoiceConsent,
                      }, allowedChannels);
                    }}
                    style={{ accentColor: 'var(--accent)', marginTop: '0.25rem', width: 16, height: 16 }}
                  />
                  <div>
                    <strong style={{ color: 'var(--ink)' }}>{locale === 'hi' ? 'नियमित सौम्य संदेश' : 'Periodic Gentle Outreach & Reminders'}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.45rem', lineHeight: 1.5 }}>
                      <div>• <strong>CHANNELS:</strong> Mobile App, SMS text, scheduled IVRS voice call, or Web portal.</div>
                      <div>• <strong>GENTLE POLICY:</strong> If you miss a check-in, Sahara never penalizes you; you can connect whenever you are ready.</div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Question 3: VOICE PRIVACY */}
              <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-faint)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={hasVoiceConsent}
                    onChange={(e) => {
                      updateConsent({
                        monitoring: hasMonitoringConsent,
                        communication: hasCommunicationConsent,
                        voice_analysis: e.target.checked,
                      }, allowedChannels);
                    }}
                    style={{ accentColor: 'var(--accent)', marginTop: '0.25rem', width: 16, height: 16 }}
                  />
                  <div>
                    <strong style={{ color: 'var(--ink)' }}>{locale === 'hi' ? 'वैकल्पिक ध्वनि पैटर्न जांच' : 'Voice Acoustic Pattern Check (Strictly Optional)'}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.45rem', lineHeight: 1.5 }}>
                      <div>• <strong>VOICE PRIVACY:</strong> Processed exclusively on your device. Raw audio is never recorded, stored, or transmitted.</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-faint)', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={revokeConsent}
                style={{ color: 'var(--risk-high)', borderColor: 'var(--risk-high)' }}
              >
                {locale === 'hi' ? 'सभी संवाद रोकें' : 'Pause All Check-ins'}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setShowConsentModal(false)}
                style={{ padding: '0.45rem 1.25rem' }}
              >
                {locale === 'hi' ? 'सुरक्षित करें एवं बंद करें' : 'Save Preferences & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
