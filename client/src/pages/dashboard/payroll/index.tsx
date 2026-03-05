import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
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
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type TeacherOption = { id: string; fullName: string };
type SessionOption = { id: string; name: string };
const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

type PayrollRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  sessionId: string;
  sessionName: string;
  month: number;
  year: number;
  basicSalary: number;
  transportAllowance: number;
  otherAllowances: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  status: "pending" | "paid";
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const monthLabel = (month: number) =>
  MONTH_OPTIONS.find((item) => Number(item.value) === month)?.label ?? String(month);

const readJsonSafe = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Invalid JSON response (${response.status}): ${text.slice(0, 140) || "empty response"}`,
    );
  }
};

export default function PayrollIndexPage() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const isAdmin = (user?.roles ?? []).includes("admin");

  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [sessionId, setSessionId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [autoYear, setAutoYear] = useState(String(new Date().getFullYear()));
  const [autoMonths, setAutoMonths] = useState<string[]>([]);

  const loadMeta = async () => {
    const promises: Promise<void>[] = [];

    promises.push(
      fetch("/api/academic-session/all")
        .then((res) => readJsonSafe(res))
        .then((data) => {
          if (data?.success) setSessions(Array.isArray(data.data) ? data.data : []);
        }),
    );

    if (isAdmin) {
      promises.push(
        fetch("/api/teacher/all")
          .then((res) => readJsonSafe(res))
          .then((data) => {
            if (data?.success) {
              const list = Array.isArray(data.data)
                ? data.data.map((item: any) => ({ id: item.id, fullName: item.fullName }))
                : [];
              setTeachers(list);
            }
          }),
      );
    }

    await Promise.all(promises);
  };

  const loadRows = async () => {
    setLoading(rows.length === 0);
    setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (sessionId) params.set("sessionId", sessionId);
      if (teacherId && isAdmin) params.set("teacherId", teacherId);
      if (status) params.set("status", status);
      if (month) params.set("month", month);
      if (year) params.set("year", year);

      const response = await fetch(`/api/payroll/all?${params.toString()}`);
      const result = await readJsonSafe(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load payroll records");
      }

      setRows(Array.isArray(result.data) ? result.data : []);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payroll records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadRows();
  }, [sessionId, teacherId, status, month, year]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(rows.map((row) => row.id));
  };

  const deleteOne = async (id: string) => {
    const response = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
    const result = await readJsonSafe(response);
    if (!response.ok || !result.success) throw new Error(result.error || "Delete failed");
  };

  const handleDelete = async (id: string) => {
    try {
      setRowActionId(id);
      await deleteOne(id);
      toast.success("Payroll deleted");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payroll");
    } finally {
      setRowActionId(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setBulkLoading(true);
      await Promise.all(selectedIds.map((id) => deleteOne(id)));
      toast.success("Selected payroll records deleted");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected payroll records");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      setRowActionId(id);
      const response = await fetch(`/api/payroll/pay/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to mark paid");
      toast.success("Marked paid");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark paid");
    } finally {
      setRowActionId(null);
    }
  };

  const handleBulkMarkPaid = async () => {
    try {
      setBulkLoading(true);
      const response = await fetch("/api/payroll/pay/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: selectedIds.map((id) => ({ id })), rollbackOnError: false }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to mark selected paid");
      toast.success("Selected payroll marked paid");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark selected paid");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUnpay = async (id: string) => {
    try {
      setRowActionId(id);
      const response = await fetch(`/api/payroll/unpay/${id}`, { method: "POST" });
      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to remove paid status");
      toast.success("Paid status removed");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove paid status");
    } finally {
      setRowActionId(null);
    }
  };

  const handleBulkUnpay = async () => {
    try {
      setBulkLoading(true);
      const response = await fetch("/api/payroll/unpay/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: selectedIds.map((id) => ({ id })), rollbackOnError: false }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to remove paid status");
      toast.success("Removed paid status for selected records");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove paid status");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setError("Please select an .xlsx file");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("rollbackOnError", "false");

      const response = await fetch("/api/payroll/upload", {
        method: "POST",
        body: formData,
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Upload failed");
      toast.success(
        `Upload completed. Success: ${result?.data?.successCount ?? 0}, Failed: ${result?.data?.failedCount ?? 0}`,
      );
      if (result?.data?.failedCount) {
        setError(
          `Upload completed with ${result.data.failedCount} failed rows out of ${result.data.totalProcessed}.`,
        );
      }
      setUploadOpen(false);
      setUploadFile(null);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload payroll excel");
    } finally {
      setUploading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!sessionId) {
      setError("Select session first for auto payroll");
      return;
    }
    if (!autoMonths.length) {
      setError("Select at least one month");
      return;
    }

    try {
      setAutoGenerating(true);
      const response = await fetch("/api/payroll/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          year: Number(autoYear),
          months: autoMonths.map((value) => Number(value)),
          overwriteExisting: false,
          rollbackOnError: false,
        }),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to auto generate payroll");
      toast.success(`Auto generated: ${result?.data?.successCount ?? 0}`);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to auto generate payroll");
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleDownloadAutoExcel = () => {
    if (!sessionId) {
      setError("Select session first to download sheet");
      return;
    }
    const params = new URLSearchParams();
    params.set("sessionId", sessionId);
    if (autoYear) params.set("year", autoYear);
    if (autoMonths.length) params.set("months", autoMonths.join(","));
    window.open(`/api/payroll/download/auto?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  return (
    <DashboardLayout title="Payroll">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Payroll Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Session</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                >
                  <option value="">All sessions</option>
                  {sessions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Teacher</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={teacherId}
                  onChange={(event) => setTeacherId(event.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="">All teachers</option>
                  {teachers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">All status</option>
                  <option value="pending">pending</option>
                  <option value="paid">paid</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                >
                  <option value="">All months</option>
                  {MONTH_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  min="2000"
                  max="2100"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder="All"
                />
              </div>

              <div className="flex items-end gap-2">
                {isAdmin && (
                  <>
                    <Button asChild>
                      <Link to="/dashboard/payroll/add">Add Payroll</Link>
                    </Button>
                    <Button variant="outline" onClick={() => setUploadOpen(true)}>
                      Upload Excel
                    </Button>
                  </>
                )}
                <Button variant="secondary" onClick={loadRows} disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {selectedIds.length > 0 && isAdmin && (
              <div className="rounded-md border p-3 flex flex-wrap gap-2 items-center">
                <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
                <Button size="sm" onClick={handleBulkMarkPaid} disabled={bulkLoading}>
                  {bulkLoading ? "Processing..." : "Mark Paid"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkUnpay} disabled={bulkLoading}>
                  {bulkLoading ? "Processing..." : "Remove Paid Status"}
                </Button>
                <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={bulkLoading}>
                  {bulkLoading ? "Processing..." : "Delete"}
                </Button>
              </div>
            )}

            {isAdmin && (
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-semibold">Auto Payroll (All Teachers in Session)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input
                      type="number"
                      min="2000"
                      max="2100"
                      value={autoYear}
                      onChange={(event) => setAutoYear(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Select Months</Label>
                    <div className="flex flex-wrap gap-2">
                      {MONTH_OPTIONS.map((item) => (
                        <label key={`auto-${item.value}`} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-1">
                          <input
                            type="checkbox"
                            checked={autoMonths.includes(item.value)}
                            onChange={(event) => {
                              setAutoMonths((prev) =>
                                event.target.checked
                                  ? [...prev, item.value]
                                  : prev.filter((value) => value !== item.value),
                              );
                            }}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAutoGenerate} disabled={autoGenerating}>
                    {autoGenerating ? "Generating..." : "Create Auto Payroll"}
                  </Button>
                  <Button variant="outline" onClick={handleDownloadAutoExcel}>
                    Download Auto Data (Excel)
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {isAdmin ? (
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && selectedIds.length === rows.length}
                          onChange={toggleAll}
                        />
                      ) : null}
                    </TableHead>
                    <TableHead>Teacher Name</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Month/Year</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead>Transport Allowance</TableHead>
                    <TableHead>Other Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>Net Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
                        No payroll records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {isAdmin ? (
                            <input
                              type="checkbox"
                              checked={selectedSet.has(row.id)}
                              onChange={() => toggleRow(row.id)}
                            />
                          ) : null}
                        </TableCell>
                        <TableCell>{row.teacherName}</TableCell>
                        <TableCell>{row.sessionName}</TableCell>
                        <TableCell>{monthLabel(row.month)} {row.year}</TableCell>
                        <TableCell>{formatMoney(row.basicSalary)}</TableCell>
                        <TableCell>{formatMoney(row.transportAllowance)}</TableCell>
                        <TableCell>{formatMoney(row.otherAllowances)}</TableCell>
                        <TableCell>{formatMoney(row.deductions)}</TableCell>
                        <TableCell>{formatMoney(row.grossSalary)}</TableCell>
                        <TableCell>{formatMoney(row.netSalary)}</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "paid" ? "default" : "secondary"}>{row.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/payroll/${row.id}`)}>
                              View
                            </Button>
                            {isAdmin && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/payroll/${row.id}/edit`)}>
                                  Edit
                                </Button>
                                <Button size="sm" onClick={() => handleMarkPaid(row.id)} disabled={rowActionId === row.id}>
                                  {rowActionId === row.id ? "Processing..." : "Mark Paid"}
                                </Button>
                                {row.status === "paid" && (
                                  <Button size="sm" variant="outline" onClick={() => handleUnpay(row.id)} disabled={rowActionId === row.id}>
                                    {rowActionId === row.id ? "Processing..." : "Remove Paid"}
                                  </Button>
                                )}
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(row.id)} disabled={rowActionId === row.id}>
                                  {rowActionId === row.id ? "Deleting..." : "Delete"}
                                </Button>
                              </>
                            )}
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
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Upload Payroll Excel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="file"
                accept=".xlsx"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Auto sheet columns supported on upload: teacherId | sessionId | teacherName | sessionName | month/monthName | year | basicSalary | transportAllowance | otherAllowances | deductions | status | paidAt | paymentMode | transactionRef
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
