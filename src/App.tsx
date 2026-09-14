import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import MasterHubWindow from "./features/master-hub/components/MasterHubWindow";
import RoutineTimeTrackerWindow from "./features/routine-time-tracker/components/RoutineTimeTrackerWindow";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/master-hub" element={<MasterHubWindow />} />
        <Route
          path="/routine-time-tracker"
          element={<RoutineTimeTrackerWindow />}
        />
        <Route path="/" element={<Navigate to="/master-hub" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
