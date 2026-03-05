CREATE TYPE "public"."fee_admission_type" AS ENUM('new', 'old');--> statement-breakpoint
CREATE TYPE "public"."fee_entry_status" AS ENUM('pending', 'partial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."fee_payment_mode" AS ENUM('cash', 'online', 'cheque');--> statement-breakpoint

CREATE TABLE "fee_class_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "classId" uuid NOT NULL,
  "sessionId" uuid NOT NULL,
  "newAdmissionFee" integer DEFAULT 0 NOT NULL,
  "oldAdmissionFee" integer DEFAULT 0 NOT NULL,
  "activeMonths" integer DEFAULT 12 NOT NULL,
  "createdBy" uuid NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "fee_student_monthly" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "studentId" uuid NOT NULL,
  "classId" uuid NOT NULL,
  "sessionId" uuid NOT NULL,
  "month" integer NOT NULL,
  "year" integer NOT NULL,
  "admissionType" "fee_admission_type" NOT NULL,
  "amountDue" integer DEFAULT 0 NOT NULL,
  "amountPaid" integer DEFAULT 0 NOT NULL,
  "status" "fee_entry_status" DEFAULT 'pending' NOT NULL,
  "paymentMode" "fee_payment_mode",
  "referenceNumber" varchar(120),
  "paidAt" timestamp with time zone,
  "createdBy" uuid NOT NULL,
  "updatedBy" uuid NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone
);
--> statement-breakpoint

ALTER TABLE "fee_class_configs" ADD CONSTRAINT "fee_class_configs_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_class_configs" ADD CONSTRAINT "fee_class_configs_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_class_configs" ADD CONSTRAINT "fee_class_configs_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_student_monthly" ADD CONSTRAINT "fee_student_monthly_studentId_students_id_fk" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_student_monthly" ADD CONSTRAINT "fee_student_monthly_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_student_monthly" ADD CONSTRAINT "fee_student_monthly_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_student_monthly" ADD CONSTRAINT "fee_student_monthly_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_student_monthly" ADD CONSTRAINT "fee_student_monthly_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "fee_class_configs_class_session_unique" ON "fee_class_configs" USING btree ("classId", "sessionId");--> statement-breakpoint
CREATE INDEX "fee_class_configs_session_idx" ON "fee_class_configs" USING btree ("sessionId");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_student_monthly_unique" ON "fee_student_monthly" USING btree ("studentId", "sessionId", "month", "year");--> statement-breakpoint
CREATE INDEX "fee_student_monthly_session_idx" ON "fee_student_monthly" USING btree ("sessionId", "classId");--> statement-breakpoint
CREATE INDEX "fee_student_monthly_status_idx" ON "fee_student_monthly" USING btree ("status");
