# Service Delivery - Refactoring TODO

## Files Over 500 Lines (Need Splitting)
- [ ] **ProvideServicesTab.tsx** (1223 lines) - Split into sub-components
- [ ] **EmployeeModals.tsx** (1005 lines) - Split into sub-components
- [ ] **AssignedVisitorsList.tsx** (615 lines) - Split into sub-components

## Global Styling Changes
- [ ] Set all border-radius to 0 (remove rounded corners)
- [ ] Reduce oversized font sizes for better UI/UX
- [ ] Make all pages responsive
- [ ] Ensure all tables have blue titled header color (bg-blue-50)
- [ ] Standardize loading components across all files
- [ ] Ensure overlay modals have height based on screen height

## Per-File Review
- [ ] ServiceDeliveryDashboard.tsx - Review & fix
- [ ] DepartmentManagerDashboard.tsx - Review & fix
- [ ] EmployeeDashboard.tsx - Review & fix
- [ ] ReceptionistDashboard.tsx - Review & fix
- [ ] VisitorDetailsPage.tsx - Review & fix
- [ ] All departmentFlow components - Review & fix
- [ ] All employeeFlow components - Review & fix
- [ ] All shared components - Review & fix
- [ ] All tab components - Review & fix
- [ ] All sub components - Review & fix

## Verification
- [ ] TypeScript compilation check (no errors)
- [ ] Verify all imports are correct