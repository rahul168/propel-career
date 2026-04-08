import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const MatchAnalysisSchema = registry.register(
  "MatchAnalysis",
  z.object({
    score: z.number().min(0).max(100).openapi({ description: "ATS match score 0-100" }),
    matchedKeywords: z.array(z.string()),
    missingKeywords: z.array(z.string()),
  })
);

const SuggestionSchema = registry.register(
  "Suggestion",
  z.object({
    id: z.string(),
    section: z.string(),
    original: z.string().openapi({ description: "Verbatim text from resume" }),
    suggested: z.string().openapi({ description: "Drop-in replacement" }),
    reason: z.string(),
    accepted: z.boolean(),
  })
);

registry.registerPath({
  method: "post",
  path: "/api/parse-resume/{format}",
  tags: ["Resume"],
  summary: "Upload and parse a resume — format is 'docx' or 'pdf'",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      format: z.enum(["docx", "pdf"]).openapi({
        description: "'docx' parses the file directly. 'pdf' converts to DOCX via Adobe Services (1 credit) then extracts text.",
      }),
    }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            resume: z.instanceof(File).openapi({ type: "string", format: "binary", description: "DOCX or PDF file matching the chosen format" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Extracted text, file name, and DOCX as base64",
      content: {
        "application/json": {
          schema: z.object({ text: z.string(), fileName: z.string(), docxBase64: z.string() }),
        },
      },
    },
    400: { description: "Invalid format parameter, wrong file type, or conversion failed" },
    401: { description: "Unauthorized" },
    402: { description: "Insufficient credits (pdf format only)" },
  },
});


registry.registerPath({
  method: "post",
  path: "/api/analyze-match",
  tags: ["Analysis"],
  summary: "Analyze match between resume and job description",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            resumeText: z.string().min(50),
            jobDescription: z.string().min(50),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Match analysis result",
      content: { "application/json": { schema: MatchAnalysisSchema } },
    },
    401: { description: "Unauthorized" },
    402: { description: "Insufficient credits" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/suggest-improvements",
  tags: ["Analysis"],
  summary: "Get AI-generated wording suggestions to improve match score",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            resumeText: z.string().min(50),
            jobDescription: z.string().min(50),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "List of suggestions",
      content: {
        "application/json": {
          schema: z.object({ suggestions: z.array(SuggestionSchema) }),
        },
      },
    },
    401: { description: "Unauthorized" },
    402: { description: "Insufficient credits" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/generate-resume/{format}",
  tags: ["Resume"],
  summary: "Generate updated resume — format is 'docx' or 'pdf'",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      format: z.enum(["docx", "pdf"]).openapi({
        description: "'docx' applies suggestions and returns the DOCX file. 'pdf' converts to PDF via Adobe Services (1 credit).",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            resumeText: z.string(),
            acceptedSuggestions: z.array(SuggestionSchema),
            docxBase64: z.string().openapi({ description: "Base64-encoded DOCX to apply suggestions to" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "DOCX or PDF file download",
      content: {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
        "application/pdf": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    400: { description: "Invalid format parameter or missing docxBase64" },
    401: { description: "Unauthorized" },
    402: { description: "Insufficient credits (pdf format only)" },
    500: { description: "PDF generation failed" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/stripe/checkout",
  tags: ["Stripe"],
  summary: "Create a Stripe Checkout session",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ packId: z.enum(["starter", "pro"]) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Checkout session URL",
      content: {
        "application/json": {
          schema: z.object({ url: z.string() }),
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/stripe/webhook",
  tags: ["Stripe"],
  summary: "Stripe webhook endpoint (Stripe-signed)",
  responses: {
    200: {
      description: "Webhook received",
      content: {
        "application/json": {
          schema: z.object({ received: z.boolean() }),
        },
      },
    },
    400: { description: "Invalid signature" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/user/credits",
  tags: ["User"],
  summary: "Get current credit balance",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Credit balance",
      content: {
        "application/json": {
          schema: z.object({ credits: z.number() }),
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/user/account",
  tags: ["User"],
  summary: "Get account details including credit balance, status, and usage history",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Account details",
      content: {
        "application/json": {
          schema: z.object({
            credits: z.number(),
            status: z.enum(["ok", "reminder", "warning", "empty"]),
            thresholds: z.object({ reminder: z.number(), warning: z.number() }),
            creditsUsed: z.number(),
            recentUsage: z.array(
              z.object({ id: z.string(), feature: z.string(), createdAt: z.string() })
            ),
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/user/usage",
  tags: ["User"],
  summary: "Get usage history (last 50 events with LLM details)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Usage events",
      content: {
        "application/json": {
          schema: z.object({ events: z.array(z.any()) }),
        },
      },
    },
    401: { description: "Unauthorized" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/admin/usage",
  tags: ["Admin"],
  summary: "Get aggregated usage and LLM cost stats (admin only)",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Aggregated stats",
      content: {
        "application/json": {
          schema: z.object({
            featureStats: z.array(z.any()),
            llmStats: z.array(z.any()),
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden (admin only)" },
  },
});

export function buildOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const doc = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Propel Career API",
      version: "1.0.0",
      description: "Resume optimization API",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" }],
  });

  // Inject security schemes
  if (!doc.components) doc.components = {};
  doc.components.securitySchemes = {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
      description: "Clerk session token",
    },
  };

  return doc;
}
