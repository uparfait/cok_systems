// ServiceHistoryTab.tsx - Personal completed services
import React, { useState, useEffect, useCallback } from 'react';
import { FiPhone, FiClock, FiCheckCircle, FiArrowRight, FiList, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService } from '../../../../../core/services/adminService';

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
    <div className="p-7">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[#1a2744] text-[28px] font-extrabold">Service History</h1>
        <div className="text-blue-600 bg-blue-50 px-4 py-2 rounded-lg font-bold">{serviceRecords.length} Records</div>
      </div>

      <div className="bg-white rounded-[14px] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Visitor</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Service</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Status</th>
              <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-500 uppercase">Arrival</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {serviceRecords.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 font-bold text-[#1a2744]">{record.visitorName}</td>
                <td className="px-5 py-4 text-gray-600 text-sm">{record.serviceType}</td>
                <td className="px-5 py-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${record.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {record.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-gray-400">{new Date(record.entryDate).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServiceHistoryTab;