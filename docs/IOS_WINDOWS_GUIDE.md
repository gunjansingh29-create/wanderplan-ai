# WanderPlan AI — iOS Development on Windows

## Overview

Apple's toolchain (`Xcode`, `xcodebuild`, the iOS Simulator) runs **only on macOS**.
This means a Windows machine can never build or sign an iOS binary locally.
Despite that limitation, Windows developers can still write all application code,
test it in-browser, and ship a signed `.ipa` to **TestFlight** by pushing to GitHub and
letting a cloud macOS runner do the build.

This guide covers:

1. [What works on Windows](#what-works-on-windows)
2. [What does not work on Windows](#what-does-not-work-on-windows)
3. [Prerequisites](#prerequisites)
4. [Adding Capacitor to the project](#adding-capacitor-to-the-project)
5. [Apple Developer account setup](#apple-developer-account-setup)
6. [Certificate and provisioning management with Fastlane Match](#certificate-and-provisioning-management-with-fastlane-match)
7. [GitHub Actions workflow for automated TestFlight delivery](#github-actions-workflow-for-automated-testflight-delivery)
8. [Monitoring the build and accepting the TestFlight build](#monitoring-the-build-and-accepting-the-testflight-build)
9. [Troubleshooting](#troubleshooting)

---

## What works on Windows

| Task | Tool | Notes |
|---|---|---|
| Writing React / JS / CSS code | VS Code, any editor | No restriction |
| Running the web app locally | `npm start` (CRA) | `http://localhost:3000` |
| Simulating mobile viewports | Chrome DevTools → Device toolbar | Mimics iPhone screen sizes |
| Adding the Capacitor iOS platform | `npx cap add ios` | Generates the Xcode project on disk |
| Syncing web assets to native | `npx cap sync` | Copies `build/` into the Xcode project |
| Linting, unit tests, E2E tests | `npm test`, Playwright | Full test suite runs on Windows |
| Signing certificate management | Fastlane Match (run on CI) | Certificates stored in a private Git repo |
| Uploading to TestFlight | Fastlane Pilot / `xcrun altool` (run on CI) | Runs inside the macOS GitHub Actions runner |

---

## What does not work on Windows

| Task | Why |
|---|---|
| Opening Xcode | Xcode is macOS-only; `npx cap open ios` will fail |
| Running the iOS Simulator | Simulator is bundled with Xcode |
| `xcodebuild` CLI | macOS-only binary |
| Direct USB device testing | Requires Xcode's device manager |
| Generating ad-hoc or development `.ipa` files locally | Requires `xcodebuild archive` |

> **Workaround for all of the above:** push a commit to GitHub and let the
> macOS CI runner (see [below](#github-actions-workflow-for-automated-testflight-delivery))
> do the build. Builds typically complete in 10–20 minutes.

---

## Prerequisites

### On your Windows machine

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or later | Install via [nodejs.org](https://nodejs.org) or `winget install OpenJS.NodeJS.LTS` |
| npm | bundled with Node | |
| Git | latest | [git-scm.com](https://git-scm.com/) |
| Java JDK (optional, Android only) | 17 | Only needed if you also target Android |

### On Apple side

- An **Apple Developer Program** membership ($99 / year) — required to submit to TestFlight.
- An **App Store Connect** app record created for WanderPlan AI.
- An **App ID** (bundle identifier, e.g. `com.yourcompany.wanderplanai`) registered in the Apple Developer portal.

### GitHub / CI side

- A **private GitHub repository** to store Fastlane Match certificates
  (can be a new empty repository, e.g. `your-org/ios-certificates`).
- GitHub Actions secrets configured (see [below](#github-actions-secrets)).

---

## Adding Capacitor to the project

Capacitor wraps the React web app inside a native iOS container.

### 1. Install Capacitor

```bash
npm install @capacitor/core @capacitor/ios
npm install --save-dev @capacitor/cli
```

### 2. Initialize Capacitor

From the repository root:

```bash
npx cap init "WanderPlan AI" com.yourcompany.wanderplanai --web-dir build
```

Replace `com.yourcompany.wanderplanai` with your actual bundle ID.

A `capacitor.config.json` file is created at the root. Verify it looks like:

```json
{
  "appId": "com.yourcompany.wanderplanai",
  "appName": "WanderPlan AI",
  "webDir": "build",
  "server": {
    "androidScheme": "https"
  }
}
```

### 3. Add the iOS platform

```bash
npx cap add ios
```

This creates an `ios/` directory containing a full Xcode project.
Commit `ios/` to Git so the macOS CI runner can open it.

### 4. Build and sync

Every time you change React code, run:

```bash
npm run build          # compiles React → build/
npx cap sync ios       # copies build/ into ios/App/App/public/
```

---

## Apple Developer account setup

1. Sign in to [developer.apple.com](https://developer.apple.com).
2. Under **Certificates, Identifiers & Profiles**:
   - Register an **App ID** (bundle ID must match `capacitor.config.json`).
   - Enable **Push Notifications** and any other capabilities you need.
3. In [App Store Connect](https://appstoreconnect.apple.com):
   - Create a **New App** record, selecting your bundle ID.
   - Fill in the default language, SKU, and primary category.
4. Create an **App Store Connect API Key**:
   - *Users and Access* → *Integrations* → *App Store Connect API* → Generate key.
   - Download the `.p8` file immediately — it is only available once.
   - Note the **Key ID** and **Issuer ID**.

---

## Certificate and provisioning management with Fastlane Match

[Fastlane Match](https://docs.fastlane.tools/actions/match/) stores encrypted
certificates and profiles in a private Git repository so that any CI machine can
download and install them without manual Keychain management.

### 1. Install Fastlane (on a macOS machine or inside the CI runner)

Fastlane only needs to be configured once; after that all runs happen on CI.
If you have temporary access to a Mac (a colleague's machine, a cloud VM), run:

```bash
brew install fastlane
```

Alternatively the GitHub Actions runner installs it automatically (see workflow below).

### 2. Create a Fastfile

Create `ios/fastlane/Fastfile` in your repository:

```ruby
default_platform(:ios)

platform :ios do

  desc "Fetch or create certificates/profiles with Match"
  lane :certificates do
    match(
      type: "appstore",
      app_identifier: "com.yourcompany.wanderplanai",
      git_url: ENV["MATCH_GIT_URL"],
      password: ENV["MATCH_PASSWORD"],
      readonly: true
    )
  end

  desc "Build and upload to TestFlight"
  lane :beta do
    certificates

    increment_build_number(
      build_number: ENV["BUILD_NUMBER"] || Time.now.strftime("%Y%m%d%H%M"),
      xcodeproj: "App/App.xcodeproj"
    )

    build_app(
      workspace: "App/App.xcworkspace",
      scheme: "App",
      configuration: "Release",
      export_method: "app-store",
      export_options: {
        provisioningProfiles: {
          "com.yourcompany.wanderplanai" => "match AppStore com.yourcompany.wanderplanai"
        }
      }
    )

    upload_to_testflight(
      api_key_path: "fastlane/api_key.json",
      skip_waiting_for_build_processing: true
    )
  end

end
```

Create `ios/fastlane/Appfile`:

```ruby
app_identifier "com.yourcompany.wanderplanai"
apple_id        ENV["APPLE_ID"]
team_id         ENV["APPLE_TEAM_ID"]
```

### 3. Create the API key JSON file template

Create `ios/fastlane/api_key.json` **but do not commit it** — it will be generated by
CI from the secret values:

```json
{
  "key_id":     "XXXXXXXXXX",
  "issuer_id":  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "key":        "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "duration":   1200,
  "in_house":   false
}
```

Add `ios/fastlane/api_key.json` to `.gitignore`.

### 4. Bootstrap Match certificates (one-time, requires a Mac)

```bash
cd ios
bundle exec fastlane match appstore --git_url https://github.com/your-org/ios-certificates
```

Follow the prompts to create or import the distribution certificate and provisioning
profile. They are encrypted and pushed to your certificates repository.

---

## GitHub Actions workflow for automated TestFlight delivery

### GitHub Actions secrets

Add the following secrets in your repository under
*Settings → Secrets and variables → Actions*:

| Secret name | Value |
|---|---|
| `MATCH_GIT_URL` | HTTPS URL of the private certificates repository |
| `MATCH_PASSWORD` | The passphrase you chose when running `fastlane match` |
| `APPLE_ID` | Your Apple ID email address |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | App Store Connect Issuer ID |
| `ASC_PRIVATE_KEY` | Contents of the `.p8` file (the full PEM text) |
| `MATCH_GIT_BASIC_AUTH` | `username:personal_access_token` for the certificates repo |

### Workflow file

Create `.github/workflows/testflight.yml`:

```yaml
name: iOS TestFlight

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  testflight:
    runs-on: macos-14          # Apple Silicon runner — fastest Xcode builds
    timeout-minutes: 40

    steps:
      # ── Checkout ──────────────────────────────────────────────────────
      - name: Checkout repository
        uses: actions/checkout@v4

      # ── Node / React build ────────────────────────────────────────────
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install JS dependencies
        run: npm ci

      - name: Build React app
        run: npm run build

      # ── Capacitor sync ────────────────────────────────────────────────
      - name: Sync Capacitor
        run: npx cap sync ios

      # ── Ruby / Fastlane ───────────────────────────────────────────────
      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
          working-directory: ios

      - name: Install Fastlane
        working-directory: ios
        run: bundle install

      # ── App Store Connect API key ─────────────────────────────────────
      - name: Write ASC API key
        working-directory: ios
        env:
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_PRIVATE_KEY: ${{ secrets.ASC_PRIVATE_KEY }}
        run: |
          mkdir -p fastlane
          cat > fastlane/api_key.json <<EOF
          {
            "key_id":    "$ASC_KEY_ID",
            "issuer_id": "$ASC_ISSUER_ID",
            "key":       "$ASC_PRIVATE_KEY",
            "duration":  1200,
            "in_house":  false
          }
          EOF

      # ── Match certificates ────────────────────────────────────────────
      - name: Install Match certificates
        working-directory: ios
        env:
          MATCH_GIT_URL:          ${{ secrets.MATCH_GIT_URL }}
          MATCH_PASSWORD:         ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_BASIC_AUTH:   ${{ secrets.MATCH_GIT_BASIC_AUTH }}
        run: bundle exec fastlane certificates

      # ── Build & upload ────────────────────────────────────────────────
      - name: Build and upload to TestFlight
        working-directory: ios
        env:
          MATCH_GIT_URL:        ${{ secrets.MATCH_GIT_URL }}
          MATCH_PASSWORD:       ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_BASIC_AUTH: ${{ secrets.MATCH_GIT_BASIC_AUTH }}
          APPLE_ID:             ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID:        ${{ secrets.APPLE_TEAM_ID }}
          BUILD_NUMBER:         ${{ github.run_number }}
        run: bundle exec fastlane beta
```

### Gemfile for Fastlane

Create `ios/Gemfile`:

```ruby
source "https://rubygems.org"

gem "fastlane"
```

---

## Monitoring the build and accepting the TestFlight build

1. **GitHub Actions**: Go to *Actions → iOS TestFlight* in your repository.
   The workflow takes approximately 10–20 minutes on a `macos-14` runner.

2. **App Store Connect processing**: After the `.ipa` is uploaded, Apple processes
   it (usually 5–30 minutes). You will receive an email when it is ready.

3. **Add testers**:
   - *TestFlight* tab in App Store Connect → select your build.
   - *Internal Testing* → invite team members by Apple ID.
   - *External Testing* → submit a beta review if you want to invite users outside
     your organisation (review typically takes 1–2 business days).

4. **Testers install the app** via the TestFlight app on their iPhone/iPad.

---

## Troubleshooting

### `npx cap open ios` fails on Windows

This command tries to launch Xcode, which is macOS-only. It will always fail on
Windows. Use the GitHub Actions workflow to trigger builds instead.

### `xcodebuild: not found` in CI

Ensure the workflow uses a `macos-*` runner, not `ubuntu-*` or `windows-*`.

### Match: `remote: Repository not found`

Check that `MATCH_GIT_URL` points to a private repository you own, and that
`MATCH_GIT_BASIC_AUTH` contains a valid GitHub Personal Access Token with
`repo` scope for that repository.

### Build fails: `No profiles for 'com.yourcompany.wanderplanai' were found`

Run `fastlane match appstore` once from a Mac to generate and upload the
provisioning profile, then re-run the workflow.

### Upload fails: `Invalid API key`

Verify the `.p8` key contents in `ASC_PRIVATE_KEY` include the full
`-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` header and footer,
with literal `\n` replaced by actual newlines.

### Build number conflict: `CFBundleVersion already exists`

The workflow sets `BUILD_NUMBER` to `github.run_number`, which increments
automatically. If you re-ran a failed workflow, Apple may have already seen that
number. Increment it manually with `workflow_dispatch` and override the input, or
use a timestamp-based number by removing the `BUILD_NUMBER` env override.
