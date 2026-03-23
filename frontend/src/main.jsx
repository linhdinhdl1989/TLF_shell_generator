import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import StudyPage from "./StudyPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudyPage studyId="XYZ-101" />
  </React.StrictMode>
);
