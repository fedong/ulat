-- AlterTable
ALTER TABLE "StudentRow" ADD COLUMN     "guardianNudgeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GuardianStudent" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Guardian',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentInvite" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Guardian',
    "code" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianStudent_studentUserId_idx" ON "GuardianStudent"("studentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianStudent_guardianId_studentUserId_key" ON "GuardianStudent"("guardianId", "studentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentInvite_code_key" ON "StudentInvite"("code");

-- CreateIndex
CREATE INDEX "StudentInvite_studentUserId_idx" ON "StudentInvite"("studentUserId");

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianStudent" ADD CONSTRAINT "GuardianStudent_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInvite" ADD CONSTRAINT "StudentInvite_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
