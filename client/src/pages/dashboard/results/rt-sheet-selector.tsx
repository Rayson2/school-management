import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type ExamOption = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  examTypeLabel?: string;
  academicYear: string;
  className?: string;
  status: string;
};

export default function RtSheetSelectorPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/exam/all");
        const result = (await response.json()) as Record<string, unknown>;
        if (!response.ok || !result.success) {
          throw new Error(typeof result.error === "string" ? result.error : "Failed to load exams");
        }

        const rows = Array.isArray(result.data) ? (result.data as ExamOption[]) : [];
        setExams(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exams");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <DashboardLayout title="TR Sheet">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Generate TR Sheet</CardTitle>
          <CardDescription>Select exam to open tabulation sheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Flow: Exam Type {"->"} Class {"->"} Subjects {"->"} TR Sheet
          </p>
          <select
            value={examId}
            onChange={(event) => setExamId(event.target.value)}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            disabled={loading}
          >
            <option value="">{loading ? "Loading exams..." : "Select Exam"}</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.examTypeLabel ?? exam.examType}) - {exam.className ?? "Class"} - {exam.academicYear} - {exam.status}
              </option>
            ))}
          </select>

          <Button disabled={!examId} onClick={() => navigate(`/dashboard/rt-sheet/${examId}`)}>
            Open TR Sheet
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
