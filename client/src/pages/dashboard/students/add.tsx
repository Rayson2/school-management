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

type StudentForm = {
  fullName: string;
  rollNumber: string;
  enrollmentNo: string;
  admissionNo: string;
  admissionDate: string;
  sessionName: string;
  className: string;
  gender: string;
  category: string;
  dateOfBirth: string;
  fathersName: string;
  mothersName: string;
  mobileNo: string;
  address: string;
  parentPhone: string;
  aaparId: string;
  aadharNo: string;
  parentEmail: string;
  bloodGroup: string;
  penNo: string;
};
type EnrollmentMode = "auto" | "manual";

type BulkFailure = {
  row: number;
  message: string;
};

type BulkProgressItem = {
  row: number;
  studentName: string;
  status: "success" | "failed" | "skipped";
  message: string;
};

type PostStudentResult = {
  success: boolean;
  message: string;
  statusCode?: number;
  isAlreadyExists?: boolean;
  studentId?: string;
  credentials?: { username: string; password: string };
};

const createEmptyForm = (): StudentForm => ({
  fullName: "",
  rollNumber: "",
  enrollmentNo: "",
  admissionNo: "",
  admissionDate: "",
  sessionName: "",
  className: "",
  gender: "",
  category: "",
  dateOfBirth: "",
  fathersName: "",
  mothersName: "",
  mobileNo: "",
  address: "",
  parentPhone: "",
  aaparId: "",
  aadharNo: "",
  parentEmail: "",
  bloodGroup: "",
  penNo: "",
});

const requiredFields: Array<keyof StudentForm> = [
  "fullName",
  "admissionNo",
  "admissionDate",
  "sessionName",
  "className",
  "gender",
  "category",
  "dateOfBirth",
  "fathersName",
  "mothersName",
];

const fieldLabels: Record<keyof StudentForm, string> = {
  fullName: "Full Name",
  rollNumber: "Roll Number (Optional)",
  enrollmentNo: "Enrollment Number",
  admissionNo: "Admission Number",
  admissionDate: "Admission Date",
  sessionName: "Session",
  className: "Class Name",
  gender: "Gender",
  category: "Category",
  dateOfBirth: "Date of Birth",
  fathersName: "Father's Name",
  mothersName: "Mother's Name",
  mobileNo: "Mobile Number",
  address: "Address",
  parentPhone: "Parent Phone",
  aaparId: "AAPAR ID",
  aadharNo: "Aadhar Number",
  parentEmail: "Parent Email",
  bloodGroup: "Blood Group",
  penNo: "PEN No",
};

const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const headerMap: Record<string, keyof StudentForm> = {
  studentname: "fullName",
  fullname: "fullName",
  studentclass: "className",
  session: "sessionName",
  sessionname: "sessionName",
  academicsession: "sessionName",
  admissiondate: "admissionDate",
  studentdateofbirth: "dateOfBirth",
  studentgender: "gender",
  studentcategory: "category",
  fathername: "fathersName",
  mothername: "mothersName",
  fulladdress: "address",
  studentadharno: "aadharNo",
  rollnumber: "rollNumber",
  rollno: "rollNumber",
  enrollmentnumber: "enrollmentNo",
  enrollmentno: "enrollmentNo",
  admissionno: "admissionNo",
  admissionnumber: "admissionNo",
  classname: "className",
  class: "className",
  gender: "gender",
  category: "category",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  fathersname: "fathersName",
  mothersname: "mothersName",
  mobileno: "mobileNo",
  mobile: "mobileNo",
  address: "address",
  parentphone: "parentPhone",
  parentemail: "parentEmail",
  aaparid: "aaparId",
  aadharno: "aadharNo",
  bloodgroup: "bloodGroup",
  penno: "penNo",
};

const isRequiredField = (field: keyof StudentForm) =>
  requiredFields.includes(field);

const pad = (value: number) => String(value).padStart(2, "0");

const parseDateString = (value: string): string => {
  const raw = value.trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

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

const toFieldValue = (field: keyof StudentForm, value: unknown): string => {
  if (value === null || value === undefined) return "";

  if (
    (field === "admissionDate" || field === "dateOfBirth") &&
    typeof value === "number"
  ) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    }
  }

  if (
    (field === "admissionDate" || field === "dateOfBirth") &&
    typeof value === "string"
  ) {
    return parseDateString(value);
  }

  return String(value).trim();
};

