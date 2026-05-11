/**
 * WanderPlan AI – AppDelegate.swift
 *
 * Standard React Native AppDelegate.  Replace the bundle URL with your
 * production JS bundle URL before submitting to TestFlight.
 */
import UIKit
import React
import RCTAppDelegate

@UIApplicationMain
class AppDelegate: RCTAppDelegate {

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    self.moduleName = "WanderPlanAI"

    // Pass any initial props to the React Native layer here.
    self.initialProps = [:]

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
#if DEBUG
    return self.bundleURL()
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  override func bundleURL() -> URL? {
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
  }
}
