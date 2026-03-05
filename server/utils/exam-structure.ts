export const EXAM_TYPES = ["quarterly", "half_yearly", "annual"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const RESULT_COMPONENTS = [
  "assignment_1",
  "internal_1",
  "quarterly",
  "assignment_2",
  "internal_2",
  "half_yearly",
  "theory",
  "practical_assignment",
] as const;
export type ResultComponent = (typeof RESULT_COMPONENTS)[number];

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  annual: "Annual",
};

export const COMPONENT_LABELS: Record<ResultComponent, string> = {
  assignment_1: "Assignment-1",
  internal_1: "Internal-1",
  quarterly: "Quarterly",
  assignment_2: "Assignment-2",
  internal_2: "Internal-2",
  half_yearly: "Half-Yearly",
  theory: "Theory",
  practical_assignment: "Practical/Assignment",
};

export const COMPONENTS_BY_EXAM_TYPE: Record<ExamType, ResultComponent[]> = {
  quarterly: ["assignment_1", "internal_1", "quarterly"],
  half_yearly: ["assignment_2", "internal_2", "half_yearly"],
  annual: ["theory", "practical_assignment"],
};

export const DEFAULT_COMPONENT_MARKS: Record<
  ResultComponent,
  { maxMarks: number; passMarks: number }
> = {
  assignment_1: { maxMarks: 10, passMarks: 3 },
  internal_1: { maxMarks: 20, passMarks: 7 },
  quarterly: { maxMarks: 70, passMarks: 23 },
  assignment_2: { maxMarks: 10, passMarks: 3 },
  internal_2: { maxMarks: 20, passMarks: 7 },
  half_yearly: { maxMarks: 70, passMarks: 23 },
  theory: { maxMarks: 70, passMarks: 23  },
  practical_assignment: { maxMarks: 30, passMarks: 12 },
};

export const getComponentsForExamType = (examType: ExamType) =>
  COMPONENTS_BY_EXAM_TYPE[examType];

export const getComponentMarks = (component: ResultComponent) =>
  DEFAULT_COMPONENT_MARKS[component];
