import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXAM_TYPE_LABELS } from "@/lib/examStructure";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

type AcademicSessionItem = { id: string; name: string };
type ClassItem = { id: string; name: string };
type ExamSubject = {
  examSubjectId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  examDate?: string | Date | null;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  components: Array<{
    component: string;
    componentLabel: string;
    maxMarks: number;
    passMarks: number;
  }>;
};
type ComponentRow = {
  examSubjectId: string;
  subjectName: string;
  subjectCode: string;
  component: string;
  componentLabel: string;
  maxMarks: string;
  passMarks: string;
};

type StudentListItem = {
  id: string;
  fullName: string;
  rollNumber: string;
  admissionNo?: string | null;
  classId: string;
  className: string;
  sessionId: string;
};

type ExamForm = {
  sessionId: string;
  classId: string;
  examType: "quarterly" | "half_yearly" | "annual";
  description: string;
  startDate: string;
  endDate: string;
  status: "draft" | "scheduled" | "completed";
};

const emptyForm = (): ExamForm => ({
  sessionId: "",
  classId: "",
  examType: "quarterly",
  description: "",
  startDate: "",
  endDate: "",
  status: "draft",
});

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

const toIsoDateTime = (value: string) => (value ? new Date(value).toISOString() : undefined);

const toInputDateTime = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "N/A";
const formatTime = (value: string | Date | null | undefined) =>
  value
    ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "N/A";

