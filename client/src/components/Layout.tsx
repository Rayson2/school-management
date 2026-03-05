import { Outlet } from "react-router";
import Navbar from "./Navbar";

const HomepageLayout = () => {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
};

export default HomepageLayout;
