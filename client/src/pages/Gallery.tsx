import { useState, useEffect } from "react";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Image, Camera, BookOpen, ZoomIn, Loader2 } from "lucide-react";

// Types
interface GalleryImage {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string | null;
  altText: string | null;
  eventDate: Date | null;
}

interface GalleryCategory {
  id: string;
  name: string;
  description: string | null;
}

// Helper function to get alt text
const getAltText = (img: GalleryImage): string =>
  img.altText || img.title || "Gallery Image";

// Default images for fallback
const defaultImages: GalleryImage[] = [
  {
    id: "1",
    imageUrl:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&h=600&fit=crop",
    title: "School Building",
    description: "Main Building",
    categoryId: null,
    altText: "School Building",
    eventDate: null,
  },
  {
    id: "2",
    imageUrl:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&h=600&fit=crop",
    title: "Smart Classroom",
    description: "Modern Learning Space",
    categoryId: null,
    altText: "Smart Classroom",
    eventDate: null,
  },
  {
    id: "3",
    imageUrl:
      "https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?w=800&h=600&fit=crop",
    title: "Library",
    description: "Knowledge Hub",
    categoryId: null,
    altText: "Library",
    eventDate: null,
  },
  {
    id: "4",
    imageUrl:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=600&fit=crop",
    title: "Science Fair",
    description: "Innovation Exhibition",
    categoryId: null,
    altText: "Science Fair",
    eventDate: null,
  },
  {
    id: "5",
    imageUrl:
      "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&h=600&fit=crop",
    title: "Annual Day",
    description: "Celebration",
    categoryId: null,
    altText: "Annual Day",
    eventDate: null,
  },
  {
    id: "6",
    imageUrl:
      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop",
    title: "Sports Day",
    description: "Athletic Events",
    categoryId: null,
    altText: "Sports Day",
    eventDate: null,
  },
  {
    id: "7",
    imageUrl:
      "https://images.unsplash.com/photo-1562774053-701939374585?w=800&h=600&fit=crop",
    title: "Computer Lab",
    description: "Digital Learning",
    categoryId: null,
    altText: "Computer Lab",
    eventDate: null,
  },
  {
    id: "8",
    imageUrl:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop",
    title: "Art & Craft",
    description: "Creative Expression",
    categoryId: null,
    altText: "Art and Craft",
    eventDate: null,
  },
];

const GalleryPage = () => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  // Fetch categories and images from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, imagesRes] = await Promise.all([
          axios.get("/api/gallery/categories/public"),
          axios.get("/api/gallery/images/public"),
        ]);

        if (categoriesRes.data.success) {
          setCategories(categoriesRes.data.data);
        }
        if (imagesRes.data.success && imagesRes.data.data.length > 0) {
          setImages(imagesRes.data.data);
        }
      } catch (error) {
        console.error("Error fetching gallery data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter images by category
  const filteredImages =
    selectedCategory === "All"
      ? images.length > 0
        ? images
        : defaultImages
      : images.length > 0
      ? images.filter((img) => img.categoryId === selectedCategory)
      : defaultImages;

  const displayImages =
    filteredImages.length > 0 ? filteredImages : defaultImages;

  // Category buttons
  const categoryButtons = [
    { label: "All", icon: Image, value: "All" },
    ...categories.map((cat) => ({
      label: cat.name,
      icon: BookOpen,
      value: cat.id,
    })),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="container mx-auto px-4">
          <div className="text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              <Camera className="w-4 h-4 mr-2" />
              Photo Gallery
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Gallery</h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Glimpses of our vibrant campus life and memorable moments
            </p>
          </div>
        </div>
      </section>

      {/* Featured Events Carousel */}
      <section className="py-12 -mt-8 relative z-10">
        <div className="container mx-auto px-4">
          <Card className="border-0 shadow-xl overflow-hidden">
            {loading ? (
              <div className="h-[300px] md:h-[400px] flex items-center justify-center bg-gray-100">
                <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
              </div>
            ) : (
              <Carousel className="w-full" opts={{ loop: true }}>
                <CarouselContent>
                  {displayImages.slice(0, 5).map((image, index) => (
                    <CarouselItem key={index}>
                      <div className="relative h-[300px] md:h-[400px]">
                        <img
                          src={image.imageUrl}
                          alt={getAltText(image)}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                          <div className="p-8 text-white">
                            <h3 className="text-2xl md:text-3xl font-bold">
                              {image.title}
                            </h3>
                            {image.description && (
                              <p className="text-gray-300 mt-2">
                                {image.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-4 bg-white/80 hover:bg-white" />
                <CarouselNext className="right-4 bg-white/80 hover:bg-white" />
              </Carousel>
            )}
          </Card>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {categoryButtons.map((category) => (
                <Button
                  key={category.value}
                  variant={
                    selectedCategory === category.value ? "default" : "outline"
                  }
                  onClick={() => setSelectedCategory(category.value)}
                  className={
                    selectedCategory === category.value
                      ? "bg-orange-500 hover:bg-orange-600"
                      : "border-orange-500 text-orange-500 hover:bg-orange-50"
                  }
                >
                  <category.icon className="w-4 h-4 mr-2" />
                  {category.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-8 pb-16">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-48 md:h-64 bg-gray-200 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayImages.map((image) => (
                <Dialog key={image.id}>
                  <DialogTrigger asChild>
                    <div className="relative group overflow-hidden rounded-lg cursor-pointer">
                      <img
                        src={image.imageUrl}
                        alt={getAltText(image)}
                        className="w-full h-48 md:h-64 object-cover transform group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <ZoomIn className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                        <p className="text-white font-medium text-sm">
                          {image.title}
                        </p>
                        {image.description && (
                          <Badge className="bg-white/20 text-white text-xs mt-1">
                            {image.description}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
                    <img
                      src={image.imageUrl}
                      alt={getAltText(image)}
                      className="w-full h-auto rounded-lg"
                    />
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="text-xl font-bold">{image.title}</h3>
                      {image.description && (
                        <Badge className="bg-orange-500 mt-2">
                          {image.description}
                        </Badge>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default GalleryPage;
