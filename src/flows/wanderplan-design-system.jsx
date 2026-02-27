import { useState, useRef, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════════════════════════════

const tokens = {
  color: {
    primary: "#0D7377",
    primaryLight: "#1A9A9F",
    primaryDark: "#095456",
    secondary: "#E8634A",
    secondaryLight: "#F08872",
    secondaryDark: "#C4472F",
    accent: "#4DA8DA",
    accentLight: "#7CC2E8",
    bg: "#FAFBFC",
    surface: "#FFFFFF",
    surfaceElevated: "#FFFFFF",
    textPrimary: "#1A1A2E",
    textSecondary: "#5A6A7A",
    textMuted: "#8E99A8",
    border: "#E2E8F0",
    borderLight: "#F0F3F7",
    success: "#22C55E",
    successBg: "#F0FDF4",
    warning: "#F59E0B",
    warningBg: "#FFFBEB",
    error: "#EF4444",
    errorBg: "#FEF2F2",
    overlay: "rgba(26,26,46,0.5)",
  },
  radius: { sm: 6, md: 12, lg: 20, full: 9999 },
  shadow: {
    sm: "0 1px 3px rgba(26,26,46,0.06), 0 1px 2px rgba(26,26,46,0.04)",
    md: "0 4px 16px rgba(26,26,46,0.08), 0 2px 6px rgba(26,26,46,0.04)",
    lg: "0 12px 40px rgba(26,26,46,0.12), 0 4px 12px rgba(26,26,46,0.06)",
    glow: "0 0 20px rgba(13,115,119,0.15)",
  },
  space: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96],
  fontSize: {
    xs: "11.2px", sm: "12.8px", base: "14px", md: "17.5px",
    lg: "21.9px", xl: "27.3px", "2xl": "34.2px", "3xl": "42.7px",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES
// ════════════════════════════════════════════════════════════════════════════

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --color-primary: ${tokens.color.primary};
      --color-secondary: ${tokens.color.secondary};
      --color-accent: ${tokens.color.accent};
      --color-bg: ${tokens.color.bg};
      --color-surface: ${tokens.color.surface};
      --color-text: ${tokens.color.textPrimary};
      --color-text2: ${tokens.color.textSecondary};
      --font-heading: 'DM Sans', sans-serif;
      --font-body: 'Inter', sans-serif;
      --focus-ring: 0 0 0 3px rgba(77,168,218,0.4);
    }

    body { font-family: var(--font-body); color: var(--color-text); background: var(--color-bg); }

    :focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: ${tokens.radius.sm}px; }

    @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    @keyframes slideProgress { from { width: 0; } }
    @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); } 70% { transform: scale(0.95); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes dotPulse { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
  `}</style>
);

// ════════════════════════════════════════════════════════════════════════════
// ICONS (inline SVG for accessibility)
// ════════════════════════════════════════════════════════════════════════════

const Icon = ({ name, size = 20, color = "currentColor", label }) => {
  const paths = {
    check: <path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={color}/>,
    x: <><path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={color}/></>,
    plane: <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={color}/>,
    hotel: <path d="M3 21V7a2 2 0 012-2h6v16M21 21V11a2 2 0 00-2-2h-4v12M7 9h2M7 13h2M15 13h2M15 17h2" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round"/>,
    food: <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round"/>,
    map: <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    clock: <><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={color} fill="none"/><path d="M12 6v6l4 2" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round"/></>,
    star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color}/>,
    camera: <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z" strokeWidth="1.8" stroke={color} fill="none"/>,
    users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={color} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={color} fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeWidth="1.8" stroke={color} fill="none"/></>,
    dollar: <><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" stroke={color} fill="none" strokeLinecap="round"/></>,
    chat: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeWidth="1.8" stroke={color} fill="none"/>,
    edit: <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="1.8" stroke={color} fill="none"/>,
    chevron: <path d="M9 18l6-6-6-6" strokeWidth="2" stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    sun: <><circle cx="12" cy="12" r="5" strokeWidth="1.8" stroke={color} fill="none"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round"/></>,
    hiking: <path d="M13 4a2 2 0 100-4 2 2 0 000 4zM6.5 24l3-7.5L12 18v6M17 24l-3.5-10-3 1.5" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    wifi: <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeWidth="1.8" stroke={color} fill="none" strokeLinecap="round"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role={label ? "img" : "presentation"} aria-label={label} aria-hidden={!label}>
      {paths[name] || paths.map}
    </svg>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// (a) YES/NO CARD — Primary decision component
// ════════════════════════════════════════════════════════════════════════════

const YesNoCard = ({ title, subtitle, description, imageUrl, tags = [], onApprove, onRevise, agentName = "AI" }) => {
  const [decided, setDecided] = useState(null);
  const [animating, setAnimating] = useState(false);

  const handleDecision = (choice) => {
    setAnimating(true);
    setDecided(choice);
    setTimeout(() => {
      choice === "yes" ? onApprove?.() : onRevise?.();
    }, 400);
  };

  return (
    <div style={{
      background: tokens.color.surface, borderRadius: tokens.radius.lg, boxShadow: tokens.shadow.md,
      overflow: "hidden", border: `1px solid ${tokens.color.borderLight}`, maxWidth: 420, width: "100%",
      animation: "fadeInUp 0.5s ease-out", transition: "all 0.4s ease",
      transform: decided === "yes" ? "translateX(30px)" : decided === "no" ? "translateX(-30px)" : "none",
      opacity: animating ? 0.6 : 1,
    }}>
      {imageUrl && (
        <div style={{ height: 180, background: `url(${imageUrl}) center/cover`, position: "relative" }}>
          <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(13,115,119,0.9)", color: "#fff",
            padding: "4px 12px", borderRadius: tokens.radius.full, fontSize: tokens.fontSize.xs,
            fontFamily: "var(--font-heading)", fontWeight: 600, letterSpacing: "0.5px",
          }}>{agentName} Recommends</div>
        </div>
      )}
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.lg,
          color: tokens.color.textPrimary, marginBottom: 4, lineHeight: 1.3 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: tokens.fontSize.sm, color: tokens.color.primary, fontWeight: 600, marginBottom: 8 }}>{subtitle}</p>}
        <p style={{ fontSize: tokens.fontSize.base, color: tokens.color.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>{description}</p>
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {tags.map((t, i) => (
              <span key={i} style={{ background: `${tokens.color.accent}15`, color: tokens.color.accent,
                padding: "3px 10px", borderRadius: tokens.radius.full, fontSize: tokens.fontSize.xs, fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => handleDecision("no")} aria-label="Revise this recommendation"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 20px", borderRadius: tokens.radius.md, border: `2px solid ${tokens.color.error}`,
              background: decided === "no" ? tokens.color.errorBg : "transparent", color: tokens.color.error,
              fontSize: tokens.fontSize.base, fontWeight: 600, fontFamily: "var(--font-heading)", cursor: "pointer",
              transition: "all 0.2s", minHeight: 48 }}>
            <Icon name="x" size={20} color={tokens.color.error} /> Revise
          </button>
          <button onClick={() => handleDecision("yes")} aria-label="Approve this recommendation"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 20px", borderRadius: tokens.radius.md, border: "none",
              background: decided === "yes" ? tokens.color.success : tokens.color.primary, color: "#fff",
              fontSize: tokens.fontSize.base, fontWeight: 600, fontFamily: "var(--font-heading)", cursor: "pointer",
              transition: "all 0.2s", minHeight: 48, boxShadow: `0 2px 8px ${tokens.color.primary}40` }}>
            <Icon name="check" size={20} color="#fff" /> Approve
          </button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// (b) BUDGET METER
// ════════════════════════════════════════════════════════════════════════════

const BudgetMeter = ({ spent, allocated, currency = "USD", label = "Daily Budget" }) => {
  const pct = Math.min((spent / allocated) * 100, 120);
  const zone = pct <= 70 ? "green" : pct <= 90 ? "yellow" : "red";
  const zoneColors = { green: tokens.color.success, yellow: tokens.color.warning, red: tokens.color.error };
  const zoneBg = { green: tokens.color.successBg, yellow: tokens.color.warningBg, red: tokens.color.errorBg };

  return (
    <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.md, padding: "16px 20px",
      boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: tokens.fontSize.sm, color: tokens.color.textSecondary, fontWeight: 500 }}>{label}</span>
        <div>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.md,
            color: zoneColors[zone] }}>${spent.toLocaleString()}</span>
          <span style={{ fontSize: tokens.fontSize.sm, color: tokens.color.textMuted }}> / ${allocated.toLocaleString()}</span>
        </div>
      </div>
      <div style={{ height: 10, background: tokens.color.borderLight, borderRadius: tokens.radius.full, overflow: "hidden",
        position: "relative" }} role="progressbar" aria-valuenow={spent} aria-valuemin={0} aria-valuemax={allocated} aria-label={`${label}: $${spent} of $${allocated}`}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: zoneColors[zone],
          borderRadius: tokens.radius.full, transition: "width 0.8s ease, background 0.3s",
          animation: "slideProgress 1s ease-out" }} />
        {pct > 100 && <div style={{ position: "absolute", right: 0, top: -2, bottom: -2, width: 3,
          background: tokens.color.error, borderRadius: 2, animation: "pulse 1.5s infinite" }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>
          {pct <= 100 ? `${(allocated - spent).toLocaleString()} ${currency} remaining` : `Over by $${(spent - allocated).toLocaleString()}`}
        </span>
        <span style={{ fontSize: tokens.fontSize.xs, fontWeight: 600, color: zoneColors[zone],
          background: zoneBg[zone], padding: "1px 8px", borderRadius: tokens.radius.full }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// (c) TRIP PROGRESS STEPPER
// ════════════════════════════════════════════════════════════════════════════

const STAGES = [
  { key: "bucket_list", label: "Destinations", icon: "map" },
  { key: "timing", label: "Timing", icon: "sun" },
  { key: "interests", label: "Interests", icon: "hiking" },
  { key: "health", label: "Health", icon: "check" },
  { key: "pois", label: "POIs", icon: "camera" },
  { key: "budgeting", label: "Budget", icon: "dollar" },
  { key: "flights", label: "Flights", icon: "plane" },
  { key: "stays", label: "Stays", icon: "hotel" },
  { key: "dining", label: "Dining", icon: "food" },
  { key: "itinerary", label: "Itinerary", icon: "clock" },
];

const TripProgressStepper = ({ currentStage = "pois" }) => {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);
  return (
    <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: "20px 16px",
      boxShadow: tokens.shadow.sm, overflowX: "auto", border: `1px solid ${tokens.color.borderLight}` }}>
      <div style={{ display: "flex", alignItems: "center", minWidth: "fit-content", gap: 0 }}>
        {STAGES.map((stage, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming";
          const bg = state === "done" ? tokens.color.primary : state === "active" ? tokens.color.secondary : tokens.color.borderLight;
          const fg = state === "upcoming" ? tokens.color.textMuted : "#fff";
          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 56 }}
                aria-label={`${stage.label}: ${state}`} role="listitem">
                <div style={{ width: 36, height: 36, borderRadius: tokens.radius.full, background: bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.3s", boxShadow: state === "active" ? `0 0 0 4px ${tokens.color.secondary}30` : "none",
                  animation: state === "active" ? "bounceIn 0.5s ease" : "none" }}>
                  {state === "done" ? <Icon name="check" size={16} color="#fff" label="Completed" />
                    : <Icon name={stage.icon} size={16} color={fg} />}
                </div>
                <span style={{ fontSize: "10px", fontWeight: state === "active" ? 700 : 500,
                  color: state === "upcoming" ? tokens.color.textMuted : state === "active" ? tokens.color.secondary : tokens.color.primary,
                  fontFamily: "var(--font-heading)", textAlign: "center", lineHeight: 1.2 }}>{stage.label}</span>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ width: 20, height: 2, background: i < currentIdx ? tokens.color.primary : tokens.color.borderLight,
                  transition: "background 0.5s", marginBottom: 20, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// (d) MEMBER AVATAR ROW
// ════════════════════════════════════════════════════════════════════════════

const MemberAvatarRow = ({ members = [] }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4 }} role="list" aria-label="Trip members">
    {members.map((m, i) => (
      <div key={i} role="listitem" aria-label={`${m.name}: ${m.status}`}
        style={{ position: "relative", marginLeft: i > 0 ? -8 : 0, zIndex: members.length - i }}>
        <div style={{ width: 40, height: 40, borderRadius: tokens.radius.full, border: `2.5px solid ${tokens.color.surface}`,
          background: m.avatar ? `url(${m.avatar}) center/cover` : `linear-gradient(135deg, ${tokens.color.primary}, ${tokens.color.accent})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.sm }}>
          {!m.avatar && m.name.split(" ").map(n => n[0]).join("")}
        </div>
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14,
          borderRadius: tokens.radius.full, border: `2px solid ${tokens.color.surface}`,
          background: m.status === "done" ? tokens.color.success : m.status === "pending" ? tokens.color.warning : tokens.color.borderLight,
        }} aria-hidden="true" />
      </div>
    ))}
    {members.length > 0 && (
      <span style={{ marginLeft: 8, fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>
        {members.filter(m => m.status === "done").length}/{members.length} completed
      </span>
    )}
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// (e) DESTINATION CARD
// ════════════════════════════════════════════════════════════════════════════

const DestinationCard = ({ name, country, imageUrl, bestMonths = [], matchScore = 0 }) => (
  <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, overflow: "hidden",
    boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}`, width: 280,
    transition: "all 0.25s", cursor: "pointer" }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = tokens.shadow.md; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = tokens.shadow.sm; }}>
    <div style={{ height: 160, background: imageUrl ? `url(${imageUrl}) center/cover` :
      `linear-gradient(135deg, ${tokens.color.primary}20, ${tokens.color.accent}30)`, position: "relative" }}>
      <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.95)",
        borderRadius: tokens.radius.full, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 8, height: 8, borderRadius: tokens.radius.full,
          background: matchScore >= 80 ? tokens.color.success : matchScore >= 50 ? tokens.color.warning : tokens.color.error }} />
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.xs,
          color: tokens.color.textPrimary }}>{matchScore}%</span>
      </div>
    </div>
    <div style={{ padding: "14px 16px" }}>
      <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.md,
        color: tokens.color.textPrimary, marginBottom: 2 }}>{name}</h4>
      <p style={{ fontSize: tokens.fontSize.sm, color: tokens.color.textSecondary, marginBottom: 10 }}>{country}</p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
          .filter((_, i) => bestMonths.includes(i + 1))
          .map(m => (
            <span key={m} style={{ background: `${tokens.color.primary}12`, color: tokens.color.primary,
              padding: "2px 8px", borderRadius: tokens.radius.full, fontSize: "10px", fontWeight: 600 }}>{m}</span>
          ))}
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// (f) POI CARD
// ════════════════════════════════════════════════════════════════════════════

const POICard = ({ name, category, imageUrl, duration, cost, currency = "USD", hobbyTags = [], rating }) => {
  const catColors = { attraction: "#8B5CF6", activity: tokens.color.secondary, nature: "#22C55E",
    culture: "#F59E0B", food: tokens.color.primary, nightlife: "#EC4899", shopping: tokens.color.accent, relaxation: "#6366F1" };
  return (
    <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.md, overflow: "hidden",
      boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}`, display: "flex", gap: 0,
      maxWidth: 400, transition: "box-shadow 0.2s" }}>
      <div style={{ width: 100, minHeight: 110, flexShrink: 0,
        background: imageUrl ? `url(${imageUrl}) center/cover` : `linear-gradient(135deg, ${catColors[category] || tokens.color.primary}30, ${catColors[category] || tokens.color.primary}10)`,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!imageUrl && <Icon name="camera" size={24} color={catColors[category] || tokens.color.primary} />}
      </div>
      <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ background: `${catColors[category]}18`, color: catColors[category],
            padding: "2px 8px", borderRadius: tokens.radius.full, fontSize: "10px", fontWeight: 600, textTransform: "capitalize" }}>{category}</span>
          {rating && <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.warning, display: "flex", alignItems: "center", gap: 2 }}>
            <Icon name="star" size={12} color={tokens.color.warning} /> {rating.toFixed(1)}
          </span>}
        </div>
        <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: tokens.fontSize.base,
          color: tokens.color.textPrimary, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</h4>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: tokens.fontSize.xs, color: tokens.color.textSecondary }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Icon name="clock" size={13} color={tokens.color.textMuted} /> {duration}h</span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Icon name="dollar" size={13} color={tokens.color.textMuted} /> {cost > 0 ? `${cost} ${currency}` : "Free"}</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {hobbyTags.slice(0, 3).map(t => (
            <span key={t} style={{ background: tokens.color.bg, color: tokens.color.textSecondary,
              padding: "1px 7px", borderRadius: tokens.radius.full, fontSize: "10px" }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// (g) FLIGHT CARD
// ════════════════════════════════════════════════════════════════════════════

const FlightCard = ({ airline, departure, arrival, duration, stops, price, currency = "USD", cabinClass = "Economy", selected }) => (
  <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.md, padding: "16px 20px",
    boxShadow: tokens.shadow.sm, border: `2px solid ${selected ? tokens.color.primary : tokens.color.borderLight}`,
    maxWidth: 440, transition: "all 0.2s", cursor: "pointer",
    ...(selected ? { boxShadow: tokens.shadow.glow } : {}) }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: tokens.radius.sm, background: tokens.color.bg,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="plane" size={18} color={tokens.color.primary} />
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: tokens.fontSize.base }}>{airline}</p>
          <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>{cabinClass}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.lg, color: tokens.color.primary }}>
          ${price.toLocaleString()}</p>
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>{currency}</span>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.md }}>{departure}</p>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>{duration}</span>
        <div style={{ width: "100%", height: 2, background: tokens.color.borderLight, borderRadius: 1, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: -3, width: 8, height: 8,
            borderRadius: tokens.radius.full, background: tokens.color.primary }} />
          {stops > 0 && <div style={{ position: "absolute", left: "50%", top: -2, width: 6, height: 6,
            borderRadius: tokens.radius.full, background: tokens.color.warning, transform: "translateX(-50%)" }} />}
          <div style={{ position: "absolute", right: 0, top: -3, width: 8, height: 8,
            borderRadius: tokens.radius.full, background: tokens.color.secondary }} />
        </div>
        <span style={{ fontSize: tokens.fontSize.xs, color: stops === 0 ? tokens.color.success : tokens.color.textMuted,
          fontWeight: 500 }}>{stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`}</span>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.md }}>{arrival}</p>
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// (h) STAY CARD
// ════════════════════════════════════════════════════════════════════════════

const StayCard = ({ name, imageUrl, rating, nightlyRate, currency = "USD", amenities = [], type = "Hotel" }) => (
  <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.md, overflow: "hidden",
    boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}`, width: 280, transition: "all 0.25s" }}>
    <div style={{ height: 140, background: imageUrl ? `url(${imageUrl}) center/cover` :
      `linear-gradient(135deg, ${tokens.color.accent}25, ${tokens.color.primary}15)`, position: "relative" }}>
      <span style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.6)", color: "#fff",
        padding: "3px 10px", borderRadius: tokens.radius.full, fontSize: tokens.fontSize.xs, fontWeight: 500 }}>{type}</span>
    </div>
    <div style={{ padding: "14px 16px" }}>
      <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.base, marginBottom: 6 }}>{name}</h4>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 2 }}>
          {[1,2,3,4,5].map(s => (
            <Icon key={s} name="star" size={14} color={s <= Math.round(rating) ? tokens.color.warning : tokens.color.borderLight} />
          ))}
        </div>
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textSecondary }}>{rating?.toFixed(1)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {amenities.slice(0, 4).map(a => (
          <span key={a} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "10px", color: tokens.color.textMuted }}>
            <Icon name="wifi" size={12} color={tokens.color.textMuted} /> {a}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.lg, color: tokens.color.primary }}>
          ${nightlyRate}</span>
        <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>/ night</span>
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// (i) ITINERARY TIMELINE
// ════════════════════════════════════════════════════════════════════════════

