import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { Env } from "./utils/env";
import authRouter from "./routes/auth.route";
import studentRouter from "./routes/student.route";
import documentRouter from "./routes/document.route";
import teacherRouter from "./routes/teacher.route";
import examRouter from "./routes/exam.route";
import classRouter from "./routes/class.route";
import academicSessionRouter from "./routes/academic-session.route";
import resultsRouter from "./routes/results.route";
import payrollRouter from "./routes/payroll.route";
import feeRouter from "./routes/fee.route";
import galleryRouter from "./routes/gallery.route";
import certificateRouter from "./routes/certificate.route";
import carouselRouter from "./routes/carousel.route";
import noticeRouter from "./routes/notice.route";
import attendanceRouter from "./routes/attendance.route";


const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});
app.use("/upload/*", serveStatic({ root: "./server" }));

app.route("/auth", authRouter)
app.route("/student", studentRouter)
app.route("/teacher", teacherRouter)
app.route("/document", documentRouter)
app.route("/exam", examRouter)
app.route("/class", classRouter)
app.route("/academic-session", academicSessionRouter)
app.route("/results", resultsRouter)
app.route("/payroll", payrollRouter)
app.route("/fee", feeRouter)
app.route("/auth", authRouter);
app.route("/student", studentRouter);
app.route("/teacher", teacherRouter);
app.route("/document", documentRouter);
app.route("/exam", examRouter);
app.route("/class", classRouter);
app.route("/academic-session", academicSessionRouter);
app.route("/results", resultsRouter);
app.route("/carousel", carouselRouter);
app.route("/gallery", galleryRouter);
app.route("/certificate", certificateRouter);
app.route("/notice", noticeRouter);
app.route("/attendance", attendanceRouter);

export default {
  fetch: app.fetch,
  port: Env.PORT,
};
