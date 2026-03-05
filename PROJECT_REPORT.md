# School Site Project Report

Generated on: 2026-02-28
Repository: `schoolsite-backend`

## 1. Executive Summary
This project is a full-stack school administration system with:
- Backend: Bun + Hono + Drizzle ORM + PostgreSQL
- Frontend: React + Vite + Tailwind
- Authentication: Cookie-based session auth with role-based authorization (`admin`, `teacher`, `student`)
- Core domains: Students, Teachers, Documents, Classes, Academic Sessions, Exams, Subjects, Class-Subject mapping, Enrollments, Marks

## 2. System Architecture
- API server entrypoint: `server/index.ts`
- Frontend entrypoint: `client/src/main.tsx`
- Database access: `server/db/index.ts`
- ORM configuration: `drizzle.config.ts`
- Environment parsing: `server/utils/env.ts`

Runtime flow:
1. React app calls `/api/*`.
2. Vite proxy forwards `/api` to backend `http://localhost:4000`.
3. Hono routes process request, validate with Zod middleware, enforce auth/roles.
4. Drizzle executes PostgreSQL queries.
5. JSON response shape is consistently `success/message/data` or `success/error`.

## 3. Backend Module Report

### 3.1 Auth and Security
- Session cookie name: `session`
- Cookie settings (`server/config/cookie-options.ts`): `HttpOnly`, `SameSite=Lax`, `secure` in production, 7-day max age.
- Auth middleware (`server/middlewares/auth.middleware.ts`):
  - Validates session token from cookie.
  - Confirms session expiry (`expiresAt > now`).
  - Loads user + roles and injects into context.
  - Deletes invalid/expired sessions and clears cookie.
- Role guard: `requireRoles([...])` checks any allowed role.

### 3.2 Key Backend Features
- User login/logout/profile/password change/profile image
- Student lifecycle: create, update, list, lookup, delete, profile image, document management
- Teacher lifecycle: create, update, list, lookup, delete, profile image, document management
- Academic configuration: classes and academic sessions CRUD
- Assessment lifecycle:
  - Subject creation per academic session
  - Class-subject assignments
  - Exam creation/update/deletion
  - Exam subject mapping with max/pass marks
  - Student exam enrollment
  - Marks entry and update
- Document subsystem:
  - End-user document upload/list/delete
  - Admin-managed user-document operations

### 3.3 Route Groups
- `auth` routes: login/logout/current-user/profile update/password change/profile pic
- `student` routes: student CRUD + upload/documents
- `teacher` routes: teacher CRUD + upload/documents
- `document` routes: self and admin document management
- `class` routes: class CRUD
- `academic-session` routes: academic session CRUD
- `exam` routes: subjects, class-subjects, exams, enrollments, marks

## 4. Frontend Module Report
- Router and protected routes: `client/src/main.tsx`
- Auth gate: `client/src/components/ProtectedLayout.tsx`
- Role gate: `client/src/components/RoleProtectedRoute.tsx`
- Dashboard includes:
  - Students, Teachers, Classes, Sessions
  - Subjects, Class-Subjects
  - Exams, Marks
  - Documents
  - Settings (profile/account)
- Login screen: `client/src/pages/Login.tsx`
- Dev proxy (`client/vite.config.ts`): `/api` -> `http://localhost:4000`

## 5. Database Report (Schema + Data Model)

### 5.1 Database Stack
- DB Engine: PostgreSQL
- ORM: Drizzle ORM
- Schema location: `server/db/schemas/*.ts`
- Schema deployment: `bun run db:push`
- Studio tooling: `bun run db:studio`

### 5.2 Table Inventory and Purpose
1. `users`: login identity (fullName, username, password hash, avatar)
2. `roles`: role catalog
3. `user_roles`: many-to-many mapping between users and roles
4. `sessions`: auth sessions for cookie tokens
5. `students`: student profile + guardian + class/session mapping
6. `teachers`: teacher profile + banking/identity details
7. `documents`: user-linked uploaded files
8. `academic_sessions`: school year/term
9. `classes`: class master list
10. `subjects`: subject definitions per academic session
11. `class_subjects`: class/session/subject assignment (+ optional teacher)
12. `exams`: exam header (session/class/status/date range)
13. `exam_subjects`: subjects included in an exam with max/pass marks
14. `student_exam_enrollments`: exam-student participation mapping
15. `student_marks`: primary marks table (`studentId + examSubjectId`)
16. `marks`: legacy marks table kept for compatibility

### 5.3 Relational Design (High Level)
- `users` -> `user_roles` -> `roles`
- `users` -> `sessions`
- `users` -> (`students` or `teachers`) -> `documents`
- `academic_sessions` -> `subjects`
- `academic_sessions` + `classes` + `subjects` -> `class_subjects`
- `academic_sessions` + `classes` -> `exams`
- `exams` + `subjects` -> `exam_subjects`
- `exams` + `students` -> `student_exam_enrollments`
- `students` + `exam_subjects` -> `student_marks`

### 5.4 Constraints and Integrity Rules
- Unique constraints:
  - `users.username`
  - `roles.name`
  - `students.rollNumber`
  - `classes.name`
  - `academic_sessions.name`
  - `subjects` unique on `(sessionId, name)`
  - `class_subjects` unique on `(sessionId, classId, subjectId)`
  - `exam_subjects` unique on `(examId, subjectId)`
  - `student_exam_enrollments` unique on `(examId, studentId)`
  - `student_marks` unique on `(studentId, examSubjectId)`
- Foreign key behavior:
  - Multiple cascade deletes to prevent orphan rows.
  - `class_subjects.teacherId` uses `SET NULL` on teacher delete.

### 5.5 Validation Layer (API-level)
- Zod middleware checks payload shape and business rules.
- Examples:
  - Exam `endDate` cannot be before `startDate`.
  - `passMarks <= maxMarks`.
  - Required session/class inputs for student create/update.

### 5.6 Seed Data
Seeding command: `bun run db:seed`
- Inserts default roles: `admin`, `teacher`, `student`
- Inserts default super admin user:
  - username: `admin`
  - password: `admin123` (hashed before storage)
- Inserts sample students (`student1` to `student10`) with generated user/student rows.
- Creates/uses academic session `2025-2026` and classes `Class 1` to `Class 5` as needed.

### 5.7 Live Database Status
Attempted live DB connectivity from this workspace on 2026-02-28.
- Result: connection failed (`DB_CONNECT_ERR`).
- Impact: runtime row counts and actual data volume are not included in this report.
- Schema-level and seed-level database coverage is complete from source code analysis.

## 6. Operational Notes
- Uploaded files are served via `/upload/*` static route.
- API base in dev: frontend uses `/api/*`, backend runs on `:4000`.
- Two session concepts exist:
  - `sessions` table = authentication sessions
  - `academic_sessions` table = school term/session definitions

## 7. Risks and Gaps Identified
- Default seeded credentials (`admin` / `admin123`) are unsafe for production.
- Uploaded files are stored locally; no object storage abstraction for horizontal scaling.
- No migration history files in repository (schema push is direct).
- Could not verify live data health due DB connection failure in this environment.

## 8. Conclusion
The project is a structured, role-based school management system with strong relational modeling for exam and marks workflows. Database schema design is robust with meaningful uniqueness constraints and foreign keys. The main pending visibility gap is runtime database state due current DB connectivity failure.
