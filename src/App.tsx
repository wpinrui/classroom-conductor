import { BrowserRouter, Route, Routes } from "react-router";
import { Join } from "./student/Join";
import { StudentSession } from "./student/StudentSession";
import { Library } from "./teacher/Library";
import { TeacherGate } from "./teacher/TeacherGate";
import { TeacherSession } from "./teacher/TeacherSession";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/play/:session" element={<StudentSession />} />
      <Route path="/teacher" element={<TeacherGate />}>
        <Route index element={<Library />} />
        <Route path="session/:session" element={<TeacherSession />} />
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
