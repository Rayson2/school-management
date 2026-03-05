
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useUserStore from "@/store/user.store";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type TeacherOption = {
  id: string;
  fullName: string;
  username: string;
};

type AdminAttendanceRecord = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherUsername: string;
  attendanceDate: string;
  checkInAt: string;
  method: string;
  status: string;
  distanceMeters: number | null;
  remarks: string | null;
};

type TeacherAttendanceRecord = {
  id: string;
  attendanceDate: string;
  checkInAt: string;
  method: string;
  status: string;
  distanceMeters: number | null;
  remarks: string | null;
};

type AttendanceConfig = {
  isFeatureEnabled: boolean;
  activeUntil: string | null;
};

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "N/A";

const toLocalDateTimeInput = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
};

export default function AttendanceRecordsPage() {
  const userRoles = useUserStore((state) => state.user?.roles ?? []);
  const isAdmin = userRoles.includes("admin");
  const isTeacher = userRoles.includes("teacher");

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [filterTeacherId, setFilterTeacherId] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  const [adminRecords, setAdminRecords] = useState<AdminAttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AdminAttendanceRecord | null>(null);
  const [editAttendanceDate, setEditAttendanceDate] = useState("");
  const [editCheckInAt, setEditCheckInAt] = useState("");
  const [editMethod, setEditMethod] = useState<"auto" | "manual">("manual");
  const [editRemarks, setEditRemarks] = useState("");
  const [updatingRecord, setUpdatingRecord] = useState(false);

  const [teacherFromDate, setTeacherFromDate] = useState("");
  const [teacherToDate, setTeacherToDate] = useState("");
  const [teacherRecords, setTeacherRecords] = useState<TeacherAttendanceRecord[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [config, setConfig] = useState<AttendanceConfig | null>(null);

  const loadTeachers = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch("/api/attendance/teachers", { credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load teachers");
      setTeachers(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load teachers");
    }
  };

  const loadConfig = async () => {
    if (!isAdmin && !isTeacher) return;
    try {
      const response = await fetch("/api/attendance/config", { credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load config");
      setConfig(result.data as AttendanceConfig);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance config");
    }
  };

  const loadAdminRecords = async () => {
    if (!isAdmin) return;
    setRecordsLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterTeacherId) query.set("teacherId", filterTeacherId);
      if (filterFromDate) query.set("fromDate", filterFromDate);
      if (filterToDate) query.set("toDate", filterToDate);

      const response = await fetch(`/api/attendance/records?${query.toString()}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to load records");
      setAdminRecords(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load attendance records");
    } finally {
      setRecordsLoading(false);
    }
  };

  const loadTeacherRecords = async () => {
    if (!isTeacher) return;
    setTeacherLoading(true);
    try {
      const query = new URLSearchParams();
      if (teacherFromDate) query.set("fromDate", teacherFromDate);
      if (teacherToDate) query.set("toDate", teacherToDate);

      const response = await fetch(`/api/attendance/my-attendance?${query.toString()}`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load your attendance");
      }
      setTeacherRecords(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load your attendance");
    } finally {
      setTeacherLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadTeachers();
    loadAdminRecords();
    loadTeacherRecords();
  }, []);

  const startEditRecord = (record: AdminAttendanceRecord) => {
    setEditingRecord(record);
    setEditAttendanceDate(record.attendanceDate);
    setEditCheckInAt(toLocalDateTimeInput(new Date(record.checkInAt)));
    setEditMethod(record.method === "auto" ? "auto" : "manual");
    setEditRemarks(record.remarks ?? "");
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;
    const parsedCheckInAt = new Date(editCheckInAt);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(editAttendanceDate)) {
      return toast.error("Please provide a valid attendance date");
    }

    if (Number.isNaN(parsedCheckInAt.getTime())) {
      return toast.error("Please provide a valid check-in date and time");
    }

    setUpdatingRecord(true);
    try {
      const response = await fetch(`/api/attendance/records/${editingRecord.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceDate: editAttendanceDate,
          checkInAt: parsedCheckInAt.toISOString(),
          method: editMethod,
          remarks: editRemarks.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update attendance record");
      }
      toast.success("Attendance record updated");
      setEditingRecord(null);
      await loadAdminRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update attendance record");
    } finally {
      setUpdatingRecord(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    const isConfirmed = window.confirm("Delete this attendance record?");
    if (!isConfirmed) return;

    setDeletingRecordId(recordId);
    try {
      const response = await fetch(`/api/attendance/records/${recordId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete attendance record");
      }
      toast.success("Attendance record deleted");
      await loadAdminRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete attendance record");
    } finally {
      setDeletingRecordId(null);
    }
  };

  const handleAutoCheckIn = async () => {
    if (!navigator.geolocation) return toast.error("Geolocation is not supported in this browser");

    setCheckingIn(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const response = await fetch("/api/attendance/auto-check-in", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Auto check-in failed");
      toast.success(result.message || "Attendance marked successfully");
      await loadConfig();
      await loadTeacherRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto check-in failed");
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <DashboardLayout title="Attendance Records">
      <div className="space-y-6">
        {config && (isAdmin || isTeacher) && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Feature Status</CardTitle>
              <CardDescription>
                <span
                  className={
                    config.isFeatureEnabled
                      ? "inline-flex rounded px-2 py-1 text-green-800 bg-green-100 font-medium"
                      : "inline-flex rounded px-2 py-1 text-red-800 bg-red-100 font-medium"
                  }
                >
                  {config.isFeatureEnabled ? "Enabled" : "Disabled"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {config.activeUntil
                ? `Active until ${formatDateTime(config.activeUntil)}`
                : "No auto-disable time set"}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Attendance Records</h1>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              loadConfig();
              loadAdminRecords();
              loadTeacherRecords();
            }}
            disabled={recordsLoading || teacherLoading}
          >
            {recordsLoading || teacherLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {isAdmin && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>All Teacher Records</CardTitle>
                <CardDescription>Filter and view attendance entries.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={filterTeacherId}
                    onChange={(e) => setFilterTeacherId(e.target.value)}
                  >
                    <option value="">All teachers</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.fullName}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={filterToDate}
                    onChange={(e) => setFilterToDate(e.target.value)}
                  />
                  <Button type="button" onClick={loadAdminRecords} disabled={recordsLoading}>
                    {recordsLoading ? "Loading..." : "Apply Filters"}
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Distance</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                            No attendance records.
                          </TableCell>
                        </TableRow>
                      ) : (
                        adminRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {record.teacherName}
                              <div className="text-xs text-muted-foreground">{record.teacherUsername}</div>
                            </TableCell>
                            <TableCell>{record.attendanceDate}</TableCell>
                            <TableCell>{formatDateTime(record.checkInAt)}</TableCell>
                            <TableCell className="capitalize">{record.method}</TableCell>
                            <TableCell>{record.distanceMeters ?? "-"}</TableCell>
                            <TableCell>{record.remarks || "-"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditRecord(record)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteRecord(record.id)}
                                  disabled={deletingRecordId === record.id}
                                >
                                  {deletingRecordId === record.id ? "Deleting..." : "Delete"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {isTeacher && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Automatic Attendance</CardTitle>
                <CardDescription>Attendance is marked automatically when you are near school and feature is ON.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="button" onClick={handleAutoCheckIn} disabled={checkingIn}>{checkingIn ? "Checking location..." : "Mark Attendance Automatically"}</Button>
                <p className="text-sm text-muted-foreground">Manual attendance is disabled for teachers.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Attendance</CardTitle>
                <CardDescription>View your attendance history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input
                    type="date"
                    value={teacherFromDate}
                    onChange={(e) => setTeacherFromDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={teacherToDate}
                    onChange={(e) => setTeacherToDate(e.target.value)}
                  />
                  <Button type="button" onClick={loadTeacherRecords} disabled={teacherLoading}>
                    {teacherLoading ? "Loading..." : "Apply Filters"}
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Distance</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                            No records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        teacherRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.attendanceDate}</TableCell>
                            <TableCell>{formatDateTime(record.checkInAt)}</TableCell>
                            <TableCell className="capitalize">{record.method}</TableCell>
                            <TableCell>{record.distanceMeters ?? "-"}</TableCell>
                            <TableCell>{record.remarks || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Attendance Record</DialogTitle>
              <DialogDescription>
                Update check-in date/time, method, and remarks for this attendance entry.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-attendance-date">Attendance Date</Label>
                <Input
                  id="edit-attendance-date"
                  type="date"
                  value={editAttendanceDate}
                  onChange={(e) => setEditAttendanceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-checkin">Check-in DateTime</Label>
                <Input
                  id="edit-checkin"
                  type="datetime-local"
                  value={editCheckInAt}
                  onChange={(e) => setEditCheckInAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-method">Method</Label>
                <select
                  id="edit-method"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value === "auto" ? "auto" : "manual")}
                >
                  <option value="manual">Manual</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-remarks">Remarks</Label>
                <Input
                  id="edit-remarks"
                  placeholder="Optional remarks"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRecord(null)}
                disabled={updatingRecord}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateRecord} disabled={updatingRecord}>
                {updatingRecord ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
