import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAM_TYPE_LABELS } from "@/lib/examStructure";
import { useAcademicSessionStore } from "@/store/academic-session.store";
import { useMarksStore } from "@/store/marks.store";
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

type AcademicSessionItem = { id: string; name: string };

const entryKey = (studentId: string, examSubjectId: string, component: string) =>
  `${studentId}::${examSubjectId}::${component}`;
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

function MarksSectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export default function MarksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialExamId = searchParams.get("examId") ?? "";

  const [examId, setExamId] = useState(initialExamId);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [teacherProfileId, setTeacherProfileId] = useState<string | null>(null);
  const [loadingTeacherProfile, setLoadingTeacherProfile] = useState(false);
  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const selectedSessionId = useAcademicSessionStore((state) => state.selectedSessionId);
  const setSelectedSessionId = useAcademicSessionStore(
    (state) => state.setSelectedSessionId,
  );
  const userRoles = useUserStore((state) => state.user?.roles ?? []);
  const isTeacherOnly = userRoles.includes("teacher") && !userRoles.includes("admin");

  const exams = useMarksStore((state) => state.exams);
  const examsLoadedForSessionId = useMarksStore(
    (state) => state.examsLoadedForSessionId,
  );
  const examsError = useMarksStore((state) => state.examsError);
  const examsLoading = useMarksStore((state) => state.examsLoading);
  const examDataById = useMarksStore((state) => state.examDataById);
  const loadingExamId = useMarksStore((state) => state.loadingExamId);
  const examDataError = useMarksStore((state) => state.examDataError);
  const fetchExams = useMarksStore((state) => state.fetchExams);
  const fetchExamData = useMarksStore((state) => state.fetchExamData);
  const setMarkInputField = useMarksStore((state) => state.setMarkInputField);

  const selectedExamData = examId ? examDataById[examId] : undefined;
  const examDetails = selectedExamData?.examDetails ?? null;
  const students = selectedExamData?.students ?? [];
  const existingMarks = selectedExamData?.existingMarks ?? [];
  const markInput = selectedExamData?.markInput ?? {};
  const isLoadingExam = Boolean(examId) && loadingExamId === examId;
  const hasCachedExamData = Boolean(selectedExamData);
  const selectedExamListItem = exams.find((item) => item.id === examId);
  const marksEntryMode =
    selectedExamData?.examDetails?.marksEntryMode ??
    selectedExamListItem?.marksEntryMode ??
    "closed";
  const isMarksEntryClosedForTeacher = isTeacherOnly && marksEntryMode !== "open";

  useEffect(() => {
    setSessionsLoading(true);
    fetch("/api/academic-session/all")
      .then(async (response) => {
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to fetch academic sessions",
          );
        }
        setSessions(Array.isArray(result.data) ? (result.data as AcademicSessionItem[]) : []);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to fetch academic sessions");
        setSessions([]);
      })
      .finally(() => {
        setSessionsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedSessionId) return;
    void fetchExams(selectedSessionId);
  }, [fetchExams, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setExamId("");
      setSelectedSubjectId("");
      const params = new URLSearchParams(searchParams);
      if (params.has("examId")) {
        params.delete("examId");
        setSearchParams(params);
      }
      return;
    }
    if (!examId) return;
    const normalizedSelectedSessionId = (selectedSessionId ?? "").trim();
    if (examsLoadedForSessionId !== normalizedSelectedSessionId) return;
    const exists = exams.some((exam) => exam.id === examId);
    if (!exists) {
      setExamId("");
      const params = new URLSearchParams(searchParams);
      params.delete("examId");
      setSearchParams(params);
    }
  }, [
    examId,
    exams,
    examsLoadedForSessionId,
    searchParams,
    selectedSessionId,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!examId) return;
    void fetchExamData(examId);
  }, [examId, fetchExamData]);

  useEffect(() => {
    if (!isTeacherOnly) {
      setTeacherProfileId(null);
      setLoadingTeacherProfile(false);
      return;
    }

    setLoadingTeacherProfile(true);
    fetch("/api/auth/profile")
      .then(async (response) => {
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to load teacher profile",
          );
        }
        const profile =
          result.data &&
          typeof result.data === "object" &&
          "teacherProfile" in result.data
            ? (result.data.teacherProfile as { id?: string } | null)
            : null;
        setTeacherProfileId(profile?.id ?? null);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load teacher profile");
        setTeacherProfileId(null);
      })
      .finally(() => {
        setLoadingTeacherProfile(false);
      });
  }, [isTeacherOnly]);

  const availableSubjects = useMemo(() => {
    if (!examDetails) return [];
    if (!isTeacherOnly) return examDetails.subjects;
    if (!teacherProfileId) return [];
    return examDetails.subjects.filter(
      (subject) => subject.assignedTeacherId === teacherProfileId,
    );
  }, [examDetails, isTeacherOnly, teacherProfileId]);
  const hasTeacherSubjectAccess =
    !isTeacherOnly || loadingTeacherProfile || availableSubjects.length > 0;

  useEffect(() => {
    if (!availableSubjects.length) {
      setSelectedSubjectId("");
      return;
    }
    const exists = availableSubjects.some(
      (subject) => subject.subjectId === selectedSubjectId,
    );
    if (!exists) {
      setSelectedSubjectId("");
    }
  }, [availableSubjects, selectedSubjectId]);

  useEffect(() => {
    if (examsError) toast.error(examsError);
  }, [examsError]);

  useEffect(() => {
    if (examDataError) toast.error(examDataError);
  }, [examDataError]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      [student.fullName, student.rollNumber, student.className]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search, students]);

  const markIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of existingMarks) {
      map.set(entryKey(item.studentId, item.examSubjectId, item.component), item.id);
    }
    return map;
  }, [existingMarks]);

  const existingMarkValueByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of existingMarks) {
      map.set(entryKey(item.studentId, item.examSubjectId, item.component), item.obtainedMarks);
    }
    return map;
  }, [existingMarks]);

  const updateMarkField = (
    studentId: string,
    examSubjectId: string,
    component: string,
    value: string,
    maxMarks: number,
  ) => {
    if (value && !/^\d+$/.test(value)) return;
    if (!examId) return;

    if (value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > maxMarks) {
        toast.error(`Marks must be between 0 and ${maxMarks}`);
        return;
      }
    }

    setMarkInputField(examId, studentId, examSubjectId, component, value);
  };

  const saveMarks = async () => {
    if (!selectedSessionId) {
      toast.error("Please select a session");
      return;
    }
    if (!examId || !examDetails) {
      toast.error("Please select an exam");
      return;
    }
    if (!selectedSubjectId) {
      toast.error("Please select a subject");
      return;
    }

    const createEntries: Array<{
      studentId: string;
      examSubjectId: string;
      subjectId: string;
      component: string;
      obtainedMarks: number;
    }> = [];
    const updateEntries: Array<{
      markId: string;
      obtainedMarks: number;
    }> = [];

    const sourceSubjects = isTeacherOnly ? availableSubjects : examDetails.subjects;
    const editableSubjects = sourceSubjects.filter(
      (subject) => subject.subjectId === selectedSubjectId,
    );
    const validExamSubjectIds = new Set(
      editableSubjects
        .map((subject) => subject.examSubjectId)
        .filter((value): value is string => typeof value === "string" && isUuid(value)),
    );

    for (const student of students) {
      for (const subject of editableSubjects) {
        if (!subject.examSubjectId || !isUuid(subject.examSubjectId)) {
          toast.error(
            "Subject mapping is stale. Please click Reload and try again.",
          );
          return;
        }
        for (const component of subject.components) {
          const key = entryKey(student.studentId, subject.examSubjectId, component.component);
          const raw = markInput[key];
          if (raw === undefined || raw === "") continue;
          const obtainedMarks = Number(raw);
          if (!Number.isFinite(obtainedMarks) || obtainedMarks < 0) {
            toast.error(`Invalid marks for ${student.fullName} - ${subject.subjectName} (${component.componentLabel})`);
            return;
          }
          if (obtainedMarks > component.maxMarks) {
            toast.error(
              `Marks exceed max (${component.maxMarks}) for ${student.fullName} - ${subject.subjectName} (${component.componentLabel})`,
            );
            return;
          }
          const existingMarkId = markIdByKey.get(key);
          if (!existingMarkId) {
            createEntries.push({
              studentId: student.studentId,
              examSubjectId: subject.examSubjectId,
              subjectId: subject.subjectId,
              component: component.component,
              obtainedMarks,
            });
            continue;
          }

          const previous = existingMarkValueByKey.get(key);
          if (previous === obtainedMarks) continue;
          if (isTeacherOnly) {
            toast.error(
              "Teachers cannot edit saved marks. Contact admin for correction.",
            );
            return;
          }
          updateEntries.push({
            markId: existingMarkId,
            obtainedMarks,
          });
        }
      }
    }

    if (createEntries.length === 0 && updateEntries.length === 0) {
      toast.error("No mark changes to save");
      return;
    }
    if (
      createEntries.some((entry) => !validExamSubjectIds.has(entry.examSubjectId))
    ) {
      toast.error("Exam subject data is outdated. Please reload the exam.");
      return;
    }

    setSaving(true);
    try {
      if (createEntries.length > 0) {
        const response = await fetch("/api/exam/marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ examId, entries: createEntries }),
        });
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string" ? result.error : "Failed to save marks",
          );
        }
      }

      if (updateEntries.length > 0) {
        const response = await fetch("/api/exam/marks/bulk-update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: updateEntries }),
        });
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string" ? result.error : "Failed to update marks",
          );
        }
      }

      toast.success("Marks saved/updated successfully");
      await fetchExamData(examId, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Marks">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Enter Marks</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!examId) return;
                void fetchExamData(examId, true);
              }}
              disabled={!selectedSessionId || !examId || isLoadingExam}
            >
              {isLoadingExam ? "Loading..." : "Reload"}
            </Button>
            <Button
              onClick={saveMarks}
              disabled={
                saving ||
                isLoadingExam ||
                !selectedSessionId ||
                isMarksEntryClosedForTeacher ||
                !hasTeacherSubjectAccess ||
                !selectedSubjectId
              }
            >
              {saving ? "Saving..." : "Save Marks"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exam Selection</CardTitle>
            <CardDescription>Select session and exam to load students and subjects.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">
                {sessionsLoading ? "Loading sessions..." : "Select Session *"}
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>

            <select
              value={examId}
              onChange={(event) => {
                const value = event.target.value;
                setExamId(value);
                const params = new URLSearchParams(searchParams);
                if (value) params.set("examId", value);
                else params.delete("examId");
                setSearchParams(params);
              }}
              className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              disabled={!selectedSessionId}
            >
              <option value="">
                {!selectedSessionId
                  ? "Select session first"
                  : examsLoading && exams.length === 0
                    ? "Loading exams..."
                    : "Select Exam"}
              </option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}{" "}
                  {exam.className ? `(${exam.className})` : ""}
                  {" - "}
                  {EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}
                  {" - "}
                  {exam.academicYear}
                  {" - "}
                  {exam.status}
                  {exam.marksEntryMode === "open" ? " - entry open" : " - entry closed"}
                </option>
              ))}
            </select>

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter students by name, class, roll..."
            />

            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
              disabled={!examDetails || !availableSubjects.length}
            >
              <option value="">Select subject *</option>
              {availableSubjects.map((subject) => (
                <option key={subject.examSubjectId} value={subject.subjectId}>
                  {subject.subjectName} ({subject.subjectCode})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {isLoadingExam && !hasCachedExamData ? (
          <MarksSectionSkeleton />
        ) : (
          examDetails && (
            (() => {
              const visibleSubjects =
                selectedSubjectId
                  ? availableSubjects.filter(
                      (subject) => subject.subjectId === selectedSubjectId,
                    )
                  : [];

              const componentColumns = visibleSubjects.flatMap((subject) =>
                subject.components.map((component) => ({
                  examSubjectId: subject.examSubjectId,
                  subjectName: subject.subjectName,
                  subjectCode: subject.subjectCode,
                  component: component.component,
                  componentLabel: component.componentLabel,
                  maxMarks: component.maxMarks,
                  passMarks: component.passMarks,
                })),
              );

              return (
            <Card>
              <CardHeader>
                <CardTitle>{EXAM_TYPE_LABELS[examDetails.examType] ?? examDetails.examType}</CardTitle>
                <CardDescription>
                  Students: {students.length} | Subjects: {visibleSubjects.length} | Components: {componentColumns.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isMarksEntryClosedForTeacher ? (
                  <p className="text-sm text-amber-700">
                    Marks entry is currently closed for this class. Contact admin to open it from marks control.
                  </p>
                ) : isTeacherOnly && !hasTeacherSubjectAccess ? (
                  <p className="text-sm text-amber-700">
                    No subject is assigned to you for this exam. Contact admin to map teacher-subject before entering marks.
                  </p>
                ) : !selectedSubjectId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a subject to enter marks.
                  </p>
                ) : componentColumns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No components assigned to this exam.
                  </p>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No students enrolled or matching search.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-255 text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 font-medium">Student</th>
                          <th className="text-left px-3 py-2 font-medium">Roll</th>
                          {componentColumns.map((column) => (
                            <th
                              key={`${column.examSubjectId}-${column.component}`}
                              className="text-left px-3 py-2 font-medium min-w-48"
                            >
                              {column.subjectName} ({column.subjectCode})
                              <div className="text-xs text-muted-foreground font-normal">
                                {column.componentLabel} | Max {column.maxMarks} | Pass {column.passMarks}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((student) => (
                          <tr key={student.studentId} className="border-b">
                            <td className="px-3 py-2">{student.fullName}</td>
                            <td className="px-3 py-2">{student.rollNumber}</td>
                            {componentColumns.map((column) => {
                              const key = entryKey(
                                student.studentId,
                                column.examSubjectId,
                                column.component,
                              );
                              const value = markInput[key] ?? "";
                              const numeric = value === "" ? null : Number(value);
                              const hasExisting = markIdByKey.has(key);
                              const isFail = numeric !== null && numeric < column.passMarks;
                              const isReadOnlyForTeacher = isTeacherOnly && hasExisting;

                              return (
                                <td key={`${column.examSubjectId}-${column.component}`} className="px-3 py-2">
                                  <Input
                                    value={value}
                                    type="number"
                                    min={0}
                                    max={column.maxMarks}
                                    step={1}
                                    inputMode="numeric"
                                    disabled={isReadOnlyForTeacher}
                                    onChange={(event) =>
                                      updateMarkField(
                                        student.studentId,
                                        column.examSubjectId,
                                        column.component,
                                        event.target.value,
                                        column.maxMarks,
                                      )
                                    }
                                    placeholder="0"
                                    className="h-8"
                                  />
                                  <div className="text-xs mt-1">
                                    {hasExisting ? (
                                      <span className={isReadOnlyForTeacher ? "text-amber-700" : "text-blue-600"}>
                                        {isReadOnlyForTeacher ? "Locked" : "Editable"}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">New</span>
                                    )}
                                    {numeric !== null && (
                                      <span className={isFail ? "text-red-600 ml-2" : "text-green-700 ml-2"}>
                                        {isFail ? "Fail" : "Pass"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
              );
            })()
          )
        )}
      </div>
    </DashboardLayout>
  );
}
