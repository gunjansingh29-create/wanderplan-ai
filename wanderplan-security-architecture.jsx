import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   TOKENS — Security command-center dark theme
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg:"#05080F", bgAlt:"#0A0F1A", surface:"#0F1520", surfaceLight:"#161E2E",
  border:"#1E2A3A", borderLight:"#15202E", borderAccent:"#1A3A4A",
  text:"#E2E8F0", text2:"#8B9BB4", text3:"#4A5B73",
  green:"#10B981", greenDark:"#059669", greenBg:"rgba(16,185,129,.06)",
  red:"#EF4444", redDark:"#DC2626", redBg:"rgba(239,68,68,.06)",
  amber:"#F59E0B", amberDark:"#D97706", amberBg:"rgba(245,158,11,.06)",
  blue:"#3B82F6", blueDark:"#2563EB", blueBg:"rgba(59,130,246,.06)",
  purple:"#8B5CF6", purpleDark:"#7C3AED",
  cyan:"#06B6D4", cyanDark:"#0891B2",
  teal:"#0D9488",
  critical:"#EF4444", sensitive:"#F59E0B", general:"#10B981",
};

/* ═══════════════════════════════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif;background:${C.bg};color:${C.text};-webkit-font-smoothing:antialiased}
  :focus-visible{outline:none;box-shadow:0 0 0 2px ${C.green}50;border-radius:4px}
  .mono{font-family:'JetBrains Mono',monospace}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideL{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes scanline{0%{top:-100%}100%{top:200%}}
  @keyframes typeCursor{0%,100%{border-color:${C.green}}50%{border-color:transparent}}
  @keyframes shieldPulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.15)}50%{box-shadow:0 0 30px 4px rgba(16,185,129,.08)}}
  @keyframes lockGlow{0%,100%{filter:drop-shadow(0 0 4px rgba(16,185,129,.3))}50%{filter:drop-shadow(0 0 12px rgba(16,185,129,.5))}}
  pre{white-space:pre-wrap;word-break:break-all}
  code{font-family:'JetBrains Mono',monospace}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */
