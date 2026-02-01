// src/components/dashboard/SentimentChart.tsx
// Fundamento: System Design Interview - Data Visualization
// Responsabilidade: Gráfico de distribuição de sentimentos

'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface SentimentChartProps {
  data: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export function SentimentChart({ data }: SentimentChartProps) {
  const total = data.positive + data.neutral + data.negative;

  const chartData = {
    labels: ['Positivo', 'Neutro', 'Negativo'],
    datasets: [
      {
        data: [data.positive, data.neutral, data.negative],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',   // Green for positive
          'rgba(156, 163, 175, 0.8)',  // Gray for neutral
          'rgba(239, 68, 68, 0.8)',    // Red for negative
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(156, 163, 175)',
          'rgb(239, 68, 68)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          font: {
            size: 13,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function (context: any) {
            const value = context.parsed;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Análise de Sentimentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Doughnut data={chartData} options={options} />
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-green-50 p-3">
            <span className="text-2xl font-bold text-green-600">
              {data.positive}
            </span>
            <span className="text-xs text-green-600">Positivo</span>
          </div>

          <div className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 p-3">
            <span className="text-2xl font-bold text-gray-600">
              {data.neutral}
            </span>
            <span className="text-xs text-gray-600">Neutro</span>
          </div>

          <div className="flex flex-col items-center gap-1 rounded-lg bg-red-50 p-3">
            <span className="text-2xl font-bold text-red-600">
              {data.negative}
            </span>
            <span className="text-xs text-red-600">Negativo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
