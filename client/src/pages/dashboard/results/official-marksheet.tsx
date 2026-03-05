import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

type MarksheetData = {
  header: {
    boardName: string;
    examinationTitle: string;
    certificateTitle: string;
    certificateNumber: string;
    rollNumber: string;
    enrollmentNo: string;
    logoUrl: string | null;
  };
  student: {
    studentId: string;
    fullName: string;
    avatarUrl: string | null;
    fathersName: string;
    mothersName: string;
    dateOfBirth: string | null;
    category: string;
    className: string;
    schoolName: string;
    examCenter: string;
  };
  exam: {
    examId: string;
    examName: string;
    examType: "quarterly" | "half_yearly" | "annual";
    examTypeLabel: string;
    sessionName: string;
    academicYear: string;
    startDate: string | null;
    endDate: string | null;
  };
  marks: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    schemeMax: number;
    schemeMin: number;
    componentMarks: Partial<
      Record<
        | "assignment_1"
        | "internal_1"
        | "quarterly"
        | "assignment_2"
        | "internal_2"
        | "half_yearly"
        | "theory"
        | "practical_assignment",
        number | null
      >
    >;
    marksByType: Partial<Record<"quarterly" | "half_yearly" | "annual", number | null>>;
    total: number;
  }>;
  componentColumns: Array<{
    component:
      | "assignment_1"
      | "internal_1"
      | "quarterly"
      | "assignment_2"
      | "internal_2"
      | "half_yearly"
      | "theory"
      | "practical_assignment";
    label: string;
  }>;
  totalsByComponent: Partial<
    Record<
      | "assignment_1"
      | "internal_1"
      | "quarterly"
      | "assignment_2"
      | "internal_2"
      | "half_yearly"
      | "theory"
      | "practical_assignment",
      number
    >
  >;
  statementColumns: Array<{
    examType: "quarterly" | "half_yearly" | "annual";
    label: string;
  }>;
  totalsByExamType: Partial<Record<
    "quarterly" | "half_yearly" | "annual",
    { obtained: number; max: number }
  >>;
  examSummaries: Array<{
    examType: "quarterly" | "half_yearly" | "annual";
    examTypeLabel: string;
    examId: string | null;
    examName: string | null;
    totalMarks: number;
    totalMax: number;
    percentage: number;
    grade: string;
    status: "pass" | "fail" | "pending";
    hasData: boolean;
  }>;
  summary: {
    totalMarks: number;
    totalMax: number;
    totalPass: number;
    percentage: number;
    division: string;
    grade: string;
    status: "pass" | "fail" | "pending";
  };
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const EXAM_TYPE_ACRONYM: Record<"quarterly" | "half_yearly" | "annual", string> = {
  quarterly: "QTR",
  half_yearly: "HY",
  annual: "ANL",
};

const COMPONENT_ACRONYM: Record<
  | "assignment_1"
  | "internal_1"
  | "quarterly"
  | "assignment_2"
  | "internal_2"
  | "half_yearly"
  | "theory"
  | "practical_assignment",
  string
> = {
  assignment_1: "AS1",
  internal_1: "INT1",
  quarterly: "QTR",
  assignment_2: "AS2",
  internal_2: "INT2",
  half_yearly: "HY",
  theory: "TH",
  practical_assignment: "PR",
};

const numberToWords = (num: number) => {
  const n = Math.floor(num);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n === 0) return "zero";

  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const belowThousand = (value: number) => {
    const hundred = Math.floor(value / 100);
    const rem = value % 100;
    const hundredPart = hundred ? `${ones[hundred]} hundred` : "";
    const remPart =
      rem === 0 ? "" : rem < 20 ? ones[rem] : `${tens[Math.floor(rem / 10)]}${rem % 10 ? ` ${ones[rem % 10]}` : ""}`;
    return [hundredPart, remPart].filter(Boolean).join(" ");
  };

  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (billions) parts.push(`${belowThousand(billions)} billion`);
  if (millions) parts.push(`${belowThousand(millions)} million`);
  if (thousands) parts.push(`${belowThousand(thousands)} thousand`);
  if (rest) parts.push(belowThousand(rest));

  return parts.join(" ");
};