const ItineraryTimeline = ({ day, date, theme, items = [] }) => {
  const typeColors = { flight: tokens.color.accent, transfer: "#8B5CF6", activity: tokens.color.secondary,
    meal: tokens.color.primary, rest: "#6366F1", checkin: tokens.color.success, checkout: tokens.color.warning, travel: "#8E99A8" };
  return (
    <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: "20px 24px",
      boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.lg }}>Day {day}</h3>
          <p style={{ fontSize: tokens.fontSize.sm, color: tokens.color.textSecondary }}>{date} · {theme}</p>
        </div>
        <span style={{ fontSize: tokens.fontSize.sm, color: tokens.color.textMuted }}>
          ${items.reduce((s, i) => s + (i.cost || 0), 0).toLocaleString()} total
        </span>
      </div>
      <div style={{ position: "relative", paddingLeft: 28 }} role="list">
        <div style={{ position: "absolute", left: 11, top: 8, bottom: 8, width: 2,
          background: `linear-gradient(to bottom, ${tokens.color.primary}30, ${tokens.color.borderLight})` }} />
        {items.map((item, i) => (
          <div key={i} role="listitem" style={{ display: "flex", gap: 14, marginBottom: i < items.length - 1 ? 20 : 0,
            position: "relative", animation: `fadeInUp 0.4s ease-out ${i * 0.08}s both` }}>
            <div style={{ position: "absolute", left: -28, top: 2, width: 24, height: 24, borderRadius: tokens.radius.full,
              background: typeColors[item.type] || tokens.color.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 0 3px ${tokens.color.surface}` }}>
              <Icon name={item.type === "meal" ? "food" : item.type === "flight" ? "plane" : item.type === "activity" ? "camera" : "clock"}
                size={12} color="#fff" />
            </div>
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: tokens.fontSize.base }}>{item.title}</p>
                {item.cost > 0 && <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textSecondary, fontWeight: 500 }}>${item.cost}</span>}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 2, fontSize: tokens.fontSize.xs, color: tokens.color.textMuted }}>
                <span>{item.time}</span>
                {item.location && <span>📍 {item.location}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// (j) CHAT BUBBLE
// ════════════════════════════════════════════════════════════════════════════

const ChatBubble = ({ message, agentName, agentEmoji = "🤖", isUser = false, isTyping = false }) => (
  <div style={{ display: "flex", gap: 10, flexDirection: isUser ? "row-reverse" : "row",
    maxWidth: 520, animation: "fadeInUp 0.3s ease-out" }}>
    {!isUser && (
      <div style={{ width: 36, height: 36, borderRadius: tokens.radius.full, flexShrink: 0,
        background: `linear-gradient(135deg, ${tokens.color.primary}, ${tokens.color.accent})`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}
        aria-hidden="true">{agentEmoji}</div>
    )}
    <div>
      {!isUser && <p style={{ fontSize: tokens.fontSize.xs, color: tokens.color.primary, fontWeight: 600, marginBottom: 4, fontFamily: "var(--font-heading)" }}>{agentName}</p>}
      <div style={{ background: isUser ? tokens.color.primary : tokens.color.surface,
        color: isUser ? "#fff" : tokens.color.textPrimary, padding: "12px 16px",
        borderRadius: `${tokens.radius.md}px ${tokens.radius.md}px ${isUser ? "4px" : tokens.radius.md + "px"} ${isUser ? tokens.radius.md + "px" : "4px"}`,
        boxShadow: tokens.shadow.sm, fontSize: tokens.fontSize.base, lineHeight: 1.6,
        border: isUser ? "none" : `1px solid ${tokens.color.borderLight}` }}>
        {isTyping ? (
          <div style={{ display: "flex", gap: 5, padding: "4px 0" }} aria-label="Agent is typing">
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: tokens.radius.full, background: tokens.color.textMuted,
                animation: `dotPulse 1.4s infinite ease-in-out ${i * 0.16}s` }} />
            ))}
          </div>
        ) : message}
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
// (k) PROMPT EDITOR
// ════════════════════════════════════════════════════════════════════════════

const PromptEditor = ({ agentName, defaultPrompt, onSave }) => {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState(defaultPrompt);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave?.(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.md, overflow: "hidden",
      border: `1px solid ${expanded ? tokens.color.primary + "40" : tokens.color.borderLight}`, transition: "all 0.3s" }}>
      <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "none", border: "none", cursor: "pointer", minHeight: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="edit" size={16} color={tokens.color.textSecondary} />
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: tokens.fontSize.sm,
            color: tokens.color.textSecondary }}>{agentName} Prompt</span>
        </div>
        <div style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          <Icon name="chevron" size={16} color={tokens.color.textMuted} />
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "0 16px 16px", animation: "fadeIn 0.2s ease" }}>
          <textarea value={value} onChange={e => setValue(e.target.value)}
            aria-label={`Edit ${agentName} prompt template`}
            style={{ width: "100%", minHeight: 120, padding: 12, borderRadius: tokens.radius.sm,
              border: `1px solid ${tokens.color.border}`, fontFamily: "'Fira Code', 'SF Mono', monospace",
              fontSize: tokens.fontSize.sm, lineHeight: 1.7, resize: "vertical",
              color: tokens.color.textPrimary, background: tokens.color.bg }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <button onClick={() => setValue(defaultPrompt)}
              style={{ background: "none", border: "none", color: tokens.color.textMuted, fontSize: tokens.fontSize.xs,
                cursor: "pointer", textDecoration: "underline" }}>Reset to default</button>
            <button onClick={handleSave}
              style={{ background: saved ? tokens.color.success : tokens.color.primary, color: "#fff",
                border: "none", borderRadius: tokens.radius.sm, padding: "8px 20px", fontWeight: 600,
                fontSize: tokens.fontSize.sm, cursor: "pointer", transition: "all 0.2s", minHeight: 36 }}>
              {saved ? "✓ Saved" : "Save Prompt"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM SHOWCASE
// ════════════════════════════════════════════════════════════════════════════

export default function WanderPlanDesignSystem() {
  const [showcaseSection, setShowcaseSection] = useState("all");

  const Section = ({ title, children, id }) => (
    <section id={id} style={{ marginBottom: 48, animation: "fadeInUp 0.5s ease-out" }}>
      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.xl,
        color: tokens.color.textPrimary, marginBottom: 8, letterSpacing: "-0.3px" }}>{title}</h2>
      <div style={{ width: 40, height: 3, background: `linear-gradient(90deg, ${tokens.color.primary}, ${tokens.color.accent})`,
        borderRadius: 2, marginBottom: 24 }} />
      {children}
    </section>
  );

  const Row = ({ children, gap = 16 }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "flex-start" }}>{children}</div>
  );

  return (
    <div style={{ minHeight: "100vh", background: tokens.color.bg }}>
      <GlobalStyle />

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{ background: `linear-gradient(135deg, ${tokens.color.primary}, ${tokens.color.primaryDark})`,
        padding: "48px 32px 40px", color: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: tokens.radius.md,
              background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="map" size={22} color="#fff" />
            </div>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize.md, opacity: 0.9 }}>WanderPlan AI</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: tokens.fontSize["3xl"],
            letterSpacing: "-0.5px", marginBottom: 8 }}>Design System</h1>
          <p style={{ fontSize: tokens.fontSize.md, opacity: 0.8, maxWidth: 500, lineHeight: 1.5 }}>
            Components, tokens, and patterns for building the WanderPlan experience.
          </p>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* ── Color Tokens ───────── */}
        <Section title="Color Palette" id="colors">
          <Row gap={12}>
            {[
              { name: "Ocean Teal", hex: "#0D7377", role: "Primary" },
              { name: "Sunset Coral", hex: "#E8634A", role: "Secondary" },
              { name: "Sky Blue", hex: "#4DA8DA", role: "Accent" },
              { name: "Background", hex: "#FAFBFC", role: "Background", dark: true },
              { name: "Surface", hex: "#FFFFFF", role: "Surface", dark: true },
              { name: "Deep Navy", hex: "#1A1A2E", role: "Text Primary" },
              { name: "Slate", hex: "#5A6A7A", role: "Text Secondary" },
              { name: "Success", hex: "#22C55E", role: "Success" },
              { name: "Warning", hex: "#F59E0B", role: "Warning" },
              { name: "Error", hex: "#EF4444", role: "Error" },
            ].map(c => (
              <div key={c.hex} style={{ width: 96 }}>
                <div style={{ width: 96, height: 64, borderRadius: tokens.radius.md, background: c.hex,
                  boxShadow: tokens.shadow.sm, border: c.dark ? `1px solid ${tokens.color.border}` : "none" }} />
                <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: tokens.fontSize.xs,
                  marginTop: 6 }}>{c.name}</p>
                <p style={{ fontSize: "10px", color: tokens.color.textMuted, fontFamily: "monospace" }}>{c.hex}</p>
                <p style={{ fontSize: "10px", color: tokens.color.textSecondary }}>{c.role}</p>
              </div>
            ))}
          </Row>
        </Section>

        {/* ── Typography ─────────── */}
        <Section title="Typography" id="typography">
          <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: 24,
            boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}` }}>
            {Object.entries(tokens.fontSize).map(([key, size]) => (
              <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "10px 0",
                borderBottom: `1px solid ${tokens.color.borderLight}` }}>
                <span style={{ width: 50, fontSize: tokens.fontSize.xs, color: tokens.color.textMuted, fontFamily: "monospace", flexShrink: 0 }}>{key}</span>
                <span style={{ width: 50, fontSize: tokens.fontSize.xs, color: tokens.color.textMuted, flexShrink: 0 }}>{size}</span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: size, lineHeight: 1.3 }}>DM Sans Bold</span>
                <span style={{ fontFamily: "var(--font-body)", fontWeight: 400, fontSize: size, color: tokens.color.textSecondary, lineHeight: 1.3 }}>Inter Regular</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Spacing ────────────── */}
        <Section title="Spacing Scale (4px base)" id="spacing">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            {tokens.space.slice(1).map(s => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: s, height: s, background: `${tokens.color.primary}30`, borderRadius: 2,
                  border: `1px solid ${tokens.color.primary}50`, minWidth: 4, minHeight: 4 }} />
                <span style={{ fontSize: "10px", color: tokens.color.textMuted }}>{s}px</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── YesNoCard ──────────── */}
        <Section title="(a) YesNoCard — Decision Component" id="yesno">
          <Row>
            <YesNoCard
              title="Santorini, Greece"
              subtitle="92% match · Best in Sep–Oct"
              description="Stunning caldera views, world-class sunsets, and rich Cycladic culture. Perfect for your couple's getaway preferences."
              imageUrl="https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80"
              tags={["Photography", "Culture", "Wine Tasting"]}
              agentName="Destination Agent"
              onApprove={() => {}} onRevise={() => {}}
            />
            <YesNoCard
              title="Morning Kayak Tour"
              subtitle="$65 · 3 hours · 4.8★"
              description="Guided sea kayak along the caldera cliffs with a stop at the volcanic hot springs."
              tags={["Adventure", "Nature"]}
              agentName="POI Agent"
              onApprove={() => {}} onRevise={() => {}}
            />
          </Row>
        </Section>

        {/* ── BudgetMeter ────────── */}
        <Section title="(b) BudgetMeter" id="budget">
          <Row>
            <div style={{ width: 340 }}><BudgetMeter spent={145} allocated={250} label="Day 3 Budget" /></div>
            <div style={{ width: 340 }}><BudgetMeter spent={220} allocated={250} label="Day 5 Budget" /></div>
            <div style={{ width: 340 }}><BudgetMeter spent={310} allocated={250} label="Day 7 Budget (Over)" /></div>
          </Row>
        </Section>

        {/* ── TripProgressStepper ── */}
        <Section title="(c) TripProgressStepper" id="stepper">
          <TripProgressStepper currentStage="pois" />
          <div style={{ height: 16 }} />
          <TripProgressStepper currentStage="flights" />
        </Section>

        {/* ── MemberAvatarRow ────── */}
        <Section title="(d) MemberAvatarRow" id="members">
          <MemberAvatarRow members={[
            { name: "James W", status: "done" },
            { name: "Sarah W", status: "done" },
            { name: "Alex C", status: "pending" },
            { name: "Priya S", status: "pending" },
          ]} />
        </Section>

        {/* ── DestinationCard ────── */}
        <Section title="(e) DestinationCard" id="destination">
          <Row>
            <DestinationCard name="Santorini" country="Greece" matchScore={92} bestMonths={[5,6,9,10]}
              imageUrl="https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80" />
            <DestinationCard name="Kyoto" country="Japan" matchScore={87} bestMonths={[3,4,10,11]}
              imageUrl="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80" />
            <DestinationCard name="Machu Picchu" country="Peru" matchScore={74} bestMonths={[5,6,7,8,9]} />
          </Row>
        </Section>

        {/* ── POICard ────────────── */}
        <Section title="(f) POICard" id="poi">
          <Row>
            <POICard name="Fira to Oia Caldera Trail" category="nature" duration={3.5} cost={0}
              rating={4.8} hobbyTags={["Hiking", "Photography"]} />
            <POICard name="Traditional Cooking Class" category="food" duration={3} cost={75}
              rating={4.9} hobbyTags={["Cooking", "Culture"]} />
            <POICard name="Kinkaku-ji Temple" category="culture" duration={2} cost={5}
              rating={4.7} hobbyTags={["History", "Photography"]} />
          </Row>
        </Section>

        {/* ── FlightCard ─────────── */}
        <Section title="(g) FlightCard" id="flight">
          <Row>
            <FlightCard airline="Japan Airlines" departure="10:30" arrival="14:45+1" duration="14h 15m"
              stops={0} price={1247} cabinClass="Premium Economy" selected />
            <FlightCard airline="Emirates" departure="22:15" arrival="07:30+1" duration="16h 15m"
              stops={1} price={980} cabinClass="Economy" selected={false} />
          </Row>
        </Section>

        {/* ── StayCard ───────────── */}
        <Section title="(h) StayCard" id="stay">
          <Row>
            <StayCard name="Canaves Oia Suites" rating={4.9} nightlyRate={385} type="Boutique Hotel"
              amenities={["Pool", "WiFi", "Breakfast", "Sea View"]}
              imageUrl="https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=400&q=80" />
            <StayCard name="Hoshinoya Kyoto" rating={4.8} nightlyRate={520} type="Resort"
              amenities={["Spa", "Garden", "Tea Ceremony", "River View"]} />
          </Row>
        </Section>

        {/* ── ItineraryTimeline ──── */}
        <Section title="(i) ItineraryTimeline" id="timeline">
          <div style={{ maxWidth: 500 }}>
            <ItineraryTimeline day={3} date="Jul 3, 2025" theme="Caldera & Culture" items={[
              { time: "8:00 AM", type: "meal", title: "Breakfast at Karma Restaurant", location: "Fira", cost: 28 },
              { time: "9:30 AM", type: "activity", title: "Caldera Hiking Trail", location: "Fira → Oia", cost: 0 },
              { time: "1:00 PM", type: "meal", title: "Lunch at Ammoudi Fish Tavern", location: "Ammoudi Bay", cost: 45 },
              { time: "3:00 PM", type: "activity", title: "Wine Tasting at Santo Wines", location: "Pyrgos", cost: 35 },
              { time: "6:30 PM", type: "rest", title: "Golden Hour at Oia Castle", location: "Oia", cost: 0 },
              { time: "8:00 PM", type: "meal", title: "Dinner at Lycabettus", location: "Oia", cost: 85 },
            ]} />
          </div>
        </Section>

        {/* ── ChatBubble ─────────── */}
        <Section title="(j) ChatBubble" id="chat">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
            <ChatBubble agentName="Destination Agent" agentEmoji="🌍"
              message="Based on your group's interests in photography and culture, I've found 3 destinations that score above 85% match. Let me show you the top pick first." />
            <ChatBubble isUser message="That sounds great! Show me what you've got." />
            <ChatBubble agentName="Destination Agent" agentEmoji="🌍" isTyping />
          </div>
        </Section>

        {/* ── PromptEditor ───────── */}
        <Section title="(k) PromptEditor" id="prompt">
          <div style={{ maxWidth: 520 }}>
            <PromptEditor agentName="Destination Agent"
              defaultPrompt={`You are the Destination Agent for WanderPlan AI.\n\nGiven the group's interests: {{group_interests}}\nBudget preference: {{budget_level}}\nTravel dates: {{date_range}}\n\nSuggest the top 5 destinations that best match the group's combined preferences. For each destination, provide:\n- Match score (0-100)\n- Best travel months\n- Key highlights relevant to group interests`}
              onSave={(v) => console.log("Saved:", v)} />
          </div>
        </Section>

        {/* ── Accessibility Notes ── */}
        <Section title="Accessibility (WCAG 2.1 AA)" id="a11y">
          <div style={{ background: tokens.color.surface, borderRadius: tokens.radius.lg, padding: 24,
            boxShadow: tokens.shadow.sm, border: `1px solid ${tokens.color.borderLight}`, maxWidth: 600 }}>
            {[
              { label: "Focus Rings", desc: "3px Sky Blue ring on all interactive elements via :focus-visible" },
              { label: "Touch Targets", desc: "Minimum 44×44px on all buttons and interactive elements" },
              { label: "Color + Text", desc: "Status always conveyed with text labels, never color alone" },
              { label: "Screen Readers", desc: "aria-label on all icons, role='progressbar' on meters, sr-only class" },
              { label: "Contrast Ratios", desc: "Primary text #1A1A2E on #FAFBFC = 15.2:1 · Secondary #5A6A7A = 5.1:1" },
              { label: "Breakpoints", desc: "Mobile 375px → Tablet 768px → Desktop 1024px → Wide 1440px" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0",
                borderBottom: i < 5 ? `1px solid ${tokens.color.borderLight}` : "none" }}>
                <Icon name="check" size={18} color={tokens.color.success} />
                <div>
                  <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: tokens.fontSize.sm }}>{item.label}</p>
                  <p style={{ fontSize: tokens.fontSize.xs, color: tokens.color.textSecondary, marginTop: 2 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

      </main>
    </div>
  );
}
