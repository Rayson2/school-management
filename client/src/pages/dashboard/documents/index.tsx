import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  CircleCheckBig,
  CircleOff,
  Download,
  Eye,
  FileCheck,
  FileClock,
  FileText,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
  UserSquare2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type DocumentTargetGroup = "student" | "teacher";

type RequestType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

type RequestItem = {
  id: string;
  requestTypeId: string;
  targetGroup: DocumentTargetGroup;
  isActive: boolean;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  requestType: RequestType;
};

type TrackingDocument = {
  requestId: string;
  requestTypeId: string;
  typeName: string;
  typeSlug: string;
  isActive: boolean;
  uploaded: boolean;
  documentId: string | null;
  fileName: string | null;
  fileUrl: string | null;
  uploadedAt: string | Date | null;
  status: string | null;
};

type TrackingRow = {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
  classOrRole: string;
  className: string | null;
  roleLabel: string | null;
  targetGroup: DocumentTargetGroup;
  progress: {
    uploaded: number;
    total: number;
  };
  documents: TrackingDocument[];
};

type TrackingPayload = {
  targetGroup: DocumentTargetGroup;
  requests: Array<{
    id: string;
    isActive: boolean;
    requestTypeId: string;
    typeName: string;
    typeSlug: string;
  }>;
  totals: {
    users: number;
    requests: number;
    uploadedEntries: number;
    missingEntries: number;
  };
  rows: TrackingRow[];
};

type ClassItem = {
  id: string;
  name: string;
};

type StudentUploadControlItem = {
  scopeType: "all" | "class";
  classId: string | null;
  className: string | null;
  documentUploadEnabled: boolean;
  profileUploadEnabled: boolean;
  requestedDocumentTypes: string[];
  updatedAt: string | Date | null;
};

type StudentUploadControlPayload = {
  all: StudentUploadControlItem;
  classes: StudentUploadControlItem[];
};

type ProfilePayload = {
  user: {
    userId: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    targetGroup: DocumentTargetGroup;
    classOrRole: string;
    className: string | null;
    roleLabel: string | null;
    admissionNo: string | null;
    rollNumber: string | null;
    mobileNo: string | null;
    designation: string | null;
    qualification: string | null;
  };
  requiredDocuments: TrackingDocument[];
  otherDocuments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    documentType: string;
    uploadedAt: string | Date | null;
    status: string;
  }>;
};

const formatDateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString() : "Not uploaded";

const buildTypeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const targetGroupCopy: Record<DocumentTargetGroup, string> = {
  student: "Students",
  teacher: "Teachers",
};

const statusBadgeClass = (isOpen: boolean) =>
  isOpen
    ? "bg-emerald-600 text-white hover:bg-emerald-600"
    : "border-slate-300 bg-white text-slate-600 hover:bg-white";

