import type { NextRequest } from "next/server";
import { requireUser } from "./auth";
import { prisma } from "./db";
import { classInclude, type FullClass } from "./serialize";

/** Auth + ownership in one step for all /classes/[id] handlers. */
export async function loadOwnedClass(
  req: NextRequest,
  classId: string,
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof requireUser>>>; cls: FullClass } | { error: "unauthorized" | "not_found" }> {
  const user = await requireUser(req);
  if (!user) return { error: "unauthorized" };
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: classInclude,
  });
  if (!cls || cls.ownerId !== user.id) return { error: "not_found" };
  return { user, cls };
}

const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function makeJoinCode() {
  let out = "";
  for (let i = 0; i < 6; i++)
    out += JOIN_ALPHABET[Math.floor(Math.random() * JOIN_ALPHABET.length)];
  return out;
}
