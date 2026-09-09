import React, { useState, useEffect, useMemo } from 'react';
import { roleService, type Role, type RoleNavLink } from '../../../core/services/adminService';
import { navigationCatalogService, type NavLink } from '../../../core/services/navigationService';
import MainLayout from '../../../core/components/Layout/MainLayout';
import { useToast } from '../../../core/contexts/ToastContext';
import {
  FiSearch, FiRefreshCw, FiShield, FiLock, FiPlus, FiEdit2, FiTrash2,
  FiChevronDown, FiChevronRight, FiX,
} from 'react-icons/fi';
import SpiralLoader from '@/systems/event-managment/components/SpiralLoader';

const PRIMARY = '#056daa';
const DANGER = '#E74C3C';
const BORDER = '#E0E0E0';
const fontHeading = "'Montserrat', sans-serif";

interface DefaultRole {
  role_name: string;
  role_slug: string;
  default_route: string;
  links: NavLink[];
}

// Selection state while creating/editing a custom role: which catalog links
// (and which of their children) are toggled on
type Selection = Record<string, { on: boolean; children: Record<string, boolean> }>;

const backendMsg = (err: any, fallback: string) =>
  err?.message || err?.error || fallback;

function selectionFromCatalog(catalog: NavLink[], existing?: RoleNavLink[]): Selection {
  const sel: Selection = {};
  const existingMap = new Map((existing || []).map((e) => [e.id, e]));
  catalog.forEach((link) => {
    const found = existingMap.get(link.id);
    const children: Record<string, boolean> = {};
    (link.children || []).forEach((c) => {
      children[c.id] = found
        ? !found.children || found.children.includes(c.id)
        : true;
    });
    sel[link.id] = {
      on: existing ? !!found : !!(link as any).default_enabled,
      children,
    };
  });
  return sel;
}

function selectionToNavLinks(catalog: NavLink[], sel: Selection): RoleNavLink[] {
  const links: RoleNavLink[] = [];
  catalog.forEach((link) => {
    const s = sel[link.id];
    if (!s?.on) return;
    const allChildren = (link.children || []).map((c) => c.id);
    const chosen = allChildren.filter((cid) => s.children[cid]);
    if (allChildren.length > 0 && chosen.length === 0) return; // group with nothing inside
    links.push(
      allChildren.length > 0 && chosen.length < allChildren.length
        ? { id: link.id, children: chosen }
        : { id: link.id },
    );
  });
  return links;
}

