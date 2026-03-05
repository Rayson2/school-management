import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

type PayrollDetail = {
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
  paidAt: string | null;
  paymentMode: string | null;
  transactionRef: string | null;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

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

export default function PayrollSlipSheetPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<PayrollDetail | null>(null);
  const [rows, setRows] = useState<PayrollDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const singleResponse = await fetch(`/api/payroll/${id}`);
        const singleResult = await readJsonSafe(singleResponse);
        if (!singleResponse.ok || !singleResult.success) {
          throw new Error(singleResult.error || "Failed to load salary sheet");
        }
        const selected = singleResult.data as PayrollDetail;
        setData(selected);

        const allResponse = await fetch(
          `/api/payroll/all?teacherId=${selected.teacherId}&sessionId=${selected.sessionId}&status=paid`,
        );
        const allResult = await readJsonSafe(allResponse);
        if (!allResponse.ok || !allResult.success) {
          throw new Error(allResult.error || "Failed to load multiple months");
        }

        const paidRows = (Array.isArray(allResult.data) ? allResult.data : [])
          .filter((row: PayrollDetail) => row.status === "paid")
          .sort((a: PayrollDetail, b: PayrollDetail) => (a.year - b.year) || (a.month - b.month));
        setRows(paidRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load salary sheet");
      }
    };
    void load();
  }, [id]);

  if (!data) {
    return <div className="p-6 text-sm text-red-500">{error || "Loading salary sheet..."}</div>;
  }

  if (data.status !== "paid") {
    return <div className="p-6 text-sm text-red-500">Unpaid salary details are not available in slips.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 print:bg-white print:p-0">
      <style>{`
        .sheet {
          font-family: "Times New Roman", Times, serif;
          width: 198mm;
          min-height: 285mm;
          margin: 0 auto;
          background: #fff;
          color: #111;
          border: 2px solid #111;
          padding: 6mm;
          box-sizing: border-box;
        }
        @media print {
          .hide-print { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
          body { background: #fff; }
        }
      `}</style>

      <div className="hide-print mb-3 flex gap-2 justify-center">
        <Button variant="outline" onClick={() => navigate("/dashboard/payroll/slips")}>Back</Button>
        <Button variant="outline" onClick={() => window.open(`/api/payroll/download/slip/${data.id}`, "_blank", "noopener,noreferrer")}>
          Download PDF
        </Button>
        <Button onClick={() => window.print()}>Print</Button>
      </div>

      <div className="sheet">
        <div className="border border-black p-3">
          <div className="text-center border-b border-black pb-2 mb-3">
            <h1 className="text-xl font-bold">H.B.R. ENGLISH MEDIUM SCHOOL BILHA</h1>
            <p className="text-sm">DIST-BILASPUR (C.G.)</p>
            <p className="text-xs">Affiliated to: C.G. BOARD RAIPUR (312278)</p>
            <p className="text-xs">UDISE NO.: 22070321207 | Email: hbrschoolbilha@gmail.com</p>
            <h2 className="text-lg font-bold mt-2">SALARY SHEET</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <p><strong>Teacher:</strong> {data.teacherName}</p>
            <p><strong>Session:</strong> {data.sessionName}</p>
            <p><strong>Status:</strong> PAID ONLY</p>
            <p><strong>Total Months:</strong> {rows.length || 1}</p>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-black p-2 text-left">Month</th>
                <th className="border border-black p-2 text-right">Basic</th>
                <th className="border border-black p-2 text-right">Transport</th>
                <th className="border border-black p-2 text-right">Other</th>
                <th className="border border-black p-2 text-right">Deductions</th>
                <th className="border border-black p-2 text-right">Gross</th>
                <th className="border border-black p-2 text-right">Net</th>
                <th className="border border-black p-2 text-left">Paid At</th>
                <th className="border border-black p-2 text-left">Mode</th>
              </tr>
            </thead>
            <tbody>
              {(rows.length ? rows : [data]).map((row) => (
                <tr key={row.id}>
                  <td className="border border-black p-2">{monthLabel(row.month)} {row.year}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.basicSalary)}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.transportAllowance)}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.otherAllowances)}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.deductions)}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.grossSalary)}</td>
                  <td className="border border-black p-2 text-right">{formatMoney(row.netSalary)}</td>
                  <td className="border border-black p-2">{row.paidAt ? new Date(row.paidAt).toLocaleDateString() : "-"}</td>
                  <td className="border border-black p-2">{row.paymentMode ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
