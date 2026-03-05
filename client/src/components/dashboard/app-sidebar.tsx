import * as React from "react";
import { NavLink, useLocation } from "react-router";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  ScrollText,
  Layers,
  LibraryBig,
  FolderOpen,
  Settings,
  ChevronDown,
  School,
  Banknote,
  HandCoins,
  Bell,
  MapPin,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import RoleGate from "../RoleGate";

interface NavItem {
  title: string;
  icon: React.ElementType;
  requiredRoles?: string[];
  subItems: Array<{
    title: string;
    url: string;
    requiredRoles?: string[];
  }>;
}

const navData: NavItem[] = [
  {
    title: "Home",
    icon: LayoutDashboard,
    subItems: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "Students",
    icon: GraduationCap,
    requiredRoles: ["admin"],
    subItems: [
      { title: "List of Students", url: "/dashboard/students" },
      { title: "Add Student", url: "/dashboard/students/add" },
    ],
  },
  {
    title: "Teachers",
    icon: Users,
    requiredRoles: ["admin"],
    subItems: [
      { title: "List of Teachers", url: "/dashboard/teachers" },
      { title: "Add Teacher", url: "/dashboard/teachers/add" },
    ],
  },
  {
    title: "Records",
    icon: ScrollText,
    requiredRoles: ["admin", "teacher"],
    subItems: [
      { title: "Student & Teacher Records", url: "/dashboard/records", requiredRoles: ["admin", "teacher"] },
    ],
  },
  {
    title: "Classes",
    icon: BookOpen,
    requiredRoles: ["admin"],
    subItems: [
      { title: "List of Classes", url: "/dashboard/classes" },
      { title: "Add Class", url: "/dashboard/classes/add" },
    ],
  },
  {
    title: "Sessions",
    icon: CalendarDays,
    requiredRoles: ["admin"],
    subItems: [
      { title: "Manage Sessions", url: "/dashboard/sessions" },
      { title: "Create Session", url: "/dashboard/sessions/create" },
    ],
  },
  {
    title: "Exams",
    icon: ClipboardList,
    requiredRoles: ["admin"],
    subItems: [
      { title: "List of Exams", url: "/dashboard/exams" },
      { title: "Add Exam", url: "/dashboard/exams/add" },
      { title: "Admit Card", url: "/dashboard/exams/admit-card", requiredRoles: ["admin"] },
    ],
  },
  {
    title: "Subjects",
    icon: LibraryBig,
    requiredRoles: ["admin"],
    subItems: [
      { title: "Add Subject", url: "/dashboard/subjects/add" },
      { title: "Class Subjects", url: "/dashboard/class-subjects" },
    ],
  },
  {
    title: "Front CMS",
    icon: Layers,
    requiredRoles: ["admin"],
    subItems: [
      { title: "Carousel", url: "/dashboard/cms/carousel" },
      { title: "Gallery", url: "/dashboard/cms/gallery" },
      { title: "Certificate", url: "/dashboard/cms/certificate" },
    ],
  },
  {
    title: "Documents",
    icon: FolderOpen,
    requiredRoles: ["admin"],
    subItems: [{ title: "Manage Documents", url: "/dashboard/documents" }],
  },
  {
    title: "Marks",
    icon: ClipboardCheck,
    requiredRoles: ["admin", "teacher"],
    subItems: [{ title: "Enter Marks", url: "/dashboard/marks" }],
  },
  {
    title: "Attendance",
    icon: MapPin,
    requiredRoles: ["admin", "teacher"],
    subItems: [
      { title: "Attendance Setup", url: "/dashboard/attendance", requiredRoles: ["admin"] },
      { title: "Attendance Records", url: "/dashboard/attendance/records", requiredRoles: ["admin", "teacher"] },
    ],
  },
  {
    title: "Fees",
    icon: HandCoins,
    requiredRoles: ["admin"],
    subItems: [
      { title: "Student Fees", url: "/dashboard/fees", requiredRoles: ["admin"] },
      { title: "Monthly Fee Records", url: "/dashboard/fees/records", requiredRoles: ["admin"] },
    ],
  },
  {
    title: "Payroll",
    icon: Banknote,
    requiredRoles: ["admin", "teacher"],
    subItems: [
      { title: "Payroll List", url: "/dashboard/payroll", requiredRoles: ["admin"] },
      { title: "Add Payroll", url: "/dashboard/payroll/add", requiredRoles: ["admin"] },
      { title: "Salary Slips", url: "/dashboard/payroll/slips", requiredRoles: ["admin", "teacher"] },
    ],
  },
  {
    title: "Results",
    icon: ScrollText,
    requiredRoles: ["admin", "student"],
    subItems: [
      { title: "My Results", url: "/dashboard/my-results", requiredRoles: ["student"] },
      { title: "RT Sheet", url: "/dashboard/rt-sheet", requiredRoles: ["admin"] },
      { title: "Result Logo", url: "/dashboard/results/logo", requiredRoles: ["admin"] },
    ],
  },
  {
    title: "Notices",
    icon: Bell,
    requiredRoles: ["admin", "teacher", "student"],
    subItems: [{ title: "Notice Board", url: "/dashboard/notices" }],
  },
  {
    title: "Settings",
    icon: Settings,
    subItems: [
      { title: "Profile Settings", url: "/dashboard/settings/profile" },
      {
        title: "Account Settings",
        url: "/dashboard/settings/account",
        requiredRoles: ["admin"],
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      navData.forEach((item) => {
        const hasActive = item.subItems.some(
          (sub) => sub.url === location.pathname
        );
        initial[item.title] = hasActive;
      });
      return initial;
    }
  );

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <Sidebar {...props} className="border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <School className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sm text-sidebar-foreground">
              EduAdmin
            </span>
            <span className="text-xs text-muted-foreground">
              School Management
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {navData.map((group) => {
          const Icon = group.icon;
          const isOpen = openGroups[group.title] ?? false;
          const isGroupActive = group.subItems.some(
            (sub) => sub.url === location.pathname
          );
          const hasMultiplePages = group.subItems.length > 1;

          if (!hasMultiplePages) {
            const sub = group.subItems[0];
            const isActive = location.pathname === sub.url;

            const singleItemContent = (
              <SidebarGroup key={group.title} className="mb-1 p-0">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <NavLink to={sub.url}>
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <span>{group.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            );

            const singleItemWithSubRole = sub.requiredRoles ? (
              <RoleGate key={`gate-${sub.url}`} requiredRoles={sub.requiredRoles}>
                {singleItemContent}
              </RoleGate>
            ) : (
              singleItemContent
            );

            if (group.requiredRoles) {
              return (
                <RoleGate
                  key={`gate-${group.title}`}
                  requiredRoles={group.requiredRoles}
                >
                  {singleItemWithSubRole}
                </RoleGate>
              );
            }

            return singleItemWithSubRole;
          }

          const groupContent = (
            <SidebarGroup key={group.title} className="mb-1 p-0">
              <SidebarGroupLabel asChild className="px-0 py-0 h-auto mb-0.5">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isGroupActive && !isOpen
                      ? "text-primary"
                      : "text-sidebar-foreground/80"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isGroupActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="flex-1 text-left">{group.title}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
              </SidebarGroupLabel>

              {isOpen && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.subItems.map((sub) => {
                      const isActive = location.pathname === sub.url;

                      const menuItem = (
                        <SidebarMenuItem key={sub.url}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={cn(
                              "ml-3 pl-6 relative text-sm transition-all duration-150",
                              "before:absolute before:left-2 before:top-1/2 before:-translate-y-1/2",
                              "before:h-3.5 before:w-px before:bg-border",
                              isActive
                                ? "bg-primary/10 text-primary font-medium hover:bg-primary/15"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            <NavLink to={sub.url}>
                              {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                              )}
                              {sub.title}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );

                      if (sub.requiredRoles) {
                        return (
                          <RoleGate
                            key={`gate-${sub.url}`}
                            requiredRoles={sub.requiredRoles}
                          >
                            {menuItem}
                          </RoleGate>
                        );
                      }

                      return menuItem;
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );

          if (group.requiredRoles) {
            return (
              <RoleGate
                key={`gate-${group.title}`}
                requiredRoles={group.requiredRoles}
              >
                {groupContent}
              </RoleGate>
            );
          }

          return groupContent;
        })}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
