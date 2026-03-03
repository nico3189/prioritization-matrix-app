-- AlterTable
ALTER TABLE "Task" ADD COLUMN "importanceManuallyOverriddenAt" TIMESTAMP(3),
ADD COLUMN "urgencyManuallyOverriddenAt" TIMESTAMP(3);
