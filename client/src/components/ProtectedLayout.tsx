import { useEffect, useState } from "react";
import useUserStore from "../store/user.store";
import axios from "axios";
import { Outlet, useNavigate } from "react-router";
import PageLoader from "./PageLoader";

const ProtectedLayout = () => {
  const user = useUserStore((state) => state.user);
  const authChecked = useUserStore((state) => state.authChecked);
  const setUser = useUserStore((state) => state.setUser);
  const setAuthChecked = useUserStore((state) => state.setAuthChecked);
  const clearUser = useUserStore((state) => state.clearUser);
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(!authChecked);

  useEffect(() => {
    if (authChecked) {
      if (!user) navigate("/login");
      return;
    }

    setIsChecking(true);
    axios
      .get("/api/auth/me", { withCredentials: true })
      .then((response) => {
        setUser(response.data.data);
      })
      .catch((error) => {
        console.log(
          "User not authenticated:",
          error.response?.data || error.message,
        );
        clearUser();
        navigate("/login");
      })
      .finally(() => {
        setAuthChecked(true);
        setIsChecking(false);
      });
  }, [authChecked, clearUser, navigate, setAuthChecked, setUser, user]);

  if (isChecking) return <PageLoader />;
  return <Outlet />;
};

export default ProtectedLayout;
