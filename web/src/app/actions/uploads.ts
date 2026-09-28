"use server";

import { isAppError } from "@/lib/errors";
import { assertUser } from "@/lib/session";
import { confirmUpload, prepareUpload, uploadTargetSchema } from "@/server/uploads";

export type UploadResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T extends object>(fn: () => Promise<T>): Promise<UploadResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (isAppError(e)) return { ok: false, error: e.message };
    throw e;
  }
}

export async function prepareUploadAction(target: unknown, fileName: string, size: number) {
  return guard(async () => {
    const user = await assertUser();
    const parsed = uploadTargetSchema.parse(target);
    return prepareUpload(parsed, fileName, size, user);
  });
}

export async function confirmUploadAction(target: unknown, key: string, fileName: string) {
  return guard(async () => {
    const user = await assertUser();
    await confirmUpload(uploadTargetSchema.parse(target), key, fileName, user);
    return {};
  });
}
