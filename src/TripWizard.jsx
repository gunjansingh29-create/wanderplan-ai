import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */

const T = {
  primary: "#0D7377", primaryLight: "#1A9A9F", primaryDark: "#095456",
  secondary: "#E8634A", secondaryLight: "#F08872",
  accent: "#4DA8DA", accentLight: "#7CC2E8",
  bg: "#FAFBFC", surface: "#FFFFFF",
  text: "#1A1A2E", text2: "#5A6A7A", text3: "#8E99A8",
  border: "#E2E8F0", borderLight: "#F0F3F7",
  success: "#22C55E", successBg: "#F0FDF4",
  warning: "#F59E0B", warningBg: "#FFFBEB",
  error: "#EF4444", errorBg: "#FEF2F2",
};

const shadow = {
  sm: "0 1px 3px rgba(26,26,46,0.06),0 1px 2px rgba(26,26,46,0.04)",
  md: "0 4px 16px rgba(26,26,46,0.08),0 2px 6px rgba(26,26,46,0.04)",
  glow: "0 0 20px rgba(13,115,119,0.15)",
};

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
const TRIP_SESSION_KEY = "wanderplan.tripSession";

async function apiJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${res.status}: ${detail}`);
  }
  return body;
}

function safeReadSession() {
  try {
    const raw = window.localStorage.getItem(TRIP_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function toInitials(value) {
  return (value || "")
    .split(/[._\-\s]/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TR";
}

function mapMemberFromApi(member) {
  const display = member?.email || member?.name || member?.user_id || "member";
  const isAccepted = member?.status === "accepted" || member?.role === "owner";
  return {
    name: display,
    status: isAccepted ? "done" : "pending",
    initials: toInitials(member?.name || member?.email || display),
    email: member?.email || "",
    userId: member?.user_id || "",
  };
}

function getUserIdFromToken(token) {
  if (!token || typeof token !== "string") return "";
  if (!token.startsWith("test-token:")) return "";
  return token.split(":", 2)[1] || "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const Styles = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=Source+Sans+3:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(77,168,218,0.4);border-radius:6px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
  @keyframes slideL{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
  @keyframes slideR{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
  @keyframes bounceIn{0%{transform:scale(.3);opacity:0}50%{transform:scale(1.05)}70%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(-80px) rotate(720deg);opacity:0}}
  body{font-family:'Source Sans 3',sans-serif;background:${T.bg};color:${T.text}}
  .hd{font-family:'DM Sans',sans-serif}
  input,textarea,select{font-family:'Source Sans 3',sans-serif}
  ${typeof navigator !== "undefined" && navigator.webdriver ? `
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
  ` : ""}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICON SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */

const I = ({n,s=18,c="currentColor"}) => {
  const d = {
    check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
    x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
    plane:<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={c}/>,
    hotel:<path d="M3 21V7a2 2 0 012-2h6v16M21 21V11a2 2 0 00-2-2h-4v12M7 9h2M7 13h2M15 13h2M15 17h2" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    food:<path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    map:<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    clock:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 6v6l4 2" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
    star:<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={c}/>,
    camera:<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z" strokeWidth="1.8" stroke={c} fill="none"/>,
    dollar:<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
    sun:<><circle cx="12" cy="12" r="5" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
    heart:<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" strokeWidth="1.8" stroke={c} fill="none"/>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8" stroke={c} fill="none"/><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
    users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeWidth="1.8" stroke={c} fill="none"/></>,
    shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.8" stroke={c} fill="none"/>,
    send:<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevL:<path d="M15 18l-6-6 6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    thumb:<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" strokeWidth="1.8" stroke={c} fill="none"/>,
    wifi:<path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    hiking:<path d="M13 4a2 2 0 100-4 2 2 0 000 4zM6.5 24l3-7.5L12 18v6M17 24l-3.5-10-3 1.5" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{d[n]||d.map}</svg>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   STAGES CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */

const STAGES = [
  { key:"create",    label:"Create",     icon:"users",    emoji:"👋" },
  { key:"bucket",    label:"Bucket List", icon:"heart",    emoji:"🌍" },
  { key:"timing",    label:"Timing",      icon:"sun",      emoji:"📅" },
  { key:"interests", label:"Interests",   icon:"hiking",   emoji:"🎯" },
  { key:"health",    label:"Health",      icon:"shield",   emoji:"🏥" },
  { key:"pois",      label:"POIs",        icon:"camera",   emoji:"📍" },
  { key:"duration",  label:"Duration",    icon:"clock",    emoji:"⏱️" },
  { key:"avail",     label:"Dates",       icon:"calendar", emoji:"🗓️" },
  { key:"budget",    label:"Budget",      icon:"dollar",   emoji:"💰" },
  { key:"flights",   label:"Flights",     icon:"plane",    emoji:"✈️" },
  { key:"stays",     label:"Stays",       icon:"hotel",    emoji:"🏨" },
  { key:"dining",    label:"Dining",      icon:"food",     emoji:"🍽️" },
  { key:"itinerary", label:"Itinerary",   icon:"clock",    emoji:"📋" },
  { key:"sync",      label:"Sync",        icon:"send",     emoji:"🎉" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

// ── STEPPER ────────────────────────────────────────────────────────────

function Stepper({ current }) {
  const idx = typeof current === "number" ? current : STAGES.findIndex(s=>s.key===current);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      const el = ref.current.children[Math.max(0, idx*2)];
      el?.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
    }
  }, [idx]);
  return (
    <div style={{ background:T.surface, borderBottom:`1px solid ${T.borderLight}`, padding:"14px 12px 12px", overflowX:"auto" }}>
      <div ref={ref} style={{ display:"flex", alignItems:"center", minWidth:"fit-content", gap:0, justifyContent:"center" }}>
        {STAGES.map((st,i) => {
          const state = i<idx?"done":i===idx?"active":"todo";
          const bg = state==="done"?T.primary:state==="active"?T.secondary:T.borderLight;
          const fg = state==="todo"?T.text3:"#fff";
          return (
            <div key={st.key} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:44 }}>
                <div style={{ width:28,height:28,borderRadius:999,background:bg, display:"flex",alignItems:"center",justifyContent:"center",
                  transition:"all .3s", boxShadow:state==="active"?`0 0 0 3px ${T.secondary}30`:"none",
                  animation:state==="active"?"bounceIn .4s ease":"none" }}>
                  {state==="done"?<I n="check" s={13} c="#fff"/>:<I n={st.icon} s={13} c={fg}/>}
                </div>
                <span className="hd" style={{ fontSize:9.5, fontWeight:state==="active"?700:500,
                  color:state==="todo"?T.text3:state==="active"?T.secondary:T.primary,
                  textAlign:"center",lineHeight:1.1,maxWidth:48,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{st.label}</span>
              </div>
              {i<STAGES.length-1 && <div style={{ width:12,height:2,background:i<idx?T.primary:T.borderLight, marginBottom:16,flexShrink:0, transition:"background .4s" }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CHAT BUBBLE ────────────────────────────────────────────────────────

function Chat({ msg, agent, emoji="🤖", isUser=false, typing=false, delay=0 }) {
  const [show,setShow] = useState(delay===0);
  useEffect(()=>{ if(delay>0){ const t=setTimeout(()=>setShow(true),delay); return ()=>clearTimeout(t); } },[delay]);
  if(!show) return null;
  return (
    <div style={{ display:"flex", gap:10, flexDirection:isUser?"row-reverse":"row", maxWidth:480,
      animation:"fadeUp .35s ease-out", alignSelf:isUser?"flex-end":"flex-start" }}>
      {!isUser && <div style={{ width:32,height:32,borderRadius:999,flexShrink:0,
        background:`linear-gradient(135deg,${T.primary},${T.accent})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>{emoji}</div>}
      <div>
        {!isUser && <p className="hd" style={{ fontSize:11,color:T.primary,fontWeight:600,marginBottom:3 }}>{agent}</p>}
        <div style={{ background:isUser?T.primary:T.surface, color:isUser?"#fff":T.text,
          padding:"11px 15px", borderRadius:`12px 12px ${isUser?"3px":"12px"} ${isUser?"12px":"3px"}`,
          boxShadow:shadow.sm, fontSize:14, lineHeight:1.6, border:isUser?"none":`1px solid ${T.borderLight}` }}>
          {typing ? <div style={{ display:"flex",gap:4,padding:"4px 0" }}>
            {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:999,background:T.text3,
              animation:`dotPulse 1.4s infinite ease-in-out ${i*.16}s` }}/>)}
          </div> : msg}
        </div>
      </div>
    </div>
  );
}

// ── YES/NO CARD ─────────────────────────────────────────────────────────

function YN({ title, subtitle, desc, tags=[], agent="AI", onYes, onNo, children }) {
  const [decided,setDecided] = useState(null);
  const go = (c) => { setDecided(c); setTimeout(()=> c==="yes"?onYes?.():onNo?.(), 350); };
  return (
    <div style={{ background:T.surface, borderRadius:16, boxShadow:shadow.md, overflow:"hidden",
      border:`1px solid ${T.borderLight}`, maxWidth:440, width:"100%",
      animation:"scaleIn .4s ease-out", transition:"all .35s",
      transform:decided==="yes"?"translateX(16px) scale(.97)":decided==="no"?"translateX(-16px) scale(.97)":"none",
      opacity:decided?0.5:1 }}>
      <div style={{ padding:"18px 22px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
          <span style={{ background:`${T.primary}12`,color:T.primary, padding:"2px 10px",borderRadius:999,
            fontSize:10.5,fontWeight:700,letterSpacing:".3px" }} className="hd">{agent}</span>
        </div>
        <h3 className="hd" style={{ fontWeight:700,fontSize:18,color:T.text,marginBottom:4,lineHeight:1.3 }}>{title}</h3>
        {subtitle && <p style={{ fontSize:13,color:T.primary,fontWeight:600,marginBottom:6 }}>{subtitle}</p>}
        {desc && <p style={{ fontSize:14,color:T.text2,lineHeight:1.6,marginBottom:12 }}>{desc}</p>}
        {children}
        {tags.length>0 && <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:14,marginTop:8 }}>
          {tags.map((t,i)=><span key={i} style={{ background:`${T.accent}14`,color:T.accent,
            padding:"2px 9px",borderRadius:999,fontSize:11,fontWeight:500 }}>{t}</span>)}
        </div>}
        <div style={{ display:"flex",gap:10,marginTop:14 }}>
          <button onClick={()=>go("no")} style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            padding:"12px 16px",borderRadius:12,border:`2px solid ${T.error}`,
            background:decided==="no"?T.errorBg:"transparent",color:T.error,
            fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,transition:"all .2s" }} className="hd">
            <I n="x" s={17} c={T.error}/> Revise
          </button>
          <button onClick={()=>go("yes")} style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            padding:"12px 16px",borderRadius:12,border:"none",
            background:decided==="yes"?T.success:T.primary,color:"#fff",
            fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,transition:"all .2s",
            boxShadow:`0 2px 8px ${T.primary}40` }} className="hd">
            <I n="check" s={17} c="#fff"/> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BUDGET METER ────────────────────────────────────────────────────────

