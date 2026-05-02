import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */
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
function nextDashboardExpenseId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `expense-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL CSS
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Source+Sans+3:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Source Sans 3',sans-serif;background:${T.bg};color:${T.text};-webkit-font-smoothing:antialiased}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(77,168,218,0.35);border-radius:6px}
  .hd{font-family:'DM Sans',sans-serif}
  input,textarea,select{font-family:'Source Sans 3',sans-serif}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
  @keyframes slideR{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes countPulse{0%{transform:scale(1)}50%{transform:scale(1.03)}100%{transform:scale(1)}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  ::-webkit-scrollbar{width:6px;height:6px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:99px}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════════════════════════════════════ */
const Ic = ({n,s=18,c="currentColor"}) => {
  const p = {
    home:<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeWidth="1.8" stroke={c} fill="none"/>,
    map:<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    user:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="12" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/></>,
    users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeWidth="1.8" stroke={c} fill="none"/></>,
    settings:<><circle cx="12" cy="12" r="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.8" stroke={c} fill="none"/></>,
    code:<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
    x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
    plane:<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={c}/>,
    hotel:<path d="M3 21V7a2 2 0 012-2h6v16M21 21V11a2 2 0 00-2-2h-4v12" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    food:<path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    clock:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 6v6l4 2" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
    star:<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={c}/>,
    dollar:<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
    camera:<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z" strokeWidth="1.8" stroke={c} fill="none"/>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8" stroke={c} fill="none"/><path d="M16 2v4M8 2v4M3 10h18" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
    chat:<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeWidth="1.8" stroke={c} fill="none"/>,
    edit:<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="1.8" stroke={c} fill="none"/>,
    chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevL:<path d="M15 18l-6-6 6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    bell:<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeWidth="1.8" stroke={c} fill="none"/>,
    shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.8" stroke={c} fill="none"/>,
    link:<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    download:<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    trash:<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
    plus:<path d="M12 5v14M5 12h14" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
    sos:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 8v4M12 16h.01" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/></>,
    share:<><circle cx="18" cy="5" r="3" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="6" cy="12" r="3" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="18" cy="19" r="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" strokeWidth="1.8" stroke={c} fill="none"/></>,
    wifi:<path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{p[n]||p.map}</svg>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const TRIPS = [
  { id:1, name:"Japan Cherry Blossom", dest:"Tokyo → Kyoto", status:"active", dates:"Jun 15–28, 2025", members:4, days:10, budget:2000, spent:820, gradient:`linear-gradient(135deg,${T.secondary}30,${T.secondaryLight}15)`, emoji:"🇯🇵", departure:"2025-06-15T10:30:00" },
  { id:2, name:"Greek Island Hopping", dest:"Athens → Santorini → Mykonos", status:"confirmed", dates:"Aug 5–18, 2025", members:2, days:14, budget:3100, spent:0, gradient:`linear-gradient(135deg,${T.accent}30,${T.primary}15)`, emoji:"🇬🇷", departure:"2025-08-05T08:00:00" },
  { id:3, name:"Peru Adventure", dest:"Lima → Cusco → Machu Picchu", status:"planning", dates:"Oct 2–10, 2025", members:6, days:8, budget:1800, spent:0, gradient:`linear-gradient(135deg,${T.success}25,${T.primary}10)`, emoji:"🇵🇪" },
  { id:4, name:"Bali Wellness Retreat", dest:"Ubud → Seminyak", status:"completed", dates:"Jan 10–20, 2025", members:3, days:10, budget:2500, spent:2340, gradient:`linear-gradient(135deg,#8B5CF620,${T.accent}15)`, emoji:"🇮🇩" },
  { id:5, name:"Morocco Discovery", dest:"Marrakech → Fes → Sahara", status:"planning", dates:"Nov 15–25, 2025", members:4, days:10, budget:1600, spent:0, gradient:`linear-gradient(135deg,${T.warning}25,${T.secondary}15)`, emoji:"🇲🇦" },
];

const MEMBERS = [
  { name:"James Wilson", initials:"JW", role:"Organizer", interests:["Photography","Hiking","Wine"], diet:"None", fitness:"Moderate" },
  { name:"Sarah Wilson", initials:"SW", role:"Member", interests:["Culture","Food","Art"], diet:"Vegetarian", fitness:"Light" },
  { name:"Alex Chen", initials:"AC", role:"Member", interests:["Hiking","Photography","Adventure"], diet:"None", fitness:"Athletic" },
  { name:"Priya Sharma", initials:"PS", role:"Member", interests:["Food","Culture","Shopping"], diet:"Vegan", fitness:"Moderate" },
];

const TODAY_ITEMS = [
  { time:"08:00",type:"meal",title:"Breakfast at Karma Restaurant",loc:"Fira",cost:28,done:true },
  { time:"09:30",type:"activity",title:"Caldera Hiking Trail",loc:"Fira → Oia",cost:0,done:true },
  { time:"13:00",type:"meal",title:"Lunch at Ammoudi Fish Tavern",loc:"Ammoudi Bay",cost:45,done:false },
  { time:"15:00",type:"activity",title:"Wine Tasting at Santo Wines",loc:"Pyrgos",cost:35,done:false },
  { time:"18:30",type:"rest",title:"Golden Hour at Oia Castle",loc:"Oia",cost:0,done:false },
  { time:"20:00",type:"meal",title:"Dinner at Lycabettus",loc:"Oia",cost:85,done:false },
];

const STORYBOARD = [
  { platform:"Instagram", caption:"Golden hour at Oia Castle — this view is unreal! 🌅", hashtags:["#Santorini","#GoldenHour","#Greece"], status:"draft" },
  { platform:"Twitter", caption:"Day 2 of our Santorini adventure. The caldera hike was breathtaking!", hashtags:["#TravelGoals","#Santorini"], status:"posted" },
  { platform:"TikTok", caption:"POV: You're hiking along a volcano in Greece 🌋", hashtags:["#Travel","#Greece","#Hiking"], status:"draft" },
];

const PROMPTS = [
  { id:1, agent:"Destination Agent", emoji:"🌍", name:"Destination Matcher", prompt:"Given group interests: {{interests}}\nBudget: {{budget}}\nDates: {{dates}}\n\nRank top 5 destinations by match score (0-100). Include best months, highlights, and safety notes.", uses:342 },
  { id:2, agent:"Timing Agent", emoji:"📅", name:"Travel Window Optimizer", prompt:"Analyze destinations: {{destinations}}\n\nFor each, rate months 1-12 on: weather (1-5), crowd level (1-5 inverse), price (1-5 inverse). Return heatmap data and recommended window.", uses:298 },
  { id:3, agent:"Interest Profiler", emoji:"🎯", name:"Group Interest Survey", prompt:"For user {{name}}, ask binary yes/no about these activities: {{activity_list}}\n\nBuild interest profile. Weight answers by enthusiasm. Identify group overlaps and unique interests.", uses:412 },
  { id:4, agent:"POI Discovery", emoji:"📍", name:"Activity Curator", prompt:"Destinations: {{destinations}}\nGroup interests: {{group_interests}}\nBudget: {{daily_budget}}\n\nFind top 20 POIs. Score each by hobby match, rating, uniqueness. Include duration, cost, and booking requirements.", uses:567 },
  { id:5, agent:"Budget Agent", emoji:"💰", name:"Budget Allocator", prompt:"Total budget: {{total}}\nDuration: {{days}} days\nDestinations: {{destinations}}\n\nAllocate across flights (30%), stays (35%), food (20%), activities (10%), buffer (5%). Flag if any category is insufficient.", uses:234 },
  { id:6, agent:"Flight Agent", emoji:"✈️", name:"Flight Optimizer", prompt:"From: {{origin}}\nTo: {{destination}}\nDates: {{dates}}\nClass: {{class}}\nBudget: {{budget}}\n\nFind top 5 options optimizing for price/schedule balance. Include layover analysis and seat recommendations.", uses:189 },
  { id:7, agent:"Dining Agent", emoji:"🍽️", name:"Restaurant Curator", prompt:"Destination: {{destination}}\nDietary needs: {{diets}}\nBudget per meal: {{meal_budget}}\n\nSuggest breakfast, lunch, dinner for each day. Match cuisine to local specialties. Note reservations required.", uses:321 },
  { id:8, agent:"Health Agent", emoji:"🏥", name:"Health Requirements Checker", prompt:"Destinations: {{destinations}}\nActivities: {{activities}}\n\nList all health requirements: vaccinations, certifications, fitness levels, travel insurance needs. Categorize as mandatory/recommended/optional.", uses:156 },
];

