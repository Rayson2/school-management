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
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

type PayrollRow = {
  id: string;
  teacherName: string;
  sessionName: string;
  month: number;
  year: number;
  netSalary: number;
  status: "pending" | "paid";
};

const monthLabel = (month: number) =>
  [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][month] ?? String(month);

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const readJsonSafe = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Invalid JSON response (${response.status}): ${text.slice(0, 120) || "empty response"}`,
    );
  }
};

const parseMonthInput = (value: string) => {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return year * 100 + month;
};

export default function PayrollSlipsPage() {
  const navigate = useNavigate();
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [fromMonth, setFromMonth] = useState(defaultMonth);
  const [toMonth, setToMonth] = useState(defaultMonth);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/payroll/all");
        const result = await readJsonSafe(response);
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load salary slips");
        }
        const allRows = Array.isArray(result.data) ? (result.data as PayrollRow[]) : [];
        setRows(allRows.filter((row) => row.status === "paid"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load salary slips");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const fromKey = parseMonthInput(fromMonth);
    const toKey = parseMonthInput(toMonth);
    if (!fromKey || !toKey) return rows;
    const minKey = Math.min(fromKey, toKey);
    const maxKey = Math.max(fromKey, toKey);
    return rows.filter((row) => {
      const rowKey = row.year * 100 + row.month;
      return rowKey >= minKey && rowKey <= maxKey;
    });
  }, [rows, fromMonth, toMonth]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const downloadSelected = () => {
    selectedIds.forEach((id) => {
      window.open(`/api/payroll/download/slip/${id}`, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <DashboardLayout title="Salary Slips">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Download Salary Slips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>From (Month)</Label>
                <Input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To (Month)</Label>
                <Input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} />
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="rounded-md border p-3 flex items-center justify-between">
                <p className="text-sm">{selectedIds.length} selected</p>
                <Button onClick={downloadSelected}>Download Selected PDF</Button>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Select</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Net Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No salary slips in selected period
                    </TableCell>
                  </TableRow>
                )}
                {filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelection(row.id)}
                      />
                    </TableCell>
                    <TableCell>{row.teacherName}</TableCell>
                    <TableCell>{row.sessionName}</TableCell>
                    <TableCell>{monthLabel(row.month)} {row.year}</TableCell>
                    <TableCell>{formatMoney(row.netSalary)}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/payroll/slips/${row.id}`)}>
                          View Sheet
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => window.open(`/api/payroll/download/slip/${row.id}`, "_blank", "noopener,noreferrer")}
                        >
                          Download PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
