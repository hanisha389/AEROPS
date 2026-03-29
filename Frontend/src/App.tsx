import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PinEntry from "./pages/PinEntry";
import MainMenu from "./pages/MainMenu";
import PilotInfo from "./pages/PilotInfo";
import EngineerInfo from "./pages/EngineerInfo";
import AircraftInfo from "./pages/AircraftInfo";
import Training from "./pages/Training";
import Simulation from "./pages/Simulation";
import SimulationRun from "./pages/SimulationRun";
import NotFound from "./pages/NotFound";
import AddPilot from "./pages/AddPilot";
import AddEngineer from "./pages/AddEngineer";
import AddAircraft from "./pages/AddAircraft";
import PilotDetail from "./pages/PilotDetail";
import EngineerDetail from "./pages/EngineerDetail";
import AircraftDetail from "./pages/AircraftDetail";
import Documents from "@/pages/Documents";
import { canAccessRoute, getCurrentRole } from "@/lib/rbac";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, routeKey }: { children: ReactElement; routeKey: string }) => {
  const isAuthenticated = sessionStorage.getItem("aerops-auth") === "true";
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const role = getCurrentRole();
  if (!canAccessRoute(routeKey, role)) {
    return <Navigate to="/menu" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PinEntry />} />
          <Route path="/menu" element={<ProtectedRoute routeKey="/menu"><MainMenu /></ProtectedRoute>} />
          <Route path="/pilots" element={<ProtectedRoute routeKey="/pilots"><PilotInfo /></ProtectedRoute>} />
          <Route path="/pilots/:id" element={<ProtectedRoute routeKey="/pilots/:id"><PilotDetail /></ProtectedRoute>} />
          <Route path="/engineers" element={<ProtectedRoute routeKey="/engineers"><EngineerInfo /></ProtectedRoute>} />
          <Route path="/engineers/:id" element={<ProtectedRoute routeKey="/engineers/:id"><EngineerDetail /></ProtectedRoute>} />
          <Route path="/aircraft" element={<ProtectedRoute routeKey="/aircraft"><AircraftInfo /></ProtectedRoute>} />
          <Route path="/aircraft/:id" element={<ProtectedRoute routeKey="/aircraft/:id"><AircraftDetail /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute routeKey="/training"><Training /></ProtectedRoute>} />
          <Route path="/simulation" element={<ProtectedRoute routeKey="/simulation"><Simulation /></ProtectedRoute>} />
          <Route path="/simulation/run" element={<ProtectedRoute routeKey="/simulation/run"><SimulationRun /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute routeKey="/documents"><Documents /></ProtectedRoute>} />
          <Route path="/add-pilot" element={<ProtectedRoute routeKey="/add-pilot"><AddPilot /></ProtectedRoute>} />
          <Route path="/add-engineer" element={<ProtectedRoute routeKey="/add-engineer"><AddEngineer /></ProtectedRoute>} />
          <Route path="/add-aircraft" element={<ProtectedRoute routeKey="/add-aircraft"><AddAircraft /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
