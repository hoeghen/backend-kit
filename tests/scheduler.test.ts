import { mockCallable, mockHttpsCallable, getApps, initializeApp } from "./__mocks__/firebase";
import { scheduleTask, cancelTask } from "../src/scheduler";

(getApps as jest.Mock).mockReturnValue([{ name: "[DEFAULT]" }]);
(initializeApp as jest.Mock).mockReturnValue({ name: "[DEFAULT]" });

const futureTime = new Date(Date.now() + 3_600_000).toISOString();

describe("scheduleTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getApps as jest.Mock).mockReturnValue([{ name: "[DEFAULT]" }]);
  });

  it("calls the scheduleTask Cloud Function", async () => {
    const expected = { taskId: "task-1", scheduledTime: futureTime, queueName: "default" };
    mockCallable.mockResolvedValue({ data: expected });

    const result = await scheduleTask({
      taskName: "reminder",
      scheduleTime: futureTime,
      targetFunction: "sendReminderEmail",
      data: { userId: "42" },
    });

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "scheduleTask");
    expect(result).toEqual(expected);
  });
});

describe("cancelTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getApps as jest.Mock).mockReturnValue([{ name: "[DEFAULT]" }]);
  });

  it("calls the cancelTask Cloud Function", async () => {
    const expected = { cancelled: true, taskId: "task-1" };
    mockCallable.mockResolvedValue({ data: expected });

    const result = await cancelTask({ taskId: "task-1" });

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), "cancelTask");
    expect(result).toEqual(expected);
  });
});
