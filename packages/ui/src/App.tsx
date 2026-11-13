import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import MasterHubWindow from "./features/master-hub/MasterHubWindow";
import RoutineTimeTrackerWindow from "./features/routine-time-tracker/RoutineTimeTrackerWindow";

export function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/master-hub" element={<MasterHubWindow />} />
                <Route path="/routine-time-tracker" element={<RoutineTimeTrackerWindow />} />
                <Route path="/" element={<Navigate to="/master-hub" replace />} />
            </Routes>
        </HashRouter>
    );
}
