CREATE TABLE IF NOT EXISTS "attendance_feature_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schoolLatitude" double precision,
  "schoolLongitude" double precision,
  "allowedRadiusMeters" integer DEFAULT 150 NOT NULL,
  "autoDisableMinutes" integer DEFAULT 60 NOT NULL,
  "isFeatureEnabled" boolean DEFAULT false NOT NULL,
  "enabledAt" timestamp with time zone,
  "activeUntil" timestamp with time zone,
  "isFutureScheduleEnabled" boolean DEFAULT true NOT NULL,
  "updatedByUserId" uuid,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone,
  CONSTRAINT "attendance_feature_config_updatedByUserId_users_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "attendance_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action" varchar(10) NOT NULL,
  "triggerAt" timestamp with time zone NOT NULL,
  "durationMinutes" integer,
  "isProcessed" boolean DEFAULT false NOT NULL,
  "processedAt" timestamp with time zone,
  "note" varchar(255),
  "createdByUserId" uuid NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone,
  CONSTRAINT "attendance_schedules_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "teacher_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teacherId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "attendanceDate" date NOT NULL,
  "checkInAt" timestamp with time zone NOT NULL,
  "status" varchar(20) DEFAULT 'present' NOT NULL,
  "method" varchar(20) NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "distanceMeters" integer,
  "markedByUserId" uuid,
  "remarks" varchar(255),
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone,
  CONSTRAINT "teacher_attendance_teacherId_teachers_id_fk" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "teacher_attendance_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "teacher_attendance_markedByUserId_users_id_fk" FOREIGN KEY ("markedByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_attendance_teacher_date_unique"
  ON "teacher_attendance" ("teacherId", "attendanceDate");
