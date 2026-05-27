import { ulid } from "ulid";
import type { AppEnv } from "@/lib/env";
import { extForMime, sniffMime } from "@/lib/upload-validate";
import { AppError } from "@/lib/errors";

export interface UploadResult {
  key: string;
  mime: string;
  bytes: number;
}

export async function putUpload(
  env: Pick<AppEnv, "R2">,
  userId: string,
  raw: ArrayBuffer,
): Promise<UploadResult> {
  const bytes = new Uint8Array(raw);
  const mime = sniffMime(bytes);
  if (!mime) throw new AppError("UNSUPPORTED_MEDIA", "unsupported file type");
  const key = `uploads/${userId}/${ulid()}.${extForMime(mime)}`;
  await env.R2.put(key, bytes, { httpMetadata: { contentType: mime } });
  return { key, mime, bytes: bytes.byteLength };
}

export async function getUpload(
  env: Pick<AppEnv, "R2">,
  userId: string,
  key: string,
): Promise<R2ObjectBody> {
  if (!key.startsWith(`uploads/${userId}/`)) throw new AppError("NOT_FOUND", "not found");
  const obj = await env.R2.get(key);
  if (!obj) throw new AppError("NOT_FOUND", "not found");
  return obj;
}

export async function putDiagram(
  env: Pick<AppEnv, "R2">,
  chatId: string,
  png: ArrayBuffer,
): Promise<string> {
  const key = `diagrams/${chatId}/${ulid()}.png`;
  await env.R2.put(key, png, { httpMetadata: { contentType: "image/png" } });
  return key;
}

export async function putReportPdf(
  env: Pick<AppEnv, "R2">,
  userId: string,
  reportId: string,
  version: number,
  pdf: ArrayBuffer,
): Promise<string> {
  const key = `reports/${userId}/${reportId}-v${version}.pdf`;
  await env.R2.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
  return key;
}
