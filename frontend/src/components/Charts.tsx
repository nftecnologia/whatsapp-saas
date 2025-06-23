import React from 'react';

interface DonutChartProps {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  size?: number;
  strokeWidth?: number;
}

export function DonutChart({ data, size = 120, strokeWidth = 8 }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  if (total === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-full"
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-gray-500">Sem dados</span>
      </div>
    );
  }

  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercentage = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
          
          cumulativePercentage += percentage;

          return (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{total.toLocaleString()}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
      </div>
    </div>
  );
}

interface BarChartProps {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  height?: number;
}

export function BarChart({ data, height = 200 }: BarChartProps) {
  const maxValue = Math.max(...data.map(item => item.value));
  
  if (maxValue === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg"
        style={{ height }}
      >
        <span className="text-sm text-gray-500">Sem dados para exibir</span>
      </div>
    );
  }

  return (
    <div className="space-y-3" style={{ height }}>
      {data.map((item, index) => {
        const percentage = (item.value / maxValue) * 100;
        
        return (
          <div key={index} className="flex items-center space-x-3">
            <div className="w-16 text-xs font-medium text-gray-700 truncate">
              {item.label}
            </div>
            <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
              <div
                className="h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color,
                }}
              >
                {percentage > 20 && (
                  <span className="text-xs font-medium text-white">
                    {item.value.toLocaleString()}
                  </span>
                )}
              </div>
              {percentage <= 20 && (
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-medium text-gray-700">
                  {item.value.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface LineChartPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartPoint[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 200, color = '#3b82f6' }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg"
        style={{ height }}
      >
        <span className="text-sm text-gray-500">Sem dados para exibir</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(point => point.value));
  const minValue = Math.min(...data.map(point => point.value));
  const range = maxValue - minValue;
  
  const width = 400;
  const padding = 40;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = range === 0 
      ? height / 2 
      : padding + ((maxValue - point.value) / range) * chartHeight;
    return { x, y, value: point.value, label: point.label };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="relative">
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />
        
        {/* Chart line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={color}
              className="hover:r-6 transition-all cursor-pointer"
            />
          </g>
        ))}
        
        {/* Y-axis labels */}
        <text x={padding - 10} y={padding} textAnchor="end" className="text-xs fill-gray-500">
          {maxValue.toLocaleString()}
        </text>
        <text x={padding - 10} y={height - padding} textAnchor="end" className="text-xs fill-gray-500">
          {minValue.toLocaleString()}
        </text>
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2" style={{ paddingLeft: padding, paddingRight: padding }}>
        {data.map((point, index) => (
          <div key={index} className="text-xs text-gray-500 truncate">
            {point.label}
          </div>
        ))}
      </div>
    </div>
  );
}