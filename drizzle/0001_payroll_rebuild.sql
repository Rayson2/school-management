DROP TABLE IF EXISTS "payroll_payments" CASCADE;
DROP TABLE IF EXISTS "payrolls" CASCADE;
DROP TABLE IF EXISTS "salary_structures" CASCADE;
DROP TABLE IF EXISTS "payroll" CASCADE;

DO $$ BEGIN
  CREATE TYPE "public"."payroll_status" AS ENUM('pending', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "payroll" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teacherId" uuid NOT NULL,
  "sessionId" uuid NOT NULL,
  "month" integer NOT NULL,
  "year" integer NOT NULL,
  "basicSalary" integer DEFAULT 0 NOT NULL,
  "transportAllowance" integer DEFAULT 0 NOT NULL,
  "otherAllowances" integer DEFAULT 0 NOT NULL,
  "deductions" integer DEFAULT 0 NOT NULL,
  "grossSalary" integer DEFAULT 0 NOT NULL,
  "netSalary" integer DEFAULT 0 NOT NULL,
  "status" "payroll_status" DEFAULT 'pending' NOT NULL,
  "paidAt" timestamp with time zone,
  "paymentMode" varchar(50),
  "transactionRef" varchar(120),
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone
);

ALTER TABLE "payroll"
  ADD CONSTRAINT "payroll_teacherId_teachers_id_fk"
  FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "payroll"
  ADD CONSTRAINT "payroll_sessionId_academic_sessions_id_fk"
  FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE restrict ON UPDATE no action;

CREATE UNIQUE INDEX "payroll_teacher_session_month_year_unique" ON "payroll" USING btree ("teacherId", "sessionId", "month", "year");
CREATE INDEX "payroll_session_idx" ON "payroll" USING btree ("sessionId", "month", "year");
CREATE INDEX "payroll_teacher_idx" ON "payroll" USING btree ("teacherId");
CREATE INDEX "payroll_status_idx" ON "payroll" USING btree ("status");
