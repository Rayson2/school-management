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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState, type FormEvent } from "react";
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

const fetchWithFallback = async (
  primaryUrl: string,
  fallbackUrl: string,
  init?: RequestInit,
) => {
  const first = await fetch(primaryUrl, init);
  if (first.status !== 404) return first;
  return fetch(fallbackUrl, init);
};

export default function AddSubjectPage() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [sessions, setSessions] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [subjectType, setSubjectType] = useState<"" | "theory" | "practical" | "activity">("");
  const [submitting, setSubmitting] = useState(false);

  const loadSessions = async () => {
    try {
      const response = await fetch("/api/academic-session/all");
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to fetch academic sessions",
        );
      }
      const rows = Array.isArray(result.data)
        ? (result.data as Array<{ id: string; name: string }>)
        : [];
      setSessions(rows);
      if (!sessionId && rows.length > 0) {
        setSessionId(rows[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch academic sessions");
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const onSessionChange = (value: string) => {
    setSessionId(value);
  };

  const submitSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId.trim() || !name.trim() || !code.trim()) {
      toast.error("Session ID, subject name and code are required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = JSON.stringify({
        sessionId: sessionId.trim(),
        name: name.trim(),
        code: code.trim(),
        subjectType: subjectType || undefined,
      });

      const response = await fetchWithFallback(
        "/api/exam/subjects/create",
        "/api/exam/subject/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );

      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Failed to create subject",
        );
      }

      toast.success("Subject created");
      setName("");
      setCode("");
      setSubjectType("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create subject");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Add Subject">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Add Subject</h1>

        <form className="space-y-6" onSubmit={submitSubject}>
          <Card>
            <CardHeader>
              <CardTitle>Subject Details</CardTitle>
              <CardDescription>
                Create a subject for an academic session. Duplicate names are blocked within the same session.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="name">Subject Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Mathematics"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Subject Code *</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="MATH-101"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subjectType">Subject Type</Label>
                <select
                  id="subjectType"
                  value={subjectType}
                  onChange={(event) =>
                    setSubjectType(event.target.value as "" | "theory" | "practical" | "activity")
                  }
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">None</option>
                  <option value="theory">Theory</option>
                  <option value="practical">Practical</option>
                  <option value="activity">Activity</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Subject"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard/exams/add")}
            >
              Back to Add Exam
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
