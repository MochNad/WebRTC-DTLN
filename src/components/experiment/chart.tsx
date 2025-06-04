"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface ChartDataPoint {
  time: string;
  worklet: number;
  worker: number;
  model1: number;
  model2: number;
  bufferQueue: number;
  bufferDropped: number;
}

interface ChartLine {
  dataKey: string;
  name: string;
  color: string;
}

interface ChartProps {
  data: ChartDataPoint[];
  title?: string;
  lines: ChartLine[];
  yAxisLabel: string;
  formatter: (value: number, name: string) => [string, string];
}

export const Chart: React.FC<ChartProps> = ({
  data,
  title,
  lines,
  yAxisLabel,
  formatter,
}) => {
  // Display all data instead of limiting to last 100 points
  const displayData = data;

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-medium mb-3 text-muted-foreground">
          {title}
        </h4>
      )}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              interval={Math.max(0, Math.floor(displayData.length / 10))}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
              }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              labelFormatter={(label) => `Time: ${label}`}
              formatter={formatter}
            />
            <Legend />
            {lines.map(({ dataKey, name, color }) => (
              <Line
                key={dataKey}
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                name={name}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
