import { BrowserRouter, Route, Routes } from "react-router";
import { Remote } from "./remote/Remote";
import { Join } from "./student/Join";
import { StudentSession } from "./student/StudentSession";
import { TeacherGate } from "./teacher/TeacherGate";
import { Projection, ProjectionLink } from "./teacher/TeacherSession";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/play/:session" element={<StudentSession />} />
      <Route path="/teacher" element={<TeacherGate />}>
        <Route index element={<Projection />} />
        <Route path="session/:session" element={<ProjectionLink />} />
      </Route>
      <Route path="/remote" element={<TeacherGate />}>
        <Route index element={<Remote />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
