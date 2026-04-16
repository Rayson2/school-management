import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type InquiryStatus = "new" | "contacted" | "converted" | "rejected";

type AdmissionInquiry = {
  id: string;
  inquiryId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  age: number;
  previousSchoolName: string | null;
  currentClassLastStudied: string | null;
  applyingForClass: string;
  sessionName: string;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  primaryContactNumber: string;
  alternateContactNumber: string | null;
  emailAddress: string | null;
  fatherOccupation: string | null;
  motherOccupation: string | null;
  fullAddress: string;
  city: string;
  state: string;
  pinCode: string;
  specialNeedsMedicalConditions: string | null;
  remarksQuestions: string | null;
  status: InquiryStatus;
  assignedStaffUserId: string | null;
  assignedStaffName: string | null;
  followUpDate: string | null;
  createdAt: string | null;
};

type SessionOption = {
  id: string;
  name: string;
};

type ClassOption = {
  id: string;
  name: string;
};

type StaffOption = {
  id: string;
  fullName: string;
};

type ExportFieldKey =
  | "inquiryId"
  | "fullName"
  | "gender"
  | "age"
  | "dateOfBirth"
  | "applyingForClass"
  | "sessionName"
  | "status"
  | "assignedStaffName"
  | "followUpDate"
  | "primaryContactNumber"
  | "alternateContactNumber"
  | "emailAddress"
  | "fatherName"
  | "motherName"
  | "guardianName"
  | "previousSchoolName"
  | "currentClassLastStudied"
  | "fatherOccupation"
  | "motherOccupation"
  | "fullAddress"
  | "city"
  | "state"
  | "pinCode"
  | "specialNeedsMedicalConditions"
  | "remarksQuestions"
  | "createdAt";

const DEFAULT_INQUIRY_STATUSES: InquiryStatus[] = [
  "new",
  "contacted",
  "converted",
  "rejected",
];

const EXPORT_FIELD_OPTIONS: Array<{ key: ExportFieldKey; label: string }> = [
  { key: "inquiryId", label: "Inquiry ID" },
  { key: "fullName", label: "Student Name" },
  { key: "gender", label: "Gender" },
  { key: "age", label: "Age" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "applyingForClass", label: "Class" },
  { key: "sessionName", label: "Session" },
  { key: "status", label: "Status" },
  { key: "assignedStaffName", label: "Assigned Staff" },
  { key: "followUpDate", label: "Follow-up Date" },
  { key: "primaryContactNumber", label: "Primary Contact" },
  { key: "alternateContactNumber", label: "Alternate Contact" },
  { key: "emailAddress", label: "Email" },
  { key: "fatherName", label: "Father" },
  { key: "motherName", label: "Mother" },
  { key: "guardianName", label: "Guardian" },
  { key: "previousSchoolName", label: "Previous School" },
  { key: "currentClassLastStudied", label: "Current / Last Class" },
  { key: "fatherOccupation", label: "Father Occupation" },
  { key: "motherOccupation", label: "Mother Occupation" },
  { key: "fullAddress", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "pinCode", label: "PIN Code" },
  { key: "specialNeedsMedicalConditions", label: "Special Needs / Medical" },
  { key: "remarksQuestions", label: "Remarks / Questions" },
  { key: "createdAt", label: "Created At" },
];

