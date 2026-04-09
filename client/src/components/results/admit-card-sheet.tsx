import {
  ADMIT_CARD_SHEET_STYLES,
  type AdmitCardData,
  formatAdmitCardDate,
} from "@/lib/admit-card-print";

type AdmitCardSheetProps = {
  cardData: AdmitCardData;
};

export default function AdmitCardSheet({ cardData }: AdmitCardSheetProps) {
  return (
    <section className="admit-sheet mx-auto">
      <style>{ADMIT_CARD_SHEET_STYLES}</style>

      <header className="header-block">
        <div className="logo-box">
          {cardData.school.logoUrl ? (
            <img src={cardData.school.logoUrl} alt="School logo" />
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
                    <div className="student-photo student-photo-placeholder">PHOTO</div>
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
              <td>{formatAdmitCardDate(cardData.student.dateOfBirth)}</td>
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

      <footer className="footer-sign">
        <div className="footer-sign-box">PARENT SIGNATURE</div>
        <div className="footer-sign-box">INVIGILATOR SIGNATURE</div>
      </footer>
    </section>
  );
}
