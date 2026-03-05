ALTER TABLE "fee_class_configs"
ADD COLUMN IF NOT EXISTS "startMonth" integer DEFAULT 1 NOT NULL,
ADD COLUMN IF NOT EXISTS "endMonth" integer DEFAULT 12 NOT NULL;

UPDATE "fee_class_configs"
SET
  "startMonth" = 1,
  "endMonth" = CASE
    WHEN "activeMonths" < 1 THEN 1
    WHEN "activeMonths" > 12 THEN 12
    ELSE "activeMonths"
  END
WHERE "startMonth" = 1 AND "endMonth" = 12;

UPDATE "fee_class_configs"
SET "activeMonths" = GREATEST(1, "endMonth" - "startMonth" + 1);
