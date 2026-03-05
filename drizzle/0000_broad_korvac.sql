CREATE TYPE "public"."exam_status" AS ENUM('draft', 'scheduled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."exam_type" AS ENUM('quarterly', 'half_yearly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."result_component" AS ENUM('assignment_1', 'internal_1', 'quarterly', 'assignment_2', 'internal_2', 'half_yearly', 'theory', 'practical_assignment');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('theory', 'practical', 'activity');--> statement-breakpoint
CREATE TYPE "public"."fee_payment_mode" AS ENUM('cash', 'online', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."payroll_payment_mode" AS ENUM('cash', 'online', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TABLE "academic_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileUrl" varchar(500) NOT NULL,
	"fileSize" varchar(50),
	"fileType" varchar(50),
	"documentType" varchar(100) NOT NULL,
	"uploadedAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"classId" uuid NOT NULL,
	"subjectId" uuid NOT NULL,
	"teacherId" uuid,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exam_subject_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"examSubjectId" uuid NOT NULL,
	"component" "result_component" NOT NULL,
	"maxMarks" integer NOT NULL,
	"passMarks" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exam_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"examId" uuid NOT NULL,
	"subjectId" uuid NOT NULL,
	"maxMarks" integer NOT NULL,
	"passMarks" integer NOT NULL,
	"examDate" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"classId" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"examType" "exam_type" NOT NULL,
	"description" text,
	"academicYear" varchar(20) NOT NULL,
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "student_exam_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"examId" uuid NOT NULL,
	"studentId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"subjectType" "subject_type",
	"createdAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studentId" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"feeStructureId" uuid NOT NULL,
	"amountPaid" integer NOT NULL,
	"paymentDate" timestamp with time zone NOT NULL,
	"paymentMode" "fee_payment_mode" NOT NULL,
	"receiptNumber" varchar(100) NOT NULL,
	"notes" text,
	"collectedBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone,
	CONSTRAINT "fee_payments_receiptNumber_unique" UNIQUE("receiptNumber")
);
--> statement-breakpoint
CREATE TABLE "fee_structure_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feeStructureId" uuid NOT NULL,
	"componentName" varchar(120) NOT NULL,
	"amount" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fee_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"classId" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"examId" uuid NOT NULL,
	"studentId" uuid NOT NULL,
	"subjectId" uuid NOT NULL,
	"marksObtained" integer NOT NULL,
	"gradedBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "student_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studentId" uuid NOT NULL,
	"examSubjectId" uuid NOT NULL,
	"component" "result_component" NOT NULL,
	"obtainedMarks" integer NOT NULL,
	"gradedBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payroll_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payrollId" uuid NOT NULL,
	"paymentDate" timestamp with time zone NOT NULL,
	"paymentMode" "payroll_payment_mode" NOT NULL,
	"transactionReference" varchar(120),
	"creditToAccount" varchar(120),
	"fromAccount" varchar(120),
	"paidBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone,
	CONSTRAINT "payroll_payments_payrollId_unique" UNIQUE("payrollId")
);
--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacherId" uuid NOT NULL,
	"salaryStructureId" uuid NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"basicSalary" integer NOT NULL,
	"hra" integer DEFAULT 0 NOT NULL,
	"transportAllowance" integer DEFAULT 0 NOT NULL,
	"otherAllowances" integer DEFAULT 0 NOT NULL,
	"pfDeduction" integer DEFAULT 0 NOT NULL,
	"taxDeduction" integer DEFAULT 0 NOT NULL,
	"otherDeductions" integer DEFAULT 0 NOT NULL,
	"absentDays" integer DEFAULT 0 NOT NULL,
	"attendanceDeduction" integer DEFAULT 0 NOT NULL,
	"grossSalary" integer NOT NULL,
	"totalDeductions" integer NOT NULL,
	"netSalary" integer NOT NULL,
	"status" "payroll_status" DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp with time zone,
	"generatedBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "salary_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacherId" uuid NOT NULL,
	"basicSalary" integer NOT NULL,
	"hra" integer DEFAULT 0 NOT NULL,
	"transportAllowance" integer DEFAULT 0 NOT NULL,
	"otherAllowances" integer DEFAULT 0 NOT NULL,
	"pfDeduction" integer DEFAULT 0 NOT NULL,
	"taxDeduction" integer DEFAULT 0 NOT NULL,
	"otherDeductions" integer DEFAULT 0 NOT NULL,
	"absentDayDeduction" integer DEFAULT 0 NOT NULL,
	"createdBy" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"userId" uuid NOT NULL,
	"roleId" uuid NOT NULL,
	"assignedAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_roles_userId_roleId_pk" PRIMARY KEY("userId","roleId")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"rollNumber" varchar(50) NOT NULL,
	"admissionNo" varchar(100),
	"admissionDate" timestamp,
	"fathersName" varchar(255) NOT NULL,
	"mothersName" varchar(255) NOT NULL,
	"sessionId" uuid NOT NULL,
	"classId" uuid NOT NULL,
	"parentEmail" varchar(255),
	"parentPhone" varchar(20),
	"dateOfBirth" timestamp NOT NULL,
	"bloodGroup" varchar(10),
	"gender" varchar(20) NOT NULL,
	"penNo" varchar(50),
	"aadharNo" varchar(50),
	"category" varchar(50) NOT NULL,
	"aaparId" varchar(50),
	"address" varchar(255),
	"mobileNo" varchar(20),
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone,
	CONSTRAINT "students_rollNumber_unique" UNIQUE("rollNumber")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"mobileNo" varchar(20) NOT NULL,
	"fathersName" varchar(255) NOT NULL,
	"mothersName" varchar(255) NOT NULL,
	"dateOfBirth" timestamp NOT NULL,
	"address" varchar(255) NOT NULL,
	"aadharCard" varchar(50) NOT NULL,
	"panCard" varchar(50) NOT NULL,
	"emailId" varchar(255) NOT NULL,
	"designation" varchar(255) NOT NULL,
	"qualification" varchar(255) NOT NULL,
	"accountNo" varchar(50) NOT NULL,
	"bankIfsc" varchar(20) NOT NULL,
	"bankName" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fullName" varchar(255) NOT NULL,
	"username" varchar(255) NOT NULL,
	"avatarUrl" varchar(255),
	"password" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subjectId_subjects_id_fk" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacherId_teachers_id_fk" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_subject_components" ADD CONSTRAINT "exam_subject_components_examSubjectId_exam_subjects_id_fk" FOREIGN KEY ("examSubjectId") REFERENCES "public"."exam_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_examId_exams_id_fk" FOREIGN KEY ("examId") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_subjectId_subjects_id_fk" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_exam_enrollments" ADD CONSTRAINT "student_exam_enrollments_examId_exams_id_fk" FOREIGN KEY ("examId") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_exam_enrollments" ADD CONSTRAINT "student_exam_enrollments_studentId_students_id_fk" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_studentId_students_id_fk" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_feeStructureId_fee_structures_id_fk" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_collectedBy_users_id_fk" FOREIGN KEY ("collectedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structure_components" ADD CONSTRAINT "fee_structure_components_feeStructureId_fee_structures_id_fk" FOREIGN KEY ("feeStructureId") REFERENCES "public"."fee_structures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_examId_exams_id_fk" FOREIGN KEY ("examId") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_studentId_students_id_fk" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_subjectId_subjects_id_fk" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_gradedBy_users_id_fk" FOREIGN KEY ("gradedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_marks" ADD CONSTRAINT "student_marks_studentId_students_id_fk" FOREIGN KEY ("studentId") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_marks" ADD CONSTRAINT "student_marks_examSubjectId_exam_subjects_id_fk" FOREIGN KEY ("examSubjectId") REFERENCES "public"."exam_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_marks" ADD CONSTRAINT "student_marks_gradedBy_users_id_fk" FOREIGN KEY ("gradedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_payrollId_payrolls_id_fk" FOREIGN KEY ("payrollId") REFERENCES "public"."payrolls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_payments" ADD CONSTRAINT "payroll_payments_paidBy_users_id_fk" FOREIGN KEY ("paidBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_teacherId_teachers_id_fk" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_salaryStructureId_salary_structures_id_fk" FOREIGN KEY ("salaryStructureId") REFERENCES "public"."salary_structures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_generatedBy_users_id_fk" FOREIGN KEY ("generatedBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_teacherId_teachers_id_fk" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_sessionId_academic_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."academic_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_sessions_name_unique" ON "academic_sessions" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_name_unique" ON "classes" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "class_subjects_session_class_subject_unique" ON "class_subjects" USING btree ("sessionId","classId","subjectId");--> statement-breakpoint
CREATE INDEX "class_subjects_class_idx" ON "class_subjects" USING btree ("classId");--> statement-breakpoint
CREATE INDEX "class_subjects_subject_idx" ON "class_subjects" USING btree ("subjectId");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_subject_components_subject_component_unique" ON "exam_subject_components" USING btree ("examSubjectId","component");--> statement-breakpoint
CREATE INDEX "exam_subject_components_exam_subject_idx" ON "exam_subject_components" USING btree ("examSubjectId");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_subjects_exam_subject_unique" ON "exam_subjects" USING btree ("examId","subjectId");--> statement-breakpoint
CREATE INDEX "exam_subjects_exam_idx" ON "exam_subjects" USING btree ("examId");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_enrollments_exam_student_unique" ON "student_exam_enrollments" USING btree ("examId","studentId");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_session_name_unique" ON "subjects" USING btree ("sessionId","name");--> statement-breakpoint
CREATE INDEX "fee_payments_student_idx" ON "fee_payments" USING btree ("studentId");--> statement-breakpoint
CREATE INDEX "fee_payments_session_idx" ON "fee_payments" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "fee_payments_structure_idx" ON "fee_payments" USING btree ("feeStructureId");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structure_components_unique" ON "fee_structure_components" USING btree ("feeStructureId","componentName");--> statement-breakpoint
CREATE INDEX "fee_structure_components_structure_idx" ON "fee_structure_components" USING btree ("feeStructureId");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structures_class_session_unique" ON "fee_structures" USING btree ("classId","sessionId");--> statement-breakpoint
CREATE INDEX "fee_structures_session_idx" ON "fee_structures" USING btree ("sessionId");--> statement-breakpoint
CREATE UNIQUE INDEX "marks_exam_student_subject_unique" ON "marks" USING btree ("examId","studentId","subjectId");--> statement-breakpoint
CREATE INDEX "marks_exam_idx" ON "marks" USING btree ("examId");--> statement-breakpoint
CREATE INDEX "marks_student_idx" ON "marks" USING btree ("studentId");--> statement-breakpoint
CREATE UNIQUE INDEX "student_marks_student_exam_subject_unique" ON "student_marks" USING btree ("studentId","examSubjectId","component");--> statement-breakpoint
CREATE INDEX "student_marks_exam_subject_idx" ON "student_marks" USING btree ("examSubjectId");--> statement-breakpoint
CREATE INDEX "student_marks_student_idx" ON "student_marks" USING btree ("studentId");--> statement-breakpoint
CREATE INDEX "payroll_payments_payroll_idx" ON "payroll_payments" USING btree ("payrollId");--> statement-breakpoint
CREATE UNIQUE INDEX "payrolls_teacher_month_year_unique" ON "payrolls" USING btree ("teacherId","month","year");--> statement-breakpoint
CREATE INDEX "payrolls_month_year_idx" ON "payrolls" USING btree ("month","year");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_structures_teacher_unique" ON "salary_structures" USING btree ("teacherId");