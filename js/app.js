import { isSupabaseConfigured } from './supabaseClient.js';
import { getSessionUser, onAuthStateChange, signInWithEmail, signOutUser } from './auth.js';
import {
  createAccount,
  createCategory,
  createDefaultAccounts,
  createDefaultCategories,
  createTransaction,
  createUserByAdmin,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  getMyProfile,
  listAccounts,
  listCategories,
  listTransactionsByMonth,
  listUsers,
  updateAccount,
  updateCategory,
  updateTransaction,
  updateUserRole,
} from './api.js';
import { createDashboard } from './dashboard.js';
import { initRouter, navigate } from './router.js';
import {
  downloadCsv,
  formatCurrency,
  formatDate,
  monthLabel,
  populateSelect,
  renderAccountsTable,
  renderCategoriesTable,
  renderReportTable,
  renderTransactionsTable,
  renderUsersTable,
  setAuthVisible,
  setLoginFeedback,
  setLoginSubmitting,
  setLoading,
  setUserIdentity,
  showToast,
  toggleSupabaseAlert,
} from './ui.js';

window.__APP_BOOTED__ = true;

const DEFAULT_LANCAMENTOS_FILTERS = Object.freeze({
  dateFrom: '',
  dateTo: '',
  type: '',
  description: '',
  categoryId: '',
  accountId: '',
});

const state = {
  user: null,
  role: null,
  monthKey: getStoredMonth(),
  darkMode: getStoredTheme(),
  pageSize: getStoredPageSize(),
  currentPage: 1,
  route: 'dashboard',
  search: '',
  accounts: [],
  categories: [],
  transactions: [],
  users: [],
  lancamentosFilters: { ...DEFAULT_LANCAMENTOS_FILTERS },
};

const dashboard = createDashboard();
const transactionModal = new bootstrap.Modal(document.getElementById('transactionModal'));
const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
const accountModal = new bootstrap.Modal(document.getElementById('accountModal'));
const userModal = new bootstrap.Modal(document.getElementById('userModal'));

const monthRoutes = new Set(['dashboard', 'lancamentos', 'relatorios']);
const searchRoutes = new Set(['dashboard']);
const newTxRoutes = new Set(['dashboard', 'lancamentos']);
const exportRoutes = new Set(['dashboard', 'lancamentos', 'relatorios']);
const adminOnlyRoutes = new Set(['dashboard', 'categorias', 'contas', 'usuarios', 'relatorios', 'config']);
const routeTitles = {
  dashboard: 'Visão Financeira',
  lancamentos: 'Movimento Financeiro',
  categorias: 'Categorias',
  contas: 'Contas e Meios',
  usuarios: 'Gestão de Usuários',
  relatorios: 'Relatórios',
  config: 'Configurações',
};

