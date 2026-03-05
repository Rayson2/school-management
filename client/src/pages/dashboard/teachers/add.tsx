import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type TeacherForm = {
  fullName: string;
  mobileNo: string;
  fathersName: string;
  mothersName: string;
  dateOfBirth: string;
  address: string;
  aadharCard: string;
  panCard: string;
  emailId: string;
  designation: string;
  qualification: string;
  accountNo: string;
  bankIfsc: string;
  bankName: string;
};

type BulkFailure = { row: number; message: string };
type BulkProgressItem = {
  row: number;
  teacherName: string;
  status: "success" | "failed" | "skipped";
  message: string;
};
type PostTeacherResult = {
  success: boolean;
  message: string;
  statusCode?: number;
  isAlreadyExists?: boolean;
  teacherId?: string;
  credentials?: { username: string; password: string };
};

const createEmptyForm = (): TeacherForm => ({
  fullName: "",
  mobileNo: "",
  fathersName: "",
  mothersName: "",
  dateOfBirth: "",
  address: "",
  aadharCard: "",
  panCard: "",
  emailId: "",
  designation: "",
  qualification: "",
  accountNo: "",
  bankIfsc: "",
  bankName: "",
});

const requiredFields: Array<keyof TeacherForm> = [
  "fullName",
  "mobileNo",
  "fathersName",
  "mothersName",
  "dateOfBirth",
  "address",
  "aadharCard",
  "panCard",
  "emailId",
  "designation",
  "qualification",
  "accountNo",
  "bankIfsc",
  "bankName",
];

const fieldLabels: Record<keyof TeacherForm, string> = {
  fullName: "Name",
  mobileNo: "Mobile Number",
  fathersName: "Father Name",
  mothersName: "Mother Name",
  dateOfBirth: "Date of Birth",
  address: "Full Address",
  aadharCard: "Aadhar Card",
  panCard: "PAN Card",
  emailId: "Email ID",
  designation: "Designation",
  qualification: "Qualification",
  accountNo: "Account Number",
  bankIfsc: "Bank IFSC",
  bankName: "Bank Name",
};

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const headerMap: Record<string, keyof TeacherForm> = {
  name: "fullName",
  teachername: "fullName",
  mobileno: "mobileNo",
  mobile: "mobileNo",
  phone: "mobileNo",
  fathername: "fathersName",
  mothername: "mothersName",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  fulladdress: "address",
  address: "address",
  aadharcard: "aadharCard",
  pancard: "panCard",
  emailid: "emailId",
  email: "emailId",
  designation: "designation",
  qualification: "qualification",
  accountno: "accountNo",
  bankifsc: "bankIfsc",
  bankname: "bankName",
};

const pad = (value: number) => String(value).padStart(2, "0");

const parseDateString = (value: string): string => {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return raw;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearNum = Number(match[3]);
  const year = yearNum < 100 ? 2000 + yearNum : yearNum;
  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return raw;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
};

const toFieldValue = (field: keyof TeacherForm, value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (field === "dateOfBirth" && typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }
  if (field === "dateOfBirth" && typeof value === "string") {
    return parseDateString(value);
  }
  return String(value).trim();
};

const formToPayload = (form: TeacherForm) => {
  const trimmed = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  ) as TeacherForm;

  for (const field of requiredFields) {
    if (!trimmed[field]) {
      return { ok: false as const, error: `${fieldLabels[field]} is required` };
    }
  }

  return {
    ok: true as const,
    payload: trimmed,
  };
};

const rowToForm = (row: Record<string, unknown>): TeacherForm => {
  const parsed = createEmptyForm();
  for (const [rawKey, value] of Object.entries(row)) {
    const mappedKey = headerMap[normalizeHeader(rawKey)];
    if (!mappedKey) continue;
    parsed[mappedKey] = toFieldValue(mappedKey, value);
  }
  return parsed;
};

