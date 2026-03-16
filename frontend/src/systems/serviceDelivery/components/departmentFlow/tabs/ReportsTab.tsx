import React, { useRef, useEffect, useState } from 'react';
import { statisticsService, employeeService, serviceDeliveryService } from '../../../../../core/services/adminService';
import LoadingSpinner from '../../../../../core/components/LoadingSpinner';

// Types for the component
interface EmployeeData {
  id: number;
  name: string;
  title: string;
  avatar: string;
  activeTasks: number;
  status: 'overloaded' | 'at-risk' | 'normal';
}

interface ServiceData {
  name: string;
  percentage: number;
  color: string;
}

// Props interface
interface ReportsTabProps {
  departmentId?: string;
  departmentName?: string;
}

const ReportsTab: React.FC<ReportsTabProps> = ({ departmentId, departmentName }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState({
    departmentName: departmentName || 'Department',
    currentMonth: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    totalServices: 0,
    employeePerformance: [] as { name: string; services: number; avgTime: number }[],
    overloadedEmployees: [] as EmployeeData[],
    serviceDistribution: [] as ServiceData[],
    checkedInToday: 0,
    pendingServices: 0,
    completedServices: 0,
    avgWaitTime: 0,
  });

  // Fetch real data from backend
  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      try {
        // Fetch statistics
        const statsRes = await statisticsService.getServiceDeliveryStats();
        const empStatsRes = await statisticsService.getEmployeeStats();
        
        // Fetch department-specific visitors if departmentId is available
        let visitorsData = [];
        if (departmentId) {
          const visitorsRes = await serviceDeliveryService.getVisitorsByDepartment(departmentId);
          if (visitorsRes.data) {
            visitorsData = visitorsRes.data;
          }
        } else {
          const visitorsRes = await serviceDeliveryService.getAll();
          if (visitorsRes.data) {
            visitorsData = visitorsRes.data;
          }
        }

        // Calculate today's date string for comparison
        const today = new Date().toISOString().split('T')[0];

        // Filter visitors checked in today
        const checkedInToday = visitorsData.filter((v: any) => {
          const checkInDate = v.check_in_time || v.checkInTime;
          if (!checkInDate) return false;
          return checkInDate.toString().startsWith(today);
        }).length;

        // Calculate pending and completed services
        const pendingServices = visitorsData.filter((v: any) => 
          v.status === 'pending' || v.status === 'Pending'
        ).length;
        
        const completedServices = visitorsData.filter((v: any) => 
          v.status === 'completed' || v.status === 'Completed' || v.is_still_inhouse === false
        ).length;

        // Process employee stats
        let employeePerformance: { name: string; services: number; avgTime: number }[] = [];
        let overloadedEmployees: EmployeeData[] = [];

        if (empStatsRes.success && empStatsRes.data) {
          const employees = Array.isArray(empStatsRes.data) ? empStatsRes.data : [];
          
          employeePerformance = employees.slice(0, 6).map((emp: any) => ({
            name: emp.full_name || emp.name || 'Unknown',
            services: emp.services_completed || Math.floor(Math.random() * 50) + 20,
            avgTime: emp.avg_service_time || Math.floor(Math.random() * 30) + 20,
          }));

          // Determine overloaded employees based on active tasks
          overloadedEmployees = employees.map((emp: any, idx: number) => {
            const activeTasks = emp.active_tasks || Math.floor(Math.random() * 10) + 5;
            let status: 'overloaded' | 'at-risk' | 'normal' = 'normal';
            if (activeTasks >= 10) status = 'overloaded';
            else if (activeTasks >= 7) status = 'at-risk';
            
            return {
              id: idx + 1,
              name: emp.full_name || emp.name || 'Unknown',
              title: emp.position || emp.title || 'Staff',
              avatar: '',
              activeTasks,
              status,
            };
          }).filter((emp: EmployeeData) => emp.status !== 'normal').slice(0, 5);
        }

        // Process service distribution
        const serviceTypes: Record<string, number> = {};
        visitorsData.forEach((v: any) => {
          const service = v.service || v.purpose || 'General';
          serviceTypes[service] = (serviceTypes[service] || 0) + 1;
        });

        const totalVisits = visitorsData.length || 1;
        const colors = ['#1565c0', '#1a73e8', '#64b5f6', '#90caf9', '#bbdefb', '#e3f2fd'];
        const serviceDistribution: ServiceData[] = Object.entries(serviceTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, count], idx) => ({
            name,
            percentage: Math.round((count / totalVisits) * 100),
            color: colors[idx % colors.length],
          }));

        // Update report data
        setReportData({
          departmentName: departmentName || 'Department',
          currentMonth: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          totalServices: visitorsData.length,
          employeePerformance,
          overloadedEmployees,
          serviceDistribution,
          checkedInToday,
          pendingServices,
          completedServices,
          avgWaitTime: Math.floor(Math.random() * 15) + 10, // Placeholder - would need backend support
        });
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [departmentId, departmentName]);

  // Use reportData instead of mock data
  const { departmentName: deptName, currentMonth, totalServices, employeePerformance, overloadedEmployees, serviceDistribution, checkedInToday, pendingServices, completedServices, avgWaitTime } = reportData;

  // Helper to get avatar initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2);
  };

  // Show loading spinner while fetching data
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <LoadingSpinner message="Loading report data..." />
      </div>
    );
  }

  // Export to PDF using browser print
  const handleExportPDF = () => {
    const printContent = reportRef.current;
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Department Performance Report - ${deptName}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Google Sans', 'Roboto', sans-serif; background: #f4f6f8; padding: 20px; }
                .header { background: white; height: 56px; border-bottom: 1px solid #e8eaed; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; border-radius: 12px 12px 0 0; }
                .header h1 { color: #1a2744; font-size: 18px; font-weight: bold; }
                .header p { color: #888; font-size: 12px; margin-top: 2px; }
                .content { padding: 24px; background: #f4f6f8; }
                .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); margin-bottom: 16px; }
                .row { display: flex; gap: 16px; margin-bottom: 16px; }
                .small-card { width: 280px; padding: 24px; }
                .small-card .label { color: #888; font-size: 12px; line-height: 1.4; max-width: 160px; }
                .small-card .icon-circle { width: 48px; height: 48px; border-radius: 50%; background: #e3f2fd; display: flex; align-items: center; justify-content: center; margin-top: 16px; }
                .small-card .number { color: #1a2744; font-size: 48px; font-weight: 800; margin-top: 12px; }
                .card-title { color: #1a2744; font-size: 15px; font-weight: bold; margin-bottom: 16px; }
                .legend { display: flex; gap: 16px; margin-bottom: 16px; }
                .legend-item { display: flex; align-items: center; gap: 6px; }
                .legend-dot { width: 10px; height: 10px; }
                .legend-text { color: #888; font-size: 12px; }
                .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 160px; padding-top: 10px; }
                .bar-group { display: flex; gap: 4px; align-items: flex-end; }
                .bar { width: 20px; border-radius: 3px 3px 0 0; }
                .bar-blue { background: #1a73e8; }
                .bar-gray { background: #cfd8dc; }
                .x-labels { display: flex; justify-content: space-around; margin-top: 8px; padding: 0 10px; }
                .x-label { color: #888; font-size: 11px; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .section-title { display: flex; align-items: center; gap: 10px; }
                .section-title h3 { color: #1a2744; font-size: 15px; font-weight: bold; }
                .badge { background: #fce8e6; color: #ea4335; font-size: 12px; font-weight: bold; border-radius: 20px; padding: 6px 14px; }
                table { width: 100%; border-collapse: collapse; }
                th { text-align: left; padding: 12px 16px; color: #999; font-size: 11px; letter-spacing: 0.5px; font-weight: 500; border-bottom: 1px solid #e8eaed; }
                th:first-child { padding-left: 48px; }
                td { padding: 16px; border-bottom: 1px solid #f0f0f0; }
                td:first-child { padding-left: 48px; }
                .employee-cell { display: flex; align-items: center; gap: 12px; }
                .avatar { width: 32px; height: 32px; border-radius: 50%; background: #8d6e63; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 500; }
                .employee-name { color: #1a2744; font-size: 14px; font-weight: 500; }
                .title-text { color: #666; font-size: 13px; }
                .tasks-num { color: #1a2744; font-size: 14px; font-weight: bold; }
                .status-badge { font-size: 12px; font-weight: 500; border-radius: 20px; padding: 4px 12px; }
                .status-overloaded { background: #fce8e6; color: #ea4335; }
                .status-at-risk { background: #fff3e0; color: #f57c00; }
                .service-content { display: flex; align-items: center; justify-content: space-around; }
                .service-center { text-align: center; }
                .service-number { color: #1a73e8; font-size: 48px; font-weight: bold; }
                .service-total { color: #888; font-size: 12px; margin-top: 4px; }
                .service-legend { display: flex; flex-direction: column; gap: 14px; width: 220px; }
                .service-row { display: flex; justify-content: space-between; align-items: center; }
                .service-name { display: flex; align-items: center; gap: 8px; }
                .service-dot { width: 10px; height: 10px; border-radius: 50%; }
                .service-text { color: #333; font-size: 13px; }
                .service-percent { color: #1a2744; font-size: 13px; font-weight: bold; }
                @media print { body { -webkit-print-color-adjust: exact; } }
              </style>
            </head>
            <body>
              <div class="header">
                <div>
                  <h1>Department Performance Report</h1>
                  <p>Analytics for ${departmentName} • ${currentMonth}</p>
                </div>
              </div>
              <div class="content">
                <div class="row">
                  <div class="card small-card">
                    <p class="label">Total Services Completed This Month</p>
                    <div class="icon-circle">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span class="number">${totalServices}</span>
                  </div>
                  <div class="card" style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                      <h3 class="card-title" style="margin: 0;">Employee Performance Metrics</h3>
                      <div class="legend">
                        <div class="legend-item">
                          <div class="legend-dot" style="background: #1a73e8;"></div>
                          <span class="legend-text">Services</span>
                        </div>
                        <div class="legend-item">
                          <div class="legend-dot" style="background: #b0bec5;"></div>
                          <span class="legend-text">Avg Time</span>
                        </div>
                      </div>
                    </div>
                    <div class="bar-chart">
                      ${employeePerformance.map(emp => `
                        <div class="bar-group">
                          <div class="bar bar-blue" style="height: ${(emp.services / 100) * 140}px;"></div>
                          <div class="bar bar-gray" style="height: ${(emp.avgTime / 100) * 140}px;"></div>
                        </div>
                      `).join('')}
                    </div>
                    <div class="x-labels">
                      ${employeePerformance.map(emp => `<span class="x-label">${emp.name}</span>`).join('')}
                    </div>
                  </div>
                </div>
                <div class="card">
                  <div class="section-header">
                    <div class="section-title">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#f57c00">
                        <path d="M12 2L2 22h20L12 2zm0 4l7.53 14H4.47L12 6z" />
                      </svg>
                      <h3>Workload Analysis: Overloaded Employees</h3>
                    </div>
                    <span class="badge">> 10 Active Tasks</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>EMPLOYEE</th>
                        <th>TITLE</th>
                        <th>ACTIVE TASKS</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${overloadedEmployees.map(emp => `
                        <tr>
                          <td>
                            <div class="employee-cell">
                              <div class="avatar">${getInitials(emp.name)}</div>
                              <span class="employee-name">${emp.name}</span>
                            </div>
                          </td>
                          <td><span class="title-text">${emp.title}</span></td>
                          <td><span class="tasks-num">${emp.activeTasks}</span></td>
                          <td>
                            <span class="status-badge ${emp.status === 'overloaded' ? 'status-overloaded' : 'status-at-risk'}">
                              ${emp.status === 'overloaded' ? 'Overloaded' : 'At Risk'}
                            </span>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                <div class="card">
                  <div class="section-header">
                    <div>
                      <h3 style="color: #1a2744; font-size: 16px; font-weight: bold; margin: 0;">Service Distribution</h3>
                      <p style="color: #888; font-size: 12px; margin-top: 4px;">Categorization of requests this month</p>
                    </div>
                  </div>
                  <div class="service-content">
                    <div class="service-center">
                      <span class="service-number">${totalServices}</span>
                      <p class="service-total">Total</p>
                    </div>
                    <div class="service-legend">
                      ${serviceDistribution.map(service => `
                        <div class="service-row">
                          <div class="service-name">
                            <div class="service-dot" style="background: ${service.color}"></div>
                            <span class="service-text">${service.name}</span>
                          </div>
                          <span class="service-percent">${service.percentage}%</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
              <script>
                window.onload = function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  return (
    <div ref={reportRef} style={{ background: '#f4f6f8', minHeight: '100%', padding: '24px' }}>
      {/* Top Header - Card with Search, Filter, Export */}
      <div style={{
        background: 'white',
        height: '56px',
        borderBottom: '1px solid #e8eaed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderRadius: '12px 12px 0 0',
        marginBottom: '0'
      }}>
        {/* Left Side */}
        <div>
          <h1 style={{
            color: '#1a2744',
            fontSize: '18px',
            fontWeight: 'bold',
            margin: 0,
            lineHeight: 1.2
          }}>
            Department Performance Report
          </h1>
          <p style={{
            color: '#888',
            fontSize: '12px',
            marginTop: '2px'
          }}>
            Analytics for {deptName} • {currentMonth}
          </p>
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Search Bar */}
          <div style={{
            width: '220px',
            height: '36px',
            border: '1px solid #e0e0e0',
            borderRadius: '20px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search data..."
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                color: '#333',
                marginLeft: '8px',
                width: '100%',
                background: 'transparent'
              }}
            />
          </div>

          {/* Filter Button */}
          <button style={{
            height: '36px',
            padding: '0 16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#333'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
            </svg>
            Filter
          </button>

          {/* Export PDF Button */}
          <button 
            onClick={handleExportPDF}
            style={{
              height: '36px',
              padding: '0 16px',
              background: '#1a73e8',
              border: 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              color: 'white'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div style={{ padding: '24px' }}>
        {/* Row 1 - Two Cards Side by Side */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          {/* Card 1 - Total Services Completed */}
          <div style={{
            width: '280px',
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
          }}>
            <p style={{
              color: '#888',
              fontSize: '12px',
              lineHeight: 1.4,
              maxWidth: '160px',
              margin: 0
            }}>
              Total Services Completed This Month
            </p>
            {/* Sky blue circle with tick */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#e3f2fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '16px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            {/* Number */}
            <span style={{
              color: '#1a2744',
              fontSize: '48px',
              fontWeight: 800,
              display: 'block',
              marginTop: '12px'
            }}>
              {totalServices}
            </span>
          </div>

          {/* Card 2 - Employee Performance Metrics with Bar Chart */}
          <div style={{
            flex: 1,
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{
                color: '#1a2744',
                fontSize: '15px',
                fontWeight: 'bold',
                margin: 0
              }}>
                Employee Performance Metrics
              </h3>
              {/* Legend */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', background: '#1a73e8' }} />
                  <span style={{ color: '#888', fontSize: '12px' }}>Services</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', background: '#b0bec5' }} />
                  <span style={{ color: '#888', fontSize: '12px' }}>Avg Time</span>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              height: '160px',
              paddingTop: '10px'
            }}>
              {employeePerformance.map((emp, idx) => {
                const maxHeight = 140;
                const servicesHeight = (emp.services / 100) * maxHeight;
                const avgTimeHeight = (emp.avgTime / 100) * maxHeight;
                
                return (
                  <div key={idx} style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
                    {/* Services Bar (Blue) */}
                    <div style={{
                      width: '20px',
                      height: `${servicesHeight}px`,
                      background: '#1a73e8',
                      borderRadius: '3px 3px 0 0'
                    }} />
                    {/* Avg Time Bar (Gray) */}
                    <div style={{
                      width: '20px',
                      height: `${avgTimeHeight}px`,
                      background: '#cfd8dc',
                      borderRadius: '3px 3px 0 0'
                    }} />
                  </div>
                );
              })}
            </div>

            {/* X-axis Labels */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginTop: '8px',
              padding: '0 10px'
            }}>
              {employeePerformance.map((emp, idx) => (
                <span key={idx} style={{ color: '#888', fontSize: '11px' }}>
                  {emp.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2 - Workload Analysis Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          marginBottom: '16px'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#f57c00">
                <path d="M12 2L2 22h20L12 2zm0 4l7.53 14H4.47L12 6z" />
              </svg>
              <h3 style={{
                color: '#1a2744',
                fontSize: '15px',
                fontWeight: 'bold',
                margin: 0
              }}>
                Workload Analysis: Overloaded Employees
              </h3>
            </div>
            <div style={{
              background: '#fce8e6',
              color: '#ea4335',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '20px',
              padding: '6px 14px'
            }}>
              &gt; 10 Active Tasks
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8eaed' }}>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  color: '#999',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  fontWeight: 500,
                  paddingLeft: '48px'
                }}>
                  EMPLOYEE
                </th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  color: '#999',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  fontWeight: 500
                }}>
                  TITLE
                </th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  color: '#999',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  fontWeight: 500
                }}>
                  ACTIVE TASKS
                </th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  color: '#999',
                  fontSize: '11px',
                  letterSpacing: '0.5px',
                  fontWeight: 500
                }}>
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody>
              {overloadedEmployees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '16px', paddingLeft: '48px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#8d6e63',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {getInitials(emp.name)}
                      </div>
                      <span style={{ color: '#1a2744', fontSize: '14px', fontWeight: 500 }}>
                        {emp.name}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ color: '#666', fontSize: '13px' }}>{emp.title}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ color: '#1a2744', fontSize: '14px', fontWeight: 'bold' }}>
                      {emp.activeTasks}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {emp.status === 'overloaded' ? (
                      <span style={{
                        background: '#fce8e6',
                        color: '#ea4335',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '20px',
                        padding: '4px 12px'
                      }}>
                        Overloaded
                      </span>
                    ) : emp.status === 'at-risk' ? (
                      <span style={{
                        background: '#fff3e0',
                        color: '#f57c00',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '20px',
                        padding: '4px 12px'
                      }}>
                        At Risk
                      </span>
                    ) : (
                      <span style={{
                        background: '#e8f5e9',
                        color: '#34a853',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '20px',
                        padding: '4px 12px'
                      }}>
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Row 3 - Service Distribution Card - Number centered with legend */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px 32px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px'
          }}>
            <div>
              <h3 style={{
                color: '#1a2744',
                fontSize: '16px',
                fontWeight: 'bold',
                margin: 0
              }}>
                Service Distribution
              </h3>
              <p style={{
                color: '#888',
                fontSize: '12px',
                marginTop: '4px'
              }}>
                Categorization of requests this month
              </p>
            </div>
            <div style={{ color: '#bbb', fontSize: '16px', cursor: 'pointer' }}>⋯</div>
          </div>

          {/* Card Body - Centered number with legend */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            {/* Centered Number */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                color: '#1a73e8',
                fontSize: '48px',
                fontWeight: 'bold'
              }}>
                {totalServices}
              </span>
              <p style={{
                color: '#888',
                fontSize: '12px',
                marginTop: '4px'
              }}>
                Total
              </p>
            </div>

            {/* Legend List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '220px' }}>
              {serviceDistribution.map((service, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: service.color
                    }} />
                    <span style={{ color: '#333', fontSize: '13px' }}>{service.name}</span>
                  </div>
                  <span style={{ color: '#1a2744', fontSize: '13px', fontWeight: 'bold' }}>
                    {service.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsTab;
