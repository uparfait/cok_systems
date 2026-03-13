// Employee Modals Wrapper Component
// This component combines all employee modals and manages their state

import { useState, useEffect } from "react";
import { ViewEmployeeModal, EditEmployeeModal, DeleteEmployeeModal, AddEmployeeModal } from "./EmployeeModals";

interface DepartmentEmployee {
  id: string;
  empId: string;
  name: string;
  email: string;
  title: string;
  status: 'Active' | 'Away';
  initials: string;
  phone?: string;
  department?: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: 'available' | 'busy' | 'off';
  email: string;
  phone: string;
  avatar?: string;
  initials?: string;
}

interface EmployeeModalsWrapperProps {
  showViewModal: boolean;
  showEditModal: boolean;
  showDeleteModal: boolean;
  showAddModal: boolean;
  selectedEmployee: Employee | null;
  setShowViewModal: (show: boolean) => void;
  setShowEditModal: (show: boolean) => void;
  setShowDeleteModal: (show: boolean) => void;
  setShowAddModal: (show: boolean) => void;
  onSave: (employee: Employee) => void;
  onDelete: () => void;
}

export const EmployeeModalsWrapper: React.FC<EmployeeModalsWrapperProps> = ({
  showViewModal,
  showEditModal,
  showDeleteModal,
  showAddModal,
  selectedEmployee,
  setShowViewModal,
  setShowEditModal,
  setShowDeleteModal,
  setShowAddModal,
  onSave,
  onDelete,
}) => {
  // Local state for editing
  const [editFormData, setEditFormData] = useState<Partial<Employee>>({});
  const [addFormData, setAddFormData] = useState<Partial<Employee>>({});

  // Initialize edit form when modal opens
  useEffect(() => {
    if (showEditModal && selectedEmployee) {
      setEditFormData({
        name: selectedEmployee.name,
        email: selectedEmployee.email,
        phone: selectedEmployee.phone,
        role: selectedEmployee.role,
        department: selectedEmployee.department,
        status: selectedEmployee.status,
      });
    }
  }, [showEditModal, selectedEmployee]);

  // Initialize add form when modal opens
  useEffect(() => {
    if (showAddModal) {
      setAddFormData({
        name: '',
        email: '',
        phone: '',
        role: 'Staff',
        department: 'Service Delivery',
        status: 'available',
      });
    }
  }, [showAddModal]);

  // Convert Employee to DepartmentEmployee for modal
  const convertToDepartmentEmployee = (emp: Employee | null): DepartmentEmployee | null => {
    if (!emp) return null;
    return {
      id: emp.id,
      empId: emp.id,
      name: emp.name,
      email: emp.email,
      title: emp.role,
      status: emp.status === 'available' ? 'Active' : 'Away',
      initials: emp.initials || emp.name.split(' ').map(n => n[0]).join('').toUpperCase(),
      phone: emp.phone,
      department: emp.department,
    };
  };

  const departmentEmployee = convertToDepartmentEmployee(selectedEmployee);

  // Handle edit save
  const handleEditSave = () => {
    if (selectedEmployee && editFormData) {
      onSave({
        ...selectedEmployee,
        ...editFormData,
        initials: editFormData.name?.split(' ').map(n => n[0]).join('').toUpperCase(),
      } as Employee);
      setShowEditModal(false);
    }
  };

  // Handle add save
  const handleAddSave = () => {
    if (addFormData.name && addFormData.email) {
      const newEmployee: Employee = {
        id: Date.now().toString(),
        name: addFormData.name || '',
        email: addFormData.email || '',
        phone: addFormData.phone || '',
        role: addFormData.role || 'Staff',
        department: addFormData.department || 'Service Delivery',
        status: addFormData.status || 'available',
        initials: addFormData.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'NE',
      };
      onSave(newEmployee);
      setShowAddModal(false);
    }
  };

  return (
    <>
      {/* View Modal */}
      <ViewEmployeeModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        employee={departmentEmployee}
      />

      {/* Edit Modal */}
      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        employee={departmentEmployee}
        onSave={(employee) => {
          console.log('Save employee:', employee);
          setShowEditModal(false);
        }}
      />

      {/* Delete Modal */}
      <DeleteEmployeeModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        employee={departmentEmployee}
        onDelete={() => {
          console.log('Delete employee');
          setShowDeleteModal(false);
        }}
      />

      {/* Add Modal */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(employee) => {
          console.log('Add employee:', employee);
          setShowAddModal(false);
        }}
      />
    </>
  );
};

export default EmployeeModalsWrapper;
