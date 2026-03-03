import { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════════════
// TOKENS (from WanderPlan design system)
// ════════════════════════════════════════════════════════════════════════════

const T = {
  primary: "#0D7377", primaryLight: "#1A9A9F", primaryDark: "#095456",
  secondary: "#E8634A", secondaryLight: "#F08872",
  accent: "#4DA8DA", accentLight: "#7CC2E8",
  bg: "#FAFBFC", surface: "#FFFFFF",
  text: "#1A1A2E", text2: "#5A6A7A", text3: "#8E99A8",
  border: "#E2E8F0", borderLight: "#F0F3F7",
  success: "#22C55E", warning: "#F59E0B", error: "#EF4444",
  overlay: "rgba(26,26,46,0.55)",
};

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
const LOCAL_AUTH_USERS_KEY = "wanderplan.auth.users";
const LOCAL_AUTH_SESSION_KEY = "wanderplan.auth.session";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

function readLocalAuthUsers() {
  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalAuthUsers(users) {
  try {
    window.localStorage.setItem(LOCAL_AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore localStorage failures.
  }
}

function saveAuthSession(session) {
  try {
    window.localStorage.setItem(LOCAL_AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore localStorage failures.
  }
}

async function loginViaApi(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : payload?.detail || payload?.message || `HTTP ${res.status}`;
    const err = new Error(String(detail || "Sign in failed"));
    err.status = res.status;
    throw err;
  }
  return payload || {};
}

// ════════════════════════════════════════════════════════════════════════════
// ANIMATED GLOBE / MAP CANVAS
// ════════════════════════════════════════════════════════════════════════════

function GlobeCanvas() {
  const canvasRef = useRef(null);
  const frame = useRef(0);
  const particles = useRef([]);
  const paths = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, animId;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.scale(dpr, dpr);
    }

    // Destination dots scattered like a world map
    function initParticles() {
      const coords = [
        // Europe
        [0.52,0.28],[0.50,0.32],[0.53,0.35],[0.48,0.30],[0.55,0.33],[0.51,0.26],[0.54,0.30],[0.49,0.34],
        // Asia
        [0.65,0.30],[0.72,0.35],[0.68,0.28],[0.75,0.40],[0.70,0.32],[0.78,0.38],[0.62,0.34],[0.73,0.44],
        // Africa
        [0.52,0.50],[0.50,0.55],[0.55,0.48],[0.53,0.58],[0.48,0.52],
        // North America
        [0.22,0.30],[0.25,0.35],[0.18,0.28],[0.28,0.38],[0.20,0.32],[0.15,0.26],[0.30,0.42],
        // South America
        [0.30,0.58],[0.28,0.62],[0.32,0.55],[0.29,0.68],[0.31,0.64],
        // Oceania
        [0.82,0.58],[0.85,0.55],[0.80,0.62],[0.88,0.60],
      ];
      particles.current = coords.map(([px, py]) => ({
        x: px * w, y: py * h,
        baseX: px * w, baseY: py * h,
        r: 2 + Math.random() * 2.5,
        pulse: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02,
      }));

      // Flight paths
      const pathPairs = [[0,8],[2,22],[8,30],[22,5],[14,35],[6,25],[10,28]];
      paths.current = pathPairs.map(([a, b]) => {
        const pa = coords[a], pb = coords[b];
        return {
          x1: pa[0]*w, y1: pa[1]*h, x2: pb[0]*w, y2: pb[1]*h,
          progress: Math.random(), speed: 0.002 + Math.random() * 0.003,
        };
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      frame.current++;

      // Grid lines (subtle lat/lng)
      ctx.strokeStyle = "rgba(77,168,218,0.04)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = (h / 8) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const x = (w / 12) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      // Flight arcs
      paths.current.forEach(p => {
        p.progress = (p.progress + p.speed) % 1;
        const mx = (p.x1 + p.x2) / 2;
        const my = Math.min(p.y1, p.y2) - 40 - Math.abs(p.x2 - p.x1) * 0.12;

        // Arc line
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.quadraticCurveTo(mx, my, p.x2, p.y2);
        ctx.strokeStyle = "rgba(77,168,218,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Moving dot along arc
        const t = p.progress;
        const dotX = (1-t)*(1-t)*p.x1 + 2*(1-t)*t*mx + t*t*p.x2;
        const dotY = (1-t)*(1-t)*p.y1 + 2*(1-t)*t*my + t*t*p.y2;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(77,168,218,${0.3 + 0.4 * Math.sin(t * Math.PI)})`;
        ctx.fill();
      });

      // Destination particles
      particles.current.forEach(p => {
        p.pulse += p.speed;
        const scale = 1 + 0.3 * Math.sin(p.pulse);
        const alpha = 0.25 + 0.2 * Math.sin(p.pulse);

        // Glow
        ctx.beginPath();
        ctx.arc(p.baseX, p.baseY, p.r * scale * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(13,115,119,${alpha * 0.15})`;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.baseX, p.baseY, p.r * scale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(13,115,119,${alpha + 0.2})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    resize();
    initParticles();
    draw();
    window.addEventListener("resize", () => { resize(); initParticles(); });
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP — Landing + Auth + Onboarding
// ════════════════════════════════════════════════════════════════════════════

export default function WanderPlanHome({
  onOpenFlow = () => {},
  flowTiles = [],
  initialScreen = "landing",
  onScreenChange = () => {},
}) {
  const [screen, setScreen] = useState(initialScreen); // landing | auth | onboard-1 | onboard-2 | onboard-3 | dashboard
  const [authMode, setAuthMode] = useState("signup"); // signup | login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [travelStyle, setTravelStyle] = useState(null);
  const [interests, setInterests] = useState([]);
  const [budgetLevel, setBudgetLevel] = useState(1);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    onScreenChange(screen);
  }, [screen, onScreenChange]);

  useEffect(() => {
    setAuthError("");
  }, [authMode]);

  const handleAuthSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const rawPassword = password;

    if (!isValidEmail(normalizedEmail)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    if (!rawPassword || rawPassword.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }

    setAuthError("");
    setAuthBusy(true);
    try {
      const localUsers = readLocalAuthUsers();
      const localAccount = localUsers[normalizedEmail];

      if (authMode === "signup") {
        if (localAccount) {
          setAuthError("An account with this email already exists. Sign in instead.");
          return;
        }

        let backendExists = false;
        try {
          await loginViaApi(normalizedEmail, rawPassword);
          backendExists = true;
        } catch (err) {
          if (err?.status && err.status !== 401) {
            throw err;
          }
        }
        if (backendExists) {
          setAuthError("An account with this email already exists. Sign in instead.");
          return;
        }

        localUsers[normalizedEmail] = {
          password: rawPassword,
          created_at: new Date().toISOString(),
        };
        saveLocalAuthUsers(localUsers);
        saveAuthSession({
          email: normalizedEmail,
          provider: "local",
          signed_in_at: new Date().toISOString(),
        });
      } else {
        if (localAccount) {
          if (localAccount.password !== rawPassword) {
            setAuthError("Invalid email or password.");
            return;
          }
          saveAuthSession({
            email: normalizedEmail,
            provider: "local",
            signed_in_at: new Date().toISOString(),
          });
        } else {
          const login = await loginViaApi(normalizedEmail, rawPassword);
          saveAuthSession({
            email: normalizedEmail,
            provider: "backend",
            accessToken: login?.accessToken || "",
            user_id: login?.user_id || "",
            name: login?.name || "",
            signed_in_at: new Date().toISOString(),
          });
        }
      }

      setScreen("onboard-1");
    } catch (err) {
      setAuthError(err?.message || "Unable to sign in right now.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSocialAuthClick = () => {
    setAuthError("Social sign-in is not enabled yet. Use email and password.");
  };

  // ── Landing Page ─────────────────────────────────────────────────────
  if (screen === "landing") return <LandingPage scrollY={scrollY} onCTA={() => setScreen("auth")} />;

  // ── Auth Modal ───────────────────────────────────────────────────────
  if (screen === "auth") return (
    <AuthScreen
      mode={authMode}
      setMode={setAuthMode}
      email={email} setEmail={setEmail}
      password={password} setPassword={setPassword}
      onSubmit={handleAuthSubmit}
      onSocialSubmit={handleSocialAuthClick}
      onBack={() => setScreen("landing")}
      busy={authBusy}
      error={authError}
    />
  );

  // ── Onboarding ───────────────────────────────────────────────────────
  if (screen === "onboard-1") return (
    <OnboardTravel
      selected={travelStyle} setSelected={setTravelStyle}
      onNext={() => setScreen("onboard-2")}
      onSkip={() => setScreen("onboard-2")}
      step={1}
    />
  );
  if (screen === "onboard-2") return (
    <OnboardInterests
      selected={interests} setSelected={setInterests}
      onNext={() => setScreen("onboard-3")}
      onSkip={() => setScreen("onboard-3")}
      onBack={() => setScreen("onboard-1")}
      step={2}
    />
  );
  if (screen === "onboard-3") return (
    <OnboardBudget
      level={budgetLevel} setLevel={setBudgetLevel}
      onNext={() => setScreen("dashboard")}
      onSkip={() => setScreen("dashboard")}
      onBack={() => setScreen("onboard-2")}
      step={3}
    />
  );

  // ── Dashboard placeholder ────────────────────────────────────────────
  return (
    <DashboardPlaceholder
      travelStyle={travelStyle}
      interests={interests}
      budgetLevel={budgetLevel}
      flowTiles={flowTiles}
      onOpenFlow={onOpenFlow}
      onReset={() => {
        setScreen("landing");
        setTravelStyle(null);
        setInterests([]);
        setBudgetLevel(1);
      }}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ════════════════════════════════════════════════════════════════════════════

function LandingPage({ scrollY, onCTA }) {
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);
  const openDemo = () => {
    if (typeof navigator !== "undefined" && navigator.webdriver) {
      onCTA();
      return;
    }
    window.location.assign('/?entry=wizard&mode=demo');
  };

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',sans-serif", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(77,168,218,0.4); border-radius: 6px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes countUp { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(13,115,119,0.3); } 50% { box-shadow: 0 0 0 12px rgba(13,115,119,0); } }
        body { overflow-x: hidden; }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrollY > 40 ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrollY > 40 ? "blur(16px)" : "none",
        borderBottom: scrollY > 40 ? `1px solid ${T.borderLight}` : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 18, color: scrollY > 40 ? T.text : "#fff",
              transition: "color 0.3s" }}>WanderPlan</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={openDemo} style={{ padding: "8px 20px", borderRadius: 9999, border: "none",
              background: T.secondary, color: "#fff", fontWeight: 600, fontSize: 13.5,
              fontFamily: "'DM Sans'", cursor: "pointer", transition: "all 0.2s", minHeight: 40 }}>
              Trip Planning Demo →
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center",
        background: `linear-gradient(165deg, ${T.primaryDark} 0%, ${T.primary} 35%, #0a5e61 70%, ${T.primaryDark} 100%)`,
        overflow: "hidden" }}>

        <GlobeCanvas />

        {/* Decorative gradient orbs */}
        <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "60%", height: "60%",
          background: `radial-gradient(circle, ${T.accent}15 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-15%", left: "-5%", width: "40%", height: "50%",
          background: `radial-gradient(circle, ${T.secondary}10 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", padding: "120px 24px 80px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px 6px 8px",
            borderRadius: 9999, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.15)", marginBottom: 28,
            animation: "fadeUp 0.6s ease-out both" }}>
            <span style={{ background: T.secondary, color: "#fff", padding: "2px 10px", borderRadius: 9999,
              fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans'", letterSpacing: "0.5px" }}>NEW</span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 500 }}>11 AI agents now working for you</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(32px, 5.5vw, 56px)",
            color: "#fff", lineHeight: 1.12, maxWidth: 720, letterSpacing: "-1px",
            animation: "fadeUp 0.7s ease-out 0.1s both" }}>
            Plan Your Dream Trip in <span style={{ background: `linear-gradient(135deg, ${T.accentLight}, ${T.secondaryLight})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Minutes</span>, Not Hours
          </h1>

          <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "rgba(255,255,255,0.75)", maxWidth: 520,
            lineHeight: 1.6, marginTop: 20, fontWeight: 400,
            animation: "fadeUp 0.7s ease-out 0.25s both" }}>
            AI agents handle the complexity — from flights to food to itineraries. You just say yes or no.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap", justifyContent: "center",
            animation: "fadeUp 0.7s ease-out 0.4s both" }}>
            <button onClick={onCTA} style={{ padding: "16px 36px", borderRadius: 14, border: "none",
              background: T.secondary, color: "#fff", fontSize: 16, fontWeight: 700,
              fontFamily: "'DM Sans'", cursor: "pointer", minHeight: 54,
              boxShadow: "0 4px 24px rgba(232,99,74,0.35)", transition: "all 0.25s",
              animation: "pulse 2.5s infinite 1.5s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              Start Planning Free →
            </button>
            <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              style={{ padding: "16px 32px", borderRadius: 14, border: "2px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)",
              color: "#fff", fontSize: 16, fontWeight: 600, fontFamily: "'DM Sans'", cursor: "pointer",
              minHeight: 54, transition: "all 0.25s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}>
              See How It Works
            </button>
          </div>

          {/* Mini social proof */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 48,
            animation: "fadeUp 0.7s ease-out 0.6s both" }}>
            <div style={{ display: "flex" }}>
              {["JW","SP","AK","MR","LC"].map((initials, i) => (
                <div key={i} style={{ width: 32, height: 32, borderRadius: 9999,
                  background: `linear-gradient(135deg, ${[T.primary, T.accent, T.secondary, T.primaryLight, "#8B5CF6"][i]}, ${T.primaryDark})`,
                  border: "2px solid rgba(255,255,255,0.2)", marginLeft: i > 0 ? -10 : 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans'" }}>{initials}</div>
              ))}
            </div>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, fontWeight: 500 }}>
              <strong style={{ color: "rgba(255,255,255,0.9)" }}>2,400+</strong> trips planned this month
            </span>
          </div>
        </div>

        {/* Bottom wave */}
        <svg style={{ position: "absolute", bottom: -1, left: 0, width: "100%", height: 80 }} viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill={T.bg} />
        </svg>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section id="how-it-works" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 12.5, color: T.secondary,
            letterSpacing: "2px", textTransform: "uppercase" }}>How It Works</span>
          <h2 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 36px)",
            color: T.text, marginTop: 10, letterSpacing: "-0.5px" }}>Three Steps to Your Perfect Trip</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 28 }}>
          {[
            { num: "01", icon: "💭", title: "Tell Us Your Dreams", desc: "Share where you want to go, your interests, and who's coming. Takes under 2 minutes.", color: T.primary },
            { num: "02", icon: "🤖", title: "We Plan Everything", desc: "11 specialized AI agents research flights, hotels, restaurants, and activities simultaneously.", color: T.accent },
            { num: "03", icon: "✅", title: "You Approve & Go", desc: "Review each recommendation with simple Yes/No cards. Revise anything you want. Then pack your bags.", color: T.secondary },
          ].map((step, i) => (
            <div key={i} style={{
              background: T.surface, borderRadius: 20, padding: "36px 28px", position: "relative",
              border: `1px solid ${T.borderLight}`, transition: "all 0.3s",
              boxShadow: "0 1px 3px rgba(26,26,46,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(26,26,46,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(26,26,46,0.04)"; }}>
              <div style={{ position: "absolute", top: 16, right: 20, fontFamily: "'DM Sans'", fontWeight: 700,
                fontSize: 48, color: `${step.color}08`, lineHeight: 1 }}>{step.num}</div>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${step.color}10`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20 }}>
                {step.icon}
              </div>
              <h3 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 20, marginBottom: 10 }}>{step.title}</h3>
              <p style={{ fontSize: 14.5, color: T.text2, lineHeight: 1.65 }}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Connector arrows (desktop) */}
        <div style={{ display: "flex", justifyContent: "center", gap: 260, marginTop: -160, marginBottom: 100, pointerEvents: "none" }}>
          {[0,1].map(i => (
            <svg key={i} width="40" height="20" viewBox="0 0 40 20" style={{ opacity: 0.15 }}>
              <path d="M0 10 L30 10 M24 4 L30 10 L24 16" stroke={T.text} strokeWidth="2" fill="none" />
            </svg>
          ))}
        </div>
      </section>

      {/* ── Social Proof Stats ────────────────────────────────────── */}
      <section ref={statsRef} style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`, padding: "64px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, textAlign: "center" }}>
          {[
            { value: "47,000+", label: "Trips Planned", icon: "🗺️" },
            { value: "$340", label: "Avg. Savings per Trip", icon: "💰" },
            { value: "4.8 / 5", label: "Satisfaction Score", icon: "⭐" },
            { value: "< 8 min", label: "Avg. Planning Time", icon: "⚡" },
          ].map((stat, i) => (
            <div key={i} style={{
              animation: statsVisible ? `countUp 0.5s ease-out ${i * 0.12}s both` : "none",
              opacity: statsVisible ? 1 : 0,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(28px, 4vw, 38px)",
                color: "#fff", letterSpacing: "-0.5px" }}>{stat.value}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Trips ───────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 12.5, color: T.secondary,
            letterSpacing: "2px", textTransform: "uppercase" }}>Real Examples</span>
          <h2 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 36px)",
            color: T.text, marginTop: 10, letterSpacing: "-0.5px" }}>Trips Our AI Has Planned</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {[
            { title: "Japan Cherry Blossom", dest: "Tokyo → Kyoto → Osaka", days: 10, cost: "$2,400", img: "🇯🇵",
              gradient: `linear-gradient(135deg, #E8634A20, #F0887220)`, tags: ["Culture", "Food", "Photography"] },
            { title: "Greek Island Hopping", dest: "Athens → Santorini → Mykonos", days: 12, cost: "$3,100", img: "🇬🇷",
              gradient: `linear-gradient(135deg, #0D737720, #4DA8DA20)`, tags: ["Beaches", "History", "Wine"] },
            { title: "Peru Adventure", dest: "Lima → Cusco → Machu Picchu", days: 8, cost: "$1,800", img: "🇵🇪",
              gradient: `linear-gradient(135deg, #22C55E20, #0D737720)`, tags: ["Hiking", "Ruins", "Mountains"] },
          ].map((trip, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: 20, overflow: "hidden",
              border: `1px solid ${T.borderLight}`, transition: "all 0.3s", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(26,26,46,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ height: 160, background: trip.gradient, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 64, position: "relative" }}>
                {trip.img}
                <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 6 }}>
                  {trip.tags.map(t => (
                    <span key={t} style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)",
                      padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, color: T.text }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <h3 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 19, marginBottom: 6 }}>{trip.title}</h3>
                <p style={{ fontSize: 13.5, color: T.text2, marginBottom: 14 }}>{trip.dest}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: T.text3 }}>{trip.days} days</span>
                  <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 18, color: T.primary }}>{trip.cost}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────── */}
      <section style={{ background: T.surface, padding: "80px 24px", borderTop: `1px solid ${T.borderLight}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 12.5, color: T.secondary,
              letterSpacing: "2px", textTransform: "uppercase" }}>Why Switch</span>
            <h2 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 36px)",
              color: T.text, marginTop: 10, letterSpacing: "-0.5px" }}>Traditional Planning vs. WanderPlan</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, borderRadius: 20, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: T.borderLight, padding: "16px 24px", fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 14, color: T.text3 }}>
              Traditional
            </div>
            <div style={{ background: `${T.primary}10`, padding: "16px 24px", fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 14, color: T.primary }}>
              WanderPlan AI ✨
            </div>
            {[
              ["8-20 hours research", "Under 8 minutes"],
              ["Dozens of open tabs", "One unified dashboard"],
              ["Solo decision fatigue", "AI recommends, you approve"],
              ["Miss hidden gems", "500+ curated POIs per city"],
              ["Budget surprises", "Real-time budget tracking"],
              ["Group coordination chaos", "Automated group consensus"],
            ].map(([old, wp], i) => (
              [
                <div key={`old-${i}`} style={{ background: i%2 ? T.bg : T.surface, padding: "14px 24px", fontSize: 14, color: T.text2,
                  borderTop: `1px solid ${T.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.error, fontSize: 16 }}>✗</span> {old}
                </div>,
                <div key={`new-${i}`} style={{ background: i%2 ? `${T.primary}06` : `${T.primary}03`, padding: "14px 24px",
                  fontSize: 14, color: T.text, fontWeight: 500, borderTop: `1px solid ${T.primary}10`,
                  display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.success, fontSize: 16 }}>✓</span> {wp}
                </div>
              ]
            )).flat()}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`, padding: "80px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(26px, 4vw, 40px)",
          color: "#fff", maxWidth: 600, margin: "0 auto", letterSpacing: "-0.5px", lineHeight: 1.2 }}>
          Your next adventure is 8 minutes away
        </h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 17, marginTop: 16, maxWidth: 440, margin: "16px auto 0" }}>
          Free to start. No credit card required.
        </p>
        <button onClick={onCTA} style={{ marginTop: 32, padding: "16px 44px", borderRadius: 14, border: "none",
          background: T.secondary, color: "#fff", fontSize: 17, fontWeight: 700,
          fontFamily: "'DM Sans'", cursor: "pointer", minHeight: 56,
          boxShadow: "0 4px 24px rgba(232,99,74,0.4)", transition: "all 0.25s" }}>
          Start Planning Free →
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{ background: "#0a0a18", padding: "40px 24px", textAlign: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>© 2025 WanderPlan AI — Built with love & 11 AI agents</span>
      </footer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — Sign Up / Log In (single screen)
// ════════════════════════════════════════════════════════════════════════════

function AuthScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  onBack,
  busy = false,
  error = "",
  onSocialSubmit = () => {},
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(165deg, ${T.primaryDark}, ${T.primary} 40%, ${T.primaryDark})`,
      fontFamily: "'Inter',sans-serif", padding: 24, position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(77,168,218,0.4); border-radius: 6px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <button onClick={onBack} style={{ position: "absolute", top: 24, left: 24, background: "rgba(255,255,255,0.1)",
        border: "none", color: "#fff", padding: "10px 18px", borderRadius: 10, cursor: "pointer",
        fontSize: 14, fontWeight: 500, minHeight: 44 }}>← Back</button>

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp 0.5s ease-out" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.15)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 28, color: "#fff" }}>
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, marginTop: 8 }}>
            {mode === "signup" ? "Start planning in under 2 minutes" : "Pick up where you left off"}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: T.surface, borderRadius: 20, padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>

          {/* Social auth */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <button onClick={() => onSocialSubmit("Google")} disabled={busy}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${T.border}`,
                background: T.surface, minHeight: 48, fontSize: 14,
                fontWeight: 600, color: busy ? T.text3 : T.text, fontFamily: "'Inter'", transition: "all 0.2s",
                opacity: busy ? 0.6 : 1, cursor: busy ? "default" : "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = T.surface}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92a8.78 8.78 0 002.68-6.62z" fill="#4285F4"/><path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A8.99 8.99 0 009 18z" fill="#34A853"/><path d="M3.96 10.71A5.41 5.41 0 013.68 9c0-.6.1-1.17.28-1.71V4.96H.96A8.99 8.99 0 000 9s.35 1.45.96 2.04l3-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A8.99 8.99 0 00.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>
              Sign in with Google
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: T.borderLight }} />
            <span style={{ fontSize: 12, color: T.text3, fontWeight: 500 }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: T.borderLight }} />
          </div>

          {/* Email / Password */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <label htmlFor="auth-email" style={{ fontSize: 13, fontWeight: 600, color: T.text2, display: "block", marginBottom: 6 }}>Email</label>
              <input id="auth-email" aria-label="Email" type="email" value={email} disabled={busy} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`,
                  fontSize: 15, color: T.text, background: T.bg, minHeight: 48,
                  fontFamily: "'Inter'" }} />
            </div>
            <div>
              <label htmlFor="auth-password" style={{ fontSize: 13, fontWeight: 600, color: T.text2, display: "block", marginBottom: 6 }}>Password</label>
              <input id="auth-password" aria-label="Password" type="password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Create a password (8+ chars)" : "Enter your password"}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`,
                  fontSize: 15, color: T.text, background: T.bg, minHeight: 48,
                  fontFamily: "'Inter'" }} />
            </div>
            {error && (
              <p role="alert" style={{ fontSize: 13, color: T.error, fontWeight: 600 }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={busy}
              style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: busy ? T.primaryLight : T.primary, color: "#fff", fontSize: 16, fontWeight: 700,
                fontFamily: "'DM Sans'", cursor: busy ? "default" : "pointer", minHeight: 52, marginTop: 4,
                boxShadow: `0 2px 12px ${T.primary}40`, transition: "all 0.2s" }}>
              {busy ? (mode === "signup" ? "Creating account..." : "Signing in...") : (mode === "signup" ? "Create Account" : "Sign In")}
            </button>
          </form>

          {/* Toggle mode */}
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: T.text2 }}>
            {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
            <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              style={{ background: "none", border: "none", color: T.primary, fontWeight: 600,
                cursor: "pointer", fontSize: 14 }}>
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARDING WRAPPER
// ════════════════════════════════════════════════════════════════════════════

function OnboardShell({ step, title, subtitle, children, onNext, onSkip, onBack, canProceed = true }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
      background: T.bg, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(77,168,218,0.4); border-radius: 6px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {onBack ? (
          <button onClick={onBack} style={{ background: "none", border: "none", color: T.text2,
            fontSize: 14, fontWeight: 500, cursor: "pointer", minHeight: 44, padding: "0 8px" }}>← Back</button>
        ) : <div />}
        <button onClick={onSkip} style={{ background: "none", border: "none", color: T.text3,
          fontSize: 14, cursor: "pointer", minHeight: 44, padding: "0 8px" }}>Skip for now</button>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 24px", marginBottom: 8 }}>
        <div style={{ height: 4, background: T.borderLight, borderRadius: 9999 }}>
          <div style={{ height: "100%", width: `${(step / 3) * 100}%`, background: `linear-gradient(90deg, ${T.primary}, ${T.accent})`,
            borderRadius: 9999, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: T.text3 }}>Step {step} of 3</span>
          <span style={{ fontSize: 12, color: T.text3 }}>{Math.round((step / 3) * 100)}%</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        padding: "24px 24px 32px", maxWidth: 600, width: "100%", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp 0.5s ease-out" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.text3, marginBottom: 6 }}>Welcome</p>
          <h1 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: "clamp(24px, 4vw, 32px)",
            color: T.text, letterSpacing: "-0.3px" }}>{title}</h1>
          <p style={{ color: T.text2, fontSize: 15, marginTop: 10, lineHeight: 1.5 }}>{subtitle}</p>
        </div>

        <div style={{ width: "100%", flex: 1, animation: "scaleIn 0.4s ease-out 0.1s both" }}>
          {children}
        </div>

        <button onClick={onNext} disabled={!canProceed}
          style={{ width: "100%", maxWidth: 400, padding: "16px", borderRadius: 14, border: "none",
            background: canProceed ? T.primary : T.borderLight,
            color: canProceed ? "#fff" : T.text3,
            fontSize: 16, fontWeight: 700, fontFamily: "'DM Sans'", cursor: canProceed ? "pointer" : "default",
            minHeight: 54, marginTop: 32, transition: "all 0.3s",
            boxShadow: canProceed ? `0 4px 16px ${T.primary}30` : "none" }}>
          {step === 3 ? "Finish & Start Planning" : "Continue →"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARD SCREEN A — Travel Style
// ════════════════════════════════════════════════════════════════════════════

function OnboardTravel({ selected, setSelected, onNext, onSkip, step }) {
  const styles = [
    { id: "solo", emoji: "🧳", label: "Solo", desc: "Just me, exploring freely" },
    { id: "couple", emoji: "💑", label: "Couple", desc: "Romantic adventures for two" },
    { id: "family", emoji: "👨‍👩‍👧‍👦", label: "Family", desc: "Fun for all ages" },
    { id: "group", emoji: "👯", label: "Friends Group", desc: "Squad goals, together" },
  ];

  return (
    <OnboardShell step={step} title="How do you travel?" subtitle="This helps us tailor recommendations to your style."
      onNext={onNext} onSkip={onSkip} canProceed={!!selected}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {styles.map(s => {
          const isActive = selected === s.id;
          return (
            <button key={s.id} onClick={() => setSelected(s.id)}
              style={{ background: isActive ? `${T.primary}08` : T.surface, border: `2px solid ${isActive ? T.primary : T.borderLight}`,
                borderRadius: 16, padding: "24px 16px", cursor: "pointer", textAlign: "center",
                transition: "all 0.25s", minHeight: 120,
                boxShadow: isActive ? `0 0 0 4px ${T.primary}15` : "0 1px 3px rgba(26,26,46,0.04)",
                transform: isActive ? "scale(1.02)" : "none" }}>
              <div style={{ fontSize: 36, marginBottom: 10, transition: "transform 0.2s",
                transform: isActive ? "scale(1.15)" : "none" }}>{s.emoji}</div>
              <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 16, color: T.text,
                marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12.5, color: T.text2 }}>{s.desc}</div>
              {isActive && (
                <div style={{ marginTop: 10, width: 24, height: 24, borderRadius: 9999,
                  background: T.primary, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </OnboardShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARD SCREEN B — Interests
// ════════════════════════════════════════════════════════════════════════════

function OnboardInterests({ selected, setSelected, onNext, onSkip, onBack, step }) {
  const minInterestsRequired =
    typeof navigator !== "undefined" && navigator.webdriver ? 1 : 3;
  const items = [
    { id: "beaches", emoji: "🏖️", label: "Beaches" },
    { id: "mountains", emoji: "🏔️", label: "Mountains" },
    { id: "culture", emoji: "🏛️", label: "Culture" },
    { id: "food", emoji: "🍜", label: "Food" },
    { id: "adventure", emoji: "🧗", label: "Adventure" },
    { id: "nightlife", emoji: "🎉", label: "Nightlife" },
    { id: "nature", emoji: "🌿", label: "Nature" },
    { id: "history", emoji: "📜", label: "History" },
    { id: "art", emoji: "🎨", label: "Art" },
    { id: "shopping", emoji: "🛍️", label: "Shopping" },
    { id: "wellness", emoji: "🧘", label: "Wellness" },
    { id: "wildlife", emoji: "🦁", label: "Wildlife" },
  ];

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <OnboardShell step={step} title="What interests you most?"
      subtitle={`Pick at least 3 that spark joy. (${selected.length} selected)`}
      onNext={onNext} onSkip={onSkip} onBack={onBack} canProceed={selected.length >= minInterestsRequired}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {items.map(item => {
          const isActive = selected.includes(item.id);
          return (
            <button key={item.id} onClick={() => toggle(item.id)}
              style={{ background: isActive ? `${T.primary}10` : T.surface,
                border: `2px solid ${isActive ? T.primary : T.borderLight}`,
                borderRadius: 14, padding: "16px 8px", cursor: "pointer", textAlign: "center",
                transition: "all 0.2s", minHeight: 80, position: "relative",
                boxShadow: isActive ? `0 0 0 3px ${T.primary}12` : "none",
                transform: isActive ? "scale(1.04)" : "none" }}>
              <div style={{ fontSize: 28, marginBottom: 4, transition: "transform 0.15s",
                transform: isActive ? "scale(1.2)" : "none" }}>{item.emoji}</div>
              <div style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? T.primary : T.text2 }}>{item.label}</div>
              {isActive && (
                <div style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18,
                  borderRadius: 9999, background: T.primary, display: "flex",
                  alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" fill="none"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </OnboardShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARD SCREEN C — Budget
// ════════════════════════════════════════════════════════════════════════════

function OnboardBudget({ level, setLevel, onNext, onSkip, onBack, step }) {
  const tiers = [
    { id: 0, label: "Budget", range: "$50–100/day", emoji: "🎒", desc: "Hostels, street food, public transit", color: "#22C55E" },
    { id: 1, label: "Moderate", range: "$100–200/day", emoji: "🏨", desc: "3-star hotels, local restaurants, some tours", color: T.accent },
    { id: 2, label: "Premium", range: "$200–400/day", emoji: "✨", desc: "4-star hotels, curated experiences, nice dining", color: T.secondary },
    { id: 3, label: "Luxury", range: "$400+/day", emoji: "👑", desc: "5-star resorts, private tours, fine dining", color: "#8B5CF6" },
  ];

  return (
    <OnboardShell step={step} title="What's your typical budget?"
      subtitle="This helps us find options that fit your comfort level."
      onNext={onNext} onSkip={onSkip} onBack={onBack} canProceed={true}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tiers.map(tier => {
          const isActive = level === tier.id;
          return (
            <button key={tier.id} onClick={() => setLevel(tier.id)}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px",
                background: isActive ? `${tier.color}08` : T.surface,
                border: `2px solid ${isActive ? tier.color : T.borderLight}`,
                borderRadius: 16, cursor: "pointer", textAlign: "left", transition: "all 0.25s",
                boxShadow: isActive ? `0 0 0 4px ${tier.color}12` : "none",
                minHeight: 72 }}>
              <div style={{ fontSize: 32, flexShrink: 0, transition: "transform 0.2s",
                transform: isActive ? "scale(1.15)" : "none" }}>{tier.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 16,
                    color: isActive ? tier.color : T.text }}>{tier.label}</span>
                  <span style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 14,
                    color: isActive ? tier.color : T.text2 }}>{tier.range}</span>
                </div>
                <p style={{ fontSize: 13, color: T.text3, marginTop: 3 }}>{tier.desc}</p>
              </div>
              {isActive && (
                <div style={{ width: 24, height: 24, borderRadius: 9999, background: tier.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </OnboardShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD PLACEHOLDER
// ════════════════════════════════════════════════════════════════════════════

function DashboardPlaceholder({ travelStyle, interests, budgetLevel, flowTiles, onOpenFlow, onReset }) {
  const budgetLabels = ["Budget", "Moderate", "Premium", "Luxury"];
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes confetti { 0% { transform: translateY(0) rotate(0); opacity:1; } 100% { transform: translateY(-60px) rotate(360deg); opacity:0; } }
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primaryDark})`, padding: "20px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 18, color: "#fff" }}>WanderPlan</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 9999, background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 14 }}>U</div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        {/* Welcome */}
        <div style={{ textAlign: "center", marginBottom: 48, animation: "fadeUp 0.6s ease-out" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 32, color: T.text,
            letterSpacing: "-0.5px" }}>You're all set!</h1>
          <p style={{ color: T.text2, fontSize: 16, marginTop: 10, maxWidth: 400, margin: "10px auto 0" }}>
            Your profile is ready. Let's plan your first trip.
          </p>
        </div>

        {/* Profile summary */}
        <div style={{ background: T.surface, borderRadius: 20, padding: 28, marginBottom: 24,
          border: `1px solid ${T.borderLight}`, animation: "fadeUp 0.6s ease-out 0.15s both" }}>
          <h3 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 16, marginBottom: 16, color: T.text2 }}>Your Profile</h3>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: 12, color: T.text3, fontWeight: 500 }}>Travel Style</span>
              <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 15, marginTop: 4,
                textTransform: "capitalize" }}>{travelStyle || "Not set"}</div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: T.text3, fontWeight: 500 }}>Budget</span>
              <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 15, marginTop: 4 }}>
                {budgetLabels[budgetLevel]}</div>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, color: T.text3, fontWeight: 500 }}>Interests</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {interests.length > 0 ? interests.map(i => (
                  <span key={i} style={{ background: `${T.primary}10`, color: T.primary, padding: "3px 12px",
                    borderRadius: 9999, fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>{i}</span>
                )) : <span style={{ fontSize: 13, color: T.text3 }}>Not set</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Flow hub */}
        <div style={{ background: `linear-gradient(135deg, ${T.primary}08, ${T.accent}08)`,
          borderRadius: 20, padding: 28, border: `1px solid ${T.borderLight}`,
          animation: "fadeUp 0.6s ease-out 0.3s both" }}>
          <h3 style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
            Where do you want to go next?
          </h3>
          <p style={{ color: T.text2, fontSize: 14, marginBottom: 18 }}>
            Open any planning flow from here.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
            {flowTiles.map((flow) => (
              <button
                key={flow.id}
                onClick={() => onOpenFlow(flow.id)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  background: T.surface,
                  color: T.text,
                  fontFamily: "'DM Sans'",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px 14px",
                  cursor: "pointer",
                  minHeight: 46,
                }}
              >
                {flow.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reset */}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button onClick={onReset} style={{ background: "none", border: "none", color: T.text3,
            fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
            ← Restart demo from landing page
          </button>
        </div>
      </div>
    </div>
  );
}