export default function EditExamPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState<ExamForm>(emptyForm());
  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [componentRows, setComponentRows] = useState<ComponentRow[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [allStudents, setAllStudents] = useState<StudentListItem[]>([]);
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [enrollingStudents, setEnrollingStudents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingComponentMarks, setSavingComponentMarks] = useState(false);

  const setField = <K extends keyof ExamForm>(key: K, value: ExamForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadDependencies = async () => {
    const [sessionsRes, classesRes] = await Promise.all([
      fetch("/api/academic-session/all"),
      fetch("/api/class/all"),
    ]);
    const [sessionsData, classesData] = await Promise.all([
      parseJsonResponse(sessionsRes),
      parseJsonResponse(classesRes),
    ]);

    if (!sessionsRes.ok || !sessionsData.success) {
      throw new Error(
        typeof sessionsData.error === "string"
          ? sessionsData.error
          : "Failed to fetch sessions",
      );
    }
    if (!classesRes.ok || !classesData.success) {
      throw new Error(
        typeof classesData.error === "string"
          ? classesData.error
          : "Failed to fetch classes",
      );
    }

    setSessions(
      Array.isArray(sessionsData.data) ? (sessionsData.data as AcademicSessionItem[]) : [],
    );
    setClasses(Array.isArray(classesData.data) ? (classesData.data as ClassItem[]) : []);
  };

  const loadExam = async (examId: string) => {
    const response = await fetch(`/api/exam/${examId}`);
    const result = await parseJsonResponse(response);
    if (!response.ok || !result.success || typeof result.data !== "object" || result.data === null) {
      throw new Error(typeof result.error === "string" ? result.error : "Failed to fetch exam");
    }

    const data = result.data as Record<string, unknown>;
    const subjects = Array.isArray(data.subjects)
      ? (data.subjects as ExamSubject[])
      : [];
    setExamSubjects(subjects);

    setForm({
      sessionId: typeof data.sessionId === "string" ? data.sessionId : "",
      classId: typeof data.classId === "string" ? data.classId : "",
      examType:
        data.examType === "half_yearly" || data.examType === "annual"
          ? data.examType
          : "quarterly",
      description: typeof data.description === "string" ? data.description : "",
      startDate: toInputDateTime(data.startDate as string | Date | null | undefined),
      endDate: toInputDateTime(data.endDate as string | Date | null | undefined),
      status:
        data.status === "scheduled" || data.status === "completed"
          ? data.status
          : "draft",
    });

    const rows = subjects.flatMap((subject) =>
      subject.components.map((component) => ({
        examSubjectId: subject.examSubjectId,
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
        component: component.component,
        componentLabel: component.componentLabel,
        maxMarks: String(component.maxMarks),
        passMarks: String(component.passMarks),
      })),
    );
    setComponentRows(rows);
  };

  const loadEnrollmentContext = async (examId: string) => {
    const [studentsRes, enrolledRes] = await Promise.all([
      fetch("/api/student/all"),
      fetch(`/api/exam/${examId}/students`),
    ]);
    const [studentsData, enrolledData] = await Promise.all([
      parseJsonResponse(studentsRes),
      parseJsonResponse(enrolledRes),
    ]);

    if (!studentsRes.ok || !studentsData.success) {
      throw new Error(
        typeof studentsData.error === "string"
          ? studentsData.error
          : "Failed to fetch students",
      );
    }
    if (!enrolledRes.ok || !enrolledData.success) {
      throw new Error(
        typeof enrolledData.error === "string"
          ? enrolledData.error
          : "Failed to fetch enrolled students",
      );
    }

    const all = Array.isArray(studentsData.data)
      ? (studentsData.data as StudentListItem[])
      : [];
    const enrolled = Array.isArray(enrolledData.data)
      ? (enrolledData.data as Array<{ studentId: string }>)
      : [];

    setAllStudents(all);
    setEnrolledStudentIds(enrolled.map((row) => row.studentId));
  };

  useEffect(() => {
    if (!id) {
      toast.error("Exam id is missing");
      navigate("/dashboard/exams");
      return;
    }

    setLoading(true);
    Promise.all([loadDependencies(), loadExam(id), loadEnrollmentContext(id)])
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load exam");
        navigate("/dashboard/exams");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const availableStudents = useMemo(() => {
    if (!form.classId || !form.sessionId) return [] as StudentListItem[];
    const enrolledSet = new Set(enrolledStudentIds);
    return allStudents.filter(
      (student) =>
        student.classId === form.classId &&
        student.sessionId === form.sessionId &&
        !enrolledSet.has(student.id),
    );
  }, [allStudents, enrolledStudentIds, form.classId, form.sessionId]);

  const filteredAvailableStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return availableStudents;
    return availableStudents.filter((student) =>
      [student.fullName, student.rollNumber, student.admissionNo, student.className]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [availableStudents, studentSearch]);

  useEffect(() => {
    const visibleIds = new Set(availableStudents.map((student) => student.id));
    setSelectedStudentIds((previous) =>
      previous.filter((studentId) => visibleIds.has(studentId)),
    );
  }, [availableStudents]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((previous) =>
      previous.includes(studentId)
        ? previous.filter((id) => id !== studentId)
        : [...previous, studentId],
    );
  };

  const toggleAllStudents = () => {
    const visibleIds = filteredAvailableStudents.map((student) => student.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((previous) =>
        previous.filter((id) => !visibleIds.includes(id)),
      );
      return;
    }
    setSelectedStudentIds((previous) => [...new Set([...previous, ...visibleIds])]);
  };

  const selectAllClassStudents = () => {
    setSelectedStudentIds(availableStudents.map((student) => student.id));
  };

  const enrollSelectedStudents = async () => {
    if (!id) return;
    if (!selectedStudentIds.length) {
      toast.error("Select at least one student to enroll");
      return;
    }

    setEnrollingStudents(true);
    try {
      const response = await fetch(`/api/exam/${id}/enroll-students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to enroll students",
        );
      }

      toast.success("Students enrolled successfully");
      setSelectedStudentIds([]);
      setStudentSearch("");
      await Promise.all([loadEnrollmentContext(id), loadExam(id)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll students");
    } finally {
      setEnrollingStudents(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id) return;

    if (!form.sessionId || !form.classId) {
      toast.error("Session and class are required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/exam/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: form.sessionId,
          classId: form.classId,
          examType: form.examType,
          description: form.description.trim() || undefined,
          startDate: toIsoDateTime(form.startDate),
          endDate: toIsoDateTime(form.endDate),
          status: form.status,
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to update exam",
        );
      }

      toast.success("Exam updated successfully");
      navigate("/dashboard/exams");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update exam");
    } finally {
      setSaving(false);
    }
  };

  const updateComponentRow = (
    index: number,
    key: "maxMarks" | "passMarks",
    value: string,
  ) => {
    if (value && !/^\d+$/.test(value)) return;
    setComponentRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const saveComponentMarks = async () => {
    if (!id) return;
    if (!componentRows.length) {
      toast.error("No component rows found");
      return;
    }

    const entries = [];
    for (const row of componentRows) {
      const maxMarks = Number(row.maxMarks);
      const passMarks = Number(row.passMarks);
      if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
        toast.error(
          `Invalid max marks for ${row.subjectName} - ${row.componentLabel}`,
        );
        return;
      }
      if (!Number.isFinite(passMarks) || passMarks < 0) {
        toast.error(
          `Invalid pass marks for ${row.subjectName} - ${row.componentLabel}`,
        );
        return;
      }
      if (passMarks > maxMarks) {
        toast.error(
          `Pass marks cannot exceed max marks for ${row.subjectName} - ${row.componentLabel}`,
        );
        return;
      }
      entries.push({
        examSubjectId: row.examSubjectId,
        component: row.component,
        maxMarks,
        passMarks,
      });
    }

    setSavingComponentMarks(true);
    try {
      const response = await fetch(`/api/exam/${id}/component-marks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to update component marks",
        );
      }
      toast.success("Component marks updated successfully");
      await loadExam(id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update component marks",
      );
    } finally {
      setSavingComponentMarks(false);
    }
  };

  return (
    <DashboardLayout title="Edit Exam">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Edit Exam</h1>
        <p className="text-sm text-muted-foreground">
          Flow: Exam Type {"->"} Class {"->"} Subjects {"->"} Schedule (Date & Time)
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Exam Details</CardTitle>
            <CardDescription>
              Session, class, exam type and fixed components are locked after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading exam...</p>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sessionId">Academic Session *</Label>
                    <select
                      id="sessionId"
                      value={form.sessionId}
                      onChange={(event) => setField("sessionId", event.target.value)}
                      disabled
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="">Select academic session</option>
                      {sessions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classId">Class *</Label>
                    <select
                      id="classId"
                      value={form.classId}
                      onChange={(event) => setField("classId", event.target.value)}
                      disabled
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="">Select class</option>
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="examType">Exam Type</Label>
                    <Input id="examType" value={EXAM_TYPE_LABELS[form.examType]} disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={form.status}
                      onChange={(event) =>
                        setField("status", event.target.value as "draft" | "scheduled" | "completed")
                      }
                      className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date & Time</Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={form.startDate}
                      onChange={(event) => setField("startDate", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date & Time</Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={form.endDate}
                      onChange={(event) => setField("endDate", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={form.description}
                      onChange={(event) => setField("description", event.target.value)}
                      className="min-h-24 w-full rounded-md border bg-transparent p-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/dashboard/exams")}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {!loading && (
          <Card>
            <CardHeader>
              <CardTitle>Subject Schedule</CardTitle>
              <CardDescription>
                Review the fixed subject-wise exam date and time configured during exam creation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {examSubjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects found for this exam.</p>
              ) : (
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
                      {examSubjects.map((subject) => (
                        <tr key={subject.examSubjectId} className="border-b">
                          <td className="px-3 py-2">{subject.subjectName}</td>
                          <td className="px-3 py-2">{subject.subjectCode}</td>
                          <td className="px-3 py-2">{formatDate(subject.examDate)}</td>
                          <td className="px-3 py-2">{formatTime(subject.startTime)}</td>
                          <td className="px-3 py-2">{formatTime(subject.endTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && (
          <Card>
            <CardHeader>
              <CardTitle>Enroll Newly Added Students</CardTitle>
              <CardDescription>
                Add students from this exam&apos;s class and session who are not enrolled yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search by name, roll, admission..."
                  className="w-full md:w-80"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={selectAllClassStudents}
                  disabled={availableStudents.length === 0}
                >
                  Select All Class Students
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleAllStudents}
                  disabled={filteredAvailableStudents.length === 0}
                >
                  {filteredAvailableStudents.length > 0 &&
                  filteredAvailableStudents.every((student) =>
                    selectedStudentIds.includes(student.id),
                  )
                    ? "Unselect Visible"
                    : "Select Visible"}
                </Button>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-2">
                {filteredAvailableStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No unenrolled students found for this class/session.
                  </p>
                ) : (
                  filteredAvailableStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                    >
                      <span>
                        {student.fullName} | {student.className} | {student.rollNumber}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="h-4 w-4"
                      />
                    </label>
                  ))
                )}
              </div>

              <Button
                type="button"
                onClick={enrollSelectedStudents}
                disabled={enrollingStudents || selectedStudentIds.length === 0}
              >
                {enrollingStudents ? "Enrolling..." : "Enroll Selected Students"}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && (
          <Card>
            <CardHeader>
              <CardTitle>Component Max/Min Marks</CardTitle>
              <CardDescription>
                Update component-wise max and min(pass) marks for this exam.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {componentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No component rows found for this exam.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-3 py-2 text-left">Subject</th>
                        <th className="px-3 py-2 text-left">Code</th>
                        <th className="px-3 py-2 text-left">Component</th>
                        <th className="px-3 py-2 text-left">Max Marks</th>
                        <th className="px-3 py-2 text-left">Min Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentRows.map((row, index) => (
                        <tr
                          key={`${row.examSubjectId}-${row.component}`}
                          className="border-b"
                        >
                          <td className="px-3 py-2">{row.subjectName}</td>
                          <td className="px-3 py-2">{row.subjectCode}</td>
                          <td className="px-3 py-2">{row.componentLabel}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={1}
                              value={row.maxMarks}
                              onChange={(event) =>
                                updateComponentRow(
                                  index,
                                  "maxMarks",
                                  event.target.value,
                                )
                              }
                              className="h-8"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.passMarks}
                              onChange={(event) =>
                                updateComponentRow(
                                  index,
                                  "passMarks",
                                  event.target.value,
                                )
                              }
                              className="h-8"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Button
                type="button"
                onClick={saveComponentMarks}
                disabled={savingComponentMarks || componentRows.length === 0}
              >
                {savingComponentMarks
                  ? "Saving Component Marks..."
                  : "Save Component Marks"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
