import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  GraduationCap,
  Calendar,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Clock,
  DollarSign,
  FileText,
  Users,
  Award,
} from "lucide-react";

type FormState = {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  previousSchoolName: string;
  currentClassLastStudied: string;
  applyingForClass: string;
  sessionName: string;
  fatherName: string;
  motherName: string;
  guardianName: string;
  primaryContactNumber: string;
  alternateContactNumber: string;
  emailAddress: string;
  fatherOccupation: string;
  motherOccupation: string;
  fullAddress: string;
  city: string;
  state: string;
  pinCode: string;
  specialNeedsMedicalConditions: string;
  remarksQuestions: string;
};

type OptionItem = {
  id: string;
  name: string;
};

const initialForm: FormState = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  previousSchoolName: "",
  currentClassLastStudied: "",
  applyingForClass: "",
  sessionName: "",
  fatherName: "",
  motherName: "",
  guardianName: "",
  primaryContactNumber: "",
  alternateContactNumber: "",
  emailAddress: "",
  fatherOccupation: "",
  motherOccupation: "",
  fullAddress: "",
  city: "",
  state: "",
  pinCode: "",
  specialNeedsMedicalConditions: "",
  remarksQuestions: "",
};

const calculateAge = (dateOfBirth: string) => {
  if (!dateOfBirth) return "";
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 160)}`);
  }
};

const AdmissionPage = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [genders, setGenders] = useState<string[]>([]);
  const [sessions, setSessions] = useState<OptionItem[]>([]);
  const [classes, setClasses] = useState<OptionItem[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const admissionProcess = [
    {
      step: 1,
      title: "Online Registration",
      description: "Share inquiry details for the student and guardian",
      icon: FileText,
    },
    {
      step: 2,
      title: "Document Review",
      description: "Our team reviews eligibility and required documents",
      icon: Users,
    },
    {
      step: 3,
      title: "Interaction Session",
      description: "We connect with the family for the next admission step",
      icon: Calendar,
    },
    {
      step: 4,
      title: "Admission Confirmation",
      description: "Complete fee formalities once the seat is confirmed",
      icon: DollarSign,
    },
  ];

  const eligibility = [
    { class: "Nursery", age: "3-4 years", criteria: "Basic interaction" },
    { class: "LKG", age: "4-5 years", criteria: "Basic interaction" },
    { class: "UKG", age: "5-6 years", criteria: "Basic interaction" },
    { class: "Class 1", age: "6-7 years", criteria: "Previous school TC" },
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
    { class: "Nursery - UKG", admissionFee: "₹5,000", tuitionFee: "₹2,500/month" },
    { class: "Class 1-5", admissionFee: "₹7,500", tuitionFee: "₹3,000/month" },
    { class: "Class 6-10", admissionFee: "₹10,000", tuitionFee: "₹3,500/month" },
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

  const age = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/admission-inquiry/options");
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to load admission form options",
          );
        }

        const data = (result.data ?? {}) as {
          genders?: string[];
          sessions?: OptionItem[];
          classes?: OptionItem[];
        };

        setGenders(Array.isArray(data.genders) ? data.genders : []);
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
        setClasses(Array.isArray(data.classes) ? data.classes : []);

        setForm((current) => ({
          ...current,
          sessionName: current.sessionName || data.sessions?.[0]?.name || "",
        }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load admission form");
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadOptions();
  }, []);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (
      !form.fullName.trim() ||
      !form.dateOfBirth ||
      !form.gender ||
      !form.applyingForClass ||
      !form.sessionName ||
      !form.primaryContactNumber.trim() ||
      !form.fullAddress.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.pinCode.trim()
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admission-inquiry/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to submit admission inquiry",
        );
      }

      const currentSessionName = form.sessionName;
      setForm({
        ...initialForm,
        sessionName: currentSessionName,
      });
      toast.success("Admission inquiry submitted successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit admission inquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <section className="relative bg-gradient-to-r from-orange-500 to-amber-500 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              Admissions Open
            </Badge>
            <h1 className="mb-4 text-4xl font-bold md:text-5xl">Join Our Community</h1>
            <p className="mx-auto max-w-2xl text-xl text-orange-100">
              Share an admission inquiry and our team will guide you through the next steps.
            </p>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-6 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-orange-500" />
                <h3 className="mb-2 font-semibold text-gray-900">Current & Upcoming Sessions</h3>
                <p className="text-sm text-gray-600">
                  Inquiry form supports only current and upcoming academic sessions
                </p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-6 text-center">
                <Clock className="mx-auto mb-3 h-10 w-10 text-orange-500" />
                <h3 className="mb-2 font-semibold text-gray-900">Quick Follow-up</h3>
                <p className="text-sm text-gray-600">
                  Our admission team reviews fresh inquiries and reaches out promptly
                </p>
              </CardContent>
            </Card>
            <Card className="border-orange-100 bg-orange-50">
              <CardContent className="p-6 text-center">
                <Award className="mx-auto mb-3 h-10 w-10 text-orange-500" />
                <h3 className="mb-2 font-semibold text-gray-900">25+ Years</h3>
                <p className="text-sm text-gray-600">Of educational excellence</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Admission Process
            </Badge>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">How to Apply</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {admissionProcess.map((process) => (
              <Card key={process.step} className="relative border-orange-100">
                <CardContent className="p-6">
                  <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
                    {process.step}
                  </div>
                  <div className="mt-2 mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                    <process.icon className="h-6 w-6 text-orange-500" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{process.title}</h3>
                  <p className="text-sm text-gray-600">{process.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="mb-6 flex items-center gap-3">
                  <BookOpen className="h-6 w-6 text-orange-500" />
                  <h2 className="text-2xl font-bold text-gray-900">Eligibility Criteria</h2>
                </div>
                <div className="space-y-4">
                  {eligibility.map((item) => (
                    <div
                      key={item.class}
                      className="flex items-center justify-between rounded-lg bg-orange-50 p-4"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{item.class}</p>
                        <p className="text-sm text-gray-600">Age: {item.age}</p>
                      </div>
                      <Badge className="bg-orange-500">{item.criteria}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="mb-6 flex items-center gap-3">
                  <FileText className="h-6 w-6 text-orange-500" />
                  <h2 className="text-2xl font-bold text-gray-900">Required Documents</h2>
                </div>
                <ul className="space-y-3">
                  {requiredDocuments.map((doc) => (
                    <li key={doc} className="flex items-center gap-3 rounded-lg bg-orange-50 p-3">
                      <CheckCircle className="h-5 w-5 text-orange-500" />
                      <span className="text-gray-700">{doc}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Admission Inquiry Form
            </Badge>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
              Submit Student Details
            </h2>
            <p className="mx-auto max-w-2xl text-gray-600">
              Fill in the student, parent, address, and additional details below. Required
              fields help us start the inquiry immediately.
            </p>
          </div>

          <Card className="mx-auto max-w-6xl border-orange-100 shadow-sm">
            <CardHeader>
              <CardTitle>Admission Inquiry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">1. Student Details</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(event) => updateField("fullName", event.target.value)}
                      placeholder="Enter student full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(event) => updateField("dateOfBirth", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <Select value={form.gender} onValueChange={(value) => updateField("gender", value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        {genders.map((gender) => (
                          <SelectItem key={gender} value={gender}>
                            {gender}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" value={age} readOnly placeholder="Auto-calculated" />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="previousSchoolName">Previous School Name</Label>
                    <Input
                      id="previousSchoolName"
                      value={form.previousSchoolName}
                      onChange={(event) =>
                        updateField("previousSchoolName", event.target.value)
                      }
                      placeholder="Enter previous school name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currentClassLastStudied">Current Class / Last Class Studied</Label>
                    <Input
                      id="currentClassLastStudied"
                      value={form.currentClassLastStudied}
                      onChange={(event) =>
                        updateField("currentClassLastStudied", event.target.value)
                      }
                      placeholder="Example: Class 5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Applying for Class *</Label>
                    <Select
                      value={form.applyingForClass}
                      onValueChange={(value) => updateField("applyingForClass", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((item) => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Session *</Label>
                    <Select
                      value={form.sessionName}
                      onValueChange={(value) => updateField("sessionName", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((item) => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">2. Parent / Guardian Details</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fatherName">Father’s Name</Label>
                    <Input
                      id="fatherName"
                      value={form.fatherName}
                      onChange={(event) => updateField("fatherName", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherName">Mother’s Name</Label>
                    <Input
                      id="motherName"
                      value={form.motherName}
                      onChange={(event) => updateField("motherName", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guardianName">Guardian Name</Label>
                    <Input
                      id="guardianName"
                      value={form.guardianName}
                      onChange={(event) => updateField("guardianName", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primaryContactNumber">Contact Number (Primary) *</Label>
                    <Input
                      id="primaryContactNumber"
                      value={form.primaryContactNumber}
                      onChange={(event) =>
                        updateField("primaryContactNumber", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alternateContactNumber">Alternate Contact Number</Label>
                    <Input
                      id="alternateContactNumber"
                      value={form.alternateContactNumber}
                      onChange={(event) =>
                        updateField("alternateContactNumber", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailAddress">Email Address</Label>
                    <Input
                      id="emailAddress"
                      type="email"
                      value={form.emailAddress}
                      onChange={(event) => updateField("emailAddress", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherOccupation">Occupation (Father)</Label>
                    <Input
                      id="fatherOccupation"
                      value={form.fatherOccupation}
                      onChange={(event) =>
                        updateField("fatherOccupation", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherOccupation">Occupation (Mother)</Label>
                    <Input
                      id="motherOccupation"
                      value={form.motherOccupation}
                      onChange={(event) =>
                        updateField("motherOccupation", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">3. Address Details</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor="fullAddress">Full Address *</Label>
                    <Textarea
                      id="fullAddress"
                      value={form.fullAddress}
                      onChange={(event) => updateField("fullAddress", event.target.value)}
                      placeholder="Enter complete address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      value={form.state}
                      onChange={(event) => updateField("state", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pinCode">PIN Code *</Label>
                    <Input
                      id="pinCode"
                      value={form.pinCode}
                      onChange={(event) => updateField("pinCode", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">4. Additional Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="specialNeedsMedicalConditions">
                      Special Needs / Medical Conditions
                    </Label>
                    <Textarea
                      id="specialNeedsMedicalConditions"
                      value={form.specialNeedsMedicalConditions}
                      onChange={(event) =>
                        updateField("specialNeedsMedicalConditions", event.target.value)
                      }
                      placeholder="Share anything the school should know"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remarksQuestions">Remarks / Questions</Label>
                    <Textarea
                      id="remarksQuestions"
                      value={form.remarksQuestions}
                      onChange={(event) => updateField("remarksQuestions", event.target.value)}
                      placeholder="Add your questions or remarks"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-orange-100 pt-6 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-500">
                  Fields marked with * are required. Inquiry ID and follow-up details are handled
                  by the school after submission.
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || loadingOptions}
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  {submitting ? "Submitting..." : loadingOptions ? "Loading..." : "Submit Inquiry"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Fee Structure
            </Badge>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">Academic Fees</h2>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            {feeStructure.map((fee) => (
              <Card key={fee.class} className="border-orange-100 text-center">
                <CardContent className="p-8">
                  <h3 className="mb-4 text-xl font-bold text-gray-900">{fee.class}</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Admission Fee</p>
                      <p className="text-2xl font-bold text-orange-500">{fee.admissionFee}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Tuition Fee</p>
                      <p className="text-2xl font-bold text-orange-500">{fee.tuitionFee}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-6 text-center text-gray-500">
            * Fees are subject to change. Contact us for the latest update.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Facilities
            </Badge>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">What We Offer</h2>
          </div>

          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {facilities.map((facility) => (
              <Card key={facility} className="border-orange-100">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="mx-auto mb-2 h-6 w-6 text-orange-500" />
                  <p className="font-medium text-gray-900">{facility}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-orange-500 to-amber-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Need Help Before Applying?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-orange-100">
            Contact the school office and we’ll help you with documents, eligibility, and the
            next admission step.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              className="bg-white px-8 text-lg text-orange-500 hover:bg-orange-50"
            >
              <Link to="/contact">
                Contact Us
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white px-8 text-lg text-white hover:bg-white/20"
            >
              <Link to="/login">
                <GraduationCap className="mr-2 h-5 w-5" />
                Dashboard Login
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdmissionPage;
