-- CreateTable
CREATE TABLE "UserEvent" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "event" TEXT NOT NULL,
    "lessonNumber" INTEGER,
    "locale" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEvent_telegramId_idx" ON "UserEvent"("telegramId");

-- CreateIndex
CREATE INDEX "UserEvent_event_idx" ON "UserEvent"("event");

-- CreateIndex
CREATE INDEX "UserEvent_createdAt_idx" ON "UserEvent"("createdAt");
