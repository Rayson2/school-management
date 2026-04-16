import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type LeaveStatus = "pending" | "approved" | "rejected";

type LeaveItem = {
  id: string;
  applicantName: string;
  applicantRole: "student" | "teacher";
  className: string | null;
  designation: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  createdAt: string | null;
};

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "-";

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

export default function DashboardHomePage() {
  const userRoles = useUserStore((state) => state.user?.roles ?? []);
  const isAdmin = userRoles.includes("admin");
  const canViewLeaves = userRoles.includes("admin") || userRoles.includes("teacher") || userRoles.includes("student");
  const canViewAttendance = userRoles.includes("admin") || userRoles.includes("teacher");
  const [attendanceStatus, setAttendanceStatus] = useState<{
    isFeatureEnabled: boolean;
    activeUntil: string | null;
  } | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveItem[]>([]);

  const leaveSummary = useMemo(() => {
    return ["pending", "approved", "rejected"].reduce<Record<string, number>>((acc, status) => {
      acc[status] = leaveRequests.filter((item) => item.status === status).length;
      return acc;
    }, {});
  }, [leaveRequests]);

  const leaveRoleSummary = useMemo(
    () => ({
      student: leaveRequests.filter((item) => item.applicantRole === "student").length,
      teacher: leaveRequests.filter((item) => item.applicantRole === "teacher").length,
    }),
    [leaveRequests],
  );

  useEffect(() => {
    if (!canViewAttendance) return;

    const loadAttendanceConfig = async () => {
      try {
        const response = await fetch("/api/attendance/config", { credentials: "include" });
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to fetch attendance status",
          );
        }

        setAttendanceStatus(
          result.data as { isFeatureEnabled: boolean; activeUntil: string | null },
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch attendance status");
      }
    };

    void loadAttendanceConfig();
  }, [canViewAttendance]);

  useEffect(() => {
    if (!canViewLeaves) return;

    const loadLeaveRequests = async () => {
      try {
        const response = await fetch("/api/leave/list", { credentials: "include" });
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string" ? result.error : "Failed to fetch leave requests",
          );
        }

        setLeaveRequests(Array.isArray(result.data) ? (result.data as LeaveItem[]) : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch leave requests");
      }
    };

    void loadLeaveRequests();
  }, [canViewLeaves]);

  return (
    <DashboardLayout title="Overview">
      <h1 className="text-2xl font-bold">Welcome to Dashboard</h1>
      <div className="space-y-6">
        {canViewAttendance && attendanceStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Feature Status</CardTitle>
              <CardDescription>
                <span
                  className={
                    attendanceStatus.isFeatureEnabled
                      ? "inline-flex rounded px-2 py-1 text-green-800 bg-green-100 font-medium"
                      : "inline-flex rounded px-2 py-1 text-red-800 bg-red-100 font-medium"
                  }
                >
                  {attendanceStatus.isFeatureEnabled ? "Enabled" : "Disabled"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard/attendance">Attendance Setup</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/attendance/records">Attendance Records</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {canViewLeaves && (
          <Card>
            <CardHeader>
              <CardTitle>{isAdmin ? "Leave Applications Overview" : "My Leave Applications"}</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Quick visibility into pending, approved, and rejected leave requests."
                  : "Track your leave request progress and open the leave page to apply or review details."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdmin && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border bg-sky-50 p-4">
                    <p className="text-sm text-muted-foreground">Student Leave Requests</p>
                    <p className="text-3xl font-bold text-sky-700">{leaveRoleSummary.student}</p>
                  </div>
                  <div className="rounded-lg border bg-violet-50 p-4">
                    <p className="text-sm text-muted-foreground">Teacher Leave Requests</p>
                    <p className="text-3xl font-bold text-violet-700">{leaveRoleSummary.teacher}</p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-amber-50 p-4">
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-amber-700">{leaveSummary.pending ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-green-50 p-4">
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-3xl font-bold text-green-700">{leaveSummary.approved ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-red-50 p-4">
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-3xl font-bold text-red-700">{leaveSummary.rejected ?? 0}</p>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b px-4 py-3">
                  <p className="font-medium">Recent Leave Requests</p>
                </div>
                <div className="divide-y">
                  {leaveRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">
                          {isAdmin ? request.applicantName : request.leaveType}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isAdmin
                            ? `${request.applicantRole === "student" ? "Student" : "Teacher"}${request.className ? ` • ${request.className}` : request.designation ? ` • ${request.designation}` : ""}`
                            : `${request.leaveType} • ${request.totalDays} day(s)`}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-right">
                        <p className="capitalize">{request.status}</p>
                        <p>{formatDate(request.startDate)} to {formatDate(request.endDate)}</p>
                      </div>
                    </div>
                  ))}
                  {leaveRequests.length === 0 && (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      No leave requests available yet.
                    </div>
                  )}
                </div>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/leave">
                  {isAdmin ? "Manage Leave Requests" : "Open Leave Page"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
