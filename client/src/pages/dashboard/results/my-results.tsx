import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type SubjectComponent = {
  component: string;
  componentLabel: string;
  maxMarks: number;
  passMarks: number;
  obtainedMarks: number | null;
  status: "pass" | "fail" | "pending";
};

type SubjectResult = {
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

type ExamResult = {
  examId: string;
  examName: string;
  examType: "quarterly" | "half_yearly" | "annual";
  examTypeLabel: string;
  academicYear: string;
  className: string;
  sessionName: string;
  startDate: string | null;
  endDate: string | null;
  totalObtained: number;
  totalMax: number;
  totalPass: number;
  percentage: number;
  grade: string;
  division: string;
  status: "pass" | "fail" | "pending";
  subjects: SubjectResult[];
};

type StudentResultResponse = {
  student: {
    studentId: string;
    rollNumber: string;
    enrollmentNo: string | null;
    fullName: string;
  };
  exams: ExamResult[];
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

export default function MyResultsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<StudentResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/results/my-results");
        const result = (await response.json()) as Record<string, unknown>;

        if (!response.ok || !result.success) {
          throw new Error(typeof result.error === "string" ? result.error : "Failed to fetch results");
        }

        setData((result.data ?? null) as StudentResultResponse | null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch results");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const sessionOptions = useMemo(() => {
    if (!data) return [] as string[];
    return Array.from(new Set(data.exams.map((exam) => exam.sessionName)));
  }, [data]);

  const examsForSelectedSession = useMemo(() => {
    if (!data || !selectedSession) return [] as ExamResult[];
    return data.exams.filter((exam) => exam.sessionName === selectedSession);
  }, [data, selectedSession]);

  const selectedExam = useMemo(
    () => examsForSelectedSession.find((exam) => exam.examId === selectedExamId) ?? null,
    [examsForSelectedSession, selectedExamId],
  );

  useEffect(() => {
    if (!data || data.exams.length === 0) return;
    if (!selectedSession || !sessionOptions.includes(selectedSession)) {
      setSelectedSession(sessionOptions[0] ?? "");
    }
  }, [data, selectedSession, sessionOptions]);

  useEffect(() => {
    if (!selectedSession) return;
    if (!selectedExamId || !examsForSelectedSession.some((exam) => exam.examId === selectedExamId)) {
      setSelectedExamId(examsForSelectedSession[0]?.examId ?? "");
    }
  }, [selectedExamId, selectedSession, examsForSelectedSession]);

  return (
    <DashboardLayout title="My Results">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Results</h1>
        {loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Loading results...</CardContent>
          </Card>
        ) : !data || data.exams.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No exam results are available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Result</CardTitle>
                <CardDescription>Select session and exam to view student copy marksheet.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Session</label>
                    <select
                      value={selectedSession}
                      onChange={(event) => setSelectedSession(event.target.value)}
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    >
                      {sessionOptions.map((sessionName) => (
                        <option key={sessionName} value={sessionName}>
                          {sessionName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Exam</label>
                    <select
                      value={selectedExamId}
                      onChange={(event) => setSelectedExamId(event.target.value)}
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                    >
                      {examsForSelectedSession.map((exam) => (
                        <option key={exam.examId} value={exam.examId}>
                          {exam.examName} ({exam.examTypeLabel})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!data?.student.studentId || !selectedExam?.examId) return;
                    navigate(`/dashboard/marksheet/${data.student.studentId}/${selectedExam.examId}`);
                  }}
                  disabled={!selectedExam || selectedExam.status === "pending"}
                >
                  View Student Copy Marksheet
                </Button>
                {selectedExam?.status === "pending" ? (
                  <p className="text-sm text-amber-700">
                    Marksheet is unavailable until all marks are entered.
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Student ID: {data.student.enrollmentNo || data.student.rollNumber || "-"}
                </p>
              </CardContent>
            </Card>

            {selectedExam ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedExam.examName}</CardTitle>
                  <CardDescription>
                    {selectedExam.examTypeLabel} | {selectedExam.className} | Session {selectedExam.sessionName} | {formatDate(selectedExam.startDate)} - {formatDate(selectedExam.endDate)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><span className="text-muted-foreground">Grand Total:</span> {selectedExam.totalObtained}/{selectedExam.totalMax}</div>
                    <div><span className="text-muted-foreground">Pass Marks:</span> {selectedExam.totalPass}</div>
                    <div><span className="text-muted-foreground">Percentage:</span> {selectedExam.percentage.toFixed(2)}%</div>
                    <div><span className="text-muted-foreground">Result:</span> {selectedExam.status.toUpperCase()}</div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
