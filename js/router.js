const VALID_ROUTES = new Set(['dashboard', 'lancamentos', 'categorias', 'contas', 'usuarios', 'relatorios', 'config']);

export function normalizeRoute(hashValue) {
  const raw = (hashValue || '').replace('#', '').trim().toLowerCase();
  if (!raw || !VALID_ROUTES.has(raw)) return 'dashboard';
  return raw;
}

export function getRouteFromHash() {
  return normalizeRoute(window.location.hash);
}

export function navigate(route) {
  const normalized = normalizeRoute(route);
  window.location.hash = normalized;
}

export function initRouter(onRouteChange) {
  const dispatch = () => onRouteChange(getRouteFromHash());

  window.addEventListener('hashchange', dispatch);

  if (!window.location.hash) {
    window.location.hash = 'dashboard';
  } else {
    dispatch();
  }

  return () => {
    window.removeEventListener('hashchange', dispatch);
  };
}
