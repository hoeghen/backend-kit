/**
 * sendEmail Cloud Function — powered by Brevo (formerly Sendinblue)
 *
 * Secret management:
 *   Set your Brevo API key with:
 *     firebase functions:secrets:set BREVO_API_KEY
 *
 * App Check:
 *   enforceAppCheck: true rejects requests not from your verified app.
 *
 * Rate limiting:
 *   Each user is limited to MAX_EMAILS_PER_DAY per UTC day, tracked in Firestore.
 */

import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const BREVO_API_URL        = "https://api.brevo.com/v3/smtp/email";
const ALLOWED_SENDER_EMAIL = "no-reply@example.com"; // replace with your Brevo verified sender
const ALLOWED_SENDER_NAME  = "BackendKit";
const MAX_EMAILS_PER_DAY   = 20;

interface EmailPayload {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

export const sendEmailFn = functions.onCall(
  {
    secrets: ["BREVO_API_KEY"],
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Must be signed in to send email.");
    }

    const uid = request.auth.uid;

    // ── Rate limit ──────────────────────────────────────────────────────────
    const today        = new Date().toISOString().slice(0, 10);
    const rateLimitRef = db.doc(`rateLimits/${uid}`);

    const count = await db.runTransaction(async (tx) => {
      const snap    = await tx.get(rateLimitRef);
      const data    = snap.data() ?? {};
      const current = data["date"] === today ? (data["emailsSent"] as number ?? 0) : 0;
      if (current >= MAX_EMAILS_PER_DAY) return current;
      tx.set(rateLimitRef, { date: today, emailsSent: current + 1 }, { merge: true });
      return current + 1;
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

    const apiKey = process.env["BREVO_API_KEY"];
    if (!apiKey) throw new functions.HttpsError("internal", "Brevo API key not configured.");

    const toList = (Array.isArray(payload.to) ? payload.to : [payload.to]).map((email) => ({ email }));

    const body: Record<string, unknown> = {
      sender:      { email: payload.from ?? ALLOWED_SENDER_EMAIL, name: payload.fromName ?? ALLOWED_SENDER_NAME },
      to:          toList,
      subject:     payload.subject,
      textContent: payload.text,
    };
    if (payload.html)    body["htmlContent"] = payload.html;
    if (payload.replyTo) body["replyTo"]     = { email: payload.replyTo };

    const response = await fetch(BREVO_API_URL, {
      method:  "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error("Brevo API error", { status: response.status, body: err });
      throw new functions.HttpsError("internal", "Failed to send email.");
    }

    const result = await response.json() as { messageId?: string };
    logger.info("Email sent via Brevo", { uid, to: payload.to, messageId: result.messageId, dailyCount: count });

    return {
      messageId:      result.messageId ?? "unknown",
      accepted:       toList.map((a) => a.email),
      remainingToday: MAX_EMAILS_PER_DAY - count,
    };
  }
);