const formToPayload = (form: StudentForm, enrollmentMode: EnrollmentMode = "auto") => {
  const trimmed = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  ) as StudentForm;

  for (const field of requiredFields) {
    if (!trimmed[field]) {
      return {
        ok: false as const,
        error: `${fieldLabels[field]} is required`,
      };
    }
  }

  if (enrollmentMode === "manual" && !trimmed.enrollmentNo) {
    return {
      ok: false as const,
      error: "Enrollment Number is required when manual mode is selected",
    };
  }

  return {
    ok: true as const,
    payload: {
      fullName: trimmed.fullName,
      rollNumber: trimmed.rollNumber || undefined,
      enrollmentNo:
        enrollmentMode === "manual" ? trimmed.enrollmentNo || undefined : undefined,
      admissionNo: trimmed.admissionNo,
      admissionDate: trimmed.admissionDate,
      sessionName: trimmed.sessionName,
      className: trimmed.className,
      gender: trimmed.gender,
      category: trimmed.category,
      dateOfBirth: trimmed.dateOfBirth,
      fathersName: trimmed.fathersName,
      mothersName: trimmed.mothersName,
      mobileNo: trimmed.mobileNo || undefined,
      address: trimmed.address || undefined,
      parentPhone: trimmed.parentPhone || undefined,
      aaparId: trimmed.aaparId || undefined,
      aadharNo: trimmed.aadharNo || undefined,
      parentEmail: trimmed.parentEmail || undefined,
      bloodGroup: trimmed.bloodGroup || undefined,
      penNo: trimmed.penNo || undefined,
    },
  };
};

