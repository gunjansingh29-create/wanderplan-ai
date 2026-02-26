/**
 * Canonical test-ID / ARIA-label registry.
 *
 * Maps semantic names → the locator strings used by Playwright.
 * Keeping them in one place means a single edit here fixes every spec
 * if a selector changes.
 *
 * NOTE: Where the component doesn't yet have `data-testid` attributes,
 * this module also exports the recommended attribute to add.
 * Suggested additions are marked with  // ← ADD THIS
 */

// ─────────────────────────────────────────────────────────────────────────────
// Homepage / Auth
// ─────────────────────────────────────────────────────────────────────────────
export const HOME = {
  /** CTA button that opens the auth screen */
  ctaButton:        '[data-testid="cta-get-started"]',   // ← ADD THIS
  heroHeading:      'h1',
  navLogo:          '[data-testid="nav-logo"]',           // ← ADD THIS
  howItWorksLink:   '#how-it-works',
} as const;

export const AUTH = {
  /** Wrapping form card */
  card:             '[data-testid="auth-card"]',          // ← ADD THIS
  emailInput:       'input[type="email"]',
  passwordInput:    'input[type="password"]',
  createAccountBtn: 'button:has-text("Create Account")',
  signInBtn:        'button:has-text("Sign In")',
  toggleModeBtn:    '[data-testid="auth-toggle"]',        // ← ADD THIS
  googleBtn:        'button:has-text("Google")',
  appleBtn:         'button:has-text("Apple")',
  backBtn:          'button:has-text("← Back")',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding  (3 steps)
// ─────────────────────────────────────────────────────────────────────────────
export const ONBOARD = {
  progressBar:      '[data-testid="onboard-progress"]',  // ← ADD THIS
  stepLabel:        'text=Step',
  continueBtn:      'button:has-text("Continue")',
  finishBtn:        'button:has-text("Finish & Start Planning")',
  skipBtn:          'button:has-text("Skip for now")',
  backBtn:          'button:has-text("← Back")',

  // Step 1 — Travel style
  soloCard:         '[data-testid="style-solo"]',         // ← ADD THIS
  groupCard:        '[data-testid="style-group"]',        // ← ADD THIS
  styleCard:        (id: string) => `[data-testid="style-${id}"]`,

  // Step 2 — Interests
  interestItem:     (id: string) => `[data-testid="interest-${id}"]`,

  // Step 3 — Budget
  budgetTier:       (id: string) => `[data-testid="budget-${id}"]`,
  budgetModerate:   '[data-testid="budget-moderate"]',    // ← ADD THIS
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Wizard Shell & Stepper
// ─────────────────────────────────────────────────────────────────────────────
export const WIZARD = {
  stepper:          '[data-testid="stepper"]',            // ← ADD THIS
  stepperItem:      (key: string) => `[data-testid="step-${key}"]`,
  activeStep:       '[data-testid="step-active"]',        // ← ADD THIS
  doneStep:         (key: string) => `[data-testid="step-done-${key}"]`,

  /** Agent header area */
  agentHeader:      '[data-testid="agent-header"]',       // ← ADD THIS
  agentName:        '[data-testid="agent-name"]',         // ← ADD THIS

  /** Generic continue / next button */
  continueBtn:      'button:has-text("Continue")',
  nextBtn:          'button:has([text*="Continue"], [text*="→"])',

  /** Budget meter */
  budgetMeter:      '[data-testid="budget-meter"]',       // ← ADD THIS
  budgetMeterFill:  '[data-testid="budget-meter-fill"]',  // ← ADD THIS
  budgetMeterLabel: '[data-testid="budget-meter-label"]', // ← ADD THIS
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// YesNo Card  (YN component)
// ─────────────────────────────────────────────────────────────────────────────
export const YN = {
  /** Container — use `.nth(n)` to target the n-th card on a screen */
  card:             '[data-testid="yn-card"]',            // ← ADD THIS
  title:            '[data-testid="yn-title"]',           // ← ADD THIS
  approveBtn:       'button:has-text("Approve")',
  reviseBtn:        'button:has-text("Revise")',
  /** Target a specific card by its title text */
  cardByTitle:      (title: string) => `[data-testid="yn-card"]:has-text("${title}")`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Individual wizard stages
// ─────────────────────────────────────────────────────────────────────────────
export const STAGES = {
  // ── Create ──────────────────────────────────────────────────────────────
  tripNameInput:    'input[placeholder*="trip"]',
  inviteEmailInput: 'input[placeholder*="friend@email"]',
  inviteBtn:        'button:has-text("Send")',
  membersJoined:    '[data-testid="members-joined"]',     // ← ADD THIS
  continueMembers:  'button:has-text("Continue with")',

  // ── Bucket List ──────────────────────────────────────────────────────────
  bucketInput:      '[data-testid="bucket-input"]',       // ← ADD THIS
  bucketDestCard:   (rank: number) => `[data-testid="dest-card-${rank}"]`,
  thumbUpBtn:       'button:has([data-icon="thumb"])',
  bucketApproveYN:  'button:has-text("Approve")',

  // ── Timing ───────────────────────────────────────────────────────────────
  timingHeatmap:    '[data-testid="timing-heatmap"]',     // ← ADD THIS
  timingMonthCell:  (month: string) => `[data-testid="month-${month}"]`,
  timingApproveYN:  'button:has-text("Approve")',

  // ── Interests ────────────────────────────────────────────────────────────
  interestQuestion: '[data-testid="interest-q"]',         // ← ADD THIS
  interestYesBtn:   'button:has-text("👍 Yes")',
  interestNoBtn:    'button:has-text("👎 No")',
  interestContinue: 'button:has-text("Continue")',

  // ── Health ───────────────────────────────────────────────────────────────
  healthApproveBtn: 'button:has-text("Approve")',

  // ── POIs ─────────────────────────────────────────────────────────────────
  poiCard:          '[data-testid="poi-card"]',           // ← ADD THIS
  poiApproveBtn:    'button:has-text("Approve")',
  poiSkipBtn:       'button:has-text("Skip")',
  poiContinueBtn:   'button:has-text("activities selected")',

  // ── Duration ─────────────────────────────────────────────────────────────
  durationApprove:  'button:has-text("Approve")',

  // ── Availability ─────────────────────────────────────────────────────────
  availApprove:     'button:has-text("Approve")',

  // ── Budget ───────────────────────────────────────────────────────────────
  budgetSlider:     'input[type="range"]',
  budgetValue:      '[data-testid="budget-value"]',       // ← ADD THIS
  budgetApprove:    'button:has-text("Approve")',

  // ── Flights ───────────────────────────────────────────────────────────────
  flightClassBtn:   (cls: string) => `button:has-text("${cls}")`,
  flightCard:       '[data-testid="flight-card"]',        // ← ADD THIS
  flightBookBtn:    'button:has-text("Book")',
  flightExpandBtn:  '[data-testid="expand-search-btn"]',  // ← ADD THIS

  // ── Stays ─────────────────────────────────────────────────────────────────
  stayCard:         '[data-testid="stay-card"]',          // ← ADD THIS
  stayBookBtn:      'button:has-text("Book ✓")',
  staySkipBtn:      'button:has-text("Skip")',
  stayContinueBtn:  'button:has-text("Continue to Dining")',

  // ── Dining ────────────────────────────────────────────────────────────────
  diningItem:       '[data-testid="dining-item"]',        // ← ADD THIS
  diningApproveBtn: 'button[aria-label*="approve-dining"]',
  diningCheckIcon:  'button:has([data-icon="check"])',
  diningContinue:   'button:has-text("Continue to Itinerary")',

  // ── Itinerary ────────────────────────────────────────────────────────────
  itineraryDayCard: '[data-testid="itinerary-day"]',      // ← ADD THIS
  itineraryApprove: 'button:has-text("Approve")',

  // ── Sync ─────────────────────────────────────────────────────────────────
  syncTitle:        'h1:has-text("Trip Confirmed")',
  syncCalendarRow:  '[data-testid="calendar-row"]',       // ← ADD THIS
  syncedBadge:      'text=✓ Synced',
  restartBtn:       'button:has-text("Restart demo")',
} as const;