function getStoredMonth() {
  const saved = localStorage.getItem('financas_month');
  if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getStoredTheme() {
  return localStorage.getItem('financas_dark_mode') === 'true';
}

function getStoredPageSize() {
  const saved = Number(localStorage.getItem('financas_page_size') || '20');
  if ([20, 50, 100].includes(saved)) return saved;
  return 20;
}

function saveStoredMonth(value) {
  localStorage.setItem('financas_month', value);
}

function saveStoredTheme(value) {
  localStorage.setItem('financas_dark_mode', String(value));
}

function saveStoredPageSize(value) {
  localStorage.setItem('financas_page_size', String(value));
}

function isAdmin() {
  return state.role === 'administrador';
}

function friendlyRole(role) {
  if (role === 'administrador') return 'Administrador';
  if (role === 'administrativo') return 'Administrativo';
  return '-';
}

function describeAuthError(error) {
  const raw = (error?.message || '').toLowerCase();

  if (!raw) return 'Falha no login. Verifique email/senha e tente novamente.';
  if (raw.includes('invalid login credentials')) return 'Email ou senha inválidos.';
  if (raw.includes('email not confirmed')) return 'Email não confirmado no Supabase Auth.';
  if (raw.includes('database error querying schema')) return 'Erro no schema do Auth. Execute novamente o supabase.sql atualizado.';
  if (raw.includes('network') || raw.includes('failed to fetch')) return 'Falha de rede ao conectar no Supabase.';
  if (raw.includes('apikey') || raw.includes('invalid api key')) return 'Chave ANON inválida em js/config.js.';
  if (raw.includes('jwt') || raw.includes('jws')) return 'Token inválido. Revise SUPABASE_URL e ANON KEY.';
  return error.message || 'Falha no login.';
}

function describeUserSaveError(error) {
  const raw = (error?.message || '').toLowerCase();

  if (raw.includes('gen_salt') || raw.includes('crypt(')) {
    return 'Banco desatualizado para criação de usuário. Reexecute o arquivo supabase.sql no SQL Editor e tente novamente.';
  }
  if (raw.includes('acesso negado')) return 'Somente Administrador pode criar usuários.';
  if (raw.includes('email já cadastrado')) return 'Este email já está cadastrado.';
  return error?.message || 'Erro ao salvar usuário.';
}

function setMonthLabel() {
  document.getElementById('currentMonth').textContent = monthLabel(state.monthKey);
}

function applyTheme(dark) {
  state.darkMode = dark;
  saveStoredTheme(dark);
  document.body.classList.toggle('dark', dark);
  dashboard.applyTheme();

  const icon = document.querySelector('#darkModeToggle i');
  if (icon) {
    icon.className = dark ? 'bi bi-sun' : 'bi bi-moon-stars';
  }
}

function applyRoleUi() {
  const admin = isAdmin();
  document.querySelectorAll('.nav-admin-only').forEach((el) => {
    el.classList.toggle('d-none', !admin);
  });

  if (!admin) {
    if (adminOnlyRoutes.has(state.route)) {
      navigate('lancamentos');
      return;
    }
  }
}

function shiftMonth(offset) {
  const [year, month] = state.monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  state.monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  state.currentPage = 1;
  saveStoredMonth(state.monthKey);
  setMonthLabel();
  refreshTransactions();
}

function currentFilteredTransactions() {
  let rows = [...state.transactions];

  if (state.search.trim()) {
    const token = state.search.trim().toLowerCase();
    rows = rows.filter((item) =>
      item.description.toLowerCase().includes(token)
        || item.category_name.toLowerCase().includes(token)
        || item.account_name.toLowerCase().includes(token)
        || item.type.toLowerCase().includes(token)
    );
  }

  if (state.route === 'lancamentos') {
    const f = state.lancamentosFilters;

    if (f.dateFrom) {
      rows = rows.filter((item) => item.dt >= f.dateFrom);
    }

    if (f.dateTo) {
      rows = rows.filter((item) => item.dt <= f.dateTo);
    }

    if (f.type) {
      rows = rows.filter((item) => item.type === f.type);
    }

    if (f.description) {
      const descriptionToken = f.description.toLowerCase();
      rows = rows.filter((item) => item.description.toLowerCase().includes(descriptionToken));
    }

    if (f.categoryId) {
      rows = rows.filter((item) => (item.category_id || '') === f.categoryId);
    }

    if (f.accountId) {
      rows = rows.filter((item) => (item.account_id || '') === f.accountId);
    }
  }

  return rows;
}

function syncLancamentosFiltersFromUi() {
  state.lancamentosFilters = {
    dateFrom: document.getElementById('lancFilterDateFrom')?.value || '',
    dateTo: document.getElementById('lancFilterDateTo')?.value || '',
    type: document.getElementById('lancFilterType')?.value || '',
    description: document.getElementById('lancFilterDesc')?.value.trim() || '',
    categoryId: document.getElementById('lancFilterCategory')?.value || '',
    accountId: document.getElementById('lancFilterAccount')?.value || '',
  };
}

function applyLancamentosFiltersToUi() {
  const f = state.lancamentosFilters;
  const from = document.getElementById('lancFilterDateFrom');
  const to = document.getElementById('lancFilterDateTo');
  const type = document.getElementById('lancFilterType');
  const desc = document.getElementById('lancFilterDesc');
  const category = document.getElementById('lancFilterCategory');
  const account = document.getElementById('lancFilterAccount');

  if (from) from.value = f.dateFrom;
  if (to) to.value = f.dateTo;
  if (type) type.value = f.type;
  if (desc) desc.value = f.description;
  if (category) category.value = f.categoryId;
  if (account) account.value = f.accountId;
}

function refreshLancamentosFilterSelects() {
  populateSelect('lancFilterCategory', state.categories, 'Todas categorias');
  populateSelect('lancFilterAccount', state.accounts, 'Todos meios');
  applyLancamentosFiltersToUi();
}

function sortByDateDesc(rows) {
  return [...rows].sort((a, b) => {
    const byDate = b.dt.localeCompare(a.dt);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });
}

function updateReports(rows) {
  const receitas = rows.filter((item) => item.type === 'receita').reduce((sum, item) => sum + item.amount, 0);
  const despesas = rows.filter((item) => item.type === 'despesa').reduce((sum, item) => sum + item.amount, 0);
  const saldo = receitas - despesas;

  document.getElementById('reportCount').textContent = String(rows.length);
  document.getElementById('reportIncome').textContent = formatCurrency(receitas);
  document.getElementById('reportExpense').textContent = formatCurrency(despesas);
  document.getElementById('reportBalance').textContent = formatCurrency(saldo);
  document.getElementById('reportBalance').className = `h4 m-0 ${saldo >= 0 ? 'value-positive' : 'value-negative'}`;

  const byCategory = {};
  rows.filter((item) => item.type === 'despesa').forEach((item) => {
    byCategory[item.category_name] = (byCategory[item.category_name] || 0) + item.amount;
  });

  const byAccount = {};
  rows.filter((item) => item.type === 'despesa').forEach((item) => {
    byAccount[item.account_name] = (byAccount[item.account_name] || 0) + item.amount;
  });

  renderReportTable('reportCategoryBody', Object.entries(byCategory).sort((a, b) => b[1] - a[1]));
  renderReportTable('reportAccountBody', Object.entries(byAccount).sort((a, b) => b[1] - a[1]));
}

function updateLancamentosTotals(rows) {
  const receitas = rows.filter((item) => item.type === 'receita').reduce((sum, item) => sum + item.amount, 0);
  const despesas = rows.filter((item) => item.type === 'despesa').reduce((sum, item) => sum + item.amount, 0);
  const saldo = receitas - despesas;

  document.getElementById('lancamentosTotalCount').textContent = String(rows.length);
  document.getElementById('lancamentosTotalIncome').textContent = formatCurrency(receitas);
  document.getElementById('lancamentosTotalExpense').textContent = formatCurrency(despesas);

  const balanceEl = document.getElementById('lancamentosTotalBalance');
  balanceEl.textContent = formatCurrency(saldo);
  balanceEl.className = `fw-semibold ${saldo >= 0 ? 'value-positive' : 'value-negative'}`;
}

function paginateTransactions(rows) {
  const totalItems = rows.length;
  const pageSize = state.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

  const startIndex = (state.currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageRows = rows.slice(startIndex, endIndex);

  return {
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    pageRows,
  };
}

function updateLancamentosPaginationUi(meta) {
  const info = document.getElementById('lancamentosPageInfo');
  const prevBtn = document.getElementById('lancamentosPrevPage');
  const nextBtn = document.getElementById('lancamentosNextPage');
  const pageSizeSelect = document.getElementById('lancamentosPageSize');

  pageSizeSelect.value = String(state.pageSize);

  if (meta.totalItems === 0) {
    info.textContent = 'Página 1 de 1';
  } else {
    const start = meta.startIndex + 1;
    const end = meta.endIndex;
    info.textContent = `${start}-${end} de ${meta.totalItems} · Página ${state.currentPage} de ${meta.totalPages}`;
  }

  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = state.currentPage >= meta.totalPages;
}

function refreshViewData() {
  const filtered = currentFilteredTransactions();
  const sortedDesc = sortByDateDesc(filtered);

  const pagination = paginateTransactions(sortedDesc);

  renderTransactionsTable('transactionsBody', pagination.pageRows, true);
  renderTransactionsTable('dashboardTransactionsBody', sortedDesc.slice(0, 10), true);
  updateLancamentosTotals(sortedDesc);
  updateLancamentosPaginationUi(pagination);
  dashboard.render(filtered, state.monthKey);
  updateReports(filtered);
}

function refreshLookupSelects() {
  populateSelect('campoCategoria', state.categories, 'Sem categoria');
  populateSelect('campoConta', state.accounts, 'Sem conta');
  refreshLancamentosFilterSelects();
}

async function refreshAccounts() {
  state.accounts = await listAccounts();
  renderAccountsTable(state.accounts);
  refreshLookupSelects();
}

async function refreshCategories() {
  state.categories = await listCategories();
  renderCategoriesTable(state.categories);
  refreshLookupSelects();
}

async function refreshUsers() {
  if (!isAdmin()) return;
  state.users = await listUsers();
  renderUsersTable(state.users);
}

async function refreshTransactions() {
  if (!state.user) return;

  try {
    setLoading(true);
    state.transactions = await listTransactionsByMonth(state.monthKey);
    refreshViewData();
  } catch (error) {
    showToast(error.message || 'Erro ao carregar lançamentos.', 'error');
  } finally {
    setLoading(false);
  }
}

async function loadAppData() {
  if (!state.user) return;

  try {
    setLoading(true);
    await Promise.all([refreshAccounts(), refreshCategories(), refreshUsers()]);
    state.transactions = await listTransactionsByMonth(state.monthKey);
    refreshViewData();
  } catch (error) {
    showToast(error.message || 'Erro ao carregar dados.', 'error');
  } finally {
    setLoading(false);
  }
}

function updateTopbarByRoute(route) {
  document.getElementById('monthSelector').classList.toggle('d-none', !monthRoutes.has(route));
  document.getElementById('searchWrap').classList.toggle('d-none', !searchRoutes.has(route));
  document.getElementById('btnNovoLancamento').classList.toggle('d-none', !newTxRoutes.has(route));
  document.getElementById('exportCsvBtn').classList.toggle('d-none', !exportRoutes.has(route));

  if (!searchRoutes.has(route)) {
    document.getElementById('globalSearch').value = '';
    state.search = '';
    state.currentPage = 1;
    refreshViewData();
  }
}

function updatePageTitle(route) {
  const el = document.getElementById('pageTitle');
  if (!el) return;
  el.textContent = routeTitles[route] || 'Movimento Financeiro';
}

function onRouteChange(route) {
  state.route = route;

  if (state.user && !isAdmin() && adminOnlyRoutes.has(route)) {
    navigate('lancamentos');
    return;
  }

  document.querySelectorAll('.app-view').forEach((view) => {
    const active = view.id === `view-${route}`;
    view.classList.toggle('d-none', !active);
  });

  document.querySelectorAll('[data-route-link]').forEach((link) => {
    const active = link.dataset.routeLink === route;
    link.classList.toggle('active', active);
  });

  updatePageTitle(route);
  updateTopbarByRoute(route);
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function openTransactionModal(transactionId = null) {
  refreshLookupSelects();

  const title = document.getElementById('transactionModalTitle');
  const tx = transactionId
    ? state.transactions.find((item) => item.id === transactionId)
    : null;

  if (tx) {
    title.textContent = 'Editar lançamento';
    document.getElementById('transactionId').value = tx.id;
    document.getElementById('campoData').value = tx.dt;
    document.getElementById('campoTipo').value = tx.type;
    document.getElementById('campoValor').value = String(tx.amount);
    document.getElementById('campoDescricao').value = tx.description;
    document.getElementById('campoCategoria').value = tx.category_id || '';
    document.getElementById('campoConta').value = tx.account_id || '';
    document.getElementById('campoObs').value = tx.note || '';
  } else {
    title.textContent = 'Novo lançamento';
    document.getElementById('formLancamento').reset();
    document.getElementById('transactionId').value = '';
    document.getElementById('campoTipo').value = 'despesa';
    document.getElementById('campoData').valueAsDate = new Date();
  }

  transactionModal.show();
}

function openCategoryModal(categoryId = null) {
  const category = categoryId
    ? state.categories.find((item) => item.id === categoryId)
    : null;

  document.getElementById('categoryModalTitle').textContent = category ? 'Editar categoria' : 'Nova categoria';
  document.getElementById('categoryId').value = category?.id || '';
  document.getElementById('categoryName').value = category?.name || '';
  categoryModal.show();
}

function openAccountModal(accountId = null) {
  const account = accountId
    ? state.accounts.find((item) => item.id === accountId)
    : null;

  document.getElementById('accountModalTitle').textContent = account ? 'Editar conta' : 'Nova conta';
  document.getElementById('accountId').value = account?.id || '';
  document.getElementById('accountName').value = account?.name || '';
  document.getElementById('accountKind').value = account?.kind || 'dinheiro';
  accountModal.show();
}

function openUserModal(userId = null) {
  const row = userId
    ? state.users.find((item) => item.user_id === userId)
    : null;

  document.getElementById('userModalTitle').textContent = row ? 'Editar usuário' : 'Novo usuário';
  document.getElementById('appUserId').value = row?.user_id || '';
  document.getElementById('appUserEmail').value = row?.email || '';
  document.getElementById('appUserRole').value = row?.role || 'administrativo';

  const passWrap = document.getElementById('appUserPasswordWrap');
  const passInput = document.getElementById('appUserPassword');

  if (row) {
    passWrap.classList.add('d-none');
    passInput.value = '';
    passInput.removeAttribute('required');
    document.getElementById('appUserEmail').setAttribute('disabled', 'disabled');
  } else {
    passWrap.classList.remove('d-none');
    passInput.value = '';
    passInput.setAttribute('required', 'required');
    document.getElementById('appUserEmail').removeAttribute('disabled');
  }

  userModal.show();
}

function parseTransactionForm() {
  const dt = document.getElementById('campoData').value;
  const type = document.getElementById('campoTipo').value;
  const amount = Number(document.getElementById('campoValor').value);
  const description = document.getElementById('campoDescricao').value.trim();
  const categoryId = document.getElementById('campoCategoria').value;
  const accountId = document.getElementById('campoConta').value;
  const note = document.getElementById('campoObs').value.trim();

  if (!dt) throw new Error('Informe a data.');
  if (!['receita', 'despesa'].includes(type)) throw new Error('Tipo inválido.');
  if (!amount || amount <= 0) throw new Error('Valor precisa ser maior que zero.');
  if (!description) throw new Error('Descrição é obrigatória.');

  return {
    dt,
    type,
    amount: Number(amount.toFixed(2)),
    description,
    category_id: categoryId || null,
    account_id: accountId || null,
    note: note || null,
  };
}

async function saveTransaction() {
  if (!state.user) return;

  try {
    const payload = parseTransactionForm();
    const txId = document.getElementById('transactionId').value;

    setLoading(true);
    if (txId) {
      await updateTransaction(txId, payload);
      showToast('Lançamento atualizado com sucesso.');
    } else {
      await createTransaction(state.user.id, payload);
      showToast('Lançamento criado com sucesso.');
    }

    transactionModal.hide();
    await refreshTransactions();
  } catch (error) {
    showToast(error.message || 'Erro ao salvar lançamento.', 'error');
  } finally {
    setLoading(false);
  }
}

async function removeTransaction(transactionId) {
  if (!state.user) return;
  if (!window.confirm('Deseja realmente excluir este lançamento?')) return;

  try {
    setLoading(true);
    await deleteTransaction(transactionId);
    showToast('Lançamento excluído.');
    await refreshTransactions();
  } catch (error) {
    showToast(error.message || 'Erro ao excluir lançamento.', 'error');
  } finally {
    setLoading(false);
  }
}

async function saveCategory() {
  if (!isAdmin()) return;

  const id = document.getElementById('categoryId').value;
  const name = document.getElementById('categoryName').value.trim();
  if (!name) {
    showToast('Nome da categoria é obrigatório.', 'error');
    return;
  }

  try {
    setLoading(true);
    if (id) {
      await updateCategory(id, { name });
      showToast('Categoria atualizada.');
    } else {
      await createCategory(state.user.id, { name });
      showToast('Categoria criada.');
    }
    categoryModal.hide();
    await refreshCategories();
    await refreshTransactions();
  } catch (error) {
    showToast(error.message || 'Erro ao salvar categoria.', 'error');
  } finally {
    setLoading(false);
  }
}

async function removeCategory(categoryId) {
  if (!isAdmin()) return;
  if (!window.confirm('Excluir categoria? Lançamentos ficarão sem categoria.')) return;

  try {
    setLoading(true);
    await deleteCategory(categoryId);
    showToast('Categoria excluída.');
    await refreshCategories();
    await refreshTransactions();
  } catch (error) {
    showToast(error.message || 'Erro ao excluir categoria.', 'error');
  } finally {
    setLoading(false);
  }
}

async function saveAccount() {
  if (!isAdmin()) return;

  const id = document.getElementById('accountId').value;
  const name = document.getElementById('accountName').value.trim();
  const kind = document.getElementById('accountKind').value;

  if (!name) {
    showToast('Nome da conta é obrigatório.', 'error');
    return;
  }

  try {
    setLoading(true);
    if (id) {
      await updateAccount(id, { name, kind });
      showToast('Conta atualizada.');
    } else {
      await createAccount(state.user.id, { name, kind });
      showToast('Conta criada.');
    }
    accountModal.hide();
    await refreshAccounts();
    await refreshTransactions();
  } catch (error) {
    showToast(error.message || 'Erro ao salvar conta.', 'error');
  } finally {
    setLoading(false);
  }
}

async function removeAccount(accountId) {
  if (!isAdmin()) return;
  if (!window.confirm('Excluir conta? Lançamentos ficarão sem conta.')) return;

  try {
    setLoading(true);
    await deleteAccount(accountId);
    showToast('Conta excluída.');
    await refreshAccounts();
    await refreshTransactions();
  } catch (error) {
    showToast(error.message || 'Erro ao excluir conta.', 'error');
  } finally {
    setLoading(false);
  }
}

async function saveUser() {
  if (!isAdmin()) return;

  const id = document.getElementById('appUserId').value;
  const email = document.getElementById('appUserEmail').value.trim().toLowerCase();
  const password = document.getElementById('appUserPassword').value;
  const role = document.getElementById('appUserRole').value;

  try {
    setLoading(true);
    if (id) {
      await updateUserRole(id, role);
      showToast('Perfil do usuário atualizado.');
    } else {
      if (!email) throw new Error('Email é obrigatório.');
      if (!password || password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres.');
      await createUserByAdmin({ email, password, role });
      showToast('Usuário criado com sucesso.');
    }

    userModal.hide();
    await refreshUsers();
  } catch (error) {
    showToast(describeUserSaveError(error), 'error');
  } finally {
    setLoading(false);
  }
}

async function seedAccounts() {
  if (!isAdmin()) return;

  try {
    setLoading(true);
    await createDefaultAccounts(state.user.id);
    showToast('Contas padrão criadas.');
    await refreshAccounts();
  } catch (error) {
    showToast(error.message || 'Erro ao criar contas padrão.', 'error');
  } finally {
    setLoading(false);
  }
}

async function seedCategories() {
  if (!isAdmin()) return;

  try {
    setLoading(true);
    await createDefaultCategories(state.user.id);
    showToast('Categorias padrão criadas.');
    await refreshCategories();
  } catch (error) {
    showToast(error.message || 'Erro ao criar categorias padrão.', 'error');
  } finally {
    setLoading(false);
  }
}

function exportCurrentCsv() {
  const rows = sortByDateDesc(currentFilteredTransactions());
  const usersMap = new Map((state.users || []).map((row) => [row.user_id, row.email]));
  const currentEmail = state.user?.email || '';
  const resolveUserEmail = (userId) => usersMap.get(userId) || (userId === state.user?.id ? currentEmail : '');

  downloadCsv(
    `lancamentos-${state.monthKey}.csv`,
    ['Data', 'Tipo', 'Descricao', 'Categoria', 'Meio', 'Valor', 'Observacao', 'Usuario'],
    rows.map((item) => [
      formatDate(item.dt),
      item.type === 'receita' ? 'Receita' : 'Despesa',
      item.description,
      item.category_name,
      item.account_name,
      item.amount.toFixed(2).replace('.', ','),
      item.note || '',
      resolveUserEmail(item.user_id) || '',
    ]),
    { delimiter: ';', includeBom: true }
  );

  showToast('CSV exportado com sucesso.');
}

async function processUser(user) {
  if (!user) {
    state.user = null;
    state.role = null;
    state.accounts = [];
    state.categories = [];
    state.transactions = [];
    state.users = [];
    state.currentPage = 1;
    setUserIdentity('-', '-');
    setAuthVisible(true);
    setLoginSubmitting(false);
    return;
  }

  state.user = user;

  try {
    const profile = await getMyProfile(user.id);
    if (!profile) {
      throw new Error('Perfil do usuário não encontrado. Execute o supabase.sql e tente novamente.');
    }

    state.role = profile.role;
    setUserIdentity(profile.email || user.email, friendlyRole(profile.role));
    setLoginFeedback('Login realizado com sucesso. Carregando painel...', 'success');
    setAuthVisible(false);
    setMonthLabel();
    applyRoleUi();

    navigate(isAdmin() ? 'dashboard' : 'lancamentos');

    await loadAppData();
  } catch (error) {
    const msg = error.message || 'Erro ao carregar perfil do usuário.';
    showToast(msg, 'error');
    setLoginFeedback(msg, 'error');
    setAuthVisible(true);
  }
}

function bindAuthEvents() {
  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      setLoginFeedback('Validando credenciais no Supabase...', 'info');
      setLoginSubmitting(true);
      setLoading(true);
      await signInWithEmail(email, password);
      showToast('Login realizado com sucesso.');
      setLoginFeedback('Credenciais válidas. Finalizando acesso...', 'success');
    } catch (error) {
      const msg = describeAuthError(error);
      showToast(msg, 'error');
      setLoginFeedback(msg, 'error');
    } finally {
      setLoading(false);
      setLoginSubmitting(false);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      setLoading(true);
      await signOutUser();
      showToast('Sessão encerrada.');
    } catch (error) {
      showToast(error.message || 'Erro ao sair.', 'error');
    } finally {
      setLoading(false);
    }
  });

  window.__LOGIN_BOUND__ = true;
}

function bindUiEvents() {
  document.getElementById('prevMonth').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => shiftMonth(1));

  document.getElementById('globalSearch').addEventListener('input', (event) => {
    state.search = event.target.value;
    state.currentPage = 1;
    refreshViewData();
  });

  document.getElementById('lancamentosPageSize').addEventListener('change', (event) => {
    const nextSize = Number(event.target.value);
    if (![20, 50, 100].includes(nextSize)) return;
    state.pageSize = nextSize;
    state.currentPage = 1;
    saveStoredPageSize(nextSize);
    refreshViewData();
  });

  document.getElementById('lancamentosPrevPage').addEventListener('click', () => {
    if (state.currentPage <= 1) return;
    state.currentPage -= 1;
    refreshViewData();
  });

  document.getElementById('lancamentosNextPage').addEventListener('click', () => {
    state.currentPage += 1;
    refreshViewData();
  });

  const lancFilterChange = () => {
    syncLancamentosFiltersFromUi();
    state.currentPage = 1;
    refreshViewData();
  };

  document.getElementById('lancFilterDateFrom').addEventListener('change', lancFilterChange);
  document.getElementById('lancFilterDateTo').addEventListener('change', lancFilterChange);
  document.getElementById('lancFilterType').addEventListener('change', lancFilterChange);
  document.getElementById('lancFilterCategory').addEventListener('change', lancFilterChange);
  document.getElementById('lancFilterAccount').addEventListener('change', lancFilterChange);
  document.getElementById('lancFilterDesc').addEventListener('input', lancFilterChange);
  document.getElementById('lancFilterClear').addEventListener('click', () => {
    state.lancamentosFilters = { ...DEFAULT_LANCAMENTOS_FILTERS };
    applyLancamentosFiltersToUi();
    state.currentPage = 1;
    refreshViewData();
  });
  document.getElementById('lancExportBtn').addEventListener('click', exportCurrentCsv);

  document.getElementById('btnNovoLancamento').addEventListener('click', () => openTransactionModal());
  document.getElementById('btnNovoLancamentoLista').addEventListener('click', () => openTransactionModal());
  document.getElementById('salvarLancamentoBtn').addEventListener('click', saveTransaction);

  document.getElementById('btnNovaCategoria').addEventListener('click', () => openCategoryModal());
  document.getElementById('salvarCategoriaBtn').addEventListener('click', saveCategory);
  document.getElementById('btnSeedCategories').addEventListener('click', seedCategories);

  document.getElementById('btnNovaConta').addEventListener('click', () => openAccountModal());
  document.getElementById('salvarContaBtn').addEventListener('click', saveAccount);
  document.getElementById('btnSeedAccounts').addEventListener('click', seedAccounts);

  document.getElementById('btnNovoUsuario').addEventListener('click', () => openUserModal());
  document.getElementById('salvarUsuarioBtn').addEventListener('click', saveUser);

  document.getElementById('exportCsvBtn').addEventListener('click', exportCurrentCsv);

  document.getElementById('darkModeToggle').addEventListener('click', () => applyTheme(!state.darkMode));
  document.getElementById('btnToggleThemeConfig').addEventListener('click', () => applyTheme(!state.darkMode));

  document.getElementById('btnClearLocalData').addEventListener('click', () => {
    localStorage.removeItem('financas_month');
    localStorage.removeItem('financas_dark_mode');
    showToast('Preferências locais removidas.');
  });

  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('mobile-open');
  });

  document.getElementById('mobileCloseBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
  });

  document.getElementById('transactionsBody').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;
    if (action === 'edit-transaction') openTransactionModal(id);
    if (action === 'delete-transaction') removeTransaction(id);
  });

  document.getElementById('dashboardTransactionsBody').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;
    if (action === 'edit-transaction') openTransactionModal(id);
    if (action === 'delete-transaction') removeTransaction(id);
  });

  document.getElementById('categoriesBody').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;
    if (action === 'edit-category') openCategoryModal(id);
    if (action === 'delete-category') removeCategory(id);
  });

  document.getElementById('accountsBody').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;
    if (action === 'edit-account') openAccountModal(id);
    if (action === 'delete-account') removeAccount(id);
  });

  document.getElementById('usersBody').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const { action, id } = btn.dataset;
    if (action === 'edit-user') openUserModal(id);
  });
}

