import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import BackgroundLayout from '@/components/BackgroundLayout';
import PageHeader from '@/components/PageHeader';
import { Panel } from '@/components/ui/custom/Panel';
import { Play, Square, FastForward, Navigation, Target, Activity } from 'lucide-react';

const aircraftIcon = new L.DivIcon({
  html: `<div style="
    width: 20px; height: 20px; 
    background: transparent; 
    border: 2px solid hsl(142 68% 42%);
    border-radius: 50%;
    position: relative;
    box-shadow: 0 0 10px hsl(142 68% 42% / 0.8);
    display: flex; justify-content: center; align-items: center;
  ">
    <div style="width: 6px; height: 6px; background: hsl(142 68% 42%); border-radius: 50%;"></div>
    <div style="position: absolute; width: 30px; height: 1px; background: hsl(142 68% 42%/0.5); top: 50%; left: -5px;"></div>
    <div style="position: absolute; width: 1px; height: 30px; background: hsl(142 68% 42%/0.5); left: 50%; top: -5px;"></div>
  </div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const enemyIcon = new L.DivIcon({
  html: `<div style="
    width: 16px; height: 16px; 
    background: transparent; 
    border: 2px solid hsl(4 80% 52%);
    transform: rotate(45deg);
    position: relative;
    box-shadow: 0 0 10px hsl(4 80% 52% / 0.8);
    display: flex; justify-content: center; align-items: center;
  ">
    <div style="width: 4px; height: 4px; background: hsl(4 80% 52%);"></div>
  </div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const defaultCenter: [number, number] = [34.0522, -118.2437]; // LA

type ActiveStep = {
  coordinate: [number, number];
  altitude: number;
  speed: number;
  fuel: number;
  weather: string;
};

// --- Interfaces ---
interface AircraftData { id: string; name: string }
interface PilotData { id: number; name: string }

const Simulation = () => {
  const [data, setData] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [aircraftList, setAircraftList] = useState<AircraftData[]>([]);
  const [pilotList, setPilotList] = useState<PilotData[]>([]);

  const [inputData, setInputData] = useState({
    aircraftId: '',
    pilotId: '',
    duration: 60,
    complexity: 'medium',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAircrafts().then(setAircraftList);
    api.getPilots().then(setPilotList);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && data?.route?.length > 0) {
      interval = setInterval(() => {
        setProgress((p) => {
          if (p >= data.route.length - 1) {
            setIsPlaying(false);
            return p;
          }
          return p + 1;
        });
      }, 1000 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, data, speed]);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const result = await api.getSimulationData(
        inputData.aircraftId,
        inputData.pilotId,
        inputData.duration,
        inputData.complexity
      );
      setData(result);
      setProgress(0);
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      alert('Simulation link failed. Check connected systems.');
    } finally {
      setLoading(false);
    }
  };

  const routeForDisplay: [number, number][] = useMemo(() => {
    return data?.route?.map((r: any) => r.coordinate) || [];
  }, [data]);

  const activeStep: ActiveStep | null = useMemo(() => {
    if (!data?.route) return null;
    return data.route[progress];
  }, [data, progress]);

  // Enemies logic matching the original
  const enemies = useMemo(() => {
    if (!data?.enemies) return [];
    return data.enemies.filter((e: any) => e.appearAtStep <= progress);
  }, [data, progress]);

  const center = activeStep?.coordinate || defaultCenter;

  return (
    <BackgroundLayout>
      <PageHeader title="TACTICAL AIRSPACE SIMULATION" backTo="/menu" />

      <div className="flex-1 flex flex-col lg:flex-row gap-6 mt-2 pb-6">

        {/* LEFT COLUMN: 70% MAP */}
        <div className="w-full lg:w-[70%] h-[60vh] lg:h-[calc(100vh-160px)] relative mil-panel overflow-hidden border-border/40 p-0">
          <MapContainer
            center={center}
            zoom={8}
            className="h-full w-full z-0 font-inter"
            zoomControl={false}
          >
            {/* Dark Tactical Map Tiles */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {routeForDisplay.length > 0 && (
              <Polyline
                positions={routeForDisplay}
                color="hsl(188 100% 48%)"
                weight={2}
                dashArray="4 6"
                opacity={0.6}
              />
            )}

            {/* Flown Route */}
            {routeForDisplay.length > 0 && progress > 0 && (
              <Polyline
                positions={routeForDisplay.slice(0, progress + 1)}
                color="hsl(142 68% 42%)"
                weight={3}
                opacity={1}
                className="animate-pulse"
              />
            )}

            {/* Current Position Marker */}
            {activeStep && (
              <>
                <Marker position={activeStep.coordinate} icon={aircraftIcon}>
                  <Popup className="tactical-popup border-border/40 font-mono text-xs">
                    <span className="text-primary font-bold tracking-widest uppercase">EAGLE-1</span><br />
                    ALT: {activeStep.altitude}ft<br />
                    SPD: {activeStep.speed}kts
                  </Popup>
                </Marker>
                <Circle
                  center={activeStep.coordinate}
                  radius={15000}
                  pathOptions={{ color: 'hsl(142 68% 42%)', fillColor: 'hsl(142 68% 42%)', fillOpacity: 0.1, weight: 1 }}
                />
              </>
            )}

            {/* Enemies */}
            {enemies.map((enemy: any, i: number) => (
              <Marker key={i} position={enemy.coordinate} icon={enemyIcon}>
                <Popup className="tactical-popup border-danger/40 text-danger font-mono text-xs">
                  <span className="font-bold tracking-widest uppercase">HOSTILE</span><br />
                  TYPE: {enemy.type}
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Overlay Elements */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-background/80 border border-border/40 px-3 py-2 backdrop-blur-md">
              <span className="font-orbitron text-primary text-xs tracking-[0.2em] uppercase font-bold flex items-center gap-2">
                <span className="signal-dot cyan animate-blink" />
                SAT-LINK ACTIVE
              </span>
            </div>
          </div>

          {/* Map Crosshairs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40px] h-[40px] pointer-events-none z-10 flex items-center justify-center opacity-30">
            <div className="absolute w-full h-[1px] bg-primary"></div>
            <div className="absolute h-full w-[1px] bg-primary"></div>
            <div className="absolute w-[20px] h-[20px] border border-primary rounded-full"></div>
          </div>
        </div>

        {/* RIGHT COLUMN: 30% CONTROLS */}
        <div className="w-full lg:w-[30%] flex flex-col gap-4 h-auto lg:h-[calc(100vh-160px)] overflow-y-auto pr-2 custom-scrollbar">

          {/* Controls Panel */}
          <Panel label="MISSION PARAMETERS" className="flex-shrink-0">
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-space text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Select Aircraft</label>
                <select
                  className="bg-secondary/40 border border-border/40 px-3 py-2 text-sm text-foreground font-inter focus:border-primary focus:outline-none transition-colors rounded-none w-full"
                  value={inputData.aircraftId}
                  onChange={(e) => setInputData({ ...inputData, aircraftId: e.target.value })}
                >
                  <option value="">AWAITING SELECTION</option>
                  {aircraftList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-space text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Select Pilot</label>
                <select
                  className="bg-secondary/40 border border-border/40 px-3 py-2 text-sm text-foreground font-inter focus:border-primary focus:outline-none transition-colors rounded-none w-full"
                  value={inputData.pilotId}
                  onChange={(e) => setInputData({ ...inputData, pilotId: e.target.value })}
                >
                  <option value="">AWAITING SELECTION</option>
                  {pilotList.map((p) => (
                    <option key={p.id} value={p.id.toString()}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4 mt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="font-space text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Complexity</label>
                  <select
                    className="bg-secondary/40 border border-border/40 px-3 py-2 text-sm text-foreground font-inter focus:border-primary focus:outline-none transition-colors rounded-none w-full uppercase"
                    value={inputData.complexity}
                    onChange={(e) => setInputData({ ...inputData, complexity: e.target.value })}
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-space text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Dur (Mins)</label>
                  <input
                    type="number"
                    className="bg-secondary/40 border border-border/40 px-3 py-2 text-sm text-foreground font-mono focus:border-primary focus:outline-none transition-colors rounded-none w-full text-center"
                    value={inputData.duration}
                    onChange={(e) => setInputData({ ...inputData, duration: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                onClick={handleSimulate}
                disabled={loading || !inputData.aircraftId || !inputData.pilotId}
                className="tac-btn w-full mt-2"
              >
                {loading ? 'INITIALIZING...' : 'GENERATE SIMULATION VECTOR'}
              </button>
            </div>
          </Panel>

          {/* Telemetry Display */}
          <Panel label="LIVE TELEMETRY" className="flex-1 flex flex-col">
            <div className="p-5 flex flex-col h-full">
              {!data ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                  <Target size={32} className="mb-3" />
                  <p className="font-space text-xs tracking-widest text-muted-foreground uppercase text-center">AWAITING TELEMETRY STREAM</p>
                </div>
              ) : (
                <>
                  {/* Status Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="border border-border/40 bg-secondary/20 p-3">
                      <span className="font-space text-[9px] text-muted-foreground tracking-[0.15em] uppercase block mb-1">ALTITUDE</span>
                      <span className="font-mono text-xl text-primary font-bold">{activeStep?.altitude || 0} <span className="text-xs text-primary/60 font-space">FT</span></span>
                    </div>
                    <div className="border border-border/40 bg-secondary/20 p-3">
                      <span className="font-space text-[9px] text-muted-foreground tracking-[0.15em] uppercase block mb-1">AIRSPEED</span>
                      <span className="font-mono text-xl text-primary font-bold">{activeStep?.speed || 0} <span className="text-xs text-primary/60 font-space">KTS</span></span>
                    </div>
                    <div className="border border-border/40 bg-secondary/20 p-3">
                      <span className="font-space text-[9px] text-muted-foreground tracking-[0.15em] uppercase block mb-1">FUEL LOAD</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-lg text-success font-bold">{activeStep?.fuel || 0}%</span>
                        <span className="signal-dot green" />
                      </div>
                    </div>
                    <div className="border border-border/40 bg-secondary/20 p-3">
                      <span className="font-space text-[9px] text-muted-foreground tracking-[0.15em] uppercase block mb-1">WEATHER</span>
                      <span className="font-space text-sm text-foreground uppercase tracking-widest block truncate">{activeStep?.weather || 'CLR'}</span>
                    </div>
                  </div>

                  {/* Environment Threat */}
                  <div className="mb-auto border border-danger/30 bg-danger/5 p-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-8 h-8 bg-danger/10 border-l border-b border-danger/20 flex flex-col items-center justify-center">
                      <ShieldAlert size={12} className="text-danger" />
                    </div>
                    <h4 className="font-space text-[10px] text-danger uppercase tracking-widest font-bold mb-2">THREAT DETECTIONS</h4>
                    {enemies.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <span className="font-orbitron text-2xl text-danger font-bold">{enemies.length}</span>
                        <span className="font-inter text-xs text-danger/80 uppercase">HOSTILES IN SECTOR</span>
                      </div>
                    ) : (
                      <span className="font-inter text-xs text-success uppercase">SECTOR CLEAR</span>
                    )}
                  </div>

                  {/* Playback Controls */}
                  <div className="border-t border-border/40 pt-5 mt-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-space text-[10px] text-muted-foreground uppercase tracking-[0.15em]">MISSION PROGRESS</span>
                      <span className="font-mono text-xs text-primary">{Math.round((progress / (data.route.length - 1)) * 100) || 0}%</span>
                    </div>

                    <div className="w-full h-1.5 bg-secondary/50 rounded-full mb-5 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 relative"
                        style={{ width: `${(progress / (data.route.length - 1)) * 100}%` }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/30" />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <button
                        className="col-span-1 border border-border/50 bg-secondary/30 hover:bg-secondary flex items-center justify-center py-2 transition-colors disabled:opacity-30"
                        onClick={() => setProgress(0)}
                        disabled={!data}
                      >
                        <Square size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        className={`col-span-2 border py-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-30 font-space text-[10px] uppercase tracking-widest ${isPlaying ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/50 bg-secondary/30 text-foreground hover:bg-secondary'}`}
                        onClick={() => setIsPlaying(!isPlaying)}
                        disabled={!data || progress >= data.route.length - 1}
                      >
                        {isPlaying ? <Square size={12} className="fill-primary" /> : <Play size={12} className="fill-current" />}
                        {isPlaying ? 'PAUSE' : 'RESUME'}
                      </button>
                      <button
                        className={`col-span-1 border border-border/50 flex items-center justify-center py-2 transition-colors disabled:opacity-30 ${speed > 1 ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary/40' : 'bg-secondary/30 hover:bg-secondary text-muted-foreground'}`}
                        onClick={() => setSpeed(s => s >= 4 ? 1 : s * 2)}
                        disabled={!data}
                      >
                        <FastForward size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Simulation;
