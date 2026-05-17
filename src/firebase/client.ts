import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider, type AppCheck } from "firebase/app-check";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface AppCheckConfig {
  /** reCAPTCHA v3 site key — safe to embed, it is a public key. */
  recaptchaSiteKey: string;
  /**
   * Set to true during local development to skip token verification.
   * Never set in production — the Functions will reject un-checked requests.
   */
  debug?: boolean;
}

/**
 * Returns a singleton FirebaseApp.
 *
 * Pass your config once at app startup; subsequent calls return the same instance.
 * The config values are intentionally public — Firebase security is enforced
 * through Firestore/Storage Rules, IAM, and App Check — not by hiding the config.
 */
export function getFirebaseApp(config?: FirebaseConfig): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;

  if (!config) {
    throw new Error(
      "No Firebase app is initialised yet. Call getFirebaseApp(config) with your project config first."
    );
  }

  return initializeApp(config);
}

/**
 * Enable Firebase App Check with reCAPTCHA v3.
 *
 * App Check cryptographically proves that requests come from your app,
 * not from a script that scraped your public Firebase config.
 *
 * Call this once, immediately after getFirebaseApp(), before any other
 * Firebase service is used.
 *
 * Prerequisites:
 *  1. Enable App Check in the Firebase console (Build → App Check).
 *  2. Register your site with reCAPTCHA v3 at https://www.google.com/recaptcha/admin.
 *  3. In Firebase console → App Check → Apps, register your web app with the
 *     reCAPTCHA v3 provider and paste the site key here.
 *  4. In Firebase console → App Check → APIs, enforce App Check for
 *     Cloud Functions (and Firestore if desired).
 *
 * @example
 * const app = getFirebaseApp(config);
 * initFirebaseAppCheck(app, { recaptchaSiteKey: import.meta.env.VITE_RECAPTCHA_SITE_KEY });
 */
export function initFirebaseAppCheck(app: FirebaseApp, cfg: AppCheckConfig): AppCheck {
  if (cfg.debug) {
    // In debug mode the SDK uses a self-signed token accepted by the emulator.
    // The cast is needed because the global is injected at runtime.
    (self as unknown as Record<string, unknown>)["FIREBASE_APPCHECK_DEBUG_TOKEN"] = true;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(cfg.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

/**
 * App Check provider for environments where reCAPTCHA cannot run (e.g. unit
 * tests, CI).  Returns a fixed debug token that is accepted by the emulator
 * but rejected by production Firebase — safe to use in test code only.
 */
export function initFirebaseAppCheckDebug(app: FirebaseApp): AppCheck {
  (self as unknown as Record<string, unknown>)["FIREBASE_APPCHECK_DEBUG_TOKEN"] = true;
  return initializeAppCheck(app, {
    provider: new CustomProvider({ getToken: async () => ({ token: "debug-token", expireTimeMillis: Date.now() + 3_600_000 }) }),
    isTokenAutoRefreshEnabled: false,
  });
}
