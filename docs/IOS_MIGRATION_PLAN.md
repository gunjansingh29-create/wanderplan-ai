# WanderPlan AI — iOS Migration Plan

This document covers the detailed sprint plan, decision tree, and TestFlight
submission checklist for migrating WanderPlan AI from its current React/CRA web
app to a native iOS application.

It is scoped to iOS only. Android parity can follow after a stable TestFlight
beta.

Related issues: #133 (Convert WanderPlan web app to native iOS app for
TestFlight beta), #134 (this document).

---

## Contents

1. [Migration Strategy Decision Tree](#1-migration-strategy-decision-tree)
2. [Screen & Feature Inventory](#2-screen--feature-inventory)
3. [Sprint Plan](#3-sprint-plan)
4. [API & Backend Compatibility](#4-api--backend-compatibility)
5. [TestFlight Submission Checklist](#5-testflight-submission-checklist)
6. [Open Decisions](#6-open-decisions)
7. [Success Criteria](#7-success-criteria)

---

## 1. Migration Strategy Decision Tree

Use the tree below to decide **how** to build each part of the iOS app before
writing code.

```
START
│
├─► Do we have an existing React web component for this screen?
│   │
│   ├─ YES ─► Is the component pure layout/data with no browser-only APIs?
│   │         │
│   │         ├─ YES ─► Port to React Native with StyleSheet
│   │         │         (replace CSS-in-JS, window.*, localStorage)
│   │         │
│   │         └─ NO  ─► Identify browser-only dependencies first:
│   │                   • localStorage   → AsyncStorage (@react-native-async-storage/async-storage)
│   │                   • window.innerWidth → Dimensions.get("window")
│   │                   • ResizeObserver / matchMedia → useWindowDimensions hook
│   │                   • WebSocket (browser) → React Native WebSocket (built-in)
│   │                   • CSS animations → Reanimated 3 / Animated API
│   │                   • SVG inline → react-native-svg
│   │                   Then port.
│   │
│   └─ NO  ─► Build new screen natively in React Native.
│
├─► What navigation pattern does this screen use?
│   │
│   ├─ Full-screen push (wizard step, trip detail) → Stack.Screen (React Navigation)
│   ├─ Bottom tab (dashboard, bucket list, profile) → Tab.Screen (React Navigation)
│   └─ Modal overlay (filters, invite sheet)        → Modal presentation in Stack
│
├─► How does this screen store state?
│   │
│   ├─ Server-owned (trips, members, planning state) → fetch from existing REST API
│   ├─ Session-only (wizard in-progress)             → React useState / useReducer
│   └─ Persisted locally (auth token, profile cache) → AsyncStorage (encrypted via
│                                                       react-native-encrypted-storage
│                                                       for the auth token)
│
├─► Does this screen need push notifications?
│   │
│   ├─ YES (crew invites, trip status changes) → Firebase Cloud Messaging (FCM)
│   │                                            + APNs certificate in App Store Connect
│   └─ NO  ─► skip notification setup for now
│
└─► Is this feature in scope for the initial TestFlight beta?
    │
    ├─ YES ─► Include in Sprint 1–4
    └─ NO  ─► Backlog for post-beta iteration
```

### Framework decision

| Option | Verdict | Reason |
|---|---|---|
| **React Native (Expo managed)** | ✅ Chosen | Reuses existing React component knowledge and business logic. Expo SDK accelerates native module access without full ejection. Eject to bare workflow only if a native module requires it. |
| SwiftUI / UIKit (native) | ❌ Skip | Would require full rewrite. No code reuse. Adds Swift skill requirement. |
| Capacitor / Cordova (web view wrapper) | ❌ Skip | App Store reviewers reject thin web-view wrappers for travel/planning apps. Performance is poor for the wizard step count. |
| React Native CLI (bare) | ⚠️ Fallback | Use only if Expo cannot support a required native module. |

### Navigation decision

Use **React Navigation v7** (Stack + Bottom Tabs):

```
Root Stack
├── AuthStack
│   ├── LandingScreen
│   ├── LoginScreen
│   └── RegisterScreen
├── OnboardingStack
│   ├── TravelStyleScreen
│   ├── InterestsScreen
│   └── OnboardCompleteScreen
└── AppTabs (Bottom Tab Navigator)
    ├── DashboardTab  →  DashboardScreen
    ├── PlanTab       →  WizardStack (16 wizard steps as Stack screens)
    ├── TripsTab      →  TripsListScreen → TripDetailScreen → CompanionScreen
    └── ProfileTab    →  ProfileScreen
```

### State management decision

| Concern | Solution |
|---|---|
| Auth token | `react-native-encrypted-storage` (keychain-backed) |
| User profile cache | AsyncStorage, invalidated on login/logout |
| Wizard in-progress state | React `useReducer` (same logic as current `WanderPlanLLMFlow`) |
| Trip list / details | `@tanstack/react-query` (server state, refetch on focus) |
| Global UI state (modals, toasts) | React Context, scoped and minimal |

---

## 2. Screen & Feature Inventory

The following table maps every current web screen to its iOS equivalent and beta
scope.

| Web Screen / Component | iOS Screen | Beta scope | Notes |
|---|---|---|---|
| `LandingPage` (WanderPlanHome) | `LandingScreen` | Sprint 1 | Simplified hero; no scroll-parallax |
| Auth modal (login / register) | `LoginScreen`, `RegisterScreen` | Sprint 1 | Reuse existing `/auth/*` API |
| Onboarding step 1 — travel style | `TravelStyleScreen` | Sprint 1 | |
| Onboarding step 2 — interests | `InterestsScreen` | Sprint 1 | |
| Dashboard | `DashboardScreen` | Sprint 2 | Trip cards, quick-start CTA |
| Bucket list chat | `BucketListScreen` | Sprint 2 | Reuse bucket list agent API |
| Wizard step 1 — Destinations | `DestinationsScreen` | Sprint 2 | |
| Wizard step 2 — Invite Crew | `InviteCrewScreen` | Sprint 2 | Deep-link SMS invite |
| Wizard step 3 — Vote | `VoteScreen` | Sprint 2 | Real-time poll via WebSocket |
| Wizard step 4 — Interests | `WizardInterestsScreen` | Sprint 2 | |
| Wizard step 5 — Health | `HealthScreen` | Sprint 2 | |
| Wizard step 6 — Route Planner | `RoutePlannerScreen` | Sprint 3 | Map view; use `react-native-maps` |
| Wizard step 7 — Activities | `ActivitiesScreen` | Sprint 3 | |
| Wizard step 8 — POI Voting | `POIVotingScreen` | Sprint 3 | Card swipe; use Reanimated |
| Wizard step 9 — Budget | `BudgetScreen` | Sprint 3 | |
| Wizard step 10 — Duration | `DurationScreen` | Sprint 3 | |
| Wizard step 11 — Stays | `StaysScreen` | Sprint 3 | |
| Wizard step 12 — Dining | `DiningScreen` | Sprint 3 | |
| Wizard step 13 — Itinerary | `ItineraryScreen` | Sprint 3 | |
| Wizard step 14 — Availability | `AvailabilityScreen` | Sprint 3 | Native date picker |
| Wizard step 15 — Flights | `FlightsScreen` | Sprint 4 | |
| Wizard step 16 — Confirm | `ConfirmScreen` | Sprint 4 | |
| Trip detail | `TripDetailScreen` | Sprint 4 | |
| During-trip companion | `CompanionScreen` | Sprint 4 | refs DURING_TRIP checklist |
| Analytics dashboard | `AnalyticsDashboardScreen` | Post-beta | Owner/admin only |
| Security architecture view | — | Post-beta | Internal tool; not for TestFlight |

---

## 3. Sprint Plan

Each sprint is **2 weeks**. The total plan targets a TestFlight build by the end
of Sprint 5, with a hardening sprint (Sprint 6) before public beta promotion.

### Sprint 0 — Environment Setup (Week 0, pre-work)

Goal: working iOS simulator build with CI.

- [ ] Create `mobile/` directory in repository root
- [ ] Initialise Expo project: `npx create-expo-app mobile --template blank-typescript`
- [ ] Configure ESLint, Prettier, and TypeScript `strict` mode
- [ ] Add React Navigation: `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
- [ ] Add `@react-native-async-storage/async-storage`, `react-native-encrypted-storage`
- [ ] Add `@tanstack/react-query`
- [ ] Confirm build runs on iOS Simulator (iPhone 15 Pro, iOS 17)
- [ ] Set up GitHub Actions workflow `.github/workflows/ios-ci.yml`:
  - `expo install --check`
  - `npx tsc --noEmit`
  - `jest --runInBand`
- [ ] Register app bundle ID `ai.wanderplan.ios` in Apple Developer portal
- [ ] Create Xcode project signing config (manual provisioning for TestFlight)

Acceptance criteria:
- `npx expo start` opens on simulator without errors
- CI passes on `main` and feature branches

---

### Sprint 1 — Auth, Onboarding & Navigation Shell (Weeks 1–2)

Goal: user can sign up, log in, and complete onboarding on device.

#### Navigation shell
- [ ] Implement `RootNavigator` with `AuthStack` / `AppTabs` split
- [ ] Implement `AppTabs` (Dashboard, Plan, Trips, Profile) with icons
- [ ] Add deep-link configuration (`wanderplan://`) for crew invites

#### Auth screens
- [ ] `LandingScreen` — hero illustration, CTA buttons
- [ ] `LoginScreen` — email/password form; POST `/auth/login`
- [ ] `RegisterScreen` — name/email/password form; POST `/auth/register`
- [ ] Store auth token in `react-native-encrypted-storage`
- [ ] Auto-login on app relaunch if valid token exists

#### Onboarding screens
- [ ] `TravelStyleScreen` — tap-to-select grid (Solo / Couple / Friends / Family)
- [ ] `InterestsScreen` — category chips (Hiking, Food, Culture, …)
- [ ] `OnboardCompleteScreen` — confirmation and CTA to Dashboard

#### Shared components
- [ ] `Button` (primary, secondary, ghost variants)
- [ ] `TextInput` with validation state
- [ ] `ScreenHeader` with back arrow and title
- [ ] `Toast` / `SnackBar` for API error feedback

#### Tests
- [ ] Unit: auth token storage/retrieval
- [ ] Unit: form validation logic
- [ ] Component: `LoginScreen` renders and submits correctly

Acceptance criteria:
- New user can register, complete onboarding, and reach Dashboard tab
- Returning user is auto-logged-in

---

### Sprint 2 — Dashboard & Wizard Steps 1–5 (Weeks 3–4)

Goal: user can start a new trip and complete the first half of the wizard.

#### Dashboard
- [ ] `DashboardScreen` — trip cards (`GET /trips`), "Start New Trip" FAB
- [ ] Trip card shows name, destination count, status badge, member avatars
- [ ] Skeleton loader while fetching

#### Bucket list
- [ ] `BucketListScreen` — chat interface; POST `/bucket-list/message`
- [ ] Destination chips display and removal
- [ ] Persist bucket list to `GET/POST /bucket-list-items`

#### Wizard steps 1–5
- [ ] `DestinationsScreen` — destination input with validation (reuse `BUCKET_DESTINATION_*` regexes from web)
- [ ] `InviteCrewScreen` — contact picker or manual email entry; SMS deep-link via `expo-sms`
- [ ] `VoteScreen` — destination vote cards; WebSocket subscribe to trip vote events
- [ ] `WizardInterestsScreen` — category selection chips
- [ ] `HealthScreen` — accessibility/mobility needs form

#### Shared state
- [ ] `WizardContext` to hold in-progress trip state across steps
- [ ] Persist wizard progress to `AsyncStorage` so partial progress survives app backgrounding

#### Tests
- [ ] Unit: `WizardContext` step advance / step back
- [ ] Unit: destination name validation matches web implementation
- [ ] Component: `VoteScreen` updates optimistically

Acceptance criteria:
- User can start a new trip and advance through wizard steps 1–5
- Partial wizard progress is restored after app restart

---

### Sprint 3 — Wizard Steps 6–14, Maps & POI (Weeks 5–6)

Goal: full wizard flow completable end-to-end on device.

#### Map integration
- [ ] Add `react-native-maps` (Expo config plugin)
- [ ] `RoutePlannerScreen` — interactive map with destination markers and route polyline
- [ ] Request location permission with `expo-location` (optional; used to pre-fill nearest airport)

#### POI & activities
- [ ] `ActivitiesScreen` — activity category selection
- [ ] `POIVotingScreen` — swipe card deck (Reanimated 3 pan gesture); POST `/poi/vote`

#### Budget & logistics
- [ ] `BudgetScreen` — tier selector with daily estimate display
- [ ] `DurationScreen` — night count stepper
- [ ] `StaysScreen` — accommodation preference chips

#### Dining & itinerary
- [ ] `DiningScreen` — cuisine preference chips + dietary restriction toggles
- [ ] `ItineraryScreen` — day-by-day scrollable list from `GET /trips/{id}/itinerary`
- [ ] `AvailabilityScreen` — native `DateTimePicker` for each member's availability window

#### Tests
- [ ] Unit: budget tier calculation helpers
- [ ] Unit: duration stepper min/max bounds
- [ ] Component: `POIVotingScreen` swipe triggers correct vote API call
- [ ] Component: `AvailabilityScreen` native date picker integration

Acceptance criteria:
- User can complete all wizard steps 1–14 without error
- Map renders destination markers correctly

---

### Sprint 4 — Flights, Confirm, Trip Detail & Companion (Weeks 7–8)

Goal: end-to-end trip creation and access to the during-trip companion.

#### Flights
- [ ] `FlightsScreen` — origin/destination airport search; flight option list from `GET /flights/search`
- [ ] Airport code autocomplete using `airportResolution` logic from web

#### Confirm & post-wizard
- [ ] `ConfirmScreen` — trip summary card; "Confirm & Lock" button; POST `/trips/{id}/confirm`
- [ ] On confirm: update trip status to `active`, navigate to `TripDetailScreen`

#### Trip detail
- [ ] `TripDetailScreen` — trip metadata, member avatars, action buttons
- [ ] "Open Live Companion" button visible when `trip.status === "active"` (refs DURING_TRIP checklist)
- [ ] "Continue Planning" button visible when `trip.status === "planning"`

#### During-trip companion
- [ ] `CompanionScreen` — trip name, date range, destinations, crew list, today's itinerary
- [ ] Read from `GET /trips/{id}` + planning state (Option A from DURING_TRIP checklist)
- [ ] Back navigation returns to `TripDetailScreen`

#### Push notifications (APNs)
- [ ] Add `expo-notifications`
- [ ] Register device token and store in backend `POST /users/device-token`
- [ ] Handle foreground and background notification payloads
- [ ] Notification types for beta:
  - crew member accepts invite
  - vote round complete
  - trip status changes to `active`

#### Tests
- [ ] Component: `ConfirmScreen` calls confirm API and navigates
- [ ] Component: `TripDetailScreen` shows companion button only for `active` trips
- [ ] Component: `CompanionScreen` renders real trip data
- [ ] Unit: push notification payload parsing

Acceptance criteria:
- Full end-to-end trip creation works on device
- Companion screen opens from an `active` trip
- Push notifications delivered in foreground and background

---

### Sprint 5 — Polish, Accessibility & TestFlight Build (Weeks 9–10)

Goal: production-quality build submitted to TestFlight.

#### UI polish
- [ ] Audit all screens against WanderPlan design tokens (colors, typography, spacing)
- [ ] Add `AccessibilityLabel` and `accessibilityHint` to all interactive elements
- [ ] Dynamic Type support (respect system font size settings)
- [ ] Dark mode — the existing web palette is already dark-first; verify on light mode devices
- [ ] Safe area insets on all screens (`react-native-safe-area-context`)
- [ ] Keyboard avoidance on all form screens (`KeyboardAvoidingView`)
- [ ] Empty states for trip list, bucket list, and itinerary

#### Performance
- [ ] Profile JS thread with Flipper / React DevTools
- [ ] Lazy-load `AnalyticsDashboardScreen` (post-beta, but ensure it does not slow startup)
- [ ] Image caching for destination photos (`expo-image`)
- [ ] Reduce bridge calls in `WizardContext` state updates

#### Error handling
- [ ] Global error boundary for each tab
- [ ] API timeout and retry with exponential backoff
- [ ] Offline detection banner (`@react-native-community/netinfo`)

#### App Store assets
- [ ] App icon (1024×1024 PNG, no alpha) — use WanderPlan compass/map brand mark
- [ ] Splash screen (Expo splash plugin)
- [ ] App Store screenshots: iPhone 6.9" (iPhone 16 Pro Max) × 5 screens
- [ ] Privacy policy URL ready for App Store Connect
- [ ] App description and keywords drafted

#### Build
- [ ] `eas build --platform ios --profile preview` (internal TestFlight)
- [ ] Verify `.ipa` installs on physical iPhone via TestFlight
- [ ] Verify on minimum deployment target: iOS 16
- [ ] Verify on latest iOS 18 release

Acceptance criteria:
- Zero crashes on the happy path (full trip creation)
- Accessibility audit passes (no unlabelled interactive elements)
- App Store Connect build upload succeeds

---

### Sprint 6 — TestFlight Beta Hardening (Weeks 11–12)

Goal: stable beta with internal tester feedback incorporated.

- [ ] Invite 5–10 internal testers via TestFlight
- [ ] Collect crash reports from Xcode Organizer / Sentry
- [ ] Fix all P0/P1 crashes within sprint
- [ ] Fix top 5 UX issues from tester feedback
- [ ] Add Sentry (`@sentry/react-native`) for production crash reporting
- [ ] Analytics events via Mixpanel (`mixpanel-react-native`):
  - `app_open`, `signup`, `onboard_complete`, `wizard_start`, `wizard_complete`, `trip_confirmed`
- [ ] Re-submit to TestFlight after fixes
- [ ] Gate public beta promotion on: 0 P0 crashes, < 2% crash rate, tester NPS ≥ 7

---

## 4. API & Backend Compatibility

The existing FastAPI backend is already accessible from a mobile client. No new
backend work is required for the beta except the device-token endpoint and the
trip status transition (both already covered in the DURING_TRIP checklist).

| Concern | Action |
|---|---|
| CORS | Confirm Kong gateway allows the mobile app's origin (non-browser requests do not send Origin, so this is already fine) |
| Auth | JWT Bearer token — same as web. Store in keychain via `react-native-encrypted-storage`. |
| WebSocket | React Native ships a standards-compliant WebSocket — no change needed. |
| File uploads (trip photos, post-trip) | Use `expo-image-picker` + multipart POST; backend already handles this |
| Rate limiting | Mobile clients share the same Kong rate-limit policy as the web client |
| Minimum backend version | All endpoints used by the mobile app must be on the production backend before Sprint 4 testing begins |

### New backend endpoint needed

```
POST /users/device-token
Body: { device_token: string, platform: "apns" }
Auth: Bearer JWT
```

Register APNs device token for push notification delivery. Required before
Sprint 4 push notification work.

---

## 5. TestFlight Submission Checklist

Work through this list **in order** before submitting each build.

### 5.1 Xcode & Build Settings

- [ ] Bundle ID set to `ai.wanderplan.ios` in `app.json` (`expo.ios.bundleIdentifier`)
- [ ] Version and build number incremented (`expo.version`, `expo.ios.buildNumber`)
- [ ] Deployment target iOS 16.0 or higher
- [ ] `EAS_NO_VCS=1` not set in CI — EAS must have access to git metadata
- [ ] Build profile `production` uses `release` configuration (not `debug`)
- [ ] `expo-dev-client` not included in production build
- [ ] All Expo SDK modules listed in `app.json` `plugins` section

### 5.2 Apple Developer Account

- [ ] Apple Developer Program membership active
- [ ] App ID `ai.wanderplan.ios` created in Apple Developer portal
- [ ] Push Notifications capability enabled for the App ID
- [ ] APNs key (`.p8`) uploaded to Firebase / Expo push service
- [ ] Distribution certificate (iOS Distribution) valid and not expiring within 30 days
- [ ] Provisioning profile (App Store Distribution) downloaded and referenced in EAS
- [ ] TestFlight internal test group created with ≥ 2 testers

### 5.3 App Store Connect

- [ ] App record created in App Store Connect (`ai.wanderplan.ios`)
- [ ] App name: **WanderPlan AI**
- [ ] Primary category: Travel
- [ ] Secondary category: Productivity
- [ ] Privacy policy URL set
- [ ] Age rating questionnaire completed (no objectionable content, ≥ 4+)
- [ ] App description (170 chars) and full description (4000 chars max) complete
- [ ] 5 keywords set
- [ ] App screenshots uploaded for iPhone 6.7" (required); iPad optional for beta
- [ ] App icon 1024×1024 uploaded (no alpha, no rounded corners — App Store adds them)
- [ ] Support URL set

### 5.4 Privacy & Permissions

- [ ] `NSLocationWhenInUseUsageDescription` set in `app.json` Info.plist entries
  (used only for nearest-airport suggestion; not required at launch)
- [ ] `NSContactsUsageDescription` set if crew invite uses contacts picker
- [ ] `NSCameraUsageDescription` set if profile photo or trip photo upload enabled
- [ ] `NSPhotoLibraryUsageDescription` set for trip photo selection
- [ ] `NSUserNotificationsUsageDescription` set for push notification permission prompt
- [ ] Data collection declaration completed in App Store Connect
  (collect: email, name, travel preferences; not linked to third-party advertising)
- [ ] No third-party analytics SDKs added without disclosure in privacy manifest

### 5.5 Functional QA Pass (on physical device, not simulator)

- [ ] Cold launch from home screen — no crash
- [ ] Sign up new account
- [ ] Complete onboarding
- [ ] Add destination to bucket list
- [ ] Start new trip wizard — complete all 16 steps
- [ ] Confirm trip → status becomes `active`
- [ ] Open Live Companion from trip detail
- [ ] Receive push notification (crew invite)
- [ ] Background app, foreground app — state preserved
- [ ] Switch to airplane mode — offline banner shown, no crash
- [ ] Log out and log back in — correct state restored

### 5.6 Device & OS Coverage

Test on at least the following before each TestFlight submission:

| Device | iOS | Screen size |
|---|---|---|
| iPhone 16 Pro Max | iOS 18 | 6.9" |
| iPhone 16 Pro | iOS 18 | 6.3" |
| iPhone 15 Pro | iOS 17 | 6.1" |
| iPhone SE (3rd gen) | iOS 17 | 4.7" |
| iPhone 13 mini | iOS 16 | 5.4" |

### 5.7 EAS Submit

```bash
# Build for TestFlight
eas build --platform ios --profile production

# Submit to App Store Connect / TestFlight
eas submit --platform ios --latest

# Verify build in App Store Connect
# → Processing usually takes 5–15 minutes
# → Add to TestFlight internal group after processing completes
```

---

## 6. Open Decisions

These must be resolved before the relevant sprint begins.

| # | Decision | Options | Recommended | Sprint needed by |
|---|---|---|---|---|
| 1 | Expo managed vs bare workflow | Managed (EAS Build handles native) / Bare (full Xcode project) | Managed; eject only if a native module forces it | Sprint 0 |
| 2 | Map provider | Apple Maps (MapKit, free) / Google Maps ($) | Apple Maps via `react-native-maps` with `provider={PROVIDER_DEFAULT}` | Sprint 3 |
| 3 | Push notification service | Expo Push Service (wraps APNs) / direct APNs / FCM | Expo Push Service for beta simplicity; migrate to direct APNs for v1.0 | Sprint 4 |
| 4 | Offline-first scope | None (online-only) / read cache / full offline | Read cache only for beta (trip list and last-viewed trip detail) | Sprint 5 |
| 5 | Deep-link scheme | Custom (`wanderplan://`) / Universal Links (HTTPS) | Both; custom scheme for invite links, Universal Links for App Clip (post-beta) | Sprint 1 |
| 6 | Minimum iOS version | iOS 15 / iOS 16 / iOS 17 | iOS 16 (covers ~95%+ of active devices as of Q1 2026; verify against latest Apple analytics before Sprint 0 cutoff) | Sprint 0 |

---

## 7. Success Criteria

This migration plan is complete when:

- A TestFlight build is available to internal testers
- All 16 wizard steps complete without error on a physical iPhone
- Trip confirmation transitions status to `active`
- The during-trip companion screen is reachable from a confirmed trip
- Push notifications are delivered for crew invites and trip status changes
- Zero P0 crashes in 48 hours of internal testing
- Build passes App Store Connect automated checks (no rejection reasons)
- CI runs `tsc --noEmit` and `jest` successfully on every PR to `mobile/`
