ALTER TABLE "Task" ADD COLUMN "lockOverride" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TaskDependency" (
  "taskId" TEXT NOT NULL,
  "dependsOnTaskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("taskId","dependsOnTaskId")
);

CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "TaskDependency"("dependsOnTaskId");

ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskDependency"
  ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey"
  FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