const LOCAL_AUTH_USERS_KEY = "wanderplan.auth.users";
const LOCAL_AUTH_SESSION_KEY = "wanderplan.auth.session";
const LOCAL_PROFILE_BY_EMAIL_KEY = "wanderplan.profile.byEmail";
const LOCAL_CREW_LINKS_KEY = "wanderplan.crew.links";
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

function readJsonStorage(key) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures.
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function duplicateCrewInviteMessageForStatus(status) {
  return String(status || "").trim().toLowerCase() === "joined"
    ? "Already a member."
    : "This person is already invited.";
}

export function findCrewMemberByEmail(members = [], email = "") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return (
    members.find((member) => normalizeEmail(member?.email) === normalizedEmail) || null
  );
}

function defaultNameFromEmail(email) {
  const localPart = normalizeEmail(email).split("@")[0] || "";
  if (!localPart) return "Traveler";
  return localPart
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function splitName(name) {
  const tokens = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "Traveler", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };
  return { firstName: tokens[0], lastName: tokens.slice(1).join(" ") };
}

function initialsFromName(name) {
  const tokens = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (tokens.length === 0) return "U";
  return tokens.map((token) => token.charAt(0).toUpperCase()).join("");
}

function loadViewerProfile() {
  const session = readJsonStorage(LOCAL_AUTH_SESSION_KEY);
  const email = normalizeEmail(session?.email || "traveler@example.com");
  const profilesByEmail = readJsonStorage(LOCAL_PROFILE_BY_EMAIL_KEY);
  const stored = email ? profilesByEmail[email] : null;
  const name =
    String(stored?.name || session?.profile_name || session?.name || "").trim() ||
    "Traveler";
  const { firstName, lastName } = splitName(name);
  return {
    name,
    firstName,
    lastName,
    email,
    initials: initialsFromName(name),
    phone: String(stored?.phone || "").trim() || "+1 555-1234",
    travelStyle: String(stored?.travel_style || "").trim() || "couple",
    budgetPreference: String(stored?.budget_preference || "").trim() || "moderate",
    interests:
      Array.isArray(stored?.interests) && stored.interests.length > 0
        ? stored.interests
        : ["Photography", "Hiking", "Culture"],
    dietary: String(stored?.dietary || "").trim() || "None",
    fitness: String(stored?.fitness || "").trim() || "Moderate",
    planLabel: "Premium Plan",
  };
}

function saveViewerProfile(email, updates) {
  const viewerEmail = normalizeEmail(email);
  if (!viewerEmail) return;
  const profilesByEmail = readJsonStorage(LOCAL_PROFILE_BY_EMAIL_KEY);
  const existing = profilesByEmail[viewerEmail] || {};
  const next = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
    created_at: existing.created_at || new Date().toISOString(),
  };
  profilesByEmail[viewerEmail] = next;
  writeJsonStorage(LOCAL_PROFILE_BY_EMAIL_KEY, profilesByEmail);

  const session = readJsonStorage(LOCAL_AUTH_SESSION_KEY);
  if (normalizeEmail(session?.email) === viewerEmail && next.name) {
    writeJsonStorage(LOCAL_AUTH_SESSION_KEY, {
      ...session,
      name: next.name,
      profile_name: next.name,
    });
  }
}

function loadCrewMembersForViewer(viewerEmail) {
  const viewer = normalizeEmail(viewerEmail);
  if (!viewer) return [];
  const links = readJsonStorage(LOCAL_CREW_LINKS_KEY);
  const profilesByEmail = readJsonStorage(LOCAL_PROFILE_BY_EMAIL_KEY);
  const authUsers = readJsonStorage(LOCAL_AUTH_USERS_KEY);
  const connected = Array.isArray(links[viewer]) ? links[viewer] : [];
  const uniqueEmails = [...new Set(connected.map(normalizeEmail).filter(Boolean))];

  return uniqueEmails.map((email) => {
    const stored = profilesByEmail[email] || {};
    const name = String(stored?.name || "").trim() || defaultNameFromEmail(email);
    const interests =
      Array.isArray(stored?.interests) && stored.interests.length > 0 ? stored.interests : [];
    const hasAccount = Boolean(authUsers[email]) || Boolean(profilesByEmail[email]);
    return {
      email,
      name,
      initials: initialsFromName(name),
      role: "Member",
      interests,
      diet: String(stored?.dietary || "").trim() || "Not shared yet",
      fitness: String(stored?.fitness || "").trim() || "Not shared yet",
      status: hasAccount ? "Joined" : "Invited",
    };
  });
}

