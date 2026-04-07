import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { extractTextFromDOCX } from "@/lib/docx/parser";

export const runtime = "nodejs";

const schema = z.object({
  docxBase64: z.string().min(1),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  let buf: Buffer;
  try {
    buf = Buffer.from(parsed.data.docxBase64, "base64");
  } catch {
    return Response.json({ error: "Invalid base64" }, { status: 400 });
  }

  // Basic DOCX validation: DOCX is a ZIP => starts with "PK"
  if (buf.length < 2 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return Response.json({ error: "Invalid DOCX" }, { status: 400 });
  }

  const text = await extractTextFromDOCX(buf);
  return Response.json({ text });
}

