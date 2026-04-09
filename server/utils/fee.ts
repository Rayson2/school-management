export const parseSessionStartYear = (sessionName: string) => {
  const match = sessionName.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

export const parseSessionYearRange = (sessionName: string) => {
  const matches = sessionName.match(/(19|20)\d{2}/g) ?? [];
  if (matches.length >= 2) {
    return {
      startYear: Number(matches[0]),
      endYear: Number(matches[1]),
    };
  }

  const startYear = matches.length ? Number(matches[0]) : null;
  if (!startYear) return null;

  return {
    startYear,
    endYear: startYear + 1,
  };
};

export const inferAdmissionType = (
  admissionDate: Date | null,
  sessionName: string,
): "new" | "old" => {
  if (!admissionDate) return "old";

  const startYear = parseSessionStartYear(sessionName);
  if (!startYear) return "old";

  return admissionDate.getUTCFullYear() >= startYear ? "new" : "old";
};

export const buildMonthYearRange = (
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number,
) => {
  const start = startYear * 12 + (startMonth - 1);
  const end = endYear * 12 + (endMonth - 1);
  if (end < start) return [];

  const out: Array<{ month: number; year: number }> = [];
  for (let value = start; value <= end; value += 1) {
    out.push({
      year: Math.floor(value / 12),
      month: (value % 12) + 1,
    });
  }

  return out;
};

export const computeActiveMonths = (
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number,
) => buildMonthYearRange(startMonth, startYear, endMonth, endYear).length;

export const resolveGenerationRangeForStudent = (input: {
  admissionType: "new" | "old";
  admissionDate: Date | null;
  sessionName: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}) => {
  const monthYearRange = buildMonthYearRange(
    input.startMonth,
    input.startYear,
    input.endMonth,
    input.endYear,
  );

  if (input.admissionType !== "new" || !input.admissionDate) {
    return { monthYearRange, skipped: false };
  }

  const sessionRange = parseSessionYearRange(input.sessionName);
  if (!sessionRange) {
    return { monthYearRange, skipped: false };
  }

  const admissionYear = input.admissionDate.getUTCFullYear();
  const admissionMonth = input.admissionDate.getUTCMonth() + 1;
  const admissionInSession =
    admissionYear >= sessionRange.startYear && admissionYear <= sessionRange.endYear;

  if (!admissionInSession) {
    return { monthYearRange, skipped: false };
  }

  const admissionIndex = monthYearRange.findIndex(
    (item) => item.year === admissionYear && item.month === admissionMonth,
  );

  if (admissionIndex < 0) {
    const lastMonth = monthYearRange[monthYearRange.length - 1];
    const isAfterRange =
      lastMonth &&
      (admissionYear > lastMonth.year ||
        (admissionYear === lastMonth.year && admissionMonth > lastMonth.month));

    if (isAfterRange) {
      return { monthYearRange: [], skipped: true };
    }

    return { monthYearRange, skipped: false };
  }

  return {
    monthYearRange: monthYearRange.slice(admissionIndex),
    skipped: false,
  };
};
