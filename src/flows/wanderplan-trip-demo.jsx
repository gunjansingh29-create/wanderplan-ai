import { useState, useEffect, useRef } from "react";

const T = {
  primary:"#0D7377", primaryLight:"#1A9A9F", primaryDark:"#095456",
  secondary:"#E8634A", secondaryLight:"#F08872",
  accent:"#4DA8DA", accentLight:"#7CC2E8",
  bg:"#F6F8FA", surface:"#FFFFFF",
  text:"#1A1A2E", text2:"#5A6A7A", text3:"#8E99A8",
  border:"#E2E8F0", borderLight:"#F0F3F7",
  success:"#22C55E", successBg:"#F0FDF4",
  warning:"#F59E0B", warningBg:"#FFFBEB",
  error:"#EF4444", errorBg:"#FEF2F2",
};
const sh = {
  sm:"0 1px 3px rgba(26,26,46,0.05),0 1px 2px rgba(26,26,46,0.03)",
  md:"0 4px 16px rgba(26,26,46,0.07),0 2px 6px rgba(26,26,46,0.03)",
  lg:"0 12px 40px rgba(26,26,46,0.1),0 4px 12px rgba(26,26,46,0.05)",
};

const CSS = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Source+Sans+3:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Source Sans 3',sans-serif;background:${T.bg};color:${T.text};-webkit-font-smoothing:antialiased}
  .hd{font-family:'DM Sans',sans-serif}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes slideProgress{from{width:0}}
  @keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.35}40%{transform:scale(1);opacity:1}}
  @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(13,115,119,.1)}50%{box-shadow:0 0 20px rgba(13,115,119,.25)}}
  ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${T.border};border-radius:99px}
