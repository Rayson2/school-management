import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, ArrowLeft } from "lucide-react";
import { useState } from "react";

const TCVerifyPage = () => {
  const [tcNumber, setTcNumber] = useState("");
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
            <FileText className="w-4 h-4 mr-2" />
            TC Verification
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Transfer Certificate Verification
          </h1>
          <p className="text-gray-600">
            Verify transfer certificate by entering TC number
          </p>
        </div>

        <Card className="max-w-md mx-auto border-orange-100">
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label
                  htmlFor="tcNumber"
                  className="text-sm font-medium mb-2 block"
                >
                  Enter TC Number
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    id="tcNumber"
                    placeholder="e.g., TC/2025/001"
                    value={tcNumber}
                    onChange={(e) => setTcNumber(e.target.value)}
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
                {loading ? "Verifying..." : "Verify TC"}
              </Button>
            </form>
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

export default TCVerifyPage;
