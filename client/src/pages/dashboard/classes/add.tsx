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
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export default function AddClassPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Class name is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/class/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to add class");
      }
      toast.success("Class created successfully");
      navigate("/dashboard/classes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add class");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Add Class">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Add Class</h1>
        <Card>
          <CardHeader>
            <CardTitle>Create Class</CardTitle>
            <CardDescription>Add a class for student mapping.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="class-name">Class Name</Label>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Class 10-A"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Class"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard/classes")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
