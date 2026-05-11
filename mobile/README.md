# WanderPlan AI – iOS App

React Native 0.74 native iOS application that brings the WanderPlan AI travel-planning experience to iPhone.

## Features

| Feature | Description |
|---|---|
| **Sign in / Sign up** | Local-first auth matching the web app |
| **My Trips dashboard** | View, filter, and manage all your trips |
| **AI Trip Planner** | Chat with the AI to build a full itinerary |
| **Bucket List** | Save and manage dream destinations |
| **Profile & Settings** | Account info, notification prefs, offline mode |

## Project structure

```
mobile/
├── App.tsx                    # Root component
├── index.js                   # React Native entry point
├── app.json                   # App name used by the registry
├── package.json               # JS dependencies
├── tsconfig.json              # TypeScript config
├── babel.config.js            # Babel preset
├── metro.config.js            # Metro bundler config
│
├── src/
│   ├── constants/
│   │   └── theme.ts           # Colors, typography, spacing, shadows
│   ├── services/
│   │   └── api.ts             # API calls + local auth helpers
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── TripCard.tsx
│   │   └── LoadingSpinner.tsx
│   ├── screens/
│   │   ├── AuthScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── TripPlannerScreen.tsx
│   │   ├── BucketListScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── navigation/
│       └── RootNavigator.tsx  # Auth-gated root + bottom tab nav
│
└── ios/
    ├── Podfile                # CocoaPods manifest
    ├── .xcode.env             # NODE_BINARY env override
    ├── WanderPlanAI/
    │   ├── AppDelegate.swift
    │   ├── Info.plist
    │   ├── LaunchScreen.storyboard
    │   └── Images.xcassets/
    └── WanderPlanAI.xcodeproj/
        └── project.pbxproj
```

## Getting started

> **macOS + Xcode 15 required** for iOS builds.

```bash
# From the repo root
cd mobile

# Install JS dependencies
npm install

# Install iOS native dependencies
cd ios && pod install && cd ..

# Start Metro bundler (keep running)
npm start

# Run on Simulator
npm run ios
```

## TestFlight distribution

See [`docs/IOS_TESTFLIGHT.md`](../docs/IOS_TESTFLIGHT.md) for the complete guide including:

- Apple Developer Portal setup
- Code signing (certificate + provisioning profile)
- GitHub Actions CI/CD secrets
- Manual build commands
- Inviting beta testers

## Design tokens

Colors, typography and spacing are defined in `src/constants/theme.ts` and mirror the web app's design system (`T` object in the JSX files) so both platforms stay visually consistent.

## API integration

All network calls go through `src/services/api.ts`.  Update the `API_BASE` constant (or the `REACT_APP_API_BASE` env var) to point to your production backend before submitting to TestFlight.
