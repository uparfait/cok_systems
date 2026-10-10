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
  onDelete: () => void | Promise<void>;
}

const initialsOf = (name?: string) => (name || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();

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
  const convertToDepartmentEmployee = (emp: Employee | null): DepartmentEmployee | null => {
    if (!emp) return null;
    return {
      id: emp.id,
      empId: emp.id,
      name: emp.name,
      email: emp.email,
      title: emp.role,
      status: emp.status === 'available' ? 'Active' : 'Away',
      initials: emp.initials || initialsOf(emp.name),
      phone: emp.phone,
      department: emp.department,
    };
  };

  const departmentEmployee = convertToDepartmentEmployee(selectedEmployee);

  const handleEditSave = (updated: DepartmentEmployee) => {
    if (!selectedEmployee) return;
    onSave({
      ...selectedEmployee,
      name: updated.name,
      role: updated.title,
      email: updated.email,
      initials: initialsOf(updated.name) || selectedEmployee.initials,
    });
  };

  const handleAdd = (added: { name: string; email: string; title: string; phone: string; gender: string; department: string }) => {
    onSave({
      id: Date.now().toString(),
      name: added.name,
      email: added.email,
      phone: added.phone,
      role: added.title || 'Staff',
      department: added.department,
      status: 'available',
      initials: initialsOf(added.name) || 'NE',
    });
  };

  const handleDelete = async () => {
    await onDelete();
  };

  return (
    <>
      <ViewEmployeeModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        employee={departmentEmployee}
      />

      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        employee={departmentEmployee}
        onSave={handleEditSave}
      />

      <DeleteEmployeeModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        employee={departmentEmployee}
        onDelete={handleDelete}
      />

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </>
  );
};

export default EmployeeModalsWrapper;
