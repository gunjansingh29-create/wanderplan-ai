import { useState, useEffect, useRef } from "react";
import { BUILD_INFO } from "./buildInfo";

var C = {bg:"#08070d",bg2:"#110f1a",surface:"#161322",border:"rgba(255,255,255,0.06)",gold:"#E8A838",goldDim:"rgba(232,168,56,0.12)",goldT:"#f0c060",coral:"#E8634A",teal:"#0D7377",tealL:"#1A9A9F",sky:"#4DA8DA",tx:"#fff",tx2:"rgba(255,255,255,0.52)",tx3:"rgba(255,255,255,0.28)",grn:"#22C55E",grnBg:"rgba(34,197,94,0.1)",red:"#EF4444",redBg:"rgba(239,68,68,0.1)",wrn:"#F59E0B",wrnBg:"rgba(245,158,11,0.1)",purp:"#8B5CF6"};
var MO=["J","F","M","A","M","J","J","A","S","O","N","D"];
var MOFUL=["January","February","March","April","May","June","July","August","September","October","November","December"];
var CATS=[{id:"hiking",q:"Hiking & nature?"},{id:"food",q:"Food & cooking?"},{id:"culture",q:"Temples & history?"},{id:"photo",q:"Photography?"},{id:"adventure",q:"Water sports?"},{id:"nightlife",q:"Nightlife?"},{id:"shopping",q:"Markets & shopping?"},{id:"wellness",q:"Spa & wellness?"}];
var BUDGETS=[{id:"budget",l:"Budget",r:"$50-120/day"},{id:"moderate",l:"Mid-range",r:"$120-250/day"},{id:"premium",l:"Premium",r:"$250-400/day"},{id:"luxury",l:"Luxury",r:"$400+/day"}];
var STYLES=[{id:"solo",l:"Solo"},{id:"couple",l:"Couple"},{id:"friends",l:"Friends"},{id:"family",l:"Family"}];
var WIZ=["Destinations","Invite Crew","Vote","Interests","Health","Route Planner","Activities","POI Voting","Budget","Duration","Stays","Dining","Itinerary","Availability","Flights","Confirm"];
var WIZARD_ORDER_VERSION=3;
var MAX_BUCKET_DESTINATION_NAME_LENGTH=80;
var MAX_CONSECUTIVE_CONSONANTS_IN_DESTINATION_NAME=6;
var BUCKET_DESTINATION_DIGIT_RUN_RE=/\d{3,}/;
var BUCKET_DESTINATION_ALLOWED_CHARS_RE=/[^A-Za-zÀ-ÖØ-öø-ÿ .'\-()]/;
var BUCKET_DESTINATION_LETTERS_ONLY_RE=/[^A-Za-zÀ-ÖØ-öø-ÿ]/g;
var BUCKET_DESTINATION_VOWEL_RE=/[aeiouyà-öø-ÿ]/i;
var BUILD_STAMP=("Build "+String(BUILD_INFO&&BUILD_INFO.sha||"unknown")+" | "+String(BUILD_INFO&&BUILD_INFO.branch||"unknown")).trim();
var BUILD_STAMP_DETAIL=String(BUILD_INFO&&BUILD_INFO.builtAt||"unknown");

function Fade(props){var d=props.delay||0;var mt=useRef(null);var[v,setV]=useState(false);useEffect(function(){mt.current=setTimeout(function(){setV(true);},Math.max(d,10));return function(){clearTimeout(mt.current);};},[]);return(<div style={Object.assign({opacity:v?1:0,transform:v?"none":"translateY(14px)",transition:"all .6s cubic-bezier(.16,1,.3,1)"},props.style||{})}>{props.children}</div>);}
function Avi(props){var s=props.size||28;return(<div title={props.name||""} style={{width:s,height:s,borderRadius:999,background:props.color||C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontSize:s*.4,fontWeight:700,color:"#fff",flexShrink:0,border:"1.5px solid "+C.surface}}>{props.ini||"?"}</div>);}
function TrashIcon(props){var s=props.size||14;var c=props.color||"currentColor";return(<svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M10 11v6M14 11v6" stroke={c} strokeWidth="2" strokeLinecap="round"/></svg>);}

async function ld(k,fb){
  try{
    if(window.storage&&typeof window.storage.get==="function"){
      var r=await window.storage.get(k);if(r&&r.value)return JSON.parse(r.value);
    }
  }catch(e){}
  try{
    var raw=window.localStorage.getItem(k);if(raw!==null)return JSON.parse(raw);
  }catch(e){}
  return fb;
}
async function sv(k,v){
  var txt=JSON.stringify(v);
  try{
    if(window.storage&&typeof window.storage.set==="function"){await window.storage.set(k,txt);return;}
  }catch(e){}
  try{window.localStorage.setItem(k,txt);}catch(e){}
}

function emptyUserState(){
  return {name:"",email:"",styles:[],interests:{},budget:"moderate",dietary:[]};
}

function accountCacheKey(baseKey,token,email){
  var base=String(baseKey||"").trim();
  if(!base)return "";
  var uid=userIdFromToken(token||"");
  if(uid)return base+":uid:"+uid;
  var em=String(email||"").trim().toLowerCase();
  if(em)return base+":email:"+em;
  return base;
}

async function ldAccount(baseKey,token,email,fb){
  var miss={};
  var scopedKey=accountCacheKey(baseKey,token,email);
  if(scopedKey&&scopedKey!==baseKey){
    var scoped=await ld(scopedKey,miss);
    if(scoped!==miss)return scoped;
  }
  return ld(baseKey,fb);
}

async function svAccount(baseKey,token,email,value){
  var scopedKey=accountCacheKey(baseKey,token,email);
  return sv(scopedKey||baseKey,value);
}

function mergeProfileIntoUser(baseUser,profile,emailHint,nameHint){
  var base=Object.assign(emptyUserState(),baseUser||{});
  var prof=(profile&&typeof profile==="object")?profile:{};
  var merged=Object.assign({},base,{
    name:prof.display_name||nameHint||base.name||"",
    email:String(emailHint||base.email||"").trim().toLowerCase(),
    styles:Array.isArray(prof.travel_styles)?prof.travel_styles:(base.styles||[]),
    interests:(prof.interests&&typeof prof.interests==="object")?prof.interests:(base.interests||{}),
    budget:prof.budget_tier||base.budget||"moderate",
    dietary:Array.isArray(prof.dietary)?prof.dietary:(base.dietary||[])
  });
  return merged;
}

function normalizePersonalBucketItems(items){
  return (Array.isArray(items)?items:[]).map(function(it){
    return Object.assign({id:it.id},it);
  });
}

function chooseBucketStringValue(primary,fallback){
  var p=String(primary||"").trim();
  if(p)return p;
  return String(fallback||"").trim();
}

function chooseBucketArrayValue(primary,fallback){
  var p=Array.isArray(primary)?primary.filter(Boolean):[];
  if(p.length>0)return p;
  return Array.isArray(fallback)?fallback.filter(Boolean):[];
}

function chooseBucketNumberValue(primary,fallback){
  var p=Number(primary||0)||0;
  if(p>0)return p;
  return Number(fallback||0)||0;
}

function mergeBucketItemDetails(primary,fallback){
  var basePrimary=(primary&&typeof primary==="object")?primary:{};
  var baseFallback=(fallback&&typeof fallback==="object")?fallback:{};
  return Object.assign({},baseFallback,basePrimary,{
    id:chooseBucketStringValue(basePrimary.id,baseFallback.id),
    name:chooseBucketStringValue(basePrimary.name,baseFallback.name),
    country:chooseBucketStringValue(basePrimary.country,baseFallback.country),
    bestMonths:chooseBucketArrayValue(basePrimary.bestMonths,baseFallback.bestMonths),
    costPerDay:chooseBucketNumberValue(basePrimary.costPerDay,baseFallback.costPerDay),
    tags:chooseBucketArrayValue(basePrimary.tags,baseFallback.tags),
    bestTimeDesc:chooseBucketStringValue(basePrimary.bestTimeDesc,baseFallback.bestTimeDesc),
    costNote:chooseBucketStringValue(basePrimary.costNote,baseFallback.costNote)
  });
}

function normalizeTripDestinationValue(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function addTripDestinationValue(values,value){
  var nextValue=normalizeTripDestinationValue(value);
  var out=Array.isArray(values)?values.slice():[];
  if(!nextValue)return out;
  var exists=out.some(function(entry){
    return normalizeTripDestinationValue(entry).toLowerCase()===nextValue.toLowerCase();
  });
  if(exists)return out;
  out.push(nextValue);
  return out;
}

function removeTripDestinationValue(values,value){
  var target=normalizeTripDestinationValue(value).toLowerCase();
  return (Array.isArray(values)?values:[]).filter(function(entry){
    return normalizeTripDestinationValue(entry).toLowerCase()!==target;
  });
}

function tripDestinationNamesFromValues(values,bucket){
  var seen={};
  return (Array.isArray(values)?values:[]).map(function(raw){
    var text=normalizeTripDestinationValue(raw);
    if(!text)return "";
    var byId=(Array.isArray(bucket)?bucket:[]).find(function(item){
      return String(item&&item.id||"").trim()===text;
    });
    var name=normalizeTripDestinationValue(byId&&byId.name?byId.name:text);
    var key=name.toLowerCase();
    if(!name||seen[key])return "";
    seen[key]=1;
    return name;
  }).filter(Boolean);
}

function canonicalTripDestinationName(value){
  return normalizeTripDestinationValue(value)
    .replace(/\s*\([^)]*\)\s*/g," ")
    .replace(/\s+/g," ")
    .trim()
    .toLowerCase();
}

function shouldTreatBucketItemsAsSameDestination(existing,incoming){
  var existingName=canonicalTripDestinationName(existing&&existing.name||"");
  var incomingName=canonicalTripDestinationName(incoming&&incoming.name||"");
  if(!existingName||!incomingName||existingName!==incomingName)return false;
  var existingCountry=canonicalTripDestinationName(existing&&existing.country||"");
  var incomingCountry=canonicalTripDestinationName(incoming&&incoming.country||"");
  if(!existingCountry||!incomingCountry)return true;
  return existingCountry===incomingCountry;
}

function activeTripTravelerCount(members,tripJoinedMap){
  var count=1;
  (Array.isArray(members)?members:[]).forEach(function(member){
    var st=mapTripMemberStatus(member&&(member.trip_status||member.status));
    var joined=!!(tripJoinedMap&&member&&tripJoinedMap[member.id]);
    if(st==="accepted"||joined)count++;
  });
  return count;
}

function normalizeApiBase(raw){
  var v=String(raw||"").trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))){
    v=v.substring(1,v.length-1).trim();
  }
  return v.replace(/\/+$/,"");
}

function coerceApiBaseHost(rawBase){
  var base=normalizeApiBase(rawBase);
  if(!base)return "";
  try{
    var u=new URL(base);
    var h=String(u.hostname||"").toLowerCase();
    if(h==="wanderplan-orchestrator.onrender.com"){
      u.hostname="wanderplan-ai.onrender.com";
      return normalizeApiBase(u.toString());
    }
  }catch(e){}
  return base;
}

function resolveApiBase(){
  // CRA/webpack inlines REACT_APP_* at build time.
  var envBase=coerceApiBaseHost((process.env.REACT_APP_API_BASE)||"");
  if(envBase)return envBase;
  if(typeof window!=="undefined"){
    try{
      var sp=new URLSearchParams(window.location.search||"");
      var q=coerceApiBaseHost(sp.get("api_base")||"");
      if(q)return q;
    }catch(e){}
    var host=String(window.location.hostname||"").toLowerCase();
    if(host==="localhost"||host==="127.0.0.1")return "http://localhost:8000";
    // Production safety: map known frontend host -> backend host.
    if(host==="wanderplan-orchestrator.onrender.com")return "https://wanderplan-ai.onrender.com";
    if(host==="wanderplan-ai.onrender.com")return "https://wanderplan-ai.onrender.com";
    return "https://wanderplan-ai.onrender.com";
  }
  return "http://localhost:8000";
}

function toApiUrl(path){
  var p=String(path||"");
  if(/^https?:\/\//i.test(p))return p;
  if(!p.startsWith("/"))p="/"+p;
  return API_BASE+p;
}

function apiFallbackUrlFor(url){
  try{
    var u=new URL(String(url||""));
    var host=String(u.hostname||"").toLowerCase();
    if(host==="wanderplan-ai.onrender.com"){
      u.hostname="wanderplan-orchestrator.onrender.com";
      return u.toString();
    }
    if(host==="wanderplan-orchestrator.onrender.com"){
      u.hostname="wanderplan-ai.onrender.com";
      return u.toString();
    }
  }catch(e){}
  return "";
}

var API_BASE=resolveApiBase();
var LLM_PROXY=normalizeApiBase((process.env.REACT_APP_LLM_PROXY)||"")||(""+API_BASE+"/llm/messages");
var CREW_COLORS=[C.sky,C.coral,C.grn,C.purp,C.tealL,C.gold];

function iniFromName(name){
  var parts=String(name||"").split(/[\s._-]+/).filter(Boolean);
  if(parts.length===0)return"?";
  if(parts.length===1)return parts[0].substring(0,2).toUpperCase();
  return (parts[0].charAt(0)+parts[1].charAt(0)).toUpperCase();
}

function normalizeCrewStatus(status){
  var st=String(status||"").trim().toLowerCase();
  if(st==="accepted"||st==="pending"||st==="invited"||st==="declined"||st==="link_only")return st;
  if(st==="joined"||st==="active")return "accepted";
  return "pending";
}

function normalizeCrewRelation(relation){
  var rel=String(relation||"").trim().toLowerCase();
  if(rel==="invitee"||rel==="inviter"||rel==="owner"||rel==="self"||rel==="crew")return rel;
  return "crew";
}

function crewStatusRank(status){
  var st=normalizeCrewStatus(status);
  if(st==="accepted")return 4;
  if(st==="pending"||st==="invited")return 3;
  if(st==="link_only")return 2;
  if(st==="declined")return 1;
  return 0;
}

function defaultCrewNameFromEmail(email){
  var local=String(email||"").trim().toLowerCase().split("@")[0]||"";
  if(!local)return "Member";
  return local
    .split(/[._\-]+/)
    .filter(Boolean)
    .map(function(token){return token.charAt(0).toUpperCase()+token.slice(1);})
    .join(" ");
}

function sanitizeCrewMembers(rows){
  var list=Array.isArray(rows)?rows:[];
  var out=[];
  var emailToIdx={};
  list.forEach(function(item){
    var src=(item&&typeof item==="object")?item:{};
    var profile=(src.profile&&typeof src.profile==="object")?src.profile:{};
    var email=String(src.email||src.invitee_email||profile.email||"").trim().toLowerCase();
    if(!email)return;
    var name=String(src.name||profile.display_name||"").trim()||defaultCrewNameFromEmail(email);
    var existingIdx=emailToIdx[email];
    var candidate={
      id:String(src.id||src.peer_user_id||("m-"+email)).trim()||("m-"+email),
      name:name,
      ini:String(src.ini||"").trim()||iniFromName(name),
      color:src.color||CREW_COLORS[(existingIdx!==undefined?existingIdx:out.length)%CREW_COLORS.length],
      status:normalizeCrewStatus(src.status||src.crew_status),
      email:email,
      profile:profile,
      relation:normalizeCrewRelation(src.relation)
    };
    if(existingIdx===undefined){
      emailToIdx[email]=out.length;
      out.push(candidate);
      return;
    }
    var current=out[existingIdx]||{};
    if(crewStatusRank(candidate.status)>crewStatusRank(current.status)){
      out[existingIdx]=Object.assign({},current,candidate,{color:current.color||candidate.color});
    }else{
      out[existingIdx]=Object.assign({},candidate,current);
    }
  });
  return out;
}

function readJoinTripIdFromUrl(){
  try{
    var sp=new URLSearchParams(window.location.search||"");
    var q=(sp.get("join_trip_id")||"").trim();
    if(q)return q;
    var h=String(window.location.hash||"");
    var idx=h.indexOf("?");
    if(idx>=0){
      var hsp=new URLSearchParams(h.substring(idx+1));
      var fromHash=(hsp.get("join_trip_id")||hsp.get("tripId")||"").trim();
      if(fromHash)return fromHash;
    }
  }catch(e){}
  return "";
}

function readTripInviteActionFromUrl(){
  try{
    var sp=new URLSearchParams(window.location.search||"");
    var a=(sp.get("trip_invite_action")||"").trim().toLowerCase();
    if(a==="accept"||a==="reject"||a==="decline")return a==="decline"?"reject":a;
  }catch(e){}
  return "";
}

function readInviteActionFromUrl(){
  try{
    var sp=new URLSearchParams(window.location.search||"");
    var a=(sp.get("invite_action")||"").trim().toLowerCase();
    if(a==="reject"||a==="decline")return "reject";
  }catch(e){}
  return "accept";
}

function readInviteTokenFromUrl(){
  try{
    var sp=new URLSearchParams(window.location.search||"");
    var tok=(sp.get("invite_token")||"").trim();
    if(tok)return tok;
  }catch(e){}
  return "";
}

function formatCompanionDate(raw){
  var text=String(raw||"").trim();
  if(!text)return "";
  try{
    return new Date(text+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});
  }catch(e){}
  return text;
}

function formatCompanionWindow(win){
  var start=formatCompanionDate(win&&win.start);
  var end=formatCompanionDate(win&&win.end);
  if(start&&end)return start+" - "+end;
  return start||end||"Dates TBD";
}

function normalizeCompanionCheckinStatus(raw){
  var v=String(raw||"").trim().toLowerCase();
  if(v==="done"||v==="skipped"||v==="in_progress")return v;
  return "pending";
}

function companionCheckinMeta(status){
  var v=normalizeCompanionCheckinStatus(status);
  if(v==="done")return {label:"Done",color:C.grn,bg:C.grnBg};
  if(v==="skipped")return {label:"Skipped",color:C.red,bg:C.redBg};
  if(v==="in_progress")return {label:"In Progress",color:C.goldT,bg:C.goldDim};
  return {label:"Pending",color:C.tx3,bg:C.bg};
}

function formatMoney(amount,currency){
  var value=Number(amount||0)||0;
  var code=String(currency||"USD").trim().toUpperCase()||"USD";
  try{
    return new Intl.NumberFormat(undefined,{style:"currency",currency:code,maximumFractionDigits:2}).format(value);
  }catch(e){}
  return "$"+value.toFixed(2);
}

function receiptItemsTotal(items){
  return (Array.isArray(items)?items:[]).reduce(function(sum,item){
    return sum+(Number(item&&item.amount||0)||0);
  },0);
}

function defaultExpenseSplitMemberIds(members,currentUserId){
  var out=[];
  (Array.isArray(members)?members:[]).forEach(function(member){
    var memberId=String(member&&member.user_id||member&&member.id||"").trim();
    if(memberId&&out.indexOf(memberId)<0)out.push(memberId);
  });
  var currentId=String(currentUserId||"").trim();
  if(currentId&&out.indexOf(currentId)<0)out.push(currentId);
  return out;
}

function readFileAsBase64(file){
  return new Promise(function(resolve,reject){
    if(!file)return resolve({name:"",mediaType:"",base64:""});
    try{
      var reader=new FileReader();
      reader.onload=function(){
        var raw=String(reader.result||"");
        var match=raw.match(/^data:([^;]+);base64,(.*)$/);
        if(match){
          resolve({name:String(file.name||""),mediaType:match[1],base64:match[2]});
          return;
        }
        resolve({name:String(file.name||""),mediaType:String(file.type||"image/jpeg"),base64:""});
      };
      reader.onerror=function(){
        reject(new Error("Could not read receipt image"));
      };
      reader.readAsDataURL(file);
    }catch(e){
      reject(e);
    }
  });
}

function appBaseUrl(){
  if(typeof window!=="undefined"&&window.location){
    return String(window.location.origin||"").trim()||"";
  }
  return "";
}

function buildTripShareLink(trip, action){
  var tripId=String(trip&&trip.id||"").trim();
  if(!tripId)return "";
  var base=appBaseUrl();
  if(!base)return "";
  var params=new URLSearchParams();
  params.set("join_trip_id",tripId);
  params.set("trip_invite_action",(String(action||"accept").trim().toLowerCase()==="reject")?"reject":"accept");
  return base+"/?"+params.toString();
}

function buildTripShareSummary(trip){
  var tr=(trip&&typeof trip==="object")?trip:{};
  var name=String(tr.name||"Trip").trim()||"Trip";
  var dests=Array.isArray(tr.dests)&&tr.dests.length?tr.dests.join(" + "):String(tr.destNames||"").trim();
  var dates=String(tr.dates||"").trim()||"Dates TBD";
  var duration=tr.days?(String(tr.days)+" days"):"Duration TBD";
  var travelers=String((Array.isArray(tr.members)?tr.members.length+1:1) || 1)+" travelers";
  var status=String(tr.status||"planning").trim()||"planning";
  return [
    "WanderPlan trip: "+name,
    dests?("Destinations: "+dests):"",
    "Dates: "+dates,
    "Duration: "+duration,
    "Travelers: "+travelers,
    "Status: "+status
  ].filter(Boolean).join("\n");
}

function buildTripWhatsAppText(trip){
  var summary=buildTripShareSummary(trip);
  var link=buildTripShareLink(trip,"accept");
  return summary+(link?("\n\nJoin trip: "+link):"");
}

function buildWhatsAppShareUrl(text){
  var msg=String(text||"").trim();
  if(!msg)return "";
  return "https://wa.me/?text="+encodeURIComponent(msg);
}

function companionReadinessCopy(reason){
  var key=String(reason||"").trim().toLowerCase();
  if(key==="locked_dates_and_itinerary_required"){
    return {
      title:"Live Companion isn't ready yet",
      body:"This trip needs locked travel dates and a saved itinerary before daily guidance and check-ins can go live."
    };
  }
  if(key==="locked_dates_required"){
    return {
      title:"Lock trip dates to activate Live Companion",
      body:"This trip is missing its final locked travel window, so today's live plan and check-ins are not available yet."
    };
  }
  if(key==="itinerary_required"){
    return {
      title:"Confirm the itinerary to activate Live Companion",
      body:"This trip does not have persisted itinerary days yet, so there is nothing to check in against."
    };
  }
  return {
    title:"Live Companion is still getting ready",
    body:"Trip context loaded, but today's live plan is not available yet. Open the itinerary to finish setup."
  };
}

async function apiJson(path, options, token){
  var opts=Object.assign({},options||{});
  var hdrs=Object.assign({},opts.headers||{});
  if(token)hdrs.Authorization="Bearer "+token;
  if(opts.body&&typeof opts.body==="object"){hdrs["Content-Type"]="application/json";opts.body=JSON.stringify(opts.body);}
  opts.headers=hdrs;
  var url=toApiUrl(path);
  var fallbackUrl=apiFallbackUrlFor(url);
  var r=null;
  try{
    r=await fetch(url,opts);
  }catch(e){
    if(fallbackUrl&&fallbackUrl!==url){
      try{
        r=await fetch(fallbackUrl,opts);
      }catch(e2){
        var netMsg2=String(e2&&e2.message||String(e&&e.message)||"Failed to fetch");
        throw new Error("Network error calling "+url+" (fallback "+fallbackUrl+" also failed). Check REACT_APP_API_BASE and backend CORS (FRONTEND_ORIGINS). "+netMsg2);
      }
    }else{
      var netMsg=String(e&&e.message||"Failed to fetch");
      throw new Error("Network error calling "+url+". Check REACT_APP_API_BASE and backend CORS (FRONTEND_ORIGINS). "+netMsg);
    }
  }
  var txt=await r.text();
  var data=null;
  try{data=txt?JSON.parse(txt):null;}catch(e){data=txt;}
  if(!r.ok){throw new Error((data&&data.detail)||(data&&data.message)||("HTTP "+r.status));}
  return data;
}

async function llmReq(payload){
  var opts={method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)};
  var r=null;
  var fallbackUrl=apiFallbackUrlFor(LLM_PROXY);
  try{
    r=await fetch(LLM_PROXY,opts);
  }catch(e){
    if(fallbackUrl&&fallbackUrl!==LLM_PROXY){
      try{
        r=await fetch(fallbackUrl,opts);
      }catch(e2){
        var netMsg2=String(e2&&e2.message||String(e&&e.message)||"Failed to fetch");
        throw new Error("Network error calling "+LLM_PROXY+" (fallback "+fallbackUrl+" also failed). Check REACT_APP_API_BASE / REACT_APP_LLM_PROXY and backend CORS (FRONTEND_ORIGINS). "+netMsg2);
      }
    }else{
      var netMsg=String(e&&e.message||"Failed to fetch");
      throw new Error("Network error calling "+LLM_PROXY+". Check REACT_APP_API_BASE / REACT_APP_LLM_PROXY and backend CORS (FRONTEND_ORIGINS). "+netMsg);
    }
  }
  var txt=await r.text();
  var data=null;
  try{data=txt?JSON.parse(txt):null;}catch(e){data=txt;}
  if(!r.ok){
    var detail=(data&&typeof data==="object"&&(data.detail||data.message))||(typeof data==="string"?data:"");
    throw new Error("LLM proxy HTTP "+r.status+(detail?": "+detail:""));
  }
  return data;
}

function mapTripMemberStatus(rawStatus){
  var st=String(rawStatus||"").trim().toLowerCase();
  if(st==="pending")return "invited";
  if(st==="accepted")return "accepted";
  if(st==="declined"||st==="rejected")return "declined";
  if(st==="owner")return "accepted";
  return st||"selected";
}

function isUuidLike(value){
  var v=String(value||"").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function userIdFromToken(token){
  var t=String(token||"").trim();
  if(t.indexOf("test-token:")===0){
    return t.substring("test-token:".length).trim();
  }
  var parts=t.split(".");
  if(parts.length===3){
    try{
      var payload=parts[1].replace(/-/g,"+").replace(/_/g,"/");
      while(payload.length%4!==0)payload+="=";
      var decoded="";
      if(typeof atob==="function"){
        decoded=atob(payload);
      }else if(typeof Buffer!=="undefined"){
        decoded=Buffer.from(payload,"base64").toString("utf8");
      }else{
        return "";
      }
      var obj=JSON.parse(decoded);
      return String(obj&&obj.sub||obj&&obj.user_id||obj&&obj.userId||obj&&obj.id||"").trim();
    }catch(e){}
  }
  return "";
}

function makeVoteUserId(userId,email,fallback){
  var uid=String(userId||"").trim();
  if(uid)return uid;
  var em=String(email||"").trim().toLowerCase();
  if(em)return "email:"+em;
  return String(fallback||"member");
}

function voteKeyAliasesFor(voter){
  var keys=[];
  function pushKey(k){
    var v=String(k||"").trim();
    if(!v)return;
    if(keys.indexOf(v)>=0)return;
    keys.push(v);
  }
  if(voter&&typeof voter==="object"){
    pushKey(voter.id);
    pushKey(voter.userId);
    var em=String(voter.email||"").trim().toLowerCase();
    if(em)pushKey("email:"+em);
    return keys;
  }
  pushKey(voter);
  return keys;
}

function readVoteForVoter(row,voter){
  var r=(row&&typeof row==="object")?row:{};
  var aliases=voteKeyAliasesFor(voter);
  for(var i=0;i<aliases.length;i++){
    var v=String(r[aliases[i]]||"").trim().toLowerCase();
    if(v==="up"||v==="down")return v;
    if(v==="yes")return "up";
    if(v==="no")return "down";
  }
  return "";
}

function isCurrentVoteVoter(voter,currentVoter){
  var voterAliases=voteKeyAliasesFor(voter);
  var currentAliases=voteKeyAliasesFor(currentVoter);
  for(var i=0;i<voterAliases.length;i++){
    if(currentAliases.indexOf(voterAliases[i])>=0)return true;
  }
  return false;
}

function canEditVoteForMember(voter,currentVoter,isOrganizer){
  if(isOrganizer)return true;
  return isCurrentVoteVoter(voter,currentVoter);
}

function dedupeVoteVoters(voters){
  var out=[];
  var aliasToIdx={};
  (Array.isArray(voters)?voters:[]).forEach(function(voter){
    var aliases=voteKeyAliasesFor(voter);
    var foundIdx=undefined;
    for(var i=0;i<aliases.length;i++){
      if(aliasToIdx[aliases[i]]!==undefined){
        foundIdx=aliasToIdx[aliases[i]];
        break;
      }
    }
    if(foundIdx===undefined){
      foundIdx=out.length;
      out.push(voter);
    }else{
      var existing=out[foundIdx]||{};
      out[foundIdx]=Object.assign({},voter,existing,{
        id:existing.id||voter.id||"",
        userId:existing.userId||voter.userId||"",
        email:existing.email||voter.email||"",
        name:existing.name||voter.name||"",
        ini:existing.ini||voter.ini||"",
        color:existing.color||voter.color||""
      });
    }
    aliases.forEach(function(alias){
      aliasToIdx[alias]=foundIdx;
    });
  });
  return out;
}

function canonicalDestinationVoteKey(name,fallback){
  var raw=String(name||"").trim().toLowerCase();
  var slug=raw.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  if(slug)return "dest:"+slug;
  var fb=String(fallback||"").trim();
  return fb||"dest:unknown";
}

function canonicalDestinationVoteKeyFromStoredKey(key){
  var raw=String(key||"").trim();
  if(!raw)return "";
  if(raw.indexOf("dest:")===0)return raw;
  var legacyMatch=raw.match(/^trip-dest-\d+-(.+)$/i);
  if(legacyMatch&&legacyMatch[1]){
    return canonicalDestinationVoteKey(legacyMatch[1],raw);
  }
  return raw;
}

function normalizeDestinationVoteState(votesMap){
  var map=(votesMap&&typeof votesMap==="object")?votesMap:{};
  var out={};
  Object.keys(map).sort(function(a,b){
    var aCanonical=String(a||"").trim().indexOf("dest:")===0?1:0;
    var bCanonical=String(b||"").trim().indexOf("dest:")===0?1:0;
    return aCanonical-bCanonical;
  }).forEach(function(key){
    var row=map[key];
    if(!(row&&typeof row==="object"))return;
    var canonicalKey=canonicalDestinationVoteKeyFromStoredKey(key);
    if(!canonicalKey)return;
    var prev=(out[canonicalKey]&&typeof out[canonicalKey]==="object")?out[canonicalKey]:{};
    out[canonicalKey]=Object.assign({},prev,row);
  });
  return out;
}

function mergeVoteRows(votesMap,keys){
  var map=(votesMap&&typeof votesMap==="object")?votesMap:{};
  var merged={};
  (Array.isArray(keys)?keys:[]).forEach(function(key){
    var k=String(key||"").trim();
    if(!k)return;
    var row=map[k];
    if(!(row&&typeof row==="object"))return;
    Object.keys(row).forEach(function(alias){
      merged[alias]=row[alias];
    });
  });
  return merged;
}

function readDestinationVoteRow(votesMap,dest){
  var aliases=[];
  function pushKey(key){
    var k=String(key||"").trim();
    if(!k)return;
    if(aliases.indexOf(k)>=0)return;
    aliases.push(k);
  }
  var voteKey=String(dest&&dest.vote_key||"").trim();
  var legacyKey=String(dest&&dest.id||"").trim();
  pushKey(legacyKey);
  pushKey(voteKey);
  pushKey(canonicalDestinationVoteKey(dest&&dest.name,legacyKey||voteKey));
  return mergeVoteRows(votesMap,aliases);
}

function summarizeDestinationVotes(votesMap,dest,voters,majorityNeeded){
  var row=readDestinationVoteRow(votesMap,dest);
  var normalizedVoters=dedupeVoteVoters(voters);
  var up=0;var down=0;var votedCount=0;
  normalizedVoters.forEach(function(voter){
    var val=readVoteForVoter(row,voter);
    if(val==="up"){up++;votedCount++;}
    else if(val==="down"){down++;votedCount++;}
  });
  var totalVoters=normalizedVoters.length;
  var needed=Math.max(1,Number(majorityNeeded)||0||1);
  var allVoted=votedCount===totalVoters&&totalVoters>0;
  var majorityWin=up>=needed&&up>down;
  return {row:row,up:up,down:down,votedCount:votedCount,allVoted:allVoted,majorityWin:majorityWin};
}

function buildCurrentVoteActor(token,userState,tripId){
  var uid=String(userIdFromToken(token)||"").trim();
  var email=String(userState&&userState.email||"").trim().toLowerCase();
  var tid=String(tripId||"").trim();
  var sharedTrip=!!(token&&tid&&isUuidLike(tid));
  return {
    id:sharedTrip?makeVoteUserId(uid,email,""):makeVoteUserId(uid,email,"me"),
    userId:uid,
    email:email
  };
}

function wizardSyncIntervalMs(stepNum){
  var step=Number(stepNum||0);
  if(step===1||step===2||step===3||step===5||step===6||step===7||step===10||step===11||step===12||step===13||step===14)return 1200;
  return 3000;
}

function normalizeWizardStepIndex(stepNum, orderVersion){
  var step=Math.min(Math.max(0,Number(stepNum)||0),Math.max(WIZ.length-1,0));
  var version=Math.max(0,Number(orderVersion)||0);
  if(version<2){
    if(step===9)step=12;
    else if(step===10)step=13;
    else if(step===11)step=9;
    else if(step===12)step=10;
    else if(step===13)step=11;
  }
  if(version<3&&step>=5)step+=1;
  return step;
}

function inclusiveIsoDays(startIso, endIso){
  var start=String(startIso||"").slice(0,10);
  var end=String(endIso||"").slice(0,10);
  if(!start||!end)return 0;
  var startMs=Date.parse(start+"T00:00:00Z");
  var endMs=Date.parse(end+"T00:00:00Z");
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<startMs)return 0;
  return Math.floor((endMs-startMs)/86400000)+1;
}

function availabilityWindowMatchesTripDays(window, tripDays){
  var required=Math.max(1,Number(tripDays)||1);
  if(!window||typeof window!=="object")return false;
  return inclusiveIsoDays(window.start,window.end)===required;
}

function sanitizeAvailabilityWindow(window, tripDays){
  if(!availabilityWindowMatchesTripDays(window,tripDays))return null;
  return {
    start:String(window.start||"").slice(0,10),
    end:String(window.end||"").slice(0,10)
  };
}

function exactAvailabilityWindows(windows, tripDays){
  return (Array.isArray(windows)?windows:[]).filter(function(win){
    return availabilityWindowMatchesTripDays(win,tripDays);
  }).map(function(win){
    return {
      start:String(win.start||"").slice(0,10),
      end:String(win.end||"").slice(0,10)
    };
  });
}

function sanitizeFlightDatesForTrip(flightDatesValue, tripDays){
  var next=(flightDatesValue&&typeof flightDatesValue==="object")?Object.assign({},flightDatesValue):{};
  if(next.depart||next.ret){
    if(!availabilityWindowMatchesTripDays({start:next.depart,end:next.ret},tripDays)){
      next.depart="";
      next.ret="";
    }else{
      next.depart=String(next.depart||"").slice(0,10);
      next.ret=String(next.ret||"").slice(0,10);
    }
  }
  return next;
}

function sanitizeAvailabilityOverlapData(data, tripDays){
  var next=(data&&typeof data==="object")?Object.assign({},data):{};
  next.locked_window=sanitizeAvailabilityWindow(next.locked_window,tripDays);
  next.is_locked=!!next.locked_window;
  return next;
}

function resolveAvailabilityDraftWindow(overlapData, currentUserId, flightDatesValue, tripDays){
  var data=sanitizeAvailabilityOverlapData(overlapData,tripDays);
  if(data.locked_window)return data.locked_window;
  var mine=((Array.isArray(data.member_windows)?data.member_windows:[]).find(function(member){
    return String(member&&member.user_id||"").trim()===String(currentUserId||"").trim();
  })||{}).windows;
  var exactMine=exactAvailabilityWindows(mine,tripDays);
  if(exactMine[0])return exactMine[0];
  var validFlightDates=sanitizeFlightDatesForTrip(flightDatesValue,tripDays);
  if(validFlightDates.depart&&validFlightDates.ret){
    return {
      start:String(validFlightDates.depart||"").slice(0,10),
      end:String(validFlightDates.ret||"").slice(0,10)
    };
  }
  return {start:"",end:""};
}

function mergeAvailabilityDraft(prevDraft, resolvedDraft, tripDays, hasLockedWindow){
  var prev=(prevDraft&&typeof prevDraft==="object")?prevDraft:{start:"",end:""};
  var next=(resolvedDraft&&typeof resolvedDraft==="object")?resolvedDraft:{start:"",end:""};
  if(hasLockedWindow&&availabilityWindowMatchesTripDays(next,tripDays))return next;
  if(String(prev.start||"").trim()||String(prev.end||"").trim())return prev;
  return next;
}

function tryShowDatePicker(event){
  try{
    if(event&&event.currentTarget&&typeof event.currentTarget.showPicker==="function"){
      event.currentTarget.showPicker();
    }
  }catch(e){}
}

function mergeSharedFlightDates(prevValue, nextValue, preserveLocationText){
  var prev=(prevValue&&typeof prevValue==="object")?prevValue:{};
  var next=(nextValue&&typeof nextValue==="object")?nextValue:{};
  var merged=Object.assign({},prev,next);
  if(preserveLocationText){
    merged.origin=prev.origin!==undefined?prev.origin:merged.origin;
    merged.arrive=prev.arrive!==undefined?prev.arrive:merged.arrive;
    merged.final_airport=prev.final_airport!==undefined?prev.final_airport:merged.final_airport;
  }
  return merged;
}

function addIsoDays(startIso, dayCount){
  var start=String(startIso||"").slice(0,10);
  var startMs=Date.parse(start+"T00:00:00Z");
  if(!start||!Number.isFinite(startMs))return "";
  var offset=Math.max(0,Number(dayCount)||0);
  return new Date(startMs+(offset*86400000)).toISOString().slice(0,10);
}

function flightRoutePlanSignature(plan){
  return JSON.stringify((Array.isArray(plan)?plan:[]).map(function(stop){
    return {
      destination:String(stop&&stop.destination||"").trim(),
      airport:String(stop&&stop.airport||"").trim(),
      travel_date:String(stop&&stop.travel_date||"").slice(0,10),
      manual_date:!!(stop&&stop.manual_date)
    };
  }));
}

var DEST_AIRPORT_ALIAS_ROWS=[
  {keys:["grishneshwar","aurangabad"],code:"BOM"},
  {keys:["kedarnath","guptkashi","haridwar","rishikesh"],code:"DED"},
  {keys:["mahakaleshwar","ujjain"],code:"IDR"},
  {keys:["mallikarjuna","srisailam"],code:"HYD"},
  {keys:["nageshwar","dwarka"],code:"JGA"},
  {keys:["omkareshwar"],code:"IDR"},
  {keys:["rameswaram"],code:"IXM"},
  {keys:["shrikhand kailash","shrikhand"],code:"IXC"},
  {keys:["somnath","veraval"],code:"DIU"},
  {keys:["trimbakeshwar","nashik"],code:"ISK"},
  {keys:["vaidyanath","deoghar"],code:"DGH"}
];

function normAirportCode(value){
  return String(value||"").replace(/[^A-Za-z]/g,"").toUpperCase().slice(0,3);
}

function airportAliasFallbackCode(value){
  var raw=String(value||"").trim().toLowerCase();
  if(!raw)return "";
  for(var i=0;i<DEST_AIRPORT_ALIAS_ROWS.length;i++){
    var row=DEST_AIRPORT_ALIAS_ROWS[i]||{};
    var keys=Array.isArray(row.keys)?row.keys:[];
    var hit=keys.some(function(k){return raw.indexOf(String(k||"").toLowerCase())>=0;});
    if(hit){
      var code=normAirportCode(row.code||"");
      if(code.length===3)return code;
    }
  }
  return "";
}

function routePlanDestinationOrder(destinations, savedPlan){
  var base=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    return typeof dest==="string"?String(dest||"").trim():String(dest&&dest.name||dest&&dest.destination||"").trim();
  }).filter(Boolean);
  var canonical=[];
  var seenBase={};
  base.forEach(function(name){
    var key=String(name||"").trim().toLowerCase();
    if(!key||seenBase[key])return;
    seenBase[key]=name;
    canonical.push(name);
  });
  if(canonical.length===0)return canonical;
  var byLower={};
  canonical.forEach(function(name){
    byLower[String(name||"").trim().toLowerCase()]=name;
  });
  var ordered=[];
  var seen={};
  (Array.isArray(savedPlan)?savedPlan:[]).forEach(function(stop){
    var raw=String(stop&&stop.destination||"").trim();
    var mapped=byLower[String(raw||"").toLowerCase()];
    if(!mapped)return;
    if(seen[mapped])return;
    seen[mapped]=1;
    ordered.push(mapped);
  });
  canonical.forEach(function(name){
    if(seen[name])return;
    seen[name]=1;
    ordered.push(name);
  });
  return ordered;
}

function buildFlightRoutePlan(destinations, durationPerDestination, lockedWindow, savedPlan){
  var list=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    return typeof dest==="string"?String(dest||"").trim():String(dest&&dest.name||dest&&dest.destination||"").trim();
  }).filter(Boolean);
  var existing={};
  (Array.isArray(savedPlan)?savedPlan:[]).forEach(function(stop,idx){
    var key=String(stop&&stop.destination||"").trim().toLowerCase()||("idx:"+idx);
    existing[key]={
      destination:String(stop&&stop.destination||"").trim(),
      airport:String(stop&&stop.airport||stop&&stop.to_airport||"").trim(),
      travel_date:String(stop&&stop.travel_date||stop&&stop.depart_date||"").slice(0,10),
      manual_date:!!(stop&&stop.manual_date)
    };
  });
  var cursor=(lockedWindow&&typeof lockedWindow==="object")?String(lockedWindow.start||"").slice(0,10):"";
  if(!cursor){
    var firstSaved=(Array.isArray(savedPlan)?savedPlan:[])[0]||{};
    cursor=String(firstSaved.travel_date||firstSaved.depart_date||"").slice(0,10);
  }
  return list.map(function(name){
    var saved=existing[String(name||"").trim().toLowerCase()]||{};
    var days=Math.max(1,Number((durationPerDestination&&durationPerDestination[name])||0)||1);
    var autoDate=String(cursor||"").slice(0,10);
    var savedDate=String(saved.travel_date||"").slice(0,10);
    var finalDate=String((saved.manual_date&&savedDate)?savedDate:(autoDate||savedDate||"")).slice(0,10);
    var savedAirport=String(saved.airport||"").trim();
    var airportLabel=savedAirport||name;
    if(!savedAirport||savedAirport.toLowerCase()===String(name||"").trim().toLowerCase()){
      var aliasCode=airportAliasFallbackCode(name);
      if(aliasCode)airportLabel=name+" ("+aliasCode+")";
    }
    var stop={
      destination:name,
      airport:String(airportLabel||name).trim()||name,
      travel_date:finalDate
    };
    if(saved.manual_date&&savedDate)stop.manual_date=true;
    if(finalDate)cursor=addIsoDays(finalDate,days);
    return stop;
  });
}

function moveFlightRouteStop(plan, index, direction, durationPerDestination, lockedWindow){
  var list=(Array.isArray(plan)?plan:[]).slice(0);
  var from=Math.max(0,Math.min(list.length-1,Number(index)||0));
  var to=from+(direction<0?-1:1);
  if(from<0||from>=list.length||to<0||to>=list.length)return list;
  var item=list.splice(from,1)[0];
  list.splice(to,0,item);
  return buildFlightRoutePlan(list.map(function(stop){return stop.destination;}),durationPerDestination,lockedWindow,list);
}

function roundTripFlightRoutePlan(plan, finalDateIso){
  var base=(Array.isArray(plan)?plan:[]).map(function(stop){
    return Object.assign({},stop||{});
  });
  if(base.length<=1)return base;
  var first=base[0]||{};
  base.push({
    destination:String(first.destination||"").trim(),
    airport:String(first.airport||first.destination||"").trim(),
    travel_date:String(finalDateIso||"").slice(0,10),
    is_return_stop:true
  });
  return base;
}

function fillMissingDurationPerDestination(destinations, durationPerDestination, totalTripDays){
  var list=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    return typeof dest==="string"?String(dest||"").trim():String(dest&&dest.name||dest&&dest.destination||"").trim();
  }).filter(Boolean);
  var existing=(durationPerDestination&&typeof durationPerDestination==="object")?durationPerDestination:{};
  var next={};
  var seen={};
  list.forEach(function(name){
    var key=String(name||"").trim();
    if(!key||seen[key])return;
    seen[key]=1;
    var raw=Number(existing[key]);
    if(Number.isFinite(raw)&&raw>0)next[key]=Math.max(1,Math.round(raw));
  });
  if(list.length===0)return next;
  var missing=list.filter(function(name){return next[name]===undefined;});
  if(missing.length===0)return next;
  var totalDays=Math.max(0,Number(totalTripDays)||0);
  var targetStayDays=Math.max(list.length,totalDays>0?(totalDays-Math.max(0,list.length-1)-1):list.length);
  var assigned=list.reduce(function(sum,name){
    return sum+(next[name]!==undefined?Math.max(1,Number(next[name])||1):0);
  },0);
  missing.forEach(function(name){
    next[name]=1;
  });
  assigned=list.reduce(function(sum,name){
    return sum+Math.max(1,Number(next[name])||1);
  },0);
  var delta=targetStayDays-assigned;
  var cursor=0;
  while(delta>0&&list.length>0){
    var name=list[cursor%list.length];
    next[name]=Math.max(1,Number(next[name])||1)+1;
    delta-=1;
    cursor+=1;
  }
  return next;
}

function resolveBudgetTier(profileOrMember, fallbackTier){
  var src=(profileOrMember&&typeof profileOrMember==="object")?profileOrMember:{};
  var profile=(src.profile&&typeof src.profile==="object")?src.profile:src;
  var tier=String(profile.budget_tier||src.budget||fallbackTier||"moderate").trim().toLowerCase();
  return tier||"moderate";
}

function resolveTripBudgetTier(sharedTier, userTier){
  return String(sharedTier||userTier||"moderate").trim().toLowerCase()||"moderate";
}

function buildDurationPlanSignature(destNames,totalDays){
  var names=(Array.isArray(destNames)?destNames:[]).map(function(name){return String(name||"").trim().toLowerCase();}).filter(Boolean);
  return names.join("|")+"::"+String(Math.max(0,Number(totalDays)||0));
}

function shouldResetTravelPlanForDurationChange(prevSignature,nextSignature,prevDays,nextDays){
  var prevSig=String(prevSignature||"").trim();
  var nextSig=String(nextSignature||"").trim();
  if(prevSig&&nextSig&&prevSig!==nextSig)return true;
  var prevNum=Math.max(0,Number(prevDays)||0);
  var nextNum=Math.max(0,Number(nextDays)||0);
  return prevNum>0&&nextNum>0&&prevNum!==nextNum;
}

function resolveWizardTripId(currentTripIdValue,newTripValue,tripValue){
  var preferred=String(currentTripIdValue||"").trim();
  if(preferred)return preferred;
  var tripCtx=(tripValue&&typeof tripValue==="object")?tripValue:{};
  var tripId=String(tripCtx.id||"").trim();
  if(tripId)return tripId;
  var nextTrip=(newTripValue&&typeof newTripValue==="object")?newTripValue:{};
  return String(nextTrip.id||"").trim();
}

function readVoteDebugFlagFromUrl(){
  if(typeof window==="undefined")return false;
  try{
    var sp=new URLSearchParams(window.location.search||"");
    var raw=String(sp.get("debug_votes")||sp.get("debugVotes")||"").trim().toLowerCase();
    return raw==="1"||raw==="true"||raw==="yes";
  }catch(e){}
  return false;
}

function canonicalPoiVoteKey(poi,idx){
  var raw=(String(poi&&poi.name||"")+" "+String(poi&&poi.destination||"")+" "+String(poi&&poi.category||"")).trim().toLowerCase();
  var slug=raw.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  if(slug)return "poi:"+slug;
  var pid=String(poi&&poi.poi_id||"").trim();
  if(pid)return "poi:"+pid;
  return "poi:index-"+String(idx);
}

function readPoiVoteRow(votesMap,poi,idx){
  var map=(votesMap&&typeof votesMap==="object")?votesMap:{};
  var key=canonicalPoiVoteKey(poi,idx);
  var row=map[key];
  if(!(row&&typeof row==="object")){
    row=map[idx];
    if(!(row&&typeof row==="object")){
      row=map[String(idx)];
    }
  }
  if(!(row&&typeof row==="object"))row={};
  return {key:key,row:row};
}

function canonicalPoiVoteKeyFromStoredKey(key, map){
  var raw=String(key||"").trim();
  if(!raw)return "";
  var lookup=(map&&typeof map==="object")?map:{};
  var direct=lookup[raw];
  if(direct&&typeof direct==="object"){
    return canonicalPoiVoteKey(direct,raw);
  }
  if(raw.indexOf("poi:")===0)return raw;
  var viaMap=lookup[raw];
  if(viaMap&&typeof viaMap==="object"){
    return canonicalPoiVoteKey(viaMap,raw);
  }
  return "";
}

function normalizePoiStateMap(rowsMap, poiList, sharedPool){
  var map=(rowsMap&&typeof rowsMap==="object")?rowsMap:{};
  var lookup={};
  (Array.isArray(poiList)?poiList:[]).forEach(function(poi,idx){
    lookup[String(idx)]=poi;
    lookup[canonicalPoiVoteKey(poi,idx)]=poi;
    var legacyIdKey=String(poi&&poi.poi_id||"").trim();
    if(legacyIdKey)lookup["poi:"+legacyIdKey]=poi;
  });
  var pool=(sharedPool&&typeof sharedPool==="object")?sharedPool:{};
  Object.keys(pool).forEach(function(key){
    lookup[key]=pool[key];
  });
  var out={};
  Object.keys(map).sort(function(a,b){
    var aCanonical=String(a||"").trim().indexOf("poi:")===0?1:0;
    var bCanonical=String(b||"").trim().indexOf("poi:")===0?1:0;
    return aCanonical-bCanonical;
  }).forEach(function(key){
    var row=map[key];
    if(!(row&&typeof row==="object"))return;
    var canonicalKey=canonicalPoiVoteKeyFromStoredKey(key,lookup);
    if(!canonicalKey)return;
    var prev=(out[canonicalKey]&&typeof out[canonicalKey]==="object")?out[canonicalKey]:{};
    out[canonicalKey]=Object.assign({},prev,row);
  });
  return out;
}

function normalizePoiDecisionStateMap(statusMap, poiList, sharedPool){
  var rows=mergePoiListsByCanonical(
    Array.isArray(poiList)?poiList:[],
    (sharedPool&&typeof sharedPool==="object")?sharedPool:{}
  );
  var src=(statusMap&&typeof statusMap==="object")?statusMap:{};
  var out={};
  rows.forEach(function(poi,idx){
    var rowMeta=readPoiVoteRow(src,poi,idx);
    var raw=src[rowMeta.key];
    if(raw===undefined)raw=src[idx];
    if(raw===undefined)raw=src[String(idx)];
    var v=String(raw||"").trim().toLowerCase();
    if(v==="yes"||v==="no")out[rowMeta.key]=v;
  });
  return out;
}

function readPoiSelectionRow(selectionMap,poi,idx){
  var map=(selectionMap&&typeof selectionMap==="object")?selectionMap:{};
  var key=canonicalPoiVoteKey(poi,idx);
  var row=map[key];
  if(!(row&&typeof row==="object")){
    row=map[idx];
    if(!(row&&typeof row==="object")){
      row=map[String(idx)];
    }
  }
  if(!(row&&typeof row==="object"))row={};
  return {key:key,row:row};
}

function summarizePoiVotes(votesMap,poi,idx,voters){
  var rowMeta=readPoiVoteRow(votesMap,poi,idx);
  var row=rowMeta.row;
  var normalizedVoters=dedupeVoteVoters(voters);
  var up=0;var down=0;var votedCount=0;
  normalizedVoters.forEach(function(voter){
    var v=readVoteForVoter(row,voter);
    if(v==="up"){up++;votedCount++;}
    else if(v==="down"){down++;votedCount++;}
  });
  return {key:rowMeta.key,row:row,up:up,down:down,votedCount:votedCount,totalVoters:normalizedVoters.length};
}

function findDuplicatePoiKeys(rows){
  var seen={};
  var duplicates=[];
  (Array.isArray(rows)?rows:[]).forEach(function(poi,idx){
    var key=canonicalPoiVoteKey(poi,idx);
    if(!seen[key]){
      seen[key]={key:key,indexes:[idx],names:[String(poi&&poi.name||"").trim()]};
      return;
    }
    seen[key].indexes.push(idx);
    seen[key].names.push(String(poi&&poi.name||"").trim());
  });
  Object.keys(seen).forEach(function(key){
    if(seen[key].indexes.length>1)duplicates.push(seen[key]);
  });
  return duplicates;
}

function hasAnyYesInPoiSelectionRow(row){
  var src=(row&&typeof row==="object")?row:{};
  var yes=false;
  Object.keys(src).forEach(function(k){
    if(yes)return;
    var v=String(src[k]||"").trim().toLowerCase();
    if(v==="yes")yes=true;
  });
  return yes;
}

function hasAnyNoInPoiSelectionRow(row){
  var src=(row&&typeof row==="object")?row:{};
  var no=false;
  Object.keys(src).forEach(function(k){
    if(no)return;
    var v=String(src[k]||"").trim().toLowerCase();
    if(v==="no")no=true;
  });
  return no;
}

function resolvePoiVotingDecision(currentStatus, voteSummary, selectionRow){
  var summary=(voteSummary&&typeof voteSummary==="object")?voteSummary:{};
  var up=Number(summary.up||0)||0;
  var down=Number(summary.down||0)||0;
  if(up>down)return "yes";
  if(down>up)return "no";
  var status=String(currentStatus||"").trim().toLowerCase();
  if(status==="yes"||status==="no")return status;
  if(hasAnyYesInPoiSelectionRow(selectionRow))return "yes";
  if(hasAnyNoInPoiSelectionRow(selectionRow))return "no";
  return "yes";
}

function normalizePoiForSharedPool(poi){
  var src=(poi&&typeof poi==="object")?poi:{};
  var name=String(src.name||"").trim();
  if(!name)return null;
  var rawCat=String(src.category||"Culture").trim();
  var category=rawCat?rawCat.charAt(0).toUpperCase()+rawCat.slice(1).toLowerCase():"Culture";
  return {
    poi_id:String(src.poi_id||src.id||"").trim(),
    name:name,
    destination:String(src.destination||src.city||src.country||"").trim(),
    country:String(src.country||"").trim(),
    category:category,
    duration:String(src.duration||"2-3h"),
    cost:Number((src.cost!==undefined)?src.cost:((src.cost_estimate_usd!==undefined)?src.cost_estimate_usd:0))||0,
    rating:Number((src.rating!==undefined)?src.rating:4.5)||4.5,
    matchReason:String(src.matchReason||""),
      locationHint:String(src.locationHint||src.location_hint||src.near_poi||src.neighborhood||src.location_name||"").trim(),
      bestTime:String(src.bestTime||src.best_time||"").trim().toLowerCase(),
      openingWindow:String(src.openingWindow||src.opening_window||src.open_hours||src.hours||"").trim(),
      lat:(src.lat!==undefined&&src.lat!==null)?Number(src.lat)||0:0,
      lng:(src.lng!==undefined&&src.lng!==null)?Number(src.lng)||0:0,
    source:String(src.source||"").trim().toLowerCase()||"unknown",
    failureReason:String(src.failureReason||src.failure_reason||"").trim().toLowerCase(),
    tags:Array.isArray(src.tags)?src.tags:[],
    approved:typeof src.approved==="boolean"?src.approved:null
  };
}

function routeStopForDestination(routePlan, destination){
  var destKey=canonicalTripDestinationName(destination&&destination.name||destination||"");
  if(!destKey)return null;
  var stops=Array.isArray(routePlan&&routePlan.destinations)?routePlan.destinations:[];
  for(var i=0;i<stops.length;i++){
    var stop=stops[i]||{};
    if(canonicalTripDestinationName(stop.destination||stop.name||"")===destKey)return stop;
  }
  return null;
}

function isManufacturedPoiName(name, destination){
  var rawName=String(name||"").trim();
  var rawDest=String(destination&&destination.name||destination||"").trim();
  if(!rawName)return true;
  var normalized=rawName.toLowerCase();
  var normalizedDest=rawDest.toLowerCase();
  var genericSuffixes=[
    "heritage walk",
    "orientation walk",
    "sacred heritage circuit",
    "mythology and ritual interpretation session",
    "evening aarti viewing",
    "landmark orientation walk",
    "signature local experience",
    "market and neighborhood walk",
    "sunset or evening highlight",
    "temple darshan and orientation walk"
  ];
  if(normalizedDest){
    for(var i=0;i<genericSuffixes.length;i++){
      if(normalized===normalizedDest+" "+genericSuffixes[i])return true;
    }
  }
  return genericSuffixes.some(function(suffix){
    return normalized===suffix;
  });
}

function shouldReplaceWithGroundedNearbyPois(rows, destination, routePlan){
  var routeStop=routeStopForDestination(routePlan,destination);
  var nearbySites=Array.isArray(routeStop&&routeStop.nearbySites)?routeStop.nearbySites.filter(Boolean):[];
  if(nearbySites.length===0)return false;
  var list=(Array.isArray(rows)?rows:[]).filter(Boolean);
  if(list.length===0)return true;
  return list.every(function(row){
    return isManufacturedPoiName(row&&row.name,destination);
  });
}

function mergePoiListsByCanonical(localRows, sharedPool){
  var out=[];
  var seen={};
  function addPoi(raw,fallback){
    var normalized=normalizePoiForSharedPool(raw);
    if(!normalized)return;
    var key=canonicalPoiVoteKey(normalized,fallback);
    if(seen[key])return;
    seen[key]=1;
    out.push(normalized);
  }
  (Array.isArray(localRows)?localRows:[]).forEach(function(p,idx){addPoi(p,idx);});
  var pool=(sharedPool&&typeof sharedPool==="object")?sharedPool:{};
  Object.keys(pool).forEach(function(k){addPoi(pool[k],k);});
  return out;
}

function poiKeySignature(rows){
  var src=Array.isArray(rows)?rows:[];
  return src.map(function(p,idx){return canonicalPoiVoteKey(p,idx);}).join("|");
}

function buildPoiOptionPoolPatch(rows, existingPool){
  var patch={};
  var pool=(existingPool&&typeof existingPool==="object")?existingPool:{};
  (Array.isArray(rows)?rows:[]).forEach(function(raw,idx){
    var normalized=normalizePoiForSharedPool(raw);
    if(!normalized)return;
    var key=canonicalPoiVoteKey(normalized,idx);
    if(pool[key]&&typeof pool[key]==="object")return;
    patch[key]=normalized;
  });
  return patch;
}

function summarizeInterestConsensus(catId,myInterests,members,tripJoinedMap){
  var yesCount=0;
  var totalCount=0;
  var my=(myInterests&&typeof myInterests==="object")?myInterests[catId]:undefined;
  if(typeof my==="boolean"){
    totalCount++;
    if(my)yesCount++;
  }
  (Array.isArray(members)?members:[]).forEach(function(m){
    var st=mapTripMemberStatus(m&&(m.trip_status||m.status));
    var joined=!!(tripJoinedMap&&m&&tripJoinedMap[m.id]);
    if(st!=="accepted"&&!joined)return;
    var prof=(m&&m.profile&&typeof m.profile==="object")?m.profile:null;
    var ints=(prof&&prof.interests&&typeof prof.interests==="object")?prof.interests:{};
    var v=ints[catId];
    if(typeof v==="boolean"){
      totalCount++;
      if(v)yesCount++;
    }
  });
  var pct=totalCount>0?Math.round((yesCount/totalCount)*100):0;
  return {yesCount:yesCount,totalCount:totalCount,pct:pct,myValue:my};
}

function updateUserInterestSelection(userState, catId, selected){
  var base=Object.assign(emptyUserState(),userState||{});
  var nextInterests=(base.interests&&typeof base.interests==="object")
    ? Object.assign({},base.interests)
    : {};
  nextInterests[String(catId||"")]=!!selected;
  return Object.assign({},base,{interests:nextInterests});
}

function isCurrentMemberRow(member, token, myEmail){
  var mid=String(member&&member.user_id||member&&member.id||"").trim();
  var tokUid=userIdFromToken(token||"");
  if(tokUid&&mid&&tokUid===mid)return true;
  var em=String(member&&member.email||"").trim().toLowerCase();
  var me=String(myEmail||"").trim().toLowerCase();
  return !!(me&&em&&me===em);
}

function crewStatusLabel(rawStatus){
  var st=String(rawStatus||"").trim().toLowerCase();
  if(st==="accepted")return "joined";
  if(st==="pending"||st==="invited")return "invite pending";
  if(st==="declined")return "declined";
  if(st==="link_only")return "link only";
  return st||"unknown";
}

function crewRelationLabel(rawRelation){
  var rel=String(rawRelation||"").trim().toLowerCase();
  if(rel==="invitee")return "invitee";
  if(rel==="inviter")return "inviter";
  if(rel==="owner"||rel==="self")return "account holder";
  return "crew member";
}

function toTripMember(member, tripStatus){
  var src=member||{};
  var email=String(src.email||"").trim().toLowerCase();
  var name=String(src.name||email.split("@")[0]||"Member").trim()||"Member";
  var nextTripStatus=mapTripMemberStatus(tripStatus||src.trip_status||"selected");
  var nextCrewStatus=String(src.crew_status||src.status||"").trim().toLowerCase()||"unknown";
  return Object.assign({},src,{
    name:name,
    email:email,
    ini:src.ini||iniFromName(name),
    color:src.color||C.purp,
    crew_status:nextCrewStatus,
    trip_status:nextTripStatus,
    status:nextTripStatus
  });
}

function isTripInvitePending(member){
  var st=mapTripMemberStatus(member&&(member.trip_status||member.status));
  return st!=="accepted"&&st!=="invited"&&st!=="declined"&&st!=="link_only";
}

function parseJsonLoose(txt){
  var raw=String(txt||"").replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(e){}
  var arr=raw.match(/\[[\s\S]*\]/);
  if(arr){try{return JSON.parse(arr[0]);}catch(e){}}
  var obj=raw.match(/\{[\s\S]*\}/);
  if(obj){try{return JSON.parse(obj[0]);}catch(e){}}
  return null;
}

async function callLLM(sysPrompt, userMsg, maxTok) {
  try {
    var data = await llmReq({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTok || 1000,
      messages: [{role: "user", content: sysPrompt + "\n\n---\n\n" + userMsg}]
    });
    var txt = "";
    if (data.content) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") txt += data.content[i].text;
      }
    }
    return parseJsonLoose(txt);
  } catch (e) {
    return null;
  }
}

var ROUTE_LLM_TIMEOUT_MS = 70000;

function buildRoutePlanSignature(destinations, interests, budgetTier, dietary, styles, groupPrefs){
  var rows=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    return {
      name:canonicalTripDestinationName(dest&&dest.name||dest||""),
      country:canonicalTripDestinationName(dest&&dest.country||"")
    };
  }).filter(function(row){return row.name;});
  var yes=[],no=[];
  var src=(interests&&typeof interests==="object")?interests:{};
  Object.keys(src).sort().forEach(function(key){
    if(src[key]===true)yes.push(key);
    else if(src[key]===false)no.push(key);
  });
  return JSON.stringify({
    destinations:rows,
    yes:yes,
    no:no,
    budget:String(budgetTier||"moderate").trim().toLowerCase(),
    dietary:(Array.isArray(dietary)?dietary:[]).map(function(item){return String(item||"").trim().toLowerCase();}).filter(Boolean).sort(),
    styles:(Array.isArray(styles)?styles:[]).map(function(item){return String(item||"").trim().toLowerCase();}).filter(Boolean).sort(),
    crew:Array.isArray(groupPrefs&&groupPrefs.memberSummaries)?groupPrefs.memberSummaries.slice().sort():[]
  });
}

function normalizeRoutePlan(parsed, destinations){
  if(!parsed||typeof parsed!=="object")return null;
  var requested=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    return {
      name:String(dest&&dest.name||dest||"").trim(),
      country:String(dest&&dest.country||"").trim()
    };
  }).filter(function(dest){return dest.name;});
  if(requested.length===0)return null;
  var requestedByKey={};
  requested.forEach(function(dest){
    requestedByKey[canonicalTripDestinationName(dest.name)]=dest;
  });
  function normalizeStops(items){
    return (Array.isArray(items)?items:[]).map(function(item){
      if(!item||typeof item!=="object")return null;
      var rawName=String(item.destination||item.name||item.stop||"").trim();
      var key=canonicalTripDestinationName(rawName);
      var requestedMatch=key&&requestedByKey[key]?requestedByKey[key]:null;
      var name=requestedMatch?requestedMatch.name:rawName;
      if(!name)return null;
      var nearbyRaw=item.nearbySites||item.nearby_sites||item.nearbyTemples||item.nearby_temples||item.nearby||item.related_sites||[];
      return {
        destination:name,
        country:requestedMatch&&requestedMatch.country||String(item.country||"").trim(),
        days:Math.max(1,Number(item.days||item.nights||item.duration_days||1)||1),
        nearbySites:(Array.isArray(nearbyRaw)?nearbyRaw:[]).map(function(site){return String(site||"").trim();}).filter(Boolean).slice(0,6),
        reason:String(item.reason||item.why||item.summary||item.notes||"").trim(),
        bestTime:String(item.bestTime||item.best_time||item.visit_window||"").trim(),
        travelNote:String(item.travelNote||item.travel_note||item.logistics||"").trim()
      };
    }).filter(Boolean);
  }
  var normalizedStops=normalizeStops(parsed.destinations||parsed.stops||parsed.route||[]);
  if(normalizedStops.length===0){
    normalizedStops=requested.map(function(dest){
      return {destination:dest.name,country:dest.country,days:1,nearbySites:[],reason:"",bestTime:"",travelNote:""};
    });
  }
  var seen={};
  normalizedStops=normalizedStops.filter(function(stop){
    var key=canonicalTripDestinationName(stop.destination);
    if(!key||seen[key])return false;
    seen[key]=1;
    return true;
  });
  requested.forEach(function(dest){
    var key=canonicalTripDestinationName(dest.name);
    if(key&&!seen[key]){
      normalizedStops.push({destination:dest.name,country:dest.country,days:1,nearbySites:[],reason:"",bestTime:"",travelNote:""});
      seen[key]=1;
    }
  });
  var phases=(Array.isArray(parsed.phases)?parsed.phases:[]).map(function(phase,idx){
    var route=Array.isArray(phase&&phase.route)?phase.route.map(function(stop){return String(stop||"").trim();}).filter(Boolean):[];
    return {
      title:String(phase&&phase.title||("Phase "+(idx+1))).trim()||("Phase "+(idx+1)),
      route:route,
      days:Math.max(1,Number(phase&&phase.days||route.length||1)||1),
      notes:String(phase&&phase.notes||phase&&phase.summary||"").trim()
    };
  }).filter(function(phase){return phase.route.length>0||phase.notes;});
  var totalDays=Math.max(
    1,
    Number(parsed.totalDays||parsed.total_days||0)||0,
    normalizedStops.reduce(function(sum,stop){return sum+Math.max(1,Number(stop.days)||1);},0)
  );
  return {
    startingCity:String(parsed.startingCity||parsed.start_city||parsed.origin||"").trim(),
    endingCity:String(parsed.endingCity||parsed.end_city||parsed.returnCity||"").trim(),
    summary:String(parsed.summary||parsed.routeSummary||parsed.route_summary||"").trim(),
    totalDays:totalDays,
    phases:phases,
    destinations:normalizedStops,
    seasonNotes:(Array.isArray(parsed.seasonNotes||parsed.season_notes)?(parsed.seasonNotes||parsed.season_notes):[]).map(function(note){return String(note||"").trim();}).filter(Boolean).slice(0,6),
    bookingNotes:(Array.isArray(parsed.bookingNotes||parsed.booking_notes)?(parsed.bookingNotes||parsed.booking_notes):[]).map(function(note){return String(note||"").trim();}).filter(Boolean).slice(0,6),
    packingNotes:(Array.isArray(parsed.packingNotes||parsed.packing_notes)?(parsed.packingNotes||parsed.packing_notes):[]).map(function(note){return String(note||"").trim();}).filter(Boolean).slice(0,6)
  };
}

function orderDestinationsByRoutePlan(destinations, routePlan){
  var list=Array.isArray(destinations)?destinations:[];
  var orderedStops=Array.isArray(routePlan&&routePlan.destinations)?routePlan.destinations:[];
  if(list.length===0||orderedStops.length===0)return list;
  var order={};
  orderedStops.forEach(function(stop,idx){
    var key=canonicalTripDestinationName(stop&&stop.destination||stop&&stop.name||"");
    if(key&&order[key]===undefined)order[key]=idx;
  });
  return list.slice().sort(function(a,b){
    var ak=canonicalTripDestinationName(a&&a.name||a||"");
    var bk=canonicalTripDestinationName(b&&b.name||b||"");
    var ai=order[ak];
    var bi=order[bk];
    if(ai===undefined&&bi===undefined)return 0;
    if(ai===undefined)return 1;
    if(bi===undefined)return -1;
    return ai-bi;
  });
}

function routePlanDurationMap(routePlan){
  var out={};
  (Array.isArray(routePlan&&routePlan.destinations)?routePlan.destinations:[]).forEach(function(stop){
    var name=String(stop&&stop.destination||"").trim();
    if(!name)return;
    var days=Math.max(1,Number(stop&&stop.days||1)||1);
    out[name]=days;
  });
  return out;
}

async function askRoutePlan(destinations, interests, budgetTier, dietary, styles, groupPrefs){
  var destList=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    var name=String(dest&&dest.name||dest||"").trim();
    var country=String(dest&&dest.country||"").trim();
    return country?(name+", "+country):name;
  }).filter(Boolean);
  if(destList.length===0)return null;
  var yes=[],no=[];
  var src=(interests&&typeof interests==="object")?interests:{};
  Object.keys(src).sort().forEach(function(key){
    if(src[key]===true)yes.push(key);
    else if(src[key]===false)no.push(key);
  });
  if(groupPrefs&&Array.isArray(groupPrefs.extraYes)){
    groupPrefs.extraYes.forEach(function(key){
      var next=String(key||"").trim();
      if(next&&yes.indexOf(next)<0)yes.push(next);
    });
  }
  if(groupPrefs&&Array.isArray(groupPrefs.extraNo)){
    groupPrefs.extraNo.forEach(function(key){
      var next=String(key||"").trim();
      if(next&&no.indexOf(next)<0)no.push(next);
    });
  }
  var styleText=(Array.isArray(styles)?styles:[]).map(function(style){return String(style||"").trim();}).filter(Boolean).join(", ")||"mixed traveler";
  var dietaryText=(Array.isArray(dietary)?dietary:[]).map(function(item){return String(item||"").trim();}).filter(Boolean).join(", ")||"none";
  var crewSummary=(groupPrefs&&Array.isArray(groupPrefs.memberSummaries)&&groupPrefs.memberSummaries.length)
    ? groupPrefs.memberSummaries.join(" | ")
    : "none provided";
  var focusText=yes.length?yes.join(", "):"culture, spiritual history, local experiences";
  var avoidText=no.length?no.join(", "):"none";
  var sys=`You are WanderPlan Route Planner. Build a realistic route-first travel plan for this trip.

Return ONLY a JSON object with this exact shape:
{
  "startingCity":"Best starting city",
  "endingCity":"Best ending city",
  "summary":"2-3 sentence route summary",
  "totalDays":24,
  "phases":[
    {"title":"North India phase","route":["Delhi","Kedarnath","Varanasi"],"days":6,"notes":"Why this grouping works"}
  ],
  "destinations":[
    {
      "destination":"Kedarnath",
      "days":2,
      "nearbySites":["Triyuginarayan Temple","Guptkashi"],
      "reason":"Why this stop matters in the route",
      "bestTime":"Morning darshan; altitude travel buffer",
      "travelNote":"Road + trek or helicopter logistics"
    }
  ],
  "seasonNotes":["October to March is easiest for most stops"],
  "bookingNotes":["Book high-demand temple rituals or helicopter slots early"],
  "packingNotes":["Carry modest temple clothing and layers for high altitude"]
}

Trip destinations: ${destList.join(" | ")}
Travel style: ${styleText}
Budget tier: ${String(budgetTier||"moderate").trim().toLowerCase()}
Dietary: ${dietaryText}
Prioritize traveler interests: ${focusText}
Avoid emphasizing: ${avoidText}
Crew context: ${crewSummary}

Rules:
- Do the heavy lifting: choose the best starting city, group stops efficiently, reduce backtracking, and assign realistic days
- Use every listed destination exactly once as a core stop
- Include important nearby temples, spiritual sites, or major landmarks in nearbySites
- Keep nearbySites real and recognizable when possible
- For pilgrimage or theme-heavy trips, lean strongly into the spiritual route
- Keep output concise, practical, and efficient
- Return ONLY JSON object. No markdown, no tables, no commentary.`;
  var msg="I am interested in traveling to "+destList.join(", ")+". Build a realistic route plan with the best starting city, grouped phases, nearby important temples or landmarks, and practical days per stop. Return only the JSON object.";
  async function runRouteRequest(systemPrompt,userPrompt,maxTokens){
    try{
      var data=await withAsyncTimeout(function(){
        return llmReq({
          model:"claude-sonnet-4-20250514",
          max_tokens:maxTokens||2200,
          system:systemPrompt,
          messages:[{role:"user",content:userPrompt}]
        });
      },ROUTE_LLM_TIMEOUT_MS,{__routeTimeout:true});
      if(data&&data.__routeTimeout){
        return {plan:null,reason:"timed_out",error:"Route planner timed out waiting for Anthropic."};
      }
      var txt=extractLlmTextContent(data);
      var parsed=parseJsonLoose(txt);
      var normalized=normalizeRoutePlan(parsed,destinations);
      if(normalized&&Array.isArray(normalized.destinations)&&normalized.destinations.length){
        return {plan:normalized,reason:"ok",rawText:txt};
      }
      return {
        plan:null,
        reason:txt?"parse_failed":"empty_response",
        rawText:txt,
        error:txt
          ?"Route planner returned a response, but it was not usable structured JSON."
          :"Route planner returned an empty response."
      };
    }catch(e){
      return {
        plan:null,
        reason:"provider_error",
        error:trimRouteErrorDetail(e&&e.message||"Could not build a route plan")
      };
    }
  }
  var first=await runRouteRequest(sys,msg,1600);
  if(first.plan)return first.plan;
  var retrySys=sys+"\nAdditional rule: return one valid JSON object only. Do not include prose, tables, markdown, or commentary before or after the JSON.";
  var retryMsg=msg+" Return just the JSON object.";
  var retry=await runRouteRequest(retrySys,retryMsg,2000);
  if(retry.plan)return retry.plan;
  var finalError=retry.error||first.error||"Could not build a route plan yet. Try again in a moment.";
  var err=new Error(finalError);
  err.routeReason=retry.reason||first.reason||"provider_error";
  err.routeRawText=retry.rawText||first.rawText||"";
  throw err;
}

function extractLlmTextContent(data){
  var txt="";
  if(data&&Array.isArray(data.content)){
    for(var i=0;i<data.content.length;i++){
      if(data.content[i]&&data.content[i].type==="text")txt+=String(data.content[i].text||"");
    }
  }
  return txt.trim();
}

function normalizeBucketLLMResult(parsed){
  function toItem(row){
    if(!row||typeof row!=="object")return null;
    var name=String(row.name||row.destination||row.city||"").trim();
    if(!name)return null;
    if(!isPlausibleBucketDestinationName(name))return null;
    return {
      name:name,
      country:String(row.country||"").trim(),
      bestMonths:Array.isArray(row.bestMonths)?row.bestMonths:[],
      costPerDay:Number(row.costPerDay||0)||0,
      tags:Array.isArray(row.tags)?row.tags:[],
      bestTimeDesc:String(row.bestTimeDesc||"").trim(),
      costNote:String(row.costNote||"").trim()
    };
  }

  if(!parsed)return null;
  if(parsed.type==="clarify"){
    return {type:"clarify",message:String(parsed.message||"Could you name a specific city or country?")};
  }
  if(Array.isArray(parsed)){
    var arrItems=parsed.map(toItem).filter(Boolean);
    return arrItems.length?{type:"destinations",items:arrItems}:null;
  }
  if(parsed.type==="destination"){
    var one=toItem(parsed);
    return one?{type:"destinations",items:[one]}:null;
  }
  if(parsed.type==="destinations"&&Array.isArray(parsed.items)){
    var many=parsed.items.map(toItem).filter(Boolean);
    return many.length?{type:"destinations",items:many}:null;
  }
  if(Array.isArray(parsed.destinations)){
    var list=parsed.destinations.map(toItem).filter(Boolean);
    return list.length?{type:"destinations",items:list}:null;
  }
  var fallbackOne=toItem(parsed);
  return fallbackOne?{type:"destinations",items:[fallbackOne]}:null;
}

function bucketQueryNeedsSpecificChildren(userMsg){
  var q=String(userMsg||"").trim().toLowerCase();
  if(!q)return false;
  var hasPlaceNoun=/\b(cities|city|towns|town|places|destinations|spots|areas|regions|islands)\b/.test(q);
  var hasListIntent=/\b(popular|top|best|tourist|must-see|recommend|recommended)\b/.test(q);
  if(hasListIntent)return true;
  if(!hasPlaceNoun)return false;
  if(q.split(/\s+/).filter(Boolean).length>18)return false;
  return /\b(in|within|around|across|for)\b/.test(q);
}

function bucketQueryAnchorName(userMsg){
  var raw=String(userMsg||"").trim().replace(/[?!.,]+$/g,"");
  if(!raw)return "";
  var re=/\b(?:in|within|around|across|for)\s+([A-Za-z][A-Za-z .'\-()]{2,})/gi;
  var match,last="";
  while((match=re.exec(raw))){ last=String(match[1]||"").trim(); }
  last=last.replace(/^.*\b(?:in|within|around|across|for)\s+/i,"").trim();
  return canonicalTripDestinationName(last);
}

function isLongFormBucketEssay(userMsg){
  var text=String(userMsg||"").trim();
  if(!text)return false;
  var words=text.split(/\s+/).filter(Boolean);
  return words.length>=60;
}

function countPhraseOccurrences(text, phrase){
  var t=String(text||"");
  var p=String(phrase||"").trim();
  if(!t||!p)return 0;
  var esc=p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  var matches=t.match(new RegExp("\\b"+esc+"\\b","gi"));
  return matches?matches.length:0;
}

function selectPrimaryBucketItem(userMsg, items){
  var text=String(userMsg||"");
  var normalizedText=text.toLowerCase();
  var best=null;
  var bestScore=-Infinity;
  (Array.isArray(items)?items:[]).forEach(function(item){
    var name=String(item&&item.name||"").trim();
    if(!name)return;
    var lower=name.toLowerCase();
    var mentions=countPhraseOccurrences(text,name);
    var intentMentions=countPhraseOccurrences(text,"to "+name)+countPhraseOccurrences(text,"in "+name)+countPhraseOccurrences(text,"visit "+name)+countPhraseOccurrences(text,"visiting "+name)+countPhraseOccurrences(text,"explore "+name)+countPhraseOccurrences(text,"trip to "+name)+countPhraseOccurrences(text,"travel to "+name);
    var landmarkPenalty=/\b(bridge|river|castle|square|clock|monument|museum|cathedral|temple|church|palace|tower|fort|gothic|baroque|art nouveau)\b/i.test(lower)?5:0;
    var firstIdx=normalizedText.indexOf(lower);
    var positionBonus=firstIdx>=0?Math.max(0,5000-firstIdx):0;
    var score=(intentMentions*100)+(mentions*20)+positionBonus-landmarkPenalty;
    if(score>bestScore){
      bestScore=score;
      best=item;
    }
  });
  return best||((Array.isArray(items)&&items.length)?items[0]:null);
}

function refineBucketItemsForQuery(userMsg, items){
  var list=Array.isArray(items)?items:[];
  if(!list.length)return [];
  var needsSpecific=bucketQueryNeedsSpecificChildren(userMsg);
  var anchor=bucketQueryAnchorName(userMsg);
  var out=[];
  var seen={};
  list.forEach(function(it){
    var name=String(it&&it.name||"").trim();
    if(!name)return;
    var country=String(it&&it.country||"").trim();
    var nameKey=canonicalTripDestinationName(name);
    var countryKey=canonicalTripDestinationName(country);
    if(needsSpecific&&anchor&&nameKey===anchor&&(!countryKey||countryKey===anchor)){
      return;
    }
    var dedupeKey=nameKey+"|"+countryKey;
    if(seen[dedupeKey])return;
    seen[dedupeKey]=1;
    out.push(it);
  });
  if(!needsSpecific&&isLongFormBucketEssay(userMsg)&&out.length>1){
    var primary=selectPrimaryBucketItem(userMsg,out);
    return primary?[primary]:[];
  }
  return out;
}

function bucketClarifyMessage(userMsg){
  var anchor=bucketQueryAnchorName(userMsg);
  if(anchor){
    var pretty=String(anchor||"").replace(/\b\w/g,function(ch){return ch.toUpperCase();});
    return "I need specific cities, islands, or regions in "+pretty+". Try something like \"best cities in "+pretty+"\" or name a few places you want to compare.";
  }
  return "Could you name specific cities, islands, or regions you want to explore?";
}

function summarizeActiveInterests(interests){
  var keys=Object.keys((interests&&typeof interests==="object")?interests:{}).filter(function(key){
    return interests[key]===true;
  });
  return keys.slice(0,3).join(", ");
}

async function fallbackExtractDestinations(userMsg){
  try{
    var r=await apiJson("/nlp/extract-destinations",{method:"POST",body:{text:userMsg}});
    var arr=(r&&Array.isArray(r.destinations))?r.destinations:[];
    if(!arr.length)return [];
    var out=[];
    for(var i=0;i<arr.length;i++){
      var it=arr[i]||{};
      var nm=String(it.name||it.destination||it.city||"").trim();
      if(!nm)continue;
      if(!isPlausibleBucketDestinationName(nm))continue;
      out.push({
        name:nm,
        country:String(it.country||"").trim(),
        bestMonths:[4,5,9,10],
        costPerDay:150,
        tags:["Culture","Food"],
        bestTimeDesc:"Shoulder seasons are usually best for weather and crowds.",
        costNote:"Estimated default until preferences refine this."
      });
    }
    return out;
  }catch(e){
    return [];
  }
}

async function askLLM(userMsg, budget, history) {
  var bd = {budget:"$50-120/day budget",moderate:"$120-250/day mid-range",premium:"$250-400/day premium",luxury:"$400+/day luxury"};
  var sys = "You are WanderPlan Bucket List Agent. User may mention one or many dream destinations. Respond with ONLY valid JSON.\n\nFor one or more places return: {\"type\":\"destinations\",\"items\":[{\"name\":\"Place\",\"country\":\"Country\",\"bestMonths\":[3,4,5],\"costPerDay\":150,\"tags\":[\"Culture\",\"Food\"],\"bestTimeDesc\":\"Mar-May for cherry blossoms\",\"costNote\":\"Based on " + (bd[budget] || bd.moderate) + "\"}]}\n\nIf too vague: {\"type\":\"clarify\",\"message\":\"Your question\"}\n\nRules:\n- return specific cities, islands, or regions travelers actually plan around\n- do not return generic placeholders like \"Europe trip\" or \"beach destination\"\n- do not duplicate the same place with slightly different wording\n- include realistic bestMonths and costPerDay ranges, not zeros\n- prefer destinations that fit the stated budget when possible\n- if the user names multiple places, include each distinct place once\n\ntags from: Beach,Culture,Food,Adventure,Nature,Nightlife,History,Wellness,Photography,Shopping,Wine,Hiking. ONLY JSON.";
  var msgs = [];
  if (history) { for (var i = 0; i < history.length; i++) { var m = history[i]; if (m.from === "user") msgs.push({role:"user",content:m.text}); else if (m.from === "agent" && !m.dest) msgs.push({role:"assistant",content:m.text}); } }
  msgs.push({role: "user", content: userMsg});
  try {
    var data = await llmReq({model: "claude-sonnet-4-20250514", max_tokens: 500, messages: msgs, system: sys});
    var txt = ""; if (data.content) { for (var j = 0; j < data.content.length; j++) { if (data.content[j].type === "text") txt += data.content[j].text; } }
    var parsed=parseJsonLoose(txt);
    var normalized=normalizeBucketLLMResult(parsed);
    if(normalized&&normalized.type==="destinations"){
      var refined=refineBucketItemsForQuery(userMsg, normalized.items);
      if(refined.length)return {type:"destinations",items:refined};
      if(bucketQueryNeedsSpecificChildren(userMsg)){
        var retrySys=sys+"\nAdditional rule: if the user asks for cities/places in a country or larger area, NEVER return just that parent country/area. Return 4-8 specific city, island, or region-level destinations inside it.";
        var retryData=await llmReq({model:"claude-sonnet-4-20250514",max_tokens:700,messages:msgs,system:retrySys});
        var retryTxt=""; if(retryData&&retryData.content){ for(var rj=0;rj<retryData.content.length;rj++){ if(retryData.content[rj].type==="text")retryTxt+=retryData.content[rj].text; } }
        var retryParsed=parseJsonLoose(retryTxt);
        var retryNormalized=normalizeBucketLLMResult(retryParsed);
        if(retryNormalized&&retryNormalized.type==="destinations"){
          var retryRefined=refineBucketItemsForQuery(userMsg, retryNormalized.items);
          if(retryRefined.length)return {type:"destinations",items:retryRefined};
        }
        return {type:"clarify",message:bucketClarifyMessage(userMsg)};
      }
    }
    if(normalized)return normalized;
  } catch (e) {}
  var fb=await fallbackExtractDestinations(userMsg);
  var refinedFallback=refineBucketItemsForQuery(userMsg, fb);
  if(refinedFallback.length)return {type:"destinations",items:refinedFallback};
  return {type: "clarify", message: bucketClarifyMessage(userMsg)};
}

function buildPoiRequestSignature(destinations, interests, budgetTier, dietary, groupPrefs, routePlanSignature){
  var destList=(Array.isArray(destinations)?destinations:[]).map(function(d){
    return {
      name:String(d&&d.name||d||"").trim(),
      country:String(d&&d.country||"").trim()
    };
  }).filter(function(d){return !!d.name;});
  var ints=(interests&&typeof interests==="object")?interests:{};
  var normalizedInterests={};
  Object.keys(ints).sort().forEach(function(key){
    if(typeof ints[key]==="boolean")normalizedInterests[key]=ints[key];
  });
  var gp=(groupPrefs&&typeof groupPrefs==="object")?groupPrefs:{};
  function cleanList(list){
    return (Array.isArray(list)?list:[]).map(function(v){return String(v||"").trim();}).filter(Boolean).sort();
  }
  return JSON.stringify({
    version:"grounded-nearby-sites-v1",
    destinations:destList,
    interests:normalizedInterests,
    budgetTier:String(budgetTier||"").trim().toLowerCase(),
    dietary:cleanList(dietary),
    extraYes:cleanList(gp.extraYes),
    extraNo:cleanList(gp.extraNo),
    groupDietary:cleanList(gp.dietary),
    memberSummaries:cleanList(gp.memberSummaries),
    routePlanSignature:String(routePlanSignature||"").trim()
  });
}

function groundPoiRowsWithRoutePlan(rows, routePlan, interests, budgetTier, dietary, groupPrefs){
  var list=Array.isArray(rows)?rows:[];
  if(list.length===0||!(routePlan&&Array.isArray(routePlan.destinations)&&routePlan.destinations.length))return list;
  var grouped={};
  list.forEach(function(row){
    var key=canonicalTripDestinationName(row&&row.destination||"");
    if(!key)return;
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(row);
  });
  var grounded=[];
  Object.keys(grouped).forEach(function(key){
    var rowsForDest=grouped[key]||[];
    var destName=String((rowsForDest[0]&&rowsForDest[0].destination)||"").trim();
    var routeStop=routeStopForDestination(routePlan,destName);
    var nearbySites=Array.isArray(routeStop&&routeStop.nearbySites)?routeStop.nearbySites.filter(Boolean):[];
    if(nearbySites.length>0){
      var manufacturedRows=[];
      var preservedRows=[];
      rowsForDest.forEach(function(row){
        if(isManufacturedPoiName(row&&row.name,destName))manufacturedRows.push(row);
        else preservedRows.push(row);
      });
      if(manufacturedRows.length>0){
        var groundedNearbyRows=buildDestinationFallbackPois(destName, interests, budgetTier, dietary, groupPrefs, routePlan, "route_plan_grounded");
        grounded=grounded.concat(mergePoiListsByCanonical(preservedRows.concat(groundedNearbyRows), {}));
        return;
      }
    }
    grounded=grounded.concat(rowsForDest);
  });
  return mergePoiListsByCanonical(grounded, {});
}

function poiListNeedsRefresh(savedSignature, currentSignature, rows, destinations){
  var list=Array.isArray(rows)?rows:[];
  if(list.length===0)return false;
  var destCount=(Array.isArray(destinations)?destinations:[]).length;
  var minPerDestination=destCount<=2?4:(destCount<=6?3:2);
  if(destinationsNeedingPoiCoverage(list,destinations,minPerDestination).length===0){
    return false;
  }
  var saved=String(savedSignature||"").trim();
  var current=String(currentSignature||"").trim();
  if(saved&&current&&saved!==current)return true;
  var destNames=(Array.isArray(destinations)?destinations:[]).map(function(d){
    return canonicalTripDestinationName(d&&d.name||d||"");
  }).filter(Boolean);
  if(destNames.length===0)return false;
  var poiDests={};
  list.forEach(function(p){
    var key=canonicalTripDestinationName(p&&p.destination||"");
    if(key)poiDests[key]=1;
  });
  return destNames.some(function(name){return !poiDests[name];});
}

function destinationsNeedingPoiCoverage(rows, destinations, minPerDestination){
  var required=Math.max(1,Number(minPerDestination)||1);
  var counts={};
  (Array.isArray(rows)?rows:[]).forEach(function(p){
    var dest=canonicalTripDestinationName(p&&p.destination||"");
    if(!dest)return;
    counts[dest]=(counts[dest]||0)+1;
  });
  return (Array.isArray(destinations)?destinations:[]).filter(function(d){
    var name=String(d&&d.name||d||"").trim();
    if(!name)return false;
    return (counts[canonicalTripDestinationName(name)]||0)<required;
  });
}

function buildPOIGroupPrefsFromCrew(members){
  var yesMap={},noMap={},dietMap={},summaries=[];
  (Array.isArray(members)?members:[]).forEach(function(m){
    var prof=(m&&m.profile&&typeof m.profile==="object")?m.profile:null;
    if(!prof)return;
    var ints=(prof.interests&&typeof prof.interests==="object")?prof.interests:{};
    var yesLocal=[],noLocal=[];
    Object.keys(ints).forEach(function(k){
      if(ints[k]===true){yesMap[k]=1;yesLocal.push(k);}
      else if(ints[k]===false){noMap[k]=1;noLocal.push(k);}
    });
    var dy=Array.isArray(prof.dietary)?prof.dietary:[];
    dy.forEach(function(d){var v=String(d||"").trim();if(v)dietMap[v]=1;});
    var parts=[];
    if(yesLocal.length)parts.push("likes "+yesLocal.slice(0,4).join(", "));
    if(noLocal.length)parts.push("avoids "+noLocal.slice(0,4).join(", "));
    if(dy.length)parts.push("dietary "+dy.join(", "));
    var profileBudget=String(prof&&prof.budget_tier||"").trim().toLowerCase();
    if(profileBudget)parts.push("budget "+profileBudget);
    var nm=m.name||m.email||"Crew";
    summaries.push(nm+(parts.length?": "+parts.join("; "):""));
  });
  return {extraYes:Object.keys(yesMap),extraNo:Object.keys(noMap),dietary:Object.keys(dietMap),memberSummaries:summaries};
}

function shouldAutoGeneratePois(sc,wizStep,rows,done,loading,contextStale,destinations){
  if(sc!=="wizard"||wizStep!==6)return false;
  if(loading||contextStale)return false;
  if(!Array.isArray(destinations)||destinations.length===0)return false;
  return !Array.isArray(rows)||rows.length===0;
}

function shouldSkipPoiAutoGenerate(autoRan, rows){
  return !!autoRan && Array.isArray(rows) && rows.length>0;
}

async function askPOISupplement(destination, interests, budgetTier, dietary, groupPrefs){
  var bd = {budget:"$50-120/day",moderate:"$120-250/day",premium:"$250-400/day",luxury:"$400+/day"};
  var destName=String(destination&&destination.name||destination||"").trim();
  var country=String(destination&&destination.country||"").trim();
  if(!destName)return [];
  var intYes = []; var intNo = [];
  if (interests) { Object.keys(interests).forEach(function(k) { if (interests[k] === true) intYes.push(k); else if (interests[k] === false) intNo.push(k); }); }
  if (groupPrefs && Array.isArray(groupPrefs.extraYes)) {
    groupPrefs.extraYes.forEach(function(k){ if (intYes.indexOf(k) < 0) intYes.push(k); });
  }
  if (groupPrefs && Array.isArray(groupPrefs.extraNo)) {
    groupPrefs.extraNo.forEach(function(k){ if (intNo.indexOf(k) < 0) intNo.push(k); });
  }
  var dietaryAll = Array.isArray(dietary) ? dietary.slice() : [];
  if (groupPrefs && Array.isArray(groupPrefs.dietary)) {
    groupPrefs.dietary.forEach(function(d){ if (dietaryAll.indexOf(d) < 0) dietaryAll.push(d); });
  }
  var dietStr = dietaryAll.length > 0 ? dietaryAll.join(", ") : "none";
  var crewSummary = "";
  if (groupPrefs && Array.isArray(groupPrefs.memberSummaries) && groupPrefs.memberSummaries.length > 0) {
    crewSummary = groupPrefs.memberSummaries.join(" | ");
  }
  var focusedTheme=intYes.length===1?intYes[0]:"";
  var sys = `You are WanderPlan POI Coverage Agent. Suggest 4-5 destination-specific activities for ${destName}${country?", "+country:""}.

Return ONLY a JSON array:
[{"name":"Activity Name","destination":"${destName}","category":"Nature","duration":"3h","cost":0,"rating":4.8,"matchReason":"Short reason","tags":["Hiking"],"locationHint":"Neighborhood, waterfront, district, or landmark area","bestTime":"morning|afternoon|evening|flexible","openingWindow":"Short note like 08:00-17:00 or sunrise to noon"}]

Budget: ${bd[budgetTier] || bd.moderate}
Prioritize: ${intYes.join(", ") || "culture, food"}
Avoid: ${intNo.join(", ") || "none"}
Dietary: ${dietStr}
Crew preferences: ${crewSummary || "none provided"}
${focusedTheme?("Primary trip interest: "+focusedTheme+". Every option should feel clearly relevant to that interest while still staying destination-specific. "):""}
Rules:
- only return activities for ${destName}
- return exactly 4 or 5 strong options, not a huge list
- make the list rich and varied, not repetitive
- use real, recognizable landmarks, walks, food experiences, viewpoints, rituals, markets, museums, and locally distinctive experiences when possible
- include at least 2-3 morning-friendly options when they exist
- include useful local area hints for every POI
- avoid duplicates or near-duplicates of obvious temple-only variants unless the destination truly revolves around that theme
- match the budget and group preferences in matchReason
Return 4-5 items. ONLY JSON array.`;
  var msg = "Find additional activities for " + destName + (country ? ", " + country : "");
  var res = await callLLM(sys, msg, 800);
  return Array.isArray(res) ? res : [];
}

function primaryPoiTheme(interests, groupPrefs){
  var yes=[];
  var src=(interests&&typeof interests==="object")?interests:{};
  Object.keys(src).forEach(function(k){
    if(src[k]===true&&yes.indexOf(k)<0)yes.push(k);
  });
  if(groupPrefs&&Array.isArray(groupPrefs.extraYes)){
    groupPrefs.extraYes.forEach(function(k){
      var next=String(k||"").trim();
      if(next&&yes.indexOf(next)<0)yes.push(next);
    });
  }
  return yes.length===1?yes[0].toLowerCase():"";
}

function buildDestinationFallbackPois(destination, interests, budgetTier, dietary, groupPrefs, routePlan, failureReason){
  var destName=String(destination&&destination.name||destination||"").trim();
  var country=String(destination&&destination.country||"").trim();
  if(!destName)return [];
  var theme=primaryPoiTheme(interests,groupPrefs);
   var routeStop=routeStopForDestination(routePlan,destination);
   var nearbySites=Array.isArray(routeStop&&routeStop.nearbySites)?routeStop.nearbySites.filter(Boolean):[];
  var budgetCost={budget:0,moderate:15,premium:35,luxury:60};
  var paidCost=budgetCost[budgetTier]!==undefined?budgetCost[budgetTier]:15;
  var freeCost=0;
  var rowsByTheme={
    culture:[
      {name:destName+" Heritage Walk",category:"Culture",duration:"2h",cost:freeCost,tags:["Heritage","Walking"],locationHint:"Historic core",bestTime:"morning",openingWindow:"Early morning to sunset",matchReason:"Grounded cultural orientation for the destination."},
      {name:destName+" Museum and Storytelling Visit",category:"Culture",duration:"2h",cost:paidCost,tags:["Museum","History"],locationHint:"Central museum district",bestTime:"afternoon",openingWindow:"10:00-17:00",matchReason:"Adds local history depth without overloading the day."},
      {name:destName+" Local Craft and Bazaar Trail",category:"Shopping",duration:"2h",cost:paidCost,tags:["Crafts","Bazaar"],locationHint:"Market quarter",bestTime:"afternoon",openingWindow:"11:00-19:00",matchReason:"Balances cultural sightseeing with locally distinctive browsing."},
      {name:destName+" Evening Ritual and Old Quarter Walk",category:"Culture",duration:"2h",cost:freeCost,tags:["Ritual","Walking"],locationHint:"Old quarter or temple district",bestTime:"evening",openingWindow:"Sunset onward",matchReason:"Fits culture-focused travelers with a memorable evening anchor."}
    ],
    spiritual:[
      {name:destName+" Temple Darshan and Orientation Walk",category:"Culture",duration:"2h",cost:freeCost,tags:["Temple","Spiritual"],locationHint:"Main temple precinct",bestTime:"morning",openingWindow:"Sunrise to noon",matchReason:"Prioritizes the main spiritual draw early in the day."},
      {name:destName+" Sacred Heritage Circuit",category:"Culture",duration:"2h",cost:freeCost,tags:["Pilgrimage","Heritage"],locationHint:"Temple and heritage zone",bestTime:"morning",openingWindow:"Morning",matchReason:"Gives spiritual travelers a focused circuit around key sacred stops."},
      {name:destName+" Mythology and Ritual Interpretation Session",category:"Culture",duration:"90m",cost:paidCost,tags:["History","Rituals"],locationHint:"Pilgrim learning center",bestTime:"afternoon",openingWindow:"12:00-17:00",matchReason:"Adds meaning and context beyond just darshan."},
      {name:destName+" Evening Aarti Viewing",category:"Culture",duration:"90m",cost:freeCost,tags:["Aarti","Spiritual"],locationHint:"Riverfront or temple courtyard",bestTime:"evening",openingWindow:"Sunset",matchReason:"Strong evening spiritual anchor for the itinerary."}
    ],
    hiking:[
      {name:destName+" Viewpoint Hike",category:"Nature",duration:"3h",cost:freeCost,tags:["Hiking","Views"],locationHint:"Trailhead near main viewpoint",bestTime:"morning",openingWindow:"Sunrise to noon",matchReason:"Leans into the trip's hiking focus with a clear morning activity."},
      {name:destName+" Scenic Ridge Walk",category:"Nature",duration:"2h",cost:freeCost,tags:["Walking","Scenic"],locationHint:"Scenic ridge or hill path",bestTime:"morning",openingWindow:"Morning",matchReason:"Adds a moderate outdoor option without needing a full-day trek."},
      {name:destName+" Local Nature Trail",category:"Nature",duration:"2h",cost:paidCost,tags:["Nature","Trail"],locationHint:"Regional park or reserve edge",bestTime:"afternoon",openingWindow:"08:00-17:00",matchReason:"Keeps the itinerary outdoors and destination-specific."},
      {name:destName+" Sunset Panorama Walk",category:"Photography",duration:"90m",cost:freeCost,tags:["Sunset","Photography"],locationHint:"Sunset overlook",bestTime:"evening",openingWindow:"Golden hour",matchReason:"Creates a lighter scenic option late in the day."}
    ],
    food:[
      {name:destName+" Market Breakfast Walk",category:"Food",duration:"90m",cost:paidCost,tags:["Breakfast","Market"],locationHint:"Central market streets",bestTime:"morning",openingWindow:"08:00-11:00",matchReason:"Grounds the day in local food culture right away."},
      {name:destName+" Street Food Tasting Trail",category:"Food",duration:"2h",cost:paidCost,tags:["Street food","Tasting"],locationHint:"Popular food lanes",bestTime:"afternoon",openingWindow:"11:00-17:00",matchReason:"Strong food-first experience aligned to traveler interests."},
      {name:destName+" Regional Cuisine Workshop",category:"Food",duration:"2h",cost:paidCost+10,tags:["Cooking","Cuisine"],locationHint:"Cooking studio or host kitchen",bestTime:"afternoon",openingWindow:"12:00-18:00",matchReason:"Adds a richer food experience beyond restaurants alone."},
      {name:destName+" Signature Dinner District Crawl",category:"Food",duration:"2h",cost:paidCost+10,tags:["Dinner","Local specialties"],locationHint:"Dining district",bestTime:"evening",openingWindow:"18:00-22:00",matchReason:"Makes dinner itself part of the local experience."}
    ]
  };
  var chosen=(nearbySites.length>0?nearbySites.slice(0,4).map(function(site,idx){
    var siteName=String(site||"").trim();
    var lower=siteName.toLowerCase();
    var templeLike=/temple|mandir|jyotirlinga|ghat|aarti|shrine|ashram|math|dham/.test(lower);
    return {
      name:siteName,
      category:templeLike?"Culture":"Culture",
      duration:templeLike?"90m":"2h",
      cost:freeCost,
      tags:templeLike?["Temple","Spiritual"]:["Nearby site","Culture"],
      locationHint:destName+" area",
      bestTime:templeLike?"morning":"flexible",
      openingWindow:templeLike?"Sunrise to noon":"",
      matchReason:"Highlighted in the route plan as an important nearby site for "+destName+"."
    };
  }):rowsByTheme[theme])||[
    {name:destName+" Landmark Orientation Walk",category:"Culture",duration:"90m",cost:freeCost,tags:["Walking","Highlights"],locationHint:"Historic center",bestTime:"morning",openingWindow:"Morning",matchReason:"Good first-pass overview of the destination."},
    {name:destName+" Signature Local Experience",category:"Culture",duration:"2h",cost:paidCost,tags:["Local","Experience"],locationHint:"Main cultural district",bestTime:"afternoon",openingWindow:"10:00-17:00",matchReason:"Adds a destination-specific cultural anchor."},
    {name:destName+" Market and Neighborhood Walk",category:"Shopping",duration:"2h",cost:paidCost,tags:["Market","Neighborhood"],locationHint:"Local market streets",bestTime:"afternoon",openingWindow:"11:00-18:00",matchReason:"Balances sightseeing with everyday local life."},
    {name:destName+" Sunset or Evening Highlight",category:"Photography",duration:"90m",cost:freeCost,tags:["Sunset","Views"],locationHint:"Best evening landmark area",bestTime:"evening",openingWindow:"Golden hour",matchReason:"Creates a memorable late-day moment."}
  ];
  return chosen.slice(0,4).map(function(row,idx){
    return Object.assign({
      poi_id:"",
      destination:destName,
      country:country,
      rating:4.2-(idx*0.05),
      approved:null,
      source:"fallback",
      failureReason:String(failureReason||"fallback").trim().toLowerCase()
    },row);
  });
}

async function askPOISupplementDetailed(destination, interests, budgetTier, dietary, groupPrefs, routePlan){
  var bd = {budget:"$50-120/day",moderate:"$120-250/day",premium:"$250-400/day",luxury:"$400+/day"};
  var destName=String(destination&&destination.name||destination||"").trim();
  var country=String(destination&&destination.country||"").trim();
  if(!destName)return {rows:[],reason:"empty_destination"};
  var intYes = []; var intNo = [];
  if (interests) { Object.keys(interests).forEach(function(k) { if (interests[k] === true) intYes.push(k); else if (interests[k] === false) intNo.push(k); }); }
  if (groupPrefs && Array.isArray(groupPrefs.extraYes)) {
    groupPrefs.extraYes.forEach(function(k){ if (intYes.indexOf(k) < 0) intYes.push(k); });
  }
  if (groupPrefs && Array.isArray(groupPrefs.extraNo)) {
    groupPrefs.extraNo.forEach(function(k){ if (intNo.indexOf(k) < 0) intNo.push(k); });
  }
  var dietaryAll = Array.isArray(dietary) ? dietary.slice() : [];
  if (groupPrefs && Array.isArray(groupPrefs.dietary)) {
    groupPrefs.dietary.forEach(function(d){ if (dietaryAll.indexOf(d) < 0) dietaryAll.push(d); });
  }
  var dietStr = dietaryAll.length > 0 ? dietaryAll.join(", ") : "none";
  var crewSummary = "";
  if (groupPrefs && Array.isArray(groupPrefs.memberSummaries) && groupPrefs.memberSummaries.length > 0) {
    crewSummary = groupPrefs.memberSummaries.join(" | ");
  }
  var focusedTheme=intYes.length===1?intYes[0]:"";
  var routeStop=routeStopForDestination(routePlan,destination);
  var nearbyContext=Array.isArray(routeStop&&routeStop.nearbySites)?routeStop.nearbySites.filter(Boolean).slice(0,6):[];
  var sys = `You are WanderPlan POI Coverage Agent. Suggest 4-5 destination-specific activities for ${destName}${country?", "+country:""}.

Return ONLY a JSON array:
[{"name":"Activity Name","destination":"${destName}","category":"Nature","duration":"3h","cost":0,"rating":4.8,"matchReason":"Short reason","tags":["Hiking"],"locationHint":"Neighborhood, waterfront, district, or landmark area","bestTime":"morning|afternoon|evening|flexible","openingWindow":"Short note like 08:00-17:00 or sunrise to noon"}]

Budget: ${bd[budgetTier] || bd.moderate}
Prioritize: ${intYes.join(", ") || "culture, food"}
Avoid: ${intNo.join(", ") || "none"}
Dietary: ${dietStr}
Crew preferences: ${crewSummary || "none provided"}
${focusedTheme?("Primary trip interest: "+focusedTheme+". Every option should feel clearly relevant to that interest while still staying destination-specific. "):""}
${nearbyContext.length?("Route planner nearby sites to ground this destination: "+nearbyContext.join(", ")+". Use them directly or build around them with real, recognizable nearby spiritual or cultural stops. "):""}
Rules:
- only return activities for ${destName}
- return exactly 4 or 5 strong options, not a huge list
- make the list rich and varied, not repetitive
- use real, recognizable landmarks, walks, food experiences, viewpoints, rituals, markets, museums, and locally distinctive experiences when possible
- include at least 2-3 morning-friendly options when they exist
- include useful local area hints for every POI
- avoid duplicates or near-duplicates of obvious temple-only variants unless the destination truly revolves around that theme
- if route planner nearby sites are provided, ground at least 2 options in those real sites or their immediate area
- match the budget and group preferences in matchReason
Return 4-5 items. ONLY JSON array.`;
  var msg = "Find additional activities for " + destName + (country ? ", " + country : "");
  try{
    var data=await llmReq({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: sys,
      messages: [{role: "user", content: msg}]
    });
    var txt=extractLlmTextContent(data);
    var parsed=parseJsonLoose(txt);
    if(parsed===null){
      return {rows:[],reason:txt?"parse_failed":"empty_response"};
    }
    var rows=(Array.isArray(parsed)?parsed:[]).map(function(row){
      return Object.assign({},row||{},{
        source:"llm",
        failureReason:""
      });
    });
    if(shouldReplaceWithGroundedNearbyPois(rows,destination,routePlan)){
      return {
        rows:buildDestinationFallbackPois(destination, interests, budgetTier, dietary, groupPrefs, routePlan, "llm_ungrounded"),
        reason:"llm_ungrounded"
      };
    }
    return {rows:rows,reason:rows.length>0?"ok":"empty_array"};
  }catch(e){
    return {rows:[],reason:"provider_error",error:String(e&&e.message||"provider_error")};
  }
}

async function askComprehensivePOIs(destinations, interests, budgetTier, dietary, groupPrefs){
  var dests=Array.isArray(destinations)?destinations:[];
  if(dests.length===0)return [];
  var batches=await Promise.all(dests.map(function(dest){
    return askPOISupplement(dest, interests, budgetTier, dietary, groupPrefs).catch(function(){return [];});
  }));
  var merged=[];
  batches.forEach(function(batch){
    merged=mergePoiListsByCanonical(merged.concat(batch||[]), {});
  });
  return merged;
}

function withAsyncTimeout(task, timeoutMs, fallbackValue){
  var ms=Math.max(1000,Number(timeoutMs)||0);
  return Promise.race([
    Promise.resolve().then(task),
    new Promise(function(resolve){
      setTimeout(function(){resolve(fallbackValue);},ms);
    })
  ]);
}

var POI_LLM_TIMEOUT_MS = 12000;

function classifyPoiFailureReason(reason, errorText){
  var base=String(reason||"").trim().toLowerCase();
  var msg=String(errorText||"").trim().toLowerCase();
  if(msg.indexOf("529")>=0||msg.indexOf("overloaded")>=0||msg.indexOf("overload")>=0)return "overloaded";
  if(base==="provider_error" && (msg.indexOf("timeout")>=0 || msg.indexOf("504")>=0))return "timed_out";
  return base||"provider_error";
}

function trimPoiErrorDetail(errorText){
  var msg=String(errorText||"").trim().replace(/^Error:\s*/,"");
  if(msg.length>240)return msg.substring(0,240)+"...";
  return msg;
}

function trimRouteErrorDetail(errorText){
  var msg=String(errorText||"").trim().replace(/^Error:\s*/,"");
  if(!msg)return "Could not build a route plan yet. Try again in a moment.";
  if(msg.length>240)return msg.substring(0,240)+"...";
  return msg;
}

async function buildPoiCoverageForDestinations(destinations, interests, budgetTier, dietary, groupPrefs, routePlan, minPerDestination, onProgress, onStatus){
  var dests=(Array.isArray(destinations)?destinations:[]).filter(Boolean);
  var required=Math.max(1,Number(minPerDestination)||1);
  var mergedRows=[];
  var pending=dests.slice();
  var batchCount=Math.max(1,dests.length);
  var attemptCounts={};
  var completedDestinations=[];
  var timedOutDestinations=[];
  var emptyDestinations=[];
  var failedDestinations=[];
  var parseFailedDestinations=[];
  var fallbackDestinations=[];
  var destinationErrors={};
  onStatus=(typeof onStatus==="function")?onStatus:null;
  var maxTimeoutAttempts=2;
  var batchIndex=0;
  while(pending.length>0){
    var current=pending.shift();
    var destName=String(current&&current.name||current||"").trim();
    if(!destName)continue;
    batchIndex+=1;
    attemptCounts[destName]=(attemptCounts[destName]||0)+1;
    if(onStatus)onStatus({
      phase:"llm",
      attempt:attemptCounts[destName],
      currentBatch:Math.min(batchIndex,batchCount),
      batchCount:batchCount,
      activeDestinations:[destName],
      completedDestinations:completedDestinations.slice(),
        timedOutDestinations:timedOutDestinations.slice(),
        emptyDestinations:emptyDestinations.slice(),
        failedDestinations:failedDestinations.slice(),
        parseFailedDestinations:parseFailedDestinations.slice(),
        fallbackDestinations:fallbackDestinations.slice(),
        destinationErrors:Object.assign({},destinationErrors)
      });
    var meta=await withAsyncTimeout(function(){
      return askPOISupplementDetailed(current, interests, budgetTier, dietary, groupPrefs, routePlan);
    },POI_LLM_TIMEOUT_MS,{rows:[],reason:"timed_out",error:"Frontend POI timeout after "+Math.round(POI_LLM_TIMEOUT_MS/1000)+"s"});
    var rows=Array.isArray(meta&&meta.rows)?meta.rows:[];
    var errorText=trimPoiErrorDetail(meta&&meta.error||"");
    var reason=classifyPoiFailureReason(meta&&meta.reason||"empty_array",errorText);
    if(rows.length>0){
      mergedRows=mergePoiListsByCanonical(mergedRows.concat(rows), {});
      if(completedDestinations.indexOf(destName)<0)completedDestinations.push(destName);
      delete destinationErrors[destName];
      if(typeof onProgress==="function")onProgress(mergedRows.slice());
      continue;
    }
    if(errorText)destinationErrors[destName]=errorText;
    if(reason==="timed_out"&&timedOutDestinations.indexOf(destName)<0)timedOutDestinations.push(destName);
    else if(reason==="provider_error"&&failedDestinations.indexOf(destName)<0)failedDestinations.push(destName);
    else if(reason==="overloaded"&&failedDestinations.indexOf(destName)<0)failedDestinations.push(destName);
    else if((reason==="parse_failed"||reason==="empty_response")&&parseFailedDestinations.indexOf(destName)<0)parseFailedDestinations.push(destName);
    else if(emptyDestinations.indexOf(destName)<0)emptyDestinations.push(destName);
    // Retry only true timeouts once; provider overload/parse issues should fail fast to fallback.
    if(reason==="timed_out" && (attemptCounts[destName]||0)<maxTimeoutAttempts){
      pending.push(current);
      continue;
    }
    var fallbackRows=buildDestinationFallbackPois(current, interests, budgetTier, dietary, groupPrefs, routePlan, reason);
    if(fallbackRows.length>0){
      mergedRows=mergePoiListsByCanonical(mergedRows.concat(fallbackRows), {});
      if(fallbackDestinations.indexOf(destName)<0)fallbackDestinations.push(destName);
      if(completedDestinations.indexOf(destName)<0)completedDestinations.push(destName);
      if(typeof onProgress==="function")onProgress(mergedRows.slice());
    }
  }
  return mergedRows;
}

async function askPOI(destinations, interests, budgetTier, dietary, groupPrefs) {
  var bd = {budget:"$50-120/day",moderate:"$120-250/day",premium:"$250-400/day",luxury:"$400+/day"};
  var destStr = (destinations || []).map(function(d) { return d.name + ", " + d.country; }).join("; ") || "Kyoto, Japan; Santorini, Greece";
  var intYes = []; var intNo = [];
  if (interests) { Object.keys(interests).forEach(function(k) { if (interests[k] === true) intYes.push(k); else if (interests[k] === false) intNo.push(k); }); }
  if (groupPrefs && Array.isArray(groupPrefs.extraYes)) {
    groupPrefs.extraYes.forEach(function(k){ if (intYes.indexOf(k) < 0) intYes.push(k); });
  }
  if (groupPrefs && Array.isArray(groupPrefs.extraNo)) {
    groupPrefs.extraNo.forEach(function(k){ if (intNo.indexOf(k) < 0) intNo.push(k); });
  }
  var dietaryAll = Array.isArray(dietary) ? dietary.slice() : [];
  if (groupPrefs && Array.isArray(groupPrefs.dietary)) {
    groupPrefs.dietary.forEach(function(d){ if (dietaryAll.indexOf(d) < 0) dietaryAll.push(d); });
  }
  var dietStr = dietaryAll.length > 0 ? dietaryAll.join(", ") : "none";
  var crewSummary = "";
  if (groupPrefs && Array.isArray(groupPrefs.memberSummaries) && groupPrefs.memberSummaries.length > 0) {
    crewSummary = groupPrefs.memberSummaries.join(" | ");
  }
  var sys = `You are WanderPlan POI Discovery Agent. Suggest 12-16 destination-specific activities spread across all destinations.

Return ONLY a JSON array:
[{"name":"Activity Name","destination":"City","category":"Nature","duration":"3h","cost":0,"rating":4.8,"matchReason":"Short reason","tags":["Hiking"],"locationHint":"Neighborhood, waterfront, district, or landmark area","bestTime":"morning|afternoon|evening|flexible","openingWindow":"Short note like 08:00-17:00 or sunrise to noon"}]

category: Nature, Food, Culture, Adventure, Wellness, Shopping, Nightlife, Photography
Budget: ${bd[budgetTier] || bd.moderate}
Prioritize: ${intYes.join(", ") || "culture, food"}
Avoid: ${intNo.join(", ") || "none"}
Dietary: ${dietStr}
Crew preferences: ${crewSummary || "none provided"}
Rules:
- use real, recognizable activities or landmarks when possible
- avoid generic placeholders like "Explore City", "Local sightseeing", or "Food tour" without a specific anchor
- spread the list across all destinations; aim for at least 2-3 strong options per destination when possible and do not let one city dominate unless only one city was given
- include a strong mix of spiritual, culture, food, scenic, and locally distinctive options where relevant; include at least one strong morning-friendly option per destination when possible
- provide a useful local area hint for each POI so itinerary routing can group nearby stops realistically
- set bestTime honestly: morning for sunrise/garden/lookout/market/open-early places, evening for nightlife/show/sunset places, flexible otherwise
- openingWindow should be brief and realistic when known; otherwise leave it empty
- no duplicates or near-duplicates
- match the budget and group preferences explicitly in matchReason
Return 12-16 items. ONLY JSON array.`;
  var msg = "Find activities for: " + destStr;
  var res = await callLLM(sys, msg, 1000);
  return Array.isArray(res) ? res : [];
}

async function askStays(destinations, budgetTier, nights, groupSize) {
  var bd = {budget:"$50-120/day",moderate:"$120-250/day",premium:"$250-400/day",luxury:"$400+/day"};
  var destStr = (destinations || []).map(function(d) { return d.name + ", " + d.country; }).join("; ") || "Kyoto, Japan";
  var sys = "You are WanderPlan Accommodation Agent. Find stays for each destination.\n\nReturn ONLY a JSON array:\n[{\"name\":\"Hotel Name\",\"destination\":\"City\",\"type\":\"Boutique Hotel\",\"rating\":4.8,\"ratePerNight\":185,\"totalNights\":3,\"amenities\":[\"Pool\",\"WiFi\",\"Breakfast\"],\"neighborhood\":\"Old Town\",\"bookingSource\":\"Booking.com\",\"whyThisOne\":\"Why it fits\",\"cancellation\":\"Free cancellation\",\"bookingUrl\":\"https://...\",\"imageUrl\":\"https://...\"}]\n\nProvide 3-4 options per destination. Budget: " + (bd[budgetTier] || bd.moderate) + ". Group: " + (groupSize || 2) + " people. Use local property types (Ryokan, Riad, Villa etc). Include bookingUrl and imageUrl when known.\nRules:\n- prefer real, well-known properties or high-confidence neighborhood-specific stays\n- do not invent generic template names like \"Grand <City> Palace\", \"<City> Central Suites\", or \"Urban Lodge\"\n- vary the property mix: boutique, apartment hotel, local inn, design hotel, guesthouse, etc. when appropriate\n- include a real neighborhood or district travelers would recognize\n- whyThisOne should mention what is nearby or why it fits the itinerary and budget\n- if exact listing URLs or images are not known, leave them empty rather than inventing fake links\nONLY JSON array.";
  var msg = "Find stays for: " + destStr + ". " + (nights || 10) + " total nights. " + (groupSize || 2) + " people.";
  var res = await callLLM(sys, msg, 1000);
  return Array.isArray(res) ? res : [];
}

export function stayPreviewLink(stay){
  var exact=String(stay&&(
    stay.bookingUrl||
    stay.booking_url||
    stay.listingUrl||
    stay.listing_url||
    stay.url||
    stay.link
  )||"").trim();
  if(exact)return exact;
  var query=[String(stay&&stay.name||"").trim(),String(stay&&stay.destination||"").trim(),String(stay&&stay.bookingSource||"hotel").trim()].filter(Boolean).join(" ");
  if(!query)return "";
  return "https://www.google.com/search?q="+encodeURIComponent(query);
}

function isManufacturedStayName(name,destination){
  var raw=String(name||"").trim();
  var dest=String(destination||"").trim();
  if(!raw||!dest)return false;
  var low=raw.toLowerCase();
  var destLow=dest.toLowerCase();
  if(low.indexOf(destLow)<0)return false;
  return /( palace| suites| suite| lodge| inn| residency| retreat| central| urban| grand)\b/.test(low);
}

function isAreaGuidanceStay(stay){
  if(!stay||typeof stay!=="object")return false;
  var type=String(stay.type||"").trim().toLowerCase();
  var source=String(stay.bookingSource||"").trim().toLowerCase();
  return type==="area guidance" || source.indexOf("area guidance")>=0 || source.indexOf("curated fallback")>=0;
}

function normalizeStays(rows,dests,budgetTier,totalNights){
  var list=Array.isArray(rows)?rows:[];
  var names=(dests||[]).map(function(d){return String(d&&d.name||"").trim();}).filter(Boolean);
  var nightsEach=Math.max(1,Math.round((totalNights||10)/Math.max(names.length,1)));
  var budgetDefaults={budget:95,moderate:170,premium:300,luxury:520};
  var defaultRate=budgetDefaults[budgetTier]||budgetDefaults.moderate;

  function pickDestination(raw){
    var s=String(raw||"").trim();
    if(!s&&names.length>0)return names[0];
    var low=s.toLowerCase();
    for(var i=0;i<names.length;i++){
      if(names[i].toLowerCase()===low)return names[i];
    }
    for(var j=0;j<names.length;j++){
      var dn=names[j].toLowerCase();
      if(low.indexOf(dn)>=0||dn.indexOf(low)>=0)return names[j];
    }
    return s||"Destination";
  }

  var out=[];
  var seen={};
  for(var k=0;k<list.length;k++){
    var it=list[k]||{};
    var name=String(it.name||it.hotel||it.property||"").trim();
    if(!name)continue;
    var dest=pickDestination(it.destination||it.city||it.location||"");
    var manufactured=isManufacturedStayName(name,dest);
    var source=String(it.bookingSource||"").trim();
    var areaName=String(it.neighborhood||it.area||"").trim();
    var areaGuidance=manufactured||isAreaGuidanceStay(it);
    if(areaGuidance){
      name=areaName?("Stay near "+areaName):("Stay near "+dest);
    }
    var key=(name.toLowerCase()+"|"+dest.toLowerCase());
    if(seen[key])continue;
    seen[key]=true;
    var rate=Math.max(0,Math.round(Number(it.ratePerNight||it.price||it.pricePerNight||0)));
    var why=String(it.whyThisOne||it.reason||"").trim();
    if(areaGuidance&&!why){
      why="Use this area to compare real guesthouses, dharamshalas, and hotels near "+(areaName||dest)+".";
    }
    out.push({
      name:name,
      destination:dest,
      type:areaGuidance?"Area guidance":(String(it.type||it.propertyType||"Hotel").trim()||"Hotel"),
      rating:areaGuidance?0:(Number(it.rating||it.stars||4.3)||4.3),
      ratePerNight:rate>0?rate:defaultRate,
      totalNights:Math.max(1,Number(it.totalNights||it.nights||nightsEach)||nightsEach),
      amenities:Array.isArray(it.amenities)?it.amenities.slice(0,6):[],
      neighborhood:areaName,
      bookingSource:areaGuidance?"WanderPlan area guidance":(source||"WanderPlan LLM"),
      whyThisOne:why||"Good fit for your budget and trip style.",
      cancellation:String(it.cancellation||"Flexible cancellation").trim(),
      imageUrl:String(it.imageUrl||it.image_url||it.photoUrl||it.photo_url||it.thumbnail||it.image||"").trim(),
      bookingUrl:String(it.bookingUrl||it.booking_url||it.listingUrl||it.listing_url||it.url||it.link||"").trim()
    });
  }
  return out;
}
function normalizePersistedStayOptions(rows,dests,budgetTier,totalNights){
  return normalizeStays(
    Array.isArray(rows)?rows:[],
    Array.isArray(dests)?dests:[],
    String(budgetTier||"moderate").trim().toLowerCase()||"moderate",
    Math.max(0,Number(totalNights)||0)
  );
}

function canonicalStayVoteKey(stay, idx){
  var raw=(String(stay&&stay.name||"")+" "+String(stay&&stay.destination||"")+" "+String(stay&&stay.type||"")).trim().toLowerCase();
  var slug=raw.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  if(slug)return "stay:"+slug;
  return "stay:index-"+String(idx);
}

function readStayVoteRow(votesMap, stay, idx){
  var map=(votesMap&&typeof votesMap==="object")?votesMap:{};
  var key=canonicalStayVoteKey(stay,idx);
  var row=map[key];
  if(!(row&&typeof row==="object")){
    row=map[idx];
    if(!(row&&typeof row==="object"))row=map[String(idx)];
  }
  if(!(row&&typeof row==="object"))row={};
  return {key:key,row:row};
}

function summarizeStayVotes(votesMap, stay, idx, voters){
  var rowMeta=readStayVoteRow(votesMap,stay,idx);
  var row=rowMeta.row;
  var normalizedVoters=dedupeVoteVoters(voters);
  var up=0;var down=0;var votedCount=0;
  normalizedVoters.forEach(function(voter){
    var v=readVoteForVoter(row,voter);
    if(v==="up"){up++;votedCount++;}
    else if(v==="down"){down++;votedCount++;}
  });
  return {key:rowMeta.key,row:row,up:up,down:down,votedCount:votedCount,totalVoters:normalizedVoters.length};
}

function canonicalMealVoteKey(day, meal, dayIndex, mealIndex){
  var mealGroupKey=String(day&&day.locationLabel||day&&day.anchor||"").trim();
  if(!mealGroupKey)mealGroupKey=String(day&&day.day||dayIndex+1);
  var raw=(
    mealGroupKey+" "+
    String(day&&day.destination||meal&&meal.city||"")+" "+
    String(meal&&meal.type||"")+" "+
    String(meal&&meal.time||"")
  ).trim().toLowerCase();
  var slug=raw.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  if(slug)return "meal:"+slug;
  return "meal:index-"+String(dayIndex)+"-"+String(mealIndex);
}

function readMealVoteRow(votesMap, day, meal, dayIndex, mealIndex){
  var map=(votesMap&&typeof votesMap==="object")?votesMap:{};
  var key=canonicalMealVoteKey(day,meal,dayIndex,mealIndex);
  var row=map[key];
  if(!(row&&typeof row==="object")){
    var legacyKey=String(dayIndex)+"-"+String(mealIndex);
    row=map[legacyKey];
  }
  if(!(row&&typeof row==="object"))row={};
  return {key:key,row:row};
}

function summarizeMealVotes(votesMap, day, meal, dayIndex, mealIndex, voters){
  var rowMeta=readMealVoteRow(votesMap,day,meal,dayIndex,mealIndex);
  var row=rowMeta.row;
  var normalizedVoters=dedupeVoteVoters(voters);
  var up=0;var down=0;var votedCount=0;
  normalizedVoters.forEach(function(voter){
    var v=readVoteForVoter(row,voter);
    if(v==="up"){up++;votedCount++;}
    else if(v==="down"){down++;votedCount++;}
  });
  return {key:rowMeta.key,row:row,up:up,down:down,votedCount:votedCount,totalVoters:normalizedVoters.length};
}

function normalizeMealForItinerary(meal, destination){
  var dest=String(destination||meal&&meal.destination||meal&&meal.city||"").trim();
  var base=(meal&&typeof meal==="object")?Object.assign({},meal):{};
  var options=Array.isArray(base.options)?base.options:[];
  var selectedIdx=Math.max(0,Math.min(options.length-1,Number(base.selectedOption)||0));
  var picked=(options[selectedIdx]&&typeof options[selectedIdx]==="object")?options[selectedIdx]:null;
  var mealType=String(base.type||"Meal").trim()||"Meal";
  var candidateName=String((picked&&picked.name)||base.name||"").trim();
  if((!candidateName||isRouteInstructionMealText(candidateName)||isManufacturedMealName(candidateName,dest))&&options.length>0){
    var valid=options.find(function(opt){
      var nm=String(opt&&opt.name||"").trim();
      return nm&&!isRouteInstructionMealText(nm)&&!isManufacturedMealName(nm,dest);
    });
    if(valid){
      picked=valid;
      candidateName=String(valid.name||"").trim();
    }
  }
  var anchor=String((picked&&picked.anchorLabel)||base.anchorLabel||base.focusArea||base.city||dest||"").trim();
  if(!candidateName||isRouteInstructionMealText(candidateName)||isManufacturedMealName(candidateName,dest)){
    var area=mealAreaLabel(dest,anchor);
    candidateName=mealType+(area&&normalizeMealText(area)!==normalizeMealText(dest)?(" near "+area):(" in "+(dest||"destination")));
  }
  return Object.assign({},base,{
    destination:dest||String(base.destination||"").trim(),
    city:String((picked&&picked.city)||base.city||dest||"").trim(),
    name:candidateName,
    cuisine:String((picked&&picked.cuisine)||base.cuisine||"Local").trim()||"Local",
    cost:Number((picked&&picked.cost)!==undefined?picked.cost:base.cost)||0,
    rating:Number((picked&&picked.rating)!==undefined?picked.rating:base.rating)||0
  });
}

function resolveMealsForItinerary(mealDays, mealVotes, voters, majorityNeeded, soloMode){
  var rows=Array.isArray(mealDays)?mealDays:[];
  var normalizedVoters=dedupeVoteVoters(voters);
  var need=Math.max(1,Number(majorityNeeded)||Math.floor(Math.max(normalizedVoters.length,1)/2)+1);
  var approved=[];
  var pending=[];
  var all=[];
  rows.forEach(function(day,di){
    var dayMeals=Array.isArray(day&&day.meals)?day.meals:[];
    var dest=String(day&&day.destination||"").trim();
    dayMeals.forEach(function(meal,mi){
      var normalizedMeal=normalizeMealForItinerary(meal,dest);
      all.push(normalizedMeal);
      if(soloMode){
        approved.push(normalizedMeal);
        return;
      }
      var summary=summarizeMealVotes(mealVotes,day,meal,di,mi,normalizedVoters);
      var isApproved=summary.up>=need&&summary.up>summary.down;
      var isRejected=summary.votedCount===normalizedVoters.length&&summary.down>=summary.up;
      if(isApproved)approved.push(normalizedMeal);
      else if(!isRejected)pending.push(normalizedMeal);
    });
  });
  if(approved.length>0)return approved;
  if(pending.length>0)return pending;
  return all;
}

function resolveSelectedStaysForDestinations(destinations, stays, stayPick, stayFinalChoices){
  var orderedDestNames=(Array.isArray(destinations)?destinations:[]).map(function(dest){
    return typeof dest==="string"?String(dest||"").trim():String(dest&&dest.name||dest&&dest.destination||"").trim();
  }).filter(Boolean);
  var byDest={};
  (Array.isArray(stays)?stays:[]).forEach(function(stay,idx){
    var destName=String(stay&&stay.destination||"").trim()||"Other";
    if(!byDest[destName])byDest[destName]=[];
    byDest[destName].push({stay:stay,idx:idx,localIndex:byDest[destName].length});
  });
  return orderedDestNames.map(function(destName){
    var entries=byDest[destName]||[];
    if(entries.length===0)return null;
    var selectedIdx=stayPick?stayPick[destName]:undefined;
    var selectedByPick=entries.find(function(entry){return entry.localIndex===selectedIdx;});
    if(selectedByPick)return selectedByPick.stay;
    var lockedKey=String((stayFinalChoices&&stayFinalChoices[destName])||"");
    if(lockedKey){
      var selectedByLock=entries.find(function(entry){
        return canonicalStayVoteKey(entry.stay,entry.idx)===lockedKey;
      });
      if(selectedByLock)return selectedByLock.stay;
    }
    var sorted=entries.slice().sort(function(a,b){
      return (Number(b&&b.stay&&b.stay.rating||0)||0)-(Number(a&&a.stay&&a.stay.rating||0)||0);
    });
    return (sorted[0]&&sorted[0].stay)||entries[0].stay||null;
  }).filter(Boolean);
}

function formatDateISO(d){
  var dt=d instanceof Date?d:new Date(d);
  if(Number.isNaN(dt.getTime()))dt=new Date();
  return dt.toISOString().slice(0,10);
}

async function askStaysBackend(tripId,destinations,budgetTier,totalNights,token){
  var tid=String(tripId||"").trim();
  if(!(token&&tid&&isUuidLike(tid)))return [];
  var dests=Array.isArray(destinations)?destinations:[];
  if(dests.length===0)return [];

  var budgetCaps={budget:130,moderate:260,premium:420,luxury:700};
  var maxPrice=budgetCaps[budgetTier]||budgetCaps.moderate;
  var nightsEach=Math.max(1,Math.round((totalNights||10)/Math.max(dests.length,1)));
  var today=new Date();
  var checkIn=formatDateISO(today);
  var checkOut=formatDateISO(new Date(today.getTime()+nightsEach*24*60*60*1000));

  var out=[];
  for(var i=0;i<dests.length;i++){
    var d=dests[i]||{};
    var city=String(d.name||d.destination||"").trim();
    if(!city)continue;
    try{
      var r=await apiJson("/trips/"+tid+"/stays/search",{method:"POST",body:{
        city:city,
        check_in:checkIn,
        check_out:checkOut,
        max_price:maxPrice
      }},token);
      var rows=(r&&Array.isArray(r.stays))?r.stays:[];
      rows.forEach(function(s){
        out.push({
          name:String(s&&s.name||"").trim(),
          destination:city,
          type:String(s&&s.type||"Hotel"),
          rating:Number(s&&s.rating||4.3)||4.3,
          ratePerNight:Number(s&&s.price_per_night_usd||0)||0,
          totalNights:Number(s&&s.nights||nightsEach)||nightsEach,
          amenities:Array.isArray(s&&s.amenities)?s.amenities.slice(0,6):["WiFi"],
          neighborhood:String(s&&(
            s.neighborhood||
            s.area
          )||"").trim(),
          bookingSource:String(s&&(
            s.bookingSource||
            s.booking_source||
            s.source
          )||"WanderPlan Search").trim(),
          whyThisOne:String(s&&(
            s.whyThisOne||
            s.why_this_one||
            s.reason
          )||"Matches your trip budget and destination.").trim(),
          cancellation:String(s&&(
            s.cancellation||
            s.cancellation_policy
          )||"Check provider policy").trim(),
          imageUrl:String(s&&(
            s.imageUrl||
            s.image_url||
            s.photoUrl||
            s.photo_url||
            s.thumbnail||
            s.image
          )||"").trim(),
          bookingUrl:String(s&&(
            s.bookingUrl||
            s.booking_url||
            s.listingUrl||
            s.listing_url||
            s.url||
            s.link
          )||"").trim()
        });
      });
    }catch(e){}
  }
  return out;
}

async function fetchAvailabilityOverlap(tripId, token){
  var tid=String(tripId||"").trim();
  if(!(token&&tid&&isUuidLike(tid)))return null;
  return apiJson("/trips/"+tid+"/availability/overlap",{method:"GET"},token);
}

async function submitAvailabilityRange(tripId, range, token){
  var tid=String(tripId||"").trim();
  if(!(token&&tid&&isUuidLike(tid)))return null;
  return apiJson("/trips/"+tid+"/availability",{method:"POST",body:{date_ranges:[range]}},token);
}

async function lockAvailabilityRange(tripId, range, token){
  var tid=String(tripId||"").trim();
  if(!(token&&tid&&isUuidLike(tid)))return null;
  return apiJson("/trips/"+tid+"/availability/lock",{method:"POST",body:{start:range.start,end:range.end}},token);
}

async function askDining(destinations, budgetTier, dietary, days, groupSize) {
  var bd = {budget:"$50-120/day",moderate:"$120-250/day",premium:"$250-400/day",luxury:"$400+/day"};
  var destStr = (destinations || []).map(function(d) { return d.name + ", " + d.country; }).join("; ") || "Kyoto, Japan";
  var dietStr = (dietary && dietary.length > 0) ? dietary.join(", ") : "none";
  var sys = "You are WanderPlan Dining Agent. Build a location-based restaurant plan for a trip.\n\nReturn ONLY a JSON array:\n[{\"destination\":\"City\",\"anchor\":\"Neighborhood or nearby attraction\",\"meals\":[{\"type\":\"Breakfast\",\"time\":\"08:00\",\"name\":\"Restaurant\",\"cuisine\":\"Local\",\"cost\":25,\"rating\":4.6,\"dietaryOk\":true,\"note\":\"Why go here\",\"options\":[{\"name\":\"Restaurant A\",\"cuisine\":\"Cafe\",\"cost\":22,\"rating\":4.7,\"note\":\"Known for pastries\"},{\"name\":\"Restaurant B\",\"cuisine\":\"Brunch\",\"cost\":26,\"rating\":4.5,\"note\":\"High-rated brunch spot\"},{\"name\":\"Restaurant C\",\"cuisine\":\"Bakery\",\"cost\":18,\"rating\":4.4,\"note\":\"Quick local favorite\"}]}]}]\n\nFor each destination, suggest breakfast, lunch, and dinner options tied to a local anchor like the hotel neighborhood, waterfront, market, old town, museum district, or a nearby landmark. Dietary: " + dietStr + ". Budget: " + (bd[budgetTier] || bd.moderate) + ". Group size: " + (groupSize || 2) + ".\nRules:\n- prefer real, highly rated restaurants or strong local specialties when known\n- avoid repeating the same style of restaurant names across cities\n- breakfast should be a realistic first stop near the stay or a morning POI area\n- lunch and dinner should reflect the destination's food culture, not generic placeholders\n- each option should feel meaningfully different in cuisine, price point, or atmosphere\n- notes should explain why the place is worth choosing locally\n- do not assign days; itinerary will place meals into days later\nONLY JSON array.";
  var msg = "Plan location-based meals for: " + destStr + ". " + (days || 10) + " trip days. " + (groupSize || 2) + " people. Dietary: " + dietStr;
  var res = await callLLM(sys, msg, 1000);
  return Array.isArray(res) ? res : [];
}

var MANUFACTURED_MEAL_SUFFIXES=[
  "sunrise cafe","brunch table","bakery kitchen","morning roastery",
  "market bistro","laneway kitchen","harbor grill","food hall",
  "supper club","chef's table","night market house","ember kitchen",
  "morning bakery","local breakfast house","street kitchen","local lunch spot",
  "evening table","chef's local kitchen"
];

var MANUFACTURED_MEAL_GENERIC_WORDS=[
  "cafe","bistro","kitchen","table","house","bakery","grill","hall",
  "club","roastery","diner","eatery","canteen","dhaba","restaurant",
  "spot","bar","food","brunch","breakfast","lunch","dinner","supper",
  "cuisine"
];

var MANUFACTURED_MEAL_DESCRIPTOR_WORDS=[
  "sunrise","morning","market","laneway","harbor","street","night",
  "ember","local","chef","temple","town","templetown","evening",
  "pilgrim","pilgrimage","courtyard","ritual","rituals","sacred",
  "holy","aarti","darshan","heritage","devotional","spiritual",
  "traditional",
  "coastal","photography","seafood","tasting","cooking","class"
];

var MANUFACTURED_MEAL_CONNECTOR_WORDS=[
  "and","with","of","near","by","for","from","to","at","in","on"
];

var MEAL_ROUTE_INSTRUCTION_REGEX=/\b(?:arrive in|travel to|check in(?: at)?|check out(?: from)?|transit from|transfer from)\b/i;
var MEAL_TRANSIT_DURATION_REGEX=/\bapprox\.?\s*\d+\s*min(?:ute)?s?\s*(?:transit|transfer)?\b/i;

function normalizeMealText(value){
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

var MEAL_AREA_KEYWORDS=[
  "access","area","bazaar","beach","center","centre","chowk","district","fort",
  "front","ghat","ghats","harbor","harbour","hill","hills","junction","lake",
  "lane","lanes","market","marina","old","precinct","quarter","quarters","road",
  "riverfront","square","street","streets","temple","town","trailhead","waterfront"
];

var MEAL_ACTIVITY_LABEL_WORDS=[
  "class","circuit","darshan","experience","highlights","highlight","orientation",
  "photography","session","tasting","tour","trail","viewing","walk","workshop"
];

function cleanMealAnchorText(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

function optionalMealAreaLabel(destination, anchor){
  var raw=cleanMealAnchorText(anchor);
  if(!raw)return "";
  return mealAreaLabel(destination, raw);
}

function defaultMealAnchorRole(type){
  return String(type||"").trim().toLowerCase()==="lunch"?"poi":"stay";
}

function normalizeMealAnchorRole(value, type){
  var role=String(value||"").trim().toLowerCase();
  if(role!=="poi"&&role!=="stay")role=defaultMealAnchorRole(type);
  return role;
}

function mealAnchorContext(role, destination, anchor){
  var dest=cleanMealAnchorText(destination)||"the destination";
  var label=optionalMealAreaLabel(dest,anchor);
  if(role==="poi"){
    return label&&normalizeMealText(label)!==normalizeMealText(dest)
      ? "the main sightseeing stop near "+label
      : "the main sightseeing area in "+dest;
  }
  return label&&normalizeMealText(label)!==normalizeMealText(dest)
    ? "your stay around "+label
    : "your stay in "+dest;
}

function mealAnchorBadge(role, anchor){
  var label=cleanMealAnchorText(anchor);
  if(role==="poi")return label?("Near sightseeing stop: "+label):"Near sightseeing stop";
  return label?("Near your stay: "+label):"Near your stay";
}

function mealTravelLabel(role, minutes){
  var mins=Number(minutes)||0;
  if(!mins)return "";
  return "~"+mins+" min from "+(role==="poi"?"sightseeing stop":"your stay");
}

function mealAreaLabel(destination, anchor){
  var dest=cleanMealAnchorText(destination)||"the area";
  var raw=cleanMealAnchorText(anchor);
  if(!raw)return dest;
  var candidate=raw
    .replace(/[|/;]+/g,",")
    .split(",")[0];
  if(/^approx\.\s*\d+\s*min transit\b/i.test(candidate) && /\bto\b/i.test(candidate)){
    candidate=candidate.split(/\bto\b/i).pop();
  }
  candidate=candidate
    .replace(/^(?:arrive in|travel to)\s+/i,"")
    .replace(/^check in(?: at)?\s+/i,"")
    .replace(/^check out(?: from)?\s+/i,"")
    .replace(/^stay near\s+/i,"");
  if(/\bnear\b/i.test(candidate)){
    candidate=candidate.split(/\bnear\b/i).pop();
  }
  if(/\bof\b/i.test(candidate)){
    var tail=candidate.split(/\bof\b/i).pop();
    if(cleanMealAnchorText(tail))candidate=tail;
  }
  candidate=cleanMealAnchorText(candidate)
    .replace(/\b(?:orientation walk|heritage walk|photography tour|interpretation session|evening aarti viewing|landmark orientation walk|signature local experience|market and neighborhood walk|sunset or evening highlight|temple darshan and orientation walk)\b.*$/i,"")
    .replace(/\b(?:darshan|viewing|session|trail|circuit|tasting|workshop|class|experience)\b.*$/i,"")
    .replace(/^[\s:,-]+|[\s:,-]+$/g,"");
  candidate=cleanMealAnchorText(candidate);
  if(!candidate)return dest;
  var candidateNorm=normalizeMealText(candidate);
  var destNorm=normalizeMealText(dest);
  if(!candidateNorm || candidateNorm==="trip highlights" || candidateNorm==="highlights")return dest;
  if(candidateNorm===destNorm)return dest;
  var tokens=candidateNorm.split(/\s+/).filter(Boolean);
  var hasAreaToken=tokens.some(function(token){return MEAL_AREA_KEYWORDS.indexOf(token)>=0;});
  var hasActivityToken=tokens.some(function(token){return MEAL_ACTIVITY_LABEL_WORDS.indexOf(token)>=0;});
  if((isManufacturedMealName(candidate,dest) || isManufacturedPoiName(candidate,dest)) && !hasAreaToken)return dest;
  if(tokens.length>7 && !hasAreaToken)return dest;
  if(hasActivityToken && !hasAreaToken)return dest;
  return candidate;
}

function mealGuidanceVariants(type,destination,anchor,anchorRole){
  var t=String(type||"meal").toLowerCase();
  var dest=String(destination||"the area").trim()||"the area";
  var near=mealAreaLabel(dest,anchor);
  var role=normalizeMealAnchorRole(anchorRole,t);
  var context=mealAnchorContext(role,dest,near);
  if(t==="breakfast")return [
    {name:"Breakfast near your stay",note:"Area guidance only. Compare real breakfast spots close to "+context+"."},
    {name:"Cafe options near your stay",note:"Area guidance only. Compare real cafes close to "+context+"."},
    {name:"Early breakfast near your stay",note:"Useful when you want a practical breakfast close to "+context+" before heading out."},
    {name:"Tea and bakery near your stay",note:"Area guidance only. Compare tea stalls, bakeries, and cafes close to "+context+"."}
  ];
  if(t==="lunch")return [
    {name:"Lunch near sightseeing stop",note:"Area guidance only. Compare real lunch places close to "+context+" so midday travel stays light."},
    {name:"Quick lunch near sightseeing stop",note:"Area guidance only. Good for comparing quick midday stops close to "+context+"."},
    {name:"Casual lunch near sightseeing stop",note:"Useful when you want flexible lunch choices without drifting far from "+context+"."},
    {name:"Midday food near sightseeing stop",note:"Area guidance only. Compare simple local eateries close to "+context+"."}
  ];
  return [
    {name:"Dinner near your stay",note:"Area guidance only. Compare real dinner options close to "+context+"."},
    {name:"Evening dinner near your stay",note:"Area guidance only. Good for comparing dinner spots close to "+context+"."},
    {name:"Dinner options near your stay",note:"Useful when you want the evening to end close to "+context+"."},
    {name:"After-sightseeing dinner near your stay",note:"Area guidance only. Choose a real restaurant close to "+context+" after the day wraps up."}
  ];
}

function isRouteInstructionMealText(value){
  var raw=String(value||"").trim();
  if(!raw)return false;
  if(MEAL_ROUTE_INSTRUCTION_REGEX.test(raw))return true;
  if(MEAL_TRANSIT_DURATION_REGEX.test(raw) && /\b(?:transit|transfer|from|to)\b/i.test(raw))return true;
  if(/\bnear\b/i.test(raw) && /\b(?:arrive|check in|check out|transit|transfer)\b/i.test(raw))return true;
  if(/\bfrom\b.+\bto\b/i.test(raw) && /\b(?:breakfast|lunch|dinner|transit|transfer|approx\.?)\b/i.test(raw))return true;
  return false;
}

function isManufacturedMealName(name,destination){
  var raw=String(name||"").trim().toLowerCase();
  var dest=String(destination||"").trim().toLowerCase();
  var rawNorm=normalizeMealText(raw);
  var destNorm=normalizeMealText(dest);
  if(!raw)return false;
  if(isRouteInstructionMealText(raw))return true;
  if(MANUFACTURED_MEAL_SUFFIXES.some(function(suffix){
    var suffixNorm=normalizeMealText(suffix);
    return rawNorm===suffixNorm || (destNorm && rawNorm===((destNorm+" "+suffixNorm).trim()));
  }))return true;
  if(destNorm && rawNorm.indexOf(destNorm+" ")===0){
    var remainder=rawNorm.slice(destNorm.length).trim();
    if(!remainder)return false;
    var tokens=remainder.split(/\s+/).filter(Boolean);
    var hasGeneric=tokens.some(function(token){return MANUFACTURED_MEAL_GENERIC_WORDS.indexOf(token)>=0;});
    var significant=tokens.filter(function(token){
      return MANUFACTURED_MEAL_GENERIC_WORDS.indexOf(token)<0 &&
        MANUFACTURED_MEAL_DESCRIPTOR_WORDS.indexOf(token)<0 &&
        MANUFACTURED_MEAL_CONNECTOR_WORDS.indexOf(token)<0;
    });
    var hasDescriptor=tokens.some(function(token){return MANUFACTURED_MEAL_DESCRIPTOR_WORDS.indexOf(token)>=0;});
    if(significant.length===0 && (hasGeneric || hasDescriptor))return true;
  }
  var allTokens=rawNorm.split(/\s+/).filter(Boolean);
  if(allTokens.length>=3 && allTokens.length<=7){
    var hasGenericWord=allTokens.some(function(token){return MANUFACTURED_MEAL_GENERIC_WORDS.indexOf(token)>=0;});
    var hasDescriptorWord=allTokens.some(function(token){return MANUFACTURED_MEAL_DESCRIPTOR_WORDS.indexOf(token)>=0;});
    var destTokens=destNorm?destNorm.split(/\s+/).filter(Boolean):[];
    var nonPatternTokens=allTokens.filter(function(token){
      return MANUFACTURED_MEAL_GENERIC_WORDS.indexOf(token)<0 &&
        MANUFACTURED_MEAL_DESCRIPTOR_WORDS.indexOf(token)<0 &&
        MANUFACTURED_MEAL_CONNECTOR_WORDS.indexOf(token)<0 &&
        destTokens.indexOf(token)<0;
    });
    if(hasDescriptorWord && nonPatternTokens.length<=2 && (hasGenericWord || destTokens.length>0))return true;
  }
  return false;
}

function isAreaGuidanceMealOption(option,destination){
  var tags=Array.isArray(option&&option.tags)?option.tags.map(function(t){return String(t||"").toLowerCase();}):[];
  var cuisine=String(option&&option.cuisine||"").toLowerCase();
  var note=String(option&&option.note||"").toLowerCase();
  return tags.indexOf("area-guidance")>=0 ||
    cuisine==="area guidance" ||
    note.indexOf("area guidance only")>=0 ||
    isManufacturedMealName(option&&option.name,destination);
}

function hasRealMealOption(options,destination){
  return (Array.isArray(options)?options:[]).some(function(opt){
    return !isAreaGuidanceMealOption(opt,destination);
  });
}

function mealTimeForType(type){
  var t=String(type||"meal").toLowerCase();
  if(t==="breakfast")return "08:00";
  if(t==="lunch")return "13:00";
  if(t==="dinner")return "19:00";
  return "";
}

export function normalizeDiningPlan(rows){
  var list=Array.isArray(rows)?rows:[];
  return list.map(function(day,dayIndex){
    var destination=String(day&&day.destination||"City").trim()||"City";
    var anchor=mealAreaLabel(destination,String(day&&day.anchor||day&&day.locationLabel||"").trim());
    var mealsIn=Array.isArray(day&&day.meals)?day.meals:[];
    var mealsOut=mealsIn.map(function(meal,mealIndex){
      var type=String(meal&&meal.type||"Meal").trim()||"Meal";
      var anchorRole=normalizeMealAnchorRole(meal&&((meal.anchorRole!==undefined)?meal.anchorRole:meal.anchor_role),type);
      var anchorLabel=optionalMealAreaLabel(
        destination,
        String(
          meal&&(
            meal.anchorLabel||
            meal.anchor_label||
            meal.near_poi
          )||
          day&&day[
            anchorRole==="poi"?"lunchAnchorLabel":"stayAnchorLabel"
          ]||
          day&&day[
            anchorRole==="poi"?"lunch_anchor_label":"stay_anchor_label"
          ]||
          anchor||
          ""
        ).trim()
      ) || (anchorRole==="poi"?anchor:optionalMealAreaLabel(destination,String(day&&day.stayAnchorLabel||day&&day.stay_anchor_label||"").trim())||anchor);
      var guidanceVariants=mealGuidanceVariants(type,destination,anchorLabel,anchorRole);
      var spotlight=resolveMealSpotlight(destination,type,anchorLabel);
      var optionSeed=(Array.isArray(meal&&meal.options)&&meal.options.length?meal.options:[meal]).map(function(opt,optIndex){
        var rawName=String(opt&&opt.name||meal&&meal.name||guidanceVariants[Math.min(optIndex,guidanceVariants.length-1)].name).trim();
        var guidance=isAreaGuidanceMealOption(opt,destination) || isManufacturedMealName(rawName,destination);
        var guidanceVariant=guidanceVariants[Math.min(optIndex,guidanceVariants.length-1)];
        var optionAnchorRole=normalizeMealAnchorRole(opt&&((opt.anchorRole!==undefined)?opt.anchorRole:opt.anchor_role),type)||anchorRole;
        var optionAnchorLabel=optionalMealAreaLabel(destination,String(opt&&(
          opt.anchorLabel||
          opt.anchor_label||
          opt.near_poi
        )||anchorLabel||"").trim())||anchorLabel;
        return {
          option_id:String(opt&&opt.option_id||("meal-opt-"+dayIndex+"-"+mealIndex+"-"+optIndex)),
          name:guidance?guidanceVariant.name:rawName,
          city:String(opt&&opt.city||meal&&meal.city||destination).trim(),
          cuisine:guidance?"Area guidance":(String(opt&&opt.cuisine||meal&&meal.cuisine||"Local").trim()||"Local"),
          cost:guidance?0:(Number((opt&&opt.cost)!==undefined?opt.cost:(meal&&meal.cost)!==undefined?meal.cost:0)||0),
          rating:guidance?0:(Number((opt&&opt.rating)!==undefined?opt.rating:(meal&&meal.rating)!==undefined?meal.rating:(4.2+(optIndex*0.2)))||4.2),
          note:guidance?guidanceVariant.note:(String(opt&&opt.note||opt&&opt.near_poi||meal&&meal.note||"").trim()),
          travel_minutes:Number((opt&&opt.travel_minutes)!==undefined?opt.travel_minutes:(opt&&opt.travelMinutes)!==undefined?opt.travelMinutes:(meal&&meal.travelMinutes)!==undefined?meal.travelMinutes:0)||0,
          tags:guidance?["area-guidance",String(type||"meal").toLowerCase()]:(Array.isArray(opt&&opt.tags)?opt.tags:[]),
          anchorRole:optionAnchorRole,
          anchorLabel:optionAnchorLabel
        };
      });
      var options=optionSeed.slice();
      var optionsHaveReal=hasRealMealOption(options,destination);
      if(!optionsHaveReal){
        guidanceVariants.forEach(function(variant,variantIndex){
          if(options.length>=4)return;
          var candidateName=String(variant.name||"").trim();
          var exists=options.some(function(opt){
            return String(opt&&opt.name||"").trim().toLowerCase()===candidateName.toLowerCase();
          });
          if(exists)return;
          options.push({
            option_id:"meal-opt-"+dayIndex+"-"+mealIndex+"-fallback-"+variantIndex,
            name:candidateName,
            city:destination,
            cuisine:"Area guidance",
            cost:0,
            rating:0,
            note:String(variant.note||"").trim(),
            travel_minutes:Math.max(4,8+(variantIndex*4)),
            tags:["area-guidance",String(type||"meal").toLowerCase()],
            anchorRole:anchorRole,
            anchorLabel:anchorLabel
          });
        });
      }
      var selectedOpt=(meal&&meal.selectedOption!==undefined&&meal.selectedOption!==null)?Number(meal.selectedOption):0;
      if(!(selectedOpt>=0&&selectedOpt<options.length))selectedOpt=0;
      var requestedName=String(
        (options[selectedOpt]&&options[selectedOpt].name) ||
        (meal&&meal.name) ||
        ""
      ).trim();
      if(optionsHaveReal && isAreaGuidanceMealOption(options[selectedOpt],destination)){
        var firstRealIndex=options.findIndex(function(opt){
          return !isAreaGuidanceMealOption(opt,destination);
        });
        if(firstRealIndex>=0)selectedOpt=firstRealIndex;
      }else if(requestedName && isManufacturedMealName(requestedName,destination)){
        var groundedIndex=options.findIndex(function(opt){
          return isAreaGuidanceMealOption(opt,destination);
        });
        if(groundedIndex>=0)selectedOpt=groundedIndex;
      }
      var picked=options[selectedOpt]||options[0]||{};
      return {
        type:type,
        time:String(meal&&meal.time||mealTimeForType(type)).trim(),
        date:String(meal&&meal.date||day&&day.date||"").trim(),
        options:options,
        selectedOption:selectedOpt,
        name:String(picked.name||meal&&meal.name||"Restaurant").trim(),
        city:String(picked.city||meal&&meal.city||destination).trim(),
        cuisine:String(picked.cuisine||meal&&meal.cuisine||"Local").trim()||"Local",
        cost:Number((picked.cost!==undefined)?picked.cost:(meal&&meal.cost)!==undefined?meal.cost:0)||0,
        rating:isAreaGuidanceMealOption(picked,destination)?0:(Number((picked.rating!==undefined)?picked.rating:(meal&&meal.rating)!==undefined?meal.rating:4.4)||4.4),
        dietaryOk:typeof (meal&&meal.dietaryOk)==="boolean"?meal.dietaryOk:true,
        note:String(picked.note||meal&&meal.note||"").trim(),
        travelMinutes:Number((picked.travel_minutes!==undefined)?picked.travel_minutes:(meal&&meal.travelMinutes)!==undefined?meal.travelMinutes:0)||0,
        anchorRole:normalizeMealAnchorRole(picked&&picked.anchorRole, type),
        anchorLabel:optionalMealAreaLabel(destination,String(picked&&picked.anchorLabel||meal&&meal.anchorLabel||anchorLabel||"").trim())||anchorLabel,
        focusDish:String(meal&&meal.focusDish||spotlight.dish||"").trim(),
        focusArea:String(meal&&meal.focusArea||spotlight.area||"").trim(),
        focusNote:String(meal&&meal.focusNote||spotlight.note||"").trim()
      };
    });
      var stayAnchorLabel=optionalMealAreaLabel(
        destination,
        String(
          day&&(
            day.stayAnchorLabel||
            day.stay_anchor_label
          )||
          ((mealsOut.find(function(entry){
            return normalizeMealAnchorRole(entry&&entry.anchorRole,entry&&entry.type)!=="poi" && cleanMealAnchorText(entry&&entry.anchorLabel);
          })||{}).anchorLabel)||
          ""
        ).trim()
      );
      var lunchAnchorLabel=optionalMealAreaLabel(
        destination,
        String(
          day&&(
            day.lunchAnchorLabel||
            day.lunch_anchor_label
          )||
          ((mealsOut.find(function(entry){
            return normalizeMealAnchorRole(entry&&entry.anchorRole,entry&&entry.type)==="poi" && cleanMealAnchorText(entry&&entry.anchorLabel);
          })||{}).anchorLabel)||
          ""
        ).trim()
      );
      return {
        day:Number(day&&day.day||dayIndex+1)||dayIndex+1,
        date:String(day&&day.date||"").trim(),
        destination:destination,
        anchor:anchor,
        locationLabel:String(day&&day.locationLabel||destination).trim()||destination,
        stayAnchorLabel:stayAnchorLabel,
        lunchAnchorLabel:lunchAnchorLabel,
        meals:mealsOut
      };
  });
}

function mealTypeSortValue(type){
  var low=String(type||"").trim().toLowerCase();
  if(low==="breakfast")return 0;
  if(low==="lunch")return 1;
  if(low==="dinner")return 2;
  return 3;
}

function canonicalDestinationMealKey(value){
  return String(value||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"");
}

var DESTINATION_MEAL_SPOTLIGHTS={
  trimbakeshwar:{
    Breakfast:{dish:"Poha and chai",area:"Kushavarta Kund area",note:"Keep breakfast light before the temple circuit."},
    Lunch:{dish:"Sabudana khichdi and thalipeeth",area:"Temple complex lanes",note:"Sattvic lunch works better around darshan hours."},
    Dinner:{dish:"Misal pav and solkadhi",area:"Town market side",note:"Classic Nashik-region flavors after evening rituals."}
  },
  vaidyanath:{
    Breakfast:{dish:"Litti chokha and chai",area:"Temple approach market",note:"A hearty start before morning temple queues."},
    Lunch:{dish:"Seasonal thali and dal-rice",area:"Deoghar local bazaar",note:"Simple regional lunch keeps the day steady."},
    Dinner:{dish:"Regional curry with rice",area:"Main bazaar side",note:"Pick cleaner, well-rated local kitchens for dinner."}
  },
  deoghar:{
    Breakfast:{dish:"Litti chokha and chai",area:"Basukinath corridor",note:"Traditional local breakfast before temple visits."},
    Lunch:{dish:"Jharkhand thali",area:"Clock tower market area",note:"Good midday option close to town attractions."},
    Dinner:{dish:"Regional curry and rice",area:"Deoghar market lanes",note:"Popular local dinner style with moderate spice."}
  },
  kedarnath:{
    Breakfast:{dish:"Aloo paratha and tea",area:"Mandir path",note:"Warm, simple carbs are better at altitude."},
    Lunch:{dish:"Dal-rice and vegetable curry",area:"Pilgrim food lines",note:"Prefer light sattvic meals in high-altitude weather."},
    Dinner:{dish:"Khichdi and soup",area:"Stay-side kitchens",note:"Keep dinner light for overnight acclimatization."}
  },
  rameswaram:{
    Breakfast:{dish:"Idli, pongal, and filter coffee",area:"Temple street",note:"Classic Tamil breakfast near morning darshan routes."},
    Lunch:{dish:"South Indian thali or seafood meal",area:"Seafront market side",note:"Best time to sample local coastal lunch plates."},
    Dinner:{dish:"Chettinad-style dinner or grilled seafood",area:"Harbor-side restaurants",note:"A strong destination for seafood-forward dinners."}
  }
};

function mealSpotlightFallback(destination, mealType, anchorLabel){
  var type=String(mealType||"Meal").trim().toLowerCase();
  var area=String(anchorLabel||destination||"town center").trim()||"town center";
  if(type==="breakfast"){
    return {dish:"Regional breakfast specialties",area:area,note:"Start near your morning route to reduce backtracking."};
  }
  if(type==="lunch"){
    return {dish:"Local thali and midday staples",area:area,note:"Choose lunch close to the main sightseeing stop."};
  }
  return {dish:"Signature regional dinner dishes",area:area,note:"Use dinner for destination-famous flavors near your stay."};
}

function resolveMealSpotlight(destination, mealType, anchorLabel){
  var key=canonicalDestinationMealKey(destination);
  var type=String(mealType||"Meal").trim();
  var byDestination=DESTINATION_MEAL_SPOTLIGHTS[key]||null;
  if(byDestination&&byDestination[type]){
    var row=byDestination[type];
    return {
      dish:String(row.dish||"").trim(),
      area:String(row.area||anchorLabel||destination||"").trim(),
      note:String(row.note||"").trim()
    };
  }
  return mealSpotlightFallback(destination,type,anchorLabel);
}

function mealOptionFitScore(option, spotlight){
  var text=[
    String(option&&option.name||""),
    String(option&&option.cuisine||""),
    String(option&&option.note||""),
    Array.isArray(option&&option.tags)?option.tags.join(" "):""
  ].join(" ").toLowerCase();
  var score=0;
  var dishTokens=String(spotlight&&spotlight.dish||"").toLowerCase().split(/[^a-z0-9]+/).filter(function(token){
    return token.length>3;
  });
  dishTokens.forEach(function(token){
    if(text.indexOf(token)>=0)score+=4;
  });
  var areaTokens=String(spotlight&&spotlight.area||"").toLowerCase().split(/[^a-z0-9]+/).filter(function(token){
    return token.length>3;
  });
  areaTokens.forEach(function(token){
    if(text.indexOf(token)>=0)score+=2;
  });
  score+=Number(option&&option.rating||0)*2;
  return score;
}

function sortMealOptionsForSpotlight(options, spotlight){
  var list=(Array.isArray(options)?options:[]).slice();
  return list.sort(function(a,b){
    var sb=mealOptionFitScore(b,spotlight);
    var sa=mealOptionFitScore(a,spotlight);
    if(sb!==sa)return sb-sa;
    return (Number(b&&b.rating||0)-Number(a&&a.rating||0));
  });
}

export function buildDiningRowsFromSuggestions(suggestions){
  var list=Array.isArray(suggestions)?suggestions:[];
  var byDay={};
  var ordered=[];
  list.forEach(function(s){
    var destination=String(s&&(
      s.destination||
      s.city||
      s.poi_city
    )||"City").trim()||"City";
    var dayNumber=Math.max(1,Number(s&&s.day||0)||0);
    var dayDate=String(s&&s.date||"").trim();
    var key=(dayDate?("date:"+dayDate):("day:"+String(dayNumber||ordered.length+1))).toLowerCase();
    if(!byDay[key]){
      byDay[key]={
        day:ordered.length+1,
        date:dayDate,
        destination:destination,
        anchor:"",
        locationLabel:"",
        stayAnchorLabel:"",
        lunchAnchorLabel:"",
        meals:[]
      };
      if(dayNumber>0)byDay[key].day=dayNumber;
      ordered.push(byDay[key]);
    }
    var row=byDay[key];
    if(!row.destination)row.destination=destination;
    var mealType=String(s&&s.meal||"Meal").trim()||"Meal";
    if(row.meals.some(function(existing){
      return String(existing&&existing.type||"").trim().toLowerCase()===mealType.toLowerCase();
    }))return;
    var anchorRole=normalizeMealAnchorRole(s&&((s.anchor_role!==undefined)?s.anchor_role:s.anchorRole),mealType);
    var anchorLabel=optionalMealAreaLabel(destination,String(s&&(
      s.anchor_label||
      s.anchorLabel||
      s.near_poi
    )||"").trim());
    var options=(Array.isArray(s&&s.options)&&s.options.length>0?s.options:[{
      option_id:s&&s.id||("meal-"+key.replace(/[^a-z0-9]+/gi,"-")+"-"+mealType.toLowerCase()),
      name:s&&s.name||"Restaurant",
      city:destination,
      cuisine:s&&s.cuisine||((s&&s.tags&&s.tags[0])||"Local"),
      cost:s&&s.cost||0,
      rating:Number((s&&s.rating!==undefined)?s.rating:4.5)||4.5,
      tags:s&&s.tags||[],
      near_poi:s&&s.near_poi||"",
      travel_minutes:s&&s.travel_from_poi_minutes||0,
      note:s&&s.note||"",
      anchorRole:anchorRole,
      anchorLabel:anchorLabel
     }]).map(function(o,oi){
      return {
        option_id:o.option_id||("opt-"+key.replace(/[^a-z0-9]+/gi,"-")+"-"+mealType.toLowerCase()+"-"+oi),
        name:o.name||"Restaurant",
        city:o.city||destination,
        cuisine:o.cuisine||((o.tags&&o.tags[0])||"Local"),
        cost:Number((o.cost!==undefined)?o.cost:0)||0,
        rating:Number((o.rating!==undefined)?o.rating:4.5)||4.5,
        tags:Array.isArray(o.tags)?o.tags:[],
        near_poi:o.near_poi||s.near_poi||"",
        travel_minutes:Number((o.travel_minutes!==undefined)?o.travel_minutes:0)||0,
        note:o.note||"",
        anchorRole:normalizeMealAnchorRole((o.anchorRole!==undefined)?o.anchorRole:o.anchor_role,mealType),
        anchorLabel:optionalMealAreaLabel(destination,String(o.anchorLabel||o.anchor_label||anchorLabel||o.near_poi||"").trim())||anchorLabel
     };
    });
    var realOnly=options.filter(function(opt){
      return !isAreaGuidanceMealOption(opt,destination) && !isManufacturedMealName(opt&&opt.name,destination);
    });
    if(realOnly.length>0)options=realOnly;
    var spotlight=resolveMealSpotlight(destination,mealType,anchorLabel||String(s&&s.near_poi||"").trim());
    var focusDish=String(s&&(s.focus_dish||s.focusDish)||spotlight.dish||"").trim();
    var focusArea=String(s&&(s.focus_area||s.focusArea)||spotlight.area||anchorLabel||"").trim();
    var focusNote=String(s&&(s.focus_note||s.focusNote)||spotlight.note||"").trim();
    options=sortMealOptionsForSpotlight(options,spotlight);
    var top=options[0]||{};
    row.meals.push({
      type:mealType,
      time:s&&s.time||"",
      date:dayDate,
      options:options,
      selectedOption:0,
      name:top.name||s&&s.name||"Restaurant",
      city:top.city||s&&s.city||"",
      cuisine:top.cuisine||((s&&s.tags&&s.tags[0])||"Local"),
      cost:Number((top.cost!==undefined)?top.cost:(s&&s.cost||0))||0,
      rating:Number((top.rating!==undefined)?top.rating:(s&&s.rating!==undefined)?s.rating:4.5)||4.5,
      dietaryOk:true,
      note:top.note||top.near_poi||s&&s.note||s&&s.near_poi||((s&&s.tags||[]).join(", ")),
      travelMinutes:Number((top.travel_minutes!==undefined)?top.travel_minutes:(s&&s.travel_from_poi_minutes||0))||0,
      anchorRole:anchorRole,
      anchorLabel:anchorLabel,
      focusDish:focusDish,
      focusArea:focusArea,
      focusNote:focusNote
    });
    if(anchorRole==="poi"){
      if(anchorLabel)row.lunchAnchorLabel=anchorLabel;
    }else if(anchorLabel){
      row.stayAnchorLabel=anchorLabel;
    }
  });
  ordered.forEach(function(row,idx){
    if(!(row.day>0))row.day=idx+1;
    row.locationLabel=(row.date?("Day "+row.day+" - "+row.date+" - "+row.destination):("Day "+row.day+" - "+row.destination));
    row.meals.sort(function(a,b){
      return mealTypeSortValue(a&&a.type)-mealTypeSortValue(b&&b.type);
    });
    row.anchor=row.lunchAnchorLabel||row.stayAnchorLabel||row.anchor||"";
  });
  return ordered;
}

async function askItinerary(destinations, acceptedPOIs, pickedStays, approvedMeals, budgetTier, days, groupSize, startDateIso) {
  var dNames = (destinations || []).map(function(d) { return d.name; });
  var destStr = dNames.join(", ") || "the destinations";
  var actList = (acceptedPOIs || []).map(function(p) { return p.name + " in " + (p.destination || ""); }).join(", ") || "sightseeing";
  var stayList = (pickedStays || []).map(function(s) { return s.name + " (" + (s.destination || "") + ")"; }).join(", ") || "hotel";
  var mealList = (approvedMeals || []).slice(0, 6).map(function(m) { return m.type + " at " + m.name; }).join(", ") || "local restaurants";
  var numDays = Math.max(1, Number(days || 5) || 5);
  var showDays = Math.min(numDays, 21);
  var startDate = String(startDateIso || "").trim().slice(0,10);
  var hasIsoStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  if(!hasIsoStart)startDate="";
  var dateRule = startDate
    ? ("Start date is " + startDate + ". Increment one day for each itinerary day.")
    : "Use Day 1, Day 2, etc. in the date field until exact travel dates are locked.";
  var sys = "Build a " + showDays + "-day travel itinerary. Return ONLY a JSON array. No markdown.\n\nFormat: [{\"day\":1,\"date\":\"YYYY-MM-DD or Day N\",\"destination\":\"City\",\"theme\":\"Theme\",\"items\":[{\"time\":\"09:00\",\"type\":\"activity\",\"title\":\"Name\",\"cost\":0}]}]\n\ntype must be one of: flight, checkin, checkout, activity, meal, travel, rest\nPlan " + showDays + " days for " + destStr + ".\n" + dateRule + "\nUse these activities: " + actList + "\nStays: " + stayList + "\nMeals: " + mealList + "\nRules:\n- breakfast is the first stop on every full day\n- place morning-friendly POIs after breakfast and before lunch\n- place afternoon/evening POIs after lunch and before dinner\n- use the hotel and lunch/dinner restaurants as routing anchors so POIs feel geographically grouped\n- include travel items with approximate minutes between the hotel, breakfast, POIs, lunch, dinner, and airport/rail transfers\n- do not push sunrise/garden/market/temple/viewpoint style POIs into late-afternoon if better in the morning\n- make sure approved POIs actually appear in the itinerary\n- do not use generic filler titles like \"Explore City\", \"Free time in City\", or \"Local sightseeing\" if a named approved POI, stay, or meal can be used instead\n- use the actual POI names, hotel names, and restaurant names in visible titles whenever possible\n- if one day is mainly travel, keep it honest and light rather than inventing extra sightseeing\n5-8 items per day. Day 1 starts with arrival. ONLY JSON array.";
  var msg = "Create " + showDays + "-day itinerary for " + (groupSize || 2) + " people visiting " + destStr + (startDate?(". Start on "+startDate+"."):"");
  var res = await callLLM(sys, msg, 1500);
  return Array.isArray(res) ? res : [];
}

function poiDayPartScore(poi, dayPart){
  var part=String(dayPart||"any").toLowerCase();
  var text=[
    String(poi&&poi.name||""),
    String(poi&&poi.category||""),
    Array.isArray(poi&&poi.tags)?poi.tags.join(" "):"",
    String(poi&&poi.matchReason||""),
    String(poi&&poi.locationHint||""),
    String(poi&&poi.bestTime||""),
    String(poi&&poi.openingWindow||"")
  ].join(" ").toLowerCase();
  var bestTime=String(poi&&poi.bestTime||"").trim().toLowerCase();
  var score=0;
  if(part==="morning"){
    if(bestTime==="morning")score+=7;
    if(bestTime==="evening")score-=6;
    if(/breakfast|brunch|nightlife|bar|club|cocktail|late/.test(text))score-=4;
    if(/sunrise|garden|market|temple|shrine|museum|lookout|viewpoint|park|walk|photo|photography|hike|trail|nature|culture/.test(text))score+=5;
    if(/beach|spa|shopping|food/.test(text))score+=1;
  }else if(part==="afternoon"){
    if(bestTime==="afternoon")score+=6;
    if(bestTime==="morning")score-=2;
    if(/sunrise|garden|temple|shrine|lookout|viewpoint|hike|trail|photography/.test(text))score-=4;
    if(/museum|gallery|market|food|shopping|culture|park|garden|harbor|waterfront|tour/.test(text))score+=3;
  }else if(part==="evening"){
    if(bestTime==="evening")score+=7;
    if(bestTime==="morning")score-=6;
    if(/sunrise|temple|shrine|museum|garden|market|lookout|viewpoint|hike|trail|photography|park/.test(text))score-=4;
    if(/night|sunset|bar|club|food|market|show|music|harbor|waterfront/.test(text))score+=4;
  }
  return score;
}

function routeAnchorLabel(kind, stay, meal){
  if(kind==="stay"&&stay&&stay.name)return stay.name;
  if(meal&&meal.name)return meal.name;
  if(stay&&stay.neighborhood)return stay.neighborhood;
  return "";
}

function poiLocationHint(poi){
  return String(poi&&(
    poi.locationHint||
    poi.location_hint||
    poi.near_poi||
    poi.neighborhood
  )||"").trim();
}

function poiRoutingLabel(poi){
  if(!poi)return "Local highlight";
  var poiName=String(poi&&poi.name||"").trim()||"Local highlight";
  var hint=poiLocationHint(poi);
  return hint?(poiName+" ("+hint+")"):poiName;
}

function formatPoiStop(poi, anchorLabel, prefix){
  if(!poi)return null;
  var poiName=cleanItineraryStopLabel(String(poi&&poi.name||"").trim()||"Local highlight");
  var hint=cleanItineraryStopLabel(poiLocationHint(poi));
  if(hint&&normalizeItineraryText(hint)!==normalizeItineraryText(poiName))return poiName+" in "+hint;
  return poiName;
}

function addClockMinutes(timeText, minutes){
  var text=String(timeText||"").trim();
  var match=text.match(/^(\d{1,2}):(\d{2})$/);
  if(!match)return text;
  var hours=Number(match[1]||0)||0;
  var mins=Number(match[2]||0)||0;
  var total=(hours*60)+mins+(Number(minutes)||0);
  if(total<0)total=0;
  var nextHours=Math.floor(total/60)%24;
  var nextMins=total%60;
  return String(nextHours).padStart(2,"0")+":"+String(nextMins).padStart(2,"0");
}

function routeTokens(text){
  return String(text||"").toLowerCase().split(/[^a-z0-9]+/).filter(function(token){
    return token&&token.length>2;
  });
}

function cleanItineraryStopLabel(value){
  var raw=String(value||"").replace(/\s+/g," ").trim();
  if(!raw)return "";
  var cleaned=raw;
  if(MEAL_TRANSIT_DURATION_REGEX.test(cleaned)&&/\bto\b/i.test(cleaned)){
    cleaned=cleaned.split(/\bto\b/i).pop();
  }
  if(/\bfrom\b.+\bto\b/i.test(cleaned)){
    cleaned=cleaned.split(/\bto\b/i).pop();
  }
  cleaned=cleaned
    .replace(/^(?:walk from breakfast to|continue to|head to|start with|see|arrive in|travel to|check in(?: at)?|check out(?: from)?|near)\s+/i,"")
    .replace(/\bvia\b.*$/i,"")
    .replace(/\s+/g," ")
    .trim();
  if(!cleaned)cleaned=raw;
  if(cleaned.length>72)cleaned=cleaned.slice(0,72).trim()+"...";
  return cleaned;
}

function estimateTransitMinutes(fromLabel, toLabel){
  var from=String(fromLabel||"").trim();
  var to=String(toLabel||"").trim();
  if(!from||!to)return 0;
  if(from.toLowerCase()===to.toLowerCase())return 0;
  var combined=(from+" "+to).toLowerCase();
  if(/airport|terminal/.test(combined))return 45;
  if(/station|harbor|ferry|port/.test(combined))return 30;
  var fromTokens=routeTokens(from);
  var toTokens=routeTokens(to);
  var shared=fromTokens.filter(function(token){return toTokens.indexOf(token)>=0;}).length;
  if(shared>=2)return 10;
  if(shared===1)return 15;
  return 25;
}

function buildTransitItem(timeText, fromLabel, toLabel){
  var from=cleanItineraryStopLabel(fromLabel);
  var to=cleanItineraryStopLabel(toLabel);
  if(!from||!to)return null;
  if(normalizeItineraryText(from)===normalizeItineraryText(to))return null;
  var minutes=estimateTransitMinutes(fromLabel,toLabel);
  if(!minutes)return null;
  return {
    time:String(timeText||"").trim()||"00:00",
    type:"travel",
    title:"Approx. "+minutes+" min transit from "+from+" to "+to,
    cost:0
  };
}

function materializeItineraryDates(rows, startDateIso){
  var start=String(startDateIso||"").trim().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return Array.isArray(rows)?rows:[];
  var changed=false;
  var mapped=(Array.isArray(rows)?rows:[]).map(function(day,idx){
    var nextDate=addIsoDays(start,idx);
    if(String(day&&day.date||"")!==nextDate)changed=true;
    return Object.assign({},day,{date:nextDate});
  });
  return changed?mapped:(Array.isArray(rows)?rows:[]);
}

function normalizeItineraryText(text){
  return String(text||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function itineraryRowsScore(rows, acceptedPOIs){
  var candidateRows=Array.isArray(rows)?rows:[];
  var pois=Array.isArray(acceptedPOIs)?acceptedPOIs:[];
  var seenPoiNames={};
  var poiHits=0;
  var travelCount=0;
  var genericActivityPenalty=0;
  candidateRows.forEach(function(day){
    (Array.isArray(day&&day.items)?day.items:[]).forEach(function(item){
      var title=normalizeItineraryText(item&&item.title);
      if(String(item&&item.type||"").toLowerCase()==="travel")travelCount+=1;
      if((String(item&&item.type||"").toLowerCase()==="activity"||String(item&&item.type||"").toLowerCase()==="rest")&&/^(explore|free time|last walk|settle in|flexible time)/.test(title)){
        genericActivityPenalty+=1;
      }
      pois.forEach(function(poi){
        var poiName=normalizeItineraryText(poi&&poi.name);
        if(!poiName||seenPoiNames[poiName])return;
        if(title.indexOf(poiName)>=0){
          seenPoiNames[poiName]=true;
          poiHits+=1;
        }
      });
    });
  });
  return {
    poiHits:poiHits,
    travelCount:travelCount,
    genericActivityPenalty:genericActivityPenalty,
    score:(poiHits*5)+(travelCount*1)-genericActivityPenalty
  };
}

function chooseBestItineraryRows(candidateRows, fallbackRows, acceptedPOIs){
  var candidateScore=itineraryRowsScore(candidateRows,acceptedPOIs);
  var fallbackScore=itineraryRowsScore(fallbackRows,acceptedPOIs);
  if(candidateScore.poiHits===0&&fallbackScore.poiHits>0)return Array.isArray(fallbackRows)?fallbackRows:[];
  if(candidateScore.travelCount===0&&fallbackScore.travelCount>0&&fallbackScore.poiHits>=candidateScore.poiHits)return Array.isArray(fallbackRows)?fallbackRows:[];
  if(fallbackScore.score>candidateScore.score)return Array.isArray(fallbackRows)?fallbackRows:[];
  return Array.isArray(candidateRows)?candidateRows:[];
}

function buildFallbackItinerary(destinations, acceptedPOIs, pickedStays, approvedMeals, totalTripDays, startDateIso, durationPerDestination){
  var destList=(Array.isArray(destinations)?destinations:[]).map(function(d){
    return typeof d==="string"?String(d||"").trim():String(d&&d.name||d&&d.destination||"").trim();
  }).filter(Boolean);
  if(destList.length===0)destList=["Trip"];
  var tripDays=Math.max(1,Number(totalTripDays)||destList.length||1);
  var resolvedDurations=fillMissingDurationPerDestination(destList,durationPerDestination,tripDays);
  var startDate=String(startDateIso||"").trim().slice(0,10);
  var hasIsoStart=/^\d{4}-\d{2}-\d{2}$/.test(startDate);
  var poisByDest={};
  (Array.isArray(acceptedPOIs)?acceptedPOIs:[]).forEach(function(p){
    var key=String(p&&p.destination||destList[0]||"Trip").trim()||"Trip";
    if(!poisByDest[key])poisByDest[key]=[];
    poisByDest[key].push(p);
  });
  var staysByDest={};
  (Array.isArray(pickedStays)?pickedStays:[]).forEach(function(stay){
    var key=String(stay&&stay.destination||destList[0]||"Trip").trim()||"Trip";
    if(!staysByDest[key])staysByDest[key]=[];
    staysByDest[key].push(stay);
  });
  var mealsByDest={};
  (Array.isArray(approvedMeals)?approvedMeals:[]).forEach(function(meal){
    var key=String(meal&&meal.destination||destList[0]||"Trip").trim()||"Trip";
    if(!mealsByDest[key])mealsByDest[key]=[];
    mealsByDest[key].push(meal);
  });
  var mealCursor={};
  function nextPoi(dest, dayPart, usedToday){
    var list=poisByDest[dest]||[];
    if(list.length===0)return null;
    var best=null;
    list.forEach(function(poi,idx){
      var score=poiDayPartScore(poi,dayPart);
      if((dayPart==="afternoon"||dayPart==="evening")&&score<=0)return;
      var entry={poi:poi,idx:idx,score:score};
      var key=normalizeItineraryText(entry&&entry.poi&&entry.poi.name||("poi-"+entry.idx));
      if(usedToday&&usedToday[key])return;
      if(!best||entry.score>best.score||(entry.score===best.score&&entry.idx<best.idx)){
        best=entry;
      }
    });
    if(!best)return null;
    var bestKey=normalizeItineraryText(best&&best.poi&&best.poi.name||("poi-"+best.idx));
    if(usedToday)usedToday[bestKey]=1;
    return best.poi;
  }
  function nextMeal(dest, fallbackType){
    var list=mealsByDest[dest]||[];
    if(list.length===0)return null;
    var preferred=list.find(function(meal,idx){
      if(String(meal&&meal.type||"").toLowerCase()!==String(fallbackType||"").toLowerCase())return false;
      if((mealCursor[dest]||0)>idx)return false;
      mealCursor[dest]=idx+1;
      return true;
    });
    if(preferred)return preferred;
    var idx=Number(mealCursor[dest]||0)%list.length;
    mealCursor[dest]=idx+1;
    return list[idx];
  }
  function mealStopTitle(type, meal, destination){
    var mealType=String(type||meal&&meal.type||"Meal").trim()||"Meal";
    var dest=String(destination||"").trim()||"destination";
    var name=cleanItineraryStopLabel(String(meal&&meal.name||"").trim());
    if(name&&!isRouteInstructionMealText(name)&&!isManufacturedMealName(name,dest)){
      return name;
    }
    var area=mealAreaLabel(dest,String(meal&&(
      meal.anchorLabel||
      meal.focusArea||
      meal.city
    )||"").trim());
    if(area&&normalizeMealText(area)!==normalizeMealText(dest)){
      return mealType+" near "+area;
    }
    return mealType+" in "+dest;
  }
  var planDays=[];
  destList.forEach(function(dest,idx){
    var stayDays=Math.max(1,Number(resolvedDurations[dest])||1);
    if(idx>0)planDays.push({destination:dest,kind:"travel"});
    for(var i=0;i<stayDays;i++)planDays.push({destination:dest,kind:"stay",stayIndex:i});
  });
  planDays.push({destination:destList[destList.length-1],kind:"buffer"});
  while(planDays.length<tripDays){
    planDays.push({destination:destList[destList.length-1],kind:"buffer"});
  }
  if(planDays.length>tripDays)planDays=planDays.slice(0,tripDays);
  return planDays.map(function(entry,idx){
    var dayNum=idx+1;
    var dest=entry.destination||destList[0]||"Trip";
    var stay=(staysByDest[dest]&&staysByDest[dest][0])||null;
    var usedPoiToday={};
    var breakfast=nextMeal(dest,"breakfast");
    var lunch=nextMeal(dest,"lunch");
    var dinner=nextMeal(dest,"dinner");
    var actMorning=nextPoi(dest,"morning",usedPoiToday);
    var actAfternoon=nextPoi(dest,"afternoon",usedPoiToday);
    var actEvening=nextPoi(dest,"evening",usedPoiToday);
    var stayLabel=cleanItineraryStopLabel((stay&&stay.name)||((stay&&stay.neighborhood)?(stay.neighborhood+" stay"):("Stay in "+dest)));
    var breakfastLabel=mealStopTitle("Breakfast",breakfast,dest);
    var lunchLabel=mealStopTitle("Lunch",lunch,dest);
    var dinnerLabel=mealStopTitle("Dinner",dinner,dest);
    function pushTransit(timeText, fromLabel, toLabel){
      var leg=buildTransitItem(timeText,fromLabel,toLabel);
      if(leg)items.push(leg);
    }
    var items=[];
    if(entry.kind==="travel"){
      items.push({time:"09:00",type:"checkout",title:"Check out and depart previous city",cost:0});
      items.push({time:"11:30",type:"travel",title:"Travel to "+dest,cost:0});
      items.push({time:"15:00",type:"checkin",title:"Check in"+(stay&&stay.name?(" at "+stay.name):""),cost:0});
      if(actEvening){
        pushTransit("16:00",stayLabel,poiRoutingLabel(actEvening));
        items.push({time:"16:30",type:"activity",title:formatPoiStop(actEvening,routeAnchorLabel("stay",stay,dinner),"Ease into"),cost:Number(actEvening&&actEvening.cost||0)||0});
      }
      pushTransit("18:00",actEvening?poiRoutingLabel(actEvening):stayLabel,dinnerLabel);
      items.push({time:"18:30",type:"meal",title:dinnerLabel,cost:Number(dinner&&dinner.cost||30)||30});
      pushTransit("20:00",dinnerLabel,stayLabel);
    }else if(entry.kind==="buffer"){
      items.push({time:"09:00",type:"meal",title:breakfastLabel,cost:Number(breakfast&&breakfast.cost||20)||20});
      if(actMorning){
        pushTransit("09:35",breakfastLabel,poiRoutingLabel(actMorning));
        items.push({time:"10:15",type:"activity",title:formatPoiStop(actMorning,routeAnchorLabel("stay",stay,breakfast),"Walk from breakfast to"),cost:Number(actMorning&&actMorning.cost||0)||0});
      }else{
        items.push({time:"11:00",type:"rest",title:"Flexible time around "+stayLabel,cost:0});
      }
      if(lunch){
        pushTransit("12:30",actMorning?poiRoutingLabel(actMorning):stayLabel,lunchLabel);
        items.push({time:"13:00",type:"meal",title:lunchLabel,cost:Number(lunch&&lunch.cost||25)||25});
      }
      pushTransit("14:00",lunchLabel,actAfternoon?poiRoutingLabel(actAfternoon):stayLabel);
      items.push({time:"14:30",type:(actAfternoon?"activity":"rest"),title:actAfternoon?formatPoiStop(actAfternoon,routeAnchorLabel("meal",stay,lunch||dinner),"Continue to"):("Last walk around "+dest),cost:Number(actAfternoon&&actAfternoon.cost||0)||0});
      pushTransit("18:15",actAfternoon?poiRoutingLabel(actAfternoon):stayLabel,dinnerLabel);
      items.push({time:"19:00",type:"meal",title:dinnerLabel,cost:Number(dinner&&dinner.cost||40)||40});
      pushTransit("20:15",dinnerLabel,stayLabel);
    }else{
      if(dayNum===1){
        items.push({time:"09:00",type:"flight",title:"Arrive in "+dest,cost:0});
        items.push({time:"11:00",type:"checkin",title:"Check in"+(stay&&stay.name?(" at "+stay.name):""),cost:0});
        items.push({time:"12:30",type:"meal",title:lunchLabel,cost:Number(lunch&&lunch.cost||25)||25});
        if(actAfternoon){
          pushTransit("13:20",lunchLabel,poiRoutingLabel(actAfternoon));
          items.push({time:"14:00",type:"activity",title:formatPoiStop(actAfternoon,routeAnchorLabel("stay",stay,lunch),"Start with"),cost:Number(actAfternoon&&actAfternoon.cost||0)||0});
        }
      }else{
        items.push({time:"08:30",type:"meal",title:breakfastLabel,cost:Number(breakfast&&breakfast.cost||18)||18});
        if(actMorning){
          pushTransit("09:15",breakfastLabel,poiRoutingLabel(actMorning));
          items.push({time:"10:00",type:"activity",title:formatPoiStop(actMorning,routeAnchorLabel("meal",stay,breakfast),"Walk from breakfast to"),cost:Number(actMorning&&actMorning.cost||0)||0});
        }
      }
      if(dayNum===1&&!actAfternoon){
        items.push({time:"13:00",type:"rest",title:"Settle in around "+stayLabel,cost:0});
      }else if(dayNum!==1){
        pushTransit("12:20",actMorning?poiRoutingLabel(actMorning):stayLabel,lunchLabel);
        items.push({time:"13:00",type:"meal",title:lunchLabel,cost:Number(lunch&&lunch.cost||25)||25});
      }
      pushTransit("14:50",lunchLabel,actAfternoon?poiRoutingLabel(actAfternoon):stayLabel);
      items.push({time:"15:30",type:(actAfternoon?"activity":"rest"),title:actAfternoon?formatPoiStop(actAfternoon,routeAnchorLabel("meal",stay,lunch),"Head to"):("Free time near "+stayLabel),cost:Number(actAfternoon&&actAfternoon.cost||0)||0});
      if(actEvening){
        pushTransit("17:10",actAfternoon?poiRoutingLabel(actAfternoon):stayLabel,poiRoutingLabel(actEvening));
        items.push({time:"17:30",type:"activity",title:formatPoiStop(actEvening,routeAnchorLabel("meal",stay,dinner),"See"),cost:Number(actEvening&&actEvening.cost||0)||0});
      }
      pushTransit("18:25",actEvening?poiRoutingLabel(actEvening):(actAfternoon?poiRoutingLabel(actAfternoon):stayLabel),dinnerLabel);
      items.push({time:"19:00",type:"meal",title:dinnerLabel,cost:Number(dinner&&dinner.cost||35)||35});
      pushTransit("20:15",dinnerLabel,stayLabel);
    }
    return {
      day:dayNum,
      date:hasIsoStart?addIsoDays(startDate,idx):("Day "+dayNum),
      destination:dest,
      theme:entry.kind==="travel"?"Travel day":(entry.kind==="buffer"?"Flexible day":"Explore "+dest),
      items:items
    };
  });
}


function buildItinerarySavePayload(rows){
  return {
    days:(Array.isArray(rows)?rows:[]).map(function(day,idx){
      return {
        day:Math.max(1,Number(day&&day.day||idx+1)||idx+1),
        date:String(day&&day.date||"").trim(),
        destination:String(day&&day.destination||"").trim(),
        theme:String(day&&day.theme||"").trim(),
        items:(Array.isArray(day&&day.items)?day.items:[]).map(function(item){
          return {
            time:String(item&&item.time||"").trim(),
            type:String(item&&item.type||"activity").trim(),
            title:String(item&&item.title||"").trim(),
            cost:Number(item&&item.cost||0)||0
          };
        }).filter(function(item){return !!item.title;})
      };
    }).filter(function(day){return day.items.length>0;})
  };
}


export default function WanderPlan(){
  var[sc,setSc]=useState("landing");
  var[fade,setFade]=useState(false);
  var[hist,setHist]=useState([]);
  var[loaded,setLd]=useState(false);
  var[authToken,setAT]=useState("");
  var[authMode,setAuthMode]=useState("signin");
  var[signinPass,setSigninPass]=useState("");
  var[resetPass,setResetPass]=useState("");
  var[rememberCreds,setRememberCreds]=useState(false);
  var[signinLoad,setSigninLoad]=useState(false);
  var[vpW,setVpW]=useState(typeof window!=="undefined"&&window.innerWidth?window.innerWidth:1024);
  var[profileHydrated,setPH]=useState(false);
  var[authErr,setAE]=useState("");
  var[authInfo,setAI]=useState("");
  var[wizSessionId,setWSID]=useState("");
  var[currentTripId,setCTID]=useState("");
  var[crewMsg,setCM]=useState("");
  var[crewInviteLink,setCIL]=useState("");
  var[crewInviteCopyMsg,setCICM]=useState("");
  var[tripInviteMsg,setTIM]=useState("");
  var[tripShareMsg,setTSM]=useState("");
  var[tripInviteLinks,setTIL]=useState({});
  var[showVoteDebug,setSVD]=useState(readVoteDebugFlagFromUrl());
  var[pendingInviteToken,setPIT]=useState("");
  var[pendingInviteAction,setPIA]=useState("accept");
  var[pendingTripJoinId,setPTJ]=useState("");
  var[pendingTripJoinAction,setPTJA]=useState("");
  var[user,setUser]=useState(emptyUserState());
  var[crew,setCrew]=useState([]);
  var[bucket,setBucket]=useState([]);
  var[trips,setTrips]=useState([]);
  var[newTrip,setNT]=useState({name:"",dests:[],members:[],step:0});
  var[newTripDestInput,setNTDI]=useState("");
  var[tripDestSearchLoad,setTDSL]=useState(false);
  var[destinationMsg,setDSM]=useState("");
  var[tripFilter,setTF]=useState("all");
  var[viewTrip,setVT]=useState(null);
  var[deletedSeedTripIds,setDeletedSeedTripIds]=useState({});
  var[wizStep,setWS]=useState(0);
  var[profileDebug,setProfileDebug]=useState({lastGet:null,lastPut:null,lastPutResult:null,tripProfiles:null});
  var[blChat,setBC]=useState([{from:"agent",text:"Tell me a place you dream of visiting! Be as vague or specific as you like."}]);
  var[blIn,setBLI]=useState("");
  var[blLoad,setBLL]=useState(false);
  var[bucketMsg,setBM]=useState("");
  var[invEmail,setIE]=useState("");
  var chatRef=useRef(null);
  var blInFlightRef=useRef(false);
  var inviteAcceptSeenRef=useRef({});
  var tripInviteAttemptRef=useRef({});
  var tripInviteInFlightRef=useRef(false);
  var inviteTripFilterAppliedRef=useRef(false);
  var planningStateUpdatedAtRef=useRef("");
  var airportResolveCacheRef=useRef({});
  var autoTripAcceptRef=useRef({});
  var poiAutoGenerateRef=useRef({});
  var durationDraftSaveTimerRef=useRef(null);
  var mealDraftSaveTimerRef=useRef(null);
  var pendingWizardStepPersistRef=useRef(null);
  var wizardStepPersistRetryRef=useRef(null);
  // Wizard interaction states
  var[destMemberVotes,setDMV]=useState({});
  var[tripJoined,setTJ]=useState({});
  var[grpInts,setGI]=useState({});
  var[timingOk,setTO]=useState(false);
  var[healthOk,setHO]=useState(false);
  var[routePlan,setRoutePlan]=useState(null);
  var[routePlanLoad,setRPL]=useState(false);
  var[routePlanSaveLoad,setRPSL]=useState(false);
  var[routePlanDone,setRPD]=useState(false);
  var[routePlanErr,setRPE]=useState("");
  var[routePlanSignature,setRPS]=useState("");
  var[pois,setPois]=useState([]);
  var[poiLoad,setPL]=useState(false);
  var[poiDone,setPD]=useState(false);
  var[poiStatus,setPS]=useState({});
  var[poiVotes,setPV]=useState({});
  var[poiMemberChoices,setPMC]=useState({});
  var[poiOptionPool,setPOP]=useState({});
  var[poiGenStatus,setPGS]=useState({phase:"idle",currentBatch:0,batchCount:0,activeDestinations:[],completedDestinations:[],timedOutDestinations:[],emptyDestinations:[],failedDestinations:[],parseFailedDestinations:[],fallbackDestinations:[],destinationErrors:{},backendSync:"idle"});
  var[poiRequestSignature,setPoiRequestSignature]=useState("");
  var[poiAsk,setPA]=useState("");
  var[poiAskLoad,setPAL]=useState(false);
  var[flightDates,setFD]=useState({origin:"",depart:"",arrive:"",ret:"",final_airport:""});
  var[flightLegInputs,setFLI]=useState([]);
  var[flightLegs,setFLegs]=useState([]);
  var[flightSel,setFSel]=useState({});
  var[flightLoad,setFLoad]=useState(false);
  var[flightDone,setFDone]=useState(false);
  var[flightErr,setFErr]=useState("");
  var[flightConfirmLoad,setFCL]=useState(false);
  var[flightConfirmed,setFC]=useState(false);
  var[flightBookLinks,setFBL]=useState([]);
  var[budgetSaveLoad,setBSL]=useState(false);
  var[budgetSaveErr,setBSE]=useState("");
  var[sharedBudgetTier,setSBT]=useState("");
  var[consensusMsg,setCSM]=useState("");
  var[durPerDest,setDPD]=useState({});
  var[sharedDurationDays,setSDD]=useState(0);
  var[sharedDurationSignature,setSDSig]=useState("");
  var[availabilityDraft,setADraft]=useState({start:"",end:""});
  var[availabilityData,setAData]=useState(null);
  var[availabilityErr,setAErr]=useState("");
  var[availabilityLoad,setALoad]=useState(false);
  var[stays,setStays]=useState([]);
  var[stayVotes,setStayVotes]=useState({});
  var[stayFinalChoices,setSFC]=useState({});
  var[stayLoad,setSL]=useState(false);
  var[stayDone,setSD]=useState(false);
  var[stayPick,setStayPick]=useState({});
  var[stayPreview,setStayPreview]=useState(null);
  var[stayAsk,setSA]=useState("");
  var[stayAskLoad,setSAL]=useState(false);
  var[stayChat,setSChat]=useState([]);
  var[meals,setMeals]=useState([]);
  var[mealVotes,setMealVotes]=useState({});
  var[mealLoad,setML]=useState(false);
  var[mealDone,setMD]=useState(false);
  var[mealErr,setMealErr]=useState("");
  var[mealAsk,setMA]=useState("");
  var[mealAskLoad,setMAL]=useState(false);
  var[mealChat,setMChat]=useState([]);
  var[itin,setItin]=useState([]);
  var[itinLoad,setIL]=useState(false);
  var[itinDone,setID]=useState(false);
  var[itinErr,setItinErr]=useState("");
  var[companionData,setCompanionData]=useState(null);
  var[companionLoad,setCompanionLoad]=useState(false);
  var[companionErr,setCompanionErr]=useState("");
  var[companionRefreshLoad,setCompanionRefreshLoad]=useState(false);
  var[companionRefreshStamp,setCompanionRefreshStamp]=useState("");
  var[companionActionLoad,setCompanionActionLoad]=useState(false);
  var[receiptText,setReceiptText]=useState("");
  var[receiptImage,setReceiptImage]=useState({name:"",mediaType:"",base64:""});
  var[receiptParse,setReceiptParse]=useState(null);
  var[receiptLoad,setReceiptLoad]=useState(false);
  var[receiptSaveLoad,setReceiptSaveLoad]=useState(false);
  var[receiptMsg,setReceiptMsg]=useState("");
  var[expensePaidBy,setExpensePaidBy]=useState("");
  var[expenseSplitWith,setExpenseSplitWith]=useState([]);
  var[manualExpensePaidBy,setManualExpensePaidBy]=useState("");
  var[manualExpenseSplitWith,setManualExpenseSplitWith]=useState([]);
  var[manualExpense,setManualExpense]=useState({merchant:"",amount:"",category:"dining",note:"",date:""});
  useEffect(function(){
    if(sc!=="companion")return;
    var comp=(companionData&&typeof companionData==="object")?companionData:{};
    var tripMembers=(Array.isArray(comp.members)&&comp.members.length>0)?comp.members:(Array.isArray(viewTrip&&viewTrip.members)?viewTrip.members:[]);
    var currentId=String(userIdFromToken(authToken)||"").trim()||makeVoteUserId(user);
    var defaults=defaultExpenseSplitMemberIds(tripMembers,currentId);
    if(currentId&&!expensePaidBy)setExpensePaidBy(currentId);
    if(defaults.length>0&&(!Array.isArray(expenseSplitWith)||expenseSplitWith.length===0))setExpenseSplitWith(defaults);
    if(currentId&&!manualExpensePaidBy)setManualExpensePaidBy(currentId);
    if(currentId&&(!Array.isArray(manualExpenseSplitWith)||manualExpenseSplitWith.length===0))setManualExpenseSplitWith([currentId]);
  },[sc,companionData,viewTrip,authToken,user,expensePaidBy,expenseSplitWith,manualExpensePaidBy,manualExpenseSplitWith]);
  var flightPlannerDests=(function(){
    var tripCtx=(newTrip&&typeof newTrip==="object")?newTrip:{};
    var tripDestInputs=(Array.isArray(tripCtx.dests)&&tripCtx.dests.length)
      ? tripCtx.dests
      : String(tripCtx.destNames||"").split("+").map(function(s){return String(s||"").trim();}).filter(Boolean);
    return tripDestInputs.map(function(v,idx){
      var raw=String(v||"").trim();
      if(!raw)return null;
      var byId=bucket.find(function(b){return b.id===raw;});
      if(byId)return byId;
      var byName=bucket.find(function(b){return String(b&&b.name||"").trim().toLowerCase()===raw.toLowerCase();});
      if(byName)return byName;
      return {id:"flight-dest-"+idx,name:raw};
    }).filter(Boolean);
  }());
  var effectiveDurPerDest=fillMissingDurationPerDestination(
    flightPlannerDests,
    durPerDest,
    sharedDurationDays||inclusiveIsoDays(flightDates.depart,flightDates.ret)
  );
  var wizardPoiDests=(function(){
    var vals=(newTrip&&Array.isArray(newTrip.dests))?newTrip.dests:[];
    return vals.map(function(v,idx){
      var raw=String(v||"").trim();
      if(!raw)return null;
      var byId=bucket.find(function(b){return b.id===raw;});
      if(byId)return byId;
      var byName=bucket.find(function(b){return String(b&&b.name||"").trim().toLowerCase()===raw.toLowerCase();});
      if(byName)return byName;
      return {id:"poi-dest-"+idx,name:raw};
    }).filter(Boolean);
  }());
  var effectiveTripBudgetTierGlobal=resolveTripBudgetTier(sharedBudgetTier,user.budget);
  var wizardPoiGroupPrefs=buildPOIGroupPrefsFromCrew((newTrip&&newTrip.members)||[]);
  var routePlanCurrentSignatureGlobal=buildRoutePlanSignature(wizardPoiDests,user.interests||{},effectiveTripBudgetTierGlobal,user.dietary,user.styles||[],wizardPoiGroupPrefs);
  var routePlanContextStaleGlobal=!!(
    routePlan&&
    routePlanSignature&&
    routePlanSignature!==routePlanCurrentSignatureGlobal
  );
  var mergedPoiRowsGlobal=mergePoiListsByCanonical(pois,poiOptionPool);
  var poiCurrentSignatureGlobal=buildPoiRequestSignature(wizardPoiDests,user.interests||{},effectiveTripBudgetTierGlobal,user.dietary,wizardPoiGroupPrefs,routePlanSignature);
  var poiContextStaleGlobal=poiListNeedsRefresh(poiRequestSignature,poiCurrentSignatureGlobal,mergedPoiRowsGlobal,wizardPoiDests);

  useEffect(function(){(async function(){
    var inviteTokenInUrl="";
    var inviteActionInUrl="accept";
    try{
      inviteTokenInUrl=readInviteTokenFromUrl();
      inviteActionInUrl=readInviteActionFromUrl();
      if(inviteTokenInUrl)setPIT(inviteTokenInUrl);
      setPIA(inviteActionInUrl);
    }catch(e){}
    try{
      var tripIdInUrl=readJoinTripIdFromUrl();
      if(tripIdInUrl){
        var tripActionInUrl=readTripInviteActionFromUrl();
        setPTJ(tripIdInUrl);
        setPTJA(tripActionInUrl);
        setCM(tripActionInUrl==="reject"?"Trip invitation detected. Sign in to reject this trip invite.":"Trip invitation detected. Sign in to review this trip invite.");
      }
    }catch(e){}
    var savedCreds=await ld("wp-login-creds",null);
    if(savedCreds&&savedCreds.remember){
      setRememberCreds(true);
      setUser(function(p){return Object.assign({},p,{email:savedCreds.email||p.email});});
      if(savedCreds.password)setSigninPass(savedCreds.password);
    }
    var tok=await ld("wp-auth","");if(tok)setAT(tok);
    var accountEmail=String(savedCreds&&savedCreds.email||"").trim().toLowerCase();
    var u=await ldAccount("wp-u",tok,accountEmail,null);if(u)setUser(Object.assign(emptyUserState(),u));
    var c=await ldAccount("wp-c",tok,accountEmail,null);if(c)setCrew(sanitizeCrewMembers(c));
    var b=await ldAccount("wp-b",tok,accountEmail,null);if(b)setBucket(b);
    var t=await ldAccount("wp-t",tok,accountEmail,null);if(t)setTrips(t);
    var ch=await ld("wp-ch",null);if(ch&&ch.length>1)setBC(ch);
    setLd(true);
    if(tok){
      try{
        await acceptPendingInvite(tok,inviteTokenInUrl,inviteActionInUrl);
      }catch(e){}
      try{
        await hydrateSignedInSession(tok,{baseUser:u||Object.assign(emptyUserState(),{email:accountEmail})});
      }catch(e){}
      setSc("dash");
    }
  })();},[]);
  useEffect(function(){if(loaded)svAccount("wp-u",authToken,user.email,user);},[user,loaded,authToken]);
  useEffect(function(){if(loaded){if(rememberCreds)sv("wp-auth",authToken||"");else sv("wp-auth","");}},[authToken,loaded,rememberCreds]);
  useEffect(function(){if(loaded)svAccount("wp-c",authToken,user.email,sanitizeCrewMembers(crew));},[crew,loaded,authToken,user.email]);
  useEffect(function(){if(loaded)svAccount("wp-b",authToken,user.email,bucket);},[bucket,loaded,authToken,user.email]);
  useEffect(function(){if(loaded)svAccount("wp-t",authToken,user.email,trips);},[trips,loaded,authToken,user.email]);
  useEffect(function(){if(loaded&&blChat.length>1)sv("wp-ch",blChat);},[blChat,loaded]);
  useEffect(function(){if(chatRef.current&&typeof chatRef.current.scrollIntoView==="function")chatRef.current.scrollIntoView({behavior:"smooth"});},[blChat]);
  useEffect(function(){if(sc==="new_trip"){setTIM("");setTIL({});}},[sc]);
  useEffect(function(){
    if(typeof window==="undefined")return;
    function onResize(){
      setVpW(window.innerWidth||1024);
    }
    onResize();
    window.addEventListener("resize",onResize);
    return function(){window.removeEventListener("resize",onResize);};
  },[]);

  useEffect(function(){
    if(!loaded||!authToken||!profileHydrated)return;
    var t=setTimeout(function(){
      var activeTripId=String(resolveWizardTripId(currentTripId,newTrip,viewTrip)||String(viewTrip&&viewTrip.id||"")).trim();
      persistProfileNow(user,activeTripId).catch(function(){});
    },700);
    return function(){clearTimeout(t);};
  },[user,authToken,loaded,profileHydrated,currentTripId,newTrip,viewTrip&&viewTrip.id]);

  function go(s){setFade(true);setTimeout(function(){setHist(function(h){return h.concat([sc]);});setSc(s);setFade(false);},200);}
  function deleteTripWithConfirmation(trip){
    if(!trip)return false;
    if(typeof window!=="undefined"&&typeof window.confirm==="function"){
      var ok=window.confirm("Are you sure you want to delete this trip? This cannot be undone.");
      if(!ok)return false;
    }
    var tripId=String(trip.id||"").trim();
    if(!tripId)return false;
    setTrips(function(p){return p.filter(function(x){return String(x&&x.id||"").trim()!==tripId;});});
    if(trip.isSeed){
      setDeletedSeedTripIds(function(prev){var next=Object.assign({},prev);next[tripId]=true;return next;});
    }
    setVT(function(prev){return String(prev&&prev.id||"").trim()===tripId?null:prev;});
    setCTID(function(prev){return String(prev||"").trim()===tripId?"":prev;});
    return true;
  }
  function back(){if(!hist.length)return;setFade(true);setTimeout(function(){setSc(hist[hist.length-1]);setHist(function(h){return h.slice(0,-1);});setFade(false);},200);}
  function upU(k,v){setUser(function(p){var n=Object.assign({},p);n[k]=v;return n;});}
  function mergeCrewFromPeers(peers){
    if(!Array.isArray(peers))return;
    setCrew(function(prev){
      var next=(prev||[]).slice();
      var emailToIdx={};
      for(var i=0;i<next.length;i++){
        var em0=String(next[i]&&next[i].email||"").trim().toLowerCase();
        if(em0)emailToIdx[em0]=i;
      }
      peers.forEach(function(p){
        var em=String(p&&p.email||"").trim().toLowerCase();
        var dn=(p&&p.profile&&p.profile.display_name)||p.name||p.email||"Member";
        if(em&&emailToIdx[em]!==undefined){
          var idx=emailToIdx[em];
          var cur=next[idx]||{};
            next[idx]=Object.assign({},cur,{
              id:cur.id||p.peer_user_id||("m"+Date.now()),
              name:dn||cur.name||"Member",
              ini:cur.ini||iniFromName(dn),
              color:cur.color||CREW_COLORS[idx%CREW_COLORS.length],
              status:"accepted",
              email:em,
              profile:(p&&p.profile&&typeof p.profile==="object")?p.profile:(cur.profile||{}),
              relation:cur.relation||"crew"
            });
            return;
          }
        var nidx=next.length;
        next.push({
          id:(p&&p.peer_user_id)||("m"+Date.now()+"-"+nidx),
          name:dn,
          ini:iniFromName(dn),
          color:CREW_COLORS[nidx%CREW_COLORS.length],
          status:"accepted",
          email:em,
          profile:(p&&p.profile&&typeof p.profile==="object")?p.profile:{},
          relation:"crew"
        });
        if(em)emailToIdx[em]=nidx;
      });
      return next;
    });
  }
  async function refreshCrewFromBackend(){
    if(!authToken)return;
    try{
      var peers=await apiJson("/crew/peer-profiles",{method:"GET"},authToken);
      if(peers&&Array.isArray(peers.peers))mergeCrewFromPeers(peers.peers);
    }catch(e){}
    try{
      var sent=await apiJson("/crew/invites/sent",{method:"GET"},authToken);
      if(sent&&Array.isArray(sent.invites)){
        var acceptedJustNow=[];
        setCrew(function(prev){
          var next=(prev||[]).slice();
          var emailToIdx={};
          for(var i=0;i<next.length;i++){
            var e0=String(next[i]&&next[i].email||"").trim().toLowerCase();
            if(e0)emailToIdx[e0]=i;
          }
          sent.invites.forEach(function(inv){
            var em=String(inv&&inv.invitee_email||"").trim().toLowerCase();
            if(!em)return;
            var st=String(inv&&inv.status||"pending").toLowerCase();
            var mapped=(st==="accepted"||st==="declined")?st:"pending";
            var ikey=String(inv&&inv.invite_token||"")+"|"+String(inv&&inv.accepted_at||"");
            if(st==="accepted"&&ikey&&!inviteAcceptSeenRef.current[ikey]){
              inviteAcceptSeenRef.current[ikey]=1;
              acceptedJustNow.push(em);
            }
            if(emailToIdx[em]!==undefined){
              var idx=emailToIdx[em];
              var cur=next[idx]||{};
              next[idx]=Object.assign({},cur,{status:mapped,email:em,relation:"invitee"});
              return;
            }
            var ni=next.length;
            next.push({
              id:"inv-"+Date.now()+"-"+ni,
              name:em.split("@")[0],
              ini:em.substring(0,2).toUpperCase(),
              color:CREW_COLORS[ni%CREW_COLORS.length],
              status:mapped,
              email:em,
              relation:"invitee"
            });
            emailToIdx[em]=ni;
          });
          return next;
        });
        if(acceptedJustNow.length>0){
          setCM(acceptedJustNow[0]+" accepted your invite.");
        }
      }
    }catch(e){}
  }
  async function refreshTripsFromBackend(token,emailOverride){
    var tok=token||authToken;
    if(!tok)return;
    try{
      var r=await apiJson("/me/trips",{method:"GET"},tok);
      var items=(r&&Array.isArray(r.trips))?r.trips:[];
      var myEmail=String(emailOverride||user.email||"").trim().toLowerCase();
      var mapped=items.map(function(t){
        var myStatusRaw=String(t.my_status||"pending").toLowerCase();
        var tripStatusRaw=String(t.status||"planning").toLowerCase();
        var displayStatus=(myStatusRaw==="accepted"||myStatusRaw==="owner")?tripStatusRaw:"invited";
        var membersRaw=Array.isArray(t.members)?t.members:[];
        var members=membersRaw.filter(function(m){return !isCurrentMemberRow(m,tok,myEmail);}).map(function(m,mi){
          var dn=(m&&m.profile&&m.profile.display_name)||m.name||m.email||("Member "+(mi+1));
          var tripMemberStatus=mapTripMemberStatus(String(m&&m.status||"pending"));
          return {
            id:String(m.user_id||("tm-"+mi)),
            name:dn,
            ini:iniFromName(dn),
            color:CREW_COLORS[mi%CREW_COLORS.length],
            status:tripMemberStatus,
            trip_status:tripMemberStatus,
            crew_status:"",
            email:String(m.email||"").toLowerCase(),
            profile:(m&&m.profile&&typeof m.profile==="object")?m.profile:{}
          };
        });
        var destArr=Array.isArray(t.destinations)?t.destinations:[];
        var tripDestinations=destArr.map(function(d){
          if(typeof d==="string")return d.trim();
          if(d&&typeof d==="object"){
            return String(d.name||d.destination||"").trim();
          }
          return "";
        }).filter(Boolean);
        return {
          id:String(t.id||""),
          name:String(t.name||"Trip"),
          status:displayStatus,
          trip_status:tripStatusRaw,
          my_status:myStatusRaw,
          my_role:String(t.my_role||((myStatusRaw==="owner")?"owner":"member")).toLowerCase(),
          owner_id:String(t.owner_id||""),
          dests:tripDestinations.slice(),
          destinations:tripDestinations.slice(),
          destNames:tripDestinations.join(" + "),
          members:members,
          step:0,
          dates:"",
          days:Number(t.duration_days||0)||0,
          budget:0,
          spent:0
        };
      });
      var planningMetaRows=await Promise.all((mapped||[]).map(async function(tripItem){
        if(!tripItem||!isUuidLike(tripItem.id))return null;
        if(String(tripItem.status||"").trim().toLowerCase()==="invited")return null;
        try{
          var ps=await apiJson("/trips/"+tripItem.id+"/planning-state",{method:"GET"},tok);
          var state=(ps&&ps.state&&typeof ps.state==="object")?ps.state:{};
          var rawStep=Number(ps&&ps.current_step);
          var stepValue=Number.isFinite(rawStep)?normalizeWizardStepIndex(rawStep,state.wizard_order_version):0;
          var lockedWindow=(state&&state.availability_locked_window&&typeof state.availability_locked_window==="object")?state.availability_locked_window:null;
          var flightDateState=(state&&state.flight_dates&&typeof state.flight_dates==="object")?state.flight_dates:{};
          var startDate=String((lockedWindow&&lockedWindow.start)||flightDateState.depart||"").slice(0,10);
          var endDate=String((lockedWindow&&lockedWindow.end)||flightDateState.ret||"").slice(0,10);
          var dateLabel=(startDate&&endDate)?(startDate+" to "+endDate):(startDate||endDate||"");
          var daysLocked=Math.max(0,Number(state&&state.duration_days_locked)||0);
          var inferredDays=(startDate&&endDate)?Math.max(0,inclusiveIsoDays(startDate,endDate)||0):0;
          var dayValue=Math.max(daysLocked,inferredDays,Math.max(0,Number(tripItem.days)||0));
          return {
            id:tripItem.id,
            step:Math.max(0,Number(stepValue)||0),
            dates:dateLabel,
            days:dayValue
          };
        }catch(e){
          return null;
        }
      }));
      var planningMetaById={};
      (planningMetaRows||[]).forEach(function(row){
        if(!row||!row.id)return;
        planningMetaById[row.id]=row;
      });
      var enrichedMapped=mapped.map(function(tripItem){
        var meta=planningMetaById[tripItem.id]||{};
        return Object.assign({},tripItem,{
          step:meta.step!==undefined?Math.max(0,Number(meta.step)||0):Math.max(0,Number(tripItem.step)||0),
          dates:String(meta.dates||tripItem.dates||""),
          days:Math.max(0,Number(meta.days||tripItem.days)||0)
        });
      });
      setTrips(function(prev){
        if(enrichedMapped.length===0)return prev||[];
        var prevMap={};(prev||[]).forEach(function(p){if(p&&p.id)prevMap[p.id]=p;});
        var synced=enrichedMapped.map(function(t){
          var p=prevMap[t.id];
          if(!p)return t;
          return Object.assign({},t,{
            destNames:(t.destNames&&t.destNames.trim())?t.destNames:(p.destNames||""),
            dests:(Array.isArray(t.dests)&&t.dests.length)?t.dests:(Array.isArray(p.dests)?p.dests:[]),
            step:Number(t.step||p.step||0)||0,
            dates:t.dates||p.dates||"",
            days:Math.max(0,Number(t.days||p.days)||0),
            budget:Number(p.budget||0)||0,
            spent:Number(p.spent||0)||0
          });
        });
        var syncedIds={};synced.forEach(function(t){syncedIds[t.id]=1;});
        var extras=(prev||[]).filter(function(p){
          if(!p||!p.id||syncedIds[p.id])return false;
          return String(p.status||"")==="saved"||String(p.id||"").indexOf("saved-")===0;
        });
        return synced.concat(extras);
      });
      var peerProfiles=[];
      items.forEach(function(t){
        (Array.isArray(t.members)?t.members:[]).forEach(function(m){
          var em=String(m&&m.email||"").trim().toLowerCase();
          if(!em||isCurrentMemberRow(m,tok,myEmail)||String(m&&m.status||"")!=="accepted")return;
          peerProfiles.push({
            peer_user_id:String(m.user_id||""),
            email:em,
            name:String(m&&m.name||""),
            profile:(m&&m.profile&&typeof m.profile==="object")?m.profile:{}
          });
        });
      });
      if(peerProfiles.length>0)mergeCrewFromPeers(peerProfiles);
      setNT(function(prev){
        if(!prev||!prev.id)return prev;
        var found=enrichedMapped.find(function(t){return t.id===prev.id;});
        if(!found)return prev;
        return Object.assign({},prev,{
          members:found.members,
          status:found.status,
          trip_status:found.trip_status,
          my_status:found.my_status,
          my_role:found.my_role,
          owner_id:found.owner_id,
          name:found.name,
          destNames:found.destNames,
          dests:Array.isArray(found.dests)?found.dests.slice():[],
          step:Number(found.step||0)||0,
          dates:String(found.dates||""),
          days:Math.max(0,Number(found.days)||0)
        });
      });
      setVT(function(prev){
        if(!prev||!prev.id)return prev;
        var found=enrichedMapped.find(function(t){return t.id===prev.id;});
        if(!found)return prev;
        return Object.assign({},prev,{
          members:found.members,
          status:found.status,
          trip_status:found.trip_status,
          my_status:found.my_status,
          my_role:found.my_role,
          owner_id:found.owner_id,
          name:found.name,
          destNames:found.destNames,
          dests:Array.isArray(found.dests)?found.dests.slice():[],
          step:Number(found.step||0)||0,
          dates:String(found.dates||""),
          days:Math.max(0,Number(found.days)||0)
        });
      });
    }catch(e){}
  }

  async function hydrateSignedInSession(token,opts){
    var o=opts||{};
    var baseUser=Object.assign(emptyUserState(),o.baseUser||{});
    var emailHint=String(o.email||baseUser.email||"").trim().toLowerCase();
    var nameHint=String(o.name||baseUser.name||"").trim();
    var seededUser=Object.assign({},baseUser,{
      email:emailHint||baseUser.email||"",
      name:baseUser.name||nameHint||""
    });
    setPH(false);
    setUser(seededUser);
    setBucket([]);
    setCrew([]);
    setTrips([]);
    try{
      var prof=await apiJson("/me/profile",{method:"GET"},token);
      if(prof&&prof.profile){
        setProfileDebug(function(prev){return Object.assign({},prev||{},{lastGet:{profile:prof.profile,emailHint:emailHint,nameHint:nameHint}});});
        setUser(mergeProfileIntoUser(seededUser,prof.profile,emailHint,nameHint));
      }
    }catch(e){}
    try{
      var bl=await apiJson("/me/bucket-list",{method:"GET"},token);
      if(bl&&Array.isArray(bl.items))setBucket(normalizePersonalBucketItems(bl.items));
    }catch(e){}
    try{
      var peers=await apiJson("/crew/peer-profiles",{method:"GET"},token);
      if(peers&&Array.isArray(peers.peers)){
        setCrew(peers.peers.map(function(p,i){
          var dn=(p.profile&&p.profile.display_name)||p.name||p.email||("Member "+(i+1));
          return {id:p.peer_user_id,name:dn,ini:iniFromName(dn),color:CREW_COLORS[i%CREW_COLORS.length],status:"accepted",email:p.email||"",profile:(p&&p.profile&&typeof p.profile==="object")?p.profile:{},relation:"crew"};
        }));
      }
    }catch(e){}
    try{await refreshTripsFromBackend(token,emailHint);}catch(e){}
    setPH(true);
  }
  function mapBackendPois(rows){
    return (Array.isArray(rows)?rows:[]).map(function(x){
      var rawCat=String((x&&x.category)||"Culture");
      var category=rawCat?rawCat.charAt(0).toUpperCase()+rawCat.slice(1).toLowerCase():"Culture";
      return {
        poi_id:String((x&&x.poi_id)||(x&&x.id)||""),
        name:String((x&&x.name)||""),
        destination:String((x&&x.city)||(x&&x.destination)||(x&&x.country)||""),
        category:category,
        duration:String((x&&x.duration)||"2-3h"),
        cost:Number((x&&x.cost_estimate_usd)!==undefined?(x&&x.cost_estimate_usd):((x&&x.cost)!==undefined?(x&&x.cost):0))||0,
        rating:Number((x&&x.rating)!==undefined?(x&&x.rating):4.5)||4.5,
        matchReason:String((x&&x.matchReason)||(((x&&Array.isArray(x.tags))?x.tags:[]).join(", "))),
        locationHint:String((x&&x.location_hint)||(x&&x.locationHint)||(x&&x.neighborhood)||(x&&x.location_name)||"").trim(),
        bestTime:String((x&&x.best_time)||(x&&x.bestTime)||"").trim().toLowerCase(),
        openingWindow:String((x&&x.opening_window)||(x&&x.openingWindow)||(x&&x.open_hours)||(x&&x.hours)||"").trim(),
        source:String((x&&x.source)||"").trim().toLowerCase()||"unknown",
        failureReason:String((x&&x.failure_reason)||(x&&x.failureReason)||"").trim().toLowerCase(),
        tags:(x&&Array.isArray(x.tags))?x.tags:[],
        approved:typeof (x&&x.approved)==="boolean"?x.approved:null
      };
    });
  }
  function syncTripPoisToBackend(statusMap, rowsOverride){
    var tripIdForSync=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!(authToken&&tripIdForSync&&isUuidLike(tripIdForSync)))return Promise.resolve(null);
    var rows=(Array.isArray(rowsOverride)?rowsOverride:(pois||[]));
    if(rows.length===0)return Promise.resolve(null);
    var status=statusMap||poiStatus||{};
    var payload=rows.map(function(p,idx){
      return {
        poi_id:String(p&&p.poi_id||"")||null,
        name:String(p&&p.name||"").trim(),
        category:String(p&&p.category||"Culture"),
        destination:String(p&&p.destination||""),
        country:String(p&&p.country||""),
        tags:Array.isArray(p&&p.tags)?p.tags:[],
        rating:Number(p&&p.rating||0)||0,
        cost_estimate_usd:Number((p&&p.cost)!==undefined?p.cost:0)||0,
        match_reason:String(p&&p.matchReason||""),
        location_hint:String(p&&p.locationHint||""),
        best_time:String(p&&p.bestTime||""),
        opening_window:String(p&&p.openingWindow||""),
        source:String(p&&p.source||""),
        failure_reason:String(p&&p.failureReason||""),
        approved:status[idx]==="yes"
      };
    }).filter(function(p){return !!p.name;});
    if(payload.length===0)return Promise.resolve(null);
    return apiJson("/trips/"+tripIdForSync+"/pois/sync",{method:"POST",body:{pois:payload}},authToken).then(function(r){
      var mapped=mapBackendPois((r&&r.pois)||[]);
      if(mapped.length>0){
        setPois(mapped);
        setPD(true);
        var nextStatus={};
        mapped.forEach(function(p,idx){
          if(p.approved===true)nextStatus[idx]="yes";
          else if(p.approved===false)nextStatus[idx]="no";
        });
        setPS(nextStatus);
      }
      return r;
    }).catch(function(){return null;});
  }
  function chooseMealOption(dayIndex, mealIndex, optionIndex){
    setMeals(function(prev){
      var next=(Array.isArray(prev)?prev:[]).map(function(day){return Object.assign({},day,{meals:Array.isArray(day.meals)?day.meals.slice():[]});});
      if(!next[dayIndex]||!next[dayIndex].meals||!next[dayIndex].meals[mealIndex])return prev;
      var meal=Object.assign({},next[dayIndex].meals[mealIndex]);
      var opts=Array.isArray(meal.options)?meal.options:[];
      if(!(optionIndex>=0&&optionIndex<opts.length))return prev;
      var picked=opts[optionIndex]||{};
      meal.selectedOption=optionIndex;
      meal.name=String(picked.name||meal.name||"");
      meal.cuisine=String(picked.cuisine||meal.cuisine||"Local");
      meal.cost=Number((picked.cost!==undefined)?picked.cost:meal.cost)||0;
      meal.rating=Number((picked.rating!==undefined)?picked.rating:meal.rating)||0;
      meal.note=String(picked.note||picked.near_poi||meal.note||"");
      meal.city=String(picked.city||meal.city||"");
      meal.travelMinutes=Number((picked.travel_minutes!==undefined)?picked.travel_minutes:(picked.travelMinutes!==undefined)?picked.travelMinutes:meal.travelMinutes)||0;
      meal.anchorRole=normalizeMealAnchorRole((picked.anchorRole!==undefined)?picked.anchorRole:picked.anchor_role,meal.type);
      meal.anchorLabel=optionalMealAreaLabel(next[dayIndex].destination,String(picked.anchorLabel||picked.anchor_label||meal.anchorLabel||meal.anchor_label||picked.near_poi||"").trim())||meal.anchorLabel||"";
      next[dayIndex].meals[mealIndex]=meal;
      var mealKey=canonicalMealVoteKey(next[dayIndex],meal,dayIndex,mealIndex);
      setMealVotes(function(prevVotes){
        var out=Object.assign({},prevVotes||{});
        delete out[mealKey];
        delete out[String(dayIndex)+"-"+String(mealIndex)];
        saveTripPlanningState({state:{meal_plan:next,meal_votes:out}}).then(function(){
          refreshTripPlanningState(authToken,resolveWizardTripId(currentTripId,newTrip,viewTrip)).catch(function(){});
        });
        return out;
      });
      return next;
    });
  }
  async function refreshCurrentTripSharedState(token,tripId){
    var tok=token||authToken;
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)).trim();
    if(!(tok&&tid&&isUuidLike(tid)))return;
    try{
      var tripRes=null;
      var destRes=null;
      var poiRes=null;
      try{tripRes=await apiJson("/trips/"+tid,{method:"GET"},tok);}catch(e){}
      try{destRes=await apiJson("/trips/"+tid+"/destinations",{method:"GET"},tok);}catch(e){}
      try{poiRes=await apiJson("/trips/"+tid+"/pois?limit=50",{method:"GET"},tok);}catch(e){}
      var sharedNames=[];
      if(destRes&&Array.isArray(destRes.destinations)){
        sharedNames=destRes.destinations.map(function(d){return String((d&&d.name)||d||"").trim();}).filter(Boolean);
      }
      var tripStatus="";
      var tripName="";
      var sharedMembers=null;
      if(tripRes&&tripRes.trip){
        tripStatus=String(tripRes.trip.status||"");
        tripName=String(tripRes.trip.name||"");
        var myEmail=String(user.email||"").trim().toLowerCase();
        var existingByEmail={};
        ((newTrip&&Array.isArray(newTrip.members))?newTrip.members:[]).forEach(function(m){
          var em=String(m&&m.email||"").trim().toLowerCase();
          if(em)existingByEmail[em]=m;
        });
        sharedMembers=(Array.isArray(tripRes.trip.members)?tripRes.trip.members:[]).filter(function(m){
          return !isCurrentMemberRow(m,tok,myEmail);
        }).map(function(m,mi){
          var em=String(m&&m.email||"").trim().toLowerCase();
          var existing=existingByEmail[em]||{};
          var profileFromTrip=(m&&m.profile&&typeof m.profile==="object")?m.profile:null;
          var existingProfile=(existing&&existing.profile&&typeof existing.profile==="object")?existing.profile:null;
          var mergedProfile=profileFromTrip||existingProfile||{};
          var dn=String((mergedProfile&&mergedProfile.display_name)||m&&m.name||m&&m.email||("Member "+(mi+1)));
          var st=mapTripMemberStatus(String(m&&m.status||"pending"));
          return {
            id:String(m&&m.user_id||("tm-"+mi)),
            name:dn,
            ini:existing.ini||iniFromName(dn),
            color:existing.color||CREW_COLORS[mi%CREW_COLORS.length],
            status:st,
            trip_status:st,
            crew_status:String(existing.crew_status||""),
            email:em,
            profile:mergedProfile
          };
        });
      }
      if(sharedNames.length>0||tripStatus||tripName||(sharedMembers&&sharedMembers.length>=0)){
        setProfileDebug(function(prev){
          return Object.assign({},prev||{},{
            tripProfiles:{
              tripId:tid,
              members:(sharedMembers&&sharedMembers.length>0)?sharedMembers:(Array.isArray(tripRes&&tripRes.trip&&tripRes.trip.members)?tripRes.trip.members:[])
            }
          });
        });
        setTrips(function(prev){
          return (prev||[]).map(function(t){
            if(!t||String(t.id||"")!==tid)return t;
            return Object.assign({},t,{
              name:tripName||t.name,
              status:tripStatus||t.status,
              dests:sharedNames.length>0?sharedNames.slice():(Array.isArray(t.dests)?t.dests:[]),
              destNames:sharedNames.length>0?sharedNames.join(" + "):(t.destNames||""),
              members:(sharedMembers&&sharedMembers.length>0)?sharedMembers:t.members
            });
          });
        });
        setNT(function(prev){
          if(!prev||String(prev.id||"")!==tid)return prev;
          return Object.assign({},prev,{
            name:tripName||prev.name,
            status:tripStatus||prev.status,
            dests:sharedNames.length>0?sharedNames.slice():(Array.isArray(prev.dests)?prev.dests:[]),
            destNames:sharedNames.length>0?sharedNames.join(" + "):(prev.destNames||""),
            members:(sharedMembers&&sharedMembers.length>0)?sharedMembers:prev.members
          });
        });
      }
      if(poiRes&&Array.isArray(poiRes.pois)){
        var mappedPois=mapBackendPois(poiRes.pois);
        mappedPois=groundPoiRowsWithRoutePlan(mappedPois, routePlan, user.interests||{}, effectiveTripBudgetTierGlobal, user.dietary, wizardPoiGroupPrefs);
        if(mappedPois.length>0){
          setPois(mappedPois);
          setPD(true);
          var syncedStatus={};
          mappedPois.forEach(function(p,idx){
            if(p.approved===true)syncedStatus[idx]="yes";
            else if(p.approved===false)syncedStatus[idx]="no";
          });
          setPS(syncedStatus);
        }
      }
    }catch(e){}
  }
  function getCurrentPlannerId(){
    var tid=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    return buildCurrentVoteActor(authToken,user,tid).id;
  }
  function runPoiSearchNow(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    var pendingDestinations=(Array.isArray(wizardPoiDests)?wizardPoiDests.slice():[]).filter(Boolean);
    var targetPerDestination=pendingDestinations.length<=2?5:4;
    setPL(true);
    setPGS({phase:"starting",currentBatch:0,batchCount:Math.max(1,pendingDestinations.length),activeDestinations:pendingDestinations.map(function(d){return String(d&&d.name||d||"").trim();}).filter(Boolean),completedDestinations:[],timedOutDestinations:[],emptyDestinations:[],failedDestinations:[],parseFailedDestinations:[],fallbackDestinations:[],destinationErrors:{},backendSync:"idle"});
    setPS({});
    setPV({});
    setPMC({});
    setPois([]);
    setPD(false);
    setPOP({});
    saveTripPlanningState({state:{poi_votes:null,poi_member_choices:null,poi_option_pool:null,poi_request_signature:poiCurrentSignatureGlobal}}).catch(function(){return null;});
    if(pendingDestinations.length===0){
      setPL(false);
      setPD(true);
      setPGS({phase:"done",currentBatch:0,batchCount:0,activeDestinations:[],completedDestinations:[],timedOutDestinations:[],emptyDestinations:[],failedDestinations:[],parseFailedDestinations:[],fallbackDestinations:[],destinationErrors:{},backendSync:"skipped"});
      setPoiRequestSignature(poiCurrentSignatureGlobal);
      return;
    }
    var mergedRows=[];
    function appendRows(rows){
      mergedRows=mergePoiListsByCanonical(mergedRows.concat(Array.isArray(rows)?rows:[]), {});
      mergedRows=groundPoiRowsWithRoutePlan(mergedRows, routePlan, user.interests||{}, effectiveTripBudgetTierGlobal, user.dietary, wizardPoiGroupPrefs);
      if(mergedRows.length>0){
        var partialPool=buildPoiOptionPoolPatch(mergedRows,{});
        setPois(mergedRows);
        setPOP(partialPool);
        setPD(true);
      }
    }
    buildPoiCoverageForDestinations(
      pendingDestinations,
      user.interests||{},
      effectiveTripBudgetTierGlobal,
      user.dietary,
      wizardPoiGroupPrefs,
      routePlan,
      targetPerDestination,
      appendRows,
      function(status){
        setPGS(function(prev){
          return Object.assign({},prev||{},status||{},{
            backendSync:(prev&&prev.backendSync)||"idle"
          });
        });
      }
    ).then(function(nextRows){
      nextRows=groundPoiRowsWithRoutePlan(nextRows, routePlan, user.interests||{}, effectiveTripBudgetTierGlobal, user.dietary, wizardPoiGroupPrefs);
      var nextPool=buildPoiOptionPoolPatch(nextRows,{});
      setPGS(function(prev){return Object.assign({},prev||{},{phase:"syncing",backendSync:"pending",activeDestinations:[]});});
      syncTripPoisToBackend({},nextRows).then(function(syncRes){
        var syncedRows=mapBackendPois((syncRes&&syncRes.pois)||[]);
        syncedRows=groundPoiRowsWithRoutePlan(syncedRows, routePlan, user.interests||{}, effectiveTripBudgetTierGlobal, user.dietary, wizardPoiGroupPrefs);
        var finalRows=syncedRows.length>0?syncedRows:nextRows;
        var finalPool=buildPoiOptionPoolPatch(finalRows,{});
        setPois(finalRows);
        setPOP(finalPool);
        setPL(false);
        setPD(true);
        setPoiRequestSignature(poiCurrentSignatureGlobal);
        setPGS(function(prev){return Object.assign({},prev||{},{phase:"done",backendSync:"ok",activeDestinations:[]});});
        replacePoiOptionPoolState(activeTripId, finalPool, {
          poi_votes:{},
          poi_member_choices:{},
          poi_request_signature:poiCurrentSignatureGlobal
        }).then(function(){
          refreshCurrentTripSharedState(authToken,activeTripId).catch(function(){});
          refreshTripPlanningState(authToken,activeTripId).catch(function(){});
        }).catch(function(){return null;});
      }).catch(function(){
        setPois(nextRows);
        setPOP(nextPool);
        setPL(false);
        setPD(true);
        setPoiRequestSignature(poiCurrentSignatureGlobal);
        setPGS(function(prev){return Object.assign({},prev||{},{phase:"done",backendSync:"planning-only",activeDestinations:[]});});
        replacePoiOptionPoolState(activeTripId, nextPool, {
          poi_votes:{},
          poi_member_choices:{},
          poi_request_signature:poiCurrentSignatureGlobal
        }).then(function(){
          refreshTripPlanningState(authToken,activeTripId).catch(function(){});
        }).catch(function(){return null;});
      });
    }).catch(function(){
      setPois([]);
      setPOP({});
      setPL(false);
      setPD(true);
      setPoiRequestSignature(poiCurrentSignatureGlobal);
      setPGS(function(prev){return Object.assign({},prev||{},{phase:"failed",backendSync:"failed",activeDestinations:[]});});
    });
  }
  async function refreshTripPlanningState(token,tripId){
    var tok=token||authToken;
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)).trim();
    if(!(tok&&tid&&isUuidLike(tid)))return;
    try{
      var ps=await apiJson("/trips/"+tid+"/planning-state",{method:"GET"},tok);
      if(!ps)return;
      var updatedAt=String(ps.updated_at||"");
      if(updatedAt)planningStateUpdatedAtRef.current=updatedAt;
      var st=(ps&&ps.state&&typeof ps.state==="object")?ps.state:{};
      if(typeof ps.current_step==="number"&&sc==="wizard"){
        var remoteStep=normalizeWizardStepIndex(ps.current_step,st.wizard_order_version);
        var pendingStep=pendingWizardStepPersistRef.current;
        var pendingForTrip=!!(pendingStep&&pendingStep.tripId===tid&&pendingStep.step!==undefined&&pendingStep.step!==null);
        if(pendingForTrip&&remoteStep!==Number(pendingStep.step||0)){
          // Keep local step while a user-initiated step save is still syncing.
        }else{
          if(remoteStep!==wizStep)updateLocalWizardStepState(remoteStep,tid);
          if(pendingForTrip&&remoteStep===Number(pendingStep.step||0)){
            pendingWizardStepPersistRef.current=null;
            clearWizardStepPersistRetry();
          }
        }
      }
      if(st.duration_days_locked!==undefined){
        setSDD(Math.max(0,Number(st.duration_days_locked)||0));
      }
      if(st.duration_revision_signature!==undefined){
        setSDSig(String(st.duration_revision_signature||"").trim());
      }
      if(st.duration_per_destination&&typeof st.duration_per_destination==="object"){
        setDPD(st.duration_per_destination);
      }
      if(st.shared_budget_tier!==undefined){
        setSBT(String(st.shared_budget_tier||"").trim().toLowerCase());
      }
      if(st.flight_dates&&typeof st.flight_dates==="object"){
        var planningTripDays=Math.max(0,Number(st.duration_days_locked!==undefined?st.duration_days_locked:sharedDurationDays)||0);
        setFD(function(prev){
          return sanitizeFlightDatesForTrip(
              mergeSharedFlightDates(prev,st.flight_dates,wizStep===14),
            planningTripDays
          );
        });
      }
      if(Array.isArray(st.flight_route_plan)){
        setFLI(st.flight_route_plan.map(function(stop){
          return {
            destination:String(stop&&stop.destination||"").trim(),
            airport:String(stop&&stop.airport||stop&&stop.to_airport||"").trim(),
            travel_date:String(stop&&stop.travel_date||stop&&stop.depart_date||"").slice(0,10),
            manual_date:!!(stop&&stop.manual_date)
          };
        }));
      }
      if(st.flights_confirmed!==undefined){
        setFC(!!st.flights_confirmed);
      }
      if(Array.isArray(st.flight_booking_links)){
        setFBL(st.flight_booking_links.slice());
      }
      setDMV(normalizeDestinationVoteState(st.dest_member_votes));
      if(st.poi_request_signature!==undefined){
        setPoiRequestSignature(String(st.poi_request_signature||"").trim());
      }
      if(st.route_plan_signature!==undefined){
        setRPS(String(st.route_plan_signature||"").trim());
      }
      if(st.route_plan&&typeof st.route_plan==="object"){
        var normalizedRoutePlan=normalizeRoutePlan(st.route_plan,wizardPoiDests);
        setRoutePlan(normalizedRoutePlan);
        setRPD(!!(normalizedRoutePlan&&Array.isArray(normalizedRoutePlan.destinations)&&normalizedRoutePlan.destinations.length));
      }
      var planningPool=(st.poi_option_pool&&typeof st.poi_option_pool==="object")?st.poi_option_pool:poiOptionPool;
      var mergedPlanningPois=mergePoiListsByCanonical(pois,planningPool);
      setPV(normalizePoiStateMap(st.poi_votes,mergedPlanningPois,planningPool));
      if(st.poi_status&&typeof st.poi_status==="object"){
        setPS(normalizePoiDecisionStateMap(st.poi_status,mergedPlanningPois,planningPool));
      }
      if(st.poi_option_pool&&typeof st.poi_option_pool==="object"){
        setPOP(st.poi_option_pool);
        setPois(function(prev){
          var base=Array.isArray(prev)?prev:[];
          var merged=mergePoiListsByCanonical(base,st.poi_option_pool);
          if(merged.length>0)setPD(true);
          if(poiKeySignature(merged)===poiKeySignature(base))return base;
          return merged;
        });
      }
      setPMC(normalizePoiStateMap(st.poi_member_choices,mergedPlanningPois,planningPool));
      if(st.poi_member_choices&&typeof st.poi_member_choices==="object"&&!(st.poi_status&&typeof st.poi_status==="object")){
        var me=getCurrentPlannerId();
        if(me){
          setPS(function(prev){
            var next=Object.assign({},prev||{});
            (mergedPlanningPois||[]).forEach(function(p,idx){
              var rowMeta=readPoiSelectionRow(st.poi_member_choices,p,idx);
              var v=String((rowMeta.row&&rowMeta.row[me])||"").trim().toLowerCase();
              if(v==="yes"||v==="no")next[idx]=v;
            });
            return next;
          });
        }
      }
      if(Array.isArray(st.stay_options)){
        var hydratedStayOptions=normalizePersistedStayOptions(
          st.stay_options,
          dests,
          sharedBudgetTier,
          sharedDurationDays
        );
        setStays(hydratedStayOptions);
        setSD(hydratedStayOptions.length>0);
      }
      setStayVotes((st.stay_votes&&typeof st.stay_votes==="object")?st.stay_votes:{});
      setSFC((st.stay_final_choices&&typeof st.stay_final_choices==="object")?st.stay_final_choices:{});
      if(Array.isArray(st.meal_plan)){
        var normalizedMealPlan=normalizeDiningPlan(st.meal_plan);
        setMeals(normalizedMealPlan);
        setMD(normalizedMealPlan.length>0);
      }
      setMealVotes((st.meal_votes&&typeof st.meal_votes==="object")?st.meal_votes:{});
      setAData(function(prev){
        var planningTripDays=Math.max(0,Number(st.duration_days_locked!==undefined?st.duration_days_locked:sharedDurationDays)||0);
        var next=sanitizeAvailabilityOverlapData((prev&&typeof prev==="object")?prev:{},planningTripDays);
        next.locked_window=sanitizeAvailabilityWindow(st.availability_locked_window,planningTripDays);
        next.is_locked=!!next.locked_window;
        return next;
      });
    }catch(e){}
  }
  function replacePoiOptionPoolState(activeTripId, fullPool, extraState){
    var tid=String(activeTripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)).trim();
    if(!(authToken&&tid&&isUuidLike(tid)))return Promise.resolve(null);
    var nextPool=(fullPool&&typeof fullPool==="object")?fullPool:{};
    var extras=(extraState&&typeof extraState==="object")?extraState:{};
    return saveTripPlanningState({state:{poi_option_pool:null}})
      .catch(function(){return null;})
      .then(function(){
        return saveTripPlanningState({
          state:Object.assign({},extras,{poi_option_pool:nextPool})
        });
      });
  }
  function saveTripPlanningState(patch){
    var tid=String((patch&&patch.trip_id)||resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    if(!(authToken&&tid&&isUuidLike(tid)))return Promise.resolve(null);
    var body={merge:true,state:{}};
    if(patch&&typeof patch==="object"){
      if(patch.current_step!==undefined)body.current_step=Number(patch.current_step)||0;
      if(patch.state&&typeof patch.state==="object"){
        body.state=Object.assign({},patch.state);
        var poolForNormalization=(body.state.poi_option_pool!==undefined)
          ? ((body.state.poi_option_pool&&typeof body.state.poi_option_pool==="object")?body.state.poi_option_pool:{})
          : ((poiOptionPool&&typeof poiOptionPool==="object")?poiOptionPool:{});
        var rowsForNormalization=mergePoiListsByCanonical(pois,poolForNormalization);
        if(body.state.dest_member_votes&&typeof body.state.dest_member_votes==="object"){
          body.state.dest_member_votes=normalizeDestinationVoteState(body.state.dest_member_votes);
        }
        if(body.state.poi_votes&&typeof body.state.poi_votes==="object"){
          body.state.poi_votes=normalizePoiStateMap(body.state.poi_votes,rowsForNormalization,poolForNormalization);
        }
        if(body.state.poi_member_choices&&typeof body.state.poi_member_choices==="object"){
          body.state.poi_member_choices=normalizePoiStateMap(body.state.poi_member_choices,rowsForNormalization,poolForNormalization);
        }
        if(body.state.poi_status&&typeof body.state.poi_status==="object"){
          body.state.poi_status=normalizePoiDecisionStateMap(body.state.poi_status,rowsForNormalization,poolForNormalization);
        }
      }
    }
    return apiJson("/trips/"+tid+"/planning-state",{method:"PUT",body:body},authToken).then(function(r){
      if(r&&r.updated_at)planningStateUpdatedAtRef.current=String(r.updated_at||"");
      var state=(r&&r.state&&typeof r.state==="object")?r.state:null;
      if(state){
        if(state.poi_request_signature!==undefined)setPoiRequestSignature(String(state.poi_request_signature||"").trim());
        if(state.route_plan_signature!==undefined)setRPS(String(state.route_plan_signature||"").trim());
        if(state.route_plan&&typeof state.route_plan==="object"){
          var normalizedRouteState=normalizeRoutePlan(state.route_plan,wizardPoiDests);
          setRoutePlan(normalizedRouteState);
          setRPD(!!(normalizedRouteState&&Array.isArray(normalizedRouteState.destinations)&&normalizedRouteState.destinations.length));
        }else if(state.route_plan===null){
          setRoutePlan(null);
          setRPD(false);
        }
        if(state.dest_member_votes&&typeof state.dest_member_votes==="object"){
          setDMV(normalizeDestinationVoteState(state.dest_member_votes));
        }
        var returnedPool=(state.poi_option_pool&&typeof state.poi_option_pool==="object")?state.poi_option_pool:poiOptionPool;
        var returnedPoiRows=mergePoiListsByCanonical(pois,returnedPool);
        if(state.poi_votes&&typeof state.poi_votes==="object")setPV(normalizePoiStateMap(state.poi_votes,returnedPoiRows,returnedPool));
        if(state.poi_member_choices&&typeof state.poi_member_choices==="object")setPMC(normalizePoiStateMap(state.poi_member_choices,returnedPoiRows,returnedPool));
        if(state.poi_status&&typeof state.poi_status==="object")setPS(normalizePoiDecisionStateMap(state.poi_status,returnedPoiRows,returnedPool));
        if(state.duration_days_locked!==undefined)setSDD(Math.max(0,Number(state.duration_days_locked)||0));
        if(state.duration_revision_signature!==undefined)setSDSig(String(state.duration_revision_signature||"").trim());
        if(state.duration_per_destination&&typeof state.duration_per_destination==="object")setDPD(state.duration_per_destination);
        if(state.shared_budget_tier!==undefined)setSBT(String(state.shared_budget_tier||"").trim().toLowerCase());
        if(state.flight_dates&&typeof state.flight_dates==="object"){
          var returnedTripDays=Math.max(0,Number(state.duration_days_locked!==undefined?state.duration_days_locked:sharedDurationDays)||0);
          setFD(function(prev){
            return sanitizeFlightDatesForTrip(
              mergeSharedFlightDates(prev,state.flight_dates,wizStep===14),
              returnedTripDays
            );
          });
        }
        if(Array.isArray(state.flight_route_plan)){
          setFLI(state.flight_route_plan.map(function(stop){
            return {
              destination:String(stop&&stop.destination||"").trim(),
              airport:String(stop&&stop.airport||stop&&stop.to_airport||"").trim(),
              travel_date:String(stop&&stop.travel_date||stop&&stop.depart_date||"").slice(0,10),
            manual_date:!!(stop&&stop.manual_date)
          };
        }));
      }
      if(state.flights_confirmed!==undefined)setFC(!!state.flights_confirmed);
      if(Array.isArray(state.flight_booking_links))setFBL(state.flight_booking_links.slice());
        if(Array.isArray(state.stay_options)){
          var savedStayOptions=normalizePersistedStayOptions(
            state.stay_options,
            dests,
            state.shared_budget_tier!==undefined?state.shared_budget_tier:sharedBudgetTier,
            state.duration_days_locked!==undefined?state.duration_days_locked:sharedDurationDays
          );
          setStays(savedStayOptions);
          setSD(savedStayOptions.length>0);
        }
        if(state.stay_votes&&typeof state.stay_votes==="object")setStayVotes(state.stay_votes);
        if(state.stay_final_choices&&typeof state.stay_final_choices==="object")setSFC(state.stay_final_choices);
        if(Array.isArray(state.meal_plan)){var normalizedMealPlan=normalizeDiningPlan(state.meal_plan);setMeals(normalizedMealPlan);setMD(normalizedMealPlan.length>0);}
        if(state.meal_votes&&typeof state.meal_votes==="object")setMealVotes(state.meal_votes);
        setAData(function(prev){
          var returnedTripDays=Math.max(0,Number(state.duration_days_locked!==undefined?state.duration_days_locked:sharedDurationDays)||0);
          var next=sanitizeAvailabilityOverlapData((prev&&typeof prev==="object")?prev:{},returnedTripDays);
          next.locked_window=sanitizeAvailabilityWindow(state.availability_locked_window,returnedTripDays);
          next.is_locked=!!next.locked_window;
          return next;
        });
      }
      return r;
    }).catch(function(){return null;});
  }
  function persistPlanningStateStrict(patch,retries){
    var maxAttempts=Math.max(1,Number(retries)||2);
    function run(remaining){
      return saveTripPlanningState(patch).then(function(res){
        if(res)return res;
        throw new Error("planning_state_save_failed");
      }).catch(function(err){
        if(remaining<=1)throw err;
        return new Promise(function(resolve){
          setTimeout(resolve,Math.min(600,180*(maxAttempts-remaining+1)));
        }).then(function(){
          return run(remaining-1);
        });
      });
    }
    return run(maxAttempts);
  }
  function clearWizardStepPersistRetry(){
    if(wizardStepPersistRetryRef.current){
      clearTimeout(wizardStepPersistRetryRef.current);
      wizardStepPersistRetryRef.current=null;
    }
  }
  function updateLocalWizardStepState(stepValue,tripId){
    var stepNum=Math.max(0,Number(stepValue)||0);
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    setWS(stepNum);
    setNT(function(prev){
      if(!(prev&&typeof prev==="object"))return prev;
      var prevId=String(prev.id||"").trim();
      if(tid&&prevId&&prevId!==tid)return prev;
      if(Number(prev.step||0)===stepNum)return prev;
      return Object.assign({},prev,{step:stepNum});
    });
    if(tid){
      setTrips(function(prev){
        return (prev||[]).map(function(item){
          if(!item||String(item.id||"").trim()!==tid)return item;
          if(Number(item.step||0)===stepNum)return item;
          return Object.assign({},item,{step:stepNum});
        });
      });
    }
  }
  function persistWizardStepWithRetry(stepValue,tripId,attempt){
    var stepNum=Math.max(0,Number(stepValue)||0);
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    if(!(authToken&&tid&&isUuidLike(tid))){
      pendingWizardStepPersistRef.current=null;
      clearWizardStepPersistRetry();
      return;
    }
    var tryNum=Math.max(1,Number(attempt)||1);
    pendingWizardStepPersistRef.current={tripId:tid,step:stepNum,attempt:tryNum};
    persistPlanningStateStrict({current_step:stepNum,state:{wizard_order_version:WIZARD_ORDER_VERSION}},1).then(function(){
      var pending=pendingWizardStepPersistRef.current;
      if(pending&&pending.tripId===tid&&pending.step===stepNum){
        pendingWizardStepPersistRef.current=null;
      }
      clearWizardStepPersistRetry();
    }).catch(function(){
      var pending=pendingWizardStepPersistRef.current;
      if(!(pending&&pending.tripId===tid&&pending.step===stepNum))return;
      if(tryNum>=4){
        pendingWizardStepPersistRef.current=null;
        clearWizardStepPersistRetry();
        setCSM("Could not sync step progress. Please retry this step once connection is stable.");
        return;
      }
      clearWizardStepPersistRetry();
      wizardStepPersistRetryRef.current=setTimeout(function(){
        persistWizardStepWithRetry(stepNum,tid,tryNum+1);
      },Math.min(4000,700*tryNum));
    });
  }
  useEffect(function(){
    if(wizStep!==9)return;
    var tid=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!(authToken&&tid&&isUuidLike(tid)))return;
    if(durationDraftSaveTimerRef.current)clearTimeout(durationDraftSaveTimerRef.current);
    durationDraftSaveTimerRef.current=setTimeout(function(){
      saveTripPlanningState({state:{duration_per_destination:Object.assign({},durPerDest||{})}}).catch(function(){return null;});
    },500);
    return function(){
      if(durationDraftSaveTimerRef.current){
        clearTimeout(durationDraftSaveTimerRef.current);
        durationDraftSaveTimerRef.current=null;
      }
    };
  },[wizStep,durPerDest,authToken,currentTripId,newTrip&&newTrip.id,viewTrip&&viewTrip.id]);
  useEffect(function(){
    if(wizStep!==11)return;
    var tid=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!(authToken&&tid&&isUuidLike(tid)))return;
    if(!mealDone||!Array.isArray(meals)||meals.length===0)return;
    if(mealDraftSaveTimerRef.current)clearTimeout(mealDraftSaveTimerRef.current);
    mealDraftSaveTimerRef.current=setTimeout(function(){
      saveTripPlanningState({
        state:{
          meal_plan:normalizeDiningPlan(meals),
          meal_votes:(mealVotes&&typeof mealVotes==="object")?Object.assign({},mealVotes):{}
        }
      }).catch(function(){return null;});
    },500);
    return function(){
      if(mealDraftSaveTimerRef.current){
        clearTimeout(mealDraftSaveTimerRef.current);
        mealDraftSaveTimerRef.current=null;
      }
    };
  },[wizStep,mealDone,meals,mealVotes,authToken,currentTripId,newTrip&&newTrip.id,viewTrip&&viewTrip.id]);
  function refreshCompanionNow(tid,silent){
    var tripId=String(tid||resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    if(!(loaded&&authToken&&tripId&&isUuidLike(tripId)))return Promise.resolve(null);
    if(!silent)setCompanionRefreshLoad(true);
    if(!silent){
      setCompanionLoad(true);
      setCompanionErr("");
    }
    return apiJson("/trips/"+tripId+"/companion?refresh_ts="+Date.now(),{method:"GET",cache:"no-store"},authToken).then(function(res){
      setCompanionData((res&&res.companion)||null);
      if(!silent){
        setCompanionLoad(false);
        setCompanionRefreshStamp(new Date().toISOString());
      }
      refreshCurrentTripSharedState(authToken,tripId).catch(function(){});
      return (res&&res.companion)||null;
    }).catch(function(e){
      if(!silent){
        setCompanionLoad(false);
        setCompanionErr(String(e&&e.message||"Could not load live companion"));
      }
      throw e;
    }).finally(function(){
      if(!silent)setCompanionRefreshLoad(false);
    });
  }
  function parseReceiptForTrip(tripId,payload){
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    if(!(authToken&&tid&&isUuidLike(tid)))return Promise.reject(new Error("Trip context missing"));
    return apiJson("/trips/"+tid+"/expenses/parse",{method:"POST",body:payload},authToken);
  }
  function saveReceiptItemsForTrip(tripId,items){
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    if(!(authToken&&tid&&isUuidLike(tid)))return Promise.reject(new Error("Trip context missing"));
    return apiJson("/trips/"+tid+"/expenses",{method:"POST",body:{items:items}},authToken);
  }
  function profilePayloadFor(userState){
    var u=Object.assign(emptyUserState(),userState||{});
    return {
      display_name:u.name||"",
      travel_styles:u.styles||[],
      interests:u.interests||{},
      budget_tier:u.budget||"moderate",
      dietary:u.dietary||[]
    };
  }
  function persistProfileNow(nextUser,tripId){
    var tid=String(tripId||resolveWizardTripId(currentTripId,newTrip,viewTrip)).trim();
    if(!authToken)return Promise.resolve(null);
    var payload=profilePayloadFor(nextUser);
    setProfileDebug(function(prev){return Object.assign({},prev||{},{lastPut:{tripId:tid||"",payload:payload,user:Object.assign({},nextUser||{})}});});
    return apiJson("/me/profile",{method:"PUT",body:payload},authToken).then(function(r){
      setProfileDebug(function(prev){return Object.assign({},prev||{},{lastPutResult:r||{ok:false}});});
      if(tid&&isUuidLike(tid))refreshCurrentTripSharedState(authToken,tid).catch(function(){});
      return r;
    }).catch(function(){
      setProfileDebug(function(prev){return Object.assign({},prev||{},{lastPutResult:{ok:false,error:"save_failed"}});});
      return null;
    });
  }
  function setWizardStepShared(nextStep){
    var n=Math.min(Math.max(0,Number(nextStep)||0),Math.max(WIZ.length-1,0));
    var tid=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    updateLocalWizardStepState(n,tid);
    persistWizardStepWithRetry(n,tid,1);
  }
  function consensusStageKeyForStep(stepNum){
    var map={
      2:"vote_destinations",
      3:"interests",
      4:"health",
      6:"activities",
      7:"poi_voting",
      8:"budget",
      10:"stays",
      11:"dining",
      12:"itinerary",
      13:"dates"
    };
    return map[Number(stepNum)]||"";
  }
  function isWizardOrganizer(tripCtx){
    var tr=tripCtx||newTrip||{};
    var tid=resolveWizardTripId(currentTripId,newTrip,tr);
    if(!isUuidLike(tid))return true;
    var hasRoleHints=!!(tr&&((tr.my_status!==undefined&&tr.my_status!==null)||(tr.my_role!==undefined&&tr.my_role!==null)||(tr.owner_id!==undefined&&tr.owner_id!==null)));
    if(!hasRoleHints)return true;
    var myStatus=String(tr.my_status||"").trim().toLowerCase();
    if(myStatus==="owner")return true;
    var role=String(tr.my_role||"").trim().toLowerCase();
    if(role==="owner")return true;
    var ownerId=String(tr.owner_id||"").trim();
    var myId=String(userIdFromToken(authToken)||"").trim();
    if(ownerId&&myId&&ownerId===myId)return true;
    var me=String(user.email||"").trim().toLowerCase();
    var ownerByMember=(Array.isArray(tr.members)?tr.members:[]).find(function(m){
      return String(m&&m.role||"").trim().toLowerCase()==="owner";
    });
    var ownerEmail=String(ownerByMember&&ownerByMember.email||"").trim().toLowerCase();
    return !!(me&&ownerEmail&&me===ownerEmail);
  }
  function submitStageConsensusDecision(stageKey,decision,tripCtx){
    var tid=String(currentTripId||(tripCtx&&tripCtx.id)||newTrip.id||"").trim();
    if(!(authToken&&tid&&isUuidLike(tid)&&stageKey))return Promise.resolve({mode:"local"});
    function voteCall(){
      return apiJson("/trips/"+tid+"/consensus/stages/"+stageKey+"/vote",{method:"POST",body:{vote:decision==="revise"?"no":"yes"}},authToken).then(function(r){
        return {mode:"server",organizer:false,consensus:r&&r.consensus||null};
      });
    }
    function finalizeCall(){
      return apiJson("/trips/"+tid+"/consensus/stages/"+stageKey+"/finalize",{method:"POST",body:{action:decision==="revise"?"revise":"approve"}},authToken).then(function(r){
        return {mode:"server",organizer:true,consensus:r&&r.consensus||null};
      }).catch(function(err){
        var msg=String(err&&err.message||"").toLowerCase();
        if(msg.indexOf("only trip owner")>=0||msg.indexOf("only owner")>=0||msg.indexOf("403")>=0){
          return voteCall();
        }
        throw err;
      });
    }
    return apiJson("/trips/"+tid+"/consensus/stages/"+stageKey,{method:"GET"},authToken).then(function(meta){
      if(meta&&meta.can_finalize)return finalizeCall();
      return voteCall();
    }).catch(function(){
      var organizer=isWizardOrganizer(tripCtx);
      return organizer?finalizeCall():voteCall();
    });
  }
  useEffect(function(){
    if(sc!=="wizard")return;
    setCSM("");
  },[wizStep,sc,currentTripId]);
  useEffect(function(){
    return function(){
      clearWizardStepPersistRetry();
    };
  },[]);
  useEffect(function(){
    if(!loaded||!authToken||(sc!=="crew"&&sc!=="new_trip"&&sc!=="dash"&&sc!=="wizard"))return;
    refreshCrewFromBackend();
    var t=setInterval(function(){refreshCrewFromBackend();},5000);
    return function(){clearInterval(t);};
  },[loaded,authToken,sc]);
  useEffect(function(){
    if(!loaded||!authToken||!(sc==="dash"||sc==="wizard"||sc==="trip_detail"||sc==="companion"))return;
    refreshTripsFromBackend();
    var t=setInterval(function(){refreshTripsFromBackend();},7000);
    return function(){clearInterval(t);};
  },[loaded,authToken,sc,user.email]);
  useEffect(function(){
    var tid=String((viewTrip&&viewTrip.id)||currentTripId||"").trim();
    if(!loaded||!authToken||sc!=="companion"||!tid||!isUuidLike(tid))return;
    var alive=true;
    refreshCompanionNow(tid,false).catch(function(){});
    var t=setInterval(function(){
      if(!alive)return;
      refreshCompanionNow(tid,true).catch(function(){});
    },4000);
    return function(){alive=false;clearInterval(t);};
  },[loaded,authToken,sc,viewTrip&&viewTrip.id,currentTripId]);
  useEffect(function(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!loaded||!authToken||sc!=="wizard"||!activeTripId||!isUuidLike(activeTripId))return;
    refreshCurrentTripSharedState();
    refreshTripPlanningState();
    var syncMs=wizardSyncIntervalMs(wizStep);
    var t=setInterval(function(){
      refreshCurrentTripSharedState();
      refreshTripPlanningState();
    },syncMs);
    return function(){clearInterval(t);};
  },[loaded,authToken,sc,currentTripId,newTrip&&newTrip.id,viewTrip&&viewTrip.id,user.email,wizStep]);
  useEffect(function(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!loaded||!authToken||!activeTripId||!isUuidLike(activeTripId))return;
    if(!shouldAutoGeneratePois(sc,wizStep,mergedPoiRowsGlobal,poiDone,poiLoad,poiContextStaleGlobal,wizardPoiDests))return;
    var autoKey=activeTripId+"|"+poiCurrentSignatureGlobal;
    if(shouldSkipPoiAutoGenerate(poiAutoGenerateRef.current[autoKey],mergedPoiRowsGlobal))return;
    poiAutoGenerateRef.current[autoKey]=true;
    runPoiSearchNow();
  },[
    loaded,
    authToken,
    sc,
    wizStep,
    currentTripId,
    newTrip&&newTrip.id,
    viewTrip&&viewTrip.id,
    mergedPoiRowsGlobal.length,
    poiDone,
    poiLoad,
    poiContextStaleGlobal,
    poiCurrentSignatureGlobal,
    JSON.stringify((wizardPoiDests||[]).map(function(d){return {name:d&&d.name||"",country:d&&d.country||""};}))
  ]);
  useEffect(function(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!loaded||!authToken||sc!=="wizard"||wizStep!==13||!activeTripId||!isUuidLike(activeTripId))return;
    function run(){
      fetchAvailabilityOverlap(activeTripId,authToken).then(function(res){
        if(!res)return;
        var requiredTripDays=Math.max(1,Number(res.required_trip_days||sharedDurationDays||inclusiveIsoDays(flightDates.depart,flightDates.ret)||Number(tr.days)||10));
        var sanitized=sanitizeAvailabilityOverlapData(res,requiredTripDays);
        setAData(sanitized);
        var resolvedDraft=resolveAvailabilityDraftWindow(sanitized,String(userIdFromToken(authToken)||"").trim(),flightDates,requiredTripDays);
        setADraft(function(prev){
          return mergeAvailabilityDraft(prev,resolvedDraft,requiredTripDays,!!sanitized.locked_window);
        });
      }).catch(function(e){
        setAErr(String(e&&e.message||"Could not load availability"));
      });
    }
    run();
    var t=setInterval(run,1500);
    return function(){clearInterval(t);};
  },[loaded,authToken,sc,wizStep,currentTripId,newTrip&&newTrip.id,viewTrip&&viewTrip.id,flightDates.depart,flightDates.ret]);
  useEffect(function(){
    if(!loaded||sc!=="wizard"||wizStep!==14)return;
    var lockedWindow=(availabilityData&&availabilityData.locked_window&&typeof availabilityData.locked_window==="object")
      ? availabilityData.locked_window
      : ((flightDates.depart&&flightDates.ret)?{start:String(flightDates.depart||"").slice(0,10),end:String(flightDates.ret||"").slice(0,10)}:null);
    var normalized=buildFlightRoutePlan(
      routePlanDestinationOrder(flightPlannerDests,flightLegInputs),
      effectiveDurPerDest,
      lockedWindow,
      flightLegInputs
    );
    if(flightRoutePlanSignature(flightLegInputs)!==flightRoutePlanSignature(normalized)){
      setFLI(normalized);
    }
    if(lockedWindow){
      var nextDepart=String(lockedWindow.start||"").slice(0,10);
      var nextRet=String(lockedWindow.end||"").slice(0,10);
      if(String(flightDates.depart||"").slice(0,10)!==nextDepart||String(flightDates.ret||"").slice(0,10)!==nextRet||flightDates.final_airport===undefined){
        setFD(function(prev){
          return Object.assign({},prev||{},{
            depart:nextDepart,
            ret:nextRet,
            final_airport:String((prev&&prev.final_airport)||prev&&prev.origin||"").trim()
          });
        });
      }
    }
  },[
    loaded,
    sc,
    wizStep,
    flightRoutePlanSignature(flightLegInputs),
    JSON.stringify((flightPlannerDests||[]).map(function(d){return d&&d.name||d;})),
    JSON.stringify(effectiveDurPerDest||{}),
    availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start,
    availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.end,
    flightDates.depart,
    flightDates.ret,
    flightDates.origin,
    flightDates.final_airport
  ]);
  useEffect(function(){
    var cancelled=false;
    async function hydrateNearestDestinationAirports(){
      if(!loaded||!authToken||sc!=="wizard"||wizStep!==14)return;
      var normalized=normalizedFlightRoutePlan();
      var unresolvedIndexes=[];
      normalized.forEach(function(stop,idx){
        var destination=String(stop&&stop.destination||"").trim();
        var airport=String(stop&&stop.airport||"").trim();
        if(destination.length<2)return;
        if(!airport||airport.toLowerCase()===destination.toLowerCase()){
          unresolvedIndexes.push(idx);
        }
      });
      if(unresolvedIndexes.length===0)return;
      var nextPlan=normalized.slice(0);
      var changed=false;
      for(var i=0;i<unresolvedIndexes.length;i++){
        if(cancelled)return;
        var stopIdx=unresolvedIndexes[i];
        var stop=nextPlan[stopIdx]||{};
        var destinationName=String(stop.destination||"").trim();
        if(destinationName.length<2)continue;
        var resolvedCode=await resolveAirportCode(destinationName,"");
        if(cancelled)return;
        if(!resolvedCode||resolvedCode.length!==3)continue;
        var priorAirport=String(stop.airport||"").trim();
        if(priorAirport&&priorAirport.toLowerCase()!==destinationName.toLowerCase())continue;
        nextPlan[stopIdx]=Object.assign({},stop,{airport:destinationName+" ("+resolvedCode+")"});
        changed=true;
      }
      if(!cancelled&&changed&&flightRoutePlanSignature(nextPlan)!==flightRoutePlanSignature(normalized)){
        persistFlightRoute(flightDates,nextPlan);
      }
    }
    hydrateNearestDestinationAirports();
    return function(){cancelled=true;};
  },[
    loaded,
    authToken,
    sc,
    wizStep,
    flightRoutePlanSignature(flightLegInputs),
    JSON.stringify((flightPlannerDests||[]).map(function(d){return d&&d.name||d;})),
    availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start,
    availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.end,
    flightDates.depart,
    flightDates.ret
  ]);
  useEffect(function(){
    var startDate=(availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start)||flightDates.depart||"";
    if(!itinDone||!startDate)return;
    setItin(function(prev){
      return materializeItineraryDates(prev,startDate);
    });
  },[
    itinDone,
    availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start,
    flightDates.depart
  ]);
  useEffect(function(){
    var grouped={};
    (Array.isArray(stays)?stays:[]).forEach(function(stay,idx){
      var dest=String(stay&&stay.destination||"Other");
      if(!grouped[dest])grouped[dest]=[];
      grouped[dest].push({stay:stay,idx:idx,localIndex:grouped[dest].length});
    });
    var next={};
    Object.keys(stayFinalChoices||{}).forEach(function(destName){
      var wanted=String(stayFinalChoices[destName]||"");
      var hit=(grouped[destName]||[]).find(function(entry){
        return canonicalStayVoteKey(entry.stay,entry.idx)===wanted;
      });
      if(hit)next[destName]=hit.localIndex;
    });
    if(Object.keys(next).length===0)return;
    setStayPick(function(prev){return Object.assign({},prev||{},next);});
  },[stays,stayFinalChoices]);
  useEffect(function(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!loaded||!authToken||sc!=="wizard"||!activeTripId||!isUuidLike(activeTripId))return;
    if(wizStep<5)return;
    if(!Array.isArray(pois)||pois.length===0)return;
    var fullPool=buildPoiOptionPoolPatch(pois,{});
    var currentPool=(poiOptionPool&&typeof poiOptionPool==="object")?poiOptionPool:{};
    if(poiKeySignature(Object.keys(fullPool).map(function(key){return fullPool[key];}))===poiKeySignature(Object.keys(currentPool).map(function(key){return currentPool[key];})))return;
    setPOP(fullPool);
    replacePoiOptionPoolState(activeTripId, fullPool).then(function(){
      refreshTripPlanningState(authToken,activeTripId).catch(function(){});
    });
  },[loaded,authToken,sc,currentTripId,newTrip&&newTrip.id,viewTrip&&viewTrip.id,wizStep,pois,poiOptionPool]);
  useEffect(function(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!loaded||!authToken||sc!=="wizard"||!activeTripId||!isUuidLike(activeTripId))return;
    if(wizStep<7)return;
    if(!routePlan||!Array.isArray(routePlan.destinations)||routePlan.destinations.length===0)return;
    if(!Array.isArray(pois)||pois.length===0)return;
    var grounded=groundPoiRowsWithRoutePlan(
      pois,
      routePlan,
      user.interests||{},
      effectiveTripBudgetTierGlobal,
      user.dietary,
      wizardPoiGroupPrefs
    );
    if(poiKeySignature(grounded)===poiKeySignature(pois))return;
    var groundedPool=buildPoiOptionPoolPatch(grounded,{});
    setPois(grounded);
    setPOP(groundedPool);
    replacePoiOptionPoolState(activeTripId, groundedPool, {
      poi_request_signature:poiCurrentSignatureGlobal
    }).then(function(){
      refreshTripPlanningState(authToken,activeTripId).catch(function(){});
    }).catch(function(){});
  },[
    loaded,
    authToken,
    sc,
    currentTripId,
    newTrip&&newTrip.id,
    viewTrip&&viewTrip.id,
    wizStep,
    poiCurrentSignatureGlobal,
    routePlanSignature,
    JSON.stringify((Array.isArray(routePlan&&routePlan.destinations)?routePlan.destinations:[]).map(function(stop){
      return {
        destination:String(stop&&stop.destination||"").trim(),
        nearbySites:Array.isArray(stop&&stop.nearbySites)?stop.nearbySites.slice():[]
      };
    })),
    poiKeySignature(pois)
  ]);
  useEffect(function(){
    if(!loaded)return;
    if(!pendingTripJoinId)return;
    if(inviteTripFilterAppliedRef.current)return;
    inviteTripFilterAppliedRef.current=true;
    setTF("invited");
  },[loaded,pendingTripJoinId]);
  useEffect(function(){
    if(!loaded||!authToken||!pendingTripJoinId||!pendingTripJoinAction)return;
    processPendingTripInvite(authToken);
  },[loaded,authToken,pendingTripJoinId,pendingTripJoinAction]);
  useEffect(function(){
    if(!loaded||!authToken||sc!=="wizard"||wizStep!==1)return;
    refreshCrewFromBackend();
  },[loaded,authToken,sc,wizStep,currentTripId]);
  useEffect(function(){
    var activeTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip);
    if(!loaded||!authToken||sc!=="wizard"||wizStep!==1||!activeTripId)return;
    var members=(newTrip&&Array.isArray(newTrip.members))?newTrip.members:[];
    var pendingMembers=members.filter(function(m){return isTripInvitePending(m);});
    if(pendingMembers.length===0)return;
    if(tripInviteInFlightRef.current)return;
    var now=Date.now();
    var sendNow=pendingMembers.filter(function(m){
      var em=String(m&&m.email||"").trim().toLowerCase();
      if(!em)return false;
      var key=activeTripId+"|"+em;
      var last=Number(tripInviteAttemptRef.current[key]||0)||0;
      return (now-last)>15000;
    });
    if(sendNow.length===0)return;
    sendNow.forEach(function(m){
      var em=String(m&&m.email||"").trim().toLowerCase();
      if(!em)return;
      tripInviteAttemptRef.current[activeTripId+"|"+em]=now;
    });
    tripInviteInFlightRef.current=true;
    Promise.resolve(inviteSelectedMembersToTrip(activeTripId,sendNow)).finally(function(){
      tripInviteInFlightRef.current=false;
    });
  },[loaded,authToken,sc,wizStep,currentTripId,newTrip,viewTrip&&viewTrip.id]);
  useEffect(function(){
    if(!loaded||!authToken||sc!=="trip_detail"||!viewTrip)return;
    var tr=viewTrip||{};
    if(String(tr.status||"")!=="invited")return;
    var tripId=String(tr.id||"").trim();
    if(!tripId||!isUuidLike(tripId))return;
    if(autoTripAcceptRef.current[tripId])return;
    autoTripAcceptRef.current[tripId]=1;
    apiJson("/trips/"+tripId+"/respond",{method:"POST",body:{action:"accept"}},authToken).then(function(){
      setCM("Trip invite accepted. Moved to Planning.");
      setTF("planning");
      setPTJ("");
      setPTJA("");
      clearTripJoinFromUrl();
      setVT(function(prev){
        if(!prev||String(prev.id||"")!==tripId)return prev;
        return Object.assign({},prev,{status:"planning"});
      });
      refreshTripsFromBackend(authToken);
    }).catch(function(e){
      autoTripAcceptRef.current[tripId]=0;
      setCM("Trip invite could not be accepted: "+String(e&&e.message||"error"));
    });
  },[loaded,authToken,sc,viewTrip&&viewTrip.id,viewTrip&&viewTrip.status]);
  function clearInviteTokenFromUrl(){
    try{
      var sp=new URLSearchParams(window.location.search||"");
      sp.delete("invite_token");
      sp.delete("invite_action");
      var q=sp.toString();
      window.history.replaceState(null,"",window.location.pathname+(q?("?"+q):""));
    }catch(e){}
  }
  function clearTripJoinFromUrl(){
    try{
      var sp=new URLSearchParams(window.location.search||"");
      sp.delete("join_trip_id");
      sp.delete("trip_invite_action");
      var q=sp.toString();
      var hash=String(window.location.hash||"");
      var cleanHash=hash;
      var idx=hash.indexOf("?");
      if(idx>=0){
        var hp=new URLSearchParams(hash.substring(idx+1));
        hp.delete("tripId");
        hp.delete("join_trip_id");
        hp.delete("trip_invite_action");
        var hq=hp.toString();
        cleanHash=hash.substring(0,idx)+(hq?("?"+hq):"");
      }
      window.history.replaceState(null,"",window.location.pathname+(q?("?"+q):"")+cleanHash);
    }catch(e){}
  }
  async function copyCrewInviteLink(){
    var link=String(crewInviteLink||"").trim();
    if(!link)return;
    try{
      if(navigator&&navigator.clipboard&&typeof navigator.clipboard.writeText==="function"){
        await navigator.clipboard.writeText(link);
      }else{
        var ta=document.createElement("textarea");
        ta.value=link;
        ta.setAttribute("readonly","readonly");
        ta.style.position="fixed";
        ta.style.opacity="0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCICM("Invite link copied.");
    }catch(e){
      setCICM("Copy failed. Please copy manually.");
    }
    setTimeout(function(){setCICM("");},1800);
  }
  async function copyTextValue(text){
    var value=String(text||"").trim();
    if(!value)return false;
    try{
      if(navigator&&navigator.clipboard&&typeof navigator.clipboard.writeText==="function"){
        await navigator.clipboard.writeText(value);
      }else{
        var ta=document.createElement("textarea");
        ta.value=value;
        ta.setAttribute("readonly","readonly");
        ta.style.position="fixed";
        ta.style.opacity="0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      return true;
    }catch(e){
      return false;
    }
  }
  function flashTripShareMessage(text){
    setTSM(String(text||"").trim());
    setTimeout(function(){setTSM("");},2200);
  }
  async function copyTripShareSummary(trip){
    var ok=await copyTextValue(buildTripShareSummary(trip));
    flashTripShareMessage(ok?"Trip summary copied.":"Copy failed. Please copy manually.");
  }
  async function copyTripInviteLink(trip){
    var link=buildTripShareLink(trip,"accept");
    if(!link){
      flashTripShareMessage("Trip link unavailable.");
      return;
    }
    var ok=await copyTextValue(link);
    flashTripShareMessage(ok?"Trip link copied.":"Copy failed. Please copy manually.");
  }
  function shareTripViaWhatsApp(trip){
    var url=buildWhatsAppShareUrl(buildTripWhatsAppText(trip));
    if(!url){
      flashTripShareMessage("WhatsApp share unavailable.");
      return;
    }
    try{
      window.open(url,"_blank","noopener,noreferrer");
      flashTripShareMessage("Opened WhatsApp share.");
    }catch(e){
      flashTripShareMessage("Could not open WhatsApp share.");
    }
  }
  async function acceptPendingInvite(token,inviteTokenOverride,inviteActionOverride){
    var inviteToken=(String(inviteTokenOverride||"").trim()||(pendingInviteToken||"").trim()||readInviteTokenFromUrl());
    if(!inviteToken||!token)return;
    var actRaw=(String(inviteActionOverride||"").trim().toLowerCase()||String(pendingInviteAction||"").trim().toLowerCase()||readInviteActionFromUrl());
    var act=actRaw==="reject"?"reject":"accept";
    try{
      await apiJson("/crew/invites/respond",{method:"POST",body:{invite_token:inviteToken,action:act}},token);
      setCM(act==="reject"?"Crew invite rejected.":"Crew invite accepted.");
      setPIT("");
      setPIA("accept");
      clearInviteTokenFromUrl();
      await refreshCrewFromBackend();
    }catch(e){
      setCM("Invite found but could not be processed yet: "+String(e&&e.message||"error"));
    }
  }
  async function processPendingTripInvite(token,tripIdOverride,tripActionOverride){
    var tripId=(String(tripIdOverride||"").trim()||(pendingTripJoinId||"").trim()||readJoinTripIdFromUrl());
    if(!tripId||!token)return false;
    var rawAction=(String(tripActionOverride||"").trim().toLowerCase()||String(pendingTripJoinAction||"").trim().toLowerCase()||readTripInviteActionFromUrl());
    if(!rawAction)return false;
    var action=(rawAction==="reject"||rawAction==="decline")?"reject":"accept";
    try{
      await apiJson("/trips/"+tripId+"/respond",{method:"POST",body:{action:action}},token);
      setCM(action==="reject"?"Trip invite rejected.":"Trip invite accepted.");
      if(action==="accept")setTF("planning");
      setPTJ("");
      setPTJA("");
      clearTripJoinFromUrl();
      await refreshTripsFromBackend(token);
      return true;
    }catch(e){
      setCM("Trip invite could not be processed: "+String(e&&e.message||"error"));
      return false;
    }
  }
  async function loginUser(){
    setAE("");
    setAI("");
    setSigninLoad(true);
    var email=(user.email||"").trim().toLowerCase();
    var isValidEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(!email||!signinPass){setAE("Enter email and password.");setSigninLoad(false);return;}
    if(!isValidEmail){setAE("Please enter a valid email address.");setSigninLoad(false);return;}
    try{
      var reg=await apiJson("/auth/login",{method:"POST",body:{email:email,password:signinPass}});
      if(reg&&reg.accessToken){
        if(rememberCreds){
          sv("wp-login-creds",{remember:true,email:email,password:signinPass});
        }else{
          sv("wp-login-creds",{remember:false,email:"",password:""});
        }
        setAT(reg.accessToken);
        var loginBaseUser=Object.assign(emptyUserState(),{email:email,name:String(reg.name||"").trim()});
        await acceptPendingInvite(reg.accessToken);
        await processPendingTripInvite(reg.accessToken);
        await hydrateSignedInSession(reg.accessToken,{baseUser:loginBaseUser,email:email,name:reg.name});
        go("dash");
      }
    }catch(e){
      var msg=String(e&&e.message||"Sign in failed");
      if((msg||"").toLowerCase().indexOf("user not found")>=0){
        setAuthMode("signup");
        setAE("Account not found. Please sign up.");
      }else{
        setAE(msg);
      }
    }
    setSigninLoad(false);
  }

  async function signupUser(){
    setAE("");
    setAI("");
    setSigninLoad(true);
    var email=(user.email||"").trim().toLowerCase();
    var name=(user.name||"").trim();
    if(!email||!signinPass){setAE("Enter name, email and password.");setSigninLoad(false);return;}
    try{
      var reg=await apiJson("/auth/register",{method:"POST",body:{email:email,password:signinPass,name:name}});
      if(reg&&reg.accessToken){
        if(rememberCreds){
          sv("wp-login-creds",{remember:true,email:email,password:signinPass});
        }else{
          sv("wp-login-creds",{remember:false,email:"",password:""});
        }
        setAT(reg.accessToken);
        var signupBaseUser=Object.assign(emptyUserState(),user||{},{email:email,name:name||String(reg.name||"").trim()||String(user&&user.name||"").trim()});
        await acceptPendingInvite(reg.accessToken);
        await processPendingTripInvite(reg.accessToken);
        await hydrateSignedInSession(reg.accessToken,{baseUser:signupBaseUser,email:email,name:signupBaseUser.name});
        go("ob1");
      }
    }catch(e){setAE(String(e&&e.message||"Sign up failed"));}
    setSigninLoad(false);
  }

  async function forgotPassword(){
    setAE("");
    setAI("");
    setSigninLoad(true);
    var email=(user.email||"").trim().toLowerCase();
    if(!email||!resetPass){setAE("Enter email and new password.");setSigninLoad(false);return;}
    try{
      var r=await apiJson("/auth/password-reset",{method:"POST",body:{email:email,new_password:resetPass}});
      setAI((r&&r.message)||"If an account exists for this email, the password has been updated");
      setResetPass("");
      setSigninPass("");
      setAuthMode("signin");
    }catch(e){setAE(String(e&&e.message||"Password reset failed"));}
    setSigninLoad(false);
  }

  function updateBucketItemLocal(newItem){
    setBucket(function(p){
      var key=(newItem.id||newItem.name||"").toString();
      var exists=false;
      var out=p.map(function(x){if((x.id||x.name||"").toString()===key){exists=true;return newItem;}return x;});
      return exists?out:out.concat([newItem]);
    });
  }

  function destinationTripKey(dest){
    var nm=String(dest&&dest.name||"").trim().toLowerCase();
    var ct=String(dest&&dest.country||"").trim().toLowerCase();
    return nm+"|"+ct;
  }

  function applyTripDestinationValuesLocal(nextValues,tripIdOverride){
    var normalizedNames=tripDestinationNamesFromValues(nextValues,bucket);
    var normalizedValues=normalizedNames.slice();
    var tid=String(tripIdOverride||resolveWizardTripId(currentTripId,newTrip,viewTrip)).trim();
    setNT(function(prev){
      return Object.assign({},prev||{},{
        dests:normalizedValues.slice(),
        destNames:normalizedNames.join(" + ")
      });
    });
    if(tid){
      setTrips(function(prev){
        return (prev||[]).map(function(t){
          if(!t||String(t.id||"")!==tid)return t;
          return Object.assign({},t,{
            dests:normalizedValues.slice(),
            destNames:normalizedNames.join(" + "),
            destinations:normalizedValues.slice()
          });
        });
      });
      setVT(function(prev){
        if(!prev||String(prev.id||"")!==tid)return prev;
        return Object.assign({},prev,{
          dests:normalizedValues.slice(),
          destNames:normalizedNames.join(" + "),
          destinations:normalizedValues.slice()
        });
      });
    }
    return normalizedValues;
  }

  function persistTripDestinations(nextValues,tripIdOverride){
    var tid=String(tripIdOverride||resolveWizardTripId(currentTripId,newTrip,viewTrip)).trim();
    var destNames=tripDestinationNamesFromValues(nextValues,bucket);
    if(!(authToken&&tid&&isUuidLike(tid)))return Promise.resolve(destNames);
    return apiJson("/trips/"+tid+"/destinations",{method:"PUT",body:{destinations:destNames,votes:{}}},authToken).then(function(res){
      var sharedNames=(res&&Array.isArray(res.destinations)?res.destinations:[]).map(function(row){
        return String((row&&row.name)||row||"").trim();
      }).filter(Boolean);
      var resolvedNames=sharedNames.length>0?sharedNames:destNames;
      applyTripDestinationValuesLocal(resolvedNames,tid);
      setDSM("");
      return resolvedNames;
    }).catch(function(err){
      setDSM("Could not sync destinations: "+String(err&&err.message||"error"));
      throw err;
    });
  }

  function addBucketSuggestionsToLocalBucket(items){
    (Array.isArray(items)?items:[]).forEach(function(it,idx){
      var name=String(it&&it.name||"").trim();
      if(!name)return;
      updateBucketItemLocal({
        id:String(it&&it.id||("trip-ai-dest-"+Date.now()+"-"+idx)),
        name:name,
        country:String(it&&it.country||"").trim(),
        bestMonths:Array.isArray(it&&it.bestMonths)?it.bestMonths:[],
        costPerDay:Number(it&&it.costPerDay||0)||0,
        tags:Array.isArray(it&&it.tags)?it.tags:[],
        bestTimeDesc:String(it&&it.bestTimeDesc||"").trim(),
        costNote:String(it&&it.costNote||"").trim()
      });
    });
  }

  function mergePersistedBucketItem(item, fallback){
    var resolved=item||{};
    var base=fallback||{};
    return Object.assign({},resolved,{
      id:resolved.id||base.id,
      name:resolved.name||base.name,
      country:resolved.country||base.country,
      bestMonths:resolved.bestMonths||base.bestMonths,
      costPerDay:resolved.costPerDay||base.costPerDay,
      tags:resolved.tags||base.tags,
      bestTimeDesc:resolved.bestTimeDesc||base.bestTimeDesc,
      costNote:resolved.costNote||base.costNote
    });
  }

  function searchDestinationsForTrip(){
    var msg=String(newTripDestInput||"").trim();
    if(!msg||tripDestSearchLoad)return;
    setTDSL(true);
    setDSM("");
    askLLM(msg,user.budget,blChat).then(function(res){
      var items=(res&&res.type==="destinations"&&Array.isArray(res.items))?res.items:[];
      if(items.length===0){
        setDSM(String(res&&res.message||"Could not find destination suggestions. Try a city or country."));
        setTDSL(false);
        return;
      }
      addBucketSuggestionsToLocalBucket(items);
      var currentValues=Array.isArray(newTrip&&newTrip.dests)?newTrip.dests.slice():[];
      var nextValues=currentValues.slice();
      items.forEach(function(it){
        nextValues=addTripDestinationValue(nextValues,it&&it.name);
      });
      if(nextValues.length===currentValues.length){
        setDSM("Those destinations are already on this trip.");
        setTDSL(false);
        return;
      }
      applyTripDestinationValuesLocal(nextValues);
      setNTDI("");
      setDSM("Added "+items.map(function(it){return String(it&&it.name||"").trim();}).filter(Boolean).join(", ")+" to this trip.");
      persistTripDestinations(nextValues).catch(function(){});
      setTDSL(false);
    }).catch(function(err){
      setDSM("Destination search failed: "+String(err&&err.message||"error"));
      setTDSL(false);
    });
  }

  function addDestinationToNewTrip(value){
    var normalized=normalizeTripDestinationValue(value);
    if(!normalized)return false;
    var currentValues=Array.isArray(newTrip&&newTrip.dests)?newTrip.dests:[];
    var nextValues=addTripDestinationValue(currentValues,normalized);
    applyTripDestinationValuesLocal(nextValues);
    persistTripDestinations(nextValues).catch(function(){});
    setDSM("");
    return true;
  }

  function removeDestinationFromNewTrip(value){
    var normalized=normalizeTripDestinationValue(value);
    if(!normalized)return;
    var currentValues=Array.isArray(newTrip&&newTrip.dests)?newTrip.dests:[];
    var nextDests=removeTripDestinationValue(currentValues,normalized);
    (Array.isArray(bucket)?bucket:[]).forEach(function(item){
      if(normalizeTripDestinationValue(item&&item.name).toLowerCase()===normalized.toLowerCase()){
        nextDests=removeTripDestinationValue(nextDests,item.id);
      }
    });
    applyTripDestinationValuesLocal(nextDests);
    persistTripDestinations(nextDests).catch(function(){});
    setDSM("");
  }

  function pickDestinationForTrip(dest){
    var picked=normalizeTripDestinationValue(dest&&dest.name);
    if(!picked)return;
    addDestinationToNewTrip(picked);
    var activeTripId=String(resolveWizardTripId(currentTripId,newTrip,viewTrip)||"").trim();
    if(activeTripId&&isUuidLike(activeTripId)){
      setCTID(activeTripId);
      setWS(0);
      go("wizard");
      return;
    }
    setCM("Destination selected for your next trip. Continue in Plan a New Trip.");
    go("new_trip");
  }

  function isPersistedBucketItem(dest){
    var id=String(dest&&dest.id||"").trim();
    if(!id)return false;
    return !/^d\d+/.test(id)&&id.indexOf("tmp-")!==0;
  }

  async function saveBucketDestination(dest){
    if(!dest)return;
    var nm=String(dest.name||"").trim()||"Destination";
    if(isPersistedBucketItem(dest)){setBM(nm+" already saved.");setTimeout(function(){setBM("");},1800);return;}
    if(!authToken){setBM("Sign in required to save bucket destinations.");setTimeout(function(){setBM("");},2200);return;}
    setBM("Saving "+nm+"...");
    try{
      var r=await apiJson("/me/bucket-list",{method:"POST",body:{
        destination:nm,
        country:String(dest.country||""),
        tags:Array.isArray(dest.tags)?dest.tags:[],
        best_months:Array.isArray(dest.bestMonths)?dest.bestMonths:[],
        cost_per_day:Number(dest.costPerDay||0)||0,
        best_time_desc:String(dest.bestTimeDesc||""),
        cost_note:String(dest.costNote||"")
      }},authToken);
      var item=(r&&r.item)?r.item:{};
      updateBucketItemLocal({
        id:item.id||dest.id,
        name:item.name||item.destination||dest.name,
        country:item.country||dest.country||"",
        bestMonths:item.bestMonths||item.best_months||dest.bestMonths||[],
        costPerDay:Number(item.costPerDay||item.cost_per_day||dest.costPerDay||0)||0,
        tags:item.tags||dest.tags||[],
        bestTimeDesc:item.bestTimeDesc||item.best_time_desc||dest.bestTimeDesc||"",
        costNote:item.costNote||item.cost_note||dest.costNote||""
      });
      setBM(nm+" saved.");
    }catch(e){
      setBM("Could not save "+nm+": "+String(e&&e.message||"error"));
    }
    setTimeout(function(){setBM("");},2200);
  }

  function removeBucketDestination(dest){
    if(!dest)return;
    setBucket(function(p){return p.filter(function(x){return x.id!==dest.id;});});
    if(authToken&&dest.id){apiJson("/me/bucket-list/"+dest.id,{method:"DELETE"},authToken).catch(function(){});}
    setBM((dest.name||"Destination")+" removed.");
    setTimeout(function(){setBM("");},1800);
  }

  async function sendCrewInvite(opts){
    var o=opts||{};
    if(!invEmail)return null;
    var email=invEmail.trim().toLowerCase();
    if(!email)return null;
    setCICM("");
    setCIL("");
    if(!authToken){setCM("Sign in required to send invites.");return null;}
    if(!user.email||String(user.email).indexOf("@")<0){setCM("Account email missing. Please sign out and sign in again.");return null;}
    var existing=(crew||[]).find(function(m){return String(m&&m.email||"").trim().toLowerCase()===email;});
    if(existing&&existing.status==="accepted"){
      if(o.selectForTrip){
        setNT(function(p){
          var ms=Array.isArray(p.members)?p.members:[];
          var already=ms.some(function(x){return x.id===existing.id||String(x.email||"").trim().toLowerCase()===email;});
          if(already)return p;
          return Object.assign({},p,{members:ms.concat([toTripMember(existing,"selected")])});
        });
      }
      setIE("");
      setCM("Already in crew: "+email);
      return existing;
    }
    setCM("Sending invite...");
    try{
      var r=await apiJson("/crew/invite-email",{method:"POST",body:{inviter_email:user.email||"owner@example.com",inviter_name:user.name||"Owner",invitee_email:email}},authToken);
      var id=(existing&&existing.id)||("m"+Date.now());
      var ini=(existing&&existing.ini)||email.substring(0,2).toUpperCase();
      var inviteStatus=(r&&r.email_sent)?"pending":"link_only";
      var item=Object.assign({},existing||{},{
        id:id,
        name:(existing&&existing.name)||email.split("@")[0],
        ini:ini,
        color:(existing&&existing.color)||C.purp,
        status:inviteStatus,
        email:email,
        relation:"invitee"
      });
      setCrew(function(prev){
        var p=Array.isArray(prev)?prev:[];
        var idx=p.findIndex(function(m){return String(m&&m.email||"").trim().toLowerCase()===email;});
        if(idx<0)return p.concat([item]);
        var n=p.slice();n[idx]=Object.assign({},n[idx],item);return n;
      });
      if(o.selectForTrip){
        setNT(function(p){
          var ms=Array.isArray(p.members)?p.members:[];
          var already=ms.some(function(x){return x.id===item.id||String(x.email||"").trim().toLowerCase()===email;});
          if(already)return p;
          return Object.assign({},p,{members:ms.concat([toTripMember(item,"selected")])});
        });
      }
      setIE("");
      if(r&&r.email_sent){
        setCIL("");
        setCM("Invite email sent.");
      }else{
        var link=(r&&r.invite_link)?String(r.invite_link).trim():"";
        if(link)setCIL(link);
        setCM(link?"Email not sent. Copy and share this invite link.":"Email not sent and invite link unavailable.");
      }
      setTimeout(function(){refreshCrewFromBackend();},1200);
      return item;
    }catch(e){
      setCIL("");
      setCM("Invite failed: "+String(e&&e.message||"error"));
      return null;
    }
  }

  async function inviteSelectedMembersToTrip(tripId,members){
    var tripIdStr=String(tripId||"").trim();
    if(!authToken||!tripIdStr||!Array.isArray(members)||members.length===0)return;
    if(!isUuidLike(tripIdStr)){
      setTIM("Trip session is missing. Go back to Create and save the trip first.");
      return;
    }
    var sent=0;
    var failed=[];
    var statusByEmail={};
    var joinedIds={};
    var newInviteLinks={};
    var skipped=0;
    for(var i=0;i<members.length;i++){
      var m=members[i]||{};
      var email=String(m.email||"").trim().toLowerCase();
      if(!email){failed.push((m.name||("member "+(i+1)))+": missing email");continue;}
      var currentStatus=mapTripMemberStatus(m.trip_status||m.status);
      if(currentStatus==="accepted"||currentStatus==="invited"||currentStatus==="link_only"){
        skipped++;
        continue;
      }
      try{
        var ir=await apiJson("/trips/"+tripIdStr+"/members",{method:"POST",body:{email:email,role:"member"}},authToken);
        var emailWasSent=!!(ir&&ir.email_sent);
        var mappedStatus=emailWasSent?mapTripMemberStatus(ir&&ir.status):"link_only";
        statusByEmail[email]=mappedStatus;
        if(mappedStatus==="accepted"&&m.id)joinedIds[m.id]=true;
        if(!emailWasSent&&ir&&ir.accept_link){
          newInviteLinks[email]={accept_link:String(ir.accept_link),reject_link:String(ir.reject_link||"")};
        }
        sent++;
      }catch(e){
        failed.push(email+": "+String(e&&e.message||"invite failed"));
      }
    }
    if(Object.keys(newInviteLinks).length>0){
      setTIL(function(prev){return Object.assign({},prev,newInviteLinks);});
    }
    if(Object.keys(statusByEmail).length>0){
      setNT(function(prev){
        if(!prev)return prev;
        var ms=(Array.isArray(prev.members)?prev.members:[]).map(function(mm){
          var em=String(mm&&mm.email||"").trim().toLowerCase();
          if(!em||statusByEmail[em]===undefined)return mm;
          return toTripMember(mm,statusByEmail[em]);
        });
        return Object.assign({},prev,{members:ms});
      });
      setTrips(function(prev){
        return (prev||[]).map(function(t){
          if(!t||t.id!==tripIdStr)return t;
          var ms=(Array.isArray(t.members)?t.members:[]).map(function(mm){
            var em=String(mm&&mm.email||"").trim().toLowerCase();
            if(!em||statusByEmail[em]===undefined)return mm;
            return toTripMember(mm,statusByEmail[em]);
          });
          return Object.assign({},t,{members:ms});
        });
      });
    }
    if(Object.keys(joinedIds).length>0){
      setTJ(function(prev){return Object.assign({},prev,joinedIds);});
    }
    if(failed.length===0&&sent>0){
      setTIM("Trip invites sent to "+sent+" member"+(sent>1?"s":"")+".");
      return;
    }
    if(sent>0&&failed.length>0){
      setTIM("Trip invites sent to "+sent+" member"+(sent>1?"s":"")+". Failed: "+failed.slice(0,2).join(" | "));
      return;
    }
    if(sent===0&&failed.length===0&&skipped>0){
      setTIM("Trip invites already sent for selected members.");
      return;
    }
    if(failed.length>0){
      setTIM("Trip invite failed: "+failed.slice(0,2).join(" | "));
    }
  }

  function sendBL(){
    if(!blIn.trim()||blLoad||blInFlightRef.current)return;var msg=blIn.trim();setBLI("");
    blInFlightRef.current=true;
    setBC(function(p){return p.concat([{from:"user",text:msg}]);});setBLL(true);
    askLLM(msg,user.budget,blChat).then(function(res){
      if(res&&res.type==="destinations"&&Array.isArray(res.items)&&res.items.length){
        var proposed=[];
        var proposedSeen={};
        for(var k=0;k<res.items.length;k++){
          var it0=res.items[k]||{};
          var n0=String(it0.name||"").trim();
          if(!n0)continue;
          var existingMatch0=bucket.find(function(savedItem){
            return shouldTreatBucketItemsAsSameDestination(savedItem,{name:n0,country:it0.country});
          })||null;
          var c0=String(it0.country||"").trim();
          if(!c0&&existingMatch0)c0=String(existingMatch0.country||"").trim();
          var pKey=n0.toLowerCase()+"|"+c0.toLowerCase();
          if(proposedSeen[pKey])continue;
          proposedSeen[pKey]=true;
          var normalizedItem0={
            name:n0,
            country:c0,
            bestMonths:Array.isArray(it0.bestMonths)?it0.bestMonths:[],
            costPerDay:Number(it0.costPerDay||0)||0,
            tags:Array.isArray(it0.tags)?it0.tags:[],
            bestTimeDesc:String(it0.bestTimeDesc||""),
            costNote:String(it0.costNote||"")
          };
          proposed.push(existingMatch0?mergeBucketItemDetails(existingMatch0,normalizedItem0):normalizedItem0);
        }
        var existing={};
        bucket.forEach(function(b){
          var key=(String(b.name||"").trim().toLowerCase()+"|"+String(b.country||"").trim().toLowerCase());
          if(key!=="|")existing[key]=true;
        });
        var toAdd=[];
        for(var i=0;i<proposed.length;i++){
          var it=proposed[i]||{};
          var nm=String(it.name||"").trim();
          if(!nm)continue;
          var ct=String(it.country||"").trim();
          var existingMatch=bucket.find(function(savedItem){
            return shouldTreatBucketItemsAsSameDestination(savedItem,{name:nm,country:ct});
          })||null;
          if(existingMatch){
            var refreshed=mergeBucketItemDetails(existingMatch,it);
            updateBucketItemLocal(refreshed);
            continue;
          }
          var key=(nm.toLowerCase()+"|"+ct.toLowerCase());
          if(existing[key])continue;
          existing[key]=true;
          toAdd.push({
            id:"d"+Date.now()+"-"+i,
            name:nm,
            country:ct,
            bestMonths:Array.isArray(it.bestMonths)?it.bestMonths:[],
            costPerDay:Number(it.costPerDay||0)||0,
            tags:Array.isArray(it.tags)?it.tags:[],
            bestTimeDesc:String(it.bestTimeDesc||""),
            costNote:String(it.costNote||"")
          });
        }
        if(!toAdd.length){
          setBC(function(p){return p.concat([{from:"agent",text:"Those places are already in your bucket list. Pick destinations from Bucket List cards when you start planning a trip.",suggestions:proposed}]);});
          return;
        }

        var names=toAdd.map(function(d){return d.name;}).join(", ");
        var interestCue=summarizeActiveInterests(user&&user.interests);
        var responseText="Added "+names+" to your bucket list. Destinations become part of planning only after you pick them in Plan a New Trip.";
        if(interestCue){
          responseText+=" Matched with your interests: "+interestCue+".";
        }
        setBC(function(p){return p.concat([{from:"agent",text:responseText,suggestions:proposed}]);});
        toAdd.forEach(function(d){
          updateBucketItemLocal(d);
        });

        function persistAt(idx){
          if(idx>=toAdd.length){
            return;
          }
          var d=toAdd[idx];
          if(authToken){
            apiJson("/me/bucket-list",{method:"POST",body:{
              destination:d.name,country:d.country,tags:d.tags||[],best_months:d.bestMonths||[],
              cost_per_day:d.costPerDay||0,best_time_desc:d.bestTimeDesc||"",cost_note:d.costNote||""
            }},authToken).then(function(saved){
              var item=(saved&&saved.item)?saved.item:d;
              updateBucketItemLocal(mergePersistedBucketItem(item,d));
              persistAt(idx+1);
            }).catch(function(){
              persistAt(idx+1);
            });
          }else{
            persistAt(idx+1);
          }
        }
        persistAt(0);
      }else{
        setBC(function(p){return p.concat([{from:"agent",text:(res&&res.message)||"Tell me more?"}]);});
      }
    }).catch(function(){
      setBC(function(p){return p.concat([{from:"agent",text:"I ran into an issue processing that request. Please try again."}]);});
    }).finally(function(){
      blInFlightRef.current=false;
      setBLL(false);
    });
  }

  var acc=crew.filter(function(m){return m.status==="accepted";});
  var pendingCrewCount=crew.filter(function(m){return m.status==="pending"||m.status==="invited";}).length;
  var inDash=sc==="dash"||sc==="profile"||sc==="crew"||sc==="bucket"||sc==="analytics"||sc==="new_trip"||sc==="wizard"||sc==="trip_detail"||sc==="companion";
  var isPhone=vpW<=480;
  var isNarrow=vpW<=768;
  var pagePad=isNarrow?12:24;
  var formPad=isPhone?20:40;
  var landingPadX=isPhone?16:44;
  var crewInviteLinkUI=crewInviteLink?(<div style={{marginTop:8,marginBottom:10,padding:"10px 12px",borderRadius:10,background:C.bg,border:"1px solid "+C.border}}>
    <p style={{fontSize:11,color:C.tx3,marginBottom:6}}>Invite link</p>
    <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <input value={crewInviteLink} readOnly style={{flex:1,padding:"9px 11px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:12,color:C.tx2}}/>
      <button onClick={copyCrewInviteLink} style={{padding:"8px 12px",borderRadius:8,border:"none",background:C.gold,color:C.bg,fontSize:12,fontWeight:600,cursor:"pointer"}}>Copy link</button>
    </div>
    {crewInviteCopyMsg&&<p style={{fontSize:11,color:C.grn,marginTop:6}}>{crewInviteCopyMsg}</p>}
  </div>):null;

  if(!loaded)return(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.tx2}}><style>{"body{margin:0}"}</style>Loading...</div>);

  var CSS="body{margin:0;overflow-x:hidden}*{box-sizing:border-box}button{font-family:inherit;cursor:pointer}input{min-width:0}::placeholder{color:rgba(255,255,255,.22)}input:focus,button:focus{outline:none}@keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.35}40%{transform:scale(1);opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}@supports(backdrop-filter:blur(16px)){.glass{backdrop-filter:blur(16px)}}";

  return(
    <div style={{fontFamily:"system-ui,-apple-system,sans-serif",background:C.bg,color:"#fff",minHeight:"100vh",overflowX:"hidden"}}>
      <style>{CSS}</style>
      <div style={{opacity:fade?0:1,transition:"opacity .2s"}}>

{sc==="landing"&&(<div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 25% 45%,"+C.bg2+","+C.bg+" 55%)"}}>
  <Fade delay={80}><nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:(isPhone?"16px ":"22px ")+landingPadX+"px",gap:10}}><div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}><div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,"+C.gold+","+C.coral+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,flexShrink:0}}>W</div><span style={{fontSize:isPhone?18:20,fontWeight:700,whiteSpace:"nowrap"}}>WanderPlan</span></div><button onClick={function(){go("signup");}} style={{fontSize:13.5,fontWeight:600,color:C.bg,background:C.gold,border:"none",borderRadius:9,padding:isPhone?"8px 14px":"9px 22px",cursor:"pointer",whiteSpace:"nowrap"}}>Get Started</button></nav></Fade>
  <div style={{maxWidth:680,margin:"0 auto",padding:(isPhone?"52px ":"80px ")+landingPadX+"px 50px"}}>
    <Fade delay={200}><h1 style={{fontSize:44,fontWeight:700,lineHeight:1.1,marginBottom:22}}>Dream it today. <span style={{color:C.gold}}>Plan it</span> when ready.</h1></Fade>
    <Fade delay={400}><p style={{fontSize:17,color:C.tx2,maxWidth:460,lineHeight:1.7,marginBottom:38}}>Save destinations as you discover them. Build your crew. 14 AI agents build your perfect trip.</p></Fade>
    <Fade delay={600}><button onClick={function(){go("signup");}} style={{fontSize:16,fontWeight:600,color:C.bg,padding:"17px 42px",borderRadius:13,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Start your bucket list</button></Fade>
  </div>
</div>)}

{sc==="signup"&&(<div style={{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 60%,"+C.bg2+","+C.bg+")",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:400,width:"100%",padding:formPad}}>
  <Fade delay={100}><div style={{textAlign:"center",marginBottom:36}}><div style={{width:44,height:44,borderRadius:12,margin:"0 auto 18px",background:"linear-gradient(135deg,"+C.gold+","+C.coral+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700}}>W</div><h2 style={{fontSize:32,fontWeight:700,marginBottom:8}}>{authMode==="signup"?"Sign Up":(authMode==="forgot"?"Forgot Password":"Sign In")}</h2></div></Fade>
  <Fade delay={300}><div style={{display:"flex",flexDirection:"column",gap:12}}>
    {authMode==="signup"&&<input placeholder="Name" value={user.name} onChange={function(e){upU("name",e.target.value);}} style={{width:"100%",padding:"13px 16px",borderRadius:11,background:C.surface,border:"1.5px solid "+C.border,fontSize:14.5,color:"#fff"}}/>}
    <input placeholder="Email" type="email" value={user.email} onChange={function(e){upU("email",e.target.value);}} style={{width:"100%",padding:"13px 16px",borderRadius:11,background:C.surface,border:"1.5px solid "+C.border,fontSize:14.5,color:"#fff"}}/>
    {authMode==="forgot"?
      <input placeholder="New password" type="password" value={resetPass} onChange={function(e){setResetPass(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")forgotPassword();}} style={{width:"100%",padding:"13px 16px",borderRadius:11,background:C.surface,border:"1.5px solid "+C.border,fontSize:14.5,color:"#fff"}}/>:
      <input placeholder="Password" type="password" value={signinPass} onChange={function(e){setSigninPass(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){if(authMode==="signup")signupUser();else loginUser();}}} style={{width:"100%",padding:"13px 16px",borderRadius:11,background:C.surface,border:"1.5px solid "+C.border,fontSize:14.5,color:"#fff"}}/>
    }
    {authMode!=="forgot"&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.tx2,cursor:"pointer"}}><input type="checkbox" checked={rememberCreds} onChange={function(e){setRememberCreds(!!e.target.checked);}} style={{accentColor:C.gold,width:14,height:14}}/>Remember credentials</label>}
    <button onClick={authMode==="signup"?signupUser:(authMode==="forgot"?forgotPassword:loginUser)} disabled={signinLoad} style={{width:"100%",marginTop:4,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:signinLoad?C.border:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:signinLoad?"default":"pointer"}}>{signinLoad?(authMode==="signup"?"Creating account...":(authMode==="forgot"?"Resetting password...":"Signing in...")):(authMode==="signup"?"Create Account":(authMode==="forgot"?"Reset Password":"Sign In"))}</button>
    {authErr&&<p style={{fontSize:12,color:C.red}}>{authErr}</p>}
    {authInfo&&<p style={{fontSize:12,color:C.grn}}>{authInfo}</p>}
    {authMode==="signin"&&<button onClick={function(){setAE("");setAI("");setAuthMode("forgot");}} style={{background:"none",border:"none",color:C.tealL,fontSize:12,padding:0,textAlign:"left",cursor:"pointer"}}>Forgot password?</button>}
    {authMode==="signin"&&<button onClick={function(){setAE("");setAI("");setAuthMode("signup");}} style={{background:"none",border:"none",color:C.tealL,fontSize:12,padding:0,textAlign:"left",cursor:"pointer"}}>No account? Sign Up</button>}
    {(authMode==="signup"||authMode==="forgot")&&<button onClick={function(){setAE("");setAI("");setAuthMode("signin");}} style={{background:"none",border:"none",color:C.tealL,fontSize:12,padding:0,textAlign:"left",cursor:"pointer"}}>Back to Sign In</button>}
  </div></Fade>
</div></div>)}

{sc==="ob1"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:440,width:"100%",padding:formPad}}><Fade delay={100}><div style={{height:3,background:C.border,borderRadius:2,marginBottom:32}}><div style={{height:"100%",width:"20%",background:"linear-gradient(90deg,"+C.gold+","+C.coral+")",borderRadius:2}}/></div><p style={{fontSize:12,color:C.goldT,marginBottom:8}}>STEP 1 OF 5</p><h2 style={{fontSize:28,fontWeight:700,marginBottom:6}}>What should we call you?</h2><p style={{fontSize:14,color:C.tx2,marginBottom:28}}>How your crew sees you.</p><input placeholder="Your name" value={user.name} onChange={function(e){upU("name",e.target.value);}} style={{width:"100%",padding:"14px 16px",borderRadius:12,background:C.surface,border:"1.5px solid "+C.border,fontSize:16,color:"#fff"}}/>{user.name.length>0&&<button onClick={function(){go("ob2");}} style={{width:"100%",marginTop:14,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Continue</button>}</Fade></div></div>)}

{sc==="ob2"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:440,width:"100%",padding:formPad}}><Fade delay={100}><div style={{height:3,background:C.border,borderRadius:2,marginBottom:32}}><div style={{height:"100%",width:"40%",background:"linear-gradient(90deg,"+C.gold+","+C.coral+")",borderRadius:2}}/></div><p style={{fontSize:12,color:C.goldT,marginBottom:8}}>STEP 2 OF 5</p><h2 style={{fontSize:28,fontWeight:700,marginBottom:6}}>How do you travel?</h2><p style={{fontSize:14,color:C.tx2,marginBottom:24}}>Select all that apply.</p><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>{STYLES.map(function(ts){var sel=(user.styles||[]).indexOf(ts.id)>=0;return(<button key={ts.id} onClick={function(){var cur=user.styles||[];upU("styles",cur.indexOf(ts.id)>=0?cur.filter(function(x){return x!==ts.id;}):cur.concat([ts.id]));}} style={{padding:"22px 16px",borderRadius:14,textAlign:"center",cursor:"pointer",background:sel?C.goldDim:C.surface,border:"2px solid "+(sel?C.gold+"50":C.border),color:sel?C.goldT:C.tx2,fontSize:15,fontWeight:sel?600:400}}>{ts.l}</button>);})}</div>{(user.styles||[]).length>0&&<button onClick={function(){go("ob3");}} style={{width:"100%",marginTop:14,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Continue</button>}</Fade></div></div>)}

{sc==="ob3"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:440,width:"100%",padding:formPad}}><Fade delay={100}><div style={{height:3,background:C.border,borderRadius:2,marginBottom:32}}><div style={{height:"100%",width:"60%",background:"linear-gradient(90deg,"+C.gold+","+C.coral+")",borderRadius:2}}/></div><p style={{fontSize:12,color:C.goldT,marginBottom:8}}>STEP 3 OF 5</p><h2 style={{fontSize:28,fontWeight:700,marginBottom:6}}>What excites you?</h2><p style={{fontSize:14,color:C.tx2,marginBottom:24}}>Same questions your crew answers later.</p><div style={{display:"flex",flexDirection:"column",gap:7}}>{CATS.map(function(cat){var v=(user.interests||{})[cat.id];return(<div key={cat.id} style={{background:C.surface,borderRadius:12,padding:"12px 16px",border:"1px solid "+C.border,display:"flex",alignItems:"center",gap:12}}><span style={{flex:1,fontSize:14,color:C.tx2}}>{cat.q}</span><div style={{display:"flex",gap:5}}>{[{l:"Yes",v:true,c:C.grn},{l:"No",v:false,c:C.red}].map(function(o){var a=v===o.v;return(<button key={o.l} onClick={function(){var n=Object.assign({},user.interests||{});n[cat.id]=o.v;upU("interests",n);}} style={{padding:"5px 13px",borderRadius:8,border:a?"2px solid "+o.c:"1.5px solid "+C.border,background:a?o.c+"12":"transparent",color:a?o.c:C.tx3,fontWeight:600,fontSize:13,cursor:"pointer"}}>{o.l}</button>);})}</div></div>);})}</div>{Object.keys(user.interests||{}).length>=4&&<button onClick={function(){go("ob4");}} style={{width:"100%",marginTop:14,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Continue</button>}</Fade></div></div>)}

{sc==="ob4"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:440,width:"100%",padding:formPad}}><Fade delay={100}><div style={{height:3,background:C.border,borderRadius:2,marginBottom:32}}><div style={{height:"100%",width:"80%",background:"linear-gradient(90deg,"+C.gold+","+C.coral+")",borderRadius:2}}/></div><p style={{fontSize:12,color:C.goldT,marginBottom:8}}>STEP 4 OF 5</p><h2 style={{fontSize:28,fontWeight:700,marginBottom:6}}>Budget comfort zone?</h2><div style={{display:"flex",flexDirection:"column",gap:8}}>{BUDGETS.map(function(b){var sel=user.budget===b.id;return(<button key={b.id} onClick={function(){upU("budget",b.id);}} style={{display:"flex",justifyContent:"space-between",padding:"14px 18px",borderRadius:14,cursor:"pointer",background:sel?C.goldDim:C.surface,border:"2px solid "+(sel?C.gold+"50":C.border),color:C.tx}}><span style={{fontWeight:600,color:sel?C.goldT:C.tx}}>{b.l}</span><span style={{color:sel?C.goldT:C.tx2}}>{b.r}</span></button>);})}</div><button onClick={function(){go("ob5");}} style={{width:"100%",marginTop:14,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Continue</button></Fade></div></div>)}

{sc==="ob5"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:440,width:"100%",padding:formPad}}><Fade delay={100}><div style={{height:3,background:C.border,borderRadius:2,marginBottom:32}}><div style={{height:"100%",width:"100%",background:"linear-gradient(90deg,"+C.gold+","+C.coral+")",borderRadius:2}}/></div><p style={{fontSize:12,color:C.goldT,marginBottom:8}}>STEP 5 OF 5</p><h2 style={{fontSize:28,fontWeight:700,marginBottom:6}}>Dietary needs?</h2><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["Vegetarian","Vegan","Gluten-free","Halal","Kosher","None"].map(function(item){var sel=(user.dietary||[]).indexOf(item)>=0;return(<button key={item} onClick={function(){var cur=user.dietary||[];upU("dietary",cur.indexOf(item)>=0?cur.filter(function(x){return x!==item;}):cur.concat([item]));}} style={{padding:"8px 16px",borderRadius:10,border:"1.5px solid "+(sel?C.tealL+"50":C.border),background:sel?C.tealL+"12":"transparent",color:sel?C.tealL:C.tx2,fontSize:14,fontWeight:sel?600:400,cursor:"pointer"}}>{item}</button>);})}</div><button onClick={function(){go("dash");}} style={{width:"100%",marginTop:20,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Enter WanderPlan</button></Fade></div></div>)}

{inDash&&(<div style={{minHeight:"100vh",background:C.bg}}>
  {/* Top navigation bar */}
  <header style={{position:"sticky",top:0,zIndex:50,background:C.bg+"ee",backdropFilter:"blur(16px)",borderBottom:"1px solid "+C.border}}>
    <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",padding:"10px "+pagePad+"px",gap:10,flexWrap:isNarrow?"wrap":"nowrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:"auto"}}><div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,"+C.gold+","+C.coral+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>W</div><span style={{fontSize:15,fontWeight:700}}>WanderPlan</span></div>
      <nav style={{display:"flex",gap:2,overflowX:isNarrow?"auto":"visible",maxWidth:isNarrow?"100%":"none",WebkitOverflowScrolling:"touch",flex:isNarrow?"1 1 100%":"0 1 auto"}}>
        {[{id:"dash",l:"Trips"},{id:"bucket",l:"Bucket List"},{id:"crew",l:"Crew"},{id:"profile",l:"Profile"},{id:"analytics",l:"Stats"}].map(function(it){var a=sc===it.id||(sc==="wizard"&&it.id==="dash")||(sc==="new_trip"&&it.id==="dash")||(sc==="trip_detail"&&it.id==="dash")||(sc==="companion"&&it.id==="dash");return(<button key={it.id} onClick={function(){go(it.id);}} style={{padding:isPhone?"6px 10px":"6px 14px",borderRadius:8,border:"none",background:a?C.goldDim:"transparent",color:a?C.goldT:C.tx3,cursor:"pointer",fontSize:12.5,fontWeight:a?600:400,whiteSpace:"nowrap"}}>{it.l}</button>);})}
      </nav>
      <button onClick={function(){setNT({name:"",dests:[],members:[],step:0});go("new_trip");}} style={{padding:isPhone?"7px 10px":"7px 16px",borderRadius:8,border:"none",background:C.gold,color:C.bg,fontWeight:600,fontSize:12,cursor:"pointer",marginLeft:4,whiteSpace:"nowrap"}}>{isPhone?"+ Trip":"+ New Trip"}</button>
      <div style={{marginLeft:4}}><Avi ini={user.name?user.name.charAt(0).toUpperCase():"?"} color={C.gold} size={28}/></div>
    </div>
  </header>
  {/* Main content area */}
  <main style={{maxWidth:900,margin:"0 auto",padding:"24px "+pagePad+"px 80px"}}>

  {sc==="dash"&&(function(){
    var stMap={active:{l:"Active",c:C.grn,bg:C.grnBg,icon:"LIVE"},planning:{l:"Planning",c:C.wrn,bg:C.wrnBg,icon:""},invited:{l:"Invited",c:C.sky,bg:C.sky+"14",icon:""},saved:{l:"Planning",c:C.wrn,bg:C.wrnBg,icon:""},completed:{l:"Completed",c:C.tx3,bg:"rgba(255,255,255,.05)",icon:""}};
    var tabs=["all","invited","active","planning","completed"];
    function matchesTripFilter(t,filter){
      if(filter==="all")return true;
      if(filter==="planning")return t.status==="planning"||t.status==="saved";
      return t.status===filter;
    }
    var hasActive=trips.some(function(t){return t&&t.status==="active";});
    var hasCompleted=trips.some(function(t){return t&&t.status==="completed";});
    var seedTrips=[];
    if(!hasActive){
      seedTrips.push({
        id:"seed-active-trip",
        name:"Tokyo Discovery Sprint",
        status:"active",
        trip_status:"active",
        my_status:"owner",
        dests:["Tokyo"],
        destinations:["Tokyo"],
        destNames:"Tokyo",
        members:[],
        step:9,
        dates:"Apr 10 - Apr 18",
        days:8,
        budget:3600,
        spent:1420,
        isSeed:true
      });
    }
    if(!hasCompleted){
      seedTrips.push({
        id:"seed-completed-trip",
        name:"Santorini Celebration",
        status:"completed",
        trip_status:"completed",
        my_status:"owner",
        dests:["Santorini"],
        destinations:["Santorini"],
        destNames:"Santorini",
        members:[],
        step:15,
        dates:"Sep 2 - Sep 9",
        days:7,
        budget:2800,
        spent:2610,
        isSeed:true
      });
    }
    var displayTrips=trips.concat(seedTrips).filter(function(t){return !deletedSeedTripIds[String(t&&t.id||"").trim()];});
    var filtered=displayTrips.filter(function(t){return matchesTripFilter(t,tripFilter);});
    return(<div>
      <Fade delay={50}><h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>My Trips</h1><p style={{fontSize:14,color:C.tx2,marginBottom:20}}>{displayTrips.length} trip{displayTrips.length!==1?"s":""} total</p></Fade>
      <Fade delay={100}><button onClick={function(){setNT({name:"",dests:[],members:[],step:0});go("new_trip");}} style={{width:"100%",textAlign:"left",background:C.gold+"0c",borderRadius:16,padding:"20px 24px",marginBottom:20,border:"1px solid "+C.gold+"18",cursor:"pointer",display:"flex",alignItems:"center",gap:16}}><div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.coral+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,color:"#fff"}}>+</div><div><h3 style={{fontSize:16,fontWeight:700,color:"#fff"}}>Plan a new trip</h3><p style={{fontSize:13,color:C.tx2}}>Pick from bucket list, invite crew</p></div></button></Fade>
      <Fade delay={150}><div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>{tabs.map(function(t){var cnt=t==="all"?displayTrips.length:displayTrips.filter(function(tr){return matchesTripFilter(tr,t);}).length;var sel=tripFilter===t;return(<button key={t} onClick={function(){setTF(t);}} style={{padding:"6px 16px",borderRadius:999,fontSize:13,fontWeight:sel?600:400,background:sel?C.goldDim:C.surface,color:sel?C.goldT:C.tx2,border:"1px solid "+(sel?C.gold+"30":C.border),cursor:"pointer"}}>{t==="all"?"All":stMap[t]?stMap[t].l:t} ({cnt})</button>);})}</div></Fade>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,300px),1fr))",gap:14}}>
        {filtered.map(function(tr,i){var st=stMap[tr.status]||stMap.saved;var pct=tr.budget>0&&tr.spent>0?Math.round((tr.spent/tr.budget)*100):0;
          return(<Fade key={tr.id} delay={200+i*50}><div onClick={function(){setVT(tr);go("trip_detail");}} style={{background:C.surface,borderRadius:16,overflow:"hidden",border:"1px solid "+C.border,cursor:"pointer",transition:"all .2s"}}
            onMouseEnter={function(e){e.currentTarget.style.borderColor=C.gold+"40";e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={function(e){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
            <div style={{padding:"16px 20px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <h3 style={{fontWeight:700,fontSize:16,flex:1,marginRight:8}}>{tr.name}</h3>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {tr.status==="active"&&<div style={{width:6,height:6,borderRadius:999,background:C.grn,animation:"pulse 1.5s infinite"}}/>}
                  <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,color:st.c,background:st.bg,whiteSpace:"nowrap"}}>{st.l}</span>
                  {!tr.isSeed&&<button onClick={function(e){e.stopPropagation();deleteTripWithConfirmation(tr);}} title="Delete trip" aria-label="Delete trip" style={{width:24,height:24,borderRadius:6,border:"1px solid "+C.red+"30",background:C.redBg,color:C.red,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}><TrashIcon size={12} color={C.red}/></button>}
                </div>
              </div>
              <p style={{fontSize:13,color:C.tx2,marginBottom:10}}>{tr.destNames||"No destinations"}</p>
              <div style={{display:"flex",gap:12,fontSize:12,color:C.tx3,marginBottom:10}}>
                <span>{tr.dates||"TBD"}</span>
                <span>{tr.days?tr.days+" days":""}</span>
                <span>{tr.members?tr.members.length+1:1} people</span>
              </div>
              {tr.status!=="saved"&&tr.budget>0&&(<div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.tx3}}>{tr.spent>0?"$"+tr.spent+" of $"+tr.budget:"$"+tr.budget+" budget"}</span>{pct>0&&<span style={{color:pct>90?C.red:pct>70?C.wrn:C.grn}}>{pct}%</span>}</div>
                {tr.spent>0&&<div style={{height:4,background:C.border,borderRadius:999}}><div style={{height:"100%",width:Math.min(pct,100)+"%",background:pct>90?C.red:pct>70?C.wrn:C.grn,borderRadius:999}}/></div>}
              </div>)}
              {tr.status==="planning"&&(<div style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.tx3}}>Wizard progress</span><span style={{color:C.wrn}}>Step {tr.step}/{WIZ.length}</span></div><div style={{height:4,background:C.border,borderRadius:999}}><div style={{height:"100%",width:((tr.step)/WIZ.length)*100+"%",background:C.wrn,borderRadius:999}}/></div></div>)}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:3}}>{(tr.members||[]).slice(0,4).map(function(m){return <Avi key={m.id} ini={m.ini} color={m.color} size={22}/>;})}<Avi ini={user.name?user.name.charAt(0):"Y"} color={C.gold} size={22}/></div>
                <span style={{fontSize:12,color:C.gold}}>View details</span>
              </div>
            </div>
          </div></Fade>);
        })}
      </div>
      {filtered.length===0&&(<Fade delay={200}><div style={{background:C.surface,borderRadius:16,padding:"40px 28px",border:"1px solid "+C.border,textAlign:"center"}}><p style={{fontSize:14,color:C.tx3}}>No {tripFilter==="all"?"":"\""+tripFilter+"\""} trips yet.</p></div></Fade>)}
    </div>);
  }())}

  {sc==="trip_detail"&&viewTrip&&(function(){
    var tr=viewTrip;var st={active:{l:"Active",c:C.grn},planning:{l:"Planning",c:C.wrn},invited:{l:"Invited",c:C.sky},saved:{l:"Planning",c:C.wrn},completed:{l:"Completed",c:C.tx3}};var s=st[tr.status]||st.saved;
    var pct=tr.budget>0&&tr.spent>0?Math.round((tr.spent/tr.budget)*100):0;
    return(<div style={{maxWidth:640}}>
      <Fade delay={50}><button onClick={function(){go("dash");}} style={{background:"none",border:"none",color:C.tx3,cursor:"pointer",fontSize:13,marginBottom:16,display:"flex",alignItems:"center",gap:4}}>Back to My Trips</button></Fade>
      <Fade delay={100}><div style={{background:C.surface,borderRadius:18,border:"1px solid "+C.border,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"24px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div><h1 style={{fontSize:24,fontWeight:700,marginBottom:4}}>{tr.name}</h1><p style={{fontSize:14,color:C.tx2}}>{tr.destNames||"No destinations"}</p></div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>{tr.status==="active"&&<div style={{width:7,height:7,borderRadius:999,background:C.grn,animation:"pulse 1.5s infinite"}}/>}<span style={{fontSize:12,fontWeight:600,padding:"4px 14px",borderRadius:20,color:s.c,background:s.c+"15"}}>{s.l}</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
            {[{l:"Dates",v:tr.dates||"TBD"},{l:"Duration",v:tr.days?tr.days+" days":"TBD"},{l:"Travelers",v:(tr.members?tr.members.length+1:1)+" people"}].map(function(item){return(<div key={item.l} style={{background:C.bg,borderRadius:10,padding:"12px 14px"}}><p style={{fontSize:11,color:C.tx3,marginBottom:4}}>{item.l}</p><p style={{fontSize:15,fontWeight:600}}>{item.v}</p></div>);})}
          </div>
          {tr.budget>0&&(<div style={{background:C.bg,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:C.tx2}}>Budget</span><span style={{fontSize:16,fontWeight:700,color:C.goldT}}>${tr.budget}</span></div>
            {tr.spent>0&&(<div><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:C.tx3}}>${tr.spent} spent</span><span style={{color:pct>90?C.red:pct>70?C.wrn:C.grn}}>{pct}% used</span></div><div style={{height:6,background:C.border,borderRadius:999}}><div style={{height:"100%",width:Math.min(pct,100)+"%",background:pct>90?C.red:pct>70?C.wrn:C.grn,borderRadius:999}}/></div></div>)}
            {tr.spent===0&&<p style={{fontSize:12,color:C.tx3}}>No spending recorded yet</p>}
          </div>)}
          <div style={{marginBottom:16}}><p style={{fontSize:12,fontWeight:600,color:C.tx3,marginBottom:8}}>CREW</p><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:8,background:C.bg,borderRadius:10,padding:"8px 12px"}}><Avi ini={user.name?user.name.charAt(0):"Y"} color={C.gold} size={28}/><div><p style={{fontSize:13,fontWeight:600}}>{user.name||"You"}</p><p style={{fontSize:11,color:C.tx3}}>Organizer</p></div></div>{(tr.members||[]).map(function(m){return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:8,background:C.bg,borderRadius:10,padding:"8px 12px"}}><Avi ini={m.ini} color={m.color} size={28}/><div><p style={{fontSize:13,fontWeight:600}}>{m.ini}</p><p style={{fontSize:11,color:C.tx3}}>Member</p></div></div>);})}</div></div>
          {(tr.status==="planning"||tr.status==="active")&&(<div style={{marginBottom:16}}><p style={{fontSize:12,fontWeight:600,color:C.tx3,marginBottom:8}}>WIZARD PROGRESS</p><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{WIZ.map(function(s2,i){var done=i<(tr.step||0);var act=i===(tr.step||0);return(<div key={i} style={{width:28,height:28,borderRadius:7,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",background:act?C.gold:done?C.teal+"25":C.bg,color:act?C.bg:done?C.teal:C.tx3,border:act?"none":"1px solid "+C.border}}>{done?"Y":(i+1)}</div>);})}</div><p style={{fontSize:12,color:C.tx3,marginTop:6}}>Step {(tr.step||0)+1} of {WIZ.length}: {WIZ[tr.step||0]||""}</p></div>)}
          <div style={{marginBottom:16}}>
            <p style={{fontSize:12,fontWeight:600,color:C.tx3,marginBottom:8}}>SHARE TRIP</p>
            <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"repeat(3,1fr)",gap:8}}>
              <button onClick={function(){shareTripViaWhatsApp(tr);}} style={{padding:"11px 12px",borderRadius:10,border:"1px solid "+C.grn+"35",background:C.grnBg,color:C.grn,fontSize:12,fontWeight:700,cursor:"pointer"}}>Share via WhatsApp</button>
              <button onClick={function(){copyTripShareSummary(tr);}} style={{padding:"11px 12px",borderRadius:10,border:"1px solid "+C.sky+"35",background:C.sky+"12",color:C.sky,fontSize:12,fontWeight:700,cursor:"pointer"}}>Copy Trip Summary</button>
              <button onClick={function(){copyTripInviteLink(tr);}} style={{padding:"11px 12px",borderRadius:10,border:"1px solid "+C.goldT+"35",background:C.goldDim,color:C.goldT,fontSize:12,fontWeight:700,cursor:"pointer"}}>Copy Invite Link</button>
            </div>
            {tripShareMsg&&<p style={{fontSize:12,color:C.tx2,marginTop:8}}>{tripShareMsg}</p>}
          </div>
          <div style={{display:"flex",gap:10}}>
            {tr.status==="planning"&&<button onClick={function(){setCTID(tr.id||"");setNT(tr);setWS(Math.max(0,Number(tr.step||0)||0));go("wizard");}} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:C.teal,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Continue Planning</button>}
            {tr.status==="active"&&isUuidLike(tr.id)&&<button onClick={function(){setCTID(tr.id||"");setVT(tr);setCompanionErr("");setCompanionData(null);go("companion");}} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,"+C.grn+","+C.teal+")",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><span style={{width:8,height:8,borderRadius:999,background:"#fff",animation:"pulse 1.5s infinite"}}/>Open Live Companion</button>}
            {tr.status==="invited"&&(<>
              <button onClick={function(){
                if(!authToken||!tr.id)return;
                apiJson("/trips/"+tr.id+"/respond",{method:"POST",body:{action:"accept"}},authToken).then(function(){
                  setCM("Trip invite accepted.");
                  setTF("planning");
                  setPTJ("");
                  setPTJA("");
                  clearTripJoinFromUrl();
                  refreshTripsFromBackend(authToken).then(function(){go("dash");});
                }).catch(function(e){setCM("Trip invite could not be accepted: "+String(e&&e.message||"error"));});
              }} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:C.teal,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Accept Trip Invite</button>
              <button onClick={function(){
                if(!authToken||!tr.id)return;
                apiJson("/trips/"+tr.id+"/respond",{method:"POST",body:{action:"reject"}},authToken).then(function(){
                  setCM("Trip invite rejected.");
                  setPTJ("");
                  setPTJA("");
                  clearTripJoinFromUrl();
                  refreshTripsFromBackend(authToken).then(function(){go("dash");});
                }).catch(function(e){setCM("Trip invite could not be rejected: "+String(e&&e.message||"error"));});
              }} style={{padding:"12px 14px",borderRadius:12,border:"1px solid "+C.red+"30",background:C.redBg,color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Reject</button>
            </>)}
            {tr.status==="saved"&&<button onClick={function(){setCTID(tr.id||"");setNT(tr);setWS(Math.max(0,Number(tr.step||0)||0));go("wizard");}} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",color:C.bg,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Start Planning</button>}
            {tr.status==="completed"&&<button style={{flex:1,padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:"transparent",color:C.tx2,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>View Itinerary</button>}
            <button onClick={function(){if(deleteTripWithConfirmation(tr))go("dash");}} title="Delete trip" aria-label="Delete trip" style={{padding:"12px 14px",borderRadius:12,border:"1px solid "+C.red+"30",background:C.redBg,color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46,display:"flex",alignItems:"center",justifyContent:"center"}}><TrashIcon size={16} color={C.red}/></button>
          </div>
        </div>
      </div></Fade>
    </div>);
  }())}

  {sc==="companion"&&viewTrip&&(function(){
    var tr=viewTrip||{};
    var comp=companionData||{};
    var today=comp.today||null;
    var upcoming=Array.isArray(comp.upcoming)?comp.upcoming:[];
    var currentItem=comp.current_item||null;
    var nextItem=comp.next_item||null;
    var staySnapshot=Array.isArray(comp.stays)?comp.stays:[];
    var diningSnapshot=Array.isArray(comp.today_meals)?comp.today_meals:[];
    var expenseSummary=(comp.expense_summary&&typeof comp.expense_summary==="object")?comp.expense_summary:{};
    var recentExpenses=Array.isArray(comp.recent_expenses)?comp.recent_expenses:[];
    var expenseBalances=Array.isArray(comp.expense_member_balances)?comp.expense_member_balances:[];
    var dayProgress=(comp.day_progress&&typeof comp.day_progress==="object")?comp.day_progress:{};
    var members=Array.isArray(comp.members)&&comp.members.length>0?comp.members:(Array.isArray(tr.members)?tr.members:[]);
    var lockedWindow=comp.locked_window||{};
    var tripTitle=(comp.trip&&comp.trip.name)||tr.name||"Trip";
    var currentUserVoteId=String(userIdFromToken(authToken)||"").trim()||makeVoteUserId(user);
    var splitDefaultIds=defaultExpenseSplitMemberIds(members,currentUserVoteId);
    var companionReady=(comp.is_ready!==false)&&!!(today||currentItem||nextItem||upcoming.length);
    var readinessCopy=companionReadinessCopy(comp.readiness_reason);
      var companionActions=[
      {label:"Open Flights",step:14,color:C.sky},
      {label:"Open Stays",step:10,color:C.goldT},
      {label:"Open Dining",step:11,color:C.coral},
      {label:"Open Itinerary",step:12,color:C.tealL}
      ];
    function openCompanionWizardStep(stepIndex){
      var tid=String((tr&&tr.id)||currentTripId||"").trim();
      var fallbackDests=(Array.isArray(tr.dests)&&tr.dests.length)?tr.dests:String(tr.destNames||"").split("+").map(function(s){return String(s||"").trim();}).filter(Boolean);
      setCTID(tid);
      setVT(tr);
      setNT(function(prev){
        var base=(prev&&typeof prev==="object")?prev:{};
        var nextTrip=Object.assign({},base,tr,{step:stepIndex});
        if(!(Array.isArray(nextTrip.dests)&&nextTrip.dests.length))nextTrip.dests=fallbackDests;
        if(!Array.isArray(nextTrip.members))nextTrip.members=Array.isArray(tr.members)?tr.members:[];
        return nextTrip;
      });
      setWS(stepIndex);
      go("wizard");
    }
    function submitCompanionCheckin(item,status){
      var activityId=String(item&&item.activity_id||"").trim();
      var normalizedStatus=normalizeCompanionCheckinStatus(status);
      if(!(activityId&&today&&today.day_number))return;
      setCompanionActionLoad(true);
      setCompanionErr("");
      saveTripPlanningState({state:{companion_checkins:(function(){
        var patch={};
        patch[activityId]={
          status:normalizedStatus,
          updated_by:String(userIdFromToken(authToken)||"").trim()||("email:"+String(user.email||"").trim().toLowerCase()),
          updated_by_name:String(user.name||user.email||"Traveler"),
          updated_at:new Date().toISOString(),
          day_number:Number(today.day_number||0)||0
        };
        return patch;
      })()}}).then(function(){
        return refreshCompanionNow(String(tr&&tr.id||currentTripId||""),true);
      }).then(function(){
        setCompanionActionLoad(false);
      }).catch(function(e){
        setCompanionActionLoad(false);
        setCompanionErr(String(e&&e.message||"Could not update live day status"));
      });
    }
    function onReceiptImageChange(ev){
      var file=ev&&ev.target&&ev.target.files&&ev.target.files[0];
      if(!file){
        setReceiptImage({name:"",mediaType:"",base64:""});
        return;
      }
      setReceiptMsg("");
      readFileAsBase64(file).then(function(payload){
        setReceiptImage(payload||{name:"",mediaType:"",base64:""});
      }).catch(function(e){
        setReceiptImage({name:"",mediaType:"",base64:""});
        setReceiptMsg(String(e&&e.message||"Could not read receipt image"));
      });
    }
    function analyzeReceipt(){
      var tripId=String((tr&&tr.id)||currentTripId||"").trim();
      var payload={
        expense_date:String(today&&today.date||new Date().toISOString().slice(0,10)).slice(0,10),
        receipt_text:String(receiptText||"").trim(),
        receipt_name:String(receiptImage&&receiptImage.name||"").trim(),
        receipt_image_base64:String(receiptImage&&receiptImage.base64||"").trim(),
        receipt_image_media_type:String(receiptImage&&receiptImage.mediaType||"").trim(),
        currency:String(expenseSummary.currency||"USD")
      };
      setReceiptLoad(true);
      setReceiptParse(null);
      setReceiptMsg("");
      parseReceiptForTrip(tripId,payload).then(function(res){
        setReceiptParse(res&&res.parsed||null);
        if(res&&res.llm_error){
          setReceiptMsg("Receipt parsed with fallback logic because the LLM parse was unavailable.");
        }else{
          setReceiptMsg("Receipt analyzed. Review the categories before saving.");
        }
        setReceiptLoad(false);
      }).catch(function(e){
        setReceiptLoad(false);
        setReceiptMsg(String(e&&e.message||"Could not analyze receipt"));
      });
    }
    function saveParsedReceipt(){
      var tripId=String((tr&&tr.id)||currentTripId||"").trim();
      var parsed=(receiptParse&&typeof receiptParse==="object")?receiptParse:{};
      var items=Array.isArray(parsed.items)?parsed.items:[];
      if(items.length===0){
        setReceiptMsg("Analyze a receipt first.");
        return;
      }
      setReceiptSaveLoad(true);
      setReceiptMsg("");
      saveReceiptItemsForTrip(tripId,items.map(function(item){
        return {
          expense_date:String(item&&item.expense_date||today&&today.date||"").slice(0,10),
          merchant:String(item&&item.merchant||parsed.merchant||"Receipt expense"),
          amount:Number(item&&item.amount||0)||0,
          currency:String(item&&item.currency||parsed.currency||expenseSummary.currency||"USD"),
          category:String(item&&item.category||"misc"),
          note:String(item&&item.note||parsed.summary||""),
          receipt_name:String(receiptImage&&receiptImage.name||"").trim(),
          receipt_text:String(receiptText||"").trim(),
          paid_by_user_id:String(expensePaidBy||currentUserVoteId||"").trim(),
          split_with_user_ids:(Array.isArray(expenseSplitWith)&&expenseSplitWith.length?expenseSplitWith:[String(expensePaidBy||currentUserVoteId||"").trim()].filter(Boolean))
        };
      })).then(function(res){
        setReceiptSaveLoad(false);
        setReceiptParse(null);
        setReceiptText("");
        setReceiptImage({name:"",mediaType:"",base64:""});
        setReceiptMsg("Receipt saved to trip budget.");
        setCompanionData(function(prev){
          if(!(prev&&typeof prev==="object"))return prev;
          return Object.assign({},prev,{
            expense_summary:(res&&res.summary)||prev.expense_summary||{},
            recent_expenses:(res&&res.expenses)||prev.recent_expenses||[],
            expense_member_balances:(res&&res.member_balances)||prev.expense_member_balances||[]
          });
        });
        return refreshCompanionNow(tripId,true);
      }).then(function(){return null;}).catch(function(e){
        setReceiptSaveLoad(false);
        setReceiptMsg(String(e&&e.message||"Could not save receipt"));
      });
    }
    function saveManualExpense(){
      var tripId=String((tr&&tr.id)||currentTripId||"").trim();
      var amount=Number(manualExpense.amount||0)||0;
      var paidBy=String(manualExpensePaidBy||expensePaidBy||currentUserVoteId||"").trim();
      var splitWith=(Array.isArray(manualExpenseSplitWith)&&manualExpenseSplitWith.length?manualExpenseSplitWith:[paidBy].filter(Boolean));
      if(!String(manualExpense.merchant||"").trim()||amount<=0){
        setReceiptMsg("Enter a merchant and amount for the manual expense.");
        return;
      }
      setReceiptSaveLoad(true);
      setReceiptMsg("");
      saveReceiptItemsForTrip(tripId,[{
        expense_date:String(manualExpense.date||today&&today.date||new Date().toISOString().slice(0,10)).slice(0,10),
        merchant:String(manualExpense.merchant||"").trim(),
        amount:amount,
        currency:String(expenseSummary.currency||"USD"),
        category:String(manualExpense.category||"misc"),
        note:String(manualExpense.note||"").trim(),
        paid_by_user_id:paidBy,
        split_with_user_ids:splitWith
      }]).then(function(res){
        setReceiptSaveLoad(false);
        setManualExpense({merchant:"",amount:"",category:"dining",note:"",date:""});
        if(paidBy)setManualExpenseSplitWith([paidBy]);
        setReceiptMsg("Manual expense saved to trip budget.");
        setCompanionData(function(prev){
          if(!(prev&&typeof prev==="object"))return prev;
          return Object.assign({},prev,{
            expense_summary:(res&&res.summary)||prev.expense_summary||{},
            recent_expenses:(res&&res.expenses)||prev.recent_expenses||[],
            expense_member_balances:(res&&res.member_balances)||prev.expense_member_balances||[]
          });
        });
        return refreshCompanionNow(tripId,true);
      }).then(function(){return null;}).catch(function(e){
        setReceiptSaveLoad(false);
        setReceiptMsg(String(e&&e.message||"Could not save manual expense"));
      });
    }
    function toggleExpenseSplitMember(memberId){
      var nextId=String(memberId||"").trim();
      if(!nextId)return;
      setExpenseSplitWith(function(prev){
        var list=Array.isArray(prev)?prev.slice():[];
        var idx=list.indexOf(nextId);
        if(idx>=0){
          list.splice(idx,1);
        }else{
          list.push(nextId);
        }
        return list;
      });
    }
    function toggleManualExpenseSplitMember(memberId){
      var nextId=String(memberId||"").trim();
      if(!nextId)return;
      setManualExpenseSplitWith(function(prev){
        var list=Array.isArray(prev)?prev.slice():[];
        var idx=list.indexOf(nextId);
        if(idx>=0){
          list.splice(idx,1);
        }else{
          list.push(nextId);
        }
        return list;
      });
    }
    return(<div style={{maxWidth:720}}>
      <Fade delay={50}><button onClick={function(){go("trip_detail");}} style={{background:"none",border:"none",color:C.tx3,cursor:"pointer",fontSize:13,marginBottom:16}}>Back to {tr.name||"trip"}</button></Fade>
      <Fade delay={100}><div style={{background:C.surface,borderRadius:18,border:"1px solid "+C.border,overflow:"hidden",marginBottom:18}}>
        <div style={{padding:"24px 28px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <div>
              <h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>Live Companion</h1>
              <p style={{fontSize:14,color:C.tx2}}>{tripTitle}</p>
            </div>
            <button disabled={companionRefreshLoad} onClick={function(){refreshCompanionNow(String((tr&&tr.id)||currentTripId||""),false).catch(function(){});}} style={{padding:"8px 12px",borderRadius:10,border:"1px solid "+C.border,background:C.bg,color:C.tx2,fontSize:12,fontWeight:600,cursor:companionRefreshLoad?"default":"pointer",opacity:companionRefreshLoad?0.7:1}}>{companionRefreshLoad?"Refreshing...":"Refresh"}</button>
          </div>
          {companionRefreshStamp&&<p role="status" aria-live="polite" style={{fontSize:11,color:C.tx3,marginBottom:10}}>Updated just now</p>}
          <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,1fr)",gap:12}}>
            {[{l:"Trip Window",v:formatCompanionWindow(lockedWindow)},{l:"Destinations",v:(Array.isArray(tr.dests)?tr.dests.join(" + "):(tr.destNames||""))||"TBD"},{l:"Travelers",v:String(members.length||1)+" active"}].map(function(item){return(<div key={item.l} style={{background:C.bg,borderRadius:12,padding:"12px 14px"}}><p style={{fontSize:11,color:C.tx3,marginBottom:4}}>{item.l}</p><p style={{fontSize:14,fontWeight:600}}>{item.v}</p></div>);})}
          </div>
        </div>
      </div></Fade>
      <Fade delay={115}><div style={{background:C.surface,borderRadius:16,padding:"18px 22px",border:"1px solid "+C.border,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:4}}>QUICK ACTIONS</p>
            <p style={{fontSize:12,color:C.tx3}}>Jump straight into the live trip steps without losing context.</p>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
          {companionActions.map(function(action){
            return(<button key={action.label} onClick={function(){openCompanionWizardStep(action.step);}} style={{padding:"12px 10px",borderRadius:12,border:"1px solid "+action.color+"35",background:action.color+"12",color:action.color,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:46}}>
              {action.label}
            </button>);
          })}
        </div>
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+C.border}}>
          <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>SHARE TRIP</p>
          <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,1fr)",gap:8}}>
            <button onClick={function(){shareTripViaWhatsApp(tr);}} style={{padding:"11px 10px",borderRadius:12,border:"1px solid "+C.grn+"35",background:C.grnBg,color:C.grn,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:44}}>Share via WhatsApp</button>
            <button onClick={function(){copyTripShareSummary(tr);}} style={{padding:"11px 10px",borderRadius:12,border:"1px solid "+C.sky+"35",background:C.sky+"12",color:C.sky,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:44}}>Copy Trip Summary</button>
            <button onClick={function(){copyTripInviteLink(tr);}} style={{padding:"11px 10px",borderRadius:12,border:"1px solid "+C.goldT+"35",background:C.goldDim,color:C.goldT,fontSize:12,fontWeight:700,cursor:"pointer",minHeight:44}}>Copy Invite Link</button>
          </div>
          {tripShareMsg&&<p style={{fontSize:12,color:C.tx2,marginTop:8}}>{tripShareMsg}</p>}
        </div>
      </div></Fade>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
        <p style={{fontSize:11,color:C.tx3}}>Debug panel shows the raw companion payload for this trip.</p>
        <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {showVoteDebug?"Hide Debug":"Show Debug"}
        </button>
      </div>
      {showVoteDebug&&(<div style={{marginBottom:14,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
        <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Companion Debug</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
          {[
            {l:"Resolved trip id",v:String((tr&&tr.id)||currentTripId||"(missing)")},
            {l:"Trip status",v:String((comp.trip&&comp.trip.status)||tr.status||"(none)")},
            {l:"Trip window",v:formatCompanionWindow(lockedWindow)},
            {l:"Is ready",v:String(comp.is_ready!==false)},
            {l:"Readiness reason",v:String(comp.readiness_reason||"(none)")},
            {l:"Has today",v:String(!!today)},
            {l:"Today item count",v:String(Array.isArray(today&&today.items)?today.items.length:0)},
            {l:"Progress summary",v:JSON.stringify(dayProgress||{})},
            {l:"Expense summary",v:JSON.stringify(expenseSummary||{})},
            {l:"Recent expense count",v:String(recentExpenses.length||0)}
          ].map(function(item){
            return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
              <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
            </div>);
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10}}>
          <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Current item</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(currentItem||null,null,2)}</pre>
          </div>
          <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Today payload</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:220,overflowY:"auto"}}>{JSON.stringify(today||null,null,2)}</pre>
          </div>
          <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw today check-ins</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:220,overflowY:"auto"}}>{JSON.stringify(comp.today_checkins||[],null,2)}</pre>
          </div>
          <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw companion payload</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:220,overflowY:"auto"}}>{JSON.stringify(comp||{},null,2)}</pre>
          </div>
          <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Recent expenses</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:220,overflowY:"auto"}}>{JSON.stringify(recentExpenses||[],null,2)}</pre>
          </div>
        </div>
      </div>)}
      {companionErr&&<Fade delay={120}><div style={{marginBottom:14,padding:"12px 14px",borderRadius:12,background:C.redBg,border:"1px solid "+C.red+"20"}}><p style={{fontSize:13,color:C.red}}>{companionErr}</p></div></Fade>}
      {companionLoad&&<Fade delay={120}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border,marginBottom:14}}><p style={{fontSize:14,color:C.tx2}}>Loading live trip context...</p></div></Fade>}
      {!companionLoad&&!companionReady&&(<Fade delay={125}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border,marginBottom:14}}>
        <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:10}}>LIVE COMPANION SETUP</p>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>{readinessCopy.title}</h2>
        <p style={{fontSize:14,color:C.tx2,marginBottom:14}}>{readinessCopy.body}</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={function(){openCompanionWizardStep(12);}} style={{padding:"11px 14px",borderRadius:10,border:"1px solid "+C.tealL+"35",background:C.teal+"12",color:C.tealL,fontSize:12,fontWeight:700,cursor:"pointer"}}>Open Itinerary</button>
          <button onClick={function(){openCompanionWizardStep(13);}} style={{padding:"11px 14px",borderRadius:10,border:"1px solid "+C.goldT+"35",background:C.goldDim,color:C.goldT,fontSize:12,fontWeight:700,cursor:"pointer"}}>Open Availability</button>
        </div>
      </div></Fade>)}
      {!companionLoad&&(currentItem||nextItem)&&(<Fade delay={130}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border,marginBottom:14}}>
        <p style={{fontSize:12,fontWeight:700,color:C.grn,marginBottom:10}}>NOW / NEXT</p>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(2,1fr)",gap:10}}>
          {[{label:"Now",item:currentItem},{label:"Next",item:nextItem}].map(function(block){
            return(<div key={block.label} style={{background:C.bg,borderRadius:12,padding:"12px 14px",border:"1px solid "+C.border,minHeight:92}}>
              <p style={{fontSize:11,color:C.tx3,marginBottom:6}}>{block.label}</p>
              {block.item?(<>
                <p style={{fontSize:12,color:C.tealL,marginBottom:4}}>{String(block.item.time_slot||"").split("-")[0]||"--:--"}</p>
                <p style={{fontSize:14,fontWeight:700,marginBottom:4}}>{block.item.title||"Planned item"}</p>
                <p style={{fontSize:12,color:C.tx2}}>{block.item.location||block.item.category||"Trip plan"}</p>
              </>):(<p style={{fontSize:12,color:C.tx3}}>No item queued.</p>)}
            </div>);
          })}
        </div>
      </div></Fade>)}
      {!companionLoad&&today&&(<Fade delay={135}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:4}}>TODAY PROGRESS</p>
            <p style={{fontSize:12,color:C.tx3}}>
              {String(dayProgress.completed_items||0)} of {String(dayProgress.total_items||0)} items closed
              {dayProgress.last_updated_at?(" - updated "+formatCompanionDate(String(dayProgress.last_updated_at||"").slice(0,10))):""}
            </p>
          </div>
          <div style={{padding:"8px 12px",borderRadius:999,background:C.teal+"12",color:C.tealL,fontSize:12,fontWeight:700}}>
            {String(dayProgress.completion_pct||0)}%
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr 1fr":"repeat(4,1fr)",gap:8}}>
          {[
            {l:"Done",v:dayProgress.done||0,c:C.grn,bg:C.grnBg},
            {l:"In Progress",v:dayProgress.in_progress||0,c:C.goldT,bg:C.goldDim},
            {l:"Skipped",v:dayProgress.skipped||0,c:C.red,bg:C.redBg},
            {l:"Pending",v:dayProgress.pending||0,c:C.tx2,bg:C.bg}
          ].map(function(stat){
            return(<div key={stat.l} style={{padding:"10px 12px",borderRadius:12,background:stat.bg,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{stat.l}</p>
              <p style={{fontSize:16,fontWeight:700,color:stat.c}}>{stat.v}</p>
            </div>);
          })}
        </div>
      </div></Fade>)}
      {!companionLoad&&today&&(<Fade delay={140}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:10}}>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:C.tealL,marginBottom:4}}>TODAY'S PLAN</p>
            <h2 style={{fontSize:20,fontWeight:700}}>{today.title||("Day "+(today.day_number||1))}</h2>
          </div>
          <div style={{padding:"6px 10px",borderRadius:999,background:C.teal+"12",color:C.tealL,fontSize:12,fontWeight:700}}>{formatCompanionDate(today.date)||("Day "+(today.day_number||1))}</div>
        </div>
        {(today.items||[]).length>0?(<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(today.items||[]).map(function(item,idx){
            var meta=companionCheckinMeta(item&&item.live_status);
            return(<div key={idx} style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"72px 1fr auto",gap:12,padding:"10px 0",borderTop:idx===0?"1px solid "+C.border:"1px solid "+C.border}}>
              <div style={{fontSize:12,color:C.tx3}}>{String(item.time_slot||"").split("-")[0]||"--:--"}</div>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                  <p style={{fontSize:14,fontWeight:600}}>{item.title||"Activity"}</p>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:999,background:meta.bg,color:meta.color}}>{meta.label}</span>
                </div>
                <p style={{fontSize:12,color:C.tx2,marginBottom:4}}>{item.location||item.category||"Planned item"}</p>
                {item&&item.live_updated_by_name&&<p style={{fontSize:11,color:C.tx3}}>Updated by {item.live_updated_by_name}</p>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:isNarrow?"flex-start":"flex-end"}}>
                {[{label:"Start",status:"in_progress",color:C.goldT,bg:C.goldDim},{label:"Done",status:"done",color:C.grn,bg:C.grnBg},{label:"Skip",status:"skipped",color:C.red,bg:C.redBg}].map(function(action){
                  var active=normalizeCompanionCheckinStatus(item&&item.live_status)===action.status;
                  return(<button key={action.status} onClick={function(){submitCompanionCheckin(item,action.status);}} disabled={companionActionLoad} style={{padding:"7px 10px",borderRadius:8,border:"1px solid "+action.color+"35",background:active?action.bg:C.surface,color:action.color,fontSize:11,fontWeight:700,cursor:companionActionLoad?"default":"pointer",opacity:(companionActionLoad&&!active)?0.7:1}}>
                    {action.label}
                  </button>);
                })}
              </div>
            </div>);
          })}
        </div>):(<p style={{fontSize:13,color:C.tx3}}>No itinerary items are available for today yet.</p>)}
      </div></Fade>)}
      {!companionLoad&&upcoming.length>0&&(<Fade delay={170}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border,marginBottom:14}}>
        <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:10}}>UPCOMING</p>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(2,1fr)",gap:10}}>
          {upcoming.map(function(day,idx){return(<div key={idx} style={{background:C.bg,borderRadius:12,padding:"12px 14px",border:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}>
              <p style={{fontSize:14,fontWeight:700}}>{day.title||("Day "+(day.day_number||idx+1))}</p>
              <span style={{fontSize:11,color:C.tx3}}>{formatCompanionDate(day.date)||("Day "+(day.day_number||idx+1))}</span>
            </div>
            <p style={{fontSize:12,color:C.tx2}}>{(day.items||[]).slice(0,2).map(function(item){return item.title;}).filter(Boolean).join(" | ")||"More itinerary items coming up"}</p>
          </div>);})}
        </div>
      </div></Fade>)}
      <Fade delay={190}><div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1.1fr .9fr",gap:14}}>
        <div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border}}>
          <p style={{fontSize:12,fontWeight:700,color:C.tx3,marginBottom:10}}>CREW</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {members.map(function(m,idx){
              var dn=String(m.display_name||m.name||m.ini||("Traveler "+(idx+1)));
              var role=String(m.role||"member");
              return(<div key={String(m.user_id||m.id||idx)} style={{display:"flex",alignItems:"center",gap:10,background:C.bg,borderRadius:12,padding:"10px 12px"}}>
                <Avi ini={iniFromName(dn)} color={role==="owner"?C.gold:CREW_COLORS[idx%CREW_COLORS.length]} size={28} name={dn}/>
                <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{dn}</p><p style={{fontSize:11,color:C.tx3}}>{role==="owner"?"Organizer":"Traveler"}</p></div>
              </div>);
            })}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border}}>
            <p style={{fontSize:12,fontWeight:700,color:C.tx3,marginBottom:10}}>STAY SNAPSHOT</p>
            {staySnapshot.length>0?(<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {staySnapshot.map(function(stay,idx){
                return(<div key={stay.destination+"-"+idx} style={{background:C.bg,borderRadius:12,padding:"12px 14px",border:"1px solid "+C.border}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:4}}>
                    <p style={{fontSize:14,fontWeight:700}}>{stay.name||stay.destination||"Stay"}</p>
                    {stay.rate_per_night? <span style={{fontSize:12,color:C.goldT,fontWeight:700}}>${Math.round(stay.rate_per_night)}/night</span> : null}
                  </div>
                  <p style={{fontSize:12,color:C.tx2,marginBottom:4}}>{stay.destination}{stay.type?(" | "+stay.type):""}</p>
                  {stay.why_this_one&&<p style={{fontSize:11,color:C.tx3}}>{stay.why_this_one}</p>}
                </div>);
              })}
            </div>):(<p style={{fontSize:12,color:C.tx3}}>No stay snapshot available yet.</p>)}
          </div>
          <div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border}}>
            <p style={{fontSize:12,fontWeight:700,color:C.tx3,marginBottom:10}}>DINING TODAY</p>
            {diningSnapshot.length>0?(<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {diningSnapshot.map(function(meal,idx){
                return(<div key={(meal.type||"Meal")+"-"+idx} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderTop:idx===0?"1px solid "+C.border:"1px solid "+C.border}}>
                  <div>
                    <p style={{fontSize:12,color:C.tealL,marginBottom:3}}>{meal.time||meal.type||"Meal"}</p>
                    <p style={{fontSize:14,fontWeight:700,marginBottom:2}}>{meal.name||"Dining plan"}</p>
                    <p style={{fontSize:12,color:C.tx2}}>{meal.destination||meal.cuisine||meal.type||"Meal"}</p>
                  </div>
                  {meal.cost? <span style={{fontSize:12,color:C.goldT,fontWeight:700}}>${Math.round(meal.cost)}</span> : null}
                </div>);
              })}
            </div>):(<p style={{fontSize:12,color:C.tx3}}>No dining snapshot available yet.</p>)}
          </div>
          <div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
              <div>
                <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:4}}>END-OF-DAY RECEIPTS</p>
                <p style={{fontSize:12,color:C.tx3}}>Upload or paste receipts and let WanderPlan categorize them against the shared trip budget.</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:11,color:C.tx3}}>Trip spend</p>
                <p style={{fontSize:15,fontWeight:700,color:(Number(expenseSummary.remaining||0)<0?C.red:C.grn)}}>
                  {formatMoney(expenseSummary.spent||0,expenseSummary.currency||"USD")}
                </p>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {[
                {l:"Today",v:formatMoney(expenseSummary.today_spent||0,expenseSummary.currency||"USD"),c:C.goldT},
                {l:"Remaining",v:formatMoney(expenseSummary.remaining||0,expenseSummary.currency||"USD"),c:Number(expenseSummary.remaining||0)<0?C.red:C.tealL},
                {l:"Daily target",v:formatMoney(expenseSummary.daily_target||0,expenseSummary.currency||"USD"),c:C.sky}
              ].map(function(stat){
                return(<div key={stat.l} style={{padding:"10px 12px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
                  <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{stat.l}</p>
                  <p style={{fontSize:15,fontWeight:700,color:stat.c}}>{stat.v}</p>
                </div>);
              })}
            </div>
            {Array.isArray(expenseSummary.categories)&&expenseSummary.categories.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                {expenseSummary.categories.map(function(cat){
                  return(<div key={cat.category} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,padding:"7px 0",borderTop:"1px solid "+C.border}}>
                    <span style={{color:C.tx2,textTransform:"capitalize"}}>{String(cat.category||"misc")}</span>
                    <span style={{color:cat.over_budget?C.red:C.tx2}}>
                      {formatMoney(cat.spent||0,expenseSummary.currency||"USD")} / {formatMoney(cat.budget||0,expenseSummary.currency||"USD")}
                    </span>
                  </div>);
                })}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1fr 1fr",gap:8,marginBottom:10}}>
              <div>
                <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:6}}>Paid by</p>
                <select value={expensePaidBy} onChange={function(e){setExpensePaidBy(e.target.value);}} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.bg,color:"#fff",fontSize:13}}>
                  {members.map(function(member,idx){
                    var memberId=String(member&&member.user_id||member&&member.id||"").trim();
                    var label=String(member&&member.display_name||member&&member.name||("Traveler "+(idx+1)));
                    return(<option key={memberId||idx} value={memberId}>{label}</option>);
                  })}
                </select>
              </div>
              <div>
                <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:6}}>Split with</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,minHeight:48,padding:"8px 10px",borderRadius:12,border:"1px solid "+C.border,background:C.bg}}>
                  {members.map(function(member,idx){
                    var memberId=String(member&&member.user_id||member&&member.id||"").trim();
                    var label=String(member&&member.display_name||member&&member.name||("Traveler "+(idx+1)));
                    var active=expenseSplitWith.indexOf(memberId)>=0;
                    return(<button key={memberId||idx} onClick={function(){toggleExpenseSplitMember(memberId);}} style={{padding:"6px 10px",borderRadius:999,border:"1px solid "+(active?C.tealL:C.border),background:active?(C.teal+"12"):C.surface,color:active?C.tealL:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      {label}
                    </button>);
                  })}
                </div>
              </div>
            </div>
            <textarea
              value={receiptText}
              onChange={function(e){setReceiptText(e.target.value);}}
              placeholder="Paste receipt text here if you have it..."
              style={{width:"100%",minHeight:88,borderRadius:12,border:"1px solid "+C.border,background:C.bg,color:"#fff",padding:"12px 14px",fontSize:13,marginBottom:10}}
            />
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
              <label style={{padding:"10px 12px",borderRadius:12,border:"1px solid "+C.border,background:C.bg,color:C.tx2,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                Upload receipt image
                <input type="file" accept="image/*" onChange={onReceiptImageChange} style={{display:"none"}}/>
              </label>
              {receiptImage&&receiptImage.name&&<span style={{fontSize:12,color:C.tx3}}>{receiptImage.name}</span>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <button onClick={analyzeReceipt} disabled={receiptLoad||receiptSaveLoad||(!String(receiptText||"").trim()&&!(receiptImage&&receiptImage.base64))} style={{padding:"11px 14px",borderRadius:12,border:"1px solid "+C.tealL+"35",background:C.teal+"12",color:C.tealL,fontSize:12,fontWeight:700,cursor:(receiptLoad||receiptSaveLoad)?"default":"pointer",opacity:(!String(receiptText||"").trim()&&!(receiptImage&&receiptImage.base64))?0.55:1}}>
                {receiptLoad?"Analyzing...":"Analyze Receipt"}
              </button>
              <button onClick={saveParsedReceipt} disabled={receiptSaveLoad||!(receiptParse&&Array.isArray(receiptParse.items)&&receiptParse.items.length)} style={{padding:"11px 14px",borderRadius:12,border:"1px solid "+C.grn+"35",background:C.grnBg,color:C.grn,fontSize:12,fontWeight:700,cursor:receiptSaveLoad?"default":"pointer",opacity:(receiptParse&&Array.isArray(receiptParse.items)&&receiptParse.items.length)?1:0.55}}>
                {receiptSaveLoad?"Saving...":"Save to Budget"}
              </button>
            </div>
            {receiptMsg&&<p style={{fontSize:12,color:receiptMsg.toLowerCase().indexOf("could not")>=0?C.red:C.tx2,marginBottom:10}}>{receiptMsg}</p>}
            {receiptParse&&Array.isArray(receiptParse.items)&&receiptParse.items.length>0&&(
              <div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:8}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:700}}>{receiptParse.merchant||"Parsed receipt"}</p>
                    <p style={{fontSize:11,color:C.tx3}}>{receiptParse.expense_date||today&&today.date||"Date TBD"}{receiptParse.parse_source?(" | "+receiptParse.parse_source):""}</p>
                  </div>
                  <p style={{fontSize:13,fontWeight:700,color:C.goldT}}>{formatMoney(receiptItemsTotal(receiptParse.items),receiptParse.currency||expenseSummary.currency||"USD")}</p>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {receiptParse.items.map(function(item,idx){
                    return(<div key={(item.category||"item")+"-"+idx} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12}}>
                      <span style={{color:C.tx2}}>{item.merchant||receiptParse.merchant||"Expense"} <span style={{color:C.tx3}}>| {String(item.category||"misc")}</span></span>
                      <span style={{fontWeight:700}}>{formatMoney(item.amount||0,item.currency||receiptParse.currency||expenseSummary.currency||"USD")}</span>
                    </div>);
                  })}
                </div>
              </div>
            )}
            <div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
              <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>MANUAL EXPENSE</p>
              <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1.2fr .8fr",gap:8,marginBottom:8}}>
                <input
                  value={manualExpense.merchant}
                  onChange={function(e){setManualExpense(function(prev){return Object.assign({},prev,{merchant:e.target.value});});}}
                  placeholder="Merchant or expense name"
                  style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:13}}
                />
                <input
                  value={manualExpense.amount}
                  onChange={function(e){setManualExpense(function(prev){return Object.assign({},prev,{amount:e.target.value});});}}
                  placeholder="Amount"
                  inputMode="decimal"
                  style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:13}}
                />
              </div>
              <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1fr 1fr",gap:8,marginBottom:8}}>
                <select value={manualExpense.category} onChange={function(e){setManualExpense(function(prev){return Object.assign({},prev,{category:e.target.value});});}} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:13}}>
                  {["dining","activities","transport","accommodation","misc"].map(function(cat){return <option key={cat} value={cat}>{cat}</option>;})}
                </select>
                <input
                  type="date"
                  value={manualExpense.date}
                  onChange={function(e){setManualExpense(function(prev){return Object.assign({},prev,{date:e.target.value});});}}
                  style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:13}}
                />
              </div>
              <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1fr 1fr",gap:8,marginBottom:8}}>
                <div>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:6}}>Manual paid by</p>
                  <select value={manualExpensePaidBy} onChange={function(e){var next=e.target.value;setManualExpensePaidBy(next);if(!Array.isArray(manualExpenseSplitWith)||manualExpenseSplitWith.length===0)setManualExpenseSplitWith(next?[next]:[]);}} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:13}}>
                    {members.map(function(member,idx){
                      var memberId=String(member&&member.user_id||member&&member.id||"").trim();
                      var label=String(member&&member.display_name||member&&member.name||("Traveler "+(idx+1)));
                      return(<option key={memberId||idx} value={memberId}>{label}</option>);
                    })}
                  </select>
                </div>
                <div>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:6}}>Manual split with</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,minHeight:48,padding:"8px 10px",borderRadius:12,border:"1px solid "+C.border,background:C.surface}}>
                    {members.map(function(member,idx){
                      var memberId=String(member&&member.user_id||member&&member.id||"").trim();
                      var label=String(member&&member.display_name||member&&member.name||("Traveler "+(idx+1)));
                      var active=manualExpenseSplitWith.indexOf(memberId)>=0;
                      return(<button key={memberId||idx} onClick={function(){toggleManualExpenseSplitMember(memberId);}} style={{padding:"6px 10px",borderRadius:999,border:"1px solid "+(active?C.sky:C.border),background:active?(C.sky+"12"):C.surface,color:active?C.sky:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        {label}
                      </button>);
                    })}
                  </div>
                </div>
              </div>
              <textarea
                value={manualExpense.note}
                onChange={function(e){setManualExpense(function(prev){return Object.assign({},prev,{note:e.target.value});});}}
                placeholder="Optional note"
                style={{width:"100%",minHeight:64,padding:"12px",borderRadius:12,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:13,marginBottom:8}}
              />
              <button onClick={saveManualExpense} disabled={receiptSaveLoad} style={{padding:"11px 14px",borderRadius:12,border:"1px solid "+C.sky+"35",background:C.sky+"12",color:C.sky,fontSize:12,fontWeight:700,cursor:receiptSaveLoad?"default":"pointer"}}>
                {receiptSaveLoad?"Saving...":"Save Manual Expense"}
              </button>
            </div>
            {expenseBalances.length>0&&(
              <div style={{marginBottom:12}}>
                <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>WHO PAID VS SHARE</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {expenseBalances.map(function(row){
                    return(<div key={row.user_id} style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1fr repeat(3,auto)",gap:10,alignItems:"center",padding:"10px 0",borderTop:"1px solid "+C.border}}>
                      <span style={{fontSize:13,fontWeight:600}}>{row.display_name||"Traveler"}</span>
                      <span style={{fontSize:12,color:C.tx3}}>Paid {formatMoney(row.paid_total||0,expenseSummary.currency||"USD")}</span>
                      <span style={{fontSize:12,color:C.tx3}}>Share {formatMoney(row.share_total||0,expenseSummary.currency||"USD")}</span>
                      <span style={{fontSize:12,fontWeight:700,color:Number(row.net_balance||0)>=0?C.grn:C.red}}>
                        Net {formatMoney(row.net_balance||0,expenseSummary.currency||"USD")}
                      </span>
                    </div>);
                  })}
                </div>
              </div>
            )}
            <div>
              <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>RECENT RECEIPTS</p>
              {recentExpenses.length>0?(<div style={{display:"flex",flexDirection:"column",gap:8}}>
                {recentExpenses.slice(0,5).map(function(expense){
                  return(<div key={expense.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderTop:"1px solid "+C.border}}>
                    <div>
                      <p style={{fontSize:13,fontWeight:600}}>{expense.merchant||"Expense"}</p>
                      <p style={{fontSize:11,color:C.tx3}}>
                        {expense.expense_date||"Date TBD"} | {String(expense.category||"misc")}
                        {expense.split_count?(" | split "+expense.split_count+" ways"):""}
                      </p>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:C.goldT}}>{formatMoney(expense.amount||0,expense.currency||expenseSummary.currency||"USD")}</span>
                  </div>);
                })}
              </div>):(<p style={{fontSize:12,color:C.tx3}}>No receipts saved yet.</p>)}
            </div>
          </div>
          <div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border}}>
            <p style={{fontSize:12,fontWeight:700,color:C.tx3,marginBottom:10}}>TRIP SNAPSHOT</p>
            {[
              {l:"Status",v:String((comp.trip&&comp.trip.status)||tr.status||"active")},
              {l:"Approved days",v:String(comp.stats&&comp.stats.approved_days||0)},
              {l:"Planned items",v:String(comp.stats&&comp.stats.item_count||0)},
              {l:"Wizard step",v:String((comp.current_step||0)+1)}
            ].map(function(row){return(<div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13}}><span style={{color:C.tx3}}>{row.l}</span><span style={{fontWeight:600}}>{row.v}</span></div>);})}
          </div>
        </div>
      </div></Fade>
    </div>);
  }())}

  {sc==="profile"&&(<div style={{maxWidth:520}}>
    <Fade delay={50}><h1 style={{fontSize:26,fontWeight:700,marginBottom:24}}>My Profile</h1></Fade>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
      <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
        {showVoteDebug?"Hide Debug":"Show Debug"}
      </button>
    </div>
    {showVoteDebug&&(<div style={{marginBottom:16,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
      <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Profile Debug</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
        {[
          {l:"Profile hydrated",v:String(!!profileHydrated)},
          {l:"Auth user id",v:String(userIdFromToken(authToken)||"(none)")},
          {l:"Active trip id",v:String(resolveWizardTripId(currentTripId,newTrip,viewTrip)||"(none)")},
          {l:"Current email",v:String(user.email||"(none)")}
        ].map(function(item){
          return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
            <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
          </div>);
        })}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Local user state</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(user||{},null,2)}</pre>
        </div>
        <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Last GET /me/profile</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(profileDebug&&profileDebug.lastGet||null,null,2)}</pre>
        </div>
        <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Last PUT /me/profile payload</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(profileDebug&&profileDebug.lastPut||null,null,2)}</pre>
        </div>
        <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Last PUT /me/profile result</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(profileDebug&&profileDebug.lastPutResult||null,null,2)}</pre>
        </div>
        <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Active trip member profiles</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:220,overflowY:"auto"}}>{JSON.stringify(profileDebug&&profileDebug.tripProfiles||null,null,2)}</pre>
        </div>
      </div>
    </div>)}
    <Fade delay={100}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}><p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:8}}>NAME</p><input value={user.name||""} onChange={function(e){upU("name",e.target.value);}} style={{width:"100%",padding:"11px 14px",borderRadius:10,background:C.bg,border:"1.5px solid "+C.border,fontSize:14,color:"#fff"}}/></div></Fade>
    <Fade delay={150}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}><p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:8}}>TRAVEL STYLE</p><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>{STYLES.map(function(ts){var sel=(user.styles||[]).indexOf(ts.id)>=0;return(<button key={ts.id} onClick={function(){var cur=user.styles||[];upU("styles",cur.indexOf(ts.id)>=0?cur.filter(function(x){return x!==ts.id;}):cur.concat([ts.id]));}} style={{padding:"12px 8px",borderRadius:10,cursor:"pointer",background:sel?C.goldDim:C.bg,border:"2px solid "+(sel?C.gold+"50":C.border),color:sel?C.goldT:C.tx2,fontSize:13,fontWeight:sel?600:400}}>{ts.l}</button>);})}</div></div></Fade>
    <Fade delay={200}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}><p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:8}}>INTERESTS</p>{CATS.map(function(cat,i){var v=(user.interests||{})[cat.id];return(<div key={cat.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<CATS.length-1?"1px solid "+C.border:"none"}}><span style={{flex:1,fontSize:13,color:C.tx2}}>{cat.q}</span><div style={{display:"flex",gap:4}}>{[{l:"Y",v:true,c:C.grn},{l:"N",v:false,c:C.red}].map(function(o){var a=v===o.v;return(<button key={o.l} onClick={function(){var n=Object.assign({},user.interests||{});n[cat.id]=o.v;upU("interests",n);}} style={{width:28,height:28,borderRadius:6,border:a?"2px solid "+o.c:"1.5px solid "+C.border,background:a?o.c+"12":"transparent",color:a?o.c:C.tx3,fontWeight:600,fontSize:11,cursor:"pointer"}}>{o.l}</button>);})}</div></div>);})}</div></Fade>
    <Fade delay={250}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}><p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:8}}>BUDGET</p>{BUDGETS.map(function(b){var sel=user.budget===b.id;return(<button key={b.id} onClick={function(){upU("budget",b.id);}} style={{display:"flex",justifyContent:"space-between",width:"100%",padding:"10px 14px",borderRadius:10,cursor:"pointer",background:sel?C.goldDim:"transparent",border:"1.5px solid "+(sel?C.gold+"50":C.border),color:C.tx,marginBottom:4}}><span style={{color:sel?C.goldT:C.tx2}}>{b.l}</span><span style={{color:C.tx3}}>{b.r}</span></button>);})}</div></Fade>
    <Fade delay={300}><div style={{padding:"10px 14px",borderRadius:10,background:C.grnBg}}><p style={{fontSize:12,color:C.grn}}>Auto-saved</p></div></Fade>
  </div>)}

{sc==="crew"&&(<div style={{maxWidth:520}}>
    <Fade delay={50}><h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>My Crew</h1><p style={{fontSize:14,color:C.tx2,marginBottom:24}}>{acc.length} joined, {pendingCrewCount} pending</p></Fade>
    <Fade delay={100}><div style={{display:"flex",gap:8,marginBottom:20}}><input value={invEmail} onChange={function(e){setIE(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){sendCrewInvite();}}} placeholder="Email to invite" style={{flex:1,padding:"11px 14px",borderRadius:10,background:C.surface,border:"1.5px solid "+C.border,fontSize:14,color:"#fff"}}/><button onClick={sendCrewInvite} style={{padding:"10px 20px",borderRadius:10,border:"none",background:C.gold,color:C.bg,fontSize:14,fontWeight:600,cursor:"pointer"}}>Invite</button></div>{crewMsg&&<p style={{fontSize:12,color:C.tx2,marginTop:-12,marginBottom:10}}>{crewMsg}</p>}{crewInviteLinkUI}</Fade>
    <Fade delay={130}>
      <div style={{background:C.surface,borderRadius:12,padding:"13px 16px",border:"1px solid "+C.border,display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
        <Avi ini={iniFromName(user.name||"You")} color={C.gold} size={36} name={user.name||"You"}/>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:600}}>{user.name||"You"}</div>
          <div style={{fontSize:11,color:C.tx3}}>{user.email||"signed-in account"}</div>
        </div>
        <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,color:C.goldT,background:C.goldDim}}>account holder</span>
      </div>
    </Fade>
    <div style={{display:"flex",flexDirection:"column",gap:7}}>{crew.map(function(m,i){var sc2=m.status==="accepted"?C.grn:(m.status==="pending"||m.status==="invited")?C.wrn:m.status==="link_only"?C.sky:C.red;var sb=m.status==="accepted"?C.grnBg:(m.status==="pending"||m.status==="invited")?C.wrnBg:m.status==="link_only"?"rgba(77,168,218,0.15)":C.redBg;var rel=crewRelationLabel(m.relation);return(<Fade key={m.id} delay={150+i*50}><div style={{background:C.surface,borderRadius:12,padding:"13px 16px",border:"1px solid "+C.border,display:"flex",alignItems:"center",gap:12}}><Avi ini={m.ini} color={m.color} size={36} name={m.name}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{m.name}</div><div style={{fontSize:11,color:C.tx3}}>{m.email}</div></div><span style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:20,color:C.sky,background:"rgba(77,168,218,0.15)"}}>{rel}</span><span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,color:sc2,background:sb}}>{m.status==="invited"?"pending":m.status}</span></div></Fade>);})}</div>
  </div>)}

  {sc==="bucket"&&(<div>
    <Fade delay={50}><h1 style={{fontSize:26,fontWeight:700,marginBottom:4}}>My Bucket List</h1><p style={{fontSize:14,color:C.tx2,marginBottom:20}}>{bucket.length} destination{bucket.length!==1?"s":""} saved</p></Fade>
    {bucketMsg&&<p style={{fontSize:12,color:C.tx2,marginBottom:10}}>{bucketMsg}</p>}
    <Fade delay={100}><div style={{background:C.surface,borderRadius:16,border:"1px solid "+C.border,marginBottom:20,overflow:"hidden"}}>
      <div style={{padding:"14px 18px 8px",borderBottom:"1px solid "+C.border}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:999,background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700}}>B</div><span style={{fontSize:13,fontWeight:600,color:C.tealL}}>Bucket List Agent</span><span style={{fontSize:11,color:C.tx3,marginLeft:"auto"}}>AI-powered</span></div></div>
      <div style={{maxHeight:280,overflowY:"auto",padding:"12px 18px"}}>
        {blChat.map(function(msg,i){
          var isU=msg.from==="user";
          var sug=Array.isArray(msg.suggestions)?msg.suggestions:[];
          return(
            <div key={i} style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",marginBottom:8}}>
              <div style={{maxWidth:"85%"}}>
                <div style={{padding:"10px 14px",borderRadius:isU?"12px 12px 4px 12px":"12px 12px 12px 4px",background:isU?C.teal+"25":C.bg,border:"1px solid "+(isU?C.teal+"30":C.border),fontSize:14,lineHeight:1.6,color:isU?"#fff":C.tx2}}>{msg.text}</div>
                {!isU&&sug.length>0&&(
                  <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:6}}>
                    {sug.map(function(d,di){
                      var tkey=destinationTripKey(d);
                      return(<div key={tkey+"-"+di} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:C.surface,border:"1px solid "+C.border,borderRadius:10,padding:"8px 10px"}}>
                        <div><p style={{fontSize:13,fontWeight:600,color:"#fff"}}>{d.name}</p><p style={{fontSize:11,color:C.tx3}}>{d.country||"Destination"}</p></div>
                      </div>);
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {blLoad&&(<div style={{display:"flex",gap:5,padding:"8px 0"}}><div style={{width:6,height:6,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:6,height:6,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:6,height:6,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div>)}
        <div ref={chatRef}/>
      </div>
      <div style={{display:"flex",gap:8,padding:"10px 14px",borderTop:"1px solid "+C.border}}><input value={blIn} onChange={function(e){setBLI(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")sendBL();}} placeholder="e.g. 'northern lights' or 'Kyoto'" disabled={blLoad} style={{flex:1,padding:"11px 14px",borderRadius:10,background:C.bg,border:"1.5px solid "+C.border,fontSize:14,color:"#fff",opacity:blLoad?.5:1}}/><button onClick={sendBL} disabled={blLoad} style={{padding:"10px 20px",borderRadius:10,border:"none",background:blLoad?C.border:C.gold,color:blLoad?C.tx3:C.bg,fontSize:14,fontWeight:600,cursor:blLoad?"default":"pointer"}}>Send</button></div>
    </div></Fade>
    {bucket.length>0&&(<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,280px),1fr))",gap:14}}>{bucket.map(function(d,i){var saved=isPersistedBucketItem(d);return(<Fade key={d.id||i} delay={50+i*30}><div style={{background:C.surface,borderRadius:14,border:"1px solid "+C.border,padding:"16px 18px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:2}}>
        <h3 style={{fontSize:17,fontWeight:700,marginBottom:0}}>{d.name}</h3>
        <button onClick={function(){removeBucketDestination(d);}} title="Remove destination" aria-label={"Remove "+(d.name||"destination")} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.red+"40",background:C.redBg,color:C.red,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,whiteSpace:"nowrap"}}>
          <TrashIcon size={12} color={C.red}/>Remove
        </button>
      </div>
      <p style={{fontSize:13,color:C.tx2,marginBottom:8}}>{d.country}</p>
      {d.tags&&d.tags.length>0&&(<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{d.tags.map(function(t){return <span key={t} style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(255,255,255,.04)",color:C.tx2}}>{t}</span>;})}</div>)}
      <div style={{display:"flex",gap:2,marginBottom:8}}>{MO.map(function(m,mi){var g=(d.bestMonths||[]).indexOf(mi+1)>=0;return <div key={mi} style={{width:20,height:15,borderRadius:2,background:g?C.grn+"22":"rgba(255,255,255,.03)",color:g?C.grn:C.tx3,fontSize:8,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{m}</div>;})}</div>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:C.tealL}}>{d.bestTimeDesc||""}</span><span style={{fontSize:13,fontWeight:600,color:C.goldT}}>~${d.costPerDay||0}/day</span></div>
      {d.costNote&&<p style={{fontSize:11,color:C.tx3,marginTop:4}}>{d.costNote}</p>}
      <div style={{display:"flex",gap:8,marginTop:10}}>
        <button onClick={function(){saveBucketDestination(d);}} disabled={saved} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"none",background:saved?C.border:C.gold,color:saved?C.tx3:C.bg,fontSize:12,fontWeight:600,cursor:saved?"default":"pointer"}}>{saved?"Saved":"Save"}</button>
      </div>
      <button onClick={function(){pickDestinationForTrip(d);}} style={{marginTop:8,padding:"8px 12px",borderRadius:8,border:"none",background:C.teal,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",width:"100%"}}>Pick for Trip</button>
    </div></Fade>);})}</div>)}
  </div>)}

  {sc==="analytics"&&(<div>
    <Fade delay={50}><h1 style={{fontSize:26,fontWeight:700,marginBottom:24}}>Analytics</h1></Fade>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,200px),1fr))",gap:14,marginBottom:24}}>{[{l:"Trips",v:trips.length,c:C.gold},{l:"Destinations",v:bucket.length,c:C.teal},{l:"Crew",v:crew.length,c:C.sky},{l:"Interests",v:Object.keys(user.interests||{}).length+"/8",c:C.coral}].map(function(s,i){return(<Fade key={i} delay={100+i*50}><div style={{background:C.surface,borderRadius:14,padding:"18px 20px",border:"1px solid "+C.border}}><p style={{fontSize:12,color:C.tx3,marginBottom:6}}>{s.l}</p><p style={{fontWeight:700,fontSize:28,color:s.c}}>{s.v}</p></div></Fade>);})}</div>
    {bucket.length>0&&(<Fade delay={300}><div style={{background:C.surface,borderRadius:14,padding:20,border:"1px solid "+C.border}}><h3 style={{fontWeight:700,fontSize:16,marginBottom:14}}>Bucket List Costs</h3>{bucket.map(function(d){return(<div key={d.id} style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:C.tx2}}>{d.name}</span><span style={{fontSize:13,fontWeight:600,color:C.goldT}}>~${d.costPerDay||0}/day</span></div>);})}</div></Fade>)}
  </div>)}

  {sc==="new_trip"&&(<div style={{maxWidth:520}}>
    <Fade delay={50}><h1 style={{fontSize:26,fontWeight:700,marginBottom:24}}>Plan a New Trip</h1></Fade>
    <Fade delay={100}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}><p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:8}}>TRIP NAME</p><input placeholder="e.g. Summer 2025" value={newTrip.name} onChange={function(e){setNT(function(p){return Object.assign({},p,{name:e.target.value});});}} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:C.bg,border:"1.5px solid "+C.border,fontSize:14,color:"#fff"}}/></div></Fade>
    <Fade delay={150}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}><p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:10}}>DESTINATIONS ({newTrip.dests.length})</p>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input placeholder="Add a destination directly (e.g. Kyoto)" value={newTripDestInput} onChange={function(e){setNTDI(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){if(addDestinationToNewTrip(newTripDestInput))setNTDI("");}}} style={{flex:1,padding:"10px 12px",borderRadius:9,background:C.bg,border:"1.5px solid "+C.border,fontSize:13,color:"#fff"}}/>
        <button onClick={function(){if(addDestinationToNewTrip(newTripDestInput))setNTDI("");}} style={{padding:"9px 14px",borderRadius:9,border:"none",background:C.teal,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Add</button>
        <button onClick={searchDestinationsForTrip} disabled={!newTripDestInput.trim()||tripDestSearchLoad} style={{padding:"9px 14px",borderRadius:9,border:"1px solid "+C.goldT+"35",background:tripDestSearchLoad?C.border:C.goldDim,color:tripDestSearchLoad?C.tx3:C.goldT,fontSize:13,fontWeight:700,cursor:(!newTripDestInput.trim()||tripDestSearchLoad)?"default":"pointer"}}>{tripDestSearchLoad?"Searching...":"Search AI"}</button>
      </div>
      {destinationMsg&&<p style={{fontSize:12,color:C.tx2,marginBottom:10}}>{destinationMsg}</p>}
      <p style={{fontSize:12,color:C.tx3,marginBottom:10}}>Bucket list is optional here. Add destinations directly, or quick-pick them below.</p>
      {newTrip.dests.length>0?(<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>{tripDestinationNamesFromValues(newTrip.dests,bucket).map(function(destName){return(<div key={destName} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:999,background:C.bg,border:"1px solid "+C.border}}><span style={{fontSize:12,fontWeight:600,color:"#fff"}}>{destName}</span><button onClick={function(){removeDestinationFromNewTrip(destName);}} title="Remove destination" aria-label={"Remove "+destName} style={{padding:"3px 7px",borderRadius:999,border:"1px solid "+C.red+"30",background:C.redBg,color:C.red,fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button></div>);})}</div>):(<p style={{fontSize:13,color:C.tx3,marginBottom:12}}>Add at least one destination to start planning.</p>)}
      {bucket.length>0&&(<div style={{display:"flex",flexDirection:"column",gap:6}}>{bucket.map(function(d){var sel=tripDestinationNamesFromValues(newTrip.dests,bucket).some(function(name){return name.toLowerCase()===String(d.name||"").trim().toLowerCase();});return(<button key={d.id} onClick={function(){if(sel)removeDestinationFromNewTrip(d.name);else addDestinationToNewTrip(d.name);}} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,border:"2px solid "+(sel?C.gold+"50":C.border),background:sel?C.goldDim:"transparent",cursor:"pointer",color:C.tx}}><span style={{fontWeight:sel?600:400,color:sel?C.goldT:C.tx}}>{d.name} ({d.country})</span>{sel&&<span style={{color:C.gold}}>Y</span>}</button>);})}</div>)}
    </div></Fade>
    <Fade delay={200}><div style={{background:C.surface,borderRadius:14,padding:18,border:"1px solid "+C.border,marginBottom:16}}>
      <p style={{fontSize:11,fontWeight:600,color:C.tx3,marginBottom:10}}>SELECT CREW FOR THIS TRIP ({newTrip.members.length})</p>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input value={invEmail} onChange={function(e){setIE(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){sendCrewInvite({selectForTrip:true});}}} placeholder="Email (adds to My Crew; then select for this trip)" style={{flex:1,padding:"10px 12px",borderRadius:9,background:C.bg,border:"1.5px solid "+C.border,fontSize:13,color:"#fff"}}/>
        <button onClick={function(){sendCrewInvite({selectForTrip:true});}} style={{padding:"9px 14px",borderRadius:9,border:"none",background:C.gold,color:C.bg,fontSize:13,fontWeight:600,cursor:"pointer"}}>Invite</button>
      </div>
      {(crew.filter(function(m){return m.status!=="declined";}).length===0)&&(<p style={{fontSize:12,color:C.tx3,marginBottom:8}}>No crew yet. Invite by email above.</p>)}
      {crew.filter(function(m){return m.status!=="declined";}).map(function(m){
        var sel=newTrip.members.some(function(x){return x.id===m.id;});
        var st=String(m.status||"");
        var stc=st==="accepted"?C.grn:((st==="invited"||st==="pending")?C.wrn:(st==="link_only"?C.sky:C.tx3));
        return(<button key={m.id} onClick={function(){setNT(function(p){var ms=p.members||[];return Object.assign({},p,{members:ms.some(function(x){return x.id===m.id;})?ms.filter(function(x){return x.id!==m.id;}):ms.concat([toTripMember(m,"selected")])});});}} style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"8px 10px",borderRadius:10,border:"2px solid "+(sel?C.tealL+"50":C.border),background:sel?C.tealL+"10":"transparent",cursor:"pointer",color:C.tx,marginBottom:6}}>
          <Avi ini={m.ini} color={m.color} size={30}/>
          <span style={{flex:1,fontSize:14,textAlign:"left"}}>{m.name}</span>
          <span style={{fontSize:10,color:stc,textTransform:"uppercase"}}>{"Crew: "+crewStatusLabel(st)}</span>
          {sel&&<span style={{fontSize:11,color:C.tealL}}>Added</span>}
        </button>);
      })}
      <p style={{fontSize:12,color:C.tx3,marginTop:8}}>My Crew invite status is separate from Trip invite status. Step 2 sends trip-specific invitations for selected members.</p>
      {crewMsg&&<p style={{fontSize:12,color:C.tx2,marginTop:6}}>{crewMsg}</p>}
      {crewInviteLinkUI}
      {tripInviteMsg&&<p style={{fontSize:12,color:C.tx2,marginTop:6}}>{tripInviteMsg}</p>}
    </div></Fade>
    {newTrip.name&&newTrip.dests.length>0&&(<Fade delay={250}><button onClick={function(){
      var localTrip=Object.assign({},newTrip,{step:0,id:"trip"+Date.now(),status:"planning"});
      var destNames=tripDestinationNamesFromValues(newTrip.dests,bucket);
      if(authToken){
        apiJson("/wizard/sessions",{method:"POST",body:{trip_name:newTrip.name,duration_days:10,initial_state:{selected_destinations:destNames}}},authToken).then(function(r){
          if(r&&r.session){
            setWSID(r.session.id||"");
            setCTID(r.session.trip_id||"");
            if(r.session.trip_id&&destNames.length>0){
              apiJson("/trips/"+r.session.trip_id+"/destinations",{method:"PUT",body:{destinations:destNames,votes:{}}},authToken).catch(function(){});
            }
            if(r.session.trip_id&&newTrip.members&&newTrip.members.length>0){
              inviteSelectedMembersToTrip(r.session.trip_id,newTrip.members.filter(function(m){return isTripInvitePending(m);}));
            }
            var trip=Object.assign({},localTrip,{id:r.session.trip_id||localTrip.id,name:newTrip.name,dests:destNames.slice(),destNames:destNames.join(" + "),status:"planning"});
            setTrips(function(p){return p.concat([trip]);});
            setNT(trip);
            setWS(0);go("wizard");
          }
        }).catch(function(){
          apiJson("/trips",{method:"POST",body:{name:newTrip.name,duration_days:10,destination_hint:destNames[0]||""}},authToken).then(function(cr){
            var createdTripId=(cr&&cr.trip&&cr.trip.id)||"";
            if(createdTripId&&destNames.length>0){
              apiJson("/trips/"+createdTripId+"/destinations",{method:"PUT",body:{destinations:destNames,votes:{}}},authToken).catch(function(){});
            }
            if(createdTripId&&newTrip.members&&newTrip.members.length>0){
              inviteSelectedMembersToTrip(createdTripId,newTrip.members.filter(function(m){return isTripInvitePending(m);}));
            }
            var trip=Object.assign({},localTrip,{id:createdTripId||localTrip.id,name:newTrip.name,dests:destNames.slice(),destNames:destNames.join(" + "),status:"planning"});
            setCTID(createdTripId||"");
            setTrips(function(p){return p.concat([trip]);});
            setNT(trip);
            setWS(0);go("wizard");
          }).catch(function(){
            setTrips(function(p){return p.concat([localTrip]);});setNT(localTrip);setWS(0);go("wizard");
          });
        });
      }else{
        setTrips(function(p){return p.concat([localTrip]);});setNT(localTrip);setWS(0);go("wizard");
      }
    }} style={{width:"100%",marginTop:14,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Start Planning</button></Fade>)}
  </div>)}

  {sc==="wizard"&&(function(){
    var tr=newTrip;var pct=((wizStep+1)/WIZ.length)*100;
    var tm=(tr.members||[]);var jc=0;var invitedCount=0;var selectedCount=0;
    var effectiveTripBudgetTier=resolveTripBudgetTier(sharedBudgetTier,user.budget);
    tm.forEach(function(m){
      var st=mapTripMemberStatus(m&&(m.trip_status||m.status));
      if(st==="accepted"||tripJoined[m.id]){jc++;return;}
      if(st==="invited"){invitedCount++;return;}
      if(st!=="declined")selectedCount++;
    });
    function memberIdentity(member){
      var em=String(member&&member.email||"").trim().toLowerCase();
      if(em)return "email:"+em;
      var id=String(member&&member.id||"").trim();
      if(id)return "id:"+id;
      return "";
    }
    function findTripMemberFor(member){
      var key=memberIdentity(member);
      if(!key)return null;
      for(var i=0;i<tm.length;i++){
        if(memberIdentity(tm[i])===key)return tm[i];
      }
      return null;
    }
    var step2CrewPool=[];
    var step2CrewSeen={};
    function addStep2CrewMember(raw,tripStatusHint){
      var m=toTripMember(raw,tripStatusHint||raw&&raw.trip_status||raw&&raw.status||"selected");
      if(isCurrentMemberRow(m,authToken,user.email||""))return;
      if(mapTripMemberStatus(m.trip_status||m.status)==="declined")return;
      var key=memberIdentity(m);
      if(!key)return;
      if(step2CrewSeen[key]===undefined){
        step2CrewSeen[key]=step2CrewPool.length;
        step2CrewPool.push(m);
        return;
      }
      var idx=step2CrewSeen[key];
      var cur=step2CrewPool[idx]||{};
      var curSt=mapTripMemberStatus(cur.trip_status||cur.status);
      var nextSt=mapTripMemberStatus(m.trip_status||m.status);
      var rank={accepted:4,invited:3,selected:2,pending:2,declined:0};
      var useNext=(rank[nextSt]||1)>(rank[curSt]||1);
      step2CrewPool[idx]=Object.assign({},cur,m,useNext?{trip_status:nextSt,status:nextSt}:{});
    }
    var pendingCrewCount=0;
    (crew||[]).forEach(function(m){
      var cst=String(m&&m.crew_status||m&&m.status||"").trim().toLowerCase();
      if(cst==="accepted"){addStep2CrewMember(m,"selected");}
      else if(cst!=="declined"){pendingCrewCount++;}
    });
    tm.forEach(function(m){
      addStep2CrewMember(m,m.trip_status||m.status);
    });
    function toggleStep2Member(member){
      var key=memberIdentity(member);
      if(!key)return;
      setNT(function(prev){
        if(!prev)return prev;
        var ms=Array.isArray(prev.members)?prev.members:[];
        var exists=ms.some(function(x){return memberIdentity(x)===key;});
        var nextMembers=exists?ms.filter(function(x){return memberIdentity(x)!==key;}):ms.concat([toTripMember(member,"selected")]);
        return Object.assign({},prev,{members:nextMembers});
      });
    }
    var activeTravelerCount=activeTripTravelerCount(tm,tripJoined);
    var soloTripMode=activeTravelerCount<=1;
    var canGo=jc>0||tm.length===0;
    var tripDestInputs=(Array.isArray(tr.dests)&&tr.dests.length)?tr.dests:String(tr.destNames||"").split("+").map(function(s){return String(s||"").trim();}).filter(Boolean);
    var td=tripDestInputs.map(function(v,idx){
      var raw=String(v||"").trim();
      if(!raw)return null;
      var voteKey=canonicalDestinationVoteKey(raw,("dest:"+idx));
      var byId=bucket.find(function(b){return b.id===raw;});
      if(byId)return Object.assign({},byId,{vote_key:voteKey});
      var byName=bucket.find(function(b){return String(b&&b.name||"").trim().toLowerCase()===raw.toLowerCase();});
      if(byName)return Object.assign({},byName,{vote_key:voteKey});
      var sid=("trip-dest-"+idx+"-"+raw.toLowerCase().replace(/[^a-z0-9]+/g,"-")).replace(/^-+|-+$/g,"");
      return {id:sid||("trip-dest-"+idx),vote_key:voteKey,name:raw,country:"",bestMonths:[],costPerDay:0,tags:[],bestTimeDesc:"",costNote:""};
    }).filter(Boolean);
    var syncedTripId=String(currentTripId||tr.id||newTrip.id||"").trim();
    var currentVoteActor=buildCurrentVoteActor(authToken,user,syncedTripId);
    var currentPlannerId=currentVoteActor.id;
    var destVoteVoters=[{
      id:currentPlannerId,
      userId:userIdFromToken(authToken),
      email:user.email||"",
      name:user.name||user.email||"You",
      ini:iniFromName(user.name||user.email||"You"),
      color:C.gold
    }];
    tm.forEach(function(m,mi){
      var st=mapTripMemberStatus(m&&(m.trip_status||m.status));
      if(st==="accepted"||tripJoined[m.id]){
        var memberVoteId=makeVoteUserId(m.id,m.email,"");
        if(!memberVoteId)return;
        destVoteVoters.push({
          id:memberVoteId,
          userId:m.id||"",
          email:m.email||"",
          name:m.name||m.email||("Member "+(mi+1)),
          ini:m.ini||iniFromName(m.name||m.email||("Member "+(mi+1))),
          color:m.color||CREW_COLORS[(mi+1)%CREW_COLORS.length]
        });
      }
    });
    destVoteVoters=dedupeVoteVoters(destVoteVoters);
    var majorityNeeded=Math.floor(Math.max(destVoteVoters.length,1)/2)+1;
    function getDestVoteSummary(dest){
      var summary=summarizeDestinationVotes(destMemberVotes,dest,destVoteVoters,majorityNeeded);
      return {up:summary.up,down:summary.down,votedCount:summary.votedCount,allVoted:summary.allVoted,majorityWin:summary.majorityWin};
    }
    function castDestVote(dest,voter,vote){
      if(!voter||!canEditVoteForMember(voter,currentVoteActor,organizerMode))return;
      var aliases=voteKeyAliasesFor(voter);
      if(aliases.length===0)return;
      var voteKey=String(dest&&dest.vote_key||dest&&dest.id||"").trim();
      var canonicalKey=canonicalDestinationVoteKey(dest&&dest.name,voteKey);
      if(!voteKey&&!canonicalKey)return;
      setDMV(function(prev){
        var next=normalizeDestinationVoteState(prev);
        var row=Object.assign({},readDestinationVoteRow(next,dest));
        aliases.forEach(function(alias){row[alias]=vote;});
        next[canonicalKey]=row;
        var patchRows={};
        patchRows[canonicalKey]=row;
        saveTripPlanningState({state:{dest_member_votes:patchRows}}).then(function(){
          refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
        });
        return next;
      });
    }
    var vd=td.filter(function(d){var s=getDestVoteSummary(d);return s.majorityWin;});
    var allDestinationsVoted=td.length>0&&td.every(function(d){return getDestVoteSummary(d).allVoted;});
    var rawDests=vd.length>0?vd:td;
    var routePlanCurrentSignature=buildRoutePlanSignature(rawDests,user.interests||{},resolveTripBudgetTier(sharedBudgetTier,user.budget),user.dietary,user.styles||[],wizardPoiGroupPrefs);
    var routePlanContextStale=!!(
      routePlan&&
      routePlanSignature&&
      routePlanSignature!==routePlanCurrentSignature
    );
    var dests=routePlanContextStale?rawDests:orderDestinationsByRoutePlan(rawDests,routePlan);

    function logWizAction(action,payload){
      if(authToken&&wizSessionId){
        apiJson("/wizard/sessions/"+wizSessionId+"/actions",{method:"POST",body:{action_type:action,payload:payload||{}}},authToken).catch(function(){});
      }
    }
    function advanceWizardStep(){
      var n=wizStep+1;
      if(n<WIZ.length){
        setWizardStepShared(n);
      }else{
        go("dash");
      }
    }
    function adv(){
      logWizAction("approve_step",{step:wizStep});
      setCSM("");
      var stageKey=consensusStageKeyForStep(wizStep);
      if(!stageKey){advanceWizardStep();return;}
      submitStageConsensusDecision(stageKey,"approve",tr).then(function(out){
        if(out&&out.mode==="server"&&out.organizer===false){
          setCSM("Vote recorded. Waiting for organizer final decision.");
          refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          return;
        }
        setCSM("Stage approved by organizer.");
        advanceWizardStep();
      }).catch(function(e){
        setCSM("Consensus update failed: "+String(e&&e.message||"error"));
      });
    }
    function revise(){
      logWizAction("revise_step",{step:wizStep-1});
      setCSM("");
      var stageKey=consensusStageKeyForStep(wizStep);
      if(!stageKey){
        if(wizStep>0)setWizardStepShared(wizStep-1);
        return;
      }
      submitStageConsensusDecision(stageKey,"revise",tr).then(function(out){
        if(out&&out.mode==="server"&&out.organizer===false){
          setCSM("Revision requested. Waiting for organizer decision.");
          refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          return;
        }
        if(wizStep>0)setWizardStepShared(wizStep-1);
      }).catch(function(e){
        setCSM("Consensus update failed: "+String(e&&e.message||"error"));
      });
    }
    function sendStep2TripInvites(){
      var tripIdForInvites=String(currentTripId||tr.id||"").trim();
      if(!(authToken&&tripIdForInvites&&isUuidLike(tripIdForInvites))){setTIM("Save/start this trip first, then send trip invites.");return;}
      var pending=tm.filter(function(m){return isTripInvitePending(m);});
      if(pending.length===0){setTIM("Trip invites already sent for selected members.");return;}
      inviteSelectedMembersToTrip(tripIdForInvites,pending);
    }
    function budgetDailyValue(tier){
      if(tier==="budget")return 100;
      if(tier==="premium")return 320;
      if(tier==="luxury")return 520;
      return 180;
    }
    function saveBudgetThenAdvance(){
      setBSE("");
      var budgetTripId=resolveWizardTripId(currentTripId,newTrip,tr);
      if(!(authToken&&budgetTripId&&isUuidLike(budgetTripId))){
        setBSE("Trip context missing. Please refresh and try again.");
        return;
      }
      var chosenTier=String(sharedBudgetTier||user.budget||"moderate").trim().toLowerCase()||"moderate";
      setBSL(true);
      persistPlanningStateStrict({state:{shared_budget_tier:chosenTier}}).then(function(){
        return apiJson("/trips/"+budgetTripId+"/budget",{method:"POST",body:{daily_budget:budgetDailyValue(chosenTier),currency:"USD"}},authToken);
      }).then(function(){
        setBSL(false);adv();
      }).catch(function(e){
        setBSL(false);
        setBSE(String(e&&e.message||"Could not save budget to backend"));
      });
    }
    function airportLookupQueries(value){
      var raw=String(value||"").trim();
      if(raw.length<2)return [];
      var seen={};
      var out=[];
      function add(q){
        var text=String(q||"").trim().replace(/\s+/g," ");
        if(text.length<2)return;
        var key=text.toLowerCase();
        if(seen[key])return;
        seen[key]=1;
        out.push(text);
      }
      add(raw);
      raw.replace(/\(([^)]+)\)/g,function(_,inner){
        add(inner);
        return _;
      });
      var withoutParens=raw.replace(/\([^)]*\)/g," ").replace(/\s+/g," ").trim();
      add(withoutParens);
      withoutParens.split(/\s+-\s+|\s+\/\s+|,\s*/g).forEach(function(part){add(part);});
      raw.split(/\s+-\s+|\s+\/\s+|,\s*/g).forEach(function(part){add(part);});
      var words=withoutParens.split(/\s+/).filter(Boolean);
      if(words.length>=2){
        add(words[words.length-1]);
        add(words.slice(-2).join(" "));
      }
      return out.slice(0,6);
    }
    function explicitAirportCode(value){
      var raw=String(value||"").trim();
      if(/^[A-Za-z]{3}$/.test(raw))return raw.toUpperCase();
      var parenMatch=raw.match(/\(([A-Za-z]{3})\)\s*$/);
      if(parenMatch&&parenMatch[1])return String(parenMatch[1]).toUpperCase();
      return "";
    }
    async function resolveAirportCode(value,fallbackCode){
      var explicit=explicitAirportCode(value);
      if(explicit)return explicit;
      var query=String(value||"").trim();
      if(query.length<2)return String(fallbackCode||"").trim().toUpperCase();
      var queries=airportLookupQueries(query);
      for(var i=0;i<queries.length;i++){
        var lookup=String(queries[i]||"").trim();
        if(lookup.length<2)continue;
        var cacheKey=lookup.toLowerCase();
        var cached=airportResolveCacheRef.current[cacheKey];
        if(cached!==undefined){
          if(String(cached||"").trim())return String(cached||"").trim().toUpperCase();
          continue;
        }
        try{
          var res=await apiJson("/airports/search?q="+encodeURIComponent(lookup),{method:"GET"},authToken);
          var airports=Array.isArray(res&&res.airports)?res.airports:[];
          var best=airports[0]||null;
          var bestCode=String(best&&best.iata||"").trim().toUpperCase();
          airportResolveCacheRef.current[cacheKey]=bestCode||"";
          if(bestCode)return bestCode;
        }catch(e){
          airportResolveCacheRef.current[cacheKey]="";
        }
      }
      var aliasCode=airportAliasFallbackCode(query);
      if(aliasCode)return aliasCode;
      return String(fallbackCode||"").trim().toUpperCase();
    }
    function currentLockedFlightWindow(){
      var raw=(availabilityData&&availabilityData.locked_window&&typeof availabilityData.locked_window==="object")?availabilityData.locked_window:null;
      if(raw)return raw;
      if(flightDates.depart&&flightDates.ret)return {start:String(flightDates.depart||"").slice(0,10),end:String(flightDates.ret||"").slice(0,10)};
      return null;
    }
    function normalizedFlightRoutePlan(planOverride){
      var savedPlan=(planOverride!==undefined?planOverride:flightLegInputs);
      return buildFlightRoutePlan(
        routePlanDestinationOrder(flightPlannerDests,savedPlan),
        effectiveDurPerDest,
        currentLockedFlightWindow(),
        savedPlan
      );
    }
    function displayedRoundTripRoutePlan(planOverride){
      var normalized=normalizedFlightRoutePlan(planOverride);
      var finalDate=(currentLockedFlightWindow()&&String(currentLockedFlightWindow().end||"").slice(0,10))||String(flightDates.ret||"").slice(0,10);
      return roundTripFlightRoutePlan(normalized,finalDate);
    }
    function persistFlightRoute(nextDates,nextPlan){
      var normalizedPlan=normalizedFlightRoutePlan(nextPlan);
      var nextFlightDates=Object.assign({},flightDates||{},nextDates||{});
      var locked=currentLockedFlightWindow();
      if(locked&&locked.start)nextFlightDates.depart=String(locked.start||"").slice(0,10);
      if(locked&&locked.end)nextFlightDates.ret=String(locked.end||"").slice(0,10);
      setFD(nextFlightDates);
      setFLI(normalizedPlan);
      saveTripPlanningState({state:{
        flight_dates:{
          origin:String(nextFlightDates.origin||"").trim(),
          final_airport:String(nextFlightDates.final_airport||"").trim(),
          depart:String(nextFlightDates.depart||"").slice(0,10),
          ret:String(nextFlightDates.ret||"").slice(0,10)
        },
        flight_route_plan:normalizedPlan
      }}).catch(function(){});
      return {plan:normalizedPlan,dates:nextFlightDates};
    }
    async function buildFlightSegments(routePlan,originInput,finalAirportInput){
      var segments=[];
      var plan=displayedRoundTripRoutePlan(routePlan);
      if(plan.length===0)throw new Error("Add at least one destination before searching flights.");
      var originCode=await resolveAirportCode(originInput,"");
      if(!originCode||originCode.length!==3)throw new Error("Could not match the starting city to an airport.");
      var prevCode=originCode;
      for(var i=0;i<plan.length;i++){
        var stop=plan[i]||{};
        var airportLabel=String(stop.airport||stop.destination||"").trim();
        var nextCode=await resolveAirportCode(airportLabel,"");
        var travelDate=String(stop.travel_date||"").slice(0,10);
        if(!nextCode||nextCode.length!==3){
          throw new Error((airportLabel?('Could not match "'+airportLabel+'" to an airport for stop '+(i+1)+'.'):('Enter a city or airport for stop '+(i+1)+'.')));
        }
        if(!travelDate){
          throw new Error("Enter a travel date for "+String(stop.destination||("stop "+(i+1)))+".");
        }
        if(prevCode!==nextCode){
          segments.push({from_airport:prevCode,to_airport:nextCode,depart_date:travelDate});
        }
        prevCode=nextCode;
      }
      var finalInput=String(finalAirportInput||originInput||"").trim();
      var finalCode=await resolveAirportCode(finalInput,originCode);
      if(!finalCode||finalCode.length!==3){
        throw new Error((finalInput?('Could not match "'+finalInput+'" to an airport for the final return leg.'):("Enter a final return city or airport.")));
      }
      var finalDate=(currentLockedFlightWindow()&&String(currentLockedFlightWindow().end||"").slice(0,10))||String(flightDates.ret||"").slice(0,10);
      if(finalCode!==prevCode){
        if(!finalDate)throw new Error("Enter the final return date.");
        segments.push({from_airport:prevCode,to_airport:finalCode,depart_date:finalDate});
      }
      return segments;
    }
    async function searchFlights(){
      setFErr("");
      setFC(false);
      setFBL([]);
      var originInput=String(flightDates.origin||"").trim();
      var finalAirportInput=String(flightDates.final_airport||flightDates.origin||"").trim();
      var departDate=String(flightDates.depart||"").slice(0,10);
      var returnDate=String(flightDates.ret||"").slice(0,10);
      if(!(authToken&&currentTripId)){setFErr("Sign in and create/save the trip first.");return;}
      if(originInput.length<2){setFErr("Enter your starting city or airport.");return;}
      if(finalAirportInput.length<2){setFErr("Enter your final return city or airport.");return;}
      if(!departDate){setFErr("Select a departure date.");return;}
      if(!returnDate){setFErr("Select a return date.");return;}
      setFLoad(true);
      setFDone(false);
      setFLegs([]);
      setFSel({});
      try{
        var routePlan=normalizedFlightRoutePlan();
        var origin=await resolveAirportCode(originInput,"");
        var firstArrival=await resolveAirportCode(String((routePlan[0]&&routePlan[0].airport)||"",),"");
        if(!origin||origin.length!==3){setFLoad(false);setFDone(false);setFErr("Could not match the starting city to an airport.");return;}
        if(!firstArrival||firstArrival.length!==3){setFLoad(false);setFDone(false);setFErr("Could not match the first destination city to an airport.");return;}
        var segments=await buildFlightSegments(routePlan,originInput,finalAirportInput);
        var r=await apiJson("/trips/"+currentTripId+"/flights/search",{method:"POST",body:{
          origin:origin,
          destination:firstArrival,
          depart_date:departDate,
          return_date:returnDate,
          round_trip:false,
          cabin_class:"economy",
          multi_city_segments:segments
        }},authToken);
        var legs=(r&&r.legs)||[];
        setFLegs(legs);
        setFDone(true);
        setFLoad(false);
        if(legs.length===0)setFErr("No flight options found.");
        logWizAction("record_selection",{key:"flights.search",value:{origin:origin,destination:firstArrival,segments:segments.length,source:r&&r.search_params&&r.search_params.source}});
      }catch(e){
        setFLoad(false);
        setFDone(false);
        setFErr(String(e&&e.message||"Flight search failed"));
      }
    }
    function legSelectionKey(leg, legIndex){
      var raw=String(
        (leg&&(
          leg.leg_id||
          leg.segment_id||
          leg.id
        ))||
        ""
      ).trim();
      if(raw)return raw;
      return "leg-"+String(legIndex);
    }
    function optionSelectionKey(opt, optionIndex){
      var raw=String(
        (opt&&(
          opt.flight_id||
          opt.offer_id||
          opt.id
        ))||
        ""
      ).trim();
      if(raw)return raw;
      var signature=[
        String(opt&&opt.airline||"").trim(),
        String(opt&&opt.departure_time||"").trim(),
        String(opt&&opt.arrival_time||"").trim(),
        String((opt&&opt.price_usd)!==undefined?opt.price_usd:(opt&&opt.price)!==undefined?opt.price:"").trim()
      ].join("|");
      if(signature.replace(/\|/g,"").trim())return "opt:"+signature;
      return "opt-index-"+String(optionIndex);
    }
    function selectedOptionForLeg(leg, legIndex){
      var legKey=legSelectionKey(leg,legIndex);
      var selectedKey=String((flightSel&&flightSel[legKey])||"").trim();
      if(!selectedKey)return null;
      var options=Array.isArray(leg&&leg.options)?leg.options:[];
      for(var i=0;i<options.length;i++){
        if(optionSelectionKey(options[i],i)===selectedKey)return options[i];
      }
      return null;
    }
    function confirmFlightsThenContinue(){
      var missingProviderId=false;
      var missingOptionLegs=[];
      var legSelections=[];
      var links=[];
      var autopickStatePatch={};
      (flightLegs||[]).forEach(function(leg,legIndex){
        var legKey=legSelectionKey(leg,legIndex);
        var options=Array.isArray(leg&&leg.options)?leg.options:[];
        var opt=selectedOptionForLeg(leg,legIndex);
        if(!opt&&options.length>0){
          opt=options[0];
          autopickStatePatch[legKey]=optionSelectionKey(opt,0);
        }
        if(!opt){
          missingOptionLegs.push(String(leg&&leg.from_airport||"?")+" -> "+String(leg&&leg.to_airport||"?"));
          return;
        }
        var fid=String((opt&&(
          opt.flight_id||
          opt.offer_id||
          opt.id
        ))||"").trim();
        if(!fid)missingProviderId=true;
        legSelections.push({leg_id:String(leg&&leg.leg_id||leg&&leg.segment_id||leg&&leg.id||legKey),flight_id:fid||""});
        if(opt&&opt.booking_url)links.push({leg_id:String(leg&&leg.leg_id||leg&&leg.segment_id||leg&&leg.id||legKey),airline:opt.airline||"Airline",route:(opt.departure_airport||"")+" -> "+(opt.arrival_airport||""),url:opt.booking_url});
      });
      if(Object.keys(autopickStatePatch).length>0){
        setFSel(function(prev){
          return Object.assign({},prev||{},autopickStatePatch);
        });
      }
      if(missingOptionLegs.length>0){
        setFErr("No selectable options were returned for: "+missingOptionLegs.join(", ")+". Run Search Flight Options again.");
        return;
      }
      if(legSelections.length===0){setFErr("No flight options are selectable yet. Run Search Flight Options again.");return;}
      if(missingProviderId){
        setFErr("One selected flight is missing a provider ID. Please run Search Flight Options again.");
        return;
      }
      if(!(authToken&&currentTripId)){setFC(true);setFBL(links);adv();return;}
      setFCL(true);
      setFErr("");
      apiJson("/trips/"+currentTripId+"/flights/select",{method:"POST",body:{leg_selections:legSelections}},authToken).then(function(){
        setFC(true);
        setFBL(links);
        logWizAction("record_selection",{key:"flights.selected",value:legSelections});
        return persistPlanningStateStrict({state:{flight_dates:{
          origin:flightDates.origin||"",
          final_airport:flightDates.final_airport||"",
          depart:String(flightDates.depart||"").slice(0,10),
          ret:String(flightDates.ret||"").slice(0,10)
        },flight_route_plan:normalizedFlightRoutePlan(),flights_confirmed:true,flight_booking_links:links}});
      }).then(function(){
        setFCL(false);
        links.forEach(function(link){
          try{window.open(link.url,"_blank","noopener,noreferrer");}catch(e){}
        });
        adv();
      }).catch(function(e){
        setFCL(false);
        setFErr(String(e&&e.message||"Could not persist confirmed flights. Please retry."));
      });
    }
    function routePlanNearbyPoisForItinerary(){
      var rows=[];
      (Array.isArray(routePlan&&routePlan.destinations)?routePlan.destinations:[]).forEach(function(stop){
        var destName=String(stop&&stop.destination||"").trim();
        if(!destName)return;
        var nearbySites=Array.isArray(stop&&stop.nearbySites)?stop.nearbySites.filter(Boolean):[];
        nearbySites.slice(0,4).forEach(function(site,idx){
          var siteName=String(site||"").trim();
          if(!siteName)return;
          rows.push({
            poi_id:"",
            name:siteName,
            destination:destName,
            country:String(stop&&stop.country||"").trim(),
            category:"Culture",
            duration:"90m",
            cost:0,
            rating:4.1-(idx*0.05),
            matchReason:"Route-plan nearby site included to keep activity coverage grounded.",
            tags:["Nearby site","Route plan"],
            locationHint:destName+" area",
            bestTime:"morning",
            openingWindow:"",
            source:"route-plan-nearby",
            failureReason:""
          });
        });
      });
      return rows;
    }
    function resolveItineraryPoiRows(baseRows,minPerDestination){
      var budgetTier=resolveTripBudgetTier(sharedBudgetTier,user.budget);
      var rows=Array.isArray(baseRows)?baseRows.filter(Boolean):[];
      var merged=mergePoiListsByCanonical(rows,poiOptionPool);
      if(merged.length===0){
        merged=mergePoiListsByCanonical(pois,poiOptionPool);
      }
      if(merged.length===0){
        merged=routePlanNearbyPoisForItinerary();
      }
      if(merged.length===0){
        var generatedFallback=[];
        (Array.isArray(dests)?dests:[]).forEach(function(dest){
          generatedFallback=generatedFallback.concat(
            buildDestinationFallbackPois(dest,user.interests||{},budgetTier,user.dietary,wizardPoiGroupPrefs,routePlan,"itinerary_no_poi_state")
          );
        });
        merged=generatedFallback;
      }
      merged=groundPoiRowsWithRoutePlan(merged,routePlan,user.interests||{},budgetTier,user.dietary,wizardPoiGroupPrefs);
      var missing=destinationsNeedingPoiCoverage(merged,dests,Math.max(1,Number(minPerDestination)||1));
      if(missing.length>0){
        var fillRows=[];
        missing.forEach(function(dest){
          fillRows=fillRows.concat(
            buildDestinationFallbackPois(dest,user.interests||{},budgetTier,user.dietary,wizardPoiGroupPrefs,routePlan,"itinerary_destination_gap")
          );
        });
        merged=mergePoiListsByCanonical(merged.concat(fillRows),{});
      }
      return merged;
    }
    function buildItineraryWithBackend(accPois,pStays,appMeals,totalDays,grpSize,forceFresh){
      var force=!!forceFresh;
      var itineraryStartDate=(availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start)||flightDates.depart||"";
      var itineraryDurations=fillMissingDurationPerDestination(
        dests,
        durPerDest,
        totalDays
      );
      var itineraryPois=resolveItineraryPoiRows(accPois,1);
      var fallbackRows=buildFallbackItinerary(dests,itineraryPois,pStays,appMeals,totalDays,itineraryStartDate,itineraryDurations);
      function persistItineraryRows(rows){
        var payload=buildItinerarySavePayload(rows);
        if(!(authToken&&currentTripId))return Promise.resolve(payload);
        if(!Array.isArray(payload.days)||payload.days.length===0)return Promise.resolve(payload);
        return apiJson("/trips/"+currentTripId+"/itinerary",{method:"POST",body:payload},authToken);
      }
      function finalizeItineraryResult(res){
        var rows=(Array.isArray(res)&&res.length>0)
          ? res
          : fallbackRows;
        rows=chooseBestItineraryRows(rows,fallbackRows,itineraryPois);
        rows=materializeItineraryDates(rows,itineraryStartDate);
        persistItineraryRows(rows).then(function(){
          setItinErr("");
          setItin(rows);
          setIL(false);
          setID(true);
        }).catch(function(e){
          setItin(rows);
          setIL(false);
          setID(true);
          setItinErr(String(e&&e.message||"Could not persist itinerary"));
        });
      }
      setIL(true);
      setItinErr("");
      if(force){
        finalizeItineraryResult(fallbackRows);
        return;
      }
      if(authToken&&currentTripId){
        apiJson("/trips/"+currentTripId+"/itinerary",{method:"GET"},authToken).then(function(r){
          var days=(r&&r.itinerary&&r.itinerary.days)||[];
          if(days.length>0){
            var rows=days.map(function(d){
              var acts=d.activities||[];
              var mapped=acts.map(function(a){
                var slot=String(a.time_slot||"");
                var timeLabel=slot.indexOf("-")>=0?slot.split("-")[0]:slot;
                var cat=String(a.category||"activity").toLowerCase();
                var t=(cat==="flight"||cat==="checkin"||cat==="checkout"||cat==="meal"||cat==="travel"||cat==="rest")?cat:"activity";
                return {time:timeLabel,type:t,title:a.title,cost:a.cost_estimate||0};
              });
              return {
                day:d.day_number||1,
                date:d.date||("Day "+(d.day_number||1)),
                destination:(acts[0]&&acts[0].location)||"Trip",
                theme:d.title||"Plan",
                items:mapped
              };
            });
            rows=chooseBestItineraryRows(rows,fallbackRows,itineraryPois);
            rows=materializeItineraryDates(rows,itineraryStartDate);
            setItin(rows);
            setIL(false);
            setID(true);
            return;
          }
          return askItinerary(dests,itineraryPois,pStays,appMeals,user.budget,totalDays,grpSize,itineraryStartDate).then(finalizeItineraryResult);
        }).catch(function(){
          askItinerary(dests,itineraryPois,pStays,appMeals,user.budget,totalDays,grpSize,itineraryStartDate).then(finalizeItineraryResult);
        });
      }else{
        askItinerary(dests,itineraryPois,pStays,appMeals,user.budget,totalDays,grpSize,itineraryStartDate).then(finalizeItineraryResult);
      }
    }
    function saveItineraryThenAdvance(){
      var rows=materializeItineraryDates(itin,(availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start)||flightDates.depart||"");
      if(authToken&&currentTripId){
        setIL(true);
        setItinErr("");
        apiJson("/trips/"+currentTripId+"/itinerary",{method:"POST",body:buildItinerarySavePayload(rows)},authToken)
          .then(function(){
            setItin(rows);
            setIL(false);
            adv();
          })
          .catch(function(e){
            setIL(false);
            setItinErr(String(e&&e.message||"Could not save itinerary before continuing"));
          });
      }else{
        setItin(rows);
        adv();
      }
    }
    function confirmTripAndActivate(){
      function approveSavedItinerary(){
        return apiJson("/trips/"+currentTripId+"/itinerary/approve",{method:"POST",body:{approved:true}},authToken).then(function(res){
          var nextStatus=String(res&&res.trip&&res.trip.status||"").trim().toLowerCase();
          if(nextStatus){
            setTrips(function(prev){
              return (prev||[]).map(function(t){
                if(!t||String(t.id||"")!==String(currentTripId||""))return t;
                return Object.assign({},t,{status:nextStatus,trip_status:nextStatus});
              });
            });
            setNT(function(prev){
              if(!prev||String(prev.id||"")!==String(currentTripId||""))return prev;
              return Object.assign({},prev,{status:nextStatus,trip_status:nextStatus});
            });
            setVT(function(prev){
              if(!prev||String(prev.id||"")!==String(currentTripId||""))return prev;
              return Object.assign({},prev,{status:nextStatus,trip_status:nextStatus});
            });
          }
          return Promise.allSettled([
            refreshCurrentTripSharedState(authToken,currentTripId),
            refreshTripsFromBackend(authToken)
          ]);
        });
      }
      if(authToken&&currentTripId){
        setIL(true);
        setItinErr("");
        apiJson("/trips/"+currentTripId+"/itinerary",{method:"POST",body:buildItinerarySavePayload(materializeItineraryDates(itin,(availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start)||flightDates.depart||""))},authToken)
          .then(function(){
            return approveSavedItinerary();
          })
          .then(function(){
            setIL(false);
          })
          .catch(function(e){
            setIL(false);
            setItinErr(String(e&&e.message||"Could not confirm trip"));
          });
      }else{
        setItinErr("Trip confirmation requires a saved trip.");
      }
    }
    function applyRoutePlanDurations(plan){
      var suggestions=routePlanDurationMap(plan);
      if(!suggestions||Object.keys(suggestions).length===0)return;
      setDPD(function(prev){
        var next=Object.assign({},prev||{});
        Object.keys(suggestions).forEach(function(name){
          if(!next[name])next[name]=suggestions[name];
        });
        return next;
      });
    }
    function persistRoutePlanState(plan,signature){
      var nextPlan=plan&&typeof plan==="object"?plan:null;
      if(!(nextPlan&&Array.isArray(nextPlan.destinations)&&nextPlan.destinations.length)){
        var missingErr=new Error("Build a route plan first.");
        setRPE(missingErr.message);
        return Promise.reject(missingErr);
      }
      var nextSignature=String(signature||routePlanSignature||"").trim();
      if(!nextSignature){
        nextSignature=buildRoutePlanSignature(rawDests,user.interests||{},resolveTripBudgetTier(sharedBudgetTier,user.budget),user.dietary,user.styles||[],wizardPoiGroupPrefs);
      }
      var nextDurations=routePlanDurationMap(nextPlan);
      setRoutePlan(nextPlan);
      setRPS(nextSignature);
      setRPD(true);
      applyRoutePlanDurations(nextPlan);
      setRPE("");
      setRPSL(true);
      return saveTripPlanningState({state:{
        route_plan:nextPlan,
        route_plan_signature:nextSignature,
        duration_per_destination:nextDurations
      }}).then(function(res){
        setRPSL(false);
        return res;
      }).catch(function(e){
        setRPSL(false);
        setRPE(String(e&&e.message||"Could not save the route plan"));
        throw e;
      });
    }
    function buildRoutePlanThenContinue(shouldAdvance){
      var activeBudget=resolveTripBudgetTier(sharedBudgetTier,user.budget);
      var signature=buildRoutePlanSignature(rawDests,user.interests||{},activeBudget,user.dietary,user.styles||[],wizardPoiGroupPrefs);
      setRPL(true);
      setRPE("");
      askRoutePlan(rawDests,user.interests||{},activeBudget,user.dietary,user.styles||[],wizardPoiGroupPrefs).then(function(plan){
        if(!(plan&&Array.isArray(plan.destinations)&&plan.destinations.length)){
          setRPL(false);
          setRPD(false);
          setRPE("Could not build a route plan yet. Try again in a moment.");
          return;
        }
        setRoutePlan(plan);
        setRPS(signature);
        setRPD(true);
        applyRoutePlanDurations(plan);
        setRPL(false);
        persistRoutePlanState(plan,signature).then(function(){
          setRPL(false);
          if(shouldAdvance)adv();
        }).catch(function(){
          setRPL(false);
        });
      }).catch(function(e){
        setRPL(false);
        setRPD(false);
        setRPE(String(e&&e.message||"Could not build a route plan"));
      });
    }

    var organizerMode=isWizardOrganizer(tr);
    var hdr=(<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}><button onClick={function(){if(wizStep>0)setWizardStepShared(wizStep-1);else go("dash");}} style={{background:"none",border:"none",color:C.tx3,cursor:"pointer",fontSize:13}}>Back</button><div style={{flex:1,height:3,background:C.border,borderRadius:2}}><div style={{height:"100%",width:pct+"%",background:"linear-gradient(90deg,"+C.gold+","+C.coral+")",borderRadius:2,transition:"width .5s"}}/></div><span style={{fontSize:11,color:C.tx3}}>{wizStep+1}/{WIZ.length}</span></div>);
    var shdr=(<Fade delay={50}><div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0 20px"}}><div style={{width:44,height:44,borderRadius:13,background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff"}}>{wizStep+1}</div><div><h2 style={{fontSize:20,fontWeight:700}}>{WIZ[wizStep]}</h2><p style={{fontSize:13,color:C.tx2}}>Step {wizStep+1} of {WIZ.length}</p></div></div></Fade>);
    var chps=(<Fade delay={80}><div style={{background:C.surface,borderRadius:14,padding:"14px 18px",border:"1px solid "+C.border,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:12,color:C.tx3}}>{tr.name||"Trip"}</span><div style={{display:"flex",gap:3}}><Avi ini={user.name?user.name.charAt(0):"Y"} color={C.gold} size={20}/>{tm.map(function(m){return <Avi key={m.id} ini={m.ini} color={m.color} size={20}/>;})}</div></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,color:C.tx3}}>{organizerMode?"Organizer final say enabled":"Voting mode - organizer finalizes each stage"}</span><span style={{fontSize:11,color:C.tx3}}>{organizerMode?"Organizer":"Crew member"}</span></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{WIZ.map(function(s,i){var dn=i<wizStep;var a=i===wizStep;var canJump=organizerMode||i<=wizStep;return(<div key={i} onClick={function(){if(canJump)setWizardStepShared(i);}} style={{width:28,height:28,borderRadius:7,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",cursor:canJump?"pointer":"default",opacity:canJump?1:.85,background:a?C.gold:dn?C.teal+"25":C.bg,color:a?C.bg:dn?C.teal:C.tx3,border:a?"none":"1px solid "+C.border}}>{dn?"Y":(i+1)}</div>);})}</div></div></Fade>);

    var ab=function(n,msg){return(<div style={{display:"flex",gap:10,marginBottom:14}}><div style={{width:28,height:28,borderRadius:999,background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",flexShrink:0}}>AI</div><div><p style={{fontSize:11,color:C.tealL,fontWeight:600,marginBottom:3}}>{n}</p><div style={{background:C.bg,padding:"10px 14px",borderRadius:"12px 12px 12px 3px",fontSize:14,lineHeight:1.6,color:C.tx2,border:"1px solid "+C.border}}>{msg}</div></div></div>);};
    var goBtn=function(label){return(<button onClick={adv} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>{label||"Approve & Continue"}</button>);};
    var ynBtns=(<div style={{display:"flex",gap:10,marginTop:16}}><button onClick={revise} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid "+C.red,background:"transparent",color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Revise</button><button onClick={adv} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:C.teal,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>{wizStep>=WIZ.length-1?"Finish Trip":"Approve"}</button></div>);
    return(<div style={{maxWidth:560}}>{hdr}{shdr}{chps}{consensusMsg&&(<Fade delay={95}><div style={{marginBottom:10,padding:"10px 14px",borderRadius:10,background:C.teal+"10",border:"1px solid "+C.teal+"20"}}><p style={{fontSize:12,color:C.tealL}}>{consensusMsg}</p></div></Fade>)}<Fade delay={120}><div style={{background:C.surface,borderRadius:16,padding:"22px",border:"1px solid "+C.border}}>

    {wizStep===0&&(<div>
      {ab("Destination Agent","Here are the destinations you selected. Confirm to lock them in.")}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={newTripDestInput} onChange={function(e){setNTDI(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){if(addDestinationToNewTrip(newTripDestInput))setNTDI("");}}} placeholder="Add another destination directly" style={{flex:1,padding:"10px 12px",borderRadius:9,background:C.bg,border:"1.5px solid "+C.border,fontSize:13,color:"#fff"}}/>
        <button onClick={function(){if(addDestinationToNewTrip(newTripDestInput))setNTDI("");}} style={{padding:"9px 14px",borderRadius:9,border:"none",background:C.teal,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Add</button>
        <button onClick={searchDestinationsForTrip} disabled={!newTripDestInput.trim()||tripDestSearchLoad} style={{padding:"9px 14px",borderRadius:9,border:"1px solid "+C.goldT+"35",background:tripDestSearchLoad?C.border:C.goldDim,color:tripDestSearchLoad?C.tx3:C.goldT,fontSize:13,fontWeight:700,cursor:(!newTripDestInput.trim()||tripDestSearchLoad)?"default":"pointer"}}>{tripDestSearchLoad?"Searching...":"Search AI"}</button>
      </div>
      {destinationMsg&&<p style={{fontSize:12,color:C.tx2,marginBottom:10}}>{destinationMsg}</p>}
      {td.length===0&&<p style={{fontSize:13,color:C.tx3,marginBottom:10}}>Add at least one destination before continuing.</p>}
      {td.map(function(d){return(<div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid "+C.border,gap:10}}><div><span style={{fontWeight:600}}>{d.name}</span><span style={{color:C.tx3,marginLeft:8,fontSize:13}}>{d.country}</span></div><div style={{textAlign:"right",display:"flex",alignItems:"center",gap:10}}><div><span style={{color:C.goldT,fontWeight:600,fontSize:13}}>~${d.costPerDay}/day</span>{d.bestTimeDesc&&<p style={{fontSize:11,color:C.tx3}}>{d.bestTimeDesc}</p>}</div><button onClick={function(){removeDestinationFromNewTrip(d.name);}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.red+"30",background:C.redBg,color:C.red,fontSize:11,fontWeight:700,cursor:"pointer"}}>Remove</button></div></div>);})}
      {td.length>0&&goBtn("Confirm "+td.length+" Destination"+(td.length>1?"s":""))}
    </div>)}

    {wizStep===1&&(<div>
      {ab("Trip Coordinator",tm.length>0?"Selected members are invited to this specific trip. Waiting for at least 1 acceptance before continuing.":"No trip members selected yet. Select crew members below, or continue solo.")}
      <div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
          <p style={{fontSize:12,fontWeight:700,color:C.tx3}}>SELECT FROM MY CREW ({step2CrewPool.length})</p>
          <button onClick={function(){refreshCrewFromBackend();}} style={{padding:"5px 10px",borderRadius:8,border:"1px solid "+C.border,background:C.surface,color:C.tx2,fontSize:11,fontWeight:600,cursor:"pointer"}}>Reload My Crew</button>
        </div>
        {pendingCrewCount>0&&(<p style={{fontSize:11,color:C.wrn,marginBottom:8}}>{pendingCrewCount} crew member{pendingCrewCount>1?"s":""} not yet registered - they must sign up before being invited to a trip.</p>)}
        {step2CrewPool.length===0?(<p style={{fontSize:12,color:C.tx3}}>{pendingCrewCount>0?"No registered crew members yet. Waiting for pending invites to be accepted.":"No crew members available. Invite people in My Crew first."}</p>):(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {step2CrewPool.map(function(m){
              var inTrip=findTripMemberFor(m);
              var tripSt=mapTripMemberStatus(inTrip&&(inTrip.trip_status||inTrip.status));
              var crewSt=String(m.crew_status||m.status||"");
              var locked=tripSt==="accepted"||tripSt==="invited";
              var selected=!!inTrip;
              var tripBadgeLabel=selected?(tripSt==="accepted"?"accepted":(tripSt==="invited"?"invited":"selected")):"not selected";
              var tripBadgeColor=tripSt==="accepted"?C.grn:(tripSt==="invited"?C.wrn:(selected?C.tealL:C.tx3));
              var tripBadgeBg=tripSt==="accepted"?C.grnBg:(tripSt==="invited"?C.wrnBg:(selected?C.teal+"18":"rgba(255,255,255,.04)"));
              return(
                <button key={memberIdentity(m)||m.id||m.email} disabled={locked} onClick={function(){toggleStep2Member(m);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 10px",borderRadius:10,border:"1px solid "+(selected?C.teal+"45":C.border),background:selected?C.teal+"12":"transparent",cursor:locked?"default":"pointer",opacity:locked?.8:1,textAlign:"left"}}>
                  <Avi ini={m.ini||iniFromName(m.name||m.email||"M")} color={m.color||C.purp} size={30}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name||m.email||"Crew Member"}</div>
                    <div style={{fontSize:11,color:C.tx3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.email||""}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,color:C.sky,background:C.sky+"14",whiteSpace:"nowrap"}}>{"crew: "+crewStatusLabel(crewSt)}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,color:tripBadgeColor,background:tripBadgeBg,whiteSpace:"nowrap"}}>{tripBadgeLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {tm.map(function(m){var st=mapTripMemberStatus(m&&(m.trip_status||m.status));var j=st==="accepted"||tripJoined[m.id];return(<div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid "+C.border}}>
        <Avi ini={m.ini} color={m.color} size={36}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{m.name}</div><div style={{fontSize:12,color:C.tx3}}>{m.email}</div></div>
        {j?(<span style={{fontSize:11,fontWeight:600,padding:"4px 12px",borderRadius:20,color:C.grn,background:C.grnBg}}>Accepted</span>):(<div style={{display:"flex",gap:6}}><span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20,color:C.wrn,background:C.wrnBg,animation:"pulse 2s infinite"}}>{st==="invited"?"Invited":"Selected"}</span><button onClick={function(){setTJ(function(p){var n=Object.assign({},p);n[m.id]=true;return n;});}} style={{fontSize:11,padding:"4px 12px",borderRadius:20,border:"1px solid "+C.grn+"30",background:C.grnBg,color:C.grn,cursor:"pointer",fontWeight:600}}>Sim Join</button></div>)}
      </div>);})}
      {selectedCount>0&&(<button onClick={sendStep2TripInvites} style={{width:"100%",marginTop:12,padding:"10px 12px",borderRadius:10,border:"1px solid "+C.gold+"30",background:C.goldDim,color:C.goldT,fontSize:13,fontWeight:700,cursor:"pointer"}}>Send Trip Invites ({selectedCount})</button>)}
      {tripInviteMsg&&<p style={{fontSize:12,color:C.tx2,marginTop:8}}>{tripInviteMsg}</p>}
      {tm.filter(function(m){
        var em0=String(m&&m.email||"").trim().toLowerCase();
        if(!em0||!tripInviteLinks[em0])return false;
        var st0=mapTripMemberStatus(m&&(m.trip_status||m.status));
        return st0!=="accepted"&&st0!=="declined";
      }).map(function(m){
        var em=String(m.email||"").trim().toLowerCase();
        var links=tripInviteLinks[em]||{};
        var shareText="Join my trip on WanderPlan!\nAccept: "+links.accept_link+(links.reject_link?"\nDecline: "+links.reject_link:"");
        return(<div key={em} style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:C.sky+"10",border:"1px solid "+C.sky+"30"}}>
          <p style={{fontSize:12,fontWeight:600,color:C.sky,marginBottom:4}}>{m.name||em} - email not sent</p>
          <p style={{fontSize:11,color:C.tx3,marginBottom:6,wordBreak:"break-all"}}>{links.accept_link}</p>
          <div style={{display:"flex",gap:6}}>
            <button onClick={function(){
              var txt=links.accept_link;
              if(navigator&&navigator.clipboard&&typeof navigator.clipboard.writeText==="function"){navigator.clipboard.writeText(txt).catch(function(){});}
              else{var ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}
            }} style={{padding:"5px 12px",borderRadius:8,border:"none",background:C.sky,color:C.bg,fontSize:11,fontWeight:600,cursor:"pointer"}}>Copy Accept Link</button>
            <button onClick={function(){
              if(navigator&&navigator.share){navigator.share({title:"WanderPlan Trip Invite",text:shareText}).catch(function(){});}
              else if(navigator&&navigator.clipboard&&typeof navigator.clipboard.writeText==="function"){navigator.clipboard.writeText(shareText).catch(function(){});}
            }} style={{padding:"5px 12px",borderRadius:8,border:"1px solid "+C.sky+"40",background:"transparent",color:C.sky,fontSize:11,fontWeight:600,cursor:"pointer"}}>Share (WhatsApp etc.)</button>
          </div>
        </div>);
      })}
      {(invitedCount>0||jc>0)&&(<div style={{marginTop:14,padding:"12px 16px",borderRadius:12,background:C.teal+"10",border:"1px solid "+C.teal+"20"}}><p style={{fontSize:13,color:C.tealL,fontWeight:600}}>{invitedCount} invited, {jc} accepted</p><p style={{fontSize:12,color:C.tx2,marginTop:4}}>Invited members get an email with trip name and inviter. On acceptance, this trip appears in their Trips and moves to Planning.</p></div>)}
      <div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:canGo?C.grnBg:C.wrnBg}}><p style={{fontSize:12,color:canGo?C.grn:C.wrn}}>{canGo?(jc>0?("Crew ready: "+jc+" joined."):"No crew - continuing solo."):"Waiting for 1+ to join..."}</p></div>
      {canGo&&goBtn(jc>0?("Continue with "+jc+" crew member"+(jc>1?"s":"")):"Continue Solo")}
    </div>)}

    {wizStep===2&&(<div>
      {ab("Voting Agent",soloTripMode?"Solo trip detected. Voting is skipped here, so you can continue directly with your destination set.":"Each traveler votes thumbs up/down per destination. Continue unlocks only after all votes are in and at least one destination has majority.")}
      {!soloTripMode&&(<div style={{marginBottom:10,padding:"10px 14px",borderRadius:10,background:C.teal+"10",border:"1px solid "+C.teal+"20"}}>
        <p style={{fontSize:12,color:C.tealL}}>Majority needed: {majorityNeeded} of {destVoteVoters.length}</p>
      </div>)}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
        <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare organizer and crew runtime state on this step.</p>
        <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {showVoteDebug?"Hide Debug":"Show Debug"}
        </button>
      </div>
      {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
        <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Vote Debug</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
          {[
            {l:"Resolved trip id",v:syncedTripId||"(missing)"},
            {l:"Current vote actor",v:JSON.stringify(currentVoteActor)},
            {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"},
            {l:"Voter count",v:String(destVoteVoters.length)}
          ].map(function(item){
            return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
              <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
            </div>);
          })}
        </div>
        <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Voters</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:140,overflowY:"auto"}}>{JSON.stringify(destVoteVoters.map(function(v){return {id:v.id,userId:v.userId||"",email:v.email||"",name:v.name||"",aliases:voteKeyAliasesFor(v)};}),null,2)}</pre>
        </div>
        <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw dest_member_votes</p>
          <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(destMemberVotes||{},null,2)}</pre>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {td.map(function(d,idx){
            var mergedRow=readDestinationVoteRow(destMemberVotes,d);
            var summary=summarizeDestinationVotes(destMemberVotes,d,destVoteVoters,majorityNeeded);
            return(<div key={(d.id||d.name||"dest")+"-debug-"+idx} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:4}}>{d.name}</p>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>vote_key={String(d.vote_key||"")} legacy_id={String(d.id||"")}</p>
              <p style={{fontSize:10,color:C.tealL,marginBottom:4}}>summary: {summary.up} up / {summary.down} down / {summary.votedCount} voted / allVoted={String(summary.allVoted)} / majority={String(summary.majorityWin)}</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:120,overflowY:"auto"}}>{JSON.stringify({merged_row:mergedRow},null,2)}</pre>
            </div>);
          })}
        </div>
      </div>)}
      {soloTripMode?(<div>
        {td.map(function(d){
          return(<div key={d.id} style={{padding:"12px 0",borderBottom:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
              <div><span style={{fontWeight:700}}>{d.name}</span><span style={{color:C.tx3,fontSize:13,marginLeft:8}}>{d.country}</span></div>
              <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:C.grnBg,color:C.grn}}>Ready</span>
            </div>
            <p style={{fontSize:12,color:C.tx3}}>No destination voting is needed for a solo trip.</p>
          </div>);
        })}
        {td.length>0&&goBtn("Continue with "+td.length+" destination"+(td.length>1?"s":""))}
      </div>):td.map(function(d){
        var s=getDestVoteSummary(d);
        return(<div key={d.id} style={{padding:"12px 0",borderBottom:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}>
            <div><span style={{fontWeight:700}}>{d.name}</span><span style={{color:C.tx3,fontSize:13,marginLeft:8}}>{d.country}</span></div>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:s.allVoted?(s.majorityWin?C.grnBg:C.redBg):C.wrnBg,color:s.allVoted?(s.majorityWin?C.grn:C.red):C.wrn}}>
              {s.allVoted?(s.majorityWin?"In":"Out"):("Voting "+s.votedCount+"/"+destVoteVoters.length)}
            </span>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8,fontSize:12}}>
            <span style={{color:C.grn}}>{s.up} up</span>
            <span style={{color:C.red}}>{s.down} down</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {destVoteVoters.map(function(vr){
              var row=readDestinationVoteRow(destMemberVotes,d);
              var vv=readVoteForVoter(row,vr);
              var canEdit=canEditVoteForMember(vr,currentVoteActor,organizerMode);
              return(<div key={vr.id} style={{display:"flex",alignItems:"center",gap:6}}>
                <Avi ini={vr.ini} color={vr.color} size={24} name={vr.name}/>
                <button disabled={!canEdit} onClick={function(){castDestVote(d,vr,"up");}} style={{width:28,height:28,borderRadius:8,border:"1px solid "+(vv==="up"?C.grn+"55":C.grn+"35"),background:vv==="up"?C.grnBg:"transparent",color:C.grn,fontSize:13,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"\uD83D\uDC4D"}</button>
                <button disabled={!canEdit} onClick={function(){castDestVote(d,vr,"down");}} style={{width:28,height:28,borderRadius:8,border:"1px solid "+(vv==="down"?C.red+"55":C.red+"35"),background:vv==="down"?C.redBg:"transparent",color:C.red,fontSize:13,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"\uD83D\uDC4E"}</button>
              </div>);
            })}
          </div>
        </div>);
      })}
      {!soloTripMode&&allDestinationsVoted&&vd.length>0&&(<div style={{marginTop:12}}>
        <div style={{padding:"10px 14px",borderRadius:10,background:C.grnBg}}>
          <p style={{fontSize:12,color:C.grn}}>{vd.length} approved by majority: {vd.map(function(d){return d.name;}).join(", ")}</p>
        </div>
        {goBtn("Continue with "+vd.length+" destination"+(vd.length>1?"s":""))}
      </div>)}
      {!soloTripMode&&allDestinationsVoted&&vd.length===0&&(<div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:C.wrnBg}}>
        <p style={{fontSize:12,color:C.wrn}}>No destination reached majority yet. Adjust votes so at least one place wins.</p>
      </div>)}
    </div>)}

    {wizStep===3&&(<div>
      {ab("Interest Profiler","Your profile interests merged with the group. Green = strong consensus.")}
      {(function(){
        function setInterestForCurrentUser(catId,val){
          var nextUserForPersist=null;
          setUser(function(prev){
            var nextUser=updateUserInterestSelection(prev,catId,val);
            nextUserForPersist=nextUser;
            return nextUser;
          });
          if(nextUserForPersist){
            var myEmail=String(nextUserForPersist&&nextUserForPersist.email||"").trim().toLowerCase();
            var tok=authToken;
            function patchMembersInterest(members){
              return (Array.isArray(members)?members:[]).map(function(m){
                if(!isCurrentMemberRow(m,tok,myEmail))return m;
                var profile=(m&&m.profile&&typeof m.profile==="object")?Object.assign({},m.profile):{};
                profile.interests=(profile.interests&&typeof profile.interests==="object")
                  ? Object.assign({},profile.interests)
                  : {};
                profile.interests[String(catId||"")]=!!val;
                return Object.assign({},m,{profile:profile});
              });
            }
            setNT(function(prev){
              if(!prev)return prev;
              return Object.assign({},prev,{members:patchMembersInterest(prev.members)});
            });
            setTrips(function(prev){
              return (Array.isArray(prev)?prev:[]).map(function(trip){
                if(!trip||String(trip.id||"")!==String((currentTripId||tr.id||"")).trim())return trip;
                return Object.assign({},trip,{members:patchMembersInterest(trip.members)});
              });
            });
          }
          if(nextUserForPersist)persistProfileNow(nextUserForPersist,currentTripId||tr.id);
        }
        return CATS.map(function(cat,i){
          var sum=summarizeInterestConsensus(cat.id,user.interests,tm,tripJoined);
          var my=sum.myValue;
          var yesCount=sum.yesCount;
          var totalCount=sum.totalCount;
          var p=sum.pct;
          return(<div key={cat.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:i<CATS.length-1?"1px solid "+C.border:"none"}}>
            <span style={{flex:1,fontSize:13,color:C.tx2}}>{cat.q}</span>
            <div style={{display:"flex",gap:4}}>
              {[{l:"Y",v:true,c:C.grn},{l:"N",v:false,c:C.red}].map(function(o){
                var active=my===o.v;
                return(<button key={o.l} onClick={function(){
                setInterestForCurrentUser(cat.id,o.v);
              }} style={{width:28,height:28,borderRadius:6,border:active?"2px solid "+o.c:"1.5px solid "+C.border,background:active?o.c+"12":"transparent",color:active?o.c:C.tx3,fontWeight:700,fontSize:11,cursor:"pointer"}}>{o.l}</button>);
              })}
            </div>
            <div style={{width:80,height:6,background:C.border,borderRadius:999}}><div style={{height:"100%",width:p+"%",background:p>=70?C.grn:p>=40?C.wrn:C.red,borderRadius:999}}/></div>
            <span style={{fontSize:12,fontWeight:600,color:p>=70?C.grn:p>=40?C.wrn:C.red,minWidth:68,textAlign:"right"}}>{p+"% ("+yesCount+"/"+totalCount+")"}</span>
          </div>);
        });
      }())}
      {goBtn("Continue")}
    </div>)}

    {wizStep===4&&(<div>
      {ab("Health Agent","CDC/WHO scan for your destinations:")}
      {[{l:"Vaccinations",v:"No special vaccinations required",s:"low",t:"Standard up-to-date recommended"},{l:"Travel Insurance",v:"Recommended for adventure activities",s:"med",t:"Medical evacuation coverage suggested"},{l:"Fitness Level",v:"Moderate - suitable for all members",s:"low",t:"Caldera hiking requires basic fitness"}].map(function(h,i){return(<div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<2?"1px solid "+C.border:"none"}}><div style={{width:8,height:8,borderRadius:999,background:h.s==="low"?C.grn:h.s==="med"?C.wrn:C.red,marginTop:6,flexShrink:0}}/><div><p style={{fontSize:14,fontWeight:600}}>{h.l}</p><p style={{fontSize:13,color:C.tx2}}>{h.v}</p><p style={{fontSize:12,color:C.tx3}}>{h.t}</p></div></div>);})}
      {goBtn("Acknowledge & Continue")}
    </div>)}

    {wizStep===5&&(function(){
      var activePlan=routePlanContextStale?null:routePlan;
      var routeStops=Array.isArray(activePlan&&activePlan.destinations)?activePlan.destinations:[];
      var routePhases=Array.isArray(activePlan&&activePlan.phases)?activePlan.phases:[];
      var canContinue=routeStops.length>0;
      var routePlanBusy=routePlanLoad||routePlanSaveLoad;
      return(<div>
        {ab("Route Planner",activePlan&&activePlan.summary?activePlan.summary:"Let the LLM do the heavy lifting first: choose the best starting city, group your destinations efficiently, add nearby important temples or landmarks, and assign realistic time at each stop.")}
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(2,1fr)",gap:10,marginBottom:12}}>
          <div style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
            <p style={{fontSize:11,color:C.tx3,marginBottom:4}}>Destinations in scope</p>
            <p style={{fontSize:13,color:"#fff",fontWeight:600}}>{rawDests.map(function(d){return d.name;}).join(" • ")||"None yet"}</p>
          </div>
          <div style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
            <p style={{fontSize:11,color:C.tx3,marginBottom:4}}>Planning focus</p>
            <p style={{fontSize:13,color:"#fff",fontWeight:600}}>{Object.keys(user.interests||{}).filter(function(k){return user.interests[k]===true;}).join(", ")||"culture, spiritual history, local experiences"}</p>
          </div>
        </div>
        {routePlanContextStale&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.wrnBg,border:"1px solid "+C.wrn+"20"}}>
          <p style={{fontSize:13,color:C.wrn,fontWeight:600,marginBottom:4}}>Trip context changed</p>
          <p style={{fontSize:12,color:C.tx2}}>Destinations, budget, or traveler preferences changed. Rebuild the route plan so the downstream itinerary reflects the current trip.</p>
        </div>)}
        {routePlanErr&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.redBg,border:"1px solid "+C.red+"20"}}>
          <p style={{fontSize:13,color:C.red}}>{routePlanErr}</p>
        </div>)}
        {routePlanBusy&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
          <p style={{fontSize:13,color:C.tx2}}>{routePlanLoad?("Building the route plan across "+rawDests.length+" destination"+(rawDests.length===1?"":"s")+"..."):"Saving the route plan before continuing..."}</p>
        </div>)}
        {activePlan&&(<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(4,1fr)",gap:8}}>
            {[
              {l:"Starting city",v:activePlan.startingCity||"Best TBD"},
              {l:"Ending city",v:activePlan.endingCity||activePlan.startingCity||"Best TBD"},
              {l:"Trip days",v:String(activePlan.totalDays||routeStops.reduce(function(sum,stop){return sum+(Number(stop.days||1)||1);},0)||rawDests.length)},
              {l:"Stops",v:String(routeStops.length||rawDests.length)}
            ].map(function(item){
              return(<div key={item.l} style={{padding:"10px 12px",borderRadius:10,background:C.bg,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                <p style={{fontSize:13,color:"#fff",fontWeight:700}}>{item.v}</p>
              </div>);
            })}
          </div>
          {routePhases.length>0&&(<div style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
            <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Route phases</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {routePhases.map(function(phase,idx){
                return(<div key={phase.title+"-"+idx} style={{padding:"10px 12px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:4}}>
                    <p style={{fontSize:13,fontWeight:700,color:"#fff"}}>{phase.title}</p>
                    <p style={{fontSize:12,color:C.goldT,fontWeight:700}}>{phase.days} day{phase.days===1?"":"s"}</p>
                  </div>
                  <p style={{fontSize:12,color:C.tx2,marginBottom:4}}>{phase.route.join(" → ")}</p>
                  {phase.notes&&<p style={{fontSize:11,color:C.tx3}}>{phase.notes}</p>}
                </div>);
              })}
            </div>
          </div>)}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {routeStops.map(function(stop,idx){
              return(<div key={(stop.destination||"stop")+"-"+idx} style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6,alignItems:"center"}}>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:"#fff"}}>{idx+1}. {stop.destination}</p>
                    {stop.country&&<p style={{fontSize:11,color:C.tx3}}>{stop.country}</p>}
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,background:C.teal+"15",color:C.tealL}}>{stop.days} day{stop.days===1?"":"s"}</span>
                </div>
                {stop.reason&&<p style={{fontSize:12,color:C.tx2,marginBottom:6}}>{stop.reason}</p>}
                {(stop.bestTime||stop.travelNote)&&(
                  <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(2,1fr)",gap:8,marginBottom:6}}>
                    {stop.bestTime&&<div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}><p style={{fontSize:10,color:C.tx3,marginBottom:3}}>Best time</p><p style={{fontSize:11,color:C.tx2}}>{stop.bestTime}</p></div>}
                    {stop.travelNote&&<div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}><p style={{fontSize:10,color:C.tx3,marginBottom:3}}>Travel note</p><p style={{fontSize:11,color:C.tx2}}>{stop.travelNote}</p></div>}
                  </div>
                )}
                {Array.isArray(stop.nearbySites)&&stop.nearbySites.length>0&&(<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {stop.nearbySites.map(function(site){return <span key={site} style={{fontSize:11,padding:"4px 8px",borderRadius:999,background:C.goldDim,color:C.goldT,border:"1px solid "+C.goldT+"20"}}>{site}</span>;})}
                </div>)}
              </div>);
            })}
          </div>
          {(activePlan.seasonNotes&&activePlan.seasonNotes.length>0||activePlan.bookingNotes&&activePlan.bookingNotes.length>0||activePlan.packingNotes&&activePlan.packingNotes.length>0)&&(
            <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(3,1fr)",gap:8}}>
              {[["Season notes",activePlan.seasonNotes],["Booking notes",activePlan.bookingNotes],["Packing notes",activePlan.packingNotes]].map(function(entry){
                var label=entry[0],items=entry[1];
                if(!Array.isArray(items)||items.length===0)return null;
                return(<div key={label} style={{padding:"10px 12px",borderRadius:10,background:C.bg,border:"1px solid "+C.border}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.goldT,marginBottom:6}}>{label}</p>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {items.map(function(item,idx){return <p key={label+"-"+idx} style={{fontSize:11,color:C.tx2}}>{item}</p>;})}
                  </div>
                </div>);
              })}
            </div>
          )}
        </div>)}
        <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
          <button onClick={function(){buildRoutePlanThenContinue(false);}} disabled={routePlanBusy||rawDests.length===0} style={{flex:1,padding:"12px",borderRadius:12,border:"1px solid "+C.teal+"35",background:(routePlanBusy||rawDests.length===0)?C.border:C.teal+"12",color:(routePlanBusy||rawDests.length===0)?C.tx3:C.tealL,fontSize:14,fontWeight:700,cursor:(routePlanBusy||rawDests.length===0)?"default":"pointer",minHeight:46}}>
            {routePlanLoad?"Planning route...":(routePlanSaveLoad?"Saving route plan...":(activePlan?"Refresh Route Plan":"Build Route Plan"))}
          </button>
          {canContinue&&<button onClick={function(){persistRoutePlanState(activePlan).then(function(){adv();}).catch(function(){});}} disabled={routePlanBusy} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:routePlanBusy?C.border:C.teal,color:routePlanBusy?C.tx3:"#fff",fontSize:14,fontWeight:700,cursor:routePlanBusy?"default":"pointer",minHeight:46}}>{routePlanSaveLoad?"Saving route plan...":"Use Route Plan & Continue"}</button>}
          {!canContinue&&!routePlanBusy&&<button onClick={function(){buildRoutePlanThenContinue(true);}} disabled={rawDests.length===0} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:rawDests.length===0?C.border:C.gold,color:rawDests.length===0?C.tx3:C.bg,fontSize:14,fontWeight:700,cursor:rawDests.length===0?"default":"pointer",minHeight:46}}>Build Route Plan & Continue</button>}
        </div>
      </div>);
    }())}

    {wizStep===6&&(function(){
      var poiRows=mergePoiListsByCanonical(pois,poiOptionPool);
      function hasAnyCrewYesForIdx(idx){
        var rowMeta=readPoiSelectionRow(poiMemberChoices,poiRows[idx],idx);
        return hasAnyYesInPoiSelectionRow(rowMeta.row)||poiStatus[idx]==="yes";
      }
      function setPoiDecisionForCurrentUser(idx,decision){
        if(!(decision==="yes"||decision==="no"))return;
        setPS(function(prev){
          var next=Object.assign({},prev||{});
          next[idx]=decision;
          return next;
        });
        if(!currentPlannerId)return;
        setPMC(function(prev){
          var next=normalizePoiStateMap(prev,poiRows,poiOptionPool);
          var rowMeta=readPoiSelectionRow(next,poiRows[idx],idx);
          var row=Object.assign({},rowMeta.row||{});
          row[currentPlannerId]=decision;
          next[rowMeta.key]=row;
          saveTripPlanningState({state:{poi_member_choices:next}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          return next;
        });
      }
      var accepted=poiRows.filter(function(p,i){return poiStatus[i]==="yes";});
      var rejected=poiRows.filter(function(p,i){return poiStatus[i]==="no";});
      var pending=poiRows.filter(function(p,i){return !poiStatus[i];});
      var combinedAccepted=poiRows.filter(function(_,i){return hasAnyCrewYesForIdx(i);});
      var allDecided=poiDone&&poiRows.length>0&&pending.length===0&&!poiContextStale;
      function revisePOISelection(){
        setPS({});
        if(authToken&&wizSessionId){
          apiJson("/wizard/sessions/"+wizSessionId+"/actions",{method:"POST",body:{action_type:"revise_step",payload:{step:wizStep,scope:"poi.selection"}}},authToken).catch(function(){});
        }
      }
      function approvePOISelection(){
        var voteMembers=[{
          id:currentPlannerId,
          userId:userIdFromToken(authToken),
          email:user.email||"",
          name:user.name||user.email||"You",
          ini:iniFromName(user.name||user.email||"You"),
          color:C.gold
        }];
        (tm||[]).forEach(function(m){
          voteMembers.push({
            id:makeVoteUserId(m.id,m.email,("crew-"+voteMembers.length)),
            userId:m.id||"",
            email:m.email||"",
            name:m.name||m.email||"Crew",
            ini:m.ini||iniFromName(m.name||m.email||"Crew"),
            color:m.color||CREW_COLORS[voteMembers.length%CREW_COLORS.length]
          });
        });
        var acceptedIdx=[];
        poiRows.forEach(function(_,i){
          if(hasAnyCrewYesForIdx(i))acceptedIdx.push(i);
        });
        setPV(function(prev){
          var next=normalizePoiStateMap(prev,poiRows,poiOptionPool);
          acceptedIdx.forEach(function(idx){
            var rowMeta=readPoiVoteRow(next,poiRows[idx],idx);
            var voteKey=rowMeta.key;
            var row=Object.assign({},rowMeta.row||{});
            voteMembers.forEach(function(vm){
              var aliases=voteKeyAliasesFor(vm);
              var hasExisting=aliases.some(function(k){return row[k]!==undefined;});
              if(hasExisting)return;
              var seedVal=isCurrentVoteVoter(vm,currentVoteActor)?"up":"";
              aliases.forEach(function(k){row[k]=seedVal;});
            });
            next[voteKey]=row;
          });
          saveTripPlanningState({state:{poi_votes:next}});
          return next;
        });
        if(authToken&&wizSessionId){
          apiJson("/wizard/sessions/"+wizSessionId+"/actions",{method:"POST",body:{action_type:"approve_step",payload:{step:wizStep,scope:"poi.selection",accepted_count:accepted.length,rejected_count:rejected.length}}},authToken).catch(function(){});
        }
        var syncStatus=Object.assign({},poiStatus||{});
        acceptedIdx.forEach(function(i){syncStatus[i]="yes";});
        persistPlanningStateStrict({state:{poi_status:syncStatus,poi_votes:normalizePoiStateMap(poiVotes,poiRows,poiOptionPool),poi_member_choices:normalizePoiStateMap(poiMemberChoices,poiRows,poiOptionPool)}}).then(function(){
          syncTripPoisToBackend(syncStatus,poiRows).then(function(){
            adv();
          }).catch(function(){
            setCSM("Could not sync activity decisions to the trip. Please retry.");
          });
        }).catch(function(){
          setCSM("Could not persist activity decisions. Please retry.");
        });
      }
      var poiGroupPrefs=wizardPoiGroupPrefs;
      var poiCurrentSignature=poiCurrentSignatureGlobal;
      var poiContextStale=poiContextStaleGlobal;
      var profCount=poiGroupPrefs.memberSummaries.length;
      var poiDebugDuplicates=findDuplicatePoiKeys(poiRows);
      var poiVoteMembers=[{
        id:currentPlannerId,
        userId:userIdFromToken(authToken),
        email:user.email||"",
        name:user.name||user.email||"You",
        ini:iniFromName(user.name||user.email||"You"),
        color:C.gold
      }];
      (tm||[]).forEach(function(m){
        poiVoteMembers.push({
          id:makeVoteUserId(m.id,m.email,("crew-"+poiVoteMembers.length)),
          userId:m.id||"",
          email:m.email||"",
          name:m.name||m.email||"Crew",
          ini:m.ini||iniFromName(m.name||m.email||"Crew"),
          color:m.color||CREW_COLORS[poiVoteMembers.length%CREW_COLORS.length]
        });
      });

      function runPoiSearch(){
        runPoiSearchNow();
      }

      function addPOI(){
        if(!poiAsk.trim()||poiAskLoad)return;var msg=poiAsk.trim();setPA("");setPAL(true);
        var destStr=dests.map(function(d){return d.name;}).join(", ")||"your destinations";
        var sys=`You are WanderPlan POI Agent. Add a specific destination activity. Return ONLY JSON:
{"name":"Activity","destination":"City","category":"Nature","duration":"2h","cost":0,"rating":4.5,"matchReason":"Why it fits","tags":["Tag1"],"locationHint":"Neighborhood or landmark area","bestTime":"morning|afternoon|evening|flexible","openingWindow":"08:00-17:00"}
Destinations: ${destStr}. Use a real, recognizable activity when possible. ONLY JSON.`;
        callLLM(sys,msg,500).then(function(res){
          setPAL(false);if(res&&res.name){setPois(function(prev){return prev.concat([res]);});}
        }).catch(function(){setPAL(false);});
      }

      return(<div>
        {ab("POI Discovery Agent",poiContextStale?"Trip destinations or traveler profiles changed. Refresh activities to match the updated trip.":(poiDone?(allDecided?accepted.length+" activities selected. Add more or continue.":"Accept or reject each activity:"):("Find activities matched to your group"+(profCount>0?(" ("+profCount+" crew profile"+(profCount>1?"s":"")+" included)"):".") )))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare organizer and crew POI shortlist state on this step.</p>
          <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {showVoteDebug?"Hide Debug":"Show Debug"}
          </button>
        </div>
        {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
          <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>POI Debug</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
            {[
              {l:"Resolved trip id",v:syncedTripId||"(missing)"},
              {l:"Current planner id",v:currentPlannerId||"(missing)"},
              {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"},
              {l:"POI count",v:String((poiRows||[]).length)},
              {l:"Shared pool count",v:String(Object.keys(poiOptionPool||{}).length)},
              {l:"Selection row count",v:String(Object.keys(poiMemberChoices||{}).length)},
              {l:"Vote row count",v:String(Object.keys(poiVotes||{}).length)},
              {l:"Duplicate canonical keys",v:String(poiDebugDuplicates.length)},
              {l:"POI phase",v:String(poiGenStatus&&poiGenStatus.phase||"idle")},
              {l:"Backend sync",v:String(poiGenStatus&&poiGenStatus.backendSync||"idle")},
              {l:"Saved request signature",v:poiRequestSignature||"(none)"},
              {l:"Current request signature",v:poiCurrentSignature||"(none)"},
              {l:"Context stale",v:poiContextStale?"yes":"no"}
            ].map(function(item){
              return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
              </div>);
            })}
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Voters</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:140,overflowY:"auto"}}>{JSON.stringify(poiVoteMembers.map(function(v){return {id:v.id,userId:v.userId||"",email:v.email||"",name:v.name||"",aliases:voteKeyAliasesFor(v)};}),null,2)}</pre>
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Duplicate canonical keys</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:120,overflowY:"auto"}}>{JSON.stringify(poiDebugDuplicates,null,2)}</pre>
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw poi_option_pool</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:160,overflowY:"auto"}}>{JSON.stringify(poiOptionPool||{},null,2)}</pre>
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw poi_member_choices</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:160,overflowY:"auto"}}>{JSON.stringify(poiMemberChoices||{},null,2)}</pre>
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw poi_votes</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:160,overflowY:"auto"}}>{JSON.stringify(poiVotes||{},null,2)}</pre>
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>POI generation status</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:160,overflowY:"auto"}}>{JSON.stringify(poiGenStatus||{},null,2)}</pre>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {poiRows.map(function(p,idx){
              var selectionMeta=readPoiSelectionRow(poiMemberChoices,p,idx);
              var voteSummary=summarizePoiVotes(poiVotes,p,idx,poiVoteMembers);
              var yesCount=Object.keys(selectionMeta.row||{}).filter(function(k){return String(selectionMeta.row[k]||"").trim().toLowerCase()==="yes";}).length;
              return(<div key={voteSummary.key+"-debug-"+idx} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:4}}>{p.name||("POI "+(idx+1))}</p>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>canonical_key={voteSummary.key} idx={idx} destination={String(p.destination||"")}</p>
                <p style={{fontSize:10,color:C.tealL,marginBottom:4}}>shortlist_yes={yesCount} vote_summary={voteSummary.up} up / {voteSummary.down} down / {voteSummary.votedCount} voted</p>
                <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:120,overflowY:"auto"}}>{JSON.stringify({selection_key:selectionMeta.key,selection_row:selectionMeta.row,vote_row:voteSummary.row},null,2)}</pre>
              </div>);
            })}
          </div>
        </div>)}
        {(!poiDone||poiContextStale)&&!poiLoad&&(<div><p style={{fontSize:14,color:C.tx2,marginBottom:12}}>{poiContextStale?"Destinations, budget, or traveler profiles changed. Refresh the activity list so it matches the current trip.":("The agent searches "+dests.length+" destination"+(dests.length>1?"s":"")+" based on group interests and budget.")}</p><button onClick={runPoiSearch} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>{poiContextStale?"Refresh Activities for Updated Trip":"Find Activities"}</button></div>)}
        {poiLoad&&(<div style={{textAlign:"center",padding:"30px 0"}}><div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12}}><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div><p style={{fontSize:14,color:C.tx2,marginBottom:8}}>{poiGenStatus.phase==="syncing"?"Saving generated POIs to the trip...":("Searching across "+dests.map(function(d){return d.name;}).join(", ")+"...")}</p>{poiGenStatus.currentBatch>0&&<p style={{fontSize:12,color:C.tx3,marginBottom:6}}>Destination {poiGenStatus.currentBatch} of {poiGenStatus.batchCount||1}{Array.isArray(poiGenStatus.activeDestinations)&&poiGenStatus.activeDestinations.length?": "+poiGenStatus.activeDestinations.join(", "):""}</p>}{Array.isArray(poiGenStatus.completedDestinations)&&poiGenStatus.completedDestinations.length>0&&<p style={{fontSize:12,color:C.grn,marginBottom:6}}>Completed: {poiGenStatus.completedDestinations.join(", ")}</p>}{Array.isArray(poiGenStatus.timedOutDestinations)&&poiGenStatus.timedOutDestinations.length>0&&<p style={{fontSize:12,color:C.wrn,marginBottom:6}}>Anthropic timed out for: {poiGenStatus.timedOutDestinations.join(", ")}</p>}{Array.isArray(poiGenStatus.failedDestinations)&&poiGenStatus.failedDestinations.length>0&&<p style={{fontSize:12,color:C.red,marginBottom:6}}>Provider errors for: {poiGenStatus.failedDestinations.join(", ")}</p>}{Array.isArray(poiGenStatus.parseFailedDestinations)&&poiGenStatus.parseFailedDestinations.length>0&&<p style={{fontSize:12,color:C.tx3,marginBottom:6}}>Responses could not be parsed for: {poiGenStatus.parseFailedDestinations.join(", ")}</p>}{Array.isArray(poiGenStatus.emptyDestinations)&&poiGenStatus.emptyDestinations.length>0&&<p style={{fontSize:12,color:C.tx3,marginBottom:6}}>No usable POIs yet for: {poiGenStatus.emptyDestinations.join(", ")}</p>}{Array.isArray(poiGenStatus.fallbackDestinations)&&poiGenStatus.fallbackDestinations.length>0&&<p style={{fontSize:12,color:C.sky,marginBottom:6}}>Fallback POIs used for: {poiGenStatus.fallbackDestinations.join(", ")}</p>}{poiGenStatus.destinationErrors&&Object.keys(poiGenStatus.destinationErrors).length>0&&<div style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:C.surface,border:"1px solid "+C.border,textAlign:"left"}}><p style={{fontSize:11,color:C.tx3,marginBottom:6}}>Provider details</p>{Object.keys(poiGenStatus.destinationErrors).map(function(dest){return <p key={dest} style={{fontSize:11,color:C.tx2,marginBottom:4}}><span style={{color:"#fff"}}>{dest}:</span> {poiGenStatus.destinationErrors[dest]}</p>;})}</div>}</div>)}
        {poiDone&&poiRows.length>0&&!poiContextStale&&(<div>
          {poiRows.map(function(p,i){var st=poiStatus[i];var cc=p.category==="Nature"?C.grn:p.category==="Food"?C.teal:p.category==="Culture"?C.wrn:p.category==="Adventure"?C.coral:p.category==="Wellness"?C.purp:C.tealL;
            return(<div key={i} style={{padding:"12px 0",borderBottom:i<poiRows.length-1?"1px solid "+C.border:"none",opacity:st==="no"?.72:1,transition:"opacity .2s"}}>
              <div style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}><span style={{fontSize:10,padding:"1px 8px",borderRadius:999,background:cc+"18",color:cc,fontWeight:600}}>{p.category}</span><span style={{fontSize:11,color:C.wrn}}>{"*"+(p.rating||4.5)}</span><span style={{fontSize:11,color:C.tx3,marginLeft:"auto"}}>{p.destination}</span></div>
              <p style={{fontSize:14,fontWeight:600,marginBottom:2,textDecoration:st==="no"?"line-through":"none"}}>{p.name}</p>
              <div style={{display:"flex",gap:12,fontSize:12,color:C.tx3,marginBottom:4,flexWrap:"wrap"}}><span>{p.duration}</span><span>{p.cost>0?"$"+p.cost:"Free"}</span>{p.locationHint&&<span>{p.locationHint}</span>}{p.bestTime&&<span>Best {p.bestTime}</span>}{p.openingWindow&&<span>{p.openingWindow}</span>}</div>
              <p style={{fontSize:11,color:C.tx3,marginBottom:6}}>{Object.keys((readPoiSelectionRow(poiMemberChoices,p,i).row)||{}).filter(function(k){return String(readPoiSelectionRow(poiMemberChoices,p,i).row[k]||"").trim().toLowerCase()==="yes";}).length} crew accept{Object.keys((readPoiSelectionRow(poiMemberChoices,p,i).row)||{}).filter(function(k){return String(readPoiSelectionRow(poiMemberChoices,p,i).row[k]||"").trim().toLowerCase()==="yes";}).length===1?"":"s"}</p>
              {p.matchReason&&<p style={{fontSize:12,color:C.tealL,fontStyle:"italic",marginBottom:6}}>{p.matchReason}</p>}
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={function(){setPoiDecisionForCurrentUser(i,"yes");}} style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid "+C.grn+"30",background:st==="yes"?C.grnBg:"transparent",color:C.grn,fontWeight:600,fontSize:13,cursor:"pointer",minWidth:120}}>Accept</button>
                <button onClick={function(){setPoiDecisionForCurrentUser(i,"no");}} style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid "+C.red+"30",background:st==="no"?C.redBg:"transparent",color:C.red,fontWeight:600,fontSize:13,cursor:"pointer",minWidth:120}}>Reject</button>
                {st==="yes"&&<span style={{fontSize:12,fontWeight:600,color:C.grn}}>Accepted</span>}
                {st==="no"&&<span style={{fontSize:12,fontWeight:600,color:C.red}}>Rejected</span>}
              </div>
            </div>);
          })}
          <div style={{marginTop:14,padding:"12px 14px",borderRadius:10,background:C.teal+"08",border:"1px solid "+C.teal+"15"}}><p style={{fontSize:12,color:C.tealL}}>Missing something? Ask the agent to add a specific activity:</p></div>
          <div style={{display:"flex",gap:8,marginTop:8}}><input value={poiAsk} onChange={function(e){setPA(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")addPOI();}} placeholder="e.g. 'a sunset sailing tour' or 'cooking class'" disabled={poiAskLoad} style={{flex:1,padding:"11px 14px",borderRadius:10,background:C.bg,border:"1.5px solid "+C.border,fontSize:14,color:"#fff",opacity:poiAskLoad?.5:1}}/><button onClick={addPOI} disabled={poiAskLoad} style={{padding:"10px 16px",borderRadius:10,border:"none",background:poiAskLoad?C.border:C.teal,color:poiAskLoad?C.tx3:"#fff",fontSize:13,fontWeight:600,cursor:poiAskLoad?"default":"pointer"}}>Add</button></div>
          {poiAskLoad&&<div style={{display:"flex",gap:4,marginTop:8}}><div style={{width:6,height:6,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:6,height:6,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:6,height:6,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div>}
          {allDecided&&(<div style={{marginTop:14}}>
            <div style={{padding:"10px 14px",borderRadius:10,background:C.grnBg}}>
              <p style={{fontSize:12,color:C.grn}}>{combinedAccepted.length} crew-selected activities across {dests.length} destination{dests.length>1?"s":""}. Total est. cost: ${combinedAccepted.reduce(function(s,p){return s+(p.cost||0);},0)}</p>
            </div>
            <div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:C.teal+"08",border:"1px solid "+C.teal+"18"}}>
              <p style={{fontSize:12,color:C.tealL,fontWeight:600,marginBottom:4}}>Consolidated crew shortlist</p>
              <p style={{fontSize:12,color:C.tx2}}>{combinedAccepted.length>0?combinedAccepted.map(function(p){return p.name;}).join(", "):"No accepted activities yet."}</p>
            </div>
            <div style={{display:"flex",gap:10,marginTop:12}}>
              <button onClick={revisePOISelection} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid "+C.red,background:"transparent",color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Revise</button>
              <button onClick={approvePOISelection} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:C.teal,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Approve</button>
            </div>
          </div>)}
        </div>)}
        {poiDone&&poiRows.length===0&&(<div><p style={{fontSize:14,color:C.tx3,padding:"20px 0"}}>No activities found. Try asking for something specific below.</p><div style={{display:"flex",gap:8}}><input value={poiAsk} onChange={function(e){setPA(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")addPOI();}} placeholder="e.g. 'hiking in Kyoto'" style={{flex:1,padding:"11px 14px",borderRadius:10,background:C.bg,border:"1.5px solid "+C.border,fontSize:14,color:"#fff"}}/><button onClick={addPOI} style={{padding:"10px 16px",borderRadius:10,border:"none",background:C.teal,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Add</button></div></div>)}
      </div>);
    }())}

    {wizStep===7&&(function(){
      var poiRows=mergePoiListsByCanonical(pois,poiOptionPool);
      var voteMembers=[{
        id:currentPlannerId,
        userId:userIdFromToken(authToken),
        email:user.email||"",
        name:user.name||user.email||"You",
        ini:iniFromName(user.name||user.email||"You"),
        color:C.gold
      }];
      (tm||[]).forEach(function(m){
        voteMembers.push({
          id:makeVoteUserId(m.id,m.email,("crew-"+voteMembers.length)),
          userId:m.id||"",
          email:m.email||"",
          name:m.name||m.email||"Crew",
          ini:m.ini||iniFromName(m.name||m.email||"Crew"),
          color:m.color||CREW_COLORS[voteMembers.length%CREW_COLORS.length]
        });
      });
      var candidates=poiRows.map(function(p,i){
        var selectionMeta=readPoiSelectionRow(poiMemberChoices,p,i);
        return {idx:i,poi:p,selectionRow:selectionMeta.row};
      });
      var ranked=candidates.map(function(it){
        var voteSummary=summarizePoiVotes(poiVotes,it.poi,it.idx,voteMembers);
        var yesCount=Object.keys(it.selectionRow||{}).filter(function(k){
          return String(it.selectionRow[k]||"").trim().toLowerCase()==="yes";
        }).length;
        var noCount=Object.keys(it.selectionRow||{}).filter(function(k){
          return String(it.selectionRow[k]||"").trim().toLowerCase()==="no";
        }).length;
        return Object.assign({},it,{vote_key:voteSummary.key,up:voteSummary.up,down:voteSummary.down,score:voteSummary.up-voteSummary.down,yesCount:yesCount,noCount:noCount});
      }).sort(function(a,b){
        if(b.up!==a.up)return b.up-a.up;
        if(b.yesCount!==a.yesCount)return b.yesCount-a.yesCount;
        if(a.down!==b.down)return a.down-b.down;
        return String(a.poi.name||"").localeCompare(String(b.poi.name||""));
      });
      function castPoiVote(voteKey,idx,member,vote){
        if(!member||!canEditVoteForMember(member,currentVoteActor,organizerMode))return;
        var aliases=voteKeyAliasesFor(member);
        if(aliases.length===0)return;
        setPV(function(prev){
          var next=normalizePoiStateMap(prev,poiRows,poiOptionPool);
          var rowMeta=readPoiVoteRow(next,poiRows[idx],idx);
          var row=Object.assign({},rowMeta.row||{});
          aliases.forEach(function(k){row[k]=vote;});
          next[rowMeta.key]=row;
          saveTripPlanningState({state:{poi_votes:next}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          return next;
        });
      }
      function applyPoiVotingAndContinue(){
        var nextStatus=Object.assign({},poiStatus||{});
        ranked.forEach(function(r){
          nextStatus[r.idx]=resolvePoiVotingDecision(nextStatus[r.idx],{up:r.up,down:r.down},r.selectionRow);
        });
        setPS(nextStatus);
        logWizAction("record_selection",{key:"pois.voting",value:ranked.map(function(r){return {name:r.poi.name,up:r.up,down:r.down,approved:r.up>=r.down};})});
        persistPlanningStateStrict({state:{poi_status:nextStatus,poi_votes:normalizePoiStateMap(poiVotes,poiRows,poiOptionPool),poi_member_choices:normalizePoiStateMap(poiMemberChoices,poiRows,poiOptionPool)}}).then(function(){
          syncTripPoisToBackend(nextStatus,poiRows).then(function(){
            adv();
          }).catch(function(){
            setCSM("Could not sync POI votes to the trip. Please retry.");
          });
        }).catch(function(){
          setCSM("Could not persist POI votes. Please retry.");
        });
      }
      if(soloTripMode){
        return(<div>
          {ab("POI Voting Agent","Solo trip detected. Crew voting is skipped here, so your approved POIs move straight into the itinerary.")} 
          {ranked.length===0&&<p style={{fontSize:13,color:C.tx2,padding:"8px 0"}}>No POIs available yet. Go back to Activities and approve some first.</p>}
          {ranked.map(function(r){
            return(<div key={r.idx} style={{padding:"12px 0",borderBottom:"1px solid "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <p style={{fontSize:18,fontWeight:700,lineHeight:1.2}}>{r.poi.name}</p>
                <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:C.grnBg,color:C.grn,fontWeight:700}}>Selected</span>
              </div>
              <p style={{fontSize:13,color:C.tx2,marginBottom:6}}>{r.poi.destination||"Destination"} | {r.poi.duration||"2h"} | {r.poi.cost>0?"$"+r.poi.cost:"Free"}</p>
              {r.poi.matchReason&&<p style={{fontSize:12,color:C.tealL,fontStyle:"italic"}}>{r.poi.matchReason}</p>}
            </div>);
          })}
          {ranked.length>0&&(<div style={{marginTop:14,padding:"10px 14px",borderRadius:10,background:C.grnBg}}>
            <p style={{fontSize:12,color:C.grn}}>{ranked.length} approved activit{ranked.length===1?"y":"ies"} ready for the itinerary.</p>
          </div>)}
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <button onClick={revise} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid "+C.red,background:"transparent",color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Revise</button>
            <button onClick={applyPoiVotingAndContinue} disabled={ranked.length===0} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:ranked.length===0?C.border:C.teal,color:ranked.length===0?C.tx3:"#fff",fontSize:14,fontWeight:600,cursor:ranked.length===0?"default":"pointer",minHeight:46}}>Continue</button>
          </div>
        </div>);
      }
      return(<div>
        {ab("POI Voting Agent","Crew votes are tabulated here. Every generated POI is shown so any of them can make the final itinerary. Ranked from most voted to least voted.")}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare organizer and crew POI vote state on this step.</p>
          <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {showVoteDebug?"Hide Debug":"Show Debug"}
          </button>
        </div>
        {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
          <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>POI Vote Debug</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
            {[
              {l:"Resolved trip id",v:syncedTripId||"(missing)"},
              {l:"Current vote actor",v:JSON.stringify(currentVoteActor)},
              {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"},
              {l:"Candidate count",v:String(candidates.length)},
              {l:"Ranked count",v:String(ranked.length)},
              {l:"Vote row count",v:String(Object.keys(poiVotes||{}).length)},
              {l:"Selection row count",v:String(Object.keys(poiMemberChoices||{}).length)},
              {l:"Duplicate canonical keys",v:String(findDuplicatePoiKeys(poiRows).length)}
            ].map(function(item){
              return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
              </div>);
            })}
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Voters</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:140,overflowY:"auto"}}>{JSON.stringify(voteMembers.map(function(v){return {id:v.id,userId:v.userId||"",email:v.email||"",name:v.name||"",aliases:voteKeyAliasesFor(v)};}),null,2)}</pre>
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw poi_votes</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:160,overflowY:"auto"}}>{JSON.stringify(poiVotes||{},null,2)}</pre>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {ranked.map(function(r){
              var selectionMeta=readPoiSelectionRow(poiMemberChoices,r.poi,r.idx);
              var voteSummary=summarizePoiVotes(poiVotes,r.poi,r.idx,voteMembers);
              return(<div key={r.vote_key+"-vote-debug"} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:4}}>{r.poi.name||("POI "+(r.idx+1))}</p>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>canonical_key={r.vote_key} idx={r.idx} destination={String(r.poi.destination||"")}</p>
                <p style={{fontSize:10,color:C.tealL,marginBottom:4}}>summary: {voteSummary.up} up / {voteSummary.down} down / {voteSummary.votedCount} voted / score={r.score}</p>
                <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:120,overflowY:"auto"}}>{JSON.stringify({selection_key:selectionMeta.key,selection_row:selectionMeta.row,vote_row:voteSummary.row},null,2)}</pre>
              </div>);
            })}
          </div>
        </div>)}
        {ranked.length===0&&<p style={{fontSize:13,color:C.tx2,padding:"8px 0"}}>No POIs available to vote yet. Go back to Activities and approve some first.</p>}
        {ranked.map(function(r){
          return(<div key={r.idx} style={{padding:"12px 0",borderBottom:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <p style={{fontSize:20,fontWeight:700,lineHeight:1.2}}>{r.poi.name}</p>
              <span style={{fontSize:11,padding:"3px 10px",borderRadius:999,background:C.grnBg,color:C.grn,fontWeight:700}}>{r.up} up</span>
            </div>
            <p style={{fontSize:13,color:C.tx2,marginBottom:10}}>{r.poi.destination||"Destination"} - Mentioned by {r.up}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {voteMembers.map(function(vm){
                var rowMeta=readPoiVoteRow(poiVotes,r.poi,r.idx);
                var row=rowMeta.row;
                var v=readVoteForVoter(row,vm);
                var canEdit=canEditVoteForMember(vm,currentVoteActor,organizerMode);
                return(<div key={vm.id} style={{display:"flex",alignItems:"center",gap:6}}>
                  <Avi ini={vm.ini} color={vm.color} size={24} name={vm.name}/>
                  <button disabled={!canEdit} onClick={function(){castPoiVote(r.vote_key,r.idx,vm,"up");}} style={{width:28,height:28,borderRadius:8,border:"1px solid "+(v==="up"?C.grn+"55":C.grn+"40"),background:v==="up"?C.grnBg:"transparent",color:C.grn,fontSize:13,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"\uD83D\uDC4D"}</button>
                  <button disabled={!canEdit} onClick={function(){castPoiVote(r.vote_key,r.idx,vm,"down");}} style={{width:28,height:28,borderRadius:8,border:"1px solid "+(v==="down"?C.red+"55":C.red+"40"),background:v==="down"?C.redBg:"transparent",color:C.red,fontSize:13,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"\uD83D\uDC4E"}</button>
                </div>);
              })}
            </div>
          </div>);
        })}
        {ranked.length>0&&(<div style={{marginTop:14,padding:"10px 14px",borderRadius:10,background:C.teal+"08",border:"1px solid "+C.teal+"18"}}>
          <p style={{fontSize:12,color:C.tealL,fontWeight:700,marginBottom:4}}>Ranked POIs</p>
          <p style={{fontSize:12,color:C.tx2}}>{ranked.map(function(r){return r.poi.name+" ("+r.up+")";}).join(" | ")}</p>
        </div>)}
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button onClick={revise} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid "+C.red,background:"transparent",color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Revise</button>
          <button onClick={applyPoiVotingAndContinue} disabled={ranked.length===0} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:ranked.length===0?C.border:C.teal,color:ranked.length===0?C.tx3:"#fff",fontSize:14,fontWeight:600,cursor:ranked.length===0?"default":"pointer",minHeight:46}}>Approve</button>
        </div>
      </div>);
    }())}

    {wizStep===8&&(<div>
      {(function(){
        var joinedMembers=tm.filter(function(m){
          var st=mapTripMemberStatus(m&&(m.trip_status||m.status));
          return st==="accepted"||tripJoined[m.id];
        });
        var budgetProfiles=[{
          key:"self",
          label:user.name||"You",
          ini:iniFromName(user.name||user.email||"You"),
          color:C.gold,
          tier:String(user.budget||"moderate").trim().toLowerCase()||"moderate",
          mine:true
        }].concat(joinedMembers.map(function(m){
          var tier=resolveBudgetTier(m,user.budget||"moderate");
          return {
            key:m.id,
            label:m.name||m.email||"Traveler",
            ini:m.ini||iniFromName(m.name||m.email||"Traveler"),
            color:m.color||C.sky,
            tier:tier,
            mine:false
          };
        }));
        var chosenTier=String(sharedBudgetTier||user.budget||"moderate").trim().toLowerCase()||"moderate";
        function chooseSharedBudgetTier(tier){
          var nextTier=String(tier||"moderate").trim().toLowerCase()||"moderate";
          setSBT(nextTier);
          saveTripPlanningState({state:{shared_budget_tier:nextTier}}).catch(function(){});
        }
        var chosenBudgetDef=(BUDGETS.find(function(b){return b.id===chosenTier;})||BUDGETS[1]||BUDGETS[0]);
        return(<>
          {ab("Budget Agent","Traveler budget profiles are shown below. Organizer picks the shared profile to use for trip budgeting.")}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:14}}>
            {budgetProfiles.map(function(item){
              var active=item.tier===chosenTier;
              return(<button key={item.key} onClick={function(){if(organizerMode)chooseSharedBudgetTier(item.tier);}} disabled={!organizerMode} style={{textAlign:"left",padding:"12px 14px",borderRadius:12,border:"1.5px solid "+(active?C.gold+"55":C.border),background:active?C.goldDim:C.bg,cursor:organizerMode?"pointer":"default",opacity:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <Avi ini={item.ini} color={item.color} size={24} name={item.label}/>
                  <div style={{minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:700,color:active?C.goldT:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}</p>
                    <p style={{fontSize:10,color:C.tx3}}>{item.mine?"your profile":"traveler profile"}</p>
                  </div>
                </div>
                <p style={{fontSize:13,fontWeight:700,color:active?C.goldT:C.tx2,textTransform:"capitalize"}}>{item.tier}</p>
              </button>);
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6,marginBottom:12}}>
            {BUDGETS.map(function(b){
              var active=b.id===chosenTier;
              return(<button key={b.id} onClick={function(){if(organizerMode)chooseSharedBudgetTier(b.id);}} disabled={!organizerMode} style={{padding:"10px 8px",borderRadius:10,border:"1.5px solid "+(active?C.gold+"55":C.border),background:active?C.goldDim:C.bg,color:active?C.goldT:C.tx2,fontSize:12,fontWeight:700,cursor:organizerMode?"pointer":"default"}}>{b.l}</button>);
            })}
          </div>
          <div style={{padding:"12px 14px",borderRadius:10,background:C.teal+"10",border:"1px solid "+C.teal+"20",marginBottom:8}}><p style={{fontSize:13,color:C.tealL}}>Shared budget selected: <strong>{chosenBudgetDef.l} ({chosenBudgetDef.r})</strong></p><p style={{fontSize:12,color:C.tx2,marginTop:4}}>Shared allocation: Stays 40% / Food 25% / Activities 20% / Transport 10% / Buffer 5%</p><p style={{fontSize:12,color:C.tx3,marginTop:4}}>Flights are personal and selected later by each traveler.</p></div>
          {!organizerMode&&<p style={{fontSize:12,color:C.tx3,marginBottom:8}}>Organizer chooses the shared trip budget after reviewing everyone's profile preferences.</p>}
        </>);
      }())}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>{[{l:"Stays",p:40,c:C.teal},{l:"Food",p:25,c:C.coral},{l:"Activities",p:20,c:C.grn},{l:"Transport",p:10,c:C.sky},{l:"Buffer",p:5,c:C.wrn}].map(function(b){return(<div key={b.l} style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,color:C.tx3,width:70}}>{b.l}</span><div style={{flex:1,height:6,background:C.border,borderRadius:999}}><div style={{height:"100%",width:b.p+"%",background:b.c,borderRadius:999}}/></div><span style={{fontSize:11,color:C.tx3,width:30}}>{b.p}%</span></div>);})}</div>
      <button onClick={saveBudgetThenAdvance} disabled={budgetSaveLoad||!organizerMode} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:(budgetSaveLoad||!organizerMode)?C.border:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:(budgetSaveLoad||!organizerMode)?"default":"pointer"}}>{budgetSaveLoad?"Saving budget...":(organizerMode?"Approve Budget":"Waiting for organizer")}</button>
      {budgetSaveErr&&<p style={{fontSize:12,color:C.red,marginTop:8}}>{budgetSaveErr}</p>}
    </div>)}

    {wizStep===9&&(function(){
      var accPois=pois.filter(function(p,i){return poiStatus[i]==="yes";});
      var poisByDest={};accPois.forEach(function(p){var d=p.destination||"Other";if(!poisByDest[d])poisByDest[d]=[];poisByDest[d].push(p);});
      var destNames=Object.keys(poisByDest);if(destNames.length===0)dests.forEach(function(d){destNames.push(d.name);poisByDest[d.name]=[];});
      var travelDays=Math.max(1,destNames.length-1);
      var totalCalc=0;
      destNames.forEach(function(dn){var dd=durPerDest[dn];var poisCount=(poisByDest[dn]||[]).length;var auto=Math.max(1,Math.ceil(poisCount/2));var days=dd!==undefined?dd:auto;totalCalc+=days;});
      var resolvedDurations=fillMissingDurationPerDestination(destNames,durPerDest,totalCalc);
      totalCalc+=travelDays+1;
      var feasible=totalCalc<=21;
      var tooLong=totalCalc>14;
      function approveDurationAndContinue(){
        var nextSignature=buildDurationPlanSignature(destNames,totalCalc);
        var shouldResetTravel=shouldResetTravelPlanForDurationChange(sharedDurationSignature,nextSignature,sharedDurationDays,totalCalc);
        var nextFlightDates={
          origin:flightDates.origin||"",
          arrive:flightDates.arrive||"",
          depart:shouldResetTravel?"":String(flightDates.depart||"").slice(0,10),
          ret:shouldResetTravel?"":String(flightDates.ret||"").slice(0,10)
        };
        setSDD(totalCalc);
        setSDSig(nextSignature);
        if(shouldResetTravel){
          setAData(function(prev){
            var next=Object.assign({},(prev&&typeof prev==="object")?prev:{});
            delete next.locked_window;
            next.is_locked=false;
            next.overlapping_windows=[];
            next.closest_windows=[];
            return next;
          });
          setADraft({start:"",end:""});
          setAErr("");
          setFD(function(prev){return Object.assign({},prev||{},nextFlightDates);});
          setFLI([]);
          setFLegs([]);
          setFSel({});
          setFErr("");
          setFDone(false);
          setFC(false);
          setFBL([]);
          setCSM("Duration changed. Availability and flight timing need revision.");
        }
        saveTripPlanningState({state:{
          duration_days_locked:totalCalc,
          duration_revision_signature:nextSignature,
          duration_per_destination:resolvedDurations,
          availability_locked_window:shouldResetTravel?null:((availabilityData&&availabilityData.locked_window&&typeof availabilityData.locked_window==="object")?availabilityData.locked_window:null),
          flight_dates:nextFlightDates,
          flights_confirmed:shouldResetTravel?false:flightConfirmed,
          flight_booking_links:shouldResetTravel?[]:flightBookLinks
        }}).then(function(){
          adv();
        }).catch(function(){
          setCSM("Could not save duration changes. Please try again.");
        });
      }

      return(<div>
        {ab("Duration Calculator","Calculated from your "+accPois.length+" accepted activities and flight schedule:")}
        {destNames.map(function(dn){var dp=poisByDest[dn]||[];var auto=Math.max(1,Math.ceil(dp.length/2));var days=durPerDest[dn]!==undefined?durPerDest[dn]:auto;
          return(<div key={dn} style={{padding:"12px 0",borderBottom:"1px solid "+C.border}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div><span style={{fontWeight:600,fontSize:14}}>{dn}</span><span style={{color:C.tx3,fontSize:12,marginLeft:8}}>{dp.length} activities</span></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={function(){setDPD(function(p){var n=Object.assign({},p);n[dn]=Math.max(1,(n[dn]!==undefined?n[dn]:auto)-1);return n;});}} style={{width:28,height:28,borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.tx2,cursor:"pointer",fontSize:14}}>-</button>
                <span style={{fontWeight:700,fontSize:16,minWidth:36,textAlign:"center",color:C.goldT}}>{days}d</span>
                <button onClick={function(){setDPD(function(p){var n=Object.assign({},p);n[dn]=(n[dn]!==undefined?n[dn]:auto)+1;return n;});}} style={{width:28,height:28,borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.tx2,cursor:"pointer",fontSize:14}}>+</button>
              </div>
            </div>
            {dp.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{dp.map(function(p,i){return <span key={i} style={{fontSize:10,padding:"1px 7px",borderRadius:999,background:"rgba(255,255,255,.04)",color:C.tx3}}>{p.name}</span>;})}</div>}
          </div>);
        })}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",color:C.tx3,fontSize:13}}><span>Travel between destinations</span><span>{travelDays}d</span></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",color:C.tx3,fontSize:13}}><span>Buffer / rest</span><span>1d</span></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"14px 0 0",borderTop:"2px solid "+C.gold+"20",marginTop:6}}><span style={{fontWeight:700,fontSize:18,color:C.goldT}}>Total</span><span style={{fontWeight:700,fontSize:18,color:C.goldT}}>{totalCalc} days</span></div>
        {(flightDates.depart||flightDates.ret)&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:C.teal+"08",border:"1px solid "+C.teal+"15"}}><p style={{fontSize:12,color:C.tealL}}>Exact travel dates captured: {String(flightDates.depart||"").slice(0,10)||"--"} to {String(flightDates.ret||"").slice(0,10)||"--"}. Later steps can refresh these once the itinerary and exact crew availability are locked.</p></div>}
        {tooLong&&(<div style={{marginTop:12,padding:"12px 14px",borderRadius:10,background:C.wrnBg,border:"1px solid "+C.wrn+"20"}}><p style={{fontSize:13,color:C.wrn,fontWeight:600}}>This trip is {totalCalc} days. That is longer than our usual planning range, but you can continue as-is or trim time here if you want a tighter route.</p><button onClick={function(){setWizardStepShared(6);}} style={{marginTop:8,padding:"8px 16px",borderRadius:8,border:"1px solid "+C.wrn+"30",background:"transparent",color:C.wrn,fontSize:13,fontWeight:600,cursor:"pointer"}}>Back to Activities</button></div>)}
        {!feasible&&(<div style={{marginTop:12,padding:"12px 14px",borderRadius:10,background:C.redBg,border:"1px solid "+C.red+"20"}}><p style={{fontSize:13,color:C.red}}>Trips over 21 days can take more coordination, but the final choice is yours. Continue if this duration matches how you want to travel.</p></div>)}
        {!tooLong&&<button onClick={approveDurationAndContinue} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>{"Approve "+totalCalc+" days"}</button>}
        {tooLong&&<button onClick={approveDurationAndContinue} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>{"Continue with "+totalCalc+" days"}</button>}
      </div>);
    }())}

    {wizStep===13&&(function(){
      var requiredTripDays=Math.max(1,Number(sharedDurationDays)||inclusiveIsoDays(flightDates.depart,flightDates.ret)||Number(tr.days)||10);
      var myUserId=String(userIdFromToken(authToken)||"").trim();
      var overlapData=sanitizeAvailabilityOverlapData((availabilityData&&typeof availabilityData==="object")?availabilityData:{},requiredTripDays);
      var knownFlightDates=sanitizeFlightDatesForTrip(flightDates,requiredTripDays);
      var memberWindows=Array.isArray(overlapData.member_windows)?overlapData.member_windows:[];
      var myWindows=exactAvailabilityWindows(((memberWindows.find(function(m){return String(m.user_id||"").trim()===myUserId;})||{}).windows)||[],requiredTripDays);
      var draftDays=inclusiveIsoDays(availabilityDraft.start,availabilityDraft.end);
      var lockedWindow=(overlapData.locked_window&&typeof overlapData.locked_window==="object")?overlapData.locked_window:null;
      var overlappingWindows=Array.isArray(overlapData.overlapping_windows)?overlapData.overlapping_windows:[];
      var closestWindows=Array.isArray(overlapData.closest_windows)?overlapData.closest_windows:[];
      var everyoneSubmitted=memberWindows.length>0&&memberWindows.every(function(m){return exactAvailabilityWindows(m.windows,requiredTripDays).length>0;});
      function updateAvailabilityField(key,val){
        setADraft(function(prev){var next=Object.assign({},prev||{});next[key]=val;return next;});
      }
      function submitMyAvailability(){
        if(availabilityLoad)return;
        var range={start:String(availabilityDraft.start||"").slice(0,10),end:String(availabilityDraft.end||"").slice(0,10)};
        if(!availabilityWindowMatchesTripDays(range,requiredTripDays)){
          setAErr("Choose exactly "+requiredTripDays+" days.");
          return;
        }
        setAErr("");
        setALoad(true);
        submitAvailabilityRange(resolveWizardTripId(currentTripId,newTrip,viewTrip),range,authToken).then(function(){
          return fetchAvailabilityOverlap(resolveWizardTripId(currentTripId,newTrip,viewTrip),authToken);
        }).then(function(res){
          if(res)setAData(res);
          setALoad(false);
        }).catch(function(e){
          setALoad(false);
          setAErr(String(e&&e.message||"Could not save availability"));
        });
      }
      function lockDates(range){
        if(!organizerMode||availabilityLoad)return;
        var lockRange={start:String(range&&range.start||"").slice(0,10),end:String(range&&range.end||"").slice(0,10)};
        if(!availabilityWindowMatchesTripDays(lockRange,requiredTripDays)){
          setAErr("Locked dates must cover exactly "+requiredTripDays+" days.");
          return;
        }
        setAErr("");
        setALoad(true);
        lockAvailabilityRange(resolveWizardTripId(currentTripId,newTrip,viewTrip),lockRange,authToken).then(function(){
          return fetchAvailabilityOverlap(resolveWizardTripId(currentTripId,newTrip,viewTrip),authToken);
        }).then(function(res){
          setFD(function(prev){return Object.assign({},prev||{},{depart:lockRange.start,ret:lockRange.end});});
          if(res)setAData(res);
          saveTripPlanningState({state:{availability_locked_window:lockRange,flight_dates:{depart:lockRange.start,ret:lockRange.end}}}).catch(function(){});
          setALoad(false);
        }).catch(function(e){
          setALoad(false);
          setAErr(String(e&&e.message||"Could not lock travel dates"));
        });
      }
      return(<div>
        {ab("Availability Agent","Everyone confirms the exact "+requiredTripDays+"-day window now that trip length is set. Organizer locks the final overlap.")}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare member windows, overlap, and lock state.</p>
          <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {showVoteDebug?"Hide Debug":"Show Debug"}
          </button>
        </div>
        {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
          <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Availability Debug</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
            {[
              {l:"Resolved trip id",v:resolveWizardTripId(currentTripId,newTrip,viewTrip)||"(missing)"},
              {l:"Required trip days",v:String(requiredTripDays)},
              {l:"Flight date range",v:(String(knownFlightDates.depart||"").slice(0,10)||"--")+" to "+(String(knownFlightDates.ret||"").slice(0,10)||"--")},
              {l:"Locked window",v:JSON.stringify(lockedWindow||null)},
              {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"}
            ].map(function(item){
              return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
              </div>);
            })}
          </div>
          <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw availability overlap payload</p>
            <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:220,overflowY:"auto"}}>{JSON.stringify(overlapData||{},null,2)}</pre>
          </div>
        </div>)}
        <div style={{padding:"12px 14px",borderRadius:10,background:C.teal+"08",border:"1px solid "+C.teal+"15",marginBottom:12}}>
          <p style={{fontSize:12,color:C.tealL}}>Trip duration is locked at <strong>{requiredTripDays} days</strong>.</p>
          <p style={{fontSize:12,color:C.tx2,marginTop:4}}>Known travel dates: {String(knownFlightDates.depart||"").slice(0,10)||"--"} to {String(knownFlightDates.ret||"").slice(0,10)||"--"}. Each traveler submits one exact {requiredTripDays}-day window that works.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:12}}>
          <input value={availabilityDraft.start||""} onClick={tryShowDatePicker} onFocus={tryShowDatePicker} onChange={function(e){updateAvailabilityField("start",e.target.value);}} type="date" style={{padding:"10px 12px",borderRadius:8,background:C.bg,border:"1px solid "+C.border,fontSize:13,color:"#fff"}}/>
          <input value={availabilityDraft.end||""} onClick={tryShowDatePicker} onFocus={tryShowDatePicker} onChange={function(e){updateAvailabilityField("end",e.target.value);}} type="date" style={{padding:"10px 12px",borderRadius:8,background:C.bg,border:"1px solid "+C.border,fontSize:13,color:"#fff"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <span style={{fontSize:12,color:draftDays===requiredTripDays?C.grn:C.wrn}}>{draftDays>0?(draftDays+" of "+requiredTripDays+" days selected"):("Pick exactly "+requiredTripDays+" days")}</span>
          <button onClick={submitMyAvailability} disabled={availabilityLoad} style={{padding:"10px 16px",borderRadius:10,border:"none",background:availabilityLoad?C.border:C.teal,color:availabilityLoad?C.tx3:"#fff",fontSize:13,fontWeight:600,cursor:availabilityLoad?"default":"pointer"}}>{availabilityLoad?"Saving...":"Save My Dates"}</button>
        </div>
        {availabilityErr&&<div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,background:C.redBg,border:"1px solid "+C.red+"22"}}><p style={{fontSize:12,color:C.red}}>{availabilityErr}</p></div>}
        {memberWindows.length>0&&(<div style={{marginBottom:12}}>
          {memberWindows.map(function(member){
            var exactWindows=exactAvailabilityWindows(member.windows,requiredTripDays);
            var rawWindows=Array.isArray(member.windows)?member.windows:[];
            var submitted=exactWindows.length>0;
            var needsRevision=!submitted&&rawWindows.length>0;
            return(<div key={member.user_id} style={{padding:"10px 0",borderBottom:"1px solid "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,fontWeight:600}}>{member.name||member.email||"Traveler"}</span>
                <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:submitted?C.grnBg:(needsRevision?C.redBg:C.wrnBg),color:submitted?C.grn:(needsRevision?C.red:C.wrn)}}>{submitted?"Submitted":(needsRevision?"Needs update":"Waiting")}</span>
              </div>
              <p style={{fontSize:12,color:C.tx3,marginTop:4}}>{submitted?exactWindows.map(function(win){return win.start+" to "+win.end;}).join("; "):(needsRevision?"Saved window no longer matches the locked "+requiredTripDays+"-day trip.":"No dates submitted yet.")}</p>
            </div>);
          })}
        </div>)}
        {myWindows.length>0&&<p style={{fontSize:12,color:C.tx3,marginBottom:12}}>Your saved window: {myWindows.map(function(win){return win.start+" to "+win.end;}).join("; ")}</p>}
        {lockedWindow&&(<div style={{padding:"10px 14px",borderRadius:10,background:C.grnBg,border:"1px solid "+C.grn+"22",marginBottom:12}}>
          <p style={{fontSize:12,color:C.grn}}>Organizer locked travel dates: {lockedWindow.start} to {lockedWindow.end}</p>
        </div>)}
        {!lockedWindow&&overlappingWindows.length>0&&(<div style={{marginBottom:12}}>
          <p style={{fontSize:12,fontWeight:600,color:C.tealL,marginBottom:6}}>Common windows</p>
          {overlappingWindows.map(function(win,idx){
            return(<div key={win.start+"-"+win.end+"-"+idx} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:C.bg,border:"1px solid "+C.border,marginBottom:6}}>
              <span style={{fontSize:12,color:C.tx2}}>{win.start} to {win.end} ({win.overlap_days} days)</span>
              {organizerMode&&<button onClick={function(){lockDates(win);}} disabled={availabilityLoad} style={{padding:"8px 12px",borderRadius:8,border:"none",background:availabilityLoad?C.border:C.gold,color:availabilityLoad?C.tx3:C.bg,fontSize:12,fontWeight:700,cursor:availabilityLoad?"default":"pointer"}}>Lock These Dates</button>}
            </div>);
          })}
        </div>)}
        {!lockedWindow&&closestWindows.length>0&&(<div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,background:C.wrnBg,border:"1px solid "+C.wrn+"20"}}>
          <p style={{fontSize:12,color:C.wrn,fontWeight:600,marginBottom:6}}>No full overlap yet</p>
          {closestWindows.slice(0,3).map(function(item,idx){return <p key={idx} style={{fontSize:12,color:C.tx2,marginBottom:4}}>{item.window.start} to {item.window.end}: {item.members_available.length}/{memberWindows.length} available</p>;})}
        </div>)}
        {lockedWindow&&goBtn("Continue with locked dates")}
        {!lockedWindow&&!organizerMode&&everyoneSubmitted&&<p style={{fontSize:12,color:C.tx3}}>Waiting for organizer to lock the final travel dates.</p>}
      </div>);
    }())}

    {wizStep===14&&(function(){
      var lockedWindow=(availabilityData&&availabilityData.locked_window&&typeof availabilityData.locked_window==="object")?availabilityData.locked_window:null;
      var routePlan=normalizedFlightRoutePlan();
      var displayedRoutePlan=displayedRoundTripRoutePlan(routePlan);
      var resolvedFlightTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip)||"(missing)";
      var routePlanSig=flightRoutePlanSignature(routePlan);
      var displayedRoutePlanSig=flightRoutePlanSignature(displayedRoutePlan);
      var allPicked=(flightLegs||[]).length>0&&(flightLegs||[]).every(function(leg,legIndex){
        return !!selectedOptionForLeg(leg,legIndex);
      });
      var missingPickCount=(flightLegs||[]).reduce(function(total,leg,legIndex){
        return total+(!selectedOptionForLeg(leg,legIndex)?1:0);
      },0);
      function updFlight(k,v,commit){
        setFD(function(p){
          var n=Object.assign({},p);
          n[k]=v;
          if(k==="origin"&&!String(n.final_airport||"").trim())n.final_airport=v;
          if(commit){
            persistFlightRoute(n,routePlan);
          }
          return n;
        });
      }
      function updRouteStop(idx,key,val,commit){
        setFLI(function(prev){
          var arr=normalizedFlightRoutePlan(prev).slice(0);
          var row=Object.assign({},arr[idx]||{});
          row[key]=val;
          if(key==="travel_date")row.manual_date=!!String(val||"").slice(0,10);
          arr[idx]=row;
          if(commit)persistFlightRoute(flightDates,arr);
          return arr;
        });
      }
      function moveRouteStop(idx,direction){
        var moved=moveFlightRouteStop(routePlan,idx,direction,effectiveDurPerDest,lockedWindow);
        persistFlightRoute(flightDates,moved);
      }
      return(<div>
        {ab("Flight Agent","Search and confirm flights only after the organizer has locked the exact trip dates.")}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
          <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare shared route-plan state, locked dates, and search inputs on this step.</p>
          <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {showVoteDebug?"Hide Debug":"Show Debug"}
          </button>
        </div>
        {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
          <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Flight Debug</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
            {[
              {l:"Resolved trip id",v:resolvedFlightTripId},
              {l:"Locked window",v:JSON.stringify(lockedWindow||null)},
              {l:"Flight dates",v:JSON.stringify(flightDates||{})},
              {l:"Saved route signature",v:routePlanSig},
              {l:"Displayed route signature",v:displayedRoutePlanSig},
              {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"}
            ].map(function(item){
              return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
              </div>);
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10}}>
            <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw `flightLegInputs` state</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(flightLegInputs||[],null,2)}</pre>
            </div>
            <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Normalized route plan</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(routePlan||[],null,2)}</pre>
            </div>
            <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Displayed round-trip route plan</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(displayedRoutePlan||[],null,2)}</pre>
            </div>
            <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Duration per destination</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(effectiveDurPerDest||{},null,2)}</pre>
            </div>
          </div>
        </div>)}
        {lockedWindow&&<div style={{marginBottom:10,padding:"10px 14px",borderRadius:10,background:C.teal+"10",border:"1px solid "+C.teal+"20"}}><p style={{fontSize:12,color:C.tealL}}>Locked trip dates: {lockedWindow.start} to {lockedWindow.end}</p></div>}
        <div style={{marginBottom:10,padding:"12px 14px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
          <p style={{fontSize:12,color:C.tx2,marginBottom:6}}>Set the starting airport and final return airport. Destination cities are inserted underneath, auto-dated from the locked trip window, and can be reordered or overridden by any traveler.</p>
          <p style={{fontSize:11,color:C.tx3}}>Round-trip routing automatically returns through Destination 1 before the final leg home.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"repeat(2,minmax(0,1fr))",gap:8,marginBottom:10}}>
          <input value={flightDates.origin||""} onChange={function(e){updFlight("origin",e.target.value,false);}} onBlur={function(e){updFlight("origin",e.target.value,true);}} placeholder="Starting city or airport (e.g. Detroit)" style={{padding:"10px 12px",borderRadius:8,background:C.bg,border:"1px solid "+C.border,fontSize:13,color:"#fff"}}/>
          <input value={flightDates.final_airport||""} onChange={function(e){updFlight("final_airport",e.target.value,false);}} onBlur={function(e){updFlight("final_airport",e.target.value,true);}} placeholder="Final return city or airport" style={{padding:"10px 12px",borderRadius:8,background:C.bg,border:"1px solid "+C.border,fontSize:13,color:"#fff"}}/>
          <input value={flightDates.depart||""} readOnly type="date" style={{padding:"10px 12px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:13,color:C.tx2}}/>
          <input value={flightDates.ret||""} readOnly type="date" style={{padding:"10px 12px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:13,color:C.tx2}}/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
          {displayedRoutePlan.map(function(stop,idx){
            var isReturnStop=!!stop.is_return_stop;
            var canMoveUp=!isReturnStop&&idx>0;
            var canMoveDown=!isReturnStop&&idx<routePlan.length-1;
            return(<div key={stop.destination+"-"+idx+(isReturnStop?"-return":"")} style={{padding:"10px 12px",borderRadius:10,border:"1px solid "+C.border,background:C.surface}}>
              <div style={{padding:"10px 12px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,minWidth:0}}>
                <p style={{fontSize:11,color:C.tx3,marginBottom:4}}>{isReturnStop?"Return through destination 1":"Destination "+(idx+1)}</p>
                <p style={{fontSize:13,fontWeight:700,color:"#fff",wordBreak:"break-word"}}>{stop.destination}</p>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"minmax(0,1fr) minmax(130px,.55fr) auto",gap:8,minWidth:0,marginTop:8,alignItems:"center"}}>
                <input value={stop.airport||""} title={stop.airport||""} readOnly={isReturnStop} onChange={function(e){if(!isReturnStop)updRouteStop(idx,"airport",e.target.value,false);}} onBlur={function(e){if(!isReturnStop)updRouteStop(idx,"airport",e.target.value,true);}} placeholder={stop.destination+" city or airport"} style={{width:"100%",minWidth:0,padding:"10px 12px",borderRadius:8,background:isReturnStop?C.surface:C.bg,border:"1px solid "+C.border,fontSize:13,color:isReturnStop?C.tx2:"#fff"}}/>
                <input value={stop.travel_date||""} title={stop.travel_date||""} readOnly={isReturnStop} onClick={isReturnStop?undefined:tryShowDatePicker} onFocus={isReturnStop?undefined:tryShowDatePicker} onChange={function(e){if(!isReturnStop)updRouteStop(idx,"travel_date",e.target.value,false);}} onBlur={function(e){if(!isReturnStop)updRouteStop(idx,"travel_date",e.target.value,true);}} type="date" style={{width:"100%",minWidth:0,padding:"10px 12px",borderRadius:8,background:isReturnStop?C.surface:C.bg,border:"1px solid "+C.border,fontSize:13,color:isReturnStop?C.tx2:"#fff"}}/>
                <div style={{display:"flex",gap:6,justifyContent:isNarrow?"flex-start":"flex-end"}}>
                  <button onClick={function(){moveRouteStop(idx,-1);}} disabled={!canMoveUp} style={{minWidth:38,height:34,padding:"0 8px",borderRadius:8,border:"1px solid "+C.border,background:!canMoveUp?C.surface:C.bg,color:!canMoveUp?C.tx3:"#fff",cursor:!canMoveUp?"default":"pointer"}}>Up</button>
                  <button onClick={function(){moveRouteStop(idx,1);}} disabled={!canMoveDown} style={{minWidth:38,height:34,padding:"0 8px",borderRadius:8,border:"1px solid "+C.border,background:!canMoveDown?C.surface:C.bg,color:!canMoveDown?C.tx3:"#fff",cursor:!canMoveDown?"default":"pointer"}}>Dn</button>
                </div>
              </div>
            </div>);
          })}
        </div>
        <button onClick={searchFlights} disabled={flightLoad} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:flightLoad?C.border:C.teal,color:flightLoad?C.tx3:"#fff",fontSize:14,fontWeight:600,cursor:flightLoad?"default":"pointer"}}>{flightLoad?"Searching flights...":"Search Flight Options"}</button>
        {flightErr&&<p style={{fontSize:12,color:C.red,marginTop:8}}>{flightErr}</p>}
        {flightDone&&flightLegs.length>0&&(<div style={{marginTop:10}}>
          {flightLegs.map(function(leg,legIndex){
            var legKey=legSelectionKey(leg,legIndex);
            return(<div key={String(leg&&leg.leg_id||leg&&leg.segment_id||leg&&leg.id||legKey)} style={{marginBottom:12,border:"1px solid "+C.border,borderRadius:10,padding:"10px 12px",background:C.bg}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:C.tx2}}>{leg.from_airport} {"->"} {leg.to_airport}</span><span style={{fontSize:11,color:C.tx3}}>{leg.depart_date}</span></div>
              {(leg.options||[]).map(function(opt,optIndex){
                var optKey=optionSelectionKey(opt,optIndex);
                var sel=String((flightSel&&flightSel[legKey])||"")===optKey;
                return(<div key={legKey+"-"+optKey} onClick={function(){setFSel(function(prev){var n=Object.assign({},prev);n[legKey]=optKey;return n;});}} style={{padding:"8px 10px",borderRadius:8,border:"1px solid "+(sel?C.teal+"55":C.border),background:sel?C.teal+"10":"transparent",marginBottom:6,cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:13,fontWeight:600}}>{opt.airline}</span><span style={{fontSize:14,fontWeight:700,color:C.goldT}}>${Math.round(opt.price_usd||0)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.tx3}}><span>{(opt.departure_time||"").slice(11,16)} - {(opt.arrival_time||"").slice(11,16)} | {opt.stops===0?"Nonstop":(opt.stops+" stop")}</span><span>{opt.duration_minutes||0} min</span></div>
                </div>);
              })}
            </div>);
          })}
          {flightBookLinks.length>0&&(<div style={{marginTop:8,padding:"10px 12px",borderRadius:10,background:C.teal+"10",border:"1px solid "+C.teal+"22"}}>
            <p style={{fontSize:12,color:C.tealL,marginBottom:6}}>Booking links:</p>
            {flightBookLinks.map(function(link,i){return <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{display:"block",fontSize:12,color:C.sky,marginBottom:4,textDecoration:"none"}}>{link.airline} - {link.route}</a>;})}
          </div>)}
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <button onClick={revise} style={{flex:1,padding:"12px",borderRadius:12,border:"2px solid "+C.red,background:"transparent",color:C.red,fontSize:14,fontWeight:600,cursor:"pointer",minHeight:46}}>Revise</button>
            <button onClick={confirmFlightsThenContinue} disabled={flightLegs.length===0||flightConfirmLoad} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:(flightLegs.length===0||flightConfirmLoad)?C.border:C.teal,color:(flightLegs.length===0||flightConfirmLoad)?C.tx3:"#fff",fontSize:14,fontWeight:600,cursor:(flightLegs.length===0||flightConfirmLoad)?"default":"pointer",minHeight:46}}>{flightConfirmLoad?"Confirming...":"Confirm Flights"}</button>
          </div>
          {allPicked&&!flightConfirmLoad&&<p style={{fontSize:11,color:C.tx3,marginTop:8}}>Confirm will save selected legs and open airline booking pages.</p>}
          {!allPicked&&missingPickCount>0&&!flightConfirmLoad&&<p style={{fontSize:11,color:C.tx3,marginTop:8}}>Missing selections: {missingPickCount}. Confirm will auto-pick the first option for unselected legs.</p>}
        </div>)}
      </div>);
    }())}

    {wizStep===10&&(function(){
      var grpSize=(jc||0)+1;
      var totalN=Math.max(1,Number(sharedDurationDays)||inclusiveIsoDays((availabilityData&&availabilityData.locked_window||{}).start,(availabilityData&&availabilityData.locked_window||{}).end)||10);
      var voteMembers=[{
        id:currentPlannerId,
        userId:userIdFromToken(authToken),
        email:user.email||"",
        name:user.name||user.email||"You",
        ini:iniFromName(user.name||user.email||"You"),
        color:C.gold
      }];
      (tm||[]).forEach(function(m){
        voteMembers.push({
          id:makeVoteUserId(m.id,m.email,("crew-"+voteMembers.length)),
          userId:m.id||"",
          email:m.email||"",
          name:m.name||m.email||"Crew",
          ini:m.ini||iniFromName(m.name||m.email||"Crew"),
          color:m.color||CREW_COLORS[voteMembers.length%CREW_COLORS.length]
        });
      });
      voteMembers=dedupeVoteVoters(voteMembers);
      var majorityNeeded=Math.floor(Math.max(voteMembers.length,1)/2)+1;
      var destGroups={};if(stays.length>0)stays.forEach(function(s,idx){var d=s.destination||"Other";if(!destGroups[d])destGroups[d]=[];destGroups[d].push({stay:s,idx:idx,localIndex:destGroups[d].length});});
      var destList=Object.keys(destGroups);
      function lockedStayKeyForDest(destName){
        return String((stayFinalChoices&&stayFinalChoices[destName])||"");
      }
      function lockedStayEntryForDest(destName){
        var wanted=lockedStayKeyForDest(destName);
        if(!wanted)return null;
        return (destGroups[destName]||[]).find(function(entry){
          return canonicalStayVoteKey(entry.stay,entry.idx)===wanted;
        })||null;
      }
      function rankStayOptions(destName){
        return (destGroups[destName]||[]).map(function(entry){
          var summary=summarizeStayVotes(stayVotes,entry.stay,entry.idx,voteMembers);
          return Object.assign({},entry,{summary:summary});
        }).sort(function(a,b){
          if(b.summary.up!==a.summary.up)return b.summary.up-a.summary.up;
          if(a.summary.down!==b.summary.down)return a.summary.down-b.summary.down;
          if((a.stay.ratePerNight||0)!==(b.stay.ratePerNight||0))return (a.stay.ratePerNight||0)-(b.stay.ratePerNight||0);
          return String(a.stay.name||"").localeCompare(String(b.stay.name||""));
        });
      }
      function summarizeStayDestination(destName){
        var entries=destGroups[destName]||[];
        var voted=0;
        var ranked=rankStayOptions(destName);
        var lockedEntry=lockedStayEntryForDest(destName);
        var majorityEntry=ranked.find(function(entry){return entry.summary.up>=majorityNeeded&&entry.summary.up>entry.summary.down;})||null;
        voteMembers.forEach(function(vm){
          var hasVote=entries.some(function(entry){
            var v=readVoteForVoter(readStayVoteRow(stayVotes,entry.stay,entry.idx).row,vm);
            return v==="up"||v==="down";
          });
          if(hasVote)voted++;
        });
        return {
          votedCount:voted,
          allVoted:voted===voteMembers.length&&voteMembers.length>0,
          lockedEntry:lockedEntry,
          majorityEntry:majorityEntry,
          resolvedEntry:lockedEntry||majorityEntry||null
        };
      }
      function voteForStay(destName, chosenEntry, member, vote){
        if(!chosenEntry||!member||!canEditVoteForMember(member,currentVoteActor,organizerMode))return;
        var aliases=voteKeyAliasesFor(member);
        if(aliases.length===0)return;
        setStayVotes(function(prev){
          var next=Object.assign({},prev||{});
          (destGroups[destName]||[]).forEach(function(entry){
            var rowMeta=readStayVoteRow(next,entry.stay,entry.idx);
            var row=Object.assign({},rowMeta.row||{});
            aliases.forEach(function(alias){
              if(vote==="up"){
                row[alias]=entry.idx===chosenEntry.idx?"up":"down";
              }else if(entry.idx===chosenEntry.idx){
                row[alias]="down";
              }
            });
            next[rowMeta.key]=row;
          });
          saveTripPlanningState({state:{stay_votes:next}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          return next;
        });
      }
      function lockStayChoice(destName, chosenEntry){
        if(!organizerMode||!chosenEntry)return;
        var lockKey=canonicalStayVoteKey(chosenEntry.stay,chosenEntry.idx);
        setSFC(function(prev){
          var next=Object.assign({},prev||{});
          next[destName]=lockKey;
          var patch={};
          patch[destName]=lockKey;
          saveTripPlanningState({state:{stay_final_choices:patch}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          return next;
        });
      }
      var allResolved=false;var pickedStays=[];var nextStayPick={};
      destList.forEach(function(d){
        var resolved=soloTripMode?(function(){
          var selectedIdx=stayPick[d];
          if(selectedIdx===undefined||selectedIdx===null)return null;
          return (destGroups[d]||[]).find(function(entry){return entry.localIndex===selectedIdx;})||null;
        }()):summarizeStayDestination(d).resolvedEntry;
        if(resolved){
          pickedStays.push(resolved.stay);
          nextStayPick[d]=resolved.localIndex;
        }
      });
      allResolved=destList.length>0&&destList.every(function(d){return nextStayPick[d]!==undefined;});
      var totalCost=pickedStays.reduce(function(s,st){return s+(st.ratePerNight||0)*(st.totalNights||1);},0);
      function selectSoloStay(destName, entry){
        if(!soloTripMode||!entry)return;
        setStayPick(function(prev){
          var next=Object.assign({},prev||{});
          next[destName]=entry.localIndex;
          return next;
        });
        var lockKey=canonicalStayVoteKey(entry.stay,entry.idx);
        setSFC(function(prev){
          var next=Object.assign({},prev||{});
          next[destName]=lockKey;
          saveTripPlanningState({state:{stay_final_choices:next}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          return next;
        });
      }
      function confirmStaysAndContinue(){
        var activeStayTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip||tr);
        var resolvedChoiceMap=Object.assign({},stayFinalChoices||{});
        Object.keys(nextStayPick||{}).forEach(function(destName){
          var selectedLocal=nextStayPick[destName];
          var selectedEntry=(destGroups[destName]||[]).find(function(entry){
            return entry.localIndex===selectedLocal;
          })||null;
          if(selectedEntry){
            resolvedChoiceMap[destName]=canonicalStayVoteKey(selectedEntry.stay,selectedEntry.idx);
          }
        });
        setStayPick(nextStayPick);
        setSFC(resolvedChoiceMap);
        if(!(authToken&&activeStayTripId&&isUuidLike(activeStayTripId))){
          adv();
          return;
        }
        persistPlanningStateStrict({trip_id:activeStayTripId,state:{
          stay_votes:(stayVotes&&typeof stayVotes==="object")?Object.assign({},stayVotes):{},
          stay_final_choices:resolvedChoiceMap
        }}).then(function(){
          adv();
        }).catch(function(){
          setCSM("Could not persist stay selections. Please retry.");
        });
      }
      async function runStayLLM(){
        setSL(true);
        setSD(false);
        try{
          var res=await askStays(dests,effectiveTripBudgetTier,totalN,grpSize);
          var norm=normalizeStays(res,dests,effectiveTripBudgetTier,totalN);
          var clearedStayLocks={};Object.keys(stayFinalChoices||{}).forEach(function(k){clearedStayLocks[k]="";});
          if(norm.length===0){
            var fbRows=await askStaysBackend(currentTripId,dests,effectiveTripBudgetTier,totalN,authToken);
            norm=normalizeStays(fbRows,dests,effectiveTripBudgetTier,totalN);
            if(norm.length>0){
              setSChat(function(p){return p.concat([{from:"agent",text:"Live stay search fallback used. Review and select one per destination."}]);});
            }
          }
          setStays(norm);
          setSFC({});
          setSL(false);
          setSD(true);
          saveTripPlanningState({state:{stay_options:norm,stay_votes:{},stay_final_choices:clearedStayLocks}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          if(norm.length===0){
            setSChat(function(p){return p.concat([{from:"agent",text:"I need more detail. Try: 'boutique hotels with pool in Kyoto under $180'."}]);});
          }
        }catch(e){
          var fallbackRows=await askStaysBackend(currentTripId,dests,effectiveTripBudgetTier,totalN,authToken);
          var fallbackNorm=normalizeStays(fallbackRows,dests,effectiveTripBudgetTier,totalN);
          var clearedStayLocksFallback={};Object.keys(stayFinalChoices||{}).forEach(function(k){clearedStayLocksFallback[k]="";});
          setStays(fallbackNorm);
          setSFC({});
          setSL(false);
          setSD(true);
          saveTripPlanningState({state:{stay_options:fallbackNorm,stay_votes:{},stay_final_choices:clearedStayLocksFallback}}).then(function(){
            refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
          });
          if(fallbackNorm.length>0){
            setSChat(function(p){return p.concat([{from:"agent",text:"LLM was unavailable, so I pulled stay options from backend search."}]);});
          }else{
            setSChat(function(p){return p.concat([{from:"agent",text:"Could not generate stays right now. Please try again."}]);});
          }
        }
      }

      function sendStayChat(){
        if(!stayAsk.trim()||stayAskLoad)return;var msg=stayAsk.trim();setSA("");setSAL(true);
        setSChat(function(p){return p.concat([{from:"user",text:msg}]);});
        var destStr=dests.map(function(d){return d.name;}).join(", ")||"your destinations";
        var currentPicked=pickedStays.map(function(s){return s.name+" ($"+s.ratePerNight+"/n) in "+s.destination;}).join("; ");
        var sys="You are WanderPlan Accommodation Agent. User wants to modify stays. Current: "+(currentPicked||"none")+". Destinations: "+destStr+". Budget: "+effectiveTripBudgetTier+".\n\nReturn ONLY JSON in one of these strict formats:\n{\"type\":\"options\",\"stays\":[{\"name\":\"Hotel\",\"destination\":\"City\",\"type\":\"Hotel\",\"rating\":4.5,\"ratePerNight\":120,\"totalNights\":3,\"amenities\":[\"WiFi\"],\"bookingSource\":\"Booking.com\",\"whyThisOne\":\"Reason\",\"cancellation\":\"Free\",\"bookingUrl\":\"https://...\",\"imageUrl\":\"https://...\"}]}\nOR\n{\"type\":\"options\",\"stays\":[]}\n\nRules:\n- this step is accommodation-only; do not provide meal plans, itinerary summaries, or travel tips\n- prioritize real property names or honest area guidance if exact listings are uncertain\n- include bookingUrl and imageUrl when known; otherwise leave them empty\n- do not include markdown or prose outside JSON";
        callLLM(sys,msg,1000).then(function(res){
          setSAL(false);
          var candidateRows=Array.isArray(res)?res:((res&&res.type==="options"&&Array.isArray(res.stays))?res.stays:[]);
          if(candidateRows.length>0){
            var norm=normalizeStays(candidateRows,dests,effectiveTripBudgetTier,totalN);
            setStays(function(prev){
              var next=(Array.isArray(prev)?prev:[]).concat(norm);
              var clearedStayLocksNext={};Object.keys(stayFinalChoices||{}).forEach(function(k){clearedStayLocksNext[k]="";});
              setSFC({});
              saveTripPlanningState({state:{stay_options:next,stay_votes:stayVotes,stay_final_choices:clearedStayLocksNext}}).then(function(){
                refreshTripPlanningState(authToken,currentTripId||tr.id).catch(function(){});
              });
              return next;
            });
            setSChat(function(p){return p.concat([{from:"agent",text:"Added "+norm.length+" new option"+(norm.length!==1?"s":"")+"! Scroll up to see them."}]);});
          }
          else{setSChat(function(p){return p.concat([{from:"agent",text:"I can only update accommodations on this step. Try: 'cheaper hotels in Kyoto under $100' or 'guesthouse near temple area'."}]);});}
        }).catch(function(){setSAL(false);setSChat(function(p){return p.concat([{from:"agent",text:"Connection issue. Try again."}]);});});
      }

      return(<div>
        {ab("Accommodation Agent",stayDone?(soloTripMode?"Choose one stay per destination. Chat below to refine.":"Select one per destination. Chat below to refine."): "Generating LLM accommodation options...")}
        {!stayDone&&!stayLoad&&(<div><p style={{fontSize:14,color:C.tx2,marginBottom:12}}>LLM agent will generate 2-3 stay options per destination from your budget and trip profile.</p><button onClick={runStayLLM} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>Generate Stay Options</button></div>)}
        {stayLoad&&(<div style={{textAlign:"center",padding:"30px 0"}}><div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12}}><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div><p style={{fontSize:14,color:C.tx2}}>Analyzing destinations and generating stay options...</p></div>)}
        {stayDone&&stays.length>0&&(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
            <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare stay votes and organizer locks on this step.</p>
            <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              {showVoteDebug?"Hide Debug":"Show Debug"}
            </button>
          </div>
          {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
            <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Stay Debug</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
              {[
                {l:"Resolved trip id",v:resolveWizardTripId(currentTripId,newTrip,viewTrip)||"(missing)"},
                {l:"Required nights",v:String(totalN)},
                {l:"Stay count",v:String(stays.length)},
                {l:"Locked choices",v:JSON.stringify(stayFinalChoices||{})},
                {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"}
              ].map(function(item){
                return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                  <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                  <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
                </div>);
              })}
            </div>
            <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw stay votes</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(stayVotes||{},null,2)}</pre>
            </div>
          </div>)}
          {destList.map(function(destName){var opts=destGroups[destName]||[];var destSummary=summarizeStayDestination(destName);var ranked=rankStayOptions(destName);var leadingIdx=ranked[0]?ranked[0].idx:-1;var lockedEntry=destSummary.lockedEntry;var resolvedEntry=soloTripMode?(function(){var selectedIdx=stayPick[destName];return opts.find(function(entry){return entry.localIndex===selectedIdx;})||null;}()):destSummary.resolvedEntry;
            return(<div key={destName} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:8,height:8,borderRadius:999,background:C.tealL}}/><span style={{fontSize:14,fontWeight:700}}>{destName}</span><span style={{fontSize:12,color:C.tx3}}>{opts.length} options</span><span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:lockedEntry?C.goldDim:(resolvedEntry?C.grnBg:C.wrnBg),color:lockedEntry?C.goldT:(resolvedEntry?C.grn:C.wrn),marginLeft:"auto"}}>{soloTripMode?(resolvedEntry?"Selected":"Choose one"): (lockedEntry?"Locked":(resolvedEntry?("Ready "+destSummary.votedCount+"/"+voteMembers.length):("Voting "+destSummary.votedCount+"/"+voteMembers.length)))}</span></div>
              {opts.map(function(entry){var s=entry.stay;var summary=summarizeStayVotes(stayVotes,s,entry.idx,voteMembers);var mine=readVoteForVoter(summary.row,currentVoteActor)==="up";var leader=soloTripMode?(stayPick[destName]===entry.localIndex):(entry.idx===leadingIdx);var isLocked=!!(lockedEntry&&lockedEntry.idx===entry.idx);var isResolved=!!(resolvedEntry&&resolvedEntry.idx===entry.idx);var isAreaGuidance=isAreaGuidanceStay(s);
                return(<div key={entry.idx} onClick={function(){setStayPreview({destination:destName,stay:s,summary:summary,isLocked:isLocked,isResolved:isResolved,leader:leader});}} style={{background:isLocked?C.goldDim:(leader?C.teal+"10":C.bg),borderRadius:12,padding:"12px 14px",marginBottom:6,border:"2px solid "+(isLocked?C.goldT:(isResolved?C.teal+"50":C.border)),transition:"all .2s",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <div><h4 style={{fontWeight:700,fontSize:14,color:isLocked?C.goldT:(leader?C.tealL:C.tx)}}>{s.name}</h4><div style={{display:"flex",gap:8,fontSize:11,color:C.tx3,marginTop:2,flexWrap:"wrap"}}><span>{s.type}</span>{!isAreaGuidance&&Number(s.rating||0)>0&&<span style={{color:C.wrn}}>{"*"+(s.rating||4.5)}</span>}{s.neighborhood&&<span>{s.neighborhood}</span>}<span style={{color:C.sky}}>{isAreaGuidance?"Click to review area":"Click to preview"}</span></div></div>
                    <div style={{textAlign:"right"}}><span style={{fontWeight:700,fontSize:16,color:C.goldT}}>{"$"+(s.ratePerNight||0)}</span><p style={{fontSize:10,color:C.tx3}}>/night x {s.totalNights||"?"}</p></div>
                  </div>
                  {s.amenities&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>{s.amenities.map(function(a){return <span key={a} style={{fontSize:10,padding:"1px 7px",borderRadius:999,background:"rgba(255,255,255,.04)",color:C.tx2}}>{a}</span>;})}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>{s.whyThisOne&&<p style={{fontSize:11,color:C.tealL,fontStyle:"italic",flex:1}}>{s.whyThisOne}</p>}{s.bookingSource&&<span style={{fontSize:10,padding:"1px 7px",borderRadius:999,background:C.sky+"15",color:C.sky}}>{s.bookingSource}</span>}</div>
                  <div style={{marginTop:6,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:(mine||isResolved)?C.grn:C.tx3}}>{soloTripMode?(isResolved?(isAreaGuidance?"Selected stay area":"Selected for this trip"):(isAreaGuidance?"Review and use this area below":"Preview and select below")):(isLocked?"Organizer locked this stay":(mine?"Your pick":"Vote on this stay below"))}</span>
                    <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:isLocked?C.goldDim:(soloTripMode?(isResolved?C.grnBg:C.surface):(summary.up>=majorityNeeded?C.grnBg:C.surface)),color:isLocked?C.goldT:(soloTripMode?(isResolved?C.grn:C.tx2):(summary.up>=majorityNeeded?C.grn:C.tx2))}}>
                      {soloTripMode?(isResolved?(isAreaGuidance?"Area Selected":"Selected"):(isAreaGuidance?"Review Area":"Preview")):(summary.up+" / "+voteMembers.length+" votes")}
                    </span>
                  </div>
                  {!soloTripMode&&(<div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:8}}>
                    {voteMembers.map(function(vm){
                      var v=readVoteForVoter(summary.row,vm);
                      var canEdit=!lockedEntry&&canEditVoteForMember(vm,currentVoteActor,organizerMode);
                      return(<div key={vm.id} style={{display:"flex",alignItems:"center",gap:6}}>
                        <Avi ini={vm.ini} color={vm.color} size={22} name={vm.name}/>
                        <button disabled={!canEdit} onClick={function(e){e.stopPropagation();voteForStay(destName,entry,vm,"up");}} style={{width:26,height:26,borderRadius:8,border:"1px solid "+(v==="up"?C.grn+"55":C.grn+"40"),background:v==="up"?C.grnBg:"transparent",color:C.grn,fontSize:10,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"Up"}</button>
                        <button disabled={!canEdit} onClick={function(e){e.stopPropagation();voteForStay(destName,entry,vm,"down");}} style={{width:26,height:26,borderRadius:8,border:"1px solid "+(v==="down"?C.red+"55":C.red+"40"),background:v==="down"?C.redBg:"transparent",color:C.red,fontSize:10,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"Dn"}</button>
                      </div>);
                    })}
                  </div>)}
                  <div style={{marginTop:10,display:"flex",justifyContent:"flex-end",gap:8}}>
                    {soloTripMode&&<button onClick={function(e){e.stopPropagation();selectSoloStay(destName,entry);}} style={{padding:"8px 12px",borderRadius:8,border:"none",background:isResolved?C.grn:C.teal,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>{isResolved?(isAreaGuidance?"Area Selected":"Selected"):(isAreaGuidance?"Use This Area":"Select Stay")}</button>}
                    {!soloTripMode&&organizerMode&&<button onClick={function(e){e.stopPropagation();lockStayChoice(destName,entry);}} style={{padding:"8px 12px",borderRadius:8,border:"none",background:isLocked?C.gold:C.goldT,color:C.bg,fontSize:12,fontWeight:700,cursor:"pointer"}}>{isLocked?"Locked by Organizer":"Lock This Stay"}</button>}
                  </div>
                </div>);
              })}
            </div>);
          })}
          {stayPreview&&stayPreview.stay&&(<div onClick={function(){setStayPreview(null);}} style={{position:"fixed",inset:0,zIndex:60,background:"rgba(4,6,12,.78)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
            <div onClick={function(e){e.stopPropagation();}} style={{width:"min(720px,100%)",maxHeight:"85vh",overflowY:"auto",borderRadius:18,background:C.surface,border:"1px solid "+C.border,padding:20,boxShadow:"0 24px 80px rgba(0,0,0,.45)"}}>
              {stayPreview.stay.imageUrl?(
                <div style={{marginBottom:14,borderRadius:16,overflow:"hidden",border:"1px solid "+C.border,background:C.bg}}>
                  <img src={stayPreview.stay.imageUrl} alt={stayPreview.stay.name||"Stay preview"} style={{display:"block",width:"100%",height:isNarrow?220:280,objectFit:"cover"}}/>
                </div>
              ):(
                <div style={{marginBottom:14,borderRadius:16,border:"1px dashed "+C.border,background:"linear-gradient(135deg,"+C.bg+","+C.surface+")",padding:isNarrow?18:24}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:6}}>Property preview</p>
                  <p style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>{stayPreview.stay.name||"Stay option"}</p>
                  <p style={{fontSize:12,color:C.tx2}}>Image unavailable from this source. You can still open the live listing/search link below.</p>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:12}}>
                <div>
                  <p style={{fontSize:11,fontWeight:700,color:C.tealL,marginBottom:6}}>{stayPreview.destination||stayPreview.stay.destination||"Stay Preview"}</p>
                  <h3 style={{fontSize:24,fontWeight:800,marginBottom:6}}>{stayPreview.stay.name||"Selected stay"}</h3>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:12,color:C.tx3}}>
                    <span>{stayPreview.stay.type||"Hotel"}</span>
                    {!isAreaGuidanceStay(stayPreview.stay)&&Number(stayPreview.stay.rating||0)>0&&<span style={{color:C.wrn}}>{"*"+(stayPreview.stay.rating||4.5)}</span>}
                    {stayPreview.stay.neighborhood&&<span>{stayPreview.stay.neighborhood}</span>}
                    {stayPreview.stay.bookingSource&&<span style={{color:C.sky}}>{stayPreview.stay.bookingSource}</span>}
                  </div>
                </div>
                <button onClick={function(){setStayPreview(null);}} style={{padding:"8px 12px",borderRadius:10,border:"1px solid "+C.border,background:C.bg,color:C.tx2,fontSize:12,fontWeight:700,cursor:"pointer"}}>Close</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1.1fr .9fr",gap:12,marginBottom:12}}>
                <div style={{padding:"14px 16px",borderRadius:14,background:C.bg,border:"1px solid "+C.border}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>Why it fits</p>
                  <p style={{fontSize:13,color:C.tx2,lineHeight:1.6}}>{stayPreview.stay.whyThisOne||"Good fit for your destination, duration, and budget."}</p>
                </div>
                <div style={{padding:"14px 16px",borderRadius:14,background:C.bg,border:"1px solid "+C.border}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>Cost snapshot</p>
                  <p style={{fontSize:22,fontWeight:800,color:C.goldT,marginBottom:4}}>{"$"+Math.round(Number(stayPreview.stay.ratePerNight||0)||0)}<span style={{fontSize:12,color:C.tx3,fontWeight:600}}> / night</span></p>
                  <p style={{fontSize:12,color:C.tx2,marginBottom:4}}>{"$"+Math.round((Number(stayPreview.stay.ratePerNight||0)||0)*(Number(stayPreview.stay.totalNights||0)||0))} total stay estimate</p>
                  <p style={{fontSize:12,color:C.tx3}}>{stayPreview.stay.totalNights||"?"} nights</p>
                </div>
              </div>
              {Array.isArray(stayPreview.stay.amenities)&&stayPreview.stay.amenities.length>0&&(<div style={{marginBottom:12}}>
                <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>Features</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {stayPreview.stay.amenities.map(function(a){return <span key={a} style={{fontSize:12,padding:"6px 10px",borderRadius:999,background:C.teal+"12",color:C.tealL,border:"1px solid "+C.teal+"30"}}>{a}</span>;})}
                </div>
              </div>)}
              <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
                <div style={{padding:"14px 16px",borderRadius:14,background:C.bg,border:"1px solid "+C.border}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>Booking details</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:12,color:C.tx2}}>
                    <span>{"Source: "+(stayPreview.stay.bookingSource||"Direct / OTA")}</span>
                    <span>{"Cancellation: "+(stayPreview.stay.cancellation||"Policy not provided")}</span>
                    <span>{"Destination: "+(stayPreview.destination||stayPreview.stay.destination||"Trip stop")}</span>
                    {isAreaGuidanceStay(stayPreview.stay)&&<span>This is area guidance, not a single verified hotel listing.</span>}
                  </div>
                </div>
                <div style={{padding:"14px 16px",borderRadius:14,background:C.bg,border:"1px solid "+C.border}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.tx3,marginBottom:8}}>Group status</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:12,color:C.tx2}}>
                    <span>{"Votes: "+String((stayPreview.summary&&stayPreview.summary.up)||0)+" / "+String(voteMembers.length)}</span>
                    <span>{stayPreview.isLocked?"Organizer locked this stay":(stayPreview.isResolved?"This stay currently wins the vote":"Still in voting")}</span>
                    <span>{stayPreview.leader?"Currently leading in this destination":"Not leading right now"}</span>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <p style={{fontSize:12,color:C.tx3}}>{isAreaGuidanceStay(stayPreview.stay)?"Review this area before choosing a real guesthouse, dharamshala, or hotel nearby.":"Preview stays before voting so the crew can compare hotel features, pricing, and policies clearly."}</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {stayPreviewLink(stayPreview.stay)&&<a href={stayPreviewLink(stayPreview.stay)} target="_blank" rel="noreferrer" style={{padding:"10px 14px",borderRadius:10,border:"1px solid "+C.sky+"35",background:C.sky+"12",color:C.sky,fontSize:12,fontWeight:700,textDecoration:"none"}}>{isAreaGuidanceStay(stayPreview.stay)?"Search This Area":(stayPreview.stay.bookingUrl?"Open Listing":"Search Property")}</a>}
                  <button onClick={function(){setStayPreview(null);}} style={{padding:"10px 14px",borderRadius:10,border:"1px solid "+C.border,background:C.surface,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Back to stays</button>
                </div>
              </div>
            </div>
          </div>)}
          <div style={{background:C.bg,borderRadius:12,border:"1px solid "+C.border,overflow:"hidden",marginTop:4}}>
            <div style={{padding:"8px 12px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:6}}><div style={{width:18,height:18,borderRadius:999,background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff"}}>AI</div><span style={{fontSize:11,fontWeight:600,color:C.tealL}}>Modify stays</span></div>
            {stayChat.length>0&&(<div style={{maxHeight:160,overflowY:"auto",padding:"8px 12px"}}>{stayChat.map(function(msg,i){var isU=msg.from==="user";return(<div key={i} style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",marginBottom:5}}><div style={{maxWidth:"85%",padding:"7px 11px",borderRadius:isU?"10px 10px 3px 10px":"10px 10px 10px 3px",background:isU?C.teal+"20":C.surface,border:"1px solid "+(isU?C.teal+"25":C.border),fontSize:13,lineHeight:1.5,color:isU?"#fff":C.tx2}}>{msg.text}</div></div>);})}{stayAskLoad&&<div style={{display:"flex",gap:4,padding:"4px 0"}}><div style={{width:5,height:5,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:5,height:5,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:5,height:5,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div>}</div>)}
            <div style={{display:"flex",gap:6,padding:"8px 10px",borderTop:stayChat.length>0?"1px solid "+C.border:"none"}}><input value={stayAsk} onChange={function(e){setSA(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")sendStayChat();}} placeholder="'cheaper in Kyoto' or 'need a pool'" disabled={stayAskLoad} style={{flex:1,padding:"8px 11px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:12,color:"#fff",opacity:stayAskLoad?.5:1}}/><button onClick={sendStayChat} disabled={stayAskLoad} style={{padding:"7px 12px",borderRadius:8,border:"none",background:stayAskLoad?C.border:C.teal,color:stayAskLoad?C.tx3:"#fff",fontSize:11,fontWeight:600,cursor:stayAskLoad?"default":"pointer"}}>Ask</button></div>
          </div>
          {allResolved&&(<div style={{marginTop:12}}><div style={{padding:"10px 14px",borderRadius:10,background:C.grnBg}}><p style={{fontSize:12,color:C.grn}}>{pickedStays.length} {soloTripMode?"selected":"resolved"} stays. Total: ${totalCost}</p></div><button onClick={confirmStaysAndContinue} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>{"Confirm Stays ($"+totalCost+")"}</button></div>)}
          {!allResolved&&destList.length>0&&<p style={{fontSize:12,color:C.wrn,marginTop:8}}>{soloTripMode?"Select one stay per destination to continue.":(organizerMode?"If votes split, lock one stay per destination to continue.":"Vote for one stay per destination. Organizer will lock any mismatches.")}</p>}
        </div>)}
        {stayDone&&stays.length===0&&(<div><p style={{fontSize:14,color:C.tx3,padding:"12px 0"}}>No results. Describe what you need:</p><div style={{display:"flex",gap:6}}><input value={stayAsk} onChange={function(e){setSA(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")sendStayChat();}} placeholder="e.g. 'Airbnbs in Santorini under $150'" style={{flex:1,padding:"9px 12px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:13,color:"#fff"}}/><button onClick={sendStayChat} style={{padding:"8px 14px",borderRadius:8,border:"none",background:C.teal,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ask</button></div></div>)}
      </div>);
    }())}

    {wizStep===11&&(function(){
      var grpSize=(jc||0)+1;var dietStr=(user.dietary||[]).join(", ")||"none";
      var totalDays=Math.max(1,Number(sharedDurationDays)||inclusiveIsoDays((availabilityData&&availabilityData.locked_window||{}).start,(availabilityData&&availabilityData.locked_window||{}).end)||10);
      var activeDiningTripId=resolveWizardTripId(currentTripId,newTrip,viewTrip||tr);
      var DINING_CALL_TIMEOUT_MS=12000;
      var voteMembers=[{
        id:currentPlannerId,
        userId:userIdFromToken(authToken),
        email:user.email||"",
        name:user.name||user.email||"You",
        ini:iniFromName(user.name||user.email||"You"),
        color:C.gold
      }];
      (tm||[]).forEach(function(m){
        voteMembers.push({
          id:makeVoteUserId(m.id,m.email,("crew-"+voteMembers.length)),
          userId:m.id||"",
          email:m.email||"",
          name:m.name||m.email||"Crew",
          ini:m.ini||iniFromName(m.name||m.email||"Crew"),
          color:m.color||CREW_COLORS[voteMembers.length%CREW_COLORS.length]
        });
      });
      voteMembers=dedupeVoteVoters(voteMembers);
      var majorityNeeded=Math.floor(Math.max(voteMembers.length,1)/2)+1;
      var approvedMeals=[];var rejectedMeals=[];var pendingMeals=[];
      meals.forEach(function(day,di){(day.meals||[]).forEach(function(m,mi){var summary=summarizeMealVotes(mealVotes,day,m,di,mi,voteMembers);if(summary.up>=majorityNeeded&&summary.up>summary.down)approvedMeals.push(m);else if(summary.votedCount===voteMembers.length&&summary.down>=summary.up)rejectedMeals.push(m);else pendingMeals.push(m);});});
      var allDecided=soloTripMode?(mealDone&&meals.length>0):(mealDone&&meals.length>0&&pendingMeals.length===0);
      var totalMealCost=approvedMeals.reduce(function(s,m){return s+(m.cost||0);},0);
      function castMealVote(day,meal,di,mi,member,vote){
        if(!member||!canEditVoteForMember(member,currentVoteActor,organizerMode))return;
        var aliases=voteKeyAliasesFor(member);
        if(aliases.length===0)return;
        setMealVotes(function(prev){
          var next=Object.assign({},prev||{});
          var rowMeta=readMealVoteRow(next,day,meal,di,mi);
          var row=Object.assign({},rowMeta.row||{});
          aliases.forEach(function(alias){row[alias]=vote;});
          next[rowMeta.key]=row;
          saveTripPlanningState({state:{meal_votes:next}}).then(function(){
            refreshTripPlanningState(authToken,activeDiningTripId).catch(function(){});
          });
          return next;
        });
      }
      function confirmMealPlanAndContinue(){
        function proceedAfterMealConfirm(){
          setCSM("");
          advanceWizardStep();
        }
        var mealSnapshot=normalizeDiningPlan(meals);
        var voteSnapshot=(mealVotes&&typeof mealVotes==="object")?Object.assign({},mealVotes):{};
        if(!(authToken&&activeDiningTripId&&isUuidLike(activeDiningTripId))){
          // Allow local wizard progression even when backend trip context is unavailable.
          setMeals(mealSnapshot);
          setMealVotes(voteSnapshot);
          setMD(mealSnapshot.length>0);
          setCSM("Meal plan confirmed locally.");
          proceedAfterMealConfirm();
          return;
        }
        persistPlanningStateStrict({trip_id:activeDiningTripId,state:{meal_plan:mealSnapshot,meal_votes:voteSnapshot}}).then(function(){
          proceedAfterMealConfirm();
        }).catch(function(){
          setCSM("Could not save meal plan right now. Please retry.");
        });
      }

      function mergeDiningPlanRows(existingRows,incomingRows){
        var merged=(Array.isArray(existingRows)?existingRows:[]).concat(Array.isArray(incomingRows)?incomingRows:[]);
        var byKey={};
        merged.forEach(function(row){
          if(!row||typeof row!=="object")return;
          var dayNum=Number(row.day||0)||0;
          var key=(String(row.date||"").trim()+"|"+String(dayNum)+"|"+canonicalTripDestinationName(row.destination||"")).toLowerCase();
          var meals=Array.isArray(row.meals)?row.meals.slice():[];
          if(!byKey[key]){
            byKey[key]=Object.assign({},row,{meals:meals});
            return;
          }
          meals.forEach(function(meal){
            var typeKey=String(meal&&meal.type||"").trim().toLowerCase();
            var hasType=Array.isArray(byKey[key].meals)&&byKey[key].meals.some(function(existingMeal){
              return String(existingMeal&&existingMeal.type||"").trim().toLowerCase()===typeKey;
            });
            if(!hasType)byKey[key].meals.push(meal);
          });
        });
        var out=Object.keys(byKey).map(function(key){return byKey[key];});
        out.sort(function(a,b){
          var ad=Number(a&&a.day||0)||0;
          var bd=Number(b&&b.day||0)||0;
          if(ad!==bd)return ad-bd;
          return String(a&&a.date||"").localeCompare(String(b&&b.date||""));
        });
        return out;
      }
      function mergeSuggestionRows(existingRows,incomingRows){
        var all=(Array.isArray(existingRows)?existingRows:[]).concat(Array.isArray(incomingRows)?incomingRows:[]);
        var seen={};
        var out=[];
        all.forEach(function(row){
          if(!(row&&typeof row==="object"))return;
          var key=[
            String(row.day||"").trim(),
            String(row.meal||"").trim().toLowerCase(),
            String(row.destination||row.city||"").trim().toLowerCase(),
            String(row.name||"").trim().toLowerCase()
          ].join("|");
          if(seen[key])return;
          seen[key]=1;
          out.push(row);
        });
        return out;
      }
      function withTimeoutPromise(promise,timeoutMs){
        return new Promise(function(resolve,reject){
          var done=false;
          var timer=setTimeout(function(){
            if(done)return;
            done=true;
            reject(new Error("Request timed out"));
          },Math.max(1000,Number(timeoutMs)||DINING_CALL_TIMEOUT_MS));
          Promise.resolve(promise).then(function(value){
            if(done)return;
            done=true;
            clearTimeout(timer);
            resolve(value);
          }).catch(function(err){
            if(done)return;
            done=true;
            clearTimeout(timer);
            reject(err);
          });
        });
      }
      function fetchDiningApi(path){
        return withTimeoutPromise(apiJson(path,{method:"GET"},authToken),DINING_CALL_TIMEOUT_MS);
      }
      function fetchJsonWithTimeout(url, timeoutMs){
        return withTimeoutPromise(fetch(url,{method:"GET",headers:{Accept:"application/json"}}).then(function(res){
          if(!res.ok)throw new Error("HTTP "+res.status);
          return res.json();
        }),timeoutMs||15000);
      }
      function osmQueryUrls(queryText, limit){
        var q=encodeURIComponent(String(queryText||"").trim());
        var lim=Math.max(5,Math.min(25,Number(limit)||12));
        var target="https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit="+lim+"&q="+q;
        return [
          target,
          "https://api.allorigins.win/raw?url="+encodeURIComponent(target)
        ];
      }
      async function fetchFirstSuccessfulJson(urls, timeoutMs){
        var list=Array.isArray(urls)?urls:[];
        var lastErr=null;
        for(var i=0;i<list.length;i++){
          var url=String(list[i]||"").trim();
          if(!url)continue;
          try{
            return await fetchJsonWithTimeout(url,timeoutMs);
          }catch(err){
            lastErr=err;
          }
        }
        throw (lastErr||new Error("all_sources_failed"));
      }
      function normalizeOpenVenueRows(rawRows, destinationName){
        var rows=Array.isArray(rawRows)?rawRows:[];
        var seen={};
        var out=[];
        rows.forEach(function(row){
          if(!(row&&typeof row==="object"))return;
          var name=String(row.name||"").trim();
          if(!name)return;
          if(/^restaurant$/i.test(name))return;
          var display=String(row.display_name||"").trim();
          var key=(name+"|"+display).toLowerCase();
          if(seen[key])return;
          seen[key]=1;
          var parts=display.split(",").map(function(p){return String(p||"").trim();}).filter(Boolean);
          out.push({
            name:name,
            city:String(destinationName||"").trim(),
            cuisine:String(row.type||"Local").trim()||"Local",
            rating:4.2,
            cost:0,
            near_poi:(parts.length>1?parts.slice(0,2).join(", "):display),
            note:"OpenStreetMap fallback venue match.",
            travel_minutes:15
          });
        });
        return out;
      }
      function pickWrapped(arr, startIndex, count){
        var src=Array.isArray(arr)?arr:[];
        if(src.length===0)return [];
        var out=[];
        for(var i=0;i<count;i++){
          out.push(src[(startIndex+i)%src.length]);
        }
        return out;
      }
      function buildRealFallbackSuggestionsForDestination(destinationName, dayNum, venues){
        var base=Array.isArray(venues)?venues:[];
        if(base.length===0)return [];
        var breakfastOptions=pickWrapped(base,0,Math.min(4,base.length));
        var lunchOptions=pickWrapped(base,1,Math.min(4,base.length));
        var dinnerOptions=pickWrapped(base,2,Math.min(4,base.length));
        function buildMeal(mealType, mealTime, options){
          var first=options[0]||{};
          return {
            day:dayNum,
            destination:destinationName,
            meal:mealType,
            time:mealTime,
            name:first.name||("Restaurant in "+destinationName),
            cuisine:first.cuisine||"Local",
            cost:0,
            rating:4.2,
            note:first.note||"OpenStreetMap fallback venue match.",
            options:(options||[]).map(function(opt,idx){
              return Object.assign({
                option_id:canonicalTripDestinationName(destinationName)+"-"+mealType.toLowerCase()+"-"+String(idx+1)
              },opt);
            })
          };
        }
        return [
          buildMeal("Breakfast","08:00",breakfastOptions),
          buildMeal("Lunch","13:00",lunchOptions),
          buildMeal("Dinner","19:00",dinnerOptions)
        ];
      }
      async function fetchOpenVenueRowsForDestination(destinationName){
        var destName=String(destinationName||"").trim();
        if(!destName)return [];
        var queryCandidates=[
          "restaurants in "+destName,
          "food in "+destName,
          destName+" eateries"
        ];
        for(var i=0;i<queryCandidates.length;i++){
          try{
            var raw=await fetchFirstSuccessfulJson(osmQueryUrls(queryCandidates[i],14),18000);
            var venues=normalizeOpenVenueRows(raw,destName);
            if(Array.isArray(venues)&&venues.length>0)return venues;
          }catch(err){}
        }
        return [];
      }
      async function fetchOpenDataMealSuggestionsForDestinations(orderedDests, destLimit, dayOffset){
        var list=(Array.isArray(orderedDests)?orderedDests:[]).slice(0,Math.max(1,Number(destLimit)||2));
        var offset=Math.max(0,Number(dayOffset)||0);
        var allRows=[];
        var jobs=list.map(function(dest,idx){
          var destName=String(dest&&dest.name||dest||"").trim();
          if(!destName)return Promise.resolve([]);
          return fetchOpenVenueRowsForDestination(destName).then(function(venues){
            return buildRealFallbackSuggestionsForDestination(destName,offset+idx+1,venues);
          }).catch(function(){return [];});
        });
        var settled=await Promise.all(jobs);
        settled.forEach(function(rows){
          if(Array.isArray(rows)&&rows.length>0)allRows=allRows.concat(rows);
        });
        return allRows;
      }
      function loadOpenDataMealFallback(orderedDests,nextVotes,label){
        var list=Array.isArray(orderedDests)?orderedDests:[];
        var votes=(nextVotes&&typeof nextVotes==="object")?Object.assign({},nextVotes):{};
        var totalDest=list.length;
        if(totalDest===0)return Promise.reject(new Error("no_destinations"));
        var firstChunk=Math.min(2,Math.max(1,totalDest||1));
        return fetchOpenDataMealSuggestionsForDestinations(list,firstChunk,0).then(function(seedRows){
          if(!Array.isArray(seedRows)||seedRows.length===0)throw new Error("seed_empty");
          var plan=normalizeDiningPlan(buildDiningRowsFromSuggestions(seedRows));
          return persistMealsSnapshot(plan,votes).then(function(){
            setMealErr("");
            setMChat(function(p){
              return p.concat([{from:"agent",text:(label?label+" ":"")+"Loaded real venue names from open map data for the first destinations. Fetching more in background..."}]);
            });
            if(totalDest>firstChunk){
              fetchOpenDataMealSuggestionsForDestinations(list.slice(firstChunk),Math.max(1,totalDest-firstChunk),firstChunk).then(function(moreRows){
                if(!Array.isArray(moreRows)||moreRows.length===0)return;
                setMeals(function(prevMeals){
                  var mergedRows=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreRows)));
                  persistMealsSnapshot(mergedRows,votes).catch(function(){return null;});
                  return mergedRows;
                });
              }).catch(function(){});
            }
            return plan;
          });
        });
      }
      function readDiningSuggestions(resp){
        return Array.isArray(resp&&resp.suggestions)?resp.suggestions:[];
      }
      async function fetchDayBasedDiningSuggestions(dayStart,dayEnd){
        var maxDays=Math.max(1,Math.min(21,totalDays||1));
        var start=Math.max(1,Math.min(maxDays,Number(dayStart)||1));
        var end=Math.max(start,Math.min(maxDays,Number(dayEnd)||maxDays));
        var jobs=[];
        for(var dayNum=start;dayNum<=end;dayNum++){
          jobs.push((function(dn){
            return fetchDiningApi("/trips/"+activeDiningTripId+"/dining/suggestions?day="+dn+"&meal=any&limit=50").then(function(dayResp){
              return readDiningSuggestions(dayResp).map(function(row){
                if(!(row&&typeof row==="object"))return row;
                if(row.day!==undefined&&row.day!==null)return row;
                return Object.assign({},row,{day:dn});
              });
            }).catch(function(){return [];});
          })(dayNum));
        }
        var settled=await Promise.all(jobs);
        var out=[];
        settled.forEach(function(rows){
          if(Array.isArray(rows)&&rows.length>0)out=mergeSuggestionRows(out,rows);
        });
        return out;
      }
      function persistMealsSnapshot(nextMeals,nextVotes){
        var plan=normalizeDiningPlan(Array.isArray(nextMeals)?nextMeals:[]);
        var votes=(nextVotes&&typeof nextVotes==="object")?Object.assign({},nextVotes):{};
        setMeals(plan);
        setMD(plan.length>0);
        setMealErr("");
        return saveTripPlanningState({state:{meal_plan:plan,meal_votes:votes}}).then(function(){
          refreshTripPlanningState(authToken,activeDiningTripId).catch(function(){});
          return plan;
        });
      }
      function buildLocalMealGuidanceRows(orderedDests){
        var rows=[];
        var list=Array.isArray(orderedDests)?orderedDests:[];
        list.forEach(function(dest,idx){
          var destName=String(dest&&dest.name||dest||"").trim()||("Destination "+(idx+1));
          var slots=[
            {meal:"Breakfast",time:"08:00",anchorRole:"stay"},
            {meal:"Lunch",time:"13:00",anchorRole:"poi"},
            {meal:"Dinner",time:"19:00",anchorRole:"stay"}
          ];
          slots.forEach(function(slot){
            var spotlight=resolveMealSpotlight(destName,slot.meal,slot.anchorRole==="poi"?"main sightseeing stop":"your stay");
            var baseName=slot.meal+" near "+(slot.anchorRole==="poi"?"sightseeing stop":"your stay");
            var options=[0,1,2].map(function(optIdx){
              var suffix=optIdx===0?"":(optIdx===1?" option B":" option C");
              return {
                option_id:canonicalTripDestinationName(destName)+"-"+slot.meal.toLowerCase()+"-"+String(optIdx+1),
                name:baseName+suffix,
                city:destName,
                cuisine:slot.meal==="Breakfast"?"Regional breakfast":(slot.meal==="Lunch"?"Local lunch":"Regional dinner"),
                cost:slot.meal==="Breakfast"?12:(slot.meal==="Lunch"?18:24),
                rating:4.2-(optIdx*0.1),
                tags:["local","guidance"],
                near_poi:String(spotlight&&spotlight.area||"").trim(),
                travel_minutes:slot.meal==="Lunch"?18:12,
                note:String(spotlight&&spotlight.note||"").trim(),
                anchorRole:slot.anchorRole,
                anchorLabel:String(spotlight&&spotlight.area||"").trim()
              };
            });
            rows.push({
              day:idx+1,
              destination:destName,
              meal:slot.meal,
              time:slot.time,
              name:baseName,
              cuisine:options[0].cuisine,
              cost:options[0].cost,
              rating:options[0].rating,
              note:options[0].note,
              anchor_role:slot.anchorRole,
              anchor_label:options[0].anchorLabel,
              options:options
            });
          });
        });
        return normalizeDiningPlan(buildDiningRowsFromSuggestions(rows));
      }
      function loadGuidanceMealFallback(orderedDests,nextVotes,label){
        var budgetTier=resolveTripBudgetTier(sharedBudgetTier,user.budget);
        return withTimeoutPromise(
          Promise.resolve(askDining(orderedDests,budgetTier,user.dietary,totalDays,grpSize)),
          25000
        ).then(function(aiRows){
          var rows=normalizeDiningPlan(Array.isArray(aiRows)?aiRows:[]);
          if(rows.length===0)throw new Error("empty_fallback");
          return persistMealsSnapshot(rows,nextVotes).then(function(){
            setMChat(function(p){
              return p.concat([{from:"agent",text:(label?label+" ":"")+"Live venue service is currently unavailable. Loaded AI meal guidance so planning can continue. Venue options are guidance-only until backend recovers."}]);
            });
            return rows;
          });
        }).catch(function(){
          var localRows=buildLocalMealGuidanceRows(orderedDests);
          if(!Array.isArray(localRows)||localRows.length===0){
            throw new Error("local_guidance_failed");
          }
          return persistMealsSnapshot(localRows,nextVotes).then(function(){
            setMChat(function(p){
              return p.concat([{from:"agent",text:(label?label+" ":"")+"Live dining and AI services are unavailable. Loaded offline meal guidance so you can continue planning."}]);
            });
            return localRows;
          });
        });
      }
      function tryAutoOpenDataFallback(orderedDests,nextVotes,finalErr){
        return loadOpenDataMealFallback(orderedDests,nextVotes,"Auto real-data fallback.").then(function(){
          setML(false);
          return true;
        }).catch(function(){
          setML(false);
          if(finalErr)setMealErr(finalErr);
          return false;
        });
      }

      function sendMealChat(){
        if(!mealAsk.trim()||mealAskLoad)return;var msg=mealAsk.trim();setMA("");setMAL(true);
        setMChat(function(p){return p.concat([{from:"user",text:msg}]);});
        if(authToken&&activeDiningTripId&&isUuidLike(activeDiningTripId)){
          setMealErr("");
          var orderedDests=orderDestinationsByRoutePlan(dests,routePlan);
          var destCount=orderedDests.length;
          var firstChunk=Math.min(2,Math.max(1,destCount||1));
          var firstPath="/trips/"+activeDiningTripId+"/dining/suggestions"+(destCount>2?("?destination_offset=0&destination_limit="+firstChunk):"");
          fetchDiningApi(firstPath).then(function(r){
            var sug=readDiningSuggestions(r);
            setMAL(false);
            if(sug.length>0){
              var nextMeals=normalizeDiningPlan(buildDiningRowsFromSuggestions(sug));
              persistMealsSnapshot(nextMeals,mealVotes);
              if(destCount>firstChunk){
                setMChat(function(p){return p.concat([{from:"agent",text:"Refreshed first "+firstChunk+" destinations. Loading remaining destinations now..."}]);});
                fetchDiningApi("/trips/"+activeDiningTripId+"/dining/suggestions?destination_offset="+firstChunk).then(function(nextResp){
                  var nextSug=readDiningSuggestions(nextResp);
                  if(nextSug.length>0){
                    var appendedMeals=normalizeDiningPlan(buildDiningRowsFromSuggestions(nextSug));
                    setMeals(function(prevMeals){
                      var mergedMeals=mergeDiningPlanRows(prevMeals,appendedMeals);
                      persistMealsSnapshot(mergedMeals,mealVotes).catch(function(){return null;});
                      return mergedMeals;
                    });
                    setMChat(function(p){return p.concat([{from:"agent",text:"Added meal options for the remaining destinations."}]);});
                  }else{
                    setMChat(function(p){return p.concat([{from:"agent",text:"No additional real venue options were found for the remaining destinations right now."}]);});
                  }
                }).catch(function(){
                  setMChat(function(p){return p.concat([{from:"agent",text:"Could not load remaining destinations in background. You can keep working with the loaded set."}]);});
                });
              }else{
                setMChat(function(p){return p.concat([{from:"agent",text:"Refreshed real venue options from backend with your current budget settings."}]);});
              }
              return;
            }
            if(destCount>2){
              fetchDiningApi("/trips/"+activeDiningTripId+"/dining/suggestions").then(function(fallbackResp){
                var fallbackSug=readDiningSuggestions(fallbackResp);
                if(fallbackSug.length>0){
                  var fallbackMeals=normalizeDiningPlan(buildDiningRowsFromSuggestions(fallbackSug));
                  persistMealsSnapshot(fallbackMeals,mealVotes);
                  setMChat(function(p){return p.concat([{from:"agent",text:"Loaded real venue options using full-trip fallback fetch."}]);});
                  return;
                }
                fetchDayBasedDiningSuggestions(1,2).then(function(daySug){
                  if(daySug.length>0){
                    var dayMeals=normalizeDiningPlan(buildDiningRowsFromSuggestions(daySug));
                    persistMealsSnapshot(dayMeals,mealVotes);
                    setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first fallback meal options quickly. Fetching additional days in background..."}]);});
                    fetchDayBasedDiningSuggestions(3,Math.max(3,Math.min(21,totalDays||1))).then(function(moreDaySug){
                      if(moreDaySug.length===0)return;
                      setMeals(function(prevMeals){
                        var mergedDayMeals=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreDaySug)));
                        persistMealsSnapshot(mergedDayMeals,mealVotes).catch(function(){return null;});
                        return mergedDayMeals;
                      });
                    }).catch(function(){});
                    return;
                  }
                  setMChat(function(p){return p.concat([{from:"agent",text:"No real venue suggestions are available right now for this trip. Try again in a moment."}]);});
                }).catch(function(){
                  setMChat(function(p){return p.concat([{from:"agent",text:"Could not refresh real venue suggestions right now. Please try again."}]);});
                });
              }).catch(function(){
                fetchDayBasedDiningSuggestions(1,2).then(function(daySug){
                  if(daySug.length>0){
                    var dayMeals=normalizeDiningPlan(buildDiningRowsFromSuggestions(daySug));
                    persistMealsSnapshot(dayMeals,mealVotes);
                    setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first fallback meal options quickly. Fetching additional days in background..."}]);});
                    fetchDayBasedDiningSuggestions(3,Math.max(3,Math.min(21,totalDays||1))).then(function(moreDaySug){
                      if(moreDaySug.length===0)return;
                      setMeals(function(prevMeals){
                        var mergedDayMeals=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreDaySug)));
                        persistMealsSnapshot(mergedDayMeals,mealVotes).catch(function(){return null;});
                        return mergedDayMeals;
                      });
                    }).catch(function(){});
                    return;
                  }
                  setMChat(function(p){return p.concat([{from:"agent",text:"Could not refresh real venue suggestions right now. Please try again."}]);});
                }).catch(function(){
                  setMChat(function(p){return p.concat([{from:"agent",text:"Could not refresh real venue suggestions right now. Please try again."}]);});
                });
              });
              return;
            }
            setMChat(function(p){return p.concat([{from:"agent",text:"No real venue suggestions are available right now for this trip. Try again in a moment."}]);});
          }).catch(function(){
            setMAL(false);
            fetchDayBasedDiningSuggestions(1,2).then(function(daySug){
              if(daySug.length>0){
                var dayMeals=normalizeDiningPlan(buildDiningRowsFromSuggestions(daySug));
                persistMealsSnapshot(dayMeals,mealVotes);
                setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first fallback meal options quickly. Fetching additional days in background..."}]);});
                fetchDayBasedDiningSuggestions(3,Math.max(3,Math.min(21,totalDays||1))).then(function(moreDaySug){
                  if(moreDaySug.length===0)return;
                  setMeals(function(prevMeals){
                    var mergedDayMeals=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreDaySug)));
                    persistMealsSnapshot(mergedDayMeals,mealVotes).catch(function(){return null;});
                    return mergedDayMeals;
                  });
                }).catch(function(){});
                return;
              }
              setMChat(function(p){return p.concat([{from:"agent",text:"Could not refresh real venue suggestions right now. Please try again."}]);});
            }).catch(function(){
              setMChat(function(p){return p.concat([{from:"agent",text:"Could not refresh real venue suggestions right now. Please try again."}]);});
            });
          });
          return;
        }
        setMAL(false);
        setMChat(function(p){return p.concat([{from:"agent",text:"Real venue refresh needs an active saved trip. Open this trip from your account and try again."}]);});
      }

      return(<div>
        {ab("Dining Agent",mealDone?(soloTripMode?"Solo trip detected. Review your day-by-day meal plan, adjust venue choices, then continue. Dietary: "+dietStr+".":"Review your day-by-day meal plan. Local food highlights + selectable real venues are shown for each meal. Dietary: "+dietStr+"."):"Planning day-by-day meals across your destinations...")}
        {!mealDone&&!mealLoad&&(<div>
          <p style={{fontSize:14,color:C.tx2,marginBottom:12}}>The agent builds a day-by-day breakfast/lunch/dinner plan with famous local food cues, then attaches real venue options that fit those choices and your budget.</p>
          {mealErr&&<p style={{fontSize:12,color:C.wrn,marginBottom:10}}>{mealErr}</p>}
          {mealErr&&<button onClick={function(){
            var orderedDests=orderDestinationsByRoutePlan(dests,routePlan);
            setML(true);
            setMealErr("");
            loadGuidanceMealFallback(orderedDests,{},"Manual guidance mode.").then(function(){
              setML(false);
            }).catch(function(){
              setML(false);
              setMealErr("Guidance Mode also failed. Please retry in a moment.");
            });
          }} style={{width:"100%",padding:"12px",marginBottom:8,borderRadius:10,border:"1px solid "+C.border,background:C.surface,color:C.tx2,fontSize:13,fontWeight:700,cursor:"pointer"}}>Use Guidance Mode (Non-Real Venues)</button>}
          {mealErr&&<button onClick={function(){
            var orderedDests=orderDestinationsByRoutePlan(dests,routePlan);
            setML(true);
            setMealErr("");
            loadOpenDataMealFallback(orderedDests,{},"Manual real-data fallback.").then(function(){
              setML(false);
            }).catch(function(){
              setML(false);
              setMealErr("Open-data real venue fallback is unavailable right now. Please retry.");
            });
          }} style={{width:"100%",padding:"12px",marginBottom:8,borderRadius:10,border:"1px solid "+C.teal+"40",background:C.teal+"12",color:C.tealL,fontSize:13,fontWeight:700,cursor:"pointer"}}>Load Real Venue Fallback (Open Data)</button>}
          <button onClick={function(){
          setML(true);
          setMealErr("");
          if(authToken&&activeDiningTripId&&isUuidLike(activeDiningTripId)){
            var orderedDests=orderDestinationsByRoutePlan(dests,routePlan);
            var destCount=orderedDests.length;
            var firstChunk=Math.min(2,Math.max(1,destCount||1));
            var firstPath="/trips/"+activeDiningTripId+"/dining/suggestions"+(destCount>2?("?destination_offset=0&destination_limit="+firstChunk):"");
            fetchDiningApi(firstPath).then(function(r){
              var sug=readDiningSuggestions(r);
              if(sug.length>0){
                var rows=normalizeDiningPlan(buildDiningRowsFromSuggestions(sug));
                setML(false);
                persistMealsSnapshot(rows,{});
                if(destCount>firstChunk){
                  setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first "+firstChunk+" destinations. Fetching the rest in background..."}]);});
                  fetchDiningApi("/trips/"+activeDiningTripId+"/dining/suggestions?destination_offset="+firstChunk).then(function(nextResp){
                    var nextSug=readDiningSuggestions(nextResp);
                    if(nextSug.length>0){
                      var nextRows=normalizeDiningPlan(buildDiningRowsFromSuggestions(nextSug));
                      setMeals(function(prevMeals){
                        var mergedRows=mergeDiningPlanRows(prevMeals,nextRows);
                        persistMealsSnapshot(mergedRows,{}).catch(function(){return null;});
                        return mergedRows;
                      });
                      setMChat(function(p){return p.concat([{from:"agent",text:"Appended meal options for the remaining destinations."}]);});
                    }else{
                      setMChat(function(p){return p.concat([{from:"agent",text:"Could not find additional real venue options for the remaining destinations right now."}]);});
                    }
                  }).catch(function(){
                    setMChat(function(p){return p.concat([{from:"agent",text:"Background fetch for remaining destinations failed. You can still continue with what loaded."}]);});
                  });
                }
                return;
              }
              if(destCount>2){
                fetchDiningApi("/trips/"+activeDiningTripId+"/dining/suggestions").then(function(fallbackResp){
                  var fallbackSug=readDiningSuggestions(fallbackResp);
                  if(fallbackSug.length>0){
                    var fallbackRows=normalizeDiningPlan(buildDiningRowsFromSuggestions(fallbackSug));
                    setML(false);
                    persistMealsSnapshot(fallbackRows,{});
                    setMChat(function(p){return p.concat([{from:"agent",text:"Loaded meal options using full-trip fallback fetch."}]);});
                    return;
                  }
                  fetchDayBasedDiningSuggestions(1,2).then(function(daySug){
                    if(daySug.length>0){
                      var dayRows=normalizeDiningPlan(buildDiningRowsFromSuggestions(daySug));
                      setML(false);
                      persistMealsSnapshot(dayRows,{});
                      setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first fallback meal options quickly. Fetching additional days in background..."}]);});
                      fetchDayBasedDiningSuggestions(3,Math.max(3,Math.min(21,totalDays||1))).then(function(moreDaySug){
                        if(moreDaySug.length===0)return;
                        setMeals(function(prevMeals){
                          var mergedDayMeals=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreDaySug)));
                          persistMealsSnapshot(mergedDayMeals,{}).catch(function(){return null;});
                          return mergedDayMeals;
                        });
                      }).catch(function(){});
                      return;
                    }
                    tryAutoOpenDataFallback(orderedDests,{},"Could not load real venue suggestions yet. Please retry in a moment. Guidance Mode is optional if you still want a meal draft.").then(function(){});
                  }).catch(function(){
                    tryAutoOpenDataFallback(orderedDests,{},"Dining suggestions endpoint is unavailable right now. Retry once backend connectivity is healthy. Guidance Mode is optional if you still want a meal draft.").then(function(){});
                  });
                }).catch(function(){
                  fetchDayBasedDiningSuggestions(1,2).then(function(daySug){
                    if(daySug.length>0){
                      var dayRows=normalizeDiningPlan(buildDiningRowsFromSuggestions(daySug));
                      setML(false);
                      persistMealsSnapshot(dayRows,{});
                      setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first fallback meal options quickly. Fetching additional days in background..."}]);});
                      fetchDayBasedDiningSuggestions(3,Math.max(3,Math.min(21,totalDays||1))).then(function(moreDaySug){
                        if(moreDaySug.length===0)return;
                        setMeals(function(prevMeals){
                          var mergedDayMeals=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreDaySug)));
                          persistMealsSnapshot(mergedDayMeals,{}).catch(function(){return null;});
                          return mergedDayMeals;
                        });
                      }).catch(function(){});
                      return;
                    }
                    tryAutoOpenDataFallback(orderedDests,{},"Dining suggestions endpoint is unavailable right now. Retry once backend connectivity is healthy. Guidance Mode is optional if you still want a meal draft.").then(function(){});
                  }).catch(function(){
                    tryAutoOpenDataFallback(orderedDests,{},"Dining suggestions endpoint is unavailable right now. Retry once backend connectivity is healthy. Guidance Mode is optional if you still want a meal draft.").then(function(){});
                  });
                });
                return;
              }
              tryAutoOpenDataFallback(orderedDests,{},"Could not load real venue suggestions yet. Please retry in a moment.").then(function(){});
            }).catch(function(){
              fetchDayBasedDiningSuggestions(1,2).then(function(daySug){
                if(daySug.length>0){
                  var dayRows=normalizeDiningPlan(buildDiningRowsFromSuggestions(daySug));
                  setML(false);
                  persistMealsSnapshot(dayRows,{});
                  setMChat(function(p){return p.concat([{from:"agent",text:"Loaded first fallback meal options quickly. Fetching additional days in background..."}]);});
                  fetchDayBasedDiningSuggestions(3,Math.max(3,Math.min(21,totalDays||1))).then(function(moreDaySug){
                    if(moreDaySug.length===0)return;
                    setMeals(function(prevMeals){
                      var mergedDayMeals=mergeDiningPlanRows(prevMeals,normalizeDiningPlan(buildDiningRowsFromSuggestions(moreDaySug)));
                      persistMealsSnapshot(mergedDayMeals,{}).catch(function(){return null;});
                      return mergedDayMeals;
                    });
                  }).catch(function(){});
                  return;
                }
                tryAutoOpenDataFallback(orderedDests,{},"Dining suggestions endpoint is unavailable right now. Retry once backend connectivity is healthy. Guidance Mode is optional if you still want a meal draft.").then(function(){});
              }).catch(function(){
                tryAutoOpenDataFallback(orderedDests,{},"Dining suggestions endpoint is unavailable right now. Retry once backend connectivity is healthy. Guidance Mode is optional if you still want a meal draft.").then(function(){});
              });
            });
          }else{
            setML(false);
            setMealErr("Real venue suggestions need an active saved trip. Re-open the trip from your account and retry.");
          }
        }} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>Plan Meals</button></div>)}
        {mealLoad&&(<div style={{textAlign:"center",padding:"30px 0"}}><div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12}}><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div><p style={{fontSize:14,color:C.tx2}}>Finding restaurants across destinations...</p></div>)}
        {mealDone&&meals.length>0&&(<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
            <p style={{fontSize:11,color:C.tx3}}>Debug panel helps compare the shared meal plan, raw votes, and resolved vote summaries on this step.</p>
            <button onClick={function(){setSVD(function(prev){return !prev;});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:showVoteDebug?C.goldDim:C.surface,color:showVoteDebug?C.goldT:C.tx2,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              {showVoteDebug?"Hide Debug":"Show Debug"}
            </button>
          </div>
          {showVoteDebug&&(<div style={{marginBottom:12,padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
            <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:8}}>Dining Debug</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,marginBottom:10}}>
              {[
                {l:"Resolved trip id",v:resolveWizardTripId(currentTripId,newTrip,viewTrip)||"(missing)"},
                {l:"Meal groups",v:String(meals.length)},
                {l:"Vote member count",v:String(voteMembers.length)},
                {l:"Majority needed",v:String(majorityNeeded)},
                {l:"Approved / Pending / Rejected",v:String(approvedMeals.length)+" / "+String(pendingMeals.length)+" / "+String(rejectedMeals.length)},
                {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"(none)"}
              ].map(function(item){
                return(<div key={item.l} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                  <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{item.l}</p>
                  <p style={{fontSize:11,color:"#fff",wordBreak:"break-word"}}>{item.v}</p>
                </div>);
              })}
            </div>
            <div style={{marginBottom:10,padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Vote members</p>
              <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:140,overflowY:"auto"}}>{JSON.stringify(voteMembers||[],null,2)}</pre>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isNarrow?"1fr":"1fr 1fr",gap:8,marginBottom:10}}>
              <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw meal plan</p>
                <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(meals||[],null,2)}</pre>
              </div>
              <div style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Raw meal votes</p>
                <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:180,overflowY:"auto"}}>{JSON.stringify(mealVotes||{},null,2)}</pre>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {meals.map(function(day,di){
                return (day.meals||[]).map(function(m,mi){
                  var rowMeta=readMealVoteRow(mealVotes,day,m,di,mi);
                  var summary=summarizeMealVotes(mealVotes,day,m,di,mi,voteMembers);
                  return(<div key={"meal-debug-"+di+"-"+mi} style={{padding:"8px 10px",borderRadius:10,background:C.surface,border:"1px solid "+C.border}}>
                    <p style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:4}}>{day.locationLabel||day.destination||("Group "+day.day)} {" | "} {m.type||"Meal"} {" | "} {m.name||"Unnamed"}</p>
                    <p style={{fontSize:10,color:C.tx3,marginBottom:6}}>key={rowMeta.key}</p>
                    <p style={{fontSize:10,color:C.tx2,marginBottom:6}}>summary: {summary.up} up / {summary.down} down / {summary.votedCount} voted / allVoted={String(summary.allVoted)} / majority={String(summary.majority)}</p>
                    <pre style={{margin:0,whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:10,color:C.tx2,maxHeight:120,overflowY:"auto"}}>{JSON.stringify({row:summary.row},null,2)}</pre>
                  </div>);
                });
              })}
            </div>
          </div>)}
          {meals.map(function(day,di){
            return(<div key={di} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}><div style={{width:24,height:24,borderRadius:7,background:C.teal+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.tealL}}>{day.day}</div><span style={{fontSize:14,fontWeight:700}}>{day.destination||("Location "+day.day)}</span>{day.date&&<span style={{fontSize:11,color:C.tx3}}>{day.date}</span>}<span style={{fontSize:12,color:C.tx3}}>Breakfast and dinner stay near your stay area. Lunch stays near the main sightseeing stop.</span>{day.stayAnchorLabel&&<span style={{fontSize:10,padding:"4px 8px",borderRadius:999,background:C.surface,color:C.tealL,border:"1px solid "+C.teal+"30"}}>{"Your stay: "+day.stayAnchorLabel}</span>}{day.lunchAnchorLabel&&<span style={{fontSize:10,padding:"4px 8px",borderRadius:999,background:C.surface,color:C.sky,border:"1px solid "+C.sky+"30"}}>{"Sightseeing stop: "+day.lunchAnchorLabel}</span>}</div>
              {(day.meals||[]).map(function(m,mi){var summary=summarizeMealVotes(mealVotes,day,m,di,mi,voteMembers);var st=soloTripMode?"yes":((summary.up>=majorityNeeded&&summary.up>summary.down)?"yes":(summary.votedCount===voteMembers.length&&summary.down>=summary.up?"no":""));var typeCol=m.type==="Breakfast"?C.wrn:m.type==="Lunch"?C.sky:C.coral;
                var opts=Array.isArray(m.options)?m.options:[];
                var selectedOpt=(m.selectedOption!==undefined&&m.selectedOption!==null)?m.selectedOption:0;
                var mealGuidance=isAreaGuidanceMealOption(m,day.destination);
                var anchorRole=normalizeMealAnchorRole(m&&m.anchorRole,m&&m.type);
                var anchorText=mealAnchorBadge(anchorRole,m&&m.anchorLabel);
                var travelText=mealTravelLabel(anchorRole,m&&m.travelMinutes);
                return(<div key={mi} style={{display:"flex",flexDirection:"column",gap:6,padding:"8px 0",borderBottom:mi<(day.meals||[]).length-1?"1px solid "+C.border:"none",opacity:st==="no"?.35:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:6,height:6,borderRadius:999,background:typeCol,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,color:typeCol,fontWeight:600}}>{m.type}</span>
                        {m.time&&<span style={{fontSize:10,color:C.tx3}}>{m.time}</span>}
                        <span style={{fontSize:13,fontWeight:600,textDecoration:st==="no"?"line-through":"none"}}>{m.name}</span>{m.rating && !mealGuidance? <span style={{fontSize:10,color:C.wrn,fontWeight:700}}>{"*"+Number(m.rating).toFixed(1)}</span> : null}
                      </div>
                      {(m.focusDish||m.focusArea||m.focusNote)&&<div style={{display:"flex",gap:8,fontSize:11,color:C.tealL,flexWrap:"wrap"}}>
                        {m.focusDish&&<span>{"Try: "+m.focusDish}</span>}
                        {m.focusArea&&<span>{"Near: "+m.focusArea}</span>}
                        {m.focusNote&&<span style={{fontStyle:"italic"}}>{m.focusNote}</span>}
                      </div>}
                      <div style={{display:"flex",gap:8,fontSize:11,color:C.tx3,flexWrap:"wrap"}}>
                        <span>{anchorText}</span>
                        <span>{m.cuisine}</span>
                        {travelText? <span>{travelText}</span> : null}
                        {m.note&&<span style={{fontStyle:"italic"}}>{"Venue fit: "+m.note}</span>}
                      </div>
                    </div>
                    {!mealGuidance&&<span style={{fontSize:13,fontWeight:600,color:C.goldT,flexShrink:0}}>{"$"+(m.cost||0)}</span>}
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:999,background:st==="yes"?C.grnBg:(st==="no"?C.redBg:C.wrnBg),color:st==="yes"?C.grn:(st==="no"?C.red:C.wrn),flexShrink:0}}>{soloTripMode?"Ready":(st==="yes"?"Approved":(st==="no"?"Rejected":("Voting "+summary.votedCount+"/"+voteMembers.length)))}</span>
                  </div>
                  {opts.length>0&&(<div style={{display:"flex",flexDirection:"column",gap:6,paddingLeft:16}}>
                        {opts.map(function(opt,oi){
                        var picked=selectedOpt===oi;
                        var optGuidance=isAreaGuidanceMealOption(opt,day.destination);
                        var line1=optGuidance?opt.name:(opt.name+" *"+Number(opt.rating||0).toFixed(1)+"  $"+(opt.cost||0));
                        var line2=(opt.cuisine||"Local")+(opt.note?(" - "+opt.note):"");
                        return <button key={oi} onClick={function(e){e.stopPropagation();chooseMealOption(di,mi,oi);}} style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,textAlign:"left",border:"1px solid "+(picked?C.teal:C.border),background:picked?C.teal+"12":C.bg,color:picked?C.tealL:C.tx2,padding:"7px 10px",borderRadius:10,fontSize:11,cursor:"pointer"}}>
                          <span style={{fontWeight:700}}>{line1}</span>
                          {!optGuidance&&<span style={{fontSize:10,color:picked?C.tealL:C.tx3}}>{line2}</span>}
                        </button>;
                      })}
                  </div>)}
                  {!soloTripMode&&(<div style={{display:"flex",flexWrap:"wrap",gap:8,paddingLeft:16}}>
                    {voteMembers.map(function(vm){
                      var v=readVoteForVoter(summary.row,vm);
                      var canEdit=canEditVoteForMember(vm,currentVoteActor,organizerMode);
                      return(<div key={vm.id} style={{display:"flex",alignItems:"center",gap:6}}>
                        <Avi ini={vm.ini} color={vm.color} size={22} name={vm.name}/>
                        <button disabled={!canEdit} onClick={function(e){e.stopPropagation();castMealVote(day,m,di,mi,vm,"up");}} style={{width:26,height:26,borderRadius:8,border:"1px solid "+(v==="up"?C.grn+"55":C.grn+"40"),background:v==="up"?C.grnBg:"transparent",color:C.grn,fontSize:10,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"Up"}</button>
                        <button disabled={!canEdit} onClick={function(e){e.stopPropagation();castMealVote(day,m,di,mi,vm,"down");}} style={{width:26,height:26,borderRadius:8,border:"1px solid "+(v==="down"?C.red+"55":C.red+"40"),background:v==="down"?C.redBg:"transparent",color:C.red,fontSize:10,fontWeight:700,cursor:canEdit?"pointer":"default",opacity:canEdit?1:.5}}>{"Dn"}</button>
                      </div>);
                    })}
                  </div>)}
                </div>);
              })}
            </div>);
          })}
          <div style={{fontSize:12,color:C.tx3,marginBottom:12}}>Showing {meals.length} day-by-day meal plans with local food highlights and selectable venue options.</div>

          {/* Chat for modifications */}
          <div style={{background:C.bg,borderRadius:12,border:"1px solid "+C.border,overflow:"hidden",marginTop:4}}>
            <div style={{padding:"8px 12px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:6}}><div style={{width:18,height:18,borderRadius:999,background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#fff"}}>AI</div><span style={{fontSize:11,fontWeight:600,color:C.tealL}}>Modify meals</span></div>
            {mealChat.length>0&&(<div style={{maxHeight:140,overflowY:"auto",padding:"8px 12px"}}>{mealChat.map(function(msg,i){var isU=msg.from==="user";return(<div key={i} style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",marginBottom:5}}><div style={{maxWidth:"85%",padding:"7px 11px",borderRadius:isU?"10px 10px 3px 10px":"10px 10px 10px 3px",background:isU?C.teal+"20":C.surface,border:"1px solid "+(isU?C.teal+"25":C.border),fontSize:13,lineHeight:1.5,color:isU?"#fff":C.tx2}}>{msg.text}</div></div>);})}{mealAskLoad&&<div style={{display:"flex",gap:4,padding:"4px 0"}}><div style={{width:5,height:5,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:5,height:5,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:5,height:5,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div>}</div>)}
            <div style={{display:"flex",gap:6,padding:"8px 10px",borderTop:mealChat.length>0?"1px solid "+C.border:"none"}}><input value={mealAsk} onChange={function(e){setMA(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")sendMealChat();}} placeholder="'vegan ramen in Kyoto' or 'cheaper dinners'" disabled={mealAskLoad} style={{flex:1,padding:"8px 11px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:12,color:"#fff",opacity:mealAskLoad?.5:1}}/><button onClick={sendMealChat} disabled={mealAskLoad} style={{padding:"7px 12px",borderRadius:8,border:"none",background:mealAskLoad?C.border:C.teal,color:mealAskLoad?C.tx3:"#fff",fontSize:11,fontWeight:600,cursor:mealAskLoad?"default":"pointer"}}>Ask</button></div>
          </div>

          <div style={{marginTop:12}}>
            <div style={{padding:"10px 14px",borderRadius:10,background:allDecided?C.grnBg:(C.gold+"18"),border:allDecided?"1px solid transparent":"1px solid "+C.gold+"35"}}>
              <p style={{fontSize:12,color:allDecided?C.grn:C.goldT}}>
                {soloTripMode?meals.reduce(function(total,day){return total+((day.meals||[]).length||0);},0):approvedMeals.length} meals {soloTripMode?"ready":"approved"}.
                {" "}Est. food cost for sample: ${totalMealCost}
              </p>
              {!allDecided&&mealDone&&<p style={{fontSize:11,color:C.tx2,marginTop:6}}>{soloTripMode?"You can continue after review.":"Some meal votes are still pending, but you can continue and revisit this step later."}</p>}
            </div>
            <button onClick={confirmMealPlanAndContinue} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>{allDecided?"Confirm Meal Plan":"Confirm Meal Plan & Continue"}</button>
          </div>
        </div>)}
        {mealDone&&meals.length===0&&(<div><p style={{fontSize:14,color:C.tx3,padding:"12px 0"}}>No meal plan generated. Describe what you want:</p><div style={{display:"flex",gap:6}}><input value={mealAsk} onChange={function(e){setMA(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")sendMealChat();}} placeholder="e.g. 'plan meals for Kyoto, mostly local food'" style={{flex:1,padding:"9px 12px",borderRadius:8,background:C.surface,border:"1px solid "+C.border,fontSize:13,color:"#fff"}}/><button onClick={sendMealChat} style={{padding:"8px 14px",borderRadius:8,border:"none",background:C.teal,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ask</button></div></div>)}
      </div>);
    }())}

    {wizStep===12&&(function(){
      var accPois=resolveItineraryPoiRows(
        pois.filter(function(p,i){return poiStatus[i]==="yes";}),
        1
      );
      var grpSize=(jc||0)+1;
      var lockedDays=inclusiveIsoDays((availabilityData&&availabilityData.locked_window||{}).start,(availabilityData&&availabilityData.locked_window||{}).end);
      var totalDays=Math.max(3,Number(sharedDurationDays)||Number(lockedDays)||Number(tr&&tr.days)||0);
      if(!(totalDays>0)){
        var fallbackTotal=0;
        dests.forEach(function(d){
          var dd=durPerDest[d.name];
          fallbackTotal+=dd!==undefined?dd:2;
        });
        totalDays=Math.max(fallbackTotal+Math.max(0,dests.length-1)+1,3);
      }
      var pStays=resolveSelectedStaysForDestinations(dests,stays,stayPick,stayFinalChoices);
      var itineraryVoteMembers=[{
        id:currentPlannerId,
        userId:userIdFromToken(authToken),
        email:user.email||""
      }].concat((tm||[]).map(function(m){return {id:makeVoteUserId(m.id,m.email,""),userId:m.id||"",email:m.email||""};}));
      itineraryVoteMembers=dedupeVoteVoters(itineraryVoteMembers);
      var itineraryMajorityNeeded=Math.floor(Math.max(itineraryVoteMembers.length,1)/2)+1;
      var appMeals=resolveMealsForItinerary(meals,mealVotes,itineraryVoteMembers,itineraryMajorityNeeded,soloTripMode);
      var typeIcons={flight:"F",checkin:"C",checkout:"O",activity:"A",meal:"M",travel:"T",rest:"R"};
      var typeColors={flight:C.sky,checkin:C.grn,checkout:C.wrn,activity:C.coral,meal:C.teal,travel:C.purp,rest:"#6366F1"};
      var itineraryStartDate=(availabilityData&&availabilityData.locked_window&&availabilityData.locked_window.start)||flightDates.depart||"";
      var itineraryDurations=fillMissingDurationPerDestination(dests,durPerDest,totalDays);

      return(<div>
        {ab("Itinerary Builder",itinDone?"Your complete day-by-day schedule:":"Building your itinerary from approved activities, stays, and meals...")}
        {itinErr&&<div style={{marginBottom:12,padding:"10px 14px",borderRadius:10,background:C.redBg,border:"1px solid "+C.red+"22"}}><p style={{fontSize:12,color:C.red}}>{itinErr}</p></div>}
        <div style={{marginBottom:12}}>
          <p style={{fontSize:11,color:C.tx3,marginBottom:6}}>Debug panel compares approved POIs, routing anchors, trip days, and the saved itinerary rows.</p>
          <button onClick={function(){setSVD(function(v){return !v;});}} style={{padding:"8px 12px",borderRadius:10,border:"1px solid "+C.goldT+"35",background:C.goldDim,color:C.goldT,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {showVoteDebug?"Hide Debug":"Show Debug"}
          </button>
        </div>
        {showVoteDebug&&<div style={{background:C.surface,borderRadius:16,padding:"18px",border:"1px solid "+C.border,marginBottom:14}}>
          <p style={{fontSize:12,fontWeight:700,color:C.goldT,marginBottom:10}}>Itinerary Debug</p>
          <p style={{fontSize:11,color:C.tx3,marginBottom:10}}>Transit rows are heuristic placeholders right now. They are marked as approximate until live routing is integrated.</p>
          <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:12}}>
            {[
              {l:"Resolved trip id",v:resolveWizardTripId(currentTripId,newTrip,viewTrip)||"--"},
              {l:"Locked / start date",v:String(itineraryStartDate||"Day labels until dates are locked")},
              {l:"Total trip days",v:String(totalDays)},
              {l:"Approved POIs",v:String(accPois.length)},
              {l:"Selected stays",v:String(pStays.length)},
              {l:"Approved meals",v:String(appMeals.length)},
              {l:"Duration per destination",v:JSON.stringify(itineraryDurations||{})},
              {l:"Itinerary rows",v:String((itin||[]).length)},
              {l:"Itinerary quality",v:JSON.stringify(itineraryRowsScore(itin||[],accPois))},
              {l:"Planning updated_at",v:planningStateUpdatedAtRef.current||"--"}
            ].map(function(row){
              return(<div key={row.l} style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
                <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>{row.l}</p>
                <p style={{fontSize:12,color:"#fff",lineHeight:1.5,wordBreak:"break-word"}}>{row.v}</p>
              </div>);
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"repeat(2,minmax(0,1fr))",gap:10}}>
            <div style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Approved POIs</p>
              <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:11,color:"#fff",maxHeight:240,overflow:"auto"}}>{JSON.stringify(accPois,null,2)}</pre>
            </div>
            <div style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border}}>
              <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Selected stays + meals</p>
              <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:11,color:"#fff",maxHeight:240,overflow:"auto"}}>{JSON.stringify({stays:pStays,meals:appMeals},null,2)}</pre>
            </div>
          </div>
          <div style={{padding:"12px 14px",borderRadius:12,background:C.bg,border:"1px solid "+C.border,marginTop:10}}>
            <p style={{fontSize:10,color:C.tx3,marginBottom:4}}>Built itinerary rows</p>
            <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:11,color:"#fff",maxHeight:260,overflow:"auto"}}>{JSON.stringify(itin||[],null,2)}</pre>
          </div>
        </div>}
        {!itinDone&&!itinLoad&&(<div>
          <p style={{fontSize:14,color:C.tx2,marginBottom:10}}>The agent assembles everything into a day-by-day schedule, including travel time between the hotel, meals, and POIs. Exact dates can be locked afterward.</p>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:14}}>
            <div style={{display:"flex",gap:8,fontSize:12,color:C.tx3}}><span style={{color:C.coral}}>{accPois.length} activities</span><span style={{color:C.teal}}>{pStays.length} stays</span><span style={{color:C.grn}}>{appMeals.length} meals</span><span>{dests.length} destinations</span></div>
          </div>
          <button onClick={function(){buildItineraryWithBackend(accPois,pStays,appMeals,totalDays,grpSize,true);}} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,"+C.teal+","+C.sky+")",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>Build Itinerary</button>
        </div>)}
        {itinLoad&&(<div style={{textAlign:"center",padding:"30px 0"}}><div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12}}><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite 0s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .16s"}}/><div style={{width:8,height:8,borderRadius:999,background:C.tealL,animation:"dotPulse 1.2s infinite .32s"}}/></div><p style={{fontSize:14,color:C.tx2}}>Assembling {totalDays}-day itinerary...</p></div>)}
        {itinDone&&itin.length>0&&(<div>
          <button onClick={function(){buildItineraryWithBackend(accPois,pStays,appMeals,totalDays,grpSize,true);}} style={{width:"100%",marginBottom:12,padding:"10px 12px",borderRadius:10,border:"1px solid "+C.teal+"35",background:C.teal+"10",color:C.tealL,fontSize:12,fontWeight:700,cursor:"pointer"}}>Rebuild Itinerary From Current Selections</button>
          {itin.map(function(day,di){var dayCost=(day.items||[]).reduce(function(s,it){return s+(it.cost||0);},0);
            return(<div key={di} style={{marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:8,background:C.teal+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.tealL}}>{day.day}</div>
                  <div><h4 style={{fontWeight:700,fontSize:14}}>{day.date||"Day "+day.day}</h4><p style={{fontSize:11,color:C.tx2}}>{day.destination} - {day.theme}</p></div>
                </div>
                {dayCost>0&&<span style={{fontSize:12,color:C.goldT,fontWeight:600}}>{"$"+dayCost}</span>}
              </div>
              <div style={{paddingLeft:20,borderLeft:"2px solid "+C.teal+"20"}}>
                {(day.items||[]).map(function(item,ii){var tc=typeColors[item.type]||C.tx3;
                  return(<div key={ii} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:ii<(day.items||[]).length-1?8:0,position:"relative"}}>
                    <div style={{position:"absolute",left:-25,top:2,width:12,height:12,borderRadius:999,background:tc,display:"flex",alignItems:"center",justifyContent:"center",fontSize:6,color:"#fff",fontWeight:700}}>{typeIcons[item.type]||"."}</div>
                    <span style={{fontSize:12,color:C.tx3,minWidth:40,flexShrink:0}}>{item.time||""}</span>
                    <span style={{fontSize:13,fontWeight:500,flex:1}}>{item.title}</span>
                    {item.cost>0&&<span style={{fontSize:11,color:C.tx3}}>{"$"+item.cost}</span>}
                  </div>);
                })}
              </div>
            </div>);
          })}
          <div style={{padding:"12px 14px",borderRadius:10,background:C.teal+"08",border:"1px solid "+C.teal+"15",marginTop:8}}>
            <p style={{fontSize:12,color:C.tealL}}>Total trip cost: ${itin.reduce(function(s,d){return s+(d.items||[]).reduce(function(s2,it){return s2+(it.cost||0);},0);},0)} across {itin.length} days</p>
            {!itineraryStartDate&&<p style={{fontSize:11,color:C.tx2,marginTop:4}}>Dates are still placeholders. Availability and flights will lock exact dates after this itinerary is approved.</p>}
          </div>
          <button onClick={saveItineraryThenAdvance} style={{width:"100%",marginTop:16,fontSize:15,fontWeight:600,color:C.bg,padding:"14px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>{itinLoad?"Saving...":"Lock Itinerary & Continue"}</button>
        </div>)}
        {itinDone&&itin.length===0&&(<div><p style={{fontSize:14,color:C.tx3,padding:"20px 0"}}>Could not build itinerary. You may need more activities or meals approved.</p><button onClick={function(){setWizardStepShared(6);}} style={{padding:"10px 18px",borderRadius:10,border:"1px solid "+C.wrn+"30",background:"transparent",color:C.wrn,fontSize:13,fontWeight:600,cursor:"pointer"}}>Back to Activities</button></div>)}
      </div>);
    }())}

    {wizStep===15&&(function(){
      var accPois=resolveItineraryPoiRows(
        pois.filter(function(p,i){return poiStatus[i]==="yes";}),
        1
      );
      var grpSize=(jc||0)+1;
      var pStays=resolveSelectedStaysForDestinations(dests,stays,stayPick,stayFinalChoices);
      var finalVoteMembers=[{
        id:currentPlannerId,
        userId:userIdFromToken(authToken),
        email:user.email||""
      }].concat((tm||[]).map(function(m){return {id:makeVoteUserId(m.id,m.email,""),userId:m.id||"",email:m.email||""};}));
      finalVoteMembers=dedupeVoteVoters(finalVoteMembers);
      var finalMajorityNeeded=Math.floor(Math.max(finalVoteMembers.length,1)/2)+1;
      var appMeals=resolveMealsForItinerary(meals,mealVotes,finalVoteMembers,finalMajorityNeeded,soloTripMode);
      var itineraryActivityCount=0;
      var itineraryMealCount=0;
      (itin||[]).forEach(function(day){
        (day&&day.items||[]).forEach(function(item){
          var t=String(item&&item.type||"").trim().toLowerCase();
          if(t==="activity")itineraryActivityCount+=1;
          if(t==="meal")itineraryMealCount+=1;
        });
      });
      var activityCount=accPois.length>0?accPois.length:itineraryActivityCount;
      var allMealSlots=meals.reduce(function(total,day){return total+((day&&day.meals||[]).length||0);},0);
      var mealCount=appMeals.length;
      if(soloTripMode&&mealCount===0)mealCount=allMealSlots;
      if(mealCount===0&&itineraryMealCount>0)mealCount=itineraryMealCount;
      var lockedWindowForSummary=(availabilityData&&availabilityData.locked_window&&typeof availabilityData.locked_window==="object")?availabilityData.locked_window:null;
      var startDateForSummary=String((lockedWindowForSummary&&lockedWindowForSummary.start)||flightDates.depart||"").slice(0,10);
      var endDateForSummary=String((lockedWindowForSummary&&lockedWindowForSummary.end)||flightDates.ret||"").slice(0,10);
      var computedTripDays=Math.max(1,Number(inclusiveIsoDays(startDateForSummary,endDateForSummary)||itin.length||sharedDurationDays||10));
      var totalItinCost=itin.reduce(function(s,d){return s+(d.items||[]).reduce(function(s2,it){return s2+(it.cost||0);},0);},0);
      var stayTotal=pStays.reduce(function(s,st){return s+(st.ratePerNight||0)*(st.totalNights||3);},0);
      var nextStatus=String((viewTrip&&viewTrip.status)||(newTrip&&newTrip.status)||(tr&&tr.status)||"").trim().toLowerCase();
      var tripActive=nextStatus==="active"||nextStatus==="completed";
      var routeStops=normalizedFlightRoutePlan();
      var routeNames=(routeStops||[]).map(function(stop){return String(stop&&stop.destination||"").trim();}).filter(Boolean);
      var routePreview=(routeNames.length<=6)
        ? routeNames.join(" -> ")
        : (routeNames.slice(0,6).join(" -> ")+" -> ...");
      var tripDateLabel=(startDateForSummary&&endDateForSummary)
        ? (startDateForSummary+" to "+endDateForSummary)
        : "--";
      var tripDaysLabel=computedTripDays;
      var originLabel=String(flightDates.origin||"").trim()||"your origin";
      var finalLabel=String(flightDates.final_airport||flightDates.origin||"").trim()||"your origin";
      var poiHighlights=(accPois.length>0
        ? accPois.map(function(p){return String(p&&p.name||"").trim();}).filter(Boolean)
        : (itin||[]).reduce(function(list,day){
            (day&&day.items||[]).forEach(function(item){
              if(String(item&&item.type||"").trim().toLowerCase()!=="activity")return;
              var title=String(item&&item.title||"").trim();
              if(title)list.push(title);
            });
            return list;
          },[]));
      var stayHighlights=pStays.map(function(s){return String(s&&s.name||"").trim();}).filter(Boolean);
      var mealHighlights=(appMeals.length>0
        ? appMeals.map(function(m){return String(m&&m.name||"").trim();}).filter(Boolean)
        : meals.reduce(function(list,day){
            (day&&day.meals||[]).forEach(function(m){
              var name=String(m&&m.name||"").trim();
              if(name)list.push(name);
            });
            return list;
          },[]));
      var summaryLines=[
        tripDaysLabel+"-day plan for "+grpSize+" traveler"+(grpSize===1?"":"s")+" across "+Math.max(routeNames.length,dests.length)+" destinations ("+tripDateLabel+").",
        "Route: "+(routePreview||dests.map(function(d){return d.name;}).join(" -> ")||"--")+".",
        "Travel: starts from "+originLabel+" and returns to "+finalLabel+"; flights are "+(flightConfirmed?"confirmed":"pending confirmation")+".",
        "Selections so far: "+activityCount+" activities, "+pStays.length+" stays, and "+mealCount+" meals.",
      ];
      if(poiHighlights.length>0)summaryLines.push("Top activity highlights: "+poiHighlights.slice(0,4).join(", ")+".");
      if(stayHighlights.length>0)summaryLines.push("Stay plan: "+stayHighlights.slice(0,3).join(" + ")+".");
      if(mealHighlights.length>0)summaryLines.push("Meal highlights: "+mealHighlights.slice(0,4).join(", ")+".");

      return(<div style={{textAlign:"center",padding:"20px 0"}}>
        <div style={{fontSize:48,marginBottom:16}}>!</div>
        <h2 style={{fontSize:24,fontWeight:700,color:tripActive?C.grn:C.goldT,marginBottom:8}}>{tripActive?"Trip Confirmed!":"Final Review"}</h2>
        <p style={{fontSize:15,color:C.tx2,marginBottom:20}}>{tripActive?("Calendar synced for all "+grpSize+" members. Booking confirmations sent."):("Review the itinerary, locked dates, and flight picks. Confirm when the trip is ready to go live for all "+grpSize+" members.")}</p>
        <div style={{background:C.teal+"12",borderRadius:14,padding:20,textAlign:"left",marginBottom:16,border:"1px solid "+C.teal+"20"}}>
          <h3 style={{fontWeight:700,fontSize:18,marginBottom:12}}>{tr.name||"Your Trip"}</h3>
          {[
            {l:"Destinations",v:dests.map(function(d){return d.name;}).join(" + ")||"--"},
            {l:"Duration",v:tripDaysLabel+" days"},
            {l:"Travelers",v:grpSize+" people"},
            {l:"Activities",v:activityCount+" planned"},
            {l:"Stays",v:pStays.map(function(s){return s.name;}).join(" + ")||"--"},
            {l:"Meals",v:mealCount+" meals planned"},
            {l:"Trip dates",v:tripDateLabel},
            {l:"Flights",v:flightConfirmed?"Confirmed":"Needs confirmation"},
            {l:"Est. Total",v:"$"+(totalItinCost+stayTotal)+"/person"},
          ].map(function(r){return(<div key={r.l} style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:4}}><span style={{color:C.tx3}}>{r.l}</span><span style={{fontWeight:600}}>{r.v}</span></div>);})}
        </div>
        <div style={{background:C.surface,borderRadius:14,padding:16,textAlign:"left",marginBottom:16,border:"1px solid "+C.border}}>
          <h4 style={{fontSize:15,fontWeight:700,color:C.goldT,marginBottom:10}}>Trip Summary</h4>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {summaryLines.map(function(line,idx){
              return <p key={"trip-summary-"+idx} style={{fontSize:13,color:C.tx2,lineHeight:1.5}}>{line}</p>;
            })}
          </div>
        </div>
        {!tripActive&&<button onClick={confirmTripAndActivate} disabled={itinLoad||!flightConfirmed} style={{fontSize:15,fontWeight:600,color:C.bg,padding:"14px 40px",borderRadius:12,background:(itinLoad||!flightConfirmed)?C.border:("linear-gradient(135deg,"+C.gold+","+C.goldT+")"),border:"none",cursor:(itinLoad||!flightConfirmed)?"default":"pointer"}}>
          {itinLoad?"Confirming...":"Confirm Trip"}
        </button>}
        {!tripActive&&!flightConfirmed&&<p style={{fontSize:12,color:C.wrn,marginTop:10}}>Confirm flights before activating the trip.</p>}
        {tripActive&&<button onClick={function(){go("dash");}} style={{fontSize:15,fontWeight:600,color:C.bg,padding:"14px 40px",borderRadius:12,background:"linear-gradient(135deg,"+C.gold+","+C.goldT+")",border:"none",cursor:"pointer"}}>Back to My Trips</button>}
      </div>);
    }())}

    </div></Fade></div>);
  }())}
  </main>
  <div title={BUILD_STAMP_DETAIL} style={{position:"fixed",right:isPhone?10:16,bottom:isPhone?10:16,zIndex:50,pointerEvents:"none"}}>
    <div style={{padding:isPhone?"6px 8px":"7px 10px",borderRadius:999,background:"rgba(8,7,13,0.88)",border:"1px solid "+C.border,boxShadow:"0 12px 28px rgba(0,0,0,0.28)",backdropFilter:"blur(10px)"}}>
      <p style={{fontSize:isPhone?10:11,color:C.tx3,fontWeight:700,letterSpacing:0.2}}>{BUILD_STAMP}</p>
    </div>
  </div>
</div>)}

      </div>
    </div>
  );
}

<<<<<<< copilot/g-14-fix-refresh-button-issue
export { POI_LLM_TIMEOUT_MS, ROUTE_LLM_TIMEOUT_MS, accountCacheKey, activeTripTravelerCount, addClockMinutes, addIsoDays, addTripDestinationValue, availabilityWindowMatchesTripDays, bucketClarifyMessage, bucketQueryAnchorName, bucketQueryNeedsSpecificChildren, buildCurrentVoteActor, buildDestinationFallbackPois, buildDurationPlanSignature, buildFallbackItinerary, buildFlightRoutePlan, buildItinerarySavePayload, buildPOIGroupPrefsFromCrew, buildPoiRequestSignature, buildRoutePlanSignature, buildTransitItem, buildTripShareLink, buildTripShareSummary, buildTripWhatsAppText, buildWhatsAppShareUrl, canEditVoteForMember, canonicalDestinationVoteKeyFromStoredKey, canonicalMealVoteKey, canonicalPoiVoteKeyFromStoredKey, canonicalStayVoteKey, chooseBestItineraryRows, classifyPoiFailureReason, companionCheckinMeta, dedupeVoteVoters, destinationsNeedingPoiCoverage, emptyUserState, estimateTransitMinutes, exactAvailabilityWindows, fillMissingDurationPerDestination, findDuplicatePoiKeys, flightRoutePlanSignature, formatMoney, groundPoiRowsWithRoutePlan, hasAnyNoInPoiSelectionRow, inclusiveIsoDays, isManufacturedPoiName, itineraryRowsScore, isCurrentVoteVoter, makeVoteUserId, materializeItineraryDates, mergeAvailabilityDraft, mergeProfileIntoUser, mergeSharedFlightDates, mergeVoteRows, moveFlightRouteStop, normalizeDestinationVoteState, normalizePersonalBucketItems, normalizePoiStateMap, normalizeRoutePlan, normalizeStays, normalizeTripDestinationValue, normalizeWizardStepIndex, orderDestinationsByRoutePlan, poiListNeedsRefresh, readDestinationVoteRow, readMealVoteRow, readPoiVoteRow, readStayVoteRow, readVoteForVoter, receiptItemsTotal, refineBucketItemsForQuery, removeTripDestinationValue, resolveAvailabilityDraftWindow, resolveBudgetTier, resolvePoiVotingDecision, resolveTripBudgetTier, resolveWizardTripId, roundTripFlightRoutePlan, routePlanDurationMap, sanitizeAvailabilityOverlapData, sanitizeAvailabilityWindow, sanitizeFlightDatesForTrip, shouldAutoGeneratePois, shouldReplaceWithGroundedNearbyPois, shouldSkipPoiAutoGenerate, shouldResetTravelPlanForDurationChange, summarizeDestinationVotes, summarizeInterestConsensus, summarizeMealVotes, summarizePoiVotes, summarizeStayVotes, tripDestinationNamesFromValues, trimPoiErrorDetail, trimRouteErrorDetail, voteKeyAliasesFor, wizardSyncIntervalMs };
=======
export { POI_LLM_TIMEOUT_MS, ROUTE_LLM_TIMEOUT_MS, accountCacheKey, activeTripTravelerCount, addClockMinutes, addIsoDays, addTripDestinationValue, availabilityWindowMatchesTripDays, bucketClarifyMessage, bucketQueryAnchorName, bucketQueryNeedsSpecificChildren, buildCurrentVoteActor, buildDestinationFallbackPois, buildDurationPlanSignature, buildFallbackItinerary, buildFlightRoutePlan, buildItinerarySavePayload, buildPOIGroupPrefsFromCrew, buildPoiRequestSignature, buildRoutePlanSignature, buildTransitItem, buildTripShareLink, buildTripShareSummary, buildTripWhatsAppText, buildWhatsAppShareUrl, canEditVoteForMember, canonicalDestinationVoteKeyFromStoredKey, canonicalMealVoteKey, canonicalPoiVoteKeyFromStoredKey, canonicalStayVoteKey, chooseBestItineraryRows, classifyPoiFailureReason, companionCheckinMeta, dedupeVoteVoters, destinationsNeedingPoiCoverage, emptyUserState, estimateTransitMinutes, exactAvailabilityWindows, fillMissingDurationPerDestination, findDuplicatePoiKeys, flightRoutePlanSignature, formatMoney, groundPoiRowsWithRoutePlan, hasAnyNoInPoiSelectionRow, inclusiveIsoDays, isManufacturedPoiName, itineraryRowsScore, isCurrentVoteVoter, makeVoteUserId, materializeItineraryDates, mergeAvailabilityDraft, mergeBucketItemDetails, mergeProfileIntoUser, mergeSharedFlightDates, mergeVoteRows, moveFlightRouteStop, normalizeDestinationVoteState, normalizePersonalBucketItems, normalizePoiStateMap, normalizeRoutePlan, normalizeStays, normalizeTripDestinationValue, normalizeWizardStepIndex, orderDestinationsByRoutePlan, poiListNeedsRefresh, readDestinationVoteRow, readMealVoteRow, readPoiVoteRow, readStayVoteRow, readVoteForVoter, receiptItemsTotal, refineBucketItemsForQuery, removeTripDestinationValue, resolveAvailabilityDraftWindow, resolveBudgetTier, resolvePoiVotingDecision, resolveTripBudgetTier, resolveWizardTripId, roundTripFlightRoutePlan, routePlanDurationMap, sanitizeAvailabilityOverlapData, sanitizeAvailabilityWindow, sanitizeCrewMembers, sanitizeFlightDatesForTrip, shouldAutoGeneratePois, shouldReplaceWithGroundedNearbyPois, shouldSkipPoiAutoGenerate, shouldResetTravelPlanForDurationChange, shouldTreatBucketItemsAsSameDestination, summarizeDestinationVotes, summarizeInterestConsensus, summarizeMealVotes, summarizePoiVotes, summarizeStayVotes, tripDestinationNamesFromValues, trimPoiErrorDetail, trimRouteErrorDetail, updateUserInterestSelection, voteKeyAliasesFor, wizardSyncIntervalMs };
>>>>>>> main
