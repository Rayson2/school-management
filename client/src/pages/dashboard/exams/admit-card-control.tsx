import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXAM_TYPE_LABELS } from "@/lib/examStructure";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Mode = "off" | "only_paid" | "all";

type ExamOption = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  academicYear: string;
  className: string;
  sessionId: string;
};

type StudentStatus = {
  studentId: string;
  fullName: string;
  rollNumber: string;
  enrollmentNo: string | null;
  admissionNo: string | null;
  admissionType: "new" | "old";
  paymentStatus: "paid" | "unpaid";
  fullyPaid: boolean;
  requiredMonthCount: number;
  paidMonthCount: number;
  missingMonthCount: number;
  partialMonthCount: number;
  totalExpectedAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  missingMonths: string[];
  partialMonths: string[];
  warning: string | null;
};

type ControlPayload = {
  exam: {
    id: string;
    name: string;
    examType: "quarterly" | "half_yearly" | "annual";
    academicYear: string;
    className: string;
    sessionName: string;
  };
  control: {
    mode: Mode;
    newStudentAmount: number;
    oldStudentAmount: number;
    defaultNewStudentAmount: number | null;
    defaultOldStudentAmount: number | null;
    startMonth: number | null;
    startYear: number | null;
    endMonth: number | null;
    endYear: number | null;
    updatedAt: string | null;
  };
  summary: {
    totalStudents: number;
    paidStudents: number;
    unpaidStudents: number;
  };
  students: StudentStatus[];
};

type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error?: string };

const MODE_LABELS: Record<Mode, string> = {
  off: "OFF",
  only_paid: "OnlyPAID",
  all: "ALL",
};

const MODE_HELPER: Record<Mode, string> = {
  off: "Nobody can open admit cards.",
  only_paid: "Only students with all required fees fully paid can open admit cards.",
  all: "Every student can open admit cards, regardless of payment.",
};

const parseJson = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text) return null as T | null;
  return JSON.parse(text) as T;
};

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? `Rs ${value.toLocaleString("en-IN")}` : "Not set";

