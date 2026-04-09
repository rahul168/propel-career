/**
 * Unit tests for SendGrid email helpers.
 *
 * Strategy: jest.resetModules() + jest.doMock() + require() re-initialises the
 * module under test for each case, so the module-level `const SENDGRID_API_KEY`
 * capture and `sgMail.setApiKey()` call pick up the correct env / mock state.
 */

const mockSend = jest.fn();
const mockSetApiKey = jest.fn();

const TICKET_PARAMS = {
  ticketId: "clticket123",
  userEmail: "jane@example.com",
  subject: "Cannot download PDF",
  category: "technical",
  message: "I click the download button but nothing happens on my Mac.",
};

function loadModule() {
  jest.doMock("@sendgrid/mail", () => ({
    __esModule: true,
    default: { setApiKey: mockSetApiKey, send: mockSend },
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/email/sendgrid") as typeof import("./sendgrid");
}

beforeEach(() => {
  jest.resetModules();
  mockSend.mockClear().mockResolvedValue([{ statusCode: 202 }, {}]);
  mockSetApiKey.mockClear();
});

// ── Configured (API key present) ─────────────────────────────────────────────

describe("when SENDGRID_API_KEY is set", () => {
  beforeEach(() => {
    process.env.SENDGRID_API_KEY = "SG.test-key-abc123";
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
  });

  describe("sendAdminTicketNotification", () => {
    it("calls sgMail.send once", async () => {
      const { sendAdminTicketNotification } = loadModule();
      await sendAdminTicketNotification(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("sends to support@propel8.com", async () => {
      const { sendAdminTicketNotification } = loadModule();
      await sendAdminTicketNotification(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: "support@propel8.com" })
      );
    });

    it("uses support@propel8.com as from address", async () => {
      const { sendAdminTicketNotification } = loadModule();
      await sendAdminTicketNotification(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "support@propel8.com" })
      );
    });

    it("prefixes subject with [Support]", async () => {
      const { sendAdminTicketNotification } = loadModule();
      await sendAdminTicketNotification(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "[Support] Cannot download PDF" })
      );
    });

    it("includes ticket ID, user email, category, and message in plain-text body", async () => {
      const { sendAdminTicketNotification } = loadModule();
      await sendAdminTicketNotification(TICKET_PARAMS);
      const { text } = mockSend.mock.calls[0][0] as { text: string };
      expect(text).toContain(TICKET_PARAMS.ticketId);
      expect(text).toContain(TICKET_PARAMS.userEmail);
      expect(text).toContain("Technical"); // capitalised category
      expect(text).toContain(TICKET_PARAMS.message);
    });

    it("includes ticket details in HTML body", async () => {
      const { sendAdminTicketNotification } = loadModule();
      await sendAdminTicketNotification(TICKET_PARAMS);
      const { html } = mockSend.mock.calls[0][0] as { html: string };
      expect(html).toContain(TICKET_PARAMS.ticketId);
      expect(html).toContain(TICKET_PARAMS.userEmail);
      expect(html).toContain(TICKET_PARAMS.message);
    });
  });

  describe("sendUserTicketConfirmation", () => {
    it("calls sgMail.send once", async () => {
      const { sendUserTicketConfirmation } = loadModule();
      await sendUserTicketConfirmation(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("sends to the user's email address", async () => {
      const { sendUserTicketConfirmation } = loadModule();
      await sendUserTicketConfirmation(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: TICKET_PARAMS.userEmail })
      );
    });

    it("uses support@propel8.com as from address", async () => {
      const { sendUserTicketConfirmation } = loadModule();
      await sendUserTicketConfirmation(TICKET_PARAMS);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: "support@propel8.com" })
      );
    });

    it("includes the original subject in the confirmation subject line", async () => {
      const { sendUserTicketConfirmation } = loadModule();
      await sendUserTicketConfirmation(TICKET_PARAMS);
      const { subject } = mockSend.mock.calls[0][0] as { subject: string };
      expect(subject).toContain(TICKET_PARAMS.subject);
    });

    it("includes the ticket ID in the plain-text body", async () => {
      const { sendUserTicketConfirmation } = loadModule();
      await sendUserTicketConfirmation(TICKET_PARAMS);
      const { text } = mockSend.mock.calls[0][0] as { text: string };
      expect(text).toContain(TICKET_PARAMS.ticketId);
    });

    it("mentions 1-2 business days response time in HTML body", async () => {
      const { sendUserTicketConfirmation } = loadModule();
      await sendUserTicketConfirmation(TICKET_PARAMS);
      const { html } = mockSend.mock.calls[0][0] as { html: string };
      expect(html).toContain("1–2 business days");
    });
  });
});

// ── Unconfigured (no API key) ─────────────────────────────────────────────────

describe("when SENDGRID_API_KEY is not set", () => {
  beforeEach(() => {
    delete process.env.SENDGRID_API_KEY;
  });

  it("sendAdminTicketNotification does not call sgMail.send", async () => {
    const { sendAdminTicketNotification } = loadModule();
    await sendAdminTicketNotification(TICKET_PARAMS);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sendUserTicketConfirmation does not call sgMail.send", async () => {
    const { sendUserTicketConfirmation } = loadModule();
    await sendUserTicketConfirmation(TICKET_PARAMS);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sendAdminTicketNotification resolves without throwing", async () => {
    const { sendAdminTicketNotification } = loadModule();
    await expect(sendAdminTicketNotification(TICKET_PARAMS)).resolves.toBeUndefined();
  });
});
