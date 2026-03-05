import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";

type ClassItem = {
  id: string;
  name: string;
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/class/all");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch classes");
      }
      setClasses(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const startEdit = (item: ClassItem) => {
    setEditId(item.id);
    setEditName(item.name);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/class/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update class");
      }
      setEditId(null);
      setEditName("");
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update class");
    } finally {
      setSaving(false);
    }
  };

  const deleteClass = async (id: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/class/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete class");
      }
      await loadClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete class");
    }
  };

  return (
    <DashboardLayout title="Classes">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">List of Classes</h1>
          <Button variant="outline" onClick={loadClasses} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </Button>
        </div>

        {error && <p className="text-red-500">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {editId === item.id ? (
                        <Input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      ) : (
                        item.name
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editId === item.id ? (
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
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteClass(item.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && classes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="h-16 text-center">
                      No classes found.
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
