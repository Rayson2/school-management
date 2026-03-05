import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
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

type FormState = {
  teacherId: string;
  sessionId: string;
  month: string;
  year: string;
  basicSalary: string;
  transportAllowance: string;
  otherAllowances: string;
  deductions: string;
};

const toNumber = (value: string) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
};

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

export default function EditPayrollPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({
    teacherId: "",
    sessionId: "",
    month: "",
    year: "",
    basicSalary: "",
    transportAllowance: "0",
    otherAllowances: "0",
    deductions: "0",
  });

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      try {
        const [teacherRes, sessionRes, payrollRes] = await Promise.all([
          fetch("/api/teacher/all"),
          fetch("/api/academic-session/all"),
          fetch(`/api/payroll/${id}`),
        ]);

        const [teacherData, sessionData, payrollData] = await Promise.all([
          readJsonSafe(teacherRes),
          readJsonSafe(sessionRes),
          readJsonSafe(payrollRes),
        ]);

        if (teacherData?.success) {
          const list = Array.isArray(teacherData.data)
            ? teacherData.data.map((item: any) => ({ id: item.id, fullName: item.fullName }))
            : [];
          setTeachers(list);
        }

        if (sessionData?.success) {
          setSessions(Array.isArray(sessionData.data) ? sessionData.data : []);
        }

        if (!payrollRes.ok || !payrollData.success) {
          throw new Error(payrollData.error || "Failed to load payroll");
        }

        const payroll = payrollData.data;
        setForm({
          teacherId: payroll.teacherId,
          sessionId: payroll.sessionId,
          month: String(payroll.month ?? ""),
          year: String(payroll.year ?? ""),
          basicSalary: String(payroll.basicSalary ?? 0),
          transportAllowance: String(payroll.transportAllowance ?? 0),
          otherAllowances: String(payroll.otherAllowances ?? 0),
          deductions: String(payroll.deductions ?? 0),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payroll");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const preview = useMemo(() => {
    const gross = toNumber(form.basicSalary) + toNumber(form.transportAllowance) + toNumber(form.otherAllowances);
    const net = Math.max(gross - toNumber(form.deductions), 0);
    return { gross, net };
  }, [form]);

  const handleSubmit = async () => {
    if (!id) return;
    setError(null);

    if (!form.teacherId || !form.sessionId || !form.month || !form.year) {
      setError("Teacher, session, month and year are required");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/payroll/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: form.teacherId,
          sessionId: form.sessionId,
          month: toNumber(form.month),
          year: toNumber(form.year),
          basicSalary: toNumber(form.basicSalary),
          transportAllowance: toNumber(form.transportAllowance),
          otherAllowances: toNumber(form.otherAllowances),
          deductions: toNumber(form.deductions),
        }),
      });

      const result = await readJsonSafe(response);
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update payroll");
      }

      toast.success("Payroll updated successfully");
      navigate("/dashboard/payroll");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payroll");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <DashboardLayout title="Edit Payroll">Loading...</DashboardLayout>;
  }

  return (
    <DashboardLayout title="Edit Payroll">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Update Payroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Teacher</Label>
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={form.teacherId}
                onChange={(event) => setForm((prev) => ({ ...prev, teacherId: event.target.value }))}
              >
                <option value="">Select teacher</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Academic Session</Label>
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={form.sessionId}
                onChange={(event) => setForm((prev) => ({ ...prev, sessionId: event.target.value }))}
              >
                <option value="">Select session</option>
                {sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Basic Salary</Label>
              <Input type="number" min="0" value={form.basicSalary} onChange={(event) => setForm((prev) => ({ ...prev, basicSalary: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={form.month}
                onChange={(event) => setForm((prev) => ({ ...prev, month: event.target.value }))}
              >
                {MONTH_OPTIONS.map((month) => (
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
                min="2000"
                max="2100"
                value={form.year}
                onChange={(event) => setForm((prev) => ({ ...prev, year: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Transport Allowance</Label>
              <Input type="number" min="0" value={form.transportAllowance} onChange={(event) => setForm((prev) => ({ ...prev, transportAllowance: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Other Allowances</Label>
              <Input type="number" min="0" value={form.otherAllowances} onChange={(event) => setForm((prev) => ({ ...prev, otherAllowances: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Deductions</Label>
              <Input type="number" min="0" value={form.deductions} onChange={(event) => setForm((prev) => ({ ...prev, deductions: event.target.value }))} />
            </div>
          </div>

          <div className="rounded-md border p-3 text-sm space-y-1">
            <p><strong>Gross Salary:</strong> {preview.gross}</p>
            <p><strong>Net Salary:</strong> {preview.net}</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Updating..." : "Update"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard/payroll")}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
