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

function countEnabledInterests(interestsObj){
  var safeInterests=(interestsObj&&typeof interestsObj==="object")?interestsObj:{};
  return Object.keys(safeInterests).filter(function(interestKey){
    var interestValue=safeInterests[interestKey];
    if(interestValue===true||interestValue===1||interestValue==="1")return true;
    if(typeof interestValue==="string"){
      var normalized=interestValue.trim().toLowerCase();
      return normalized==="y"||normalized==="yes"||normalized==="true"||normalized==="1";
    }
    return false;
  }).length;
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

function dedupeBucketSuggestionsForExisting(proposedItems, bucketItems){
  var existingByName = {};
  (Array.isArray(bucketItems)?bucketItems:[]).forEach(function(item){
    var key = canonicalTripDestinationName(item&&item.name);
    if(key)existingByName[key] = String(item&&item.name||"").trim()||String(item&&item.destination||"").trim()||"Destination";
  });
  var seen = Object.assign({},existingByName);
  var duplicateMap = {};
  var toAdd = [];
  (Array.isArray(proposedItems)?proposedItems:[]).forEach(function(it){
    var nm = String(it&&it.name||"").trim();
    if(!nm)return;
    var key = canonicalTripDestinationName(nm);
    if(!key)return;
    if(seen[key]){
      if(!duplicateMap[key])duplicateMap[key] = seen[key];
      return;
    }
    seen[key] = nm;
    toAdd.push(it);
  });
  return {
    toAdd:toAdd,
    duplicateNames:Object.keys(duplicateMap).map(function(key){return duplicateMap[key];})
  };}

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
    var existingColor=(existingIdx!==undefined&&out[existingIdx]&&out[existingIdx].color)?out[existingIdx].color:"";
    var candidate={
      id:String(src.id||src.peer_user_id||("m-"+email)).trim()||("m-"+email),
      name:name,
      ini:String(src.ini||"").trim()||iniFromName(name),
      color:src.color||existingColor||CREW_COLORS[(existingIdx!==undefined?existingIdx:out.length)%CREW_COLORS.length],
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
    var merged=Object.assign({},current);
    if(crewStatusRank(candidate.status)>crewStatusRank(current.status)){
      merged.id=candidate.id||merged.id;
      merged.name=candidate.name||merged.name;
      merged.ini=candidate.ini||merged.ini;
      merged.status=candidate.status;
      merged.relation=candidate.relation||merged.relation;
      merged.profile=(candidate.profile&&Object.keys(candidate.profile).length)?candidate.profile:merged.profile;
    }
    if(!merged.name&&candidate.name)merged.name=candidate.name;
    if(!merged.ini&&candidate.ini)merged.ini=candidate.ini;
    merged.color=current.color||candidate.color;
    out[existingIdx]=merged;
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

function tripExpenseLineItems(trip){
  var sourceExpenses=(trip&&Array.isArray(trip.expenses)&&trip.expenses.length)?trip.expenses:(trip&&Array.isArray(trip.recent_expenses)?trip.recent_expenses:[]);
  return sourceExpenses.map(function(item,idx){
    var amount=Number(item&&item.amount||0)||0;
    var merchant=String(item&&item.merchant||item&&item.name||"").trim();
    var category=String(item&&item.category||"").trim();
    var date=String(item&&item.expense_date||item&&item.date||"").trim();
    return {
      id:String(item&&item.id||("expense-"+idx)),
      merchant:merchant||("Expense "+(idx+1)),
      category:category||"misc",
      expense_date:date,
      amount:amount,
      currency:String(item&&item.currency||trip&&trip.currency||"USD").trim().toUpperCase()||"USD"
    };
  }).filter(function(item){
    return item.amount>0;
  });
}

function tripExpenseLineItemsTotal(items){
  return receiptItemsTotal(items);
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

var SPA_HISTORY_SCREEN_KEY="wanderplan_screen";

function historyStateForScreen(screen){
  return {[SPA_HISTORY_SCREEN_KEY]:String(screen||"").trim()||"landing"};
}

function screenFromHistoryState(state){
  if(!state||typeof state!=="object")return "";
  var screen=String(state[SPA_HISTORY_SCREEN_KEY]||"").trim();
  return screen;
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
  var anchor=bucketQueryAnchorName(userMsg);
  if(/\b(?:somewhere|anywhere|ideas?|suggestions?)\b/.test(q)&&anchor){
    return true;
  }
  return /\b(cities|city|towns|town|places|destinations|spots|areas|regions|islands)\b/.test(q) ||
    /\b(popular|top|best|tourist|must-see|recommend|recommended)\b/.test(q);}

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

const BUCKET_REGIONAL_CITY_FALLBACKS = {
  "south america": [
    { name: "Buenos Aires", country: "Argentina" },
    { name: "Cartagena", country: "Colombia" },
    { name: "Cusco", country: "Peru" },
  ],
};

function bucketRegionalFallbackItems(userMsg){
  var scope=bucketQueryAnchorName(userMsg);
  if(!scope)return [];
  var key=canonicalTripDestinationName(scope);
  var seeded=BUCKET_REGIONAL_CITY_FALLBACKS[key];
  if(!Array.isArray(seeded)||seeded.length===0)return [];
  return seeded.map(function(it){
    return {
      name:String(it.name||"").trim(),
      country:String(it.country||"").trim(),
      bestMonths:[4,5,9,10],
      costPerDay:150,
      tags:["Culture","Food"],
      bestTimeDesc:"Shoulder seasons are usually best for weather and crowds.",
      costNote:"Estimated default until preferences refine this."
    };
  }).filter(function(it){return it.name;});}

async function fallbackExtractDestinations(userMsg){
  var regionFallback=bucketRegionalFallbackItems(userMsg);
  if(regionFallback.length>0)return regionFallback;
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
        var regionFallback=bucketRegionalFallbackItems(userMsg);
        if(regionFallback.length)return {type:"destinations",items:regionFallback};
        return {type:"clarify",message:bucketClarifyMessage(userMsg)};
      }
    }
    if(normalized&&normalized.type==="clarify"){
      var clarifySeeds=bucketPreferenceSeedDestinations(userMsg,budget);
      if(clarifySeeds.length)return {type:"destinations",items:clarifySeeds};
    }
    if(normalized)return normalized;
  } catch (e) {}
  var fb=await fallbackExtractDestinations(userMsg);
  var refinedFallback=refineBucketItemsForQuery(userMsg, fb);
  if(refinedFallback.length)return {type:"destinations",items:refinedFallback};
  var preferenceSeeds=bucketPreferenceSeedDestinations(userMsg,budget);
  if(preferenceSeeds.length)return {type:"destinations",items:preferenceSeeds};
  return {type: "clarify", message: bucketClarifyMessage(userMsg)};
}

