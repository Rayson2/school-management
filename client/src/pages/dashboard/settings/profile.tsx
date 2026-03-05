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
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

export default function ProfileSettingsPage() {
  const user = useUserStore((state) => state.user);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("");

  const hasStudentOrTeacherRole = useMemo(() => {
    const roles = user?.roles ?? [];
    return roles.includes("student") || roles.includes("teacher");
  }, [user?.roles]);
  const canDeleteOwnDocuments = useMemo(() => {
    const roles = user?.roles ?? [];
    return !roles.includes("student");
  }, [user?.roles]);

  const fetchMyDocuments = async () => {
    setLoadingDocs(true);
    try {
      const response = await fetch("/api/document/me/documents");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch documents");
      }
      setDocuments(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (hasStudentOrTeacherRole) {
      fetchMyDocuments();
    }
  }, [hasStudentOrTeacherRole]);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Select at least one document");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      if (documentType.trim()) {
        formData.append("documentType", documentType.trim());
      }

      const response = await fetch("/api/document/me/documents", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload documents");
      }

      toast.success("Documents uploaded successfully");
      setSelectedFiles([]);
      setDocumentType("");
      await fetchMyDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload documents");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      const response = await fetch(`/api/document/me/documents/${documentId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete document");
      }

      toast.success("Document deleted");
      await fetchMyDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout title="Profile Settings">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Profile Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>
              Profile is available for all users: admin, teacher, and student.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <p>
              <strong>Full Name:</strong> {user?.fullName || "N/A"}
            </p>
            <p>
              <strong>Username:</strong> {user?.username || "N/A"}
            </p>
            <p>
              <strong>Roles:</strong> {(user?.roles ?? []).join(", ") || "N/A"}
            </p>
            <p>
              <strong>Profile Photo:</strong>{" "}
              {user?.avatarUrl ? (
                <a
                  href={user.avatarUrl}
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
          </CardContent>
        </Card>

        {!hasStudentOrTeacherRole && (
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
              <CardDescription>
                Document upload is available for student and teacher accounts.
                Admin can manage individual documents from the Documents tab.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {hasStudentOrTeacherRole && (
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
              <CardDescription>
                Upload and manage your own documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="my-document-type">Document Type (Optional)</Label>
                  <Input
                    id="my-document-type"
                    placeholder="e.g. marksheet, id-proof"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="my-documents">Select Files</Label>
                  <Input
                    id="my-documents"
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
                  onClick={fetchMyDocuments}
                  disabled={loadingDocs}
                >
                  {loadingDocs ? "Refreshing..." : "Refresh List"}
                </Button>
              </div>
              {!canDeleteOwnDocuments && (
                <p className="text-sm text-muted-foreground">
                  Students are not allowed to delete documents.
                </p>
              )}

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
                      {canDeleteOwnDocuments && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deletingId === doc.id}
                          onClick={() => handleDelete(doc.id)}
                        >
                          {deletingId === doc.id ? "Deleting..." : "Delete"}
                        </Button>
                      )}
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
