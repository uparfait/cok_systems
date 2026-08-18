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
  Bar,
  LabelList
} from 'recharts';
import type { WaitingAnalytics, ServiceDuration, SLAMonitoring, CitizenFeedback } from '../services/dashboardService.types';

const COK_PRIMARY = '#056daa';
const COK_SUCCESS = '#4CAF50';
const COK_DANGER = '#E74C3C';
const COK_NEUTRAL_DARK = '#333333';
const COK_BORDER = '#E0E0E0';
const COK_TOOLTIP_STYLE = { backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 0 };



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
          <CartesianGrid strokeDasharray="3 3" stroke={COK_BORDER} vertical={false} />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip contentStyle={COK_TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="waitTime"
            stroke={COK_PRIMARY}
            strokeWidth={2}
            dot={{ fill: COK_PRIMARY }}
            label={{ position: 'top', fill: COK_NEUTRAL_DARK, fontSize: 10, fontWeight: 600 }}
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
          <CartesianGrid strokeDasharray="3 3" stroke={COK_BORDER} vertical={false} />
          <XAxis dataKey="service" />
          <YAxis />
          <Tooltip contentStyle={COK_TOOLTIP_STYLE} />
          <Bar dataKey="duration" fill={COK_PRIMARY}>
            <LabelList dataKey="duration" position="top" style={{ fill: COK_NEUTRAL_DARK, fontWeight: 700, fontSize: 11 }} />
          </Bar>
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
    { name: 'Within SLA', value: data.withinSLA, color: COK_SUCCESS },
    { name: 'Delayed', value: data.delayed, color: COK_DANGER }
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
            label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
            outerRadius={80}
            fill={COK_PRIMARY}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={COK_TOOLTIP_STYLE} />
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
    { name: 'Positive', value: data.positive, color: COK_SUCCESS },
    { name: 'Negative', value: 100 - data.positive, color: COK_DANGER }
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
            label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
            outerRadius={80}
            fill={COK_PRIMARY}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={COK_TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};