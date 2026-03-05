import { type ReactNode } from "react";
import useUserStore from "../store/user.store";
import { Navigate } from "react-router";

interface RoleProtectedRouteProps {
  children: ReactNode;
  requiredRoles: string[];
  requireAll?: boolean;
}

const RoleProtectedRoute = ({
  children,
  requiredRoles,
  requireAll = false,
}: RoleProtectedRouteProps) => {
  const userRoles = useUserStore((state) => state.user?.roles) || [];

  const hasAccess = requireAll
    ? requiredRoles.every((role) => userRoles.includes(role))
    : userRoles.some((role) => requiredRoles.includes(role));

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default RoleProtectedRoute;
