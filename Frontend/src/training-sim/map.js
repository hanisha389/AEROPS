import L from "leaflet";

const createAircraftIcon = () =>
  L.divIcon({
    html: '<div style="font-size:20px; line-height:20px; transform: rotate(90deg);">✈</div>',
    className: "training-aircraft-icon",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const runwayEndpoints = (baseLocation) => {
  const halfRunwayMeters = 650;
  const deltaLng = halfRunwayMeters / (111320 * Math.cos((baseLocation.lat * Math.PI) / 180));
  return [
    [baseLocation.lat, baseLocation.lng - deltaLng],
    [baseLocation.lat, baseLocation.lng + deltaLng],
  ];
};

export const createTrainingMap = (container, baseLocation) => {
  const map = L.map(container, {
    zoomControl: true,
    dragging: true,
  }).setView([baseLocation.lat, baseLocation.lng], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  const runway = L.polyline(runwayEndpoints(baseLocation), {
    color: "#f59e0b",
    weight: 6,
    opacity: 0.9,
  }).addTo(map);

  const baseMarker = L.circleMarker([baseLocation.lat, baseLocation.lng], {
    radius: 6,
    color: "#22c55e",
    fillColor: "#22c55e",
    fillOpacity: 1,
  }).addTo(map);
  baseMarker.bindTooltip("Airbase", { permanent: false });

  const aircraftMarker = L.marker([baseLocation.lat, baseLocation.lng], {
    icon: createAircraftIcon(),
  }).addTo(map);

  const pathPolyline = L.polyline([[baseLocation.lat, baseLocation.lng]], {
    color: "#38bdf8",
    weight: 3,
    opacity: 0.9,
  }).addTo(map);

  return {
    map,
    runway,
    baseMarker,
    aircraftMarker,
    pathPolyline,
    updateAircraft(position, heading) {
      aircraftMarker.setLatLng([position.lat, position.lng]);
      aircraftMarker.setIcon(
        L.divIcon({
          html: `<div style="font-size:20px; line-height:20px; transform: rotate(${heading}deg);">✈</div>`,
          className: "training-aircraft-icon",
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      );
    },
    appendPath(position) {
      pathPolyline.addLatLng([position.lat, position.lng]);
    },
    resetPath(base) {
      pathPolyline.setLatLngs([[base.lat, base.lng]]);
      aircraftMarker.setLatLng([base.lat, base.lng]);
    },
    destroy() {
      map.remove();
    },
  };
};
