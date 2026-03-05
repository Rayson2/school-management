import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import useUserStore from "@/store/user.store";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ExamOption = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  examTypeLabel?: string;
  academicYear: string;
  sessionName?: string;
};

type StudentOption = {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  enrollmentNo: string | null;
  className: string;
};

type AdmitCardData = {
  school: {
    name: string;
    district: string;
    affiliation: string;
    udiseNo: string;
    address: string;
    phone?: string;
    email: string;
    logoUrl: string | null;
  };
  student: {
    studentId: string;
    fullName: string;
    fathersName: string;
    mothersName: string;
    dateOfBirth: string | null;
    className: string;
    gender: string;
    category: string;
    address?: string | null;
    mobileNo?: string | null;
    rollNumber: string;
    enrollmentNo: string | null;
    avatarUrl: string | null;
  };
  exam: {
    examId: string;
    examName: string;
    examTypeLabel: string;
    academicYear: string;
    sessionName: string;
    startDate: string | null;
    endDate: string | null;
  };
  timetable: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    dateOfExam: string;
    dayOfExam: string;
    timing: string;
  }>;
};

type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

type ApiError = {
  success: false;
  error?: string;
};

const parseJson = async <T,>(response: Response) => {
  const text = await response.text();
  if (!text) return null as T | null;
  return JSON.parse(text) as T;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

export default function DashboardAdmitCardPage() {
  const user = useUserStore((state) => state.user);
  const roles = user?.roles ?? [];
  const isAdmin = roles.includes("admin");

  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);
  const [cardData, setCardData] = useState<AdmitCardData | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        if (isAdmin) {
          const response = await fetch("/api/exam/all");
          const result = await parseJson<ApiSuccess<ExamOption[]> | ApiError>(response);
          if (!response.ok || !result?.success) {
            throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
          }
          const rows = Array.isArray(result.data) ? result.data : [];
          setExamOptions(rows);
        } else {
          const response = await fetch("/api/results/my-results");
          const result = await parseJson<
            | ApiSuccess<{
              exams: Array<{
                examId: string;
                examName: string;
                examType: "quarterly" | "half_yearly" | "annual";
                examTypeLabel: string;
                academicYear: string;
                sessionName: string;
              }>;
            }>
            | ApiError
          >(response);
          if (!response.ok || !result?.success) {
            throw new Error(result && "error" in result ? result.error || "Failed to load exams" : "Failed to load exams");
          }
          const rows = (result.data?.exams ?? []).map((item) => ({
            id: item.examId,
            name: item.examName,
            examType: item.examType,
            examTypeLabel: item.examTypeLabel,
            academicYear: item.academicYear,
            sessionName: item.sessionName,
          }));
          setExamOptions(rows);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exams");
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadOptions();
  }, [isAdmin]);

  useEffect(() => {
    if (!examOptions.length) return;
    if (!examOptions.some((item) => item.id === selectedExamId)) {
      setSelectedExamId(examOptions[0]?.id ?? "");
    }
  }, [examOptions, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) {
      setStudentOptions([]);
      setSelectedStudentId("");
      return;
    }
    if (!isAdmin) return;

    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await fetch(`/api/exam/${selectedExamId}/students`);
        const result = await parseJson<
          | ApiSuccess<
            Array<{
              studentId: string;
              fullName: string;
              rollNumber: string;
              enrollmentNo: string | null;
              className: string;
            }>
          >
          | ApiError
        >(response);
        if (!response.ok || !result?.success) {
          throw new Error(
            result && "error" in result
              ? result.error || "Failed to load exam students"
              : "Failed to load exam students",
          );
        }
        const rows = Array.isArray(result.data)
          ? result.data.map((item) => ({
            studentId: item.studentId,
            fullName: item.fullName,
            rollNumber: item.rollNumber,
            enrollmentNo: item.enrollmentNo,
            className: item.className,
          }))
          : [];
        setStudentOptions(rows);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load exam students");
        setStudentOptions([]);
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [isAdmin, selectedExamId]);

  const canLoadCard = useMemo(() => {
    if (!selectedExamId) return false;
    if (!isAdmin) return true;
    return !!selectedStudentId;
  }, [isAdmin, selectedExamId, selectedStudentId]);

  const fetchAdmitCard = async () => {
    if (!canLoadCard) return;

    setLoadingCard(true);
    try {
      const query = isAdmin ? `?studentId=${encodeURIComponent(selectedStudentId)}` : "";
      const response = await fetch(`/api/results/admit-card/${selectedExamId}${query}`);
      const result = await parseJson<ApiSuccess<AdmitCardData> | ApiError>(response);

      if (!response.ok || !result?.success) {
        throw new Error(result && "error" in result ? result.error || "Failed to load admit card" : "Failed to load admit card");
      }
      setCardData(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load admit card");
      setCardData(null);
    } finally {
      setLoadingCard(false);
    }
  };

  useEffect(() => {
    if (!canLoadCard) {
      setCardData(null);
      return;
    }
    void fetchAdmitCard();
  }, [canLoadCard, selectedExamId, selectedStudentId]);

  useEffect(() => {
    if (!selectedExamId) return;
    if (!isAdmin) return;
    if (!studentOptions.length) {
      setSelectedStudentId("");
      return;
    }
    if (!studentOptions.some((item) => item.studentId === selectedStudentId)) {
      setSelectedStudentId(studentOptions[0]?.studentId ?? "");
    }
  }, [isAdmin, selectedExamId, selectedStudentId, studentOptions]);

  return (
    <DashboardLayout title="Admit Card">
      <div className="space-y-4">
        <h1 className="admit-controls text-2xl font-bold">Exam Admit Card</h1>

        <Card className="admit-controls">
          <CardHeader>
            <CardTitle>Select Details</CardTitle>
            <CardDescription>
              Choose exam{isAdmin ? " and student" : ""} to generate the admit card.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
              <div className="space-y-1">
                <label className="text-sm font-medium">Exam</label>
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">
                    {loadingOptions ? "Loading exams..." : "Select exam"}
                  </option>
                  {examOptions.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name} ({exam.examTypeLabel ?? exam.examType}) - {exam.academicYear}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Student</label>
                  <select
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    disabled={!selectedExamId || loadingStudents}
                    className="h-9 w-full rounded-md border bg-transparent px-3 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {!selectedExamId
                        ? "Select exam first"
                        : loadingStudents
                          ? "Loading students..."
                          : "Select student"}
                    </option>
                    {studentOptions.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.fullName} ({student.enrollmentNo || student.rollNumber || "No ID"})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button onClick={fetchAdmitCard} disabled={!canLoadCard || loadingCard}>
                {loadingCard ? "Loading..." : "Refresh Admit Card"}
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={!cardData}>
                Print
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="min-h-50">
          {loadingCard ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">Loading admit card...</CardContent>
            </Card>
          ) : cardData ? (
            <section className="admit-sheet mx-auto bg-white text-black shadow print:shadow-none">
              <style>{`
                .admit-sheet {
                  width: 210mm;
                  min-height: 297mm;
                  max-width: 100%;
                  font-family: "Times New Roman", Times, serif;
                  border: 1.5px solid #6b7280;
                  padding: 4mm;
                  box-sizing: border-box;
                  display: flex;
                  flex-direction: column;
                }
                .admit-main {
                  flex: 1;
                }
                .admit-table {
                  width: 100%;
                  border-collapse: collapse;
                }
                .admit-table th,
                .admit-table td {
                  border: 1px solid #6b7280;
                  padding: 5px 6px;
                  font-size: 14px;
                  vertical-align: middle;
                }
                .admit-table th {
                  font-weight: 700;
                }
                .header-block {
                  display: grid;
                  grid-template-columns: 160px 1fr;
                  gap: 14px;
                  align-items: center;
                  border-bottom: 1px solid #6b7280;
                  padding: 6px 8px;
                }
                /* LOGO SIZE CONTROL: change width/height below to adjust logo size */
                .logo-box {
                  width: 150px;
                  height: 150px;
                  border: 1px solid #6b7280;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  overflow: hidden;
                  margin: 0 auto;
                }
                .logo-box img {
                  width: 100%;
                  height: 100%;
                  object-fit: contain;
                }
                .school-title {
                  text-align: center;
                  line-height: 1.15;
                  min-width: 0;
                }
                .school-name {
                  font-size: 40px;
                  font-weight: 800;
                }
                .school-dist {
                  font-size: 28px;
                  font-weight: 700;
                }
                .school-lines {
                  font-size: 20px;
                  line-height: 1.2;
                }
                .section-title {
                  text-align: center;
                  font-size: 22px;
                  padding: 4px 0;
                  border-bottom: 1px solid #6b7280;
                }
                /* STUDENT PHOTO SIZE CONTROL: change width/height below to adjust student photo size */
                .student-photo {
                  width: 125px;
                  height: 150px;
                  object-fit: cover;
                  border: 1px solid #6b7280;
                }
                .footer-sign {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 8px;
                  padding: 18px 14px 22px;
                  font-size: 16px;
                  margin-top: auto;
                }
                .footer-sign-box {
                  min-height: 58px;
                  display: flex;
                  align-items: flex-end;
                  justify-content: center;
                  border-top: 1px solid #6b7280;
                  padding-top: 8px;
                  font-weight: 600;
                }
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 4mm;
                  }
                  * {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  [data-slot="sidebar"],
                  [data-slot="sidebar-gap"],
                  [data-slot="sidebar-container"],
                  [data-slot="sidebar-rail"],
                  [data-slot="sidebar-trigger"] {
                    display: none !important;
                  }
                  [data-slot="sidebar-inset"] > header {
                    display: none !important;
                  }
                  [data-slot="sidebar-inset"] > div {
                    padding: 0 !important;
                    padding: 0 !important;
                    gap: 0 !important;
                  }
                  .admit-controls {
                    display: none !important;
                  }
                  .admit-sheet {
                    width: 100% !important;
                    min-height: calc(297mm - 8mm) !important;
                    margin: 0 auto !important;
                    box-sizing: border-box !important;
                    border: 1.5px solid #6b7280 !important;
                    outline: none !important;
                    padding: 3.5mm !important;
                  }
                  .header-block,
                  .section-title,
                  .logo-box,
                  .student-photo,
                  .footer-sign-box,
                  .admit-table,
                  .admit-table th,
                  .admit-table td {
                    border-color: #000 !important;
                  }
                  .admit-table th,
                  .admit-table td {
                    border-width: 1px !important;
                    border-style: solid !important;
                  }
                  .admit-table {
                    border-collapse: collapse !important;
                    border: 1px solid #6b7280 !important;
                  }
                  .admit-table thead,
                  .admit-table tbody,
                  .admit-table tr,
                  .admit-table th,
                  .admit-table td {
                    border: 1px solid #6b7280 !important;
                  }
                }
              `}</style>

              <header className="header-block">
                <div className="logo-box">
                  {cardData.school.logoUrl ? (
                    <img src={cardData.school.logoUrl} alt="Result logo" className="logo-img"/>
                  ) : (
                    <span className="text-xs">LOGO</span>
                  )}
                </div>
                <div className="school-title">
                  <div className="school-name">{cardData.school.name}</div>
                  <div className="school-dist">{cardData.school.district}</div>
                  <div className="school-lines">
                    {cardData.school.affiliation}
                    <br />
                    {cardData.school.udiseNo}
                    <br />
                    {cardData.school.address}
                    <br />
                    {cardData.school.phone ?? "Phone - -"}
                    <br />
                    {cardData.school.email}
                  </div>
                </div>
              </header>

              <div className="admit-main">
                <div className="section-title">
                  Admit Card ({cardData.exam.examTypeLabel}) - {cardData.exam.academicYear}
                </div>

                <table className="admit-table">
                  <tbody>
                    <tr>
                      <td style={{ width: "19%" }}>Name</td>
                      <td style={{ width: "36%" }}>{cardData.student.fullName}</td>
                      <td style={{ width: "45%" }} rowSpan={10}>
                        <div className="flex justify-center">
                          {cardData.student.avatarUrl ? (
                            <img
                              src={cardData.student.avatarUrl}
                              alt={cardData.student.fullName}
                              className="student-photo"
                            />
                          ) : (
                            <div className="student-photo flex items-center justify-center text-xs">PHOTO</div>
                          )}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td>Father Name</td>
                      <td>{cardData.student.fathersName}</td>
                    </tr>
                    <tr>
                      <td>Mother Name</td>
                      <td>{cardData.student.mothersName}</td>
                    </tr>
                    <tr>
                      <td>DOB</td>
                      <td>{formatDate(cardData.student.dateOfBirth)}</td>
                    </tr>
                    <tr>
                      <td>Class</td>
                      <td>{cardData.student.className}</td>
                    </tr>
                    <tr>
                      <td>Enrollment No</td>
                      <td>{cardData.student.enrollmentNo || "-"}</td>
                    </tr>
                    <tr>
                      <td>Phone</td>
                      <td>{cardData.student.mobileNo || "-"}</td>
                    </tr>
                    <tr>
                      <td>Address</td>
                      <td>{cardData.student.address || "-"}</td>
                    </tr>
                    <tr>
                      <td>Gender</td>
                      <td>{cardData.student.gender}</td>
                    </tr>
                    <tr>
                      <td>Category</td>
                      <td>{cardData.student.category}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="section-title">Time Table with Attestation</div>

                <table className="admit-table">
                  <thead>
                    <tr>
                      <th style={{ width: "13%" }}>Date Of Exam</th>
                      <th style={{ width: "14%" }}>Day of Exam</th>
                      <th style={{ width: "13%" }}>Timing</th>
                      <th>Subject</th>
                      <th style={{ width: "21%" }}>SIGNATURE OF STUDENT/PARENT</th>
                      <th style={{ width: "18%" }}>SIGNATURE OF TEACHER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardData.timetable.map((item) => (
                      <tr key={item.subjectId}>
                        <td>{item.dateOfExam}</td>
                        <td>{item.dayOfExam}</td>
                        <td>{item.timing}</td>
                        <td>{item.subjectName}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    ))}
                    {!cardData.timetable.length ? (
                      <tr>
                        <td colSpan={6} className="text-center">No timetable entries found for this exam.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="footer-sign">
                <div className="footer-sign-box">PARENT SIGNATURE</div>
                <div className="footer-sign-box">INVIGILATOR SIGNATURE</div>
              </div>
            </section>
          ) : (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                Select exam{isAdmin ? " and student" : ""} to view admit card.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
