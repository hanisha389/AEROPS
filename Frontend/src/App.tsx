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
import NotFound from "./pages/NotFound";
import AddPilot from "./pages/AddPilot";
import AddEngineer from "./pages/AddEngineer";
import AddAircraft from "./pages/AddAircraft";
import PilotDetail from "./pages/PilotDetail";
import EngineerDetail from "./pages/EngineerDetail";
import AircraftDetail from "./pages/AircraftDetail";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const isAuthenticated = sessionStorage.getItem("aerops-auth") === "true";
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
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
          <Route path="/menu" element={<ProtectedRoute><MainMenu /></ProtectedRoute>} />
          <Route path="/pilots" element={<ProtectedRoute><PilotInfo /></ProtectedRoute>} />
          <Route path="/pilots/:id" element={<ProtectedRoute><PilotDetail /></ProtectedRoute>} />
          <Route path="/engineers" element={<ProtectedRoute><EngineerInfo /></ProtectedRoute>} />
          <Route path="/engineers/:id" element={<ProtectedRoute><EngineerDetail /></ProtectedRoute>} />
          <Route path="/aircraft" element={<ProtectedRoute><AircraftInfo /></ProtectedRoute>} />
          <Route path="/aircraft/:id" element={<ProtectedRoute><AircraftDetail /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
          <Route path="/simulation" element={<ProtectedRoute><Simulation /></ProtectedRoute>} />
          <Route path="/add-pilot" element={<ProtectedRoute><AddPilot /></ProtectedRoute>} />
          <Route path="/add-engineer" element={<ProtectedRoute><AddEngineer /></ProtectedRoute>} />
          <Route path="/add-aircraft" element={<ProtectedRoute><AddAircraft /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
