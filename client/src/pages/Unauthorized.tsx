import { Lock } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-background">
      <div className="max-w-lg w-full bg-card border rounded-lg p-8 text-center">
        <Lock className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-2xl font-semibold">Unauthorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to view this page. If you believe this is
          a mistake, contact your administrator.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    </div>
  );
}
