import { memo, useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatListingPrice } from "../formatInr";
import type { CurrencyCode } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

type PriceHistoryChartProps = {
  history: number[];
  currency?: CurrencyCode;
};

const baseChartOptions: ChartOptions<"line"> = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: false } },
};

function PriceHistoryChart({
  history,
  currency = "INR",
}: PriceHistoryChartProps) {
  const chartOptions = useMemo<ChartOptions<"line">>(
    () => ({
      ...baseChartOptions,
      plugins: {
        ...baseChartOptions.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ctx.parsed.y != null
                ? formatListingPrice(ctx.parsed.y as number, currency)
                : "",
          },
        },
      },
      scales: {
        y: {
          ...baseChartOptions.scales?.y,
          ticks: {
            callback: (raw) =>
              formatListingPrice(Number(raw), currency),
          },
        },
      },
    }),
    [currency],
  );

  const data = useMemo(
    () => ({
      labels: ["5d ago", "4d ago", "3d ago", "2d ago", "Today"],
      datasets: [
        {
          label: "Lowest Price Trend",
          data: history,
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124, 58, 237, 0.1)",
          tension: 0.4,
          borderWidth: 4,
          pointRadius: 5,
          fill: true,
        },
      ],
    }),
    [history],
  );

  return <Line data={data} options={chartOptions} />;
}

export default memo(PriceHistoryChart);
