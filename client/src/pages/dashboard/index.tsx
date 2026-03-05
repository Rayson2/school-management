import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import useUserStore from "@/store/user.store";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

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
  const canViewAttendance = userRoles.includes("admin") || userRoles.includes("teacher");
  const [attendanceStatus, setAttendanceStatus] = useState<{
    isFeatureEnabled: boolean;
    activeUntil: string | null;
  } | null>(null);

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
      </div>
    </DashboardLayout>
  );
}
