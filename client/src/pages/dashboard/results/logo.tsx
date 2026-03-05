import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type LogoResponse = {
  logoUrl: string | null;
};

export default function ResultLogoPage() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchLogo = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/results/logo");
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: LogoResponse;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch result logo");
      }

      setLogoUrl(result.data?.logoUrl ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch result logo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogo();
  }, []);

  const handleUpload = async () => {
    if (!logoFile) {
      toast.error("Please select a logo image");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      const response = await fetch("/api/results/logo", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { logoUrl: string };
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload result logo");
      }

      setLogoUrl(result.data?.logoUrl ?? null);
      setLogoFile(null);
      toast.success("Result logo uploaded successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload result logo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout title="Result Logo">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Result Logo</h1>

        <Card>
          <CardHeader>
            <CardTitle>Upload Logo</CardTitle>
            <CardDescription>
              This logo will be used on the official result marksheet header.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="result-logo">Logo Image</Label>
              <Input
                id="result-logo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload Logo"}
              </Button>
              <Button type="button" variant="outline" onClick={fetchLogo} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Logo</CardTitle>
          </CardHeader>
          <CardContent>
            {logoUrl ? (
              <a href={logoUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img src={logoUrl} alt="Result logo" className="h-20 w-20 rounded border object-contain p-1" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No result logo uploaded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
