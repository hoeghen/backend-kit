import { mockCallable, mockHttpsCallable, getApps, initializeApp } from "./__mocks__/firebase";
import { sendEmail } from "../src/email";

// Seed the shared mock so getFirebaseApp() finds an existing app
(getApps as jest.Mock).mockReturnValue([{ name: "[DEFAULT]" }]);
(initializeApp as jest.Mock).mockReturnValue({ name: "[DEFAULT]" });

describe("sendEmail", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls the sendEmail Cloud Function with the payload", async () => {
    (getApps as jest.Mock).mockReturnValue([{ name: "[DEFAULT]" }]);
    const expected = { messageId: "msg-123", accepted: ["user@example.com"] };
    mockCallable.mockResolvedValue({ data: expected });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Hello",
      text: "World",
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "sendEmail");
    expect(mockCallable).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Hello",
      text: "World",
    });
    expect(result).toEqual(expected);
  });

  it("propagates errors thrown by the callable", async () => {
    (getApps as jest.Mock).mockReturnValue([{ name: "[DEFAULT]" }]);
    mockCallable.mockRejectedValue(new Error("unauthenticated"));

    await expect(
      sendEmail({ to: "x@y.com", subject: "S", text: "T" })
    ).rejects.toThrow("unauthenticated");
  });
});
