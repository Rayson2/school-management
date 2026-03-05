DROP INDEX IF EXISTS "exams_session_exam_type_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "exams_session_class_exam_type_unique" ON "exams" USING btree ("sessionId","classId","examType");