const stringifyErrorValue = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item;
        if (typeof item === "object") {
          const field =
            "field" in item && typeof item.field === "string"
              ? item.field
              : "unknown";
          const message =
            "message" in item && typeof item.message === "string"
              ? item.message
              : JSON.stringify(item);
          return `${field}: ${message}`;
        }
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const inferDocumentTypeFromFileName = (fileName: string) => {
  const base = fileName.replace(/\.[^/.]+$/, "");
  const parts = base.split(/[_-]+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join("_") : parts[0] || "general";
};

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();
const getBulkFileIdentifier = (fileName: string) =>
  normalizeIdentifier(fileName.replace(/\.[^/.]+$/, "").split(/[_-]+/)[0] || "");

const groupBulkDocumentFiles = (files: File[]) => {
  const grouped = new Map<string, File[]>();
  for (const file of files) {
    const identifier = getBulkFileIdentifier(file.name);
    if (!identifier) continue;
    const existing = grouped.get(identifier) ?? [];
    existing.push(file);
    grouped.set(identifier, existing);
  }
  return grouped;
};

export default function AddTeacherPage() {
  const [singleForm, setSingleForm] = useState<TeacherForm>(createEmptyForm());
  const [singleDocuments, setSingleDocuments] = useState<File[]>([]);
  const [singleProfilePic, setSingleProfilePic] = useState<File | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkDocumentFiles, setBulkDocumentFiles] = useState<File[]>([]);
  const [bulkProfilePicFiles, setBulkProfilePicFiles] = useState<File[]>([]);
  const [bulkSuccessCount, setBulkSuccessCount] = useState(0);
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);
  const [bulkTotalRows, setBulkTotalRows] = useState(0);
  const [bulkProcessedRows, setBulkProcessedRows] = useState(0);
  const [bulkProgressItems, setBulkProgressItems] = useState<BulkProgressItem[]>([]);
  const [skipIfExists, setSkipIfExists] = useState(true);
  const [bulkSkippedCount, setBulkSkippedCount] = useState(0);

  const handleSingleChange =
    (field: keyof TeacherForm) => (e: ChangeEvent<HTMLInputElement>) => {
      setSingleForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const postTeacher = async (
    payload: ReturnType<typeof formToPayload>,
  ): Promise<PostTeacherResult> => {
    if (!payload.ok) return { success: false, message: payload.error };

    const res = await fetch("/api/teacher/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.payload),
    });

    const body = (await res.json().catch(() => null)) as
      | {
          success?: boolean;
          message?: string;
          error?: unknown;
          data?: {
            teacher?: { id?: string };
            credentials?: { username?: string; password?: string };
          };
        }
      | null;

    if (!res.ok || !body?.success) {
      const errorMessage =
        stringifyErrorValue(body?.error) ||
        body?.message ||
        `Request failed with status ${res.status}`;
      return {
        success: false,
        message: errorMessage,
        statusCode: res.status,
        isAlreadyExists: res.status === 409 || /already exists/i.test(errorMessage),
      };
    }

    return {
      success: true,
      message: body?.message || "Teacher added",
      teacherId: body?.data?.teacher?.id,
      credentials:
        body?.data?.credentials?.username && body?.data?.credentials?.password
          ? {
              username: body.data.credentials.username,
              password: body.data.credentials.password,
            }
          : undefined,
    };
  };

  const resolveTeacherId = async (identifier: string) => {
    if (!identifier.trim()) return null;
    const response = await fetch(
      `/api/teacher/lookup/${encodeURIComponent(identifier.trim())}`,
    );
    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: { id?: string } }
      | null;
    if (!response.ok || !result?.success || !result.data?.id) return null;
    return result.data.id;
  };

  const uploadTeacherDocuments = async (teacherId: string, files: File[]) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("documentType", inferDocumentTypeFromFileName(file.name));
      const response = await fetch(`/api/teacher/${teacherId}/documents`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to upload document");
      }
    }
  };

  const uploadTeacherProfilePic = async (teacherId: string, file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await fetch(`/api/teacher/${teacherId}/profile-pic`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Failed to upload profile picture");
    }
  };

  const handleSingleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const prepared = formToPayload(singleForm);
    if (!prepared.ok) return toast.error(prepared.error);

    setSingleSubmitting(true);
    try {
      const result = await postTeacher(prepared);
      if (!result.success) return toast.error(result.message);

      if (singleDocuments.length > 0 && result.teacherId) {
        await uploadTeacherDocuments(result.teacherId, singleDocuments);
      }
      if (singleProfilePic && result.teacherId) {
        await uploadTeacherProfilePic(result.teacherId, singleProfilePic);
      }

      const credentialText = result.credentials
        ? ` | Username: ${result.credentials.username} | Password: ${result.credentials.password}`
        : "";
      toast.success(`Teacher added successfully${credentialText}`);
      setSingleForm(createEmptyForm());
      setSingleDocuments([]);
      setSingleProfilePic(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add teacher");
    } finally {
      setSingleSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return toast.error("Please select an Excel file");
    setBulkSubmitting(true);
    setBulkSuccessCount(0);
    setBulkFailures([]);
    setBulkTotalRows(0);
    setBulkProcessedRows(0);
    setBulkProgressItems([]);
    setBulkSkippedCount(0);

    try {
      const groupedDocuments = groupBulkDocumentFiles(bulkDocumentFiles);
      const groupedProfilePics = groupBulkDocumentFiles(bulkProfilePicFiles);
      const workbook = XLSX.read(await bulkFile.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return toast.error("The Excel file has no sheets");
      const rows = XLSX.utils
        .sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], {
          defval: "",
          raw: true,
        })
        .map(rowToForm)
        .filter((form) => Object.values(form).some((value) => value.trim()));

      if (!rows.length) return toast.error("The Excel file is empty");
      setBulkTotalRows(rows.length);

      let successCount = 0;
      let skippedCount = 0;
      const failures: BulkFailure[] = [];

      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2;
        const form = rows[i];
        const prepared = formToPayload(form);
        if (!prepared.ok) {
          failures.push({ row: rowNumber, message: prepared.error });
          setBulkProgressItems((prev) => [
            ...prev,
            {
              row: rowNumber,
              teacherName: form.fullName || "Unknown",
              status: "failed",
              message: prepared.error,
            },
          ]);
          break;
        }

        const result = await postTeacher(prepared);
        if (!result.success) {
          if (skipIfExists && result.isAlreadyExists) {
            skippedCount += 1;
            const matchedFiles =
              groupedDocuments.get(normalizeIdentifier(form.mobileNo)) ?? [];
            const matchedProfilePics =
              groupedProfilePics.get(normalizeIdentifier(form.mobileNo)) ?? [];
            if (matchedFiles.length > 0) {
              const existingTeacherId =
                (await resolveTeacherId(form.mobileNo)) ??
                (await resolveTeacherId(form.emailId));
              if (existingTeacherId) {
                await uploadTeacherDocuments(existingTeacherId, matchedFiles);
                if (matchedProfilePics.length > 0) {
                  await uploadTeacherProfilePic(existingTeacherId, matchedProfilePics[0]);
                }
              }
            }
            setBulkProgressItems((prev) => [
              ...prev,
              {
                row: rowNumber,
                teacherName: form.fullName || "Unknown",
                status: "skipped",
                message: "Skipped: Teacher already exists",
              },
            ]);
            setBulkProcessedRows(i + 1);
            continue;
          }

          failures.push({ row: rowNumber, message: result.message });
          setBulkProgressItems((prev) => [
            ...prev,
            {
              row: rowNumber,
              teacherName: form.fullName || "Unknown",
              status: "failed",
              message: result.message,
            },
          ]);
          break;
        }

        successCount += 1;
        const matchedFiles =
          groupedDocuments.get(normalizeIdentifier(form.mobileNo)) ?? [];
        const matchedProfilePics =
          groupedProfilePics.get(normalizeIdentifier(form.mobileNo)) ?? [];
        if (matchedFiles.length > 0 && result.teacherId) {
          await uploadTeacherDocuments(result.teacherId, matchedFiles);
        }
        if (matchedProfilePics.length > 0 && result.teacherId) {
          await uploadTeacherProfilePic(result.teacherId, matchedProfilePics[0]);
        }
        setBulkProgressItems((prev) => [
          ...prev,
          {
            row: rowNumber,
            teacherName: form.fullName || "Unknown",
            status: "success",
            message: "Added successfully",
          },
        ]);
        setBulkProcessedRows(i + 1);
      }

      setBulkSuccessCount(successCount);
      setBulkSkippedCount(skippedCount);
      setBulkFailures(failures);
      if (failures.length) toast.error("Bulk upload stopped due to an error");
      else toast.success(`Bulk upload complete: ${successCount} added, ${skippedCount} skipped`);
    } catch {
      toast.error("Failed to process the Excel file");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const downloadSampleFile = () => {
    const sampleRows = [
      {
        mobile_no: "9876543210",
        name: "Raj Kumar",
        father_name: "Shyam Kumar",
        mother_name: "Radha Devi",
        date_of_birth: "2003-08-15",
        full_address: "Bhopal, MP",
        aadhar_card: "123412341234",
        pan_card: "ABCDE1234F",
        email_id: "raj@school.com",
        designation: "Math Teacher",
        qualification: "M.Sc B.Ed",
        account_no: "123456789012",
        bank_ifsc: "SBIN0001234",
        bank_name: "SBI",
      },
    ];
    const sheet = XLSX.utils.json_to_sheet(sampleRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Teachers");
    XLSX.writeFile(book, "teachers-bulk-sample.xlsx");
  };

  const progressPercent =
    bulkTotalRows > 0 ? Math.round((bulkProcessedRows / bulkTotalRows) * 100) : 0;

  return (
    <DashboardLayout title="Add Teacher">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Add Teacher</h1>

        <Card>
          <CardHeader>
            <CardTitle>Single Teacher</CardTitle>
            <CardDescription>
              Username is auto-set to phone number. Password is auto-generated as
              first 3 letters of first name + birth year (example: RAJ2002).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(singleForm) as Array<keyof TeacherForm>).map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{fieldLabels[field]} *</Label>
                    <Input
                      id={field}
                      type={field === "dateOfBirth" ? "date" : "text"}
                      value={singleForm[field]}
                      onChange={handleSingleChange(field)}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="single-documents">Documents (Optional)</Label>
                <Input
                  id="single-documents"
                  type="file"
                  multiple
                  onChange={(e) => setSingleDocuments(Array.from(e.target.files ?? []))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="single-profile-pic">Profile Picture (Optional)</Label>
                <Input
                  id="single-profile-pic"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSingleProfilePic(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button type="submit" disabled={singleSubmitting}>
                {singleSubmitting ? "Submitting..." : "Add Teacher"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload (Excel)</CardTitle>
            <CardDescription>
              Use columns like mobile_no, name, father_name, mother_name, date_of_birth,
              full_address, aadhar_card, pan_card, email_id, designation, qualification,
              account_no, bank_ifsc, bank_name.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="outline" onClick={downloadSampleFile}>
              Download Sample Excel
            </Button>
            <div className="space-y-2">
              <Label htmlFor="excelFile">Excel File</Label>
              <Input
                id="excelFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-documents">Bulk Documents (Optional)</Label>
              <Input
                id="bulk-documents"
                type="file"
                multiple
                onChange={(e) => setBulkDocumentFiles(Array.from(e.target.files ?? []))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-profile-pics">Bulk Profile Pictures (Optional)</Label>
              <Input
                id="bulk-profile-pics"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setBulkProfilePicFiles(Array.from(e.target.files ?? []))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipIfExists}
                onChange={(e) => setSkipIfExists(e.target.checked)}
                className="h-4 w-4"
              />
              Skip row if teacher already exists
            </label>

            <Button onClick={handleBulkUpload} disabled={bulkSubmitting || !bulkFile}>
              {bulkSubmitting ? "Uploading..." : "Upload and Add Teachers"}
            </Button>

            {(bulkTotalRows > 0 || bulkSubmitting) && (
              <div className="space-y-2 rounded-md border p-4">
                <p className="text-sm font-medium">
                  Progress: {bulkProcessedRows}/{bulkTotalRows} ({progressPercent}%)
                </p>
                <div className="h-2 w-full rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {bulkProgressItems.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1 text-sm pt-1">
                    {bulkProgressItems.map((item) => (
                      <p
                        key={`${item.row}-${item.teacherName}-${item.status}`}
                        className={
                          item.status === "success"
                            ? "text-green-700"
                            : item.status === "skipped"
                              ? "text-amber-700"
                              : "text-red-600"
                        }
                      >
                        Row {item.row} - {item.teacherName}: {item.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(bulkSuccessCount > 0 || bulkFailures.length > 0) && (
              <div className="rounded-md border p-4 space-y-2">
                <p className="text-sm font-medium">
                  Success: {bulkSuccessCount} | Skipped: {bulkSkippedCount} | Failed:{" "}
                  {bulkFailures.length}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