// Read-only links tree used on both Default and Other role cards
const LinksTree: React.FC<{ links: NavLink[] }> = ({ links }) => (
  <div className="flex flex-col gap-1">
    {links.map((link) => (
      <div key={link.id}>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-gray-900">{link.label}</span>
          <span className="text-gray-400">{link.path}</span>
        </div>
        {(link.children || []).length > 0 && (
          <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
            {(link.children || []).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-gray-700">{c.label}</span>
                <span className="text-gray-400">{c.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; bg: string; color: string }> = ({ children, bg, color }) => (
  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: bg, color, fontFamily: fontHeading }}>
    {children}
  </span>
);

const RolesManagementPage: React.FC = () => {
  const { showError, showSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<'default' | 'other'>('default');
  const [defaultRoles, setDefaultRoles] = useState<DefaultRole[]>([]);
  const [catalog, setCatalog] = useState<NavLink[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Create / edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [selection, setSelection] = useState<Selection>({});
  const [defaultRoute, setDefaultRoute] = useState('/calendar');
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [defaultsRes, catalogRes, rolesRes] = await Promise.all([
        navigationCatalogService.getDefaults(),
        navigationCatalogService.getLinksCatalog(),
        roleService.getAll(),
      ]);
      if (defaultsRes?.success) setDefaultRoles(defaultsRes.data?.roles || []);
      if (catalogRes?.success) setCatalog(catalogRes.data?.links || []);
      if (rolesRes?.success) setRoles(rolesRes.data || []);
      if (!defaultsRes?.success) showError(defaultsRes?.message || 'The default roles could not be loaded');
    } catch (err: any) {
      showError(backendMsg(err, 'The roles could not be loaded. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const otherRoles = useMemo(
    () => roles.filter((r) => !r.is_default_tied),
    [roles],
  );

  const visibleOtherRoles = useMemo(
    () => (searchQuery.trim()
      ? otherRoles.filter((r) => r.role_name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : otherRoles),
    [otherRoles, searchQuery],
  );

  const visibleDefaults = useMemo(
    () => (searchQuery.trim()
      ? defaultRoles.filter((r) => r.role_name.toLowerCase().includes(searchQuery.toLowerCase()))
      : defaultRoles),
    [defaultRoles, searchQuery],
  );

  // Options for the "where does this role land after login" select:
  // every toggled link and child, plus the calendar
  const routeOptions = useMemo(() => {
    const opts: Array<{ label: string; path: string }> = [];
    catalog.forEach((link) => {
      const s = selection[link.id];
      if (!s?.on) return;
      opts.push({ label: link.label, path: link.path });
      (link.children || []).forEach((c) => {
        if (s.children[c.id]) opts.push({ label: `${link.label} - ${c.label}`, path: c.path });
      });
    });
    if (!opts.some((o) => o.path === '/calendar')) opts.unshift({ label: 'Calender', path: '/calendar' });
    return opts;
  }, [catalog, selection]);

  useEffect(() => {
    if (!routeOptions.some((o) => o.path === defaultRoute)) setDefaultRoute('/calendar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOptions]);

  const openCreate = () => {
    setEditingRole(null);
    setRoleName('');
    setSelection(selectionFromCatalog(catalog));
    setDefaultRoute('/calendar');
    setFormOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.role_name);
    setSelection(selectionFromCatalog(catalog, role.nav_links && role.nav_links.length > 0 ? role.nav_links : undefined));
    setDefaultRoute(role.default_route || '/calendar');
    setFormOpen(true);
  };

  const toggleLink = (id: string) => {
    setSelection((prev) => ({ ...prev, [id]: { ...prev[id], on: !prev[id]?.on } }));
  };

  const toggleChild = (id: string, childId: string) => {
    setSelection((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        children: { ...prev[id]?.children, [childId]: !prev[id]?.children?.[childId] },
      },
    }));
  };

  const handleSave = async () => {
    const name = roleName.trim();
    if (!name) { showError('Role name is required'); return; }
    const nav_links = selectionToNavLinks(catalog, selection);
    if (nav_links.length === 0) { showError('Select at least one link for this role'); return; }
    setSaving(true);
    try {
      const res = editingRole?._id
        ? await roleService.update(editingRole._id, { role_name: name !== editingRole.role_name ? name : undefined, nav_links, default_route: defaultRoute })
        : await roleService.create({ role_name: name, permissions: [], nav_links, default_route: defaultRoute });
      if (res?.success) {
        showSuccess(res.message || (editingRole ? 'Role updated successfully' : 'Role created successfully'));
        setFormOpen(false);
        await load();
      } else {
        showError(res?.message || 'The role could not be saved');
      }
    } catch (err: any) {
      showError(backendMsg(err, 'The role could not be saved. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    setDeleting(true);
    try {
      const res = await roleService.delete(deleteTarget._id);
      if (res?.success) {
        showSuccess(res.message || 'Role deleted successfully');
        setDeleteTarget(null);
        await load();
      } else {
        showError(res?.message || 'The role could not be deleted');
      }
    } catch (err: any) {
      showError(backendMsg(err, 'The role could not be deleted. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  // Resolve a custom role's stored nav_links into displayable links
  const resolveRoleLinks = (role: Role): NavLink[] => {
    const byId = new Map(catalog.map((l) => [l.id, l]));
    const out: NavLink[] = [];
    (role.nav_links || []).forEach((entry) => {
      const link = byId.get(entry.id);
      if (!link) return;
      const children = entry.children
        ? (link.children || []).filter((c) => entry.children!.includes(c.id))
        : link.children || [];
      out.push({ ...link, children });
    });
    return out;
  };

  const tabBtn = (key: 'default' | 'other', label: string, count: number) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      className="px-4 py-2 text-sm font-semibold cursor-pointer"
      style={{
        fontFamily: fontHeading,
        color: activeTab === key ? '#FFFFFF' : '#333333',
        backgroundColor: activeTab === key ? PRIMARY : 'transparent',
        border: `1px solid ${activeTab === key ? PRIMARY : BORDER}`,
      }}
    >
      {label} ({count})
    </button>
  );

  return (
    <MainLayout>
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-base font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: fontHeading }}>
            <FiShield className="w-5 h-5" />
            Roles Management
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">
            Default roles are unchangeable. Other roles can be created with their own sidebar links and landing page.
          </p>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="flex items-center gap-2">
            {tabBtn('default', 'Default Roles', defaultRoles.length)}
            {tabBtn('other', 'Other Roles', otherRoles.length)}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 pl-8 pr-3 py-1.5 cok-auth-input"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 cok-btn-outlined text-sm cursor-pointer disabled:opacity-50"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {activeTab === 'other' && (
              <button
                onClick={openCreate}
                disabled={loading || catalog.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 cok-btn-primary text-sm cursor-pointer disabled:opacity-50"
                style={{ width: 'auto' }}
              >
                <FiPlus className="w-3.5 h-3.5" />
                Create Role
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-8 text-center" style={{ border: `1px solid ${BORDER}` }}>
            <SpiralLoader />
          </div>
        ) : activeTab === 'default' ? (
          <div className="space-y-3">
            {visibleDefaults.length === 0 ? (
              <div className="bg-white p-8 text-center text-sm text-gray-500" style={{ border: `1px solid ${BORDER}` }}>
                {searchQuery ? 'No default roles match your search' : 'No default roles found. Restart the main backend to load Default_Roles.json.'}
              </div>
            ) : visibleDefaults.map((role) => (
              <div key={role.role_slug} className="bg-white" style={{ border: `1px solid ${BORDER}` }}>
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [role.role_slug]: !p[role.role_slug] }))}
                  className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-[#F7F9FB] text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
                      <FiLock className="w-5 h-5" style={{ color: PRIMARY }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900" style={{ fontFamily: fontHeading }}>{role.role_name}</h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Chip bg="rgba(51,51,51,0.08)" color="#555555">Default - unchangeable</Chip>
                        <Chip bg="rgba(5,109,170,0.1)" color={PRIMARY}>/{role.role_slug}</Chip>
                        <Chip bg="rgba(51,51,51,0.08)" color="#555555">Lands on {role.default_route}</Chip>
                      </div>
                    </div>
                  </div>
                  {expanded[role.role_slug]
                    ? <FiChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                    : <FiChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                </button>
                {expanded[role.role_slug] && (
                  <div className="p-4 bg-gray-50" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Links ({role.links.length})</h4>
                    <LinksTree links={role.links} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOtherRoles.length === 0 ? (
              <div className="bg-white p-8 text-center text-sm text-gray-500" style={{ border: `1px solid ${BORDER}` }}>
                {searchQuery ? 'No roles match your search' : 'No other roles yet. Create one to give it its own sidebar links.'}
              </div>
            ) : visibleOtherRoles.map((role) => {
              const configured = (role.nav_links || []).length > 0;
              const links = resolveRoleLinks(role);
              const key = role._id || role.role_name;
              return (
                <div key={key} className="bg-white" style={{ border: `1px solid ${BORDER}` }}>
                  <div className="p-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
                      className="flex items-center gap-3 cursor-pointer text-left flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(5,109,170,0.1)' }}>
                        <FiShield className="w-5 h-5" style={{ color: PRIMARY }} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate" style={{ fontFamily: fontHeading }}>{role.role_name}</h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Chip bg="rgba(5,109,170,0.1)" color={PRIMARY}>/{role.role_slug}</Chip>
                          {configured ? (
                            <>
                              <Chip bg="rgba(76,175,80,0.12)" color="#388E3C">{links.length} link{links.length === 1 ? '' : 's'}</Chip>
                              <Chip bg="rgba(51,51,51,0.08)" color="#555555">Lands on {role.default_route || '/calendar'}</Chip>
                            </>
                          ) : (
                            <Chip bg="rgba(243,156,18,0.15)" color="#B9770E">No links configured yet</Chip>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" title="Edit links" onClick={() => openEdit(role)} className="p-2 cursor-pointer hover:bg-[#F7F9FB]" style={{ color: PRIMARY }}>
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button type="button" title="Delete role" onClick={() => setDeleteTarget(role)} className="p-2 cursor-pointer hover:bg-[#F7F9FB]" style={{ color: DANGER }}>
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {expanded[key] && configured && (
                    <div className="p-4 bg-gray-50" style={{ borderTop: `1px solid ${BORDER}` }}>
                      <h4 className="text-xs font-medium text-gray-700 mb-2">Links</h4>
                      <LinksTree links={links} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / edit role */}
      {formOpen && (
        <div className="fixed inset-0 z-[999999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-4 py-3 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: PRIMARY }}>
              <span className="text-sm font-bold" style={{ fontFamily: fontHeading }}>
                {editingRole ? `Edit Role - ${editingRole.role_name}` : 'Create New Role'}
              </span>
              <button type="button" onClick={() => setFormOpen(false)} className="p-1 cursor-pointer hover:opacity-80">
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-gray-700" style={{ fontFamily: fontHeading }}>
                Role name
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Auditor"
                className="w-full cok-auth-input py-2 text-sm mb-4"
                style={{ paddingLeft: '12px' }}
              />

              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1 text-gray-700" style={{ fontFamily: fontHeading }}>
                Links this role can see
              </p>
              <p className="text-xs text-gray-500 mb-2">
                Only shared links are listed. Links tied to a specific default role (visitors, my employees, role dashboards and similar) cannot be assigned here.
              </p>
              <div className="mb-4" style={{ border: `1px solid ${BORDER}` }}>
                {catalog.map((link, i) => {
                  const s = selection[link.id];
                  return (
                    <div key={link.id} className="px-3 py-2" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : 'none' }}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!s?.on}
                          onChange={() => toggleLink(link.id)}
                          className="cursor-pointer"
                        />
                        <span className="text-sm font-medium text-gray-900">{link.label}</span>
                        <span className="text-xs text-gray-400">{link.path}</span>
                      </label>
                      {s?.on && (link.children || []).length > 0 && (
                        <div className="ml-6 mt-1 flex flex-col gap-1">
                          {(link.children || []).map((c) => (
                            <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!s.children[c.id]}
                                onChange={() => toggleChild(link.id, c.id)}
                                className="cursor-pointer"
                              />
                              <span className="text-xs text-gray-700">{c.label}</span>
                              <span className="text-[11px] text-gray-400">{c.path}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-gray-700" style={{ fontFamily: fontHeading }}>
                Where users with this role land after login
              </label>
              <select
                value={defaultRoute}
                onChange={(e) => setDefaultRoute(e.target.value)}
                className="w-full cok-auth-input py-2 text-sm cursor-pointer"
                style={{ paddingLeft: '12px' }}
              >
                {routeOptions.map((o) => (
                  <option key={o.path} value={o.path}>{o.label} ({o.path})</option>
                ))}
              </select>
            </div>

            <div className="px-4 py-3 flex gap-3 justify-end shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="cok-btn-outlined cursor-pointer disabled:opacity-50" style={{ padding: '0.5rem 1.2rem' }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="cok-btn-primary cursor-pointer disabled:opacity-60 inline-flex items-center gap-2" style={{ width: 'auto', padding: '0.5rem 1.4rem' }}>
                {saving && <SpiralLoader color="#FFFFFF" padded={false} size={16} />}
                {saving ? 'Saving...' : (editingRole ? 'Save Changes' : 'Create Role')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[999999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm p-5" style={{ border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold text-base mb-2 text-gray-900" style={{ fontFamily: fontHeading }}>Delete Role</h3>
            <p className="text-sm mb-5 text-gray-600">
              Delete the role <span className="font-semibold text-gray-900">"{deleteTarget.role_name}"</span>?
              Users still holding this role will fall back to a calendar-only sidebar.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="cok-btn-outlined flex-1 cursor-pointer disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="cok-btn-outlined-danger flex-1 cursor-pointer disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default RolesManagementPage;
