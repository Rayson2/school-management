import axios from "axios";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MessageSquareWarning } from "lucide-react";
import { Link, useNavigate } from "react-router";
import useUserStore from "../store/user.store";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const LoginPage = () => {
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const setAuthChecked = useUserStore((state) => state.setAuthChecked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigator = useNavigate();

  useEffect(() => {
    if (user) navigator("/dashboard");
  }, [navigator, user]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      await axios.post("/api/auth/login", {
        username: username.trim(),
        password: password.trim(),
      }, { withCredentials: true });

      const meResponse = await axios.get("/api/auth/me", { withCredentials: true });
      setUser(meResponse.data.data);
      setAuthChecked(true);

      setError(null);
      navigator("/dashboard");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Login error:", error.response?.data || error.message);
        setError(
          error.response?.data.error || "An error occurred during login",
        );
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-amber-50">
      <Link
        to="/"
        className="absolute top-4 left-4 text-orange-500 font-medium flex items-center gap-2 hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Link>

      <Card className="w-full max-w-md mx-2">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <FieldLabel htmlFor="username" className="-mb-4">
                  Username
                </FieldLabel>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="eg. johndoe12"
                  autoFocus
                  required
                />
              </FieldGroup>

              <FieldGroup>
                <FieldLabel htmlFor="password" className="-mb-4">
                  Password
                </FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </FieldGroup>

              {error && (
                <div className="text-red-500 text-sm flex items-center gap-2 bg-red-50 p-3 rounded">
                  <MessageSquareWarning className="w-4 h-4" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging in...
                  </span>
                ) : (
                  "Login"
                )}
              </Button>
            </form>
          </Field>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
