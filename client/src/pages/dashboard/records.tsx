import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudentStore, type StudentListItem } from "@/store/student.store";
import { useTeacherStore, type TeacherListItem } from "@/store/teacher.store";
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type RecordMode = "students" | "teachers";
type AcademicSessionItem = { id: string; name: string };
type StudentFieldKey =
  | "fullName"
  | "username"
  | "admissionNo"
  | "admissionDate"
  | "rollNumber"
  | "className"
  | "sessionName"
  | "fathersName"
  | "mothersName"
  | "parentPhone"
  | "parentEmail"
  | "dateOfBirth"
  | "gender"
  | "category"
  | "bloodGroup"
  | "penNo"
  | "aadharNo"
  | "aaparId"
  | "address"
  | "mobileNo";
type TeacherFieldKey =
  | "fullName"
  | "username"
  | "mobileNo"
  | "fathersName"
  | "mothersName"
  | "dateOfBirth"
  | "address"
  | "aadharCard"
  | "panCard"
  | "emailId"
  | "designation"
  | "qualification"
  | "accountNo"
  | "bankIfsc"
  | "bankName";

const STUDENT_FIELD_OPTIONS: Array<{ key: StudentFieldKey; label: string }> = [
  { key: "fullName", label: "Name" },
  { key: "username", label: "Username" },
  { key: "admissionNo", label: "Admission No" },
  { key: "admissionDate", label: "Admission Date" },
  { key: "rollNumber", label: "Roll No" },
  { key: "className", label: "Class" },
  { key: "sessionName", label: "Session" },
  { key: "fathersName", label: "Father Name" },
  { key: "mothersName", label: "Mother Name" },
  { key: "parentPhone", label: "Parent Phone" },
  { key: "parentEmail", label: "Parent Email" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "category", label: "Category" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "penNo", label: "PEN No" },
  { key: "aadharNo", label: "Aadhar No" },
  { key: "aaparId", label: "AAPAR ID" },
  { key: "address", label: "Address" },
  { key: "mobileNo", label: "Mobile No" },
];
const TEACHER_FIELD_OPTIONS: Array<{ key: TeacherFieldKey; label: string }> = [
  { key: "fullName", label: "Name" },
  { key: "username", label: "Username" },
  { key: "mobileNo", label: "Mobile No" },
  { key: "fathersName", label: "Father Name" },
  { key: "mothersName", label: "Mother Name" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "address", label: "Address" },
  { key: "aadharCard", label: "Aadhar Card" },
  { key: "panCard", label: "PAN Card" },
  { key: "emailId", label: "Email" },
  { key: "designation", label: "Designation" },
  { key: "qualification", label: "Qualification" },
  { key: "accountNo", label: "Account No" },
  { key: "bankIfsc", label: "Bank IFSC" },
  { key: "bankName", label: "Bank Name" },
];

