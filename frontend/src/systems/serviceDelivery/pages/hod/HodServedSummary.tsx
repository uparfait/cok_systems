import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid } from 'recharts';
import { departmentManagerService } from '@/core/services/adminService';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const PRIMARY = '#056daa';
const NEUTRAL_DARK = '#333333';
const NEUTRAL_LIGHT = '#F7F9FB';
const GRAY = '#9E9E9E';
const BORDER = '#E0E0E0';
const FONT = "'Montserrat', sans-serif";

interface ManagedDept {
  _id: string;
  department_name?: string;
  is_unit?: boolean;
}

interface ServedRow {
  id: string;
  name: string;
  isUnit: boolean;
  total: number;
}

const wrapLabel = (name: string, max = 18): string[] => {
  const words = String(name || '').split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
};

const DeptNameTick = ({ x, y, payload }: any) => {
  const lines = wrapLabel(payload?.value);
  const startDy = 4 - (lines.length - 1) * 5.5;
  return (
    <text x={x} y={y} textAnchor="end" fill="#555555" fontSize={11} fontFamily={FONT}>
      {lines.map((l, i) => (
        <tspan key={i} x={x - 4} dy={i === 0 ? startDy : 12}>{l}</tspan>
      ))}
    </text>
  );
};

const HodServedSummary: React.FC<{ from?: string; to?: string }> = ({ from, to }) => {
  const [rows, setRows] = useState<ServedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const deptsRef = useRef<ManagedDept[] | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!deptsRef.current) {
        const res: any = await departmentManagerService.getManagedDepartments();
        deptsRef.current = res?.success && Array.isArray(res.data) ? res.data : [];
      }
      const depts = deptsRef.current || [];
      const results = await Promise.all(
        depts.map((d: ManagedDept) =>
          departmentManagerService
            .getVisitorsByDepartment(String(d._id), 1, 1, undefined, 'completed', from, to)
            .then((r: any) => r?.total || 0)
            .catch(() => 0)
        )
      );
      setRows(
        depts.map((d: ManagedDept, i: number) => ({
          id: String(d._id),
          name: `${d.department_name || 'Unnamed'}${d.is_unit ? ' (Unit)' : ''}`,
          isUnit: !!d.is_unit,
          total: results[i],
        }))
      );
    } catch {
      if (!silent) setRows([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => load(true), 10000);
    return () => clearInterval(interval);
  }, [load]);

  const chartHeight = Math.max(220, rows.length * 56 + 40);

  return (
    <div className="bg-white p-4" style={{ border: `1px solid ${BORDER}`, borderRadius: 0 }}>
      <h2 className="text-sm font-bold uppercase mb-1" style={{ fontFamily: FONT, color: NEUTRAL_DARK, letterSpacing: '1px' }}>
        Total Served
      </h2>
      <p className="text-xs mb-3" style={{ color: GRAY }}>
        Visitors served in your departments and units for the selected period
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <SpiralLoader />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm py-2" style={{ color: GRAY }}>No departments found</p>
      ) : (
        <div style={{ width: '100%', height: `${chartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 44, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.ceil((dataMax || 1) * 1.2)]}
                tick={{ fontSize: 11, fill: '#555555' }}
                axisLine={{ stroke: BORDER }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={124}
                interval={0}
                tick={<DeptNameTick />}
                axisLine={{ stroke: BORDER }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: NEUTRAL_LIGHT }}
                contentStyle={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 12 }}
                formatter={(value: any) => [`${value} served`, 'Total']}
              />
              <Bar dataKey="total" fill={PRIMARY} barSize={26} isAnimationActive={false}>
                <LabelList dataKey="total" position="right" style={{ fill: NEUTRAL_DARK, fontWeight: 700, fontSize: 12, fontFamily: FONT }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default HodServedSummary;
