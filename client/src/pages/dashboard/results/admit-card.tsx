import DashboardLayout from "@/components/DashboardLayout";
import AdmitCardSheet from "@/components/results/admit-card-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildBulkAdmitCardDocument,
  downloadAdmitCardDocument,
  openAdmitCardPrintWindow,
  type AdmitCardData,
} from "@/lib/admit-card-print";
import useUserStore from "@/store/user.store";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

type ExamOption = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  examTypeLabel?: string;
  academicYear: string;
  sessionName?: string;
};

type StudentOption = {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  enrollmentNo: string | null;
  className: string;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

type ApiError = {
  success: false;
  error?: string;
};

const parseJson = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text) return null as T | null;
  return JSON.parse(text) as T;
};

export default function DashboardAdmitCardPage() {
  const [searchParams] = useSearchParams();
  const user = useUserStore((state) => state.user);
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("admin");

  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [previewStudentId, setPreviewStudentId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const [cardData, setCardData] = useState<AdmitCardData | null>(null);
  const [bulkAction, setBulkAction] = useState<"idle" | "printing" | "downloading">("idle");
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const examIdFromQuery = searchParams.get("examId") ?? "";

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        if (isAdmin) {
          const response = await fetch("/api/exam/all");
          const result = await parseJson<ApiSuccess<ExamOption[]> | ApiError>(response);
          if (!response.ok || !result?.success) {
            throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
          }
          const rows = Array.isArray(result.data) ? result.data : [];
          setExamOptions(rows);
        } else {
          const response = await fetch("/api/results/my-results");
          const result = await parseJson<
            | ApiSuccess<{
              exams: Array<{
                examId: string;
                examName: string;
                examType: "quarterly" | "half_yearly" | "annual";
                examTypeLabel: string;
                academicYear: string;
                sessionName: string;
              }>;
            }>
            | ApiError
          >(response);
          if (!response.ok || !result?.success) {
            throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
          }
          const rows = (result.data?.exams ?? []).map((item) => ({
            id: item.examId,
            name: item.examName,
            examType: item.examType,
            examTypeLabel: item.examTypeLabel,
            academicYear: item.academicYear,
            sessionName: item.sessionName,
          }));
          setExamOptions(rows);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exams");
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadOptions();
  }, [isAdmin]);

  useEffect(() => {
    if (!examOptions.length) return;
    if (examIdFromQuery && examOptions.some((item) => item.id === examIdFromQuery)) {
      setSelectedExamId(examIdFromQuery);
      return;
    }
    if (!examOptions.some((item) => item.id === selectedExamId)) {
      setSelectedExamId(examOptions[0]?.id ?? "");
    }
  }, [examIdFromQuery, examOptions, selectedExamId]);

  useEffect(() => {
    setSelectedStudentIds([]);
    setPreviewStudentId("");
    setCardData(null);
  }, [selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) {
      setStudentOptions([]);
      return;
    }
    if (!isAdmin) return;

    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await fetch(`/api/exam/${selectedExamId}/students`);
        const result = await parseJson<
          | ApiSuccess<
            Array<{
              studentId: string;
              fullName: string;
              rollNumber: string;
              enrollmentNo: string | null;
              className: string;
            }>
          >
          | ApiError
        >(response);
        if (!response.ok || !result?.success) {
          throw new Error(
            result && "error" in result
              ? result.error || "Failed to load exam students"
              : "Failed to load exam students",
          );
        }

        const rows = Array.isArray(result.data)
          ? result.data.map((item) => ({
            studentId: item.studentId,
            fullName: item.fullName,
            rollNumber: item.rollNumber,
            enrollmentNo: item.enrollmentNo,
            className: item.className,
          }))
          : [];
        setStudentOptions(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exam students");
        setStudentOptions([]);
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [isAdmin, selectedExamId]);

  useEffect(() => {
    if (!isAdmin) return;

    if (!studentOptions.length) {
      setSelectedStudentIds([]);
      setPreviewStudentId("");
      return;
    }

    setSelectedStudentIds((current) =>
      current.filter((studentId) => studentOptions.some((student) => student.studentId === studentId)),
    );

    if (!studentOptions.some((student) => student.studentId === previewStudentId)) {
      setPreviewStudentId(studentOptions[0]?.studentId ?? "");
    }
  }, [isAdmin, previewStudentId, studentOptions]);

  const canLoadCard = useMemo(() => {
    if (!selectedExamId) return false;
    if (!isAdmin) return true;
    return !!previewStudentId;
  }, [isAdmin, previewStudentId, selectedExamId]);

  const fetchAdmitCardData = async (examId: string, studentId?: string) => {
    const query = isAdmin && studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
    const response = await fetch(`/api/results/admit-card/${examId}${query}`);
    const result = await parseJson<ApiSuccess<AdmitCardData> | ApiError>(response);

    if (!response.ok || !result?.success) {
      throw new Error(result && "error" in result ? result.error || "Failed to load admit card" : "Failed to load admit card");
    }

    return result.data;
  };

  const fetchAdmitCard = async () => {
    if (!canLoadCard) return;

    setLoadingCard(true);
    try {
      const result = await fetchAdmitCardData(selectedExamId, isAdmin ? previewStudentId : undefined);
      setCardData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admit card");
      setCardData(null);
    } finally {
      setLoadingCard(false);
    }
  };

  const syncPreviewAdmitCard = useEffectEvent(async () => {
    await fetchAdmitCard();
  });

  useEffect(() => {
    if (!canLoadCard) {
      setCardData(null);
      return;
    }
    void syncPreviewAdmitCard();
  }, [canLoadCard, selectedExamId, previewStudentId]);

  const selectedStudents = useMemo(
    () => studentOptions.filter((student) => selectedStudentIds.includes(student.studentId)),
    [selectedStudentIds, studentOptions],
  );

  const allSelected = studentOptions.length > 0 && selectedStudentIds.length === studentOptions.length;
  const someSelected = selectedStudentIds.length > 0 && !allSelected;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleStudentSelection = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((current) => {
      if (checked) {
        if (current.includes(studentId)) return current;
        return [...current, studentId];
      }
      return current.filter((id) => id !== studentId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedStudentIds(checked ? studentOptions.map((student) => student.studentId) : []);
  };

  const prepareSelectedCards = async () => {
    if (!selectedStudents.length) {
      throw new Error("Select at least one admit card to continue.");
    }

    const results = await Promise.allSettled(
      selectedStudents.map((student) => fetchAdmitCardData(selectedExamId, student.studentId)),
    );

    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount > 0) {
      throw new Error(
        failedCount === 1
          ? "Failed to prepare one admit card. Please try again."
          : `Failed to prepare ${failedCount} admit cards. Please try again.`,
      );
    }

    return results
      .filter((result): result is PromiseFulfilledResult<AdmitCardData> => result.status === "fulfilled")
      .map((result) => result.value);
  };

  const runBulkAction = async (mode: "printing" | "downloading") => {
    if (!selectedStudents.length) {
      toast.error("Select at least one admit card to continue.");
      return;
    }

    setBulkAction(mode);
    try {
      const cards = await prepareSelectedCards();
      const selectedExam = examOptions.find((exam) => exam.id === selectedExamId);
      const title = selectedExam
        ? `${selectedExam.name} Admit Cards`
        : "Admit Cards";
      const documentHtml = buildBulkAdmitCardDocument(cards, title);

      if (mode === "printing") {
        await openAdmitCardPrintWindow(documentHtml);
      } else {
        const filenameBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "admit-cards";
        downloadAdmitCardDocument(documentHtml, `${filenameBase}.html`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to prepare bulk admit cards");
    } finally {
      setBulkAction("idle");
    }
  };

  const handleSinglePrint = async () => {
    if (!cardData) return;

    try {
      const documentHtml = buildBulkAdmitCardDocument(
        [cardData],
        `${cardData.student.fullName} Admit Card`,
      );
      await openAdmitCardPrintWindow(documentHtml);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print admit card");
    }
  };

  return (
    <DashboardLayout title="Admit Card">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Exam Admit Card</h1>

        <Card>
          <CardHeader>
            <CardTitle>Select Details</CardTitle>
            <CardDescription>
              Choose exam{isAdmin ? " and students" : ""} to generate admit cards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-1"}`}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Exam</label>
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">
                    {loadingOptions ? "Loading exams..." : "Select exam"}
                  </option>
                  {examOptions.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ({exam.examTypeLabel ?? exam.examType}) - {exam.academicYear}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Preview Student</label>
                  <select
                    value={previewStudentId}
                    onChange={(event) => setPreviewStudentId(event.target.value)}
                    disabled={!selectedExamId || loadingStudents || !studentOptions.length}
                    className="h-9 w-full min-w-64 rounded-md border bg-transparent px-3 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {!selectedExamId
                        ? "Select exam first"
                        : loadingStudents
                          ? "Loading students..."
                          : studentOptions.length
                            ? "Select student"
                            : "No students found"}
                    </option>
                    {studentOptions.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.fullName} ({student.enrollmentNo || student.rollNumber || "No ID"})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void fetchAdmitCard()} disabled={!canLoadCard || loadingCard}>
                {loadingCard ? "Loading..." : "Refresh Admit Card"}
              </Button>
              <Button variant="outline" onClick={handleSinglePrint} disabled={!cardData}>
                Print Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Bulk Print Admit Cards</CardTitle>
              <CardDescription>
                Select students, then print or download multiple admit cards in one batch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border"
                    checked={allSelected}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                    disabled={!studentOptions.length || loadingStudents}
                  />
                  <span>Select All</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedStudentIds.length} selected
                  </span>
                  <Button
                    onClick={() => void runBulkAction("printing")}
                    disabled={!selectedStudentIds.length || bulkAction !== "idle"}
                  >
                    {bulkAction === "printing" ? "Preparing print..." : "Bulk Print"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void runBulkAction("downloading")}
                    disabled={!selectedStudentIds.length || bulkAction !== "idle"}
                  >
                    {bulkAction === "downloading" ? "Preparing download..." : "Download"}
                  </Button>
                </div>
              </div>

              {loadingStudents ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                  Loading students for this exam...
                </div>
              ) : studentOptions.length ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">Select</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Roll No.</TableHead>
                        <TableHead>Enrollment No.</TableHead>
                        <TableHead className="w-28 text-right">Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentOptions.map((student) => {
                        const isChecked = selectedStudentIds.includes(student.studentId);
                        const isPreviewing = previewStudentId === student.studentId;

                        return (
                          <TableRow key={student.studentId} data-state={isPreviewing ? "selected" : undefined}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border"
                                checked={isChecked}
                                onChange={(event) => toggleStudentSelection(student.studentId, event.target.checked)}
                                aria-label={`Select ${student.fullName}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.fullName}</TableCell>
                            <TableCell>{student.className}</TableCell>
                            <TableCell>{student.rollNumber || "-"}</TableCell>
                            <TableCell>{student.enrollmentNo || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant={isPreviewing ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => setPreviewStudentId(student.studentId)}
                              >
                                {isPreviewing ? "Viewing" : "Preview"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : selectedExamId ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                  No students are enrolled for the selected exam.
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                  Select an exam to load students.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="min-h-50">
          {loadingCard ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading admit card...</CardContent>
            </Card>
          ) : cardData ? (
            <AdmitCardSheet cardData={cardData} />
          ) : (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                {selectedExamId
                  ? "No admit card preview available."
                  : "Select an exam to view an admit card."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
