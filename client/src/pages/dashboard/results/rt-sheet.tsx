import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import useUserStore from "@/store/user.store";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

type SubjectItem = {
  examSubjectId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

type SubjectComponent = {
  component: string;
  componentLabel: string;
  maxMarks: number;
  passMarks: number;
  obtainedMarks: number | null;
  status: "pass" | "fail" | "pending";
};

type StudentSubjectMark = {
  examSubjectId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  components: SubjectComponent[];
  totalObtained: number;
  totalMax: number;
  totalPass: number;
  status: "pass" | "fail" | "pending";
};

type StudentRow = {
  serialNumber: number;
  studentId: string;
  rollNumber: string | null;
  enrollmentNo: string | null;
  fullName: string;
  fatherName: string;
  className: string;
  subjectMarks: StudentSubjectMark[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: string;
  division: string;
  status: "pass" | "fail" | "pending";
  remarks: string;
};

type RtSheetData = {
  exam: {
    examId: string;
    examName: string;
    examType: "quarterly" | "half_yearly" | "annual";
    examTypeLabel: string;
    academicYear: string;
    startDate: string | null;
    endDate: string | null;
    className: string;
    sessionName: string;
  };
  subjects: SubjectItem[];
  students: StudentRow[];
  summary: {
    classAverage: number;
    passCount: number;
    failCount: number;
    pendingCount: number;
    highestScore: number;
    totalStudents: number;
  };
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};
const formatTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function RtSheetPage() {
  const { examId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const userRoles = useUserStore((state) => state.user?.roles ?? []);
  const canBulkStyledPrintResults = userRoles.includes("admin");
  const [data, setData] = useState<RtSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const sortBy = searchParams.get("sort") || "roll";

  useEffect(() => {
    const load = async () => {
      if (!examId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/results/rt-sheet/${examId}`);
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok || !result.success) {
          throw new Error(typeof result.error === "string" ? result.error : "Failed to load TR sheet");
        }
        setData((result.data ?? null) as RtSheetData | null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load TR sheet");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [examId]);

  const filteredRows = useMemo(() => {
    if (!data) return [] as StudentRow[];
    const query = search.trim().toLowerCase();
    let rows = data.students;

    if (query) {
      rows = rows.filter((row) =>
        [row.enrollmentNo, row.rollNumber, row.fullName, row.fatherName]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    if (classFilter !== "all") {
      rows = rows.filter((row) => row.className === classFilter);
    }

    rows = [...rows].sort((a, b) => {
      if (sortBy === "name") return a.fullName.localeCompare(b.fullName);
      return (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, {
        numeric: true,
      });
    });

    return rows;
  }, [classFilter, data, search, sortBy]);

  const classOptions = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.students.map((row) => row.className)));
  }, [data]);

  const computedSummary = useMemo(() => {
    if (!filteredRows.length) {
      return {
        classAverage: 0,
        passCount: 0,
        failCount: 0,
        pendingCount: 0,
        highestScore: 0,
      };
    }

    const totalPercent = filteredRows.reduce((sum, row) => sum + row.percentage, 0);
    const passCount = filteredRows.filter((row) => row.status === "pass").length;
    const failCount = filteredRows.filter((row) => row.status === "fail").length;
    const pendingCount = filteredRows.filter((row) => row.status === "pending").length;
    const highestScore = Math.max(...filteredRows.map((row) => row.percentage));

    return {
      classAverage: totalPercent / filteredRows.length,
      passCount,
      failCount,
      pendingCount,
      highestScore,
    };
  }, [filteredRows]);

  const exportToExcel = () => {
    if (!data) return;

    const rows = filteredRows.map((student, index) => {
      const subjectColumns = Object.fromEntries(
        data.subjects.map((subject) => {
          const found = student.subjectMarks.find((item) => item.examSubjectId === subject.examSubjectId);
          return [subject.subjectName, `${found?.totalObtained ?? "-"}/${found?.totalMax ?? "-"}`];
        }),
      );

      return {
        "S.No": index + 1,
        "Roll No": student.rollNumber ?? "-",
        "Enrollment No": student.enrollmentNo ?? "-",
        "Student Name": student.fullName,
        "Father Name": student.fatherName,
        ...subjectColumns,
        Total: student.totalObtained,
        Max: student.totalMax,
        "%": student.percentage.toFixed(2),
        Grade: student.grade,
        Division: student.division,
        Result: student.status.toUpperCase(),
        Remarks: student.remarks,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TR Sheet");
    XLSX.writeFile(workbook, `tr-sheet-${data.exam.examName.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`);
  };

  const printRtSheet = () => {
    const existing = document.getElementById("rt-sheet-print-style");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "rt-sheet-print-style";
    style.media = "print";
    style.textContent = `
      @page { size: A4 landscape; margin: 10mm; }
      .rt-sheet-no-print { display: none !important; }
      .rt-sheet-print-wrap { overflow: visible !important; max-height: none !important; border: 0 !important; }
      .rt-sheet-print-table { min-width: 0 !important; width: 100% !important; font-size: 11px !important; }
      .rt-sheet-print-table th, .rt-sheet-print-table td { white-space: nowrap !important; padding: 4px 6px !important; }
      .rt-sheet-print-table thead {
        position: static !important;
        display: table-header-group !important;
      }
      .rt-sheet-print-table tbody { display: table-row-group !important; }
      .rt-sheet-print-table tfoot { display: table-footer-group !important; }
      .rt-sheet-print-table tr { page-break-inside: avoid !important; break-inside: avoid !important; }
      .rt-sheet-marksheet-col { display: none !important; }
      .rt-sheet-subject-header {
        height: auto !important;
        min-width: 60px !important;
        vertical-align: middle !important;
        text-align: center !important;
      }
      .rt-sheet-subject-header > span {
        writing-mode: horizontal-tb !important;
        transform: none !important;
        text-orientation: mixed !important;
        display: inline !important;
        visibility: visible !important;
        color: #000 !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
      }
    `;
    document.head.appendChild(style);

    const cleanup = () => {
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup, { once: true });

    window.print();
  };

  const openBulkOfficialStyledPrint = () => {
    if (!examId) return;
    window.open(`/dashboard/official-marksheet/bulk/${examId}`, "_blank", "noopener,noreferrer");
  };

  return (
    <DashboardLayout title="TR Sheet">
      <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
        <p className="rt-sheet-no-print text-sm text-muted-foreground">
          Flow: Exam Type {"->"} Class {"->"} Subjects {"->"} TR Sheet
        </p>
        <div className="rt-sheet-no-print flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by roll, student, father"
              className="w-full sm:w-72"
            />
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="all">All Classes</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                next.set("sort", event.target.value);
                setSearchParams(next);
              }}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="roll">Sort by Roll</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportToExcel} disabled={!data}>Export to Excel</Button>
            <Button variant="outline" onClick={printRtSheet} disabled={!data}>Print TR Sheet</Button>
            {canBulkStyledPrintResults && (
              <Button
                variant="outline"
                onClick={openBulkOfficialStyledPrint}
                disabled={!data}
              >
                Bulk Styled Official Marksheets
              </Button>
            )}
            <Button asChild>
              <Link to="/dashboard/rt-sheet">Change Exam</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading TR sheet...</CardContent>
          </Card>
        ) : !data ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">TR sheet not available.</CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{data.exam.examName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {data.exam.examTypeLabel} | Class: {data.exam.className} | Session: {data.exam.sessionName} | Date: {formatDate(data.exam.startDate)} - {formatDate(data.exam.endDate)}
                </p>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subject Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-3 py-2 text-left">Subject</th>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Exam Date</th>
                        <th className="px-3 py-2 text-left">Start Time</th>
                        <th className="px-3 py-2 text-left">End Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((subject) => (
                        <tr key={`schedule-${subject.examSubjectId}`} className="border-b">
                          <td className="px-3 py-2">{subject.subjectName}</td>
                          <td className="px-3 py-2">{subject.subjectCode}</td>
                          <td className="px-3 py-2">{formatDate(subject.examDate ?? null)}</td>
                          <td className="px-3 py-2">{formatTime(subject.startTime)}</td>
                          <td className="px-3 py-2">{formatTime(subject.endTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="rt-sheet-print-wrap w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto rounded-md border max-h-[70vh]">
              <table className="rt-sheet-print-table w-full min-w-275 text-sm">
                <thead className="sticky top-0 z-20 bg-background">
                  <tr className="border-b">
                    <th className="bg-background px-2 py-2 text-left whitespace-nowrap">S.No</th>
                    <th className="bg-background px-2 py-2 text-left whitespace-nowrap">Student Details</th>
                    {data.subjects.map((subject) => (
                      <th
                        key={subject.examSubjectId}
                        className="rt-sheet-subject-header bg-background px-2 py-2 text-center min-w-14 align-bottom"
                      >
                        <span
                          className="inline-block text-xs font-medium leading-none whitespace-nowrap"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                        >
                          {subject.subjectName}
                        </span>
                      </th>
                    ))}
                    <th className="bg-background px-2 py-2 text-left whitespace-nowrap">Total</th>
                    <th className="bg-background px-2 py-2 text-left whitespace-nowrap">Max</th>
                    <th className="bg-background px-2 py-2 text-left whitespace-nowrap">%</th>
                    <th className="bg-background px-2 py-2 text-left whitespace-nowrap">Result</th>
                    <th className="rt-sheet-marksheet-col bg-background px-2 py-2 text-left whitespace-nowrap">
                      Marksheet
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((student, index) => (
                    <tr key={student.studentId} className="border-b">
                      <td className="px-2 py-2">{index + 1}</td>
                      <td className="px-2 py-2">
                        <div className="flex min-w-45 flex-col leading-tight">
                          <span className="font-medium">{student.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            Enrollment: {student.enrollmentNo ?? "-"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Roll: {student.rollNumber ?? "-"}
                          </span>
                          <span className="text-xs text-muted-foreground">Father: {student.fatherName}</span>
                        </div>
                      </td>
                      {data.subjects.map((subject) => {
                        const mark = student.subjectMarks.find((item) => item.examSubjectId === subject.examSubjectId);
                        return (
                          <td key={`${student.studentId}-${subject.examSubjectId}`} className="px-2 py-2">
                            {mark ? `${mark.totalObtained}/${mark.totalMax}` : "-"}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 font-medium">{student.totalObtained}</td>
                      <td className="px-2 py-2">{student.totalMax}</td>
                      <td className="px-2 py-2">{student.percentage.toFixed(2)}</td>
                      <td className="px-2 py-2 font-semibold">{student.status.toUpperCase()}</td>
                      <td className="rt-sheet-marksheet-col px-2 py-2">
                        {student.status === "pending" ? (
                          <span className="text-xs text-amber-700">Pending</span>
                        ) : (
                          <Button size="sm" asChild>
                            <Link to={`/dashboard/official-marksheet/${student.studentId}/${data.exam.examId}`}>
                              Open
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/40 font-medium">
                    <td className="px-2 py-2" colSpan={2}>Summary</td>
                    <td className="px-2 py-2" colSpan={data.subjects.length + 5}>
                      Class Average: {computedSummary.classAverage.toFixed(2)}% | Pass: {computedSummary.passCount} | Fail: {computedSummary.failCount} | Pending: {computedSummary.pendingCount} | Highest: {computedSummary.highestScore.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
