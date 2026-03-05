import { Link } from "react-router";
import axios from "axios";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BookOpen,
  Award,
  Users,
  Calendar,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Clock,
  Star,
  TrendingUp,
  GraduationCap,
  Target,
  Heart,
  Loader2,
} from "lucide-react";

// Types for API response
interface CarouselItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface GalleryImage {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string | null;
  altText: string | null;
}

interface GalleryCategory {
  id: string;
  name: string;
  description: string | null;
}

// Default hero slides (fallback when API fails)
const defaultHeroSlides = [
  {
    id: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1200&h=600&fit=crop",
    title: "Welcome to Our School",
    description:
      "Excellence in education with a commitment to holistic development",
  },
  {
    id: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&h=600&fit=crop",
    title: "Modern Facilities",
    description: "Well-equipped labs, libraries, and sports amenities",
  },
  {
    id: 3,
    imageUrl:
      "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1200&h=600&fit=crop",
    title: "Expert Faculty",
    description: "Experienced educators committed to student success",
  },
];

// News and announcements data
const newsItems = [
  {
    id: 1,
    category: "Academic",
    title: "Annual Examination Schedule Released",
    date: "Feb 28, 2026",
    excerpt:
      "The comprehensive examination schedule for the current academic session has been published.",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=250&fit=crop",
    featured: true,
  },
  {
    id: 2,
    category: "Event",
    title: "Science Fair 2026 Registrations Open",
    date: "Feb 25, 2026",
    excerpt:
      "Students can now register for the annual science fair showcasing innovative projects.",
    image:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=250&fit=crop",
    featured: false,
  },
  {
    id: 3,
    category: "Sports",
    title: "Inter-School Sports Meet Results",
    date: "Feb 22, 2026",
    excerpt:
      "Our students brought home multiple medals from the inter-school sports competition.",
    image:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=250&fit=crop",
    featured: false,
  },
  {
    id: 4,
    category: "Announcement",
    title: "Summer Vacation Notice",
    date: "Feb 20, 2026",
    excerpt: "Summer vacation will begin from May 15th to June 30th, 2026.",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=250&fit=crop",
    featured: false,
  },
];

// Default gallery images (fallback when API fails)
const defaultGalleryImages = [
  {
    id: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400&h=300&fit=crop",
    title: "Classroom",
  },
  {
    id: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?w=400&h=300&fit=crop",
    title: "Library",
  },
  {
    id: 3,
    imageUrl:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop",
    title: "Science Lab",
  },
  {
    id: 4,
    imageUrl:
      "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&h=300&fit=crop",
    title: "Sports Ground",
  },
  {
    id: 5,
    imageUrl:
      "https://images.unsplash.com/photo-1562774053-701939374585?w=400&h=300&fit=crop",
    title: "Computer Lab",
  },
  {
    id: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop",
    title: "Art Class",
  },
];

// Statistics data
const stats = [
  { icon: Users, value: "2000+", label: "Students" },
  { icon: GraduationCap, value: "100+", label: "Teachers" },
  { icon: Award, value: "25+", label: "Years of Excellence" },
  { icon: Star, value: "98%", label: "Pass Rate" },
];

// Features data
const features = [
  {
    icon: BookOpen,
    title: "Quality Education",
    description: "Comprehensive curriculum with modern teaching methodologies",
  },
  {
    icon: Target,
    title: "Career Guidance",
    description: "Expert counseling for students' career progression",
  },
  {
    icon: Heart,
    title: "Student Welfare",
    description: "Dedicated support system for student wellbeing",
  },
  {
    icon: TrendingUp,
    title: "Overall Growth",
    description: "Focus on academic, physical, and social development",
  },
];

