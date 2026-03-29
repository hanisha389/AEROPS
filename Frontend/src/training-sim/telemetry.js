export const createTelemetryStore = () => ({
  points: [],
  sampleAccumulator: 0,
});

export const pushTelemetrySample = (store, sample) => {
  store.points.push(sample);
  if (store.points.length > 1200) {
    store.points.shift();
  }
};

export const latestTelemetry = (store) => store.points[store.points.length - 1] || null;
