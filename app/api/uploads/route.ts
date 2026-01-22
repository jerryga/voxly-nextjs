import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/storage/s3";

export const runtime = "nodejs";

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const templateField = formData.get("template");
  const template =
    typeof templateField === "string" && templateField.trim()
      ? templateField.trim()
      : "default";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeFilename(file.name || "upload");
  const key = `users/${user.id}/${Date.now()}-${safeName}`;

  const upload = await uploadToS3({
    key,
    body: buffer,
    contentType: file.type || "application/octet-stream",
  });

  const transcription = await prisma.transcription.create({
    data: {
      userId: user.id,
      fileName: file.name || safeName,
      fileUrl: upload.key,
      status: "uploaded",
      template,
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    transcriptionId: transcription.id,
    key: upload.key,
  });
}
