import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Award, Search, ArrowLeft, Download } from "lucide-react";
import { useState } from "react";

const ResultPage = () => {
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [examId, setExamId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
            <Award className="w-4 h-4 mr-2" />
            Results
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            View Results
          </h1>
          <p className="text-gray-600">Check your examination results online</p>
        </div>

        <Card className="max-w-md mx-auto border-orange-100">
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label
                  htmlFor="admission"
                  className="text-sm font-medium mb-2 block"
                >
                  Admission Number
                </label>
                <Input
                  id="admission"
                  placeholder="e.g., ADM1001"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="exam"
                  className="text-sm font-medium mb-2 block"
                >
                  Select Examination
                </label>
                <Select value={examId} onValueChange={setExamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select exam" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mid-term">Mid Term 2025-26</SelectItem>
                    <SelectItem value="annual">Annual Exam 2025-26</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={loading}
              >
                {loading ? "Searching..." : "View Result"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm mb-4">or</p>
              <Link to="/login">
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-500"
                >
                  Login to View Detailed Marksheet
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Link to="/">
            <Button variant="ghost" className="text-orange-500">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
