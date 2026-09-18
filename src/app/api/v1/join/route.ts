import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireUser, unauthorized } from "@/server/auth";
import { prisma } from "@/server/db";

/**
 * Student joins a class: the class join code plus either their student number
 * or their name, matched against unclaimed roster rows. No instructor
 * approval needed — the roster row is the approval.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return unauthorized();
  if (user.role !== "STUDENT")
    return NextResponse.json(
      { error: "wrong_role", message: "Only student accounts can join a class." },
      { status: 403 },
    );

  const b = await req.json().catch(() => null);
  const code = String(b?.code || "").trim().toUpperCase();
  const studentNo = String(b?.studentNo || "").trim();
  const name = String(b?.name || "").trim().toLowerCase();
  if (!code) return badRequest("class code required");
  if (!studentNo && !name) return badRequest("student number or name required");

  const cls = await prisma.class.findUnique({
    where: { joinCode: code },
    include: { students: { where: { removedAt: null }, include: { enrollment: true } } },
  });
  if (!cls)
    return NextResponse.json(
      { error: "unknown_code", message: "No class with that code. Check it with your instructor." },
      { status: 404 },
    );

  const matches = cls.students.filter((s) =>
    studentNo
      ? s.no.trim() === studentNo
      : s.name.toLowerCase() === name ||
        `${s.first} ${s.last}`.toLowerCase() === name ||
        `${s.last}, ${s.first}`.toLowerCase() === name,
  );
  if (!matches.length)
    return NextResponse.json(
      {
        error: "no_match",
        message: "No matching student on this class list. Check with your instructor.",
      },
      { status: 404 },
    );
  if (matches.length > 1)
    return badRequest("more than one match — use your student number instead");
  const row = matches[0];
  if (row.enrollment && row.enrollment.userId !== user.id)
    return NextResponse.json(
      { error: "already_linked", message: "That student is already linked to another account." },
      { status: 409 },
    );

  if (!row.enrollment)
    await prisma.enrollment.create({ data: { userId: user.id, studentRowId: row.id } });
  return NextResponse.json(
    { classId: cls.id, code: cls.code, title: cls.title, studentRowId: row.id },
    { status: 201 },
  );
}
