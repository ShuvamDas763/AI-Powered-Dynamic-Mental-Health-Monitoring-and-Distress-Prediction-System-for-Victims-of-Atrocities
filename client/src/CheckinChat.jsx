import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api.js';
import VoicePatternIndicator from './VoicePatternIndicator.jsx';
import { IconChat, IconAlert, IconCheck, IconClock, IconPhone, IconShield, IconLock, IconCheckCircle } from './GovernmentBranding.jsx';

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
        if (channels.length > 0) {
          if (!channels.includes(channel)) {
            setChannel(channels[0]);
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
    }, 400);
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
          reason: 'Victim requested consent revocation through portal',
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
                ? 'नियमित संवाद के लिए आपकी सक्रिय सहमति आवश्यक है। संवाद जारी रखने के लिए कृपया "सहमति एवं अधिकार" में जाकर सहमति सक्षम करें।'
                : 'Active consent is required for routine well-being check-ins. Please enable check-in dialogue in Consent & Rights to continue.',
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
            <h1>{locale === 'hi' ? 'दैनिक संबल एवं कल्याण संवाद' : 'Well-being Support & Check-in'}</h1>
            <p>
              {locale === 'hi'
                ? 'अपने नामित कल्याण अधिकारी से जुड़ें। आपकी बात पूर्णतः गोपनीय एवं सुरक्षित है।'
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

        <div className="card card-elevated animate-in animate-in-delay-1" style={{ maxWidth: '52rem' }}>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.5rem' }}>
            {locale === 'hi' ? 'अपना केस प्रोफाइल चुनें' : 'Select your case record'}
          </h2>
          <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
            {locale === 'hi'
              ? 'गोपनीय संवाद प्रारंभ करने के लिए अपना विवरण चुनें:'
              : 'Choose your case profile to start your confidential dialogue:'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '0.85rem' }}>
            {availableCases.map((c, i) => (
              <button
                key={c.caseId}
                className="card card-interactive"
                style={{ textAlign: 'left', padding: '1.1rem' }}
                onClick={() => selectCase(c.caseId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {c.locale === 'hi' ? 'अ' : 'En'}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>{c.label}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>{c.desc}</div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.2rem', display: 'inline-block' }}>
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
      {/* Top Controls: Safe Exit & Case Meta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          className="back-link animate-in"
          onClick={() => { setSelectedCase(null); setMessages([]); setCrisisActive(false); }}
          style={{ margin: 0 }}
        >
          &larr; {locale === 'hi' ? 'केस बदलें' : 'Change case'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setCamouflaged(true)}
            title="Instantly switch to neutral weather screen for privacy and safety"
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 'var(--radius-full)', fontWeight: 600 }}
          >
            🛡️ {locale === 'hi' ? 'सुरक्षित निकास' : 'Safe Exit'}
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
            Active Case: <strong style={{ color: 'var(--ink)' }}>{selectedCase}</strong> · {locale === 'hi' ? 'हिंदी' : 'English'}
          </span>
        </div>
      </div>

      {/* Paused Check-ins Banner (if consent revoked) */}
      {isConsentRevoked && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'var(--surface-sunken)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
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
              ? 'सहारा याद रखता है कि आपने कहाँ छोड़ा था। जब भी आप तैयार महसूस करें, संवाद पुनः शुरू कर सकते हैं। 24/7 निःशुल्क आपातकालीन हेल्पलाइन सहायता सदैव उपलब्ध है।'
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

      {/* Main 2-Column Grid */}
      <div className="checkin-grid animate-in animate-in-delay-1">
        {/* Left column: Dignified Chat Interface */}
        <div className="checkin-chat-col">
          <div className="chat-container">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line-faint)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40,
                  height: 40,
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
                  <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
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

            {/* Pinned Emergency SOS Banner - Calm, Non-Sensational */}
            {crisisActive && (
              <div className="crisis-sos-banner" role="alert">
                <div className="crisis-sos-header">
                  <div className="crisis-sos-badge">
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--risk-high)', display: 'inline-block' }} />
                    <span>
                      {locale === 'hi' ? 'आपको तुरंत सहायता की आवश्यकता हो सकती है' : 'You may need immediate support.'}
                    </span>
                  </div>
                  <div className="crisis-sos-actions">
                    <a
                      href="tel:14416"
                      className="btn-sos"
                      aria-label={locale === 'hi' ? 'Tele-MANAS को 14416 पर कॉल करें' : 'Call Tele-MANAS at 14416'}
                    >
                      <IconPhone size={14} color="#fff" />
                      <span>{locale === 'hi' ? 'Tele-MANAS: 14416' : 'Call Tele-MANAS: 14416'}</span>
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
                      Helpline 112
                    </a>
                  </div>
                </div>
                <p className="crisis-sos-desc">
                  {locale === 'hi'
                    ? 'आप अकेले नहीं हैं। आपके कल्याण दल को सूचित किया गया है। प्रशिक्षित परामर्शदाता 24/7 निःशुल्क और पूर्णतः गोपनीय सहायता के लिए उपलब्ध हैं।'
                    : 'You do not have to carry this alone. Dedicated counsellors are available right now to speak with you in complete confidence, and your welfare officer has received a priority support request.'}
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
                      <div className="crisis-msg-tag">
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
                      <span className="typing-dot" style={{ animationDelay: '0s' }}>●</span>
                      <span className="typing-dot" style={{ animationDelay: '0.15s' }}>●</span>
                      <span className="typing-dot" style={{ animationDelay: '0.3s' }}>●</span>
                    </span>
                    {' '}{locale === 'hi' ? 'संवाद सुरक्षित रूप से दर्ज हो रहा है...' : 'Recording your check-in securely...'}
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {/* Quick response thought chips */}
            <div className="crisis-chips-row">
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', alignSelf: 'center', fontWeight: 700, flexShrink: 0 }}>
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
                placeholder={locale === 'hi' ? 'अपनी बात यहाँ लिखें...' : 'Type your message at your own pace...'}
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
        <div className="checkin-sidebar-col">
          {/* Timeline: WHAT HAPPENS NEXT */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.15rem' }}>🌱</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {locale === 'hi' ? 'आगे क्या होगा' : 'What Happens Next'}
                </strong>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, background: 'var(--accent-pale)', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)' }}>
                {locale === 'hi' ? 'सहारा संबल' : 'Support Path'}
              </span>
            </div>

            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
              {locale === 'hi'
                ? 'सहारा याद रखता है कि आपने कहाँ छोड़ा था। आपकी जानकारी आपके नामित कल्याण अधिकारी के पास सुरक्षित रहती है।'
                : 'Sahara remembers where you left off. Your responses remain confidential with your designated welfare officer.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Step 1: Today */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: 24,
                  height: 24,
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
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
                    {locale === 'hi' ? 'आज: संवाद उपलब्ध' : 'Today: Check-in available'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.4 }}>
                    {lastSubmittedAt
                      ? (locale === 'hi' ? `संवाद दर्ज हुआ (${formatTime(lastSubmittedAt)})` : `Response recorded at ${formatTime(lastSubmittedAt)}`)
                      : (locale === 'hi' ? 'अपनी गति से उत्तर दें। कोई जल्दबाज़ी नहीं है।' : 'Share thoughts at your own pace. There is no rush.')}
                  </div>
                </div>
              </div>

              {/* Step 2: Support follow-up */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--surface-deep)',
                  color: 'var(--ink-soft)',
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
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
                    {locale === 'hi' ? 'आगामी: संबल समीक्षा' : 'Upcoming: Support follow-up'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.4 }}>
                    {locale === 'hi'
                      ? 'आपका कल्याण दल आपके समय के साथ आए परिवर्तनों की समीक्षा कर सकता है।'
                      : 'Your support team reviews trends over time and coordinates assistance.'}
                  </div>
                </div>
              </div>

              {/* Step 3: Legal / Case Milestone */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--surface-deep)',
                  color: 'var(--ink-soft)',
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
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
                    {locale === 'hi' ? 'प्रक्रिया पड़ाव: नियत चरण' : 'Upcoming: Case milestone'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.4 }}>
                    {locale === 'hi'
                      ? 'विशेष न्यायालय व राहत योजना के अंतर्गत सुरक्षा एवं सहायता निरंतर है।'
                      : 'Statutory review & relief coordination under SC/ST PoA Act protections.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Channel Preference: Choose how Sahara communicates */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.35rem' }}>
              {locale === 'hi' ? 'सहारा आपसे कैसे संवाद करे' : 'Choose how Sahara communicates with you'}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '0 0 0.75rem', lineHeight: 1.45 }}>
              {locale === 'hi'
                ? 'चुनें कि आप किस माध्यम से सहजता और शांति से संदेश प्राप्त करना चाहते हैं:'
                : 'Select the channel that feels safest and most comfortable for gentle check-in reminders:'}
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
              {channel === 'sms' ? 'SMS: Discreet text message prompts.' : channel === 'ivrs' ? 'IVRS Voice: Scheduled automated audio call.' : channel === 'web' ? 'Web Portal: Browser-based check-in.' : 'App: Discreet mobile application reminders.'}
            </div>
          </div>

          {/* Optional Voice Acoustic Check */}
          <VoicePatternIndicator
            caseId={selectedCase}
            enabled={channel === 'app' || channel === 'web'}
            hasVoiceConsent={hasVoiceConsent}
            onRequestConsent={() => setShowConsentModal(true)}
          />

          {/* Consent & Victim Rights Management Card */}
          <div className="card" style={{ padding: '1.25rem', background: 'var(--surface-sunken)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink)' }}>
                {locale === 'hi' ? 'सहमति एवं नागरिक अधिकार' : 'Consent & Victim Rights'}
              </div>
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
                  {locale === 'hi' ? 'सहमति वापस लें' : 'Revoke Consent'}
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

          {/* Emergency / Crisis Helplines Card (Always Visible) */}
          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--risk-high)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🚨</span>
              <strong style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? '24/7 आपातकालीन एवं संकट हेल्पलाइन' : '24/7 Crisis & Emergency Helplines'}
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                <div>
                  <strong>Tele-MANAS</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>National Mental Health Helpline</div>
                </div>
                <a href="tel:14416" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>14416</a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                <div>
                  <strong>National Emergency</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>Police, Medical, Fire</div>
                </div>
                <a href="tel:112" style={{ color: 'var(--risk-high)', fontWeight: 800, textDecoration: 'none' }}>112</a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid var(--line-faint)' }}>
                <div>
                  <strong>National SC/ST Helpline</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>PoA Act Assistance</div>
                </div>
                <a href="tel:14566" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>14566</a>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
                <div>
                  <strong>KIRAN Helpline</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>Govt Mental Health Support</div>
                </div>
                <a href="tel:18005990019" style={{ color: 'var(--ink-soft)', fontWeight: 700, textDecoration: 'none' }}>1800-599-0019</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progressive Consent Modal — Centered on Victim Control & Dignity */}
      {showConsentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(28, 25, 23, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem', backdropFilter: 'blur(3px)',
        }}>
          <div className="card" style={{ maxWidth: '40rem', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', animation: 'fadeIn 0.2s var(--ease-out)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink)' }}>
                {locale === 'hi' ? 'आपकी सहमति एवं गोपनीयता नियंत्रण' : 'Your Consent & Privacy Controls'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'var(--accent-pale)', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                {locale === 'hi' ? 'पूर्णतः स्वैच्छिक' : 'Voluntary & In Your Control'}
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              {locale === 'hi'
                ? 'अनुसूचित जाति एवं अनुसूचित जनजाति (अत्याचार निवारण) अधिनियम के अंतर्गत आप पूर्ण नियंत्रण में हैं। सहमति का उपयोग केवल आपको समय पर मानवीय सहायता पहुँचाने के लिए किया जाता है।'
                : 'Under the SC/ST (Prevention of Atrocities) Protection framework, you remain in complete control. Your participation is voluntary, and these controls determine how Sahara supports you.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Question 1 & 2: WHY & WHAT & WHO */}
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
                      <div>• <strong>{locale === 'hi' ? 'क्यों (WHY):' : 'WHY:'}</strong> {locale === 'hi' ? 'ताकि आपका नामित कल्याण दल आपकी सहायता कर सके।' : 'So your designated district welfare officer can coordinate timely human support.'}</div>
                      <div>• <strong>{locale === 'hi' ? 'क्या (WHAT):' : 'WHAT:'}</strong> {locale === 'hi' ? 'संवाद में आपके द्वारा साझा किए गए विचार। कोई स्वचालित दंडात्मक अंकन नहीं।' : 'The thoughts and messages you choose to share. No automated punishments.'}</div>
                      <div>• <strong>{locale === 'hi' ? 'किन्हें दिखेगा (WHO):' : 'WHO:'}</strong> {locale === 'hi' ? 'केवल आपके अधिकृत कल्याण अधिकारी को। उच्च स्तर पर केवल अनाम सांख्यिकी दिखती है।' : 'Only your assigned welfare officer. Administrators see only anonymous aggregate counts.'}</div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Question 3: CHANNELS & GENTLE OUTREACH */}
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
                      <div>• <strong>{locale === 'hi' ? 'माध्यम (CHANNELS):' : 'CHANNELS:'}</strong> {locale === 'hi' ? 'आप चुनते हैं: ऐप, एसएमएस, स्वचालित ध्वनि कॉल (IVRS), या वेब पोर्टल।' : 'You choose: Mobile App, SMS text, scheduled IVRS voice call, or Web portal.'}</div>
                      <div>• <strong>{locale === 'hi' ? 'सौम्य नियम:' : 'GENTLE POLICY:'}</strong> {locale === 'hi' ? 'यदि आप उत्तर नहीं दे पाते हैं, तो सहारा आपको कभी दंडित या दोषी नहीं ठहराता।' : 'If you miss a check-in, Sahara never penalizes you; you can connect whenever you are ready.'}</div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Question 4: VOICE PRIVACY */}
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
                      <div>• <strong>{locale === 'hi' ? 'ध्वनि सुरक्षा:' : 'VOICE PRIVACY:'}</strong> {locale === 'hi' ? 'ध्वनि केवल आपके फोन के ब्राउज़र में जांची जाती है। ध्वनि कभी रिकॉर्ड या स्टोर नहीं की जाती।' : 'Processed exclusively on your device. Raw audio is never recorded, stored, or transmitted.'}</div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Question 5: HOW TO CHANGE */}
              <div style={{ padding: '0.85rem 1rem', background: 'var(--accent-pale)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--accent)', lineHeight: 1.5 }}>
                ℹ️ <strong>{locale === 'hi' ? 'सहमति बदलना:' : 'HOW TO CHANGE:'}</strong>{' '}
                {locale === 'hi'
                  ? 'आप जब चाहें तब सहमति वापस ले सकते हैं या बदल सकते हैं। इससे आपकी कानूनी सुरक्षा या मुआवजे पर कोई असर नहीं पड़ता। आपातकालीन सहायता (14416 / 112) हमेशा उपलब्ध रहती है।'
                  : 'You can modify preferences or pause check-ins at any time. This never affects your legal rights, police protection, or statutory compensation. 24/7 helplines remain permanently accessible.'}
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
                style={{ padding: '0.45rem 1.15rem' }}
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