const DEFAULT_EXPORT_FIELDS: ExportFieldKey[] = [
  "inquiryId",
  "fullName",
  "applyingForClass",
  "sessionName",
  "status",
  "assignedStaffName",
  "primaryContactNumber",
  "createdAt",
];

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 160)}`);
  }
};

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "-";

const toInputDate = (value: string | null | undefined) => {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
};

const formatDateTimeForExport = (value: string | null | undefined) => {
  if (!value) return "";
  return new Date(value).toLocaleString();
};

export default function AdmissionInquiriesPage() {
  const [inquiries, setInquiries] = useState<AdmissionInquiry[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [statuses, setStatuses] = useState<InquiryStatus[]>(DEFAULT_INQUIRY_STATUSES);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selectedInquiry, setSelectedInquiry] = useState<AdmissionInquiry | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFields, setExportFields] = useState<ExportFieldKey[]>(DEFAULT_EXPORT_FIELDS);
  const [editStatus, setEditStatus] = useState<InquiryStatus>("new");
  const [editAssignedStaffUserId, setEditAssignedStaffUserId] = useState<string>("unassigned");
  const [editFollowUpDate, setEditFollowUpDate] = useState("");
  const [editRemarksQuestions, setEditRemarksQuestions] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAdminOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/admission-inquiry/admin-options");
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to load admission options",
        );
      }

      const data = (result.data ?? {}) as {
        statuses?: InquiryStatus[];
        sessions?: SessionOption[];
        classes?: ClassOption[];
        staff?: StaffOption[];
      };

      setStatuses(
        Array.isArray(data.statuses) && data.statuses.length > 0
          ? data.statuses
          : DEFAULT_INQUIRY_STATUSES,
      );
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      setClasses(Array.isArray(data.classes) ? data.classes : []);
      setStaff(Array.isArray(data.staff) ? data.staff : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admission options");
    }
  }, []);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sessionFilter !== "all") params.set("sessionName", sessionFilter);
      if (classFilter !== "all") params.set("applyingForClass", classFilter);

      const suffix = params.toString();
      const response = await fetch(
        `/api/admission-inquiry/all${suffix ? `?${suffix}` : ""}`,
      );
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to load admission inquiries",
        );
      }

      setInquiries(Array.isArray(result.data) ? (result.data as AdmissionInquiry[]) : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admission inquiries");
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, [classFilter, query, sessionFilter, statusFilter]);

  useEffect(() => {
    void loadAdminOptions();
    void loadInquiries();
  }, [loadAdminOptions, loadInquiries]);

  const openEditDialog = (inquiry: AdmissionInquiry) => {
    setSelectedInquiry(inquiry);
    setEditStatus(inquiry.status);
    setEditAssignedStaffUserId(inquiry.assignedStaffUserId ?? "unassigned");
    setEditFollowUpDate(toInputDate(inquiry.followUpDate));
    setEditRemarksQuestions(inquiry.remarksQuestions ?? "");
  };

  const handleSave = async () => {
    if (!selectedInquiry) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admission-inquiry/${selectedInquiry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          assignedStaffUserId:
            editAssignedStaffUserId === "unassigned" ? null : editAssignedStaffUserId,
          followUpDate: editFollowUpDate || null,
          remarksQuestions: editRemarksQuestions,
        }),
      });
      const result = await parseJsonResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to update admission inquiry",
        );
      }

      toast.success("Admission inquiry updated");
      setSelectedInquiry(null);
      await loadInquiries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admission inquiry");
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    return statuses.reduce<Record<string, number>>((acc, status) => {
      acc[status] = inquiries.filter((item) => item.status === status).length;
      return acc;
    }, {});
  }, [inquiries, statuses]);

  const exportValue = (inquiry: AdmissionInquiry, field: ExportFieldKey) => {
    switch (field) {
      case "inquiryId":
        return inquiry.inquiryId;
      case "fullName":
        return inquiry.fullName;
      case "gender":
        return inquiry.gender;
      case "age":
        return inquiry.age;
      case "dateOfBirth":
        return formatDate(inquiry.dateOfBirth);
      case "applyingForClass":
        return inquiry.applyingForClass;
      case "sessionName":
        return inquiry.sessionName;
      case "status":
        return inquiry.status;
      case "assignedStaffName":
        return inquiry.assignedStaffName ?? "";
      case "followUpDate":
        return formatDate(inquiry.followUpDate);
      case "primaryContactNumber":
        return inquiry.primaryContactNumber;
      case "alternateContactNumber":
        return inquiry.alternateContactNumber ?? "";
      case "emailAddress":
        return inquiry.emailAddress ?? "";
      case "fatherName":
        return inquiry.fatherName ?? "";
      case "motherName":
        return inquiry.motherName ?? "";
      case "guardianName":
        return inquiry.guardianName ?? "";
      case "previousSchoolName":
        return inquiry.previousSchoolName ?? "";
      case "currentClassLastStudied":
        return inquiry.currentClassLastStudied ?? "";
      case "fatherOccupation":
        return inquiry.fatherOccupation ?? "";
      case "motherOccupation":
        return inquiry.motherOccupation ?? "";
      case "fullAddress":
        return inquiry.fullAddress;
      case "city":
        return inquiry.city;
      case "state":
        return inquiry.state;
      case "pinCode":
        return inquiry.pinCode;
      case "specialNeedsMedicalConditions":
        return inquiry.specialNeedsMedicalConditions ?? "";
      case "remarksQuestions":
        return inquiry.remarksQuestions ?? "";
      case "createdAt":
        return formatDateTimeForExport(inquiry.createdAt);
      default:
        return "";
    }
  };

  const toggleExportField = (field: ExportFieldKey) => {
    setExportFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  };

  const handleDownload = () => {
    if (!inquiries.length) {
      toast.error("No admission inquiries available to download");
      return;
    }
    if (!exportFields.length) {
      toast.error("Select at least one field to download");
      return;
    }

    const rows = inquiries.map((inquiry) =>
      exportFields.reduce<Record<string, string | number>>((acc, field) => {
        const label = EXPORT_FIELD_OPTIONS.find((option) => option.key === field)?.label ?? field;
        acc[label] = exportValue(inquiry, field);
        return acc;
      }, {}),
    );

    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Admission Inquiries");
    const fileParts = [
      "admission-inquiries",
      sessionFilter !== "all" ? sessionFilter : null,
      statusFilter !== "all" ? statusFilter : null,
      classFilter !== "all" ? classFilter : null,
    ]
      .filter(Boolean)
      .join("-");
    XLSX.writeFile(book, `${fileParts || "admission-inquiries"}.xlsx`);
    setExportDialogOpen(false);
  };

  return (
    <DashboardLayout title="Admission Inquiries">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admission Inquiries</h1>
            <p className="text-sm text-muted-foreground">
              Track new leads, assign counselors, and manage follow-ups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(true)} disabled={!inquiries.length}>
              Download Selected Data
            </Button>
            <Button variant="outline" onClick={loadInquiries} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {statuses.map((status) => (
            <Card key={status}>
              <CardHeader className="pb-2">
                <CardDescription className="capitalize">{status}</CardDescription>
                <CardTitle className="text-3xl">{summary[status] ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Inquiries</CardTitle>
            <CardDescription>
              Filter by student name, inquiry status, or academic session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by student name"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.name}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={loadInquiries} disabled={loading}>
                Search
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inquiry ID</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Applying For</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Staff</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell className="font-medium">{inquiry.inquiryId}</TableCell>
                    <TableCell>
                      <div>{inquiry.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {inquiry.gender} • Age {inquiry.age}
                      </div>
                    </TableCell>
                    <TableCell>{inquiry.applyingForClass}</TableCell>
                    <TableCell>{inquiry.sessionName}</TableCell>
                    <TableCell>
                      <div>{inquiry.primaryContactNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {inquiry.emailAddress ?? "No email"}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{inquiry.status}</TableCell>
                    <TableCell>{inquiry.assignedStaffName ?? "-"}</TableCell>
                    <TableCell>{formatDate(inquiry.followUpDate)}</TableCell>
                    <TableCell>{formatDate(inquiry.createdAt)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(inquiry)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && inquiries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-20 text-center">
                      No admission inquiries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedInquiry)} onOpenChange={(open) => !open && setSelectedInquiry(null)}>
          <DialogContent className="w-[min(96vw,1200px)] max-h-[92vh] max-w-none overflow-hidden p-0">
            <DialogHeader>
              <DialogTitle className="px-6 pt-6">
                {selectedInquiry?.fullName} ({selectedInquiry?.inquiryId})
              </DialogTitle>
              <DialogDescription className="px-6 pb-2">
                Review submitted details and update backend follow-up fields.
              </DialogDescription>
            </DialogHeader>

            {selectedInquiry && (
              <div className="grid max-h-[calc(92vh-10rem)] gap-6 overflow-y-auto px-6 pb-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Student Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Date of Birth:</strong> {formatDate(selectedInquiry.dateOfBirth)}</p>
                    <p><strong>Gender:</strong> {selectedInquiry.gender}</p>
                    <p><strong>Age:</strong> {selectedInquiry.age}</p>
                    <p><strong>Previous School:</strong> {selectedInquiry.previousSchoolName ?? "-"}</p>
                    <p><strong>Current / Last Class:</strong> {selectedInquiry.currentClassLastStudied ?? "-"}</p>
                    <p><strong>Applying for Class:</strong> {selectedInquiry.applyingForClass}</p>
                    <p><strong>Session:</strong> {selectedInquiry.sessionName}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Parent / Guardian</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Father:</strong> {selectedInquiry.fatherName ?? "-"}</p>
                    <p><strong>Mother:</strong> {selectedInquiry.motherName ?? "-"}</p>
                    <p><strong>Guardian:</strong> {selectedInquiry.guardianName ?? "-"}</p>
                    <p><strong>Primary Contact:</strong> {selectedInquiry.primaryContactNumber}</p>
                    <p><strong>Alternate Contact:</strong> {selectedInquiry.alternateContactNumber ?? "-"}</p>
                    <p><strong>Email:</strong> {selectedInquiry.emailAddress ?? "-"}</p>
                    <p><strong>Father Occupation:</strong> {selectedInquiry.fatherOccupation ?? "-"}</p>
                    <p><strong>Mother Occupation:</strong> {selectedInquiry.motherOccupation ?? "-"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Address & Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p><strong>Address:</strong> {selectedInquiry.fullAddress}</p>
                    <p><strong>City:</strong> {selectedInquiry.city}</p>
                    <p><strong>State:</strong> {selectedInquiry.state}</p>
                    <p><strong>PIN Code:</strong> {selectedInquiry.pinCode}</p>
                    <p><strong>Special Needs / Medical:</strong> {selectedInquiry.specialNeedsMedicalConditions ?? "-"}</p>
                    <p><strong>Remarks / Questions:</strong> {selectedInquiry.remarksQuestions ?? "-"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">System Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={(value) => setEditStatus(value as InquiryStatus)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Assigned Staff / Counselor</Label>
                      <Select
                        value={editAssignedStaffUserId}
                        onValueChange={setEditAssignedStaffUserId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {staff.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="followUpDate">Follow-up Date</Label>
                      <Input
                        id="followUpDate"
                        type="date"
                        value={editFollowUpDate}
                        onChange={(event) => setEditFollowUpDate(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="remarksQuestions">Internal Remarks</Label>
                      <Textarea
                        id="remarksQuestions"
                        value={editRemarksQuestions}
                        onChange={(event) => setEditRemarksQuestions(event.target.value)}
                        placeholder="Add counselor notes or follow-up context"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={() => setSelectedInquiry(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent className="w-[min(92vw,900px)] max-h-[88vh] max-w-none overflow-hidden p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Download Selected Data</DialogTitle>
              <DialogDescription>
                Export the currently filtered inquiries and choose which fields to include.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 overflow-y-auto px-6 pb-6">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Current filters</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <p><strong>Search:</strong> {query.trim() || "All"}</p>
                  <p><strong>Status:</strong> {statusFilter === "all" ? "All" : statusFilter}</p>
                  <p><strong>Session:</strong> {sessionFilter === "all" ? "All" : sessionFilter}</p>
                  <p><strong>Class:</strong> {classFilter === "all" ? "All" : classFilter}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" onClick={() => setExportFields(DEFAULT_EXPORT_FIELDS)}>
                  Reset Fields
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setExportFields(EXPORT_FIELD_OPTIONS.map((option) => option.key))}
                >
                  Select All
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {EXPORT_FIELD_OPTIONS.map((option) => {
                  const checked = exportFields.includes(option.key);
                  return (
                    <label
                      key={option.key}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExportField(option.key)}
                        className="h-4 w-4"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleDownload} disabled={!inquiries.length || !exportFields.length}>
                Download Excel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
