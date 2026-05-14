# iOS Migration for Non-Developers — WanderPlan AI

> **References:** [#133](https://github.com/gunjansingh29-create/wanderplan-ai/issues/133) (original iOS proposal) · [#134](https://github.com/gunjansingh29-create/wanderplan-ai/issues/134) (sprint plan & TestFlight checklist)

This guide is written for product owners, designers, and testers who want to understand the iOS migration without needing to read code. It explains what the migration involves, what the AI (Opus) can handle automatically, what still requires human decisions, and what realistic timelines look like.

---

## 1. What the Migration Actually Means

WanderPlan AI is currently a **web app** — it runs in a browser on any device. The iOS migration means creating a version of the app that:

- Lives on an iPhone's home screen as a real app icon.
- Is distributed through **TestFlight** (Apple's beta testing platform) so invited testers can install it without going through the App Store.
- Can later be submitted to the **App Store** for public release.

The web app code (React, JavaScript) does not run natively on iPhone the same way a web browser does. Moving it to iOS therefore involves one of two approaches:

| Approach | Plain meaning | Effort |
|---|---|---|
| **Web wrapper (Capacitor/Ionic)** | Pack the existing website inside a thin iOS shell. The app looks and behaves like a native app but the internals are still web code. | Low–medium |
| **React Native rewrite** | Rewrite every screen using React Native, which compiles to actual iOS UI components. Looks and feels fully native. | Medium–high |
| **Full Swift/SwiftUI rewrite** | Rewrite everything from scratch in Apple's language. Maximum performance; most work. | Very high |

**Recommended path for WanderPlan AI:** Start with the **Capacitor wrapper** to get on TestFlight fast, then migrate screen-by-screen to React Native for a native-quality experience. The sprint plan in issue [#134](https://github.com/gunjansingh29-create/wanderplan-ai/issues/134) follows this two-phase approach.

---

## 2. What Opus Handles

Opus (Claude Opus, the AI coding assistant) can autonomously generate, refactor, and wire up large portions of the migration. Below is an honest list of what it can do well:

### ✅ Fully automated by Opus

- **Capacitor project scaffolding** — generating `capacitor.config.ts`, updating `package.json` with the right dependencies, creating the `ios/` Xcode project folder structure.
- **React → React Native component conversion** — translating `<div>`, `<button>`, inline styles, and CSS into `<View>`, `<TouchableOpacity>`, `StyleSheet` equivalents.
- **Navigation layer** — converting the current `sc`/`go()` screen-routing pattern in `WanderPlanLLMFlow.jsx` (the internal functions that switch between app screens) to `react-navigation` stack and tab navigators.
- **API client adaptation** — replacing `fetch`/`axios` calls with React Native–compatible versions; handling CORS differences between web and native.
- **Push notification wiring** — adding `@capacitor/push-notifications` or React Native Firebase boilerplate; the business logic (what triggers a notification) must still be decided by the product team.
- **Deep-link / Universal Link configuration** — generating `apple-app-site-association` files and updating `Info.plist` once the bundle ID and domain are confirmed.
- **Splash screen and app icon generation** — resizing the WanderPlan logo to all required `@1x / @2x / @3x` sizes and placing them in the correct asset catalog folders.
- **TestFlight distribution configuration** — writing the `ExportOptions.plist` and `Fastfile` (Fastlane) for automated IPA signing and TestFlight upload once certificates are in place.
- **Unit and integration tests** — generating Jest tests for new React Native components and Detox end-to-end test scripts for critical flows (login, trip creation, itinerary view).
- **CI workflow** — writing a GitHub Actions workflow that builds the iOS IPA on every pull request and uploads it to TestFlight on every merge to `main`.

### ⚠️ Opus assists but a human must review

- **Native module selection** — for camera, GPS, biometric auth, or background tasks there are several libraries to choose from. Opus will propose options with trade-offs; the team confirms the choice.
- **Offline / caching strategy** — Opus can implement any strategy you choose, but deciding which data must work offline (itinerary? budget?) is a product decision.
- **Payment handling** — if the app ever sells in-app purchases or subscriptions, Apple requires StoreKit. Opus can write the code, but pricing and entitlements need a human decision.
- **Privacy manifest (`PrivacyInfo.xcprivacy`)** — required by Apple since May 2024 for App Store submissions. Opus generates the file but the product team must confirm which APIs are used and why.

### ❌ Opus cannot do these — human action required

See [Section 3](#3-what-requires-human-action) below.

---

## 3. What Requires Human Action

These tasks **cannot be automated** by an AI. Each one needs a person with access to the right account or device.

### Apple Developer Account (one-time, done by account owner)

| Task | Where | Notes |
|---|---|---|
| Enroll in the Apple Developer Program | [developer.apple.com](https://developer.apple.com) | $99/year; requires a valid Apple ID and identity verification. Can take 24–48 hours for approval. |
| Create an App ID (bundle identifier) | Apple Developer portal → Certificates, IDs & Profiles | Decide the bundle ID now — it cannot be changed later. Convention: `com.wanderplan.app` |
| Create a Distribution Certificate | Same portal | Download and install in Keychain on the Mac that will build the app. |
| Create a Provisioning Profile | Same portal | Links the App ID, certificate, and test devices together. |
| Register test devices (UDID) | Same portal → Devices | Each tester's iPhone UDID must be added for Ad Hoc distribution. Not needed for TestFlight internal testing. |

### Xcode (done on a Mac with Xcode installed)

| Task | Details |
|---|---|
| Install Xcode 15+ | Free from the Mac App Store. ~15 GB download. |
| Sign in with Apple ID | Xcode → Settings → Accounts — connect the developer account. |
| Open and build the iOS project | `ios/WanderPlan.xcworkspace` (generated by Capacitor or React Native CLI). First build takes 5–20 minutes. |
| Resolve any native build errors | Opus will explain errors in plain language if you paste them back, but someone must run the build on a Mac. |
| Archive and upload to TestFlight | Xcode → Product → Archive → Distribute App → TestFlight. |

### App Store Connect (done by account owner or app manager)

| Task | Details |
|---|---|
| Create the app record | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) — fill in app name, primary language, bundle ID, SKU. |
| Add internal testers | Up to 100 people in your developer team; available within minutes of upload. |
| Add external testers | Up to 10,000 people; requires Apple's beta review (1–3 business days). |
| Write TestFlight "What to Test" notes | Shown to every tester; describe what feedback you want. |

---

## 4. Realistic Expectations

The table below gives honest estimates. Times assume Opus is generating code continuously and a developer is reviewing/building on Mac.

| Milestone | Realistic time | What can go wrong |
|---|---|---|
| Capacitor scaffold + first iOS build | 1–2 days | Xcode version mismatch; CocoaPods install failures; native dependency conflicts. |
| All screens rendering on iPhone (Simulator) | 1–2 weeks | Scroll behavior, keyboard-avoiding views, safe-area insets all behave differently on iOS than in a browser. |
| Real device build + TestFlight upload | 1 day (after signing is set up) | Provisioning profile errors are the #1 cause of delays; plan 2–4 hours for first-time setup. |
| Apple beta review (external testers) | 1–3 business days | Apple may reject for missing privacy manifest, missing data usage descriptions in `Info.plist`, or UI issues. Rejections are common on first submission; plan for at least one revision cycle. |
| Full React Native port (if chosen) | 4–8 weeks | Complex flows like the 13-stage trip wizard and the 15-agent LLM orchestration view will need careful screen-by-screen work. |
| App Store public release | Additional 1–7 days after final review | Apple's review SLA for new apps is 1–3 days, but first submissions often get detailed reviews. |

### Common misconceptions

**"The AI will just convert everything automatically in one go."**
Opus converts code very well, but mobile apps have dozens of platform-specific edge cases (keyboard handling, gesture conflicts, background fetch limits, push notification permissions) that surface only during real device testing. Expect several rounds of fixes after each test session.

**"TestFlight is the same as the App Store."**
TestFlight is only for invited testers. The public cannot find or install TestFlight builds. A separate App Store submission is required for public distribution.

**"We can test everything in the Simulator."**
The iOS Simulator runs on your Mac and cannot test push notifications, camera, biometric auth, background audio, or real network conditions. Real device testing is essential before every TestFlight release.

**"We only need one tester's device."**
Screen sizes, iOS versions, and memory constraints vary significantly. Test on at least: a small iPhone (SE / iPhone 13 mini), a large iPhone (iPhone 14 Pro Max or 15 Plus), and the oldest iOS version you plan to support (minimum iOS 16 is a safe floor for 2025/2026 apps).

---

## 5. Step-by-Step Owner Walkthrough

This is the end-to-end sequence you will go through. Items marked 🤖 are handled by Opus; items marked 👤 require a human.

```
Phase 0 — Preparation
  👤 Enroll in Apple Developer Program (if not already done)
  👤 Decide bundle ID (e.g. com.wanderplan.app)
  👤 Install Xcode 15+ on a Mac

Phase 1 — Capacitor scaffold
  🤖 Add Capacitor to the React project
  🤖 Generate ios/ project folder
  🤖 Update capacitor.config.ts with bundle ID and server URL
  👤 Run `npx cap sync` and `npx cap open ios` on a Mac
  👤 Build in Xcode for Simulator — verify the app loads

Phase 2 — Core screens on iOS
  🤖 Fix scroll, safe-area, and font-size issues
  🤖 Adapt the trip wizard flow for mobile viewports
  🤖 Configure push notification permissions prompt
  👤 Test on a real iPhone — note anything that looks wrong
  👤 Feed screenshots and error logs back to Opus for fixes

Phase 3 — Signing and TestFlight
  👤 Create Distribution Certificate in Apple Developer portal
  👤 Create App ID and Provisioning Profile
  🤖 Write Fastlane Fastfile and ExportOptions.plist
  👤 Archive in Xcode and upload to App Store Connect
  👤 Invite internal testers in App Store Connect
  👤 Distribute to internal team; collect feedback

Phase 4 — External beta (optional, before App Store)
  🤖 Add missing Info.plist usage descriptions (camera, location, etc.)
  🤖 Generate PrivacyInfo.xcprivacy
  👤 Submit for Apple beta review
  👤 Respond to any rejection notes
  👤 Invite external testers once approved

Phase 5 — App Store submission
  👤 Prepare screenshots (6.7" and 5.5" sizes required)
  👤 Write App Store description, keywords, and category
  🤖 Final code review and lint pass
  👤 Submit for App Store review
  👤 Monitor review status; respond to reviewer questions
```

---

## 6. Glossary

| Term | Plain meaning |
|---|---|
| **App ID / Bundle ID** | A unique reverse-domain name that identifies your app forever (e.g. `com.wanderplan.app`). Set once; cannot be changed after first submission. |
| **Apple Developer Program** | Apple's paid membership ($99/year) required to distribute apps outside the web. |
| **App Store Connect** | Apple's web portal for managing your apps, testers, and submissions. |
| **Capacitor** | A tool that wraps a web app inside an iOS (and Android) shell so it can be distributed as a native app. |
| **CocoaPods** | iOS's package manager. Installs native dependencies for your app, similar to npm for JavaScript. |
| **Distribution Certificate** | A cryptographic key Apple gives you to prove your builds are genuine. Installed on the Mac that builds the app. |
| **Fastlane** | An automation tool that handles code signing, building, and uploading to TestFlight from the command line. |
| **Info.plist** | A configuration file inside every iOS app that tells Apple (and the user) what permissions the app needs (camera, location, etc.). |
| **IPA** | The file format for compiled iOS apps, similar to an APK on Android or an EXE on Windows. |
| **Opus** | Claude Opus — the AI coding assistant generating code for this migration. |
| **Provisioning Profile** | A file that links your app ID, signing certificate, and (for development) specific devices together. Required to install the app anywhere. |
| **React Native** | A framework for building mobile apps using JavaScript/React that compiles to real iOS and Android components (not a web wrapper). |
| **Safe Area** | The portion of the iPhone screen not obscured by the notch, Dynamic Island, or home indicator. Apps must lay out content within this area. |
| **Simulator** | Apple's software emulator bundled with Xcode that runs iOS on your Mac. Useful but cannot replicate all real-device behaviour. |
| **TestFlight** | Apple's official beta testing platform. Lets you distribute builds to up to 10,000 invited testers before going to the App Store. |
| **UDID** | A unique hardware identifier for each iPhone/iPad. Required for Ad Hoc distribution; not needed for TestFlight. |
| **Universal Links** | A mechanism that lets a URL (`https://wanderplan.app/trip/123`) open directly in the app instead of a browser. |
| **Xcode** | Apple's official development environment for building iOS apps. Must run on a Mac. |
| **xcworkspace** | The Xcode project file that opens when your app uses CocoaPods or Capacitor. Always open this file, not `.xcodeproj`. |
