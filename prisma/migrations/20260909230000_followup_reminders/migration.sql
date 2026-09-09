-- Follow-up reminder emails
ALTER TABLE "UserSettings" ADD COLUMN "notificationEmail" TEXT,
                           ADD COLUMN "followUpReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Prospect" ADD COLUMN "followUpReminderSentAt" TIMESTAMP(3);
