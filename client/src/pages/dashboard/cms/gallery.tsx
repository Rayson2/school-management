import { useState, useEffect } from "react";
import axios from "axios";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Eye,
  EyeOff,
  FolderOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Types
interface GalleryImage {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  categoryId: string | null;
  altText: string | null;
  displayOrder: number;
  isActive: boolean;
  eventDate: Date | null;
}

interface GalleryCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
}

export default function GalleryManagementPage() {
  const [activeTab, setActiveTab] = useState<"images" | "categories">("images");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<GalleryCategory | null>(null);

  // Image form state
  const [imageFormData, setImageFormData] = useState({
    title: "",
    description: "",
    altText: "",
    categoryId: "",
    displayOrder: 0,
    isActive: true,
    eventDate: "",
    image: null as File | null,
    imagePreview: "",
  });

  // Category form state
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    displayOrder: 0,
    isActive: true,
  });

  // Fetch data
  const fetchData = async () => {
    try {
      const [categoriesRes, imagesRes] = await Promise.all([
        axios.get("/api/gallery/categories/all"),
        axios.get("/api/gallery/images/all"),
      ]);
      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.data);
      }
      if (imagesRes.data.success) {
        setImages(imagesRes.data.data);
      }
    } catch (error) {
      console.error("Error fetching gallery data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset image form
  const resetImageForm = () => {
    setImageFormData({
      title: "",
      description: "",
      altText: "",
      categoryId: "",
      displayOrder: 0,
      isActive: true,
      eventDate: "",
      image: null,
      imagePreview: "",
    });
    setEditingImage(null);
  };

  // Reset category form
  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      description: "",
      displayOrder: 0,
      isActive: true,
    });
    setEditingCategory(null);
  };

  // Open image dialog
  const handleAddImage = () => {
    resetImageForm();
    setIsImageDialogOpen(true);
  };

  // Open category dialog
  const handleAddCategory = () => {
    resetCategoryForm();
    setIsCategoryDialogOpen(true);
  };

  // Edit image
  const handleEditImage = (image: GalleryImage) => {
    setEditingImage(image);
    setImageFormData({
      title: image.title,
      description: image.description || "",
      altText: image.altText || "",
      categoryId: image.categoryId || "",
      displayOrder: image.displayOrder,
      isActive: image.isActive,
      eventDate: image.eventDate
        ? new Date(image.eventDate).toISOString().split("T")[0]
        : "",
      image: null,
      imagePreview: image.imageUrl,
    });
    setIsImageDialogOpen(true);
  };

  // Edit category
  const handleEditCategory = (category: GalleryCategory) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || "",
      displayOrder: category.displayOrder,
      isActive: category.isActive,
    });
    setIsCategoryDialogOpen(true);
  };

  // Handle image file change
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFormData({
        ...imageFormData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  };

  // Submit image form
  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", imageFormData.title);
      formDataToSend.append("description", imageFormData.description);
      formDataToSend.append("altText", imageFormData.altText);
      formDataToSend.append("categoryId", imageFormData.categoryId);
      formDataToSend.append("displayOrder", String(imageFormData.displayOrder));
      formDataToSend.append("isActive", String(imageFormData.isActive));
      if (imageFormData.eventDate)
        formDataToSend.append("eventDate", imageFormData.eventDate);
      if (imageFormData.image)
        formDataToSend.append("image", imageFormData.image);

      let response;
      if (editingImage) {
        response = await axios.put(
          `/api/gallery/images/${editingImage.id}`,
          formDataToSend,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      } else {
        response = await axios.post(
          "/api/gallery/images/create",
          formDataToSend,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      }

      if (response.data.success) {
        toast.success(editingImage ? "Image updated" : "Image uploaded");
        setIsImageDialogOpen(false);
        fetchData();
        resetImageForm();
      }
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error("Failed to save image");
    } finally {
      setSaving(false);
    }
  };

  // Submit category form
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let response;
      if (editingCategory) {
        response = await axios.put(
          `/api/gallery/categories/${editingCategory.id}`,
          {
            name: categoryFormData.name,
            description: categoryFormData.description,
            displayOrder: categoryFormData.displayOrder,
            isActive: categoryFormData.isActive,
          }
        );
      } else {
        response = await axios.post("/api/gallery/categories/create", {
          name: categoryFormData.name,
          description: categoryFormData.description,
          displayOrder: categoryFormData.displayOrder,
          isActive: categoryFormData.isActive,
        });
      }

      if (response.data.success) {
        toast.success(
          editingCategory ? "Category updated" : "Category created"
        );
        setIsCategoryDialogOpen(false);
        fetchData();
        resetCategoryForm();
      }
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  // Delete image
  const handleDeleteImage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await axios.delete(`/api/gallery/images/${id}`);
      if (response.data.success) {
        toast.success("Image deleted");
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image");
    }
  };

  // Delete category
  const handleDeleteCategory = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? All images in this category will also be deleted."
      )
    )
      return;

    try {
      const response = await axios.delete(`/api/gallery/categories/${id}`);
      if (response.data.success) {
        toast.success("Category deleted");
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  };

  // Toggle image active
  const handleToggleImageActive = async (image: GalleryImage) => {
    try {
      const response = await axios.put(`/api/gallery/images/${image.id}`, {
        title: image.title,
        description: image.description,
        altText: image.altText,
        categoryId: image.categoryId,
        displayOrder: image.displayOrder,
        isActive: !image.isActive,
        eventDate: image.eventDate
          ? new Date(image.eventDate).toISOString()
          : null,
      });
      if (response.data.success) {
        toast.success(`Image ${image.isActive ? "deactivated" : "activated"}`);
        fetchData();
      }
    } catch (error) {
      console.error("Error toggling image:", error);
      toast.error("Failed to update image");
    }
  };

  // Toggle category active
  const handleToggleCategoryActive = async (category: GalleryCategory) => {
    try {
      const response = await axios.put(
        `/api/gallery/categories/${category.id}`,
        {
          name: category.name,
          description: category.description,
          displayOrder: category.displayOrder,
          isActive: !category.isActive,
        }
      );
      if (response.data.success) {
        toast.success(
          `Category ${category.isActive ? "deactivated" : "activated"}`
        );
        fetchData();
      }
    } catch (error) {
      console.error("Error toggling category:", error);
      toast.error("Failed to update category");
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown";
  };

  return (
    <DashboardLayout title="Gallery Management">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b pb-4">
          <Button
            variant={activeTab === "images" ? "default" : "outline"}
            onClick={() => setActiveTab("images")}
            className={
              activeTab === "images" ? "bg-orange-500 hover:bg-orange-600" : ""
            }
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Images
          </Button>
          <Button
            variant={activeTab === "categories" ? "default" : "outline"}
            onClick={() => setActiveTab("categories")}
            className={
              activeTab === "categories"
                ? "bg-orange-500 hover:bg-orange-600"
                : ""
            }
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Categories
          </Button>
        </div>

        {/* Images Tab */}
        {activeTab === "images" && (
          <>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gallery Images</h2>
                <p className="text-muted-foreground">Manage gallery images</p>
              </div>
              <Button
                onClick={handleAddImage}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Image
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  </div>
                ) : images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mb-4" />
                    <p>No images yet</p>
                    <Button
                      onClick={handleAddImage}
                      variant="outline"
                      className="mt-4"
                    >
                      Add First Image
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Image</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {images.map((image) => (
                        <TableRow key={image.id}>
                          <TableCell>
                            <div className="w-20 h-12 rounded overflow-hidden bg-gray-100">
                              <img
                                src={image.imageUrl}
                                alt={image.altText || image.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {image.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getCategoryName(image.categoryId)}
                            </Badge>
                          </TableCell>
                          <TableCell>{image.displayOrder}</TableCell>
                          <TableCell>
                            <Badge
                              variant={image.isActive ? "default" : "secondary"}
                            >
                              {image.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleImageActive(image)}
                              >
                                {image.isActive ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditImage(image)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteImage(image.id)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Gallery Categories</h2>
                <p className="text-muted-foreground">
                  Organize images into categories
                </p>
              </div>
              <Button
                onClick={handleAddCategory}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Category
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <FolderOpen className="w-12 h-12 mb-4" />
                    <p>No categories yet</p>
                    <Button
                      onClick={handleAddCategory}
                      variant="outline"
                      className="mt-4"
                    >
                      Add First Category
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">
                            {category.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {category.description || "-"}
                          </TableCell>
                          <TableCell>{category.displayOrder}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                category.isActive ? "default" : "secondary"
                              }
                            >
                              {category.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleToggleCategoryActive(category)
                                }
                              >
                                {category.isActive ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCategory(category)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDeleteCategory(category.id)
                                }
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Image Dialog */}
        <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingImage ? "Edit Image" : "Add New Image"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleImageSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imageTitle">Title *</Label>
                <Input
                  id="imageTitle"
                  value={imageFormData.title}
                  onChange={(e) =>
                    setImageFormData({
                      ...imageFormData,
                      title: e.target.value,
                    })
                  }
                  placeholder="Enter image title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageDescription">Description</Label>
                <Textarea
                  id="imageDescription"
                  value={imageFormData.description}
                  onChange={(e) =>
                    setImageFormData({
                      ...imageFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter image description"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageAltText">Alt Text</Label>
                <Input
                  id="imageAltText"
                  value={imageFormData.altText}
                  onChange={(e) =>
                    setImageFormData({
                      ...imageFormData,
                      altText: e.target.value,
                    })
                  }
                  placeholder="For accessibility"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageCategory">Category</Label>
                <Select
                  value={imageFormData.categoryId}
                  onValueChange={(value) =>
                    setImageFormData({ ...imageFormData, categoryId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Uncategorized</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imageOrder">Display Order</Label>
                  <Input
                    id="imageOrder"
                    type="number"
                    value={imageFormData.displayOrder}
                    onChange={(e) =>
                      setImageFormData({
                        ...imageFormData,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="galleryImage">Image *</Label>
                  <Input
                    id="galleryImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    required={!editingImage}
                  />
                </div>
              </div>

              {imageFormData.imagePreview && (
                <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={imageFormData.imagePreview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="eventDate">Event Date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={imageFormData.eventDate}
                  onChange={(e) =>
                    setImageFormData({
                      ...imageFormData,
                      eventDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="imageActive"
                    checked={imageFormData.isActive}
                    onCheckedChange={(checked: boolean) =>
                      setImageFormData({ ...imageFormData, isActive: checked })
                    }
                  />
                  <Label htmlFor="imageActive">Active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImageDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {editingImage ? "Update" : "Upload"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog
          open={isCategoryDialogOpen}
          onOpenChange={setIsCategoryDialogOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Add New Category"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">Name *</Label>
                <Input
                  id="categoryName"
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryDescription">Description</Label>
                <Textarea
                  id="categoryDescription"
                  value={categoryFormData.description}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter category description"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryOrder">Display Order</Label>
                <Input
                  id="categoryOrder"
                  type="number"
                  value={categoryFormData.displayOrder}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      displayOrder: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="categoryActive"
                    checked={categoryFormData.isActive}
                    onCheckedChange={(checked: boolean) =>
                      setCategoryFormData({
                        ...categoryFormData,
                        isActive: checked,
                      })
                    }
                  />
                  <Label htmlFor="categoryActive">Active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCategoryDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {editingCategory ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
