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
import AddEntity from "./pages/AddEntity";

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
          <Route path="/engineers" element={<ProtectedRoute><EngineerInfo /></ProtectedRoute>} />
          <Route path="/aircraft" element={<ProtectedRoute><AircraftInfo /></ProtectedRoute>} />
          <Route path="/training" element={<ProtectedRoute><Training /></ProtectedRoute>} />
          <Route path="/simulation" element={<ProtectedRoute><Simulation /></ProtectedRoute>} />
          <Route path="/add-pilot" element={<ProtectedRoute><AddPilot /></ProtectedRoute>} />
          <Route path="/add" element={<ProtectedRoute><AddEntity /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
