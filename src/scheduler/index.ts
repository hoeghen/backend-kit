/**
 * Task scheduling helpers — delegates to a Firebase Cloud Function that
 * uses the Cloud Tasks API.  Credentials for Cloud Tasks live exclusively
 * in the server environment; the client only calls the callable function.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../firebase/client.js";

export type ScheduleTaskPayload = {
  /** Arbitrary task name (used for deduplication). */
  taskName: string;
  /** ISO-8601 date string for when to execute the task. */
  scheduleTime: string;
  /** Your own payload that the Cloud Function will receive when the task fires. */
  data: Record<string, unknown>;
  /**
   * Target Cloud Function name to invoke when the task fires.
   * Must be an allowlisted function name — the server validates this.
   */
  targetFunction: string;
};

export interface ScheduleTaskResult {
  taskId: string;
  scheduledTime: string;
  queueName: string;
}

export interface CancelTaskPayload {
  taskId: string;
}

export interface CancelTaskResult {
  cancelled: boolean;
  taskId: string;
}

/**
 * Schedule a Cloud Task via Firebase Functions.
 *
 * The callable function validates that `targetFunction` is in its allowlist
 * before enqueuing — preventing arbitrary function invocation from the client.
 *
 * @example
 * await scheduleTask({
 *   taskName: "send-reminder-user-42",
 *   scheduleTime: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour
 *   targetFunction: "sendReminderEmail",
 *   data: { userId: "42" },
 * });
 */
export async function scheduleTask(payload: ScheduleTaskPayload): Promise<ScheduleTaskResult> {
  const app = getFirebaseApp();
  const functions = getFunctions(app);
  const callable = httpsCallable<ScheduleTaskPayload, ScheduleTaskResult>(functions, "scheduleTask");
  const result = await callable(payload);
  return result.data;
}

/**
 * Cancel a previously scheduled task.
 *
 * Only the task owner (determined server-side via Firebase Auth UID) may
 * cancel it.
 */
export async function cancelTask(payload: CancelTaskPayload): Promise<CancelTaskResult> {
  const app = getFirebaseApp();
  const functions = getFunctions(app);
  const callable = httpsCallable<CancelTaskPayload, CancelTaskResult>(functions, "cancelTask");
  const result = await callable(payload);
  return result.data;
}