const Ic=({n,s=18,c="currentColor"})=>{const p={
  shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.8" stroke={c} fill="none"/>,
  lock:<><rect x="3" y="11" width="18" height="11" rx="2" strokeWidth="1.8" stroke={c} fill="none"/><path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="1.8" stroke={c} fill="none"/></>,
  key:<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  eye:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="12" cy="12" r="3" strokeWidth="1.8" stroke={c} fill="none"/></>,
  check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
  x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
  alert:<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 9v4M12 17h.01" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/></>,
  database:<><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M21 5v14c0 1.66-4 3-9 3s-9-1.34-9-3V5" strokeWidth="1.8" stroke={c} fill="none"/></>,
  server:<><rect x="2" y="2" width="20" height="8" rx="2" strokeWidth="1.8" stroke={c} fill="none"/><rect x="2" y="14" width="20" height="8" rx="2" strokeWidth="1.8" stroke={c} fill="none"/><path d="M6 6h.01M6 18h.01" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/></>,
  users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/></>,
  globe:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeWidth="1.8" stroke={c} fill="none"/></>,
  file:<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="1.8" stroke={c} fill="none"/>,
  clock:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 6v6l4 2" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
  chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  scan:<path d="M7 3H3v4m14-4h4v4M3 17v4h4m10 0h4v-4M8 7h8v10H8z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
  cloud:<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" strokeWidth="1.8" stroke={c} fill="none"/>,
  settings:<><circle cx="12" cy="12" r="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.8" stroke={c} fill="none"/></>,
};return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{p[n]||p.shield}</svg>};

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT LOG SAMPLE DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const AUDIT_ENTRIES = [
  { ts:"2026-02-25 14:23:07", actor:"system@wanderplan.ai", action:"secret_rotated", resource:"aws/db-password", ip:"internal", level:"info" },
  { ts:"2026-02-25 14:18:42", actor:"james@email.com", action:"data_export_requested", resource:"user/u-7a2f/gdpr-export", ip:"73.42.18.x", level:"info" },
  { ts:"2026-02-25 14:12:01", actor:"admin@wanderplan.ai", action:"tier1_data_accessed", resource:"user/u-3b91/payment", ip:"10.0.2.15", level:"warn" },
  { ts:"2026-02-25 13:55:19", actor:"sarah@email.com", action:"mfa_enabled", resource:"user/u-4c82/auth", ip:"98.22.41.x", level:"info" },
  { ts:"2026-02-25 13:48:33", actor:"flight-agent", action:"api_call_external", resource:"amadeus/flight-search", ip:"10.0.1.8", level:"info" },
  { ts:"2026-02-25 13:31:07", actor:"priya@email.com", action:"consent_updated", resource:"user/u-9d12/consent", ip:"142.58.x.x", level:"info" },
  { ts:"2026-02-25 13:22:55", actor:"system@wanderplan.ai", action:"vuln_scan_complete", resource:"container/api-server:v2.4.1", ip:"internal", level:"info" },
  { ts:"2026-02-25 12:45:12", actor:"alex@email.com", action:"account_deleted", resource:"user/u-6e41/erasure", ip:"204.15.x.x", level:"warn" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   CODE BLOCK COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
function CodeBlock({ title, lang, children }) {
  return (
    <div style={{ background:C.bg, borderRadius:10, overflow:"hidden",
      border:`1px solid ${C.border}`, marginBottom:12 }}>
      {title && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
          borderBottom:`1px solid ${C.border}`, background:C.bgAlt }}>
          <div style={{ display:"flex", gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:999, background:C.red, opacity:.6 }}/>
            <div style={{ width:8, height:8, borderRadius:999, background:C.amber, opacity:.6 }}/>
            <div style={{ width:8, height:8, borderRadius:999, background:C.green, opacity:.6 }}/>
          </div>
          <span className="mono" style={{ fontSize:11, color:C.text3 }}>{title}</span>
          {lang && <span className="mono" style={{ fontSize:10, color:C.text3, marginLeft:"auto",
            background:C.surface, padding:"1px 8px", borderRadius:4 }}>{lang}</span>}
        </div>
      )}
      <pre className="mono" style={{ fontSize:11.5, lineHeight:1.65, padding:14, overflow:"auto",
        maxHeight:420, color:C.green }}>{children}</pre>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
function Section({ id, number, title, icon, color, children }) {
  return (
    <section id={id} style={{ marginBottom:32, animation:"fadeUp .4s ease-out" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
          background:`${color}10`, border:`1px solid ${color}25`,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ic n={icon} s={20} c={color}/>
        </div>
        <div>
          <span className="mono" style={{ fontSize:11, color:C.text3 }}>SECTION {number}</span>
          <h2 style={{ fontWeight:800, fontSize:20, letterSpacing:"-0.3px", color:C.text }}>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SecurityArchitecture() {
  const [activeNav, setActiveNav] = useState("classification");
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consents, setConsents] = useState({ essential:true, analytics:false, marketing:false, thirdParty:false });
  const [privacyToggles, setPrivacyToggles] = useState({
    locationSharing:true, analyticsTracking:true, crashReporting:true,
    socialPosting:false, doNotSell:false, dataRetention:"2years",
  });

  const NAV = [
    { id:"classification", label:"Data Classification", icon:"database", num:"01" },
    { id:"auth",           label:"Authentication",      icon:"key",      num:"02" },
    { id:"api",            label:"API Security",        icon:"server",   num:"03" },
    { id:"privacy",        label:"GDPR / CCPA",         icon:"globe",    num:"04" },
    { id:"thirdparty",     label:"Third-Party",         icon:"cloud",    num:"05" },
    { id:"audit",          label:"Audit Logging",       icon:"eye",      num:"06" },
    { id:"infra",          label:"Infrastructure",      icon:"shield",   num:"07" },
    { id:"ui",             label:"Privacy UI",          icon:"settings", num:"08" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex" }}>
      <CSS/>

      {/* ── SIDEBAR NAV ────────────────────────────────────── */}
      <nav style={{ width:260, background:C.surface, borderRight:`1px solid ${C.border}`,
        padding:"20px 0", position:"sticky", top:0, height:"100vh", overflowY:"auto", flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:"0 20px 20px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:`linear-gradient(135deg,${C.green}20,${C.teal}10)`,
              border:`1px solid ${C.green}30`,
              display:"flex", alignItems:"center", justifyContent:"center",
              animation:"shieldPulse 4s ease-in-out infinite" }}>
              <Ic n="shield" s={18} c={C.green}/>
            </div>
            <div>
              <p style={{ fontWeight:800, fontSize:15 }}>WanderPlan</p>
              <p className="mono" style={{ fontSize:10, color:C.green }}>SECURITY ARCHITECTURE</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ padding:"12px 10px" }}>
          {NAV.map((item, i) => {
            const active = activeNav === item.id;
            return (
              <button key={item.id} onClick={() => {
                setActiveNav(item.id);
                document.getElementById(item.id)?.scrollIntoView({ behavior:"smooth" });
              }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
                  padding:"9px 12px", borderRadius:8, border:"none", cursor:"pointer",
                  background:active ? `${C.green}10` : "transparent",
                  color:active ? C.green : C.text2, textAlign:"left",
                  marginBottom:2, transition:"all .15s" }}>
                <Ic n={item.icon} s={16} c={active ? C.green : C.text3}/>
                <div style={{ flex:1 }}>
                  <span className="mono" style={{ fontSize:9, color:C.text3, display:"block" }}>{item.num}</span>
                  <span style={{ fontSize:13, fontWeight:active ? 700 : 500 }}>{item.label}</span>
                </div>
                {active && <div style={{ width:3, height:20, borderRadius:999, background:C.green }}/>}
              </button>
            );
          })}
        </div>

        {/* Security score */}
        <div style={{ margin:"12px 16px", padding:"14px 16px", borderRadius:10,
          background:`linear-gradient(135deg,${C.green}08,${C.teal}05)`,
          border:`1px solid ${C.green}20` }}>
          <p style={{ fontSize:11, color:C.text3, marginBottom:4 }}>Security Posture</p>
          <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontWeight:800, fontSize:28, color:C.green }}>A+</span>
            <span className="mono" style={{ fontSize:11, color:C.text3 }}>/ SOC 2 Type II</span>
          </div>
          <div style={{ height:4, background:C.border, borderRadius:999, marginTop:8, overflow:"hidden" }}>
            <div style={{ height:"100%", width:"96%", background:`linear-gradient(90deg,${C.green},${C.teal})`,
              borderRadius:999 }}/>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <main style={{ flex:1, padding:"28px 36px 80px", maxWidth:920 }}>

        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ width:8, height:8, borderRadius:999, background:C.green, animation:"pulse 2s infinite" }}/>
            <span className="mono" style={{ fontSize:12, color:C.green }}>ALL SYSTEMS OPERATIONAL</span>
          </div>
          <h1 style={{ fontWeight:800, fontSize:30, letterSpacing:"-0.5px", marginBottom:4 }}>
            Data Privacy & Security Architecture
          </h1>
          <p style={{ fontSize:15, color:C.text2, lineHeight:1.6 }}>
            Complete security framework for WanderPlan AI — data classification, authentication,
            API hardening, GDPR/CCPA compliance, audit logging, and infrastructure security.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════
           (1) DATA CLASSIFICATION
           ═══════════════════════════════════════════════════ */}
        <Section id="classification" number="01" title="Data Classification" icon="database" color={C.red}>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
            {[
              { tier:"TIER 1", label:"Critical", color:C.red, icon:"🔴",
                items:["Passwords (bcrypt hash only)","Payment info (card tokens)","Passport / ID numbers","SSN / National ID"],
                rules:["AES-256-GCM encryption at rest","Never logged, never cached","Field-level encryption in DB","Access requires MFA + audit log","Auto-purge after 30 days post-trip"] },
              { tier:"TIER 2", label:"Sensitive", color:C.amber, icon:"🟡",
                items:["Email addresses","Phone numbers","Health conditions","Travel dates & locations","Group member names"],
                rules:["AES-256 encryption at rest","All access logged to audit trail","Anonymized in analytics (k-anonymity ≥5)","Pseudonymized for agent processing","Exportable via GDPR data request"] },
              { tier:"TIER 3", label:"General", color:C.green, icon:"🟢",
                items:["Trip preferences","POI selections","Itinerary structure","Budget allocations","Style preferences"],
                rules:["Standard TLS + at-rest encryption","Can be used for aggregate analytics","No PII in analytics payloads","Retained 2 years, then anonymized","Shareable within trip group"] },
            ].map(t => (
              <div key={t.tier} style={{ background:C.surface, borderRadius:12, overflow:"hidden",
                border:`1px solid ${t.color}20` }}>
                <div style={{ padding:"12px 16px", background:`${t.color}08`,
                  borderBottom:`1px solid ${t.color}15`, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>{t.icon}</span>
                  <div>
                    <span className="mono" style={{ fontSize:10, color:t.color }}>{t.tier}</span>
                    <p style={{ fontWeight:700, fontSize:15 }}>{t.label}</p>
                  </div>
                </div>
                <div style={{ padding:"12px 16px" }}>
                  <p className="mono" style={{ fontSize:10, color:C.text3, marginBottom:6 }}>DATA TYPES</p>
                  {t.items.map(item => (
                    <div key={item} style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 0" }}>
                      <div style={{ width:5, height:5, borderRadius:999, background:t.color, flexShrink:0 }}/>
                      <span style={{ fontSize:12.5, color:C.text2 }}>{item}</span>
                    </div>
                  ))}
                  <p className="mono" style={{ fontSize:10, color:C.text3, marginTop:10, marginBottom:6 }}>PROTECTION RULES</p>
                  {t.rules.map(r => (
                    <div key={r} style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"2px 0" }}>
                      <Ic n="check" s={12} c={t.color}/>
                      <span style={{ fontSize:12, color:C.text2, lineHeight:1.4 }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <CodeBlock title="schema/encryption.ts" lang="TypeScript">{`// Field-level encryption for Tier 1 data
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encryptField(plaintext: string): EncryptedField {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), data: encrypted, tag: authTag, tier: 1 };
}

export function decryptField(field: EncryptedField): string {
  const decipher = createDecipheriv(ALGORITHM,KEY,Buffer.from(field.iv,'hex'));
  decipher.setAuthTag(Buffer.from(field.tag, 'hex'));
  let decrypted = decipher.update(field.data, 'hex', 'utf8');
  return decrypted + decipher.final('utf8');
}

// Column-level encryption in PostgreSQL via pgcrypto
// Tier 1 columns: users.payment_token, users.passport_hash
// Tier 2 columns: users.email_encrypted, users.phone_encrypted`}</CodeBlock>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (2) AUTHENTICATION SECURITY
           ═══════════════════════════════════════════════════ */}
        <Section id="auth" number="02" title="Authentication Security" icon="key" color={C.blue}>

          {/* Auth flow diagram */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {[
              { label:"Password Hashing", icon:"lock", color:C.blue,
                specs:["bcrypt with cost factor 12","Salt auto-generated per hash","Timing-safe comparison","Argon2id migration planned Q3"] },
              { label:"JWT Token Strategy", icon:"key", color:C.purple,
                specs:["Access token: 15 min expiry","Refresh token: 7-day expiry","HttpOnly + Secure + SameSite=Strict cookies","RS256 signing (asymmetric keys)","Token rotation on each refresh"] },
              { label:"MFA / TOTP", icon:"shield", color:C.green,
                specs:["TOTP via Google Authenticator / Authy","Required for: payment changes, account deletion, Tier 1 data access","30-second window with ±1 drift","Backup codes (10, one-time use, bcrypt-hashed)"] },
              { label:"OAuth2 PKCE", icon:"users", color:C.cyan,
                specs:["Google, Apple, Facebook social login","PKCE flow (no client secret in browser)","State parameter for CSRF protection","Nonce for replay attack prevention","Scope: openid profile email only"] },
            ].map(item => (
              <div key={item.label} style={{ background:C.surface, borderRadius:12, padding:"14px 16px",
                border:`1px solid ${C.borderLight}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <Ic n={item.icon} s={16} c={item.color}/>
                  <span style={{ fontWeight:700, fontSize:14 }}>{item.label}</span>
                </div>
                {item.specs.map(s => (
                  <div key={s} style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"2px 0" }}>
                    <Ic n="check" s={11} c={item.color}/>
                    <span style={{ fontSize:12, color:C.text2, lineHeight:1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <CodeBlock title="auth/jwt.ts" lang="TypeScript">{`import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const ACCESS_TTL  = '15m';
const REFRESH_TTL = '7d';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function generateTokens(userId: string, sessionId: string) {
  const accessToken = jwt.sign(
    { sub: userId, sid: sessionId, type: 'access' },
    process.env.JWT_PRIVATE_KEY!,
    { algorithm: 'RS256', expiresIn: ACCESS_TTL }
  );
  const refreshToken = jwt.sign(
    { sub: userId, sid: sessionId, type: 'refresh' },
    process.env.JWT_PRIVATE_KEY!,
    { algorithm: 'RS256', expiresIn: REFRESH_TTL }
  );
  return { accessToken, refreshToken };
}

// Cookie settings for refresh token
export const REFRESH_COOKIE_OPTS = {
  httpOnly: true,       // No JS access
  secure: true,         // HTTPS only
  sameSite: 'strict',   // CSRF protection
  path: '/api/auth',    // Scoped to auth endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
};

// TOTP verification for sensitive actions
import { authenticator } from 'otplib';
authenticator.options = { window: 1 }; // ±30s drift

export function verifyTOTP(secret: string, token: string): boolean {
  return authenticator.verify({ token, secret });
}`}</CodeBlock>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (3) API SECURITY
           ═══════════════════════════════════════════════════ */}
        <Section id="api" number="03" title="API Security" icon="server" color={C.purple}>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10, marginBottom:16 }}>
            {[
              { label:"TLS 1.3", val:"Enforced", desc:"All endpoints HTTPS only. HSTS header with 1-year max-age. Certificate pinning on mobile.", color:C.green },
              { label:"Rate Limiting", val:"100/20 rpm", desc:"Authenticated: 100 req/min. Unauthenticated: 20 req/min. Sliding window via Redis.", color:C.amber },
              { label:"Input Validation", val:"Zod schemas", desc:"All inputs validated + sanitized. SQL injection: parameterized queries. XSS: DOMPurify on output.", color:C.blue },
              { label:"CORS Policy", val:"Strict origins", desc:"Allowed: app.wanderplan.ai, localhost:3000 (dev). Credentials: true. No wildcards.", color:C.purple },
              { label:"CSRF Protection", val:"Double-submit", desc:"CSRF token in cookie + request header. Verified server-side on all state-changing requests.", color:C.cyan },
              { label:"Request Signing", val:"HMAC-SHA256", desc:"Agent-to-agent API calls signed with shared secret. Timestamp within 5-minute window.", color:C.red },
            ].map(item => (
              <div key={item.label} style={{ background:C.surface, borderRadius:10, padding:"12px 14px",
                border:`1px solid ${C.borderLight}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{item.label}</span>
                  <span className="mono" style={{ fontSize:11, color:item.color, fontWeight:600 }}>{item.val}</span>
                </div>
                <p style={{ fontSize:11.5, color:C.text3, lineHeight:1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <CodeBlock title="middleware/security.ts" lang="TypeScript">{`// Express middleware stack — applied to all routes
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { z } from 'zod';

// 1. TLS enforcement + security headers
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdn.mixpanel.com"],
    connectSrc: ["'self'", "https://api.amadeus.com", "https://api.anthropic.com"],
  }},
}));

// 2. CORS — restricted to app domains
app.use(cors({
  origin: ['https://app.wanderplan.ai', 'https://admin.wanderplan.ai'],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH'],
}));

// 3. Rate limiting
const authLimiter = rateLimit({ windowMs: 60_000, max: 100, keyGenerator: req => req.user.id });
const publicLimiter = rateLimit({ windowMs: 60_000, max: 20, keyGenerator: req => req.ip });
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 5 }));  // Strict on auth
app.use('/api', (req, _, next) => (req.user ? authLimiter : publicLimiter)(req, _, next));

// 4. CSRF double-submit cookie
app.use((req, res, next) => {
  if (['POST','PUT','DELETE','PATCH'].includes(req.method)) {
    const cookieToken = req.cookies['csrf-token'];
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || cookieToken !== headerToken) return res.status(403).json({ error: 'CSRF' });
  }
  next();
});

// 5. Input sanitization — example for trip creation
const CreateTripSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
  destinations: z.array(z.string().max(50)).min(1).max(10),
  date_start: z.string().datetime(),
  members: z.array(z.string().uuid()).max(20),
});`}</CodeBlock>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (4) GDPR / CCPA COMPLIANCE
           ═══════════════════════════════════════════════════ */}
        <Section id="privacy" number="04" title="GDPR & CCPA Compliance" icon="globe" color={C.teal}>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ background:C.surface, borderRadius:12, padding:"14px 16px",
              border:`1px solid ${C.blue}20` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:16 }}>🇪🇺</span>
                <span style={{ fontWeight:700, fontSize:15 }}>GDPR Requirements</span>
              </div>
              {[
                { right:"Explicit Consent", detail:"Granular consent modal on first use. Separate toggles for analytics, marketing, and third-party sharing. Consent stored with timestamp + IP." },
                { right:"Right to Access", detail:"One-click data export (JSON). Includes all trip data, preferences, analytics events. Delivered within 72 hours via secure download link." },
                { right:"Right to Erasure", detail:"CASCADE DELETE across all PostgreSQL tables + MongoDB collections. Removes: user, trips, events, messages, uploaded photos. Audit log entry retained (anonymized)." },
                { right:"Data Portability", detail:"Machine-readable JSON export. Schema documented. Compatible with competitor import formats." },
                { right:"DPO Contact", detail:"dpo@wanderplan.ai in privacy policy footer. Response SLA: 48 hours. Annual DPIA reviews." },
              ].map(item => (
                <div key={item.right} style={{ marginBottom:8, paddingBottom:8,
                  borderBottom:`1px solid ${C.borderLight}` }}>
                  <p style={{ fontWeight:600, fontSize:13, color:C.blue, marginBottom:2 }}>{item.right}</p>
                  <p style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>{item.detail}</p>
                </div>
              ))}
            </div>

            <div style={{ background:C.surface, borderRadius:12, padding:"14px 16px",
              border:`1px solid ${C.amber}20` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:16 }}>🇺🇸</span>
                <span style={{ fontWeight:700, fontSize:15 }}>CCPA Requirements</span>
              </div>
              {[
                { right:"Do Not Sell Toggle", detail:"Settings → Privacy → 'Do Not Sell My Personal Information'. Immediately stops any data sharing with analytics aggregators. Persisted in user record." },
                { right:"Data Collection Transparency", detail:"Every screen that collects data shows an (i) icon linking to exactly what data is collected and why. No dark patterns." },
                { right:"Opt-Out Mechanism", detail:"One-click opt-out of all non-essential data processing. Essential only: auth, trip storage, payment processing. No account deletion required." },
                { right:"Categories Disclosed", detail:"Privacy policy lists all data categories: identifiers, commercial info, geolocation, internet activity, professional info, inferences." },
                { right:"Right to Know", detail:"Users can request full disclosure of data collected in the preceding 12 months. Same JSON export as GDPR access request." },
              ].map(item => (
                <div key={item.right} style={{ marginBottom:8, paddingBottom:8,
                  borderBottom:`1px solid ${C.borderLight}` }}>
                  <p style={{ fontWeight:600, fontSize:13, color:C.amber, marginBottom:2 }}>{item.right}</p>
                  <p style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <CodeBlock title="api/gdpr/erasure.ts" lang="TypeScript">{`// Right to Erasure — cascade delete across all datastores
export async function handleErasureRequest(userId: string) {
  const auditId = await auditLog('erasure_initiated', userId);

  await db.transaction(async (tx) => {
    // 1. PostgreSQL cascade delete
    await tx.execute('DELETE FROM analytics_events WHERE user_id = $1', [userId]);
    await tx.execute('DELETE FROM trip_members WHERE user_id = $1', [userId]);
    await tx.execute('DELETE FROM expenses WHERE user_id = $1', [userId]);
    await tx.execute('DELETE FROM notifications WHERE user_id = $1', [userId]);
    // Trips: only delete if sole owner; else remove membership
    await tx.execute(\`DELETE FROM trips WHERE id IN (
      SELECT trip_id FROM trip_members WHERE user_id = $1
      GROUP BY trip_id HAVING COUNT(*) = 1
    )\`, [userId]);
    await tx.execute('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await tx.execute('DELETE FROM users WHERE id = $1', [userId]);

    // 2. MongoDB collections
    await mongo.collection('chat_messages').deleteMany({ userId });
    await mongo.collection('storyboard_content').deleteMany({ userId });
    await mongo.collection('health_checklists').deleteMany({ userId });

    // 3. S3 user uploads
    await s3.deletePrefix(\`users/\${userId}/\`);

    // 4. Mixpanel: request deletion via GDPR API
    await mixpanel.gdpr.deleteUser(userId);

    // 5. Invalidate all sessions
    await redis.del(\`sessions:\${userId}:*\`);
  });

  await auditLog('erasure_completed', 'system', { auditId, userId: '[REDACTED]' });
  return { status: 'erased', timestamp: new Date().toISOString() };
}`}</CodeBlock>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (5) THIRD-PARTY DATA SHARING
           ═══════════════════════════════════════════════════ */}
        <Section id="thirdparty" number="05" title="Third-Party Data Isolation" icon="cloud" color={C.cyan}>

          <div style={{ background:C.surface, borderRadius:12, padding:"16px 18px", marginBottom:16,
            border:`1px solid ${C.borderLight}` }}>
            <p style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Data Sharing Rules</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                { api:"Amadeus (Flights)", sends:"Destination, dates, cabin class, passenger count",
                  never:"Names, emails, passport numbers, payment info", consent:"None (anonymous search)" },
                { api:"Booking.com (Stays)", sends:"Destination, dates, room count, price range",
                  never:"User identity, group member names, health conditions", consent:"None (anonymous search)" },
                { api:"Google Maps", sends:"Coordinates, place IDs",
                  never:"User ID, trip name, group data", consent:"None (public data)" },
                { api:"Claude API (Content)", sends:"Trip activities, style preferences (pseudonymized)",
                  never:"Real names, emails, exact dates, location history", consent:"Implicit (core feature)" },
                { api:"Social Media (Post)", sends:"User-approved content only",
                  never:"Anything without explicit per-action OAuth consent", consent:"Explicit per-post OAuth" },
                { api:"Mixpanel (Analytics)", sends:"Pseudonymized events, device info",
                  never:"Email, name, Tier 1 data, raw IP", consent:"Opt-in via consent modal" },
              ].map(item => (
                <div key={item.api} style={{ background:C.bgAlt, borderRadius:10, padding:"10px 12px" }}>
                  <p style={{ fontWeight:700, fontSize:12, color:C.cyan, marginBottom:6 }}>{item.api}</p>
                  <p style={{ fontSize:11, color:C.text3, marginBottom:4 }}>
                    <span style={{ color:C.green }}>✓ Sends:</span> {item.sends}
                  </p>
                  <p style={{ fontSize:11, color:C.text3, marginBottom:4 }}>
                    <span style={{ color:C.red }}>✗ Never:</span> {item.never}
                  </p>
                  <p style={{ fontSize:11, color:C.text3 }}>
                    <span style={{ color:C.amber }}>⚙ Consent:</span> {item.consent}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <CodeBlock title="services/flight-search.ts" lang="TypeScript">{`// Third-party API calls NEVER include user identity
export async function searchFlights(params: FlightSearchParams) {
  // STRIP all PII before calling external API
  const sanitizedRequest = {
    origin: params.origin,           // "JFK"
    destination: params.destination,  // "DPS"
    departureDate: params.date,       // "2025-10-04"
    adults: params.passengerCount,    // 4 (number only, no names)
    cabinClass: params.cabin,         // "ECONOMY"
    // ❌ NEVER included: user_id, names, emails, trip_id
  };

  const response = await amadeus.shopping.flightOffers.get(sanitizedRequest);

  // Log the search (anonymized) for analytics
  await analyticsTrack('api_call_external', {
    provider: 'amadeus',
    endpoint: 'flight-search',
    params_hash: sha256(JSON.stringify(sanitizedRequest)), // Hash, not raw
    results_count: response.data.length,
    // ❌ No user_id in this log entry
  });

  return response.data;
}`}</CodeBlock>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (6) AUDIT LOGGING
           ═══════════════════════════════════════════════════ */}
        <Section id="audit" number="06" title="Immutable Audit Trail" icon="eye" color={C.amber}>

          <CodeBlock title="schema/audit_log.sql" lang="SQL">{`-- Append-only audit trail — no UPDATE or DELETE permissions
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor       VARCHAR(255) NOT NULL,          -- user email or system ID
  action      VARCHAR(100) NOT NULL,          -- e.g. 'tier1_data_accessed'
  resource    VARCHAR(500) NOT NULL,          -- e.g. 'user/u-3b91/payment'
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',             -- Additional context
  level       VARCHAR(10) DEFAULT 'info',     -- info, warn, error, critical
  checksum    VARCHAR(64) NOT NULL            -- SHA-256 of previous row + this row
);

-- CRITICAL: Revoke mutating permissions
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
REVOKE TRUNCATE ON audit_log FROM app_user;

-- Only INSERT allowed (append-only)
GRANT INSERT ON audit_log TO app_user;
GRANT SELECT ON audit_log TO audit_reader;

-- Integrity verification: each row's checksum chains to previous
-- Tamper detection: if any row is modified, all subsequent checksums break
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp DESC);
CREATE INDEX idx_audit_actor     ON audit_log (actor, timestamp);
CREATE INDEX idx_audit_resource  ON audit_log (resource);

-- AWS CloudTrail integration for infrastructure-level audit
-- Covers: IAM changes, S3 access, RDS access, Lambda invocations`}</CodeBlock>

          {/* Live audit log viewer */}
          <div style={{ background:C.surface, borderRadius:12, overflow:"hidden",
            border:`1px solid ${C.borderLight}`, marginBottom:16 }}>
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`,
              display:"flex", alignItems:"center", gap:8, background:C.bgAlt }}>
              <Ic n="eye" s={14} c={C.amber}/>
              <span style={{ fontWeight:700, fontSize:13 }}>Live Audit Trail</span>
              <span className="mono" style={{ fontSize:10, color:C.text3, marginLeft:"auto" }}>
                Append-only · Tamper-proof
              </span>
            </div>
            <div style={{ maxHeight:280, overflow:"auto" }}>
              {AUDIT_ENTRIES.map((entry, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 16px", borderBottom:`1px solid ${C.borderLight}`,
                  animation:`slideL .2s ease-out ${i*.03}s both` }}>
                  <div style={{ width:6, height:6, borderRadius:999, flexShrink:0,
                    background:entry.level==="warn"?C.amber:entry.level==="critical"?C.red:C.green }}/>
                  <span className="mono" style={{ fontSize:11, color:C.text3, width:140, flexShrink:0 }}>{entry.ts}</span>
                  <span className="mono" style={{ fontSize:11, color:C.cyan, width:180, flexShrink:0,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.actor}</span>
                  <span className="mono" style={{ fontSize:11, fontWeight:600,
                    color:entry.level==="warn"?C.amber:C.text, flex:1 }}>{entry.action}</span>
                  <span className="mono" style={{ fontSize:10, color:C.text3, maxWidth:200,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.resource}</span>
                  <span className="mono" style={{ fontSize:10, color:C.text3, width:80, textAlign:"right" }}>{entry.ip}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (7) INFRASTRUCTURE SECURITY
           ═══════════════════════════════════════════════════ */}
        <Section id="infra" number="07" title="Infrastructure Security" icon="shield" color={C.green}>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            {[
              { label:"VPC Isolation", icon:"server", color:C.green,
                items:["Private subnets for DB + app servers","Public subnet: ALB only (TLS termination)","No public DB endpoints — ever","NAT Gateway for outbound API calls","Security groups: principle of least privilege","Network ACLs as secondary defense layer"] },
              { label:"Secrets Management", icon:"lock", color:C.purple,
                items:["AWS Secrets Manager for all credentials","Automatic rotation every 90 days","DB passwords, API keys, JWT signing keys","No secrets in code, env vars, or config files","Secrets fetched at runtime via SDK","Rotation triggers zero-downtime key swap"] },
              { label:"Container Security", icon:"scan", color:C.blue,
                items:["Trivy scanner on every CI/CD build","Block deployment if CRITICAL CVE found","Base image: distroless (minimal attack surface)","Read-only filesystem in containers","No root processes — all run as user 1000","Runtime: Falco for anomaly detection"] },
              { label:"Dependency Scanning", icon:"alert", color:C.amber,
                items:["Dependabot: daily vulnerability checks","npm audit / pip audit in CI pipeline","Auto-PR for patch-level security fixes","Manual review for major version bumps","SBOM (Software Bill of Materials) generated","Annual penetration test by external firm"] },
            ].map(item => (
              <div key={item.label} style={{ background:C.surface, borderRadius:12, padding:"14px 16px",
                border:`1px solid ${C.borderLight}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <Ic n={item.icon} s={16} c={item.color}/>
                  <span style={{ fontWeight:700, fontSize:14 }}>{item.label}</span>
                </div>
                {item.items.map(s => (
                  <div key={s} style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"2px 0" }}>
                    <Ic n="check" s={11} c={item.color}/>
                    <span style={{ fontSize:12, color:C.text2, lineHeight:1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <CodeBlock title="infrastructure/vpc.tf" lang="Terraform">{`# AWS VPC Architecture — WanderPlan Production
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "wanderplan-prod" }
}

# Public subnet — ALB only (no direct app/DB access)
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}

# Private subnet — App servers (ECS Fargate)
resource "aws_subnet" "app" {
  count      = 2
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.${count.index + 10}.0/24"
}

# Isolated subnet — Databases (RDS + DocumentDB)
resource "aws_subnet" "data" {
  count      = 2
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.${count.index + 20}.0/24"
}

# Security group: DB — only accessible from app subnet
resource "aws_security_group" "database" {
  vpc_id = aws_vpc.main.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]  # App servers only
  }
  egress { from_port = 0; to_port = 0; protocol = "-1"; cidr_blocks = ["0.0.0.0/0"] }
}

# Secrets rotation
resource "aws_secretsmanager_secret_rotation" "db_password" {
  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_lambda_arn = aws_lambda_function.secret_rotator.arn
  rotation_rules { automatically_after_days = 90 }
}`}</CodeBlock>
        </Section>

        {/* ═══════════════════════════════════════════════════
           (8) PRIVACY-BY-DESIGN UI
           ═══════════════════════════════════════════════════ */}
        <Section id="ui" number="08" title="Privacy-by-Design UI" icon="settings" color={C.teal}>

          <p style={{ fontSize:14, color:C.text2, lineHeight:1.6, marginBottom:16 }}>
            Interactive components that ship in the WanderPlan app for user-facing privacy controls.
          </p>

          {/* Consent Modal Preview */}
          <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px", marginBottom:16,
            border:`1px solid ${C.borderLight}`, position:"relative", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <span style={{ fontSize:18 }}>🍪</span>
              <span style={{ fontWeight:700, fontSize:16 }}>Consent Management Modal</span>
              <span className="mono" style={{ fontSize:10, color:C.text3, marginLeft:"auto" }}>
                Shown on first use
              </span>
            </div>

            {/* Simulated consent modal */}
            <div style={{ background:C.bgAlt, borderRadius:12, padding:"18px 20px",
              border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <Ic n="shield" s={20} c={C.teal}/>
                <span style={{ fontWeight:800, fontSize:17 }}>Your Privacy Matters</span>
              </div>
              <p style={{ fontSize:13, color:C.text2, lineHeight:1.6, marginBottom:14 }}>
                WanderPlan collects data to plan your perfect trip. You control exactly what we can use.
                You can change these settings anytime in Settings → Privacy.
              </p>

              {[
                { key:"essential", label:"Essential Services", desc:"Account authentication, trip storage, payment processing. Required for the app to function.",
                  locked:true, on:true },
                { key:"analytics", label:"Usage Analytics", desc:"Anonymous usage patterns to improve the app. No personal data sent. Mixpanel SDK.",
                  locked:false, on:consents.analytics },
                { key:"marketing", label:"Marketing Communications", desc:"Trip inspiration emails and feature announcements. Max 2 per month.",
                  locked:false, on:consents.marketing },
                { key:"thirdParty", label:"Third-Party Sharing", desc:"Share anonymized data with travel partners for better recommendations. Never includes PII.",
                  locked:false, on:consents.thirdParty },
              ].map(item => (
                <div key={item.key} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 0", borderBottom:`1px solid ${C.borderLight}` }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:600, fontSize:14 }}>{item.label}</p>
                    <p style={{ fontSize:12, color:C.text3, lineHeight:1.4 }}>{item.desc}</p>
                  </div>
                  <button onClick={() => !item.locked && setConsents(prev => ({
                    ...prev, [item.key]: !prev[item.key]
                  }))}
                    style={{ width:44, height:24, borderRadius:999, border:"none", cursor:item.locked?"not-allowed":"pointer",
                      background:item.on ? C.green : C.border, position:"relative", transition:"background .2s",
                      opacity:item.locked ? .6 : 1 }}>
                    <div style={{ width:20, height:20, borderRadius:999, background:"#fff",
                      position:"absolute", top:2, left:item.on ? 22 : 2, transition:"left .2s",
                      boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                  </button>
                  {item.locked && (
                    <span className="mono" style={{ fontSize:10, color:C.text3 }}>Required</span>
                  )}
                </div>
              ))}

              <div style={{ display:"flex", gap:10, marginTop:14 }}>
                <button style={{ flex:1, padding:"10px", borderRadius:8,
                  border:`1px solid ${C.border}`, background:"transparent",
                  color:C.text2, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                  Reject Non-Essential
                </button>
                <button style={{ flex:1.5, padding:"10px", borderRadius:8,
                  border:"none", background:C.green, color:"#fff",
                  fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Save Preferences
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Settings Panel */}
          <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px", marginBottom:16,
            border:`1px solid ${C.borderLight}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <Ic n="settings" s={18} c={C.teal}/>
              <span style={{ fontWeight:700, fontSize:16 }}>Settings → Privacy Panel</span>
            </div>

            <div style={{ background:C.bgAlt, borderRadius:12, padding:"14px 16px",
              border:`1px solid ${C.border}` }}>
              {[
                { key:"locationSharing", label:"Location sharing with group", desc:"Share your live location during active trips" },
                { key:"analyticsTracking", label:"Anonymous usage analytics", desc:"Help us improve by sharing anonymized app usage" },
                { key:"crashReporting", label:"Crash & error reporting", desc:"Automatically send crash reports to fix bugs faster" },
                { key:"socialPosting", label:"Social media auto-post", desc:"Allow Storyboard Agent to post on your behalf (requires per-post confirmation)" },
                { key:"doNotSell", label:"Do Not Sell My Data (CCPA)", desc:"Prevents any data sharing with third-party advertisers or aggregators" },
              ].map((item, i) => (
                <div key={item.key} style={{ display:"flex", alignItems:"center", gap:12,
                  padding:"10px 0",
                  borderBottom:i < 4 ? `1px solid ${C.borderLight}` : "none" }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:600, fontSize:13.5 }}>{item.label}</p>
                    <p style={{ fontSize:12, color:C.text3 }}>{item.desc}</p>
                  </div>
                  <button onClick={() => setPrivacyToggles(prev => ({
                    ...prev, [item.key]: !prev[item.key]
                  }))}
                    style={{ width:44, height:24, borderRadius:999, border:"none", cursor:"pointer",
                      background:privacyToggles[item.key] ? (item.key==="doNotSell"?C.red:C.green) : C.border,
                      position:"relative", transition:"background .2s" }}>
                    <div style={{ width:20, height:20, borderRadius:999, background:"#fff",
                      position:"absolute", top:2, left:privacyToggles[item.key] ? 22 : 2,
                      transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                  </button>
                </div>
              ))}

              {/* Data retention */}
              <div style={{ marginTop:12, padding:"12px 14px", background:C.surface,
                borderRadius:10, border:`1px solid ${C.border}` }}>
                <p style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>Data Retention Policy</p>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { val:"1year", label:"1 Year" },
                    { val:"2years", label:"2 Years" },
                    { val:"forever", label:"Until I delete" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setPrivacyToggles(prev => ({...prev, dataRetention:opt.val}))}
                      style={{ flex:1, padding:"8px", borderRadius:8, fontSize:12, fontWeight:600,
                        border:`1.5px solid ${privacyToggles.dataRetention===opt.val?C.teal:C.border}`,
                        background:privacyToggles.dataRetention===opt.val?`${C.teal}10`:"transparent",
                        color:privacyToggles.dataRetention===opt.val?C.teal:C.text3, cursor:"pointer" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:11, color:C.text3, marginTop:6, lineHeight:1.4 }}>
                  Trip data is kept for your selected period, then fully anonymized. Anonymized aggregate
                  data may be retained for product improvement. You can delete all data immediately via
                  Settings → Account → Delete My Data.
                </p>
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <button style={{ flex:1, padding:"10px", borderRadius:8,
                  border:`1px solid ${C.blue}40`, background:`${C.blue}08`,
                  color:C.blue, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  📄 Export My Data (JSON)
                </button>
                <button style={{ flex:1, padding:"10px", borderRadius:8,
                  border:`1px solid ${C.red}40`, background:`${C.red}06`,
                  color:C.red, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  🗑️ Delete All My Data
                </button>
              </div>
            </div>
          </div>

          {/* Per-screen data collection notice */}
          <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px",
            border:`1px solid ${C.borderLight}` }}>
            <p style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>
              Per-Screen Data Collection Notices
            </p>
            <p style={{ fontSize:13, color:C.text2, lineHeight:1.6, marginBottom:14 }}>
              Every screen that collects data displays an (ℹ) icon. Tapping reveals exactly what data
              is collected and why — no hidden collection.
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[
                { screen:"Interest Profiler", collects:"Hobby preferences, activity ratings", why:"Match POIs to your interests", tier:"Tier 3" },
                { screen:"Health Agent", collects:"Fitness level, medical conditions", why:"Ensure safe activity selection", tier:"Tier 2" },
                { screen:"Budget Setup", collects:"Budget amount, allocation preferences", why:"Optimize trip within budget", tier:"Tier 3" },
                { screen:"Flight Booking", collects:"Departure preference, cabin class", why:"Search flights (no PII sent to Amadeus)", tier:"Tier 3" },
                { screen:"Calendar Sync", collects:"Calendar access (OAuth)", why:"Create trip events", tier:"Tier 2" },
                { screen:"Storyboard", collects:"Social accounts (OAuth), posting style", why:"Generate personalized content", tier:"Tier 2" },
              ].map(item => (
                <div key={item.screen} style={{ background:C.bgAlt, borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontWeight:600, fontSize:12.5 }}>{item.screen}</span>
                    <span className="mono" style={{ fontSize:10,
                      color:item.tier==="Tier 2"?C.amber:C.green }}>{item.tier}</span>
                  </div>
                  <p style={{ fontSize:11, color:C.text3, lineHeight:1.4 }}>
                    <span style={{ color:C.text2 }}>Collects:</span> {item.collects}
                  </p>
                  <p style={{ fontSize:11, color:C.text3, lineHeight:1.4 }}>
                    <span style={{ color:C.text2 }}>Purpose:</span> {item.why}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Section>

      </main>
    </div>
  );
}
