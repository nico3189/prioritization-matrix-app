-- CreateTable
CREATE TABLE "IntegrationHealth" (
    "service" TEXT NOT NULL,
    "healthy" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationHealth_pkey" PRIMARY KEY ("service")
);
