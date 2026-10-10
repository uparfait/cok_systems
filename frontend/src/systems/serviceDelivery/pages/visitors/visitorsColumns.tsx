import React from 'react';
import type { DataTableColumn, DataTableQuery } from '../../../../core/components/table/dataTableTypes';
import { isFilterActive } from '../../../../core/components/table/dataTableTypes';
import type { VisitorListParams, VisitorRow } from '../../../../core/components/visitor/visitorTypes';
import { GENDERS, ID_TYPES } from '../../../../core/components/visitor/visitorTypes';
import { formatDateTime } from '../../../../core/components/visitor/visitorApi';

const statusLabel = (row: VisitorRow): string => {
  const visit = row.current_visit;
  if (!visit) return '-';
  if (visit.is_being_served) return 'Being served';
  if (visit.status === 'Not started') return 'Waiting';
  if (visit.status === 'Not assigned') return 'Not sent yet';
  if (visit.status === 'Transfered') return 'Transferred';
  return visit.status || '-';
};

export const visitorsColumns: DataTableColumn<VisitorRow>[] = [
  { key: 'full_name', label: 'Full name', filter: 'text', width: 190, render: (r) => <span className="font-semibold text-gray-900">{r.full_name}</span> },
  { key: 'id_type', label: 'ID type', filter: 'select', options: ID_TYPES.map((t) => ({ value: t, label: t })), width: 150, value: (r) => r.identification?.id_type },
  { key: 'id_number', label: 'ID number', filter: 'text', width: 170, value: (r) => r.identification?.number },
  { key: 'telephone', label: 'Telephone', filter: 'text', width: 150 },
  { key: 'email', label: 'Email', filter: 'text', width: 200, render: (r) => r.email || '-' },
  { key: 'gender', label: 'Gender', filter: 'select', options: GENDERS.map((g) => ({ value: g, label: g })), width: 120, render: (r) => r.gender || '-' },
  {
    key: 'presence',
    label: 'In house',
    filter: 'select',
    allLabel: 'All',
    options: [{ value: 'in_house', label: 'In house' }, { value: 'not_in_house', label: 'Not in house' }],
    sortable: false,
    width: 140,
    render: (r) => (
      <span className={`text-[11px] font-semibold px-2 py-0.5 border ${r.Is_In_House ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-300 bg-gray-50 text-gray-600'}`}>
        {r.Is_In_House ? 'In house' : 'Not in house'}
      </span>
    ),
  },
  { key: 'n_visits', label: 'Visits', filter: 'number', width: 130, align: 'center', value: (r) => r.N_visits },
  { key: 'department', label: 'Current department', filter: 'none', sortable: false, width: 180, render: (r) => r.current_visit?.department_name || '-' },
  { key: 'status', label: 'Service status', filter: 'none', sortable: false, width: 150, render: (r) => statusLabel(r) },
  {
    key: 'served_by',
    label: 'Being served by',
    filter: 'none',
    sortable: false,
    width: 180,
    render: (r) => (r.current_visit?.serving_by?.name ? `${r.current_visit.serving_by.name}${r.current_visit.serving_by.department_name ? ` (${r.current_visit.serving_by.department_name})` : ''}` : '-'),
  },
  { key: 'vehicle', label: 'Vehicle', filter: 'none', sortable: false, width: 120, render: (r) => r.current_visit?.plate_number || '-' },
  { key: 'updatedAt', label: 'Last update', filter: 'none', width: 170, render: (r) => formatDateTime(r.updatedAt) },
];

const SORT_KEYS: Record<string, string> = {
  full_name: 'full_name',
  id_type: 'id_type',
  id_number: 'id_number',
  telephone: 'telephone',
  email: 'email',
  gender: 'gender',
  n_visits: 'n_visits',
  updatedAt: 'updatedAt',
};

export function toListParams(query: DataTableQuery, extra: { from: string; to: string; mine: boolean }): VisitorListParams {
  const f = query.filters;
  const value = (key: string) => (isFilterActive(f[key]) ? f[key].value : undefined);
  const presence = f.presence ? f.presence.value : 'in_house';
  return {
    page: query.page,
    limit: query.limit,
    presence: presence === 'ALL' ? 'all' : (presence as VisitorListParams['presence']) || 'in_house',
    from: extra.from || undefined,
    to: extra.to || undefined,
    full_name: value('full_name'),
    id_type: value('id_type'),
    id_number: value('id_number'),
    telephone: value('telephone'),
    email: value('email'),
    gender: value('gender'),
    n_visits: value('n_visits'),
    n_visits_mode: isFilterActive(f.n_visits) ? f.n_visits.mode || 'min' : undefined,
    scope: extra.mine ? 'mine' : undefined,
    sort: query.sort.key ? SORT_KEYS[query.sort.key] : undefined,
    dir: query.sort.key ? query.sort.dir : undefined,
  };
}
