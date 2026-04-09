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
  totalExpectedAmount: number;
  totalPaidAmount: number;
  outstandingAmount: number;
  missingMonthCount: number;
  partialMonthCount: number;
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
  off: "Nobody can open results.",
  only_paid: "Only students with fully paid fees can open results.",
  all: "All students can open results, regardless of payment.",
};

const parseJson = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text) return null as T | null;
  return JSON.parse(text) as T;
};

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? `Rs ${value.toLocaleString("en-IN")}` : "Not set";

export default function ResultControlPage() {
  const navigate = useNavigate();
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingControl, setLoadingControl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [controlData, setControlData] = useState<ControlPayload | null>(null);
  const [mode, setMode] = useState<Mode>("off");

  useEffect(() => {
    const loadExams = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/exam/all");
        const result = await parseJson<ApiResponse<ExamOption[]>>(response);
        if (!response.ok || !result?.success) {
          throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
        }
        setExamOptions(Array.isArray(result.data) ? result.data : []);
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
        const response = await fetch(`/api/results/result-control/${selectedExamId}`);
        const result = await parseJson<ApiResponse<ControlPayload>>(response);
        if (!response.ok || !result?.success) {
          throw new Error(result && "error" in result ? result.error || "Failed to load result control" : "Failed to load result control");
        }
        setControlData(result.data);
        setMode(result.data.control.mode);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load result control");
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

    setSaving(true);
    try {
      const response = await fetch(`/api/results/result-control/${selectedExamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultMode: mode }),
      });
      const result = await parseJson<ApiResponse<undefined>>(response);
      if (!response.ok || !result?.success) {
        throw new Error(result && "error" in result ? result.error || "Failed to save result control" : "Failed to save result control");
      }
      toast.success("Result control settings saved.");

      const refresh = await fetch(`/api/results/result-control/${selectedExamId}`);
      const refreshed = await parseJson<ApiResponse<ControlPayload>>(refresh);
      if (!refresh.ok || !refreshed?.success) {
        throw new Error(refreshed && "error" in refreshed ? refreshed.error || "Failed to refresh result control" : "Failed to refresh result control");
      }
      setControlData(refreshed.data);
      setMode(refreshed.data.control.mode);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save result control");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Result Control">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Result Control</CardTitle>
            <CardDescription>
              Control who can open results using the shared fee configuration already used for admit cards.
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

              <div className="flex items-end">
                <Button
                  variant="outline"
                  disabled={!selectedExamId}
                  onClick={() => navigate("/dashboard/my-results")}
                >
                  Open Student Result Page
                </Button>
              </div>
            </div>

            {controlData ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="px-3 py-1">
                  Current Mode: {MODE_LABELS[controlData.control.mode]}
                </Badge>
                <span>
                  Shared Lump Amounts: New {formatCurrency(controlData.control.newStudentAmount)} • Old {formatCurrency(controlData.control.oldStudentAmount)}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {loadingControl ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Loading result control details...
            </CardContent>
          </Card>
        ) : controlData ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Result Mode</CardTitle>
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
                          mode === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                        )}
                      >
                        <div className="font-semibold">{MODE_LABELS[value]}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{MODE_HELPER[value]}</div>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Saving..." : "Save Result Mode"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shared Fee Configuration</CardTitle>
                  <CardDescription>
                    Result control reuses the same lump fee amounts configured for admit cards.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>New Student Amount</span>
                    <strong>{formatCurrency(controlData.control.newStudentAmount)}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Old Student Amount</span>
                    <strong>{formatCurrency(controlData.control.oldStudentAmount)}</strong>
                  </div>
                  <div className="rounded-lg border border-dashed px-3 py-2 text-muted-foreground">
                    Update these values from Admit Card Control if the shared source of truth needs to change.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Summary</CardTitle>
                  <CardDescription>
                    Result access uses the same paid/unpaid evaluation as admit card control.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Total Students</span>
                    <strong>{controlData.summary.totalStudents}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Paid Students</span>
                    <strong>{controlData.summary.paidStudents}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>Unpaid Students</span>
                    <strong>{controlData.summary.unpaidStudents}</strong>
                  </div>
                </CardContent>
              </Card>
            </div>

            {unpaidStudents.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Blocked In OnlyPAID</CardTitle>
                  <CardDescription>
                    {unpaidStudents.length} student{unpaidStudents.length === 1 ? "" : "s"} would be blocked from results in OnlyPAID mode.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Student Payment Status</CardTitle>
                <CardDescription>
                  Status is shared with Admit Card Control, but the result switch is managed independently here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expected Total</TableHead>
                        <TableHead>Paid Total</TableHead>
                        <TableHead>Outstanding</TableHead>
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
                          <TableCell>{formatCurrency(student.totalExpectedAmount)}</TableCell>
                          <TableCell>{formatCurrency(student.totalPaidAmount)}</TableCell>
                          <TableCell>{formatCurrency(student.outstandingAmount)}</TableCell>
                          <TableCell className="max-w-md text-sm text-muted-foreground">
                            {student.warning ?? "Payment is clear for result access."}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Select an exam to configure result access.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
