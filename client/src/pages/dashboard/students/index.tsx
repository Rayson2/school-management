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
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

type StudentDocument = {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: string | null;
  documentType: string;
  uploadedAt: string | Date | null;
  updatedAt: string | Date | null;
};
type AcademicSessionItem = { id: string; name: string };

type StudentEditForm = {
  fullName: string;
  rollNumber: string;
  enrollmentNo: string;
  admissionNo: string;
  admissionDate: string;
  sessionName: string;
  className: string;
  gender: string;
  category: string;
  dateOfBirth: string;
  fathersName: string;
  mothersName: string;
  mobileNo: string;
  address: string;
  parentPhone: string;
  aaparId: string;
  aadharNo: string;
  parentEmail: string;
  bloodGroup: string;
  penNo: string;
};

const requiredFields: Array<keyof StudentEditForm> = [
  "fullName",
  "admissionNo",
  "admissionDate",
  "sessionName",
  "className",
  "gender",
  "category",
  "dateOfBirth",
  "fathersName",
  "mothersName",
];

const editFields: Array<{
  key: keyof StudentEditForm;
  label: string;
  type?: "text" | "date" | "email" | "password";
  required?: boolean;
}> = [
  { key: "fullName", label: "Full Name", required: true },
  { key: "rollNumber", label: "Roll Number (Optional)" },
  { key: "enrollmentNo", label: "Enrollment No" },
  { key: "admissionNo", label: "AdminNumber", required: true },
  { key: "admissionDate", label: "Admission Date", type: "date", required: true },
  { key: "sessionName", label: "Session", required: true },
  { key: "className", label: "Class", required: true },
  { key: "gender", label: "Gender", required: true },
  { key: "category", label: "Category", required: true },
  { key: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
  { key: "fathersName", label: "Father Name", required: true },
  { key: "mothersName", label: "Mother Name", required: true },
  { key: "parentPhone", label: "Parent Phone" },
  { key: "parentEmail", label: "Parent Email", type: "email" },
  { key: "mobileNo", label: "Mobile No" },
  { key: "address", label: "Address" },
  { key: "aadharNo", label: "Aadhar No" },
  { key: "aaparId", label: "AAPAR ID" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "penNo", label: "PEN No" },
];

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "N/A";

const toInputDate = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toEditForm = (student: StudentListItem): StudentEditForm => ({
  fullName: student.fullName ?? "",
  rollNumber: student.rollNumber ?? "",
  enrollmentNo: student.enrollmentNo ?? "",
  admissionNo: student.admissionNo ?? "",
  admissionDate: toInputDate(student.admissionDate),
  sessionName: student.sessionName ?? "",
  className: student.className ?? "",
  gender: student.gender ?? "",
  category: student.category ?? "",
  dateOfBirth: toInputDate(student.dateOfBirth),
  fathersName: student.fathersName ?? "",
  mothersName: student.mothersName ?? "",
  mobileNo: student.mobileNo ?? "",
  address: student.address ?? "",
  parentPhone: student.parentPhone ?? "",
  aaparId: student.aaparId ?? "",
  aadharNo: student.aadharNo ?? "",
  parentEmail: student.parentEmail ?? "",
  bloodGroup: student.bloodGroup ?? "",
  penNo: student.penNo ?? "",
});

export default function StudentsPage() {
  const { students, loading, error, fetchStudents } = useStudentStore();
  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [admissionDateFrom, setAdmissionDateFrom] = useState("");
  const [admissionDateTo, setAdmissionDateTo] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<StudentEditForm | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [documentsByStudent, setDocumentsByStudent] = useState<
    Record<string, StudentDocument[]>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [editDocumentType, setEditDocumentType] = useState("");
  const [editUploadFiles, setEditUploadFiles] = useState<File[]>([]);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [editProfilePicFile, setEditProfilePicFile] = useState<File | null>(null);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState("");

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );
  const classOptions = useMemo(
    () =>
      Array.from(
        new Set(students.map((student) => (student.className ?? "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const genderOptions = useMemo(
    () =>
      Array.from(
        new Set(students.map((student) => (student.gender ?? "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(students.map((student) => (student.category ?? "").trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const fromTime = admissionDateFrom ? new Date(admissionDateFrom).getTime() : null;
    const toTime = admissionDateTo ? new Date(admissionDateTo).getTime() : null;

    return students.filter((student) => {
      const studentAdmissionTime = student.admissionDate
        ? new Date(student.admissionDate).getTime()
        : null;
      const searchableText = [
        student.fullName,
        student.username,
        student.rollNumber,
        student.admissionNo,
        student.fathersName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = query ? searchableText.includes(query) : true;
      const matchesClass = classFilter ? student.className === classFilter : true;
      const matchesGender = genderFilter ? student.gender === genderFilter : true;
      const matchesCategory = categoryFilter ? student.category === categoryFilter : true;
      const matchesFrom =
        fromTime !== null
          ? studentAdmissionTime !== null && studentAdmissionTime >= fromTime
          : true;
      const matchesTo =
        toTime !== null
          ? studentAdmissionTime !== null && studentAdmissionTime <= toTime
          : true;

      return (
        matchesSearch &&
        matchesClass &&
        matchesGender &&
        matchesCategory &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    admissionDateFrom,
    admissionDateTo,
    categoryFilter,
    classFilter,
    genderFilter,
    searchQuery,
    students,
  ]);

  const selectedStudentDocuments = selectedStudentId
    ? documentsByStudent[selectedStudentId] ?? []
    : [];

  const editingStudentDocuments = editingStudentId
    ? documentsByStudent[editingStudentId] ?? []
    : [];

  const groupedSelectedDocuments = useMemo(() => {
    return selectedStudentDocuments.reduce<Record<string, StudentDocument[]>>(
      (acc, doc) => {
        const key = doc.documentType || "general";
        if (!acc[key]) acc[key] = [];
        acc[key].push(doc);
        return acc;
      },
      {},
    );
  }, [selectedStudentDocuments]);

  const groupedEditingDocuments = useMemo(() => {
    return editingStudentDocuments.reduce<Record<string, StudentDocument[]>>(
      (acc, doc) => {
        const key = doc.documentType || "general";
        if (!acc[key]) acc[key] = [];
        acc[key].push(doc);
        return acc;
      },
      {},
    );
  }, [editingStudentDocuments]);

  useEffect(() => {
    fetch("/api/academic-session/all")
      .then(async (response) => {
        const result = (await response.json()) as Record<string, unknown>;
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
      });
  }, []);

  useEffect(() => {
    void fetchStudents(selectedSessionId || undefined);
  }, [fetchStudents, selectedSessionId]);

  const fetchStudentDocuments = async (studentId: string) => {
    try {
      const response = await fetch(`/api/student/${studentId}/documents`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch documents");
      }

      setDocumentsByStudent((prev) => ({
        ...prev,
        [studentId]: Array.isArray(result.data) ? result.data : [],
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch documents");
    }
  };

  const updateEditField =
    (field: keyof StudentEditForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setEditForm((previous) =>
        previous
          ? {
              ...previous,
              [field]: event.target.value,
            }
          : previous,
      );
    };

  const handleViewProfile = (studentId: string) => {
    setEditingStudentId(null);
    setEditForm(null);
    setSelectedStudentId(studentId);
    setActionError(null);
    fetchStudentDocuments(studentId);
  };

  const handleStartEdit = (student: StudentListItem) => {
    setSelectedStudentId(null);
    setEditingStudentId(student.id);
    setEditForm(toEditForm(student));
    setEditDocumentType("");
    setEditUploadFiles([]);
    setEditProfilePicFile(null);
    setEditNewPassword("");
    setActionError(null);
    fetchStudentDocuments(student.id);
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setEditForm(null);
    setEditDocumentType("");
    setEditUploadFiles([]);
    setEditProfilePicFile(null);
    setEditNewPassword("");
  };
  const resetFilters = () => {
    setSearchQuery("");
    setClassFilter("");
    setGenderFilter("");
    setCategoryFilter("");
    setAdmissionDateFrom("");
    setAdmissionDateTo("");
  };

  const handleDelete = async (student: StudentListItem) => {
    setDeletingId(student.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/student/${student.id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete student");
      }

      if (selectedStudentId === student.id) {
        setSelectedStudentId(null);
      }
      if (editingStudentId === student.id) {
        handleCancelEdit();
      }
      setDeleteStudent(null);
      await fetchStudents(selectedSessionId || undefined);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete student");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteDocument = async (studentId: string, documentId: string) => {
    setDeletingDocumentId(documentId);
    setActionError(null);

    try {
      const response = await fetch(`/api/student/${studentId}/documents/${documentId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete document");
      }

      await fetchStudentDocuments(studentId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleUploadEditDocuments = async () => {
    if (!editingStudentId) return;
    if (editUploadFiles.length === 0) {
      setActionError("Please select at least one file to upload");
      return;
    }

    setUploadingDocuments(true);
    setActionError(null);

    try {
      const formData = new FormData();
      editUploadFiles.forEach((file) => formData.append("files", file));
      if (editDocumentType.trim()) {
        formData.append("documentType", editDocumentType.trim());
      }

      const response = await fetch(`/api/student/${editingStudentId}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload documents");
      }

      setEditUploadFiles([]);
      setEditDocumentType("");
      await fetchStudentDocuments(editingStudentId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload documents");
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleUploadProfilePic = async () => {
    if (!editingStudentId || !editProfilePicFile) {
      setActionError("Please select a profile picture file");
      return;
    }

    setUploadingProfilePic(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", editProfilePicFile);

      const response = await fetch(`/api/student/${editingStudentId}/profile-pic`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload profile picture");
      }

      setEditProfilePicFile(null);
      await fetchStudents(selectedSessionId || undefined);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to upload profile picture",
      );
    } finally {
      setUploadingProfilePic(false);
    }
  };

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingStudentId || !editForm) return;

    for (const field of requiredFields) {
      if (!editForm[field].trim()) {
        setActionError(`${field} is required`);
        return;
      }
    }

    setSaving(true);
    setActionError(null);

    try {
      const payload = {
        fullName: editForm.fullName.trim(),
        rollNumber: editForm.rollNumber.trim(),
        enrollmentNo: editForm.enrollmentNo.trim() || undefined,
        admissionNo: editForm.admissionNo.trim(),
        admissionDate: editForm.admissionDate,
        sessionName: editForm.sessionName.trim(),
        className: editForm.className.trim(),
        gender: editForm.gender.trim(),
        category: editForm.category.trim(),
        dateOfBirth: editForm.dateOfBirth,
        fathersName: editForm.fathersName.trim(),
        mothersName: editForm.mothersName.trim(),
        mobileNo: editForm.mobileNo.trim() || undefined,
        address: editForm.address.trim() || undefined,
        parentPhone: editForm.parentPhone.trim() || undefined,
        aaparId: editForm.aaparId.trim() || undefined,
        aadharNo: editForm.aadharNo.trim() || undefined,
        parentEmail: editForm.parentEmail.trim() || undefined,
        bloodGroup: editForm.bloodGroup.trim() || undefined,
        penNo: editForm.penNo.trim() || undefined,
      };

      const response = await fetch(`/api/student/${editingStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update student");
      }

      if (editNewPassword.trim()) {
        const passwordResponse = await fetch(
          `/api/student/${editingStudentId}/change-password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: editNewPassword.trim() }),
          },
        );
        const passwordResult = await passwordResponse.json();

        if (!passwordResponse.ok || !passwordResult.success) {
          throw new Error(passwordResult.error || "Failed to change student password");
        }
      }

      await fetchStudents(selectedSessionId || undefined);
      setSelectedStudentId(editingStudentId);
      handleCancelEdit();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Students">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">List of Students</h1>
          <Button onClick={() => fetchStudents(selectedSessionId || undefined)} disabled={loading}>
            {loading ? "Loading..." : "Reload Data"}
          </Button>
        </div>

        {loading && <p>Loading students...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {actionError && <p className="text-red-500">{actionError}</p>}

        {!loading && !error && (
          <div className="space-y-4">
            <div className="rounded-md border w-full max-w-5xl mx-auto p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="student-search" className="sr-only">
                  Search
                </Label>
                <Input
                  id="student-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search students..."
                  className="h-8 w-full md:w-64"
                />
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-40"
                >
                  <option value="">All Sessions</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>

                <Label htmlFor="class-filter" className="sr-only">
                  Class
                </Label>
                <select
                  id="class-filter"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-28"
                >
                  <option value="">All Classes</option>
                  {classOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <Label htmlFor="gender-filter" className="sr-only">
                  Gender
                </Label>
                <select
                  id="gender-filter"
                  value={genderFilter}
                  onChange={(event) => setGenderFilter(event.target.value)}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-28"
                >
                  <option value="">All Genders</option>
                  {genderOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <Label htmlFor="category-filter" className="sr-only">
                  Category
                </Label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-32"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>

                <Label htmlFor="admission-from" className="sr-only">
                  Admission Date From
                </Label>
                <Input
                  id="admission-from"
                  type="date"
                  value={admissionDateFrom}
                  onChange={(event) => setAdmissionDateFrom(event.target.value)}
                  className="h-8 w-36 text-xs"
                />

                <Label htmlFor="admission-to" className="sr-only">
                  Admission Date To
                </Label>
                <Input
                  id="admission-to"
                  type="date"
                  value={admissionDateTo}
                  onChange={(event) => setAdmissionDateTo(event.target.value)}
                  className="h-8 w-36 text-xs"
                />

                <Button type="button" variant="outline" onClick={resetFilters} className="h-8">
                  Clear
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Showing {filteredStudents.length} of {students.length} students
              </p>
            </div>

            <div className="rounded-md border w-full max-w-5xl mx-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">AdminNumber</TableHead>
                    <TableHead className="whitespace-nowrap">Enrollment No</TableHead>
                    <TableHead className="whitespace-nowrap">Father Name</TableHead>
                    <TableHead className="whitespace-nowrap">Admission Date</TableHead>
                    <TableHead className="whitespace-nowrap">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {student.fullName}
                        </TableCell>
                        <TableCell>{student.admissionNo ?? "N/A"}</TableCell>
                        <TableCell>{student.enrollmentNo ?? "N/A"}</TableCell>
                        <TableCell>{student.fathersName}</TableCell>
                        <TableCell>{formatDate(student.admissionDate)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewProfile(student.id)}
                            >
                              View Profile
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              onClick={() => handleStartEdit(student)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deletingId === student.id}
                              onClick={() => setDeleteStudent(student)}
                            >
                              {deletingId === student.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No students match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {selectedStudent && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Student Profile</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setSelectedStudentId(null)}
                >
                  Close
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm wrap-break-words">
                <p className="wrap-break-words">
                  <strong>Name:</strong> {selectedStudent.fullName}
                </p>
                <p>
                  <strong>Profile Photo:</strong>{" "}
                  {selectedStudent.avatarUrl ? (
                    <a
                      href={selectedStudent.avatarUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      View
                    </a>
                  ) : (
                    "N/A"
                  )}
                </p>
                <p>
                  <strong>Username:</strong> {selectedStudent.username}
                </p>
                <p>
                  <strong>Enrollment No:</strong> {selectedStudent.enrollmentNo ?? "N/A"}
                </p>
                <p>
                  <strong>Roll Number:</strong> {selectedStudent.rollNumber || "N/A"}
                </p>
                <p>
                  <strong>AdminNumber:</strong> {selectedStudent.admissionNo ?? "N/A"}
                </p>
                <p>
                  <strong>Admission Date:</strong> {formatDate(selectedStudent.admissionDate)}
                </p>
                <p>
                  <strong>Class:</strong> {selectedStudent.className}
                </p>
                <p>
                  <strong>Session:</strong> {selectedStudent.sessionName}
                </p>
                <p>
                  <strong>Father Name:</strong> {selectedStudent.fathersName}
                </p>
                <p>
                  <strong>Mother Name:</strong> {selectedStudent.mothersName}
                </p>
                <p>
                  <strong>Date of Birth:</strong> {formatDate(selectedStudent.dateOfBirth)}
                </p>
                <p>
                  <strong>Gender:</strong> {selectedStudent.gender}
                </p>
                <p>
                  <strong>Category:</strong> {selectedStudent.category}
                </p>
                <p>
                  <strong>Parent Phone:</strong> {selectedStudent.parentPhone ?? "N/A"}
                </p>
                <p>
                  <strong>Parent Email:</strong> {selectedStudent.parentEmail ?? "N/A"}
                </p>
                <p>
                  <strong>Mobile No:</strong> {selectedStudent.mobileNo ?? "N/A"}
                </p>
                <p>
                  <strong>Address:</strong> {selectedStudent.address ?? "N/A"}
                </p>
                <p>
                  <strong>Aadhar No:</strong> {selectedStudent.aadharNo ?? "N/A"}
                </p>
                <p>
                  <strong>AAPAR ID:</strong> {selectedStudent.aaparId ?? "N/A"}
                </p>
                <p>
                  <strong>Blood Group:</strong> {selectedStudent.bloodGroup ?? "N/A"}
                </p>
                <p>
                  <strong>PEN No:</strong> {selectedStudent.penNo ?? "N/A"}
                </p>
              </CardContent>
              <CardContent className="space-y-3 pt-0">
                <h3 className="font-semibold">Documents</h3>
                {Object.keys(groupedSelectedDocuments).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  Object.entries(groupedSelectedDocuments).map(([group, docs]) => (
                    <div key={group} className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium capitalize">{group.replace(/_/g, " ")}</p>
                      <ul className="space-y-1 text-sm">
                        {docs.map((doc) => (
                          <li key={doc.id}>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline break-all"
                            >
                              {doc.fileName}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {editingStudentId && editForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Edit Student</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleCancelEdit}
                >
                  Close
                </Button>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSaveEdit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {editFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>
                          {field.label}
                          {field.required ? " *" : ""}
                        </Label>
                        <Input
                          id={field.key}
                          type={field.type ?? "text"}
                          value={editForm[field.key]}
                          required={field.required}
                          onChange={updateEditField(field.key)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
                <div className="space-y-3 pt-4">
                  <h3 className="font-semibold">Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-new-password">New Password (Optional)</Label>
                      <Input
                        id="edit-new-password"
                        type="password"
                        value={editNewPassword}
                        onChange={(event) => setEditNewPassword(event.target.value)}
                        placeholder="Leave blank to keep current password"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3 pt-4">
                  <h3 className="font-semibold">Profile Picture</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-profile-pic">Upload Profile Picture</Label>
                      <Input
                        id="edit-profile-pic"
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          setEditProfilePicFile(event.target.files?.[0] ?? null)
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleUploadProfilePic}
                    disabled={uploadingProfilePic || !editProfilePicFile}
                  >
                    {uploadingProfilePic ? "Uploading..." : "Upload Profile Picture"}
                  </Button>
                </div>
                <div className="space-y-3 pt-4">
                  <h3 className="font-semibold">Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-document-type">Document Type (Optional)</Label>
                      <Input
                        id="edit-document-type"
                        value={editDocumentType}
                        onChange={(event) => setEditDocumentType(event.target.value)}
                        placeholder="e.g. id-proof, marksheet"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edit-documents">Upload Documents</Label>
                      <Input
                        id="edit-documents"
                        type="file"
                        multiple
                        onChange={(event) =>
                          setEditUploadFiles(Array.from(event.target.files ?? []))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      onClick={handleUploadEditDocuments}
                      disabled={uploadingDocuments || editUploadFiles.length === 0}
                    >
                      {uploadingDocuments
                        ? "Uploading..."
                        : `Upload ${editUploadFiles.length} Document${
                            editUploadFiles.length === 1 ? "" : "s"
                          }`}
                    </Button>
                  </div>
                  {Object.keys(groupedEditingDocuments).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  ) : (
                    Object.entries(groupedEditingDocuments).map(([group, docs]) => (
                      <div key={group} className="rounded-md border p-3 space-y-2">
                        <p className="text-sm font-medium capitalize">
                          {group.replace(/_/g, " ")}
                        </p>
                        <div className="space-y-2">
                          {docs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                            >
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline break-all text-sm"
                              >
                                {doc.fileName}
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={deletingDocumentId === doc.id}
                                onClick={() =>
                                  editingStudentId &&
                                  handleDeleteDocument(editingStudentId, doc.id)
                                }
                              >
                                {deletingDocumentId === doc.id ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {deleteStudent && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Delete Student</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete {deleteStudent.fullName} (
                  {deleteStudent.admissionNo ?? "No AdminNumber"})?
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deletingId === deleteStudent.id}
                    onClick={() => setDeleteStudent(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingId === deleteStudent.id}
                    onClick={() => handleDelete(deleteStudent)}
                  >
                    {deletingId === deleteStudent.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
