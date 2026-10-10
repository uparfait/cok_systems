import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import { useAuth } from '../../../core/contexts/AuthContext';
import MainLayout from '../../../core/components/Layout/MainLayout';
import GateActionOverlay from './checkoutPerson/GateActionOverlay';
import InHouseTable from './checkoutPerson/InHouseTable';
import { useGateAction } from './checkoutPerson/useGateAction';
import { useInHouseVisits } from './checkoutPerson/useInHouseVisits';

const NEUTRAL_LIGHT = '#F7F9FB';
const WHITE = '#FFFFFF';
const GRAY_DISABLED = '#9E9E9E';
const CARD_SHADOW = '0 8px 40px 0 rgba(0,0,0,0.08)';

const CheckOutPersonPage: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const gate = useGateAction();
  const list = useInHouseVisits(isAuthenticated, !!gate.selected);
  const { removeRow, reload } = list;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  const confirm = async () => {
    const outcome = await gate.confirm();
    if (!outcome) return;
    if (outcome.removed) removeRow(outcome.id);
    reload(true);
  };

  return (
    <MainLayout>
      <div className="p-2" style={{ backgroundColor: NEUTRAL_LIGHT }}>
        <div className="p-3 mb-3" style={{ backgroundColor: WHITE, boxShadow: CARD_SHADOW, borderRadius: 0 }}>
          <div className="flex gap-2 w-full">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY_DISABLED }} />
              <input
                type="text"
                value={list.search}
                onChange={(e) => list.setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') list.applySearch();
                }}
                placeholder="Search by name, badge, ID number, phone, email or plate..."
                className="w-full pl-9 pr-3 py-2 cok-auth-input"
              />
            </div>
            <button
              type="button"
              onClick={list.applySearch}
              className="cok-btn-primary w-auto! px-4! py-2! inline-flex items-center gap-2"
            >
              <FiSearch className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>

        <InHouseTable
          rows={list.rows}
          loading={list.loading}
          searching={!!list.term.trim()}
          total={list.total}
          page={list.page}
          pages={list.pages}
          onPage={list.goTo}
          onAction={gate.open}
        />

        {gate.selected && gate.action ? (
          <GateActionOverlay
            row={gate.selected}
            action={gate.action}
            busy={gate.busy}
            failure={gate.failure}
            badge={gate.badge}
            onBadgeChange={gate.setBadge}
            onConfirm={confirm}
            onClose={gate.close}
          />
        ) : null}
      </div>
    </MainLayout>
  );
};

export default CheckOutPersonPage;