async function sendCrewInviteEmail(ownerEmail, ownerName, invitedEmail) {
  const response = await fetch(`${API_BASE}/crew/invite-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviter_email: ownerEmail,
      inviter_name: ownerName,
      invitee_email: invitedEmail,
    }),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text || "" };
  }
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || `HTTP ${response.status}`;
    throw new Error(String(detail || "Invite email failed"));
  }
  return payload;
}

async function connectCrewMembers(ownerEmail, invitedEmail, ownerName = "Traveler") {
  const owner = normalizeEmail(ownerEmail);
  const invitee = normalizeEmail(invitedEmail);
  if (!owner || !invitee) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (owner === invitee) {
    return { ok: false, error: "You cannot invite your own email." };
  }
  const links = readJsonStorage(LOCAL_CREW_LINKS_KEY);
  const ownerLinks = new Set(Array.isArray(links[owner]) ? links[owner].map(normalizeEmail) : []);
  const inviteeLinks = new Set(Array.isArray(links[invitee]) ? links[invitee].map(normalizeEmail) : []);
  const isAlreadyLinked = ownerLinks.has(invitee) || inviteeLinks.has(owner);
  if (isAlreadyLinked) {
    const authUsers = readJsonStorage(LOCAL_AUTH_USERS_KEY);
    const profilesByEmail = readJsonStorage(LOCAL_PROFILE_BY_EMAIL_KEY);
    const hasAccount = Boolean(authUsers[invitee]) || Boolean(profilesByEmail[invitee]);
    return {
      ok: false,
      error: duplicateCrewInviteMessageForStatus(hasAccount ? "Joined" : "Invited"),
    };
  }
  ownerLinks.add(invitee);
  inviteeLinks.add(owner);
  links[owner] = [...ownerLinks];
  links[invitee] = [...inviteeLinks];
  writeJsonStorage(LOCAL_CREW_LINKS_KEY, links);
  try {
    const inviteResp = await sendCrewInviteEmail(owner, ownerName, invitee);
    const currentOriginLink = typeof window !== "undefined" ? `${window.location.origin}/?entry=home` : "";
    const fallbackLink = currentOriginLink || inviteResp?.invite_link || "";
    return {
      ok: true,
      emailSent: Boolean(inviteResp?.email_sent),
      emailError: inviteResp?.email_error || "",
      deliveryMode: String(inviteResp?.delivery_mode || "").trim().toLowerCase() || "link_only",
      inviteLink: fallbackLink,
    };
  } catch (error) {
    return {
      ok: true,
      emailSent: false,
      emailError: error?.message || "Invite saved but email could not be sent.",
      deliveryMode: "link_only",
      inviteLink: typeof window !== "undefined" ? `${window.location.origin}/?entry=home` : "",
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard({ onOpenFlow = () => {} }) {
  const [page, setPage] = useState("trips"); // trips | active | detail | profile | crew | prompts
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [viewer, setViewer] = useState(() => loadViewerProfile());
  const [crewMembers, setCrewMembers] = useState(() => loadCrewMembersForViewer(loadViewerProfile().email));
  const dashboardMembers = [
    {
      name: viewer.name,
      initials: viewer.initials,
      role: "Organizer",
      interests: viewer.interests || [],
      diet: viewer.dietary || "None",
      fitness: viewer.fitness || "Moderate",
    },
    ...crewMembers.map((member) => ({
      name: member.name,
      initials: member.initials,
      role: "Member",
      interests: member.interests,
      diet: member.diet,
      fitness: member.fitness,
    })),
  ];

  const flowNavItems = [
    { id: "bucket-list", icon: "map", label: "Bucket List" },
    { id: "wizard", icon: "home", label: "Trip Wizard" },
    { id: "analytics", icon: "code", label: "Analytics" },
    { id: "budget", icon: "dollar", label: "Budget" },
    { id: "interest-health", icon: "shield", label: "Health Compatibility" },
    { id: "interest-profiler", icon: "users", label: "Interest Profiler" },
    { id: "timing", icon: "clock", label: "Best Time To Travel" },
  ];
  const isTripsPage = page === "trips" || page === "detail";

  const openTrip = (trip) => {
    setSelectedTrip(trip);
    if (trip.status === "active") setPage("active");
    else { setPage("detail"); setDetailTab("overview"); }
  };

  const openPlannerFlow = (flowId) => {
    if (typeof onOpenFlow === "function") {
      onOpenFlow(flowId);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("entry", flowId);
    const query = params.toString();
    window.location.assign(`${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const handleProfileSave = (updates) => {
    saveViewerProfile(viewer.email, updates);
    const nextViewer = loadViewerProfile();
    setViewer(nextViewer);
    setCrewMembers(loadCrewMembersForViewer(nextViewer.email));
  };

  const handleInviteMember = async (email) => {
    const result = await connectCrewMembers(viewer.email, email, viewer.name || "Traveler");
    if (result.ok) {
      setCrewMembers(loadCrewMembersForViewer(viewer.email));
    }
    return result;
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex" }}>
      <CSS/>

      {/* ── SIDEBAR ──────────────────────────────────────────────── */}
      <aside style={{ width:240, background:T.surface, borderRight:`1px solid ${T.borderLight}`,
        padding:"20px 0", display:"flex", flexDirection:"column", flexShrink:0,
        boxShadow:"1px 0 8px rgba(26,26,46,0.03)" }}>

        {/* Logo */}
        <div style={{ padding:"0 20px 24px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10,
            background:`linear-gradient(135deg,${T.primary},${T.accent})`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Ic n="map" s={17} c="#fff"/>
          </div>
          <span className="hd" style={{ fontWeight:700, fontSize:17, color:T.text }}>WanderPlan</span>
        </div>

        {/* New Trip */}
        <div style={{ padding:"0 16px", marginBottom:20 }}>
          <button className="hd" style={{ width:"100%", padding:"11px 16px", borderRadius:12, border:"none",
            background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`, color:"#fff",
            fontWeight:600, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", gap:8,
            boxShadow:`0 2px 10px ${T.primary}30`, transition:"all .2s", minHeight:44 }}
            onClick={() => openPlannerFlow("wizard")}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="none"}>
            <Ic n="plus" s={16} c="#fff"/> New Trip
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, display:"flex", flexDirection:"column", gap:2, padding:"0 10px", overflowY:"auto" }}>
          <p style={{ fontSize:11, fontWeight:700, letterSpacing:".06em", color:T.text3, margin:"0 10px 6px" }}>
            PLANNING FLOWS
          </p>
          {flowNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => openPlannerFlow(item.id)}
              style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
                border:"none", background:"transparent", color:T.text2, cursor:"pointer",
                fontSize:14, fontWeight:500, minHeight:42, transition:"all .15s", textAlign:"left", width:"100%",
              }}
              onMouseEnter={(e)=>{ e.currentTarget.style.background = T.borderLight; }}
              onMouseLeave={(e)=>{ e.currentTarget.style.background = "transparent"; }}
            >
              <Ic n={item.icon} s={18} c={T.text3}/>
              {item.label}
            </button>
          ))}

          <p style={{ fontSize:11, fontWeight:700, letterSpacing:".06em", color:T.text3, margin:"14px 10px 6px" }}>
            MY SPACE
          </p>
          <button
            onClick={() => setPage("trips")}
            style={{
              display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
              border:"none", background:isTripsPage?`${T.primary}08`:"transparent",
              color:isTripsPage?T.primary:T.text2, cursor:"pointer", fontSize:14, fontWeight:isTripsPage?600:500,
              minHeight:42, transition:"all .15s", textAlign:"left", width:"100%",
            }}
            onMouseEnter={e=>{ if(!isTripsPage) e.currentTarget.style.background=T.borderLight; }}
            onMouseLeave={e=>{ if(!isTripsPage) e.currentTarget.style.background="transparent"; }}
          >
            <Ic n="home" s={18} c={isTripsPage ? T.primary : T.text3}/>
            <span style={{ flex:1 }}>My Trips</span>
          </button>
          {[
            { id:"active", icon:"map", label:"Active Trip" },
            { id:"crew", icon:"users", label:"My Crew" },
            { id:"profile", icon:"user", label:"Profile" },
            { id:"prompts", icon:"code", label:"Prompt Library" },
          ].map(item => {
            const active = page === item.id;
            return (
              <button key={item.id} onClick={()=>{ setPage(item.id); if(item.id==="active") setSelectedTrip(TRIPS[0]); }}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
                  border:"none", background:active?`${T.primary}08`:"transparent",
                  color:active?T.primary:T.text2, cursor:"pointer", fontSize:14, fontWeight:active?600:500,
                  minHeight:42, transition:"all .15s", textAlign:"left", width:"100%" }}
                onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=T.borderLight; }}
                onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}>
                <Ic n={item.icon} s={18} c={active?T.primary:T.text3}/>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding:"16px 16px 0", borderTop:`1px solid ${T.borderLight}`, marginTop:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:999,
              background:`linear-gradient(135deg,${T.primary},${T.accent})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              color:"#fff", fontSize:13, fontWeight:700 }} className="hd">{viewer.initials}</div>
            <div>
              <p className="hd" style={{ fontWeight:600, fontSize:14 }}>{viewer.name}</p>
              <p style={{ fontSize:12, color:T.text3 }}>{viewer.planLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
      <main style={{ flex:1, minHeight:"100vh" }}>

        {/* Top bar */}
        <header style={{ background:T.surface, borderBottom:`1px solid ${T.borderLight}`,
          padding:"14px 28px", display:"flex", justifyContent:"space-between", alignItems:"center",
          position:"sticky", top:0, zIndex:40 }}>
          <div>
            {page==="detail" && selectedTrip && (
              <button onClick={()=>setPage("trips")} style={{ background:"none",border:"none",color:T.text2,
                cursor:"pointer",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:4,marginBottom:2 }}>
                <Ic n="chevL" s={14} c={T.text3}/> Back to trips
              </button>
            )}
            <h1 className="hd" style={{ fontWeight:700, fontSize:22, color:T.text }}>
              {page==="trips"?"My Trips":page==="active"?(selectedTrip?.name||"Active Trip"):
               page==="detail"?(selectedTrip?.name||"Trip Detail"):
               page==="profile"?"Profile & Settings":
               page==="crew"?"My Crew":"Prompt Library"}
            </h1>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button style={{ width:40,height:40,borderRadius:10,border:`1px solid ${T.borderLight}`,
              background:T.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <Ic n="bell" s={18} c={T.text3}/>
            </button>
            <button style={{ width:40,height:40,borderRadius:10,border:`1px solid ${T.borderLight}`,
              background:T.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <Ic n="settings" s={18} c={T.text3}/>
            </button>
          </div>
        </header>

        <div style={{ padding:"24px 28px 60px" }}>
          {page==="trips" && <TripsPage trips={TRIPS} onOpen={openTrip}/>}
          {page==="active" && <ActivePage trip={selectedTrip||TRIPS[0]} onDetail={()=>{setPage("detail");setDetailTab("overview");}}/>}
          {page==="detail" && <DetailPage trip={selectedTrip||TRIPS[0]} tab={detailTab} setTab={setDetailTab} members={dashboardMembers}/>}
          {page==="profile" && <ProfilePage viewer={viewer} onSaveProfile={handleProfileSave}/>}
          {page==="crew" && <CrewPage viewer={viewer} members={crewMembers} onInviteMember={handleInviteMember}/>}
          {page==="prompts" && <PromptsPage/>}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1) MY TRIPS — Card Grid
   ═══════════════════════════════════════════════════════════════════════════ */
function TripsPage({ trips, onOpen }) {
  const statusColors = { planning:T.warning, confirmed:T.accent, active:T.success, completed:T.text3 };
  const statusBg = { planning:T.warningBg, confirmed:`${T.accent}12`, active:T.successBg, completed:T.borderLight };
  const visibleTrips = trips;

  if (visibleTrips.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"64px 20px", color:T.text3 }}>
        <p className="hd" style={{ fontWeight:600, fontSize:17, marginBottom:8 }}>No trips in this category yet</p>
        <p style={{ fontSize:14 }}>Start a new trip to populate this view.</p>
      </div>
    );
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:20 }}>
      {visibleTrips.map((trip,i) => (
        <div key={trip.id} onClick={()=>onOpen(trip)}
          style={{ background:T.surface, borderRadius:18, overflow:"hidden", cursor:"pointer",
            border:`1px solid ${T.borderLight}`, transition:"all .25s",
            boxShadow:sh.sm, animation:`fadeUp .4s ease-out ${i*.06}s both` }}
          onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow=sh.md; }}
          onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow=sh.sm; }}>
          {/* Thumbnail */}
          <div style={{ height:130, background:trip.gradient, display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:48, position:"relative" }}>
            {trip.emoji}
            <span className="hd" style={{ position:"absolute", top:10, right:10,
              background:statusBg[trip.status], color:statusColors[trip.status],
              padding:"3px 12px", borderRadius:999, fontSize:11, fontWeight:700, textTransform:"capitalize",
              letterSpacing:".3px" }}>{trip.status}</span>
            {trip.status==="active" && <div style={{ position:"absolute",top:10,left:10,
              background:"rgba(34,197,94,.15)",padding:"3px 10px",borderRadius:999,
              display:"flex",alignItems:"center",gap:4 }}>
              <div style={{ width:6,height:6,borderRadius:999,background:T.success,animation:"pulse 1.5s infinite" }}/>
              <span style={{ fontSize:10.5,color:T.success,fontWeight:600 }}>LIVE</span>
            </div>}
          </div>
          {/* Info */}
          <div style={{ padding:"16px 18px" }}>
            <h3 className="hd" style={{ fontWeight:700, fontSize:17, marginBottom:4 }}>{trip.name}</h3>
            <p style={{ fontSize:13, color:T.text2, marginBottom:10 }}>{trip.dest}</p>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12.5, color:T.text3 }}>
                <span style={{ display:"flex",alignItems:"center",gap:3 }}><Ic n="calendar" s={13} c={T.text3}/> {trip.dates.split(",")[0]}</span>
                <span style={{ display:"flex",alignItems:"center",gap:3 }}><Ic n="users" s={13} c={T.text3}/> {trip.members}</span>
              </div>
              {trip.status!=="planning" && trip.budget && (
                <span className="hd" style={{ fontWeight:600, fontSize:14, color:T.primary }}>${trip.budget.toLocaleString()}</span>
              )}
            </div>
            {/* Budget mini bar for active/completed */}
            {trip.spent > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ height:4,background:T.borderLight,borderRadius:999 }}>
                  <div style={{ height:"100%",width:`${Math.min((trip.spent/trip.budget)*100,100)}%`,
                    background:trip.spent/trip.budget>.9?T.error:trip.spent/trip.budget>.7?T.warning:T.success,
                    borderRadius:999,transition:"width .5s" }}/>
                </div>
                <p style={{ fontSize:11,color:T.text3,marginTop:3 }}>${trip.spent} of ${trip.budget} spent</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2) ACTIVE TRIP — Countdown + Today's Timeline + Quick Actions
   ═══════════════════════════════════════════════════════════════════════════ */
function ActivePage({ trip, onDetail }) {
  const [now, setNow] = useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t); },[]);

  const dep = new Date(trip.departure || "2025-06-15T10:30:00").getTime();
  const diff = Math.max(0, dep - now);
  const days = Math.floor(diff/86400000);
  const hrs = Math.floor((diff%86400000)/3600000);
  const mins = Math.floor((diff%3600000)/60000);
  const secs = Math.floor((diff%60000)/1000);

  const typeColors = { meal:T.primary, activity:T.secondary, rest:"#6366F1", flight:T.accent, checkin:T.success };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
      {/* Countdown */}
      <div style={{ background:`linear-gradient(135deg,${T.primary},${T.primaryDark})`,
        borderRadius:20, padding:"28px 28px 24px", color:"#fff", position:"relative", overflow:"hidden",
        animation:"fadeUp .4s ease-out" }}>
        <div style={{ position:"absolute",top:0,right:0,width:"40%",height:"100%",
          background:`radial-gradient(circle at 80% 30%,${T.accent}20,transparent 70%)` }}/>
        <p className="hd" style={{ fontWeight:500,fontSize:13,opacity:.7,marginBottom:4 }}>Departure Countdown</p>
        <h2 className="hd" style={{ fontWeight:700,fontSize:20,marginBottom:16 }}>{trip.name} {trip.emoji}</h2>
        <div style={{ display:"flex",gap:16 }}>
          {[{v:days,l:"Days"},{v:hrs,l:"Hours"},{v:mins,l:"Minutes"},{v:secs,l:"Seconds"}].map((u,i)=>(
            <div key={i} style={{ textAlign:"center" }}>
              <div className="hd" style={{ fontWeight:700, fontSize:36, lineHeight:1, letterSpacing:"-1px",
                animation:i===3?"countPulse 1s infinite":"none" }}>{String(u.v).padStart(2,"0")}</div>
              <p style={{ fontSize:11, opacity:.6, marginTop:4 }}>{u.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,animation:"fadeUp .4s ease-out .1s both" }}>
        {[
          { icon:"map",label:"Full Itinerary",color:T.primary,action:onDetail },
          { icon:"camera",label:"Storyboard",color:"#8B5CF6" },
          { icon:"chat",label:"Group Chat",color:T.accent },
          { icon:"sos",label:"SOS Help",color:T.error },
        ].map((a,i)=>(
          <button key={i} onClick={a.action} className="hd" style={{ background:T.surface,borderRadius:14,
            padding:"16px 10px",border:`1px solid ${T.borderLight}`,cursor:"pointer",
            display:"flex",flexDirection:"column",alignItems:"center",gap:8,transition:"all .2s",minHeight:80 }}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="none"}>
            <div style={{ width:40,height:40,borderRadius:12,background:`${a.color}10`,
              display:"flex",alignItems:"center",justifyContent:"center" }}>
              <Ic n={a.icon} s={20} c={a.color}/>
            </div>
            <span style={{ fontSize:12.5,fontWeight:600,color:T.text2 }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Today's Timeline */}
      <div style={{ background:T.surface,borderRadius:18,padding:"22px 24px",border:`1px solid ${T.borderLight}`,
        boxShadow:sh.sm,animation:"fadeUp .4s ease-out .2s both" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:18 }}>
          <h3 className="hd" style={{ fontWeight:700,fontSize:17 }}>Today — Day 2</h3>
          <span style={{ fontSize:13,color:T.text3 }}>Jun 16 · Caldera & Culture</span>
        </div>
        <div style={{ position:"relative",paddingLeft:28 }}>
          <div style={{ position:"absolute",left:10,top:6,bottom:6,width:2,
            background:`linear-gradient(to bottom,${T.primary}25,${T.borderLight})` }}/>
          {TODAY_ITEMS.map((item,i)=>(
            <div key={i} style={{ display:"flex",gap:14,marginBottom:i<TODAY_ITEMS.length-1?18:0,position:"relative",
              opacity:item.done?.55:1,animation:`fadeUp .35s ease-out ${i*.05}s both` }}>
              <div style={{ position:"absolute",left:-28,top:2,width:22,height:22,borderRadius:999,
                background:item.done?T.success:(typeColors[item.type]||T.text3),display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:`0 0 0 3px ${T.surface}` }}>
                {item.done ? <Ic n="check" s={11} c="#fff"/> :
                  <Ic n={item.type==="meal"?"food":item.type==="activity"?"camera":"clock"} s={11} c="#fff"/>}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline" }}>
                  <p className="hd" style={{ fontWeight:600,fontSize:14,
                    textDecoration:item.done?"line-through":"none",color:item.done?T.text3:T.text }}>{item.title}</p>
                  {item.cost>0 && <span style={{ fontSize:12,color:T.text3 }}>${item.cost}</span>}
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3) TRIP DETAIL — Tabbed View
   ═══════════════════════════════════════════════════════════════════════════ */
function DetailPage({ trip, tab, setTab, members = MEMBERS }) {
  const tabs = [
    { id:"overview", label:"Overview", icon:"map" },
    { id:"itinerary", label:"Itinerary", icon:"clock" },
    { id:"budget", label:"Budget", icon:"dollar" },
    { id:"members", label:"Members", icon:"users" },
    { id:"storyboard", label:"Storyboard", icon:"camera" },
  ];

  return (
    <div>
      {/* Tabs */}
      <div style={{ display:"flex",gap:4,marginBottom:24,background:T.surface,borderRadius:14,padding:4,
        border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,overflowX:"auto" }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className="hd"
            style={{ padding:"10px 18px",borderRadius:10,border:"none",
              background:tab===t.id?T.primary:"transparent",color:tab===t.id?"#fff":T.text2,
              fontWeight:600,fontSize:13.5,cursor:"pointer",display:"flex",alignItems:"center",gap:6,
              transition:"all .2s",minHeight:40,whiteSpace:"nowrap" }}>
            <Ic n={t.icon} s={15} c={tab===t.id?"#fff":T.text3}/> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ animation:"fadeIn .25s ease-out" }}>
        {tab==="overview" && <OverviewTab trip={trip}/>}
        {tab==="itinerary" && <ItineraryTab/>}
        {tab==="budget" && <BudgetTab trip={trip}/>}
        {tab==="members" && <MembersTab members={members}/>}
        {tab==="storyboard" && <StoryboardTab/>}
      </div>
    </div>
  );
}

function OverviewTab({ trip }) {
  return (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
      {/* Map placeholder */}
      <div style={{ gridColumn:"1/-1",background:`linear-gradient(135deg,${T.primary}12,${T.accent}08)`,
        borderRadius:16,height:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        border:`1px solid ${T.borderLight}` }}>
        <Ic n="map" s={40} c={T.primary}/>
        <p className="hd" style={{ color:T.primary,fontWeight:600,fontSize:14,marginTop:10 }}>Interactive Map View</p>
        <p style={{ color:T.text3,fontSize:13 }}>Santorini → Kyoto route visualization</p>
      </div>
      {/* Stats */}
      {[
        { icon:"calendar",label:"Duration",value:`${trip.days} days`,color:T.primary },
        { icon:"users",label:"Members",value:`${trip.members} travelers`,color:T.accent },
        { icon:"dollar",label:"Budget",value:`$${trip.budget?.toLocaleString()||"—"}`,color:T.success },
        { icon:"camera",label:"Activities",value:"6 approved",color:T.secondary },
      ].map((s,i)=>(
        <div key={i} style={{ background:T.surface,borderRadius:14,padding:18,border:`1px solid ${T.borderLight}`,
          display:"flex",alignItems:"center",gap:14,animation:`fadeUp .3s ease-out ${i*.05}s both` }}>
          <div style={{ width:44,height:44,borderRadius:12,background:`${s.color}10`,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <Ic n={s.icon} s={20} c={s.color}/>
          </div>
          <div>
            <p style={{ fontSize:12.5,color:T.text3 }}>{s.label}</p>
            <p className="hd" style={{ fontWeight:700,fontSize:18 }}>{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItineraryTab() {
  const typeColors = { meal:T.primary, activity:T.secondary, rest:"#6366F1", flight:T.accent, checkin:T.success };
  const days = [
    { day:1,date:"Jun 15",theme:"Arrival in Santorini",items:[
      {time:"14:45",type:"flight",title:"Arrive Santorini",cost:0},
      {time:"16:00",type:"checkin",title:"Check in Canaves Oia",cost:385},
      {time:"18:30",type:"activity",title:"Sunset at Oia Castle",cost:0},
      {time:"20:00",type:"meal",title:"Dinner at Lycabettus",cost:85},
    ]},
    { day:2,date:"Jun 16",theme:"Caldera & Culture",items:TODAY_ITEMS.map(i=>({...i,done:undefined})) },
    { day:3,date:"Jun 17",theme:"Beach & Wine",items:[
      {time:"09:00",type:"activity",title:"Red Beach Morning Swim",cost:0},
      {time:"12:00",type:"meal",title:"Lunch at Seaside Tavern",cost:40},
      {time:"15:00",type:"activity",title:"Akrotiri Archaeological Site",cost:12},
      {time:"19:00",type:"meal",title:"Sunset Dinner Cruise",cost:95},
    ]},
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
      {days.map((day,di)=>(
        <div key={di} style={{ background:T.surface,borderRadius:16,padding:"18px 22px",
          border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,animation:`fadeUp .35s ease-out ${di*.08}s both` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16 }}>
            <div>
              <h3 className="hd" style={{ fontWeight:700,fontSize:17 }}>Day {day.day}</h3>
              <p style={{ fontSize:13,color:T.text2 }}>{day.date} · {day.theme}</p>
            </div>
            <span style={{ fontSize:13,color:T.text3 }}>${day.items.reduce((s,i)=>s+(i.cost||0),0)}</span>
          </div>
          <div style={{ position:"relative",paddingLeft:26 }}>
            <div style={{ position:"absolute",left:9,top:6,bottom:6,width:2,
              background:`linear-gradient(to bottom,${T.primary}25,${T.borderLight})` }}/>
            {day.items.map((item,ii)=>(
              <div key={ii} style={{ display:"flex",gap:12,marginBottom:ii<day.items.length-1?16:0,position:"relative" }}>
                <div style={{ position:"absolute",left:-26,top:2,width:20,height:20,borderRadius:999,
                  background:typeColors[item.type]||T.text3,display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:`0 0 0 3px ${T.surface}` }}>
                  <Ic n={item.type==="meal"?"food":item.type==="flight"?"plane":"camera"} s={10} c="#fff"/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",justifyContent:"space-between" }}>
                    <p className="hd" style={{ fontWeight:600,fontSize:14 }}>{item.title}</p>
                    {item.cost>0 && <span style={{ fontSize:12,color:T.text3 }}>${item.cost}</span>}
                  </div>
                  <span style={{ fontSize:12,color:T.text3 }}>{item.time}{item.loc?` · 📍 ${item.loc}`:""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BudgetTab({ trip }) {
  const categories = [
    { name:"Flights",allocated:600,spent:247,color:T.accent,icon:"plane" },
    { name:"Stays",allocated:700,spent:385,color:T.primary,icon:"hotel" },
    { name:"Food",allocated:400,spent:128,color:T.secondary,icon:"food" },
    { name:"Activities",allocated:200,spent:60,color:T.warning,icon:"camera" },
    { name:"Buffer",allocated:100,spent:0,color:T.text3,icon:"shield" },
  ];
  const totalSpent = categories.reduce((s,c)=>s+c.spent,0);
  const totalBudget = categories.reduce((s,c)=>s+c.allocated,0);
  const expenseCategories = ["Transport", "Accommodation", "Food", "Activities"];
  const [expenses, setExpenses] = useState([
    { id:1, name:"Airport Shuttle", category:"Transport", amount:42 },
    { id:2, name:"Hotel Maui", category:"Accommodation", amount:220 },
    { id:3, name:"Sunset Dinner", category:"Food", amount:68 },
    { id:4, name:"Boat Tour", category:"Activities", amount:95 },
  ]);
  const [expenseFilter, setExpenseFilter] = useState("All");
  const [expenseDraft, setExpenseDraft] = useState({ name:"", category:"Transport", amount:"" });
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const runningExpenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const visibleExpenses =
    expenseFilter === "All"
      ? expenses
      : expenses.filter((expense) => expense.category === expenseFilter);

  const resetExpenseDraft = () => {
    setExpenseDraft({ name:"", category:"Transport", amount:"" });
    setEditingExpenseId(null);
  };

  const submitExpense = () => {
    const name = String(expenseDraft.name || "").trim();
    const amount = Number.parseFloat(expenseDraft.amount);
    const category = expenseCategories.includes(expenseDraft.category) ? expenseDraft.category : "Transport";
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    const normalizedAmount = Number(amount.toFixed(2));

    if (editingExpenseId !== null) {
      setExpenses((prev) =>
        prev.map((expense) =>
          expense.id === editingExpenseId
            ? { ...expense, name, category, amount: normalizedAmount }
            : expense
        )
      );
      resetExpenseDraft();
      return;
    }

    setExpenses((prev) => [
      ...prev,
      { id: nextDashboardExpenseId(), name, category, amount: normalizedAmount },
    ]);
    resetExpenseDraft();
  };

  const editExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseDraft({
      name: expense.name,
      category: expense.category,
      amount: String(expense.amount),
    });
  };

  const removeExpense = (expenseId) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
    if (editingExpenseId === expenseId) resetExpenseDraft();
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
      {/* Total meter */}
      <div style={{ background:`linear-gradient(135deg,${T.primary},${T.primaryDark})`,borderRadius:18,
        padding:"24px 24px 20px",color:"#fff",animation:"fadeUp .4s ease-out" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12 }}>
          <p className="hd" style={{ fontWeight:500,fontSize:14,opacity:.7 }}>Total Budget</p>
          <div><span className="hd" style={{ fontWeight:700,fontSize:26 }}>${totalSpent}</span>
            <span style={{ opacity:.6,fontSize:15 }}> / ${totalBudget}</span></div>
        </div>
        <div style={{ height:8,background:"rgba(255,255,255,.15)",borderRadius:999 }}>
          <div style={{ height:"100%",width:`${(totalSpent/totalBudget)*100}%`,
            background:"rgba(255,255,255,.85)",borderRadius:999,transition:"width .8s" }}/>
        </div>
        <p style={{ fontSize:13,opacity:.6,marginTop:6 }}>${totalBudget-totalSpent} remaining · {Math.round((totalSpent/totalBudget)*100)}% used</p>
      </div>

      {/* Pie */}
      <div style={{ background:T.surface,borderRadius:16,padding:22,border:`1px solid ${T.borderLight}`,
        display:"flex",gap:20,alignItems:"center",animation:"fadeUp .4s ease-out .1s both" }}>
        <div style={{ width:120,height:120,borderRadius:999,flexShrink:0,position:"relative",
          background:`conic-gradient(${T.accent} 0% 30%, ${T.primary} 30% 65%, ${T.secondary} 65% 85%, ${T.warning} 85% 95%, ${T.text3} 95% 100%)` }}>
          <div style={{ position:"absolute",inset:22,borderRadius:999,background:T.surface,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
            <span className="hd" style={{ fontWeight:700,fontSize:16,color:T.text }}>${totalBudget}</span>
            <span style={{ fontSize:10.5,color:T.text3 }}>total</span>
          </div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8,flex:1 }}>
          {categories.map(c=>(
            <div key={c.name} style={{ display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:10,height:10,borderRadius:3,background:c.color,flexShrink:0 }}/>
              <span style={{ fontSize:13,color:T.text2,flex:1 }}>{c.name}</span>
              <span className="hd" style={{ fontWeight:600,fontSize:13 }}>${c.allocated}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {categories.map((c,i)=>{
          const pct = (c.spent/c.allocated)*100;
          return (
            <div key={c.name} style={{ background:T.surface,borderRadius:14,padding:"14px 18px",
              border:`1px solid ${T.borderLight}`,animation:`fadeUp .3s ease-out ${.15+i*.05}s both` }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
                <div style={{ width:32,height:32,borderRadius:8,background:`${c.color}12`,
                  display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <Ic n={c.icon} s={16} c={c.color}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",justifyContent:"space-between" }}>
                    <span className="hd" style={{ fontWeight:600,fontSize:14 }}>{c.name}</span>
                    <span style={{ fontSize:13,color:T.text2 }}>${c.spent} / ${c.allocated}</span>
                  </div>
                </div>
              </div>
              <div style={{ height:6,background:T.borderLight,borderRadius:999 }}>
                <div style={{ height:"100%",width:`${Math.min(pct,100)}%`,background:c.color,
                  borderRadius:999,transition:"width .6s" }}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expense management */}
      <div style={{ background:T.surface,borderRadius:16,padding:"20px 22px",border:`1px solid ${T.borderLight}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap" }}>
          <div>
            <h3 className="hd" style={{ fontWeight:700,fontSize:16 }}>Expense Management</h3>
            <p style={{ fontSize:12.5,color:T.text3,marginTop:2 }}>
              Running Total: <strong style={{ color:T.text }}>${runningExpenseTotal.toFixed(2)}</strong>
            </p>
          </div>
          <label style={{ fontSize:12.5,color:T.text2,display:"flex",alignItems:"center",gap:8 }}>
            Filter by category
            <select
              aria-label="Filter expenses by category"
              value={expenseFilter}
              onChange={(event) => setExpenseFilter(event.target.value)}
              style={{ padding:"8px 10px",borderRadius:10,border:`1px solid ${T.border}`,background:T.bg,color:T.text,minHeight:36 }}
            >
              <option value="All">All</option>
              {expenseCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
          {expenseCategories.map((category) => (
            <span key={category} className="hd" style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:999,background:T.borderLight,color:T.text2 }}>
              {category}
            </span>
          ))}
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,marginBottom:14 }}>
          <input
            aria-label="Expense name"
            value={expenseDraft.name}
            onChange={(event) => setExpenseDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Expense name"
            style={{ padding:"10px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:T.bg,minHeight:40 }}
          />
          <select
            aria-label="Expense category"
            value={expenseDraft.category}
            onChange={(event) => setExpenseDraft((prev) => ({ ...prev, category: event.target.value }))}
            style={{ padding:"10px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:T.bg,minHeight:40 }}
          >
            {expenseCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input
            aria-label="Expense amount"
            value={expenseDraft.amount}
            onChange={(event) => setExpenseDraft((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="0.00"
            type="number"
            min="0"
            step="0.01"
            style={{ padding:"10px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:T.bg,minHeight:40 }}
          />
          <div style={{ display:"flex",gap:8 }}>
            <button
              className="hd"
              onClick={submitExpense}
              style={{ padding:"10px 12px",borderRadius:10,border:"none",background:T.primary,color:"#fff",fontSize:12.5,fontWeight:700,cursor:"pointer",minHeight:40,whiteSpace:"nowrap" }}
            >
              {editingExpenseId !== null ? "Update Expense" : "Add Expense"}
            </button>
            {editingExpenseId !== null ? (
              <button
                className="hd"
                onClick={resetExpenseDraft}
                style={{ padding:"10px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:T.surface,color:T.text2,fontSize:12.5,fontWeight:700,cursor:"pointer",minHeight:40,whiteSpace:"nowrap" }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {visibleExpenses.length === 0 ? (
            <p style={{ fontSize:13,color:T.text3 }}>No expenses for this category.</p>
          ) : (
            visibleExpenses.map((expense) => (
              <div key={expense.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",border:`1px solid ${T.borderLight}`,borderRadius:12 }}>
                <div>
                  <p className="hd" style={{ fontSize:13.5,fontWeight:600 }}>{expense.name}</p>
                  <p style={{ fontSize:12,color:T.text3 }}>{expense.category}</p>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <span className="hd" style={{ fontSize:13.5,fontWeight:700 }}>${Number(expense.amount || 0).toFixed(2)}</span>
                  <button
                    className="hd"
                    aria-label={`Edit ${expense.name} expense`}
                    onClick={() => editExpense(expense)}
                    style={{ padding:"6px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text2,fontSize:12,fontWeight:700,cursor:"pointer" }}
                  >
                    Edit
                  </button>
                  <button
                    className="hd"
                    aria-label={`Delete ${expense.name} expense`}
                    onClick={() => removeExpense(expense.id)}
                    style={{ padding:"6px 10px",borderRadius:8,border:"none",background:T.errorBg,color:T.error,fontSize:12,fontWeight:700,cursor:"pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MembersTab({ members = MEMBERS }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
      {members.map((m,i)=>(
        <div key={i} style={{ background:T.surface,borderRadius:16,padding:20,
          border:`1px solid ${T.borderLight}`,display:"flex",gap:16,alignItems:"flex-start",
          animation:`fadeUp .35s ease-out ${i*.06}s both` }}>
          <div style={{ width:48,height:48,borderRadius:14,flexShrink:0,
            background:`linear-gradient(135deg,${T.primary},${T.accent})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            color:"#fff",fontSize:16,fontWeight:700 }} className="hd">{m.initials}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
              <h4 className="hd" style={{ fontWeight:700,fontSize:16 }}>{m.name}</h4>
              <span className="hd" style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:999,
                background:m.role==="Organizer"?`${T.primary}12`:T.borderLight,
                color:m.role==="Organizer"?T.primary:T.text3 }}>{m.role}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
              <div>
                <p style={{ fontSize:11,color:T.text3,marginBottom:4 }}>Interests</p>
                <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                  {m.interests.map(int=><span key={int} style={{ fontSize:11,background:`${T.accent}12`,
                    color:T.accent,padding:"1px 7px",borderRadius:999 }}>{int}</span>)}
                </div>
              </div>
              <div>
                <p style={{ fontSize:11,color:T.text3,marginBottom:4 }}>Dietary</p>
                <p style={{ fontSize:13,fontWeight:500 }}>{m.diet}</p>
              </div>
              <div>
                <p style={{ fontSize:11,color:T.text3,marginBottom:4 }}>Fitness</p>
                <p style={{ fontSize:13,fontWeight:500 }}>{m.fitness}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryboardTab() {
  const platColors = { Instagram:"#E1306C", Twitter:T.accent, TikTok:"#000" };
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
      {STORYBOARD.map((post,i)=>(
        <div key={i} style={{ background:T.surface,borderRadius:16,padding:20,
          border:`1px solid ${T.borderLight}`,animation:`fadeUp .35s ease-out ${i*.08}s both` }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
            <span className="hd" style={{ fontSize:12,fontWeight:700,color:platColors[post.platform],
              background:`${platColors[post.platform]}12`,padding:"3px 10px",borderRadius:999 }}>{post.platform}</span>
            <span className="hd" style={{ fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:999,
              background:post.status==="posted"?T.successBg:T.warningBg,
              color:post.status==="posted"?T.success:T.warning,textTransform:"capitalize" }}>{post.status}</span>
          </div>
          <p style={{ fontSize:14,lineHeight:1.6,marginBottom:10 }}>{post.caption}</p>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {post.hashtags.map(h=><span key={h} style={{ fontSize:12,color:T.accent }}>{h}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4) PROFILE & SETTINGS
   ═══════════════════════════════════════════════════════════════════════════ */
function ProfilePage({ viewer, onSaveProfile = () => {} }) {
  const [notifs, setNotifs] = useState({ trip:true, budget:true, members:true, marketing:false, digest:true });
  const [saveMessage, setSaveMessage] = useState("");
  const [form, setForm] = useState(() => ({
    firstName: viewer?.firstName || "Traveler",
    lastName: viewer?.lastName || "",
    email: viewer?.email || "traveler@example.com",
    phone: viewer?.phone || "",
    travelStyle: viewer?.travelStyle || "couple",
    budgetPreference: viewer?.budgetPreference || "moderate",
    interestsText: Array.isArray(viewer?.interests) ? viewer.interests.join(", ") : "",
    dietary: viewer?.dietary || "None",
    fitness: viewer?.fitness || "Moderate",
  }));

  useEffect(() => {
    setForm({
      firstName: viewer?.firstName || "Traveler",
      lastName: viewer?.lastName || "",
      email: viewer?.email || "traveler@example.com",
      phone: viewer?.phone || "",
      travelStyle: viewer?.travelStyle || "couple",
      budgetPreference: viewer?.budgetPreference || "moderate",
      interestsText: Array.isArray(viewer?.interests) ? viewer.interests.join(", ") : "",
      dietary: viewer?.dietary || "None",
      fitness: viewer?.fitness || "Moderate",
    });
  }, [viewer]);

  const Section = ({ title, children }) => (
    <div style={{ background:T.surface,borderRadius:16,padding:"20px 22px",border:`1px solid ${T.borderLight}`,marginBottom:16 }}>
      <h3 className="hd" style={{ fontWeight:700,fontSize:16,marginBottom:16 }}>{title}</h3>
      {children}
    </div>
  );

  const inputStyle = {
    width:"100%",
    padding:"11px 14px",
    borderRadius:10,
    border:`1.5px solid ${T.border}`,
    fontSize:14,
    color:T.text,
    background:T.bg,
    minHeight:44,
  };

  const Field = ({ label, value, type = "text", onChange, readOnly = false, disabled = false, placeholder = "" }) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:12.5,fontWeight:600,color:T.text2,display:"block",marginBottom:5 }}>{label}</label>
      <input
        value={value}
        type={type}
        onChange={onChange}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          opacity: disabled ? 0.8 : 1,
          cursor: readOnly ? "not-allowed" : "text",
        }}
      />
    </div>
  );

  const Toggle = ({ label, desc, checked, onChange }) => (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}` }}>
      <div>
        <p style={{ fontSize:14,fontWeight:500 }}>{label}</p>
        {desc && <p style={{ fontSize:12.5,color:T.text3 }}>{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width:44,
          height:24,
          borderRadius:999,
          background:checked?T.primary:T.border,
          border:"none",
          cursor:"pointer",
          position:"relative",
          transition:"all .2s",
          padding:0,
        }}
      >
        <div style={{ width:20,height:20,borderRadius:999,background:"#fff",position:"absolute",top:2,left:checked?22:2,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.15)" }}/>
      </button>
    </div>
  );

  const onField = (key) => (event) => {
    const value = event?.target?.value ?? "";
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const fullName = `${form.firstName || ""} ${form.lastName || ""}`.trim() || defaultNameFromEmail(form.email);
    const interests = Array.from(
      new Set(
        String(form.interestsText || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
    onSaveProfile({
      name: fullName,
      phone: String(form.phone || "").trim(),
      travel_style: form.travelStyle,
      budget_preference: form.budgetPreference,
      interests,
      dietary: String(form.dietary || "").trim() || "None",
      fitness: String(form.fitness || "").trim() || "Moderate",
    });
    setSaveMessage("Profile saved.");
    window.setTimeout(() => setSaveMessage(""), 2200);
  };

  return (
    <div style={{ maxWidth:640,animation:"fadeUp .4s ease-out" }}>
      <Section title="Personal Information">
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
          <Field label="First Name" value={form.firstName} onChange={onField("firstName")} />
          <Field label="Last Name" value={form.lastName} onChange={onField("lastName")} />
          <Field label="Email" value={form.email} type="email" readOnly />
          <Field label="Phone" value={form.phone} onChange={onField("phone")} placeholder="+1 555 123 4567" />
        </div>
      </Section>

      <Section title="Travel Preferences">
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12.5,fontWeight:600,color:T.text2,display:"block",marginBottom:5 }}>Travel Style</label>
            <select value={form.travelStyle} onChange={onField("travelStyle")} style={inputStyle}>
              <option value="solo">Solo</option>
              <option value="couple">Couple</option>
              <option value="family">Family</option>
              <option value="group">Friends Group</option>
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12.5,fontWeight:600,color:T.text2,display:"block",marginBottom:5 }}>Budget Preference</label>
            <select value={form.budgetPreference} onChange={onField("budgetPreference")} style={inputStyle}>
              <option value="budget">Budget ($50-100/day)</option>
              <option value="moderate">Moderate ($100-200/day)</option>
              <option value="premium">Premium ($200-400/day)</option>
              <option value="luxury">Luxury ($400+/day)</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12.5,fontWeight:600,color:T.text2,display:"block",marginBottom:5 }}>Interests (comma separated)</label>
          <textarea
            value={form.interestsText}
            onChange={onField("interestsText")}
            placeholder="Photography, Hiking, Food"
            style={{ ...inputStyle, minHeight:84, resize:"vertical" }}
          />
        </div>
        <Field label="Dietary Restrictions" value={form.dietary} onChange={onField("dietary")} />
        <Field label="Fitness Level" value={form.fitness} onChange={onField("fitness")} />
        <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:4 }}>
          <button
            className="hd"
            onClick={handleSave}
            style={{
              padding:"10px 18px",
              borderRadius:10,
              border:"none",
              background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,
              color:"#fff",
              fontSize:14,
              fontWeight:700,
              cursor:"pointer",
              minHeight:40,
            }}
          >
            Save Profile
          </button>
          {saveMessage ? <span style={{ fontSize:13,color:T.success,fontWeight:600 }}>{saveMessage}</span> : null}
        </div>
      </Section>

      <Section title="Notifications">
        <Toggle label="Trip Updates" desc="New suggestions, approvals, changes" checked={notifs.trip} onChange={v=>setNotifs(p=>({...p,trip:v}))}/>
        <Toggle label="Budget Alerts" desc="Over-budget warnings, price drops" checked={notifs.budget} onChange={v=>setNotifs(p=>({...p,budget:v}))}/>
        <Toggle label="Member Activity" desc="When members join, complete steps" checked={notifs.members} onChange={v=>setNotifs(p=>({...p,members:v}))}/>
        <Toggle label="Weekly Digest" desc="Summary of upcoming trips" checked={notifs.digest} onChange={v=>setNotifs(p=>({...p,digest:v}))}/>
        <Toggle label="Marketing" desc="New features, promotions" checked={notifs.marketing} onChange={v=>setNotifs(p=>({...p,marketing:v}))}/>
      </Section>
    </div>
  );
}

function CrewPage({ viewer, members = [], onInviteMember = () => ({ ok:false, error:"Invite failed." }) }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState(null);
  const [manualInviteLink, setManualInviteLink] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const visibleInviteLink =
    manualInviteLink || (typeof window !== "undefined" ? `${window.location.origin}/?entry=home` : "");

  const copyInviteLink = async () => {
    if (!visibleInviteLink) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(visibleInviteLink);
        setCopyFeedback("Invite link copied.");
      } else {
        setCopyFeedback("Copy this link manually.");
      }
    } catch {
      setCopyFeedback("Copy this link manually.");
    }
  };

  const submitInvite = async () => {
    setCopyFeedback("");
    const existingMember = findCrewMemberByEmail(members, inviteEmail);
    if (existingMember) {
      setManualInviteLink("");
      setInviteFeedback({
        type: "error",
        message: duplicateCrewInviteMessageForStatus(existingMember?.status),
      });
      return;
    }
    const result = await onInviteMember(inviteEmail);
    if (result?.ok) {
      const link = result?.inviteLink || "";
      const deliveryMode = String(result?.deliveryMode || "").trim().toLowerCase();
      setManualInviteLink(link);

      if (result.emailSent) {
        setInviteFeedback({ type:"success", message:"Invite linked and email sent." });
      } else if (deliveryMode === "link_only") {
        setInviteFeedback({
          type:"info",
          message:"Invite linked. Copy and share the invite link manually.",
          detail: result.emailError || "",
        });
      } else if (result.emailError) {
        setInviteFeedback({
          type:"info",
          message:"Invite linked. Email was not delivered, so share the invite link manually.",
          detail: result.emailError,
        });
      } else {
        setInviteFeedback({ type:"info", message:"Invite linked. Copy and share the invite link manually." });
      }
      setInviteEmail("");
      return;
    }
    setManualInviteLink("");
    setInviteFeedback({ type:"error", message: result?.error || "Could not invite this email." });
  };

  return (
    <div style={{ maxWidth:640,animation:"fadeUp .4s ease-out" }}>
      <p style={{ fontSize:14,color:T.text2,marginBottom:14,lineHeight:1.6 }}>
        Invite crew by email. Once they sign up and complete preferences, both of you can see each other.
      </p>
      <p style={{ fontSize:13,color:T.text3,marginBottom:18,lineHeight:1.5 }}>
        Privacy: your crew links are one-to-one. Members you invite can see you, but cannot see each other.
      </p>

      <div style={{ background:T.surface,border:`1px solid ${T.borderLight}`,borderRadius:14,padding:14,marginBottom:14 }}>
        <label style={{ fontSize:12.5,fontWeight:700,color:T.text2,display:"block",marginBottom:8 }}>Invite Member (email)</label>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event?.target?.value ?? "")}
            placeholder="friend@example.com"
            style={{ flex:1,minHeight:42,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${T.border}`,fontSize:14,background:T.bg,color:T.text }}
          />
          <button
            className="hd"
            onClick={submitInvite}
            style={{
              minHeight:42,
              padding:"0 16px",
              borderRadius:10,
              border:"none",
              background:`linear-gradient(135deg,${T.primary},${T.primaryLight})`,
              color:"#fff",
              fontWeight:700,
              cursor:"pointer",
            }}
          >
            Invite
          </button>
        </div>
        {inviteFeedback ? (
          <p
            style={{
              marginTop:8,
              fontSize:12.5,
              color:
                inviteFeedback.type === "success"
                  ? T.success
                  : inviteFeedback.type === "error"
                    ? T.error
                    : T.warning,
            }}
          >
            {inviteFeedback.message}
            {inviteFeedback.detail ? ` (${inviteFeedback.detail})` : ""}
          </p>
        ) : null}
        {visibleInviteLink ? (
          <div style={{ marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <input
              value={visibleInviteLink}
              readOnly
              style={{
                flex:1,
                minHeight:36,
                padding:"8px 10px",
                borderRadius:8,
                border:`1px solid ${T.border}`,
                background:T.bg,
                color:T.text2,
                fontSize:12.5,
              }}
            />
            <button
              className="hd"
              onClick={copyInviteLink}
              style={{
                minHeight:36,
                padding:"0 12px",
                borderRadius:8,
                border:`1px solid ${T.border}`,
                background:T.surface,
                color:T.text2,
                fontSize:12.5,
                fontWeight:700,
                cursor:"pointer",
              }}
            >
              Copy link
            </button>
          </div>
        ) : null}
        {copyFeedback ? <p style={{ marginTop:6,fontSize:12,color:T.text3 }}>{copyFeedback}</p> : null}
      </div>

      <div style={{ background:T.surface,border:`1px solid ${T.borderLight}`,borderRadius:14,padding:14,marginBottom:12 }}>
        <p className="hd" style={{ fontSize:13,fontWeight:700,color:T.text2,marginBottom:6 }}>Your Shared Profile</p>
        <p style={{ fontSize:14,fontWeight:600,color:T.text }}>{viewer?.name || "You"}</p>
        <p style={{ fontSize:12.5,color:T.text3 }}>{viewer?.email || ""}</p>
      </div>

      {members.length === 0 ? (
        <div style={{ background:T.surface,border:`1px solid ${T.borderLight}`,borderRadius:14,padding:18,color:T.text3,fontSize:13 }}>
          No crew members yet. Invite someone by email to start sharing trip preferences.
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {members.map((m,i) => (
            <div key={`${m.email}-${i}`} style={{ background:T.surface,borderRadius:14,padding:"16px 20px",border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,display:"flex",alignItems:"center",gap:14,animation:`fadeUp .35s ease-out ${i*.05}s both` }}>
              <div style={{ width:44,height:44,borderRadius:999,background:`linear-gradient(135deg,${T.primary},${T.accent})`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:15,fontWeight:700 }} className="hd">{m.initials}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
                  <p className="hd" style={{ fontWeight:600,fontSize:15 }}>{m.name}</p>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 10px",borderRadius:999,background:T.borderLight,color:T.text3 }}>{m.role}</span>
                  <span style={{ fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:999,background:m.status === "Joined" ? T.successBg : T.warningBg,color:m.status === "Joined" ? T.success : T.warning }}>
                    {m.status}
                  </span>
                </div>
                <p style={{ fontSize:12,color:T.text3,marginTop:4 }}>{m.email}</p>
                <div style={{ display:"flex",gap:4,marginTop:6,flexWrap:"wrap" }}>
                  {(m.interests || []).length > 0 ? (m.interests || []).map((tag) => (
                    <span key={tag} style={{ fontSize:11,color:T.text3,background:T.bg,padding:"1px 8px",borderRadius:999 }}>{tag}</span>
                  )) : <span style={{ fontSize:11,color:T.text3 }}>No interests shared yet</span>}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ fontSize:12,color:T.text3 }}>{m.diet || "Not shared yet"}</p>
                <p style={{ fontSize:12,color:T.text3 }}>{m.fitness || "Not shared yet"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function PromptsPage() {
  const [expanded, setExpanded] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saved, setSaved] = useState(null);

  return (
    <div style={{ maxWidth:700 }}>
      <p style={{ fontSize:14,color:T.text2,marginBottom:20,lineHeight:1.6,animation:"fadeUp .4s ease-out" }}>
        View and customize every AI prompt used by WanderPlan. Changes apply to future trips only.
      </p>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {PROMPTS.map((p,i)=>{
          const isOpen = expanded===p.id;
          const editVal = editValues[p.id] ?? p.prompt;
          return (
            <div key={p.id} style={{ background:T.surface,borderRadius:14,overflow:"hidden",
              border:`1px solid ${isOpen?T.primary+"40":T.borderLight}`,
              transition:"all .3s",animation:`fadeUp .35s ease-out ${i*.04}s both` }}>
              {/* Header */}
              <button onClick={()=>setExpanded(isOpen?null:p.id)} style={{ width:"100%",display:"flex",
                alignItems:"center",gap:12,padding:"14px 18px",background:"none",border:"none",
                cursor:"pointer",minHeight:56,textAlign:"left" }}>
                <div style={{ width:38,height:38,borderRadius:10,flexShrink:0,
                  background:`linear-gradient(135deg,${T.primary}15,${T.accent}10)`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{p.emoji}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <p className="hd" style={{ fontWeight:600,fontSize:15,color:T.text }}>{p.name}</p>
                    <span style={{ fontSize:11,color:T.text3,background:T.borderLight,padding:"1px 8px",borderRadius:999 }}>
                      {p.uses} uses</span>
                  </div>
                  <p style={{ fontSize:12.5,color:T.text3 }}>{p.agent}</p>
                </div>
                <div style={{ transform:isOpen?"rotate(90deg)":"none",transition:"transform .2s" }}>
                  <Ic n="chevR" s={16} c={T.text3}/>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div style={{ padding:"0 18px 18px",animation:"fadeIn .2s ease" }}>
                  <textarea value={editVal}
                    onChange={e=>setEditValues(v=>({...v,[p.id]:e.target.value}))}
                    style={{ width:"100%",minHeight:140,padding:14,borderRadius:10,
                      border:`1px solid ${T.border}`,fontFamily:"'SFMono-Regular',Consolas,'Liberation Mono',monospace",
                      fontSize:13,lineHeight:1.7,resize:"vertical",color:T.text,background:T.bg }}/>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12 }}>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>setEditValues(v=>({...v,[p.id]:p.prompt}))}
                        style={{ background:"none",border:"none",color:T.text3,fontSize:13,
                          cursor:"pointer",textDecoration:"underline" }}>Reset to default</button>
                      <button style={{ background:`${T.accent}10`,border:"none",color:T.accent,
                        padding:"6px 14px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer" }} className="hd">
                        ▶ Try it
                      </button>
                    </div>
                    <button onClick={()=>{setSaved(p.id);setTimeout(()=>setSaved(null),2000);}}
                      className="hd" style={{ background:saved===p.id?T.success:T.primary,color:"#fff",
                        border:"none",borderRadius:8,padding:"8px 20px",fontWeight:600,
                        fontSize:13,cursor:"pointer",transition:"all .2s",minHeight:36 }}>
                      {saved===p.id?"✓ Saved":"Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
