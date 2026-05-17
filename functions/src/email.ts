/**
 * sendEmail Cloud Function
 *
 * Secret management:
 *   The SendGrid API key is stored in Firebase Functions configuration and is
 *   NEVER sent to the client.  Set it with:
 *
 *     firebase functions:secrets:set SENDGRID_API_KEY
 *
 * App Check:
 *   enforceAppCheck: true rejects any request that did not come from your
 *   registered app — even if someone copies your public Firebase config.
 *
 * Rate limiting:
 *   Each authenticated user is limited to MAX_EMAILS_PER_DAY emails per UTC
 *   day.  Counts are stored in Firestore under rateLimits/{uid}.
 */

import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import sgMail from "@sendgrid/mail";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const ALLOWED_SENDER    = "no-reply@example.com"; // replace with your verified sender
const MAX_EMAILS_PER_DAY = 20;

interface EmailPayload {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

export const sendEmailFn = functions.onCall(
  {
    secrets: ["SENDGRID_API_KEY"],
    enforceAppCheck: true, // rejects requests not from your verified app
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Must be signed in to send email.");
    }

    const uid = request.auth.uid;

    // ── Rate limit ──────────────────────────────────────────────────────────
    const today       = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const rateLimitRef = db.doc(`rateLimits/${uid}`);

    const count = await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateLimitRef);
      const data = snap.data() ?? {};
      const currentCount: number = data["date"] === today ? (data["emailsSent"] ?? 0) : 0;

      if (currentCount >= MAX_EMAILS_PER_DAY) return currentCount;

      tx.set(rateLimitRef, { date: today, emailsSent: currentCount + 1 }, { merge: true });
      return currentCount + 1;
    });

    if (count > MAX_EMAILS_PER_DAY) {
      throw new functions.HttpsError(
        "resource-exhausted",
        `Daily email limit of ${MAX_EMAILS_PER_DAY} reached. Try again tomorrow.`
      );
    }
    // ────────────────────────────────────────────────────────────────────────

    const payload = request.data as EmailPayload;

    if (!payload.to || !payload.subject || !payload.text) {
      throw new functions.HttpsError("invalid-argument", "to, subject, and text are required.");
    }

    const apiKey = process.env["SENDGRID_API_KEY"];
    if (!apiKey) throw new functions.HttpsError("internal", "SendGrid key not configured.");

    sgMail.setApiKey(apiKey);

    const msg = {
      to:      payload.to,
      from:    payload.from ?? ALLOWED_SENDER,
      replyTo: payload.replyTo,
      subject: payload.subject,
      text:    payload.text,
      html:    payload.html,
    };

    try {
      const [response] = await sgMail.send(msg);
      logger.info("Email sent", { uid, to: payload.to, statusCode: response.statusCode, dailyCount: count });
      return {
        messageId: response.headers["x-message-id"] ?? "unknown",
        accepted:  Array.isArray(payload.to) ? payload.to : [payload.to],
        remainingToday: MAX_EMAILS_PER_DAY - count,
      };
    } catch (err) {
      logger.error("SendGrid error", err);
      throw new functions.HttpsError("internal", "Failed to send email.");
    }
  }
);