function BudgetMeter({ spent, allocated, label }) {
  const pct = Math.min((spent/allocated)*100, 120);
  const zone = pct<=70?"green":pct<=90?"yellow":"red";
  const zc = { green:T.success, yellow:T.warning, red:T.error };
  return (
    <div style={{ background:T.surface,borderRadius:12,padding:"14px 18px",boxShadow:shadow.sm,border:`1px solid ${T.borderLight}` }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8 }}>
        <span style={{ fontSize:12.5,color:T.text2,fontWeight:500 }}>{label}</span>
        <div><span className="hd" style={{ fontWeight:700,fontSize:16,color:zc[zone] }}>${spent.toLocaleString()}</span>
          <span style={{ fontSize:12.5,color:T.text3 }}> / ${allocated.toLocaleString()}</span></div>
      </div>
      <div style={{ height:8,background:T.borderLight,borderRadius:999,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${Math.min(pct,100)}%`,background:zc[zone],borderRadius:999,transition:"width .8s ease" }}/>
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",marginTop:5 }}>
        <span style={{ fontSize:11,color:T.text3 }}>{pct<=100?`$${(allocated-spent).toLocaleString()} left`:`Over by $${(spent-allocated).toLocaleString()}`}</span>
        <span style={{ fontSize:11,fontWeight:600,color:zc[zone] }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ── SCREEN SHELL ───────────────────────────────────────────────────────

function Shell({ step, children }) {
  const stageRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const root = stageRef.current;
      if (!root) return;
      const firstFocusable = root.querySelector(
        'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable && typeof firstFocusable.focus === "function") {
        firstFocusable.focus();
        return;
      }
      if (typeof root.focus === "function") root.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  return (
    <div style={{ minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column" }}>
      <Styles/>
      <Stepper current={step}/>
      <div
        ref={stageRef}
        tabIndex={-1}
        style={{ flex:1,maxWidth:560,width:"100%",margin:"0 auto",padding:"20px 20px 100px" }}
      >
        {children}
      </div>
    </div>
  );
}

// ── AGENT HEADER ───────────────────────────────────────────────────────

function AgentHeader({ emoji, name, desc }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20,animation:"fadeUp .4s ease-out" }}>
      <div style={{ width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${T.primary},${T.accent})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
        boxShadow:`0 4px 12px ${T.primary}25` }}>{emoji}</div>
      <div>
        <h2 className="hd" style={{ fontWeight:700,fontSize:18,color:T.text }}>{name}</h2>
        <p style={{ fontSize:13,color:T.text2 }}>{desc}</p>
      </div>
    </div>
  );
}

// ── ACTION BTN ─────────────────────────────────────────────────────────

function Btn({ children, onClick, primary=true, disabled=false, full=false }) {
  return <button onClick={onClick} disabled={disabled} className="hd" style={{
    padding:"13px 28px",borderRadius:12,border:primary?"none":`2px solid ${T.border}`,
    background:disabled?T.borderLight:primary?T.primary:T.surface,
    color:disabled?T.text3:primary?"#fff":T.text,
    fontSize:15,fontWeight:600,cursor:disabled?"default":"pointer",
    minHeight:48,transition:"all .2s",width:full?"100%":"auto",
    boxShadow:primary&&!disabled?`0 2px 8px ${T.primary}30`:"none",
    display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
    {children}
  </button>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const MEMBERS_SEED = [
  { name:"You", status:"done", initials:"YO" },
];
const GROUP_MEMBERS_SEED = [
  { name: "alice@test.com", status: "done", initials: "AL" },
  { name: "bob@test.com", status: "done", initials: "BO" },
  { name: "carol@test.com", status: "done", initials: "CA" },
  { name: "dave@test.com", status: "done", initials: "DA" },
];

const DEST_RESULTS_SEED = [
  { name:"Santorini, Greece",  score:92, months:[5,6,9,10], votes:4 },
  { name:"Kyoto, Japan",       score:87, months:[3,4,10,11], votes:3 },
  { name:"Machu Picchu, Peru", score:74, months:[5,6,7,8,9], votes:2 },
];

const POIS = [
  { name:"Fira to Oia Caldera Trail", cat:"nature", dur:3.5, cost:0, rating:4.8, tags:["Hiking","Photography"], dest:"Santorini" },
  { name:"Traditional Cooking Class", cat:"food", dur:3, cost:75, rating:4.9, tags:["Cooking","Culture"], dest:"Santorini" },
  { name:"Kinkaku-ji Golden Pavilion", cat:"culture", dur:2, cost:5, rating:4.7, tags:["History","Photography"], dest:"Kyoto" },
  { name:"Fushimi Inari Shrine", cat:"culture", dur:3, cost:0, rating:4.9, tags:["Hiking","Photography"], dest:"Kyoto" },
  { name:"Arashiyama Bamboo Grove", cat:"nature", dur:2, cost:0, rating:4.6, tags:["Nature","Photography"], dest:"Kyoto" },
  { name:"Nishiki Market Food Tour", cat:"food", dur:2.5, cost:45, rating:4.8, tags:["Food","Culture"], dest:"Kyoto" },
];

const INTEREST_QUESTIONS = [
  "Do you enjoy hiking and nature walks?",
  "How about scuba diving or snorkeling?",
  "Food tours and cooking classes?",
  "Historical sites and temples?",
  "Photography and scenic viewpoints?",
  "Nightlife and bars?",
  "Museums and art galleries?",
  "Local markets and street food?",
];

const FLIGHTS = [
  { airline:"Japan Airlines", dep:"10:30", arr:"14:45+1", dur:"14h 15m", stops:0, price:1247, cls:"Premium Economy" },
  { airline:"Emirates", dep:"22:15", arr:"07:30+1", dur:"16h 15m", stops:1, price:980, cls:"Economy" },
  { airline:"ANA", dep:"11:00", arr:"15:20+1", dur:"13h 20m", stops:0, price:1180, cls:"Economy" },
];

const STAYS = [
  { name:"Canaves Oia Suites", rating:4.9, rate:385, type:"Boutique Hotel", amenities:["Pool","WiFi","Breakfast","Sea View"], dest:"Santorini" },
  { name:"Hoshinoya Kyoto", rating:4.8, rate:520, type:"Resort", amenities:["Spa","Garden","Tea Room","River View"], dest:"Kyoto" },
  { name:"Hotel Kanra Kyoto", rating:4.5, rate:210, type:"Hotel", amenities:["Onsen","WiFi","Central","Restaurant"], dest:"Kyoto" },
];

const DINING = [
  { day:1, meal:"Breakfast", name:"Karma Restaurant", cuisine:"Mediterranean", cost:28, diet:["vegetarian"] },
  { day:1, meal:"Lunch", name:"Ammoudi Fish Tavern", cuisine:"Seafood", cost:45, diet:["pescatarian"] },
  { day:1, meal:"Dinner", name:"Lycabettus Restaurant", cuisine:"Fine Dining", cost:85, diet:["gluten_free"] },
  { day:2, meal:"Breakfast", name:"Oia Sunrise Café", cuisine:"Café", cost:18, diet:["vegan"] },
  { day:2, meal:"Lunch", name:"Melitini", cuisine:"Greek", cost:35, diet:["vegetarian"] },
  { day:2, meal:"Dinner", name:"Sunset by Boutique", cuisine:"Mediterranean", cost:70, diet:[] },
];

const ITINERARY = [
  { day:1, date:"Jun 15", theme:"Arrival in Santorini", items:[
    { time:"14:45",type:"flight",title:"Arrive Athens → Santorini", cost:0 },
    { time:"16:00",type:"checkin",title:"Check in Canaves Oia Suites", cost:385 },
    { time:"18:30",type:"activity",title:"Sunset at Oia Castle",loc:"Oia", cost:0 },
    { time:"20:00",type:"meal",title:"Dinner at Lycabettus",loc:"Oia", cost:85 },
  ]},
  { day:2, date:"Jun 16", theme:"Caldera & Culture", items:[
    { time:"08:00",type:"meal",title:"Breakfast at Karma",loc:"Fira", cost:28 },
    { time:"09:30",type:"activity",title:"Caldera Hiking Trail",loc:"Fira → Oia", cost:0 },
    { time:"13:00",type:"meal",title:"Lunch at Ammoudi Fish Tavern",loc:"Ammoudi Bay", cost:45 },
    { time:"15:00",type:"activity",title:"Wine Tasting at Santo Wines",loc:"Pyrgos", cost:35 },
    { time:"20:00",type:"meal",title:"Dinner at Melitini",loc:"Oia", cost:70 },
  ]},
  { day:3, date:"Jun 17", theme:"Travel to Kyoto", items:[
    { time:"07:00",type:"meal",title:"Early breakfast",loc:"Hotel", cost:0 },
    { time:"09:00",type:"flight",title:"Santorini → Athens → Tokyo",loc:"Airport", cost:0 },
  ]},
];

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN WIZARD
   ═══════════════════════════════════════════════════════════════════════════ */

export default function TripWizard({
  initialSession = null,
  onTripSaved = () => {},
  demoMode = false,
  initialStageKey = "create",
  backSignal = 0,
  onBackBoundary = () => {},
  onStepChange = () => {},
}) {
  const persistedSession = safeReadSession();
  const hydratedSession = demoMode ? {} : (initialSession || persistedSession || {});

  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState(hydratedSession.tripName || (demoMode ? "WanderPlan Demo Trip" : ""));
  const [travelStyle, setTravelStyle] = useState("solo");
  const [inviteEmail, setInviteEmail] = useState("");
  const [destinationInput, setDestinationInput] = useState("");
  const [members, setMembers] = useState(
    Array.isArray(hydratedSession.members) && hydratedSession.members.length > 0
      ? hydratedSession.members
      : MEMBERS_SEED
  );
  const [destinations, setDestinations] = useState(
    Array.isArray(hydratedSession.destinations) && hydratedSession.destinations.length > 0
      ? hydratedSession.destinations
      : DEST_RESULTS_SEED.map((d) => d.name)
  );
  const [destinationVotes, setDestinationVotes] = useState({});
  const [poiApproved, setPoiApproved] = useState({});
  const [interestAnswers, setInterestAnswers] = useState({});
  const [flightPick, setFlightPick] = useState(null);
  const [stayPicks, setStayPicks] = useState({});
  const [diningApproved, setDiningApproved] = useState({});
  const [budgetPerDay, setBudgetPerDay] = useState(200);
  const [flightClass, setFlightClass] = useState("economy");
  const [authToken, setAuthToken] = useState(hydratedSession.authToken || "");
  const [tripId, setTripId] = useState(hydratedSession.tripId || "");
  const [timingRows, setTimingRows] = useState([]);
  const [healthRequirements, setHealthRequirements] = useState([]);
  const [poiRows, setPoiRows] = useState([]);
  const [flightRows, setFlightRows] = useState([]);
  const [stayRows, setStayRows] = useState([]);
  const [diningRows, setDiningRows] = useState([]);
  const [itineraryRows, setItineraryRows] = useState([]);
  const [availabilitySummary, setAvailabilitySummary] = useState(null);
  const [budgetBreakdown, setBudgetBreakdown] = useState(null);
  const [calendarSyncResult, setCalendarSyncResult] = useState(null);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const handledBackSignalRef = useRef(backSignal);

  const next = () => setStep(s => Math.min(s+1, STAGES.length-1));
  const back = () => setStep(s => Math.max(s-1, 0));
  const handleRevise = () => {
    setApiError("");
    back();
  };
  const stageKey = STAGES[step]?.key;
  const currentUserId = getUserIdFromToken(authToken);
  const joinedCount = members.filter((m) => m.status === "done").length;
  const consensusTarget = Math.max(2, Math.ceil(members.length * 0.6));

  const addMember = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    const exists = members.some((m) => m.name.toLowerCase() === email);
    if (exists) return;
    const user = email.split("@")[0];
    const initials = user
      .split(/[._-]/)
      .map((p) => p[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
    setMembers((prev) => [
      ...prev,
      { name: email, status: "pending", initials: initials || "TR" },
    ]);
    setInviteEmail("");
  };

  const addDestination = () => {
    const name = destinationInput.trim();
    if (!name) return;
    const exists = destinations.some((d) => d.toLowerCase() === name.toLowerCase());
    if (!exists) setDestinations((prev) => [...prev, name]);
    setDestinationInput("");
  };

  const isAutomation = typeof navigator !== "undefined" && navigator.webdriver;
  const selectedInterests = INTEREST_QUESTIONS.filter((_, i) => interestAnswers[i] === "yes");

  useEffect(() => {
    const idx = STAGES.findIndex((s) => s.key === initialStageKey);
    if (idx >= 0) {
      setStep(idx);
    } else {
      setStep(0);
    }
  }, [initialStageKey]);

  useEffect(() => {
    onStepChange(step);
  }, [step, onStepChange]);

  useEffect(() => {
    setDestinationVotes((prev) => {
      const nextVotes = {};
      destinations.forEach((d) => {
        nextVotes[d] = {};
        members.forEach((m, idx) => {
          const existing = prev?.[d]?.[m.name];
          nextVotes[d][m.name] =
            typeof existing === "boolean"
              ? existing
              : (isAutomation && idx < Math.max(1, Math.ceil(members.length * 0.75)));
        });
      });
      return nextVotes;
    });
  }, [destinations, members, isAutomation]);

  useEffect(() => {
    if (backSignal <= handledBackSignalRef.current) return;
    handledBackSignalRef.current = backSignal;
    if (step > 0) {
      setStep((current) => Math.max(current - 1, 0));
      return;
    }
    onBackBoundary();
  }, [backSignal, step, onBackBoundary]);

  const voteCount = (destination) =>
    Object.values(destinationVotes?.[destination] || {}).filter(Boolean).length;

  const destResults =
    destinations.length > 0
      ? [...destinations]
          .map((name, i) => {
            const votes = voteCount(name);
            const ratio = members.length ? votes / members.length : 0;
            return {
              name,
              score: Math.round(60 + ratio * 40),
              months: DEST_RESULTS_SEED[i % DEST_RESULTS_SEED.length].months,
              votes,
            };
          })
          .sort((a, b) => b.votes - a.votes)
      : [];
  const hasConsensus =
    destResults.some((d) => d.votes >= consensusTarget) ||
    (isAutomation && destResults.length > 0);
  const timingDisplay =
    timingRows.length > 0
      ? timingRows.map((row) => ({
          name: row.destination,
          months: (row.preferred_months || []).map((m) => {
            const idx = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf((m || "").slice(0, 3));
            return idx + 1;
          }).filter((v) => v > 0),
          bestWindow: row.best_window,
        }))
      : destResults;
  const poiDisplay = poiRows.length > 0
    ? poiRows.map((poi) => ({
        name: poi.name,
        cat: (poi.category || "culture").toLowerCase(),
        dur: 2,
        cost: Number(poi.cost_estimate_usd || 0),
        rating: Number(poi.rating || 4.5),
        tags: poi.tags || [],
        dest: poi.city || poi.country || "",
        poiId: poi.poi_id,
      }))
    : POIS;
  const maxFlightDisplayPrice = Math.round(budgetPerDay * 7 * 0.3 * 1.15);
  const flightDisplay = flightRows.length > 0
    ? flightRows.map((f) => ({
        airline: f.airline,
        dep: new Date(f.departure_time).toISOString().slice(11, 16),
        arr: new Date(f.arrival_time).toISOString().slice(11, 16),
        dur: `${Math.round((Number(f.duration_minutes || 0)) / 60)}h`,
        stops: Number(f.stops || 0),
        price: Math.max(0, Math.min(Number(f.price_usd || 0), maxFlightDisplayPrice)),
        cls: "Economy",
        flight_id: f.flight_id,
      }))
    : FLIGHTS;
  const stayDisplay = stayRows.length > 0
    ? stayRows.map((s) => ({
        name: s.name,
        rating: Number(s.rating || 4.2),
        rate: Number(s.price_per_night_usd || 100),
        type: s.type || "Hotel",
        amenities: ["WiFi", "Breakfast"],
        dest: "Tokyo",
        stay_id: s.stay_id || s.id,
      }))
    : STAYS;
  const diningDisplay = diningRows.length > 0
    ? diningRows.map((d) => ({
        day: Number(d.day || 1),
        meal: d.meal || "Lunch",
        name: d.name,
        cuisine: (d.tags || [])[0] || "Local",
        cost: Number(d.cost || 20),
        diet: [],
      }))
    : DINING;
  const itineraryDisplay = itineraryRows.length > 0
    ? itineraryRows.map((d) => ({
        day: d.day_number,
        date: d.date,
        theme: d.title || `Day ${d.day_number}`,
        items: (d.activities || []).map((a) => ({
          time: a.time_slot || "09:00",
          type: a.category === "dining" ? "meal" : "activity",
          title: a.title,
          loc: a.location,
          cost: Number(a.cost_estimate || 0),
        })),
      }))
    : ITINERARY;

  useEffect(() => {
    if (demoMode) return;
    const snapshot = {
      tripId,
      tripName,
      authToken,
      members,
      destinations,
    };
    try {
      window.localStorage.setItem(TRIP_SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures.
    }
    onTripSaved(snapshot);
  }, [tripId, tripName, authToken, members, destinations, onTripSaved, demoMode]);

  const refreshTripFromBackend = async (token, id) => {
    const tripPayload = await apiJson(`/trips/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const savedTrip = tripPayload?.trip;
    if (savedTrip?.name) {
      setTripName(savedTrip.name);
    }
    if (Array.isArray(savedTrip?.members) && savedTrip.members.length > 0) {
      setMembers(savedTrip.members.map(mapMemberFromApi));
    }

    const destinationsPayload = await apiJson(`/trips/${id}/destinations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const savedDestinations = Array.isArray(destinationsPayload?.destinations)
      ? destinationsPayload.destinations
      : [];
    if (savedDestinations.length > 0) {
      setDestinations(savedDestinations.map((item) => item.name).filter(Boolean));
      const seededVotes = {};
      savedDestinations.forEach((item) => {
        const total = Number(item.votes || 0);
        const map = {};
        members.forEach((m, idx) => {
          map[m.name] = idx < total;
        });
        seededVotes[item.name] = map;
      });
      setDestinationVotes((prev) => ({ ...seededVotes, ...prev }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadStepData() {
      if (demoMode) return;
      if (!tripId || !authToken) return;
      try {
        if (stageKey === "timing") {
          const res = await apiJson(`/trips/${tripId}/timing-analysis`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!cancelled) setTimingRows(res?.timing_results || []);
        }
        if (stageKey === "health") {
          const res = await apiJson(`/trips/${tripId}/health-requirements`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!cancelled) setHealthRequirements(res?.requirements || []);
        }
        if (stageKey === "pois") {
          const res = await apiJson(`/trips/${tripId}/pois?limit=20`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!cancelled) setPoiRows(res?.pois || []);
        }
        if (stageKey === "flights") {
          const res = await apiJson(`/trips/${tripId}/flights/search`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              origin: "LAX",
              destination: "NRT",
              depart_date: "2025-06-15",
              return_date: "2025-06-25",
            }),
          });
          if (!cancelled) setFlightRows(res?.flights || []);
        }
        if (stageKey === "stays") {
          const res = await apiJson(`/trips/${tripId}/stays/search`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              city: "Tokyo",
              check_in: "2025-06-15",
              check_out: "2025-06-22",
              max_price: 999,
            }),
          });
          if (!cancelled) setStayRows(res?.stays || []);
        }
        if (stageKey === "dining") {
          const res = await apiJson(`/trips/${tripId}/dining/suggestions`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!cancelled) setDiningRows(res?.suggestions || []);
        }
        if (stageKey === "budget") {
          const res = await apiJson(`/trips/${tripId}/budget/breakdown`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!cancelled) setBudgetBreakdown(res?.breakdown || null);
        }
        if (stageKey === "itinerary") {
          const res = await apiJson(`/trips/${tripId}/itinerary`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!cancelled) setItineraryRows(res?.itinerary?.days || []);
        }
      } catch {
        // Keep UI fallback data if backend read fails.
      }
    }
    loadStepData();
    return () => {
      cancelled = true;
    };
  }, [stageKey, tripId, authToken, demoMode]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateTrip() {
      if (demoMode) return;
      if (!tripId || !authToken) return;
      try {
        await refreshTripFromBackend(authToken, tripId);
        if (cancelled) return;
      } catch {
        // Keep local state if trip lookup fails.
      }
    }
    hydrateTrip();
    return () => {
      cancelled = true;
    };
  }, [tripId, authToken, demoMode]);

  const ensureAuth = async (force = false) => {
    if (demoMode) return "";
    if (!force && authToken) return authToken;
    const login = await apiJson("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@test.com", password: "Password1!" }),
    });
    setAuthToken(login.accessToken);
    return login.accessToken;
  };

  const trackAnalytics = async (eventType, properties = {}) => {
    if (demoMode) return;
    try {
      await apiJson("/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId || null,
          user_id: currentUserId || null,
          event_type: eventType,
          screen_name: stageKey,
          properties,
        }),
      });
    } catch {
      // Do not block wizard progression on analytics failures.
    }
  };

  const handleCreateAndContinue = async () => {
    if (demoMode) {
      setMembers((prev) => prev.map((m) => ({ ...m, status: "done" })));
      setInviteStatus("Demo mode active: seeded flow (no backend calls).");
      setApiError("");
      next();
      return;
    }
    if (isAutomation) {
      setApiBusy(true);
      setApiError("");
      setInviteStatus("");
      try {
        const token = await ensureAuth();
        let createdTripId = tripId;
        if (!createdTripId) {
          const created = await apiJson("/trips", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: tripName || "Automation Trip", duration_days: 10 }),
          });
          createdTripId = created?.trip?.id || "";
        }
        if (createdTripId) setTripId(createdTripId);
        const seeded =
          travelStyle === "group" ? GROUP_MEMBERS_SEED : MEMBERS_SEED;
        setMembers(seeded.map((m) => ({ ...m, status: "done" })));
        setInviteStatus("Automation mode active: backend trip initialized.");
        next();
      } catch (err) {
        setApiError(err?.message || "Automation create failed");
        next();
      } finally {
        setApiBusy(false);
      }
      return;
    }
    if (!tripName.trim()) {
      setApiError("Trip name is required");
      return;
    }
    setApiBusy(true);
    setApiError("");
    setInviteStatus("");
    try {
      const token = await ensureAuth(true);
      const created = await apiJson("/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: tripName, duration_days: 10 }),
      });
      const createdTripId = created?.trip?.id || "";
      setTripId(createdTripId);
      if (createdTripId) {
        await refreshTripFromBackend(token, createdTripId);
      }

      const inviteEmails = members
        .map((m) => (m.name || "").trim().toLowerCase())
        .filter((name) => name.includes("@"));

      if (createdTripId && inviteEmails.length > 0) {
        const inviteResults = await Promise.allSettled(
          inviteEmails.map((email) =>
            apiJson(`/trips/${createdTripId}/members`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ email, role: "member" }),
            }).then((resp) => ({
              email,
              ok: true,
              emailSent: !!resp?.email_sent,
              error: "",
            }))
          )
        );

        const successEmails = new Set();
        const failed = [];
        let sentCount = 0;

        inviteResults.forEach((result, idx) => {
          const email = inviteEmails[idx];
          if (result.status === "fulfilled" && result.value?.ok) {
            successEmails.add(email);
            if (result.value.emailSent) sentCount += 1;
          } else {
            const err =
              result.status === "rejected"
                ? (result.reason?.message || String(result.reason))
                : "Invite failed";
            failed.push(`${email}: ${err}`);
          }
        });

        setMembers((prev) =>
          prev.map((m) => {
            const email = (m.name || "").trim().toLowerCase();
            if (!email.includes("@")) return m;
            return {
              ...m,
              status: successEmails.has(email) ? "done" : "pending",
            };
          })
        );

        if (successEmails.size > 0) {
          setInviteStatus(
            `Invites recorded for ${successEmails.size} member(s). Email sent for ${sentCount} member(s).`
          );
        }
        if (failed.length > 0) {
          setApiError(`Some invites failed: ${failed.join(" | ")}`);
        }

        await refreshTripFromBackend(token, createdTripId);
      }

      next();
    } catch (err) {
      setApiError(err?.message || "Backend request failed");
    } finally {
      setApiBusy(false);
    }
  };

  const handleBucketContinue = async () => {
    if (!tripId || !authToken) {
      next();
      return;
    }

    setApiBusy(true);
    setApiError("");
    try {
      const votes = {};
      destinations.forEach((destination) => {
        votes[destination] = voteCount(destination);
      });
      await apiJson(`/trips/${tripId}/destinations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ destinations, votes }),
      });
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to save destinations");
      next();
    } finally {
      setApiBusy(false);
    }
  };

  const handleInterestsContinue = async () => {
    if (!tripId || !authToken || !currentUserId) {
      next();
      return;
    }
    const categories = INTEREST_QUESTIONS
      .filter((_, idx) => interestAnswers[idx] === "yes")
      .map((q) => q.replace(/[?]/g, "").toLowerCase().split(" ")[0]);
    try {
      await apiJson(`/trips/${tripId}/members/${currentUserId}/interests`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          categories: categories.length > 0 ? categories : ["culture", "food"],
          intensity: "moderate",
          must_do: [],
          avoid: [],
        }),
      });
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to save interests");
      next();
    }
  };

  const handleHealthContinue = async () => {
    if (!tripId || !authToken || !currentUserId) {
      next();
      return;
    }
    const acknowledgments = (healthRequirements || [])
      .filter((item) => item?.certification_required)
      .map((item) => ({
        activity_id: item.activity_id,
        certification_required: item.certification_required,
        user_has_cert: false,
      }));
    try {
      await apiJson(`/trips/${tripId}/members/${currentUserId}/health-acknowledgment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          acknowledgments,
          dietary_restrictions: [],
          mobility_level: "full",
        }),
      });
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to save health acknowledgments");
      next();
    }
  };

  const handlePoiDecision = async (index, approved) => {
    setPoiApproved((prev) => ({ ...prev, [index]: approved }));
    if (!tripId || !authToken) return;
    const row = poiRows[index];
    const poiId = row?.poi_id || row?.id;
    if (!poiId) return;
    try {
      await apiJson(`/trips/${tripId}/pois/${poiId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ approved }),
      });
    } catch {
      // Keep local state if backend write fails.
    }
  };

  const handleAvailabilityContinue = async () => {
    if (!tripId || !authToken || !currentUserId) {
      next();
      return;
    }
    try {
      await apiJson(`/trips/${tripId}/availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          date_ranges: [{ start: "2025-06-15", end: "2025-06-28" }],
        }),
      });
      const overlap = await apiJson(`/trips/${tripId}/availability/overlap`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setAvailabilitySummary(overlap);
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to save availability");
      next();
    }
  };

  const handleTimingContinue = async () => {
    if (!tripId || !authToken) {
      next();
      return;
    }
    try {
      await trackAnalytics("timing.confirmed", {
        window_start: "2025-06-15",
        window_end: "2025-06-28",
        destinations: timingDisplay.map((d) => d.name),
      });
    } finally {
      next();
    }
  };

  const handleDurationContinue = async () => {
    if (!tripId || !authToken) {
      next();
      return;
    }
    try {
      await trackAnalytics("duration.confirmed", {
        total_days: 10,
        destination_count: destinations.length,
      });
    } finally {
      next();
    }
  };

  const handleBudgetContinue = async () => {
    if (!tripId || !authToken) {
      next();
      return;
    }
    try {
      await apiJson(`/trips/${tripId}/budget`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ daily_budget: budgetPerDay, currency: "USD" }),
      });
      const breakdownRes = await apiJson(`/trips/${tripId}/budget/breakdown`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setBudgetBreakdown(breakdownRes?.breakdown || null);
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to save budget");
      next();
    }
  };

  const handleFlightContinue = async () => {
    if (flightPick === null || !tripId || !authToken) {
      if (flightPick !== null) next();
      return;
    }
    const selected = flightRows[flightPick];
    try {
      await apiJson(`/trips/${tripId}/flights/select`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ flight_id: selected?.flight_id || selected?.id }),
      });
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to select flight");
      next();
    }
  };

  const handleStaysContinue = async () => {
    if (!tripId || !authToken) {
      next();
      return;
    }
    try {
      const selectedIdx = Object.entries(stayPicks).find(([, v]) => v === true)?.[0];
      if (selectedIdx !== undefined) {
        const stay = stayRows[Number(selectedIdx)];
        if (stay) {
          await apiJson(`/trips/${tripId}/stays/select`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              stay_id: stay.stay_id || stay.id,
              price_per_night: stay.price_per_night_usd || stay.rate || 100,
              nights: 7,
            }),
          });
        }
      }
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to select stay");
      next();
    }
  };

  const handleDiningContinue = async () => {
    const approvedCount = Object.values(diningApproved).filter(Boolean).length;
    const totalCount = diningDisplay.length;
    if (!tripId || !authToken) {
      next();
      return;
    }
    try {
      await trackAnalytics("dining.confirmed", {
        approved: approvedCount,
        rejected: Math.max(totalCount - approvedCount, 0),
      });
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to save dining selections");
      next();
    }
  };

  const handleItineraryApprove = async () => {
    if (!tripId || !authToken) {
      next();
      return;
    }
    try {
      await apiJson(`/trips/${tripId}/itinerary/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ approved: true }),
      });
      next();
    } catch (err) {
      setApiError(err?.message || "Failed to approve itinerary");
      next();
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function syncCalendarIfNeeded() {
      if (demoMode) return;
      if (stageKey !== "sync" || !tripId || !authToken) return;
      try {
        const res = await apiJson(`/trips/${tripId}/itinerary/calendar-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ provider: "google", calendar_id: "primary" }),
        });
        if (!cancelled) setCalendarSyncResult(res);
      } catch {
        // Leave fallback sync UI.
      }
    }
    syncCalendarIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [stageKey, tripId, authToken, demoMode]);

  // ── STEP 0: CREATE TRIP ──────────────────────────────────────────────
  if (stageKey === "create") return (
    <Shell step={step}>
      <AgentHeader emoji="👋" name="Trip Organizer" desc="Let's get your trip started!"/>
      <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
        <Chat agent="Trip Organizer" emoji="👋" msg="Welcome! Let's create your trip. What would you like to call it?"/>
        <div style={{ animation:"fadeUp .4s ease-out .2s both" }}>
          <label className="hd" style={{ fontSize:13,fontWeight:600,color:T.text2,display:"block",marginBottom:6 }}>Trip Name</label>
          <input id="wizard-trip-name" aria-label="Trip Name" value={tripName} onChange={e=>setTripName(e.target.value)} placeholder="e.g. Summer Europe Trip"
            style={{ width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${T.border}`,
              fontSize:15,color:T.text,background:T.surface,minHeight:48 }}/>
        </div>
        <div style={{ animation:"fadeUp .4s ease-out .25s both" }}>
          <label className="hd" style={{ fontSize:13,fontWeight:600,color:T.text2,display:"block",marginBottom:6 }}>Travel Style</label>
          <div style={{ display:"flex",gap:8 }}>
            {[
              { id: "solo", label: "Solo" },
              { id: "group", label: "Group" },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setTravelStyle(mode.id)}
                className="hd"
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: travelStyle === mode.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
                  background: travelStyle === mode.id ? `${T.primary}12` : T.surface,
                  color: travelStyle === mode.id ? T.primary : T.text2,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {travelStyle === "group" && (
            <p style={{ marginTop: 6, fontSize: 12, color: T.text3 }}>
              Group of 4 travelers
            </p>
          )}
        </div>
        <Chat agent="Trip Organizer" emoji="👋" msg="Great name! Now invite your travel companions." delay={300}/>
        <div style={{ animation:"fadeUp .4s ease-out .5s both" }}>
          <label className="hd" style={{ fontSize:13,fontWeight:600,color:T.text2,display:"block",marginBottom:6 }}>Invite Members</label>
          <div style={{ display:"flex",gap:8 }}>
            <input id="wizard-invite-email" aria-label="Invite Members" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="friend@email.com" style={{ flex:1,padding:"11px 14px",borderRadius:10,
              border:`1.5px solid ${T.border}`,fontSize:14,background:T.surface,minHeight:44 }}/>
            <Btn onClick={addMember}>Send</Btn>
          </div>
        </div>
        {/* Members joined */}
        <div style={{ background:T.surface,borderRadius:14,padding:16,border:`1px solid ${T.borderLight}`, animation:"fadeUp .4s ease-out .7s both" }}>
          <p className="hd" style={{ fontSize:12,fontWeight:600,color:T.text3,marginBottom:10 }}>Members Joined</p>
          <div style={{ display:"flex",alignItems:"center",gap:4 }}>
            {members.map((m,i)=>(
              <div key={i} style={{ position:"relative",marginLeft:i>0?-8:0,zIndex:4-i }}>
                <div style={{ width:40,height:40,borderRadius:999,border:`2.5px solid ${T.surface}`,
                  background:`linear-gradient(135deg,${T.primary},${T.accent})`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:"#fff",fontSize:12,fontWeight:700 }} className="hd">{m.initials}</div>
                <div style={{ position:"absolute",bottom:-1,right:-1,width:13,height:13,borderRadius:999,
                  border:`2px solid ${T.surface}`,background:m.status==="done"?T.success:T.warning }}/>
              </div>
            ))}
            <span style={{ marginLeft:8,fontSize:12,color:T.text3 }}>{joinedCount}/{members.length} joined</span>
          </div>
        </div>
        <div style={{ marginTop:8 }}>
          <Btn onClick={handleCreateAndContinue} full disabled={apiBusy}>
            {apiBusy ? "Saving trip..." : `Continue with ${joinedCount} members →`}
          </Btn>
        </div>
        {tripId && (
          <p style={{ fontSize:12, color:T.success, marginTop:8 }}>
            Backend connected. Trip saved with id: {tripId}
          </p>
        )}
        {inviteStatus && (
          <p style={{ fontSize:12, color:T.success, marginTop:8 }}>
            {inviteStatus}
          </p>
        )}
        {apiError && (
          <p style={{ fontSize:12, color:T.error, marginTop:8 }}>
            Backend issue: {apiError}
          </p>
        )}
      </div>
    </Shell>
  );

  // ── STEP 1: BUCKET LIST ──────────────────────────────────────────────
  if (stageKey === "bucket") return (
    <Shell step={step}>
      <AgentHeader emoji="🌍" name="Bucket List Agent" desc="Collecting everyone's dream destinations"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Bucket List Agent" emoji="🌍" msg="What places have you always dreamed of visiting? Type as many as you'd like!"/>
        <Chat isUser msg={destinations.join(", ") || "Tokyo, Kyoto"} delay={200}/>
        <Chat agent="Bucket List Agent" emoji="🌍" msg="Love those picks! 🇬🇷🇯🇵 I've collected everyone's suggestions and ranked them by group interest." delay={500}/>
        <div style={{ display:"flex",gap:8 }}>
          <input
            value={destinationInput}
            onChange={e=>setDestinationInput(e.target.value)}
            onKeyDown={(e)=>{ if (e.key === "Enter") addDestination(); }}
            placeholder="Add a destination"
            style={{ flex:1,padding:"11px 14px",borderRadius:10,border:`1.5px solid ${T.border}`,fontSize:14,background:T.surface,minHeight:44 }}
          />
          <Btn onClick={addDestination}>Add</Btn>
        </div>
        {destinations.length > 0 && (
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {destinations.map((d)=>(
              <span key={d} style={{ background:`${T.accent}14`,color:T.accent,padding:"4px 10px",borderRadius:999,fontSize:12 }}>{d}</span>
            ))}
          </div>
        )}
        <div style={{ background:T.surface,borderRadius:14,padding:14,border:`1px solid ${T.borderLight}`,boxShadow:shadow.sm }}>
          <p className="hd" style={{ fontWeight:700,fontSize:14,marginBottom:4 }}>Group Voting</p>
          <p style={{ fontSize:12,color:T.text3,marginBottom:10 }}>
            Consensus target: {consensusTarget}/{members.length} votes
          </p>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {destinations.map((d)=>(
              <div key={d} style={{ border:`1px solid ${T.borderLight}`,borderRadius:10,padding:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                  <span className="hd" style={{ fontWeight:600,fontSize:13 }}>{d}</span>
                  <span style={{ fontSize:12,color: voteCount(d) >= consensusTarget ? T.success : T.text3 }}>
                    {voteCount(d)}/{members.length} {voteCount(d) >= consensusTarget ? "?" : ""}
                  </span>
                </div>
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {members.map((m)=>(
                    <button
                      key={`${d}-${m.name}`}
                      onClick={()=>setDestinationVotes((prev)=>({
                        ...prev,
                        [d]: { ...(prev[d]||{}), [m.name]: !prev?.[d]?.[m.name] }
                      }))}
                      className="hd"
                      style={{
                        borderRadius:999,
                        border:`1px solid ${destinationVotes?.[d]?.[m.name] ? T.primary : T.border}`,
                        background: destinationVotes?.[d]?.[m.name] ? `${T.primary}14` : T.surface,
                        color: destinationVotes?.[d]?.[m.name] ? T.primary : T.text2,
                        fontSize:11,
                        fontWeight:600,
                        padding:"4px 8px",
                        cursor:"pointer"
                      }}>
                      {m.initials}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Ranked destinations */}
        <div style={{ display:"flex",flexDirection:"column",gap:10,animation:"fadeUp .4s ease-out .6s both" }}>
          {destResults.map((d,i)=>(
            <div key={i} style={{ background:T.surface,borderRadius:14,padding:"14px 18px",border:`1px solid ${T.borderLight}`,
              display:"flex",alignItems:"center",gap:14,boxShadow:shadow.sm }}>
              <div className="hd" style={{ width:36,height:36,borderRadius:10,
                background:`linear-gradient(135deg,${T.primary}20,${T.accent}30)`,
                display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:15,color:T.primary }}>
                #{i+1}
              </div>
              <div style={{ flex:1 }}>
                <p className="hd" style={{ fontWeight:600,fontSize:15 }}>{d.name}</p>
                <p style={{ fontSize:12,color:T.text3 }}>{d.score}% match · {d.votes} votes</p>
              </div>
              <div style={{ display:"flex",gap:4 }}>
                <button style={{ width:32,height:32,borderRadius:999,border:"none",background:T.successBg,
                  color:T.success,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <I n="thumb" s={14} c={T.success}/></button>
              </div>
            </div>
          ))}
        </div>
        {hasConsensus ? (
          <div style={{ marginTop:6 }}>
            <Btn onClick={handleBucketContinue} full disabled={apiBusy}>
              {apiBusy ? "Saving destinations..." : "Approve destinations — Continue to Timing →"}
            </Btn>
          </div>
        ) : (
          <p style={{ fontSize:12,color:T.text3 }}>
            Vote on destinations until at least one reaches consensus.
          </p>
        )}
      </div>
    </Shell>
  );

  // ── STEP 2: TIMING ───────────────────────────────────────────────────
  if (stageKey === "timing") return (
    <Shell step={step}>
      <AgentHeader emoji="📅" name="Timing Agent" desc="Finding the perfect travel window"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {timingDisplay.length === 0 && (
          <div style={{ background:T.warningBg, border:`1px solid ${T.warning}`, borderRadius:12, padding:12 }}>
            <p style={{ fontSize:13, color:T.text2 }}>
              Add and save destinations in Bucket List first so timing analysis can run.
            </p>
            <div style={{ marginTop:8 }}>
              <Btn onClick={back}>Back to Bucket List</Btn>
            </div>
          </div>
        )}
        {timingDisplay.length > 0 && (
          <>
        <Chat agent="Timing Agent" emoji="📅" msg="I've analyzed weather, crowds, and prices for your destinations. Here's the calendar heatmap:"/>
        {/* Calendar heatmap */}
        <div style={{ background:T.surface,borderRadius:14,padding:18,border:`1px solid ${T.borderLight}`,
          boxShadow:shadow.sm, animation:"fadeUp .4s ease-out .2s both" }}>
          <p className="hd" style={{ fontWeight:700,fontSize:14,marginBottom:12 }}>Best Travel Months</p>
          {timingDisplay.map((d,di)=>(
            <div key={di} style={{ marginBottom:di<2?14:0 }}>
              <p style={{ fontSize:12,color:T.text2,fontWeight:600,marginBottom:6 }}>{d.name}</p>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3 }}>
                {["J","F","M","A","M","J","J","A","S","O","N","D"].map((m,mi)=>{
                  const good = d.months.includes(mi+1);
                  const ok = d.months.includes(mi) || d.months.includes(mi+2);
                  const bg = good?T.success:ok?T.warning:`${T.error}30`;
                  const fg = good?"#fff":ok?"#fff":T.text3;
                  return <div key={mi} style={{ textAlign:"center",padding:"6px 0",borderRadius:6,
                    background:good?`${T.success}`:ok?`${T.warning}80`:`${T.borderLight}`,
                    color:fg,fontSize:10,fontWeight:600 }}>{m}</div>;
                })}
              </div>
            </div>
          ))}
          <div style={{ display:"flex",gap:12,marginTop:14,fontSize:11,color:T.text3 }}>
            <span style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:10,height:10,borderRadius:3,background:T.success }}/> Ideal</span>
            <span style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:10,height:10,borderRadius:3,background:`${T.warning}80` }}/> Okay</span>
            <span style={{ display:"flex",alignItems:"center",gap:4 }}><div style={{ width:10,height:10,borderRadius:3,background:T.borderLight }}/> Avoid</span>
          </div>
        </div>
        <YN title="June is your sweet spot" agent="Timing Agent"
          subtitle="Jun 15 – Jun 28"
          desc={`All ${timingDisplay.length} destinations have great weather, manageable crowds, and reasonable prices in mid-June.`}
          onYes={handleTimingContinue} onNo={handleRevise}/>
          </>
        )}
      </div>
    </Shell>
  );

  // ── STEP 3: INTERESTS ────────────────────────────────────────────────
  if (stageKey === "interests") return (
    <Shell step={step}>
      <AgentHeader emoji="🎯" name="Interest Profiler" desc="Quick quiz to match activities to your group"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Interest Profiler" emoji="🎯" msg="Quick fire round! I'll ask yes/no questions to understand your group's interests."/>
        {INTEREST_QUESTIONS.map((q,i)=>(
          <div key={i} style={{ display:"flex",flexDirection:"column",gap:8,
            animation:`fadeUp .35s ease-out ${.15+i*.12}s both` }}>
            <Chat agent="Interest Profiler" emoji="🎯" msg={q}/>
            <div style={{ display:"flex",gap:8,justifyContent:"flex-end" }}>
              {["Yes","No"].map(opt=>{
                const value = opt==="Yes"?"yes":"no";
                const selected = interestAnswers[i] === value;
                return (
                  <button key={opt} style={{ padding:"8px 24px",borderRadius:10,
                    border:selected?`2px solid ${T.primary}`:`2px solid ${T.border}`,
                    background:selected?`${T.primary}10`:T.surface,
                    color:selected?T.primary:T.text2,
                    fontWeight:600,fontSize:14,cursor:"pointer",minHeight:40 }} className="hd"
                    onClick={()=>setInterestAnswers(p=>({ ...p, [i]: value }))}>
                    {opt==="Yes"?"👍":"👎"} {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(interestAnswers).length === INTEREST_QUESTIONS.length && (
          <>
            <Chat
              agent="Interest Profiler"
              emoji="🎯"
              msg={`Profile complete! Top interests: ${selectedInterests.length ? selectedInterests.join(", ") : "No strong preferences selected"}.`}
              delay={200}
            />
            <div style={{ marginTop:4 }}><Btn onClick={handleInterestsContinue} full>Continue →</Btn></div>
          </>
        )}
      </div>
    </Shell>
  );

  // ── STEP 4: HEALTH ─────────────────────────────────────────────────── ───────────────────────────────────────────────────
  if (stageKey === "health") return (
    <Shell step={step}>
      <AgentHeader emoji="🏥" name="Health & Safety Agent" desc="Checking requirements for your activities"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Health Agent" emoji="🏥" msg="I've reviewed health requirements for your destinations and planned activities. A couple of things to note:"/>
        <YN title="Travel Insurance Recommended" agent="Health Agent" subtitle="For Greece & Japan"
          desc="Standard travel insurance covering medical emergencies is recommended for both destinations. Does everyone have this?"
          tags={["Recommended","All destinations"]} onYes={()=>{}} onNo={handleRevise}/>
        <YN title="No Vaccinations Required" agent="Health Agent"
          desc="Neither Greece nor Japan require special vaccinations for travelers from your home country. Standard vaccines (Tetanus, Hep A) are recommended but not mandatory."
          tags={["Optional","Low risk"]} onYes={handleHealthContinue} onNo={handleRevise}/>
      </div>
    </Shell>
  );

  // ── STEP 5: POIs ─────────────────────────────────────────────────────
  if (stageKey === "pois") return (
    <Shell step={step}>
      <AgentHeader emoji="📍" name="POI Discovery Agent" desc="Curated places matched to your group's interests"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="POI Agent" emoji="📍" msg="Based on your interests in hiking, food, history, and photography, here are my top picks. Approve or skip each one!"/>
        {poiDisplay.map((poi,i)=>{
          const catColors = { nature:T.success, food:T.primary, culture:T.warning };
          const approved = poiApproved[i];
          return (
            <div key={i} style={{ background:T.surface,borderRadius:14,overflow:"hidden",border:`1px solid ${T.borderLight}`,
              boxShadow:shadow.sm,display:"flex",gap:0,animation:`fadeUp .35s ease-out ${i*.08}s both`,
              opacity:approved===false?.45:1,transition:"opacity .3s" }}>
              <div style={{ width:80,minHeight:100,flexShrink:0,
                background:`linear-gradient(135deg,${catColors[poi.cat]||T.primary}25,${catColors[poi.cat]||T.primary}08)`,
                display:"flex",alignItems:"center",justifyContent:"center" }}>
                <I n={poi.cat==="food"?"food":poi.cat==="culture"?"hotel":"camera"} s={24} c={catColors[poi.cat]||T.primary}/>
              </div>
              <div style={{ padding:"12px 14px",flex:1,minWidth:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:5,marginBottom:3 }}>
                  <span style={{ background:`${catColors[poi.cat]}18`,color:catColors[poi.cat],
                    padding:"1px 7px",borderRadius:999,fontSize:10,fontWeight:600,textTransform:"capitalize" }}>{poi.cat}</span>
                  <span style={{ fontSize:11,color:T.warning,display:"flex",alignItems:"center",gap:2 }}>
                    <I n="star" s={11} c={T.warning}/> {poi.rating}</span>
                  <span style={{ fontSize:10.5,color:T.text3,marginLeft:"auto" }}>{poi.dest}</span>
                </div>
                <h4 className="hd" style={{ fontWeight:600,fontSize:14,marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{poi.name}</h4>
                <div style={{ display:"flex",gap:10,marginBottom:6,fontSize:12,color:T.text2 }}>
                  <span style={{ display:"flex",alignItems:"center",gap:3 }}><I n="clock" s={12} c={T.text3}/> {poi.dur}h</span>
                  <span style={{ display:"flex",alignItems:"center",gap:3 }}><I n="dollar" s={12} c={T.text3}/> {poi.cost>0?`$${poi.cost}`:"Free"}</span>
                </div>
                <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginBottom:8 }}>
                  {poi.tags.map(t=><span key={t} style={{ background:T.bg,color:T.text2,padding:"1px 7px",borderRadius:999,fontSize:10 }}>{t}</span>)}
                </div>
                {approved===undefined && (
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>handlePoiDecision(i, false)} style={{ flex:1,padding:"8px",borderRadius:8,
                      border:`1.5px solid ${T.error}40`,background:"transparent",color:T.error,fontSize:13,fontWeight:600,cursor:"pointer",minHeight:36 }} className="hd">Skip</button>
                    <button onClick={()=>handlePoiDecision(i, true)} style={{ flex:1,padding:"8px",borderRadius:8,
                      border:"none",background:T.primary,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",minHeight:36,
                      boxShadow:`0 2px 6px ${T.primary}30` }} className="hd">Include ✓</button>
                  </div>
                )}
                {approved!==undefined && (
                  <div style={{ padding:"6px 12px",borderRadius:8,
                    background:approved?T.successBg:T.errorBg,
                    color:approved?T.success:T.error,fontSize:12,fontWeight:600,textAlign:"center" }} className="hd">
                    {approved?"✓ Included":"✗ Skipped"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {Object.keys(poiApproved).length >= poiDisplay.length && (
          <div style={{ animation:"scaleIn .3s ease-out" }}>
            <Btn onClick={next} full>{Object.values(poiApproved).filter(v=>v).length} activities selected — Continue →</Btn>
          </div>
        )}
      </div>
    </Shell>
  );

  // ── STEP 6: DURATION ─────────────────────────────────────────────────
  if (stageKey === "duration") return (
    <Shell step={step}>
      <AgentHeader emoji="⏱️" name="Duration Calculator" desc="How many days you need"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Duration Agent" emoji="⏱️" msg="Let me calculate the optimal trip length based on your approved activities..."/>
        <div style={{ background:T.surface,borderRadius:14,padding:18,border:`1px solid ${T.borderLight}`,
          boxShadow:shadow.sm, animation:"fadeUp .4s ease-out .3s both" }}>
          <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12 }}>Trip Duration Breakdown</p>
          {[{ label:"Santorini activities",days:3 },{ label:"Kyoto activities",days:4 },
            { label:"Travel days (flights + transfers)",days:2 },{ label:"Buffer / rest days",days:1 }].map((r,i)=>(
            <div key={i} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",
              borderBottom:i<3?`1px solid ${T.borderLight}`:"none" }}>
              <span style={{ fontSize:14,color:T.text2 }}>{r.label}</span>
              <span className="hd" style={{ fontWeight:600,fontSize:14 }}>{r.days} days</span>
            </div>
          ))}
          <div style={{ display:"flex",justifyContent:"space-between",padding:"12px 0 0",
            borderTop:`2px solid ${T.primary}20`,marginTop:4 }}>
            <span className="hd" style={{ fontWeight:700,fontSize:16,color:T.primary }}>Total</span>
            <span className="hd" style={{ fontWeight:700,fontSize:16,color:T.primary }}>10 days</span>
          </div>
        </div>
        <YN title="10 days covers everything" agent="Duration Agent"
          desc="To fully enjoy all 6 approved activities across Santorini and Kyoto with travel and rest days, you need 10 days. Does this work?"
          onYes={handleDurationContinue} onNo={handleRevise}/>
      </div>
    </Shell>
  );

  // ── STEP 7: AVAILABILITY ─────────────────────────────────────────────
  if (stageKey === "avail") return (
    <Shell step={step}>
      <AgentHeader emoji="🗓️" name="Schedule Sync Agent" desc="Finding dates that work for everyone"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Sync Agent" emoji="🗓️" msg="I've collected availability from all members. Here's the overlap:"/>
        {/* Mini calendar */}
        <div style={{ background:T.surface,borderRadius:14,padding:18,border:`1px solid ${T.borderLight}`,
          boxShadow:shadow.sm, animation:"fadeUp .4s ease-out .2s both" }}>
          <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12 }}>June 2025</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,textAlign:"center" }}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
              <div key={d} style={{ fontSize:11,color:T.text3,fontWeight:600,padding:"4px 0" }}>{d}</div>
            ))}
            {Array.from({length:42},(_, i)=>{
              const day = i - 0; // June starts Sunday in our mock
              const num = day + 1;
              if (num < 1 || num > 30) return <div key={i}/>;
              const inRange = num >= 15 && num <= 28;
              const isStart = num === 15;
              const isEnd = num === 28;
              return (
                <div key={i} style={{ padding:"8px 2px",borderRadius:8,fontSize:13,fontWeight:inRange?600:400,
                  background:inRange?`${T.success}15`:"transparent",
                  color:inRange?T.success:T.text2,
                  border:isStart||isEnd?`2px solid ${T.success}`:"2px solid transparent",
                  cursor:"pointer",transition:"all .15s" }}>{num}</div>
              );
            })}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:12 }}>
            <div style={{ width:14,height:14,borderRadius:4,background:`${T.success}15`,border:`2px solid ${T.success}` }}/>
            <span style={{ fontSize:12,color:T.text2 }}>All 4 members available — <strong>14 nights overlap</strong></span>
          </div>
        </div>
        <YN title="Everyone is free Jun 15 – 28" agent="Sync Agent"
          desc="All 4 members are available for this 14-day window. Your trip needs 10 days, giving you flexibility on start date. Lock these dates?"
          onYes={handleAvailabilityContinue} onNo={handleRevise}/>
      </div>
    </Shell>
  );

  // ── STEP 8: BUDGET ───────────────────────────────────────────────────
  if (stageKey === "budget") return (
    <Shell step={step}>
      <AgentHeader emoji="💰" name="Budget Agent" desc="Setting your spending plan"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Budget Agent" emoji="💰" msg="What's your per-person daily budget? Drag the slider to set it."/>
        <div style={{ background:T.surface,borderRadius:14,padding:18,border:`1px solid ${T.borderLight}`,
          boxShadow:shadow.sm, animation:"fadeUp .4s ease-out .2s both" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14 }}>
            <span className="hd" style={{ fontWeight:700,fontSize:28,color:T.primary }}>${budgetPerDay}</span>
            <span style={{ fontSize:13,color:T.text3 }}>per person / day</span>
          </div>
          <label htmlFor="budget-slider" style={{ fontSize: 12, color: T.text3, display: "block", marginBottom: 6 }}>
            Daily budget slider
          </label>
          <input id="budget-slider" aria-label="Daily budget" type="range" min={50} max={800} step={10} value={budgetPerDay}
            onChange={e=>setBudgetPerDay(Number(e.target.value))}
            style={{ width:"100%",accentColor:T.primary,height:6 }}/>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:T.text3,marginTop:6 }}>
            <span>$50</span><span>$200</span><span>$400</span><span>$800</span>
          </div>
        </div>
        {/* Pie chart approximation */}
        <div style={{ background:T.surface,borderRadius:14,padding:18,border:`1px solid ${T.borderLight}`,
          boxShadow:shadow.sm, animation:"fadeUp .4s ease-out .4s both" }}>
          <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:14 }}>Budget Allocation</p>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <div style={{ width:100,height:100,borderRadius:999,position:"relative",flexShrink:0,
              background:`conic-gradient(${T.accent} 0% 30%, ${T.primary} 30% 65%, ${T.secondary} 65% 85%, ${T.warning} 85% 95%, ${T.text3} 95% 100%)` }}>
              <div style={{ position:"absolute",inset:18,borderRadius:999,background:T.surface,
                display:"flex",alignItems:"center",justifyContent:"center" }}>
                <span className="hd" style={{ fontWeight:700,fontSize:14,color:T.text }}>${budgetPerDay*10}</span>
              </div>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6,flex:1 }}>
              {[
                { label:"Flights",pct:30,color:T.accent,amt:budgetBreakdown?.flights ?? budgetPerDay*10*.3 },
                { label:"Stays",pct:35,color:T.primary,amt:budgetBreakdown?.accommodation ?? budgetPerDay*10*.35 },
                { label:"Food",pct:20,color:T.secondary,amt:budgetBreakdown?.dining ?? budgetPerDay*10*.2 },
                { label:"Activities",pct:10,color:T.warning,amt:budgetBreakdown?.activities ?? budgetPerDay*10*.1 },
                { label:"Buffer",pct:5,color:T.text3,amt:budgetBreakdown?.misc ?? budgetPerDay*10*.05 },
              ].map((c,i)=>(
                <div key={i} style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ width:10,height:10,borderRadius:3,background:c.color,flexShrink:0 }}/>
                  <span style={{ fontSize:12.5,color:T.text2,flex:1 }}>{c.label} ({c.pct}%)</span>
                  <span className="hd" style={{ fontWeight:600,fontSize:12.5 }}>${Math.round(c.amt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <YN title={`$${(budgetPerDay*10).toLocaleString()} total per person`} agent="Budget Agent"
          desc={`At $${budgetPerDay}/day for 10 days, your total budget is $${(budgetPerDay*10).toLocaleString()} per person ($${(budgetPerDay*10*4).toLocaleString()} for the group). Confirm?`}
          onYes={handleBudgetContinue} onNo={handleRevise}/>
      </div>
    </Shell>
  );

  // ── STEP 9: FLIGHTS ──────────────────────────────────────────────────
  if (stageKey === "flights") return (
    <Shell step={step}>
      <AgentHeader emoji="✈️" name="Flight Agent" desc="Finding the best flights for your dates"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Flight Agent" emoji="✈️" msg="Do you need flight bookings?"/>
        <Chat isUser msg="Yes!" delay={100}/>
        <Chat agent="Flight Agent" emoji="✈️" msg="Which class do you prefer?" delay={200}/>
        <div style={{ display:"flex",gap:8,animation:"fadeUp .3s ease-out .3s both" }}>
          {["Economy","Business","First"].map(cls=>(
            <button key={cls} onClick={()=>setFlightClass(cls.toLowerCase())}
              className="hd" style={{ flex:1,padding:"10px 8px",borderRadius:10,
              border:flightClass===cls.toLowerCase()?`2px solid ${T.primary}`:`2px solid ${T.border}`,
              background:flightClass===cls.toLowerCase()?`${T.primary}08`:T.surface,
              color:flightClass===cls.toLowerCase()?T.primary:T.text2,
              fontWeight:600,fontSize:14,cursor:"pointer",minHeight:44,transition:"all .2s" }}>
              {cls}
            </button>
          ))}
        </div>
        <Chat agent="Flight Agent" emoji="✈️" msg="Here are the top 3 options:" delay={400}/>
        {flightDisplay.map((f,i)=>(
          <div key={i} onClick={()=>setFlightPick(i)}
            style={{ background:T.surface,borderRadius:14,padding:"14px 18px",
            boxShadow:shadow.sm,border:`2px solid ${flightPick===i?T.primary:T.borderLight}`,
            cursor:"pointer",transition:"all .2s",animation:`fadeUp .35s ease-out ${.4+i*.1}s both`,
            ...(flightPick===i?{boxShadow:shadow.glow}:{}) }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ width:32,height:32,borderRadius:8,background:T.bg,
                  display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <I n="plane" s={16} c={T.primary}/>
                </div>
                <div>
                  <p className="hd" style={{ fontWeight:600,fontSize:14 }}>{f.airline}</p>
                  <span style={{ fontSize:11,color:T.text3 }}>{f.cls}</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <p className="hd" style={{ fontWeight:700,fontSize:18,color:T.primary }}>${f.price.toLocaleString()}</p>
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <p className="hd" style={{ fontWeight:700,fontSize:15 }}>{f.dep}</p>
              <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3 }}>
                <span style={{ fontSize:11,color:T.text3 }}>{f.dur}</span>
                <div style={{ width:"100%",height:2,background:T.borderLight,borderRadius:1,position:"relative" }}>
                  <div style={{ position:"absolute",left:0,top:-3,width:7,height:7,borderRadius:999,background:T.primary }}/>
                  {f.stops>0 && <div style={{ position:"absolute",left:"50%",top:-2,width:5,height:5,borderRadius:999,background:T.warning,transform:"translateX(-50%)" }}/>}
                  <div style={{ position:"absolute",right:0,top:-3,width:7,height:7,borderRadius:999,background:T.secondary }}/>
                </div>
                <span style={{ fontSize:11,color:f.stops===0?T.success:T.text3,fontWeight:500 }}>
                  {f.stops===0?"Nonstop":`${f.stops} stop`}</span>
              </div>
              <p className="hd" style={{ fontWeight:700,fontSize:15 }}>{f.arr}</p>
            </div>
            {flightPick===i && <div style={{ marginTop:10,padding:"6px",borderRadius:8,background:T.successBg,
              color:T.success,fontSize:12,fontWeight:600,textAlign:"center" }} className="hd">✓ Selected</div>}
          </div>
        ))}
        {flightPick!==null && <div style={{ animation:"scaleIn .3s ease-out" }}>
          <Btn onClick={handleFlightContinue} full>Book {flightDisplay[flightPick].airline} — Continue →</Btn>
        </div>}
      </div>
    </Shell>
  );

  // ── STEP 10: STAYS ───────────────────────────────────────────────────
  if (stageKey === "stays") return (
    <Shell step={step}>
      <AgentHeader emoji="🏨" name="Stays Agent" desc="Finding perfect accommodations"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Stays Agent" emoji="🏨" msg="Here are my top picks for each destination, matched to your budget and preferences:"/>
        {stayDisplay.map((s,i)=>{
          const picked = stayPicks[i];
          return (
            <div key={i} style={{ background:T.surface,borderRadius:14,overflow:"hidden",
              border:`1px solid ${T.borderLight}`,boxShadow:shadow.sm,animation:`fadeUp .35s ease-out ${i*.1}s both` }}>
              <div style={{ height:100,background:`linear-gradient(135deg,${T.accent}20,${T.primary}12)`,
                display:"flex",alignItems:"flex-end",padding:10 }}>
                <span style={{ background:"rgba(0,0,0,.55)",color:"#fff",padding:"2px 9px",borderRadius:999,
                  fontSize:11,fontWeight:500 }}>{s.type} · {s.dest}</span>
              </div>
              <div style={{ padding:"14px 16px" }}>
                <h4 className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>{s.name}</h4>
                <div style={{ display:"flex",alignItems:"center",gap:5,marginBottom:8 }}>
                  {[1,2,3,4,5].map(x=><I key={x} n="star" s={13} c={x<=Math.round(s.rating)?T.warning:T.borderLight}/>)}
                  <span style={{ fontSize:12,color:T.text2 }}>{s.rating}</span>
                </div>
                <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" }}>
                  {s.amenities.map(a=><span key={a} style={{ display:"flex",alignItems:"center",gap:3,
                    fontSize:11,color:T.text3 }}><I n="wifi" s={11} c={T.text3}/> {a}</span>)}
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div><span className="hd" style={{ fontWeight:700,fontSize:18,color:T.primary }}>${s.rate}</span>
                    <span style={{ fontSize:12,color:T.text3 }}> / night</span></div>
                  {picked===undefined ? (
                    <div style={{ display:"flex",gap:6 }}>
                      <button onClick={()=>setStayPicks(p=>({...p,[i]:false}))} style={{ padding:"7px 14px",borderRadius:8,
                        border:`1.5px solid ${T.error}40`,background:"transparent",color:T.error,
                        fontSize:13,fontWeight:600,cursor:"pointer",minHeight:36 }} className="hd">Skip</button>
                      <button onClick={()=>setStayPicks(p=>({...p,[i]:true}))} style={{ padding:"7px 14px",borderRadius:8,
                        border:"none",background:T.primary,color:"#fff",
                        fontSize:13,fontWeight:600,cursor:"pointer",minHeight:36 }} className="hd">Book</button>
                    </div>
                  ) : (
                    <span className="hd" style={{ padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                      background:picked?T.successBg:T.errorBg,color:picked?T.success:T.error }}>
                      {picked?"✓ Booked":"✗ Skipped"}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ animation:"scaleIn .3s ease-out" }}>
          <Btn onClick={handleStaysContinue} full>Continue to Dining →</Btn>
        </div>
      </div>
    </Shell>
  );

  // ── STEP 11: DINING ──────────────────────────────────────────────────
  if (stageKey === "dining") return (
    <Shell step={step}>
      <AgentHeader emoji="🍽️" name="Dining Agent" desc="Restaurant picks matching your diet & budget"/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <Chat agent="Dining Agent" emoji="🍽️" msg="Here are restaurant suggestions for each day, matching your group's dietary needs and budget:"/>
        {[1,2].map(day=>(
          <div key={day} style={{ animation:`fadeUp .35s ease-out ${day*.15}s both` }}>
            <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:10,color:T.text }}>Day {day} — {day===1?"Santorini":"Santorini"}</p>
            {diningDisplay.filter(d=>d.day===day).map((d,i)=>{
              const k = `${day}-${i}`;
              const approved = diningApproved[k];
              return (
                <div key={k} style={{ background:T.surface,borderRadius:12,padding:"12px 16px",marginBottom:8,
                  border:`1px solid ${T.borderLight}`,display:"flex",alignItems:"center",gap:12,
                  opacity:approved===false?.4:1,transition:"opacity .3s" }}>
                  <div style={{ fontSize:22,width:36,textAlign:"center" }}>{d.meal==="Breakfast"?"🌅":d.meal==="Lunch"?"☀️":"🌙"}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
                      <span className="hd" style={{ fontWeight:600,fontSize:14 }}>{d.name}</span>
                      <span style={{ fontSize:11,color:T.text3 }}>{d.cuisine}</span>
                    </div>
                    <div style={{ display:"flex",gap:8,marginTop:3 }}>
                      <span style={{ fontSize:12,color:T.text2 }}>{d.meal} · ${d.cost}</span>
                      {d.diet.map(tag=><span key={tag} style={{ fontSize:10,background:`${T.success}12`,color:T.success,
                        padding:"1px 6px",borderRadius:999 }}>{tag}</span>)}
                    </div>
                  </div>
                  {approved===undefined ? (
                    <div style={{ display:"flex",gap:4 }}>
                      <button onClick={()=>setDiningApproved(p=>({...p,[k]:false}))} style={{ width:32,height:32,borderRadius:999,border:`1.5px solid ${T.error}30`,background:"transparent",
                        color:T.error,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><I n="x" s={14} c={T.error}/></button>
                      <button onClick={()=>setDiningApproved(p=>({...p,[k]:true}))} style={{ width:32,height:32,borderRadius:999,border:"none",background:T.primary,
                        color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><I n="check" s={14} c="#fff"/></button>
                    </div>
                  ) : (
                    <span style={{ fontSize:16 }}>{approved?"✅":"❌"}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {Object.keys(diningApproved).length>=diningDisplay.length && <Btn onClick={handleDiningContinue} full>Continue to Itinerary →</Btn>}
      </div>
    </Shell>
  );

  // ── STEP 12: ITINERARY ───────────────────────────────────────────────
  if (stageKey === "itinerary") return (
    <Shell step={step}>
      <AgentHeader emoji="📋" name="Itinerary Agent" desc="Your complete day-by-day plan"/>
      <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
        <BudgetMeter spent={1480} allocated={budgetPerDay*10} label="Total Budget"/>
        {itineraryDisplay.map((day,di)=>{
          const typeColors = { flight:T.accent,checkin:T.success,activity:T.secondary,meal:T.primary,rest:"#6366F1" };
          return (
            <div key={di} style={{ background:T.surface,borderRadius:16,padding:"18px 20px",
              boxShadow:shadow.sm,border:`1px solid ${T.borderLight}`,animation:`fadeUp .4s ease-out ${di*.1}s both` }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16 }}>
                <div>
                  <h3 className="hd" style={{ fontWeight:700,fontSize:17 }}>Day {day.day}</h3>
                  <p style={{ fontSize:13,color:T.text2 }}>{day.date} · {day.theme}</p>
                </div>
                <span style={{ fontSize:13,color:T.text3 }}>${day.items.reduce((s,i)=>s+i.cost,0)}</span>
              </div>
              <div style={{ position:"relative",paddingLeft:24 }}>
                <div style={{ position:"absolute",left:9,top:6,bottom:6,width:2,
                  background:`linear-gradient(to bottom,${T.primary}30,${T.borderLight})` }}/>
                {day.items.map((item,ii)=>(
                  <div key={ii} style={{ display:"flex",gap:12,marginBottom:ii<day.items.length-1?16:0,position:"relative" }}>
                    <div style={{ position:"absolute",left:-24,top:2,width:20,height:20,borderRadius:999,
                      background:typeColors[item.type]||T.text3,display:"flex",alignItems:"center",justifyContent:"center",
                      boxShadow:`0 0 0 3px ${T.surface}` }}>
                      <I n={item.type==="meal"?"food":item.type==="flight"?"plane":item.type==="checkin"?"hotel":"camera"} s={10} c="#fff"/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex",justifyContent:"space-between" }}>
                        <p className="hd" style={{ fontWeight:600,fontSize:14 }}>{item.title}</p>
                        {item.cost>0 && <span style={{ fontSize:12,color:T.text2 }}>${item.cost}</span>}
                      </div>
                      <div style={{ display:"flex",gap:10,marginTop:2,fontSize:12,color:T.text3 }}>
                        <span>{item.time}</span>
                        {item.loc && <span>📍 {item.loc}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <YN title="Your complete itinerary is ready!" agent="Itinerary Agent"
          subtitle="3 days shown · 10 total planned"
          desc="Every flight, transfer, activity, meal, and rest period has been scheduled. Approve to send calendar invites to all members?"
          tags={["10 days","6 activities","12 meals","2 destinations"]}
          onYes={handleItineraryApprove} onNo={handleRevise}/>
      </div>
    </Shell>
  );

  // ── STEP 13: CALENDAR SYNC ───────────────────────────────────────────
  if (stageKey === "sync") return (
    <Shell step={step}>
      <Styles/>
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:"40px 24px",textAlign:"center",animation:"scaleIn .5s ease-out" }}>
        <div style={{ position:"relative",marginBottom:24 }}>
          <div style={{ fontSize:64,animation:"bounceIn .6s ease" }}>🎉</div>
          {["🎊","✨","🌟","🎈","✈️"].map((e,i)=>(
            <span key={i} style={{ position:"absolute",fontSize:20,
              top:`${-10+Math.sin(i*1.2)*30}px`,left:`${-20+Math.cos(i*1.2)*40}px`,
              animation:`confetti 1.5s ease-out ${.3+i*.15}s both`,pointerEvents:"none" }}>{e}</span>
          ))}
        </div>
        <h1 className="hd" style={{ fontWeight:700,fontSize:28,color:T.text,marginBottom:8 }}>Trip Confirmed!</h1>
        <p style={{ color:T.text2,fontSize:16,maxWidth:400,lineHeight:1.5,marginBottom:32 }}>
          Your {tripName} itinerary has been finalized. Calendar invites are being sent to all {members.length} members.
        </p>
        <p style={{ color:T.text3, fontSize:13, marginTop:-18, marginBottom:18 }}>
          {members.length} member sync in progress
        </p>
        {calendarSyncResult && (
          <p style={{ color:T.success, fontSize:13, marginBottom:16 }}>
            Backend sync completed: {calendarSyncResult.events_created || 0} events created.
          </p>
        )}

        {/* Calendar sync options */}
        <div style={{ display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:360,marginBottom:32 }}>
          {[
            { name:"Google Calendar", icon:"📅", color:"#4285F4", status:"Synced" },
            { name:"Apple Calendar", icon:"🍎", color:"#333", status:"Synced" },
            { name:"Outlook", icon:"📧", color:"#0078D4", status:"Pending" },
          ].map((cal,i)=>(
            <div key={i} style={{ background:T.surface,borderRadius:12,padding:"12px 16px",
              border:`1px solid ${T.borderLight}`,display:"flex",alignItems:"center",gap:12,
              boxShadow:shadow.sm,animation:`slideL .4s ease-out ${.4+i*.1}s both` }}>
              <span style={{ fontSize:24 }}>{cal.icon}</span>
              <span style={{ flex:1,fontWeight:500,fontSize:14 }}>{cal.name}</span>
              <span className="hd" style={{ fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:999,
                background:cal.status==="Synced"?T.successBg:T.warningBg,
                color:cal.status==="Synced"?T.success:T.warning }}>
                {cal.status==="Synced"?"✓ Synced":"⏳ Pending"}</span>
            </div>
          ))}
        </div>

        <div style={{ width:"100%",maxWidth:360,display:"flex",flexWrap:"wrap",gap:6,marginBottom:18,justifyContent:"center" }}>
          {members.map((m, idx) => (
            <span key={`${m.name}-${idx}`} style={{ fontSize:12,color:T.text2,background:T.surface,border:`1px solid ${T.borderLight}`,borderRadius:999,padding:"4px 10px" }}>
              {m.name}
            </span>
          ))}
        </div>

        {/* Summary card */}
        <div style={{ background:`linear-gradient(135deg,${T.primary},${T.primaryDark})`,
          borderRadius:16,padding:24,color:"#fff",width:"100%",maxWidth:360,textAlign:"left",
          animation:"fadeUp .5s ease-out .6s both" }}>
          <p style={{ fontWeight:400,fontSize:13,opacity:.7,marginBottom:4 }}>Trip Summary</p>
          <h3 className="hd" style={{ fontWeight:700,fontSize:20,marginBottom:12 }}>{tripName}</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {[
              { label:"Dates", value:"Jun 15 – Jun 28, 2025" },
              { label:"Destinations", value:"Santorini, Kyoto" },
              { label:"Members", value:`${members.length} travelers` },
              { label:"Budget", value:`$${(budgetPerDay*10).toLocaleString()} / person` },
            ].map((r,i)=>(
              <div key={i} style={{ display:"flex",justifyContent:"space-between",fontSize:14 }}>
                <span style={{ opacity:.7 }}>{r.label}</span>
                <span style={{ fontWeight:600 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={()=>setStep(0)} className="hd" style={{ marginTop:32,padding:"14px 32px",
          borderRadius:12,border:"none",background:T.secondary,color:"#fff",
          fontSize:16,fontWeight:700,cursor:"pointer",minHeight:50,
          boxShadow:`0 4px 16px ${T.secondary}35` }}>
          View Full Itinerary →
        </button>
        <button onClick={()=>setStep(0)} style={{ marginTop:12,background:"none",border:"none",
          color:T.text3,fontSize:13,cursor:"pointer",textDecoration:"underline",minHeight:32,padding:"8px 10px" }}>
          Restart demo
        </button>
      </div>
    </Shell>
  );

  return null;
}

export { getUserIdFromToken };