export default function DocumentsManagementPage() {
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [tracking, setTracking] = useState<TrackingPayload | null>(null);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentUploadControls, setStudentUploadControls] =
    useState<StudentUploadControlPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [search, setSearch] = useState("");
  const [targetGroup, setTargetGroup] = useState<DocumentTargetGroup>("student");
  const [refreshKey, setRefreshKey] = useState(0);

  const [typeForm, setTypeForm] = useState({
    id: "",
    name: "",
    description: "",
  });
  const [requestForm, setRequestForm] = useState<{
    id: string;
    requestTypeId: string;
    targetGroup: DocumentTargetGroup;
    isActive: boolean;
  }>({
    id: "",
    requestTypeId: "",
    targetGroup: "student",
    isActive: true,
  });
  const [savingType, setSavingType] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [savingStudentScope, setSavingStudentScope] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadFilesByType, setUploadFilesByType] = useState<Record<string, File | null>>({});
  const [uploadingTypeId, setUploadingTypeId] = useState<string | null>(null);
  const [studentScopeForm, setStudentScopeForm] = useState<{
    scopeType: "all" | "class";
    classId: string;
    documentUploadEnabled: boolean;
    profileUploadEnabled: boolean;
  }>({
    scopeType: "all",
    classId: "all",
    documentUploadEnabled: false,
    profileUploadEnabled: false,
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ targetGroup, search });
      const [typesResponse, requestsResponse, trackingResponse, controlsResponse, classesResponse] =
        await Promise.all([
        fetch("/api/document/admin/request-types"),
        fetch("/api/document/admin/requests"),
        fetch(`/api/document/admin/tracking?${params.toString()}`),
        fetch("/api/document/admin/student-upload-controls"),
        fetch("/api/class/all"),
      ]);

      const [typesResult, requestsResult, trackingResult, controlsResult, classesResult] =
        await Promise.all([
        typesResponse.json(),
        requestsResponse.json(),
        trackingResponse.json(),
        controlsResponse.json(),
        classesResponse.json(),
      ]);

      if (!typesResponse.ok || !typesResult.success) {
        throw new Error(typesResult.error || "Failed to fetch document types");
      }
      if (!requestsResponse.ok || !requestsResult.success) {
        throw new Error(requestsResult.error || "Failed to fetch requests");
      }
      if (!trackingResponse.ok || !trackingResult.success) {
        throw new Error(trackingResult.error || "Failed to fetch tracking data");
      }
      if (!controlsResponse.ok || !controlsResult.success) {
        throw new Error(controlsResult.error || "Failed to fetch student upload controls");
      }
      if (!classesResponse.ok || !classesResult.success) {
        throw new Error(classesResult.error || "Failed to fetch classes");
      }

      setRequestTypes(Array.isArray(typesResult.data) ? typesResult.data : []);
      setRequests(Array.isArray(requestsResult.data) ? requestsResult.data : []);
      setTracking(trackingResult.data ?? null);
      setStudentUploadControls(controlsResult.data ?? null);
      setClasses(Array.isArray(classesResult.data) ? classesResult.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load document center");
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (userId: string) => {
    setLoadingProfile(true);
    try {
      const response = await fetch(`/api/document/admin/profiles/${userId}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load profile");
      }
      setProfile(result.data ?? null);
      setProfileOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [targetGroup, refreshKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRefreshKey((current) => current + 1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const studentRequests = useMemo(
    () => requests.filter((item) => item.targetGroup === "student"),
    [requests],
  );
  const teacherRequests = useMemo(
    () => requests.filter((item) => item.targetGroup === "teacher"),
    [requests],
  );
  const activeRequestIds = useMemo(
    () => new Set(requests.filter((item) => item.isActive).map((item) => item.requestTypeId)),
    [requests],
  );
  const activeStudentScopeControl = useMemo(() => {
    if (!studentUploadControls) return null;
    if (studentScopeForm.scopeType === "all") return studentUploadControls.all;
    return (
      studentUploadControls.classes.find((item) => item.classId === studentScopeForm.classId) ?? {
        scopeType: "class" as const,
        classId: studentScopeForm.classId === "all" ? null : studentScopeForm.classId,
        className:
          classes.find((item) => item.id === studentScopeForm.classId)?.name ?? null,
        documentUploadEnabled: false,
        profileUploadEnabled: false,
        requestedDocumentTypes: studentUploadControls.all.requestedDocumentTypes,
        updatedAt: null,
      }
    );
  }, [classes, studentScopeForm.classId, studentScopeForm.scopeType, studentUploadControls]);

  const resetTypeForm = () => {
    setTypeForm({ id: "", name: "", description: "" });
  };

  const resetRequestForm = () => {
    setRequestForm({
      id: "",
      requestTypeId: requestTypes[0]?.id ?? "",
      targetGroup,
      isActive: true,
    });
  };

  useEffect(() => {
    if (!requestForm.requestTypeId && requestTypes.length > 0) {
      setRequestForm((current) => ({ ...current, requestTypeId: requestTypes[0].id }));
    }
  }, [requestForm.requestTypeId, requestTypes]);

  useEffect(() => {
    if (!requestForm.id) {
      setRequestForm((current) => ({ ...current, targetGroup }));
    }
  }, [targetGroup, requestForm.id]);

  useEffect(() => {
    if (studentScopeForm.scopeType === "class" && studentScopeForm.classId === "all" && classes.length) {
      setStudentScopeForm((current) => ({ ...current, classId: classes[0].id }));
    }
  }, [classes, studentScopeForm.classId, studentScopeForm.scopeType]);

  useEffect(() => {
    if (!activeStudentScopeControl) return;
    setStudentScopeForm((current) => ({
      ...current,
      documentUploadEnabled: activeStudentScopeControl.documentUploadEnabled,
      profileUploadEnabled: activeStudentScopeControl.profileUploadEnabled,
    }));
  }, [
    activeStudentScopeControl?.documentUploadEnabled,
    activeStudentScopeControl?.profileUploadEnabled,
  ]);

  const handleSaveType = async () => {
    const name = typeForm.name.trim();
    if (!name) {
      toast.error("Document type name is required");
      return;
    }

    setSavingType(true);
    try {
      const response = await fetch(
        typeForm.id
          ? `/api/document/admin/request-types/${typeForm.id}`
          : "/api/document/admin/request-types",
        {
          method: typeForm.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            slug: buildTypeSlug(name),
            description: typeForm.description.trim(),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save document type");
      }

      toast.success(typeForm.id ? "Document type updated" : "Document type created");
      resetTypeForm();
      setRefreshKey((current) => current + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save document type");
    } finally {
      setSavingType(false);
    }
  };

  const handleSaveRequest = async () => {
    if (!requestForm.requestTypeId) {
      toast.error("Choose a document type first");
      return;
    }

    setSavingRequest(true);
    try {
      const response = await fetch(
        requestForm.id
          ? `/api/document/admin/requests/${requestForm.id}`
          : "/api/document/admin/requests",
        {
          method: requestForm.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestForm),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save request");
      }

      toast.success(requestForm.id ? "Request updated" : "Request created");
      resetRequestForm();
      setRefreshKey((current) => current + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save request");
    } finally {
      setSavingRequest(false);
    }
  };

  const handleDelete = async (
    kind: "type" | "request" | "document",
    id: string,
    userId?: string,
  ) => {
    setDeletingId(id);
    try {
      let endpoint = "";
      if (kind === "type") endpoint = `/api/document/admin/request-types/${id}`;
      if (kind === "request") endpoint = `/api/document/admin/requests/${id}`;
      if (kind === "document" && userId) {
        endpoint = `/api/document/admin/users/${userId}/documents/${id}`;
      }

      const response = await fetch(endpoint, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete item");
      }

      toast.success("Deleted successfully");
      setRefreshKey((current) => current + 1);
      if (profile?.user.userId && kind === "document") {
        await loadProfile(profile.user.userId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setDeletingId(null);
    }
  };

  const handleProfileUpload = async (requestTypeId: string, typeSlug: string) => {
    if (!profile) return;
    const file = uploadFilesByType[requestTypeId];
    if (!file) {
      toast.error("Choose a file first");
      return;
    }

    setUploadingTypeId(requestTypeId);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("requestTypeId", requestTypeId);
      formData.append("documentType", typeSlug);

      const response = await fetch(`/api/document/admin/users/${profile.user.userId}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload document");
      }

      setUploadFilesByType((current) => ({ ...current, [requestTypeId]: null }));
      toast.success("Document uploaded successfully");
      await loadProfile(profile.user.userId);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploadingTypeId(null);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({ targetGroup, search });
    window.open(`/api/document/admin/tracking/export?${params.toString()}`, "_blank");
  };

  const handleSaveStudentScope = async () => {
    setSavingStudentScope(true);
    try {
      const response = await fetch("/api/document/admin/student-upload-controls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: studentScopeForm.scopeType,
          classId:
            studentScopeForm.scopeType === "class" && studentScopeForm.classId !== "all"
              ? studentScopeForm.classId
              : null,
          documentUploadEnabled: studentScopeForm.documentUploadEnabled,
          profileUploadEnabled: studentScopeForm.profileUploadEnabled,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save student access control");
      }

      setStudentUploadControls(result.data ?? null);
      toast.success("Student upload access updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save student access control");
    } finally {
      setSavingStudentScope(false);
    }
  };

  const summaryCards = [
    {
      title: "Active requests",
      value: requests.filter((item) => item.isActive).length,
      description: "Live requests currently visible to users",
      icon: FileText,
    },
    {
      title: `${targetGroupCopy[targetGroup]} tracked`,
      value: tracking?.totals.users ?? 0,
      description: "Profiles monitored in the current report",
      icon: UserSquare2,
    },
    {
      title: "Uploads received",
      value: tracking?.totals.uploadedEntries ?? 0,
      description: "Required documents already submitted",
      icon: FileCheck,
    },
    {
      title: "Pending uploads",
      value: tracking?.totals.missingEntries ?? 0,
      description: "Required documents still missing",
      icon: FileClock,
    },
  ];

  return (
    <DashboardLayout title="Document Center">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-sm"
              >
                <CardContent className="flex items-start justify-between p-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{card.title}</p>
                    <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-3 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1.25fr]">
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Student access controls</CardTitle>
                <CardDescription>
                  Open uploads for all students or only one class. Profile picture access follows
                  the same scope-based control.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-amber-50/40 p-5">
                  <div className="grid gap-4 xl:grid-cols-[220px_240px_1fr]">
                    <div className="space-y-2">
                      <Label>Scope</Label>
                      <Select
                        value={studentScopeForm.scopeType}
                        onValueChange={(value: "all" | "class") =>
                          setStudentScopeForm((current) => ({
                            ...current,
                            scopeType: value,
                            classId:
                              value === "class"
                                ? current.classId === "all"
                                  ? classes[0]?.id ?? "all"
                                  : current.classId
                                : "all",
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All students</SelectItem>
                          <SelectItem value="class">Single class</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select
                        value={
                          studentScopeForm.scopeType === "class"
                            ? studentScopeForm.classId
                            : "all"
                        }
                        onValueChange={(value) =>
                          setStudentScopeForm((current) => ({ ...current, classId: value }))
                        }
                        disabled={studentScopeForm.scopeType !== "class"}
                      >
                        <SelectTrigger className="bg-white disabled:opacity-60">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <Button
                        onClick={handleSaveStudentScope}
                        disabled={
                          savingStudentScope ||
                          (studentScopeForm.scopeType === "class" &&
                            studentScopeForm.classId === "all")
                        }
                      >
                        Save access
                      </Button>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Current scope:{" "}
                        <span className="font-medium text-slate-800">
                          {studentScopeForm.scopeType === "class"
                            ? activeStudentScopeControl?.className || "Selected class"
                            : "All students"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">Document uploads</p>
                          <p className="text-sm text-muted-foreground">
                            Controls whether students in this scope can submit required documents.
                          </p>
                        </div>
                        <Badge className={statusBadgeClass(studentScopeForm.documentUploadEnabled)}>
                          {studentScopeForm.documentUploadEnabled ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">Allow document upload</span>
                        <Switch
                          checked={studentScopeForm.documentUploadEnabled}
                          onCheckedChange={(checked) =>
                            setStudentScopeForm((current) => ({
                              ...current,
                              documentUploadEnabled: checked,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">Profile picture uploads</p>
                          <p className="text-sm text-muted-foreground">
                            Uses the same scope logic for student profile photos.
                          </p>
                        </div>
                        <Badge className={statusBadgeClass(studentScopeForm.profileUploadEnabled)}>
                          {studentScopeForm.profileUploadEnabled ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">Allow profile picture upload</span>
                        <Switch
                          checked={studentScopeForm.profileUploadEnabled}
                          onCheckedChange={(checked) =>
                            setStudentScopeForm((current) => ({
                              ...current,
                              profileUploadEnabled: checked,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">All students</p>
                      <Badge variant="outline">Default rule</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-600">Documents</span>
                        <Badge className={statusBadgeClass(Boolean(studentUploadControls?.all.documentUploadEnabled))}>
                          {studentUploadControls?.all.documentUploadEnabled ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-600">Profile pics</span>
                        <Badge className={statusBadgeClass(Boolean(studentUploadControls?.all.profileUploadEnabled))}>
                          {studentUploadControls?.all.profileUploadEnabled ? "Open" : "Closed"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Class overrides</p>
                      <Badge variant="outline">
                        {studentUploadControls?.classes.length ?? 0} saved
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {studentUploadControls?.classes.length ? (
                        studentUploadControls.classes.map((item) => (
                          <div
                            key={item.classId ?? item.className}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-800">
                                {item.className || "Unnamed class"}
                              </p>
                              <div className="flex gap-2">
                                <Badge className={statusBadgeClass(item.documentUploadEnabled)}>
                                  Docs {item.documentUploadEnabled ? "Open" : "Closed"}
                                </Badge>
                                <Badge className={statusBadgeClass(item.profileUploadEnabled)}>
                                  Pics {item.profileUploadEnabled ? "Open" : "Closed"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground">
                          No class-specific overrides saved yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Reusable document types</CardTitle>
                <CardDescription>
                  Build your master catalog once, then reuse each type in student or teacher
                  requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type-name">Document name</Label>
                    <Input
                      id="type-name"
                      placeholder="Aadhar Card"
                      value={typeForm.name}
                      onChange={(event) =>
                        setTypeForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Slug preview: {buildTypeSlug(typeForm.name) || "document-type"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type-description">Description</Label>
                    <Textarea
                      id="type-description"
                      placeholder="Optional notes for admins and office staff"
                      value={typeForm.description}
                      onChange={(event) =>
                        setTypeForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSaveType} disabled={savingType}>
                      <Plus className="mr-2 h-4 w-4" />
                      {typeForm.id ? "Update type" : "Create type"}
                    </Button>
                    {typeForm.id ? (
                      <Button variant="outline" onClick={resetTypeForm}>
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>In use</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requestTypes.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{type.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {type.description || "No description added"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{type.slug}</Badge>
                          </TableCell>
                          <TableCell>
                            {activeRequestIds.has(type.id) ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                Active request
                              </Badge>
                            ) : (
                              <Badge variant="outline">Library only</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setTypeForm({
                                    id: type.id,
                                    name: type.name,
                                    description: type.description || "",
                                  })
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={deletingId === type.id}
                                onClick={() => handleDelete("type", type.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!requestTypes.length ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                            No document types created yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Request controls</CardTitle>
                <CardDescription>
                  Turn each document requirement on or off for students or teachers at any time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select
                      value={requestForm.requestTypeId}
                      onValueChange={(value) =>
                        setRequestForm((current) => ({ ...current, requestTypeId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {requestTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Target group</Label>
                    <Select
                      value={requestForm.targetGroup}
                      onValueChange={(value: DocumentTargetGroup) =>
                        setRequestForm((current) => ({ ...current, targetGroup: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Students</SelectItem>
                        <SelectItem value="teacher">Teachers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Active now</Label>
                    <div className="flex h-10 items-center gap-3 rounded-xl border px-3">
                      <Switch
                        checked={requestForm.isActive}
                        onCheckedChange={(checked) =>
                          setRequestForm((current) => ({ ...current, isActive: checked }))
                        }
                      />
                      <span className="text-sm font-medium">
                        {requestForm.isActive ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveRequest} disabled={savingRequest}>
                    <Plus className="mr-2 h-4 w-4" />
                    {requestForm.id ? "Update request" : "Create request"}
                  </Button>
                  {requestForm.id ? (
                    <Button variant="outline" onClick={resetRequestForm}>
                      Cancel edit
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-emerald-200 bg-emerald-50/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Student requests</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {studentRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border bg-white p-4"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{request.requestType.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.requestType.description || "No description"}
                            </p>
                            <Badge variant={request.isActive ? "default" : "outline"}>
                              {request.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRequestForm({
                                  id: request.id,
                                  requestTypeId: request.requestTypeId,
                                  targetGroup: request.targetGroup,
                                  isActive: request.isActive,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deletingId === request.id}
                              onClick={() => handleDelete("request", request.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!studentRequests.length ? (
                        <p className="text-sm text-muted-foreground">
                          No student requests configured yet.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="border-sky-200 bg-sky-50/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Teacher requests</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {teacherRequests.map((request) => (
                        <div
                          key={request.id}
                          className="flex items-start justify-between gap-3 rounded-2xl border bg-white p-4"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{request.requestType.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.requestType.description || "No description"}
                            </p>
                            <Badge variant={request.isActive ? "default" : "outline"}>
                              {request.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRequestForm({
                                  id: request.id,
                                  requestTypeId: request.requestTypeId,
                                  targetGroup: request.targetGroup,
                                  isActive: request.isActive,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deletingId === request.id}
                              onClick={() => handleDelete("request", request.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!teacherRequests.length ? (
                        <p className="text-sm text-muted-foreground">
                          No teacher requests configured yet.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/70">
            <CardHeader className="gap-6 border-b border-slate-200 bg-slate-50/70 pb-6">
              <div className="flex flex-col gap-2">
                <CardTitle className="text-xl tracking-tight">Upload tracking & reporting</CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6">
                  Review submission status, open a single profile, and export the current view.
                </CardDescription>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Target group
                    </Label>
                    <Select
                      value={targetGroup}
                      onValueChange={(value: DocumentTargetGroup) => setTargetGroup(value)}
                    >
                      <SelectTrigger className="h-11 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Students</SelectItem>
                        <SelectItem value="teacher">Teachers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Search
                    </Label>
                    <Input
                      className="h-11 bg-white"
                      placeholder="Search by name, class, username, admission, role..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:flex">
                  <Button
                    variant="outline"
                    className="h-11 bg-white px-4"
                    onClick={() => setRefreshKey((current) => current + 1)}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button className="h-11 px-5" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                {(tracking?.requests ?? []).map((request) => (
                  <Badge
                    key={request.id}
                    variant={request.isActive ? "default" : "outline"}
                    className={
                      request.isActive
                        ? "rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-900"
                        : "rounded-full px-3 py-1"
                    }
                  >
                    {request.typeName}
                  </Badge>
                ))}
                {!tracking?.requests.length ? (
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    No requests yet
                  </Badge>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="h-12 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Name
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Class / Role
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Progress
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Status
                      </TableHead>
                      <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Profile
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                          Loading document center...
                        </TableCell>
                      </TableRow>
                    ) : (tracking?.rows ?? []).map((row) => {
                      const isComplete = row.progress.total > 0 && row.progress.uploaded === row.progress.total;
                      const hasRequests = row.progress.total > 0;

                      return (
                        <TableRow key={row.userId} className="hover:bg-slate-50/70">
                          <TableCell className="px-4 py-4 whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium text-slate-950">{row.fullName}</p>
                              <p className="text-xs text-muted-foreground">@{row.username}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4 font-medium text-slate-700">
                            {row.classOrRole}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                <span>
                                  {row.progress.uploaded}/{row.progress.total || 0}
                                </span>
                                <span className="text-muted-foreground">required uploads</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-slate-100">
                                <div
                                  className="h-2.5 rounded-full bg-slate-900 transition-all"
                                  style={{
                                    width: `${
                                      row.progress.total
                                        ? (row.progress.uploaded / row.progress.total) * 100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            {!hasRequests ? (
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                No active requests
                              </Badge>
                            ) : isComplete ? (
                              <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">
                                <CircleCheckBig className="h-3 w-3" />
                                Complete
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                <CircleOff className="h-3 w-3" />
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-w-24 bg-white"
                              onClick={() => loadProfile(row.userId)}
                              disabled={loadingProfile && profile?.user.userId === row.userId}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loading && !(tracking?.rows.length ?? 0) ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                          No profiles match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profile document review</DialogTitle>
            <DialogDescription>
              View required uploads, timestamps, and download links for one person.
            </DialogDescription>
          </DialogHeader>

          {!profile ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Select a profile from the tracking table.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-3xl border bg-slate-50/80 p-5 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Name</p>
                  <p className="mt-1 font-medium">{profile.user.fullName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Username</p>
                  <p className="mt-1 font-medium">@{profile.user.username}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Class / Role</p>
                  <p className="mt-1 font-medium">{profile.user.classOrRole}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Identifier</p>
                  <p className="mt-1 font-medium">
                    {profile.user.admissionNo ||
                      profile.user.rollNumber ||
                      profile.user.mobileNo ||
                      "Not available"}
                  </p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Required documents</CardTitle>
                  <CardDescription>
                    These are the active requests for this {profile.user.targetGroup}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.requiredDocuments.length ? (
                    profile.requiredDocuments.map((document) => (
                      <div
                        key={document.requestTypeId}
                        className="rounded-3xl border p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{document.typeName}</p>
                              <Badge variant={document.uploaded ? "default" : "outline"}>
                                {document.uploaded ? "Uploaded" : "Not uploaded"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {document.uploaded
                                ? `Uploaded on ${formatDateTime(document.uploadedAt)}`
                                : "Waiting for upload"}
                            </p>
                            {document.fileUrl ? (
                              <a
                                href={document.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                              >
                                <Download className="h-4 w-4" />
                                Preview / download current file
                              </a>
                            ) : null}
                          </div>

                          <div className="grid gap-3 lg:min-w-[280px]">
                            <Input
                              type="file"
                              onChange={(event) =>
                                setUploadFilesByType((current) => ({
                                  ...current,
                                  [document.requestTypeId]: event.target.files?.[0] ?? null,
                                }))
                              }
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() =>
                                  handleProfileUpload(document.requestTypeId, document.typeSlug)
                                }
                                disabled={uploadingTypeId === document.requestTypeId}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                {document.uploaded ? "Replace file" : "Upload file"}
                              </Button>
                              {document.documentId ? (
                                <Button
                                  variant="outline"
                                  disabled={deletingId === document.documentId}
                                  onClick={() =>
                                    handleDelete(
                                      "document",
                                      document.documentId as string,
                                      profile.user.userId,
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No active document requests apply to this profile right now.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Other uploaded documents</CardTitle>
                  <CardDescription>
                    Files stored on this profile that are not part of the active request list.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-2xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profile.otherDocuments.map((document) => (
                          <TableRow key={document.id}>
                            <TableCell>{document.documentType}</TableCell>
                            <TableCell>{document.fileName}</TableCell>
                            <TableCell>{formatDateTime(document.uploadedAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" asChild>
                                  <a href={document.fileUrl} target="_blank" rel="noreferrer">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={deletingId === document.id}
                                  onClick={() =>
                                    handleDelete("document", document.id, profile.user.userId)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!profile.otherDocuments.length ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                              No extra documents on this profile.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
