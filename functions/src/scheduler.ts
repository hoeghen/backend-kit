/**
 * scheduleTask / cancelTask Cloud Functions
 *
 * Uses Google Cloud Tasks.  The service account key is handled automatically
 * by the Firebase runtime (Application Default Credentials) — no secret
 * needs to be set manually.
 *
 * Replace QUEUE_NAME, LOCATION, and PROJECT_ID with your values.
 */

import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { CloudTasksClient } from "@google-cloud/tasks";

const PROJECT_ID = process.env["GCLOUD_PROJECT"] ?? "your-project-id";
const LOCATION = "us-central1"; // must match your Functions region
const QUEUE_NAME = "default";

/** Only these function names may be invoked via scheduleTask. */
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

export const scheduleTaskFn = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError("unauthenticated", "Must be signed in to schedule tasks.");
  }

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

  const parent = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);

  const functionUrl = `https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/${targetFunction}`;

  const [task] = await tasksClient.createTask({
    parent,
    task: {
      name: `${parent}/tasks/${taskName}-${request.auth.uid}`,
      scheduleTime: { seconds: Math.floor(scheduleDate.getTime() / 1000) },
      httpRequest: {
        httpMethod: "POST",
        url: functionUrl,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify({ uid: request.auth.uid, ...data })).toString("base64"),
        oidcToken: { serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com` },
      },
    },
  });

  logger.info("Task scheduled", { taskName: task.name, scheduleTime });

  return {
    taskId: task.name ?? "",
    scheduledTime: scheduleTime,
    queueName: QUEUE_NAME,
  };
});

export const cancelTaskFn = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError("unauthenticated", "Must be signed in to cancel tasks.");
  }

  const { taskId } = request.data as CancelTaskPayload;

  // Verify the task name contains the caller's UID (simple ownership check).
  if (!taskId.includes(request.auth.uid)) {
    throw new functions.HttpsError("permission-denied", "You may only cancel your own tasks.");
  }

  await tasksClient.deleteTask({ name: taskId });
  logger.info("Task cancelled", { taskId });

  return { cancelled: true, taskId };
});
