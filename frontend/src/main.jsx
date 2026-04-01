import React from "react";
import ReactDOM from "react-dom/client";
<<<<<<< HEAD
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import "./index.css";
import StudyPage from "./StudyPage";
import Dashboard from "./Dashboard";
import Studies from "./Studies";

function StudyPageRoute() {
  const { studyId } = useParams();
  return <StudyPage studyId={studyId} studyName={studyId} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/studies" element={<Studies />} />
        <Route path="/studies/:studyId" element={<StudyPageRoute />} />
      </Routes>
    </BrowserRouter>
=======
import "./index.css";
import StudyPage from "./StudyPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudyPage studyId="XYZ-101" />
>>>>>>> 8da91eeb48d6cf8278c971c6314d3ed004dd3e8b
  </React.StrictMode>
);
