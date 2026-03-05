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
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ManageableUser = {
  userId: string;
  fullName: string;
  username: string;
  role: string;
  studentId: string | null;
  admissionNo: string | null;
  rollNumber: string | null;
  className: string | null;
  teacherId: string | null;
  mobileNo: string | null;
  qualification: string | null;
  designation: string | null;
  docCount: number;
};

type DocumentItem = {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: string | null;
  fileType: string | null;
  documentType: string;
  uploadedAt: string | Date | null;
};

const formatDateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString() : "N/A";

export default function DocumentsManagementPage() {
  const [users, setUsers] = useState<ManageableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "student" | "teacher">(
    "all",
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((user) => user.userId === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const query = new URLSearchParams();
      if (roleFilter !== "all") query.set("role", roleFilter);
      if (search.trim()) query.set("search", search.trim());

      const response = await fetch(`/api/document/admin/users?${query.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch users");
      }

      const data = Array.isArray(result.data) ? result.data : [];
      setUsers(data);

      if (!selectedUserId && data.length > 0) {
        setSelectedUserId(data[0].userId);
      } else if (
        selectedUserId &&
        !data.some((item: ManageableUser) => item.userId === selectedUserId)
      ) {
        setSelectedUserId(data[0]?.userId ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadDocuments = async (userId: string) => {
    setLoadingDocs(true);
    try {
      const response = await fetch(`/api/document/admin/users/${userId}/documents`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch documents");
      }
      setDocuments(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch documents");
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  useEffect(() => {
    if (selectedUserId) {
      loadDocuments(selectedUserId);
    } else {
      setDocuments([]);
    }
  }, [selectedUserId]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadUsers();
  };

  const handleUpload = async () => {
    if (!selectedUserId) {
      toast.error("Select a user first");
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error("Select at least one file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      if (documentType.trim()) {
        formData.append("documentType", documentType.trim());
      }

      const response = await fetch(
        `/api/document/admin/users/${selectedUserId}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload documents");
      }

      toast.success("Documents uploaded successfully");
      setSelectedFiles([]);
      setDocumentType("");
      await loadDocuments(selectedUserId);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload documents");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!selectedUserId) return;

    setDeletingId(documentId);
    try {
      const response = await fetch(
        `/api/document/admin/users/${selectedUserId}/documents/${documentId}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete document");
      }

      toast.success("Document deleted");
      await loadDocuments(selectedUserId);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout title="Documents">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Manage Documents</h1>

        <Card>
          <CardHeader>
            <CardTitle>Find Individual</CardTitle>
            <CardDescription>
              Select a student or teacher to view and manage their documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, admission/roll, phone"
                className="md:col-span-2"
              />
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(e.target.value as "all" | "student" | "teacher")
                }
              >
                <option value="all">All</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
              </select>
              <Button type="submit" disabled={loadingUsers}>
                {loadingUsers ? "Loading..." : "Search"}
              </Button>
            </form>

            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                {users.map((item) => (
                  <button
                    key={item.userId}
                    type="button"
                    className={`w-full text-left p-3 transition-colors ${
                      item.userId === selectedUserId ? "bg-primary/10" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedUserId(item.userId)}
                  >
                    <p className="font-medium">{item.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      @{item.username} | Role: {item.role} | Docs: {item.docCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.role === "student"
                        ? `Admission: ${item.admissionNo ?? "N/A"} | Roll: ${item.rollNumber ?? "N/A"}`
                        : `Phone: ${item.mobileNo ?? "N/A"} | Designation: ${item.designation ?? "N/A"}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedUser.fullName} - Documents</CardTitle>
              <CardDescription>
                Upload and delete documents for this individual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-document-type">Document Type (Optional)</Label>
                  <Input
                    id="admin-document-type"
                    placeholder="e.g. id-proof, marksheet"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-documents">Select Files</Label>
                  <Input
                    id="admin-documents"
                    type="file"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" onClick={handleUpload} disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload Documents"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loadDocuments(selectedUser.userId)}
                  disabled={loadingDocs}
                >
                  {loadingDocs ? "Refreshing..." : "Refresh List"}
                </Button>
              </div>

              {loadingDocs ? (
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              ) : documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-md border p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium break-all">{doc.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          Type: {doc.documentType || "general"} | Uploaded:{" "}
                          {formatDateTime(doc.uploadedAt)}
                        </p>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          Open File
                        </a>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deletingId === doc.id}
                        onClick={() => handleDelete(doc.id)}
                      >
                        {deletingId === doc.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
