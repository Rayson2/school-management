import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [enrollmentPrefix, setEnrollmentPrefix] = useState("");
  const [creating, setCreating] = useState(false);

  const createSession = async () => {
    if (!newName.trim()) {
      toast.error("Session name is required");
      return;
    }
    if (!enrollmentPrefix.trim()) {
      toast.error("Enrollment prefix is required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/academic-session/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          enrollmentPrefix: enrollmentPrefix.trim().toUpperCase(),
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to create academic session",
        );
      }
      toast.success("Academic session created");
      setNewName("");
      setEnrollmentPrefix("");
      navigate("/dashboard/sessions");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create academic session");
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout title="Create Session">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Create Academic Session</h1>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>New Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full"
            />
            <Input
              value={enrollmentPrefix}
              onChange={(event) => setEnrollmentPrefix(event.target.value)}
              placeholder='Enrollment prefix, e.g. "HBR250"'
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Students in this session get auto-generated enrollment numbers like `HBR2500001`.
            </p>
            <div className="flex gap-2">
              <Button type="button" onClick={createSession} disabled={creating}>
                {creating ? "Creating..." : "Create Session"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/dashboard/sessions")}>
                Back to Manage Sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
