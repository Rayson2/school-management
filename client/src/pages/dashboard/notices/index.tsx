import DashboardLayout from "@/components/DashboardLayout";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import useUserStore from "@/store/user.store";
import { toast } from "sonner";

type NoticeType = "class" | "teacher" | "general";

type NoticeItem = {
  id: string;
  title: string;
  description: string;
  noticeType: NoticeType;
  classId: string | null;
  className: string | null;
  createdByUserId: string;
  createdByName: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
  canEdit?: boolean;
  canDelete?: boolean;
};

type ClassItem = {
  id: string;
  name: string;
};

const formatDateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString() : "N/A";

const typeLabel: Record<NoticeType, string> = {
  class: "Class Notice",
  teacher: "Teacher Notice",
  general: "General Notice",
};

export default function NoticesPage() {
  const user = useUserStore((state) => state.user);
  const userRoles = user?.roles ?? [];
  const canCreate = userRoles.includes("admin") || userRoles.includes("teacher");
  const isAdmin = userRoles.includes("admin");
  const isTeacher = userRoles.includes("teacher");

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [noticeType, setNoticeType] = useState<NoticeType>("general");
  const [classId, setClassId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filterClassId, setFilterClassId] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNoticeType, setEditNoticeType] = useState<NoticeType>("class");
  const [editClassId, setEditClassId] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [updating, setUpdating] = useState(false);

  const createNoticeTypeOptions = useMemo(() => {
    if (isAdmin) {
      return [
        { value: "general" as const, label: typeLabel.general },
        { value: "teacher" as const, label: typeLabel.teacher },
        { value: "class" as const, label: typeLabel.class },
      ];
    }
    return [
      { value: "general" as const, label: typeLabel.general },
      { value: "class" as const, label: typeLabel.class },
    ];
  }, [isAdmin]);

  const editNoticeTypeOptions = useMemo(() => {
    if (isAdmin) return createNoticeTypeOptions;
    return [{ value: "class" as const, label: typeLabel.class }];
  }, [isAdmin, createNoticeTypeOptions]);

  const loadClasses = async () => {
    if (!canCreate) return;
    setLoadingClasses(true);
    try {
      const response = await fetch("/api/class/all");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch classes");
      }
      setClasses(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch classes");
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadNotices = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterClassId) query.set("classId", filterClassId);
      if (filterFromDate) query.set("fromDate", filterFromDate);
      if (filterToDate) query.set("toDate", filterToDate);

      const response = await fetch(`/api/notice/all?${query.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch notices");
      }
      setNotices(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch notices");
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    loadNotices();
  }, []);

  useEffect(() => {
    if (isTeacher && noticeType === "teacher") {
      setNoticeType("class");
    }
  }, [isTeacher, noticeType]);

  const handleCreateNotice = async () => {
    if (!title.trim()) {
      toast.error("Notice title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Notice description is required");
      return;
    }
    if (noticeType === "class" && !classId) {
      toast.error("Please select class for class notice");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("noticeType", noticeType);
      if (noticeType === "class") {
        formData.append("classId", classId);
      }
      if (file) {
        formData.append("attachment", file);
      }

      const response = await fetch("/api/notice/add", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create notice");
      }

      toast.success("Notice created");
      setTitle("");
      setDescription("");
      setClassId("");
      setFile(null);
      await loadNotices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create notice");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (notice: NoticeItem) => {
    setEditingNoticeId(notice.id);
    setEditTitle(notice.title);
    setEditDescription(notice.description);
    setEditNoticeType(notice.noticeType);
    setEditClassId(notice.classId ?? "");
    setEditFile(null);
    setRemoveAttachment(false);
    setEditOpen(true);
  };

  const handleUpdateNotice = async () => {
    if (!editingNoticeId) return;
    if (!editTitle.trim()) {
      toast.error("Notice title is required");
      return;
    }
    if (!editDescription.trim()) {
      toast.error("Notice description is required");
      return;
    }
    if (editNoticeType === "class" && !editClassId) {
      toast.error("Please select class for class notice");
      return;
    }

    setUpdating(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle.trim());
      formData.append("description", editDescription.trim());
      formData.append("noticeType", editNoticeType);
      if (editNoticeType === "class") {
        formData.append("classId", editClassId);
      }
      if (editFile) {
        formData.append("attachment", editFile);
      }
      if (removeAttachment) {
        formData.append("removeAttachment", "true");
      }

      const response = await fetch(`/api/notice/${editingNoticeId}`, {
        method: "PUT",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update notice");
      }

      toast.success("Notice updated");
      setEditOpen(false);
      setEditingNoticeId(null);
      await loadNotices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update notice");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/notice/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete notice");
      }
      toast.success("Notice deleted");
      await loadNotices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete notice");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <DashboardLayout title="Notices">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Notices</h1>

        {canCreate && (
          <Card>
            <CardHeader>
              <CardTitle>Create Notice</CardTitle>
              <CardDescription>
                Add class, teacher-only, or general notice with optional attachment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="notice-title">Title</Label>
                  <Input
                    id="notice-title"
                    placeholder="Notice title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notice-type">Notice Type</Label>
                  <select
                    id="notice-type"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value as NoticeType)}
                  >
                    {createNoticeTypeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notice-description">Description</Label>
                <textarea
                  id="notice-description"
                  className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Write notice details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {noticeType === "class" && (
                <div className="space-y-2">
                  <Label htmlFor="notice-class">Class</Label>
                  <select
                    id="notice-class"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    disabled={loadingClasses}
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notice-file">Attachment (Optional)</Label>
                <Input
                  id="notice-file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button type="button" onClick={handleCreateNotice} disabled={submitting}>
                {submitting ? "Posting..." : "Post Notice"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Notice Board</CardTitle>
            <CardDescription>
              Class notices, teacher notices, and general notices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {canCreate ? (
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                >
                  <option value="">All classes</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div />
              )}
              <Input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
              />
              <Input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={loadNotices} disabled={loading}>
                {loading ? "Loading..." : "Apply Filters"}
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading notices...</p>
            ) : notices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notices found.</p>
            ) : (
              <div className="space-y-2">
                {notices.map((notice) => (
                  <div
                    key={notice.id}
                    className="rounded-md border p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{notice.title}</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {notice.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Type: {typeLabel[notice.noticeType]}
                        {notice.noticeType === "class" && notice.className
                          ? ` | Class: ${notice.className}`
                          : ""}
                        {" | "}
                        By: {notice.createdByName ?? "Unknown"}
                        {" | "}
                        Created: {formatDateTime(notice.createdAt)}
                        {" | "}
                        Updated: {formatDateTime(notice.updatedAt)}
                      </p>
                      {notice.attachmentUrl && (
                        <a
                          href={notice.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {notice.attachmentName || "Open Attachment"}
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {notice.canEdit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(notice)}
                        >
                          Edit
                        </Button>
                      )}
                      {notice.canDelete && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === notice.id}
                          onClick={() => handleDeleteNotice(notice.id)}
                        >
                          {deletingId === notice.id ? "Deleting..." : "Delete"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notice</DialogTitle>
            <DialogDescription>
              Update notice details and attachment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Notice Type</Label>
              <select
                id="edit-type"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={editNoticeType}
                onChange={(e) => setEditNoticeType(e.target.value as NoticeType)}
              >
                {editNoticeTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <textarea
                id="edit-description"
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            {editNoticeType === "class" && (
              <div className="space-y-2">
                <Label htmlFor="edit-class">Class</Label>
                <select
                  id="edit-class"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={editClassId}
                  onChange={(e) => setEditClassId(e.target.value)}
                  disabled={loadingClasses}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-file">New Attachment (Optional)</Label>
              <Input
                id="edit-file"
                type="file"
                onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="remove-attachment"
                type="checkbox"
                checked={removeAttachment}
                onChange={(e) => setRemoveAttachment(e.target.checked)}
              />
              <Label htmlFor="remove-attachment">Remove current attachment</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateNotice} disabled={updating}>
              {updating ? "Updating..." : "Update Notice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
