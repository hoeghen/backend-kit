/**
 * Google Drive helpers — uses the browser OAuth flow (gapi / Google Identity
 * Services).  No server credentials are required; the user's own OAuth token
 * is used, so nothing sensitive ever leaves the browser.
 *
 * Pre-requisite: load the gapi script in your HTML, then call
 * `initGoogleDrive` once before using the other helpers.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

export interface DriveListOptions {
  /** Maximum number of files to return (default 20, max 1000). */
  pageSize?: number;
  /** MIME type filter, e.g. 'application/vnd.google-apps.document' */
  mimeType?: string;
  /** Drive query string appended verbatim, e.g. "name contains 'report'" */
  query?: string;
  pageToken?: string;
}

export interface DriveListResult {
  files: DriveFile[];
  nextPageToken?: string;
}

/** Minimal gapi shape — the real type comes from @types/gapi if installed. */
interface GapiClient {
  init: (opts: {
    clientId: string;
    scope: string;
    discoveryDocs: string[];
  }) => Promise<void>;
  drive: {
    files: {
      list: (params: Record<string, unknown>) => Promise<{ result: { files: DriveFile[]; nextPageToken?: string } }>;
      get: (params: { fileId: string; fields: string }) => Promise<{ result: DriveFile }>;
    };
  };
}
declare const gapi: { client: GapiClient; auth2: { getAuthInstance: () => { signIn: () => Promise<void>; signOut: () => Promise<void>; isSignedIn: { get: () => boolean } } } };

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

/**
 * Initialise the gapi client.  Call once on page load.
 *
 * @param clientId - Your OAuth 2.0 client ID (not a secret — safe to embed).
 */
export async function initGoogleDrive(clientId: string): Promise<void> {
  await gapi.client.init({
    clientId,
    scope: SCOPES,
    discoveryDocs: [DISCOVERY_DOC],
  });
}

/** Prompt the user to sign in with their Google account. */
export async function signInToGoogle(): Promise<void> {
  await gapi.auth2.getAuthInstance().signIn();
}

/** Sign the current user out. */
export async function signOutFromGoogle(): Promise<void> {
  await gapi.auth2.getAuthInstance().signOut();
}

/** Returns true when the user is currently authenticated. */
export function isSignedInToGoogle(): boolean {
  return gapi.auth2.getAuthInstance().isSignedIn.get();
}

/**
 * List files in the signed-in user's Drive.
 *
 * Access is scoped to `drive.readonly` — the package never requests write
 * permissions unless you extend the scope in `initGoogleDrive`.
 */
export async function listDriveFiles(options: DriveListOptions = {}): Promise<DriveListResult> {
  const { pageSize = 20, mimeType, query, pageToken } = options;

  const qParts: string[] = ["trashed = false"];
  if (mimeType) qParts.push(`mimeType = '${mimeType}'`);
  if (query) qParts.push(query);

  const params: Record<string, unknown> = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
    q: qParts.join(" and "),
  };
  if (pageToken) params["pageToken"] = pageToken;

  const response = await gapi.client.drive.files.list(params);
  return {
    files: response.result.files,
    nextPageToken: response.result.nextPageToken,
  };
}

/** Fetch metadata for a single file by ID. */
export async function getDriveFile(fileId: string): Promise<DriveFile> {
  const response = await gapi.client.drive.files.get({
    fileId,
    fields: "id, name, mimeType, modifiedTime, size",
  });
  return response.result;
}
