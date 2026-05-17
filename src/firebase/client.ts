import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Returns a singleton FirebaseApp.
 *
 * Pass your config once at app startup; subsequent calls return the same instance.
 * The config values are intentionally public — Firebase security is enforced
 * through Firestore/Storage Rules and IAM, not by hiding the config.
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
