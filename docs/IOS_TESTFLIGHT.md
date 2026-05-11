# WanderPlan AI – iOS TestFlight Guide

This document walks you through building the WanderPlan AI native iOS app (located in `mobile/`) and distributing it to beta testers via TestFlight.

---

## Architecture overview

The iOS app is a **React Native 0.74** application that mirrors the core features of the WanderPlan AI web app:

| Web screen | iOS screen |
|---|---|
| Homepage / Auth | `AuthScreen` |
| Dashboard | `DashboardScreen` |
| Trip planner chat | `TripPlannerScreen` |
| Bucket list | `BucketListScreen` |
| Profile / settings | `ProfileScreen` |

All API calls go to the same backend that serves the web app.  The base URL is configured in `mobile/src/services/api.ts`.

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| macOS | Ventura 13.x | Required for Xcode |
| Xcode | 15.x | Install from the Mac App Store |
| Node.js | 20 LTS | Install via [nvm](https://github.com/nvm-sh/nvm) |
| CocoaPods | 1.14 | `sudo gem install cocoapods` |
| Watchman | latest | `brew install watchman` |
| Apple Developer account | Paid ($99/yr) | Required for TestFlight |

---

## Local development setup

```bash
# 1. Clone the repo
git clone https://github.com/<org>/wanderplan-ai.git
cd wanderplan-ai/mobile

# 2. Install JS dependencies
npm install

# 3. Install iOS native dependencies
cd ios && pod install && cd ..

# 4. Start Metro bundler (keep this running in a separate terminal)
npm start

# 5. Run on the iOS Simulator
npm run ios
# or to target a specific simulator:
npx react-native run-ios --simulator="iPhone 15 Pro"
```

---

## Configuring the API base URL

By default the app connects to `http://localhost:8000`.

For a production build, set the environment variable before building:

```bash
# Create a local override file (git-ignored)
echo 'REACT_APP_API_BASE=https://api.wanderplan.ai' > .env.local
```

Or update the fallback directly in `mobile/src/services/api.ts`:

```ts
const API_BASE = process.env.REACT_APP_API_BASE ?? 'https://api.wanderplan.ai';
```

---

## Code signing setup

### 1. Apple Developer Portal

1. Log in at [developer.apple.com](https://developer.apple.com).
2. Navigate to **Certificates, Identifiers & Profiles**.
3. Create an **App ID**: `ai.wanderplan.app`.
4. Generate a **Distribution Certificate** (`.cer`), then export as a `.p12` file with a password.
5. Create an **App Store Distribution provisioning profile** for `ai.wanderplan.app` and download it.

### 2. App Store Connect

1. Log in at [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Create a new app: **My Apps → +**.
   - Platform: iOS
   - Name: WanderPlan AI
   - Bundle ID: `ai.wanderplan.app`
3. Go to **Users and Access → Integrations → App Store Connect API**.
4. Generate a new key (role: **App Manager**) and download the `.p8` file.
   Note the **Key ID** and **Issuer ID**.

### 3. GitHub repository secrets

Add the following secrets to your repository (**Settings → Secrets and variables → Actions**):

| Secret name | Value |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | `base64 -i Distribution.p12` |
| `BUILD_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `PROVISIONING_PROFILE_BASE64` | `base64 -i WanderPlan_Distribution.mobileprovision` |
| `KEYCHAIN_PASSWORD` | Any random string (used for the temporary CI keychain) |
| `APP_STORE_CONNECT_API_KEY_ID` | 10-character key ID from App Store Connect |
| `APP_STORE_CONNECT_API_ISSUER_ID` | UUID from App Store Connect |
| `APP_STORE_CONNECT_API_PRIVATE_KEY` | Contents of the `.p8` file |

---

## Building and uploading via CI (recommended)

Push a commit that changes any file under `mobile/` to the `main` branch.  The **iOS TestFlight Beta** GitHub Actions workflow (`.github/workflows/ios-testflight.yml`) will automatically:

1. Install JS and CocoaPods dependencies.
2. Import the distribution certificate and provisioning profile.
3. Build an Xcode archive.
4. Export an `.ipa` file.
5. Upload the `.ipa` to TestFlight using the App Store Connect API.

You can also trigger the workflow manually from the **Actions** tab with optional release notes.

---

## Building manually (local machine)

```bash
cd mobile/ios

# Build the archive
xcodebuild \
  -workspace WanderPlanAI.xcworkspace \
  -scheme WanderPlanAI \
  -sdk iphoneos \
  -configuration Release \
  -archivePath /tmp/WanderPlanAI.xcarchive \
  clean archive

# Export the IPA
xcodebuild \
  -exportArchive \
  -archivePath /tmp/WanderPlanAI.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath /tmp/WanderPlanAI-export
```

Then drag the `.ipa` from `/tmp/WanderPlanAI-export/` into the **Xcode Organizer** or use `altool`/`notarytool` to upload.

---

## Inviting TestFlight beta testers

1. In App Store Connect, navigate to your app → **TestFlight**.
2. Once the build is processed (usually 5–15 minutes), click on it.
3. Under **Test Information**, add release notes.
4. Under **Beta Testers**, add internal testers (team members) or create an **External Testing group** and add testers by email.
5. Testers receive an email with a link to install TestFlight and then the app.

---

## App versioning

- **Marketing version** (`MARKETING_VERSION`): human-readable (e.g. `1.0.0`). Update in `project.pbxproj` or Xcode's **General** tab.
- **Build number** (`CURRENT_PROJECT_VERSION`): must increment for every TestFlight upload. The CI workflow uses `github.run_number` to set this automatically.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `pod install` fails | Run `pod repo update` first, then retry |
| "No matching provisioning profile" | Ensure the bundle ID in Xcode matches `ai.wanderplan.app` |
| Metro bundler not found | Run `npm start` in `mobile/` before building |
| Build succeeds but crash on launch | Check that `Info.plist` has `NSAppTransportSecurity` configured for your API host |
| TestFlight shows "Missing Compliance" | Add `ITSAppUsesNonExemptEncryption = NO` to `Info.plist` if the app uses only HTTPS |

---

## Adding `ITSAppUsesNonExemptEncryption` (required for App Store)

If your app communicates exclusively over HTTPS and does not implement any custom encryption, add this key to `Info.plist` to skip the export compliance questionnaire:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```
