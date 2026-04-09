export type AdmitCardData = {
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

export const ADMIT_CARD_SHEET_STYLES = `
  .admit-sheet {
    width: 210mm;
    min-height: 297mm;
    max-width: 100%;
    background: #fff;
    border: 1.5px solid #6b7280;
    padding: 4mm;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    page-break-after: always;
    break-after: page;
  }
  .admit-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .admit-main {
    flex: 1;
  }
  .admit-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .admit-table th,
  .admit-table td {
    border: 1px solid #6b7280;
    padding: 5px 6px;
    font-size: 14px;
    vertical-align: middle;
    word-break: break-word;
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
  .student-photo {
    width: 125px;
    height: 150px;
    object-fit: cover;
    border: 1px solid #6b7280;
    display: block;
  }
  .student-photo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
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
  @media (max-width: 900px) {
    .admit-print-root {
      padding: 8px;
    }
    .admit-sheet {
      width: 100%;
      min-height: auto;
    }
    .header-block {
      grid-template-columns: 1fr;
    }
    .school-name {
      font-size: 28px;
    }
    .school-dist {
      font-size: 22px;
    }
    .school-lines {
      font-size: 16px;
    }
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 4mm;
    }
    body {
      background: #fff;
    }
    .admit-print-root {
      padding: 0;
      gap: 0;
    }
    .admit-sheet {
      width: 100%;
      max-width: none;
      min-height: calc(297mm - 8mm);
      margin: 0;
      box-shadow: none;
    }
    .header-block,
    .section-title,
    .logo-box,
    .student-photo,
    .footer-sign-box,
    .admit-table,
    .admit-table th,
    .admit-table td {
      border-color: #000;
    }
  }
`;

export const ADMIT_CARD_DOCUMENT_STYLES = `
  :root {
    color-scheme: light;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    margin: 0;
    font-family: "Times New Roman", Times, serif;
    background: #f3f4f6;
    color: #000;
  }
  .admit-print-root {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    align-items: center;
  }
  ${ADMIT_CARD_SHEET_STYLES}
`;

export const formatAdmitCardDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
};

const escapeHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderMultiline = (value: string | null | undefined) =>
  escapeHtml(value).replaceAll("\n", "<br />");

