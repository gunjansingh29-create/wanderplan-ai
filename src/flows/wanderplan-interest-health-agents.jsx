import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(13,115,119,.12)}50%{box-shadow:0 0 22px rgba(13,115,119,.25)}}
  @keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
  @keyframes barGrow{from{width:0}}
  @keyframes confetti{0%{transform:translateY(0) rotate(0) scale(1);opacity:1}100%{transform:translateY(-100px) rotate(720deg) scale(0);opacity:0}}
  @keyframes ringPulse{0%{box-shadow:0 0 0 0 rgba(13,115,119,.25)}100%{box-shadow:0 0 0 14px rgba(13,115,119,0)}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
  @keyframes thumbPop{0%{transform:scale(1)}30%{transform:scale(1.3) rotate(-8deg)}60%{transform:scale(1.1) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
  @keyframes slideDown{from{opacity:0;max-height:0}to{opacity:1;max-height:600px}}
  @keyframes checkDraw{from{stroke-dashoffset:20}to{stroke-dashoffset:0}}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */
const Ic=({n,s=18,c="currentColor"})=>{const p={
  check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
  x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
  chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  heart:<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeWidth="1.8" stroke={c} fill="none"/>,
  users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeWidth="1.8" stroke={c} fill="none"/></>,
  sparkle:<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
  zap:<path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" strokeWidth="1.8" stroke={c} fill="none" strokeLinejoin="round"/>,
  shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.8" stroke={c} fill="none"/>,
  alert:<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 9v4M12 17h.01" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/></>,
  clipboard:<><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" strokeWidth="1.8" stroke={c} fill="none"/><rect x="8" y="2" width="8" height="4" rx="1" strokeWidth="1.8" stroke={c} fill="none"/></>,
  thumbUp:<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" strokeWidth="1.8" stroke={c} fill="none"/>,
  thumbDn:<path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" strokeWidth="1.8" stroke={c} fill="none"/>,
  swap:<><path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  db:<><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" strokeWidth="1.8" stroke={c} fill="none"/></>,
  file:<><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" strokeWidth="1.8" stroke={c} fill="none"/><path d="M13 2v7h7" strokeWidth="1.8" stroke={c} fill="none"/></>,
};return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{p[n]||p.heart}</svg>};

/* ═══════════════════════════════════════════════════════════════════════════
   TRIP MEMBERS
   ═══════════════════════════════════════════════════════════════════════════ */
const MEMBERS = [
  { id:"james", name:"James Wilson",  initials:"JW", destinations:["Bali","Kyoto"] },
  { id:"sarah", name:"Sarah Wilson",  initials:"SW", destinations:["Bali","Kyoto"] },
  { id:"alex",  name:"Alex Chen",     initials:"AC", destinations:["Bali","Kyoto"] },
  { id:"priya", name:"Priya Sharma",  initials:"PS", destinations:["Bali","Kyoto"] },
];
const MC = { james:T.primary, sarah:T.secondary, alex:T.accent, priya:"#8B5CF6" };

/* ═══════════════════════════════════════════════════════════════════════════
   HOBBY CATEGORIES & ACTIVITIES
   ═══════════════════════════════════════════════════════════════════════════ */
const HOBBY_CATS = [
  { id:"water",     label:"Water Sports",  emoji:"🏄", color:"#0EA5E9",
    activities:["Surfing","Snorkeling","Scuba diving","Kayaking"] },
  { id:"adventure", label:"Adventure",     emoji:"🧗", color:"#22C55E",
    activities:["Hiking","Rock climbing","Bungee jumping","Paragliding"] },
  { id:"culture",   label:"Culture",       emoji:"🏛️", color:"#8B5CF6",
    activities:["Museums","Temples & shrines","Historical sites","Local craft workshops"] },
  { id:"food",      label:"Food",          emoji:"🍜", color:T.secondary,
    activities:["Street food tours","Cooking classes","Fine dining","Wine & beer tasting"] },
  { id:"nature",    label:"Nature",        emoji:"🌿", color:"#10B981",
    activities:["Wildlife safari","Birdwatching","Botanical gardens","National parks"] },
  { id:"relaxation",label:"Relaxation",    emoji:"🧘", color:"#6366F1",
    activities:["Spa treatments","Beach lounging","Yoga retreats"] },
  { id:"nightlife", label:"Nightlife",     emoji:"🌙", color:"#EC4899",
    activities:["Bars & cocktails","Clubs & DJs","Live music","Pub crawls"] },
];

/* Simulated member responses */
const SIM_ANSWERS = {
  james:  {Surfing:1,Snorkeling:0.5,["Scuba diving"]:1,Kayaking:0.5,Hiking:1,["Rock climbing"]:0.5,["Bungee jumping"]:0,Paragliding:0.5,Museums:0.5,["Temples & shrines"]:1,["Historical sites"]:0.5,["Local craft workshops"]:0,["Street food tours"]:1,["Cooking classes"]:0,["Fine dining"]:0.5,["Wine & beer tasting"]:1,["Wildlife safari"]:1,Birdwatching:0,["Botanical gardens"]:0,["National parks"]:1,["Spa treatments"]:0,["Beach lounging"]:0.5,["Yoga retreats"]:0,["Bars & cocktails"]:1,["Clubs & DJs"]:0.5,["Live music"]:1,["Pub crawls"]:0.5},
  sarah:  {Surfing:0,Snorkeling:1,["Scuba diving"]:0,Kayaking:0.5,Hiking:0.5,["Rock climbing"]:0,["Bungee jumping"]:0,Paragliding:0,Museums:1,["Temples & shrines"]:1,["Historical sites"]:1,["Local craft workshops"]:1,["Street food tours"]:1,["Cooking classes"]:1,["Fine dining"]:1,["Wine & beer tasting"]:0.5,["Wildlife safari"]:0.5,Birdwatching:0,["Botanical gardens"]:0.5,["National parks"]:0.5,["Spa treatments"]:1,["Beach lounging"]:1,["Yoga retreats"]:0.5,["Bars & cocktails"]:0.5,["Clubs & DJs"]:0,["Live music"]:0.5,["Pub crawls"]:0},
  alex:   {Surfing:1,Snorkeling:0.5,["Scuba diving"]:1,Kayaking:1,Hiking:1,["Rock climbing"]:1,["Bungee jumping"]:1,Paragliding:1,Museums:0,["Temples & shrines"]:0.5,["Historical sites"]:0,["Local craft workshops"]:0,["Street food tours"]:0.5,["Cooking classes"]:0,["Fine dining"]:0,["Wine & beer tasting"]:0.5,["Wildlife safari"]:1,Birdwatching:0.5,["Botanical gardens"]:0,["National parks"]:1,["Spa treatments"]:0,["Beach lounging"]:0.5,["Yoga retreats"]:0,["Bars & cocktails"]:1,["Clubs & DJs"]:1,["Live music"]:1,["Pub crawls"]:1},
  priya:  {Surfing:0,Snorkeling:0.5,["Scuba diving"]:0,Kayaking:0,Hiking:0.5,["Rock climbing"]:0,["Bungee jumping"]:0,Paragliding:0,Museums:1,["Temples & shrines"]:1,["Historical sites"]:0.5,["Local craft workshops"]:1,["Street food tours"]:1,["Cooking classes"]:1,["Fine dining"]:1,["Wine & beer tasting"]:1,["Wildlife safari"]:0.5,Birdwatching:0,["Botanical gardens"]:1,["National parks"]:0.5,["Spa treatments"]:1,["Beach lounging"]:1,["Yoga retreats"]:1,["Bars & cocktails"]:0.5,["Clubs & DJs"]:0,["Live music"]:0.5,["Pub crawls"]:0},
};

/* ═══════════════════════════════════════════════════════════════════════════
   HEALTH & FITNESS REQUIREMENTS DATABASE
   ═══════════════════════════════════════════════════════════════════════════ */
const REQUIREMENTS_DB = {
  "Scuba diving": {
    severity:"high", icon:"🤿",
    requirements:[
      { id:"padi", label:"PADI Open Water certification (or equivalent)", type:"certification" },
      { id:"medical", label:"Medical clearance (no ear/sinus/heart conditions)", type:"medical" },
      { id:"swim", label:"Comfortable swimming in open water", type:"fitness" },
    ],
    alternatives:[
      { name:"Snorkeling", desc:"See the same reefs from the surface — no cert needed", emoji:"🤿" },
      { name:"Glass-bottom boat tour", desc:"View marine life without getting wet", emoji:"🚤" },
    ],
    certResource:"PADI.com — 3-day Open Water course available in Bali ($350–$450)",
    destinations:["Bali"],
  },
  "Bungee jumping": {
    severity:"high", icon:"🪂",
    requirements:[
      { id:"weight", label:"Weight within 35–120 kg range", type:"physical" },
      { id:"heart", label:"No heart conditions, high blood pressure, or epilepsy", type:"medical" },
      { id:"age", label:"Minimum age 16 (with parental consent) or 18+", type:"legal" },
      { id:"back", label:"No recent back, neck, or spinal injuries", type:"medical" },
    ],
    alternatives:[
      { name:"Giant Swing", desc:"Similar thrill, lower G-force — wider eligibility", emoji:"🎢" },
      { name:"Zip-lining", desc:"Fly through canopy with minimal restrictions", emoji:"🌴" },
    ],
    destinations:["Bali"],
  },
  "Paragliding": {
    severity:"medium", icon:"🪂",
    requirements:[
      { id:"weight_pg", label:"Weight within 30–110 kg for tandem flights", type:"physical" },
      { id:"heart_pg", label:"No severe heart or respiratory conditions", type:"medical" },
      { id:"mobility", label:"Able to run 5–10 steps for takeoff", type:"fitness" },
    ],
    alternatives:[
      { name:"Scenic helicopter tour", desc:"Aerial views without the physical demands", emoji:"🚁" },
    ],
    destinations:["Bali"],
  },
  "Rock climbing": {
    severity:"medium", icon:"🧗",
    requirements:[
      { id:"fitness_rc", label:"Moderate upper-body strength and grip fitness", type:"fitness" },
      { id:"vertigo", label:"Comfortable with heights (no severe vertigo)", type:"medical" },
      { id:"shoes", label:"Proper climbing shoes (available at gyms)", type:"equipment" },
    ],
    alternatives:[
      { name:"Bouldering", desc:"Low-height climbing with crash pads — easier entry", emoji:"🪨" },
      { name:"Via Ferrata", desc:"Protected climbing route with steel cables", emoji:"⛰️" },
    ],
    destinations:["Bali","Kyoto"],
  },
  "Hiking": {
    severity:"low", icon:"🥾",
    requirements:[
      { id:"fitness_hk", label:"Basic cardiovascular fitness (can walk 2+ hours)", type:"fitness" },
      { id:"altitude", label:"For Kintamani/volcano treks: acclimatization awareness (2000m+)", type:"medical" },
      { id:"gear_hk", label:"Proper hiking shoes and sun protection", type:"equipment" },
    ],
    alternatives:[
      { name:"Guided nature walks", desc:"Flat, easy terrain with expert guide", emoji:"🌺" },
    ],
    destinations:["Bali","Kyoto"],
  },
  "Surfing": {
    severity:"low", icon:"🏄",
    requirements:[
      { id:"swim_surf", label:"Confident swimmer in ocean conditions", type:"fitness" },
      { id:"fitness_surf", label:"Good balance and moderate fitness", type:"fitness" },
    ],
    alternatives:[
      { name:"Bodyboarding", desc:"Easier to learn, similar ocean fun", emoji:"🏊" },
      { name:"Stand-up paddleboarding", desc:"Calmer waters, great for beginners", emoji:"🛶" },
    ],
    destinations:["Bali"],
  },
  "Yoga retreats": {
    severity:"low", icon:"🧘",
    requirements:[
      { id:"flex", label:"No requirement — all levels welcome (notify instructors of injuries)", type:"fitness" },
    ],
    alternatives:[],
    destinations:["Bali"],
  },
};

/* Destination-specific vaccinations & health advisories */
const DEST_HEALTH = {
  Bali: {
    required:[],
    recommended:[
      { name:"Hepatitis A & B", type:"vaccination", urgency:"high", leadTime:"2 weeks before travel" },
      { name:"Typhoid", type:"vaccination", urgency:"high", leadTime:"2 weeks before" },
      { name:"Japanese Encephalitis", type:"vaccination", urgency:"medium", leadTime:"4 weeks before (if rural areas)" },
      { name:"Rabies", type:"vaccination", urgency:"medium", leadTime:"4 weeks before (if animal contact likely)" },
      { name:"Antimalarials", type:"medication", urgency:"low", leadTime:"Consult GP — low risk in tourist areas" },
    ],
    advisories:["Drink only bottled water","Use reef-safe sunscreen","Bring insect repellent (DEET 30%+)"],
  },
  Kyoto: {
    required:[],
    recommended:[
      { name:"Japanese Encephalitis", type:"vaccination", urgency:"low", leadTime:"4 weeks before (rural stays only)" },
      { name:"Influenza", type:"vaccination", urgency:"low", leadTime:"Seasonal — if traveling Oct-Mar" },
    ],
    advisories:["Japan has excellent healthcare","Carry basic medications (pharmacies may not stock Western brands)","Travel insurance strongly recommended"],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SCORING ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

function buildHobbyVector(answers) {
  const vector = {};
  HOBBY_CATS.forEach(cat => {
    cat.activities.forEach(act => {
      vector[act] = answers[act] ?? 0;
    });
  });
  return vector;
}

function calcGroupVector(allAnswers) {
  const memberIds = Object.keys(allAnswers);
  if (memberIds.length === 0) return {};
  const group = {};
  HOBBY_CATS.forEach(cat => {
    cat.activities.forEach(act => {
      const sum = memberIds.reduce((s, id) => s + (allAnswers[id][act] ?? 0), 0);
      group[act] = Math.round((sum / memberIds.length) * 100) / 100;
    });
  });
  return group;
}

function rankActivities(groupVector) {
  return Object.entries(groupVector)
    .sort((a, b) => b[1] - a[1])
    .map(([activity, score]) => {
      const cat = HOBBY_CATS.find(c => c.activities.includes(activity));
      return { activity, score, category: cat?.id, emoji: cat?.emoji, color: cat?.color };
    });
}

function calcCategoryScores(groupVector) {
  return HOBBY_CATS.map(cat => {
    const scores = cat.activities.map(a => groupVector[a] ?? 0);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    return { ...cat, avgScore: Math.round(avg * 100) / 100 };
  }).sort((a, b) => b.avgScore - a.avgScore);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function InterestHealthAgents() {
  // ── GLOBAL STATE ─────────────────────────────────────────
  const [agent, setAgent] = useState("interest"); // "interest" | "health"
  const [phase, setPhase] = useState("intro");
  // interest phases: intro → quiz → computing → results → handoff
  // health phases: scanning → requirements → checklist → complete

  // ── INTEREST PROFILER STATE ──────────────────────────────
  const [activeMember, setActiveMember] = useState(0);
  const [allAnswers, setAllAnswers] = useState({}); // {memberId: {activity: weight}}
  const [quizQueue, setQuizQueue] = useState([]); // [{catId, catLabel, activity, emoji}]
  const [qIdx, setQIdx] = useState(0);
  const [chatLog, setChatLog] = useState([]); // [{from,text,type?}]
  const [groupVector, setGroupVector] = useState({});
  const [ranked, setRanked] = useState([]);
  const [catScores, setCatScores] = useState([]);
  const [processingStep, setProcessingStep] = useState(0);

  // ── HEALTH AGENT STATE ───────────────────────────────────
  const [healthQueue, setHealthQueue] = useState([]); // activities needing checks
  const [healthIdx, setHealthIdx] = useState(0);
  const [reqDecisions, setReqDecisions] = useState({}); // {activityName: {reqId: bool}}
  const [alternatives, setAlternatives] = useState({}); // {activityName: alternativeName}
  const [healthStep, setHealthStep] = useState(0);
  const [dbRecords, setDbRecords] = useState(null);

  const chatEndRef = useRef(null);
  const member = MEMBERS[activeMember];

  // ── BUILD QUIZ QUEUE ─────────────────────────────────────
  useEffect(() => {
    const q = [];
    HOBBY_CATS.forEach(cat => {
      cat.activities.forEach(act => {
        q.push({ catId:cat.id, catLabel:cat.label, activity:act, emoji:cat.emoji, color:cat.color });
      });
    });
    setQuizQueue(q);
  }, []);

  // ── AUTO-SCROLL CHAT ─────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [chatLog, qIdx]);

  // ── START MEMBER QUIZ ────────────────────────────────────
  useEffect(() => {
    if (phase === "quiz" && member) {
      setQIdx(0);
      setChatLog([
        { from:"agent", text:`Hey ${member.name.split(" ")[0]}! 🎯 Let's discover your travel interests. I'll ask about activities across ${HOBBY_CATS.length} categories.` },
        { from:"agent", text:`For each, tell me: 👍 Love it!, 🤷 Maybe, or 👎 Not for me.` },
      ]);
    }
  }, [phase, activeMember]);

  // ── ASK NEXT QUESTION ────────────────────────────────────
  const currentQ = quizQueue[qIdx];
  const memberDone = qIdx >= quizQueue.length;
  const allMembersDone = MEMBERS.every(m => {
    const a = allAnswers[m.id];
    if (!a) return false;
    return quizQueue.every(q => a[q.activity] !== undefined);
  });

  const answerQuestion = (weight) => {
    if (!currentQ || !member) return;
    const label = weight === 1 ? "👍 Love it!" : weight === 0.5 ? "🤷 Maybe" : "👎 Not for me";
    
    // Store answer
    setAllAnswers(prev => ({
      ...prev,
      [member.id]: { ...(prev[member.id] || {}), [currentQ.activity]: weight },
    }));

    // Add to chat
    setChatLog(prev => [
      ...prev,
      { from:"user", text:`${label}`, weight },
      ...(weight === 1 ? [{ from:"agent", text:`Awesome, noted! 🔥` }] :
         weight === 0.5 ? [{ from:"agent", text:`Got it — we'll keep it as an option.` }] :
         [{ from:"agent", text:`No worries, skipping that one.` }]),
    ]);

    // Next question
    const nextIdx = qIdx + 1;
    if (nextIdx < quizQueue.length) {
      setQIdx(nextIdx);
      const nextQ = quizQueue[nextIdx];
      // If new category, announce it
      if (nextQ.catId !== currentQ.catId) {
        setTimeout(() => {
          setChatLog(prev => [...prev,
            { from:"agent", text:`Moving on to ${nextQ.emoji} ${nextQ.catLabel}!`, type:"category" },
          ]);
        }, 300);
      }
    } else {
      setQIdx(nextIdx);
      setTimeout(() => {
        setChatLog(prev => [...prev,
          { from:"agent", text:`All done, ${member.name.split(" ")[0]}! ✅ Your profile is locked in.` },
        ]);
      }, 300);
    }
  };

  // ── SIMULATE ALL ANSWERS ─────────────────────────────────
  const simulateAll = () => {
    setAllAnswers(SIM_ANSWERS);
    setChatLog(prev => [...prev, { from:"system", text:"All 4 members' answers simulated" }]);
  };

  // ── COMPUTE RESULTS ──────────────────────────────────────
  const startComputing = () => {
    setPhase("computing");
    setProcessingStep(0);
    const delays = [600, 1300, 2000, 2700, 3400, 4000];
    delays.forEach((d, i) => setTimeout(() => setProcessingStep(i), d));
    setTimeout(() => {
      const gv = calcGroupVector(allAnswers);
      setGroupVector(gv);
      setRanked(rankActivities(gv));
      setCatScores(calcCategoryScores(gv));
      setPhase("results");
    }, 4600);
  };

  // ── HAND OFF TO HEALTH AGENT ─────────────────────────────
  const handoffToHealth = () => {
    // Find activities with score > 0 that have requirements
    const approvedActivities = ranked
      .filter(r => r.score > 0)
      .map(r => r.activity)
      .filter(a => REQUIREMENTS_DB[a]);
    setHealthQueue(approvedActivities);
    setHealthIdx(0);
    setReqDecisions({});
    setAlternatives({});
    setAgent("health");
    setPhase("scanning");
    setHealthStep(0);

    // Animate scanning
    const delays = [600, 1400, 2200, 2800];
    delays.forEach((d, i) => setTimeout(() => setHealthStep(i), d));
    setTimeout(() => setPhase("requirements"), 3400);
  };

  // ── HEALTH REQUIREMENT DECISION ──────────────────────────
  const currentHealthActivity = healthQueue[healthIdx];
  const currentReqs = currentHealthActivity ? REQUIREMENTS_DB[currentHealthActivity] : null;

  const decideReq = (reqId, hasClearance) => {
    setReqDecisions(prev => ({
      ...prev,
      [currentHealthActivity]: {
        ...(prev[currentHealthActivity] || {}),
        [reqId]: hasClearance,
      },
    }));
  };

  const allReqsDecided = currentReqs &&
    currentReqs.requirements.every(r => reqDecisions[currentHealthActivity]?.[r.id] !== undefined);

  const someReqsFailed = currentReqs &&
    currentReqs.requirements.some(r => reqDecisions[currentHealthActivity]?.[r.id] === false);

  const chooseAlternative = (altName) => {
    setAlternatives(prev => ({ ...prev, [currentHealthActivity]: altName }));
  };

  const nextHealthCheck = () => {
    if (healthIdx < healthQueue.length - 1) {
      setHealthIdx(healthIdx + 1);
    } else {
      setPhase("checklist");
    }
  };

  // ── GENERATE CHECKLIST & STORE ───────────────────────────
  const generateChecklist = () => {
    const checklists = MEMBERS.map(m => {
      const memberAns = allAnswers[m.id] || {};
      const items = [];
      
      // Activity requirements
      healthQueue.forEach(act => {
        const reqs = REQUIREMENTS_DB[act];
        const decisions = reqDecisions[act] || {};
        const alt = alternatives[act];
        if (alt) {
          items.push({ type:"alternative", activity:act, replacement:alt, note:`Replaced: ${act} → ${alt}` });
        } else {
          reqs.requirements.forEach(r => {
            if (!decisions[r.id]) {
              items.push({ type:"action_needed", activity:act, requirement:r.label, reqType:r.type });
            } else {
              items.push({ type:"cleared", activity:act, requirement:r.label });
            }
          });
        }
      });

      // Destination vaccinations
      const dests = m.destinations || [];
      dests.forEach(dest => {
        const health = DEST_HEALTH[dest];
        if (health) {
          health.recommended.forEach(v => {
            items.push({ type:"vaccination", destination:dest, name:v.name, urgency:v.urgency, leadTime:v.leadTime });
          });
        }
      });

      return { member_id:m.id, name:m.name, checklist:items };
    });

    const records = {
      trip_plans: {
        group_interest_vector: groupVector,
        ranked_activities: ranked.filter(r => r.score > 0).map(r => ({ activity:r.activity, score:r.score, category:r.category })),
        approved_with_requirements: healthQueue.map(act => ({
          activity: act,
          all_cleared: !Object.values(reqDecisions[act] || {}).includes(false),
          alternative: alternatives[act] || null,
        })),
        updated_at: new Date().toISOString(),
      },
      member_checklists: checklists,
    };
    setDbRecords(records);
    setPhase("complete");
  };

  const totalPhases = agent === "interest"
    ? ["intro","quiz","computing","results","handoff"]
    : ["scanning","requirements","checklist","complete"];

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <CSS/>

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header style={{ background:agent==="interest"
        ? `linear-gradient(140deg,${T.primaryDark},${T.primary} 50%,${T.primaryLight})`
        : `linear-gradient(140deg,#7C3AED,#6D28D9 50%,#8B5CF6)`,
        padding:"20px 24px 18px", color:"#fff", position:"relative", overflow:"hidden",
        transition:"background .6s" }}>
        <div style={{ position:"absolute",inset:0,
          background:"radial-gradient(circle at 80% 30%,rgba(255,255,255,.06),transparent 55%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:720,margin:"0 auto",position:"relative" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:42,height:42,borderRadius:13,background:"rgba(255,255,255,.12)",
              display:"flex",alignItems:"center",justifyContent:"center",animation:"glow 3s infinite" }}>
              <span style={{ fontSize:22 }}>{agent==="interest"?"🎯":"🩺"}</span>
            </div>
            <div>
              <h1 className="hd" style={{ fontWeight:700,fontSize:20 }}>
                {agent==="interest" ? "Interest Profiler Agent" : "Health & Fitness Agent"}
              </h1>
              <p style={{ fontSize:13,opacity:.65 }}>
                {agent==="interest"
                  ? "Building individual & group travel preference vectors"
                  : "Checking activity requirements & health clearances"}
              </p>
            </div>
            {/* Agent indicator chips */}
            <div style={{ marginLeft:"auto",display:"flex",gap:6 }}>
              <div style={{ padding:"4px 12px",borderRadius:999,fontSize:11,fontWeight:600,
                background:agent==="interest"?"rgba(255,255,255,.25)":"rgba(255,255,255,.08)",
                opacity:agent==="interest"?1:.5 }}>🎯 Interest</div>
              <div style={{ padding:"4px 12px",borderRadius:999,fontSize:11,fontWeight:600,
                background:agent==="health"?"rgba(255,255,255,.25)":"rgba(255,255,255,.08)",
                opacity:agent==="health"?1:.5 }}>🩺 Health</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:3,marginTop:14 }}>
            {totalPhases.map((p,i) => (
              <div key={p} style={{ flex:1,height:3,borderRadius:999,
                background:totalPhases.indexOf(phase)>=i?"rgba(255,255,255,.75)":"rgba(255,255,255,.12)",
                transition:"background .4s" }}/>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth:720,margin:"0 auto",padding:"22px 20px 80px" }}>

        {/* ═══════════════════════════════════════════════════════
           INTEREST PROFILER — INTRO
           ═══════════════════════════════════════════════════════ */}
        {agent==="interest" && phase==="intro" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <AgentBubble emoji="🎯" name="Interest Profiler"
              text={`Let's discover what your group of ${MEMBERS.length} loves! I'll ask each member about ${quizQueue.length} activities across ${HOBBY_CATS.length} categories using simple yes/no questions.`}/>

            <div style={{ background:T.surface,borderRadius:16,padding:20,marginTop:16,
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:12 }}>
                {HOBBY_CATS.length} Categories · {quizQueue.length} Activities · 3-Point Scale
              </p>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8 }}>
                {HOBBY_CATS.map((cat, i) => (
                  <div key={cat.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 12px",
                    borderRadius:10,background:`${cat.color}08`,border:`1px solid ${cat.color}15`,
                    animation:`fadeUp .3s ease-out ${i*.04}s both` }}>
                    <span style={{ fontSize:18 }}>{cat.emoji}</span>
                    <div>
                      <p className="hd" style={{ fontWeight:600,fontSize:13 }}>{cat.label}</p>
                      <p style={{ fontSize:11,color:T.text3 }}>{cat.activities.length} activities</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setPhase("quiz")} className="hd"
              style={{ width:"100%",marginTop:16,padding:"14px",borderRadius:14,border:"none",
                background:T.primary,color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                minHeight:50,boxShadow:`0 4px 16px ${T.primary}30`,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <Ic n="zap" s={18} c="#fff"/> Start Profiling
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           INTEREST PROFILER — QUIZ (Conversational)
           ═══════════════════════════════════════════════════════ */}
        {agent==="interest" && phase==="quiz" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            {/* Member tabs */}
            <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto" }}>
              {MEMBERS.map((m, i) => {
                const done = allAnswers[m.id] && quizQueue.every(q => allAnswers[m.id][q.activity] !== undefined);
                const active = i === activeMember;
                return (
                  <button key={m.id} onClick={() => { setActiveMember(i); }} className="hd"
                    style={{ display:"flex",alignItems:"center",gap:7,padding:"7px 12px",borderRadius:10,
                      border:`2px solid ${active?T.primary:done?T.success+"50":T.borderLight}`,
                      background:active?`${T.primary}08`:T.surface,cursor:"pointer",
                      minHeight:40,transition:"all .2s",flexShrink:0 }}>
                    <div style={{ width:24,height:24,borderRadius:999,
                      background:`linear-gradient(135deg,${MC[m.id]},${T.primaryDark})`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:"#fff",fontSize:9,fontWeight:700 }}>{m.initials}</div>
                    <span style={{ fontSize:12,fontWeight:active?700:500,color:active?T.primary:T.text2 }}>
                      {m.name.split(" ")[0]}
                    </span>
                    {done && <Ic n="check" s={13} c={T.success}/>}
                  </button>
                );
              })}
              <button onClick={simulateAll} className="hd"
                style={{ padding:"7px 12px",borderRadius:10,border:`1.5px solid ${T.border}`,
                  background:T.surface,color:T.text3,fontSize:11,fontWeight:600,cursor:"pointer",
                  flexShrink:0,display:"flex",alignItems:"center",gap:4 }}>
                <Ic n="sparkle" s={12} c={T.accent}/> Sim All
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ flex:1,height:6,background:T.borderLight,borderRadius:999 }}>
                <div style={{ height:"100%",width:`${Math.min(100,(qIdx/quizQueue.length)*100)}%`,
                  background:`linear-gradient(90deg,${T.primary},${T.accent})`,borderRadius:999,
                  transition:"width .3s" }}/>
              </div>
              <span className="hd" style={{ fontSize:12,fontWeight:600,color:T.text3,flexShrink:0 }}>
                {Math.min(qIdx, quizQueue.length)}/{quizQueue.length}
              </span>
            </div>

            {/* Chat area */}
            <div style={{ background:T.surface,borderRadius:16,border:`1px solid ${T.borderLight}`,
              boxShadow:sh.sm,overflow:"hidden" }}>
              <div style={{ maxHeight:340,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:10 }}>
                {chatLog.map((msg, i) => (
                  <MiniChat key={i} msg={msg} i={i}/>
                ))}
                <div ref={chatEndRef}/>
              </div>

              {/* Current question card */}
              {!memberDone && currentQ && (
                <div style={{ borderTop:`1px solid ${T.borderLight}`,padding:16,animation:"fadeUp .25s ease-out" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                    <span style={{ fontSize:11,padding:"2px 10px",borderRadius:999,fontWeight:600,
                      background:`${currentQ.color}12`,color:currentQ.color }} className="hd">
                      {currentQ.emoji} {currentQ.catLabel}
                    </span>
                    <span style={{ fontSize:13,color:T.text2 }}>Activity {(qIdx%4)+1}</span>
                  </div>
                  <p className="hd" style={{ fontWeight:700,fontSize:17,marginBottom:14 }}>
                    Do you enjoy <span style={{ color:currentQ.color }}>{currentQ.activity.toLowerCase()}</span>?
                  </p>
                  <div style={{ display:"flex",gap:8 }}>
                    {[
                      { label:"👍 Love it!", weight:1, bg:T.successBg, border:T.success, color:T.success },
                      { label:"🤷 Maybe",    weight:0.5, bg:T.warningBg, border:T.warning, color:T.warning },
                      { label:"👎 Nope",     weight:0, bg:T.errorBg, border:T.error, color:T.error },
                    ].map(opt => (
                      <button key={opt.weight} onClick={() => answerQuestion(opt.weight)}
                        className="hd" style={{ flex:1,padding:"12px 8px",borderRadius:12,
                          border:`2px solid ${opt.border}30`,background:opt.bg,color:opt.color,
                          fontSize:14,fontWeight:600,cursor:"pointer",minHeight:48,transition:"all .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = opt.border; e.currentTarget.style.transform = "scale(1.03)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = opt.border+"30"; e.currentTarget.style.transform = "none"; }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {memberDone && (
                <div style={{ borderTop:`1px solid ${T.borderLight}`,padding:14,textAlign:"center" }}>
                  <p className="hd" style={{ fontSize:14,color:T.success,fontWeight:600 }}>
                    ✅ {member.name.split(" ")[0]}'s profile complete!
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display:"flex",gap:10,marginTop:16 }}>
              {memberDone && activeMember < MEMBERS.length - 1 && (
                <button onClick={() => { setActiveMember(activeMember + 1); }} className="hd"
                  style={{ flex:1,padding:"12px",borderRadius:12,border:"none",background:T.accent,
                    color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  Next: {MEMBERS[activeMember+1].name.split(" ")[0]} <Ic n="chevR" s={16} c="#fff"/>
                </button>
              )}
              {allMembersDone && (
                <button onClick={startComputing} className="hd"
                  style={{ flex:1,padding:"12px",borderRadius:12,border:"none",background:T.primary,
                    color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",minHeight:48,
                    boxShadow:`0 4px 16px ${T.primary}30`,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <Ic n="sparkle" s={18} c="#fff"/> Compute Group Vector →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           INTEREST PROFILER — COMPUTING
           ═══════════════════════════════════════════════════════ */}
        {agent==="interest" && phase==="computing" && (
          <ProcessingCard title="Building Interest Profiles" emoji="🧬"
            steps={[
              "Building hobby vectors for each member...",
              "Computing weighted group_interest_vector...",
              "Ranking activities by group alignment...",
              "Calculating category scores...",
              "Detecting overlaps & divergences...",
              "Profile complete! ✨",
            ]}
            currentStep={processingStep}/>
        )}

        {/* ═══════════════════════════════════════════════════════
           INTEREST PROFILER — RESULTS
           ═══════════════════════════════════════════════════════ */}
        {agent==="interest" && (phase==="results" || phase==="handoff") && ranked.length > 0 && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <AgentBubble emoji="🎯" name="Interest Profiler"
              text={`Group profile built! ${ranked.filter(r=>r.score>=0.75).length} activities your group loves, ${ranked.filter(r=>r.score>=0.5 && r.score<0.75).length} moderately interested in, and ${ranked.filter(r=>r.score<0.25).length} to skip.`}/>

            {/* Category ranking */}
            <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",marginTop:16,
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:14 }}>Category Rankings</p>
              {catScores.map((cat, i) => (
                <div key={cat.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",
                  borderBottom:i<catScores.length-1?`1px solid ${T.borderLight}`:"none",
                  animation:`slideL .3s ease-out ${i*.04}s both` }}>
                  <span style={{ fontSize:18 }}>{cat.emoji}</span>
                  <span style={{ fontSize:14,fontWeight:500,width:110 }}>{cat.label}</span>
                  <div style={{ flex:1,height:8,background:T.borderLight,borderRadius:999 }}>
                    <div style={{ height:"100%",width:`${cat.avgScore*100}%`,background:cat.color,
                      borderRadius:999,animation:"barGrow .6s ease-out" }}/>
                  </div>
                  <span className="hd" style={{ fontWeight:700,fontSize:14,color:cat.avgScore>=0.7?T.success:cat.avgScore>=0.4?T.warning:T.text3,
                    width:36,textAlign:"right" }}>{Math.round(cat.avgScore*100)}%</span>
                </div>
              ))}
            </div>

            {/* Top activities table */}
            <div style={{ background:T.surface,borderRadius:16,padding:"18px 20px",marginTop:14,
              border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <p className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:14 }}>
                Ranked Activities (group_interest_vector)
              </p>
              {ranked.slice(0, 15).map((r, i) => {
                const reqs = REQUIREMENTS_DB[r.activity];
                return (
                  <div key={r.activity} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 0",
                    borderBottom:i<14?`1px solid ${T.borderLight}`:"none",
                    animation:`slideL .3s ease-out ${i*.03}s both` }}>
                    <span className="hd" style={{ width:22,fontSize:12,fontWeight:700,
                      color:i<3?T.primary:T.text3 }}>#{i+1}</span>
                    <span style={{ fontSize:14,fontWeight:500,flex:1 }}>{r.activity}</span>
                    <span style={{ fontSize:11,color:r.color,background:`${r.color}12`,
                      padding:"2px 8px",borderRadius:999 }}>{r.emoji} {r.category}</span>
                    {reqs && <span style={{ fontSize:10,color:reqs.severity==="high"?T.error:T.warning,
                      background:reqs.severity==="high"?T.errorBg:T.warningBg,
                      padding:"2px 6px",borderRadius:999 }}>⚠ reqs</span>}
                    {/* Per-member dots */}
                    <div style={{ display:"flex",gap:3 }}>
                      {MEMBERS.map(m => {
                        const w = allAnswers[m.id]?.[r.activity] ?? 0;
                        return <div key={m.id} style={{ width:8,height:8,borderRadius:999,
                          background:w===1?MC[m.id]:w===0.5?MC[m.id]+"60":T.borderLight,
                          border:`1px solid ${w>0?MC[m.id]:T.border}` }}/>;
                      })}
                    </div>
                    <span className="hd" style={{ fontWeight:700,fontSize:13,width:36,textAlign:"right",
                      color:r.score>=0.75?T.success:r.score>=0.5?T.warning:T.text3 }}>
                      {Math.round(r.score*100)}%
                    </span>
                  </div>
                );
              })}
              {/* Legend */}
              <div style={{ display:"flex",gap:12,marginTop:10 }}>
                {MEMBERS.map(m => (
                  <div key={m.id} style={{ display:"flex",alignItems:"center",gap:4,fontSize:11,color:T.text3 }}>
                    <div style={{ width:8,height:8,borderRadius:999,background:MC[m.id] }}/> {m.name.split(" ")[0]}
                  </div>
                ))}
              </div>
            </div>

            {/* Handoff card */}
            {phase==="results" && (
              <div style={{ background:T.surface,borderRadius:18,boxShadow:sh.lg,overflow:"hidden",
                border:`1px solid ${T.borderLight}`,marginTop:20,animation:"scaleIn .4s ease-out .2s both" }}>
                <div style={{ padding:"20px 22px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                    <span className="hd" style={{ background:`${T.primary}12`,color:T.primary,
                      padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700 }}>Interest Profiler</span>
                    <Ic n="chevR" s={14} c={T.text3}/>
                    <span className="hd" style={{ background:"#8B5CF612",color:"#8B5CF6",
                      padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700 }}>Health Agent</span>
                  </div>
                  <h3 className="hd" style={{ fontWeight:700,fontSize:18,marginBottom:4 }}>
                    {ranked.filter(r=>r.score>0 && REQUIREMENTS_DB[r.activity]).length} activities need health/fitness checks
                  </h3>
                  <p style={{ fontSize:14,color:T.text2,lineHeight:1.6,marginBottom:14 }}>
                    Some approved activities require certifications, medical clearance, or fitness thresholds.
                    The Health Agent will check each one with your group.
                  </p>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
                    {ranked.filter(r=>r.score>0 && REQUIREMENTS_DB[r.activity]).map(r => (
                      <span key={r.activity} style={{ fontSize:12,padding:"3px 10px",borderRadius:999,
                        background:REQUIREMENTS_DB[r.activity].severity==="high"?T.errorBg:T.warningBg,
                        color:REQUIREMENTS_DB[r.activity].severity==="high"?T.error:T.warning,fontWeight:500 }}>
                        {REQUIREMENTS_DB[r.activity].icon} {r.activity}
                      </span>
                    ))}
                  </div>
                  <button onClick={handoffToHealth} className="hd"
                    style={{ width:"100%",padding:"14px",borderRadius:12,border:"none",
                      background:"linear-gradient(135deg,#7C3AED,#6D28D9)",color:"#fff",
                      fontSize:15,fontWeight:700,cursor:"pointer",minHeight:50,
                      boxShadow:"0 4px 16px rgba(124,58,237,.3)",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                    <Ic n="shield" s={18} c="#fff"/> Launch Health & Fitness Agent →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           HEALTH AGENT — SCANNING
           ═══════════════════════════════════════════════════════ */}
        {agent==="health" && phase==="scanning" && (
          <ProcessingCard title="Scanning Activity Requirements" emoji="🔬"
            steps={[
              "Loading activity_requirements database...",
              "Cross-referencing with approved activity list...",
              "Checking destination-specific health advisories...",
              "Ready to verify clearances ✨",
            ]}
            currentStep={healthStep}
            color="#8B5CF6"/>
        )}

        {/* ═══════════════════════════════════════════════════════
           HEALTH AGENT — REQUIREMENT CHECKS
           ═══════════════════════════════════════════════════════ */}
        {agent==="health" && phase==="requirements" && currentReqs && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            {/* Progress */}
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
              <span className="hd" style={{ fontSize:13,fontWeight:600,color:T.text3 }}>
                Activity {healthIdx+1} of {healthQueue.length}
              </span>
              <div style={{ flex:1,height:5,background:T.borderLight,borderRadius:999 }}>
                <div style={{ height:"100%",width:`${((healthIdx+1)/healthQueue.length)*100}%`,
                  background:"linear-gradient(90deg,#7C3AED,#8B5CF6)",borderRadius:999,transition:"width .3s" }}/>
              </div>
            </div>

            {/* YesNoCard for this activity */}
            <div style={{ background:T.surface,borderRadius:18,boxShadow:sh.lg,overflow:"hidden",
              border:`1px solid ${T.borderLight}`,animation:"scaleIn .4s ease-out" }}>
              <div style={{ background:`linear-gradient(135deg,${currentReqs.severity==="high"?"#7C3AED12":"#F59E0B08"},transparent)`,
                padding:"20px 22px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                  <span className="hd" style={{ background:"#8B5CF612",color:"#8B5CF6",
                    padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700 }}>Health Agent</span>
                  <span style={{ fontSize:11,padding:"2px 8px",borderRadius:999,fontWeight:600,
                    background:currentReqs.severity==="high"?T.errorBg:currentReqs.severity==="medium"?T.warningBg:T.successBg,
                    color:currentReqs.severity==="high"?T.error:currentReqs.severity==="medium"?T.warning:T.success }}>
                    {currentReqs.severity} priority
                  </span>
                </div>

                <h3 className="hd" style={{ fontWeight:700,fontSize:20,marginBottom:4 }}>
                  {currentReqs.icon} {currentHealthActivity}
                </h3>
                <p style={{ fontSize:13.5,color:T.text2,marginBottom:16 }}>
                  This activity has {currentReqs.requirements.length} requirement{currentReqs.requirements.length>1?"s":""} to verify.
                  {currentReqs.destinations.length>0 && ` Relevant for: ${currentReqs.destinations.join(", ")}.`}
                </p>

                {/* Requirements list */}
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {currentReqs.requirements.map((req, ri) => {
                    const decided = reqDecisions[currentHealthActivity]?.[req.id];
                    return (
                      <div key={req.id} style={{ background:T.surface,borderRadius:12,padding:"14px 16px",
                        border:`1.5px solid ${decided===true?T.success+"40":decided===false?T.error+"40":T.borderLight}`,
                        animation:`slideL .3s ease-out ${ri*.06}s both`,transition:"border .3s" }}>
                        <div style={{ display:"flex",alignItems:"flex-start",gap:10 }}>
                          <span style={{ fontSize:10,padding:"3px 8px",borderRadius:999,fontWeight:600,flexShrink:0,marginTop:2,
                            background:req.type==="certification"?"#8B5CF612":req.type==="medical"?T.errorBg:req.type==="fitness"?T.successBg:T.warningBg,
                            color:req.type==="certification"?"#8B5CF6":req.type==="medical"?T.error:req.type==="fitness"?T.success:T.warning }}>
                            {req.type}
                          </span>
                          <p style={{ fontSize:14,lineHeight:1.5,flex:1 }}>{req.label}</p>
                        </div>
                        {decided === undefined && (
                          <div style={{ display:"flex",gap:8,marginTop:10 }}>
                            <button onClick={() => decideReq(req.id, true)}
                              className="hd" style={{ flex:1,padding:"10px",borderRadius:10,
                                border:`2px solid ${T.success}30`,background:T.successBg,color:T.success,
                                fontSize:13,fontWeight:600,cursor:"pointer",minHeight:42,
                                display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
                              <Ic n="thumbUp" s={15} c={T.success}/> Yes, cleared
                            </button>
                            <button onClick={() => decideReq(req.id, false)}
                              className="hd" style={{ flex:1,padding:"10px",borderRadius:10,
                                border:`2px solid ${T.error}30`,background:T.errorBg,color:T.error,
                                fontSize:13,fontWeight:600,cursor:"pointer",minHeight:42,
                                display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
                              <Ic n="thumbDn" s={15} c={T.error}/> No / Unsure
                            </button>
                          </div>
                        )}
                        {decided !== undefined && (
                          <div style={{ marginTop:8,display:"flex",alignItems:"center",gap:6,
                            animation:"popIn .3s ease" }}>
                            <Ic n={decided?"check":"x"} s={16} c={decided?T.success:T.error}/>
                            <span className="hd" style={{ fontSize:13,fontWeight:600,
                              color:decided?T.success:T.error }}>
                              {decided?"Cleared ✓":"Not cleared"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* If some requirements failed — show alternatives */}
                {allReqsDecided && someReqsFailed && !alternatives[currentHealthActivity] && (
                  <div style={{ marginTop:16,padding:16,background:`${T.warning}08`,borderRadius:12,
                    border:`1px solid ${T.warning}20`,animation:"fadeUp .3s ease-out" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                      <Ic n="swap" s={16} c={T.warning}/>
                      <p className="hd" style={{ fontWeight:700,fontSize:14,color:T.warning }}>Suggested Alternatives</p>
                    </div>
                    {currentReqs.alternatives.map(alt => (
                      <button key={alt.name} onClick={() => chooseAlternative(alt.name)}
                        style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                          borderRadius:10,border:`1.5px solid ${T.border}`,background:T.surface,
                          cursor:"pointer",width:"100%",marginBottom:6,textAlign:"left",transition:"all .2s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}>
                        <span style={{ fontSize:20 }}>{alt.emoji}</span>
                        <div>
                          <p className="hd" style={{ fontWeight:600,fontSize:14 }}>{alt.name}</p>
                          <p style={{ fontSize:12,color:T.text3 }}>{alt.desc}</p>
                        </div>
                        <Ic n="chevR" s={16} c={T.text3}/>
                      </button>
                    ))}
                    {currentReqs.certResource && (
                      <p style={{ fontSize:12,color:T.text2,marginTop:8,padding:"8px 10px",
                        background:T.surface,borderRadius:8,border:`1px solid ${T.borderLight}` }}>
                        💡 <strong>Want to get certified?</strong> {currentReqs.certResource}
                      </p>
                    )}
                  </div>
                )}

                {/* Alternative chosen confirmation */}
                {alternatives[currentHealthActivity] && (
                  <div style={{ marginTop:12,padding:12,background:T.successBg,borderRadius:10,
                    border:`1px solid ${T.success}20`,animation:"popIn .3s ease",
                    display:"flex",alignItems:"center",gap:8 }}>
                    <Ic n="check" s={16} c={T.success}/>
                    <span className="hd" style={{ fontSize:13,fontWeight:600,color:T.success }}>
                      Swapped to: {alternatives[currentHealthActivity]}
                    </span>
                  </div>
                )}

                {/* Next button */}
                {allReqsDecided && (!someReqsFailed || alternatives[currentHealthActivity]) && (
                  <button onClick={nextHealthCheck} className="hd"
                    style={{ width:"100%",marginTop:16,padding:"14px",borderRadius:12,border:"none",
                      background:"#7C3AED",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",
                      minHeight:48,boxShadow:"0 2px 12px rgba(124,58,237,.3)",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                      animation:"scaleIn .3s ease-out" }}>
                    {healthIdx < healthQueue.length - 1
                      ? <>Next Activity <Ic n="chevR" s={16} c="#fff"/></>
                      : <>Generate Health Checklists <Ic n="clipboard" s={16} c="#fff"/></>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           HEALTH AGENT — CHECKLIST
           ═══════════════════════════════════════════════════════ */}
        {agent==="health" && phase==="checklist" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <AgentBubble emoji="🩺" name="Health Agent" color="#8B5CF6"
              text="All activity requirements verified! Here's a summary plus destination-specific health advisories. I'll generate checklists for each member."/>

            {/* Summary cards */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginTop:16,marginBottom:16 }}>
              {[
                { label:"Activities Checked", value:healthQueue.length, icon:"shield", color:"#8B5CF6" },
                { label:"All Cleared", value:healthQueue.filter(a=>!Object.values(reqDecisions[a]||{}).includes(false)).length, icon:"check", color:T.success },
                { label:"Swapped", value:Object.keys(alternatives).length, icon:"swap", color:T.warning },
                { label:"Vaccinations", value:MEMBERS[0].destinations.reduce((s,d)=>(DEST_HEALTH[d]?.recommended?.length||0)+s,0), icon:"alert", color:T.error },
              ].map((s, i) => (
                <div key={i} style={{ background:T.surface,borderRadius:12,padding:"14px 16px",
                  border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,textAlign:"center",
                  animation:`scaleIn .3s ease-out ${i*.05}s both` }}>
                  <Ic n={s.icon} s={18} c={s.color}/>
                  <p className="hd" style={{ fontWeight:700,fontSize:22,marginTop:4 }}>{s.value}</p>
                  <p style={{ fontSize:11.5,color:T.text3 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Destination health advisories */}
            {MEMBERS[0].destinations.map(dest => {
              const health = DEST_HEALTH[dest];
              if (!health) return null;
              return (
                <div key={dest} style={{ background:T.surface,borderRadius:14,padding:"16px 18px",
                  border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,marginBottom:12 }}>
                  <h4 className="hd" style={{ fontWeight:700,fontSize:15,marginBottom:10 }}>
                    🏥 Health Advisory — {dest}
                  </h4>
                  {health.recommended.map((v, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 0",
                      borderBottom:i<health.recommended.length-1?`1px solid ${T.borderLight}`:"none" }}>
                      <span style={{ fontSize:11,padding:"2px 8px",borderRadius:999,fontWeight:600,
                        background:v.urgency==="high"?T.errorBg:v.urgency==="medium"?T.warningBg:T.successBg,
                        color:v.urgency==="high"?T.error:v.urgency==="medium"?T.warning:T.success }}>
                        {v.urgency}
                      </span>
                      <span style={{ fontSize:13.5,fontWeight:500,flex:1 }}>{v.name}</span>
                      <span style={{ fontSize:12,color:T.text3 }}>{v.leadTime}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:10,display:"flex",gap:6,flexWrap:"wrap" }}>
                    {health.advisories.map((a, i) => (
                      <span key={i} style={{ fontSize:11.5,padding:"3px 10px",borderRadius:999,
                        background:`${T.accent}10`,color:T.accent }}>💡 {a}</span>
                    ))}
                  </div>
                </div>
              );
            })}

            <button onClick={generateChecklist} className="hd"
              style={{ width:"100%",marginTop:8,padding:"14px",borderRadius:14,border:"none",
                background:"#7C3AED",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                minHeight:50,boxShadow:"0 4px 16px rgba(124,58,237,.3)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              <Ic n="file" s={18} c="#fff"/> Generate Checklists & Store →
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
           COMPLETE — DB Records
           ═══════════════════════════════════════════════════════ */}
        {phase==="complete" && dbRecords && (
          <div style={{ animation:"fadeUp .5s ease-out" }}>
            <div style={{ textAlign:"center",marginBottom:24 }}>
              <div style={{ fontSize:56,marginBottom:12,position:"relative",display:"inline-block" }}>
                ✅
                {["🎯","🩺","✨","💪","🎊"].map((e,i)=>(
                  <span key={i} style={{ position:"absolute",fontSize:16,
                    top:`${-10+Math.sin(i*1.3)*25}px`,left:`${-15+Math.cos(i*1.3)*38}px`,
                    animation:`confetti 1.2s ease-out ${.2+i*.1}s both`,pointerEvents:"none" }}>{e}</span>
                ))}
              </div>
              <h2 className="hd" style={{ fontWeight:700,fontSize:24 }}>Profiles & Checklists Saved!</h2>
              <p style={{ color:T.text2,fontSize:15,marginTop:6 }}>
                Interest vectors and health requirements stored. The POI Agent will now use these to curate activities.
              </p>
            </div>

            {/* Per-member checklist preview */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20 }}>
              {dbRecords.member_checklists.map((mc, mi) => (
                <div key={mc.member_id} style={{ background:T.surface,borderRadius:14,padding:"14px 16px",
                  border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,
                  animation:`scaleIn .3s ease-out ${mi*.08}s both` }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                    <div style={{ width:28,height:28,borderRadius:999,
                      background:`linear-gradient(135deg,${MC[mc.member_id]},${T.primaryDark})`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:"#fff",fontSize:10,fontWeight:700 }} className="hd">
                      {MEMBERS.find(m=>m.id===mc.member_id)?.initials}
                    </div>
                    <span className="hd" style={{ fontWeight:700,fontSize:14 }}>{mc.name}</span>
                  </div>
                  {mc.checklist.slice(0, 5).map((item, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:12 }}>
                      <span style={{ fontSize:10,padding:"1px 6px",borderRadius:999,
                        background:item.type==="cleared"?T.successBg:item.type==="vaccination"?"#8B5CF612":item.type==="alternative"?T.warningBg:T.errorBg,
                        color:item.type==="cleared"?T.success:item.type==="vaccination"?"#8B5CF6":item.type==="alternative"?T.warning:T.error }}>
                        {item.type==="cleared"?"✓":item.type==="vaccination"?"💉":item.type==="alternative"?"↔":"⚠"}
                      </span>
                      <span style={{ color:T.text2 }}>
                        {item.type==="vaccination"?item.name:item.type==="alternative"?item.note:item.type==="cleared"?`${item.activity} ✓`:`${item.requirement}`}
                      </span>
                    </div>
                  ))}
                  {mc.checklist.length > 5 && (
                    <p style={{ fontSize:11,color:T.text3,marginTop:4 }}>+{mc.checklist.length-5} more items</p>
                  )}
                </div>
              ))}
            </div>

            {/* DB Records */}
            <div style={{ background:T.surface,borderRadius:16,overflow:"hidden",border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <div style={{ padding:"14px 18px",background:`${T.primaryDark}08`,borderBottom:`1px solid ${T.borderLight}`,
                display:"flex",alignItems:"center",gap:8 }}>
                <Ic n="db" s={16} c={T.primary}/>
                <span className="hd" style={{ fontWeight:700,fontSize:14,color:T.primary }}>Database Records</span>
              </div>
              <div style={{ padding:18,borderBottom:`1px solid ${T.borderLight}` }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  trip_plans (interest vector + health clearances)
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12,lineHeight:1.6,
                  color:T.text,overflow:"auto",maxHeight:200,border:`1px solid ${T.borderLight}`,
                  fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.trip_plans, null, 2)}
                </pre>
              </div>
              <div style={{ padding:18 }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  member_checklists ({dbRecords.member_checklists.length} rows)
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12,lineHeight:1.6,
                  color:T.text,overflow:"auto",maxHeight:250,border:`1px solid ${T.borderLight}`,
                  fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.member_checklists, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ textAlign:"center",marginTop:24 }}>
              <button onClick={() => {
                setAgent("interest"); setPhase("intro"); setActiveMember(0); setAllAnswers({});
                setQuizQueue([]); setQIdx(0); setChatLog([]); setGroupVector({}); setRanked([]);
                setCatScores([]); setHealthQueue([]); setHealthIdx(0); setReqDecisions({});
                setAlternatives({}); setDbRecords(null);
                // Re-init quiz queue
                const q = [];
                HOBBY_CATS.forEach(cat => { cat.activities.forEach(act => {
                  q.push({ catId:cat.id, catLabel:cat.label, activity:act, emoji:cat.emoji, color:cat.color });
                }); });
                setQuizQueue(q);
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
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function AgentBubble({ emoji, name, text, color }) {
  return (
    <div style={{ display:"flex",gap:10,maxWidth:540,animation:"fadeUp .35s ease-out" }}>
      <div style={{ width:32,height:32,borderRadius:999,flexShrink:0,
        background:`linear-gradient(135deg,${color||T.primary},${T.accent})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{emoji}</div>
      <div>
        <p className="hd" style={{ fontSize:11,color:color||T.primary,fontWeight:600,marginBottom:3 }}>{name}</p>
        <div style={{ background:T.surface,color:T.text,padding:"11px 15px",
          borderRadius:"12px 12px 12px 3px",boxShadow:sh.sm,fontSize:14,lineHeight:1.6,
          border:`1px solid ${T.borderLight}` }}>{text}</div>
      </div>
    </div>
  );
}

function MiniChat({ msg, i }) {
  if (msg.from === "system") return (
    <p style={{ textAlign:"center",fontSize:11.5,color:T.text3,padding:"4px 0",
      animation:"fadeIn .2s ease-out" }}>— {msg.text} —</p>
  );
  const isUser = msg.from === "user";
  return (
    <div style={{ display:"flex",gap:8,flexDirection:isUser?"row-reverse":"row",
      maxWidth:420,animation:`fadeUp .2s ease-out`,alignSelf:isUser?"flex-end":"flex-start" }}>
      {!isUser && <div style={{ width:24,height:24,borderRadius:999,flexShrink:0,marginTop:2,
        background:`linear-gradient(135deg,${T.primary},${T.accent})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>🎯</div>}
      <div style={{ background:isUser?T.primary:T.surface,color:isUser?"#fff":T.text,
        padding:"7px 12px",borderRadius:`10px 10px ${isUser?"3px":"10px"} ${isUser?"10px":"3px"}`,
        boxShadow:sh.sm,fontSize:13.5,lineHeight:1.5,
        border:isUser?"none":`1px solid ${T.borderLight}`,
        ...(msg.type === "category" ? { background:`${T.primary}08`,border:`1px solid ${T.primary}15`,color:T.primary,fontWeight:600 } : {}) }}>
        {msg.text}
      </div>
    </div>
  );
}

function ProcessingCard({ title, emoji, steps, currentStep, color }) {
  const c = color || T.primary;
  return (
    <div style={{ animation:"fadeUp .4s ease-out" }}>
      <div style={{ background:T.surface,borderRadius:18,padding:28,border:`1px solid ${T.borderLight}`,
        boxShadow:sh.md,textAlign:"center" }}>
        <div style={{ width:64,height:64,borderRadius:20,margin:"0 auto 20px",
          background:`${c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,
          animation:"glow 2s infinite" }}>{emoji}</div>
        <h2 className="hd" style={{ fontWeight:700,fontSize:22,marginBottom:8 }}>{title}</h2>
        <div style={{ display:"flex",flexDirection:"column",gap:12,textAlign:"left",maxWidth:420,margin:"0 auto" }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:12,
              opacity:currentStep>=i?1:0.2,transition:"opacity .4s" }}>
              <div style={{ width:24,height:24,borderRadius:999,flexShrink:0,
                background:currentStep>i?T.success:currentStep===i?c:T.borderLight,
                display:"flex",alignItems:"center",justifyContent:"center",transition:"all .3s" }}>
                {currentStep>i ? <Ic n="check" s={12} c="#fff"/> :
                  currentStep===i ? <div style={{ width:7,height:7,borderRadius:999,background:"#fff",animation:"dotPulse 1s infinite" }}/> :
                  <div style={{ width:5,height:5,borderRadius:999,background:T.text3 }}/>}
              </div>
              <span style={{ fontSize:14,fontWeight:currentStep===i?600:400,color:currentStep>=i?T.text:T.text3 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
