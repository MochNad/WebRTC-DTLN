"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  dotColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <span className="text-sm font-medium dark:text-gray-200">{label}</span>
    <span className="text-sm font-semibold text-muted-foreground dark:text-gray-400">{value}</span>
  </div>
);
