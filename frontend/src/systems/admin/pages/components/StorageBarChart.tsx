import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const WHITE = '#FFFFFF';
const BORDER = '#E0E0E0';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

interface CollectionStat {
  name: string;
  collectionName: string;
  count: number;
  size: number;
  formattedSize: string;
  avgObjSize: number;
}

interface StorageBarChartProps {
  collections: CollectionStat[];
}

const chartColors = [
  '#056daa', '#4CAF50', '#F39C12', '#E74C3C', '#2980B9', '#388E3C', '#D68910', '#045d94',
];

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const StorageBarChart: React.FC<StorageBarChartProps> = ({ collections }) => {
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
      setFirstLoad(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [collections]);

  const sorted = useMemo(() => {
    return [...collections].sort((a, b) => b.size - a.size);
  }, [collections]);

  const barChartData = sorted.map((col, idx) => ({
    name: col.name.trim(),
    size: col.size,
    count: col.count,
    formattedSize: col.formattedSize,
    fill: chartColors[idx % chartColors.length],
  }));

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: WHITE,
        boxShadow: CARD_SHADOW,
        borderRadius: 0,
      }}
    >
      {loading  ? (
        <div className="flex items-center justify-center py-8">
          <SpiralLoader />
        </div>
      ) : barChartData.length === 0 ? (
        <div className="text-center py-8 text-xs text-gray-400">No data available</div>
      ) : (
        <div  style={{ width: '100%', height: Math.max(400, barChartData.length * 50) }}>
          <ResponsiveContainer  width="100%" height="100%">
            <BarChart data={barChartData} layout="vertical" margin={{ top: 10, right: 100, left: 0, bottom: 10 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, textAnchor: 'end' }}
                width={160}
              />
              <Tooltip
                contentStyle={{ borderRadius: 0, border: '1px solid #E0E0E0' }}
                labelStyle={{ fontFamily: 'Montserrat, sans-serif' }}
                formatter={(value: any, name: string) => {
                  if (name === 'size') return [formatNumber(value), 'Storage'];
                  return [value, name];
                }}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="size">
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="formattedSize"
                  position="right"
                  style={{ fontSize: 9, fill: '#333333', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StorageBarChart;
