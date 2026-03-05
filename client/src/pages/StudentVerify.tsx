import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { useState } from "react";

const StudentVerifyPage = () => {
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [result, setResult] = useState<{ found: boolean; data?: any } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate search - in real app would call API
    setTimeout(() => {
      setResult({ found: false });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
            <User className="w-4 h-4 mr-2" />
            Verification
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Student Verification
          </h1>
          <p className="text-gray-600">
            Verify student details by entering admission number
          </p>
        </div>

        <Card className="max-w-md mx-auto border-orange-100">
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label
                  htmlFor="admission"
                  className="text-sm font-medium mb-2 block"
                >
                  Enter Admission Number
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="admission"
                    placeholder="e.g., ADM1001"
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={loading}
              >
                {loading ? "Searching..." : "Verify Student"}
              </Button>
            </form>

            {result && (
              <div className="mt-6 p-4 rounded-lg bg-gray-50 text-center">
                <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">
                  No student found with this admission number
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Link to="/">
            <Button
              variant="outline"
              className="border-orange-500 text-orange-500"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentVerifyPage;
