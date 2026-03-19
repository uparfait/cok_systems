// ServeVisitorModal - Modal for serving visitors (Timer starts automatically!)
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiSquare, FiRefreshCw, FiInfo, FiArrowRightCircle } from 'react-icons/fi';
import { employeeService } from '../../../../core/services/adminService';

export interface SelectedVisitor {
  name: string;
  id: string;
  email: string;
  service: string;
  checkInTime: string;
  gate: string;
  status?: string;
  serviceStartTime?: string;
  departmentName?: string;
}

export interface Department {
  _id: string;
  department_name?: string;
  name?: string;
}

export interface Employee {
  _id?: string;
  employee_id?: string;
  full_name?: string;
  title?: string;
  department_id?: string | Department | { _id?: string } | any;
}

export interface ServeVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: SelectedVisitor | null;
  onServiceEnd?: (data: { duration: string; startTime: string; endTime: string; notes: string; }) => void;
  onServiceStart?: (startTime: string) => void;
  // Transfer props
  departments?: Department[];
  employees?: Employee[];
  currentDepartmentId?: string;
  onTransfer?: (departmentId: string, departmentName: string, employeeId: string, employeeName: string) => void;
}

const ServeVisitorModal: React.FC<ServeVisitorModalProps> = ({
  isOpen, onClose, visitor, onServiceEnd, onServiceStart,
  departments = [], employees = [], currentDepartmentId = '', onTransfer
}) => {
  const [sessionNotes, setSessionNotes] = useState('');
  const [timer, setTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Added missing state variables from your code
  const [serviceStarted, setServiceStarted] = useState(false);
  const [serviceEnded, setServiceEnded] = useState(false);
  const [serviceStartTime, setServiceStartTime] = useState('');
  const [serviceEndTime, setServiceEndTime] = useState('');
  
  // Transfer state
  const [showTransferSection, setShowTransferSection] = useState(false);
  const [transferDepartment, setTransferDepartment] = useState('');
  const [transferEmployee, setTransferEmployee] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [departmentEmployees, setDepartmentEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  // YOUR LOGIC: Function to start the service timer manually
  const handleStartService = () => {
    setServiceStarted(true);
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setServiceStartTime(timeString);
    onServiceStart?.(timeString);
    
    // Start manual timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        let { hours, minutes, seconds } = prev;
        seconds++;
        if (seconds >= 60) {
          seconds = 0;
          minutes++;
        }
        if (minutes >= 60) {
          minutes = 0;
          hours++;
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
  };

  // Fetch employees when transfer department is selected
  useEffect(() => {
    if (transferDepartment && onTransfer) {
      setLoadingEmployees(true);
      setDepartmentEmployees([]);
      
      employeeService.getByDepartment(transferDepartment, false)
        .then((res: any) => {
          if (res.success && res.data) {
            setDepartmentEmployees(res.data);
          }
        })
        .catch(err => {
          console.error('Failed to fetch employees:', err);
        })
        .finally(() => {
          setLoadingEmployees(false);
        });
    } else {
      setDepartmentEmployees([]);
    }
  }, [transferDepartment, onTransfer]);

  // COMBINED LOGIC: Handles your auto-start AND colleague's sync smoothly
  useEffect(() => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isOpen && visitor) {
      // 1. Reset states (Your logic)
      setServiceStarted(false);
      setServiceEnded(false);
      setSessionNotes('');
      setTimer({ hours: 0, minutes: 0, seconds: 0 });
      setServiceStartTime('');
      setServiceEndTime('');
      setShowTransferSection(false);
      setTransferDepartment('');
      setTransferEmployee('');

      // 2. Decide which timer logic to use
      if (visitor.serviceStartTime) {
        // COLLEAGUE'S LOGIC: Visitor already has a start time, sync it accurately
        setServiceStarted(true);
        const start = new Date(visitor.serviceStartTime).getTime();
        
        if (!isNaN(start)) {
          const syncTimer = () => {
            const now = new Date().getTime();
            const elapsed = Math.max(0, Math.floor((now - start) / 1000));
            setTimer({
              hours: Math.floor(elapsed / 3600),
              minutes: Math.floor((elapsed % 3600) / 60),
              seconds: elapsed % 60
            });
          };
          
          syncTimer(); // Initial sync
          timerRef.current = setInterval(syncTimer, 1000); // Live sync
        }
      } else {
        // YOUR LOGIC: No start time yet, auto-start and notify parent
        handleStartService();
      }
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, visitor]); 

  const handleTransfer = () => {
    if (!transferDepartment || !transferEmployee || !onTransfer) return;
    
    const dept = departments.find(d => d._id === transferDepartment);
    const emp = employees.find(e => (e._id || e.employee_id) === transferEmployee);
    
    if (dept && emp) {
      setIsTransferring(true);
      onTransfer(
        transferDepartment,
        dept.department_name || dept.name || 'Unknown',
        emp._id || emp.employee_id || '',
        emp.full_name || 'Unknown'
      );
    }
  }; 

  const handleEndService = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const now = new Date();
    const endTimeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const duration = `${formatTime(timer.hours)}:${formatTime(timer.minutes)}:${formatTime(timer.seconds)}`;
    
    onServiceEnd?.({
      duration, 
      startTime: visitor?.serviceStartTime || serviceStartTime || '', // Fallback added
      endTime: endTimeString, 
      notes: sessionNotes
    });
  };

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  if (!isOpen || !visitor) return null;

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[16px] shadow-[0px_10px_30px_rgba(0,0,0,0.1)] w-full max-w-[950px] overflow-hidden" style={{ maxHeight: '90vh' }}>
        <div className="flex">
          {/* Left Panel - Visitor Information */}
          <div className="w-[300px] bg-[#F7F9FB] p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-5 h-5 bg-[#1E88C8] rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-[#2C3E50] text-[16px] font-semibold">Visitor Information</span>
            </div>

            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">VISITOR NAME</label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#DCEFF9] rounded-full flex items-center justify-center"><span className="text-[#1E88C8] text-[12px] font-bold">{getInitials(visitor.name)}</span></div>
                <span className="text-[#2C3E50] text-[14px] font-medium">{visitor.name}</span>
              </div>
            </div>

            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">VISITOR ID</label><span className="text-[#2C3E50] text-[13px]">{visitor.id}</span></div>
            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">EMAIL ADDRESS</label><span className="text-[#2C3E50] text-[13px]">{visitor.email}</span></div>
            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">DEPARTMENT</label><span className="inline-block bg-[#E3F2FD] text-[#1E88C8] text-[12px] px-2 py-1 rounded-[6px]">{visitor.departmentName || visitor.service}</span></div>
            <div className="mb-6"><label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">REQUESTED SERVICE</label><span className="inline-block bg-[#E3F2FD] text-[#1E88C8] text-[12px] px-2 py-1 rounded-[6px]">{visitor.service}</span></div>
            
            <div className="mt-auto">
              <div className="bg-[#EDF3F8] rounded-[12px] p-3 flex items-start gap-2">
                <FiInfo className="w-4 h-4 text-[#1E88C8] mt-0.5 flex-shrink-0" />
                <span className="text-[#2C3E50] text-[12px]">Assigned at {visitor.checkInTime} via {visitor.gate}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Service Session Control */}
          <div className="flex-1 p-7 overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-[#2C3E50] text-[20px] font-semibold">Service Session Control</h2>
              <button onClick={handleClose} className="text-[#000] hover:text-gray-600"><FiX className="w-6 h-6" /></button>
            </div>

            <div className="text-center mb-8">
              <label className="block text-[12px] text-[#8A94A6] uppercase tracking-[1px] mb-6">CURRENT DURATION</label>
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center"><span className="text-[40px] font-bold text-[#1F2D3D]">{formatTime(timer.hours)}</span></div><span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">HOURS</span></div><span className="text-[40px] font-bold text-[#1F2D3D] mt-[-20px]">:</span>
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center"><span className="text-[40px] font-bold text-[#1F2D3D]">{formatTime(timer.minutes)}</span></div><span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">MINUTES</span></div><span className="text-[40px] font-bold text-[#1F2D3D] mt-[-20px]">:</span>
                <div className="flex flex-col items-center"><div className="w-[90px] h-[90px] bg-[#F4F6F9] rounded-[16px] flex items-center justify-center"><span className="text-[40px] font-bold text-[#1E88C8]">{formatTime(timer.seconds)}</span></div><span className="text-[11px] text-[#8A94A6] mt-2 tracking-widest">SECONDS</span></div>
              </div>

              <div className="flex justify-center gap-3">
                <span className="inline-flex items-center gap-2 bg-[#e8f5e9] border border-[#34a853] text-[#2e7d32] px-5 py-3 rounded-[12px] text-[14px] font-bold tracking-wide">
                  <span className="w-2 h-2 rounded-full bg-[#34a853] animate-pulse"></span>
                  SERVICE IN PROGRESS
                </span>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-[12px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Session Notes (Optional)</label>
              <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Type notes about the service..." className="w-full h-[100px] border border-[#D9E1EA] rounded-[12px] p-3 text-[13px] resize-none focus:ring-2 focus:ring-[#1E88C8]" />
            </div>

            {/* Transfer Section */}
            {onTransfer && departments.length > 0 && (
              <div className="mb-6 p-4 bg-[#ecfdf5] rounded-[12px] border border-[#059669]">
                {!showTransferSection ? (
                  <button
                    onClick={() => setShowTransferSection(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#059669] text-white rounded-[8px] font-medium hover:bg-[#047857] transition-colors"
                  >
                    <FiArrowRightCircle className="w-4 h-4" /> Transfer to Another Department
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[#2C3E50] text-[14px] font-semibold">Transfer Visitor</span>
                      <button 
                        onClick={() => setShowTransferSection(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Select Department</label>
                      <select
                        value={transferDepartment}
                        onChange={(e) => {
                          setTransferDepartment(e.target.value);
                          setTransferEmployee('');
                        }}
                        className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#059669]"
                      >
                        <option value="">Choose department...</option>
                        {departments
                          .filter(d => d._id !== currentDepartmentId)
                          .map(dept => (
                            <option key={dept._id} value={dept._id}>
                              {dept.department_name || dept.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    
                    {transferDepartment && (
                      <div>
                        <label className="block text-[11px] text-[#8A94A6] uppercase tracking-[1px] mb-2">Select Employee</label>
                        <select
                          value={transferEmployee}
                          onChange={(e) => setTransferEmployee(e.target.value)}
                          className="w-full px-3 py-2 border border-[#D9E1EA] rounded-[8px] text-[13px] focus:ring-2 focus:ring-[#059669]"
                        >
                          <option value="">{loadingEmployees ? 'Loading employees...' : 'Choose employee...'}</option>
                          {departmentEmployees
                            .map((emp) => (
                              <option key={emp._id || emp.employee_id} value={emp._id || emp.employee_id}>
                                {emp.full_name} {emp.title ? `(${emp.title})` : ''}
                              </option>
                            ))}
                        </select>
                        {!loadingEmployees && departmentEmployees.length === 0 && transferDepartment && (
                          <p className="text-red-500 text-xs mt-2">No employees found in this department</p>
                        )}
                      </div>
                    )}
                    
                    <button
                      onClick={handleTransfer}
                      disabled={!transferDepartment || !transferEmployee || isTransferring}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#059669] text-white rounded-[8px] font-bold hover:bg-[#047857] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end items-center pt-4 border-t border-[#E8EAED]">
              <button onClick={handleEndService} className="inline-flex items-center gap-2 bg-[#e53935] text-white px-8 py-3 rounded-[14px] text-[14px] font-bold hover:bg-[#c62828] transition-colors shadow-sm">
                <FiSquare className="w-4 h-4 fill-current" /> End Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServeVisitorModal;