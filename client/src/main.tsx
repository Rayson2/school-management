import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import Homepage from "./pages/Home";
import AboutPage from "./pages/About";
import ContactPage from "./pages/Contact";
import GalleryPage from "./pages/Gallery";
import AdmissionPage from "./pages/Admission";
import AssignmentsPage from "./pages/Assignments";
import StudentVerifyPage from "./pages/StudentVerify";
import TCVerifyPage from "./pages/TCVerify";
import ResultPage from "./pages/Result";
import AdmitCardPage from "./pages/AdmitCard";
import TeacherActivitiesPage from "./pages/TeacherActivities";
import HomepageLayout from "./components/Layout";
import LoginPage from "./pages/Login";
import DashboardHomePage from "./pages/dashboard";
import { Toaster } from "sonner";
import ProtectedLayout from "./components/ProtectedLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import StudentsPage from "./pages/dashboard/students";
import AddStudentPage from "./pages/dashboard/students/add";
import TeachersPage from "./pages/dashboard/teachers";
import AddTeacherPage from "./pages/dashboard/teachers/add";
import ClassesPage from "./pages/dashboard/classes";
import AddClassPage from "./pages/dashboard/classes/add";
import SessionsPage from "./pages/dashboard/sessions";
import CreateSessionPage from "./pages/dashboard/sessions/create";
import ExamsPage from "./pages/dashboard/exams";
import AddExamPage from "./pages/dashboard/exams/add";
import AdmitCardControlPage from "./pages/dashboard/exams/admit-card-control";
import EditExamPage from "./pages/dashboard/exams/edit";
import AddSubjectPage from "./pages/dashboard/subjects/add";
import ClassSubjectsPage from "./pages/dashboard/class-subjects";
import MarksPage from "./pages/dashboard/marks";
import MarksControlPage from "./pages/dashboard/marks/control";
import CarouselPage from "./pages/dashboard/cms/carousel";
import CMSGalleryPage from "./pages/dashboard/cms/gallery";
import CMSCertificatePage from "./pages/dashboard/cms/certificate";
import ProfileSettingsPage from "./pages/dashboard/settings/profile";
import AccountSettingsPage from "./pages/dashboard/settings/account";
import DocumentsManagementPage from "./pages/dashboard/documents";
import UnauthorizedPage from "./pages/Unauthorized";
import NotFoundPage from "./pages/NotFound";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import MyResultsPage from "./pages/dashboard/results/my-results";
import RtSheetSelectorPage from "./pages/dashboard/results/rt-sheet-selector";
import RtSheetPage from "./pages/dashboard/results/rt-sheet";
import StudentCopyMarksheetPage from "./pages/dashboard/results/student-copy-marksheet";
import OfficialMarksheetPage from "./pages/dashboard/results/official-marksheet";
import OfficialMarksheetBulkPage from "./pages/dashboard/results/official-marksheet-bulk";
import ResultLogoPage from "./pages/dashboard/results/logo";
import ResultControlPage from "./pages/dashboard/results/result-control";
import DashboardAdmitCardPage from "./pages/dashboard/results/admit-card";
import PayrollIndexPage from "./pages/dashboard/payroll";
import AddPayrollPage from "./pages/dashboard/payroll/Add";
import EditPayrollPage from "./pages/dashboard/payroll/Edit";
import ViewPayrollPage from "./pages/dashboard/payroll/View";
import PayrollSlipsPage from "./pages/dashboard/payroll/slips";
import PayrollSlipSheetPage from "./pages/dashboard/payroll/slip-sheet";
import FeeManagementPage from "./pages/dashboard/fees";
import StudentMonthlyFeeRecordsPage from "./pages/dashboard/fees/records";
import NoticesPage from "./pages/dashboard/notices";
import RecordsPage from "./pages/dashboard/records";
import AttendancePage from "./pages/dashboard/attendance";
import AttendanceRecordsPage from "./pages/dashboard/attendance/records";
import AdmissionInquiriesPage from "./pages/dashboard/admissions/inquiries";
import LeaveRequestsPage from "./pages/dashboard/leave";

const adminRoutes = [
  { path: "students", element: <StudentsPage /> },
  { path: "students/add", element: <AddStudentPage /> },
  { path: "teachers", element: <TeachersPage /> },
  { path: "teachers/add", element: <AddTeacherPage /> },
  { path: "classes", element: <ClassesPage /> },
  { path: "classes/add", element: <AddClassPage /> },
  { path: "sessions", element: <SessionsPage /> },
  { path: "sessions/create", element: <CreateSessionPage /> },
  { path: "exams", element: <ExamsPage /> },
  { path: "exams/add", element: <AddExamPage /> },
  { path: "exams/admit-card-control", element: <AdmitCardControlPage /> },
  { path: "exams/:id/edit", element: <EditExamPage /> },
  { path: "subjects/add", element: <AddSubjectPage /> },
  { path: "class-subjects", element: <ClassSubjectsPage /> },
  { path: "cms/carousel", element: <CarouselPage /> },
  { path: "cms/gallery", element: <CMSGalleryPage /> },
  { path: "cms/certificate", element: <CMSCertificatePage /> },
  { path: "documents", element: <DocumentsManagementPage /> },
  { path: "documents/controls", element: <DocumentsManagementPage /> },
  { path: "results/logo", element: <ResultLogoPage /> },
  { path: "results/result-control", element: <ResultControlPage /> },
  { path: "marks/control", element: <MarksControlPage /> },
  { path: "payroll", element: <PayrollIndexPage /> },
  { path: "payroll/add", element: <AddPayrollPage /> },
  { path: "payroll/:id/edit", element: <EditPayrollPage /> },
  { path: "fees", element: <FeeManagementPage /> },
  { path: "fees/records", element: <StudentMonthlyFeeRecordsPage /> },
  { path: "attendance", element: <AttendancePage /> },
  { path: "admissions/inquiries", element: <AdmissionInquiriesPage /> },
];

const adminTeacherRoutes = [
  { path: "marks", element: <MarksPage /> },
  { path: "attendance/records", element: <AttendanceRecordsPage /> },
];
const recordsRoute = { path: "records", element: <RecordsPage /> };

const adminResultRoutes = [
  { path: "rt-sheet", element: <RtSheetSelectorPage /> },
  { path: "rt-sheet/:examId", element: <RtSheetPage /> },
  {
    path: "official-marksheet/:studentId/:examId",
    element: <OfficialMarksheetPage />,
  },
  {
    path: "official-marksheet/bulk/:examId",
    element: <OfficialMarksheetBulkPage />,
  },
];

const sharedResultRoutes = [
  {
    path: "exams/admit-card",
    element: <DashboardAdmitCardPage />,
  },
  {
    path: "results/admit-card",
    element: <DashboardAdmitCardPage />,
  },
  {
    path: "marksheet/:studentId/:examId",
    element: <StudentCopyMarksheetPage />,
  },
];

const studentRoutes = [{ path: "my-results", element: <MyResultsPage /> }];

const sharedNoticeRoutes = [{ path: "notices", element: <NoticesPage /> }];

const sharedLeaveRoutes = [{ path: "leave", element: <LeaveRequestsPage /> }];

const sharedPayrollRoutes = [
  { path: "payroll/:id", element: <ViewPayrollPage /> },
  { path: "payroll/slips", element: <PayrollSlipsPage /> },
  { path: "payroll/slips/:id", element: <PayrollSlipSheetPage /> },
];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomepageLayout />}>
            <Route index element={<Homepage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            <Route path="admission" element={<AdmissionPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="student-verify" element={<StudentVerifyPage />} />
            <Route path="tc-verify" element={<TCVerifyPage />} />
            <Route path="result" element={<ResultPage />} />
            <Route path="admit-card" element={<AdmitCardPage />} />
            <Route
              path="teacher-activities"
              element={<TeacherActivitiesPage />}
            />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedLayout />}>
            <Route index element={<DashboardHomePage />} />

            {/* Admin-only routes */}
            {adminRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {/* Admin/Teacher routes */}
            {adminTeacherRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin", "teacher"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {/* Admin-only result routes */}
            {adminResultRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {/* Shared result routes (admin/student) */}
            {sharedResultRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin", "student"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {/* Student-only routes */}
            {studentRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["student"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {sharedPayrollRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin", "teacher"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {sharedNoticeRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin", "teacher", "student"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            {sharedLeaveRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <RoleProtectedRoute requiredRoles={["admin", "teacher", "student"]}>
                    {route.element}
                  </RoleProtectedRoute>
                }
              />
            ))}

            <Route
              path={recordsRoute.path}
              element={
                <RoleProtectedRoute requiredRoles={["admin", "teacher"]}>
                  {recordsRoute.element}
                </RoleProtectedRoute>
              }
            />

            {/* Settings: profile available to all */}
            <Route path="settings/profile" element={<ProfileSettingsPage />} />
            <Route path="settings/account" element={<AccountSettingsPage />} />
          </Route>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </TooltipProvider>
    <Toaster
      position="bottom-right"
      richColors={false}
      expand={false}
      toastOptions={{
        className: "rounded-xl border border-gray-200 bg-white text-gray-900 shadow-md",
      }}
    />
  </StrictMode>
);
