// ServiceHistoryTab.tsx - Personal completed services
import React, { useState, useEffect, useCallback } from 'react';
import { FiPhone, FiClock, FiCheckCircle, FiArrowRight, FiList, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';
import Table from '../../../../../core/components/Table';
import type { TableHeader } from '../../../../../core/components/Table';

const PRIMARY = "#056daa";
const NEUTRAL_DARK = "#333333";
const fontHeading = "'Montserrat', sans-serif";

const ServiceHistoryTab: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [serviceRecords, setServiceRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchServiceHistory = useCallback(async () => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || '');
    if (!myUserId) return;

    try {
      setLoading(true);
      const response = await serviceDeliveryService.getAll(1, 5000) as any;
      if (response && response.success) {
        const allVisitors = response.data || [];
        const records: any[] = [];

        allVisitors.forEach((v: any) => {
          // --- CHANGED: Improved scanning of provider ID (Line 42) ---
          const sStatus = v.services_status;
          const statusArray = Array.isArray(sStatus) ? sStatus : (sStatus ? [sStatus] : []);
          const mySession = statusArray.find((s: any) => String(s.provider_id) === myUserId);

          if (mySession) {
            records.push({
              id: v._id,
              visitorName: v.full_name || 'Unknown',
              phone: v.telephone || 'N/A',
              serviceType: mySession.department_name || 'General',
              status: String(mySession.s_type).toLowerCase(),
              entryDate: v.entry_date
            });
          }
        });
        setServiceRecords(records.sort((a,b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()));
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchServiceHistory(); }, [fetchServiceHistory]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold" style={{ fontFamily: fontHeading, color: NEUTRAL_DARK }}>Service History</h1>
        <div className="px-3 py-1.5 text-xs font-bold" style={{ fontFamily: fontHeading, color: PRIMARY, backgroundColor: 'rgba(5,109,170,0.08)' }}>{serviceRecords.length} Records</div>
      </div>

      <Table
        headers={[
          { key: 'visitor', label: 'Visitor' },
          { key: 'service', label: 'Service' },
          { key: 'status', label: 'Status' },
          { key: 'arrival', label: 'Arrival' }
        ]}
        data={serviceRecords}
        loading={loading && serviceRecords.length === 0}
        emptyMessage="No service history found."
        maxHeight="500px"
        minWidth="600px"
        renderCell={(header, record, index) => {
          switch (header.key) {
            case 'visitor':
              return <span className="font-bold" style={{ color: NEUTRAL_DARK }}>{record.visitorName}</span>;
            case 'service':
              return <span className="text-[#555555] text-sm">{record.serviceType}</span>;
            case 'status':
              return (
                <span className={`px-2 py-0.5 text-xs font-bold uppercase ${
                  record.status === 'completed' ? 'bg-[rgba(51,51,51,0.08)] text-[#555555]' : 'bg-[rgba(243,156,18,0.12)] text-[#F39C12]'
                }`}>
                  {record.status}
                </span>
              );
            case 'arrival':
              return <span className="text-xs text-[#9E9E9E]">{new Date(record.entryDate).toLocaleTimeString()}</span>;
            default:
              return <span>{record[header.key] || '-'}</span>;
          }
        }}
      />
    </div>
  );
};

export default ServiceHistoryTab;
