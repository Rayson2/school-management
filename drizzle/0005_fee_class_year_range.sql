ALTER TABLE "fee_class_configs"
ADD COLUMN IF NOT EXISTS "startYear" integer,
ADD COLUMN IF NOT EXISTS "endYear" integer;

UPDATE "fee_class_configs" cfg
SET "startYear" = COALESCE(
  NULLIF(SUBSTRING(sess."name" FROM '(19|20)[0-9]{2}'), '')::integer,
  EXTRACT(YEAR FROM COALESCE(cfg."createdAt", NOW()))::integer
)
FROM "academic_sessions" sess
WHERE cfg."sessionId" = sess."id"
  AND cfg."startYear" IS NULL;

UPDATE "fee_class_configs"
SET "endYear" = CASE
  WHEN "startMonth" <= "endMonth" THEN "startYear"
  ELSE "startYear" + 1
END
WHERE "endYear" IS NULL;

ALTER TABLE "fee_class_configs"
ALTER COLUMN "startYear" SET NOT NULL,
ALTER COLUMN "startYear" SET DEFAULT 2025,
ALTER COLUMN "endYear" SET NOT NULL,
ALTER COLUMN "endYear" SET DEFAULT 2026;

UPDATE "fee_class_configs"
SET "activeMonths" = (("endYear" * 12 + "endMonth") - ("startYear" * 12 + "startMonth") + 1)
WHERE ("endYear" * 12 + "endMonth") >= ("startYear" * 12 + "startMonth");
