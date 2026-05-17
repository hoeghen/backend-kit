/** Shared Firebase stub used by all tests. */

export const mockCallable = jest.fn();
export const mockHttpsCallable = jest.fn(() => mockCallable);

// firebase/app
export const initializeApp = jest.fn(() => ({ name: "[DEFAULT]" }));
export const getApps = jest.fn(() => []);

// firebase/functions
export const getFunctions = jest.fn(() => ({}));
export const httpsCallable = mockHttpsCallable;
