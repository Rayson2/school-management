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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

type StudentUploadControl = {
  documentUploadEnabled: boolean;
  profileUploadEnabled: boolean;
  requestedDocumentTypes: string[];
  scopeType: "all" | "class";
  classId: string | null;
  className: string | null;
  updatedAt: string | Date | null;
};

const formatDateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString() : "N/A";

export default function ProfileSettingsPage() {
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [studentUploadControl, setStudentUploadControl] = useState<StudentUploadControl | null>(null);
  const [loadingControls, setLoadingControls] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [requestedDocumentFiles, setRequestedDocumentFiles] = useState<Record<string, File | null>>({});
  const [uploadingRequestedDocument, setUploadingRequestedDocument] = useState<string | null>(null);

  const hasStudentOrTeacherRole = useMemo(() => {
    const roles = user?.roles ?? [];
    return roles.includes("student") || roles.includes("teacher");
  }, [user?.roles]);
  const isStudent = useMemo(() => (user?.roles ?? []).includes("student"), [user?.roles]);
  const canUploadOwnDocuments = useMemo(() => {
    if ((user?.roles ?? []).includes("teacher") && !(user?.roles ?? []).includes("student")) {
      return true;
    }
    if (isStudent) {
      return studentUploadControl?.documentUploadEnabled ?? false;
    }
    return false;
  }, [isStudent, studentUploadControl?.documentUploadEnabled, user?.roles]);
  const canUploadOwnProfilePic = useMemo(() => {
    if (isStudent) {
      return studentUploadControl?.profileUploadEnabled ?? false;
    }
    return false;
  }, [isStudent, studentUploadControl?.profileUploadEnabled]);
  const canDeleteOwnDocuments = useMemo(() => {
    const roles = user?.roles ?? [];
    return !roles.includes("student");
  }, [user?.roles]);
  const documentsByType = useMemo(
    () =>
      documents.reduce<Record<string, DocumentItem[]>>((acc, doc) => {
        const key = (doc.documentType || "general").trim().toLowerCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(doc);
        return acc;
      }, {}),
    [documents],
  );

  const fetchUploadControls = async () => {
    setLoadingControls(true);
    try {
      const response = await fetch("/api/document/me/upload-controls");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch upload controls");
      }
      setStudentUploadControl(result.data ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch upload controls");
    } finally {
      setLoadingControls(false);
    }
  };

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

  useEffect(() => {
    if (isStudent) {
      fetchUploadControls();
    }
  }, [isStudent]);

  const handleUpload = async () => {
    if (!canUploadOwnDocuments) {
      toast.error("Document upload is currently turned off");
      return;
    }

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

  const handleAvatarUpload = async () => {
    if (!canUploadOwnProfilePic) {
      toast.error("Profile picture upload is currently turned off");
      return;
    }
    if (!avatarFile) {
      toast.error("Select a profile picture");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);

      const response = await fetch("/api/auth/profile-pic", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload profile picture");
      }

      if (result.data?.avatarUrl) {
        updateUser({ avatarUrl: result.data.avatarUrl });
      }
      setAvatarFile(null);
      toast.success("Profile picture updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload profile picture");
    } finally {
      setUploadingAvatar(false);
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

  const handleRequestedDocumentUpload = async (documentTypeName: string) => {
    if (!canUploadOwnDocuments) {
      toast.error("Document upload is currently turned off");
      return;
    }

    const normalizedType = documentTypeName.trim().toLowerCase();
    const file = requestedDocumentFiles[normalizedType];
    if (!file) {
      toast.error(`Select a file for ${documentTypeName}`);
      return;
    }

    setUploadingRequestedDocument(normalizedType);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("documentType", normalizedType);

      const response = await fetch("/api/document/me/documents", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload document");
      }

      setRequestedDocumentFiles((current) => ({ ...current, [normalizedType]: null }));
      toast.success(`${documentTypeName} uploaded successfully`);
      await fetchMyDocuments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingRequestedDocument(null);
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

        {isStudent && (
          <Card>
            <CardHeader>
              <CardTitle>Requested Documents</CardTitle>
              <CardDescription>
                Admin can request specific documents from all students or from your class. Upload
                each requested item directly from here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {loadingControls ? (
                <p className="text-muted-foreground">Loading upload controls...</p>
              ) : (
                <>
                  <p>
                    <strong>Scope:</strong>{" "}
                    {studentUploadControl?.scopeType === "class"
                      ? `Class ${studentUploadControl.className ?? "selected"}`
                      : "All students"}
                  </p>
                  <p>
                    <strong>Document Request:</strong>{" "}
                    {studentUploadControl?.documentUploadEnabled ? "On" : "Off"}
                  </p>
                  <p>
                    <strong>Profile Upload:</strong>{" "}
                    {studentUploadControl?.profileUploadEnabled ? "On" : "Off"}
                  </p>
                  <p>
                    <strong>Requested Documents:</strong>{" "}
                    {studentUploadControl?.requestedDocumentTypes?.length
                      ? studentUploadControl.requestedDocumentTypes.join(", ")
                      : "No specific document types requested"}
                  </p>

                  {studentUploadControl?.requestedDocumentTypes?.length ? (
                    <div className="space-y-3">
                      {studentUploadControl.requestedDocumentTypes.map((documentTypeName) => {
                        const normalizedType = documentTypeName.trim().toLowerCase();
                        const existingDocs = documentsByType[normalizedType] ?? [];
                        const latestDoc = existingDocs[0] ?? null;

                        return (
                          <div key={documentTypeName} className="rounded-md border p-3 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">{documentTypeName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {latestDoc
                                    ? `Uploaded ${formatDateTime(latestDoc.uploadedAt)}`
                                    : "Not submitted yet"}
                                </p>
                              </div>
                              {latestDoc && (
                                <a
                                  href={latestDoc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  Open Current File
                                </a>
                              )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                              <Input
                                type="file"
                                onChange={(event) =>
                                  setRequestedDocumentFiles((current) => ({
                                    ...current,
                                    [normalizedType]: event.target.files?.[0] ?? null,
                                  }))
                                }
                                disabled={!canUploadOwnDocuments}
                              />
                              <Button
                                type="button"
                                onClick={() => handleRequestedDocumentUpload(documentTypeName)}
                                disabled={
                                  !canUploadOwnDocuments ||
                                  uploadingRequestedDocument === normalizedType ||
                                  !requestedDocumentFiles[normalizedType]
                                }
                              >
                                {uploadingRequestedDocument === normalizedType
                                  ? "Uploading..."
                                  : "Upload"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No requested document types at the moment.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isStudent && (
          <Card>
            <CardHeader>
              <CardTitle>My Profile Picture</CardTitle>
              <CardDescription>
                Upload is available only when the current student control is turned on.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="my-avatar">Select Image</Label>
                  <Input
                    id="my-avatar"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                    disabled={!canUploadOwnProfilePic}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Photo</Label>
                  <div className="flex h-9 items-center rounded-md border px-3 text-sm">
                    {user?.avatarUrl ? "Profile picture uploaded" : "No profile picture uploaded"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleAvatarUpload}
                  disabled={uploadingAvatar || !avatarFile || !canUploadOwnProfilePic}
                >
                  {uploadingAvatar ? "Uploading..." : "Upload Profile Picture"}
                </Button>
                <Button type="button" variant="outline" onClick={fetchUploadControls} disabled={loadingControls}>
                  {loadingControls ? "Refreshing..." : "Refresh Access"}
                </Button>
              </div>

              {!canUploadOwnProfilePic && (
                <p className="text-sm text-muted-foreground">
                  Profile picture upload is currently turned off by admin control.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
              <CardTitle>My Submitted Documents</CardTitle>
              <CardDescription>
                View the documents already attached to your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isStudent && canUploadOwnDocuments && (
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
              )}

              <div className="flex items-center gap-2">
                {!isStudent && canUploadOwnDocuments && (
                  <Button type="button" onClick={handleUpload} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload Documents"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchMyDocuments}
                  disabled={loadingDocs}
                >
                  {loadingDocs ? "Refreshing..." : "Refresh List"}
                </Button>
              </div>
              {isStudent && (
                <p className="text-sm text-muted-foreground">
                  Requested documents appear above with a dedicated upload option for each type.
                </p>
              )}
              {!isStudent && !canUploadOwnDocuments && (
                <p className="text-sm text-muted-foreground">
                  Document upload is currently turned off. Please contact admin if documents need
                  to be requested or reopened.
                </p>
              )}
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
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>File</TableHead>
                        {canDeleteOwnDocuments && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium break-all">{doc.fileName}</TableCell>
                          <TableCell>{doc.documentType || "general"}</TableCell>
                          <TableCell>{formatDateTime(doc.uploadedAt)}</TableCell>
                          <TableCell>
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all"
                            >
                              Open File
                            </a>
                          </TableCell>
                          {canDeleteOwnDocuments && (
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={deletingId === doc.id}
                                onClick={() => handleDelete(doc.id)}
                              >
                                {deletingId === doc.id ? "Deleting..." : "Delete"}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
