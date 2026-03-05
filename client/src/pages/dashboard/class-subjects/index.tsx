import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AcademicSessionItem = { id: string; name: string };
type ClassItem = { id: string; name: string };
type SubjectItem = { id: string; name: string; code: string; subjectType?: string | null };
type TeacherItem = { id: string; fullName: string };

type ClassSubjectRow = {
  id: string;
  sessionId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectType: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

export default function ClassSubjectsPage() {
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const [sessions, setSessions] = useState<AcademicSessionItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [rows, setRows] = useState<ClassSubjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkTeacherId, setBulkTeacherId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const fetchClasses = async () => {
    const response = await fetch("/api/class/all");
    const result = await parseJsonResponse(response);
    if (!response.ok || !result.success) {
      throw new Error(typeof result.error === "string" ? result.error : "Failed to fetch classes");
    }
    setClasses(Array.isArray(result.data) ? (result.data as ClassItem[]) : []);
  };

  const fetchSessions = async () => {
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
    if (!sessionId && rows.length > 0) {
      setSessionId(rows[0].id);
    }
  };

  const fetchSubjects = async (currentSessionId: string) => {
    if (!currentSessionId) {
      setSubjects([]);
      return;
    }
    const query = new URLSearchParams({ sessionId: currentSessionId });
    const response = await fetch(`/api/exam/subjects/all?${query.toString()}`);
    const result = await parseJsonResponse(response);
    if (!response.ok || !result.success) {
      throw new Error(typeof result.error === "string" ? result.error : "Failed to fetch subjects");
    }
    setSubjects(Array.isArray(result.data) ? (result.data as SubjectItem[]) : []);
  };

  const fetchTeachers = async () => {
    const response = await fetch("/api/teacher/all");
    const result = await parseJsonResponse(response);
    if (!response.ok || !result.success) {
      throw new Error(typeof result.error === "string" ? result.error : "Failed to fetch teachers");
    }
    const data = Array.isArray(result.data) ? (result.data as Array<{ id: string; fullName: string }>) : [];
    setTeachers(data.map((item) => ({ id: item.id, fullName: item.fullName })));
  };

  const fetchRows = async (currentSessionId: string, currentClassId: string) => {
    if (!currentSessionId || !currentClassId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({
        sessionId: currentSessionId,
        classId: currentClassId,
      });
      const response = await fetch(`/api/exam/class-subjects/all?${query.toString()}`);
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to fetch class subjects",
        );
      }
      setRows(Array.isArray(result.data) ? (result.data as ClassSubjectRow[]) : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch class subjects");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchSessions(), fetchClasses(), fetchTeachers()]).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load dependencies");
    });
  }, []);

  const onSessionChange = (value: string) => {
    setSessionId(value);
  };

  useEffect(() => {
    fetchSubjects(sessionId).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to fetch subjects");
    });
    setSubjectId("");
  }, [sessionId]);

  useEffect(() => {
    fetchRows(sessionId, classId);
  }, [sessionId, classId]);

  const filteredSubjects = useMemo(() => {
    const assigned = new Set(rows.map((row) => row.subjectId));
    return subjects.filter((item) => !assigned.has(item.id) || item.id === subjectId);
  }, [rows, subjects, subjectId]);
  const hasAvailableSubjectToAssign = filteredSubjects.length > 0;

  const assignSubject = async () => {
    if (!sessionId.trim() || !classId || !subjectId) {
      toast.error("Session ID, class and subject are required");
      return;
    }

    setAssigning(true);
    try {
      const response = await fetch("/api/exam/class-subjects/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.trim(),
          classId,
          subjectId,
          teacherId: teacherId || undefined,
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to assign subject");
      }
      toast.success("Subject assigned to class");
      setSubjectId("");
      setTeacherId("");
      await fetchRows(sessionId.trim(), classId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign subject");
    } finally {
      setAssigning(false);
    }
  };

  const removeMapping = async (id: string) => {
    try {
      const response = await fetch(`/api/exam/class-subjects/${id}`, { method: "DELETE" });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to remove mapping");
      }
      toast.success("Mapping removed");
      await fetchRows(sessionId.trim(), classId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove mapping");
    }
  };

  const startEdit = (row: ClassSubjectRow) => {
    setEditingId(row.id);
    setEditSubjectId(row.subjectId);
    setEditTeacherId(row.teacherId ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditSubjectId("");
    setEditTeacherId("");
  };

  const saveEdit = async () => {
    if (!editingId || !editSubjectId) {
      toast.error("Subject is required");
      return;
    }

    setUpdatingId(editingId);
    try {
      const response = await fetch(`/api/exam/class-subjects/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: editSubjectId,
          teacherId: editTeacherId || null,
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to update mapping");
      }
      toast.success("Mapping updated");
      cancelEdit();
      await fetchRows(sessionId.trim(), classId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update mapping");
    } finally {
      setUpdatingId(null);
    }
  };

  const getEditableSubjectOptions = (row: ClassSubjectRow) => {
    const assignedOther = new Set(
      rows.filter((item) => item.id !== row.id).map((item) => item.subjectId),
    );
    return subjects.filter((item) => !assignedOther.has(item.id) || item.id === row.subjectId);
  };

  const assignTeacherToAllSubjects = async () => {
    if (!rows.length) {
      toast.error("No mapped subjects found for selected class/session");
      return;
    }
    if (!bulkTeacherId) {
      toast.error("Select a teacher first");
      return;
    }

    setBulkAssigning(true);
    try {
      const responses = await Promise.all(
        rows.map((row) =>
          fetch(`/api/exam/class-subjects/${row.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teacherId: bulkTeacherId,
            }),
          }),
        ),
      );

      for (const response of responses) {
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to bulk assign teacher",
          );
        }
      }

      toast.success("Teacher assigned to all mapped subjects");
      await fetchRows(sessionId.trim(), classId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to bulk assign teacher");
    } finally {
      setBulkAssigning(false);
    }
  };

  return (
    <DashboardLayout title="Class Subjects">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Class Subject Mapping</h1>

        <Card>
          <CardHeader>
            <CardTitle>Assign Subject</CardTitle>
            <CardDescription>Map subject to class within academic session.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Academic Session *</Label>
              <Select value={sessionId || undefined} onValueChange={onSessionChange}>
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
              <Label htmlFor="classId">Class *</Label>
              <select
                id="classId"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
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
              <Label htmlFor="subjectId">Subject *</Label>
              <select
                id="subjectId"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">Select subject</option>
                {filteredSubjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
              {!hasAvailableSubjectToAssign && classId && sessionId && (
                <p className="text-xs text-muted-foreground">
                  All subjects are already mapped for this class in the selected session.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacherId">Teacher (Optional)</Label>
              <select
                id="teacherId"
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
              >
                <option value="">Unassigned</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                disabled={assigning || !hasAvailableSubjectToAssign}
                onClick={assignSubject}
              >
                {assigning ? "Assigning..." : "Assign Subject"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mapped Subjects</CardTitle>
            <CardDescription>
              {loading ? "Loading..." : `Total mappings: ${rows.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="min-w-56 space-y-1">
                <Label htmlFor="bulkTeacherId">Assign Teacher To All Subjects</Label>
                <select
                  id="bulkTeacherId"
                  value={bulkTeacherId}
                  onChange={(event) => setBulkTeacherId(event.target.value)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  disabled={rows.length === 0}
                >
                  <option value="">Select teacher</option>
                  {teachers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                onClick={assignTeacherToAllSubjects}
                disabled={bulkAssigning || rows.length === 0 || !bulkTeacherId}
              >
                {bulkAssigning ? "Assigning..." : "Assign To All"}
              </Button>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mappings found for selected session/class.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-left">Subject</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Teacher</th>
                      <th className="px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b">
                        <td className="px-3 py-2">{row.className}</td>
                        <td className="px-3 py-2">
                          {editingId === row.id ? (
                            <select
                              value={editSubjectId}
                              onChange={(event) => setEditSubjectId(event.target.value)}
                              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                            >
                              <option value="">Select subject</option>
                              {getEditableSubjectOptions(row).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.code})
                                </option>
                              ))}
                            </select>
                          ) : (
                            row.subjectName
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editingId === row.id
                            ? subjects.find((item) => item.id === editSubjectId)?.code ?? "-"
                            : row.subjectCode}
                        </td>
                        <td className="px-3 py-2">
                          {editingId === row.id
                            ? subjects.find((item) => item.id === editSubjectId)?.subjectType ?? "-"
                            : row.subjectType ?? "-"}
                        </td>
                        <td className="px-3 py-2">
                          {editingId === row.id ? (
                            <select
                              value={editTeacherId}
                              onChange={(event) => setEditTeacherId(event.target.value)}
                              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                            >
                              <option value="">Unassigned</option>
                              {teachers.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.fullName}
                                </option>
                              ))}
                            </select>
                          ) : (
                            row.teacherName ?? "Unassigned"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            {editingId === row.id ? (
                              <>
                                <Button type="button" onClick={saveEdit} disabled={updatingId === row.id}>
                                  {updatingId === row.id ? "Saving..." : "Save"}
                                </Button>
                                <Button type="button" variant="outline" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button type="button" variant="outline" onClick={() => startEdit(row)}>
                                  Edit
                                </Button>
                                <Button type="button" variant="destructive" onClick={() => removeMapping(row.id)}>
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
