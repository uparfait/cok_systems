/**
 * Dashboard Chart Components
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import type { WaitingAnalytics, ServiceDuration, SLAMonitoring, CitizenFeedback } from '../services/dashboardService.types';



interface WaitingTimeChartProps {
  data: WaitingAnalytics[];
}

export const WaitingTimeChart: React.FC<WaitingTimeChartProps> = ({ data }) => {
  const chartData = data.map(item => ({
    time: item.time,
    waitTime: Math.floor(Math.random() * 60) + 10, // Mock data
    color: item.color
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="waitTime"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ fill: '#8884d8' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ServiceDurationChartProps {
  data: ServiceDuration[];
}

export const ServiceDurationChart: React.FC<ServiceDurationChartProps> = ({ data }) => {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="service" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="duration" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface SLAChartProps {
  data: SLAMonitoring;
}

export const SLAChart: React.FC<SLAChartProps> = ({ data }) => {
  const chartData = [
    { name: 'Within SLA', value: data.withinSLA, color: '#10b981' },
    { name: 'Delayed', value: data.delayed, color: '#ef4444' }
  ];

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

interface FeedbackChartProps {
  data: CitizenFeedback;
}

export const FeedbackChart: React.FC<FeedbackChartProps> = ({ data }) => {
  const chartData = [
    { name: 'Positive', value: data.positive, color: '#10b981' },
    { name: 'Negative', value: 100 - data.positive, color: '#ef4444' }
  ];

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};