const Homepage = () => {
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [loadingCarousel, setLoadingCarousel] = useState(true);
  const [loadingGallery, setLoadingGallery] = useState(true);

  // Fetch carousel items from API
  useEffect(() => {
    const fetchCarousel = async () => {
      try {
        const response = await axios.get("/api/carousel/public");
        if (response.data.success && response.data.data.length > 0) {
          setCarouselItems(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching carousel:", error);
      } finally {
        setLoadingCarousel(false);
      }
    };
    fetchCarousel();
  }, []);

  // Fetch gallery images from API
  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const response = await axios.get("/api/gallery/images/public");
        if (response.data.success && response.data.data.length > 0) {
          setGalleryImages(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching gallery:", error);
      } finally {
        setLoadingGallery(false);
      }
    };
    fetchGallery();
  }, []);

  // Use API data or fallback to default
  const heroSlides =
    carouselItems.length > 0 ? carouselItems : defaultHeroSlides;
  const displayGalleryImages =
    galleryImages.length > 0 ? galleryImages : defaultGalleryImages;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Carousel */}
      <section className="relative">
        <Carousel
          className="w-full"
          opts={{
            loop: true,
          }}
        >
          <CarouselContent>
            {loadingCarousel ? (
              <CarouselItem>
                <div className="relative h-[500px] md:h-[600px] flex items-center justify-center bg-gray-100">
                  <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
                </div>
              </CarouselItem>
            ) : (
              heroSlides.map((slide) => (
                <CarouselItem key={slide.id}>
                  <div className="relative h-[500px] md:h-[600px]">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-center">
                      <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-2xl text-white">
                          <Badge className="mb-4 bg-orange-500 hover:bg-orange-600">
                            H.B.R. English Medium School
                          </Badge>
                          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
                            {slide.title}
                          </h1>
                          <p className="text-lg md:text-xl text-gray-200 mb-8">
                            {slide.description}
                          </p>
                          <div className="flex flex-wrap gap-4">
                            <Button
                              asChild
                              className="bg-orange-500 hover:bg-orange-600 text-lg px-8"
                            >
                              <Link to="/login">Get Started</Link>
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              className="text-black border-white hover:bg-white/20 hover:text-white text-lg px-8"
                            >
                              <Link to="#about">Learn More</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))
            )}
          </CarouselContent>
          <CarouselPrevious className="left-4 bg-white/20 hover:bg-white/40 border-none text-white" />
          <CarouselNext className="right-4 bg-white/20 hover:bg-white/40 border-none text-white" />
        </Carousel>
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

      {/* About Section */}
      <section id="about" className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
                About Us
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Building Tomorrow's Leaders Today
              </h2>
              <p className="text-gray-600 text-lg mb-6">
                Our school is committed to providing quality education that
                nurtures young minds and prepares them for the challenges of the
                future. With a legacy of over 25 years, we have been at the
                forefront of educational excellence.
              </p>
              <p className="text-gray-600 text-lg mb-8">
                We believe in a holistic approach to education that combines
                academic rigor with character development, creativity, and
                physical fitness.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild className="bg-orange-500 hover:bg-orange-600">
                  <Link to="/login">
                    Join Our Community
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="border-orange-100 hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-orange-500" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* News & Announcements Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              News & Updates
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Latest News & Announcements
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Stay updated with the latest happenings, events, and announcements
              from our school community.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {newsItems.map((news) => (
              <Card
                key={news.id}
                className={`overflow-hidden border-orange-100 hover:shadow-lg transition-all ${
                  news.featured ? "md:col-span-2 md:row-span-2" : ""
                }`}
              >
                <div className="relative">
                  <img
                    src={news.image}
                    alt={news.title}
                    className={`w-full object-cover ${
                      news.featured ? "h-64" : "h-40"
                    }`}
                  />
                  <Badge className="absolute top-3 left-3 bg-orange-500 hover:bg-orange-600">
                    {news.category}
                  </Badge>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                    <Calendar className="w-4 h-4" />
                    {news.date}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {news.title}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-3">
                    {news.excerpt}
                  </p>
                  <Button
                    variant="link"
                    className="text-orange-500 hover:text-orange-600 p-0 mt-4"
                  >
                    Read More <ArrowRight className="ml-1 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              asChild
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-50"
            >
              <Link to="/login">
                View All News
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-orange-100 text-orange-600 hover:bg-orange-200">
              Our Campus
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Photo Gallery
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Glimpses of our vibrant campus life, state-of-the-art facilities,
              and memorable moments.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {loadingGallery ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              displayGalleryImages.slice(0, 6).map((image:any) => (
                <div
                  key={image.id}
                  className="relative group overflow-hidden rounded-lg"
                >
                  <img
                    src={image.imageUrl}
                    alt={ image.altText || image.title}
                    className="w-full h-48 md:h-64 object-cover transform group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4 text-white">
                      <p className="font-medium">{image.title}</p>
                      {image.description && (
                        <p className="text-sm text-gray-300 mt-1 line-clamp-2">
                          {image.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-center mt-10">
            <Button asChild className="bg-orange-500 hover:bg-orange-600">
              <Link to="/gallery">
                View Full Gallery
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              Testimonials
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What Parents Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Parent",
                image:
                  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
                quote:
                  "The school has provided an excellent environment for my child's growth. The teachers are dedicated and supportive.",
              },
              {
                name: "Michael Chen",
                role: "Parent",
                image:
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
                quote:
                  "We are thrilled with the academic progress and extracurricular opportunities. Truly a nurturing environment.",
              },
              {
                name: "Emily Davis",
                role: "Parent",
                image:
                  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
                quote:
                  "The school's focus on holistic development has helped my daughter become confident and well-rounded.",
              },
            ].map((testimonial, index) => (
              <Card
                key={index}
                className="bg-white/10 backdrop-blur-sm border-white/20"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-5 h-5 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-white/90 mb-6 italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={testimonial.image}
                        alt={testimonial.name}
                      />
                      <AvatarFallback>
                        {testimonial.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-white">
                        {testimonial.name}
                      </p>
                      <p className="text-white/70 text-sm">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="border-orange-100 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2">
                <div className="bg-orange-500 p-8 md:p-12 text-white">
                  <h2 className="text-3xl font-bold mb-6">Get in Touch</h2>
                  <p className="text-orange-100 mb-8">
                    Have questions? We'd love to hear from you. Reach out to us
                    or schedule a visit to our campus.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5" />
                      <span>123 Education Lane, City, State 123456</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5" />
                      <span>+1 (555) 123-4567</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5" />
                      <span>info@school.edu</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5" />
                      <span>Mon - Fri: 8:00 AM - 4:00 PM</span>
                    </div>
                  </div>
                </div>
                <div className="p-8 md:p-12">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Schedule a Visit
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Experience our campus firsthand. Book an appointment to meet
                    our staff and see our facilities.
                  </p>
                  <div className="space-y-4">
                    <Button
                      asChild
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      <Link to="/login">Book a Visit</Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
                    >
                      <Link to="/login">Contact Admissions</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">School Name</h3>
              <p className="text-gray-400">
                Empowering students to achieve excellence in education and
                character.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link to="/login" className="hover:text-orange-400">
                    Login
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    Admissions
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Academics</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    Curriculum
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    Faculty
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    Facilities
                  </Link>
                </li>
                <li>
                  <Link to="#" className="hover:text-orange-400">
                    Calendar
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Connect With Us</h4>
              <div className="flex gap-4">
                <Link
                  to="#"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
                >
                  <span className="sr-only">Facebook</span>
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.77,7.46H14.5v-1.9c0-.9.6-1.1,1-1.1h3V.5L14.17.5C10.24.5,9.5,3.44,9.5,5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4Z" />
                  </svg>
                </Link>
                <Link
                  to="#"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
                >
                  <span className="sr-only">Twitter</span>
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.32,6.44a.5.5,0,0,0-.2-.87l-.79-.2A.5.5,0,0,1,22,4.71l.44-.89a.5.5,0,0,0-.58-.7l-2,.56a.5.5,0,0,1-.44-.08,5,5,0,0,0-2.92-1.7,5,5,0,0,0-4.62,2.43,5,5,0,0,0,.57,5.36l.12.12-1.08,1.12a.5.5,0,0,0,.11.63l.57.57a.5.5,0,0,1,0,.71l-.57.57a.5.5,0,0,0-.63.11l-1.08-1.08a.5.5,0,0,1-.12-.63l.12-.12a5,5,0,0,0-2.2-1.47,5,5,0,0,0-1.2-.52l-1.15-.15a.5.5,0,0,0-.58.25l-.32.56a.5.5,0,0,1-.58.25l-1-.38a.5.5,0,0,0-.64.16A5,5,0,0,0,2.17,11.1a.5.5,0,0,0-.08.64l.38,1a.5.5,0,0,1-.25.58l-1.15.15a5,5,0,0,0,.52,1.2,5,5,0,0,0,1.47,2.2l.12-.12a.5.5,0,0,0-.11-.63l-.57-.57a.5.5,0,0,1,0-.71l.57-.57a.5.5,0,0,0,.63-.11l1.08,1.08a.5.5,0,0,1,.12.63l-.12.12a5,5,0,0,0,5.36-.57,5,5,0,0,0,2.43-4.62,5,5,0,0,0-1.7-2.92.5.5,0,0,1-.08-.44l.56-2a.5.5,0,0,0-.7-.58l-.89.44a.5.5,0,0,1-.63-.2Z" />
                  </svg>
                </Link>
                <Link
                  to="#"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-colors"
                >
                  <span className="sr-only">Instagram</span>
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12,2.16c3.2,0,3.58,0,4.85.07,3.25.15,4.77,1.69,4.92,4.92.06,1.27.07,1.65.07,4.85s0,3.58-.07,4.85c-.15,3.23-1.66,4.77-4.92,4.92-1.27.06-1.65.07-4.85.07s-3.58,0-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s0-3.58.07-4.85C2.38,3.92,3.9,2.38,7.15,2.23,8.42,2.18,8.8,2.16,12,2.16ZM12,0C8.74,0,8.33,0,7.05.07c-4.35.2-6.78,2.62-7,7C0,8.33,0,8.74,0,12s0,3.67.07,4.95c.2,4.36,2.62,6.78,7,7C8.33,24,8.74,24,12,24s3.67,0,4.95-.07c4.35-.2,6.78-2.62,7-7C24,15.67,24,15.26,24,12s0-3.67-.07-4.95c-.2-4.35-2.62-6.78-7-7C15.67,0,15.26,0,12,0Zm0,5.84A6.16,6.16,0,1,0,18.16,12,6.16,6.16,0,0,0,12,5.84ZM12,16a4,4,0,1,1,4-4A4,4,0,0,1,12,16ZM18.41,4.15a1.44,1.44,0,1,0,1.44,1.44A1.44,1.44,0,0,0,18.41,4.15Z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2026 School Name. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