`}</style>;

const CREW = [
  { name:"James W", ini:"JW", color:"#0D7377" },
  { name:"Sarah W", ini:"SW", color:"#4DA8DA" },
  { name:"Alex C", ini:"AC", color:"#E8634A" },
  { name:"Priya S", ini:"PS", color:"#22C55E" },
];

const STEPS = [
  { stage:"Bucket List", agent:"Destination Agent", emoji:"🌍", duration:3500,
    desc:"Each member submits their dream destinations via natural language. The agent extracts, deduplicates, and enriches with weather, visa, and cost data.",
    detail:"Sarah: 'Santorini and that temple city in Japan' -> Santorini (Greece), Kyoto (Japan). Alex: 'Iceland for northern lights, Bali' -> Iceland, Bali. 4 unique destinations extracted." },
  { stage:"Voting", agent:"Voting Agent", emoji:"🗳️", duration:3000,
    desc:"All destinations pooled. Members vote with approve/skip. Majority wins.",
    detail:"Santorini: 4/4 approved. Kyoto: 3/4 approved. Iceland: 2/4 (below threshold). Bali: 2/4 (below threshold). Final: Santorini + Kyoto." },
  { stage:"Timing", agent:"Timing Agent", emoji:"📅", duration:3500,
    desc:"Analyzes historical weather, crowd levels, flight prices, and local events across 12 months for both destinations.",
    detail:"Santorini: Sep-Oct optimal (8.4/10). Kyoto: Oct-Nov optimal (8.1/10). Combined best: October (8.2/10 avg, 87% confidence)." },
  { stage:"Interests", agent:"Interest Profiler", emoji:"🎯", duration:3000,
    desc:"Each member completes a rapid yes/no activity preference quiz. Agent finds group overlaps.",
    detail:"Group consensus: Hiking (92%), Food & Cooking (88%), Photography (85%), Culture (75%). Unique: Alex wants diving, Priya wants cooking class." },
  { stage:"Health", agent:"Health Agent", emoji:"🏥", duration:2500,
    desc:"Scans CDC and WHO databases for health requirements. Checks fitness compatibility with planned activities.",
    detail:"No special vaccinations required for Greece or Japan. Travel insurance recommended for caldera hiking. All members cleared for moderate-intensity activities." },
  { stage:"POIs", agent:"POI Discovery", emoji:"📍", duration:3500,
    desc:"Curates activities matched to group interests, rated by reviews and uniqueness. Each presented for approve/skip.",
    detail:"6 selected: Caldera Trail (4.8 stars, free), Cooking Class ($75, 3hrs), Fushimi Inari (free, 2hrs), Bamboo Grove (free, 1hr), Santo Wines ($35), Arashiyama ($15)." },
  { stage:"Duration", agent:"Duration Calculator", emoji:"⏱️", duration:2500,
    desc:"Calculates optimal days per destination based on POI count, travel pace, and rest needs.",
    detail:"Santorini: 3 full days (6 POIs, relaxed pace). Kyoto: 4 full days (8 POIs, moderate pace). Travel days: 2. Buffer: 1. Total: 10 days." },
  { stage:"Availability", agent:"Calendar Agent", emoji:"📆", duration:3000,
    desc:"Cross-references all 4 member calendars to find overlapping free windows.",
    detail:"Scanned Oct 1-31. Conflicts: James (Oct 5-7 conf), Priya (Oct 20-22 wedding). Clear window: Oct 8-19 (12 nights). Selected: Oct 8-17 (10 nights)." },
  { stage:"Budget", agent:"Budget Agent", emoji:"💰", duration:3000,
    desc:"Collects budget preferences, allocates by category, and optimizes for the group's chosen tier.",
    detail:"Group consensus: Mid-range ($150-250/day). Allocation: Flights 30% ($1,260), Stays 35% ($1,470), Food 20% ($840), Activities 10% ($420), Buffer 5% ($210). Total: $4,200/person." },
  { stage:"Flights", agent:"Flight Agent", emoji:"✈️", duration:3500,
    desc:"Searches optimal routes considering price, duration, stops, and cabin class within budget.",
    detail:"Japan Airlines Premium Economy: $1,247 round-trip, nonstop 14h15m, rated 4.6/5. Alternative: Emirates via Dubai, $980, 1 stop. Group chose JAL nonstop." },
  { stage:"Stays", agent:"Accommodation Agent", emoji:"🏨", duration:3000,
    desc:"Finds stays matching group size, budget tier, and location proximity to planned activities.",
    detail:"Santorini: Canaves Oia Suites ($385/n, 4.9 stars, caldera view, pool). Kyoto: Hoshinoya Kyoto ($520/n, 4.8 stars, riverside, tea ceremony included)." },
  { stage:"Dining", agent:"Dining Agent", emoji:"🍽️", duration:3000,
    desc:"Plans all meals respecting dietary needs (vegetarian, vegan), local specialties, and budget.",
    detail:"12 reservations across 10 days. Sarah (vegetarian) and Priya (vegan) accommodated at all venues. Mix of street food, mid-range, and 2 special dinners. All within 20% food budget." },
  { stage:"Itinerary", agent:"Itinerary Builder", emoji:"📋", duration:3500,
    desc:"Assembles the complete day-by-day schedule with times, costs, locations, and rest blocks.",
    detail:"Day 1: Arrive Santorini, check-in, sunset dinner. Day 2: Caldera hike, wine tasting. Day 3: Cooking class, beach. Day 4: Fly to Kyoto. Days 5-8: Temples, markets, bamboo grove. Day 9: Buffer/free. Day 10: Depart." },
  { stage:"Confirmed!", agent:"Trip Coordinator", emoji:"✅", duration:4000,
    desc:"Trip locked and synced. Calendar invites sent. Booking confirmations distributed to all members.",
    detail:"Total: $4,200/person for 10 days across 2 countries. 4 members confirmed. 12 reservations booked. 2 flights ticketed. Calendar synced for all. Bon voyage! 🎉" },
];

function Avi({ ini, color, size }) {
  var s = size || 32;
  return (
    <div style={{ width:s,height:s,borderRadius:999,background:color,display:"flex",alignItems:"center",
      justifyContent:"center",fontSize:s*.36,fontWeight:700,color:"#fff",flexShrink:0,
      border:"2px solid #fff" }}>{ini}</div>
  );
}

export default function TripDemo({
  onStepChange = () => {},
  backSignal = 0,
}) {
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const timerRef = useRef(null);
  const lastBackSignalRef = useRef(backSignal);

  useEffect(() => {
    if (!playing) { clearTimeout(timerRef.current); return; }
    timerRef.current = setTimeout(() => {
      setStep(s => {
        if (s < STEPS.length - 1) return s + 1;
        setPlaying(false);
        return s;
      });
      setShowDetail(false);
    }, STEPS[step].duration);
    return () => clearTimeout(timerRef.current);
  }, [playing, step]);

  useEffect(() => {
    onStepChange(step);
  }, [step, onStepChange]);

  useEffect(() => {
    if (backSignal === lastBackSignalRef.current) return;
    lastBackSignalRef.current = backSignal;
    setShowDetail(false);
    setPlaying(false);
    setStep((current) => Math.max(0, current - 1));
  }, [backSignal]);

  const cur = STEPS[step];
  const pct = ((step + 1) / STEPS.length) * 100;
  const isLast = step === STEPS.length - 1;

  const restart = () => { setStep(0); setPlaying(true); setShowDetail(false); };

  return (
    <div style={{ minHeight:"100vh",background:T.bg }}>
      <CSS/>

      {/* Header */}
      <header style={{ background:`linear-gradient(135deg,${T.primaryDark},${T.primary} 45%,${T.primaryLight})`,
        padding:"24px 28px 20px",color:"#fff",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,background:"radial-gradient(circle at 80% 30%,rgba(77,168,218,.1),transparent 60%)",pointerEvents:"none" }}/>
        <div style={{ maxWidth:800,margin:"0 auto",position:"relative" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <div style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,.12)",backdropFilter:"blur(8px)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🎬</div>
              <div>
                <h1 className="hd" style={{ fontWeight:700,fontSize:20 }}>Trip Planning Demo</h1>
                <p style={{ fontSize:13,opacity:.65 }}>Watch 14 AI agents plan a group trip end-to-end</p>
              </div>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>setPlaying(!playing)} className="hd"
                style={{ padding:"8px 20px",borderRadius:10,border:"1px solid rgba(255,255,255,.25)",
                  background:"rgba(255,255,255,.08)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                {playing?"⏸ Pause":"▶ Play"}
              </button>
              <button onClick={restart} className="hd"
                style={{ padding:"8px 20px",borderRadius:10,border:"1px solid rgba(255,255,255,.25)",
                  background:"rgba(255,255,255,.08)",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer" }}>
                ↻ Restart
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height:4,background:"rgba(255,255,255,.12)",borderRadius:99,marginTop:18,overflow:"hidden" }}>
            <div style={{ height:"100%",width:pct+"%",background:"linear-gradient(90deg,#fff,rgba(255,255,255,.7))",
              borderRadius:99,transition:"width .5s ease" }}/>
          </div>

          {/* Crew */}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginTop:12 }}>
            {CREW.map(m => <Avi key={m.ini} ini={m.ini} color={m.color} size={28}/>)}
            <span style={{ fontSize:12,opacity:.5,marginLeft:4 }}>4 members</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:800,margin:"0 auto",padding:"24px 20px 80px" }}>

        {/* Step selector */}
        <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:24 }}>
          {STEPS.map((s,i) => {
            const done = i < step;
            const active = i === step;
            return (
              <button key={i} onClick={() => { setStep(i); setShowDetail(false); setPlaying(false); }}
                className="hd" style={{ width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:700,transition:"all .2s",
                  background:active?T.primary:done?`${T.success}15`:T.surface,
                  color:active?"#fff":done?T.success:T.text3,
                  boxShadow:active?`0 0 14px ${T.primary}35`:sh.sm,
                  border:`1px solid ${active?T.primary:done?`${T.success}30`:T.borderLight}` }}>
                {done?"✓":(i+1)}
              </button>
            );
          })}
        </div>

        {/* Current step card */}
        <div style={{ background:T.surface,borderRadius:20,boxShadow:sh.md,border:`1px solid ${T.borderLight}`,
          overflow:"hidden",animation:"scaleIn .35s ease-out" }} key={step}>

          {/* Stage header */}
          <div style={{ padding:"24px 28px 20px",borderBottom:`1px solid ${T.borderLight}`,
            background:`linear-gradient(135deg,${T.primary}04,${T.accent}03)` }}>
            <div style={{ display:"flex",alignItems:"center",gap:14 }}>
              <div style={{ width:52,height:52,borderRadius:14,
                background:`linear-gradient(135deg,${T.primary},${T.accent})`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,color:"#fff",
                boxShadow:`0 4px 14px ${T.primary}30`,animation:playing?"glow 2s infinite":"none" }}>
                {cur.emoji}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <h2 className="hd" style={{ fontWeight:700,fontSize:22 }}>{cur.stage}</h2>
                  {playing && !isLast && (
                    <div style={{ display:"flex",gap:3,padding:"4px 0" }}>
                      {[0,1,2].map(i => <div key={i} style={{ width:5,height:5,borderRadius:999,
                        background:T.primary,animation:`dotPulse 1.2s infinite ease-in-out ${i*.16}s` }}/>)}
                    </div>
                  )}
                </div>
                <p style={{ fontSize:13,color:T.primary,fontWeight:500 }}>{cur.agent}</p>
              </div>
              <div className="hd" style={{ textAlign:"right" }}>
                <span style={{ fontSize:24,fontWeight:700,color:T.primary }}>{step+1}</span>
                <span style={{ fontSize:13,color:T.text3 }}> / {STEPS.length}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ padding:"22px 28px" }}>
            <p style={{ fontSize:15.5,color:T.text,lineHeight:1.7,marginBottom:16 }}>{cur.desc}</p>

            {/* Detail toggle */}
            <button onClick={() => setShowDetail(!showDetail)}
              style={{ display:"flex",alignItems:"center",gap:6,background:`${T.primary}06`,
                border:`1px solid ${T.primary}15`,borderRadius:10,padding:"10px 16px",cursor:"pointer",
                color:T.primary,fontSize:13,fontWeight:600,transition:"all .2s",width:"100%" }}>
              <span style={{ transform:showDetail?"rotate(90deg)":"none",transition:"transform .2s",display:"inline-block" }}>▸</span>
              {showDetail?"Hide":"Show"} Agent Output
            </button>

            {showDetail && (
              <div style={{ marginTop:12,padding:16,borderRadius:12,background:T.bg,border:`1px solid ${T.borderLight}`,
                animation:"fadeIn .25s ease" }}>
                <p style={{ fontSize:13.5,color:T.text2,lineHeight:1.7,fontFamily:"'SFMono-Regular',Consolas,monospace",
                  whiteSpace:"pre-wrap" }}>{cur.detail}</p>
              </div>
            )}

            {/* Simulated YesNo for approval steps */}
            {!isLast && (
              <div style={{ display:"flex",gap:12,marginTop:20 }}>
                <button className="hd" style={{ flex:1,padding:"14px",borderRadius:12,
                  border:`2px solid ${T.error}`,background:"transparent",color:T.error,
                  fontSize:14,fontWeight:600,cursor:"pointer",minHeight:48,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  ✕ Revise
                </button>
                <button onClick={() => { if(step<STEPS.length-1){setStep(step+1);setShowDetail(false);} }}
                  className="hd" style={{ flex:1,padding:"14px",borderRadius:12,border:"none",
                    background:T.primary,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:48,
                    boxShadow:`0 2px 10px ${T.primary}30`,
                    display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
                  ✓ Approve
                </button>
              </div>
            )}

            {/* Final celebration */}
            {isLast && (
              <div style={{ textAlign:"center",padding:"24px 0 8px",animation:"scaleIn .4s ease-out" }}>
                <div style={{ fontSize:56,marginBottom:12 }}>🎉</div>
                <h2 className="hd" style={{ fontWeight:700,fontSize:24,color:T.success,marginBottom:8 }}>Trip Confirmed!</h2>
                <p style={{ fontSize:15,color:T.text2,marginBottom:20 }}>$4,200/person for 10 days across 2 countries. All 4 members synced.</p>
                <div style={{ display:"flex",gap:12,justifyContent:"center" }}>
                  <button onClick={restart} className="hd"
                    style={{ padding:"12px 28px",borderRadius:12,border:"none",background:T.primary,color:"#fff",
                      fontSize:14,fontWeight:600,cursor:"pointer",boxShadow:`0 2px 10px ${T.primary}30` }}>
                    ↻ Watch Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary footer */}
        <div style={{ marginTop:24,background:T.surface,borderRadius:14,padding:"16px 20px",
          border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
          <div style={{ display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap" }}>
            {[
              { label:"Destinations",value:"Santorini + Kyoto" },
              { label:"Duration",value:"10 days" },
              { label:"Members",value:"4 travelers" },
              { label:"Budget",value:"$4,200/person" },
              { label:"Agents Used",value:"14 agents" },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center" }}>
                <p style={{ fontSize:11,color:T.text3 }}>{s.label}</p>
                <p className="hd" style={{ fontWeight:700,fontSize:14,color:T.primary }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
