import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Calendar,
  BookOpen,
  Clock,
  CheckCircle,
  ArrowRight,
  Download,
} from "lucide-react";

const AssignmentsPage = () => {
  const assignments = [
    {
      id: 1,
      class: "Class 10",
      subject: "Mathematics",
      title: "Chapter 5: Quadratic Equations",
      description: "Solve all questions from Exercise 5.1 to 5.5",
      dueDate: "2026-03-05",
      status: "Pending",
      marks: 10,
    },
    {
      id: 2,
      class: "Class 10",
      subject: "Science",
      title: "Chemical Reactions and Equations",
      description: "Complete the lab report for experiment 3",
      dueDate: "2026-03-07",
      status: "Pending",
      marks: 15,
    },
    {
      id: 3,
      class: "Class 10",
      subject: "English",
      title: "Grammar: Active and Passive Voice",
      description: "Complete all exercises from page 45-50",
      dueDate: "2026-03-10",
      status: "Pending",
      marks: 10,
    },
    {
      id: 4,
      class: "Class 9",
      subject: "Mathematics",
      title: "Number Systems",
      description: "Practice problems from exercise 1.2",
      dueDate: "2026-03-04",
      status: "Submitted",
      marks: 10,
    },
  ];

  const upcomingExams = [
    {
      id: 1,
      class: "Class 10",
      subject: "Mathematics",
      date: "2026-03-15",
      time: "10:00 AM",
    },
    {
      id: 2,
      class: "Class 10",
      subject: "Science",
      date: "2026-03-18",
      time: "10:00 AM",
    },
    {
      id: 3,
      class: "Class 10",
      subject: "English",
      date: "2026-03-20",
      time: "10:00 AM",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="relative py-16 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              <ClipboardList className="w-4 h-4 mr-2" />
              Online Assignments
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Daily Assignments
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Access your daily assignments and track your academic progress
            </p>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-8 -mt-8 relative z-10">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-orange-100">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-6 h-6 text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900">4</p>
                <p className="text-gray-600">Pending Assignments</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">15</p>
                <p className="text-gray-600">Submitted</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">3</p>
                <p className="text-gray-600">Upcoming Exams</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Assignments List */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Your Assignments
            </h2>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          </div>

          <div className="space-y-4">
            {assignments.map((assignment) => (
              <Card key={assignment.id} className="border-orange-100">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-orange-500">
                          {assignment.class}
                        </Badge>
                        <Badge variant="outline">{assignment.subject}</Badge>
                        <Badge
                          className={
                            assignment.status === "Submitted"
                              ? "bg-green-500"
                              : "bg-yellow-500"
                          }
                        >
                          {assignment.status}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {assignment.title}
                      </h3>
                      <p className="text-gray-600 mb-2">
                        {assignment.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Due: {assignment.dueDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          Marks: {assignment.marks}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-orange-500 text-orange-500 hover:bg-orange-50"
                      >
                        View Details
                      </Button>
                      {assignment.status === "Pending" && (
                        <Button className="bg-orange-500 hover:bg-orange-600">
                          Submit
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Exams */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Upcoming Exams
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {upcomingExams.map((exam) => (
              <Card key={exam.id} className="border-orange-100">
                <CardContent className="p-6 text-center">
                  <Badge className="mb-4 bg-orange-500">{exam.class}</Badge>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {exam.subject}
                  </h3>
                  <p className="text-gray-600 flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {exam.date}
                  </p>
                  <p className="text-gray-500 flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" />
                    {exam.time}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Login CTA */}
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <Card className="border-orange-100 max-w-2xl mx-auto">
            <CardContent className="p-8">
              <ClipboardList className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Student Login Required
              </h2>
              <p className="text-gray-600 mb-6">
                Please login to access your personalized assignments and track
                your academic progress.
              </p>
              <Button asChild className="bg-orange-500 hover:bg-orange-600">
                <Link to="/login">
                  Login to Continue
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default AssignmentsPage;
