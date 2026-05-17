/**
 * scheduleTask / cancelTask Cloud Functions
 *
 * Uses Google Cloud Tasks.  The service account key is handled automatically
 * by the Firebase runtime (Application Default Credentials) — no secret
 * needs to be set manually.
 *
 * App Check:
 *   enforceAppCheck: true rejects any request that did not come from your
 *   registered app.
 *
 * Rate limiting:
 *   Each user may have at most MAX_ACTIVE_TASKS active tasks at once.
 *   Active task IDs are tracked in Firestore under scheduledTasks/{uid}.
 */

import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { CloudTasksClient } from "@google-cloud/tasks";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PROJECT_ID     = process.env["GCLOUD_PROJECT"] ?? "your-project-id";
const LOCATION       = "us-central1";
const QUEUE_NAME     = "default";
const MAX_ACTIVE_TASKS = 10;

const ALLOWED_TARGET_FUNCTIONS = new Set(["sendReminderEmail", "generateWeeklyReport"]);

const tasksClient = new CloudTasksClient();

interface ScheduleTaskPayload {
  taskName: string;
  scheduleTime: string;
  data: Record<string, unknown>;
  targetFunction: string;
}

interface CancelTaskPayload {
  taskId: string;
}

export const scheduleTaskFn = functions.onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Must be signed in to schedule tasks.");
    }

    const uid = request.auth.uid;
    const { taskName, scheduleTime, data, targetFunction } = request.data as ScheduleTaskPayload;

    if (!ALLOWED_TARGET_FUNCTIONS.has(targetFunction)) {
      throw new functions.HttpsError(
        "permission-denied",
        `targetFunction '${targetFunction}' is not in the allowlist.`
      );
    }

    const scheduleDate = new Date(scheduleTime);
    if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
      throw new functions.HttpsError("invalid-argument", "scheduleTime must be a future ISO-8601 date.");
    }

    // ── Rate limit: max active tasks per user ──────────────────────────────
    const userTasksRef = db.doc(`scheduledTasks/${uid}`);
    const snap = await userTasksRef.get();
    const activeTasks: string[] = snap.data()?.["taskIds"] ?? [];

    if (activeTasks.length >= MAX_ACTIVE_TASKS) {
      throw new functions.HttpsError(
        "resource-exhausted",
        `Maximum of ${MAX_ACTIVE_TASKS} active tasks reached. Cancel some before scheduling more.`
      );
    }
    // ───────────────────────────────────────────────────────────────────────

    const parent      = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);
    const functionUrl = `https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/${targetFunction}`;

    const [task] = await tasksClient.createTask({
      parent,
      task: {
        name: `${parent}/tasks/${taskName}-${uid}`,
        scheduleTime: { seconds: Math.floor(scheduleDate.getTime() / 1000) },
        httpRequest: {
          httpMethod:  "POST",
          url:         functionUrl,
          headers:     { "Content-Type": "application/json" },
          body:        Buffer.from(JSON.stringify({ uid, ...data })).toString("base64"),
          oidcToken:   { serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com` },
        },
      },
    });

    const taskId = task.name ?? "";

    // Track the task ID so we can enforce the per-user limit
    await userTasksRef.set({ taskIds: [...activeTasks, taskId] }, { merge: true });

    logger.info("Task scheduled", { uid, taskId, scheduleTime });

    return { taskId, scheduledTime: scheduleTime, queueName: QUEUE_NAME };
  }
);

export const cancelTaskFn = functions.onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Must be signed in to cancel tasks.");
    }

    const uid = request.auth.uid;
    const { taskId } = request.data as CancelTaskPayload;

    if (!taskId.includes(uid)) {
      throw new functions.HttpsError("permission-denied", "You may only cancel your own tasks.");
    }

    await tasksClient.deleteTask({ name: taskId });

    // Remove from the user's active-task list
    const userTasksRef = db.doc(`scheduledTasks/${uid}`);
    const snap = await userTasksRef.get();
    const remaining = (snap.data()?.["taskIds"] ?? []).filter((id: string) => id !== taskId);
    await userTasksRef.set({ taskIds: remaining });

    logger.info("Task cancelled", { uid, taskId });

    return { cancelled: true, taskId };
  }
);