const renderAdmitCardMarkup = (cardData: AdmitCardData) => {
  const timetableRows = cardData.timetable.length
    ? cardData.timetable
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.dateOfExam)}</td>
              <td>${escapeHtml(item.dayOfExam)}</td>
              <td>${escapeHtml(item.timing)}</td>
              <td>${escapeHtml(item.subjectName)}</td>
              <td></td>
              <td></td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td colspan="6" style="text-align: center;">No timetable entries found for this exam.</td>
      </tr>
    `;

  const studentPhoto = cardData.student.avatarUrl
    ? `<img src="${escapeHtml(cardData.student.avatarUrl)}" alt="${escapeHtml(cardData.student.fullName)}" class="student-photo" />`
    : `<div class="student-photo student-photo-placeholder">PHOTO</div>`;

  const schoolLogo = cardData.school.logoUrl
    ? `<img src="${escapeHtml(cardData.school.logoUrl)}" alt="School logo" />`
    : `<span style="font-size: 12px;">LOGO</span>`;

  return `
    <section class="admit-sheet">
      <header class="header-block">
        <div class="logo-box">
          ${schoolLogo}
        </div>
        <div class="school-title">
          <div class="school-name">${escapeHtml(cardData.school.name)}</div>
          <div class="school-dist">${escapeHtml(cardData.school.district)}</div>
          <div class="school-lines">
            ${renderMultiline(cardData.school.affiliation)}<br />
            ${renderMultiline(cardData.school.udiseNo)}<br />
            ${renderMultiline(cardData.school.address)}<br />
            ${renderMultiline(cardData.school.phone ?? "Phone - -")}<br />
            ${renderMultiline(cardData.school.email)}
          </div>
        </div>
      </header>

      <div class="admit-main">
        <div class="section-title">
          Admit Card (${escapeHtml(cardData.exam.examTypeLabel)}) - ${escapeHtml(cardData.exam.academicYear)}
        </div>

        <table class="admit-table">
          <tbody>
            <tr>
              <td style="width: 19%;">Name</td>
              <td style="width: 36%;">${escapeHtml(cardData.student.fullName)}</td>
              <td style="width: 45%;" rowspan="10">
                <div style="display: flex; justify-content: center;">
                  ${studentPhoto}
                </div>
              </td>
            </tr>
            <tr>
              <td>Father Name</td>
              <td>${escapeHtml(cardData.student.fathersName)}</td>
            </tr>
            <tr>
              <td>Mother Name</td>
              <td>${escapeHtml(cardData.student.mothersName)}</td>
            </tr>
            <tr>
              <td>DOB</td>
              <td>${escapeHtml(formatAdmitCardDate(cardData.student.dateOfBirth))}</td>
            </tr>
            <tr>
              <td>Class</td>
              <td>${escapeHtml(cardData.student.className)}</td>
            </tr>
            <tr>
              <td>Enrollment No</td>
              <td>${escapeHtml(cardData.student.enrollmentNo || "-")}</td>
            </tr>
            <tr>
              <td>Phone</td>
              <td>${escapeHtml(cardData.student.mobileNo || "-")}</td>
            </tr>
            <tr>
              <td>Address</td>
              <td>${escapeHtml(cardData.student.address || "-")}</td>
            </tr>
            <tr>
              <td>Gender</td>
              <td>${escapeHtml(cardData.student.gender)}</td>
            </tr>
            <tr>
              <td>Category</td>
              <td>${escapeHtml(cardData.student.category)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Time Table with Attestation</div>

        <table class="admit-table">
          <thead>
            <tr>
              <th style="width: 13%;">Date Of Exam</th>
              <th style="width: 14%;">Day of Exam</th>
              <th style="width: 13%;">Timing</th>
              <th>Subject</th>
              <th style="width: 21%;">SIGNATURE OF STUDENT/PARENT</th>
              <th style="width: 18%;">SIGNATURE OF TEACHER</th>
            </tr>
          </thead>
          <tbody>
            ${timetableRows}
          </tbody>
        </table>
      </div>

      <footer class="footer-sign">
        <div class="footer-sign-box">PARENT SIGNATURE</div>
        <div class="footer-sign-box">INVIGILATOR SIGNATURE</div>
      </footer>
    </section>
  `;
};

export const buildBulkAdmitCardDocument = (cards: AdmitCardData[], title: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>${ADMIT_CARD_DOCUMENT_STYLES}</style>
  </head>
  <body>
    <main class="admit-print-root">
      ${cards.map((card) => renderAdmitCardMarkup(card)).join("")}
    </main>
    <script>
      (() => {
        const waitForImages = () => {
          const images = Array.from(document.images);
          if (!images.length) return Promise.resolve();
          return Promise.all(images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            });
          }));
        };
        window.__readyToPrint = waitForImages();
      })();
    </script>
  </body>
</html>`;

export const openAdmitCardPrintWindow = async (documentHtml: string) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error("Unable to open print preview. Please allow pop-ups and try again.");
  }

  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();

  await new Promise<void>((resolve) => {
    const finalize = async () => {
      try {
        await (printWindow as Window & { __readyToPrint?: Promise<void> }).__readyToPrint;
      } catch {
        // Ignore image loading errors and continue to print the document.
      }
      printWindow.focus();
      printWindow.print();
      resolve();
    };

    if (printWindow.document.readyState === "complete") {
      void finalize();
      return;
    }

    printWindow.addEventListener("load", () => {
      void finalize();
    }, { once: true });
  });
};

export const downloadAdmitCardDocument = (documentHtml: string, filename: string) => {
  const blob = new Blob([documentHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
