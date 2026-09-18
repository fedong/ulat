-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INSTRUCTOR', 'STUDENT', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "EntState" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE', 'FREE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleSub" TEXT,
    "role" "Role" NOT NULL DEFAULT 'INSTRUCTOR',
    "profile" JSONB NOT NULL DEFAULT '{}',
    "entState" "EntState" NOT NULL DEFAULT 'TRIALING',
    "entUntil" TIMESTAMP(3),
    "entMethod" TEXT,
    "entCycle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '',
    "joinCode" TEXT NOT NULL,
    "periods" TEXT[],
    "closed" JSONB NOT NULL DEFAULT '{}',
    "grading" JSONB NOT NULL,
    "guardianScopes" JSONB NOT NULL DEFAULT '{"Grades":true,"Attendance":true,"Missing work":true,"Remarks":false}',
    "consult" JSONB NOT NULL DEFAULT '{"slots":[],"note":""}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRow" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last" TEXT NOT NULL,
    "first" TEXT NOT NULL,
    "mi" TEXT NOT NULL DEFAULT '',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "consultedAt" TIMESTAMP(3),
    "remark" TEXT NOT NULL DEFAULT '',
    "remarkLog" JSONB NOT NULL DEFAULT '[]',
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "StudentRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comp" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "max" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "studentRowId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("studentRowId","assessmentId")
);

-- CreateTable
CREATE TABLE "AttSession" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "groupId" TEXT NOT NULL DEFAULT '',
    "marks" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AttSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_joinCode_key" ON "Class"("joinCode");

-- CreateIndex
CREATE INDEX "Class_ownerId_idx" ON "Class"("ownerId");

-- CreateIndex
CREATE INDEX "StudentRow_classId_idx" ON "StudentRow"("classId");

-- CreateIndex
CREATE INDEX "Assessment_classId_period_idx" ON "Assessment"("classId", "period");

-- CreateIndex
CREATE INDEX "AttSession_classId_idx" ON "AttSession"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "AttSession_classId_date_groupId_key" ON "AttSession"("classId", "date", "groupId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRow" ADD CONSTRAINT "StudentRow_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_studentRowId_fkey" FOREIGN KEY ("studentRowId") REFERENCES "StudentRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttSession" ADD CONSTRAINT "AttSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
