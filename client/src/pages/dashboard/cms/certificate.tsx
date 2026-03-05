import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

type CertificateField = {
  id: string;
  label: string;
  key: string;
  type: "text" | "image";
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "normal" | "bold";
  align: "left" | "center" | "right";
  width: number;
  height: number;
};

type CertificateTemplate = {
  id: string;
  name: string;
  description: string | null;
  templateImageUrl: string;
  fieldConfigJson: string;
  isActive: boolean;
  createdAt: string | Date | null;
};

const buildDefaultField = (): CertificateField => ({
  id: crypto.randomUUID(),
  label: "Student Name",
  key: "student_name",
  type: "text",
  x: 450,
  y: 300,
  fontSize: 36,
  color: "#111111",
  fontWeight: "bold",
  align: "center",
  width: 220,
  height: 80,
});

const parseFields = (fieldConfigJson: string): CertificateField[] => {
  try {
    const raw = JSON.parse(fieldConfigJson);
    if (!Array.isArray(raw)) return [buildDefaultField()];
    return raw
      .map((item, index) => {
        const row = item as Partial<CertificateField>;
        return {
          id:
            typeof row.id === "string" && row.id
              ? row.id
              : `${Date.now()}-${index}`,
          label:
            typeof row.label === "string" && row.label
              ? row.label
              : `Field ${index + 1}`,
          key:
            typeof row.key === "string" && row.key
              ? row.key
              : `field_${index + 1}`,
          type: row.type === "image" ? "image" : "text",
          x: Number.isFinite(row.x) ? Number(row.x) : 100,
          y: Number.isFinite(row.y) ? Number(row.y) : 100,
          fontSize: Number.isFinite(row.fontSize) ? Number(row.fontSize) : 24,
          color: typeof row.color === "string" ? row.color : "#111111",
          fontWeight: row.fontWeight === "bold" ? "bold" : "normal",
          align:
            row.align === "center" || row.align === "right" ? row.align : "left",
          width: Number.isFinite(row.width) ? Number(row.width) : 220,
          height: Number.isFinite(row.height) ? Number(row.height) : 80,
        } satisfies CertificateField;
      })
      .filter((item) => item.key.trim() && item.label.trim());
  } catch {
    return [buildDefaultField()];
  }
};

const normalizeFields = (fields: CertificateField[]) =>
  fields.map((field) => ({
    ...field,
    key: field.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
    label: field.label.trim(),
    x: Number(field.x) || 0,
    y: Number(field.y) || 0,
    fontSize: Number(field.fontSize) || 24,
    width: Number(field.width) || 220,
    height: Number(field.height) || 80,
  }));

