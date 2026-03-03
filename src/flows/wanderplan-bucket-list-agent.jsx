import { useState, useEffect, useRef, useCallback } from "react";

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
  lg:"0 12px 40px rgba(26,26,46,0.1),0 4px 12px rgba(26,26,46,0.05)",
};

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

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

/* ═══════════════════════════════════════════════════════════════════════════
   DESTINATION KNOWLEDGE BASE
   Complete alias → canonical mapping, enrichment data, and NLP patterns
   ═══════════════════════════════════════════════════════════════════════════ */
const DEST_DB = {
    "los_angeles": {
      canonical: "Los Angeles", country: "United States", continent: "North America",
      aliases: ["los angeles","l.a.","los angeles california","city of angels"],
      bestMonths: [4,5,6,9,10], avgDailyCost: 220, flightHrs: 0,
      visa: { US:"none", IN:"B1/B2 required", UK:"ESTA", AU:"ESTA" },
      photo: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&q=80",
      highlights: ["Hollywood","Santa Monica Pier","Venice Beach","Getty Center"],
      lat: 34.0522, lng: -118.2437, rating: 4.6,
    },
  "new_york_city": {
    canonical: "New York City", country: "United States", continent: "North America",
    aliases: ["nyc","new york","new york city","manhattan","big apple","ny city","the city that never sleeps"],
    bestMonths: [4,5,6,9,10], avgDailyCost: 250, flightHrs: 0,
    visa: { US:"none", IN:"B1/B2 required", UK:"ESTA", AU:"ESTA" },
    photo: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80",
    highlights: ["Broadway shows","Central Park","World-class museums","Iconic skyline"],
    lat: 40.7128, lng: -74.0060, rating: 4.7,
  },
  "paris": {
    canonical: "Paris", country: "France", continent: "Europe",
    aliases: ["paris","city of lights","city of light","paris france","paree"],
    bestMonths: [4,5,6,9,10], avgDailyCost: 200, flightHrs: 8,
    visa: { US:"Schengen-free 90d", IN:"Schengen visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80",
    highlights: ["Eiffel Tower","Louvre Museum","Seine River cruises","World-class cuisine"],
    lat: 48.8566, lng: 2.3522, rating: 4.8,
  },
  "tokyo": {
    canonical: "Tokyo", country: "Japan", continent: "Asia",
    aliases: ["tokyo","tokyo japan","tokio"],
    bestMonths: [3,4,5,10,11], avgDailyCost: 150, flightHrs: 14,
    visa: { US:"Visa-free 90d", IN:"Visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80",
    highlights: ["Cherry blossoms","Shibuya crossing","Ancient temples","Street food culture"],
    lat: 35.6762, lng: 139.6503, rating: 4.9,
  },
  "kyoto": {
    canonical: "Kyoto", country: "Japan", continent: "Asia",
    aliases: ["kyoto","kyoto japan","kioto"],
    bestMonths: [3,4,5,10,11], avgDailyCost: 120, flightHrs: 14,
    visa: { US:"Visa-free 90d", IN:"Visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80",
    highlights: ["Fushimi Inari gates","Bamboo groves","Geisha district","Tea ceremonies"],
    lat: 35.0116, lng: 135.7681, rating: 4.8,
  },
  "santorini": {
    canonical: "Santorini", country: "Greece", continent: "Europe",
    aliases: ["santorini","santorini greece","thira","fira"],
    bestMonths: [5,6,9,10], avgDailyCost: 180, flightHrs: 11,
    visa: { US:"Schengen-free 90d", IN:"Schengen visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=80",
    highlights: ["Caldera sunsets","Blue-domed churches","Wine tasting","Volcanic beaches"],
    lat: 36.3932, lng: 25.4615, rating: 4.9,
  },
  "bali": {
    canonical: "Bali", country: "Indonesia", continent: "Asia",
    aliases: ["bali","bali indonesia","ubud","seminyak","kuta"],
    bestMonths: [4,5,6,7,8,9], avgDailyCost: 80, flightHrs: 20,
    visa: { US:"Visa on arrival", IN:"Visa on arrival", UK:"Visa on arrival", AU:"Visa on arrival" },
    photo: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80",
    highlights: ["Rice terraces","Temple ceremonies","Surf culture","Wellness retreats"],
    lat: -8.3405, lng: 115.0920, rating: 4.7,
  },
  "maldives": {
    canonical: "Maldives", country: "Maldives", continent: "Asia",
    aliases: ["maldives","the maldives","male","maldive islands"],
    bestMonths: [1,2,3,4,11,12], avgDailyCost: 350, flightHrs: 18,
    visa: { US:"Visa on arrival", IN:"Visa on arrival", UK:"Visa on arrival", AU:"Visa on arrival" },
    photo: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80",
    highlights: ["Overwater villas","Crystal-clear lagoons","Snorkeling reefs","Bioluminescent beaches"],
    lat: 3.2028, lng: 73.2207, rating: 4.9,
  },
  "machu_picchu": {
    canonical: "Machu Picchu", country: "Peru", continent: "South America",
    aliases: ["machu picchu","machu pichu","macchu picchu","cusco","peru"],
    bestMonths: [5,6,7,8,9], avgDailyCost: 100, flightHrs: 10,
    visa: { US:"Visa-free 183d", IN:"Visa required", UK:"Visa-free 183d", AU:"Visa-free 183d" },
    photo: "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=600&q=80",
    highlights: ["Inca Trail trek","Lost city ruins","Andes mountains","Sacred Valley"],
    lat: -13.1631, lng: -72.5450, rating: 4.9,
  },
  "barcelona": {
    canonical: "Barcelona", country: "Spain", continent: "Europe",
    aliases: ["barcelona","barca","barcelona spain","bcn"],
    bestMonths: [5,6,9,10], avgDailyCost: 160, flightHrs: 9,
    visa: { US:"Schengen-free 90d", IN:"Schengen visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&q=80",
    highlights: ["Sagrada Família","Gothic Quarter","Beach culture","Tapas & nightlife"],
    lat: 41.3874, lng: 2.1686, rating: 4.7,
  },
  "iceland": {
    canonical: "Iceland", country: "Iceland", continent: "Europe",
    aliases: ["iceland","reykjavik","reykjavík","land of fire and ice"],
    bestMonths: [6,7,8,9], avgDailyCost: 220, flightHrs: 6,
    visa: { US:"Schengen-free 90d", IN:"Schengen visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=600&q=80",
    highlights: ["Northern Lights","Blue Lagoon","Glacier hiking","Volcanic landscapes"],
    lat: 64.1466, lng: -21.9426, rating: 4.8,
  },
  "marrakech": {
    canonical: "Marrakech", country: "Morocco", continent: "Africa",
    aliases: ["marrakech","marrakesh","morocco","maroc"],
    bestMonths: [3,4,5,10,11], avgDailyCost: 70, flightHrs: 8,
    visa: { US:"Visa-free 90d", IN:"Visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=600&q=80",
    highlights: ["Medina souks","Atlas Mountains","Riad stays","Sahara day trips"],
    lat: 31.6295, lng: -7.9811, rating: 4.5,
  },
  "rome": {
    canonical: "Rome", country: "Italy", continent: "Europe",
    aliases: ["rome","roma","rome italy","eternal city"],
    bestMonths: [4,5,6,9,10], avgDailyCost: 170, flightHrs: 9,
    visa: { US:"Schengen-free 90d", IN:"Schengen visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=80",
    highlights: ["Colosseum","Vatican City","Trastevere dining","Ancient ruins"],
    lat: 41.9028, lng: 12.4964, rating: 4.8,
  },
  "cape_town": {
    canonical: "Cape Town", country: "South Africa", continent: "Africa",
    aliases: ["cape town","capetown","cape town south africa"],
    bestMonths: [10,11,12,1,2,3], avgDailyCost: 90, flightHrs: 17,
    visa: { US:"Visa-free 90d", IN:"Visa required", UK:"Visa-free 90d", AU:"Visa-free 90d" },
    photo: "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=80",
    highlights: ["Table Mountain","Cape of Good Hope","Winelands","Boulders Beach penguins"],
    lat: -33.9249, lng: 18.4241, rating: 4.7,
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   NLP ENGINE — Entity Recognition + Deduplication
   ═══════════════════════════════════════════════════════════════════════════ */

function extractDestinations(text) {
  const normalized = text.toLowerCase()
    .replace(/[!?.,"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const found = [];
  const usedRanges = [];

  // Sort aliases longest-first for greedy matching
  const allAliases = [];
  for (const [key, dest] of Object.entries(DEST_DB)) {
    for (const alias of dest.aliases) {
      allAliases.push({ alias, key, len: alias.length });
    }
  }
  allAliases.sort((a, b) => b.len - a.len);

  for (const { alias, key } of allAliases) {
    // Only match if alias is at least 3 characters and not a substring of an unknown word
    if (alias.length < 3) continue;
    // Only match aliases with at least 4 characters
    if (alias.length < 4) continue;
    // Use regex to match alias as a full word
    const regex = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    const match = normalized.match(regex);
    if (!match) continue;
    const idx = match.index;
    const end = idx + alias.length;
    // Check overlap with already-used ranges
    const overlaps = usedRanges.some(([s, e]) => !(end <= s || idx >= e));
    if (overlaps) continue;
    if (!found.includes(key)) {
      found.push(key);
      usedRanges.push([idx, end]);
    }
  }

  return found.map(key => ({ key, ...DEST_DB[key] }));
}

function deduplicateDestinations(allExtractions) {
  const seen = new Map();
  for (const ext of allExtractions) {
    for (const dest of ext.destinations) {
      if (!seen.has(dest.key)) {
        seen.set(dest.key, { ...dest, mentionedBy: [ext.member], mentions: 1 });
      } else {
        const existing = seen.get(dest.key);
        if (!existing.mentionedBy.includes(ext.member)) {
          existing.mentionedBy.push(ext.member);
        }
        existing.mentions++;
      }
    }
  }
  return Array.from(seen.values())
    .sort((a, b) => b.mentionedBy.length - a.mentionedBy.length || b.mentions - a.mentions);
}

function findDestinationByName(name) {
  const normalized = (name || "").trim().toLowerCase();
  if (!normalized) return null;
  for (const [key, dest] of Object.entries(DEST_DB)) {
    if (dest.canonical.toLowerCase() === normalized) {
      return { key, ...dest, mentionedBy: [], mentions: 0 };
    }
    if ((dest.aliases || []).some((alias) => alias.toLowerCase() === normalized)) {
      return { key, ...dest, mentionedBy: [], mentions: 0 };
    }
  }
  const customKey = (normalized || "destination").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "destination";
  return {
    key: customKey,
    canonical: name,
    country: "Unknown",
    continent: "Unknown",
    aliases: [normalized],
    bestMonths: [4, 5, 9, 10],
    avgDailyCost: 150,
    flightHrs: 8,
    visa: { US: "Check requirements", IN: "Check requirements", UK: "Check requirements", AU: "Check requirements" },
    photo: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&q=80",
    highlights: ["Local culture", "Food", "Sightseeing"],
    lat: 0,
    lng: 0,
    rating: 4.2,
    mentionedBy: [],
    mentions: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRIP MEMBERS
   ═══════════════════════════════════════════════════════════════════════════ */
const MEMBERS = [
  { id: "you", name: "You", initials: "You", nationality: "US", home: "Your city" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL CSS
   ═══════════════════════════════════════════════════════════════════════════ */
const CSS = () => <style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Source+Sans+3:wght@400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Source Sans 3',sans-serif;background:${T.bg};color:${T.text};-webkit-font-smoothing:antialiased}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(77,168,218,0.35);border-radius:6px}
  .hd{font-family:'DM Sans',sans-serif}
  input,textarea{font-family:'Source Sans 3',sans-serif}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${T.border};border-radius:99px}

  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
  @keyframes slideL{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
  @keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.35}40%{transform:scale(1);opacity:1}}
  @keyframes shimmer{0%{background-position:-300% 0}100%{background-position:300% 0}}
  @keyframes popIn{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
  @keyframes thumbUp{0%{transform:rotate(0) scale(1)}25%{transform:rotate(-15deg) scale(1.3)}75%{transform:rotate(5deg) scale(1.1)}100%{transform:rotate(0) scale(1)}}
  @keyframes thumbDown{0%{transform:rotate(0) scale(1)}25%{transform:rotate(15deg) scale(1.3)}75%{transform:rotate(-5deg) scale(1.1)}100%{transform:rotate(0) scale(1)}}
  @keyframes ripple{0%{box-shadow:0 0 0 0 rgba(13,115,119,.3)}100%{box-shadow:0 0 0 16px rgba(13,115,119,0)}}
  @keyframes confettiBurst{0%{transform:translateY(0) rotate(0) scale(1);opacity:1}100%{transform:translateY(-100px) rotate(720deg) scale(0);opacity:0}}
  @keyframes slideProgress{from{width:0%}}
  @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(13,115,119,.15)}50%{box-shadow:0 0 20px rgba(13,115,119,.3)}}
`}</style>;

/* ═══════════════════════════════════════════════════════════════════════════
   ICON SYSTEM
   ═══════════════════════════════════════════════════════════════════════════ */
const Ic = ({n,s=18,c="currentColor"}) => {
  const p = {
    check:<path d="M20 6L9 17l-5-5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke={c}/>,
    x:<path d="M18 6L6 18M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" fill="none" stroke={c}/>,
    send:<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    thumbUp:<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" strokeWidth="1.8" stroke={c} fill="none"/>,
    thumbDn:<path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" strokeWidth="1.8" stroke={c} fill="none"/>,
    star:<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={c}/>,
    map:<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    clock:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M12 6v6l4 2" strokeWidth="1.8" stroke={c} fill="none" strokeLinecap="round"/></>,
    dollar:<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
    plane:<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={c}/>,
    shield:<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="1.8" stroke={c} fill="none"/>,
    users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeWidth="1.8" stroke={c} fill="none"/><circle cx="9" cy="7" r="4" strokeWidth="1.8" stroke={c} fill="none"/></>,
    chevR:<path d="M9 18l6-6-6-6" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    globe:<><circle cx="12" cy="12" r="10" strokeWidth="1.8" stroke={c} fill="none"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeWidth="1.8" stroke={c} fill="none"/></>,
    sparkle:<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeWidth="2" stroke={c} fill="none" strokeLinecap="round"/>,
    db:<><ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="1.8" stroke={c} fill="none"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3M21 5v14c0 1.66-4.03 3-9 3s-9-1.34-9-3V5" strokeWidth="1.8" stroke={c} fill="none"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">{p[n]||p.globe}</svg>;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const PHASES = ["collect", "processing", "enriched", "selection", "complete"];

export default function BucketListAgent({ tripSession = null, onTripSaved = () => {} }) {
  const [phase, setPhase] = useState("collect");
  const [memberInputs, setMemberInputs] = useState({});
  const [chatHistories, setChatHistories] = useState({});
  const [currentInput, setCurrentInput] = useState("");
  const [uniqueDestinations, setUniqueDestinations] = useState([]);
  const [votes, setVotes] = useState({});  // { destKey: { memberId: "up"|"down" } }
  const [topN, setTopN] = useState(3);
  const [selectionDecided, setSelectionDecided] = useState(null); // "yes"|"no"|null
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [dbRecords, setDbRecords] = useState(null);
  const [authToken, setAuthToken] = useState(tripSession?.authToken || "");
  const [tripId, setTripId] = useState(tripSession?.tripId || "");
  const [tripName, setTripName] = useState(tripSession?.tripName || "WanderPlan Bucket List");
  const [persistStatus, setPersistStatus] = useState("");
  const [persistError, setPersistError] = useState("");
  const [extractDebug, setExtractDebug] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const hydratedOnceRef = useRef(false);

  const member = MEMBERS[0];
  const hasAnyDestinations = (memberInputs[member.id]?.destinations || []).length > 0;

  const extractWithBackend = useCallback(async (text) => {
    try {
      const res = await apiJson("/nlp/extract-destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const candidates = Array.isArray(res?.destinations) ? res.destinations : [];
      const mapped = candidates
        .map((row) => {
          const name = typeof row === "string" ? row : row?.name;
          const country = typeof row === "string" ? "" : row?.country;
          const base = findDestinationByName(name);
          if (!base) return null;
          if (country && base.country === "Unknown") {
            return { ...base, country };
          }
          return base;
        })
        .filter(Boolean);

      const deduped = [];
      const seen = new Set();
      mapped.forEach((item) => {
        if (!item?.key || seen.has(item.key)) return;
        seen.add(item.key);
        deduped.push(item);
      });
      return {
        extracted: deduped,
        llmUsed: !!res?.llm_used,
        llmRawText: String(res?.llm_raw_text || ""),
        parseSource: String(res?.parse_source || ""),
        llmError: String(res?.llm_error || ""),
      };
    } catch {
      return {
        extracted: extractDestinations(text),
        llmUsed: false,
        llmRawText: "",
        parseSource: "frontend_fallback",
        llmError: "frontend request failed",
      };
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistories, phase]);

  // Initialize chat
  useEffect(() => {
    if (phase === "collect" && member && !chatHistories[member.id]) {
      const initial = [
        { from: "agent", text: `Hey! 🌍`, delay: 0 },
        { from: "agent", text: `Tell me places you've always wanted to visit. Type naturally and I will extract destinations for your bucket list.`, delay: 600 },
      ];
      setChatHistories(prev => ({ ...prev, [member.id]: initial }));
    }
  }, [phase, chatHistories, member]);

  // ── HANDLE USER INPUT ────────────────────────────────────────────────
  // Handle user input
  const handleSubmit = async () => {
    if (!currentInput.trim()) return;
    const text = currentInput.trim();
    setCurrentInput("");

    setChatHistories((prev) => ({
      ...prev,
      [member.id]: [...(prev[member.id] || []), { from: "user", text }],
    }));

    setPersistStatus("Running LLM destination extraction...");
    const { extracted, llmUsed, llmRawText, parseSource, llmError } = await extractWithBackend(text);
    setPersistStatus(llmUsed ? "LLM extraction completed." : "");
    setExtractDebug({
      llmUsed,
      count: extracted.length,
      parseSource,
      llmRawText,
      llmError,
      at: new Date().toISOString(),
    });

    if (extracted.length === 0) {
      setChatHistories((prev) => ({
        ...prev,
        [member.id]: [
          ...prev[member.id],
          {
            from: "agent",
            text: `I couldn't extract destinations from that. Please include city or country names, for example: "Tokyo, Paris, Bali".`,
          },
        ],
      }));
      return;
    }

    const names = extracted.map((d) => `**${d.canonical}**, ${d.country}`);
    const dedupeNotes = [];
    extracted.forEach((d) => {
      const userWords = text.toLowerCase();
      (d.aliases || []).forEach((alias) => {
        if (userWords.includes(alias) && alias !== d.canonical.toLowerCase()) {
          dedupeNotes.push(`"${alias}" -> ${d.canonical}`);
        }
      });
    });

    let responseMsg = `Found ${extracted.length} destination${extracted.length > 1 ? "s" : ""}!`;
    if (llmUsed) {
      responseMsg += " (LLM extracted)";
    }
    responseMsg += `\n\n${names.join("\n")}`;
    if (dedupeNotes.length > 0) {
      responseMsg += `\n\n_Resolved: ${dedupeNotes.join(", ")}_`;
    }

    setChatHistories((prev) => ({
      ...prev,
      [member.id]: [...prev[member.id], { from: "agent", text: responseMsg, extracted }],
    }));

    setMemberInputs((prev) => {
      const existing = prev[member.id]?.destinations || [];
      const merged = [];
      const seen = new Set();
      [...existing, ...extracted].forEach((item) => {
        if (!item?.key || seen.has(item.key)) return;
        seen.add(item.key);
        merged.push(item);
      });
      return {
        ...prev,
        [member.id]: {
          text: `${prev[member.id]?.text || ""}\n${text}`.trim(),
          destinations: merged,
        },
      };
    });

    setTimeout(() => {
      setChatHistories((prev) => ({
        ...prev,
        [member.id]: [
          ...prev[member.id],
          {
            from: "agent",
            text:
              `Got it. Add more destinations if you want, then click "Process & Enrich Destinations" when ready.`,
          },
        ],
      }));
    }, 800);
  };

  // ── PROCESS & ENRICH ─────────────────────────────────────────────────
  const startProcessing = () => {
    setPhase("processing");
    setProcessingStep(0);

    const allExtractions = Object.entries(memberInputs).map(([memberId, data]) => ({
      member: memberId, destinations: data.destinations,
    }));
    const deduped = deduplicateDestinations(allExtractions);

    // Animate processing steps
    const steps = [
      { label: "Collecting your submitted destinations...", delay: 800 },
      { label: "Running NLP entity recognition...", delay: 1400 },
      { label: `Deduplicating ${allExtractions.reduce((s, e) => s + e.destinations.length, 0)} entries → ${deduped.length} unique...`, delay: 2200 },
      { label: "Fetching cover photos from Unsplash...", delay: 3000 },
      { label: "Enriching with weather, cost & visa data...", delay: 3800 },
      { label: "Computing flight times from New York...", delay: 4400 },
      { label: "Ready! ✨", delay: 5000 },
    ];

    steps.forEach((step, i) => {
      setTimeout(() => setProcessingStep(i), step.delay);
    });

    setTimeout(() => {
      setUniqueDestinations(deduped);
      setPhase("enriched");
    }, 5400);
  };

  // ── VOTING LOGIC ─────────────────────────────────────────────────────
  const vote = (destKey, memberId, direction) => {
    setVotes(prev => ({
      ...prev,
      [destKey]: { ...(prev[destKey] || {}), [memberId]: direction },
    }));
  };

  const getRankScore = (destKey) => {
    const destination = uniqueDestinations.find((d) => d.key === destKey);
    const fallbackScore = Number(destination?.mentions || destination?.mentionedBy?.length || 0);
    const v = votes[destKey] || {};
    if (Object.keys(v).length === 0) return fallbackScore;
    const ups = Object.values(v).filter(x => x === "up").length;
    const downs = Object.values(v).filter(x => x === "down").length;
    return (ups - downs) / MEMBERS.length;
  };

  const allVoted = true;

  const rankedDestinations = [...uniqueDestinations].sort((a, b) => getRankScore(b.key) - getRankScore(a.key));
  const topDestinations = rankedDestinations.slice(0, topN);
  const alternativeDestinations = rankedDestinations.slice(topN);

  useEffect(() => {
    setAuthToken(tripSession?.authToken || "");
    setTripId(tripSession?.tripId || "");
    if (tripSession?.tripName) {
      setTripName(tripSession.tripName);
    }
  }, [tripSession?.authToken, tripSession?.tripId, tripSession?.tripName]);

  const ensureAuth = useCallback(async (force = false) => {
    if (!force && authToken) return authToken;
    const login = await apiJson("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@test.com", password: "Password1!" }),
    });
    const token = login?.accessToken || "";
    setAuthToken(token);
    return token;
  }, [authToken]);

  const ensureTrip = useCallback(async (token) => {
    if (tripId) return tripId;
    const created = await apiJson("/trips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: tripName || "WanderPlan Bucket List", duration_days: 10 }),
    });
    const createdTripId = created?.trip?.id || "";
    if (!createdTripId) throw new Error("Trip creation failed");
    setTripId(createdTripId);
    return createdTripId;
  }, [tripId, tripName]);

  useEffect(() => {
    if (hydratedOnceRef.current) return;
    hydratedOnceRef.current = true;
    let cancelled = false;
    async function hydrateSavedDestinations() {
      setPersistError("");
      try {
        const token = await ensureAuth();
        if (!token || cancelled) return;
        const id = await ensureTrip(token);
        if (!id || cancelled) return;
        const payload = await apiJson(`/trips/${id}/destinations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const saved = Array.isArray(payload?.destinations) ? payload.destinations : [];
        if (saved.length > 0) {
          const found = saved
            .map((item) => findDestinationByName(item?.name))
            .filter(Boolean);
          if (found.length > 0) {
            const seen = new Set();
            const dedupedFound = found.filter((d) => {
              if (seen.has(d.key)) return false;
              seen.add(d.key);
              return true;
            });
            const seededVotes = {};
            saved.forEach((item) => {
              const mapped = findDestinationByName(item?.name);
              if (!mapped) return;
              const upCount = Math.max(0, Number(item?.votes || 0));
              const memberVotes = {};
              MEMBERS.forEach((m, idx) => {
                memberVotes[m.id] = idx < upCount ? "up" : "down";
              });
              seededVotes[mapped.key] = memberVotes;
            });
            setUniqueDestinations(dedupedFound);
            setVotes(seededVotes);
            setTopN(Math.min(3, Math.max(1, dedupedFound.length)));
            setPhase("selection");
          }
        }
        onTripSaved({
          tripId: id,
          tripName,
          authToken: token,
          members: tripSession?.members || [],
          destinations: saved.map((d) => d?.name).filter(Boolean),
        });
      } catch (err) {
        if (!cancelled) {
          setPersistError(err?.message || "Failed to initialize backend session");
        }
      }
    }
    hydrateSavedDestinations();
    return () => {
      cancelled = true;
    };
  }, [ensureAuth, ensureTrip, onTripSaved, tripName, tripSession?.members]);

  // ── STORE TO DB ──────────────────────────────────────────────────────
  const storeSelections = async () => {
    setPersistError("");
    setPersistStatus("Saving bucket list to backend...");
    const records = {
      trip_plans: {
        bucket_list: topDestinations.map(d => d.key),
        updated_at: new Date().toISOString(),
      },
      bucket_list_items: topDestinations.map((d, i) => ({
        destination_key: d.key,
        canonical_name: d.canonical,
        country: d.country,
        rank: i + 1,
        rank_score: getRankScore(d.key).toFixed(2),
        mentioned_by: d.mentionedBy,
        upvotes: Object.values(votes[d.key] || {}).filter(v => v === "up").length,
        downvotes: Object.values(votes[d.key] || {}).filter(v => v === "down").length,
        best_months: d.bestMonths,
        avg_daily_cost: d.avgDailyCost,
        photo_url: d.photo,
      })),
    };
    try {
      const token = await ensureAuth();
      const id = await ensureTrip(token);
      const destinationNames = topDestinations.map((d) => d.canonical);
      const voteMap = {};
      topDestinations.forEach((d) => {
        const ups = Object.values(votes[d.key] || {}).filter((v) => v === "up").length;
        voteMap[d.canonical] = ups > 0 ? ups : 1;
      });
      await apiJson(`/trips/${id}/destinations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destinations: destinationNames,
          votes: voteMap,
        }),
      });
      onTripSaved({
        tripId: id,
        tripName,
        authToken: token,
        members: tripSession?.members || [],
        destinations: destinationNames,
      });
      setPersistStatus("Bucket list saved to backend.");
      setDbRecords(records);
      setPhase("complete");
    } catch (err) {
      setPersistError(err?.message || "Failed to save bucket list");
      setPersistStatus("");
    }
  };

  /* ═════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════ */

  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <CSS/>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <header style={{ background:`linear-gradient(135deg,${T.primaryDark},${T.primary} 60%,${T.primaryLight})`,
        padding:"20px 24px", color:"#fff", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute",top:0,right:0,width:"50%",height:"100%",
          background:`radial-gradient(circle at 80% 40%,${T.accent}15,transparent 65%)`,pointerEvents:"none" }}/>
        <div style={{ maxWidth:720,margin:"0 auto",position:"relative" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:4 }}>
            <div style={{ width:40,height:40,borderRadius:12,
              background:"rgba(255,255,255,.12)",backdropFilter:"blur(8px)",
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:"glow 3s ease-in-out infinite" }}>
              <span style={{ fontSize:22 }}>🌍</span>
            </div>
            <div>
              <h1 className="hd" style={{ fontWeight:700,fontSize:20 }}>Bucket List Agent</h1>
              <p style={{ fontSize:13,opacity:.7 }}>Collecting & ranking dream destinations</p>
            </div>
          </div>

          {/* Phase progress */}
          <div style={{ display:"flex",gap:4,marginTop:14 }}>
            {PHASES.map((p, i) => (
              <div key={p} style={{ flex:1,height:3,borderRadius:999,
                background: PHASES.indexOf(phase) >= i ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.15)",
                transition:"background .5s" }}/>
            ))}
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:6,fontSize:11,opacity:.5 }}>
            <span>Collect</span><span>Process</span><span>Enrich</span><span>Select</span><span>Done</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth:720,margin:"0 auto",padding:"20px 20px 80px" }}>
        {persistStatus && (
          <div style={{ marginBottom:10, color:T.success, fontSize:13, fontWeight:600 }}>
            {persistStatus}
          </div>
        )}
        {persistError && (
          <div style={{ marginBottom:10, color:T.error, fontSize:13, fontWeight:600 }}>
            {persistError}
          </div>
        )}
        {extractDebug && (
          <div style={{ marginBottom:10, color:T.text2, fontSize:12, fontWeight:600 }}>
            Extraction debug: LLM used = {String(!!extractDebug.llmUsed)}, extracted = {extractDebug.count}, source = {extractDebug.parseSource || "unknown"}
            {extractDebug.llmError ? (
              <div style={{ marginTop:4, color:T.error, fontWeight:600 }}>
                LLM error: {extractDebug.llmError}
              </div>
            ) : null}
            {extractDebug.llmRawText ? (
              <pre style={{ marginTop:6, padding:8, borderRadius:8, background:"#F8FAFC", border:`1px solid ${T.borderLight}`, whiteSpace:"pre-wrap", wordBreak:"break-word", fontWeight:500 }}>
                {extractDebug.llmRawText}
              </pre>
            ) : null}
          </div>
        )}
        {/* ═══════════════════════════════════════════════════════════
           PHASE 1: COLLECT
           ═══════════════════════════════════════════════════════════ */}
        {phase === "collect" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            {/* Chat area */}
            <div style={{ background:T.surface,borderRadius:18,border:`1px solid ${T.borderLight}`,
              boxShadow:sh.sm,overflow:"hidden" }}>
              <div style={{ maxHeight:420,overflowY:"auto",padding:"18px 20px",display:"flex",flexDirection:"column",gap:12 }}>
                {(chatHistories[member?.id] || []).map((msg, i) => (
                  <ChatBubble key={`${member?.id}-${i}`} msg={msg} index={i}/>
                ))}
                <div ref={chatEndRef}/>
              </div>

              {/* Input bar */}
              <div style={{ borderTop:`1px solid ${T.borderLight}`,padding:14,display:"flex",gap:10 }}>
                <input ref={inputRef} value={currentInput} onChange={e => setCurrentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
                  placeholder="Type destinations… e.g. Tokyo, Paris, Bali"
                  style={{ flex:1,padding:"12px 16px",borderRadius:12,border:`1.5px solid ${T.border}`,
                    fontSize:15,color:T.text,background:T.bg,minHeight:46 }}/>
                <button onClick={handleSubmit} style={{ width:46,height:46,borderRadius:12,border:"none",
                  background:T.primary,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                  boxShadow:`0 2px 8px ${T.primary}30` }}>
                  <Ic n="send" s={18} c="#fff"/>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:"flex",gap:10,marginTop:16,flexWrap:"wrap" }}>
              {!hasAnyDestinations && (
                <p style={{ fontSize:13,color:T.text3 }}>
                  Add at least one destination in chat to continue.
                </p>
              )}
              {hasAnyDestinations && (
                <button onClick={startProcessing} className="hd"
                  style={{ padding:"12px 24px",borderRadius:12,border:"none",
                    background:T.primary,color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",
                    minHeight:48,boxShadow:`0 2px 12px ${T.primary}30`,
                    display:"flex",alignItems:"center",gap:8,animation:"ripple 2s infinite" }}>
                  Process & Enrich Destinations →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE 2: PROCESSING
           ═══════════════════════════════════════════════════════════ */}
        {phase === "processing" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <div style={{ background:T.surface,borderRadius:18,padding:28,border:`1px solid ${T.borderLight}`,
              boxShadow:sh.md,textAlign:"center" }}>
              <div style={{ width:64,height:64,borderRadius:20,margin:"0 auto 20px",
                background:`linear-gradient(135deg,${T.primary}15,${T.accent}10)`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,
                animation:"glow 2s ease-in-out infinite" }}>🔮</div>
              <h2 className="hd" style={{ fontWeight:700,fontSize:22,marginBottom:8 }}>Processing Destinations</h2>
              <p style={{ color:T.text2,fontSize:14,marginBottom:28 }}>Running NLP extraction, deduplication, and enrichment pipeline...</p>

              <div style={{ display:"flex",flexDirection:"column",gap:12,textAlign:"left",maxWidth:440,margin:"0 auto" }}>
                {[
                  "Collecting your submitted destinations...",
                  "Running NLP entity recognition...",
                  `Deduplicating entries → unique destinations...`,
                  "Fetching cover photos from Unsplash...",
                  "Enriching with weather, cost & visa data...",
                  "Computing flight times from New York...",
                  "Ready! ✨",
                ].map((step, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:12,
                    opacity:processingStep >= i ? 1 : 0.25,transition:"opacity .4s",
                    animation:processingStep === i ? "fadeUp .3s ease-out" : "none" }}>
                    <div style={{ width:24,height:24,borderRadius:999,flexShrink:0,
                      background:processingStep > i ? T.success : processingStep === i ? T.primary : T.borderLight,
                      display:"flex",alignItems:"center",justifyContent:"center",transition:"all .3s" }}>
                      {processingStep > i ? <Ic n="check" s={12} c="#fff"/> :
                        processingStep === i ? <div style={{ width:8,height:8,borderRadius:999,background:"#fff",animation:"dotPulse 1s infinite" }}/> :
                        <div style={{ width:6,height:6,borderRadius:999,background:T.text3 }}/>}
                    </div>
                    <span style={{ fontSize:14,fontWeight:processingStep===i?600:400,
                      color:processingStep>=i?T.text:T.text3 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE 3: ENRICHED — Destination cards
           ═══════════════════════════════════════════════════════════ */}
        {phase === "enriched" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
              <div>
                <h2 className="hd" style={{ fontWeight:700,fontSize:20 }}>{uniqueDestinations.length} Unique Destinations Found</h2>
                <p style={{ fontSize:13,color:T.text2 }}>Extracted from your natural-language bucket list input</p>
              </div>
              <button onClick={() => setPhase("selection")} className="hd"
                style={{ padding:"10px 20px",borderRadius:10,border:"none",background:T.primary,
                  color:"#fff",fontWeight:600,fontSize:14,cursor:"pointer",minHeight:42,
                  boxShadow:`0 2px 8px ${T.primary}30` }}>
                Review Ranked List →
              </button>
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {uniqueDestinations.map((dest, i) => (
                <DestinationCard key={dest.key} dest={dest} index={i} expanded/>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE 4: VOTING
           ═══════════════════════════════════════════════════════════ */}
        {phase === "voting" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
              <div>
                <h2 className="hd" style={{ fontWeight:700,fontSize:20 }}>Group Vote</h2>
                <p style={{ fontSize:13,color:T.text2 }}>Each member votes 👍 or 👎 on every destination</p>
              </div>
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {uniqueDestinations.map((dest, i) => {
                const destVotes = votes[dest.key] || {};
                const ups = Object.values(destVotes).filter(v => v === "up").length;
                const downs = Object.values(destVotes).filter(v => v === "down").length;
                const score = getRankScore(dest.key);

                return (
                  <div key={dest.key} style={{ background:T.surface,borderRadius:16,overflow:"hidden",
                    border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,
                    animation:`slideL .4s ease-out ${i*.06}s both` }}>
                    <div style={{ display:"flex",gap:0 }}>
                      {/* Photo */}
                      <div style={{ width:110,minHeight:140,flexShrink:0,
                        background:`url(${dest.photo}) center/cover`,position:"relative" }}>
                        <div style={{ position:"absolute",inset:0,background:"linear-gradient(to right,transparent 60%,rgba(0,0,0,.03))" }}/>
                      </div>
                      <div style={{ flex:1,padding:"14px 16px" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                          <div>
                            <h3 className="hd" style={{ fontWeight:700,fontSize:16 }}>{dest.canonical}</h3>
                            <p style={{ fontSize:12.5,color:T.text2 }}>{dest.country} · Mentioned by {dest.mentionedBy.length}</p>
                          </div>
                          {Object.keys(destVotes).length === MEMBERS.length && (
                            <div className="hd" style={{ padding:"4px 12px",borderRadius:999,
                              background:score>0?T.successBg:score===0?T.warningBg:T.errorBg,
                              color:score>0?T.success:score===0?T.warning:T.error,
                              fontWeight:700,fontSize:13,animation:"popIn .3s ease" }}>
                              {score>0?"+":""}{score.toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Member vote buttons */}
                        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                          {MEMBERS.map(m => {
                            const myVote = destVotes[m.id];
                            return (
                              <div key={m.id} style={{ display:"flex",alignItems:"center",gap:4 }}>
                                <div style={{ width:22,height:22,borderRadius:999,
                                  background:`linear-gradient(135deg,${T.primary},${T.accent})`,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  color:"#fff",fontSize:8,fontWeight:700 }} className="hd">{m.initials}</div>
                                {!myVote ? (
                                  <div style={{ display:"flex",gap:2 }}>
                                    <button onClick={() => vote(dest.key, m.id, "up")}
                                      style={{ width:26,height:26,borderRadius:8,border:`1px solid ${T.success}40`,
                                        background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                                      <Ic n="thumbUp" s={12} c={T.success}/>
                                    </button>
                                    <button onClick={() => vote(dest.key, m.id, "down")}
                                      style={{ width:26,height:26,borderRadius:8,border:`1px solid ${T.error}40`,
                                        background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                                      <Ic n="thumbDn" s={12} c={T.error}/>
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ width:26,height:26,borderRadius:8,
                                    background:myVote==="up"?T.successBg:T.errorBg,
                                    display:"flex",alignItems:"center",justifyContent:"center",
                                    animation:myVote==="up"?"thumbUp .4s ease":"thumbDown .4s ease" }}>
                                    <Ic n={myVote==="up"?"thumbUp":"thumbDn"} s={13} c={myVote==="up"?T.success:T.error}/>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Vote tally bar */}
                        {Object.keys(destVotes).length > 0 && (
                          <div style={{ marginTop:8,height:4,background:T.borderLight,borderRadius:999,display:"flex",overflow:"hidden" }}>
                            {ups>0 && <div style={{ width:`${(ups/MEMBERS.length)*100}%`,background:T.success,transition:"width .3s" }}/>}
                            {downs>0 && <div style={{ width:`${(downs/MEMBERS.length)*100}%`,background:T.error,marginLeft:"auto",transition:"width .3s" }}/>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {allVoted && (
              <div style={{ marginTop:20,animation:"scaleIn .3s ease-out" }}>
                <button onClick={() => setPhase("selection")} className="hd"
                  style={{ width:"100%",padding:"14px",borderRadius:14,border:"none",
                    background:T.primary,color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
                    minHeight:50,boxShadow:`0 4px 16px ${T.primary}30` }}>
                  View Results & Select Top {topN} →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE 5: SELECTION — YesNoCard
           ═══════════════════════════════════════════════════════════ */}
        {phase === "selection" && (
          <div style={{ animation:"fadeUp .4s ease-out" }}>
            <h2 className="hd" style={{ fontWeight:700,fontSize:20,marginBottom:4 }}>Final Rankings</h2>
            <p style={{ fontSize:13,color:T.text2,marginBottom:18 }}>Ranked by extraction confidence and mentions</p>

            {/* Rankings */}
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:24 }}>
              {rankedDestinations.map((dest, i) => {
                const score = getRankScore(dest.key);
                const isTop = i < topN;
                const mentionCount = Number(dest.mentions || dest.mentionedBy?.length || 0);
                return (
                  <div key={dest.key} style={{ background:T.surface,borderRadius:14,padding:"12px 16px",
                    border:`2px solid ${isTop?(showAlternatives&&i>=topN?T.primary:T.primary):T.borderLight}`,
                    display:"flex",alignItems:"center",gap:14,
                    boxShadow:isTop?sh.md:sh.sm,opacity:isTop||showAlternatives?1:.4,
                    animation:`slideL .35s ease-out ${i*.05}s both`,transition:"all .3s" }}>
                    <div className="hd" style={{ width:32,height:32,borderRadius:10,flexShrink:0,
                      background:isTop?T.primary:T.borderLight,color:isTop?"#fff":T.text3,
                      display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14 }}>
                      #{i+1}
                    </div>
                    <div style={{ width:44,height:44,borderRadius:10,flexShrink:0,
                      background:`url(${dest.photo}) center/cover` }}/>
                    <div style={{ flex:1,minWidth:0 }}>
                      <p className="hd" style={{ fontWeight:600,fontSize:15 }}>{dest.canonical}</p>
                      <p style={{ fontSize:12,color:T.text2 }}>{dest.country} · {mentionCount} mention{mentionCount === 1 ? "" : "s"}</p>
                    </div>
                    <div className="hd" style={{ padding:"4px 12px",borderRadius:999,
                      background:score>0?T.successBg:T.warningBg,
                      color:score>0?T.success:T.warning,fontWeight:700,fontSize:14 }}>
                      {score>0?"+":""}{score.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* YesNoCard */}
            {!selectionDecided && (
              <div style={{ background:T.surface,borderRadius:18,boxShadow:sh.lg,overflow:"hidden",
                border:`1px solid ${T.borderLight}`,animation:"scaleIn .4s ease-out" }}>
                <div style={{ padding:"20px 24px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                    <span className="hd" style={{ background:`${T.primary}12`,color:T.primary,
                      padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,letterSpacing:".3px" }}>
                      Bucket List Agent
                    </span>
                  </div>
                  <h3 className="hd" style={{ fontWeight:700,fontSize:20,marginBottom:4 }}>
                    {showAlternatives ? "Alternative selections" : "Your group loves these!"}
                  </h3>
                  <p style={{ fontSize:15,color:T.text2,lineHeight:1.6,marginBottom:16 }}>
                    {showAlternatives
                      ? `Here are the next-ranked alternatives: ${alternativeDestinations.slice(0, topN).map(d => d.canonical).join(", ")}. Plan for these instead?`
                      : `${topDestinations.map(d => d.canonical).join(", ")} — your top ${topN} by group vote. Plan for these?`}
                  </p>
                  <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:18 }}>
                    {(showAlternatives ? alternativeDestinations.slice(0, topN) : topDestinations).map(d => (
                      <span key={d.key} style={{ background:`${T.accent}14`,color:T.accent,
                        padding:"4px 12px",borderRadius:999,fontSize:13,fontWeight:500 }}>
                        {d.canonical} ({`+${getRankScore(d.key).toFixed(2)}`})
                      </span>
                    ))}
                  </div>
                  <div style={{ display:"flex",gap:12 }}>
                    <button onClick={() => { if (!showAlternatives) { setShowAlternatives(true); } }}
                      className="hd" style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        padding:"14px",borderRadius:12,border:`2px solid ${T.error}`,
                        background:"transparent",color:T.error,fontSize:15,fontWeight:600,
                        cursor:"pointer",minHeight:50,transition:"all .2s" }}>
                      <Ic n="x" s={18} c={T.error}/> Revise
                    </button>
                    <button onClick={() => { setSelectionDecided("yes"); setTimeout(storeSelections, 800); }}
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

            {selectionDecided === "yes" && (
              <div style={{ textAlign:"center",padding:24,animation:"scaleIn .4s ease-out" }}>
                <div style={{ fontSize:48,marginBottom:12 }}>✅</div>
                <p className="hd" style={{ fontWeight:700,fontSize:18,color:T.success }}>Approved! Saving to database...</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
           PHASE 6: COMPLETE — DB Records
           ═══════════════════════════════════════════════════════════ */}
        {phase === "complete" && dbRecords && (
          <div style={{ animation:"fadeUp .5s ease-out" }}>
            <div style={{ textAlign:"center",marginBottom:28 }}>
              <div style={{ fontSize:56,marginBottom:12,position:"relative",display:"inline-block" }}>
                🎉
                {["✨","🌟","🗺️","✈️","🎊"].map((e,i) => (
                  <span key={i} style={{ position:"absolute",fontSize:16,
                    top:`${-8 + Math.sin(i*1.3)*25}px`,left:`${-15 + Math.cos(i*1.3)*35}px`,
                    animation:`confettiBurst 1.2s ease-out ${.2+i*.1}s both`,pointerEvents:"none" }}>{e}</span>
                ))}
              </div>
              <h2 className="hd" style={{ fontWeight:700,fontSize:24 }}>Bucket List Locked In!</h2>
              <p style={{ color:T.text2,fontSize:15,marginTop:6 }}>Your selections have been stored and are ready for the next planning stages.</p>
            </div>

            {/* Selected destinations summary */}
            <div style={{ display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",marginBottom:28 }}>
              {topDestinations.map((d, i) => (
                <div key={d.key} style={{ width:200,background:T.surface,borderRadius:16,overflow:"hidden",
                  border:`2px solid ${T.primary}30`,boxShadow:sh.md,animation:`scaleIn .4s ease-out ${i*.1}s both` }}>
                  <div style={{ height:100,background:`url(${d.photo}) center/cover`,position:"relative" }}>
                    <div className="hd" style={{ position:"absolute",top:8,left:8,background:"rgba(13,115,119,.9)",
                      color:"#fff",padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700 }}>#{i+1}</div>
                  </div>
                  <div style={{ padding:"10px 14px" }}>
                    <h4 className="hd" style={{ fontWeight:700,fontSize:15 }}>{d.canonical}</h4>
                    <p style={{ fontSize:12,color:T.text2 }}>{d.country}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Database records */}
            <div style={{ background:T.surface,borderRadius:16,overflow:"hidden",border:`1px solid ${T.borderLight}`,boxShadow:sh.sm }}>
              <div style={{ padding:"14px 18px",background:`${T.primaryDark}08`,borderBottom:`1px solid ${T.borderLight}`,
                display:"flex",alignItems:"center",gap:8 }}>
                <Ic n="db" s={16} c={T.primary}/>
                <span className="hd" style={{ fontWeight:700,fontSize:14,color:T.primary }}>Database Records</span>
              </div>

              {/* trip_plans.bucket_list */}
              <div style={{ padding:18,borderBottom:`1px solid ${T.borderLight}` }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  trip_plans.bucket_list
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12.5,lineHeight:1.6,
                  color:T.text,overflow:"auto",border:`1px solid ${T.borderLight}`,fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.trip_plans, null, 2)}
                </pre>
              </div>

              {/* bucket_list_items */}
              <div style={{ padding:18 }}>
                <p className="hd" style={{ fontWeight:600,fontSize:13,color:T.text3,marginBottom:8 }}>
                  bucket_list_items ({dbRecords.bucket_list_items.length} rows)
                </p>
                <pre style={{ background:T.bg,borderRadius:10,padding:14,fontSize:12.5,lineHeight:1.6,
                  color:T.text,overflow:"auto",maxHeight:300,border:`1px solid ${T.borderLight}`,fontFamily:"'SFMono-Regular',Consolas,monospace" }}>
{JSON.stringify(dbRecords.bucket_list_items, null, 2)}
                </pre>
              </div>
            </div>

            {/* Reset */}
            <div style={{ textAlign:"center",marginTop:24 }}>
              <button onClick={() => {
                setPhase("collect"); setMemberInputs({});
                setChatHistories({}); setCurrentInput(""); setUniqueDestinations([]);
                setVotes({}); setSelectionDecided(null); setShowAlternatives(false);
                setDbRecords(null);
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
   CHAT BUBBLE
   ═══════════════════════════════════════════════════════════════════════════ */
function ChatBubble({ msg, index }) {
  const isUser = msg.from === "user";
  return (
    <div style={{ display:"flex",gap:10,flexDirection:isUser?"row-reverse":"row",
      maxWidth:460,animation:`fadeUp .3s ease-out ${index*.05}s both`,
      alignSelf:isUser?"flex-end":"flex-start" }}>
      {!isUser && <div style={{ width:30,height:30,borderRadius:999,flexShrink:0,
        background:`linear-gradient(135deg,${T.primary},${T.accent})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>🌍</div>}
      <div>
        {!isUser && index <= 1 && <p className="hd" style={{ fontSize:10.5,color:T.primary,fontWeight:600,marginBottom:3 }}>Bucket List Agent</p>}
        <div style={{ background:isUser?T.primary:T.surface,color:isUser?"#fff":T.text,
          padding:"10px 14px",borderRadius:`12px 12px ${isUser?"3px":"12px"} ${isUser?"12px":"3px"}`,
          boxShadow:sh.sm,fontSize:14,lineHeight:1.6,
          border:isUser?"none":`1px solid ${T.borderLight}` }}>
          {msg.text.split("\n").map((line, i) => (
            <p key={i} style={{ marginBottom:i < msg.text.split("\n").length - 1 ? 6 : 0 }}>
              {line.startsWith("_") && line.endsWith("_")
                ? <em style={{ fontSize:12.5,color:isUser?"rgba(255,255,255,.7)":T.text3 }}>{line.slice(1,-1)}</em>
                : line.split("**").map((seg, j) =>
                    j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg
                  )}
            </p>
          ))}
          {/* Extracted tags */}
          {msg.extracted && msg.extracted.length > 0 && (
            <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginTop:8 }}>
              {msg.extracted.map(d => (
                <span key={d.key} style={{ background:`${isUser?"rgba(255,255,255,.2)":`${T.accent}14`}`,
                  color:isUser?"#fff":T.accent,padding:"2px 9px",borderRadius:999,
                  fontSize:11.5,fontWeight:500,display:"flex",alignItems:"center",gap:3 }}>
                  <Ic n="map" s={10} c={isUser?"#fff":T.accent}/> {d.canonical}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENRICHED DESTINATION CARD
   ═══════════════════════════════════════════════════════════════════════════ */
function DestinationCard({ dest, index, expanded }) {
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div style={{ background:T.surface,borderRadius:16,overflow:"hidden",
      border:`1px solid ${T.borderLight}`,boxShadow:sh.sm,
      animation:`slideL .4s ease-out ${index*.07}s both` }}>
      <div style={{ display:"flex",gap:0 }}>
        <div style={{ width:140,minHeight:expanded?220:120,flexShrink:0,
          background:`url(${dest.photo}) center/cover`,position:"relative" }}>
          <div style={{ position:"absolute",bottom:8,left:8,
            background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",
            color:"#fff",padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:600 }}>
            {dest.continent}
          </div>
        </div>
        <div style={{ flex:1,padding:"14px 18px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6 }}>
            <div>
              <h3 className="hd" style={{ fontWeight:700,fontSize:17 }}>{dest.canonical}</h3>
              <p style={{ fontSize:13,color:T.text2 }}>{dest.country}</p>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:3 }}>
              <Ic n="star" s={14} c={T.warning}/>
              <span className="hd" style={{ fontWeight:700,fontSize:14 }}>{dest.rating}</span>
            </div>
          </div>

          {/* Mentioned by */}
          <div style={{ display:"flex",alignItems:"center",gap:4,marginBottom:10 }}>
            {dest.mentionedBy.map(mid => {
              const m = MEMBERS.find(x => x.id === mid);
              return m ? <div key={mid} style={{ width:20,height:20,borderRadius:999,
                background:`linear-gradient(135deg,${T.primary},${T.accent})`,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontSize:7,fontWeight:700,border:`1.5px solid ${T.surface}`,
                marginLeft:dest.mentionedBy.indexOf(mid)>0?-6:0 }} className="hd">{m.initials}</div> : null;
            })}
            <span style={{ fontSize:12,color:T.text3,marginLeft:4 }}>
              {dest.mentionedBy.length} member{dest.mentionedBy.length>1?"s":""} suggested
            </span>
          </div>

          {/* Stats grid */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10 }}>
            {[
              { icon:"dollar",label:"Avg/day",value:`$${dest.avgDailyCost}`,color:T.success },
              { icon:"plane",label:"Flight",value:`${dest.flightHrs}h`,color:T.accent },
              { icon:"clock",label:"Best months",value:dest.bestMonths.slice(0,3).map(m=>monthNames[m-1]).join(","),color:T.primary },
            ].map(s => (
              <div key={s.label} style={{ background:T.bg,borderRadius:8,padding:"6px 8px",textAlign:"center" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:3,marginBottom:2 }}>
                  <Ic n={s.icon} s={12} c={s.color}/>
                  <span style={{ fontSize:10,color:T.text3 }}>{s.label}</span>
                </div>
                <p className="hd" style={{ fontWeight:600,fontSize:13 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Visa info */}
          <div style={{ marginBottom:8 }}>
            <p style={{ fontSize:11,color:T.text3,fontWeight:600,marginBottom:4 }}>Visa Requirements</p>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              {MEMBERS.map(m => {
                const visa = dest.visa[m.nationality] || "Check embassy";
                const isFree = visa.toLowerCase().includes("free") || visa === "none" || visa.toLowerCase().includes("on arrival") || visa.toLowerCase().includes("esta");
                return (
                  <span key={m.id} style={{ fontSize:10.5,padding:"2px 8px",borderRadius:999,
                    background:isFree?T.successBg:T.warningBg,
                    color:isFree?T.success:T.warning,fontWeight:500 }}>
                    {m.initials}: {visa.length > 18 ? visa.slice(0,16) + "…" : visa}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Highlights */}
          <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
            {dest.highlights.slice(0,3).map(h => (
              <span key={h} style={{ fontSize:11,background:`${T.accent}10`,color:T.accent,
                padding:"2px 8px",borderRadius:999 }}>{h}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



