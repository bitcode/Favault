/**
 * Firefox user preferences for Playwright extension testing.
 * Suppresses the welcome wizard, first-run screens, and other
 * browser UI that would block automated tests.
 *
 * Imported by both playwright.config.ts (project-level prefs) and
 * tests/playwright/fixtures/extension.ts (profile-based launch).
 */
export const FIREFOX_USER_PREFS = {
  // Override Playwright's Firefox defaults that disable the new tab page.
  // playwright.cfg sets browser.newtabpage.enabled=false and browser.startup.page=0,
  // which prevents chrome_url_overrides.newtab from working. User prefs override defaults.
  'browser.newtabpage.enabled': true,
  'browser.startup.page': 3,  // 3 = open new tab page (not blank)

  // Extension loading
  'extensions.autoDisableScopes': 0,
  'extensions.enabledScopes': 15,
  'xpinstall.signatures.required': false,
  'xpinstall.whitelist.required': false,
  'extensions.experiments.enabled': true,
  'extensions.legacy.enabled': true,

  // First-run / welcome wizard suppression
  'browser.aboutwelcome.enabled': false,
  'trailhead.firstrun.branches': 'nofirstrun-empty',
  'browser.startup.homepage_override.mstone': 'ignore',
  'browser.startup.firstrunSkipsHomepage': true,
  'startup.homepage_welcome_url': 'about:blank',
  'startup.homepage_welcome_url.additional': '',

  // Default browser check
  'browser.shell.checkDefaultBrowser': false,
  'browser.shell.didSkipDefaultBrowserCheckOnFirstRun': true,

  // Firefox View tab (Firefox 106+)
  'browser.tabs.firefox-view-next': false,
  'browser.tabs.firefox-view': false,

  // Sync / Firefox Accounts sign-in prompts
  'identity.fxaccounts.enabled': false,

  // Normandy experiments / Shield studies
  'app.normandy.enabled': false,
  'app.shield.optoutstudies.enabled': false,

  // UI tour
  'browser.uitour.enabled': false,

  // Auto-update prompts
  'app.update.enabled': false,
  'app.update.auto': false,

  // Tabs / session
  'browser.tabs.warnOnClose': false,
  'browser.sessionstore.resume_from_crash': false,

  // Telemetry / data reporting
  'datareporting.policy.dataSubmissionEnabled': false,
  'datareporting.healthreport.uploadEnabled': false,
  'datareporting.policy.firstRunURL': '',
  'datareporting.policy.dataSubmissionPolicyAcceptedVersion': 2,
  'toolkit.telemetry.reportingpolicy.firstRun': false,
  'toolkit.telemetry.reportingpolicy.firstRunShown': true,
  'toolkit.telemetry.enabled': false,

  // Recommendations / CFR
  'browser.messaging-system.whatsNewPanel.enabled': false,
  'browser.discovery.enabled': false,
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons': false,
  'browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features': false,

  // Remote debugging (used by Playwright)
  'devtools.debugger.remote-enabled': true,
  'devtools.debugger.prompt-connection': false,

  // Crash recovery wizard
  'toolkit.startup.max_resumed_crashes': -1
} as const;
