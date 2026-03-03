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
  @keyframes slideR{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
  @keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.35}40%{transform:scale(1);opacity:1}}
  @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(13,115,119,.12)}50%{box-shadow:0 0 22px rgba(13,115,119,.25)}}
  @keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
  @keyframes barGrow{from{width:0}}
  @keyframes radarDraw{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
  @keyframes confettiBurst{0%{transform:translateY(0) rotate(0) scale(1);opacity:1}100%{transform:translateY(-100px) rotate(720deg) scale(0);opacity:0}}
  @keyframes ringPulse{0%{box-shadow:0 0 0 0 rgba(13,115,119,.25)}100%{box-shadow:0 0 0 14px rgba(13,115,119,0)}}
  @keyframes optionPick{0%{transform:scale(1)}40%{transform:scale(.92)}100%{transform:scale(1)}}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */
const Ic = ({n,s=18,c="currentColor"}) => {
  const p = {
    check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
    x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
    chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevL:<path d="M15 18l-6-6 6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeWidth="1.8" stroke={c} fill="none"/></>,
    sparkle:<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
    zap:<path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" strokeWidth="1.8" stroke={c} fill="none" strokeLinejoin="round"/>,
    target:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="12" cy="12" r="6" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="12" cy="12" r="2" fill={c}/></>,
    heart:<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeWidth="1.8" stroke={c} fill="none"/>,
    compass:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" strokeWidth="1.8" stroke={c} fill="none"/></>,
    db:<><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" strokeWidth="1.8" stroke={c} fill="none"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{p[n]||p.target}</svg>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MEMBERS
   ═══════════════════════════════════════════════════════════════════════════ */
const MEMBERS = [
  { id:"james", name:"James W", initials:"JW" },
  { id:"sarah", name:"Sarah W", initials:"SW" },
  { id:"alex",  name:"Alex C",  initials:"AC" },
  { id:"priya", name:"Priya S", initials:"PS" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   INTEREST CATEGORIES & QUIZ DATA
   Each category has a set of specific activity questions
   ═══════════════════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { id:"adventure",  label:"Adventure & Outdoors",  emoji:"🏔️", color:"#22C55E",
    desc:"Hiking, water sports, extreme activities" },
  { id:"culture",    label:"Culture & History",      emoji:"🏛️", color:"#8B5CF6",
    desc:"Museums, temples, heritage sites, local customs" },
  { id:"food",       label:"Food & Drink",           emoji:"🍜", color:T.secondary,
    desc:"Street food, fine dining, cooking classes, wine" },
  { id:"relaxation", label:"Relaxation & Wellness",  emoji:"🧘", color:"#6366F1",
    desc:"Spas, beaches, yoga, slow travel" },
  { id:"photography",label:"Photography & Scenery",  emoji:"📸", color:T.accent,
    desc:"Landscapes, architecture, golden hour, viewpoints" },
  { id:"nightlife",  label:"Nightlife & Social",     emoji:"🌙", color:"#EC4899",
    desc:"Bars, clubs, live music, late-night markets" },
  { id:"shopping",   label:"Shopping & Markets",      emoji:"🛍️", color:T.warning,
    desc:"Local crafts, souvenirs, boutiques, bazaars" },
  { id:"nature",     label:"Nature & Wildlife",       emoji:"🦋", color:"#10B981",
    desc:"National parks, safaris, marine life, birdwatching" },
];

/* Questions per category — each has 3 activities to rate */
const QUIZ_QUESTIONS = {
  adventure: [
    { id:"hike",   label:"Hiking & trekking",     emoji:"🥾", scenarios:["Multi-day treks","Guided day hikes","Easy nature walks"] },
    { id:"water",  label:"Water sports",           emoji:"🏄", scenarios:["Surfing & diving","Kayaking & paddleboarding","Swimming & snorkeling"] },
    { id:"thrill", label:"Adrenaline activities",  emoji:"🪂", scenarios:["Bungee & skydiving","Zip-lining & ATV rides","Rock climbing"] },
  ],
  culture: [
    { id:"museum", label:"Museums & galleries",    emoji:"🖼️", scenarios:["World-class art museums","Quirky local galleries","Interactive exhibits"] },
    { id:"temple", label:"Temples & heritage",     emoji:"⛩️", scenarios:["Ancient ruins & temples","UNESCO heritage sites","Religious ceremonies"] },
    { id:"local",  label:"Local customs & events", emoji:"🎭", scenarios:["Cultural festivals","Traditional workshops","Local neighborhood tours"] },
  ],
  food: [
    { id:"street", label:"Street food & markets",  emoji:"🥟", scenarios:["Night markets","Food stalls & hawkers","Food truck festivals"] },
    { id:"fine",   label:"Fine dining",            emoji:"🍷", scenarios:["Michelin-star restaurants","Chef's table experiences","Wine pairing dinners"] },
    { id:"cook",   label:"Cooking & tasting",      emoji:"👨‍🍳", scenarios:["Cooking classes","Food tours with locals","Wine & cheese tastings"] },
  ],
  relaxation: [
    { id:"spa",    label:"Spas & wellness",        emoji:"💆", scenarios:["Traditional spa treatments","Onsen / hot springs","Yoga & meditation retreats"] },
    { id:"beach",  label:"Beach & poolside",       emoji:"🏖️", scenarios:["Beach lounging all day","Island hopping","Private beach resorts"] },
    { id:"slow",   label:"Slow travel",            emoji:"☕", scenarios:["Café hopping & reading","Scenic train rides","Walking with no plan"] },
  ],
  photography: [
    { id:"land",   label:"Landscape photography",  emoji:"🌅", scenarios:["Sunrise/sunset shoots","Mountain vistas","Aerial/drone shots"] },
    { id:"arch",   label:"Architecture & urban",   emoji:"🏙️", scenarios:["Skyline photography","Historic buildings","Street art & murals"] },
    { id:"people", label:"People & stories",       emoji:"👤", scenarios:["Street portraits","Market scenes","Festival documentation"] },
  ],
  nightlife: [
    { id:"bars",   label:"Bars & cocktails",       emoji:"🍸", scenarios:["Rooftop bars","Hidden speakeasies","Local craft beer spots"] },
    { id:"music",  label:"Live music & shows",     emoji:"🎵", scenarios:["Live jazz/rock venues","Traditional performances","DJ clubs & raves"] },
    { id:"night",  label:"Night markets & late eats",emoji:"🌃", scenarios:["Late-night food crawls","Night bazaars","Evening boat cruises"] },
  ],
  shopping: [
    { id:"crafts", label:"Local crafts & artisans",emoji:"🎨", scenarios:["Handmade ceramics & textiles","Local artisan workshops","Antique markets"] },
    { id:"souvn",  label:"Souvenirs & gifts",      emoji:"🎁", scenarios:["Traditional souvenirs","Unique local products","Specialty food items"] },
    { id:"boutiq", label:"Boutiques & fashion",    emoji:"👗", scenarios:["Designer boutiques","Vintage & thrift","Local fashion brands"] },
  ],
  nature: [
    { id:"parks",  label:"National parks & trails",emoji:"🌲", scenarios:["Guided nature walks","Wildlife watching","Scenic overlooks"] },
    { id:"marine", label:"Marine life",            emoji:"🐠", scenarios:["Snorkeling reefs","Whale watching","Turtle sanctuaries"] },
    { id:"bird",   label:"Birdwatching & ecology", emoji:"🦜", scenarios:["Guided birding tours","Rainforest walks","Butterfly gardens"] },
  ],
};

/* Intensity labels */
const INTENSITY = [
  { value:0, label:"Not interested", emoji:"😐", color:T.text3 },
  { value:1, label:"Mildly curious",  emoji:"🤔", color:T.warning },
  { value:2, label:"Sounds fun!",     emoji:"😊", color:T.accent },
  { value:3, label:"Love it!",        emoji:"😍", color:T.success },
  { value:4, label:"Must-do!",        emoji:"🤩", color:T.secondary },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SCORING & MATCHING ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

function calcCategoryScore(answers, catId) {
  const catAnswers = answers[catId];
  if (!catAnswers) return 0;
  const vals = Object.values(catAnswers);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / (vals.length * 4)) * 100);
}

function calcMemberProfile(answers) {
  const profile = {};
  CATEGORIES.forEach(cat => {
    profile[cat.id] = calcCategoryScore(answers, cat.id);
  });
  return profile;
}

function calcGroupOverlap(allAnswers) {
  const memberIds = Object.keys(allAnswers);
  const profiles = {};
  memberIds.forEach(id => { profiles[id] = calcMemberProfile(allAnswers[id]); });

  // Per-category group scores
  const groupScores = {};
  CATEGORIES.forEach(cat => {
    const scores = memberIds.map(id => profiles[id][cat.id]);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const spread = max - min;
    const consensus = Math.max(0, 100 - spread); // high consensus = low spread
    groupScores[cat.id] = { avg: Math.round(avg), min, max, spread, consensus: Math.round(consensus) };
  });

  // Find strong overlaps (everyone ≥50%)
  const strongOverlaps = CATEGORIES.filter(cat => groupScores[cat.id].min >= 50).map(c => c.id);

  // Find unique passions (one member ≥75%, others <40%)
  const uniquePassions = [];
  memberIds.forEach(mid => {
    CATEGORIES.forEach(cat => {
      const myScore = profiles[mid][cat.id];
      const othersMax = Math.max(...memberIds.filter(id => id !== mid).map(id => profiles[id][cat.id]));
      if (myScore >= 75 && othersMax < 40) {
        uniquePassions.push({ member: mid, category: cat.id, score: myScore });
      }
    });
  });

  // Find conflicts (high variance: someone loves it, someone doesn't)
  const conflicts = CATEGORIES.filter(cat => groupScores[cat.id].spread >= 60).map(cat => ({
    category: cat.id,
    high: memberIds.filter(id => profiles[id][cat.id] >= 70),
    low: memberIds.filter(id => profiles[id][cat.id] <= 25),
  }));

  // Activity-level consensus (specific activities everyone rated ≥2)
  const activityHits = [];
  CATEGORIES.forEach(cat => {
    const questions = QUIZ_QUESTIONS[cat.id] || [];
    questions.forEach(q => {
      const ratings = memberIds.map(id => allAnswers[id]?.[cat.id]?.[q.id] ?? 0);
      const allLike = ratings.every(r => r >= 2);
      const avgRating = ratings.reduce((s, v) => s + v, 0) / ratings.length;
      if (allLike) {
        activityHits.push({ activity: q.label, emoji: q.emoji, category: cat.id, avgRating: Math.round(avgRating * 10) / 10 });
      }
    });
  });
  activityHits.sort((a, b) => b.avgRating - a.avgRating);

  // Group compatibility score (0-100)
  const avgConsensus = Object.values(groupScores).reduce((s, v) => s + v.consensus, 0) / CATEGORIES.length;
  const overlapBonus = strongOverlaps.length * 5;
  const conflictPenalty = conflicts.length * 8;
  const compatibility = Math.round(Math.min(100, Math.max(0, avgConsensus + overlapBonus - conflictPenalty)));

  return { profiles, groupScores, strongOverlaps, uniquePassions, conflicts, activityHits, compatibility };
}

function generateGroupSummary(analysis) {
  const { strongOverlaps, uniquePassions, conflicts, activityHits, compatibility } = analysis;

  let summary = "";

  if (strongOverlaps.length > 0) {
    const names = strongOverlaps.map(id => CATEGORIES.find(c => c.id === id)?.label).filter(Boolean);
    summary += `Your group shares a strong love for ${names.slice(0, 3).join(", ")}. `;
  }

  if (activityHits.length > 0) {
    summary += `Everyone agrees on ${activityHits.slice(0, 3).map(a => a.emoji + " " + a.activity.toLowerCase()).join(", ")}. `;
  }

  if (conflicts.length > 0) {
    const c = conflicts[0];
    const catName = CATEGORIES.find(cat => cat.id === c.category)?.label;
    const highNames = c.high.map(id => MEMBERS.find(m => m.id === id)?.name.split(" ")[0]).join(" & ");
    const lowNames = c.low.map(id => MEMBERS.find(m => m.id === id)?.name.split(" ")[0]).join(" & ");
    summary += `Note: ${highNames} love${c.high.length === 1 ? "s" : ""} ${catName?.toLowerCase()} but ${lowNames} ${c.low.length === 1 ? "isn't" : "aren't"} as keen — we'll plan optional activities here. `;
  }

  if (uniquePassions.length > 0) {
    const p = uniquePassions[0];
    const memberName = MEMBERS.find(m => m.id === p.member)?.name.split(" ")[0];
    const catName = CATEGORIES.find(c => c.id === p.category)?.label;
    summary += `${memberName} has a unique passion for ${catName?.toLowerCase()} — we'll include some solo-friendly options.`;
  }

  return summary;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RADAR CHART (SVG)
   ═══════════════════════════════════════════════════════════════════════════ */
function RadarChart({ profiles, memberColors, size = 260, showGroup = false, groupScores }) {
  const cx = size / 2, cy = size / 2;
  const radius = size / 2 - 40;
  const n = CATEGORIES.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (catIdx, value) => {
    const angle = catIdx * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const gridLevels = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} style={{ overflow:"visible" }}>
      {/* Grid lines */}
      {gridLevels.map(level => (
        <polygon key={level}
          points={CATEGORIES.map((_, i) => getPoint(i, level).join(",")).join(" ")}
          fill="none" stroke={T.borderLight} strokeWidth={level === 50 ? 1.5 : 0.8}
          strokeDasharray={level === 50 ? "none" : "3,3"} />
      ))}

      {/* Axis lines */}
      {CATEGORIES.map((_, i) => {
        const [x, y] = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={T.borderLight} strokeWidth={0.8} />;
      })}

      {/* Group area (if showing group average) */}
      {showGroup && groupScores && (
        <polygon
          points={CATEGORIES.map((cat, i) => getPoint(i, groupScores[cat.id]?.avg || 0).join(",")).join(" ")}
          fill={`${T.primary}15`} stroke={T.primary} strokeWidth={2.5}
          style={{ animation:"radarDraw .8s ease-out" }} />
      )}

      {/* Member polygons */}
      {Object.entries(profiles).map(([memberId, profile], mi) => {
        const color = memberColors[memberId] || T.primary;
        return (
          <polygon key={memberId}
            points={CATEGORIES.map((cat, i) => getPoint(i, profile[cat.id] || 0).join(",")).join(" ")}
            fill={`${color}12`} stroke={color} strokeWidth={1.8}
            strokeDasharray={showGroup ? "5,3" : "none"}
            opacity={showGroup ? 0.5 : 0.8}
            style={{ animation:`radarDraw .6s ease-out ${mi * 0.1}s both` }} />
        );
      })}

      {/* Dots on member points */}
      {!showGroup && Object.entries(profiles).map(([memberId, profile]) => {
        const color = memberColors[memberId] || T.primary;
        return CATEGORIES.map((cat, i) => {
          const [x, y] = getPoint(i, profile[cat.id] || 0);
          return <circle key={`${memberId}-${i}`} cx={x} cy={y} r={3} fill={color} />;
        });
      })}

      {/* Category labels */}
      {CATEGORIES.map((cat, i) => {
        const [x, y] = getPoint(i, 115);
        return (
          <text key={cat.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize:11, fontWeight:600, fill:T.text2, fontFamily:"'DM Sans',sans-serif" }}>
            {cat.emoji}
          </text>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const PHASES = ["intro", "quiz", "processing", "profiles", "group", "complete"];

const MEMBER_COLORS = {
  james: T.primary,
  sarah: T.secondary,
  alex: T.accent,
  priya: "#8B5CF6",
};

export default function InterestProfiler() {
  const [phase, setPhase] = useState("intro");
  const [activeMember, setActiveMember] = useState(0);
  const [activeCat, setActiveCat] = useState(0);
  const [allAnswers, setAllAnswers] = useState({});
  const [processingStep, setProcessingStep] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [expandedMember, setExpandedMember] = useState(null);
  const [decision, setDecision] = useState(null);
  const [dbRecords, setDbRecords] = useState(null);

  const member = MEMBERS[activeMember];
  const category = CATEGORIES[activeCat];
  const questions = QUIZ_QUESTIONS[category?.id] || [];
  const memberAnswers = allAnswers[member?.id] || {};
  const catAnswers = memberAnswers[category?.id] || {};
  const allQuestionsAnswered = questions.every(q => catAnswers[q.id] !== undefined);
  const allCatsDone = CATEGORIES.every(cat => {
    const qs = QUIZ_QUESTIONS[cat.id] || [];
    return qs.every(q => memberAnswers[cat.id]?.[q.id] !== undefined);
  });
  const allMembersDone = MEMBERS.every(m => {
    const ans = allAnswers[m.id] || {};
    return CATEGORIES.every(cat => {
      const qs = QUIZ_QUESTIONS[cat.id] || [];
      return qs.every(q => ans[cat.id]?.[q.id] !== undefined);
    });
  });

  const setAnswer = (questionId, value) => {
    setAllAnswers(prev => ({
      ...prev,
      [member.id]: {
        ...(prev[member.id] || {}),
        [category.id]: {
          ...(prev[member.id]?.[category.id] || {}),
          [questionId]: value,
        }
      }
    }));
  };

  const nextCategory = () => {
    if (activeCat < CATEGORIES.length - 1) setActiveCat(activeCat + 1);
  };
  const prevCategory = () => {
    if (activeCat > 0) setActiveCat(activeCat - 1);
  };

  const finishMember = () => {
    if (activeMember < MEMBERS.length - 1) {
      setActiveMember(activeMember + 1);
      setActiveCat(0);
    }
  };

  const startProcessing = () => {
    setPhase("processing");
    setProcessingStep(0);
    const delays = [600, 1400, 2200, 3000, 3800, 4400];
    delays.forEach((d, i) => setTimeout(() => setProcessingStep(i), d));
    setTimeout(() => {
      const result = calcGroupOverlap(allAnswers);
      setAnalysis(result);
      setPhase("profiles");
    }, 5000);
  };

  const storeResults = () => {
    if (!analysis) return;
    const records = {
      member_profiles: MEMBERS.map(m => ({
        member_id: m.id,
        name: m.name,
        profile: analysis.profiles[m.id],
        raw_answers: allAnswers[m.id],
      })),
      group_analysis: {
        compatibility_score: analysis.compatibility,
        category_scores: analysis.groupScores,
        strong_overlaps: analysis.strongOverlaps,
        unique_passions: analysis.uniquePassions,
        conflicts: analysis.conflicts.map(c => ({
          category: c.category,
          enthusiasts: c.high,
          not_interested: c.low,
        })),
        consensus_activities: analysis.activityHits.map(a => ({
          activity: a.activity,
          category: a.category,
          avg_rating: a.avgRating,
        })),
        algorithm: "category_score = avg(ratings) / max_possible * 100; compatibility = avg_consensus + overlap_bonus - conflict_penalty",
      },
      trip_plans_update: {
        group_interests: analysis.strongOverlaps,
        priority_activities: analysis.activityHits.slice(0, 8).map(a => a.activity),
        updated_at: new Date().toISOString(),
      },
    };
    setDbRecords(records);
    setPhase("complete");
  };

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <CSS/>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header style={{ background:`linear-gradient(140deg,${T.primaryDark},${T.primary} 50%,${T.primaryLight})`,
        padding:"20px 24px 18px", color:"#fff", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,
          background:"radial-gradient(circle at 80% 25%,rgba(139,92,246,.1),transparent 55%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:720,margin:"0 auto",position:"relative" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:42,height:42,borderRadius:13,background:"rgba(255,255,255,.12)",
              display:"flex",alignItems:"center",justifyContent:"center",animation:"glow 3s infinite" }}>
              <span style={{ fontSize:22 }}>🎯</span>
            </div>
            <div>
              <h1 className="hd" style={{ fontWeight:700,fontSize:20 }}>Interest Profiler Agent</h1>
              <p style={{ fontSize:13,opacity:.65 }}>Building individual & group travel preference profiles</p>
            </div>
          </div>
          <div style={{ display:"flex",gap:3,marginTop:14 }}>
            {PHASES.map((p, i) => (
              <div key={p} style={{ flex:1,height:3,borderRadius:999,
                background:PHASES.indexOf(phase) >= i ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.12)",
                transition:"background .4s" }}/>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:720,margin:"0 auto",padding:"22px 20px 80px" }}>

        {/* ═══════════════════════════════════════════════════════════
           PHASE: INTRO
           ═══════════════════════════════════════════════════════════ */}
        {phase === "intro" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <AgentChat emoji="🎯" name="Interest Profiler"
              msg="Let's discover what your group loves! Each member will rate 24 travel activities across 8 categories. I'll then find your perfect overlap and flag any conflicts." />

            <div style={{ background:T.surface,borderRadius:16,padding:22,marginTop:18,
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <p className="hd" style={{ fontWeight:700,fontSize:16,marginBottom:14 }}>8 Categories · 24 Activities · 5-Point Scale</p>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8 }}>
                {CATEGORIES.map((cat, i) => (
                  <div key={cat.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                    borderRadius:10,background:`${cat.color}08`,border:`1px solid ${cat.color}15`,
                    animation:`fadeUp .3s ease-out ${i * .04}s both` }}>
                    <span style={{ fontSize:18 }}>{cat.emoji}</span>
                    <div>
                      <p className="hd" style={{ fontWeight:600,fontSize:13 }}>{cat.label}</p>
                      <p style={{ fontSize:11,color:T.text3 }}>3 activities</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:"flex",gap:10,marginTop:16 }}>
              <button onClick={() => setPhase("quiz")} className="hd"
                style={{ flex:1,padding:"14px",borderRadius:14,border:"none",background:T.primary,
                  color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",minHeight:50,
                  boxShadow:`0 4px 16px ${T.primary}30`,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                <Ic n="zap" s={18} c="#fff"/> Start Profiling
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: QUIZ
           ═══════════════════════════════════════════════════════════ */}
        {phase === "quiz" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            {/* Member tabs */}
            <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto" }}>
              {MEMBERS.map((m, i) => {
                const done = allAnswers[m.id] && CATEGORIES.every(cat =>
                  (QUIZ_QUESTIONS[cat.id] || []).every(q => allAnswers[m.id]?.[cat.id]?.[q.id] !== undefined)
                );
                const active = i === activeMember;
                return (
                  <button key={m.id} onClick={() => { setActiveMember(i); setActiveCat(0); }} className="hd"
                    style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:12,
                      border:`2px solid ${active ? T.primary : done ? T.success + "50" : T.borderLight}`,
                      background:active ? `${T.primary}08` : T.surface,cursor:"pointer",
                      minHeight:42,transition:"all .2s",flexShrink:0 }}>
                    <div style={{ width:26,height:26,borderRadius:999,
                      background:`linear-gradient(135deg,${MEMBER_COLORS[m.id]},${T.primaryDark})`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:"#fff",fontSize:9,fontWeight:700 }}>{m.initials}</div>
                    <span style={{ fontSize:13,fontWeight:active?700:500,color:active?T.primary:T.text2 }}>
                      {m.name.split(" ")[0]}
                    </span>
                    {done && <Ic n="check" s={14} c={T.success}/>}
                  </button>
                );
              })}
            </div>

            {/* Category tabs */}
            <div style={{ display:"flex",gap:4,marginBottom:16,overflowX:"auto",padding:"2px 0" }}>
              {CATEGORIES.map((cat, i) => {
                const isActive = i === activeCat;
                const isDone = (QUIZ_QUESTIONS[cat.id] || []).every(q => memberAnswers[cat.id]?.[q.id] !== undefined);
                return (
                  <button key={cat.id} onClick={() => setActiveCat(i)} className="hd"
                    style={{ padding:"6px 12px",borderRadius:10,border:"none",
                      background:isActive ? cat.color : isDone ? `${T.success}10` : T.borderLight,
                      color:isActive ? "#fff" : isDone ? T.success : T.text3,
                      fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4,
                      whiteSpace:"nowrap",minHeight:34,transition:"all .2s",flexShrink:0 }}>
                    {cat.emoji} {cat.label.split(" ")[0]}
                    {isDone && !isActive && <Ic n="check" s={11} c={T.success}/>}
                  </button>
                );
              })}
            </div>

            {/* Category header */}
            <div style={{ background:`linear-gradient(135deg,${category.color}12,${category.color}05)`,
              borderRadius:14,padding:"14px 18px",marginBottom:14,border:`1px solid ${category.color}18`,
              display:"flex",alignItems:"center",gap:12,animation:"scaleIn .3s ease-out" }}>
              <span style={{ fontSize:28 }}>{category.emoji}</span>
              <div>
                <h3 className="hd" style={{ fontWeight:700,fontSize:17,color:T.text }}>{category.label}</h3>
                <p style={{ fontSize:13,color:T.text2 }}>{category.desc}</p>
              </div>
              <div style={{ marginLeft:"auto",fontSize:13,color:T.text3 }} className="hd">
                {Object.keys(catAnswers).length}/{questions.length}
              </div>
            </div>

            {/* Questions */}
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {questions.map((q, qi) => {
                const currentVal = catAnswers[q.id];
                return (
                  <div key={q.id} style={{ background:T.surface,borderRadius:14,padding:"16px 18px",
                    border:`1px solid ${currentVal !== undefined ? category.color + "30" : T.borderLight}`,
                    boxShadow:sh.sm,animation:`slideL .35s ease-out ${qi * .06}s both`,
                    transition:"border .3s" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                      <span style={{ fontSize:22 }}>{q.emoji}</span>
                      <div>
                        <h4 className="hd" style={{ fontWeight:700,fontSize:15 }}>{q.label}</h4>
                        <p style={{ fontSize:12,color:T.text3 }}>{q.scenarios.join(" · ")}</p>
                      </div>
                    </div>

                    {/* Intensity picker */}
                    <div style={{ display:"flex",gap:6 }}>
                      {INTENSITY.map(int => {
                        const picked = currentVal === int.value;
                        return (
                          <button key={int.value} onClick={() => setAnswer(q.id, int.value)}
                            style={{ flex:1,padding:"8px 4px",borderRadius:10,border:`2px solid ${picked ? category.color : T.borderLight}`,
                              background:picked ? `${category.color}12` : T.surface,cursor:"pointer",
                              transition:"all .15s",minHeight:52,display:"flex",flexDirection:"column",
                              alignItems:"center",gap:2,
                              animation:picked ? "optionPick .2s ease" : "none" }}
                            onMouseEnter={e => { if (!picked) e.currentTarget.style.borderColor = category.color + "50"; }}
                            onMouseLeave={e => { if (!picked) e.currentTarget.style.borderColor = T.borderLight; }}>
                            <span style={{ fontSize:18 }}>{int.emoji}</span>
                            <span style={{ fontSize:10,fontWeight:600,color:picked ? category.color : T.text3,
                              textAlign:"center",lineHeight:1.2 }}>{int.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div style={{ display:"flex",gap:10,marginTop:18 }}>
              {activeCat > 0 && (
                <button onClick={prevCategory} className="hd"
                  style={{ padding:"12px 20px",borderRadius:12,border:`1.5px solid ${T.border}`,
                    background:T.surface,color:T.text2,fontSize:14,fontWeight:600,cursor:"pointer",
                    minHeight:46,display:"flex",alignItems:"center",gap:6 }}>
                  <Ic n="chevL" s={16} c={T.text3}/> Back
                </button>
              )}
              <div style={{ flex:1 }}/>
              {allQuestionsAnswered && activeCat < CATEGORIES.length - 1 && (
                <button onClick={nextCategory} className="hd"
                  style={{ padding:"12px 24px",borderRadius:12,border:"none",background:category.color,
                    color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,
                    display:"flex",alignItems:"center",gap:6,boxShadow:`0 2px 10px ${category.color}30` }}>
                  Next Category <Ic n="chevR" s={16} c="#fff"/>
                </button>
              )}
              {allCatsDone && activeMember < MEMBERS.length - 1 && (
                <button onClick={finishMember} className="hd"
                  style={{ padding:"12px 24px",borderRadius:12,border:"none",background:T.success,
                    color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,
                    display:"flex",alignItems:"center",gap:6,boxShadow:`0 2px 10px ${T.success}30` }}>
                  ✓ Done — Next Member <Ic n="chevR" s={16} c="#fff"/>
                </button>
              )}
              {allMembersDone && (
                <button onClick={startProcessing} className="hd"
                  style={{ padding:"12px 24px",borderRadius:12,border:"none",background:T.primary,
                    color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48,
                    display:"flex",alignItems:"center",gap:8,boxShadow:`0 4px 16px ${T.primary}30`,
                    animation:"ringPulse 2s infinite" }}>
                  <Ic n="sparkle" s={18} c="#fff"/> Analyze Group →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: PROCESSING
           ═══════════════════════════════════════════════════════════ */}
        {phase === "processing" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <div style={{ background:T.surface,borderRadius:18,padding:28,border:`1px solid ${T.borderLight}`,
              boxShadow:sh.md,textAlign:"center" }}>
              <div style={{ width:64,height:64,borderRadius:20,margin:"0 auto 20px",
                background:`linear-gradient(135deg,${T.primary}15,rgba(139,92,246,.1))`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,
                animation:"glow 2s infinite" }}>🧬</div>
              <h2 className="hd" style={{ fontWeight:700,fontSize:22,marginBottom:8 }}>Building Group Profile</h2>
              <p style={{ color:T.text2,fontSize:14,marginBottom:24 }}>
                Analyzing {MEMBERS.length} members × {CATEGORIES.length} categories × 3 activities each...
              </p>
              <div style={{ display:"flex",flexDirection:"column",gap:12,textAlign:"left",maxWidth:420,margin:"0 auto" }}>
                {[
                  "Calculating individual category scores...",
                  "Building per-member radar profiles...",
                  "Computing group overlaps & consensus...",
                  "Detecting conflicts & unique passions...",
                  "Ranking consensus activities...",
                  "Generating compatibility score ✨",
                ].map((step, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:12,
                    opacity:processingStep >= i ? 1 : 0.2,transition:"opacity .4s" }}>
                    <div style={{ width:24,height:24,borderRadius:999,flexShrink:0,
                      background:processingStep > i ? T.success : processingStep === i ? T.primary : T.borderLight,
                      display:"flex",alignItems:"center",justifyContent:"center",transition:"all .3s" }}>
                      {processingStep > i ? <Ic n="check" s={12} c="#fff"/> :
                        processingStep === i ? <div style={{ width:7,height:7,borderRadius:999,background:"#fff",animation:"dotPulse 1s infinite" }}/> :
                        <div style={{ width:5,height:5,borderRadius:999,background:T.text3 }}/>}
                    </div>
                    <span style={{ fontSize:14,fontWeight:processingStep===i?600:400,color:processingStep>=i?T.text:T.text3 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: INDIVIDUAL PROFILES
           ═══════════════════════════════════════════════════════════ */}
        {phase === "profiles" && analysis && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <AgentChat emoji="🎯" name="Interest Profiler"
              msg={`All 4 profiles built! Here's what each member loves. Tap a profile to see their full breakdown, then continue to see the group match.`} />

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:18 }}>
              {MEMBERS.map((m, mi) => {
                const profile = analysis.profiles[m.id];
                const isExpanded = expandedMember === m.id;
                const topCats = CATEGORIES
                  .map(c => ({ ...c, score: profile[c.id] }))
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3);

                return (
                  <div key={m.id} style={{ background:T.surface,borderRadius:16,overflow:"hidden",
                    border:`1px solid ${isExpanded ? MEMBER_COLORS[m.id] + "40" : T.borderLight}`,
                    boxShadow:isExpanded ? sh.md : sh.sm,cursor:"pointer",transition:"all .25s",
                    animation:`scaleIn .4s ease-out ${mi * .08}s both`,
                    gridColumn:isExpanded ? "1/-1" : "auto" }}
                    onClick={() => setExpandedMember(isExpanded ? null : m.id)}>
                    <div style={{ padding:"16px 18px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                        <div style={{ width:36,height:36,borderRadius:10,
                          background:`linear-gradient(135deg,${MEMBER_COLORS[m.id]},${T.primaryDark})`,
                          display:"flex",alignItems:"center",justifyContent:"center",
                          color:"#fff",fontSize:13,fontWeight:700 }} className="hd">{m.initials}</div>
                        <div>
                          <p className="hd" style={{ fontWeight:700,fontSize:16 }}>{m.name}</p>
                          <p style={{ fontSize:12,color:T.text3 }}>Top: {topCats.map(c => c.emoji).join(" ")}</p>
                        </div>
                      </div>

                      {/* Mini bars */}
                      <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                        {CATEGORIES.map(cat => (
                          <div key={cat.id} style={{ display:"flex",alignItems:"center",gap:8 }}>
                            <span style={{ fontSize:13,width:20,textAlign:"center" }}>{cat.emoji}</span>
                            <div style={{ flex:1,height:6,background:T.borderLight,borderRadius:999 }}>
                              <div style={{ height:"100%",width:`${profile[cat.id]}%`,
                                background:profile[cat.id]>=70?cat.color:profile[cat.id]>=40?T.warning:T.borderLight,
                                borderRadius:999,transition:"width .6s",animation:"barGrow .5s ease-out" }}/>
                            </div>
                            <span className="hd" style={{ fontSize:12,fontWeight:600,color:T.text3,width:28,textAlign:"right" }}>
                              {profile[cat.id]}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Expanded: radar + detail */}
                      {isExpanded && (
                        <div style={{ marginTop:16,animation:"fadeIn .3s ease-out" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:"flex",gap:20,alignItems:"center",flexWrap:"wrap" }}>
                            <RadarChart profiles={{ [m.id]: profile }} memberColors={MEMBER_COLORS} size={200}/>
                            <div style={{ flex:1,minWidth:180 }}>
                              <p className="hd" style={{ fontWeight:700,fontSize:14,marginBottom:10,color:T.text2 }}>Top Interests</p>
                              {topCats.map(cat => (
                                <div key={cat.id} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                                  <span style={{ fontSize:16 }}>{cat.emoji}</span>
                                  <span style={{ fontSize:13,fontWeight:500 }}>{cat.label}</span>
                                  <span className="hd" style={{ marginLeft:"auto",fontWeight:700,fontSize:14,
                                    color:cat.score>=70?cat.color:T.warning }}>{cat.score}%</span>
                                </div>
                              ))}
                              <div style={{ marginTop:12,padding:"8px 12px",borderRadius:8,
                                background:`${MEMBER_COLORS[m.id]}08`,border:`1px solid ${MEMBER_COLORS[m.id]}15` }}>
                                <p style={{ fontSize:12.5,color:T.text2,lineHeight:1.5 }}>
                                  {m.name.split(" ")[0]} is passionate about {topCats[0]?.label.toLowerCase()}
                                  {topCats[1] ? ` and ${topCats[1].label.toLowerCase()}` : ""}, with moderate interest in
                                  {" "}{CATEGORIES.filter(c => profile[c.id] >= 40 && profile[c.id] < 70).slice(0,2).map(c => c.label.toLowerCase()).join(" and ") || "other areas"}.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setPhase("group")} className="hd"
              style={{ width:"100%",marginTop:20,padding:"14px",borderRadius:14,border:"none",
                background:T.primary,color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                minHeight:50,boxShadow:`0 4px 16px ${T.primary}30`,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                animation:"scaleIn .3s ease-out .3s both" }}>
              <Ic n="users" s={18} c="#fff"/> View Group Compatibility →
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: GROUP ANALYSIS
           ═══════════════════════════════════════════════════════════ */}
        {phase === "group" && analysis && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>

            {/* Compatibility score */}
            <div style={{ background:`linear-gradient(135deg,${T.primary}10,${T.accent}08)`,
              borderRadius:18,padding:"22px 24px",marginBottom:20,border:`1px solid ${T.primary}20`,
              display:"flex",alignItems:"center",gap:18,animation:"scaleIn .4s ease-out" }}>
              <div style={{ width:68,height:68,borderRadius:20,
                background:`linear-gradient(135deg,${T.primary},${T.accent})`,
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                color:"#fff",flexShrink:0 }}>
                <span className="hd" style={{ fontWeight:700,fontSize:24,lineHeight:1 }}>{analysis.compatibility}</span>
                <span style={{ fontSize:10,opacity:.7 }}>/ 100</span>
              </div>
              <div>
                <h3 className="hd" style={{ fontWeight:700,fontSize:18 }}>
                  Group Compatibility: {analysis.compatibility >= 75 ? "Excellent!" : analysis.compatibility >= 55 ? "Good" : "Needs Balancing"}
                </h3>
                <p style={{ fontSize:13.5,color:T.text2,lineHeight:1.6,marginTop:4 }}>
                  {generateGroupSummary(analysis)}
                </p>
              </div>
            </div>

            {/* Radar comparison */}
            <div style={{ background:T.surface,borderRadius:16,padding:22,border:`1px solid ${T.borderLight}`,
              boxShadow:sh.sm,marginBottom:18 }}>
              <h3 className="hd" style={{ fontWeight:700,fontSize:16,marginBottom:16 }}>Group Radar Overlay</h3>
              <div style={{ display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",justifyContent:"center" }}>
                <RadarChart profiles={analysis.profiles} memberColors={MEMBER_COLORS} size={280}
                  showGroup groupScores={analysis.groupScores}/>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {MEMBERS.map(m => (
                    <div key={m.id} style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <div style={{ width:10,height:3,borderRadius:2,background:MEMBER_COLORS[m.id] }}/>
                      <span style={{ fontSize:12.5,color:T.text2 }}>{m.name}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:4 }}>
                    <div style={{ width:10,height:3,borderRadius:2,background:T.primary }}/>
                    <span style={{ fontSize:12.5,fontWeight:600,color:T.primary }}>Group average</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Strong overlaps */}
            <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,marginBottom:14,
              animation:`slideL .35s ease-out .1s both` }}>
              <h3 className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12,display:"flex",alignItems:"center",gap:6 }}>
                <Ic n="heart" s={16} c={T.success}/> Strong Group Overlaps
              </h3>
              {analysis.strongOverlaps.length > 0 ? (
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {analysis.strongOverlaps.map(catId => {
                    const cat = CATEGORIES.find(c => c.id === catId);
                    return (
                      <div key={catId} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",
                        borderRadius:10,background:T.successBg,border:`1px solid ${T.success}20` }}>
                        <span style={{ fontSize:16 }}>{cat?.emoji}</span>
                        <span className="hd" style={{ fontWeight:600,fontSize:13,color:T.success }}>{cat?.label}</span>
                        <span style={{ fontSize:12,color:T.text3 }}>{analysis.groupScores[catId]?.avg}% avg</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize:13,color:T.text3 }}>No categories where everyone scored ≥50%. The group has diverse interests!</p>
              )}
            </div>

            {/* Consensus activities */}
            <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,marginBottom:14,
              animation:`slideL .35s ease-out .15s both` }}>
              <h3 className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12,display:"flex",alignItems:"center",gap:6 }}>
                <Ic n="check" s={16} c={T.primary}/> Activities Everyone Loves
              </h3>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {analysis.activityHits.slice(0, 8).map((a, i) => {
                  const cat = CATEGORIES.find(c => c.id === a.category);
                  return (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"6px 0",
                      borderBottom:i < 7 ? `1px solid ${T.borderLight}` : "none" }}>
                      <span style={{ fontSize:16 }}>{a.emoji}</span>
                      <span style={{ fontSize:14,fontWeight:500,flex:1 }}>{a.activity}</span>
                      <span style={{ fontSize:11,color:cat?.color,background:`${cat?.color}12`,
                        padding:"2px 8px",borderRadius:999 }}>{cat?.label.split(" ")[0]}</span>
                      <span className="hd" style={{ fontWeight:700,fontSize:14,color:T.primary }}>{a.avgRating}/4</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conflicts */}
            {analysis.conflicts.length > 0 && (
              <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",
                border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,marginBottom:14,
                animation:`slideL .35s ease-out .2s both` }}>
                <h3 className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12,display:"flex",alignItems:"center",gap:6 }}>
                  <Ic n="zap" s={16} c={T.warning}/> Divergent Interests
                </h3>
                {analysis.conflicts.map((c, i) => {
                  const cat = CATEGORIES.find(ct => ct.id === c.category);
                  return (
                    <div key={i} style={{ padding:"10px 0",borderBottom:i < analysis.conflicts.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                        <span style={{ fontSize:16 }}>{cat?.emoji}</span>
                        <span className="hd" style={{ fontWeight:600,fontSize:14 }}>{cat?.label}</span>
                      </div>
                      <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                        {c.high.map(mid => {
                          const m = MEMBERS.find(x => x.id === mid);
                          return (
                            <span key={mid} style={{ fontSize:12,background:T.successBg,color:T.success,
                              padding:"2px 8px",borderRadius:999,fontWeight:500 }}>
                              {m?.initials} loves it ({analysis.profiles[mid]?.[c.category]}%)
                            </span>
                          );
                        })}
                        {c.low.map(mid => {
                          const m = MEMBERS.find(x => x.id === mid);
                          return (
                            <span key={mid} style={{ fontSize:12,background:T.errorBg,color:T.error,
                              padding:"2px 8px",borderRadius:999,fontWeight:500 }}>
                              {m?.initials} not keen ({analysis.profiles[mid]?.[c.category]}%)
                            </span>
                          );
                        })}
                      </div>
                      <p style={{ fontSize:12,color:T.text3,marginTop:4 }}>
                        → Plan as optional activity for those interested
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unique passions */}
            {analysis.uniquePassions.length > 0 && (
              <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",
                border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,marginBottom:20,
                animation:`slideL .35s ease-out .25s both` }}>
                <h3 className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12,display:"flex",alignItems:"center",gap:6 }}>
                  <Ic n="sparkle" s={16} c="#8B5CF6"/> Unique Passions
                </h3>
                {analysis.uniquePassions.map((p, i) => {
                  const m = MEMBERS.find(x => x.id === p.member);
                  const cat = CATEGORIES.find(c => c.id === p.category);
                  return (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 0" }}>
                      <div style={{ width:22,height:22,borderRadius:999,
                        background:`linear-gradient(135deg,${MEMBER_COLORS[p.member]},${T.primaryDark})`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:"#fff",fontSize:8,fontWeight:700 }} className="hd">{m?.initials}</div>
                      <span style={{ fontSize:13 }}>{m?.name.split(" ")[0]}</span>
                      <span style={{ fontSize:13,color:T.text3 }}>→</span>
                      <span style={{ fontSize:14 }}>{cat?.emoji} {cat?.label}</span>
                      <span className="hd" style={{ marginLeft:"auto",fontWeight:700,fontSize:13,color:"#8B5CF6" }}>{p.score}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* YesNoCard */}
            {!decision && (
              <div style={{ background:T.surface,borderRadius:18,boxShadow:sh.lg,overflow:"hidden",
                border:`1px solid ${T.borderLight}`,animation:"scaleIn .4s ease-out .3s both" }}>
                <div style={{ padding:"22px 24px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                    <span className="hd" style={{ background:`${T.primary}12`,color:T.primary,
                      padding:"2px 12px",borderRadius:999,fontSize:11,fontWeight:700 }}>
                      Interest Profiler
                    </span>
                  </div>
                  <h3 className="hd" style={{ fontWeight:700,fontSize:20,marginBottom:4 }}>
                    Group Profile Complete — {analysis.compatibility}% Compatible
                  </h3>
                  <p style={{ fontSize:14.5,color:T.text2,lineHeight:1.6,marginBottom:16 }}>
                    {analysis.activityHits.length} activities that everyone loves. {analysis.strongOverlaps.length} shared interest categories.
                    {analysis.conflicts.length > 0 ? ` ${analysis.conflicts.length} divergent area${analysis.conflicts.length > 1 ? "s" : ""} flagged for optional activities.` : ""}
                    {" "}Save this profile and use it to guide POI discovery?
                  </p>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:18 }}>
                    {analysis.activityHits.slice(0, 5).map(a => (
                      <span key={a.activity} style={{ background:`${T.accent}12`,color:T.accent,
                        padding:"3px 10px",borderRadius:999,fontSize:12.5,fontWeight:500 }}>
                        {a.emoji} {a.activity}
                      </span>
                    ))}
                  </div>
                  <div style={{ display:"flex",gap:12 }}>
                    <button onClick={() => { setDecision("no"); setPhase("quiz"); setActiveCat(0); }}
                      className="hd" style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        padding:"14px",borderRadius:12,border:`2px solid ${T.error}`,
                        background:"transparent",color:T.error,fontSize:15,fontWeight:600,
                        cursor:"pointer",minHeight:50 }}>
                      <Ic n="x" s={18} c={T.error}/> Re-do Quiz
                    </button>
                    <button onClick={() => { setDecision("yes"); storeResults(); }}
                      className="hd" style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        padding:"14px",borderRadius:12,border:"none",
                        background:T.primary,color:"#fff",fontSize:15,fontWeight:600,
                        cursor:"pointer",minHeight:50,boxShadow:`0 2px 10px ${T.primary}40` }}>
                      <Ic n="check" s={18} c="#fff"/> Approve & Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE: COMPLETE
           ═══════════════════════════════════════════════════════════ */}
        {phase === "complete" && dbRecords && (
          <div style={{ animation:"fadeUp .5s ease-out" }}>
            <div style={{ textAlign:"center",marginBottom:28 }}>
              <div style={{ fontSize:56,marginBottom:12,position:"relative",display:"inline-block" }}>
                🎯
                {["✨","🧬","❤️","🌟","🎊"].map((e,i) => (
                  <span key={i} style={{ position:"absolute",fontSize:16,
                    top:`${-10 + Math.sin(i*1.3)*25}px`,left:`${-15 + Math.cos(i*1.3)*38}px`,
                    animation:`confettiBurst 1.2s ease-out ${.2+i*.1}s both`,pointerEvents:"none" }}>{e}</span>
                ))}
              </div>
              <h2 className="hd" style={{ fontWeight:700,fontSize:24 }}>Group Profile Saved!</h2>
              <p style={{ color:T.text2,fontSize:15,marginTop:6 }}>
                {analysis?.compatibility}% compatibility score. The POI Discovery Agent will use these preferences to curate activities.
              </p>
            </div>

            {/* Database records */}
            <div style={{ background:T.surface,borderRadius:16,overflow:"hidden",border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <div style={{ padding:"14px 18px",background:`${T.primaryDark}08`,borderBottom:`1px solid ${T.borderLight}`,
                display:"flex",alignItems:"center",gap:8 }}>
                <Ic n="db" s={16} c={T.primary}/>
                <span className="hd" style={{ fontWeight:700,fontSize:14,color:T.primary }}>Database Records</span>
              </div>

              <div style={{ padding:18,borderBottom:`1px solid ${T.borderLight}` }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  trip_plans.group_interests (update)
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12,lineHeight:1.6,
                  color:T.text,overflow:"auto",border:`1px solid ${T.borderLight}`,fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.trip_plans_update, null, 2)}
                </pre>
              </div>

              <div style={{ padding:18,borderBottom:`1px solid ${T.borderLight}` }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  group_analysis (1 row)
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12,lineHeight:1.6,
                  color:T.text,overflow:"auto",maxHeight:250,border:`1px solid ${T.borderLight}`,fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.group_analysis, null, 2)}
                </pre>
              </div>

              <div style={{ padding:18 }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  member_profiles ({dbRecords.member_profiles.length} rows)
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12,lineHeight:1.6,
                  color:T.text,overflow:"auto",maxHeight:250,border:`1px solid ${T.borderLight}`,fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.member_profiles, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ textAlign:"center",marginTop:24 }}>
              <button onClick={() => {
                setPhase("intro"); setActiveMember(0); setActiveCat(0);
                setAllAnswers({}); setAnalysis(null); setExpandedMember(null);
                setDecision(null); setDbRecords(null);
              }} style={{ background:"none",border:"none",color:T.text3,fontSize:13,
                cursor:"pointer",textDecoration:"underline" }}>
                ← Restart demo
              </button>
            </div>
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
    <div style={{ display:"flex",gap:10,maxWidth:520,animation:"fadeUp .35s ease-out" }}>
      <div style={{ width:32,height:32,borderRadius:999,flexShrink:0,
        background:`linear-gradient(135deg,${T.primary},rgba(139,92,246,.8))`,
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
