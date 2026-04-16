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
import { EXAM_TYPE_LABELS } from "@/lib/examStructure";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Mode = "closed" | "open";

type ExamOption = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  academicYear: string;
  classId: string;
  className: string;
  marksEntryMode?: Mode;
};

type ControlPayload = {
  exam: {
    id: string;
    name: string;
    examType: "quarterly" | "half_yearly" | "annual";
    academicYear: string;
    classId: string;
    className: string;
    sessionId: string;
    sessionName: string;
  };
  control: {
    mode: Mode;
    updatedAt: string | null;
    updatedBy: string | null;
    updatedByName: string | null;
  };
};

type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error?: string };

const MODE_LABELS: Record<Mode, string> = {
  closed: "Closed",
  open: "Open",
};

const MODE_HELPER: Record<Mode, string> = {
  closed: "Teachers cannot open marks entry for this class.",
  open: "Assigned teachers can open marks entry and save marks for this class.",
};

const parseJson = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text) return null as T | null;
  return JSON.parse(text) as T;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Not updated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function MarksControlPage() {
  const navigate = useNavigate();
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingControl, setLoadingControl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [controlData, setControlData] = useState<ControlPayload | null>(null);
  const [mode, setMode] = useState<Mode>("closed");

  useEffect(() => {
    const loadExams = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/exam/all");
        const result = await parseJson<ApiResponse<ExamOption[]>>(response);
        if (!response.ok || !result?.success) {
          throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
        }
        setExamOptions(Array.isArray(result.data) ? result.data : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exams");
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadExams();
  }, []);

  useEffect(() => {
    if (!examOptions.length) return;
    if (!examOptions.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(examOptions[0]?.id ?? "");
    }
  }, [examOptions, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) {
      setControlData(null);
      setMode("closed");
      return;
    }

    const loadControl = async () => {
      setLoadingControl(true);
      try {
        const response = await fetch(`/api/exam/marks-control/${selectedExamId}`);
        const result = await parseJson<ApiResponse<ControlPayload>>(response);
        if (!response.ok || !result?.success) {
          throw new Error(result && "error" in result ? result.error || "Failed to load marks control" : "Failed to load marks control");
        }
        setControlData(result.data);
        setMode(result.data.control.mode);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load marks control");
        setControlData(null);
      } finally {
        setLoadingControl(false);
      }
    };

    void loadControl();
  }, [selectedExamId]);

  const handleSave = async () => {
    if (!selectedExamId) {
      toast.error("Select an exam first.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/exam/marks-control/${selectedExamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const result = await parseJson<ApiResponse<undefined>>(response);
      if (!response.ok || !result?.success) {
        throw new Error(result && "error" in result ? result.error || "Failed to save marks control" : "Failed to save marks control");
      }

      toast.success(`Marks entry ${mode === "open" ? "opened" : "closed"} successfully.`);

      const [controlResponse, examsResponse] = await Promise.all([
        fetch(`/api/exam/marks-control/${selectedExamId}`),
        fetch("/api/exam/all"),
      ]);

      const controlResult = await parseJson<ApiResponse<ControlPayload>>(controlResponse);
      const examsResult = await parseJson<ApiResponse<ExamOption[]>>(examsResponse);

      if (controlResponse.ok && controlResult?.success) {
        setControlData(controlResult.data);
        setMode(controlResult.data.control.mode);
      }

      if (examsResponse.ok && examsResult?.success) {
        setExamOptions(Array.isArray(examsResult.data) ? examsResult.data : []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save marks control");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Marks Control">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Marks Control</CardTitle>
            <CardDescription>
              Open or close marks entry for teachers class by class. Admins can still review marks even when entry is closed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-1">
              <label className="text-sm font-medium">Exam / Class</label>
              <select
                value={selectedExamId}
                onChange={(event) => setSelectedExamId(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{loadingOptions ? "Loading exams..." : "Select exam"}</option>
                {examOptions.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} ({EXAM_TYPE_LABELS[exam.examType] ?? exam.examType}) - {exam.className}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                disabled={!selectedExamId}
                onClick={() => navigate(`/dashboard/marks?examId=${encodeURIComponent(selectedExamId)}`)}
              >
                Open Marks Page
              </Button>
            </div>
          </CardContent>
        </Card>

        {loadingControl ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Loading marks control details...
            </CardContent>
          </Card>
        ) : controlData ? (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Entry Status</CardTitle>
                  <CardDescription>{MODE_HELPER[mode]}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(["closed", "open"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={cn(
                          "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                          mode === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent",
                        )}
                      >
                        <div className="font-semibold">{MODE_LABELS[value]}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{MODE_HELPER[value]}</div>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Saving..." : "Save Marks Control"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Selected Class</CardTitle>
                  <CardDescription>Current exam and session details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Class:</span>{" "}
                    <strong>{controlData.exam.className}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exam:</span>{" "}
                    <strong>{controlData.exam.name}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <strong>{EXAM_TYPE_LABELS[controlData.exam.examType] ?? controlData.exam.examType}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Session:</span>{" "}
                    <strong>{controlData.exam.sessionName}</strong>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Latest Update</CardTitle>
                  <CardDescription>Audit details for the current access state.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Current:</span>
                    <Badge variant={controlData.control.mode === "open" ? "default" : "secondary"}>
                      {MODE_LABELS[controlData.control.mode]}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated by:</span>{" "}
                    <strong>{controlData.control.updatedByName ?? "Not available"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated at:</span>{" "}
                    <strong>{formatDateTime(controlData.control.updatedAt)}</strong>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
                <CardDescription>
                  Use this control when you want to allow assigned teachers to enter marks for a class and close it again after submission.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>When status is <strong>Open</strong>, assigned teachers can load the marks screen and save marks for this exam/class.</p>
                <p>When status is <strong>Closed</strong>, teachers are blocked from opening that marks entry screen for this exam/class.</p>
                <p>Admins keep access so corrections and review are still possible.</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Select an exam to manage teacher marks entry.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