export default function OfficialMarksheetPage() {
  const navigate = useNavigate();
  const { studentId, examId } = useParams();
  const [data, setData] = useState<MarksheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!studentId || !examId) {
        toast.error("Invalid URL parameters");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/results/official-marksheet/${studentId}/${examId}`);
        const result = (await response.json()) as Record<string, unknown>;

        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to load official marksheet",
          );
        }

        setData((result.data ?? null) as MarksheetData | null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load marksheet");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [examId, studentId]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading official marksheet...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Marksheet not found.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 print:bg-white print:p-0">
      <style>{`
        .marksheet-sheet {
          font-family: "Times New Roman", Times, serif;
          width: 198mm;
          min-height: 285mm;
          margin: 0 auto;
          background: #fff;
          color: #111;
          border: none;
          padding: 6mm;
          /* Increase this value to push result content further down from the top. */
          padding-top: 150px; 
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
        }

        .marksheet-sheet > * {
          position: relative;
          z-index: 1;
        }

        .marksheet-table,
        .marksheet-table th,
        .marksheet-table td {
          border: 1px solid #111;
          border-collapse: collapse;
        }

        .marksheet-table th,
        .marksheet-table td {
          padding: 3px 5px;
          font-size: 11px;
          vertical-align: top;
        }

        .passport-photo {
          width: 35mm;
          height: 45mm;
          object-fit: cover;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }

          .print-controls {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .marksheet-sheet {
            border: none;
            margin: 0;
            width: 198mm;
            min-height: 285mm;
            break-inside: avoid;
            /* Print top offset: keep this aligned with the value above if needed. */
            padding-top: 150px;
          }
        }
      `}</style>

      <div className="print-controls mx-auto mb-4 flex w-[198mm] items-center gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        <Button onClick={() => window.print()}>Print</Button>
      </div>

      <section className="marksheet-sheet">
        <div className="border border-black px-2 py-1 text-center text-[12px] font-bold">
          {data.header.examinationTitle}
        </div>

        <table className="marksheet-table mt-2 w-full">
          <tbody>
            <tr>
              <td><strong>Sr. No.</strong></td>
              <td>1</td>
              <td></td>
              <td></td>
              <td rowSpan={6} className="text-center align-middle">
                {data.student.avatarUrl ? (
                  <img
                    src={data.student.avatarUrl}
                    alt={data.student.fullName}
                    className="passport-photo mx-auto border border-black"
                  />
                ) : (
                  <div className="passport-photo mx-auto flex items-center justify-center border border-black text-[10px]">
                    PHOTO
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td><strong>Name of Student</strong></td>
              <td>{data.student.fullName}</td>
              <td><strong>Class</strong></td>
              <td>{data.student.className}</td>
            </tr>
            <tr>
              <td><strong>Father's Name</strong></td>
              <td>{data.student.fathersName}</td>
              <td><strong>Roll No.</strong></td>
              <td>{data.header.rollNumber}</td>
            </tr>
            <tr>
              <td><strong>Mother's Name</strong></td>
              <td>{data.student.mothersName}</td>
              <td><strong>Enrollment No.</strong></td>
              <td>{data.header.enrollmentNo}</td>
            </tr>
            <tr>
              <td><strong>Date of Birth</strong></td>
              <td>{formatDate(data.student.dateOfBirth)}</td>
              <td><strong>PEN No.</strong></td>
              <td>-</td>
            </tr>
            <tr>
              <td><strong>Caste Group</strong></td>
              <td>{data.student.category}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div className="border border-black border-b-0 bg-neutral-100 px-2 py-1 text-center text-[12px] font-bold">
          STATEMENT OF MARKS
        </div>
        <table className="marksheet-table mb-2 w-full">
          <thead>
            <tr>
              <th className="w-[38px]">S.NO</th>
              <th>Subject</th>
              <th className="w-[45px]">Max</th>
              <th className="w-[45px]">Min</th>
              {data.componentColumns.map((column) => (
                <th key={column.component}>{COMPONENT_ACRONYM[column.component]}</th>
              ))}
              {data.statementColumns.map((column) => (
                <th key={column.examType}>{EXAM_TYPE_ACRONYM[column.examType]}</th>
              ))}
              <th className="w-[55px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.marks.map((row, index) => (
              <tr key={row.subjectId}>
                <td>{index + 1}</td>
                <td>{row.subjectName}</td>
                <td>{row.schemeMax}</td>
                <td>{row.schemeMin}</td>
                {data.componentColumns.map((column) => (
                  <td key={`${row.subjectId}-${column.component}`}>
                    {row.componentMarks[column.component] ?? "-"}
                  </td>
                ))}
                {data.statementColumns.map((column) => (
                  <td key={`${row.subjectId}-${column.examType}`}>
                    {row.marksByType[column.examType] ?? "-"}
                  </td>
                ))}
                <td>{row.total}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4}><strong>Grand Total</strong></td>
              {data.componentColumns.map((column) => (
                <td key={`grand-component-${column.component}`}>
                  <strong>{data.totalsByComponent[column.component] ?? 0}</strong>
                </td>
              ))}
              {data.statementColumns.map((column) => (
                <td key={`grand-${column.examType}`}>
                  <strong>{data.totalsByExamType[column.examType]?.obtained ?? 0}</strong>
                </td>
              ))}
              <td><strong>{data.summary.totalMarks}</strong></td>
            </tr>
          </tbody>
        </table>

        <table className="marksheet-table mb-2 w-full">
          <tbody>
            <tr>
              <td className="text-center text-[28px] font-bold">Grand Total</td>
              <td className="text-center"><strong>GRADE IN EXAM</strong><br />{data.summary.grade}</td>
              <td className="text-center"><strong>PERCENTAGE</strong><br />{data.summary.percentage.toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>

        <table className="marksheet-table mb-2 w-full">
          <thead>
            <tr>
              <th>S.N.</th>
              <th>Obtained</th>
              <th>Total</th>
              <th>In Words</th>
              <th>Name of Exam</th>
            </tr>
          </thead>
          <tbody>
            {data.examSummaries.map((exam, index) => (
              <tr key={exam.examType}>
                <td>{index + 1}</td>
                <td>{exam.hasData ? exam.totalMarks : "-"}</td>
                <td>{exam.hasData ? exam.totalMax : "-"}</td>
                <td>{exam.hasData ? numberToWords(exam.totalMarks).toUpperCase() : "-"}</td>
                <td>{exam.examTypeLabel.replace("-", " ")} Exam</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="marksheet-table p-2 text-center">
          <div className="text-[20px] font-bold">
            Result Declared
          </div>
          <div className="text-[14px] font-bold mt-1">
            He / She has appeared in {data.exam.examTypeLabel} Examination
          </div>
        </div>

        {/* <div className="mt-10 grid grid-cols-3 text-[14px] font-bold">
          <div>Date:<br />Checker</div>
          <div className="text-center">CONTROLLER OF EXAM.</div>
          <div className="text-right">PRINCIPAL</div>
        </div> */}
      </section>
    </div>
  );
}
