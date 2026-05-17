import { getApps, initializeApp } from "firebase/app";
import { getFirebaseApp } from "../src/firebase/client";

const mockGetApps = getApps as jest.Mock;
const mockInitializeApp = initializeApp as jest.Mock;

const config = {
  apiKey: "test-key",
  authDomain: "test.firebaseapp.com",
  projectId: "test-project",
  storageBucket: "test.appspot.com",
  messagingSenderId: "123",
  appId: "1:123:web:abc",
};

describe("getFirebaseApp", () => {
  beforeEach(() => jest.clearAllMocks());

  it("initialises a new app when none exists", () => {
    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockReturnValue({ name: "[DEFAULT]" });

    const app = getFirebaseApp(config);

    expect(mockInitializeApp).toHaveBeenCalledWith(config);
    expect(app).toEqual({ name: "[DEFAULT]" });
  });

  it("returns the existing app without re-initialising", () => {
    const existing = { name: "[DEFAULT]" };
    mockGetApps.mockReturnValue([existing]);

    const app = getFirebaseApp();

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(app).toBe(existing);
  });

  it("throws when no config is provided and no app exists", () => {
    mockGetApps.mockReturnValue([]);

    expect(() => getFirebaseApp()).toThrow(/No Firebase app is initialised yet/);
  });
});
