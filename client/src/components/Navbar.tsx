import { Link, useLocation } from "react-router";
import {
  Menu,
  GraduationCap,
  Home,
  Info,
  UserPlus,
  Image,
  Phone as ContactIcon,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { label: "Home", href: "/", icon: Home },
    { label: "About", href: "/about", icon: Info },
    { label: "Admission", href: "/admission", icon: UserPlus },
    { label: "Gallery", href: "/gallery", icon: Image },
    { label: "Contact", href: "/contact", icon: ContactIcon },
    {
      label: "Online Daily Assignment",
      href: "/assignments",
      icon: ClipboardList,
    },
  ];

  const quickLinks = [
    { label: "Login", href: "/login" },
    { label: "Student Verify", href: "/student-verify" },
    { label: "TC Verify", href: "/tc-verify" },
    { label: "Admit Card", href: "/admit-card" },
    { label: "Result", href: "/result" },
    { label: "Teacher Activities", href: "/teacher-activities" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="sticky top-0 z-50">
      {/* Top Thin Bar - Marquee + Quick Links */}
      <div className="bg-orange-600 text-white text-sm py-1">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-4 overflow-hidden">
            {/* Marquee on Left */}
            <div className="whitespace-nowrap animate-marquee flex items-center gap-3">
              <span className="font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Hey Students.! Welcome to H.B.R. English Medium School - Bilha
              </span>
              <span className="text-orange-300">|</span>
              <span>You can learn here everything</span>
            </div>

            {/* Quick Links on Right - Thin Bar */}
            <div className="flex items-center gap-3 text-xs whitespace-nowrap">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="hover:text-orange-200 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation - Sticky */}
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  H.B.R. English Medium
                </h1>
                <p className="text-xs text-gray-500">School, Bilha</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                    isActive(link.href)
                      ? "bg-orange-500 text-white"
                      : "text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side - Mobile Menu */}
            <div className="flex items-center gap-2">
              <Button
                asChild
                className="hidden md:flex bg-orange-500 hover:bg-orange-600 text-sm"
              >
                <Link to="/login">Login</Link>
              </Button>

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="flex flex-col h-full">
                    {/* Mobile Logo */}
                    <div className="flex items-center gap-3 p-4 border-b">
                      <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="font-bold text-gray-900">
                          H.B.R. English Medium
                        </h1>
                        <p className="text-xs text-gray-500">School, Bilha</p>
                      </div>
                    </div>

                    {/* Mobile Nav Links */}
                    <div className="flex-1 overflow-y-auto py-4">
                      <div className="space-y-1 px-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">
                          Navigation
                        </p>
                        {navLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg font-medium transition-all ${
                              isActive(link.href)
                                ? "bg-orange-500 text-white"
                                : "text-gray-700 hover:bg-orange-50"
                            }`}
                          >
                            <link.icon className="w-5 h-5" />
                            {link.label}
                          </Link>
                        ))}
                      </div>
                      <hr className="my-4" />
                      <div className="space-y-1 px-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase px-3 mb-2">
                          Quick Links
                        </p>
                        {quickLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-3 rounded-lg font-medium text-gray-700 hover:bg-orange-50 transition-all"
                          >
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Mobile Bottom */}
                    <div className="p-4 border-t">
                      <Button
                        asChild
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Link to="/login">
                          <GraduationCap className="w-4 h-4 mr-2" />
                          Login to Portal
                        </Link>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
