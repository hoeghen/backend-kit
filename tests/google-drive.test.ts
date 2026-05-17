/**
 * Google Drive tests use a manual gapi stub injected via globalThis.
 * The real gapi is loaded in the browser, so we stub its shape here.
 */

const mockFiles = [
  { id: "1", name: "Report.pdf", mimeType: "application/pdf", modifiedTime: "2024-01-01" },
];

const mockGapi = {
  client: {
    init: jest.fn().mockResolvedValue(undefined),
    drive: {
      files: {
        list: jest.fn().mockResolvedValue({ result: { files: mockFiles, nextPageToken: undefined } }),
        get: jest.fn().mockResolvedValue({ result: mockFiles[0] }),
      },
    },
  },
  auth2: {
    getAuthInstance: jest.fn(() => ({
      signIn: jest.fn().mockResolvedValue(undefined),
      signOut: jest.fn().mockResolvedValue(undefined),
      isSignedIn: { get: jest.fn(() => true) },
    })),
  },
};

// Inject stub before importing the module
(globalThis as unknown as Record<string, unknown>)["gapi"] = mockGapi;

import { initGoogleDrive, listDriveFiles, getDriveFile, isSignedInToGoogle } from "../src/google-drive";

describe("Google Drive helpers", () => {
  it("initialises gapi client", async () => {
    await initGoogleDrive("client-id-123");
    expect(mockGapi.client.init).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-id-123" })
    );
  });

  it("lists files with default options", async () => {
    const result = await listDriveFiles();
    expect(mockGapi.client.drive.files.list).toHaveBeenCalled();
    expect(result.files).toEqual(mockFiles);
    expect(result.nextPageToken).toBeUndefined();
  });

  it("lists files with mimeType filter", async () => {
    await listDriveFiles({ mimeType: "application/pdf" });
    const call = mockGapi.client.drive.files.list.mock.calls.at(-1)![0] as { q: string };
    expect(call.q).toContain("mimeType = 'application/pdf'");
  });

  it("gets a file by id", async () => {
    const file = await getDriveFile("1");
    expect(mockGapi.client.drive.files.get).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: "1" })
    );
    expect(file).toEqual(mockFiles[0]);
  });

  it("returns sign-in state", () => {
    expect(isSignedInToGoogle()).toBe(true);
  });
});
