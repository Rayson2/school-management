ALTER TABLE "attendance_feature_config"
ADD COLUMN IF NOT EXISTS "autoDisableMinutes" integer DEFAULT 60 NOT NULL;
