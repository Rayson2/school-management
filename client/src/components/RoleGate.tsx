import { type ReactNode } from "react";
import useUserStore from "../store/user.store";

interface RoleGateProps {
  requiredRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean;
}

const RoleGate = ({
  requiredRoles,
  children,
  fallback = null,
  requireAll = false,
}: RoleGateProps) => {
  const userRoles = useUserStore((state) => state.user?.roles) || [];

  const hasAccess = requireAll
    ? requiredRoles.every((role) => userRoles.includes(role))
    : userRoles.some((role) => requiredRoles.includes(role));

  return hasAccess ? children : fallback;
};

export default RoleGate;
