/**
 * sendEmail Cloud Function
 *
 * Secret management:
 *   The SendGrid API key is stored in Firebase Functions configuration and is
 *   NEVER sent to the client.  Set it with:
 *
 *     firebase functions:secrets:set SENDGRID_API_KEY
 *
 *   Then access it via process.env.SENDGRID_API_KEY inside the function.
 */

import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import sgMail from "@sendgrid/mail";

interface EmailPayload {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

const ALLOWED_SENDER = "no-reply@example.com"; // replace with your verified sender

export const sendEmailFn = functions.onCall(
  {
    // Declare the secret — Firebase injects it as an env var at runtime only.
    secrets: ["SENDGRID_API_KEY"],
    // Require the caller to be authenticated.
    enforceAppCheck: false, // set true if you enable App Check
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Must be signed in to send email.");
    }

    const payload = request.data as EmailPayload;

    if (!payload.to || !payload.subject || !payload.text) {
      throw new functions.HttpsError("invalid-argument", "to, subject, and text are required.");
    }

    const apiKey = process.env["SENDGRID_API_KEY"];
    if (!apiKey) throw new functions.HttpsError("internal", "SendGrid key not configured.");

    sgMail.setApiKey(apiKey);

    const msg = {
      to: payload.to,
      from: payload.from ?? ALLOWED_SENDER,
      replyTo: payload.replyTo,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };

    try {
      const [response] = await sgMail.send(msg);
      logger.info("Email sent", { to: payload.to, statusCode: response.statusCode });
      return {
        messageId: response.headers["x-message-id"] ?? "unknown",
        accepted: Array.isArray(payload.to) ? payload.to : [payload.to],
      };
    } catch (err) {
      logger.error("SendGrid error", err);
      throw new functions.HttpsError("internal", "Failed to send email.");
    }
  }
);
