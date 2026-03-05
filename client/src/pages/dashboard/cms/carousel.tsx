import { useState, useEffect } from "react";
import axios from "axios";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Types
interface CarouselItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
}

export default function CarouselPage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CarouselItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    linkUrl: "",
    displayOrder: 0,
    isActive: true,
    startDate: "",
    endDate: "",
    image: null as File | null,
    imagePreview: "",
  });

  // Fetch carousel items
  const fetchItems = async () => {
    try {
      const response = await axios.get("/api/carousel/all");
      if (response.data.success) {
        setItems(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching carousel items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      linkUrl: "",
      displayOrder: 0,
      isActive: true,
      startDate: "",
      endDate: "",
      image: null,
      imagePreview: "",
    });
    setEditingItem(null);
  };

  // Open dialog for new item
  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (item: CarouselItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      linkUrl: item.linkUrl || "",
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      startDate: item.startDate
        ? new Date(item.startDate).toISOString().split("T")[0]
        : "",
      endDate: item.endDate
        ? new Date(item.endDate).toISOString().split("T")[0]
        : "",
      image: null,
      imagePreview: item.imageUrl,
    });
    setIsDialogOpen(true);
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({
        ...formData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("linkUrl", formData.linkUrl);
      formDataToSend.append("displayOrder", String(formData.displayOrder));
      formDataToSend.append("isActive", String(formData.isActive));
      if (formData.startDate)
        formDataToSend.append("startDate", formData.startDate);
      if (formData.endDate) formDataToSend.append("endDate", formData.endDate);
      if (formData.image) formDataToSend.append("image", formData.image);

      let response;
      if (editingItem) {
        response = await axios.put(
          `/api/carousel/${editingItem.id}`,
          formDataToSend,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
      } else {
        response = await axios.post("/api/carousel/create", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      if (response.data.success) {
        toast.success(
          editingItem ? "Carousel item updated" : "Carousel item created"
        );
        setIsDialogOpen(false);
        fetchItems();
        resetForm();
      }
    } catch (error) {
      console.error("Error saving carousel item:", error);
      toast.error("Failed to save carousel item");
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this carousel item?")) return;

    try {
      const response = await axios.delete(`/api/carousel/${id}`);
      if (response.data.success) {
        toast.success("Carousel item deleted");
        fetchItems();
      }
    } catch (error) {
      console.error("Error deleting carousel item:", error);
      toast.error("Failed to delete carousel item");
    }
  };

  // Handle toggle active
  const handleToggleActive = async (item: CarouselItem) => {
    try {
      const response = await axios.put(`/api/carousel/${item.id}`, {
        title: item.title,
        description: item.description,
        linkUrl: item.linkUrl,
        displayOrder: item.displayOrder,
        isActive: !item.isActive,
        startDate: item.startDate
          ? new Date(item.startDate).toISOString()
          : null,
        endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      });
      if (response.data.success) {
        toast.success(
          `Carousel item ${item.isActive ? "deactivated" : "activated"}`
        );
        fetchItems();
      }
    } catch (error) {
      console.error("Error toggling carousel item:", error);
      toast.error("Failed to update carousel item");
    }
  };

  return (
    <DashboardLayout title="Carousel Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Hero Carousel</h2>
            <p className="text-muted-foreground">
              Manage homepage carousel slides
            </p>
          </div>
          <Button
            onClick={handleAddNew}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Slide
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-4" />
                <p>No carousel items yet</p>
                <Button
                  onClick={handleAddNew}
                  variant="outline"
                  className="mt-4"
                >
                  Add First Slide
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="w-20 h-12 rounded overflow-hidden bg-gray-100">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.title}
                      </TableCell>
                      <TableCell>{item.displayOrder}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.isActive ? "default" : "secondary"}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.startDate && item.endDate
                          ? `${new Date(
                              item.startDate
                            ).toLocaleDateString()} - ${new Date(
                              item.endDate
                            ).toLocaleDateString()}`
                          : item.startDate
                          ? `From ${new Date(
                              item.startDate
                            ).toLocaleDateString()}`
                          : item.endDate
                          ? `Until ${new Date(
                              item.endDate
                            ).toLocaleDateString()}`
                          : "Always"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(item)}
                          >
                            {item.isActive ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
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

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Carousel Slide" : "Add New Carousel Slide"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Enter slide title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter slide description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkUrl">Link URL</Label>
                <Input
                  id="linkUrl"
                  value={formData.linkUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, linkUrl: e.target.value })
                  }
                  placeholder="https://example.com (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Image *</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    required={!editingItem}
                  />
                </div>
              </div>

              {formData.imagePreview && (
                <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={formData.imagePreview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked })
                    }
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
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
                  {editingItem ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
