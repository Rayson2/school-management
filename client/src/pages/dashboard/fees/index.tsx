import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

type MetaResponse = {
  sessions: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  currentSessionId: string | null;
};

type ClassConfigRow = {
  id: string;
  className: string;
  configId: string | null;
  sessionId: string | null;
  newAdmissionFee: number | null;
  oldAdmissionFee: number | null;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  endYear: number | null;
  activeMonths: number | null;
};

type StudentOption = {
  id: string;
  fullName: string;
  rollNumber: string;
  admissionNo: string | null;
  className: string;
};

type FeeRecord = {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  month: number;
  year: number;
  admissionType: "new" | "old";
  amountDue: number;
  amountPaid: number;
  status: "pending" | "partial" | "paid";
  paymentMode: "cash" | "online" | "cheque" | null;
  referenceNumber: string | null;
  paidAt: string | null;
};

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const readJsonSafe = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Invalid JSON response (${response.status}): ${text.slice(0, 150) || "empty response"}`,
    );
  }
};

const activeMonthNames = (startMonthRaw: string, startYearRaw: string, endMonthRaw: string, endYearRaw: string) => {
  const startMonth = Number(startMonthRaw);
  const startYear = Number(startYearRaw);
  const endMonth = Number(endMonthRaw);
  const endYear = Number(endYearRaw);
  if (
    !Number.isInteger(startMonth) ||
    !Number.isInteger(endMonth) ||
    !Number.isInteger(startYear) ||
    !Number.isInteger(endYear) ||
    startMonth < 1 ||
    startMonth > 12 ||
    endMonth < 1 ||
    endMonth > 12
  ) {
    return "Invalid month/year range";
  }

  const start = startYear * 12 + (startMonth - 1);
  const end = endYear * 12 + (endMonth - 1);
  if (end < start) return "Invalid range";

  const totalMonths = end - start + 1;
  return `${MONTHS[startMonth - 1]?.label} ${startYear} to ${MONTHS[endMonth - 1]?.label} ${endYear} (${totalMonths} months)`;
};

export default function FeeManagementPage() {
  const [meta, setMeta] = useState<MetaResponse>({ sessions: [], classes: [], currentSessionId: null });
  const [sessionId, setSessionId] = useState("");
  const [classConfigs, setClassConfigs] = useState<ClassConfigRow[]>([]);
  const [configDraft, setConfigDraft] = useState<
    Record<
      string,
      {
        newAdmissionFee: string;
        oldAdmissionFee: string;
        startMonth: string;
        startYear: string;
        endMonth: string;
        endYear: string;
      }
    >
  >({});
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const [manualStudentId, setManualStudentId] = useState("");
  const [manualMonth, setManualMonth] = useState(String(new Date().getMonth() + 1));
  const [manualYear, setManualYear] = useState(String(new Date().getFullYear()));
  const [manualAmountPaid, setManualAmountPaid] = useState("");
  const [manualPaidMode, setManualPaidMode] = useState<"cash" | "online" | "cheque">("cash");
  const [manualReference, setManualReference] = useState("");

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMeta = async () => {
    setLoadingMeta(true);
    setError(null);

    try {
      const response = await fetch("/api/fee/meta");
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load fee metadata");
      }

      const data = result.data as MetaResponse;
      setMeta(data);
      if (!sessionId && data.currentSessionId) {
        setSessionId(data.currentSessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metadata");
    } finally {
      setLoadingMeta(false);
    }
  };

  const refreshClassConfig = async (targetSessionId: string) => {
    if (!targetSessionId) {
      setClassConfigs([]);
      return;
    }

    const response = await fetch(`/api/fee/class-config?sessionId=${targetSessionId}`);
    const result = await readJsonSafe(response);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Failed to load class fee config");
    }

    const rows = Array.isArray(result.data) ? (result.data as ClassConfigRow[]) : [];
    setClassConfigs(rows);
    setConfigDraft(
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            newAdmissionFee: String(row.newAdmissionFee ?? ""),
            oldAdmissionFee: String(row.oldAdmissionFee ?? ""),
            startMonth: String(row.startMonth ?? 1),
            startYear: String(row.startYear ?? new Date().getFullYear()),
            endMonth: String(row.endMonth ?? 12),
            endYear: String(row.endYear ?? new Date().getFullYear()),
          },
        ]),
      ),
    );
  };

  const refreshStudents = async (targetSessionId: string) => {
    if (!targetSessionId) {
      setStudents([]);
      return;
    }

    const response = await fetch(`/api/student/all?sessionId=${targetSessionId}`);
    const result = await readJsonSafe(response);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Failed to load students");
    }

    const list = Array.isArray(result.data)
      ? result.data.map((item: any) => ({
          id: item.id,
          fullName: item.fullName,
          rollNumber: item.rollNumber,
          admissionNo: item.admissionNo,
          className: item.className,
        }))
      : [];

    setStudents(list);
  };

  const refreshRecords = async (targetSessionId: string) => {
    if (!targetSessionId) {
      setRecords([]);
      return;
    }

    const params = new URLSearchParams();
    params.set("sessionId", targetSessionId);

    const response = await fetch(`/api/fee/records?${params.toString()}`);
    const result = await readJsonSafe(response);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Failed to load student fee records");
    }
    setRecords(Array.isArray(result.data) ? result.data : []);
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    setError(null);
    Promise.all([refreshClassConfig(sessionId), refreshStudents(sessionId), refreshRecords(sessionId)]).catch(
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load fee data");
      },
    );
  }, [sessionId]);

  const saveClassConfig = async (classId: string) => {
    const draft = configDraft[classId];
    if (!draft || !sessionId) return;

    setError(null);
    setSavingClassId(classId);

    try {
      const response = await fetch("/api/fee/class-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          sessionId,
          newAdmissionFee: Number(draft.newAdmissionFee || 0),
          oldAdmissionFee: Number(draft.oldAdmissionFee || 0),
          startMonth: Number(draft.startMonth || 1),
          startYear: Number(draft.startYear || new Date().getFullYear()),
          endMonth: Number(draft.endMonth || 12),
          endYear: Number(draft.endYear || new Date().getFullYear()),
        }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to save class fee config");
      }

      toast.success("Class fee config saved");
      await Promise.all([refreshClassConfig(sessionId), refreshRecords(sessionId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save class fee config");
    } finally {
      setSavingClassId(null);
    }
  };

  const submitManual = async () => {
    if (!manualStudentId) {
      setError("Select student for manual fee entry");
      return;
    }

    setError(null);
    setManualSubmitting(true);

    try {
      const response = await fetch("/api/fee/manual-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: manualStudentId,
          month: Number(manualMonth),
          year: Number(manualYear),
          amountPaid: Number(manualAmountPaid || 0),
          paymentMode: Number(manualAmountPaid || 0) > 0 ? manualPaidMode : undefined,
          referenceNumber: manualReference.trim() || undefined,
        }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to add manual fee entry");
      }

      toast.success("Manual fee entry saved");
      setManualAmountPaid("");
      setManualReference("");
      await refreshRecords(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add manual fee entry");
    } finally {
      setManualSubmitting(false);
    }
  };

  const runAutoGenerate = async () => {
    if (!sessionId) {
      setError("Select session first");
      return;
    }

    setError(null);
    setAutoGenerating(true);

    try {
      const response = await fetch("/api/fee/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
        }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to auto-generate records");
      }

      toast.success(`Auto-generated fee rows: ${result?.data?.generatedCount ?? 0}`);
      await refreshRecords(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to auto-generate records");
    } finally {
      setAutoGenerating(false);
    }
  };

  const downloadAutoExcel = () => {
    if (!sessionId) {
      setError("Select session first");
      return;
    }

    const params = new URLSearchParams();
    params.set("sessionId", sessionId);
    window.open(`/api/fee/download/auto?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const uploadExcel = async () => {
    if (!uploadFile) {
      setError("Select an .xlsx file to upload");
      return;
    }

    setError(null);
    setUploadingExcel(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch("/api/fee/upload", {
        method: "POST",
        body: formData,
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to upload fee excel");
      }

      toast.success(
        `Upload completed. Success: ${result.data?.successCount ?? 0}, Failed: ${result.data?.failedCount ?? 0}`,
      );
      setUploadFile(null);
      await refreshRecords(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload fee excel");
    } finally {
      setUploadingExcel(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: records.length,
      paid: records.filter((item) => item.status === "paid").length,
      partial: records.filter((item) => item.status === "partial").length,
      pending: records.filter((item) => item.status === "pending").length,
    }),
    [records],
  );

  return (
    <DashboardLayout title="Student Fee Management">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Session</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                disabled={loadingMeta}
              >
                <option value="">Select session</option>
                {meta.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-sm">Rows: {summary.total}</CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm">
              Paid {summary.paid} | Partial {summary.partial} | Pending {summary.pending}
            </CardContent>
          </Card>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>1) Class Fee Mapping (New/Old + Start/End Month-Year)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>New Admission Fee</TableHead>
                    <TableHead>Old Admission Fee</TableHead>
                    <TableHead>Start Month</TableHead>
                    <TableHead>Start Year</TableHead>
                    <TableHead>End Month</TableHead>
                    <TableHead>End Year</TableHead>
                    <TableHead>Active Months</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classConfigs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.className}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={configDraft[row.id]?.newAdmissionFee ?? ""}
                          onChange={(event) =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                newAdmissionFee: event.target.value,
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={configDraft[row.id]?.oldAdmissionFee ?? ""}
                          onChange={(event) =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                oldAdmissionFee: event.target.value,
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                          value={configDraft[row.id]?.startMonth ?? "1"}
                          onChange={(event) =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                startMonth: event.target.value,
                              },
                            }))
                          }
                        >
                          {MONTHS.map((month) => (
                            <option key={`start-${row.id}-${month.value}`} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="2000"
                          max="2100"
                          value={configDraft[row.id]?.startYear ?? String(new Date().getFullYear())}
                          onChange={(event) =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                startYear: event.target.value,
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                          value={configDraft[row.id]?.endMonth ?? "12"}
                          onChange={(event) =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                endMonth: event.target.value,
                              },
                            }))
                          }
                        >
                          {MONTHS.map((month) => (
                            <option key={`end-${row.id}-${month.value}`} value={month.value}>
                              {month.label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="2000"
                          max="2100"
                          value={configDraft[row.id]?.endYear ?? String(new Date().getFullYear())}
                          onChange={(event) =>
                            setConfigDraft((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...prev[row.id],
                                endYear: event.target.value,
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {activeMonthNames(
                            configDraft[row.id]?.startMonth ?? "1",
                            configDraft[row.id]?.startYear ?? String(new Date().getFullYear()),
                            configDraft[row.id]?.endMonth ?? "12",
                            configDraft[row.id]?.endYear ?? String(new Date().getFullYear()),
                          )}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => saveClassConfig(row.id)}
                          disabled={savingClassId === row.id}
                        >
                          {savingClassId === row.id ? "Saving..." : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>2) Manual Fee Entry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Student</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={manualStudentId}
                  onChange={(event) => setManualStudentId(event.target.value)}
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} ({student.rollNumber}) - {student.className}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={manualMonth}
                    onChange={(event) => setManualMonth(event.target.value)}
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={manualYear}
                    onChange={(event) => setManualYear(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    value={manualAmountPaid}
                    onChange={(event) => setManualAmountPaid(event.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Paid Mode</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={manualPaidMode}
                    onChange={(event) =>
                      setManualPaidMode(event.target.value as "cash" | "online" | "cheque")
                    }
                  >
                    <option value="cash">cash</option>
                    <option value="online">online</option>
                    <option value="cheque">cheque</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Reference Number</Label>
                  <Input
                    value={manualReference}
                    onChange={(event) => setManualReference(event.target.value)}
                    placeholder="UTR / cheque no / txn id"
                  />
                </div>
              </div>

              <Button onClick={submitManual} disabled={manualSubmitting}>
                {manualSubmitting ? "Saving..." : "Save Manual Entry"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3) Auto Generate Student Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Auto generate uses selected session + class configured start/end month-year and never
                overwrites existing rows.
              </p>

              <Button onClick={runAutoGenerate} disabled={autoGenerating}>
                {autoGenerating ? "Generating..." : "Run Auto Generate"}
              </Button>

              <div className="space-y-2 pt-2">
                <Label>4) Excel Download/Upload</Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={downloadAutoExcel}>
                    Download Auto Data (Excel)
                  </Button>
                  <Input
                    type="file"
                    accept=".xlsx"
                    className="max-w-xs"
                    disabled={uploadingExcel}
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                  <Button onClick={uploadExcel} disabled={uploadingExcel}>
                    {uploadingExcel ? "Uploading..." : "Upload Excel"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Excel monthly columns: `studentId/rollNumber/admissionNo`, `sessionId`, `month`, `year`,
                  `amount_due`, `amount_paid`, `paid_mode`, `reference_number`, `paid_time`.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
