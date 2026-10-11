import React, { useCallback, useEffect, useRef, useState } from 'react';
import DataTable from '../../../../core/components/table/DataTable';
import type { DataTableQuery } from '../../../../core/components/table/dataTableTypes';
import { emptyQuery } from '../../../../core/components/table/dataTableTypes';
import { useVisitorPanel } from '../../../../core/components/visitor/VisitorPanelProvider';
import { failureOf, visitorApi } from '../../../../core/components/visitor/visitorApi';
import type { VisitorListParams, VisitorRow } from '../../../../core/components/visitor/visitorTypes';
import { useToast } from '../../../../core/contexts/ToastContext';
import { toListParams, visitorsColumns } from '../../../serviceDelivery/pages/visitors/visitorsColumns';
import type { AppliedFilter } from '../components/FeedbackFeed';
import MayorBoardOverlay from './MayorBoardOverlay';
import { periodToRange } from './MayorDeptServicesSection';

export type OverviewCardKey = 'visitors' | 'inHouse' | 'returning' | 'registered' | 'served' | 'notServed';

const CARD_TITLE: Record<OverviewCardKey, string> = {
  visitors: 'Visitors in this period',
  inHouse: 'Visitors in house now',
  returning: 'Returning visitors',
  registered: 'Registered visitors',
  served: 'Visitors served in this period',
  notServed: 'Visitors not served yet',
};

const cardParams = (card: OverviewCardKey, applied: AppliedFilter): Partial<VisitorListParams> => {
  const { from, to } = periodToRange(applied);
  if (card === 'visitors') return { presence: 'all', view: 'visited', view_from: from, view_to: to };
  if (card === 'inHouse') return { presence: 'in_house' };
  if (card === 'returning') return { presence: 'all', n_visits: '2', n_visits_mode: 'min' };
  if (card === 'served') return { presence: 'all', view: 'served', view_from: from, view_to: to };
  if (card === 'notServed') return { presence: 'all', view: 'not_served', view_from: from, view_to: to };
  return { presence: 'all' };
};

interface MayorVisitorsOverlayProps {
  card: OverviewCardKey;
  applied: AppliedFilter;
  onClose: () => void;
}

const MayorVisitorsOverlay: React.FC<MayorVisitorsOverlayProps> = ({ card, applied, onClose }) => {
  const { openVisitor } = useVisitorPanel();
  const { showError } = useToast();
  const [query, setQuery] = useState<DataTableQuery>(() => ({ ...emptyQuery(20), filters: {} }));
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const base = toListParams(query, { from: '', to: '', mine: false });
      const response = await visitorApi.list({ ...base, ...cardParams(card, applied) });
      if (current !== sequence.current) return;
      setRows(response.data || []);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      if (current === sequence.current) showError(failureOf(error).message);
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [query, card, applied]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MayorBoardOverlay title={CARD_TITLE[card]} subtitle={`${total.toLocaleString()} visitor(s). Click a visitor to see their details and attachments.`} onClose={onClose} width="xl">
      <DataTable<VisitorRow>
        mode="server"
        columns={visitorsColumns}
        rows={rows}
        total={total}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        rowKey={(row) => row._id}
        onRowClick={(row) => openVisitor(row._id, { readOnly: true })}
        storageKey={`overview-${card}`}
        minWidth={1500}
        maxHeight="55vh"
        emptyTitle="No visitor"
        emptyText="No visitor matches this card for the selected period."
      />
    </MayorBoardOverlay>
  );
};

export default MayorVisitorsOverlay;
