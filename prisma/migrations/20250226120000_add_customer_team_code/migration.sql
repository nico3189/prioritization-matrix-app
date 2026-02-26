-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "code" VARCHAR(3);

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN "code" VARCHAR(3);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_code_key" ON "Customer"("userId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_code_key" ON "TeamMember"("userId", "code");
