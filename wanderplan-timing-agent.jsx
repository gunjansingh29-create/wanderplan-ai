import { useState, useEffect, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */
const T = {
  primary:"#0D7377", primaryLight:"#1A9A9F", primaryDark:"#095456",
  secondary:"#E8634A", secondaryLight:"#F08872",
  accent:"#4DA8DA", accentLight:"#7CC2E8",
  bg:"#F5F7F9", surface:"#FFFFFF",
  text:"#1A1A2E", text2:"#5A6A7A", text3:"#8E99A8",
  border:"#E2E8F0", borderLight:"#EEF1F5",
  success:"#22C55E", successBg:"#F0FDF4",
  warning:"#F59E0B", warningBg:"#FFFBEB",
  error:"#EF4444", errorBg:"#FEF2F2",
};
const sh = {
  sm:"0 1px 4px rgba(26,26,46,0.05),0 1px 2px rgba(26,26,46,0.03)",
  md:"0 4px 20px rgba(26,26,46,0.07),0 2px 6px rgba(26,26,46,0.03)",
  lg:"0 14px 44px rgba(26,26,46,0.1),0 4px 14px rgba(26,26,46,0.05)",
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL CSS
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Source+Sans+3:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Source Sans 3',sans-serif;background:${T.bg};color:${T.text};-webkit-font-smoothing:antialiased}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(77,168,218,0.35);border-radius:6px}
  .hd{font-family:'DM Sans',sans-serif}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:99px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
  @keyframes slideL{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
  @keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.35}40%{transform:scale(1);opacity:1}}
  @keyframes shimmer{0%{background-position:-300% 0}100%{background-position:300% 0}}
  @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(13,115,119,.12)}50%{box-shadow:0 0 22px rgba(13,115,119,.25)}}
  @keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
  @keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(13,115,119,.25)}100%{box-shadow:0 0 0 14px rgba(13,115,119,0)}}
  @keyframes confettiBurst{0%{transform:translateY(0) rotate(0) scale(1);opacity:1}100%{transform:translateY(-90px) rotate(720deg) scale(0);opacity:0}}
  @keyframes barGrow{from{width:0}}
  @keyframes cellReveal{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */
const Ic=({n,s=18,c="currentColor"})=>{const p={
  check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
  x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
  sun:<><circle cx="12" cy="12" r="5" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
  cloud:<path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" strokeWidth="1.8" stroke={c} fill="none"/>,
  rain:<><path d="M16 13v8M8 13v8M12 15v8" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" strokeWidth="1.8" stroke={c} fill="none"/></>,
  users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/></>,
  dollar:<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
  plane:<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={c}/>,
  star:<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={c}/>,
  calendar:<><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8" stroke={c} fill="none"/><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
  target:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="12" cy="12" r="6" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="12" cy="12" r="2" fill={c}/></>,
  zap:<path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" strokeWidth="1.8" stroke={c} fill="none" strokeLinejoin="round"/>,
  flag:<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" strokeWidth="1.8" stroke={c} fill="none"/>,
  info:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 16v-4M12 8h.01" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/></>,
  chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  map:<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  thermo:<><path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" strokeWidth="1.8" stroke={c} fill="none"/></>,
  sparkle:<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
};return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{p[n]||p.sun}</svg>};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/* ═══════════════════════════════════════════════════════════════════════════
   DESTINATION DATA — Weather / Crowds / Prices / Events
   Historical averages from OpenWeatherMap, Google Trends, Amadeus
   ═══════════════════════════════════════════════════════════════════════════ */
const DESTINATIONS = {
  bali: {
    name:"Bali", country:"Indonesia", type:"tropical_beach",
    photo:"https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80",
    idealTemp:[26,30], // ideal temperature range °C
    // Monthly data: [temp°C, rainMM, sunHrs, crowdIndex1-10, flightPrice$, events]
    monthly: [
      { temp:27, rain:345, sun:5.1, crowd:5, price:850, events:[{name:"Galungan Festival",type:"festival",bonus:2}] },
      { temp:27, rain:320, sun:5.3, crowd:4, price:780, events:[] },
      { temp:27, rain:250, sun:6.0, crowd:5, price:820, events:[{name:"Nyepi (Day of Silence)",type:"festival",bonus:2}] },
      { temp:27, rain:180, sun:7.2, crowd:6, price:900, events:[] },
      { temp:27, rain:95,  sun:8.0, crowd:7, price:950, events:[] },
      { temp:26, rain:65,  sun:8.5, crowd:7, price:1020, events:[] },
      { temp:26, rain:55,  sun:8.8, crowd:8, price:1100, events:[{name:"Bali Arts Festival",type:"festival",bonus:2}] },
      { temp:26, rain:40,  sun:9.0, crowd:9, price:1200, events:[{name:"Peak tourist season",type:"disruption",bonus:-1}] },
      { temp:27, rain:50,  sun:8.5, crowd:8, price:1050, events:[] },
      { temp:27, rain:100, sun:7.5, crowd:6, price:880, events:[] },
      { temp:27, rain:180, sun:6.5, crowd:5, price:800, events:[] },
      { temp:27, rain:280, sun:5.5, crowd:6, price:920, events:[{name:"Holiday season",type:"disruption",bonus:-1}] },
    ],
  },
  kyoto: {
    name:"Kyoto", country:"Japan", type:"cultural_temperate",
    photo:"https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80",
    idealTemp:[15,25],
    monthly: [
      { temp:4,  rain:50,  sun:4.2, crowd:3, price:1100, events:[] },
      { temp:5,  rain:65,  sun:4.5, crowd:3, price:1050, events:[] },
      { temp:9,  rain:110, sun:5.5, crowd:6, price:1250, events:[{name:"Plum Blossom Season",type:"festival",bonus:1}] },
      { temp:15, rain:120, sun:6.0, crowd:9, price:1400, events:[{name:"Cherry Blossom Season",type:"festival",bonus:2}] },
      { temp:20, rain:140, sun:6.5, crowd:7, price:1200, events:[{name:"Aoi Matsuri Festival",type:"festival",bonus:2}] },
      { temp:24, rain:210, sun:5.0, crowd:5, price:1000, events:[{name:"Rainy Season (Tsuyu)",type:"disruption",bonus:-2}] },
      { temp:28, rain:220, sun:5.5, crowd:6, price:1050, events:[{name:"Gion Matsuri Festival",type:"festival",bonus:2}] },
      { temp:29, rain:130, sun:7.0, crowd:7, price:1150, events:[{name:"Daimonji Gozan Okuribi",type:"festival",bonus:2}] },
      { temp:25, rain:170, sun:5.5, crowd:5, price:950, events:[] },
      { temp:18, rain:110, sun:6.0, crowd:7, price:1100, events:[{name:"Autumn Foliage Peak",type:"festival",bonus:2}] },
      { temp:13, rain:70,  sun:5.0, crowd:8, price:1200, events:[{name:"Momiji (Maple) Season",type:"festival",bonus:2}] },
      { temp:7,  rain:45,  sun:4.0, crowd:4, price:980, events:[{name:"Year-end temple visits",type:"festival",bonus:1}] },
    ],
  },
  santorini: {
    name:"Santorini", country:"Greece", type:"mediterranean",
    photo:"https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80",
    idealTemp:[20,30],
    monthly: [
      { temp:12, rain:70,  sun:4.5, crowd:2, price:700, events:[] },
      { temp:12, rain:50,  sun:5.0, crowd:2, price:680, events:[] },
      { temp:14, rain:40,  sun:6.5, crowd:3, price:750, events:[] },
      { temp:17, rain:20,  sun:8.0, crowd:5, price:900, events:[{name:"Greek Easter",type:"festival",bonus:2}] },
      { temp:21, rain:10,  sun:9.5, crowd:7, price:1050, events:[] },
      { temp:25, rain:2,   sun:11.0,crowd:9, price:1300, events:[{name:"Peak season begins",type:"disruption",bonus:-1}] },
      { temp:27, rain:0,   sun:12.0,crowd:10,price:1500, events:[{name:"Extreme peak crowds",type:"disruption",bonus:-2}] },
      { temp:27, rain:0,   sun:11.5,crowd:10,price:1450, events:[{name:"Volcano festival",type:"festival",bonus:1}] },
      { temp:24, rain:10,  sun:9.5, crowd:7, price:1100, events:[{name:"Wine harvest season",type:"festival",bonus:2}] },
      { temp:21, rain:25,  sun:7.5, crowd:4, price:850, events:[] },
      { temp:17, rain:55,  sun:5.5, crowd:2, price:720, events:[] },
      { temp:13, rain:70,  sun:4.5, crowd:2, price:700, events:[] },
    ],
  },
  iceland: {
    name:"Iceland", country:"Iceland", type:"subarctic_adventure",
    photo:"https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=600&q=80",
    idealTemp:[5,18],
    monthly: [
      { temp:-1, rain:75, sun:1.0, crowd:4, price:800, events:[{name:"Northern Lights peak",type:"festival",bonus:2}] },
      { temp:0,  rain:70, sun:2.5, crowd:4, price:780, events:[{name:"Northern Lights",type:"festival",bonus:2}] },
      { temp:1,  rain:75, sun:4.5, crowd:5, price:850, events:[{name:"Northern Lights fade",type:"festival",bonus:1}] },
      { temp:4,  rain:55, sun:6.5, crowd:5, price:900, events:[] },
      { temp:7,  rain:45, sun:8.0, crowd:6, price:950, events:[{name:"Puffin season begins",type:"festival",bonus:1}] },
      { temp:10, rain:50, sun:10.0,crowd:8, price:1200,events:[{name:"Midnight sun",type:"festival",bonus:2}] },
      { temp:12, rain:50, sun:9.5, crowd:9, price:1350,events:[{name:"Midnight sun peak",type:"festival",bonus:2}] },
      { temp:11, rain:60, sun:7.5, crowd:8, price:1250,events:[] },
      { temp:8,  rain:65, sun:5.5, crowd:6, price:950, events:[{name:"Northern Lights return",type:"festival",bonus:2}] },
      { temp:4,  rain:75, sun:3.5, crowd:5, price:850, events:[{name:"Northern Lights",type:"festival",bonus:2}] },
      { temp:1,  rain:70, sun:1.5, crowd:3, price:750, events:[{name:"Northern Lights",type:"festival",bonus:2}] },
      { temp:0,  rain:75, sun:0.5, crowd:4, price:820, events:[{name:"New Year's fireworks",type:"festival",bonus:2}] },
    ],
  },
  marrakech: {
    name:"Marrakech", country:"Morocco", type:"desert_cultural",
    photo:"https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=600&q=80",
    idealTemp:[18,30],
    monthly: [
      { temp:12, rain:30, sun:6.5, crowd:4, price:600, events:[] },
      { temp:14, rain:35, sun:7.0, crowd:4, price:580, events:[] },
      { temp:17, rain:35, sun:7.5, crowd:6, price:700, events:[] },
      { temp:20, rain:30, sun:8.5, crowd:7, price:780, events:[{name:"Rose Festival (nearby)",type:"festival",bonus:1}] },
      { temp:24, rain:15, sun:9.5, crowd:6, price:720, events:[] },
      { temp:29, rain:5,  sun:10.5,crowd:4, price:650, events:[{name:"Extreme heat begins",type:"disruption",bonus:-2}] },
      { temp:35, rain:2,  sun:11.0,crowd:3, price:550, events:[{name:"Extreme heat peak",type:"disruption",bonus:-3}] },
      { temp:34, rain:3,  sun:10.5,crowd:3, price:560, events:[{name:"Extreme heat",type:"disruption",bonus:-3}] },
      { temp:29, rain:10, sun:9.0, crowd:5, price:680, events:[] },
      { temp:23, rain:25, sun:8.0, crowd:7, price:750, events:[{name:"Marrakech Film Festival",type:"festival",bonus:1}] },
      { temp:18, rain:35, sun:7.0, crowd:6, price:700, events:[] },
      { temp:13, rain:30, sun:6.5, crowd:5, price:650, events:[{name:"Holiday season",type:"disruption",bonus:-1}] },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SCORING ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

function calcWeatherScore(dest, monthIdx) {
  const m = dest.monthly[monthIdx];
  const [lo, hi] = dest.idealTemp;
  // Temperature component (0-10)
  let tempScore;
  if (m.temp >= lo && m.temp <= hi) tempScore = 10;
  else if (m.temp < lo) tempScore = Math.max(0, 10 - (lo - m.temp) * 0.8);
  else tempScore = Math.max(0, 10 - (m.temp - hi) * 0.6);

  // Rain component (0-10): 0mm=10, 300mm+=0
  const rainScore = Math.max(0, 10 - (m.rain / 30));

  // Sunshine component (0-10): scale 0-12hrs
  const sunScore = Math.min(10, (m.sun / 12) * 10);

  return Math.round(((tempScore * 0.45) + (rainScore * 0.35) + (sunScore * 0.20)) * 10) / 10;
}

function calcCrowdScore(dest, monthIdx) {
  // Inverse of crowd index (1-10 crowd → 10-1 score)
  return Math.round((11 - dest.monthly[monthIdx].crowd) * 10) / 10;
}

function calcPriceScore(dest, monthIdx) {
  const prices = dest.monthly.map(m => m.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  // Inverse: cheapest=10, most expensive=1
  return Math.round((1 - (dest.monthly[monthIdx].price - minP) / range) * 9 + 1) * 10 / 10;
}

function calcEventBonus(dest, monthIdx) {
  const events = dest.monthly[monthIdx].events;
  if (events.length === 0) return 0;
  return events.reduce((sum, e) => sum + e.bonus, 0);
}

function calcTotalScore(dest, monthIdx) {
  const w = calcWeatherScore(dest, monthIdx);
  const c = calcCrowdScore(dest, monthIdx);
  const p = calcPriceScore(dest, monthIdx);
  const e = calcEventBonus(dest, monthIdx);

  const base = 0.35 * w + 0.25 * c + 0.25 * p + 0.15 * Math.max(0, Math.min(10, 5 + e));
  return Math.round(Math.max(0, Math.min(10, base)) * 10) / 10;
}

function getScoreColor(score) {
  if (score >= 7.5) return T.success;
  if (score >= 5.5) return T.warning;
  return T.error;
}

function getScoreBg(score, alpha = 1) {
  if (score >= 7.5) return `rgba(34,197,94,${alpha})`;
  if (score >= 5.5) return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
}

/* Multi-destination optimizer */
function findOptimalMonth(selectedDests) {
  const destData = selectedDests.map(key => DESTINATIONS[key]);
  const monthScores = [];

  for (let m = 0; m < 12; m++) {
    const perDest = destData.map(d => ({
      name: d.name,
      total: calcTotalScore(d, m),
      weather: calcWeatherScore(d, m),
      crowd: calcCrowdScore(d, m),
      price: calcPriceScore(d, m),
      eventBonus: calcEventBonus(d, m),
      events: d.monthly[m].events,
      temp: d.monthly[m].temp,
      rain: d.monthly[m].rain,
    }));

    const avgScore = perDest.reduce((s, d) => s + d.total, 0) / perDest.length;
    const minScore = Math.min(...perDest.map(d => d.total));
    const allAboveThreshold = perDest.every(d => d.total >= 6);

    // Combined score: avg weighted by minimum (so bad for one dest penalizes)
    const combinedScore = avgScore * 0.6 + minScore * 0.4;

    monthScores.push({ month: m, perDest, avgScore, minScore, combinedScore, allAboveThreshold });
  }

  monthScores.sort((a, b) => b.combinedScore - a.combinedScore);
  return monthScores;
}

function generateExplanation(bestMonth, selectedDests) {
  const month = MONTH_FULL[bestMonth.month];
  const destData = selectedDests.map(key => DESTINATIONS[key]);
  const details = bestMonth.perDest;

  const parts = details.map(d => {
    const dest = destData.find(dd => dd.name === d.name);
    const highlights = [];

    if (d.weather >= 7) highlights.push(
      d.temp >= 25 ? `warm ${d.temp}°C weather` :
      d.temp >= 15 ? `pleasant ${d.temp}°C temperatures` :
      `crisp ${d.temp}°C conditions`
    );
    if (d.rain < 50) highlights.push("minimal rainfall");
    if (d.crowd >= 7) highlights.push("lighter crowds");
    if (d.price >= 7) highlights.push("favorable flight prices");

    d.events.filter(e => e.bonus > 0).forEach(e => highlights.push(e.name.toLowerCase()));

    const tradeoffs = [];
    if (d.weather < 5) tradeoffs.push("less ideal weather");
    if (d.crowd < 4) tradeoffs.push("higher crowds");
    d.events.filter(e => e.bonus < 0).forEach(e => tradeoffs.push(e.name.toLowerCase()));

    return { name: d.name, highlights, tradeoffs, score: d.total };
  });

  let explanation = `${month} offers `;
  explanation += parts.map(p =>
    `${p.highlights.length > 0 ? p.highlights.slice(0, 2).join(" and ") : "reasonable conditions"} in ${p.name}`
  ).join(", and ");
  explanation += ".";

  const tradeoffParts = parts.filter(p => p.tradeoffs.length > 0);
  if (tradeoffParts.length > 0) {
    explanation += " Note: " + tradeoffParts.map(p =>
      `${p.name} may have ${p.tradeoffs.join(" and ")}`
    ).join("; ") + ".";
  }

  return explanation;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function TimingAgent() {
  const [phase, setPhase] = useState("select");  // select | analyzing | results | decision | confirmed
  const [selected, setSelected] = useState(["bali", "kyoto"]);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [monthScores, setMonthScores] = useState([]);
  const [hoveredMonth, setHoveredMonth] = useState(null);
  const [expandedDest, setExpandedDest] = useState(null);
  const [decision, setDecision] = useState(null); // "yes"|"no"
  const [showAlternative, setShowAlternative] = useState(false);

  const toggleDest = (key) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Run analysis
  const startAnalysis = () => {
    setPhase("analyzing");
    setAnalysisStep(0);

    const steps = [700, 1500, 2400, 3200, 4000, 4600, 5200];
    steps.forEach((delay, i) => setTimeout(() => setAnalysisStep(i), delay));

    setTimeout(() => {
      const scores = findOptimalMonth(selected);
      setMonthScores(scores);
      setPhase("results");
    }, 5800);
  };

  const bestMonth = monthScores[0];
  const secondBest = monthScores[1];
  const confidence = bestMonth ? Math.round((bestMonth.combinedScore / 10) * 100) : 0;

  /* ═════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <CSS/>

      {/* Header */}
      <header style={{ background:`linear-gradient(140deg,${T.primaryDark} 0%,${T.primary} 45%,${T.primaryLight} 100%)`,
        padding:"20px 24px 18px", color:"#fff", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,
          background:"radial-gradient(circle at 85% 30%,rgba(77,168,218,.12),transparent 55%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:760,margin:"0 auto",position:"relative" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:42,height:42,borderRadius:13,background:"rgba(255,255,255,.1)",backdropFilter:"blur(8px)",
              display:"flex",alignItems:"center",justifyContent:"center",animation:"glow 3s infinite" }}>
              <span style={{ fontSize:22 }}>📅</span>
            </div>
            <div>
              <h1 className="hd" style={{ fontWeight:700,fontSize:20 }}>Travel Timing Agent</h1>
              <p style={{ fontSize:13,opacity:.65 }}>Optimal dates powered by weather, crowds, prices & events</p>
            </div>
          </div>
          {/* Phase indicator */}
          <div style={{ display:"flex",gap:3,marginTop:14 }}>
            {["select","analyzing","results","decision","confirmed"].map((p,i) => (
              <div key={p} style={{ flex:1,height:3,borderRadius:999,
                background:["select","analyzing","results","decision","confirmed"].indexOf(phase)>=i
                  ?"rgba(255,255,255,.75)":"rgba(255,255,255,.12)",transition:"background .4s" }}/>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:760,margin:"0 auto",padding:"22px 20px 80px" }}>

        {/* ═══════════════════════════════════════════════════════════
           PHASE: SELECT DESTINATIONS
           ═══════════════════════════════════════════════════════════ */}
        {phase === "select" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <AgentChat emoji="📅" name="Timing Agent"
              msg="Which destinations should I analyze? Select 2–5 from your bucket list, and I'll find the perfect travel window." />

            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:12,marginTop:18 }}>
              {Object.entries(DESTINATIONS).map(([key, dest], i) => {
                const active = selected.includes(key);
                return (
                  <button key={key} onClick={() => toggleDest(key)}
                    style={{ background:T.surface,borderRadius:14,overflow:"hidden",border:`2px solid ${active?T.primary:T.borderLight}`,
                      cursor:"pointer",textAlign:"left",transition:"all .25s",
                      boxShadow:active?`${sh.md},0 0 0 3px ${T.primary}15`:sh.sm,
                      animation:`fadeUp .35s ease-out ${i*.04}s both`,
                      transform:active?"scale(1.02)":"none" }}>
                    <div style={{ height:80,background:`url(${dest.photo}) center/cover`,position:"relative" }}>
                      {active && <div style={{ position:"absolute",top:6,right:6,width:22,height:22,borderRadius:999,
                        background:T.primary,display:"flex",alignItems:"center",justifyContent:"center",
                        animation:"popIn .3s ease" }}>
                        <Ic n="check" s={12} c="#fff"/>
                      </div>}
                    </div>
                    <div style={{ padding:"10px 14px" }}>
                      <p className="hd" style={{ fontWeight:700,fontSize:15,color:active?T.primary:T.text }}>{dest.name}</p>
                      <p style={{ fontSize:12,color:T.text3 }}>{dest.country}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {selected.length >= 2 && (
              <div style={{ marginTop:20,animation:"scaleIn .3s ease-out" }}>
                <button onClick={startAnalysis} className="hd"
                  style={{ width:"100%",padding:"14px",borderRadius:14,border:"none",
                    background:T.primary,color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                    minHeight:52,boxShadow:`0 4px 16px ${T.primary}30`,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <Ic n="zap" s={18} c="#fff"/> Analyze {selected.length} Destinations →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: ANALYZING
           ═══════════════════════════════════════════════════════════ */}
        {phase === "analyzing" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <div style={{ background:T.surface,borderRadius:18,padding:28,border:`1px solid ${T.borderLight}`,
              boxShadow:sh.md,textAlign:"center" }}>
              <div style={{ width:64,height:64,borderRadius:20,margin:"0 auto 20px",
                background:`linear-gradient(135deg,${T.primary}15,${T.accent}10)`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,
                animation:"glow 2s ease-in-out infinite" }}>🔍</div>
              <h2 className="hd" style={{ fontWeight:700,fontSize:22,marginBottom:6 }}>Analyzing Travel Windows</h2>
              <p style={{ color:T.text2,fontSize:14,marginBottom:24 }}>
                Crunching data for {selected.map(k=>DESTINATIONS[k].name).join(" + ")}...
              </p>

              <div style={{ display:"flex",flexDirection:"column",gap:11,textAlign:"left",maxWidth:460,margin:"0 auto" }}>
                {[
                  {icon:"thermo",label:"Fetching historical weather from OpenWeatherMap...",src:"Temperature, rainfall, sunshine hours"},
                  {icon:"users",label:"Pulling crowd data from Google Trends...",src:"Search popularity by month"},
                  {icon:"dollar",label:"Loading Amadeus flight price analytics...",src:"Average prices by month"},
                  {icon:"flag",label:"Scanning local event calendars...",src:"Festivals, holidays, peak seasons"},
                  {icon:"sparkle",label:"Computing composite scores (12 months × "+selected.length+" dests)...",src:"Weighted: 35% weather, 25% crowd, 25% price, 15% events"},
                  {icon:"target",label:"Running multi-destination optimization...",src:"Finding months above threshold (>6.0)"},
                  {icon:"check",label:"Analysis complete! ✨",src:""},
                ].map((step,i) => (
                  <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:12,
                    opacity:analysisStep>=i?1:.2,transition:"opacity .4s",
                    animation:analysisStep===i?"fadeUp .3s ease-out":"none" }}>
                    <div style={{ width:28,height:28,borderRadius:999,flexShrink:0,marginTop:1,
                      background:analysisStep>i?T.success:analysisStep===i?T.primary:T.borderLight,
                      display:"flex",alignItems:"center",justifyContent:"center",transition:"all .3s" }}>
                      {analysisStep>i ? <Ic n="check" s={13} c="#fff"/> :
                        analysisStep===i ? <div style={{ width:8,height:8,borderRadius:999,background:"#fff",animation:"dotPulse 1s infinite" }}/> :
                        <Ic n={step.icon} s={13} c={T.text3}/>}
                    </div>
                    <div>
                      <span style={{ fontSize:14,fontWeight:analysisStep===i?600:400,color:analysisStep>=i?T.text:T.text3 }}>{step.label}</span>
                      {step.src && analysisStep>=i && <p style={{ fontSize:11.5,color:T.text3,marginTop:1 }}>{step.src}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: RESULTS — Heatmaps + Scores
           ═══════════════════════════════════════════════════════════ */}
        {(phase === "results" || phase === "decision" || phase === "confirmed") && monthScores.length > 0 && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            {/* Recommendation banner */}
            {bestMonth && (
              <div style={{ background:`linear-gradient(135deg,${T.primary}10,${T.accent}08)`,
                borderRadius:16,padding:"18px 22px",marginBottom:20,border:`1px solid ${T.primary}20`,
                display:"flex",alignItems:"center",gap:16,animation:"scaleIn .4s ease-out" }}>
                <div style={{ width:56,height:56,borderRadius:16,
                  background:`linear-gradient(135deg,${T.primary},${T.accent})`,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  color:"#fff",flexShrink:0 }}>
                  <span className="hd" style={{ fontWeight:700,fontSize:18,lineHeight:1 }}>
                    {MONTHS[bestMonth.month]}
                  </span>
                  <span style={{ fontSize:9,opacity:.7 }}>BEST</span>
                </div>
                <div style={{ flex:1 }}>
                  <h3 className="hd" style={{ fontWeight:700,fontSize:17 }}>
                    {MONTH_FULL[bestMonth.month]} is your optimal travel window
                  </h3>
                  <p style={{ fontSize:13,color:T.text2,marginTop:2 }}>
                    Combined score: {bestMonth.combinedScore.toFixed(1)}/10 · Confidence: {confidence}%
                    {!bestMonth.allAboveThreshold && <span style={{ color:T.warning }}> · Compromise month (not all above 6.0)</span>}
                  </p>
                </div>
                <div className="hd" style={{ padding:"6px 16px",borderRadius:999,
                  background:T.primary,color:"#fff",fontWeight:700,fontSize:15,flexShrink:0 }}>
                  {confidence}%
                </div>
              </div>
            )}

            {/* Per-destination heatmaps */}
            {selected.map((destKey, di) => {
              const dest = DESTINATIONS[destKey];
              const isExpanded = expandedDest === destKey;

              return (
                <div key={destKey} style={{ background:T.surface,borderRadius:16,marginBottom:16,
                  border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,overflow:"hidden",
                  animation:`slideL .4s ease-out ${di*.08}s both` }}>

                  {/* Destination header */}
                  <div style={{ display:"flex",alignItems:"center",gap:14,padding:"16px 20px",
                    borderBottom:`1px solid ${T.borderLight}`,cursor:"pointer" }}
                    onClick={() => setExpandedDest(isExpanded ? null : destKey)}>
                    <div style={{ width:44,height:44,borderRadius:12,flexShrink:0,
                      background:`url(${dest.photo}) center/cover` }}/>
                    <div style={{ flex:1 }}>
                      <h3 className="hd" style={{ fontWeight:700,fontSize:16 }}>{dest.name}</h3>
                      <p style={{ fontSize:12.5,color:T.text2 }}>{dest.country} · {dest.type.replace(/_/g," ")}</p>
                    </div>
                    {bestMonth && (
                      <div style={{ textAlign:"right" }}>
                        <div className="hd" style={{ fontWeight:700,fontSize:18,
                          color:getScoreColor(bestMonth.perDest.find(d=>d.name===dest.name)?.total||0) }}>
                          {bestMonth.perDest.find(d=>d.name===dest.name)?.total.toFixed(1)}
                        </div>
                        <span style={{ fontSize:11,color:T.text3 }}>in {MONTHS[bestMonth.month]}</span>
                      </div>
                    )}
                    <div style={{ transform:isExpanded?"rotate(90deg)":"none",transition:"transform .2s" }}>
                      <Ic n="chevR" s={16} c={T.text3}/>
                    </div>
                  </div>

                  {/* Calendar heatmap */}
                  <div style={{ padding:"14px 20px 16px" }}>
                    <p className="hd" style={{ fontSize:12,fontWeight:600,color:T.text3,marginBottom:10 }}>
                      COMPOSITE SCORE BY MONTH
                    </p>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:5 }}>
                      {MONTHS.map((m, mi) => {
                        const score = calcTotalScore(dest, mi);
                        const isBest = bestMonth && mi === bestMonth.month;
                        const isHovered = hoveredMonth === mi;

                        return (
                          <div key={mi}
                            onMouseEnter={() => setHoveredMonth(mi)}
                            onMouseLeave={() => setHoveredMonth(null)}
                            style={{ textAlign:"center",borderRadius:10,padding:"8px 2px",cursor:"pointer",
                              background:getScoreBg(score, 0.12),
                              border:isBest?`2px solid ${T.primary}`:isHovered?`2px solid ${getScoreColor(score)}50`:`2px solid transparent`,
                              transition:"all .15s",position:"relative",
                              animation:`cellReveal .3s ease-out ${mi*.03}s both`,
                              transform:isHovered?"scale(1.08)":"none" }}>
                            <p className="hd" style={{ fontSize:10.5,fontWeight:600,color:T.text2,marginBottom:3 }}>{m}</p>
                            <p className="hd" style={{ fontWeight:700,fontSize:15,color:getScoreColor(score) }}>
                              {score.toFixed(1)}
                            </p>
                            {isBest && <div style={{ width:6,height:6,borderRadius:999,background:T.primary,
                              margin:"3px auto 0",animation:"pulseRing 1.5s infinite" }}/>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div style={{ display:"flex",gap:16,marginTop:10,fontSize:11,color:T.text3 }}>
                      <span style={{ display:"flex",alignItems:"center",gap:4 }}>
                        <div style={{ width:10,height:10,borderRadius:3,background:getScoreBg(8,.2) }}/> Great (7.5+)
                      </span>
                      <span style={{ display:"flex",alignItems:"center",gap:4 }}>
                        <div style={{ width:10,height:10,borderRadius:3,background:getScoreBg(6,.2) }}/> Okay (5.5–7.4)
                      </span>
                      <span style={{ display:"flex",alignItems:"center",gap:4 }}>
                        <div style={{ width:10,height:10,borderRadius:3,background:getScoreBg(3,.2) }}/> Avoid (&lt;5.5)
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail: score breakdown */}
                  {isExpanded && (
                    <div style={{ padding:"0 20px 18px",animation:"fadeIn .25s ease-out" }}>
                      <div style={{ background:T.bg,borderRadius:12,padding:16 }}>
                        <p className="hd" style={{ fontSize:12,fontWeight:600,color:T.text3,marginBottom:12 }}>
                          SCORE BREAKDOWN — {hoveredMonth !== null ? MONTH_FULL[hoveredMonth] : (bestMonth ? MONTH_FULL[bestMonth.month] : "Select a month")}
                        </p>
                        {(() => {
                          const mi = hoveredMonth !== null ? hoveredMonth : (bestMonth ? bestMonth.month : 0);
                          const m = dest.monthly[mi];
                          const ws = calcWeatherScore(dest, mi);
                          const cs = calcCrowdScore(dest, mi);
                          const ps = calcPriceScore(dest, mi);
                          const eb = calcEventBonus(dest, mi);
                          const ts = calcTotalScore(dest, mi);

                          return (
                            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                              {[
                                { label:"Weather",score:ws,weight:"35%",icon:"sun",color:T.secondary,
                                  detail:`${m.temp}°C · ${m.rain}mm rain · ${m.sun}h sun` },
                                { label:"Crowds",score:cs,weight:"25%",icon:"users",color:T.accent,
                                  detail:`Crowd level: ${m.crowd}/10 (${m.crowd<=3?"quiet":m.crowd<=6?"moderate":m.crowd<=8?"busy":"packed"})` },
                                { label:"Flight Price",score:ps,weight:"25%",icon:"dollar",color:T.success,
                                  detail:`$${m.price} avg round-trip` },
                                { label:"Events",score:Math.max(0,Math.min(10,5+eb)),weight:"15%",icon:"flag",
                                  color:eb>0?T.primary:eb<0?T.error:T.text3,
                                  detail:m.events.length>0?m.events.map(e=>`${e.name} (${e.bonus>0?"+":""}{${e.bonus}})`).join(", "):"No notable events" },
                              ].map(row => (
                                <div key={row.label}>
                                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                                      <Ic n={row.icon} s={14} c={row.color}/>
                                      <span style={{ fontSize:13,fontWeight:600 }}>{row.label}</span>
                                      <span style={{ fontSize:11,color:T.text3 }}>({row.weight})</span>
                                    </div>
                                    <span className="hd" style={{ fontWeight:700,fontSize:14,color:getScoreColor(row.score) }}>
                                      {row.score.toFixed(1)}
                                    </span>
                                  </div>
                                  <div style={{ height:6,background:T.borderLight,borderRadius:999,marginBottom:3 }}>
                                    <div style={{ height:"100%",width:`${row.score*10}%`,background:row.color,
                                      borderRadius:999,transition:"width .4s",animation:"barGrow .6s ease-out" }}/>
                                  </div>
                                  <p style={{ fontSize:11.5,color:T.text3 }}>{row.detail}</p>
                                </div>
                              ))}
                              <div style={{ borderTop:`1px solid ${T.border}`,paddingTop:10,marginTop:4,
                                display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                                <span className="hd" style={{ fontWeight:700,fontSize:14 }}>Total Composite</span>
                                <span className="hd" style={{ fontWeight:700,fontSize:20,color:getScoreColor(ts) }}>
                                  {ts.toFixed(1)} <span style={{ fontSize:13,color:T.text3,fontWeight:500 }}>/ 10</span>
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* All-months ranking */}
            <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,marginBottom:20,
              animation:`fadeUp .4s ease-out ${selected.length*.08+.1}s both` }}>
              <p className="hd" style={{ fontSize:13,fontWeight:700,color:T.text3,marginBottom:12 }}>ALL MONTHS RANKED</p>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {monthScores.slice(0, 6).map((ms, i) => (
                  <div key={ms.month} style={{ display:"flex",alignItems:"center",gap:12,padding:"8px 12px",
                    borderRadius:10,background:i===0?`${T.primary}06`:i===1?`${T.bg}`:"transparent",
                    border:i===0?`1px solid ${T.primary}18`:`1px solid transparent`,
                    animation:`slideL .3s ease-out ${i*.04}s both` }}>
                    <span className="hd" style={{ width:24,fontWeight:700,fontSize:13,
                      color:i===0?T.primary:T.text3 }}>#{i+1}</span>
                    <span className="hd" style={{ fontWeight:600,fontSize:14,width:90 }}>
                      {MONTH_FULL[ms.month]}
                    </span>
                    <div style={{ flex:1,display:"flex",gap:4 }}>
                      {ms.perDest.map(d => (
                        <div key={d.name} style={{ flex:1,height:8,borderRadius:999,
                          background:getScoreBg(d.total, .25),position:"relative" }}>
                          <div style={{ height:"100%",width:`${d.total*10}%`,borderRadius:999,
                            background:getScoreColor(d.total),transition:"width .4s" }}/>
                        </div>
                      ))}
                    </div>
                    <span className="hd" style={{ fontWeight:700,fontSize:14,minWidth:36,textAlign:"right",
                      color:getScoreColor(ms.combinedScore) }}>
                      {ms.combinedScore.toFixed(1)}
                    </span>
                    {ms.allAboveThreshold && <span style={{ fontSize:10,color:T.success }}>✓</span>}
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",gap:12,marginTop:10 }}>
                {selected.map(k => (
                  <div key={k} style={{ display:"flex",alignItems:"center",gap:4,fontSize:11.5,color:T.text3 }}>
                    <div style={{ width:8,height:8,borderRadius:2,
                      background:`linear-gradient(135deg,${T.primary},${T.accent})` }}/>
                    {DESTINATIONS[k].name}
                  </div>
                ))}
              </div>
            </div>

            {/* YesNoCard */}
            {phase === "results" && bestMonth && (
              <div style={{ background:T.surface,borderRadius:18,boxShadow:sh.lg,overflow:"hidden",
                border:`1px solid ${T.borderLight}`,animation:"scaleIn .4s ease-out" }}>
                <div style={{ padding:"22px 24px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                    <span className="hd" style={{ background:`${T.primary}12`,color:T.primary,
                      padding:"2px 12px",borderRadius:999,fontSize:11,fontWeight:700,letterSpacing:".3px" }}>
                      Timing Agent
                    </span>
                    <span className="hd" style={{ fontSize:11,color:T.text3 }}>Recommendation</span>
                  </div>

                  <h3 className="hd" style={{ fontWeight:700,fontSize:20,lineHeight:1.3,marginBottom:4 }}>
                    {showAlternative
                      ? `Alternative: ${MONTH_FULL[secondBest.month]} (${Math.round((secondBest.combinedScore/10)*100)}% match)`
                      : `${MONTH_FULL[bestMonth.month]} is the best time for your ${selected.map(k=>DESTINATIONS[k].name).join(" + ")} trip (${confidence}% match)`
                    }
                  </h3>

                  <p style={{ fontSize:14.5,color:T.text2,lineHeight:1.65,marginBottom:16 }}>
                    {generateExplanation(showAlternative ? secondBest : bestMonth, selected)}
                  </p>

                  {/* Score chips */}
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:18 }}>
                    {(showAlternative ? secondBest : bestMonth).perDest.map(d => (
                      <span key={d.name} style={{ display:"inline-flex",alignItems:"center",gap:5,
                        background:`${getScoreColor(d.total)}12`,color:getScoreColor(d.total),
                        padding:"4px 12px",borderRadius:999,fontSize:13,fontWeight:600 }}>
                        {d.name}: {d.total.toFixed(1)}
                      </span>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div style={{ display:"flex",gap:12 }}>
                    <button onClick={() => {
                      if (!showAlternative) setShowAlternative(true);
                      else { setDecision("no"); setPhase("decision"); }
                    }}
                      className="hd" style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        padding:"14px",borderRadius:12,border:`2px solid ${T.error}`,
                        background:"transparent",color:T.error,fontSize:15,fontWeight:600,
                        cursor:"pointer",minHeight:50,transition:"all .2s" }}>
                      <Ic n="x" s={18} c={T.error}/> Revise
                    </button>
                    <button onClick={() => { setDecision("yes"); setPhase("decision"); }}
                      className="hd" style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        padding:"14px",borderRadius:12,border:"none",
                        background:T.primary,color:"#fff",fontSize:15,fontWeight:600,
                        cursor:"pointer",minHeight:50,boxShadow:`0 2px 10px ${T.primary}40`,transition:"all .2s" }}>
                      <Ic n="check" s={18} c="#fff"/> Approve
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Decision confirmed */}
            {phase === "decision" && (
              <div style={{ textAlign:"center",padding:"32px 24px",animation:"scaleIn .4s ease-out" }}>
                {decision === "yes" ? (
                  <>
                    <div style={{ fontSize:56,marginBottom:12,position:"relative",display:"inline-block" }}>
                      ✅
                      {["🗓️","✨","🌤️","🎉"].map((e,i)=>(
                        <span key={i} style={{ position:"absolute",fontSize:16,
                          top:`${-8+Math.sin(i*1.5)*25}px`,left:`${-12+Math.cos(i*1.5)*35}px`,
                          animation:`confettiBurst 1.2s ease-out ${.2+i*.12}s both`,pointerEvents:"none" }}>{e}</span>
                      ))}
                    </div>
                    <h2 className="hd" style={{ fontWeight:700,fontSize:24,color:T.success }}>
                      {MONTH_FULL[(showAlternative?secondBest:bestMonth).month]} Locked In!
                    </h2>
                    <p style={{ color:T.text2,fontSize:15,marginTop:8,maxWidth:400,margin:"8px auto 0" }}>
                      Travel window saved. The Availability Agent will now coordinate member schedules.
                    </p>

                    {/* Stored data preview */}
                    <div style={{ background:T.surface,borderRadius:14,padding:18,marginTop:24,
                      border:`1px solid ${T.borderLight}`,textAlign:"left",maxWidth:480,margin:"24px auto 0" }}>
                      <p className="hd" style={{ fontSize:12,fontWeight:600,color:T.text3,marginBottom:8 }}>
                        Stored → trip_plans.timing
                      </p>
                      <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12,lineHeight:1.6,
                        color:T.text,overflow:"auto",border:`1px solid ${T.borderLight}`,
                        fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify({
  optimal_month: (showAlternative?secondBest:bestMonth).month + 1,
  month_name: MONTH_FULL[(showAlternative?secondBest:bestMonth).month],
  confidence: confidence + "%",
  combined_score: (showAlternative?secondBest:bestMonth).combinedScore.toFixed(1),
  per_destination: (showAlternative?secondBest:bestMonth).perDest.map(d => ({
    name: d.name,
    total_score: d.total,
    weather_score: d.weather,
    crowd_score: d.crowd,
    price_score: d.price,
    event_bonus: d.eventBonus,
  })),
  algorithm: "0.35*weather + 0.25*crowd + 0.25*price + 0.15*event",
  all_above_threshold: (showAlternative?secondBest:bestMonth).allAboveThreshold,
}, null, 2)}
                      </pre>
                    </div>

                    <button onClick={() => {
                      setPhase("select"); setSelected(["bali","kyoto"]); setMonthScores([]);
                      setDecision(null); setShowAlternative(false); setExpandedDest(null); setHoveredMonth(null);
                    }} style={{ marginTop:20,background:"none",border:"none",color:T.text3,
                      fontSize:13,cursor:"pointer",textDecoration:"underline" }}>
                      ← Restart demo
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize:48,marginBottom:12 }}>🔄</div>
                    <h2 className="hd" style={{ fontWeight:700,fontSize:22 }}>No problem!</h2>
                    <p style={{ color:T.text2,fontSize:15,marginTop:8 }}>
                      Let's explore different destination combinations or adjust your priorities.
                    </p>
                    <button onClick={() => {
                      setPhase("select"); setMonthScores([]); setDecision(null); setShowAlternative(false);
                    }} className="hd"
                      style={{ marginTop:20,padding:"12px 28px",borderRadius:12,border:"none",
                        background:T.primary,color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",minHeight:48 }}>
                      Choose Different Destinations
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENT CHAT BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
function AgentChat({ emoji, name, msg }) {
  return (
    <div style={{ display:"flex",gap:10,maxWidth:500,animation:"fadeUp .35s ease-out" }}>
      <div style={{ width:32,height:32,borderRadius:999,flexShrink:0,
        background:`linear-gradient(135deg,${T.primary},${T.accent})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{emoji}</div>
      <div>
        <p className="hd" style={{ fontSize:11,color:T.primary,fontWeight:600,marginBottom:3 }}>{name}</p>
        <div style={{ background:T.surface,color:T.text,padding:"11px 15px",
          borderRadius:"12px 12px 12px 3px",boxShadow:sh.sm,fontSize:14,lineHeight:1.6,
          border:`1px solid ${T.borderLight}` }}>{msg}</div>
      </div>
    </div>
  );
}
