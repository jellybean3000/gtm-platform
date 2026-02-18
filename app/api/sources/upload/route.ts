import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/storage";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/markdown": "md",
  "text/plain": "txt",
};

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "pptx",
  "docx",
  "csv",
  "xlsx",
  "md",
  "txt",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const teamId = formData.get("teamId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    // Validate file type by extension
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: .${extension}. Allowed: ${Array.from(ALLOWED_EXTENSIONS).map((e) => `.${e}`).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Determine file type from MIME or extension
    const fileType = ALLOWED_TYPES[file.type] ?? extension;

    // Generate a unique storage path
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${teamId}/${timestamp}-${safeName}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = getSupabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    // Save document record to database
    const [doc] = await db
      .insert(documents)
      .values({
        teamId,
        filename: file.name,
        fileType,
        fileUrl: publicUrl,
        status: "uploading",
        uploadType: "file",
        metadata: {
          size: file.size,
          mimeType: file.type,
          storagePath,
        },
      })
      .returning({ id: documents.id, status: documents.status });

    return NextResponse.json({
      id: doc.id,
      status: doc.status,
      filename: file.name,
      fileType,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
