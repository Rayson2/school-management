import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type ExamListItem = {
  id: string;
  name: string;
  className?: string | null;
  examType: "quarterly" | "half_yearly" | "annual";
  academicYear: string;
  status: "draft" | "scheduled" | "completed";
  marksEntryMode?: "closed" | "open";
};

export type ExamDetails = {
  id: string;
  name: string;
  examType: "quarterly" | "half_yearly" | "annual";
  marksEntryMode?: "closed" | "open";
  subjects: Array<{
    examSubjectId: string;
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    maxMarks: number;
    passMarks: number;
    assignedTeacherId?: string | null;
    assignedTeacherName?: string | null;
    components: Array<{
      component: string;
      componentLabel: string;
      maxMarks: number;
      passMarks: number;
    }>;
  }>;
};

export type ExamStudent = {
  studentId: string;
  fullName: string;
  rollNumber: string;
  className: string;
};

export type ExistingMark = {
  id: string;
  examId: string;
  studentId: string;
  examSubjectId: string;
  component: string;
  subjectId: string;
  obtainedMarks: number;
};

export type MarkInput = Record<string, string>;

type CachedExamData = {
  examDetails: ExamDetails;
  students: ExamStudent[];
  existingMarks: ExistingMark[];
  markInput: MarkInput;
};

interface MarksState {
  exams: ExamListItem[];
  examsLoadedForSessionId: string | null;
  examsLoading: boolean;
  examsError: string | null;
  examDataById: Record<string, CachedExamData>;
  loadingExamId: string | null;
  examDataError: string | null;
  fetchExams: (sessionId?: string, force?: boolean) => Promise<void>;
  fetchExamData: (examId: string, force?: boolean) => Promise<void>;
  setMarkInputField: (
    examId: string,
    studentId: string,
    examSubjectId: string,
    component: string,
    value: string,
  ) => void;
}

const entryKey = (studentId: string, examSubjectId: string, component: string) =>
  `${studentId}::${examSubjectId}::${component}`;

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API ${response.status}: ${text.slice(0, 120)}`);
  }
};

export const useMarksStore = create<MarksState>()(
  devtools((set, get) => ({
    exams: [],
    examsLoadedForSessionId: null,
    examsLoading: false,
    examsError: null,
    examDataById: {},
    loadingExamId: null,
    examDataError: null,
    fetchExams: async (sessionId = "", force = false) => {
      const normalizedSessionId = sessionId.trim();
      if (get().examsLoadedForSessionId === normalizedSessionId && !force) return;

      set({ examsLoading: true, examsError: null });
      try {
        const query = new URLSearchParams();
        if (normalizedSessionId) query.set("sessionId", normalizedSessionId);
        const suffix = query.toString();
        const response = await fetch(`/api/exam/all${suffix ? `?${suffix}` : ""}`);
        const result = await parseJsonResponse(response);
        if (!response.ok || !result.success) {
          throw new Error(
            typeof result.error === "string"
              ? result.error
              : "Failed to fetch exams",
          );
        }
        set({
          exams: Array.isArray(result.data) ? (result.data as ExamListItem[]) : [],
          examsLoadedForSessionId: normalizedSessionId,
          examsLoading: false,
        });
      } catch (err) {
        set({
          examsError:
            err instanceof Error ? err.message : "Failed to fetch exams",
          examsLoading: false,
        });
      }
    },
    fetchExamData: async (examId, force = false) => {
      if (!examId) return;

      const cached = get().examDataById[examId];
      if (cached && !force) return;

      set({ loadingExamId: examId, examDataError: null });
      try {
        const [examRes, studentsRes, marksRes] = await Promise.all([
          fetch(`/api/exam/${examId}`),
          fetch(`/api/exam/${examId}/students`),
          fetch(`/api/exam/${examId}/marks`),
        ]);

        const [examData, studentsData, marksData] = await Promise.all([
          parseJsonResponse(examRes),
          parseJsonResponse(studentsRes),
          parseJsonResponse(marksRes),
        ]);

        if (!examRes.ok || !examData.success) {
          throw new Error(
            typeof examData.error === "string"
              ? examData.error
              : "Failed to load exam",
          );
        }
        if (!studentsRes.ok || !studentsData.success) {
          throw new Error(
            typeof studentsData.error === "string"
              ? studentsData.error
              : "Failed to load exam students",
          );
        }
        if (!marksRes.ok || !marksData.success) {
          throw new Error(
            typeof marksData.error === "string"
              ? marksData.error
              : "Failed to load marks",
          );
        }

        const details = examData.data as ExamDetails;
        const examStudents = (studentsData.data as ExamStudent[]) ?? [];
        const marks = (marksData.data as ExistingMark[]) ?? [];

        const nextInput: MarkInput = {};
        for (const mark of marks) {
          nextInput[entryKey(mark.studentId, mark.examSubjectId, mark.component)] = String(
            mark.obtainedMarks,
          );
        }

        set((state) => ({
          examDataById: {
            ...state.examDataById,
            [examId]: {
              examDetails: details,
              students: examStudents,
              existingMarks: marks,
              markInput: nextInput,
            },
          },
          loadingExamId: null,
        }));
      } catch (err) {
        set({
          examDataError:
            err instanceof Error ? err.message : "Failed to load marks",
          loadingExamId: null,
        });
      }
    },
    setMarkInputField: (examId, studentId, examSubjectId, component, value) => {
      const key = entryKey(studentId, examSubjectId, component);
      set((state) => {
        const cached = state.examDataById[examId];
        if (!cached) return state;
        return {
          examDataById: {
            ...state.examDataById,
            [examId]: {
              ...cached,
              markInput: {
                ...cached.markInput,
                [key]: value,
              },
            },
          },
        };
      });
    },
  })),
);
