import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import useUserStore from "@/store/user.store";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export function UserProfileDropdown() {
  const user = useUserStore((state) => state.user);
  const clearUser = useUserStore((state) => state.clearUser);
  const navigate = useNavigate();

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "U";

  function handleLogout() {
    axios
      .delete("/api/auth/logout")
      .then(() => {
        clearUser();
        toast.success("Logged out successfully! Redirecting to homepage...");
        setTimeout(() => navigate("/"), 1000);
      })
      .catch((error) => {
        toast.error(
          error.response?.data?.error || "An error occurred during logout"
        );
      });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 h-9 px-2 hover:bg-accent"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.avatarUrl} alt={user?.username} />
            <AvatarFallback className="text-xs font-semibold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">
              {user?.fullName ?? "User"}
            </span>
            <span className="text-xs text-muted-foreground">
              {user?.username ?? "Username does not exist"}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* Profile card header */}
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={user?.avatarUrl} alt={user?.username} />
              <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-semibold leading-none truncate">
                {user?.fullName ?? "User"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                @{user?.username}
              </p>
              {user?.roles && user.roles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {user.roles.map((role) => (
                    <Badge
                      key={role}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 capitalize"
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => navigate("/dashboard/settings/profile")}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate("/dashboard/settings/account")}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}