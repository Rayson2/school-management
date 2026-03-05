import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EXAM_TYPE_LABELS } from "@/lib/examStructure";
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

type ExamListItem = {
  id: string;
  sessionId: string;
  examGroupId?: string | null;
  classId: string;
  className: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  description: string | null;
  academicYear: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  status: "draft" | "scheduled" | "completed";
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  creatorName: string;
};

type ExamDetails = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  description: string | null;
  academicYear: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  status: "draft" | "scheduled" | "completed";
  createdByName: string;
  enrolledStudentsCount: number;
  classNames: string[];
  subjects: Array<{
    examSubjectId: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    passMarks: number;
    examDate: string | Date | null;
    startTime: string | Date | null;
    endTime: string | Date | null;
    components: Array<{
      component: string;
      componentLabel: string;
      maxMarks: number;
      passMarks: number;
    }>;
  }>;
};

type AcademicSessionItem = { id: string; name: string };

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString() : "N/A";
const formatTime = (value: string | Date | null | undefined) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

export default function ExamsPage() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [exams, setExams] = useState<ExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedExam, setSelectedExam] = useState<ExamDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const triggerPrint = () => {
    window.print();
  };

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (sessionId.trim()) query.set("sessionId", sessionId.trim());
      const suffix = query.toString();
      const response = await fetch(`/api/exam/all${suffix ? `?${suffix}` : ""}`);
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to fetch exams",
        );
      }
      const rows = Array.isArray(result.data) ? (result.data as ExamListItem[]) : [];
      setExams(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch exams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedExam(null);
    void fetchExams();
  }, [sessionId]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await fetch("/api/academic-session/all");
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to fetch academic sessions",
          );
        }
        setSessions(Array.isArray(result.data) ? (result.data as AcademicSessionItem[]) : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch academic sessions");
      }
    };
    void loadSessions();
  }, []);

  const filteredExams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exams.filter((exam) => {
      const searchable = [
        exam.name,
        exam.academicYear,
        exam.description ?? "",
        exam.creatorName,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = query ? searchable.includes(query) : true;
      const matchesStatus = statusFilter ? exam.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });
  }, [exams, search, statusFilter]);

  const openDetails = async (examId: string) => {
    setDetailsLoading(true);
    setError(null);
    try {
      const examResponse = await fetch(`/api/exam/${examId}`);
      const examResult = await parseJsonResponse(examResponse);

      if (!examResponse.ok || !examResult.success) {
        throw new Error(
          typeof examResult.error === "string"
            ? examResult.error
            : "Failed to load exam details",
        );
      }
      setSelectedExam(examResult.data as ExamDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exam details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const deleteExam = async (examId: string) => {
    setDeletingId(examId);
    setError(null);
    try {
      const response = await fetch(`/api/exam/${examId}`, { method: "DELETE" });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to delete exam",
        );
      }
      if (selectedExam?.id === examId) {
        setSelectedExam(null);
      }
      await fetchExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exam");
    } finally {
      setDeletingId(null);
    }
  };

  const updateExamStatus = async (
    examId: string,
    status: "draft" | "scheduled" | "completed",
  ) => {
    setUpdatingStatusId(examId);
    setError(null);
    try {
      const response = await fetch(`/api/exam/${examId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to update exam status",
        );
      }

      setExams((previous) =>
        previous.map((exam) => (exam.id === examId ? { ...exam, status } : exam)),
      );
      if (selectedExam?.id === examId) {
        setSelectedExam({ ...selectedExam, status });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update exam status");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <DashboardLayout title="Exams">
      <style>
        {`
          @media print {
            @page {
              size: landscape;
              margin: 10mm;
            }

            .exam-print-landscape {
              width: 100% !important;
              max-width: none !important;
            }

            .exam-print-landscape table {
              font-size: 11px;
            }

          }
        `}
      </style>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">List of Exams</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchExams} disabled={loading}>
              {loading ? "Loading..." : "Reload"}
            </Button>
            <Button onClick={() => navigate("/dashboard/exams/add")}>Add Exam</Button>
          </div>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Flow: Exam Type {"->"} Classes {"->"} Subjects {"->"} Schedule (Date & Time)
        </p>

        <div className="rounded-md border p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by exam, year, creator..."
              className="h-8 w-full md:w-72"
            />
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-40"
            >
              <option value="">All Sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-32"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
            <Button type="button" variant="outline" className="h-8" onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}>
              Clear
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {filteredExams.length} of {exams.length} exams
          </p>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-20 text-center">
                    Loading exams...
                  </TableCell>
                </TableRow>
              ) : filteredExams.length > 0 ? (
                filteredExams.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.name}</TableCell>
                    <TableCell>{exam.academicYear}</TableCell>
                    <TableCell>{EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}</TableCell>
                    <TableCell>{exam.className}</TableCell>
                    <TableCell>
                      <select
                        value={exam.status}
                        disabled={updatingStatusId === exam.id}
                        onChange={(event) =>
                          updateExamStatus(
                            exam.id,
                            event.target.value as "draft" | "scheduled" | "completed",
                          )
                        }
                        className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-28 capitalize"
                      >
                        <option value="draft">Draft</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                      </select>
                    </TableCell>
                    <TableCell>{formatDate(exam.startDate)}</TableCell>
                    <TableCell>{formatDate(exam.endDate)}</TableCell>
                    <TableCell>{exam.creatorName}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetails(exam.id)}
                          disabled={detailsLoading}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/dashboard/exams/${encodeURIComponent(exam.id)}/edit`)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/dashboard/marks?examId=${encodeURIComponent(exam.id)}`)
                          }
                        >
                          Marks
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === exam.id}
                          onClick={() => deleteExam(exam.id)}
                        >
                          {deletingId === exam.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-20 text-center">
                    No exams found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {selectedExam && (
          <div className="fixed inset-0 z-50 bg-black/50 print:bg-white flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="exam-print-landscape w-full max-w-4xl max-h-[92vh] overflow-y-auto print:max-w-none print:max-h-none print:shadow-none">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-3xl">{selectedExam.name}</CardTitle>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" onClick={triggerPrint}>
                    Print
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedExam(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="print-main-content grid grid-cols-1 md:grid-cols-2 gap-3">
                  <p>
                    <strong>Academic Year:</strong> {selectedExam.academicYear}
                  </p>
                  <p className="capitalize">
                    <strong>Status:</strong> {selectedExam.status}
                  </p>
                  <p>
                    <strong>Exam Type:</strong> {EXAM_TYPE_LABELS[selectedExam.examType] ?? selectedExam.examType}
                  </p>
                  <p>
                    <strong>Start Date:</strong> {formatDate(selectedExam.startDate)}
                  </p>
                  <p>
                    <strong>End Date:</strong> {formatDate(selectedExam.endDate)}
                  </p>
                  <p>
                    <strong>Created By:</strong> {selectedExam.createdByName}
                  </p>
                  <p>
                    <strong>Enrolled Students:</strong> {selectedExam.enrolledStudentsCount}
                  </p>
                  <p>
                    <strong>Classes:</strong>{" "}
                    {selectedExam.classNames?.length
                      ? selectedExam.classNames.join(", ")
                      : "N/A"}
                  </p>
                </div>
                <p className="print-main-content">
                  <strong>Description:</strong> {selectedExam.description || "N/A"}
                </p>

                <div className="print-main-content space-y-2">
                  <h3 className="font-semibold">Subjects</h3>
                  {selectedExam.subjects.length === 0 ? (
                    <p className="text-muted-foreground">No subjects assigned.</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Max</TableHead>
                            <TableHead>Pass</TableHead>
                            <TableHead>Components</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedExam.subjects.map((subject) => (
                            <TableRow key={subject.examSubjectId}>
                              <TableCell>{subject.subjectName}</TableCell>
                              <TableCell>{subject.subjectCode}</TableCell>
                              <TableCell>
                                {subject.examDate
                                  ? new Date(subject.examDate).toLocaleDateString()
                                  : "N/A"}
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(subject.startTime) && formatTime(subject.endTime)
                                    ? `${formatTime(subject.startTime)} - ${formatTime(subject.endTime)}`
                                    : formatDate(subject.examDate)}
                                </span>
                              </TableCell>
                              <TableCell>{subject.maxMarks}</TableCell>
                              <TableCell>{subject.passMarks}</TableCell>
                              <TableCell>
                                {subject.components
                                  .map((item) => `${item.componentLabel} (${item.maxMarks}/${item.passMarks})`)
                                  .join(", ")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
