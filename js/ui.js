const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

let loginFeedbackTimer = null;

function escapeHtml(value) {
  const str = String(value ?? '');
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatCurrency(value) {
  return currency.format(Number(value) || 0);
}

export function formatDate(dateIso) {
  if (!dateIso) return '-';
  const [year, month, day] = dateIso.split('-');
  return `${day}/${month}/${year}`;
}

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${months[month - 1]}/${year}`;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const tone = type === 'error' ? 'danger' : type;
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${tone} border-0`;
  toastEl.role = 'alert';
  toastEl.ariaLive = 'assertive';
  toastEl.ariaAtomic = 'true';
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();

  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

export function setLoading(visible) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  overlay.classList.toggle('d-none', !visible);
}

export function setAuthVisible(isAuthVisible) {
  document.getElementById('authView')?.classList.toggle('d-none', !isAuthVisible);
  document.getElementById('appRoot')?.classList.toggle('d-none', isAuthVisible);
}

export function setLoginFeedback(message, type = 'info') {
  const el = document.getElementById('loginFeedback');
  if (!el) return;

  if (loginFeedbackTimer) {
    clearTimeout(loginFeedbackTimer);
    loginFeedbackTimer = null;
  }

  if (!message) {
    el.className = 'alert d-none mt-3 mb-0';
    el.textContent = '';
    return;
  }

  let tone = 'info';
  if (type === 'error') tone = 'danger';
  if (type === 'success') tone = 'success';
  if (type === 'warning') tone = 'warning';

  el.className = `alert alert-${tone} mt-3 mb-0`;
  el.textContent = message;

  if (type === 'success' || type === 'info' || type === 'warning') {
    loginFeedbackTimer = setTimeout(() => {
      el.className = 'alert d-none mt-3 mb-0';
      el.textContent = '';
      loginFeedbackTimer = null;
    }, 3500);
  }
}

export function setLoginSubmitting(submitting) {
  const button = document.querySelector('#loginForm button[type="submit"]');
  if (!button) return;

  if (submitting) {
    button.setAttribute('disabled', 'disabled');
    button.textContent = 'Entrando...';
  } else {
    button.removeAttribute('disabled');
    button.textContent = 'Entrar';
  }
}

export function setUserIdentity(email, role) {
  const displayEmail = email || '-';
  const displayRole = role || '-';

  const emailTop = document.getElementById('userEmailTop');
  const emailSide = document.getElementById('userEmailSide');
  const roleTop = document.getElementById('userRoleTop');
  const roleSide = document.getElementById('userRoleSide');

  if (emailTop) emailTop.textContent = displayEmail;
  if (emailSide) emailSide.textContent = displayEmail;

  if (roleTop) {
    roleTop.textContent = displayRole;
    roleTop.classList.toggle('d-none', !role || role === '-');
  }

  if (roleSide) roleSide.textContent = displayRole;
}

export function toggleSupabaseAlert(show) {
  document.getElementById('supabaseConfigAlert')?.classList.toggle('d-none', !show);
}

export function populateSelect(selectId, rows, placeholder) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const options = [`<option value="">${escapeHtml(placeholder)}</option>`]
    .concat(rows.map((row) => `<option value="${row.id}">${escapeHtml(row.name)}</option>`));

  select.innerHTML = options.join('');
}

export function renderAccountsTable(rows) {
  const body = document.getElementById('accountsBody');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="3" class="text-secondary">Nenhuma conta cadastrada.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td><span class="badge text-bg-secondary">${escapeHtml(row.kind)}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-account" data-id="${row.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-account" data-id="${row.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `)
    .join('');
}

export function renderCategoriesTable(rows) {
  const body = document.getElementById('categoriesBody');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="2" class="text-secondary">Nenhuma categoria cadastrada.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-category" data-id="${row.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-category" data-id="${row.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `)
    .join('');
}

export function renderUsersTable(rows) {
  const body = document.getElementById('usersBody');
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="4" class="text-secondary">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.email)}</td>
        <td><span class="badge text-bg-dark">${escapeHtml(row.role)}</span></td>
        <td>${formatDate(row.created_at?.slice(0, 10))}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-user" data-id="${row.user_id}"><i class="bi bi-pencil"></i></button>
        </td>
      </tr>
    `)
    .join('');
}

export function renderTransactionsTable(targetBodyId, rows, withActions = true) {
  const body = document.getElementById(targetBodyId);
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-secondary">Nenhum lançamento encontrado.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => {
      const typeBadge = row.type === 'receita'
        ? '<span class="badge badge-income">Receita</span>'
        : '<span class="badge badge-expense">Despesa</span>';

      const valueClass = row.type === 'receita' ? 'value-positive' : 'value-negative';
      const actions = withActions
        ? `
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-transaction" data-id="${row.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-transaction" data-id="${row.id}"><i class="bi bi-trash"></i></button>
        `
        : '-';

      return `
        <tr>
          <td>${formatDate(row.dt)}</td>
          <td>${typeBadge}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.category_name || 'Sem categoria')}</td>
          <td>${escapeHtml(row.account_name || 'Sem conta')}</td>
          <td class="text-end ${valueClass}">${formatCurrency(row.amount)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join('');
}

export function renderReportTable(bodyId, entries) {
  const body = document.getElementById(bodyId);
  if (!body) return;

  if (!entries.length) {
    body.innerHTML = '<tr><td colspan="2" class="text-secondary">Sem dados no período.</td></tr>';
    return;
  }

  body.innerHTML = entries
    .map(([name, value]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="text-end">${formatCurrency(value)}</td>
      </tr>
    `)
    .join('');
}

export function downloadCsv(filename, headers, rows) {
  const csvHeaders = headers.join(',');
  const csvRows = rows.map((row) =>
    row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')
  );

  const csv = [csvHeaders, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