const formatMonthRange = (
  startMonth: number | null,
  startYear: number | null,
  endMonth: number | null,
  endYear: number | null,
) => {
  if (!startMonth || !startYear || !endMonth || !endYear) {
    return "Fee month range is not configured";
  }

  const start = new Date(Date.UTC(startYear, startMonth - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const end = new Date(Date.UTC(endYear, endMonth - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return `${start} to ${end}`;
};

export default function AdmitCardControlPage() {
  const navigate = useNavigate();
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingControl, setLoadingControl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [controlData, setControlData] = useState<ControlPayload | null>(null);
  const [mode, setMode] = useState<Mode>("off");
  const [newStudentAmount, setNewStudentAmount] = useState("0");
  const [oldStudentAmount, setOldStudentAmount] = useState("0");

  useEffect(() => {
    const loadExams = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/exam/all");
        const result = await parseJson<ApiResponse<ExamOption[]>>(response);

        if (!response.ok || !result?.success) {
          throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        setExamOptions(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exams");
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadExams();
  }, []);

  useEffect(() => {
    if (!examOptions.length) return;
    if (!examOptions.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(examOptions[0]?.id ?? "");
    }
  }, [examOptions, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) {
      setControlData(null);
      return;
    }

    const loadControl = async () => {
      setLoadingControl(true);
      try {
        const response = await fetch(`/api/results/admit-card-control/${selectedExamId}`);
        const result = await parseJson<ApiResponse<ControlPayload>>(response);

        if (!response.ok || !result?.success) {
          throw new Error(
            result && "error" in result
              ? result.error || "Failed to load admit card control"
              : "Failed to load admit card control",
          );
        }

        setControlData(result.data);
        setMode(result.data.control.mode);
        setNewStudentAmount(String(result.data.control.newStudentAmount));
        setOldStudentAmount(String(result.data.control.oldStudentAmount));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load admit card control");
        setControlData(null);
      } finally {
        setLoadingControl(false);
      }
    };

    void loadControl();
  }, [selectedExamId]);

  const unpaidStudents = useMemo(
    () => controlData?.students.filter((student) => !student.fullyPaid) ?? [],
    [controlData],
  );

  const handleSave = async () => {
    if (!selectedExamId) {
      toast.error("Select an exam first.");
      return;
    }

    const newAmount = Number(newStudentAmount);
    const oldAmount = Number(oldStudentAmount);

    if (!Number.isInteger(newAmount) || newAmount < 0) {
      toast.error("New Student Amount must be a valid non-negative number.");
      return;
    }

    if (!Number.isInteger(oldAmount) || oldAmount < 0) {
      toast.error("Old Student Amount must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/results/admit-card-control/${selectedExamId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          newStudentAmount: newAmount,
          oldStudentAmount: oldAmount,
        }),
      });
      const result = await parseJson<ApiResponse<undefined>>(response);

      if (!response.ok || !result?.success) {
        throw new Error(result && "error" in result ? result.error || "Failed to save settings" : "Failed to save settings");
      }

      toast.success("Admit card control settings saved.");

      const refresh = await fetch(`/api/results/admit-card-control/${selectedExamId}`);
      const refreshed = await parseJson<ApiResponse<ControlPayload>>(refresh);
      if (!refresh.ok || !refreshed?.success) {
        throw new Error(
          refreshed && "error" in refreshed
            ? refreshed.error || "Saved, but failed to refresh control data"
            : "Saved, but failed to refresh control data",
        );
      }

      setControlData(refreshed.data);
      setMode(refreshed.data.control.mode);
      setNewStudentAmount(String(refreshed.data.control.newStudentAmount));
      setOldStudentAmount(String(refreshed.data.control.oldStudentAmount));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Admit Card Control">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admit Card Control</CardTitle>
            <CardDescription>
              Control who can open admit cards, set payable amounts, and review each student&apos;s fee status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <label className="text-sm font-medium">Exam</label>
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{loadingOptions ? "Loading exams..." : "Select exam"}</option>
                  {examOptions.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ({EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}) - {exam.className}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  disabled={!selectedExamId}
                  onClick={() => navigate(`/dashboard/exams/admit-card?examId=${encodeURIComponent(selectedExamId)}`)}
                >
                  Open Preview Page
                </Button>
              </div>
            </div>

            {controlData ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="px-3 py-1">
                  Current Mode: {MODE_LABELS[controlData.control.mode]}
                </Badge>
                <span>
                  {controlData.exam.className} • {controlData.exam.sessionName} • {controlData.exam.academicYear}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {loadingControl ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Loading admit card control details...
            </CardContent>
          </Card>
        ) : controlData ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Access Mode</CardTitle>
                  <CardDescription>{MODE_HELPER[mode]}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["off", "only_paid", "all"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={cn(
                          "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                          mode === value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <div className="font-semibold">{MODE_LABELS[value]}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{MODE_HELPER[value]}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fee Configuration</CardTitle>
                  <CardDescription>
                    Saved amounts are stored as the final lump amount required for admit card eligibility.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">New Student Amount</label>
                    <Input
                      inputMode="numeric"
                      value={newStudentAmount}
                      onChange={(event) => setNewStudentAmount(event.target.value.replace(/[^\d]/g, ""))}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default: {formatCurrency(controlData.control.defaultNewStudentAmount)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Old Student Amount</label>
                    <Input
                      inputMode="numeric"
                      value={oldStudentAmount}
                      onChange={(event) => setOldStudentAmount(event.target.value.replace(/[^\d]/g, ""))}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default: {formatCurrency(controlData.control.defaultOldStudentAmount)}
                    </p>
                  </div>

                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Saving..." : "Save Settings"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Validation Summary</CardTitle>
                  <CardDescription>
                    Required fee range:{" "}
                    {formatMonthRange(
                      controlData.control.startMonth,
                      controlData.control.startYear,
                      controlData.control.endMonth,
                      controlData.control.endYear,
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Total Students</span>
                    <strong>{controlData.summary.totalStudents}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Fully Paid</span>
                    <strong>{controlData.summary.paidStudents}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Blocked / Unpaid</span>
                    <strong>{controlData.summary.unpaidStudents}</strong>
                  </div>
                  <div className="rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
                    {MODE_HELPER[controlData.control.mode]}
                  </div>
                </CardContent>
              </Card>
            </div>

            {unpaidStudents.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Attention Needed</CardTitle>
                  <CardDescription>
                    {unpaidStudents.length} student{unpaidStudents.length === 1 ? "" : "s"} will be blocked in
                    <span className="font-medium"> OnlyPAID </span>
                    mode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {unpaidStudents.slice(0, 5).map((student) => (
                    <div key={student.studentId} className="rounded-lg border px-3 py-2">
                      <div className="font-medium">{student.fullName}</div>
                      <div className="text-muted-foreground">
                        Missing: {student.missingMonthCount} • Partial: {student.partialMonthCount}
                        {student.warning ? ` • ${student.warning}` : ""}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Student Payment Status</CardTitle>
                  <CardDescription>
                    Payment data is validated by comparing the configured lump amount against the student's total paid amount.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                {controlData.students.length ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Expected Total</TableHead>
                          <TableHead>Paid Total</TableHead>
                          <TableHead>Outstanding</TableHead>
                          <TableHead>Missing</TableHead>
                          <TableHead>Partial</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {controlData.students.map((student) => (
                          <TableRow key={student.studentId}>
                            <TableCell>
                              <div className="font-medium">{student.fullName}</div>
                              <div className="text-xs text-muted-foreground">
                                {student.enrollmentNo || student.admissionNo || student.rollNumber}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{student.admissionType}</TableCell>
                            <TableCell>
                              <Badge variant={student.fullyPaid ? "secondary" : "destructive"}>
                                {student.fullyPaid ? "Paid" : "Unpaid"}
                              </Badge>
                            </TableCell>
                            <TableCell>{student.requiredMonthCount}</TableCell>
                            <TableCell>{formatCurrency(student.totalExpectedAmount)}</TableCell>
                            <TableCell>{formatCurrency(student.totalPaidAmount)}</TableCell>
                            <TableCell>{formatCurrency(student.outstandingAmount)}</TableCell>
                            <TableCell>{student.missingMonthCount}</TableCell>
                            <TableCell>{student.partialMonthCount}</TableCell>
                            <TableCell className="max-w-md text-sm text-muted-foreground">
                              {student.warning
                                ? student.warning
                                : student.partialMonths.length || student.missingMonths.length
                                  ? [
                                    student.partialMonths.length
                                      ? `Partial: ${student.partialMonths.join(", ")}`
                                      : null,
                                    student.missingMonths.length
                                      ? `Missing: ${student.missingMonths.join(", ")}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" | ")
                                  : "All required fee months are paid."}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                    No students are enrolled in this exam.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Select an exam to configure admit card access.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
