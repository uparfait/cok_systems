// The event-management pages are mounted under /:roleSlug, so links between
// them must keep whatever slug the user is browsing under (event-manager by
// default, or a custom role's slug).
export const roleBase = () => {
  const first = window.location.pathname.split('/')[1];
  return `/${first || 'event-manager'}`;
};
