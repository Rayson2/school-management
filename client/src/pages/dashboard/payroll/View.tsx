import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

type PayrollDetail = {
  id: string;
  teacherName: string;
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
  paidAt: string | null;
  paymentMode: string | null;
  transactionRef: string | null;
};

const MONTH_OPTIONS = [
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const monthLabel = (month: number) =>
  MONTH_OPTIONS.find((item) => item.value === month)?.label ?? String(month);

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

export default function ViewPayrollPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<PayrollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      try {
        const response = await fetch(`/api/payroll/${id}`);
        const result = await readJsonSafe(response);
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load payroll details");
        }
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payroll details");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) {
    return <DashboardLayout title="View Payroll">Loading...</DashboardLayout>;
  }

  if (!data) {
    return (
      <DashboardLayout title="View Payroll">
        <p className="text-sm text-red-500">{error || "Payroll not found"}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="View Payroll">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Payroll Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Teacher:</strong> {data.teacherName}</p>
          <p><strong>Academic Session:</strong> {data.sessionName}</p>
          <p><strong>Payroll Month:</strong> {monthLabel(data.month)} {data.year}</p>
          <p><strong>Basic Salary:</strong> {formatMoney(data.basicSalary)}</p>
          <p><strong>Transport Allowance:</strong> {formatMoney(data.transportAllowance)}</p>
          <p><strong>Other Allowances:</strong> {formatMoney(data.otherAllowances)}</p>
          <p><strong>Deductions:</strong> {formatMoney(data.deductions)}</p>
          <p><strong>Gross Salary:</strong> {formatMoney(data.grossSalary)}</p>
          <p><strong>Net Salary:</strong> {formatMoney(data.netSalary)}</p>
          <p><strong>Status:</strong> {data.status}</p>
          <p><strong>Paid At:</strong> {data.paidAt ? new Date(data.paidAt).toLocaleString() : "-"}</p>
          <p><strong>Payment Mode:</strong> {data.paymentMode ?? "-"}</p>
          <p><strong>Transaction Ref:</strong> {data.transactionRef ?? "-"}</p>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-2">
            {data.status === "paid" && (
              <Button variant="outline" onClick={() => window.open(`/api/payroll/download/slip/${data.id}`, "_blank", "noopener,noreferrer")}>
                Download Payroll Sheet
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate("/dashboard/payroll")}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
