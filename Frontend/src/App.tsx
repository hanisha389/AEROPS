import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PinEntry />} />
          <Route path="/menu" element={<MainMenu />} />
          <Route path="/pilots" element={<PilotInfo />} />
          <Route path="/engineers" element={<EngineerInfo />} />
          <Route path="/aircraft" element={<AircraftInfo />} />
          <Route path="/training" element={<Training />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
