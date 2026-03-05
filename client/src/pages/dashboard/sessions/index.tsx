import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type SessionItem = {
  id: string;
  name: string;
  enrollmentPrefix: string;
  createdAt?: string | null;
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

export default function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnrollmentPrefix, setEditEnrollmentPrefix] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const q = query.trim();
      const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
      const response = await fetch(`/api/academic-session/all${suffix}`);
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to fetch academic sessions",
        );
      }
      setSessions(Array.isArray(result.data) ? (result.data as SessionItem[]) : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch academic sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const startEdit = (row: SessionItem) => {
    setEditId(row.id);
    setEditName(row.name);
    setEditEnrollmentPrefix(row.enrollmentPrefix ?? "");
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim() || !editEnrollmentPrefix.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/academic-session/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          enrollmentPrefix: editEnrollmentPrefix.trim().toUpperCase(),
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to update academic session",
        );
      }
      setEditId(null);
      setEditName("");
      setEditEnrollmentPrefix("");
      toast.success("Academic session updated");
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update academic session");
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      const response = await fetch(`/api/academic-session/${id}`, {
        method: "DELETE",
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to delete academic session",
        );
      }
      toast.success("Academic session deleted");
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete academic session");
    }
  };

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.name.localeCompare(b.name)),
    [sessions],
  );

  return (
    <DashboardLayout title="Academic Sessions">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Academic Sessions</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSessions} disabled={loading}>
              {loading ? "Loading..." : "Reload"}
            </Button>
            <Button onClick={() => navigate("/dashboard/sessions/create")}>
              Create Session
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by session name"
                className="w-full md:w-72"
              />
              <Button type="button" variant="outline" onClick={loadSessions} disabled={loading}>
                Search
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Enrollment Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSessions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {editId === row.id ? (
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      ) : (
                        row.name
                      )}
                    </TableCell>
                    <TableCell>
                      {editId === row.id ? (
                        <Input
                          value={editEnrollmentPrefix}
                          onChange={(event) => setEditEnrollmentPrefix(event.target.value)}
                        />
                      ) : (
                        row.enrollmentPrefix
                      )}
                    </TableCell>
                    <TableCell>
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editId === row.id ? (
                          <>
                            <Button size="sm" onClick={saveEdit} disabled={saving}>
                              {saving ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditId(null);
                                setEditName("");
                                setEditEnrollmentPrefix("");
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteSession(row.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && sortedSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-16 text-center">
                      No academic sessions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
