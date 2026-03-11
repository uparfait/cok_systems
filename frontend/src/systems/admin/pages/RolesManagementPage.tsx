// RolesManagementPage - Admin Role Management
// Page for managing roles and their permissions

import React, { useState, useEffect } from 'react';
import { roleService, type Role, type CreateRoleInput } from '../../../core/services/adminService';
import ConfirmModal from '../../../core/components/Modals/ConfirmModal';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { 
  FiSearch, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiShield,
  FiCheck, FiX, FiAlertCircle, FiChevronDown, FiChevronRight
} from 'react-icons/fi';

interface ResourceAction {
  action: string;
  description?: string;
  is_enabled: boolean;
}

interface ResourcePermission {
  resource_name: string;
  actions: ResourceAction[];
}

interface AvailableResource {
  resource_name: string;
  actions: Array<{
    action: string;
    description?: string;
  }>;
}

const RolesManagementPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [availableResources, setAvailableResources] = useState<AvailableResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Expanded permissions state
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  const [expandedCreateResources, setExpandedCreateResources] = useState<Set<string>>(new Set());
  const [expandedEditResources, setExpandedEditResources] = useState<Set<string>>(new Set());

  // Edit modal permissions state
  const [editSelectedPermissions, setEditSelectedPermissions] = useState<string[]>([]);

  // Load roles on mount
  useEffect(() => {
    loadRoles();
    loadAvailableResources();
  }, []);

  // Filter roles when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRoles(roles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = roles.filter(r => 
        r.role_name?.toLowerCase().includes(query)
      );
      setFilteredRoles(filtered);
    }
  }, [searchQuery, roles]);

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await roleService.getAll();
      if (response.success) {
        const rolesData = response.data || [];
        setRoles(rolesData);
        setFilteredRoles(rolesData);
      } else {
        setError(response.message || 'Failed to load roles');
      }
    } catch (err: any) {
      console.error('Error loading roles:', err);
      setError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableResources = async () => {
    try {
      const response = await roleService.getAvailableResources();
      if (response.success && response.data) {
        setAvailableResources(response.data);
      }
    } catch (err) {
      console.error('Error loading available resources:', err);
    }
  };

  const handleCreateClick = () => {
    setRoleName('');
    setSelectedPermissions([]);
    setExpandedCreateResources(new Set());
    setShowCreateModal(true);
  };

  const handleEditClick = (role: Role) => {
    setSelectedRole(role);
    setRoleName(role.role_name || '');
    
    // Load existing enabled permissions
    const existingPermissions: string[] = [];
    if (role.permissions) {
      role.permissions.forEach((resource) => {
        resource.actions.forEach((action) => {
          if (action.is_enabled) {
            // Format: resource_name:action
            existingPermissions.push(`${resource.resource_name}:${action.action}`);
          }
        });
      });
    }
    setEditSelectedPermissions(existingPermissions);
    setExpandedEditResources(new Set());
    setShowEditModal(true);
  };

  const handleDeleteClick = (role: Role) => {
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  const toggleCreatePermission = (resourceName: string, action: string) => {
    const permissionKey = `${resourceName}:${action}`;
    setSelectedPermissions(prev => {
      if (prev.includes(permissionKey)) {
        return prev.filter(p => p !== permissionKey);
      } else {
        return [...prev, permissionKey];
      }
    });
  };

  const isPermissionSelected = (resourceName: string, action: string): boolean => {
    return selectedPermissions.includes(`${resourceName}:${action}`);
  };

  const handleCreateRole = async () => {
    if (!roleName.trim()) return;
    
    setActionLoading(true);
    
    // Convert selected permissions to backend format
    // Format: [{ resource_name: "employees", actions: ["read:employees"] }]
    const permissions: CreateRoleInput['permissions'] = [];
    
    // Group selected permissions by resource
    // Format in selectedPermissions is "resource_name:action_type" (e.g., "employees:read:employees")
    const permMap = new Map<string, string[]>();
    selectedPermissions.forEach(perm => {
      // Split only at the first colon to get resource_name and the rest (action)
      const firstColonIndex = perm.indexOf(':');
      if (firstColonIndex === -1) return; // Skip invalid entries
      
      const resource_name = perm.substring(0, firstColonIndex);
      const action = perm.substring(firstColonIndex + 1);
      
      if (!permMap.has(resource_name)) {
        permMap.set(resource_name, []);
      }
      permMap.get(resource_name)!.push(action);
    });
    
    permMap.forEach((actions, resource_name) => {
      permissions.push({ resource_name, actions });
    });
    
    try {
      const response = await roleService.create({ 
        role_name: roleName.trim(),
        permissions
      });
      
      if (response.success) {
        // Toast is handled by interceptor (backend returns message)
        setShowCreateModal(false);
        setRoleName('');
        setSelectedPermissions([]);
        loadRoles();
      } else {
        showError(response.message || 'Failed to create role');
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error creating role:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole?._id || !roleName.trim()) return;
    
    setActionLoading(true);
    
    // Convert selected permissions to backend format
    const permissions: Array<{ resource_name: string; actions: string[] }> = [];
    const permMap = new Map<string, string[]>();
    
    editSelectedPermissions.forEach(perm => {
      // Split only at the first colon to get resource_name and the rest (action)
      const firstColonIndex = perm.indexOf(':');
      if (firstColonIndex === -1) return;
      
      const resource_name = perm.substring(0, firstColonIndex);
      const action = perm.substring(firstColonIndex + 1);
      
      if (!permMap.has(resource_name)) {
        permMap.set(resource_name, []);
      }
      permMap.get(resource_name)!.push(action);
    });
    
    permMap.forEach((actions, resource_name) => {
      permissions.push({ resource_name, actions });
    });
    
    try {
      const response = await roleService.update(selectedRole._id, { 
        role_name: roleName.trim(),
        permissions
      });
      
      if (response.success) {
        // Toast is handled by interceptor (backend returns message)
        setShowEditModal(false);
        setSelectedRole(null);
        setRoleName('');
        setEditSelectedPermissions([]);
        loadRoles();
      } else {
        
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error updating role:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole?._id) return;
    
    setActionLoading(true);
    
    try {
      const response = await roleService.delete(selectedRole._id);
      
      if (response.success) {
        // Toast is handled by interceptor (backend returns message)
        setShowDeleteModal(false);
        setSelectedRole(null);
        loadRoles();
      } else {
        showError(response.message || 'Failed to delete role');
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error deleting role:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePermission = async (roleId: string, resourceName: string, action: string, currentState: boolean) => {
    try {
      const response = await roleService.togglePermission(roleId, resourceName, action, !currentState);
      
      if (response.success) {
        // Toast is handled by interceptor (backend returns message)
        loadRoles();
      } else {
        showError(response.message || 'Failed to toggle permission');
      }
    } catch (err: any) {
      // Error toast is already shown by apiClient interceptor
      console.error('Error toggling permission:', err);
    }
  };

  const toggleResourceExpansion = (resourceName: string) => {
    setExpandedResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resourceName)) {
        newSet.delete(resourceName);
      } else {
        newSet.add(resourceName);
      }
      return newSet;
    });
  };

  const toggleCreateResourceExpansion = (resourceName: string) => {
    setExpandedCreateResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resourceName)) {
        newSet.delete(resourceName);
      } else {
        newSet.add(resourceName);
      }
      return newSet;
    });
  };

  const toggleEditResourceExpansion = (resourceName: string) => {
    setExpandedEditResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resourceName)) {
        newSet.delete(resourceName);
      } else {
        newSet.add(resourceName);
      }
      return newSet;
    });
  };

  const toggleEditPermission = (resourceName: string, action: string) => {
    const permissionKey = `${resourceName}:${action}`;
    setEditSelectedPermissions(prev => {
      if (prev.includes(permissionKey)) {
        return prev.filter(p => p !== permissionKey);
      } else {
        return [...prev, permissionKey];
      }
    });
  };

  const isEditPermissionSelected = (resourceName: string, action: string): boolean => {
    return editSelectedPermissions.includes(`${resourceName}:${action}`);
  };

  // Select all permissions for create modal
  const selectAllCreatePermissions = () => {
    const allPermissions: string[] = [];
    availableResources.forEach(resource => {
      resource.actions.forEach(action => {
        allPermissions.push(`${resource.resource_name}:${action.action}`);
      });
    });
    setSelectedPermissions(allPermissions);
  };

  // Deselect all permissions for create modal
  const deselectAllCreatePermissions = () => {
    setSelectedPermissions([]);
  };

  // Select all permissions for a specific resource (create modal)
  const selectAllCreateResourcePermissions = (resourceName: string) => {
    const resource = availableResources.find(r => r.resource_name === resourceName);
    if (!resource) return;
    
    setSelectedPermissions(prev => {
      const newPermissions = [...prev];
      resource.actions.forEach(action => {
        const permKey = `${resourceName}:${action.action}`;
        if (!newPermissions.includes(permKey)) {
          newPermissions.push(permKey);
        }
      });
      return newPermissions;
    });
  };

  // Deselect all permissions for a specific resource (create modal)
  const deselectAllCreateResourcePermissions = (resourceName: string) => {
    setSelectedPermissions(prev => prev.filter(p => !p.startsWith(`${resourceName}:`)));
  };

  // Select all permissions for edit modal
  const selectAllEditPermissions = () => {
    const allPermissions: string[] = [];
    availableResources.forEach(resource => {
      resource.actions.forEach(action => {
        allPermissions.push(`${resource.resource_name}:${action.action}`);
      });
    });
    setEditSelectedPermissions(allPermissions);
  };

  // Deselect all permissions for edit modal
  const deselectAllEditPermissions = () => {
    setEditSelectedPermissions([]);
  };

  // Select all permissions for a specific resource (edit modal)
  const selectAllEditResourcePermissions = (resourceName: string) => {
    const resource = availableResources.find(r => r.resource_name === resourceName);
    if (!resource) return;
    
    setEditSelectedPermissions(prev => {
      const newPermissions = [...prev];
      resource.actions.forEach(action => {
        const permKey = `${resourceName}:${action.action}`;
        if (!newPermissions.includes(permKey)) {
          newPermissions.push(permKey);
        }
      });
      return newPermissions;
    });
  };

  // Deselect all permissions for a specific resource (edit modal)
  const deselectAllEditResourcePermissions = (resourceName: string) => {
    setEditSelectedPermissions(prev => prev.filter(p => !p.startsWith(`${resourceName}:`)));
  };

  const getPermissionsCount = (permissions?: ResourcePermission[]) => {
    if (!permissions) return 0;
    return permissions.reduce((count, resource) => {
      return count + resource.actions.filter(a => a.is_enabled).length;
    }, 0);
  };

  return (
    <MainLayout>
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FiShield className="w-7 h-7" />
          Roles Management
        </h1>
        <p className="text-gray-600 mt-1">
          Create, edit, and manage roles with their permissions
        </p>
      </div>

      {/* Search and Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadRoles}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiPlus className="w-4 h-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <FiAlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Roles List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="flex justify-center items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-gray-500">Loading roles...</span>
            </div>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            {searchQuery ? 'No roles found matching your search' : 'No roles available. Create your first role to get started.'}
          </div>
        ) : (
          filteredRoles.map((role) => (
            <div key={role._id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Role Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <FiShield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{role.role_name}</h3>
                    <p className="text-sm text-gray-500">
                      {getPermissionsCount(role.permissions as ResourcePermission[])} permissions enabled
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditClick(role)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                  >
                    <FiEdit2 className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(role)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
                  >
                    <FiTrash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Permissions List */}
              {role.permissions && role.permissions.length > 0 && (
                <div className="p-4 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Permissions</h4>
                  <div className="space-y-2">
                    {(role.permissions as ResourcePermission[]).map((permission) => {
                      const enabledCount = permission.actions.filter(a => a.is_enabled).length;
                      const isExpanded = expandedResources.has(permission.resource_name);
                      
                      return (
                        <div key={permission.resource_name} className="bg-white rounded border border-gray-200">
                          {/* Resource Header */}
                          <button
                            onClick={() => toggleResourceExpansion(permission.resource_name)}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <FiChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <FiChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                              <span className="font-medium text-gray-900">{permission.resource_name}</span>
                              <span className="text-xs text-gray-500">
                                ({enabledCount}/{permission.actions.length} enabled)
                              </span>
                            </div>
                          </button>
                          
                          {/* Actions */}
                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-gray-100">
                              <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {permission.actions.map((action) => (
                                  <div
                                    key={action.action}
                                    className="flex items-center justify-between p-2 rounded bg-gray-50"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {action.action}
                                      </p>
                                      {action.description && (
                                        <p className="text-xs text-gray-500 truncate">
                                          {action.description}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => handleTogglePermission(
                                        role._id!, 
                                        permission.resource_name, 
                                        action.action, 
                                        action.is_enabled
                                      )}
                                      className={`ml-2 p-1.5 rounded-full ${
                                        action.is_enabled 
                                          ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                      }`}
                                      title={action.is_enabled ? 'Disable permission' : 'Enable permission'}
                                    >
                                      {action.is_enabled ? (
                                        <FiCheck className="w-3 h-3" />
                                      ) : (
                                        <FiX className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredRoles.length} of {roles.length} roles
      </div>

      {/* Create Role Modal with Permission Selection */}
      <ConfirmModal
        isOpen={showCreateModal}
        onCancel={() => {
          setShowCreateModal(false);
          setRoleName('');
          setSelectedPermissions([]);
        }}
        onConfirm={handleCreateRole}
        title="Create New Role"
        message={
          <div className="py-2 max-h-96 overflow-y-auto">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Name
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Enter role name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Permissions ({selectedPermissions.length} selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllCreatePermissions}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllCreatePermissions}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {availableResources.map((resource) => {
                  const isExpanded = expandedCreateResources.has(resource.resource_name);
                  const selectedCount = resource.actions.filter(a => 
                    isPermissionSelected(resource.resource_name, a.action)
                  ).length;
                  
                  return (
                    <div key={resource.resource_name} className="bg-gray-50 rounded border border-gray-200">
                      <button
                        type="button"
                        onClick={() => toggleCreateResourceExpansion(resource.resource_name)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <FiChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <FiChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900">{resource.resource_name}</span>
                          {selectedCount > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {selectedCount}
                            </span>
                          )}
                        </div>
                        {!isExpanded && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllCreateResourcePermissions(resource.resource_name);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-2"
                          >
                            Select All
                          </button>
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-gray-200">
                          <div className="pt-2 flex justify-end gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() => selectAllCreateResourcePermissions(resource.resource_name)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => deselectAllCreateResourcePermissions(resource.resource_name)}
                              className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                            >
                              Deselect All
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {resource.actions.map((action) => (
                              <label
                                key={action.action}
                                className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isPermissionSelected(resource.resource_name, action.action)}
                                  onChange={() => toggleCreatePermission(resource.resource_name, action.action)}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  {action.description && (
                                    <p className="text-xs text-gray-500">{action.description}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        }
        confirmText={actionLoading ? 'Creating...' : 'Create Role'}
        cancelText="Cancel"
        type="info"
        isLoading={actionLoading}
      />

      {/* Edit Role Modal */}
      <ConfirmModal
        isOpen={showEditModal}
        onCancel={() => {
          setShowEditModal(false);
          setSelectedRole(null);
          setRoleName('');
          setEditSelectedPermissions([]);
        }}
        onConfirm={handleUpdateRole}
        title="Edit Role"
        message={
          <div className="py-2 max-h-96 overflow-y-auto text-left">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Name
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Enter role name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Select Permissions ({editSelectedPermissions.length} selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllEditPermissions}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllEditPermissions}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {availableResources.map((resource) => {
                  const isExpanded = expandedEditResources.has(resource.resource_name);
                  const selectedCount = resource.actions.filter(a => 
                    isEditPermissionSelected(resource.resource_name, a.action)
                  ).length;
                  
                  return (
                    <div key={resource.resource_name} className="bg-gray-50 rounded border border-gray-200">
                      <button
                        type="button"
                        onClick={() => toggleEditResourceExpansion(resource.resource_name)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <FiChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <FiChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900">{resource.resource_name}</span>
                          {selectedCount > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {selectedCount}
                            </span>
                          )}
                        </div>
                        {!isExpanded && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllEditResourcePermissions(resource.resource_name);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-2"
                          >
                            Select All
                          </button>
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-gray-200">
                          <div className="pt-2 flex justify-end gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() => selectAllEditResourcePermissions(resource.resource_name)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Select All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => deselectAllEditResourcePermissions(resource.resource_name)}
                              className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                            >
                              Deselect All
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {resource.actions.map((action) => (
                              <label
                                key={action.action}
                                className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isEditPermissionSelected(resource.resource_name, action.action)}
                                  onChange={() => toggleEditPermission(resource.resource_name, action.action)}
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  {action.description && (
                                    <p className="text-xs text-gray-500">{action.description}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        }
        confirmText={actionLoading ? 'Updating...' : 'Update Role'}
        cancelText="Cancel"
        type="info"
        isLoading={actionLoading}
      />

      {/* Delete Role Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedRole(null);
        }}
        onConfirm={handleDeleteRole}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${selectedRole?.role_name}"? This action cannot be undone.`}
        confirmText={actionLoading ? 'Deleting...' : 'Delete Role'}
        cancelText="Cancel"
        type="danger"
        isLoading={actionLoading}
      />
    </div>
    </MainLayout>
  );
};

export default RolesManagementPage;
