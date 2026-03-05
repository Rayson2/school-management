import { AppSidebar } from "@/components/dashboard/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LayoutDashboard } from "lucide-react";
import { UserProfileDropdown } from "@/components/dashboard/UserProfileDropdown";

function DashboardLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    {title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2">
            <Separator orientation="vertical" className="h-6" />
            <UserProfileDropdown />
          </div>
        </header>

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default DashboardLayout;
