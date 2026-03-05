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
import { Link } from "react-router";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

type MetaResponse = {
  sessions: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string }>;
  currentSessionId: string | null;
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

type FeeRecordEditForm = {
  month: string;
  year: string;
  amountDue: string;
  amountPaid: string;
  paymentMode: "cash" | "online" | "cheque";
  referenceNumber: string;
  paidAt: string;
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

const monthLabel = (month: number) => MONTHS.find((item) => item.value === month)?.label ?? String(month);

export default function StudentMonthlyFeeRecordsPage() {
  const [meta, setMeta] = useState<MetaResponse>({ sessions: [], classes: [], currentSessionId: null });
  const [sessionId, setSessionId] = useState("");
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [recordsClassFilter, setRecordsClassFilter] = useState("");
  const [recordsStatusFilter, setRecordsStatusFilter] = useState("");

  const [editingRecord, setEditingRecord] = useState<FeeRecord | null>(null);
  const [editForm, setEditForm] = useState<FeeRecordEditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
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

  const refreshRecords = async (targetSessionId: string) => {
    if (!targetSessionId) {
      setRecords([]);
      return;
    }

    setLoadingRows(true);
    const params = new URLSearchParams();
    params.set("sessionId", targetSessionId);
    if (recordsClassFilter) params.set("classId", recordsClassFilter);
    if (recordsStatusFilter) params.set("status", recordsStatusFilter);

    try {
      const response = await fetch(`/api/fee/records?${params.toString()}`);
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load student fee records");
      }
      setRecords(Array.isArray(result.data) ? result.data : []);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    setError(null);
    refreshRecords(sessionId).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load fee data");
    });
  }, [sessionId, recordsClassFilter, recordsStatusFilter]);

  const startEditRecord = (record: FeeRecord) => {
    setEditingRecord(record);
    setEditForm({
      month: String(record.month),
      year: String(record.year),
      amountDue: String(record.amountDue),
      amountPaid: String(record.amountPaid),
      paymentMode: record.paymentMode ?? "cash",
      referenceNumber: record.referenceNumber ?? "",
      paidAt: record.paidAt ? new Date(record.paidAt).toISOString().slice(0, 10) : "",
    });
  };

  const submitEditRecord = async () => {
    if (!editingRecord || !editForm) return;
    setError(null);
    setSavingEdit(true);

    try {
      const amountPaid = Number(editForm.amountPaid || 0);
      const payload = {
        month: Number(editForm.month),
        year: Number(editForm.year),
        amountDue: Number(editForm.amountDue || 0),
        amountPaid,
        paymentMode: amountPaid > 0 ? editForm.paymentMode : null,
        referenceNumber: amountPaid > 0 ? editForm.referenceNumber.trim() || null : null,
        paidAt: amountPaid > 0 ? (editForm.paidAt || null) : null,
      };

      const response = await fetch(`/api/fee/record/${editingRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to update fee record");
      }

      setEditingRecord(null);
      setEditForm(null);
      toast.success("Fee record updated successfully");
      await refreshRecords(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update fee record");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteRecord = async (recordId: string) => {
    setError(null);
    setDeletingRecordId(recordId);

    try {
      const response = await fetch(`/api/fee/record/${recordId}`, {
        method: "DELETE",
      });
      const result = await readJsonSafe(response);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to delete fee record");
      }
      toast.success("Fee record deleted successfully");
      await refreshRecords(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete fee record");
    } finally {
      setDeletingRecordId(null);
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
    <DashboardLayout title="Student Monthly Fee Records">
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
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Student Monthly Fee Records</CardTitle>
              <Button variant="outline" asChild>
                <Link to="/dashboard/fees">Back to Fee Management</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
                value={recordsClassFilter}
                onChange={(event) => setRecordsClassFilter(event.target.value)}
              >
                <option value="">All classes</option>
                {meta.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
                value={recordsStatusFilter}
                onChange={(event) => setRecordsStatusFilter(event.target.value)}
              >
                <option value="">All status</option>
                <option value="pending">pending</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
              </select>

              <Button variant="outline" onClick={() => refreshRecords(sessionId)} disabled={loadingRows}>
                {loadingRows ? "Loading..." : "Refresh"}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Month/Year</TableHead>
                    <TableHead>Admission</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Paid Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loadingRows && records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                        No fee rows found
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {record.studentName}
                          <div className="text-xs text-muted-foreground">Roll: {record.rollNumber}</div>
                        </TableCell>
                        <TableCell>{record.className}</TableCell>
                        <TableCell>
                          {monthLabel(record.month)} {record.year}
                        </TableCell>
                        <TableCell className="capitalize">{record.admissionType}</TableCell>
                        <TableCell>{record.amountDue}</TableCell>
                        <TableCell>{record.amountPaid}</TableCell>
                        <TableCell>
                          <Badge variant={record.status === "paid" ? "default" : "secondary"}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.paymentMode ?? "-"}</TableCell>
                        <TableCell>{record.referenceNumber ?? "-"}</TableCell>
                        <TableCell>{record.paidAt ? new Date(record.paidAt).toLocaleString() : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditRecord(record)}
                              disabled={deletingRecordId === record.id}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRecord(record.id)}
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
      </div>

      {editingRecord && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Edit Fee Record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={editForm.month}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, month: event.target.value } : prev))
                    }
                  >
                    {MONTHS.map((month) => (
                      <option key={`edit-month-${month.value}`} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={editForm.year}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, year: event.target.value } : prev))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount Due</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.amountDue}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, amountDue: event.target.value } : prev))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount Paid</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.amountPaid}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, amountPaid: event.target.value } : prev))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Paid Mode</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    value={editForm.paymentMode}
                    onChange={(event) =>
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, paymentMode: event.target.value as "cash" | "online" | "cheque" }
                          : prev,
                      )
                    }
                  >
                    <option value="cash">cash</option>
                    <option value="online">online</option>
                    <option value="cheque">cheque</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Paid Date</Label>
                  <Input
                    type="date"
                    value={editForm.paidAt}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, paidAt: event.target.value } : prev))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Reference Number</Label>
                  <Input
                    value={editForm.referenceNumber}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, referenceNumber: event.target.value } : prev))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingRecord(null);
                    setEditForm(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={submitEditRecord} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
