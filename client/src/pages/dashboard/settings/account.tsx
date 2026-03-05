import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useUserStore from "@/store/user.store";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ProfileData = {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  roles: string[];
};

export default function AccountSettingsPage() {
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/profile");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch profile");
      }

      const data = result.data as ProfileData;
      setProfile(data);
      setFullName(data.fullName || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update profile");
      }

      updateUser({ fullName: result.data.fullName });
      toast.success("Profile updated successfully");
      await fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      toast.error("Please select a profile image");
      return;
    }

    setSavingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const response = await fetch("/api/auth/profile-pic", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to upload profile image");
      }

      updateUser({ avatarUrl: result.data.avatarUrl });
      setAvatarFile(null);
      toast.success("Profile image updated successfully");
      await fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload profile image");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Current password and new password are required");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <DashboardLayout title="Account Settings">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Account Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your account profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={profile?.username || user?.username || ""} disabled />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
              <Button type="button" variant="outline" onClick={fetchProfile} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>Upload a profile image for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="account-avatar">Image</Label>
              <Input
                id="account-avatar"
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {profile?.avatarUrl && (
              <a
                href={profile.avatarUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-sm break-all"
              >
                View current profile image
              </a>
            )}
            <Button type="button" onClick={handleUploadAvatar} disabled={savingAvatar}>
              {savingAvatar ? "Uploading..." : "Upload Profile Picture"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Teachers can update their passwords here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="button" onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
