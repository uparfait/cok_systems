import React, { useState, useEffect } from 'react';
import { roleService, type Role } from '../../../core/services/adminService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import { FiSearch, FiRefreshCw, FiShield, FiLoader } from 'react-icons/fi';
import { Spinner } from '@/components/ui/spinner';
import LoadingSpinner from './sub/LoadingSpinner';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const RolesManagementPage: React.FC = () => {
  const { showError } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    setFilteredRoles(
      searchQuery.trim()
        ? roles.filter(r => r.role_name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : roles
    );
  }, [searchQuery, roles]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const r = await roleService.getAll();
      if (r.success) {
        setRoles(r.data || []);
        setFilteredRoles(r.data || []);
      } else {
        setError(r.message || 'Failed to load roles');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      showError(err.message || 'Failed to load roles');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  const getPermissionCount = (role: Role) => {
    return role.permissions?.reduce(
      (count, r: any) => count + r.actions.filter((a: any) => a.is_enabled).length,
      0
    ) || 0;
  };

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FiShield className="w-5 h-5" />
            Roles Management
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">View all available roles and their permissions</p>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 cok-auth-input"
            />
          </div>
          <button
            onClick={loadRoles}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 cok-btn-outlined text-sm"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && !loading && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 rounded-md">
            <FiShield className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          {(loading && firstLoad) ? (
            <div className="bg-white border-2 border-[#056daa] p-8 text-center">
              <SpiralLoader />
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="bg-white border-2 border-[#056daa] p-8 text-center text-sm text-gray-500">
              {searchQuery ? 'No roles found matching your search' : 'No roles available'}
            </div>
          ) : (
            filteredRoles.map(role => (
              <div key={role._id} className="bg-white border-2 border-[#056daa] overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FiShield className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{role.role_name}</h3>

                    </div>
                  </div>
                </div>

                {role.permissions && role.permissions.length > 0 && (
                  <div className="p-4 bg-gray-50">
                    <h4 className="text-xs font-medium text-gray-700 mb-3">Permissions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(role.permissions as any[]).map(p => {
                        const enabledActions = p.actions.filter((a: any) => a.is_enabled);
                        if (enabledActions.length === 0) return null;
                        
                        return (
                          <div key={p.resource_name} className="bg-white border border-gray-200 rounded-md p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-gray-900">{p.resource_name}</span>
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {enabledActions.length}/{p.actions.length}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {enabledActions.map((a: any) => (
                                <span
                                  key={a.action}
                                  className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200"
                                >
                                  {a.action}
                                </span>
                              ))}
                            </div>
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

        <div className="mt-3 text-xs text-gray-500">
          Showing {filteredRoles.length} of {roles.length} roles
        </div>
      </div>
    </MainLayout>
  );
};

export default RolesManagementPage;