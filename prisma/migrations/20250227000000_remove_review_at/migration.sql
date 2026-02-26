-- DropIndex
DROP INDEX IF EXISTS "Task_userId_reviewAt_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN IF EXISTS "reviewAt";
