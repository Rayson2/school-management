import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Award,
  Users,
  BookOpen,
  Target,
  Heart,
  Star,
  Clock,
  CheckCircle,
  ArrowRight,
  Building2,
  FlaskConical,
  Library,
  Trophy,
} from "lucide-react";

const AboutPage = () => {
  const stats = [
    { icon: Users, value: "2000+", label: "Students" },
    { icon: GraduationCap, value: "100+", label: "Teachers" },
    { icon: Award, value: "25+", label: "Years of Excellence" },
    { icon: Star, value: "98%", label: "Pass Rate" },
  ];

  const features = [
    {
      icon: BookOpen,
      title: "Quality Education",
      description:
        "Comprehensive curriculum with modern teaching methodologies and experienced faculty.",
    },
    {
      icon: Target,
      title: "Career Guidance",
      description:
        "Expert counseling for students' career progression and future planning.",
    },
    {
      icon: Heart,
      title: "Student Welfare",
      description:
        "Dedicated support system for student wellbeing and mental health.",
    },
    {
      icon: Building2,
      title: "Modern Infrastructure",
      description: "State-of-the-art classrooms, labs, and sports facilities.",
    },
    {
      icon: FlaskConical,
      title: "Science Labs",
      description:
        "Well-equipped physics, chemistry, and biology laboratories.",
    },
    {
      icon: Library,
      title: "Library",
      description:
        "Extensive collection of books, journals, and digital resources.",
    },
  ];

  const achievements = [
    {
      icon: Trophy,
      title: "Academic Excellence",
      description: "Consistently achieving top results in board examinations",
    },
    {
      icon: Trophy,
      title: "Sports Achievements",
      description: "Multiple medals in district and state level competitions",
    },
    {
      icon: Trophy,
      title: "Cultural Excellence",
      description: "Award-winning performances in various cultural events",
    },
    {
      icon: Trophy,
      title: "Innovation",
      description: "Students winning prestigious science and tech competitions",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              About Us
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              H.B.R. English Medium School
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Nurturing young minds and building futures since 1998
            </p>
          </div>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Welcome to H.B.R. English Medium School
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                Established in 1998, H.B.R. English Medium School has been
                committed to providing quality education that nurtures young
                minds and prepares them for the challenges of the future. Our
                school is a place where every student is encouraged to explore
                their potential and become a responsible citizen.
              </p>
              <p className="text-gray-600 text-lg mb-8">
                We believe in a holistic approach to education that combines
                academic rigor with character development, creativity, and
                physical fitness. Our mission is to empower students to achieve
                excellence in all spheres of life.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild className="bg-orange-500 hover:bg-orange-600">
                  <Link to="/contact">
                    Visit Our Campus
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img
                src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=300&h=200&fit=crop"
                alt="School Building"
                className="rounded-lg shadow-lg"
              />
              <img
                src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=300&h=200&fit=crop"
                alt="Classroom"
                className="rounded-lg shadow-lg mt-8"
              />
              <img
                src="https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?w=300&h=200&fit=crop"
                alt="Library"
                className="rounded-lg shadow-lg"
              />
              <img
                src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=300&h=200&fit=crop"
                alt="Campus"
                className="rounded-lg shadow-lg mt-8"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-12 bg-orange-500">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center text-white">
                <div className="flex justify-center mb-3">
                  <stat.icon className="w-10 h-10" />
                </div>
                <div className="text-3xl md:text-4xl font-bold mb-1">
                  {stat.value}
                </div>
                <div className="text-orange-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Why Choose Us
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What We Offer
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Our school provides a comprehensive educational experience with
              state-of-the-art facilities and dedicated faculty.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border-orange-100 hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-7 h-7 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Our Achievements
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Proud Moments
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {achievements.map((achievement, index) => (
              <Card key={index} className="border-orange-100 text-center">
                <CardContent className="p-6">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <achievement.icon className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-2">
                    {achievement.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {achievement.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Vision Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <Target className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Our Mission
                </h3>
                <p className="text-gray-600">
                  To provide quality education that empowers students to become
                  confident, creative, and compassionate individuals who
                  contribute positively to society. We strive to nurture
                  academic excellence while fostering holistic development.
                </p>
              </CardContent>
            </Card>
            <Card className="border-orange-100">
              <CardContent className="p-8">
                <div className="w-14 h-14 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <Heart className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Our Vision
                </h3>
                <p className="text-gray-600">
                  To be a center of educational excellence that transforms young
                  minds into future leaders, innovators, and responsible
                  citizens who will make a meaningful difference in the world.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join Our Community
          </h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Give your child the best education at H.B.R. English Medium School
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              className="bg-white text-orange-500 hover:bg-orange-50"
            >
              <Link to="/admission">Apply Now</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white text-white hover:bg-white/20"
            >
              <Link to="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
