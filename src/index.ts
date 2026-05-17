// Firebase initialisation + App Check
export { getFirebaseApp, initFirebaseAppCheck, initFirebaseAppCheckDebug, type FirebaseConfig, type AppCheckConfig } from "./firebase/index.js";

// Google Drive
export {
  initGoogleDrive,
  signInToGoogle,
  signOutFromGoogle,
  isSignedInToGoogle,
  listDriveFiles,
  getDriveFile,
  type DriveFile,
  type DriveListOptions,
  type DriveListResult,
} from "./google-drive/index.js";

// Email
export { sendEmail, type EmailPayload, type EmailResult } from "./email/index.js";

// Scheduler
export {
  scheduleTask,
  cancelTask,
  type ScheduleTaskPayload,
  type ScheduleTaskResult,
  type CancelTaskPayload,
  type CancelTaskResult,
} from "./scheduler/index.js";
