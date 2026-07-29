// Temporary demo: same Requests BarChart structure as OverviewPage.tsx, with many departments to show horizontal scrolling
import { createRoot } from 'react-dom/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';

const CC = { blue: '#34A8DB', teal: '#4CAF50', amber: '#F39C12', red: '#E53935' };
const COK = { border: '#e5e7eb', neutralLight: '#f9fafb' };

const rand = (n: number) => Math.floor(Math.random() * n);
const makeRows = (count: number, label: string) =>
  Array.from({ length: count }, (_, i) => ({
    name: `${label} ${i + 1}`,
    fullName: `${label} number ${i + 1}`,
    pending: rand(8), inprogress: rand(8), completed: rand(10), overdue: rand(4),
  }));

const few = makeRows(4, 'Dept');
const many = makeRows(22, 'Dept');

function RequestsChart({ rows }: { rows: ReturnType<typeof makeRows> }) {
  return (
    // Same wrapper as OverviewPage: h-56 (224px) + overflow-x-auto, inner min-width = 110px per item
    <div className="no-scrollbar" style={{ height: 224, overflowX: 'auto' }}>
      <div style={{ height: '100%', minWidth: `${rows.length * 110}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="18%" margin={{ top: 10, right: 5, left: -25, bottom: 25 }}>
            <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: COK.border }} tickLine={false} />
            <RTooltip cursor={{ fill: COK.neutralLight }} contentStyle={{ border: `1px solid ${COK.border}`, borderRadius: 0, fontSize: 12 }} />
            <Bar dataKey="pending" name="Pending" fill={CC.amber} maxBarSize={32} />
            <Bar dataKey="inprogress" name="In progress" fill={CC.blue} maxBarSize={32} />
            <Bar dataKey="completed" name="Completed" fill={CC.teal} maxBarSize={32} />
            <Bar dataKey="overdue" name="Overdue" fill={CC.red} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 16, maxWidth: 620 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{sub}</div>
      {children}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <div>
    <Card title="Requests — 4 departments" sub="Few bars: fits the card, NO scrollbar (unchanged look)">
      <RequestsChart rows={few} />
    </Card>
    <Card title="Requests — 22 departments" sub="Many bars: chart grows wider than the card and scrolls horizontally →">
      <RequestsChart rows={many} />
    </Card>
  </div>
);