async function boot() {
  bindUiEvents();
  bindAuthEvents();
  setLoginFeedback('');
  setLoginSubmitting(false);
  setMonthLabel();
  applyTheme(state.darkMode);

  if (window.location.protocol === 'file:') {
    setAuthVisible(true);
    setLoginFeedback('Abra via servidor HTTP/HTTPS. Em file:// os módulos não carregam corretamente.', 'error');
    return;
  }

  initRouter(onRouteChange);

  if (!isSupabaseConfigured) {
    toggleSupabaseAlert(true);
    setAuthVisible(true);
    setUserIdentity('-', '-');
    showToast('Configure o Supabase para iniciar.', 'warning');
    setLoginFeedback('Supabase não configurado. Preencha js/config.js com URL e ANON key.', 'warning');
    return;
  }

  toggleSupabaseAlert(false);

  onAuthStateChange((user) => {
    processUser(user);
  });

  try {
    setLoading(true);
    const user = await getSessionUser();
    await processUser(user);
  } catch (error) {
    const msg = error.message || 'Erro ao inicializar sessão.';
    showToast(msg, 'error');
    setLoginFeedback(msg, 'error');
    setAuthVisible(true);
  } finally {
    setLoading(false);
  }
}

window.addEventListener('error', (event) => {
  const msg = event?.error?.message || event.message || 'Erro inesperado na aplicação.';
  setLoginFeedback(`Erro de aplicação: ${msg}`, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const msg = typeof reason === 'string' ? reason : reason?.message || 'Promise rejeitada sem tratamento.';
  setLoginFeedback(`Erro de aplicação: ${msg}`, 'error');
});

boot();