export default function CMSCertificatePage() {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(
    null
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [imageFieldValues, setImageFieldValues] = useState<
    Record<string, { file?: File; url?: string }>
  >({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorImageRef = useRef<HTMLImageElement | null>(null);
  const [selectedEditorFieldId, setSelectedEditorFieldId] = useState<
    string | null
  >(null);
  const [dragState, setDragState] = useState<{
    fieldId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
    templateImage: null as File | null,
    templateImagePreview: "",
    fields: [buildDefaultField()] as CertificateField[],
  });

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const selectedTemplateFields = useMemo(
    () => (selectedTemplate ? parseFields(selectedTemplate.fieldConfigJson) : []),
    [selectedTemplate]
  );

  const drawEditorCanvas = () => {
    const canvas = editorCanvasRef.current;
    const image = editorImageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    formData.fields.forEach((field) => {
      if (field.type === "image") {
        const boxX = field.x;
        const boxY = field.y;
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(boxX, boxY, field.width, field.height);
        ctx.setLineDash([]);
        ctx.fillStyle = "#334155";
        ctx.textAlign = "left";
        ctx.font = `bold 14px Arial`;
        ctx.fillText(field.label || field.key || "Image", boxX + 8, boxY + 22);
      } else {
        const previewText = field.label || field.key || "Text";
        ctx.fillStyle = field.color;
        ctx.textAlign = field.align;
        ctx.font = `${field.fontWeight} ${field.fontSize}px Arial`;
        ctx.fillText(previewText, field.x, field.y);
      }

      if (selectedEditorFieldId === field.id) {
        const startX =
          field.type === "image"
            ? field.x
            : field.align === "center"
            ? field.x - ctx.measureText(field.label || field.key || "Text").width / 2
            : field.align === "right"
            ? field.x - ctx.measureText(field.label || field.key || "Text").width
            : field.x;
        const boxWidth =
          field.type === "image"
            ? field.width
            : ctx.measureText(field.label || field.key || "Text").width;
        const topY = field.type === "image" ? field.y : field.y - field.fontSize;
        const boxHeight = field.type === "image" ? field.height : field.fontSize + 14;

        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 6, topY - 6, boxWidth + 12, boxHeight + 12);
      }
    });
  };

  const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const getFieldAtPosition = (x: number, y: number) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    for (let i = formData.fields.length - 1; i >= 0; i -= 1) {
      const field = formData.fields[i];
      const previewText = field.label || field.key || "Text";
      let startX = field.x;
      let endX = field.x + field.width;
      let topY = field.y;
      let bottomY = field.y + field.height;

      if (field.type === "text") {
        ctx.font = `${field.fontWeight} ${field.fontSize}px Arial`;
        const textWidth = ctx.measureText(previewText).width;
        startX =
          field.align === "center"
            ? field.x - textWidth / 2
            : field.align === "right"
            ? field.x - textWidth
            : field.x;
        endX = startX + textWidth;
        topY = field.y - field.fontSize;
        bottomY = field.y + 10;
      }

      if (x >= startX - 10 && x <= endX + 10 && y >= topY - 10 && y <= bottomY) {
        return field;
      }
    }
    return null;
  };

  const fetchTemplates = async () => {
    try {
      const response = await axios.get("/api/certificate/all");
      if (response.data.success) {
        const data: CertificateTemplate[] = response.data.data || [];
        setTemplates(data);
        setSelectedTemplateId((prev) => prev || data[0]?.id || "");
      }
    } catch (error) {
      console.error("Error fetching certificate templates:", error);
      toast.error("Failed to load certificate templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (!selectedTemplate) {
      setFieldValues({});
      setImageFieldValues({});
      return;
    }
    const parsedFields = parseFields(selectedTemplate.fieldConfigJson);
    setFieldValues((prev) => {
      const nextValues: Record<string, string> = {};
      parsedFields.forEach((field) => {
        if (field.type === "text") nextValues[field.key] = prev[field.key] || "";
      });
      return nextValues;
    });
    setImageFieldValues((prev) => {
      const nextImageValues: Record<string, { file?: File; url?: string }> = {};
      parsedFields.forEach((field) => {
        if (field.type === "image") nextImageValues[field.key] = prev[field.key] || {};
      });
      return nextImageValues;
    });
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const image = new Image();
    image.src = selectedTemplate.templateImageUrl;

    image.onload = () => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const drawFields = async () => {
        for (const field of selectedTemplateFields) {
          if (field.type === "image") {
            const sourceUrl = imageFieldValues[field.key]?.url;
            if (!sourceUrl) continue;
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => {
                ctx.drawImage(img, field.x, field.y, field.width, field.height);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = sourceUrl;
            });
          } else {
            const value = fieldValues[field.key] || "";
            ctx.fillStyle = field.color;
            ctx.textAlign = field.align;
            ctx.font = `${field.fontWeight} ${field.fontSize}px Arial`;
            ctx.fillText(value, field.x, field.y);
          }
        }
      };

      void drawFields();
    };

    image.onerror = () => {
      toast.error("Unable to render certificate preview");
    };

    return () => {
      cancelled = true;
    };
  }, [selectedTemplate, selectedTemplateFields, fieldValues, imageFieldValues]);

  useEffect(() => {
    if (!isDialogOpen || !formData.templateImagePreview) return;

    const image = new Image();
    image.src = formData.templateImagePreview;
    image.onload = () => {
      editorImageRef.current = image;
      drawEditorCanvas();
    };
  }, [isDialogOpen, formData.templateImagePreview]);

  useEffect(() => {
    if (!isDialogOpen || !formData.templateImagePreview) return;
    drawEditorCanvas();
  }, [formData.fields, selectedEditorFieldId, isDialogOpen, formData.templateImagePreview]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      isActive: true,
      templateImage: null,
      templateImagePreview: "",
      fields: [buildDefaultField()],
    });
    setEditingTemplate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setSelectedEditorFieldId(null);
    setDragState(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: CertificateTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      isActive: template.isActive,
      templateImage: null,
      templateImagePreview: template.templateImageUrl,
      fields: parseFields(template.fieldConfigJson),
    });
    setSelectedEditorFieldId(null);
    setDragState(null);
    setIsDialogOpen(true);
  };

  const addField = () => {
    setFormData((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          ...buildDefaultField(),
          label: `Field ${prev.fields.length + 1}`,
          key: `field_${prev.fields.length + 1}`,
          type: "text",
          fontWeight: "normal",
          align: "left",
        },
      ],
    }));
  };

  const removeField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      fields: prev.fields.length > 1 ? prev.fields.filter((field) => field.id !== id) : prev.fields,
    }));
    setSelectedEditorFieldId((prev) => (prev === id ? null : prev));
  };

  const handleEditorMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(event);
    const field = getFieldAtPosition(x, y);
    if (!field) {
      setSelectedEditorFieldId(null);
      setDragState(null);
      return;
    }

    setSelectedEditorFieldId(field.id);
    setDragState({
      fieldId: field.id,
      offsetX: x - field.x,
      offsetY: y - field.y,
    });
  };

  const handleEditorMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;
    const canvas = editorCanvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasCoordinates(event);
    const nextX = Math.max(0, Math.min(canvas.width, Math.round(x - dragState.offsetX)));
    const nextY = Math.max(0, Math.min(canvas.height, Math.round(y - dragState.offsetY)));

    setFormData((prev) => ({
      ...prev,
      fields: prev.fields.map((field) =>
        field.id === dragState.fieldId
          ? { ...field, x: nextX, y: nextY }
          : field
      ),
    }));
  };

  const handleEditorMouseUp = () => {
    setDragState(null);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedFields = normalizeFields(formData.fields);
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (cleanedFields.some((field) => !field.key || !field.label)) {
      toast.error("Each field must have label and key");
      return;
    }
    if (!editingTemplate && !formData.templateImage) {
      toast.error("Template image is required");
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("name", formData.name.trim());
      payload.append("description", formData.description.trim());
      payload.append("isActive", String(formData.isActive));
      payload.append("fieldConfigJson", JSON.stringify(cleanedFields));
      if (formData.templateImage) {
        payload.append("templateImage", formData.templateImage);
      }

      let response;
      if (editingTemplate) {
        response = await axios.put(`/api/certificate/${editingTemplate.id}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        response = await axios.post("/api/certificate/create", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      if (response.data.success) {
        toast.success(editingTemplate ? "Template updated" : "Template created");
        setIsDialogOpen(false);
        resetForm();
        await fetchTemplates();
      }
    } catch (error) {
      console.error("Error saving certificate template:", error);
      toast.error("Failed to save certificate template");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this certificate template?")) return;
    try {
      const response = await axios.delete(`/api/certificate/${id}`);
      if (response.data.success) {
        toast.success("Template deleted");
        const nextTemplates = templates.filter((item) => item.id !== id);
        setTemplates(nextTemplates);
        setSelectedTemplateId((prev) =>
          prev === id ? nextTemplates[0]?.id || "" : prev
        );
      }
    } catch (error) {
      console.error("Error deleting certificate template:", error);
      toast.error("Failed to delete template");
    }
  };

  const downloadCertificate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `${selectedTemplate?.name || "certificate"}-${Date.now()}.png`;
    anchor.click();
  };

  return (
    <DashboardLayout title="Certificate Management">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Certificate Management</h2>
            <p className="text-muted-foreground">
              Create certificate templates, place text fields, and generate final images.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No template found.</p>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className={`border rounded-lg p-3 space-y-2 ${
                      selectedTemplateId === template.id ? "border-orange-500" : ""
                    }`}
                  >
                    <button
                      className="text-left w-full"
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <p className="font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.isActive ? "Active" : "Inactive"}
                      </p>
                    </button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 border-red-200 hover:text-red-600"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Generate Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTemplate ? (
                <p className="text-sm text-muted-foreground">
                  Select or create a template to generate certificates.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedTemplateFields.map((field) => (
                      <div key={field.id} className="space-y-1">
                        <Label>{field.label}</Label>
                        {field.type === "image" ? (
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = URL.createObjectURL(file);
                              setImageFieldValues((prev) => ({
                                ...prev,
                                [field.key]: { file, url },
                              }));
                            }}
                          />
                        ) : (
                          <Input
                            value={fieldValues[field.key] || ""}
                            onChange={(e) =>
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            placeholder={`Enter ${field.label}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border rounded-lg p-3 bg-muted/20 overflow-auto">
                    <canvas
                      ref={canvasRef}
                      className="max-w-full h-auto border rounded bg-white"
                    />
                  </div>

                  <Button
                    onClick={downloadCertificate}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Certificate
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit Certificate Template" : "Create Certificate Template"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Annual Achievement Certificate"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template Image {editingTemplate ? "" : "*"}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setFormData((prev) => ({
                        ...prev,
                        templateImage: file,
                        templateImagePreview: file
                          ? URL.createObjectURL(file)
                          : prev.templateImagePreview,
                      }));
                    }}
                    required={!editingTemplate}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked: boolean) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                <Label>Template active</Label>
              </div>

              {formData.templateImagePreview && (
                <div className="w-full rounded border bg-muted/20 p-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Drag text on preview to move fields.
                  </p>
                  <canvas
                    ref={editorCanvasRef}
                    onMouseDown={handleEditorMouseDown}
                    onMouseMove={handleEditorMouseMove}
                    onMouseUp={handleEditorMouseUp}
                    onMouseLeave={handleEditorMouseUp}
                    className="max-h-[420px] max-w-full h-auto mx-auto border rounded bg-white cursor-move"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Text Fields</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addField}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.fields.map((field) => (
                    <div key={field.id} className="border rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={field.type}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? {
                                      ...item,
                                      type: e.target.value === "image" ? "image" : "text",
                                    }
                                  : item
                              ),
                            }))
                          }
                        >
                          <option value="text">Text</option>
                          <option value="image">Image</option>
                        </select>
                        <Input
                          value={field.label}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id ? { ...item, label: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="Label (Student Name)"
                        />
                        <Input
                          value={field.key}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id ? { ...item, key: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="key (student_name)"
                        />
                        <Button type="button" variant="outline" onClick={() => removeField(field.id)}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant={selectedEditorFieldId === field.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedEditorFieldId(field.id)}
                        className={
                          selectedEditorFieldId === field.id
                            ? "bg-orange-500 hover:bg-orange-600"
                            : ""
                        }
                      >
                        {selectedEditorFieldId === field.id
                          ? "Selected On Canvas"
                          : "Select On Canvas"}
                      </Button>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <Input
                          type="number"
                          value={field.x}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? { ...item, x: parseInt(e.target.value) || 0 }
                                  : item
                              ),
                            }))
                          }
                          placeholder="X"
                        />
                        <Input
                          type="number"
                          value={field.y}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? { ...item, y: parseInt(e.target.value) || 0 }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Y"
                        />
                        <Input
                          type="number"
                          value={field.fontSize}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? { ...item, fontSize: parseInt(e.target.value) || 24 }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Size"
                          disabled={field.type === "image"}
                        />
                        <Input
                          type="color"
                          value={field.color}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id ? { ...item, color: e.target.value } : item
                              ),
                            }))
                          }
                        />
                        <Input
                          type="number"
                          value={field.width}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? { ...item, width: parseInt(e.target.value) || 220 }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Width"
                        />
                        <Input
                          type="number"
                          value={field.height}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? { ...item, height: parseInt(e.target.value) || 80 }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Height"
                        />
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={field.fontWeight}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? {
                                      ...item,
                                      fontWeight:
                                        e.target.value === "bold" ? "bold" : "normal",
                                    }
                                  : item
                              ),
                            }))
                          }
                          disabled={field.type === "image"}
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                        </select>
                        <select
                          className="h-9 rounded-md border bg-background px-3 text-sm"
                          value={field.align}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              fields: prev.fields.map((item) =>
                                item.id === field.id
                                  ? {
                                      ...item,
                                      align:
                                        e.target.value === "center"
                                          ? "center"
                                          : e.target.value === "right"
                                          ? "right"
                                          : "left",
                                    }
                                  : item
                              ),
                            }))
                          }
                          disabled={field.type === "image"}
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingTemplate ? "Update Template" : "Create Template"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
