import { useState, useEffect, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Dark analytics theme
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg:"#0B0F1A", surface:"#111827", surfaceLight:"#1F2937",
  border:"#374151", borderLight:"#1F2937",
  text:"#F9FAFB", text2:"#9CA3AF", text3:"#6B7280",
  primary:"#0D9488", primaryLight:"#2DD4BF", primaryDark:"#0F766E",
  accent:"#6366F1", accentLight:"#818CF8",
  coral:"#F97316", coralLight:"#FB923C",
  rose:"#F43F5E", roseLight:"#FB7185",
  sky:"#38BDF8", skyLight:"#7DD3FC",
  lime:"#84CC16", limeLight:"#BEF264",
  amber:"#F59E0B", amberLight:"#FCD34D",
  purple:"#A855F7",
  success:"#22C55E", warning:"#F59E0B", error:"#EF4444",
};
const CHART_COLORS = [C.primaryLight, C.accent, C.coral, C.rose, C.sky, C.lime, C.amber, C.purple];

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL CSS
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Outfit',sans-serif;background:${C.bg};color:${C.text};-webkit-font-smoothing:antialiased}
  :focus-visible{outline:none;box-shadow:0 0 0 2px ${C.accent}60;border-radius:6px}
  .mono{font-family:'JetBrains Mono',monospace}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
  @keyframes slideL{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes liveDot{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  .recharts-tooltip-wrapper{pointer-events:none!important}
  .recharts-default-tooltip{background:${C.surface}!important;border:1px solid ${C.border}!important;border-radius:10px!important;font-size:12px!important}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT TAXONOMY — Complete schema
   ═══════════════════════════════════════════════════════════════════════════ */
const EVENT_TAXONOMY = {
  global: [
    { event:"screen_view", desc:"Any screen viewed", props:"screen_name, referrer, session_id" },
    { event:"session_start", desc:"New session opened", props:"device, os, app_version, utm_source" },
    { event:"session_end", desc:"Session closed or timeout", props:"duration_ms, screens_visited" },
    { event:"error_occurred", desc:"JS error or API failure", props:"error_type, error_message, stack_trace" },
  ],
  screens: {
    bucket_list: [
      { event:"destination_added", props:"destination_name, source(search|suggestion|friend)" },
      { event:"destination_removed", props:"destination_name, reason" },
      { event:"destination_voted", props:"destination_name, vote(up|down), voter_id" },
      { event:"yes_no_decision", props:"item_id, decision(yes|no), time_to_decide_ms" },
      { event:"consensus_reached", props:"destinations_count, rounds_taken, time_to_consensus_ms" },
    ],
    timing_analysis: [
      { event:"timing_suggestion_viewed", props:"optimal_month, confidence_pct, destinations" },
      { event:"yes_no_decision", props:"accepted_month, revision_count, alternative_viewed" },
      { event:"heatmap_interaction", props:"destination, month_hovered, section_expanded" },
    ],
    interest_profiler: [
      { event:"quiz_started", props:"member_id" },
      { event:"question_answered", props:"member_id, category, activity, response(love|maybe|nope)" },
      { event:"quiz_completed", props:"member_id, questions_answered, time_to_complete_ms" },
      { event:"quiz_skipped", props:"member_id, questions_remaining" },
      { event:"group_analysis_viewed", props:"compatibility_score, overlaps_count" },
    ],
    health_fitness: [
      { event:"requirement_shown", props:"activity, requirement_type, severity(high|medium|low)" },
      { event:"requirement_acknowledged", props:"activity, cleared(yes|no), alternative_offered" },
      { event:"alternative_selected", props:"original_activity, alternative_activity" },
      { event:"checklist_generated", props:"member_id, items_count, vaccinations_count" },
    ],
    poi_discovery: [
      { event:"poi_card_viewed", props:"poi_id, poi_name, category, source(ai|manual)" },
      { event:"yes_no_decision", props:"poi_id, decision(yes|no), time_on_card_ms" },
      { event:"card_swipe", props:"poi_id, direction(left|right), swipe_velocity" },
      { event:"filter_applied", props:"filter_type, filter_value" },
    ],
    budget_setup: [
      { event:"budget_slider_changed", props:"old_value, new_value, preset_used" },
      { event:"allocation_adjusted", props:"category, old_pct, new_pct, method(slider|preset)" },
      { event:"budget_confirmed", props:"daily_amount, total_amount, allocation_preset" },
      { event:"budget_increase_accepted", props:"old_daily, new_daily, trigger(flight_overbudget)" },
    ],
    flight_search: [
      { event:"flight_preferences_set", props:"cabin_class, airline_pref, optimize_for" },
      { event:"flight_card_viewed", props:"airline, price, stops, position_in_list" },
      { event:"flight_selected", props:"airline, price, stops, was_recommended, budget_status" },
      { event:"flight_rejected", props:"airline, price, reason(too_expensive|too_many_stops)" },
      { event:"relaxed_search_triggered", props:"rejected_count, round_number" },
      { event:"over_budget_action", props:"action(increase|cheaper|back), overage_amount" },
    ],
    stays_booking: [
      { event:"stay_card_viewed", props:"stay_id, type, nightly_rate, position" },
      { event:"stay_selected", props:"stay_id, nightly_rate, nights, total_cost" },
      { event:"stay_rejected", props:"stay_id, reason" },
      { event:"budget_override", props:"overage_amount, approved(yes|no)" },
    ],
    itinerary: [
      { event:"itinerary_generated", props:"total_days, total_activities, algorithm_version" },
      { event:"day_expanded", props:"day_number, destination" },
      { event:"item_reordered", props:"day_number, item_id, old_position, new_position" },
      { event:"itinerary_approved", props:"edit_count, reorder_count, days_modified" },
    ],
    calendar_sync: [
      { event:"calendar_provider_selected", props:"provider(google|outlook|apple)" },
      { event:"sync_started", props:"events_count, members_count" },
      { event:"sync_completed", props:"events_created, duration_ms, errors_count" },
      { event:"sync_failed", props:"error_type, retry_count" },
    ],
    storyboard: [
      { event:"content_generated", props:"member_id, platform, style, ai_or_fallback" },
      { event:"content_copied", props:"member_id, platform, char_count" },
      { event:"content_edited", props:"member_id, platform, edit_type(minor|major)" },
      { event:"content_posted", props:"member_id, platform, was_edited" },
      { event:"content_regenerated", props:"member_id, platform, regenerate_count" },
    ],
    during_trip: [
      { event:"today_view_opened", props:"trip_day, activities_completed" },
      { event:"navigate_tapped", props:"activity_id, maps_provider" },
      { event:"expense_logged", props:"amount, category, split_type" },
      { event:"chat_message_sent", props:"message_type(text|photo|location|poll)" },
      { event:"poll_voted", props:"poll_id, option_selected" },
      { event:"sos_activated", props:"location_coords, members_notified" },
      { event:"reminder_dismissed", props:"activity_id, mins_before" },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   FUNNEL STAGES — 14-stage planning pipeline
   ═══════════════════════════════════════════════════════════════════════════ */
const FUNNEL_STAGES = [
  { key:"signup",        label:"Sign Up",          icon:"👤", users:10000, color:C.sky },
  { key:"trip_created",  label:"Trip Created",     icon:"✈️", users:7200,  color:C.sky },
  { key:"bucket_list",   label:"Bucket List",      icon:"📍", users:6800,  color:C.primaryLight },
  { key:"timing",        label:"Timing Agent",     icon:"📅", users:6100,  color:C.primaryLight },
  { key:"interests",     label:"Interest Profile", icon:"🎯", users:5400,  color:C.accent },
  { key:"health",        label:"Health Check",     icon:"🏥", users:5100,  color:C.accent },
  { key:"pois",          label:"POI Discovery",    icon:"📸", users:4700,  color:C.coral },
  { key:"budget",        label:"Budget Setup",     icon:"💰", users:4200,  color:C.coral },
  { key:"flights",       label:"Flight Booking",   icon:"🛫", users:3600,  color:C.rose },
  { key:"stays",         label:"Stays Booking",    icon:"🏨", users:3200,  color:C.rose },
  { key:"itinerary",     label:"Itinerary Built",  icon:"📋", users:2900,  color:C.lime },
  { key:"calendar_sync", label:"Calendar Sync",    icon:"🗓️", users:2400,  color:C.lime },
  { key:"trip_active",   label:"Trip Active",      icon:"🌍", users:2100,  color:C.amber },
  { key:"storyboard",    label:"Storyboard Used",  icon:"🎬", users:1200,  color:C.amber },
];

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK ANALYTICS DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const DAU_DATA = Array.from({length:30}, (_,i) => ({
  date: `Feb ${i+1}`, dau: 1200+Math.floor(Math.random()*800+Math.sin(i/3)*300),
  mau_slice: 4200+Math.floor(Math.random()*400),
}));

const TRIPS_DATA = Array.from({length:12}, (_,i) => ({
  month:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  created:180+Math.floor(Math.random()*120+i*15),
  completed:90+Math.floor(Math.random()*80+i*10),
  active:40+Math.floor(Math.random()*30),
}));

const REVENUE_DATA = Array.from({length:8}, (_,i) => ({
  week:`W${i+1}`, revenue:12000+Math.floor(Math.random()*8000+i*1500),
  bookings:45+Math.floor(Math.random()*25+i*5),
}));

const DEST_DATA = [
  { name:"Bali", trips:342, pct:18 }, { name:"Kyoto", trips:287, pct:15 },
  { name:"Santorini", trips:234, pct:12 }, { name:"Iceland", trips:198, pct:10 },
  { name:"Marrakech", trips:176, pct:9 }, { name:"Patagonia", trips:145, pct:7 },
  { name:"New Zealand", trips:132, pct:7 }, { name:"Portugal", trips:118, pct:6 },
];

const AGENT_PERF = [
  { agent:"Bucket List", emoji:"📍", avgTime:2.3, satisfaction:4.6, decisions:8420, acceptRate:78 },
  { agent:"Timing", emoji:"📅", avgTime:4.1, satisfaction:4.4, decisions:6100, acceptRate:72 },
  { agent:"Interests", emoji:"🎯", avgTime:5.8, satisfaction:4.7, decisions:5400, acceptRate:91 },
  { agent:"Health", emoji:"🏥", avgTime:1.9, satisfaction:4.3, decisions:5100, acceptRate:85 },
  { agent:"POI", emoji:"📸", avgTime:3.5, satisfaction:4.8, decisions:14200, acceptRate:65 },
  { agent:"Budget", emoji:"💰", avgTime:2.7, satisfaction:4.2, decisions:4200, acceptRate:81 },
  { agent:"Flights", emoji:"🛫", avgTime:6.2, satisfaction:4.1, decisions:3600, acceptRate:58 },
  { agent:"Stays", emoji:"🏨", avgTime:4.8, satisfaction:4.5, decisions:3200, acceptRate:63 },
  { agent:"Itinerary", emoji:"📋", avgTime:8.4, satisfaction:4.6, decisions:2900, acceptRate:88 },
  { agent:"Calendar", emoji:"🗓️", avgTime:1.2, satisfaction:4.7, decisions:2400, acceptRate:94 },
  { agent:"Storyboard", emoji:"🎬", avgTime:3.1, satisfaction:4.9, decisions:1200, acceptRate:76 },
];

const AB_TESTS = [
  { id:"AB-047", name:"Flight cards: 3 vs 5 options", status:"running", variant_a:"3 options", variant_b:"5 options",
    metric:"flight_selected rate", a_rate:58.2, b_rate:52.1, confidence:87, sample:2400, winner:"A",
    started:"Feb 10", screen:"flight_search" },
  { id:"AB-048", name:"Budget: pie chart vs bar chart", status:"running", variant_a:"Pie chart", variant_b:"Bar chart",
    metric:"allocation_adjusted count", a_rate:3.2, b_rate:4.7, confidence:94, sample:1800, winner:"B",
    started:"Feb 12", screen:"budget_setup" },
  { id:"AB-051", name:"POI cards: swipe vs button", status:"completed", variant_a:"Swipe gestures", variant_b:"Yes/No buttons",
    metric:"yes_no_decision rate", a_rate:71.4, b_rate:68.9, confidence:76, sample:4200, winner:"A",
    started:"Jan 28", screen:"poi_discovery" },
  { id:"AB-052", name:"Itinerary: auto-expand vs collapsed", status:"running", variant_a:"First 3 expanded", variant_b:"All collapsed",
    metric:"itinerary_approved rate", a_rate:88.1, b_rate:82.4, confidence:91, sample:1600, winner:"A",
    started:"Feb 18", screen:"itinerary" },
];

const SCREEN_METRICS = [
  { screen:"Bucket List", views:8420, avgTime:"2m 18s", bounceRate:6.2, conversionRate:94.4,
    custom:[{label:"Avg destinations/user",val:"3.7"},{label:"Time to consensus",val:"4.2 min"},{label:"Vote rounds",val:"2.1"}] },
  { screen:"Timing Agent", views:6100, avgTime:"4m 06s", bounceRate:8.1, conversionRate:89.6,
    custom:[{label:"1st suggestion accept",val:"68%"},{label:"Avg revisions",val:"1.4"},{label:"Alternative viewed",val:"42%"}] },
  { screen:"Interest Profiler", views:5400, avgTime:"5m 48s", bounceRate:4.8, conversionRate:92.3,
    custom:[{label:"Completion rate",val:"91%"},{label:"Avg questions answered",val:"22/26"},{label:"Simulate-all used",val:"31%"}] },
  { screen:"Health Check", views:5100, avgTime:"1m 54s", bounceRate:3.2, conversionRate:95.1,
    custom:[{label:"Ack rate",val:"95%"},{label:"Activity substitution",val:"18%"},{label:"Checklist downloads",val:"72%"}] },
  { screen:"POI Discovery", views:4700, avgTime:"3m 30s", bounceRate:7.5, conversionRate:87.2,
    custom:[{label:"Approval rate",val:"65%"},{label:"Avg swipes/session",val:"14.2"},{label:"Filter usage",val:"38%"}] },
  { screen:"Budget Setup", views:4200, avgTime:"2m 42s", bounceRate:5.1, conversionRate:90.8,
    custom:[{label:"Initial → final Δ",val:"+$22"},{label:"Increase accept rate",val:"44%"},{label:"Preset usage",val:"67%"}] },
  { screen:"Flight Search", views:3600, avgTime:"6m 12s", bounceRate:9.8, conversionRate:82.4,
    custom:[{label:"Options viewed",val:"4.2"},{label:"Price sensitivity",val:"$180 max Δ"},{label:"Relaxed search",val:"28%"}] },
  { screen:"Stays Booking", views:3200, avgTime:"4m 48s", bounceRate:6.4, conversionRate:85.7,
    custom:[{label:"Rejection reasons",val:"Price 62%"},{label:"Budget override",val:"23%"},{label:"Avg comparisons",val:"3.1"}] },
  { screen:"Itinerary", views:2900, avgTime:"8m 24s", bounceRate:2.1, conversionRate:93.8,
    custom:[{label:"Edits per user",val:"3.8"},{label:"Reorders",val:"2.1"},{label:"Days modified",val:"4.2/11"}] },
  { screen:"Calendar Sync", views:2400, avgTime:"1m 12s", bounceRate:4.2, conversionRate:94.1,
    custom:[{label:"Google",val:"72%"},{label:"Outlook",val:"18%"},{label:"Apple",val:"10%"}] },
  { screen:"Storyboard", views:1200, avgTime:"3m 06s", bounceRate:11.2, conversionRate:76.4,
    custom:[{label:"Generation rate",val:"89%"},{label:"Post rate",val:"34%"},{label:"Edit-before-post",val:"62%"}] },
];

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOM TOOLTIP
   ═══════════════════════════════════════════════════════════════════════════ */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px" }}>
      <p className="mono" style={{ fontSize:11, color:C.text3, marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize:13, fontWeight:600, color:p.color || C.text }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [liveCount, setLiveCount] = useState(847);
  const [expandedEvent, setExpandedEvent] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setLiveCount(prev => prev + Math.floor(Math.random()*7-3)), 3000);
    return () => clearInterval(t);
  }, []);

  const TABS = [
    { id:"overview", label:"Overview", icon:"📊" },
    { id:"funnel",   label:"Funnel", icon:"🔽" },
    { id:"screens",  label:"Screens", icon:"📱" },
    { id:"events",   label:"Events", icon:"⚡" },
    { id:"abtests",  label:"A/B Tests", icon:"🧪" },
    { id:"infra",    label:"Infrastructure", icon:"🏗️" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <CSS/>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"14px 24px", display:"flex", alignItems:"center", gap:16,
        position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, display:"flex",
            alignItems:"center", justifyContent:"center", fontSize:20,
            background:`linear-gradient(135deg,${C.primary}30,${C.accent}20)` }}>📊</div>
          <div>
            <h1 style={{ fontWeight:800, fontSize:18, letterSpacing:"-0.3px" }}>WanderPlan Analytics</h1>
            <p style={{ fontSize:12, color:C.text3 }}>Admin Dashboard · Real-time</p>
          </div>
        </div>

        <div style={{ flex:1 }}/>

        {/* Live indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:6, background:C.surfaceLight,
          borderRadius:999, padding:"5px 14px" }}>
          <div style={{ width:7, height:7, borderRadius:999, background:C.success,
            animation:"liveDot 2s infinite" }}/>
          <span className="mono" style={{ fontSize:12, color:C.success, fontWeight:600 }}>
            {liveCount.toLocaleString()} online
          </span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:C.text3 }}>
          <span>Feb 25, 2026</span>
        </div>
      </header>

      {/* ── TAB BAR ────────────────────────────────────────── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"0 24px", display:"flex", gap:4, overflowX:"auto" }}>
        {TABS.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding:"10px 16px", background:"none", border:"none",
                borderBottom:`2px solid ${active ? C.primaryLight : "transparent"}`,
                color:active ? C.text : C.text3, fontSize:13, fontWeight:active?700:500,
                cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                transition:"all .15s", whiteSpace:"nowrap" }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"20px 24px 60px" }}>

        {/* ═══════════════════════════════════════════════════
           TAB: OVERVIEW — KPIs + Charts
           ═══════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div style={{ animation:"fadeUp .35s ease-out" }}>
            {/* KPI Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:14, marginBottom:20 }}>
              {[
                { label:"DAU", value:"1,847", delta:"+12.3%", up:true, sub:"30-day avg: 1,640", color:C.primaryLight },
                { label:"MAU", value:"4,293", delta:"+8.7%", up:true, sub:"MoM growth", color:C.accent },
                { label:"Trips Created", value:"387", delta:"+22.1%", up:true, sub:"This month", color:C.coral },
                { label:"Completion Rate", value:"24.0%", delta:"-1.2%", up:false, sub:"Signup → Trip Active", color:C.rose },
                { label:"Booking Revenue", value:"$48.2K", delta:"+31.4%", up:true, sub:"This month (commission)", color:C.lime },
                { label:"Rev / Trip", value:"$124", delta:"+$8", up:true, sub:"Avg across bookings", color:C.amber },
                { label:"Avg Planning Time", value:"3.2 days", delta:"-0.4d", up:true, sub:"Signup → Approved", color:C.sky },
                { label:"NPS Score", value:"72", delta:"+4", up:true, sub:"Last 30 days", color:C.purple },
              ].map((kpi, i) => (
                <div key={i} style={{ background:C.surface, borderRadius:14, padding:"16px 18px",
                  border:`1px solid ${C.borderLight}`, animation:`fadeUp .3s ease-out ${i*.04}s both` }}>
                  <p style={{ fontSize:12, color:C.text3, marginBottom:6 }}>{kpi.label}</p>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontWeight:800, fontSize:24, color:kpi.color, letterSpacing:"-0.5px" }}>
                      {kpi.value}
                    </span>
                    <span style={{ fontSize:12, fontWeight:600,
                      color:kpi.up ? C.success : C.error }}>{kpi.delta}</span>
                  </div>
                  <p style={{ fontSize:11, color:C.text3, marginTop:4 }}>{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              {/* DAU/MAU Chart */}
              <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px",
                border:`1px solid ${C.borderLight}` }}>
                <p style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Daily Active Users (30d)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={DAU_DATA}>
                    <defs>
                      <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.primaryLight} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={C.primaryLight} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:C.text3}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:C.text3}} axisLine={false} tickLine={false} width={40}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="dau" stroke={C.primaryLight} fill="url(#dauGrad)"
                      strokeWidth={2} dot={false} name="DAU"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Trips Created Chart */}
              <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px",
                border:`1px solid ${C.borderLight}` }}>
                <p style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Trips by Month</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={TRIPS_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false}/>
                    <XAxis dataKey="month" tick={{fontSize:10,fill:C.text3}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:C.text3}} axisLine={false} tickLine={false} width={40}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="created" fill={C.accent} radius={[4,4,0,0]} name="Created"/>
                    <Bar dataKey="completed" fill={C.primaryLight} radius={[4,4,0,0]} name="Completed"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue + Top Destinations */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px",
                border:`1px solid ${C.borderLight}` }}>
                <p style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Weekly Revenue</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={REVENUE_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} vertical={false}/>
                    <XAxis dataKey="week" tick={{fontSize:10,fill:C.text3}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:C.text3}} axisLine={false} tickLine={false} width={40}
                      tickFormatter={v => `$${(v/1000).toFixed(0)}k`}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Line type="monotone" dataKey="revenue" stroke={C.lime} strokeWidth={2.5}
                      dot={{fill:C.lime,r:4}} name="Revenue"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background:C.surface, borderRadius:14, padding:"18px 20px",
                border:`1px solid ${C.borderLight}` }}>
                <p style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Top Destinations</p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {DEST_DATA.map((d, i) => (
                    <div key={d.name} style={{ display:"flex", alignItems:"center", gap:10,
                      animation:`slideL .25s ease-out ${i*.03}s both` }}>
                      <span style={{ width:20, fontSize:12, color:C.text3, fontWeight:600 }}>#{i+1}</span>
                      <span style={{ width:90, fontSize:13, fontWeight:600 }}>{d.name}</span>
                      <div style={{ flex:1, height:8, background:C.surfaceLight, borderRadius:999 }}>
                        <div style={{ height:"100%", width:`${d.pct*5}%`, borderRadius:999,
                          background:CHART_COLORS[i%CHART_COLORS.length], transition:"width .5s" }}/>
                      </div>
                      <span className="mono" style={{ fontSize:12, color:C.text2, width:50, textAlign:"right" }}>
                        {d.trips}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Agent Performance Table */}
            <div style={{ background:C.surface, borderRadius:14, overflow:"hidden",
              border:`1px solid ${C.borderLight}` }}>
              <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.borderLight}` }}>
                <p style={{ fontWeight:700, fontSize:14 }}>Agent Performance</p>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.borderLight}` }}>
                      {["Agent","Avg Time","Satisfaction","Decisions","Accept Rate"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left",
                          fontSize:11, color:C.text3, fontWeight:600, textTransform:"uppercase",
                          letterSpacing:"0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {AGENT_PERF.map((a, i) => (
                      <tr key={a.agent} style={{ borderBottom:`1px solid ${C.borderLight}`,
                        animation:`fadeUp .2s ease-out ${i*.03}s both` }}>
                        <td style={{ padding:"10px 16px", fontWeight:600 }}>
                          <span style={{ marginRight:6 }}>{a.emoji}</span>{a.agent}
                        </td>
                        <td style={{ padding:"10px 16px" }}>
                          <span className="mono" style={{ fontSize:12 }}>{a.avgTime}s</span>
                        </td>
                        <td style={{ padding:"10px 16px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:40, height:5, background:C.surfaceLight, borderRadius:999 }}>
                              <div style={{ height:"100%", width:`${(a.satisfaction/5)*100}%`, borderRadius:999,
                                background:a.satisfaction>=4.5?C.success:a.satisfaction>=4?C.amber:C.error }}/>
                            </div>
                            <span className="mono" style={{ fontSize:12 }}>{a.satisfaction}</span>
                          </div>
                        </td>
                        <td style={{ padding:"10px 16px" }}>
                          <span className="mono" style={{ fontSize:12 }}>{a.decisions.toLocaleString()}</span>
                        </td>
                        <td style={{ padding:"10px 16px" }}>
                          <span className="mono" style={{ fontSize:13, fontWeight:700,
                            color:a.acceptRate>=80?C.success:a.acceptRate>=60?C.amber:C.error }}>
                            {a.acceptRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           TAB: FUNNEL ANALYSIS
           ═══════════════════════════════════════════════════ */}
        {activeTab === "funnel" && (
          <div style={{ animation:"fadeUp .35s ease-out" }}>
            <h2 style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>14-Stage Planning Funnel</h2>
            <p style={{ fontSize:14, color:C.text3, marginBottom:20 }}>
              Track user progression from signup through trip completion. Identify drop-off points.
            </p>

            {/* Funnel visualization */}
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:24 }}>
              {FUNNEL_STAGES.map((stage, i) => {
                const maxUsers = FUNNEL_STAGES[0].users;
                const pct = (stage.users / maxUsers) * 100;
                const dropoff = i > 0 ? FUNNEL_STAGES[i-1].users - stage.users : 0;
                const dropPct = i > 0 ? ((dropoff / FUNNEL_STAGES[i-1].users) * 100).toFixed(1) : 0;
                const convRate = i > 0 ? ((stage.users / FUNNEL_STAGES[i-1].users) * 100).toFixed(1) : 100;

                return (
                  <div key={stage.key} style={{ display:"flex", alignItems:"center", gap:12,
                    animation:`slideL .3s ease-out ${i*.04}s both` }}>
                    <span style={{ width:28, textAlign:"center", fontSize:16 }}>{stage.icon}</span>
                    <span style={{ width:120, fontSize:13, fontWeight:600, color:C.text2 }}>{stage.label}</span>
                    <div style={{ flex:1, height:28, background:C.surfaceLight, borderRadius:6,
                      position:"relative", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, borderRadius:6,
                        background:`linear-gradient(90deg, ${stage.color}40, ${stage.color}80)`,
                        transition:"width .8s ease-out", display:"flex", alignItems:"center", paddingLeft:8 }}>
                        {pct > 15 && (
                          <span className="mono" style={{ fontSize:11, fontWeight:600, color:C.text }}>
                            {stage.users.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ width:70, textAlign:"right" }}>
                      <span className="mono" style={{ fontSize:13, fontWeight:700, color:C.text }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    {i > 0 && (
                      <div style={{ width:80, textAlign:"right" }}>
                        <span className="mono" style={{ fontSize:11,
                          color:Number(dropPct) > 15 ? C.error : Number(dropPct) > 8 ? C.warning : C.text3 }}>
                          -{dropoff.toLocaleString()} ({dropPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drop-off analysis cards */}
            <h3 style={{ fontWeight:700, fontSize:16, marginBottom:12 }}>Critical Drop-off Points</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              {[
                { stage:"Interests → Health", drop:"5.6%", abs:300, reason:"Quiz fatigue — users abandon after 20+ questions",
                  fix:"Add 'Quick mode' (8 questions) as alternative", severity:"low" },
                { stage:"POI → Budget", drop:"10.6%", abs:500, reason:"Decision fatigue from approving 14+ POIs individually",
                  fix:"Batch approve: 'Accept top 10 recommendations?'", severity:"medium" },
                { stage:"Budget → Flights", drop:"14.3%", abs:600, reason:"Sticker shock when seeing real flight prices vs. budget",
                  fix:"Show price preview during budget setup phase", severity:"high" },
                { stage:"Flights → Stays", drop:"11.1%", abs:400, reason:"Users book flights externally, don't return",
                  fix:"'Already booked?' flow to skip + import confirmation", severity:"high" },
                { stage:"Calendar → Active", drop:"12.5%", abs:300, reason:"Trip dates too far in future, users forget",
                  fix:"Pre-trip email sequence starting 30 days before", severity:"medium" },
                { stage:"Active → Storyboard", drop:"42.9%", abs:900, reason:"Feature not discovered during trip",
                  fix:"Push notification: 'Ready to share today's adventure?'", severity:"medium" },
              ].map((item, i) => (
                <div key={i} style={{ background:C.surface, borderRadius:12, padding:"14px 16px",
                  border:`1px solid ${item.severity==="high"?C.error+"30":C.borderLight}`,
                  animation:`fadeUp .3s ease-out ${i*.05}s both` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{item.stage}</span>
                    <span className="mono" style={{ fontSize:13, fontWeight:700,
                      color:item.severity==="high"?C.error:item.severity==="medium"?C.warning:C.text3 }}>
                      -{item.drop}
                    </span>
                  </div>
                  <p style={{ fontSize:12, color:C.text3, marginBottom:8, lineHeight:1.5 }}>{item.reason}</p>
                  <div style={{ background:`${C.success}10`, borderRadius:8, padding:"6px 10px" }}>
                    <p style={{ fontSize:11.5, color:C.success, lineHeight:1.4 }}>💡 {item.fix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           TAB: SCREEN METRICS
           ═══════════════════════════════════════════════════ */}
        {activeTab === "screens" && (
          <div style={{ animation:"fadeUp .35s ease-out" }}>
            <h2 style={{ fontWeight:800, fontSize:22, marginBottom:16 }}>Per-Screen Metrics</h2>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {SCREEN_METRICS.map((s, i) => (
                <div key={s.screen} style={{ background:C.surface, borderRadius:14, overflow:"hidden",
                  border:`1px solid ${C.borderLight}`, animation:`slideL .3s ease-out ${i*.04}s both` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 18px" }}>
                    <span style={{ fontWeight:700, fontSize:15, flex:1 }}>{s.screen}</span>
                    <div style={{ display:"flex", gap:16 }}>
                      {[
                        { label:"Views", val:s.views.toLocaleString(), color:C.sky },
                        { label:"Avg Time", val:s.avgTime, color:C.amber },
                        { label:"Bounce", val:`${s.bounceRate}%`, color:s.bounceRate>8?C.error:C.text2 },
                        { label:"Conversion", val:`${s.conversionRate}%`, color:s.conversionRate>90?C.success:s.conversionRate>80?C.amber:C.error },
                      ].map(m => (
                        <div key={m.label} style={{ textAlign:"center", minWidth:60 }}>
                          <p style={{ fontSize:10, color:C.text3 }}>{m.label}</p>
                          <p className="mono" style={{ fontSize:13, fontWeight:700, color:m.color }}>{m.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding:"0 18px 14px", display:"flex", gap:8 }}>
                    {s.custom.map(c => (
                      <div key={c.label} style={{ flex:1, background:C.surfaceLight, borderRadius:8,
                        padding:"8px 10px" }}>
                        <p style={{ fontSize:10, color:C.text3 }}>{c.label}</p>
                        <p className="mono" style={{ fontSize:14, fontWeight:700, color:C.primaryLight }}>{c.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           TAB: EVENT TAXONOMY
           ═══════════════════════════════════════════════════ */}
        {activeTab === "events" && (
          <div style={{ animation:"fadeUp .35s ease-out" }}>
            <h2 style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>Event Taxonomy</h2>
            <p style={{ fontSize:14, color:C.text3, marginBottom:16 }}>
              Structured event schema for every screen. {Object.values(EVENT_TAXONOMY.screens).flat().length + EVENT_TAXONOMY.global.length} events total.
            </p>

            {/* Base schema */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px", marginBottom:14,
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>📐 Base Event Schema</p>
              <pre className="mono" style={{ fontSize:12, lineHeight:1.6, color:C.primaryLight,
                background:C.bg, borderRadius:10, padding:14, overflow:"auto",
                border:`1px solid ${C.borderLight}` }}>{`interface AnalyticsEvent {
  event_name: string;          // e.g. "yes_no_decision"
  screen_name: string;         // e.g. "flight_search"
  properties: {
    trip_id: string;           // UUID
    user_id: string;           // UUID
    agent_id: string;          // e.g. "timing_agent"
    decision: "yes"|"no"|null;
    item_type: string;         // e.g. "flight", "poi"
    item_id: string;
    time_on_screen_ms: number;
    scroll_depth_percent: number;
    interaction_count: number;
    [key: string]: any;        // Custom props
  };
  timestamp: ISO8601;          // Auto-generated
  session_id: string;          // Auto-generated
  device: DeviceInfo;          // Auto-collected
}`}</pre>
            </div>

            {/* Global events */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px", marginBottom:14,
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>🌐 Global Events</p>
              {EVENT_TAXONOMY.global.map(e => (
                <div key={e.event} style={{ display:"flex", gap:10, padding:"6px 0",
                  borderBottom:`1px solid ${C.borderLight}` }}>
                  <code className="mono" style={{ fontSize:12, color:C.accent, minWidth:140 }}>{e.event}</code>
                  <span style={{ fontSize:12, color:C.text2, flex:1 }}>{e.desc}</span>
                  <span className="mono" style={{ fontSize:11, color:C.text3 }}>{e.props}</span>
                </div>
              ))}
            </div>

            {/* Per-screen events */}
            {Object.entries(EVENT_TAXONOMY.screens).map(([screen, events]) => (
              <div key={screen} style={{ background:C.surface, borderRadius:14, marginBottom:10,
                border:`1px solid ${C.borderLight}`, overflow:"hidden",
                animation:`fadeUp .25s ease-out` }}>
                <button onClick={() => setExpandedEvent(expandedEvent===screen?null:screen)}
                  style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"12px 18px", background:"none", border:"none", color:C.text,
                    cursor:"pointer" }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>
                    {screen.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}
                  </span>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span className="mono" style={{ fontSize:12, color:C.text3 }}>{events.length} events</span>
                    <span style={{ transform:expandedEvent===screen?"rotate(90deg)":"none",
                      transition:"transform .15s", fontSize:14 }}>▸</span>
                  </div>
                </button>
                {expandedEvent === screen && (
                  <div style={{ padding:"0 18px 14px", animation:"fadeIn .2s ease-out" }}>
                    {events.map(e => (
                      <div key={e.event} style={{ display:"flex", gap:8, padding:"6px 0",
                        borderBottom:`1px solid ${C.borderLight}` }}>
                        <code className="mono" style={{ fontSize:11.5, color:C.coral, minWidth:180 }}>{e.event}</code>
                        <span className="mono" style={{ fontSize:11, color:C.text3 }}>{e.props}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           TAB: A/B TESTS
           ═══════════════════════════════════════════════════ */}
        {activeTab === "abtests" && (
          <div style={{ animation:"fadeUp .35s ease-out" }}>
            <h2 style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>A/B Testing Framework</h2>
            <p style={{ fontSize:14, color:C.text3, marginBottom:16 }}>
              Serve different UX variants and measure impact on conversion. Powered by Mixpanel Experiments.
            </p>

            {/* Architecture card */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px", marginBottom:16,
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>🧪 A/B Test Config Schema</p>
              <pre className="mono" style={{ fontSize:12, lineHeight:1.6, color:C.accent,
                background:C.bg, borderRadius:10, padding:14, overflow:"auto",
                border:`1px solid ${C.borderLight}` }}>{`interface ABTest {
  id: string;                   // "AB-047"
  name: string;                 // Human-readable
  screen: ScreenName;           // Target screen
  status: "draft"|"running"|"completed"|"paused";
  variant_a: VariantConfig;     // Control
  variant_b: VariantConfig;     // Treatment
  allocation: number;           // % of traffic (default 50/50)
  metric: string;               // Primary metric to measure
  min_sample: number;           // Min users before significance
  confidence_threshold: number; // Default 95%
  started_at: ISO8601;
  ended_at?: ISO8601;
}

// Client-side assignment
const variant = mixpanel.get_variant("AB-047");
if (variant === "B") {
  showBarChart(); // Treatment
} else {
  showPieChart(); // Control (default)
}`}</pre>
            </div>

            {/* Active tests */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {AB_TESTS.map((test, i) => (
                <div key={test.id} style={{ background:C.surface, borderRadius:14, padding:"16px 18px",
                  border:`1px solid ${test.status==="running"?C.accent+"30":C.borderLight}`,
                  animation:`slideL .3s ease-out ${i*.06}s both` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <span className="mono" style={{ fontSize:11, color:C.text3, fontWeight:600 }}>{test.id}</span>
                    <span style={{ fontWeight:700, fontSize:14, flex:1 }}>{test.name}</span>
                    <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:600,
                      background:test.status==="running"?`${C.success}20`:C.surfaceLight,
                      color:test.status==="running"?C.success:C.text3 }}>
                      {test.status==="running"?"● Running":"✓ Completed"}
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                    <div style={{ flex:1, background:test.winner==="A"?`${C.primaryLight}10`:C.surfaceLight,
                      borderRadius:10, padding:"10px 14px",
                      border:`1.5px solid ${test.winner==="A"?C.primaryLight+"40":"transparent"}` }}>
                      <p style={{ fontSize:11, color:C.text3, marginBottom:2 }}>Variant A (Control)</p>
                      <p style={{ fontWeight:700, fontSize:14 }}>{test.variant_a}</p>
                      <p className="mono" style={{ fontSize:18, fontWeight:800, marginTop:4,
                        color:test.winner==="A"?C.primaryLight:C.text2 }}>{test.a_rate}%</p>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", fontSize:14, color:C.text3 }}>vs</div>
                    <div style={{ flex:1, background:test.winner==="B"?`${C.coral}10`:C.surfaceLight,
                      borderRadius:10, padding:"10px 14px",
                      border:`1.5px solid ${test.winner==="B"?C.coral+"40":"transparent"}` }}>
                      <p style={{ fontSize:11, color:C.text3, marginBottom:2 }}>Variant B (Treatment)</p>
                      <p style={{ fontWeight:700, fontSize:14 }}>{test.variant_b}</p>
                      <p className="mono" style={{ fontSize:18, fontWeight:800, marginTop:4,
                        color:test.winner==="B"?C.coral:C.text2 }}>{test.b_rate}%</p>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:16, fontSize:12, color:C.text3 }}>
                    <span>📏 Metric: <span style={{color:C.text2}}>{test.metric}</span></span>
                    <span>🎯 Confidence: <span className="mono" style={{
                      color:test.confidence>=95?C.success:test.confidence>=90?C.amber:C.text3,fontWeight:600 }}>
                      {test.confidence}%</span></span>
                    <span>👥 Sample: <span className="mono">{test.sample.toLocaleString()}</span></span>
                    <span>📅 {test.started}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
           TAB: INFRASTRUCTURE
           ═══════════════════════════════════════════════════ */}
        {activeTab === "infra" && (
          <div style={{ animation:"fadeUp .35s ease-out" }}>
            <h2 style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>Data Infrastructure</h2>
            <p style={{ fontSize:14, color:C.text3, marginBottom:20 }}>
              Client-side tracking → Event pipeline → Warehouse → Dashboards
            </p>

            {/* Pipeline diagram */}
            <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"stretch" }}>
              {[
                { label:"Client SDK", tech:"Mixpanel JS", icon:"📱", color:C.accent,
                  detail:"Track events client-side\nAuto-collect device/session\nA/B test variant assignment\nmixpanel.track() on every interaction" },
                { label:"Event Stream", tech:"Mixpanel → Webhook", icon:"🔄", color:C.coral,
                  detail:"Real-time event ingestion\nWebhook POST to our API\nBatch every 30 seconds\nRetry with exponential backoff" },
                { label:"PostgreSQL", tech:"analytics_events", icon:"🗄️", color:C.primaryLight,
                  detail:"Raw events table\nPartitioned by month\nIndexed: trip_id, user_id, timestamp\nRetention: 2 years" },
                { label:"BigQuery", tech:"Nightly sync", icon:"☁️", color:C.sky,
                  detail:"Full historical data\nCost-effective at scale\nSync via Cloud Functions\nDbt transforms daily" },
                { label:"Metabase", tech:"Dashboards", icon:"📊", color:C.lime,
                  detail:"Admin dashboard (this page)\nSelf-serve SQL explorer\nScheduled email reports\nEmbeddable charts" },
              ].map((node, i) => (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                  animation:`fadeUp .3s ease-out ${i*.06}s both` }}>
                  <div style={{ background:C.surface, borderRadius:14, padding:"14px 12px", flex:1,
                    border:`1px solid ${node.color}25`, textAlign:"center" }}>
                    <div style={{ width:40, height:40, borderRadius:12, margin:"0 auto 8px",
                      background:`${node.color}15`, display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:22 }}>{node.icon}</div>
                    <p style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{node.label}</p>
                    <p className="mono" style={{ fontSize:11, color:node.color }}>{node.tech}</p>
                    <pre style={{ fontSize:10, color:C.text3, marginTop:8, textAlign:"left",
                      lineHeight:1.5, whiteSpace:"pre-wrap" }}>{node.detail}</pre>
                  </div>
                  {i < 4 && (
                    <div style={{ textAlign:"center", padding:"6px 0", color:C.text3, fontSize:16 }}>→</div>
                  )}
                </div>
              ))}
            </div>

            {/* PostgreSQL Schema */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px", marginBottom:14,
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>🗄️ PostgreSQL: analytics_events Table</p>
              <pre className="mono" style={{ fontSize:12, lineHeight:1.6, color:C.primaryLight,
                background:C.bg, borderRadius:10, padding:14, overflow:"auto",
                border:`1px solid ${C.borderLight}` }}>{`CREATE TABLE analytics_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name    VARCHAR(100) NOT NULL,
  screen_name   VARCHAR(50) NOT NULL,
  trip_id       UUID REFERENCES trips(id),
  user_id       UUID REFERENCES users(id) NOT NULL,
  session_id    UUID NOT NULL,
  agent_id      VARCHAR(50),
  properties    JSONB DEFAULT '{}',
  device_info   JSONB DEFAULT '{}',
  timestamp     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Monthly partitions (auto-created by pg_partman)
CREATE TABLE analytics_events_2026_02
  PARTITION OF analytics_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Performance indexes
CREATE INDEX idx_events_trip     ON analytics_events (trip_id, timestamp);
CREATE INDEX idx_events_user     ON analytics_events (user_id, timestamp);
CREATE INDEX idx_events_screen   ON analytics_events (screen_name, event_name);
CREATE INDEX idx_events_session  ON analytics_events (session_id);
CREATE INDEX idx_events_props    ON analytics_events USING GIN (properties);

-- Materialized views for dashboard queries
CREATE MATERIALIZED VIEW mv_daily_metrics AS
SELECT
  date_trunc('day', timestamp) AS day,
  screen_name,
  event_name,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users,
  AVG((properties->>'time_on_screen_ms')::int) AS avg_time_ms
FROM analytics_events
WHERE timestamp > NOW() - INTERVAL '90 days'
GROUP BY 1, 2, 3
WITH DATA;

-- Refresh nightly via cron
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;`}</pre>
            </div>

            {/* Mixpanel Client SDK */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px", marginBottom:14,
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>📱 Mixpanel Client Implementation</p>
              <pre className="mono" style={{ fontSize:12, lineHeight:1.6, color:C.accent,
                background:C.bg, borderRadius:10, padding:14, overflow:"auto",
                border:`1px solid ${C.borderLight}` }}>{`// analytics.ts — WanderPlan event tracking module
import mixpanel from 'mixpanel-browser';

mixpanel.init('YOUR_MIXPANEL_TOKEN', {
  track_pageview: true,
  persistence: 'localStorage',
});

// Type-safe tracking wrapper
export function track<T extends keyof EventMap>(
  event: T,
  screen: ScreenName,
  props: EventMap[T]
) {
  const baseProps = {
    screen_name: screen,
    trip_id: getCurrentTripId(),
    user_id: getCurrentUserId(),
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
  };

  // Send to Mixpanel (client analytics)
  mixpanel.track(event, { ...baseProps, ...props });

  // Also stream to our API (→ PostgreSQL)
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: event,
      ...baseProps,
      properties: props,
    }),
    keepalive: true, // survives page unload
  });
}

// Usage in components:
track('yes_no_decision', 'flight_search', {
  item_id: 'JL-1247',
  item_type: 'flight',
  decision: 'yes',
  time_on_screen_ms: 14200,
  interaction_count: 3,
  agent_id: 'flight_agent',
});

// Auto screen tracking via React Router
useEffect(() => {
  track('screen_view', screenName, {
    referrer: previousScreen,
    scroll_depth_percent: 0,
  });
}, [screenName]);`}</pre>
            </div>

            {/* BigQuery Sync */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px", marginBottom:14,
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>☁️ BigQuery Nightly Sync</p>
              <pre className="mono" style={{ fontSize:12, lineHeight:1.6, color:C.sky,
                background:C.bg, borderRadius:10, padding:14, overflow:"auto",
                border:`1px solid ${C.borderLight}` }}>{`-- dbt model: stg_analytics_events.sql
-- Runs nightly at 02:00 UTC via Cloud Scheduler

WITH raw_events AS (
  SELECT
    id,
    event_name,
    screen_name,
    trip_id,
    user_id,
    session_id,
    agent_id,
    properties,
    timestamp,
    -- Extract common properties
    CAST(JSON_EXTRACT_SCALAR(properties, '$.decision') AS STRING)
      AS decision,
    CAST(JSON_EXTRACT_SCALAR(properties, '$.time_on_screen_ms') AS INT64)
      AS time_on_screen_ms,
    CAST(JSON_EXTRACT_SCALAR(properties, '$.scroll_depth_percent') AS FLOAT64)
      AS scroll_depth_pct,
  FROM \`wanderplan.raw.analytics_events\`
  WHERE DATE(timestamp) = DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
)

SELECT
  *,
  -- Funnel stage assignment
  CASE screen_name
    WHEN 'bucket_list'    THEN 1
    WHEN 'timing_analysis' THEN 2
    WHEN 'interest_profiler' THEN 3
    WHEN 'health_fitness'  THEN 4
    WHEN 'poi_discovery'   THEN 5
    WHEN 'budget_setup'    THEN 6
    WHEN 'flight_search'   THEN 7
    WHEN 'stays_booking'   THEN 8
    WHEN 'itinerary'       THEN 9
    WHEN 'calendar_sync'   THEN 10
    ELSE 0
  END AS funnel_stage_num

FROM raw_events;`}</pre>
            </div>

            {/* Data flow summary */}
            <div style={{ background:C.surface, borderRadius:14, padding:"16px 18px",
              border:`1px solid ${C.borderLight}` }}>
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>📋 SLA & Data Governance</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[
                  { label:"Event Latency", val:"< 2s", desc:"Client → Mixpanel" },
                  { label:"API Ingest", val:"< 500ms", desc:"Webhook → PostgreSQL" },
                  { label:"BQ Freshness", val:"< 6h", desc:"Nightly + catchup" },
                  { label:"Dashboard Refresh", val:"5 min", desc:"Metabase auto-refresh" },
                  { label:"Data Retention", val:"2 years", desc:"PG; unlimited in BQ" },
                  { label:"PII Handling", val:"Hashed", desc:"user_id = UUID, no emails in events" },
                ].map(item => (
                  <div key={item.label} style={{ background:C.surfaceLight, borderRadius:10, padding:"10px 12px" }}>
                    <p style={{ fontSize:11, color:C.text3 }}>{item.label}</p>
                    <p className="mono" style={{ fontSize:16, fontWeight:700, color:C.primaryLight }}>{item.val}</p>
                    <p style={{ fontSize:10, color:C.text3, marginTop:2 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
