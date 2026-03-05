import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXAM_TYPE_LABELS } from "@/lib/examStructure";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type ClassItem = { id: string; name: string };
type AcademicSessionItem = { id: string; name: string };

type ClassSubjectItem = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectType: "theory" | "practical" | "activity" | null;
};

type ExamForm = {
  sessionId: string;
  examType: "quarterly" | "half_yearly" | "annual";
  description: string;
  status: "draft" | "scheduled" | "completed";
  autoEnrollStudents: boolean;
};

type ClassScheduleState = {
  startDate: string;
  endDate: string;
  subjects: Record<
    string,
    {
      examDate: string;
      startTime: string;
      endTime: string;
    }
  >;
};

const toIsoDateTime = (value: string) => (value ? new Date(value).toISOString() : undefined);
const toIsoDateTimeFromDateAndTime = (date: string, time: string) =>
  date && time ? new Date(`${date}T${time}`).toISOString() : undefined;

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

export default function AddExamPage() {
  const navigate = useNavigate();

  const [examForm, setExamForm] = useState<ExamForm>({
    sessionId: "",
    examType: "quarterly",
    description: "",
    status: "draft",
    autoEnrollStudents: true,
  });
  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classSubjectsByClassId, setClassSubjectsByClassId] = useState<
    Record<string, ClassSubjectItem[]>
  >({});
  const [classSchedules, setClassSchedules] = useState<Record<string, ClassScheduleState>>({});
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingClassSubjects, setLoadingClassSubjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setExamField = <K extends keyof ExamForm>(key: K, value: ExamForm[K]) =>
    setExamForm((prev) => ({ ...prev, [key]: value }));

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch("/api/class/all");
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to fetch classes");
      }
      setClasses(Array.isArray(result.data) ? (result.data as ClassItem[]) : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch classes");
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchSessions = async () => {
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
      const rows = Array.isArray(result.data) ? (result.data as AcademicSessionItem[]) : [];
      setSessions(rows);
      if (!examForm.sessionId && rows.length > 0) {
        setExamField("sessionId", rows[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch academic sessions");
    }
  };

  useEffect(() => {
    void fetchSessions();
    void fetchClasses();
  }, []);

  useEffect(() => {
    if (!examForm.sessionId || !selectedClassIds.length) {
      setClassSubjectsByClassId({});
      return;
    }

    const fetchClassSubjects = async () => {
      setLoadingClassSubjects(true);
      try {
        const responses = await Promise.all(
          selectedClassIds.map(async (classId) => {
            const query = new URLSearchParams({ sessionId: examForm.sessionId, classId });
            const response = await fetch(`/api/exam/class-subjects/all?${query.toString()}`);
            const result = await parseJsonResponse(response);
            if (!response.ok || !result.success) {
              throw new Error(
                typeof result.error === "string"
                  ? result.error
                  : "Failed to fetch class subjects",
              );
            }
            return {
              classId,
              subjects: Array.isArray(result.data) ? (result.data as ClassSubjectItem[]) : [],
            };
          }),
        );

        const nextMap: Record<string, ClassSubjectItem[]> = {};
        for (const item of responses) {
          nextMap[item.classId] = item.subjects;
        }
        setClassSubjectsByClassId(nextMap);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch class subjects");
        setClassSubjectsByClassId({});
      } finally {
        setLoadingClassSubjects(false);
      }
    };

    void fetchClassSubjects();
  }, [examForm.sessionId, selectedClassIds]);

  const selectedClasses = useMemo(
    () => classes.filter((item) => selectedClassIds.includes(item.id)),
    [classes, selectedClassIds],
  );

  const updateClassSchedule = (classId: string, update: Partial<ClassScheduleState>) => {
    setClassSchedules((prev) => ({
      ...prev,
      [classId]: {
        startDate: prev[classId]?.startDate ?? "",
        endDate: prev[classId]?.endDate ?? "",
        subjects: prev[classId]?.subjects ?? {},
        ...update,
      },
    }));
  };

  const updateSubjectSchedule = (
    classId: string,
    subjectId: string,
    update: Partial<{ examDate: string; startTime: string; endTime: string }>,
  ) => {
    setClassSchedules((prev) => ({
      ...prev,
      [classId]: {
        startDate: prev[classId]?.startDate ?? "",
        endDate: prev[classId]?.endDate ?? "",
        subjects: {
          ...(prev[classId]?.subjects ?? {}),
          [subjectId]: {
            examDate: prev[classId]?.subjects?.[subjectId]?.examDate ?? "",
            startTime: prev[classId]?.subjects?.[subjectId]?.startTime ?? "",
            endTime: prev[classId]?.subjects?.[subjectId]?.endTime ?? "",
            ...update,
          },
        },
      },
    }));
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };
  const selectAllClasses = () => {
    setSelectedClassIds(classes.map((item) => item.id));
  };
  const clearAllClasses = () => {
    setSelectedClassIds([]);
  };

  const submitExam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!examForm.sessionId.trim()) {
      toast.error("Academic session is required");
      return;
    }
    if (!selectedClassIds.length) {
      toast.error("Select at least one class");
      return;
    }

    for (const classId of selectedClassIds) {
      const classSubjects = classSubjectsByClassId[classId] ?? [];
      if (!classSubjects.length) {
        toast.error("Each selected class must have class-subject mappings");
        return;
      }
      const subjectDates = classSchedules[classId]?.subjects ?? {};
      const missingSubject = classSubjects.find((subject) => {
        const item = subjectDates[subject.subjectId];
        return !item?.examDate || !item?.startTime || !item?.endTime;
      });
      if (missingSubject) {
        toast.error(`Please set date, start time and end time for ${missingSubject.subjectName}`);
        return;
      }

      const invalidRangeSubject = classSubjects.find((subject) => {
        const item = subjectDates[subject.subjectId];
        if (!item?.examDate || !item.startTime || !item.endTime) return false;
        const start = new Date(`${item.examDate}T${item.startTime}`).getTime();
        const end = new Date(`${item.examDate}T${item.endTime}`).getTime();
        return Number.isNaN(start) || Number.isNaN(end) || end <= start;
      });
      if (invalidRangeSubject) {
        toast.error(
          `End time must be after start time for ${invalidRangeSubject.subjectName}`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        sessionId: examForm.sessionId.trim(),
        examType: examForm.examType,
        description: examForm.description.trim() || undefined,
        status: examForm.status,
        autoEnrollStudents: examForm.autoEnrollStudents,
        classes: selectedClassIds.map((classId) => ({
          classId,
          startDate: toIsoDateTime(classSchedules[classId]?.startDate ?? ""),
          endDate: toIsoDateTime(classSchedules[classId]?.endDate ?? ""),
          subjects: (classSubjectsByClassId[classId] ?? []).map((subject) => ({
            subjectId: subject.subjectId,
            examDate: classSchedules[classId]?.subjects?.[subject.subjectId]?.examDate ?? "",
            startTime: toIsoDateTimeFromDateAndTime(
              classSchedules[classId]?.subjects?.[subject.subjectId]?.examDate ?? "",
              classSchedules[classId]?.subjects?.[subject.subjectId]?.startTime ?? "",
            ),
            endTime: toIsoDateTimeFromDateAndTime(
              classSchedules[classId]?.subjects?.[subject.subjectId]?.examDate ?? "",
              classSchedules[classId]?.subjects?.[subject.subjectId]?.endTime ?? "",
            ),
          })),
        })),
      };

      const response = await fetch("/api/exam/create-multi-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await parseJsonResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to create exam schedule");
      }

      toast.success("Multi-class exam schedule created successfully");
      navigate("/dashboard/exams");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create exam schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Add Exam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Add Multi-Class Exam</h1>

        <form className="space-y-6" onSubmit={submitExam}>
          <Card>
            <CardHeader>
              <CardTitle>Exam Details</CardTitle>
              <CardDescription>
                Flow: Exam Type {"->"} Classes {"->"} Subjects {"->"} Schedule (Date & Time).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Academic Session *</Label>
                <Select
                  value={examForm.sessionId || undefined}
                  onValueChange={(value) => setExamField("sessionId", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select academic session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="examType">Exam Type *</Label>
                <select
                  id="examType"
                  value={examForm.examType}
                  onChange={(event) =>
                    setExamField("examType", event.target.value as "quarterly" | "half_yearly" | "annual")
                  }
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="quarterly">Quarterly</option>
                  <option value="half_yearly">Half-Yearly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={examForm.status}
                  onChange={(event) =>
                    setExamField("status", event.target.value as "draft" | "scheduled" | "completed")
                  }
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoEnrollStudents">Student Enrollment</Label>
                <label
                  htmlFor="autoEnrollStudents"
                  className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm"
                >
                  <input
                    id="autoEnrollStudents"
                    type="checkbox"
                    checked={examForm.autoEnrollStudents}
                    onChange={(event) =>
                      setExamField("autoEnrollStudents", event.target.checked)
                    }
                    className="h-4 w-4"
                  />
                  Auto enroll all students of selected classes
                </label>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={examForm.description}
                  onChange={(event) => setExamField("description", event.target.value)}
                  className="min-h-24 w-full rounded-md border bg-transparent p-2 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Classes</CardTitle>
              <CardDescription>
                This {EXAM_TYPE_LABELS[examForm.examType]} exam will be created for all selected classes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={selectAllClasses}
                  disabled={loadingClasses || classes.length === 0}
                >
                  Select All Classes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllClasses}
                  disabled={selectedClassIds.length === 0}
                >
                  Clear All
                </Button>
              </div>
              {loadingClasses ? (
                <p className="text-sm text-muted-foreground">Loading classes...</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  {classes.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(item.id)}
                        onChange={() => toggleClass(item.id)}
                        className="h-4 w-4"
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedClasses.map((classItem) => {
            const classSubjects = classSubjectsByClassId[classItem.id] ?? [];
            const schedule = classSchedules[classItem.id] ?? { startDate: "", endDate: "", subjects: {} };

            return (
              <Card key={classItem.id}>
                <CardHeader>
                  <CardTitle>{classItem.name} Schedule</CardTitle>
                  <CardDescription>
                    Set subject-wise exam date with start and end time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Class Start Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={schedule.startDate}
                        onChange={(event) =>
                          updateClassSchedule(classItem.id, { startDate: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Class End Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={schedule.endDate}
                        onChange={(event) =>
                          updateClassSchedule(classItem.id, { endDate: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  {loadingClassSubjects ? (
                    <p className="text-sm text-muted-foreground">Loading subjects...</p>
                  ) : classSubjects.length === 0 ? (
                    <p className="text-sm text-red-500">
                      No class-subject mappings found. Assign subjects first.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-3 py-2 text-left">Subject</th>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Exam Date *</th>
                            <th className="px-3 py-2 text-left">Start Time *</th>
                            <th className="px-3 py-2 text-left">End Time *</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classSubjects.map((subject) => (
                            <tr key={subject.id} className="border-b">
                              <td className="px-3 py-2">{subject.subjectName}</td>
                              <td className="px-3 py-2">{subject.subjectCode}</td>
                              <td className="px-3 py-2">{subject.subjectType ?? "-"}</td>
                              <td className="px-3 py-2">
                                <Input
                                  type="date"
                                  value={schedule.subjects[subject.subjectId]?.examDate ?? ""}
                                  onChange={(event) =>
                                    updateSubjectSchedule(
                                      classItem.id,
                                      subject.subjectId,
                                      { examDate: event.target.value },
                                    )
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="time"
                                  value={schedule.subjects[subject.subjectId]?.startTime ?? ""}
                                  onChange={(event) =>
                                    updateSubjectSchedule(
                                      classItem.id,
                                      subject.subjectId,
                                      { startTime: event.target.value },
                                    )
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Input
                                  type="time"
                                  value={schedule.subjects[subject.subjectId]?.endTime ?? ""}
                                  onChange={(event) =>
                                    updateSubjectSchedule(
                                      classItem.id,
                                      subject.subjectId,
                                      { endTime: event.target.value },
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Multi-Class Exam"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard/exams")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
