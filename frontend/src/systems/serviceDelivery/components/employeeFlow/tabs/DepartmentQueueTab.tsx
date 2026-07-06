// DepartmentQueueTab - Department Queue for Employee
// Shows all units in the department and their assigned visitors

import React, { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiClock, FiCheckCircle, FiArrowRight, FiChevronDown, FiChevronRight, FiList, FiUserCheck } from 'react-icons/fi';
import { useAuth } from '../../../../../core/contexts/AuthContext';
import { serviceDeliveryService, departmentService } from '../../../../../core/services/adminService';

interface DepartmentVisitor {
  id: string;
  visitorName: string;
  phone: string;
  serviceType: string;
  status: string;
  entryDate: string;
  ticketNumber?: string;
  providerName?: string;
  departmentName?: string;
}

interface DepartmentUnity {
  unityId: string;
  unityName: string;
  visitors: DepartmentVisitor[];
}

const DepartmentQueueTab: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departmentUnities, setDepartmentUnities] = useState<DepartmentUnity[]>([]);
  const [unassignedVisitors, setUnassignedVisitors] = useState<DepartmentVisitor[]>([]);
  const [expandedUnities, setExpandedUnities] = useState<Set<string>>(new Set());
  const [showUnassigned, setShowUnassigned] = useState(true);

  const fetchDepartmentQueue = useCallback(async () => {
    const currentUser = user as any;
    const myUserId = String(currentUser?.userId || currentUser?._id || currentUser?.id || currentUser?.employee_id || '');
    
    // Extract everything we can about the user's department (could be an ID or a Name depending on login state)
    const rawDeptIdentifier = currentUser?.department_id || currentUser?.department?._id || currentUser?.department || currentUser?.department_name || '';

    if (!myUserId || myUserId === 'undefined' || myUserId === '') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // STEP 1: FETCH ALL DEPARTMENTS AND ROBUSTLY RESOLVE THE PARENT DEPARTMENT ID
      let allDepartments: any[] = [];
      const deptResponse = await departmentService.getAll() as any;
      if (deptResponse && (deptResponse.status || deptResponse.success)) {
        allDepartments = Array.isArray(deptResponse.data) ? deptResponse.data : (deptResponse.data?.data || []);
      }
      
      // Match the employee's raw department identifier to an ACTUAL backend department _id
      let actualParentDeptId = '';
      const matchedDept = allDepartments.find((d: any) => 
        String(d._id) === String(rawDeptIdentifier) || 
        String(d.department_id) === String(rawDeptIdentifier) ||
        String(d.department_name).toLowerCase() === String(rawDeptIdentifier).toLowerCase()
      );

      if (matchedDept) {
        actualParentDeptId = String(matchedDept._id);
        console.log(`Resolved Employee Dept: "${rawDeptIdentifier}" -> ID: ${actualParentDeptId}`);
      } else {
        console.warn('Could not match employee department name/id to backend list:', rawDeptIdentifier);
        // Fallback to whatever string we have if we couldn't match it
        actualParentDeptId = String(rawDeptIdentifier);
      }

      // STEP 2: FIND UNITS (SUB-DEPARTMENTS) BELONGING TO THIS PARENT ID
      const subDepts = allDepartments.filter((dept: any) => {
        return (
          (dept.sub_department_mng?.is_sub_department === true || dept.sub_department_mng?.is_sub_department === 'true') &&
          String(dept.sub_department_mng?.parent_department_id) === actualParentDeptId
        );
      });
      
      // Create mappings and pre-populate the buckets so empty units still show up in the UI
      const unitNameMap = new Map<string, string>();
      const unityBuckets = new Map<string, DepartmentVisitor[]>();
      
      subDepts.forEach((dept: any) => {
        const unitId = String(dept._id || dept.department_id || '');
        const unitName = dept.department_name || dept.name || 'Unknown Unit';
        unitNameMap.set(unitId, unitName);
        unityBuckets.set(unitId, []); // Pre-initialize bucket to empty array
      });

      console.log(`Found ${subDepts.length} units for this department`);

      // STEP 3: GET CHECKED-IN VISITORS
      const visitorResponse = await serviceDeliveryService.getAll(1, 10000) as any;
      
      if (visitorResponse && (visitorResponse.success || Array.isArray(visitorResponse.data) || Array.isArray(visitorResponse))) {
        // Handle different possible API response shapes
        const allVisitors = Array.isArray(visitorResponse) ? visitorResponse : (Array.isArray(visitorResponse.data) ? visitorResponse.data : (visitorResponse.data?.data || []));
        
        const unassigned: DepartmentVisitor[] = [];
        
        allVisitors.forEach((v: any) => {
          const visitorStatus = v.status ? String(v.status).toLowerCase() : 'waiting';
          const deptsAssigned = Array.isArray(v.departments_assigned) ? v.departments_assigned : [];
          
          let foundUnitId = '';
          let foundUnitName = '';
          let deptName = '';
          
          // Check if any of the assigned departments are actually one of our Units
          for (const dept of deptsAssigned) {
            const assignedId = String(dept.department_id || dept._id || '');
            if (unitNameMap.has(assignedId)) {
              foundUnitId = assignedId;
              foundUnitName = unitNameMap.get(assignedId)!;
              deptName = dept.department_name || '';
              break;
            }
          }

          // Fallback: Sometimes assigned directly via unit_id outside of the array
          if (!foundUnitId) {
             const flatUnitId = String(v.department_unit || v.unit_id || '');
             if (unitNameMap.has(flatUnitId)) {
                 foundUnitId = flatUnitId;
                 foundUnitName = unitNameMap.get(flatUnitId)!;
             }
          }
          
          const visitorData: DepartmentVisitor = {
            id: v._id || v.id || '',
            visitorName: v.visitor_name || v.full_name || v.name || 'Unknown',
            phone: v.phone || v.telephone || v.phone_number || 'N/A',
            serviceType: v.service_type || v.service_name || v.service || 'General Service',
            status: visitorStatus,
            entryDate: v.entry_date || v.check_in_time || v.created_at,
            ticketNumber: v.ticket_number || '',
            providerName: foundUnitName,
            departmentName: deptName
          };
          
          // Place visitor in the correct bucket
          if (foundUnitId && unityBuckets.has(foundUnitId)) {
            unityBuckets.get(foundUnitId)!.push(visitorData);
          } else {
            // Not assigned to a specific sub-unit (or assigned to main dept only)
            unassigned.push(visitorData);
          }
        });

        // STEP 4: CONVERT BUCKETS TO COMPONENT STATE
        const unities: DepartmentUnity[] = [];
        unityBuckets.forEach((visitors, unitId) => {
          unities.push({
            unityId: unitId,
            unityName: unitNameMap.get(unitId) || `Unit ${unitId.slice(-4)}`,
            visitors: visitors.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
          });
        });

        // Sort unities by number of visitors (busiest first), then alphabetically
        unities.sort((a, b) => b.visitors.length - a.visitors.length || a.unityName.localeCompare(b.unityName));

        setDepartmentUnities(unities);
        setUnassignedVisitors(unassigned.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()));
        
        // Expand all unities by default so users can see the queues immediately
        setExpandedUnities(new Set(unities.map(u => u.unityId)));
      }
    } catch (error) {
      console.error('Error fetching department queue:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDepartmentQueue();
  }, [fetchDepartmentQueue]);

  const toggleUnity = (unityId: string) => {
    const newExpanded = new Set(expandedUnities);
    if (newExpanded.has(unityId)) {
      newExpanded.delete(unityId);
    } else {
      newExpanded.add(unityId);
    }
    setExpandedUnities(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWaitTime = (entryDate: string) => {
    if (!entryDate) return 'N/A';
    const entry = new Date(entryDate).getTime();
    const now = Date.now();
    const diffMins = Math.floor((now - entry) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactNode> = {
      waiting: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FiClock className="w-3 h-3 mr-1" />Waiting</span>,
      pending: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><FiClock className="w-3 h-3 mr-1" />Pending</span>,
      in_service: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><FiUserCheck className="w-3 h-3 mr-1" />In Service</span>,
      in_progress: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><FiUserCheck className="w-3 h-3 mr-1" />In Progress</span>,
      serving: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><FiUserCheck className="w-3 h-3 mr-1" />Serving</span>,
      completed: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><FiCheckCircle className="w-3 h-3 mr-1" />Completed</span>,
      transferred: <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><FiArrowRight className="w-3 h-3 mr-1" />Transferred</span>
    };
    return badges[status] || badges.waiting;
  };

  const totalWaiting = unassignedVisitors.length + departmentUnities.reduce((sum, u) => 
    sum + u.visitors.filter(v => ['waiting', 'pending'].includes(v.status)).length, 0
  );
  const totalInService = departmentUnities.reduce((sum, u) => 
    sum + u.visitors.filter(v => ['in_service', 'serving', 'in_progress'].includes(v.status)).length, 0
  );

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold text-[#1a2744]">Department Queue</h1>
          <p className="text-gray-500 text-xs mt-0.5">A high-level view of how many people are waiting in the entire department.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-yellow-50 px-2.5 py-1.5">
            <FiClock className="text-yellow-600 w-4 h-4" />
            <span className="text-yellow-800 text-xs font-semibold">{totalWaiting} Waiting</span>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1.5">
            <FiUserCheck className="text-blue-600 w-4 h-4" />
            <span className="text-blue-800 text-xs font-semibold">{totalInService} In Service</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        {/* Unassigned Section */}
        <div className="col-span-2 bg-white rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] overflow-hidden">
          <div 
            className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100"
            onClick={() => setShowUnassigned(!showUnassigned)}
          >
            <div className="flex items-center gap-3">
              {showUnassigned ? <FiChevronDown className="w-5 h-5 text-[#666]" /> : <FiChevronRight className="w-5 h-5 text-[#666]" />}
              <span className="text-[#1a2744] text-[15px] font-semibold">Checked In (Unassigned)</span>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">{unassignedVisitors.length}</span>
            </div>
            <span className="text-[#888] text-[12px]">Visitors waiting for unit/provider assignment</span>
          </div>
          
          {!loading && showUnassigned && (
            <div className="max-h-[400px] overflow-y-auto">
              {unassignedVisitors.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-[#888] text-[14px]">No unassigned visitors</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Visitor</th>
                      <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Service</th>
                      <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Wait Time</th>
                      <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unassignedVisitors.map((visitor) => (
                      <tr key={visitor.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-yellow-400 text-white flex items-center justify-center text-[10px] font-semibold">
                              {visitor.visitorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[#1a2744] text-[13px]">{visitor.visitorName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#666] text-[12px]">{visitor.serviceType}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#888] text-[12px]">{getWaitTime(visitor.entryDate)}</span>
                        </td>
                        <td className="px-5 py-3">
                          {getStatusBadge(visitor.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-[#1a73e8] to-[#1557b0] rounded-[14px] p-5 text-white">
          <h3 className="text-white text-[16px] font-bold mb-4">Queue Summary</h3>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FiList className="w-4 h-4 opacity-70" />
                <span className="text-white/70 text-[12px]">Total Units</span>
              </div>
              <div className="text-white text-[28px] font-bold">{departmentUnities.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FiUsers className="w-4 h-4 opacity-70" />
                <span className="text-white/70 text-[12px]">Unassigned Visitors</span>
              </div>
              <div className="text-white text-[28px] font-bold">{unassignedVisitors.length}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <FiUserCheck className="w-4 h-4 opacity-70" />
                <span className="text-white/70 text-[12px]">Currently Serving</span>
              </div>
              <div className="text-white text-[28px] font-bold">{totalInService}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Department Units */}
      <div className="mt-6 bg-white rounded-[14px] shadow-[0_1px_4px_rgba(0,0,0,0.07)] overflow-hidden">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-[#1a2744] text-[15px] font-semibold">Department Units</span>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">{departmentUnities.length}</span>
          </div>
        </div>
        
        {!loading && (
          <div>
            {departmentUnities.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <FiUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-[#888] text-[14px]">No department units found.</p>
              </div>
            ) : (
              departmentUnities.map((unity) => {
                const isExpanded = expandedUnities.has(unity.unityId);
                const waitingCount = unity.visitors.filter(v => ['waiting', 'pending'].includes(v.status)).length;
                const inServiceCount = unity.visitors.filter(v => ['in_service', 'serving', 'in_progress'].includes(v.status)).length;
                
                return (
                  <div key={unity.unityId} className="border-b border-gray-100 last:border-0">
                    <div 
                      className="px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleUnity(unity.unityId)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <FiChevronDown className="w-5 h-5 text-[#666]" /> : <FiChevronRight className="w-5 h-5 text-[#666]" />}
                        <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-[14px] font-semibold">
                          {unity.unityName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[#1a2744] text-[14px] font-medium">{unity.unityName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {waitingCount > 0 && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                            {waitingCount} waiting
                          </span>
                        )}
                        {inServiceCount > 0 && (
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                            {inServiceCount} in service
                          </span>
                        )}
                        <span className="text-[#888] text-[12px]">{unity.visitors.length} total</span>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100 max-h-[300px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Visitor</th>
                              <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Service</th>
                              <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Arrival</th>
                              <th className="px-5 py-2 text-left text-[10px] font-semibold text-[#666] uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {unity.visitors.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-5 py-4 text-center text-gray-500 text-sm">
                                  No visitors assigned to this unit
                                </td>
                              </tr>
                            ) : (
                              unity.visitors.map((visitor) => (
                                <tr key={visitor.id} className="hover:bg-white">
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px] font-semibold">
                                        {visitor.visitorName.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-[#1a2744] text-[13px]">{visitor.visitorName}</span>
                                    </div>
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className="text-[#666] text-[12px]">{visitor.serviceType}</span>
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className="text-[#888] text-[12px]">{formatDate(visitor.entryDate)}</span>
                                  </td>
                                  <td className="px-5 py-3">
                                    {getStatusBadge(visitor.status)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentQueueTab;