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
import { useTeacherStore, type TeacherListItem } from "@/store/teacher.store";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

const TEACHERS_CACHE_KEY = "teachers_cache_v1";

type TeacherDocument = {
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

type TeacherEditForm = {
  fullName: string;
  mobileNo: string;
  password: string;
  fathersName: string;
  mothersName: string;
  dateOfBirth: string;
  address: string;
  aadharCard: string;
  panCard: string;
  emailId: string;
  designation: string;
  qualification: string;
  accountNo: string;
  bankIfsc: string;
  bankName: string;
};

const requiredFields: Array<keyof TeacherEditForm> = [
  "fullName",
  "mobileNo",
  "fathersName",
  "mothersName",
  "dateOfBirth",
  "address",
  "aadharCard",
  "panCard",
  "emailId",
  "designation",
  "qualification",
  "accountNo",
  "bankIfsc",
  "bankName",
];

const editFields: Array<{
  key: keyof TeacherEditForm;
  label: string;
  type?: "text" | "date" | "email" | "password";
  required?: boolean;
}> = [
  { key: "fullName", label: "Name", required: true },
  { key: "mobileNo", label: "Mobile Number", required: true },
  { key: "password", label: "New Password (Optional)", type: "password" },
  { key: "fathersName", label: "Father Name", required: true },
  { key: "mothersName", label: "Mother Name", required: true },
  { key: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
  { key: "address", label: "Full Address", required: true },
  { key: "aadharCard", label: "Aadhar Card", required: true },
  { key: "panCard", label: "PAN Card", required: true },
  { key: "emailId", label: "Email ID", type: "email", required: true },
  { key: "designation", label: "Designation", required: true },
  { key: "qualification", label: "Qualification", required: true },
  { key: "accountNo", label: "Account Number", required: true },
  { key: "bankIfsc", label: "Bank IFSC", required: true },
  { key: "bankName", label: "Bank Name", required: true },
];

const formatDate = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "N/A";

const toInputDate = (value: string | Date | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toEditForm = (teacher: TeacherListItem): TeacherEditForm => ({
  fullName: teacher.fullName ?? "",
  mobileNo: teacher.mobileNo ?? "",
  password: "",
  fathersName: teacher.fathersName ?? "",
  mothersName: teacher.mothersName ?? "",
  dateOfBirth: toInputDate(teacher.dateOfBirth),
  address: teacher.address ?? "",
  aadharCard: teacher.aadharCard ?? "",
  panCard: teacher.panCard ?? "",
  emailId: teacher.emailId ?? "",
  designation: teacher.designation ?? "",
  qualification: teacher.qualification ?? "",
  accountNo: teacher.accountNo ?? "",
  bankIfsc: teacher.bankIfsc ?? "",
  bankName: teacher.bankName ?? "",
});

export default function TeachersPage() {
  const { teachers, loading, error, fetchTeachers } = useTeacherStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TeacherEditForm | null>(null);
  const [deleteTeacher, setDeleteTeacher] = useState<TeacherListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [documentsByTeacher, setDocumentsByTeacher] = useState<
    Record<string, TeacherDocument[]>
  >({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [editDocumentType, setEditDocumentType] = useState("");
  const [editUploadFiles, setEditUploadFiles] = useState<File[]>([]);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [editProfilePicFile, setEditProfilePicFile] = useState<File | null>(null);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === selectedTeacherId) ?? null,
    [teachers, selectedTeacherId],
  );
  const designationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          teachers
            .map((teacher) => (teacher.designation ?? "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [teachers],
  );
  const filteredTeachers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const searchableText = [
        teacher.fullName,
        teacher.username,
        teacher.mobileNo,
        teacher.fathersName,
        teacher.designation,
        teacher.qualification,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = query ? searchableText.includes(query) : true;
      const matchesDesignation = designationFilter
        ? teacher.designation === designationFilter
        : true;
      return matchesSearch && matchesDesignation;
    });
  }, [designationFilter, searchQuery, teachers]);

  const selectedTeacherDocuments = selectedTeacherId
    ? documentsByTeacher[selectedTeacherId] ?? []
    : [];
  const editingTeacherDocuments = editingTeacherId
    ? documentsByTeacher[editingTeacherId] ?? []
    : [];

  const groupedSelectedDocuments = useMemo(() => {
    return selectedTeacherDocuments.reduce<Record<string, TeacherDocument[]>>(
      (acc, doc) => {
        const key = doc.documentType || "general";
        if (!acc[key]) acc[key] = [];
        acc[key].push(doc);
        return acc;
      },
      {},
    );
  }, [selectedTeacherDocuments]);

  const groupedEditingDocuments = useMemo(() => {
    return editingTeacherDocuments.reduce<Record<string, TeacherDocument[]>>(
      (acc, doc) => {
        const key = doc.documentType || "general";
        if (!acc[key]) acc[key] = [];
        acc[key].push(doc);
        return acc;
      },
      {},
    );
  }, [editingTeacherDocuments]);

  useEffect(() => {
    const cachedTeachers = localStorage.getItem(TEACHERS_CACHE_KEY);
    if (cachedTeachers) {
      try {
        const parsedTeachers = JSON.parse(cachedTeachers);
        if (Array.isArray(parsedTeachers)) {
          useTeacherStore.setState({
            teachers: parsedTeachers,
            loading: false,
          });
        }
      } catch {
        localStorage.removeItem(TEACHERS_CACHE_KEY);
      }
    }
    fetchTeachers();
  }, [fetchTeachers]);

  useEffect(() => {
    if (!loading && !error) {
      localStorage.setItem(TEACHERS_CACHE_KEY, JSON.stringify(teachers));
    }
  }, [teachers, loading, error]);

  const fetchTeacherDocuments = async (teacherId: string) => {
    try {
      const response = await fetch(`/api/teacher/${teacherId}/documents`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch documents");
      }
      setDocumentsByTeacher((prev) => ({
        ...prev,
        [teacherId]: Array.isArray(result.data) ? result.data : [],
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch documents");
    }
  };

  const updateEditField =
    (field: keyof TeacherEditForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setEditForm((prev) => (prev ? { ...prev, [field]: event.target.value } : prev));
    };

  const handleViewProfile = (teacherId: string) => {
    setEditingTeacherId(null);
    setEditForm(null);
    setSelectedTeacherId(teacherId);
    setActionError(null);
    fetchTeacherDocuments(teacherId);
  };

  const handleStartEdit = (teacher: TeacherListItem) => {
    setSelectedTeacherId(null);
    setEditingTeacherId(teacher.id);
    setEditForm(toEditForm(teacher));
    setActionError(null);
    setEditDocumentType("");
    setEditUploadFiles([]);
    setEditProfilePicFile(null);
    fetchTeacherDocuments(teacher.id);
  };

  const handleCancelEdit = () => {
    setEditingTeacherId(null);
    setEditForm(null);
    setActionError(null);
    setEditDocumentType("");
    setEditUploadFiles([]);
    setEditProfilePicFile(null);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setDesignationFilter("");
  };

  const handleDelete = async (teacher: TeacherListItem) => {
    setDeletingId(teacher.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/teacher/${teacher.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete teacher");
      }

      if (selectedTeacherId === teacher.id) setSelectedTeacherId(null);
      if (editingTeacherId === teacher.id) handleCancelEdit();
      setDeleteTeacher(null);
      await fetchTeachers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete teacher");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteDocument = async (teacherId: string, documentId: string) => {
    setDeletingDocumentId(documentId);
    setActionError(null);
    try {
      const response = await fetch(`/api/teacher/${teacherId}/documents/${documentId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete document");
      }
      await fetchTeacherDocuments(teacherId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleUploadEditDocuments = async () => {
    if (!editingTeacherId) return;
    if (editUploadFiles.length === 0) {
      setActionError("Please choose at least one file");
      return;
    }

    setUploadingDocuments(true);
    setActionError(null);
    try {
      const formData = new FormData();
      editUploadFiles.forEach((file) => formData.append("files", file));
      if (editDocumentType.trim()) formData.append("documentType", editDocumentType.trim());

      const response = await fetch(`/api/teacher/${editingTeacherId}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload documents");
      }

      setEditUploadFiles([]);
      setEditDocumentType("");
      await fetchTeacherDocuments(editingTeacherId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload documents");
    } finally {
      setUploadingDocuments(false);
    }
  };

  const handleUploadProfilePic = async () => {
    if (!editingTeacherId || !editProfilePicFile) {
      setActionError("Please choose a profile picture file");
      return;
    }

    setUploadingProfilePic(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", editProfilePicFile);

      const response = await fetch(`/api/teacher/${editingTeacherId}/profile-pic`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload profile picture");
      }

      setEditProfilePicFile(null);
      await fetchTeachers();
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
    if (!editingTeacherId || !editForm) return;

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
        mobileNo: editForm.mobileNo.trim(),
        password: editForm.password.trim() || undefined,
        fathersName: editForm.fathersName.trim(),
        mothersName: editForm.mothersName.trim(),
        dateOfBirth: editForm.dateOfBirth,
        address: editForm.address.trim(),
        aadharCard: editForm.aadharCard.trim(),
        panCard: editForm.panCard.trim(),
        emailId: editForm.emailId.trim(),
        designation: editForm.designation.trim(),
        qualification: editForm.qualification.trim(),
        accountNo: editForm.accountNo.trim(),
        bankIfsc: editForm.bankIfsc.trim(),
        bankName: editForm.bankName.trim(),
      };

      const response = await fetch(`/api/teacher/${editingTeacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update teacher");
      }

      await fetchTeachers();
      setSelectedTeacherId(editingTeacherId);
      handleCancelEdit();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update teacher");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Teachers">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">List of Teachers</h1>
          <Button onClick={fetchTeachers} disabled={loading}>
            {loading ? "Loading..." : "Reload Data"}
          </Button>
        </div>

        {loading && <p>Loading teachers...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {actionError && <p className="text-red-500">{actionError}</p>}

        {!loading && !error && (
          <div className="space-y-4">
            <div className="rounded-md border w-full max-w-5xl mx-auto p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="teacher-search" className="sr-only">
                  Search
                </Label>
                <Input
                  id="teacher-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search teachers..."
                  className="h-8 w-full md:w-64"
                />
                <select
                  value={designationFilter}
                  onChange={(event) => setDesignationFilter(event.target.value)}
                  className="h-8 rounded-md border bg-transparent px-2 text-xs shadow-xs min-w-36"
                >
                  <option value="">All Designations</option>
                  {designationOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={resetFilters} className="h-8">
                  Clear
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Showing {filteredTeachers.length} of {teachers.length} teachers
              </p>
            </div>

            <div className="rounded-md border w-full max-w-5xl mx-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Mobile</TableHead>
                    <TableHead className="whitespace-nowrap">Designation</TableHead>
                    <TableHead className="whitespace-nowrap">Qualification</TableHead>
                    <TableHead className="whitespace-nowrap">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.length > 0 ? (
                    filteredTeachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {teacher.fullName}
                        </TableCell>
                        <TableCell>{teacher.mobileNo}</TableCell>
                        <TableCell>{teacher.designation}</TableCell>
                        <TableCell>{teacher.qualification}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewProfile(teacher.id)}
                            >
                              View Profile
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              onClick={() => handleStartEdit(teacher)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deletingId === teacher.id}
                              onClick={() => setDeleteTeacher(teacher)}
                            >
                              {deletingId === teacher.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No teachers match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {selectedTeacher && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Teacher Profile</CardTitle>
                <Button type="button" variant="outline" onClick={() => setSelectedTeacherId(null)}>
                  Close
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm wrap-break-words">
                <p><strong>Name:</strong> {selectedTeacher.fullName}</p>
                <p>
                  <strong>Profile Photo:</strong>{" "}
                  {selectedTeacher.avatarUrl ? (
                    <a
                      href={selectedTeacher.avatarUrl}
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
                <p><strong>Username:</strong> {selectedTeacher.username}</p>
                <p><strong>Mobile No:</strong> {selectedTeacher.mobileNo}</p>
                <p><strong>Date of Birth:</strong> {formatDate(selectedTeacher.dateOfBirth)}</p>
                <p><strong>Father Name:</strong> {selectedTeacher.fathersName}</p>
                <p><strong>Mother Name:</strong> {selectedTeacher.mothersName}</p>
                <p><strong>Address:</strong> {selectedTeacher.address}</p>
                <p><strong>Aadhar Card:</strong> {selectedTeacher.aadharCard}</p>
                <p><strong>PAN Card:</strong> {selectedTeacher.panCard}</p>
                <p><strong>Email ID:</strong> {selectedTeacher.emailId}</p>
                <p><strong>Designation:</strong> {selectedTeacher.designation}</p>
                <p><strong>Qualification:</strong> {selectedTeacher.qualification}</p>
                <p><strong>Account No:</strong> {selectedTeacher.accountNo}</p>
                <p><strong>Bank IFSC:</strong> {selectedTeacher.bankIfsc}</p>
                <p><strong>Bank Name:</strong> {selectedTeacher.bankName}</p>
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

        {editingTeacherId && editForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Edit Teacher</CardTitle>
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
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
                    <Button type="button" variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </form>
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
                        onChange={(event) => setEditUploadFiles(Array.from(event.target.files ?? []))}
                      />
                    </div>
                  </div>
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
                  {Object.keys(groupedEditingDocuments).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  ) : (
                    Object.entries(groupedEditingDocuments).map(([group, docs]) => (
                      <div key={group} className="rounded-md border p-3 space-y-2">
                        <p className="text-sm font-medium capitalize">{group.replace(/_/g, " ")}</p>
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
                                  editingTeacherId &&
                                  handleDeleteDocument(editingTeacherId, doc.id)
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

        {deleteTeacher && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Delete Teacher</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete {deleteTeacher.fullName} ({deleteTeacher.mobileNo})?
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deletingId === deleteTeacher.id}
                    onClick={() => setDeleteTeacher(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deletingId === deleteTeacher.id}
                    onClick={() => handleDelete(deleteTeacher)}
                  >
                    {deletingId === deleteTeacher.id ? "Deleting..." : "Delete"}
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
