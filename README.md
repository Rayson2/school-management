# School Management System (Backend + Frontend)

Full-stack school administration application with:
- `server/`: Bun + Hono backend APIs
- `client/`: React + Vite + Tailwind

This repository runs both apps together for local development and supports role-based workflows for `admin`, `teacher`, and `student`.

## Full Technical Report

A deeper architecture + DB report is available in:
- [PROJECT_REPORT.md](./PROJECT_REPORT.md)

## Core Features

- Cookie-based authentication with server-side sessions
- Role-based access control (admin/teacher/student)
- Student and teacher profile management
- Class and academic session management
- Subject, class-subject assignment, and exam lifecycle
- Marks entry and update flow
- Student result APIs:
  - My Results
  - Downloadable student copy PDF
  - RT sheet
  - Official marksheet data
- Document upload management:
  - Self document uploads
  - Admin-managed document uploads per user
- Profile photo uploads for users/students/teachers

## Tech Stack

- Runtime: Bun
- API framework: Hono
- Validation: Zod + `@hono/zod-validator`
- Password hashing: `bcryptjs`
- PDF generation: `pdf-lib`
- Frontend: React 19 + Vite + Tailwind v4 + Zustand

## Project Structure

- `server/index.ts`: API app bootstrap and route mounting
- `server/routes/`: API route modules
- `server/middlewares/`: auth + validation middleware
- `server/db/schemas/`: database schema definitions
- `server/upload/`: uploaded files (created at runtime)
- `client/src/`: React frontend source
- `.env`: runtime environment variables

## Prerequisites

- Bun installed

## Environment Variables

Configured and validated via `server/utils/env.ts`:

- `DATABASE_URL` (optional): enable DB-backed routes
- `PORT` (optional): server port (default `4000`)

Example:

```env
# DATABASE_URL=postgresql://user:password@localhost:5432/schooldb
PORT=4000
```

Notes:
- `NODE_ENV=production` enables `secure` cookies.
- Existing `.env` values in your local machine should be treated as sensitive credentials.

## Installation

Install dependencies in both root and client:

```bash
bun install
cd client && bun install && cd ..
```

## Running Locally

```bash
bun run dev
```

This starts:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

Frontend dev proxy (`client/vite.config.ts`) sends `/api/*` to backend and strips `/api` prefix.

## Scripts

Root scripts:
- `bun run dev`: run client + server together
- `bun run dev:client`: run frontend only
- `bun run dev:server`: run backend only

Client scripts (`cd client`):
- `bun run dev`
- `bun run build`
- `bun run lint`
- `bun run preview`

## Database Notes

Database routes still exist in the server, but local DB migration/seed tooling files were removed.
If `DATABASE_URL` is not set, DB-backed endpoints will fail at runtime.

## Authentication and Authorization

- Cookie name: `session`
- Session persistence: `sessions` table
- Cookie options:
  - `HttpOnly: true`
  - `SameSite: lax`
  - `maxAge: 7 days`
  - `secure` only in production
- Role checks are enforced via `requireRoles([...])`

## API Conventions

Direct backend base URL:
- `http://localhost:4000`

Frontend dev calls:
- `/api/...` (proxied to backend)

Typical response shape:
- Success: `{ success: true, message, data? }`
- Error: `{ success: false, error }`

## API Routes (Detailed)

All paths below are relative to mounted prefixes in `server/index.ts`.

### Auth (`/auth`)

- `POST /auth/login`
- `DELETE /auth/logout`
- `GET /auth/me`
- `GET /auth/profile`
- `PUT /auth/profile`
- `POST /auth/change-password`
- `POST /auth/profile-pic`

### Students (`/student`)

- `GET /student/all` (admin, teacher)
- `GET /student/:id` (admin, teacher)
- `GET /student/lookup/:identifier` (admin, teacher)
- `POST /student/add` (admin)
- `PUT /student/:id` (admin)
- `POST /student/:id/change-password` (admin)
- `POST /student/:id/profile-pic` (admin)
- `GET /student/:id/documents` (admin, teacher)
- `POST /student/:id/documents` (admin)
- `DELETE /student/:id/documents/:documentId` (admin)
- `DELETE /student/:id` (admin)

### Teachers (`/teacher`)

- `GET /teacher/all` (admin)
- `GET /teacher/:id` (admin)
- `GET /teacher/lookup/:identifier` (admin)
- `POST /teacher/add` (admin)
- `PUT /teacher/:id` (admin)
- `POST /teacher/:id/profile-pic` (admin)
- `GET /teacher/:id/documents` (admin)
- `POST /teacher/:id/documents` (admin)
- `DELETE /teacher/:id/documents/:documentId` (admin)
- `DELETE /teacher/:id` (admin)

### Documents (`/document`)

Self-service:
- `GET /document/me/documents`
- `POST /document/me/documents`
- `DELETE /document/me/documents/:documentId`

Admin management:
- `GET /document/admin/users`
- `GET /document/admin/users/:userId/documents`
- `POST /document/admin/users/:userId/documents`
- `DELETE /document/admin/users/:userId/documents/:documentId`

### Classes (`/class`)

- `GET /class/all`
- `POST /class/add`
- `PUT /class/:id`
- `DELETE /class/:id`

### Academic Sessions (`/academic-session`)

- `GET /academic-session/all`
- `POST /academic-session/add`
- `PUT /academic-session/:id`
- `DELETE /academic-session/:id`

### Exams and Marks (`/exam`)

Sessions/subjects:
- `GET /exam/sessions/all`
- `GET /exam/subjects/all`
- `GET /exam/subject/all` (legacy alias)
- `POST /exam/subjects/create`
- `POST /exam/subject/create` (legacy alias)
- `DELETE /exam/subjects/:id`
- `DELETE /exam/subject/:id` (legacy alias)

Class-subject mapping:
- `POST /exam/class-subjects/assign`
- `GET /exam/class-subjects/all`
- `DELETE /exam/class-subjects/:id`

Exam lifecycle:
- `POST /exam/create`
- `GET /exam/all`
- `GET /exam/:id`
- `PUT /exam/:id`
- `DELETE /exam/:id`
- `POST /exam/:id/subjects`
- `POST /exam/:id/enroll-students`
- `GET /exam/:id/students`
- `GET /exam/:id/marks`

Marks entry:
- `POST /exam/marks`
- `PUT /exam/marks/:markId`

### Results (`/results`)

- `GET /results/my-results` (student)
- `GET /results/download/:examId` (student, PDF student copy)
- `GET /results/official-marksheet/:studentId/:examId` (admin, teacher)
- `GET /results/rt-sheet/:examId` (admin, teacher)

## Uploads and Static Serving

- Files are written under `server/upload/...`
- Public URLs are stored as `/api/upload/...`
- Backend static mount serves `/upload/*` from `./server`

This means frontend should use stored `/api/upload/...` URLs directly in dev.

## Typical Data Flow

Recommended operational order:

1. Create academic session(s)
2. Create class(es)
3. Create subject(s) in session
4. Assign subjects to class
5. Create exam for class + session
6. Add subjects to exam
7. Enroll students in exam
8. Enter/update marks
9. View RT sheet / student results / marksheet data

## Important Notes

- Root and client dependencies are separate; install both.
- The backend expects cookie credentials for authenticated APIs.
- Result PDF download fails if exam marks are still pending for the student.
- `roles`/`sessions` naming:
  - `sessions` table = auth sessions
  - `academic_sessions` table = school year/session data

## Security Notes

- Do not commit real database credentials or secrets in `.env`.
- Rotate any credentials already committed or shared.
- Use production-grade secret management outside local development.
