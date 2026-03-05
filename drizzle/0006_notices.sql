CREATE TABLE IF NOT EXISTS "notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text NOT NULL,
  "noticeType" varchar(20) NOT NULL,
  "classId" uuid,
  "createdByUserId" uuid NOT NULL,
  "attachmentName" varchar(255),
  "attachmentUrl" varchar(500),
  "attachmentSize" varchar(50),
  "attachmentType" varchar(100),
  "createdAt" timestamp with time zone DEFAULT now(),
  "updatedAt" timestamp with time zone,
  CONSTRAINT "notices_classId_classes_id_fk" FOREIGN KEY ("classId") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "notices_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