const rowToForm = (row: Record<string, unknown>): StudentForm => {
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

const normalizeIdentifier = (value: string) => value.trim().toLowerCase();

const inferDocumentTypeFromFileName = (fileName: string) => {
  const base = fileName.replace(/\.[^/.]+$/, "");
  const parts = base.split(/[_-]+/).filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(1).join("_");
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return "general";
};

const getBulkFileIdentifier = (fileName: string) => {
  const base = fileName.replace(/\.[^/.]+$/, "");
  const parts = base.split(/[_-]+/).filter(Boolean);
  if (!parts.length) return "";
  return normalizeIdentifier(parts[0]);
};

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

export default function AddStudentPage() {
  const [singleForm, setSingleForm] = useState<StudentForm>(createEmptyForm());
  const [singleEnrollmentMode, setSingleEnrollmentMode] =
    useState<EnrollmentMode>("auto");
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
  const [bulkProgressItems, setBulkProgressItems] = useState<BulkProgressItem[]>(
    [],
  );
  const [bulkModalError, setBulkModalError] = useState<BulkFailure | null>(null);
  const [skipIfExists, setSkipIfExists] = useState(true);
  const [bulkSkippedCount, setBulkSkippedCount] = useState(0);

  const handleSingleChange =
    (field: keyof StudentForm) => (e: ChangeEvent<HTMLInputElement>) => {
      setSingleForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const postStudent = async (
    payload: ReturnType<typeof formToPayload>,
  ): Promise<PostStudentResult> => {
    if (!payload.ok) {
      return { success: false, message: payload.error };
    }

    const res = await fetch("/api/student/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.payload),
    });

    let body:
      | {
          success?: boolean;
          message?: string;
          error?: string;
          data?: {
            id?: string;
            userId?: string;
            student?: { id?: string };
            credentials?: { username?: string; password?: string };
          };
        }
      | null = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok || !body?.success) {
      const detailedError = stringifyErrorValue(body?.error);
      const errorMessage =
        detailedError || body?.message || `Request failed with status ${res.status}`;
      const alreadyExists =
        res.status === 409 || /already exists/i.test(errorMessage);
      return {
        success: false,
        message: errorMessage,
        statusCode: res.status,
        isAlreadyExists: alreadyExists,
      };
    }

    return {
      success: true,
      message: body?.message || "Student added",
      studentId: body?.data?.student?.id || body?.data?.id,
      credentials:
        body?.data?.credentials?.username && body?.data?.credentials?.password
          ? {
              username: body.data.credentials.username,
              password: body.data.credentials.password,
            }
          : undefined,
    };
  };

  const uploadStudentDocument = async (
    studentId: string,
    file: File,
    documentType?: string,
  ) => {
    const formData = new FormData();
    formData.append("files", file);
    if (documentType?.trim()) {
      formData.append("documentType", documentType.trim());
    }

    const response = await fetch(`/api/student/${studentId}/documents`, {
      method: "POST",
      body: formData,
    });

    let result: { success?: boolean; error?: string; message?: string } | null = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Failed to upload document");
    }
  };

  const uploadStudentDocuments = async (studentId: string, files: File[]) => {
    for (const file of files) {
      const docType = inferDocumentTypeFromFileName(file.name);
      await uploadStudentDocument(studentId, file, docType);
    }
  };

  const uploadStudentProfilePic = async (studentId: string, file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch(`/api/student/${studentId}/profile-pic`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Failed to upload profile picture");
    }
  };

  const resolveStudentId = async (identifier: string) => {
    if (!identifier.trim()) return null;

    const response = await fetch(
      `/api/student/lookup/${encodeURIComponent(identifier.trim())}`,
    );

    let result:
      | {
          success?: boolean;
          data?: { id?: string };
          error?: string;
        }
      | null = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success || !result.data?.id) {
      return null;
    }

    return result.data.id;
  };

  const handleSingleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const prepared = formToPayload(singleForm, singleEnrollmentMode);
    if (!prepared.ok) {
      toast.error(prepared.error);
      return;
    }

    setSingleSubmitting(true);
    try {
      const result = await postStudent(prepared);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      if (singleDocuments.length > 0) {
        if (!result.studentId) {
          toast.error("Student added but document upload target is missing");
        } else {
          try {
            await uploadStudentDocuments(result.studentId, singleDocuments);
            const credentialText = result.credentials
              ? ` | Username: ${result.credentials.username} | Password: ${result.credentials.password}`
              : "";
            toast.success(`Student and documents added successfully${credentialText}`);
          } catch (err) {
            toast.error(
              err instanceof Error
                ? `Student added, but document upload failed: ${err.message}`
                : "Student added, but document upload failed",
            );
          }
        }
      } else {
        const credentialText = result.credentials
          ? ` | Username: ${result.credentials.username} | Password: ${result.credentials.password}`
          : "";
        toast.success(`Student added successfully${credentialText}`);
      }

      if (singleProfilePic && result.studentId) {
        try {
          await uploadStudentProfilePic(result.studentId, singleProfilePic);
        } catch (err) {
          toast.error(
            err instanceof Error
              ? `Student added, but profile pic upload failed: ${err.message}`
              : "Student added, but profile pic upload failed",
          );
        }
      }

      setSingleForm(createEmptyForm());
      setSingleEnrollmentMode("auto");
      setSingleDocuments([]);
      setSingleProfilePic(null);
    } catch {
      toast.error("Failed to add student");
    } finally {
      setSingleSubmitting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error("Please select an Excel file");
      return;
    }

    setBulkSubmitting(true);
    setBulkSuccessCount(0);
    setBulkFailures([]);
    setBulkTotalRows(0);
    setBulkProcessedRows(0);
    setBulkProgressItems([]);
    setBulkModalError(null);
    setBulkSkippedCount(0);

    try {
      const groupedDocuments = groupBulkDocumentFiles(bulkDocumentFiles);
      const groupedProfilePics = groupBulkDocumentFiles(bulkProfilePicFiles);
      const buffer = await bulkFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        toast.error("The Excel file has no sheets");
        return;
      }
      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
        raw: true,
      });

      const normalizedRows = rows
        .map(rowToForm)
        .filter((form) =>
          Object.values(form).some((value) => value.trim().length > 0),
        );

      if (!normalizedRows.length) {
        toast.error("The Excel file is empty");
        return;
      }

      setBulkTotalRows(normalizedRows.length);

      let successCount = 0;
      let skippedCount = 0;
      let uploadedDocCount = 0;
      const failures: BulkFailure[] = [];
      let stopUpload = false;

      for (let i = 0; i < normalizedRows.length; i++) {
        const parsedForm = normalizedRows[i];
        const prepared = formToPayload(parsedForm);
        const rowNumber = i + 2;

        if (!prepared.ok) {
          const failure = { row: rowNumber, message: prepared.error };
          failures.push(failure);
          setBulkProgressItems((prev) => [
            ...prev,
            {
              row: rowNumber,
              studentName: parsedForm.fullName || "Unknown Student",
              status: "failed",
              message: prepared.error,
            },
          ]);
          setBulkModalError(failure);
          stopUpload = true;
          setBulkProcessedRows(i + 1);
          break;
        }

        const result = await postStudent(prepared);
        if (result.success) {
          successCount += 1;
          const possibleIdentifiers = [
            parsedForm.admissionNo,
            parsedForm.rollNumber,
            parsedForm.enrollmentNo,
          ].map(normalizeIdentifier);
          const matchedFiles = possibleIdentifiers.flatMap(
            (identifier) => groupedDocuments.get(identifier) ?? [],
          );
          const matchedProfilePics = possibleIdentifiers.flatMap(
            (identifier) => groupedProfilePics.get(identifier) ?? [],
          );

          if (matchedFiles.length > 0 && result.studentId) {
            try {
              await uploadStudentDocuments(result.studentId, matchedFiles);
              uploadedDocCount += matchedFiles.length;
            } catch (err) {
              const failure = {
                row: rowNumber,
                message:
                  err instanceof Error ? err.message : "Failed to upload documents",
              };
              failures.push(failure);
              setBulkProgressItems((prev) => [
                ...prev,
                {
                  row: rowNumber,
                  studentName: parsedForm.fullName || "Unknown Student",
                  status: "failed",
                  message: `Student added, but documents failed: ${failure.message}`,
                },
              ]);
              setBulkModalError(failure);
              stopUpload = true;
              setBulkProcessedRows(i + 1);
              break;
            }
          }

          if (matchedProfilePics.length > 0 && result.studentId) {
            try {
              await uploadStudentProfilePic(result.studentId, matchedProfilePics[0]);
            } catch (err) {
              const failure = {
                row: rowNumber,
                message:
                  err instanceof Error
                    ? err.message
                    : "Failed to upload profile picture",
              };
              failures.push(failure);
              setBulkProgressItems((prev) => [
                ...prev,
                {
                  row: rowNumber,
                  studentName: parsedForm.fullName || "Unknown Student",
                  status: "failed",
                  message: `Student added, but profile pic failed: ${failure.message}`,
                },
              ]);
              setBulkModalError(failure);
              stopUpload = true;
              setBulkProcessedRows(i + 1);
              break;
            }
          }

          setBulkProgressItems((prev) => [
            ...prev,
            {
              row: rowNumber,
              studentName: parsedForm.fullName || "Unknown Student",
              status: "success",
              message:
                matchedFiles.length > 0
                  ? `Added with ${matchedFiles.length} document(s)${
                      result.credentials
                        ? ` | Username: ${result.credentials.username} | Password: ${result.credentials.password}`
                        : ""
                    }`
                  : `Added successfully${
                      result.credentials
                        ? ` | Username: ${result.credentials.username} | Password: ${result.credentials.password}`
                        : ""
                    }`,
            },
          ]);
        } else {
          if (skipIfExists && result.isAlreadyExists) {
            skippedCount += 1;
            const possibleIdentifiers = [
              parsedForm.admissionNo,
              parsedForm.rollNumber,
              parsedForm.enrollmentNo,
            ].map(normalizeIdentifier);
            const matchedFiles = possibleIdentifiers.flatMap(
              (identifier) => groupedDocuments.get(identifier) ?? [],
            );
            const matchedProfilePics = possibleIdentifiers.flatMap(
              (identifier) => groupedProfilePics.get(identifier) ?? [],
            );

            if (matchedFiles.length > 0) {
              const resolvedId =
                (await resolveStudentId(parsedForm.admissionNo)) ??
                (await resolveStudentId(parsedForm.rollNumber)) ??
                (await resolveStudentId(parsedForm.enrollmentNo));

              if (resolvedId) {
                try {
                  await uploadStudentDocuments(resolvedId, matchedFiles);
                  uploadedDocCount += matchedFiles.length;
                } catch (err) {
                  const failure = {
                    row: rowNumber,
                    message:
                      err instanceof Error
                        ? err.message
                        : "Failed to upload documents for existing student",
                  };
                  failures.push(failure);
                  setBulkProgressItems((prev) => [
                    ...prev,
                    {
                      row: rowNumber,
                      studentName: parsedForm.fullName || "Unknown Student",
                      status: "failed",
                      message: `Skipped student, but documents failed: ${failure.message}`,
                    },
                  ]);
                  setBulkModalError(failure);
                  stopUpload = true;
                  setBulkProcessedRows(i + 1);
                  break;
                }
              }
            }

            if (matchedProfilePics.length > 0) {
              const resolvedId =
                (await resolveStudentId(parsedForm.admissionNo)) ??
                (await resolveStudentId(parsedForm.rollNumber)) ??
                (await resolveStudentId(parsedForm.enrollmentNo));

              if (resolvedId) {
                try {
                  await uploadStudentProfilePic(resolvedId, matchedProfilePics[0]);
                } catch (err) {
                  const failure = {
                    row: rowNumber,
                    message:
                      err instanceof Error
                        ? err.message
                        : "Failed to upload profile picture for existing student",
                  };
                  failures.push(failure);
                  setBulkProgressItems((prev) => [
                    ...prev,
                    {
                      row: rowNumber,
                      studentName: parsedForm.fullName || "Unknown Student",
                      status: "failed",
                      message: `Skipped student, but profile pic failed: ${failure.message}`,
                    },
                  ]);
                  setBulkModalError(failure);
                  stopUpload = true;
                  setBulkProcessedRows(i + 1);
                  break;
                }
              }
            }

            setBulkProgressItems((prev) => [
              ...prev,
              {
                row: rowNumber,
                studentName: parsedForm.fullName || "Unknown Student",
                status: "skipped",
                message:
                  matchedFiles.length > 0
                    ? `Skipped existing student, uploaded ${matchedFiles.length} document(s)`
                    : "Skipped: Student already exists",
              },
            ]);
            setBulkProcessedRows(i + 1);
            continue;
          }

          const failure = { row: rowNumber, message: result.message };
          failures.push(failure);
          setBulkProgressItems((prev) => [
            ...prev,
            {
              row: rowNumber,
              studentName: parsedForm.fullName || "Unknown Student",
              status: "failed",
              message: result.message,
            },
          ]);
          setBulkModalError(failure);
          stopUpload = true;
          setBulkProcessedRows(i + 1);
          break;
        }

        setBulkProcessedRows(i + 1);
      }

      setBulkSuccessCount(successCount);
      setBulkSkippedCount(skippedCount);
      setBulkFailures(failures);

      if (stopUpload) {
        toast.error("Upload canceled due to an error");
      } else if (failures.length === 0) {
        toast.success(
          `Bulk upload complete: ${successCount} added, ${skippedCount} skipped, ${uploadedDocCount} docs uploaded`,
        );
      } else {
        toast.error(
          `Bulk upload complete: ${successCount} added, ${skippedCount} skipped, ${uploadedDocCount} docs uploaded, ${failures.length} failed`,
        );
      }
    } catch {
      toast.error("Failed to process the Excel file");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const downloadSampleFile = () => {
    const headers = [
      "Sr No.",
      "Student Class",
      "Session",
      "Student Type",
      "Admission Date",
      "Admission No.",
      "Enrollment No.",
      "Roll No.",
      "Student Name",
      "Father Name",
      "Mother Name",
      "Student DateOfBirth",
      "Student Gender",
      "Student Category",
      "Mobile No.",
      "Full Address",
      "Student Adhar No.",
      "Aapar Id",
      "PEN No.",
    ];

    const sampleRows = [
      {
        "Sr No.": 1,
        "Student Class": "10-A",
        Session: "2025-2026",
        "Student Type": "Regular",
        "Admission Date": "2025-04-01",
        "Admission No.": "ADM1001",
        "Enrollment No.": "",
        "Roll No.": "1",
        "Student Name": "Aarav Sharma",
        "Father Name": "Rajesh Sharma",
        "Mother Name": "Sunita Sharma",
        "Student DateOfBirth": "2010-08-15",
        "Student Gender": "Male",
        "Student Category": "General",
        "Mobile No.": "9876543210",
        "Full Address": "City Center, Bhopal",
        "Student Adhar No.": "123412341234",
        "Aapar Id": "AAPAR1001",
        "PEN No.": "PEN1001",
      },
    ];

    const sheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Students");
    XLSX.writeFile(book, "students-bulk-sample.xlsx");
  };

  const progressPercent =
    bulkTotalRows > 0 ? Math.round((bulkProcessedRows / bulkTotalRows) * 100) : 0;

  return (
    <DashboardLayout title="Add Student">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Add Student</h1>

        <Card>
          <CardHeader>
            <CardTitle>Single Student</CardTitle>
            <CardDescription>
              Fill in the form and submit one student at a time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(singleForm) as Array<keyof StudentForm>)
                  .filter((field) => field !== "enrollmentNo")
                  .map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>
                      {fieldLabels[field]}
                      {isRequiredField(field) ? " *" : ""}
                    </Label>
                    <Input
                      id={field}
                      type={
                        field === "admissionDate" || field === "dateOfBirth"
                          ? "date"
                          : "text"
                      }
                      value={singleForm[field]}
                      onChange={handleSingleChange(field)}
                      required={isRequiredField(field)}
                    />
                  </div>
                ))}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="enrollmentNo">Enrollment Number</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={singleEnrollmentMode}
                      onChange={(e) =>
                        setSingleEnrollmentMode(e.target.value as EnrollmentMode)
                      }
                      className="h-10 rounded-md border bg-transparent px-3 text-sm"
                    >
                      <option value="auto">Auto Generate</option>
                      <option value="manual">Enter Manually</option>
                    </select>
                    <div className="md:col-span-2">
                      <Input
                        id="enrollmentNo"
                        type="text"
                        value={singleForm.enrollmentNo}
                        onChange={handleSingleChange("enrollmentNo")}
                        disabled={singleEnrollmentMode === "auto"}
                        placeholder={
                          singleEnrollmentMode === "auto"
                            ? "Will be generated from session prefix"
                            : "Enter enrollment number"
                        }
                        required={singleEnrollmentMode === "manual"}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto mode uses the session enrollment prefix and next sequence.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="single-documents">Documents (Optional)</Label>
                <Input
                  id="single-documents"
                  type="file"
                  multiple
                  onChange={(e) =>
                    setSingleDocuments(Array.from(e.target.files ?? []))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Document type is auto-derived from file name. Example:
                  `aadhaar_card.pdf` -&gt; `card`.
                </p>
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
                {singleSubmitting ? "Submitting..." : "Add Student"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload (Excel)</CardTitle>
            <CardDescription>
              Upload in your school format. Extra columns like `Sr No.`,
              `Student Type` are ignored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button type="button" variant="outline" onClick={downloadSampleFile}>
                Download Sample Excel
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excelFile">Excel File</Label>
              <Input
                id="excelFile"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                If `Enrollment No.` is blank in Excel, it will be auto-generated from the session prefix.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-documents">Bulk Documents (Optional)</Label>
              <Input
                id="bulk-documents"
                type="file"
                multiple
                onChange={(e) =>
                  setBulkDocumentFiles(Array.from(e.target.files ?? []))
                }
              />
              <p className="text-xs text-muted-foreground">
                Name each file as `IDENTIFIER_documentType.ext` where identifier is
                Admission No / Roll No / Enrollment No / Username. Example:
                `ADM1001_transfer_certificate.pdf`.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-profile-pics">Bulk Profile Pictures (Optional)</Label>
              <Input
                id="bulk-profile-pics"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) =>
                  setBulkProfilePicFiles(Array.from(e.target.files ?? []))
                }
              />
              <p className="text-xs text-muted-foreground">
                Name each file as `IDENTIFIER.jpg` where identifier is Admission No or Roll No.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipIfExists}
                onChange={(e) => setSkipIfExists(e.target.checked)}
                className="h-4 w-4"
              />
              Skip row if student already exists
            </label>

            <Button onClick={handleBulkUpload} disabled={bulkSubmitting || !bulkFile}>
              {bulkSubmitting ? "Uploading..." : "Upload and Add Students"}
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
                        key={`${item.row}-${item.studentName}-${item.status}`}
                        className={
                          item.status === "success"
                            ? "text-green-700"
                            : item.status === "skipped"
                              ? "text-amber-700"
                              : "text-red-600"
                        }
                      >
                        Row {item.row} - {item.studentName}: {item.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(bulkSuccessCount > 0 || bulkFailures.length > 0) && (
              <div className="rounded-md border p-4 space-y-2">
                <p className="text-sm font-medium">
                  Success: {bulkSuccessCount} | Skipped: {bulkSkippedCount} |
                  Failed: {bulkFailures.length}
                </p>
                {bulkFailures.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-600">Failed rows:</p>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {bulkFailures.map((failure) => (
                        <li key={`${failure.row}-${failure.message}`}>
                          Row {failure.row}: {failure.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {bulkModalError && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-lg bg-background border shadow-lg p-5 space-y-3">
              <h2 className="text-lg font-semibold text-red-600">
                Upload Stopped Due to Error
              </h2>
              <p className="text-sm">
                Row {bulkModalError.row}: {bulkModalError.message}
              </p>
              <Button type="button" onClick={() => setBulkModalError(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
