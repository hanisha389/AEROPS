import Chart from "chart.js/auto";

const baseOptions = {
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      grid: { color: "rgba(148, 163, 184, 0.16)" },
      ticks: { color: "#94a3b8", maxTicksLimit: 8 },
    },
    y: {
      grid: { color: "rgba(148, 163, 184, 0.16)" },
      ticks: { color: "#94a3b8" },
    },
  },
  plugins: {
    legend: {
      labels: {
        color: "#cbd5e1",
      },
    },
  },
};

const makeChart = (canvas, label, color) => {
  if (!canvas) {
    return null;
  }

  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          borderColor: color,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2,
        },
      ],
    },
    options: baseOptions,
  });
};

export const createTelemetryCharts = ({ speedCanvas, altitudeCanvas, headingCanvas }) => {
  const speedChart = makeChart(speedCanvas, "Speed (knots)", "#22d3ee");
  const altitudeChart = makeChart(altitudeCanvas, "Altitude (m)", "#f59e0b");
  const headingChart = makeChart(headingCanvas, "Heading (deg)", "#a78bfa");

  const append = (chart, timeLabel, value) => {
    if (!chart) {
      return;
    }
    chart.data.labels.push(timeLabel);
    chart.data.datasets[0].data.push(Number(value.toFixed(2)));
    if (chart.data.labels.length > 150) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    if (!chart.canvas?.ownerDocument) {
      return;
    }

    chart.update("none");
  };

  return {
    push(sample) {
      const timeLabel = sample.time.toFixed(1);
      append(speedChart, timeLabel, sample.speed);
      append(altitudeChart, timeLabel, sample.altitude);
      append(headingChart, timeLabel, sample.heading);
    },
    destroy() {
      speedChart?.destroy();
      altitudeChart?.destroy();
      headingChart?.destroy();
    },
  };
};
