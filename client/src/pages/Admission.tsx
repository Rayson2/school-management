import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GraduationCap,
  Calendar,
  CheckCircle,
  ArrowRight,
  User,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Clock,
  DollarSign,
  FileText,
  Users,
  Award,
} from "lucide-react";

const AdmissionPage = () => {
  const admissionProcess = [
    {
      step: 1,
      title: "Online Registration",
      description: "Fill out the registration form with required details",
      icon: FileText,
    },
    {
      step: 2,
      title: "Document Submission",
      description: "Submit necessary documents for verification",
      icon: Users,
    },
    {
      step: 3,
      title: "Interaction Session",
      description: "Attend the student and parent interaction",
      icon: Calendar,
    },
    {
      step: 4,
      title: "Fee Payment",
      description: "Pay the admission fee to confirm the seat",
      icon: DollarSign,
    },
  ];

  const eligibility = [
    {
      class: "Nursery",
      age: "3-4 years",
      criteria: "Basic interaction",
    },
    {
      class: "LKG",
      age: "4-5 years",
      criteria: "Basic interaction",
    },
    {
      class: "UKG",
      age: "5-6 years",
      criteria: "Basic interaction",
    },
    {
      class: "Class 1",
      age: "6-7 years",
      criteria: "Previous school TC",
    },
    {
      class: "Class 2-10",
      age: "Varies",
      criteria: "Transfer Certificate + Academic Records",
    },
  ];

  const requiredDocuments = [
    "Birth Certificate",
    "Passport size photos (4)",
    "Aadhar Card (Student & Parents)",
    "Previous School TC",
    "Academic Records",
    "Caste Certificate (if applicable)",
    "Income Certificate (for fee concession)",
  ];

  const feeStructure = [
    {
      class: "Nursery - UKG",
      admissionFee: "₹5,000",
      tuitionFee: "₹2,500/month",
    },
    {
      class: "Class 1-5",
      admissionFee: "₹7,500",
      tuitionFee: "₹3,000/month",
    },
    {
      class: "Class 6-10",
      admissionFee: "₹10,000",
      tuitionFee: "₹3,500/month",
    },
  ];

  const facilities = [
    "Smart Classrooms",
    "Computer Lab",
    "Science Labs",
    "Library",
    "Sports Facilities",
    "Transport Service",
    "Medical Facility",
    "Cafeteria",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              Admissions Open
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Join Our Community
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Give your child the gift of quality education at H.B.R. English
              Medium School
            </p>
          </div>
        </div>
      </section>

      {/* Quick Info Cards */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-6 text-center">
                <Calendar className="w-10 h-10 text-orange-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">
                  Academic Year 2026-27
                </h3>
                <p className="text-gray-600 text-sm">
                  Admissions now open for all classes
                </p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-6 text-center">
                <Clock className="w-10 h-10 text-orange-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">Last Date</h3>
                <p className="text-gray-600 text-sm">31st March 2026</p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-6 text-center">
                <Award className="w-10 h-10 text-orange-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">25+ Years</h3>
                <p className="text-gray-600 text-sm">
                  Of educational excellence
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Admission Process */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Admission Process
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How to Apply
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {admissionProcess.map((process, index) => (
              <Card key={index} className="border-orange-100 relative">
                <CardContent className="p-6">
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                    {process.step}
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 mt-2">
                    <process.icon className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">
                    {process.title}
                  </h3>
                  <p className="text-gray-600 text-sm">{process.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility & Documents */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Eligibility */}
            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="w-6 h-6 text-orange-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Eligibility Criteria
                  </h2>
                </div>
                <div className="space-y-4">
                  {eligibility.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-4 bg-orange-50 rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item.class}
                        </p>
                        <p className="text-gray-600 text-sm">Age: {item.age}</p>
                      </div>
                      <Badge className="bg-orange-500">{item.criteria}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Required Documents */}
            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="w-6 h-6 text-orange-500" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Required Documents
                  </h2>
                </div>
                <ul className="space-y-3">
                  {requiredDocuments.map((doc, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg"
                    >
                      <CheckCircle className="w-5 h-5 text-orange-500" />
                      <span className="text-gray-700">{doc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Fee Structure */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Fee Structure
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Academic Fees
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {feeStructure.map((fee, index) => (
              <Card key={index} className="border-orange-100 text-center">
                <CardContent className="p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {fee.class}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-500 text-sm">Admission Fee</p>
                      <p className="text-2xl font-bold text-orange-500">
                        {fee.admissionFee}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Tuition Fee</p>
                      <p className="text-2xl font-bold text-orange-500">
                        {fee.tuitionFee}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-center text-gray-500 mt-6">
            * Fees are subject to change. Contact us for latest updates.
          </p>
        </div>
      </section>

      {/* Facilities */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Facilities
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What We Offer
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {facilities.map((facility, index) => (
              <Card key={index} className="border-orange-100">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <p className="font-medium text-gray-900">{facility}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Apply?
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Take the first step towards your child's bright future
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              className="bg-white text-orange-500 hover:bg-orange-50 text-lg px-8"
            >
              <Link to="/contact">
                Contact Us
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white text-white hover:bg-white/20 text-lg px-8"
            >
              <Link to="/login">
                <GraduationCap className="mr-2 w-5 h-5" />
                Login to Apply
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdmissionPage;
