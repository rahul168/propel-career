import { tryConsumeCredits, consumeCreditsOrThrow, InsufficientCreditsError } from "./consume";

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      updateMany: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("@/lib/db/prisma");
const mockUpdateMany = prisma.user.updateMany as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("tryConsumeCredits", () => {
  it("returns true and calls updateMany with correct args when credits are sufficient", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await tryConsumeCredits("user_123", 1);

    expect(result).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_123", credits: { gte: 1 } },
      data: { credits: { decrement: 1 } },
    });
  });

  it("returns false when user has insufficient credits (count: 0)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await tryConsumeCredits("user_123", 1);

    expect(result).toBe(false);
  });

  it("returns false immediately for empty userId without querying the DB", async () => {
    const result = await tryConsumeCredits("", 1);

    expect(result).toBe(false);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("passes correct amount in where/data clauses for multi-credit deductions", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await tryConsumeCredits("user_abc", 3);

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user_abc", credits: { gte: 3 } },
      data: { credits: { decrement: 3 } },
    });
  });

  it("throws for amount of zero", async () => {
    await expect(tryConsumeCredits("user_123", 0)).rejects.toThrow("Invalid credit amount: 0");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("throws for negative amount", async () => {
    await expect(tryConsumeCredits("user_123", -1)).rejects.toThrow("Invalid credit amount: -1");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("throws for non-integer amount", async () => {
    await expect(tryConsumeCredits("user_123", 1.5)).rejects.toThrow("Invalid credit amount: 1.5");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("consumeCreditsOrThrow", () => {
  it("resolves without a value when credits are available", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await expect(consumeCreditsOrThrow("user_123", 1)).resolves.toBeUndefined();
  });

  it("throws InsufficientCreditsError when credits are insufficient", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(consumeCreditsOrThrow("user_123", 1)).rejects.toThrow(InsufficientCreditsError);
  });

  it("thrown error has correct message and name", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    let caught: unknown;
    try {
      await consumeCreditsOrThrow("user_123", 1);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(InsufficientCreditsError);
    expect((caught as Error).message).toBe("Insufficient credits");
    expect((caught as Error).name).toBe("InsufficientCreditsError");
  });

  it("propagates DB errors unchanged", async () => {
    mockUpdateMany.mockRejectedValue(new Error("DB connection lost"));

    await expect(consumeCreditsOrThrow("user_123", 1)).rejects.toThrow("DB connection lost");
  });
});
