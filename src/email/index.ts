/**
 * Email helpers — the actual sending happens in a Firebase Cloud Function
 * (see functions/src/email.ts).  The frontend never sees or stores the
 * SendGrid API key; it only calls the callable function.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../firebase/client.js";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  /** Plain-text body (required). */
  text: string;
  /** Optional HTML body. */
  html?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  messageId: string;
  accepted: string[];
}

/**
 * Send a transactional email via a Firebase Cloud Function.
 *
 * The Cloud Function validates the payload and forwards it to SendGrid using
 * a secret API key stored in Firebase Functions configuration — never in the
 * client bundle.
 *
 * Requires the caller to be authenticated (Firebase Auth) so the function can
 * apply rate-limiting and abuse controls.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const app = getFirebaseApp();
  const functions = getFunctions(app);
  const callable = httpsCallable<EmailPayload, EmailResult>(functions, "sendEmail");
  const result = await callable(payload);
  return result.data;
}
