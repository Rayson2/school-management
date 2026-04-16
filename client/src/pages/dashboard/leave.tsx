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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import useUserStore from "@/store/user.store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type LeaveStatus = "pending" | "approved" | "rejected";
type ApplicantRole = "student" | "teacher" | null;

type LeaveItem = {
  id: string;
  applicantUserId: string;
  applicantName: string;
  applicantRole: "student" | "teacher";
  className: string | null;
  designation: string | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  adminRemarks: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 160)}`);
  }
};

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "-";

const toDateInputValue = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export default function LeaveRequestsPage() {
  const user = useUserStore((state) => state.user);
  const userRoles = user?.roles ?? [];
  const isAdmin = userRoles.includes("admin");
  const isTeacher = userRoles.includes("teacher");
  const isStudent = userRoles.includes("student");

  const [requests, setRequests] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<LeaveStatus[]>(["pending", "approved", "rejected"]);
  const [applicantRole, setApplicantRole] = useState<ApplicantRole>(null);
  const [studentMaxDays, setStudentMaxDays] = useState<number>(15);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [selectedRequest, setSelectedRequest] = useState<LeaveItem | null>(null);
  const [editStatus, setEditStatus] = useState<LeaveStatus>("pending");
  const [editRemarks, setEditRemarks] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  const todayInput = useMemo(() => toDateInputValue(new Date()), []);
  const maxLeaveDays = applicantRole === "student" ? studentMaxDays : null;
  const endDateMax = useMemo(() => {
    if (!startDate || !maxLeaveDays) return undefined;
    return toDateInputValue(addDays(new Date(startDate), maxLeaveDays - 1));
  }, [maxLeaveDays, startDate]);

  const loadOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/leave/options");
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to load leave options",
        );
      }

      const data = (result.data ?? {}) as {
        leaveTypes?: string[];
        statuses?: LeaveStatus[];
        applicantRole?: ApplicantRole;
        studentMaxDays?: number;
      };

      setLeaveTypes(Array.isArray(data.leaveTypes) ? data.leaveTypes : []);
      setStatuses(Array.isArray(data.statuses) ? data.statuses : ["pending", "approved", "rejected"]);
      setApplicantRole(data.applicantRole ?? null);
      setStudentMaxDays(typeof data.studentMaxDays === "number" ? data.studentMaxDays : 15);
      setLeaveType((current) => current || data.leaveTypes?.[0] || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leave options");
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (isAdmin && roleFilter !== "all") params.set("applicantRole", roleFilter);

      const response = await fetch(`/api/leave/list${params.toString() ? `?${params.toString()}` : ""}`);
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to load leave requests",
        );
      }

      setRequests(Array.isArray(result.data) ? (result.data as LeaveItem[]) : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leave requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, roleFilter, statusFilter]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const summary = useMemo(
    () =>
      statuses.reduce<Record<string, number>>((acc, status) => {
        acc[status] = requests.filter((request) => request.status === status).length;
        return acc;
      }, {}),
    [requests, statuses],
  );

  const roleBadge = applicantRole === "student" ? "Student Leave" : "Teacher Leave";

  const handleApply = async () => {
    if (!leaveType || !startDate || !endDate || !reason.trim()) {
      toast.error("Please fill all leave request fields");
      return;
    }

    if (startDate < todayInput) {
      toast.error("Back date is not allowed for leave applications");
      return;
    }

    if (endDate < startDate) {
      toast.error("End date cannot be before start date");
      return;
    }

    if (endDateMax && endDate > endDateMax) {
      toast.error(`End date cannot go beyond ${formatDate(endDateMax)}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/leave/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate,
          reason: reason.trim(),
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to submit leave request",
        );
      }

      toast.success("Leave request submitted");
      setStartDate("");
      setEndDate("");
      setReason("");
      await loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  const openDecisionDialog = (request: LeaveItem) => {
    setSelectedRequest(request);
    setEditStatus(request.status);
    setEditRemarks(request.adminRemarks ?? "");
  };

  const handleSaveDecision = async () => {
    if (!selectedRequest) return;

    setSavingDecision(true);
    try {
      const response = await fetch(`/api/leave/${selectedRequest.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          adminRemarks: editRemarks,
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to update leave request",
        );
      }

      toast.success("Leave request updated");
      setSelectedRequest(null);
      await loadRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update leave request");
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <DashboardLayout title="Leave Requests">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Leave Requests</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Review and manage student and teacher leave applications."
                : "Apply for leave and track the status of your requests."}
            </p>
          </div>
          <Button variant="outline" onClick={loadRequests} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {!isAdmin && (isTeacher || isStudent) && (
          <Card>
            <CardHeader>
              <CardTitle>{roleBadge} Application</CardTitle>
              <CardDescription>
                {applicantRole === "student"
                  ? `Students can request up to ${studentMaxDays} days per leave application.`
                  : "Teachers can request leave for more than 10 days when needed."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {applicantRole === "student" ? (
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4 rounded-xl border bg-blue-50/60 p-5">
                    <div>
                      <p className="text-sm font-medium text-blue-800">Student application</p>
                      <p className="text-sm text-muted-foreground">
                        Use this form for illness, family emergencies, exam-related absence, or other academic leave needs.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Leave Type</Label>
                        <Select value={leaveType} onValueChange={setLeaveType}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                          <SelectContent>
                            {leaveTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leaveReason">Reason</Label>
                        <Input
                          id="leaveReason"
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Example: fever, family event"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="leaveStartDate">Start Date</Label>
                        <Input
                          id="leaveStartDate"
                          type="date"
                          value={startDate}
                          min={todayInput}
                          onChange={(event) => setStartDate(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leaveEndDate">End Date</Label>
                        <Input
                          id="leaveEndDate"
                          type="date"
                          value={endDate}
                          min={startDate || todayInput}
                          max={endDateMax}
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-blue-100/60 p-3 text-sm text-blue-900">
                      Students cannot apply for more than <strong>{studentMaxDays} days</strong> in one leave request.
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border bg-white p-5">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Student leave rules</p>
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        Maximum days per request: <strong>{studentMaxDays}</strong>
                      </div>
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        Submit clear reasons so admin can verify quickly.
                      </div>
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        Long absences should match supporting school communication.
                      </div>
                    </div>

                    <Button className="mt-4 w-full" onClick={handleApply} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit Student Leave"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-xl border bg-amber-50/60 p-5">
                    <div className="mb-4">
                      <p className="text-sm font-medium text-amber-800">Teacher application</p>
                      <p className="text-sm text-muted-foreground">
                        Plan professional, medical, personal, or extended leave with a fuller note for admin review.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Leave Type</Label>
                        <Select value={leaveType} onValueChange={setLeaveType}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select leave type" />
                          </SelectTrigger>
                          <SelectContent>
                            {leaveTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leaveStartDate">Start Date</Label>
                        <Input
                          id="leaveStartDate"
                          type="date"
                          value={startDate}
                          min={todayInput}
                          onChange={(event) => setStartDate(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="leaveEndDate">End Date</Label>
                        <Input
                          id="leaveEndDate"
                          type="date"
                          value={endDate}
                          min={startDate || todayInput}
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-100/60 p-3 text-sm text-amber-900">
                      Teachers can apply for leave longer than <strong>10 days</strong> when required.
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-5">
                    <div className="space-y-2">
                      <Label htmlFor="leaveReason">Detailed Reason / Handover Note</Label>
                      <Textarea
                        id="leaveReason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Share the reason, expected duration, and any class or workload handover details"
                        className="min-h-36"
                      />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        Teachers may request leave longer than 10 days.
                      </div>
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                        Add enough context so admin can plan class coverage.
                      </div>
                    </div>

                    <Button className="mt-4 w-full md:w-auto" onClick={handleApply} disabled={submitting}>
                      {submitting ? "Submitting..." : "Submit Teacher Leave"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {statuses.map((status) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardDescription className="capitalize">{status}</CardDescription>
                <CardTitle className="text-3xl">{summary[status] ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? "Manage Leave Requests" : "My Leave Requests"}</CardTitle>
            <CardDescription>
              {isAdmin
                ? "Filter and review requests from students and teachers."
                : "Track the status, duration, and admin remarks for your leave applications."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-3 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdmin && (
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All applicants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All applicants</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="teacher">Teachers</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Button onClick={loadRequests} disabled={loading}>
                Search
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Applicant</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Created</TableHead>
                  {isAdmin && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    {isAdmin && (
                      <TableCell>
                        <div className="font-medium">{request.applicantName}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {request.applicantRole}
                          {request.className ? ` • ${request.className}` : ""}
                          {request.designation ? ` • ${request.designation}` : ""}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{request.leaveType}</TableCell>
                    <TableCell>
                      <div>{formatDate(request.startDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        to {formatDate(request.endDate)}
                      </div>
                    </TableCell>
                    <TableCell>{request.totalDays}</TableCell>
                    <TableCell className="capitalize">{request.status}</TableCell>
                    <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                    <TableCell>{request.adminRemarks ?? "-"}</TableCell>
                    <TableCell>{formatDate(request.createdAt)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openDecisionDialog(request)}>
                          Review
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!loading && requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 7} className="h-20 text-center">
                      No leave requests found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Leave Request</DialogTitle>
              <DialogDescription>
                Update the request status and add optional admin remarks.
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Request Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Applicant:</strong> {selectedRequest.applicantName}</p>
                    <p><strong>Role:</strong> <span className="capitalize">{selectedRequest.applicantRole}</span></p>
                    <p><strong>Leave Type:</strong> {selectedRequest.leaveType}</p>
                    <p><strong>Duration:</strong> {selectedRequest.totalDays} day(s)</p>
                    <p><strong>Dates:</strong> {formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)}</p>
                    <p><strong>Reason:</strong> {selectedRequest.reason}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Decision</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={(value) => setEditStatus(value as LeaveStatus)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leaveAdminRemarks">Admin Remarks</Label>
                      <Textarea
                        id="leaveAdminRemarks"
                        value={editRemarks}
                        onChange={(event) => setEditRemarks(event.target.value)}
                        placeholder="Add approval notes or rejection reason"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDecision} disabled={savingDecision}>
                {savingDecision ? "Saving..." : "Save Decision"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
