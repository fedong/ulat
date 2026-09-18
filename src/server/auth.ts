import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import type { User } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
};

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 30;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function signAccessToken(user: { id: string; role: string }) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

/** Opaque refresh token; only its SHA-256 lands in the database. */
export async function issueRefreshToken(userId: string) {
  const token = randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 864e5),
    },
  });
  return token;
}

/** Rotate: verify, revoke the old row, issue a fresh pair. */
export async function rotateRefreshToken(token: string) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    include: { user: true },
  });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return {
    user: row.user,
    access: await signAccessToken(row.user),
    refresh: await issueRefreshToken(row.userId),
  };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Bearer header (mobile) or ulat_token cookie (web). */
export async function requireUser(req: NextRequest): Promise<User | null> {
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.cookies.get("ulat_token")?.value || null;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export const unauthorized = () =>
  NextResponse.json({ error: "unauthorized" }, { status: 401 });
export const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });
export const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
export const badRequest = (message: string) =>
  NextResponse.json({ error: "bad_request", message }, { status: 400 });

/** Auth payload shared by register/login/refresh responses. */
export async function authPayload(user: User) {
  return {
    access: await signAccessToken(user),
    refresh: await issueRefreshToken(user.id),
    user: publicUser(user),
  };
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    profile: user.profile,
  };
}