const formatDateField = (value: unknown) => {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

const getStudentFieldValue = (student: StudentListItem, field: StudentFieldKey) => {
  switch (field) {
    case "fullName":
      return student.fullName;
    case "username":
      return student.username;
    case "admissionNo":
      return student.admissionNo ?? "-";
    case "admissionDate":
      return formatDateField(student.admissionDate);
    case "rollNumber":
      return student.rollNumber;
    case "className":
      return student.className;
    case "sessionName":
      return student.sessionName;
    case "fathersName":
      return student.fathersName;
    case "mothersName":
      return student.mothersName;
    case "parentPhone":
      return student.parentPhone ?? "-";
    case "parentEmail":
      return student.parentEmail ?? "-";
    case "dateOfBirth":
      return formatDateField(student.dateOfBirth);
    case "gender":
      return student.gender ?? "-";
    case "category":
      return student.category ?? "-";
    case "bloodGroup":
      return student.bloodGroup ?? "-";
    case "penNo":
      return student.penNo ?? "-";
    case "aadharNo":
      return student.aadharNo ?? "-";
    case "aaparId":
      return student.aaparId ?? "-";
    case "address":
      return student.address ?? "-";
    case "mobileNo":
      return student.mobileNo ?? "-";
    default:
      return "";
  }
};

const getTeacherFieldValue = (teacher: TeacherListItem, field: TeacherFieldKey) => {
  switch (field) {
    case "fullName":
      return teacher.fullName;
    case "username":
      return teacher.username;
    case "mobileNo":
      return teacher.mobileNo ?? "-";
    case "fathersName":
      return teacher.fathersName ?? "-";
    case "mothersName":
      return teacher.mothersName ?? "-";
    case "dateOfBirth":
      return formatDateField(teacher.dateOfBirth);
    case "address":
      return teacher.address ?? "-";
    case "aadharCard":
      return teacher.aadharCard ?? "-";
    case "panCard":
      return teacher.panCard ?? "-";
    case "emailId":
      return teacher.emailId ?? "-";
    case "designation":
      return teacher.designation ?? "-";
    case "qualification":
      return teacher.qualification ?? "-";
    case "accountNo":
      return teacher.accountNo ?? "-";
    case "bankIfsc":
      return teacher.bankIfsc ?? "-";
    case "bankName":
      return teacher.bankName ?? "-";
    default:
      return "";
  }
};

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

export default function RecordsPage() {
  const userRoles = useUserStore((state) => state.user?.roles ?? []);
  const isAdmin = userRoles.includes("admin");
  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    fetchStudents,
  } = useStudentStore();
  const {
    teachers,
    loading: teachersLoading,
    error: teachersError,
    fetchTeachers,
  } = useTeacherStore();

  const [mode, setMode] = useState<RecordMode>("students");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [emptyColumnsCount, setEmptyColumnsCount] = useState(0);
  const [emptyColumnNames, setEmptyColumnNames] = useState<string[]>([]);
  const [selectedStudentFields, setSelectedStudentFields] = useState<StudentFieldKey[]>(
    ["fullName", "fathersName", "admissionNo", "className"],
  );
  const [selectedTeacherFields, setSelectedTeacherFields] = useState<TeacherFieldKey[]>(
    TEACHER_FIELD_OPTIONS.map((item) => item.key),
  );

  useEffect(() => {
    void fetchStudents();
    void fetchTeachers();
  }, [fetchStudents, fetchTeachers]);

  useEffect(() => {
    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const response = await fetch("/api/academic-session/all");
        const result = (await response.json()) as {
          success?: boolean;
          data?: AcademicSessionItem[];
          error?: string;
        };
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to fetch sessions");
        }
        const rows = Array.isArray(result.data) ? result.data : [];
        setSessions(rows);
        if (!selectedSessionId && rows.length > 0) {
          setSelectedSessionId(rows[0].id);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch sessions");
      } finally {
        setLoadingSessions(false);
      }
    };

    void loadSessions();
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [mode, selectedSessionId]);

  useEffect(() => {
    setClassFilter("");
  }, [selectedSessionId]);

  useEffect(() => {
    setEmptyColumnNames((prev) => {
      if (emptyColumnsCount <= 0) return [];
      const next = Array.from({ length: emptyColumnsCount }, (_, index) =>
        prev[index] ?? `Empty Column ${index + 1}`,
      );
      return next;
    });
  }, [emptyColumnsCount]);

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((student) => !selectedSessionId || student.sessionId === selectedSessionId)
            .map((student) => (student.className ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [selectedSessionId, students],
  );

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!selectedSessionId) return [];

    return students.filter((student) => {
      const searchableText = [
        student.fullName,
        student.username,
        student.admissionNo,
        student.rollNumber,
        student.className,
        student.fathersName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = query ? searchableText.includes(query) : true;
      const matchesClass = classFilter ? student.className === classFilter : true;
      const matchesSession = student.sessionId === selectedSessionId;
      return matchesSearch && matchesClass && matchesSession;
    });
  }, [classFilter, search, selectedSessionId, students]);

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const searchableText = [
        teacher.fullName,
        teacher.username,
        teacher.mobileNo,
        teacher.designation,
        teacher.qualification,
        teacher.emailId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return query ? searchableText.includes(query) : true;
    });
  }, [search, teachers]);

  const filteredRows = mode === "students" ? filteredStudents : filteredTeachers;
  const dynamicEmptyColumns = useMemo(
    () =>
      Array.from({ length: emptyColumnsCount }, (_, index) => {
        const label = emptyColumnNames[index]?.trim();
        return label || `Empty Column ${index + 1}`;
      }),
    [emptyColumnNames, emptyColumnsCount],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(() => {
    if (mode === "students") {
      return students.filter((item) => selectedSet.has(item.id));
    }
    return teachers.filter((item) => selectedSet.has(item.id));
  }, [mode, selectedSet, students, teachers]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedSet.has(row.id));
  const loading = mode === "students" ? studentsLoading : teachersLoading;
  const error = mode === "students" ? studentsError : teachersError;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredRows.map((row) => row.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...filteredRows.map((row) => row.id)])]);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const toggleStudentField = (field: StudentFieldKey) => {
    setSelectedStudentFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== field);
      }
      return [...prev, field];
    });
  };

  const toggleTeacherField = (field: TeacherFieldKey) => {
    setSelectedTeacherFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== field);
      }
      return [...prev, field];
    });
  };

  const updateEmptyColumnName = (index: number, value: string) => {
    setEmptyColumnNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const downloadSelected = () => {
    if (mode === "students" && !selectedSessionId) {
      toast.error("Please select a session");
      return;
    }
    if (selectedRows.length === 0) {
      toast.error("Select at least one row before download");
      return;
    }

    const isStudentMode = mode === "students";
    const selectedFieldOptions = isStudentMode
      ? STUDENT_FIELD_OPTIONS.filter((field) => selectedStudentFields.includes(field.key))
      : TEACHER_FIELD_OPTIONS.filter((field) => selectedTeacherFields.includes(field.key));
    const headers = selectedFieldOptions.map((field) => field.label);
    const allHeaders = [...headers, ...dynamicEmptyColumns];

    const lines = [
      allHeaders.map((item) => escapeCsv(item)).join(","),
      ...selectedRows.map((row) => {
        if (isStudentMode) {
          const student = row as StudentListItem;
          return [
            ...(selectedFieldOptions as Array<{ key: StudentFieldKey; label: string }>).map((field) =>
              getStudentFieldValue(student, field.key),
            ),
            ...Array.from({ length: emptyColumnsCount }, () => ""),
          ]
            .map((item) => escapeCsv(item))
            .join(",");
        }

        const teacher = row as TeacherListItem;
        return [
          ...(selectedFieldOptions as Array<{ key: TeacherFieldKey; label: string }>).map((field) =>
            getTeacherFieldValue(teacher, field.key),
          ),
          ...Array.from({ length: emptyColumnsCount }, () => ""),
        ]
          .map((item) => escapeCsv(item))
          .join(",");
      }),
    ];

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.setAttribute("download", `${mode}-records-selected.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  };

  const printSelected = () => {
    if (mode === "students" && !selectedSessionId) {
      toast.error("Please select a session");
      return;
    }
    if (selectedRows.length === 0) {
      toast.error("Select at least one row before print");
      return;
    }

    const isStudentMode = mode === "students";
    const selectedFieldOptions = isStudentMode
      ? STUDENT_FIELD_OPTIONS.filter((field) => selectedStudentFields.includes(field.key))
      : TEACHER_FIELD_OPTIONS.filter((field) => selectedTeacherFields.includes(field.key));
    const headers = selectedFieldOptions.map((field) => field.label);
    const allHeaders = [...headers, ...dynamicEmptyColumns];

    const bodyRows = selectedRows
      .map((row) => {
        if (isStudentMode) {
          const student = row as StudentListItem;
          const values = [
            ...(selectedFieldOptions as Array<{ key: StudentFieldKey; label: string }>).map((field) =>
              getStudentFieldValue(student, field.key),
            ),
            ...Array.from({ length: emptyColumnsCount }, () => ""),
          ];
          return `<tr>${values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
        }

        const teacher = row as TeacherListItem;
        const values = [
          ...(selectedFieldOptions as Array<{ key: TeacherFieldKey; label: string }>).map((field) =>
            getTeacherFieldValue(teacher, field.key),
          ),
          ...Array.from({ length: emptyColumnsCount }, () => ""),
        ];
        return `<tr>${values.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`;
      })
      .join("");

    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) {
      toast.error("Could not open print window");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>${mode === "students" ? "Student Records" : "Teacher Records"} - Selected</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 6px 0; font-size: 20px; }
            p { margin: 0 0 12px 0; color: #4b5563; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>${mode === "students" ? "Student Records" : "Teacher Records"} (Selected)</h1>
          <p>Total selected: ${selectedRows.length}</p>
          <table>
            <thead>
              <tr>${allHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <DashboardLayout title="Records">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Student & Teacher Records</h1>
          <Button onClick={() => { void fetchStudents(); void fetchTeachers(); }} disabled={studentsLoading || teachersLoading}>
            {studentsLoading || teachersLoading ? "Loading..." : "Refresh Data"}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>Filters & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="record-mode">Data Type</Label>
                <select
                  id="record-mode"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={mode}
                  onChange={(event) => {
                    const value = event.target.value as RecordMode;
                    setMode(value);
                    if (value === "teachers") setClassFilter("");
                  }}
                >
                  <option value="students">Students</option>
                  <option value="teachers">Teachers</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="records-search">Search</Label>
                <Input
                  id="records-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={mode === "students" ? "Search students..." : "Search teachers..."}
                  className="h-9 w-64"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="records-session">Session</Label>
                <select
                  id="records-session"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm min-w-44"
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  disabled={loadingSessions || mode !== "students"}
                >
                  <option value="">{loadingSessions ? "Loading sessions..." : "Select session"}</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="records-class">Class</Label>
                <select
                  id="records-class"
                  className="h-9 rounded-md border bg-transparent px-3 text-sm min-w-36"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  disabled={mode !== "students"}
                >
                  <option value="">All Classes</option>
                  {classOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div className="space-y-1">
                  <Label htmlFor="empty-columns">Empty Columns</Label>
                  <Input
                    id="empty-columns"
                    type="number"
                    min="0"
                    max="6"
                    value={emptyColumnsCount}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      const next = Number.isFinite(raw) ? Math.max(0, Math.min(6, raw)) : 0;
                      setEmptyColumnsCount(next);
                    }}
                    className="h-9 w-28"
                  />
                </div>
              )}
            </div>

            {isAdmin && emptyColumnsCount > 0 && (
              <div className="space-y-1">
                <Label>Empty Column Names</Label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: emptyColumnsCount }, (_, index) => (
                    <Input
                      key={`empty-col-name-${index + 1}`}
                      value={emptyColumnNames[index] ?? ""}
                      onChange={(event) => updateEmptyColumnName(index, event.target.value)}
                      placeholder={`Empty Column ${index + 1}`}
                      className="h-9"
                    />
                  ))}
                </div>
              </div>
            )}

            {(mode === "students" || mode === "teachers") && (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>{mode === "students" ? "Student Data Columns" : "Teacher Data Columns"}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        mode === "students"
                          ? setSelectedStudentFields(STUDENT_FIELD_OPTIONS.map((item) => item.key))
                          : setSelectedTeacherFields(TEACHER_FIELD_OPTIONS.map((item) => item.key))
                      }
                    >
                      Show All Fields
                    </Button>
                  </div>
                </div>
                <div className="flex w-full flex-wrap gap-3 rounded-md border p-2">
                  {mode === "students"
                    ? STUDENT_FIELD_OPTIONS.map((field) => (
                        <label key={field.key} className="flex items-center gap-2 text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedStudentFields.includes(field.key)}
                            onChange={() => toggleStudentField(field.key)}
                          />
                          {field.label}
                        </label>
                      ))
                    : TEACHER_FIELD_OPTIONS.map((field) => (
                        <label key={field.key} className="flex items-center gap-2 text-sm whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedTeacherFields.includes(field.key)}
                            onChange={() => toggleTeacherField(field.key)}
                          />
                          {field.label}
                        </label>
                      ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={toggleSelectAllFiltered} disabled={filteredRows.length === 0}>
                {allFilteredSelected ? "Unselect Visible" : "Select Visible"}
              </Button>
              <Button type="button" variant="outline" onClick={clearSelection} disabled={selectedIds.length === 0}>
                Clear Selection
              </Button>
              <Button type="button" variant="outline" onClick={printSelected}>
                Print Selected
              </Button>
              <Button type="button" onClick={downloadSelected}>
                Download Selected
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Showing {filteredRows.length} rows | Selected {selectedRows.length} rows
            </p>
            {mode === "students" && !selectedSessionId && (
              <p className="text-sm text-amber-600">Select a session to view student records.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{mode === "students" ? "Student Records" : "Teacher Records"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  {mode === "students" ? (
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          aria-label="Select all visible students"
                        />
                      </TableHead>
                      {STUDENT_FIELD_OPTIONS.filter((field) =>
                        selectedStudentFields.includes(field.key),
                      ).map((field) => (
                        <TableHead key={`stu-col-head-${field.key}`}>{field.label}</TableHead>
                      ))}
                      {dynamicEmptyColumns.map((col) => (
                        <TableHead key={`th-stu-${col}`}>{col}</TableHead>
                      ))}
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          aria-label="Select all visible teachers"
                        />
                      </TableHead>
                      {TEACHER_FIELD_OPTIONS.filter((field) =>
                        selectedTeacherFields.includes(field.key),
                      ).map((field) => (
                        <TableHead key={`tea-col-head-${field.key}`}>{field.label}</TableHead>
                      ))}
                      {dynamicEmptyColumns.map((col) => (
                        <TableHead key={`th-tea-${col}`}>{col}</TableHead>
                      ))}
                    </TableRow>
                  )}
                </TableHeader>
                <TableBody>
                  {!loading && filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          (mode === "students"
                            ? selectedStudentFields.length + 1
                            : selectedTeacherFields.length + 1) +
                          dynamicEmptyColumns.length
                        }
                        className="text-center text-sm text-muted-foreground"
                      >
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : mode === "students" ? (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(student.id)}
                            onChange={() => toggleSelection(student.id)}
                            aria-label={`Select ${student.fullName}`}
                          />
                        </TableCell>
                        {STUDENT_FIELD_OPTIONS.filter((field) =>
                          selectedStudentFields.includes(field.key),
                        ).map((field) => (
                          <TableCell key={`stu-cell-${student.id}-${field.key}`}>
                            {getStudentFieldValue(student, field.key)}
                          </TableCell>
                        ))}
                        {dynamicEmptyColumns.map((col) => (
                          <TableCell key={`stu-empty-${student.id}-${col}`}></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(teacher.id)}
                            onChange={() => toggleSelection(teacher.id)}
                            aria-label={`Select ${teacher.fullName}`}
                          />
                        </TableCell>
                        {TEACHER_FIELD_OPTIONS.filter((field) =>
                          selectedTeacherFields.includes(field.key),
                        ).map((field) => (
                          <TableCell key={`tea-cell-${teacher.id}-${field.key}`}>
                            {getTeacherFieldValue(teacher, field.key)}
                          </TableCell>
                        ))}
                        {dynamicEmptyColumns.map((col) => (
                          <TableCell key={`tea-empty-${teacher.id}-${col}`}></TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
