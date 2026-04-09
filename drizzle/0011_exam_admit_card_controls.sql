DO $$
BEGIN
  CREATE TYPE "admit_card_access_mode" AS ENUM ('off', 'only_paid', 'all');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "exam_admit_card_controls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "examId" uuid NOT NULL REFERENCES "exams"("id") ON DELETE cascade,
  "mode" "admit_card_access_mode" NOT NULL DEFAULT 'off',
  "resultMode" "admit_card_access_mode" NOT NULL DEFAULT 'off',
  "newStudentAmount" integer NOT NULL DEFAULT 0,
  "oldStudentAmount" integer NOT NULL DEFAULT 0,
  "createdBy" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "updatedBy" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_admit_card_controls_exam_unique"
  ON "exam_admit_card_controls" ("examId");

CREATE INDEX IF NOT EXISTS "exam_admit_card_controls_mode_idx"
  ON "exam_admit_card_controls" ("mode");

ALTER TABLE "exam_admit_card_controls"
ADD COLUMN IF NOT EXISTS "resultMode" "admit_card_access_mode" NOT NULL DEFAULT 'off';
