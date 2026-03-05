ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "examGroupId" uuid;
CREATE INDEX IF NOT EXISTS "exams_exam_group_idx" ON "exams" USING btree ("examGroupId");
