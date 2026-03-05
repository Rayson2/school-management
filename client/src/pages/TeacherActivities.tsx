import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GraduationCap,
  Calendar,
  FileText,
  Users,
  BookOpen,
  Clock,
  CheckCircle,
  ArrowLeft,
  Download,
  Upload,
} from "lucide-react";

const TeacherActivitiesPage = () => {
  const upcomingTasks = [
    {
      id: 1,
      title: "Submit Mid-Term Marks",
      description: "Enter marks for Class 10 Mathematics",
      dueDate: "2026-03-10",
      priority: "High",
      status: "Pending",
    },
    {
      id: 2,
      title: "Upload Lesson Plans",
      description: "Week 10 lesson plans for all classes",
      dueDate: "2026-03-08",
      priority: "Medium",
      status: "Pending",
    },
    {
      id: 3,
      title: "Attendance Report",
      description: "Monthly attendance compilation",
      dueDate: "2026-03-05",
      priority: "High",
      status: "Completed",
    },
  ];

  const notices = [
    {
      id: 1,
      title: "Staff Meeting",
      date: "2026-03-05",
      description: "Monthly staff meeting at 2:00 PM in the staff room",
    },
    {
      id: 2,
      title: "Workshop on Digital Education",
      date: "2026-03-12",
      description: "Mandatory workshop on modern teaching methods",
    },
    {
      id: 3,
      title: "Result Submission Deadline",
      date: "2026-03-15",
      description: "Final date for mid-term result submission",
    },
  ];

  const resources = [
    { name: "Teacher's Handbook 2025-26", size: "2.5 MB", downloads: 45 },
    { name: "Lesson Plan Template", size: "500 KB", downloads: 120 },
    { name: "Exam Guidelines", size: "1.2 MB", downloads: 89 },
    { name: "Attendance Sheet Format", size: "250 KB", downloads: 156 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              <GraduationCap className="w-4 h-4 mr-2" />
              Teacher Portal
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Teacher Activities
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Access teaching resources, submit reports, and stay updated
            </p>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-8 -mt-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-orange-100 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-orange-500" />
                </div>
                <p className="font-semibold text-gray-900">Upload Marks</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-orange-500" />
                </div>
                <p className="font-semibold text-gray-900">Lesson Plans</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-orange-500" />
                </div>
                <p className="font-semibold text-gray-900">Attendance</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-orange-500" />
                </div>
                <p className="font-semibold text-gray-900">Schedule</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Tasks */}
            <div className="lg:col-span-2 space-y-6">
              {/* Upcoming Tasks */}
              <Card className="border-orange-100">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-500" />
                    Upcoming Tasks
                  </h2>
                  <div className="space-y-4">
                    {upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between p-4 bg-orange-50 rounded-lg"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {task.title}
                            </h3>
                            <Badge
                              className={
                                task.priority === "High"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                              }
                            >
                              {task.priority}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm">
                            {task.description}
                          </p>
                          <p className="text-gray-500 text-sm flex items-center gap-1 mt-2">
                            <Clock className="w-3 h-3" />
                            Due: {task.dueDate}
                          </p>
                        </div>
                        {task.status === "Completed" ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600"
                          >
                            Submit
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Notices */}
              <Card className="border-orange-100">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    Important Notices
                  </h2>
                  <div className="space-y-4">
                    {notices.map((notice) => (
                      <div
                        key={notice.id}
                        className="p-4 border border-orange-100 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {notice.title}
                          </h3>
                          <Badge className="bg-orange-500">{notice.date}</Badge>
                        </div>
                        <p className="text-gray-600 text-sm">
                          {notice.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Resources */}
            <div>
              <Card className="border-orange-100">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-orange-500" />
                    Resources
                  </h2>
                  <div className="space-y-3">
                    {resources.map((resource, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {resource.name}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {resource.size}
                          </p>
                        </div>
                        <Download className="w-4 h-4 text-orange-500" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="border-orange-100 mt-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Quick Links
                  </h2>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start border-orange-500 text-orange-500 hover:bg-orange-50"
                      asChild
                    >
                      <Link to="/login">Teacher Login</Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start border-orange-500 text-orange-500 hover:bg-orange-50"
                      asChild
                    >
                      <Link to="/contact">Contact Admin</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Login CTA */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <Card className="border-orange-100 max-w-lg mx-auto">
            <CardContent className="p-8">
              <GraduationCap className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Teacher Login Required
              </h2>
              <p className="text-gray-600 mb-6">
                Please login to access the teacher dashboard for marks entry,
                attendance, and more.
              </p>
              <Button asChild className="bg-orange-500 hover:bg-orange-600">
                <Link to="/login">Login to Teacher Portal</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default TeacherActivitiesPage;