function destinationTripKey(dest){
  var nm=String(dest&&dest.name||"").trim().toLowerCase();
  var ct=String(dest&&dest.country||"").trim().toLowerCase();
  return nm+"|"+ct;
}

function upsertBucketItemList(list,newItem){
  var incoming=(newItem&&typeof newItem==="object")?newItem:null;
  if(!incoming)return Array.isArray(list)?list.slice():[];
  var incomingId=String(incoming.id||"").trim();
  var incomingDestKey=destinationTripKey(incoming);
  var exists=false;
  var out=(Array.isArray(list)?list:[]).map(function(item){
    var itemId=String(item&&item.id||"").trim();
    var sameId=!!incomingId&&itemId===incomingId;
    var sameDestination=!!incomingDestKey&&destinationTripKey(item)===incomingDestKey;
    if(!sameId&&!sameDestination)return item;
    exists=true;
    var merged=Object.assign({},item,incoming);
    if(itemId)merged.id=itemId;
    else if(incomingId)merged.id=incomingId;
    return merged;
  });
  if(!exists)out.push(incoming);
  return out;
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
  var[mobileNavOpen,setMobileNavOpen]=useState(false);
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
  var historyBootstrappedRef=useRef(false);
  var restoringFromBrowserHistoryRef=useRef(false);
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
        await hydrateSignedInSession(tok,{baseUser:u||Object.assign(emptyUserState(),{email:accountEmail}),cachedTrips:t});
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
    function onPopState(ev){
      var nextScreen=screenFromHistoryState(ev&&ev.state);
      if(!nextScreen)return;
      restoringFromBrowserHistoryRef.current=true;
      setSc(nextScreen);
    }
    window.addEventListener("popstate",onPopState);
    return function(){window.removeEventListener("popstate",onPopState);};
  },[]);
  useEffect(function(){
    if(typeof window==="undefined")return;
    var nextState=historyStateForScreen(sc);
    if(!historyBootstrappedRef.current){
      window.history.replaceState(nextState,"",window.location.href);
      historyBootstrappedRef.current=true;
      restoringFromBrowserHistoryRef.current=false;
      return;
    }
    if(restoringFromBrowserHistoryRef.current){
      restoringFromBrowserHistoryRef.current=false;
      return;
    }
    window.history.pushState(nextState,"",window.location.href);
  },[sc]);
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

  function go(s){setMobileNavOpen(false);setFade(true);setTimeout(function(){setHist(function(h){return h.concat([sc]);});setSc(s);setFade(false);},200);}  function deleteTripWithConfirmation(trip){
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
          spent:0,
          expenses:Array.isArray(t.expenses)?t.expenses:[],
          recent_expenses:Array.isArray(t.recent_expenses)?t.recent_expenses:[],
          currency:String(t&&t.expense_summary&&t.expense_summary.currency||"USD").trim().toUpperCase()||"USD"
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
            spent:Number(p.spent||0)||0,
            expenses:(Array.isArray(t.expenses)&&t.expenses.length)?t.expenses:(Array.isArray(p.expenses)?p.expenses:[]),
            recent_expenses:(Array.isArray(t.recent_expenses)&&t.recent_expenses.length)?t.recent_expenses:(Array.isArray(p.recent_expenses)?p.recent_expenses:[]),
            currency:t.currency||p.currency||"USD"
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
    setTrips(Array.isArray(o.cachedTrips)?o.cachedTrips:[]);
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
    if(!silent){
      setCompanionLoad(true);
      setCompanionErr("");
    }
    return apiJson("/trips/"+tripId+"/companion",{method:"GET"},authToken).then(function(res){
      setCompanionData((res&&res.companion)||null);
      if(!silent)setCompanionLoad(false);
      refreshCurrentTripSharedState(authToken,tripId).catch(function(){});
      return (res&&res.companion)||null;
    }).catch(function(e){
      if(!silent){
        setCompanionLoad(false);
        setCompanionErr(String(e&&e.message||"Could not load live companion"));
      }
      throw e;
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
    setBucket(function(p){return upsertBucketItemList(p,newItem);});
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
        var split=dedupeBucketSuggestionsForExisting(proposed,bucket);
        var duplicateNames=split.duplicateNames;
        var toAdd=split.toAdd.map(function(it,i){
          var nm=String(it&&it.name||"").trim();
          var ct=String(it&&it.country||"").trim();
          return {            id:"d"+Date.now()+"-"+i,
            name:nm,
            country:ct,
            bestMonths:Array.isArray(it&&it.bestMonths)?it.bestMonths:[],
            costPerDay:Number(it&&it.costPerDay||0)||0,
            tags:Array.isArray(it&&it.tags)?it.tags:[],
            bestTimeDesc:String(it&&it.bestTimeDesc||""),
            costNote:String(it&&it.costNote||"")
          };
        });
        if(!toAdd.length){
          var duplicateMsg=duplicateNames.length===1
            ? (duplicateNames[0]+" is already in your bucket list.")
            : (duplicateNames.join(", ")+" are already in your bucket list.");
          setBC(function(p){return p.concat([{from:"agent",text:duplicateMsg+" Pick destinations from Bucket List cards when you start planning a trip.",suggestions:proposed}]);});
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
            var names=toAdd.map(function(d){return d.name;}).join(", ");
            var duplicateNote=duplicateNames.length===0?"":(" "+(duplicateNames.length===1
              ? (duplicateNames[0]+" is already in your bucket list.")
              : (duplicateNames.join(", ")+" are already in your bucket list.")));
            setBC(function(p){return p.concat([{from:"agent",text:"Added "+names+" to your bucket list."+duplicateNote+" Destinations become part of planning only after you pick them in Plan a New Trip.",suggestions:proposed}]);});>>>>>>> main
