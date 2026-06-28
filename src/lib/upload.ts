import "server-only";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Save an uploaded image to /public/uploads with a generated, non-user-controlled
 * name and return its public path ("/uploads/..."). Throws a coded error on a
 * non-image or oversize file. Shared by product photos and the banner image.
 */
export async function saveUploadedImage(file: File, prefix = "img"): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("INVALID_IMAGE");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  const ext =
    (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) ||
    "png";
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

/** Human-readable Indonesian message for a saveUploadedImage() error. */
export function imageErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "IMAGE_TOO_LARGE") return "Gambar terlalu besar (maksimal 4MB).";
  if (m === "INVALID_IMAGE") return "File yang diunggah harus berupa gambar.";
  return "Gagal memproses gambar.";
}
