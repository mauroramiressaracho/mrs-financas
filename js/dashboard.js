const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function cssVar(name, fallback) {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function monthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function toMoney(value) {
  return currency.format(Number(value) || 0);
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function byExpense(items) {
  return items.filter((item) => item.type === 'despesa');
}

export function createDashboard() {
  const kpiSaldo = document.getElementById('kpiSaldo');
  const kpiReceitas = document.getElementById('kpiReceitas');
  const kpiDespesas = document.getElementById('kpiDespesas');
  const kpiCartao = document.getElementById('kpiCartao');

  const donutCtx = document.getElementById('chartDonut');
  const lineCtx = document.getElementById('chartLinha');
  const barCtx = document.getElementById('chartBarras');
  const annualLineCtx = document.getElementById('chartLinhaAnual');

  const chartDonut = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: ['#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#eab308', '#64748b', '#94a3b8', '#14b8a6'],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  const chartLinha = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Saldo acumulado',
        data: [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.15)',
        borderWidth: 3,
        tension: 0.25,
        fill: true,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
      },
    },
  });

  const chartBarras = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Despesas',
        data: [],
        backgroundColor: '#3b82f6',
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
      },
    },
  });

  const chartLinhaAnual = annualLineCtx ? new Chart(annualLineCtx, {
    type: 'line',
    data: {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Receitas',
          data: Array(12).fill(0),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.12)',
          borderWidth: 3,
          tension: 0.25,
          fill: false,
          pointRadius: 3,
        },
        {
          label: 'Despesas',
          data: Array(12).fill(0),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.12)',
          borderWidth: 3,
          tension: 0.25,
          fill: false,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#64748b' },
        },
      },
      scales: {
        x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
      },
    },
  }) : null;

  function applyTheme() {
    const tickColor = cssVar('--text-secondary', '#64748b');
    const gridColor = cssVar('--chart-grid', '#e2e8f0');

    chartLinha.options.scales.x.ticks.color = tickColor;
    chartLinha.options.scales.x.grid.color = gridColor;
    chartLinha.options.scales.y.ticks.color = tickColor;
    chartLinha.options.scales.y.grid.color = gridColor;

    chartBarras.options.scales.x.ticks.color = tickColor;
    chartBarras.options.scales.x.grid.color = gridColor;
    chartBarras.options.scales.y.ticks.color = tickColor;
    chartBarras.options.scales.y.grid.color = gridColor;

    if (chartLinhaAnual) {
      chartLinhaAnual.options.scales.x.ticks.color = tickColor;
      chartLinhaAnual.options.scales.x.grid.color = gridColor;
      chartLinhaAnual.options.scales.y.ticks.color = tickColor;
      chartLinhaAnual.options.scales.y.grid.color = gridColor;
      chartLinhaAnual.options.plugins.legend.labels.color = tickColor;
      chartLinhaAnual.update();
    }

    chartLinha.update();
    chartBarras.update();
  }

  function render(transactions, monthKey, yearTransactions = []) {
    const receitas = transactions
      .filter((item) => item.type === 'receita')
      .reduce((sum, item) => sum + item.amount, 0);

    const despesas = transactions
      .filter((item) => item.type === 'despesa')
      .reduce((sum, item) => sum + item.amount, 0);

    const saldo = receitas - despesas;

    const percDespesasReceitas = receitas > 0 ? ((despesas / receitas) * 100).toFixed(1) : '0.0';

    kpiSaldo.textContent = toMoney(saldo);
    kpiReceitas.textContent = toMoney(receitas);
    kpiDespesas.textContent = toMoney(despesas);
    kpiCartao.textContent = `${percDespesasReceitas}%`;

    kpiSaldo.className = `fw-bold mb-0 ${saldo >= 0 ? 'value-positive' : 'value-negative'}`;
    kpiReceitas.className = 'fw-bold mb-0 value-positive';
    kpiDespesas.className = 'fw-bold mb-0 value-negative';

    const expenseByCategory = {};
    byExpense(transactions).forEach((item) => {
      const key = item.category_name || 'Sem categoria';
      expenseByCategory[key] = (expenseByCategory[key] || 0) + item.amount;
    });

    const categoryEntries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
    chartDonut.data.labels = categoryEntries.map((entry) => entry[0]);
    chartDonut.data.datasets[0].data = categoryEntries.map((entry) => Number(entry[1].toFixed(2)));
    chartDonut.update();

    const totalDays = monthDays(monthKey);
    const running = [];
    let acc = 0;

    for (let day = 1; day <= totalDays; day += 1) {
      const key = String(day).padStart(2, '0');
      const dayDate = `${monthKey}-${key}`;
      const dayValue = transactions
        .filter((item) => item.dt === dayDate)
        .reduce((sum, item) => sum + (item.type === 'receita' ? item.amount : -item.amount), 0);
      acc += dayValue;
      running.push(Number(acc.toFixed(2)));
    }

    chartLinha.data.labels = Array.from({ length: totalDays }, (_v, idx) => idx + 1);
    chartLinha.data.datasets[0].data = running;
    chartLinha.update();

    const expenseByAccount = {};
    byExpense(transactions).forEach((item) => {
      const key = item.account_name || 'Sem conta';
      expenseByAccount[key] = (expenseByAccount[key] || 0) + item.amount;
    });

    const accountEntries = Object.entries(expenseByAccount).sort((a, b) => b[1] - a[1]);
    chartBarras.data.labels = accountEntries.map((entry) => entry[0]);
    chartBarras.data.datasets[0].data = accountEntries.map((entry) => Number(entry[1].toFixed(2)));
    chartBarras.update();

    if (chartLinhaAnual) {
      const receitasPorMes = Array(12).fill(0);
      const despesasPorMes = Array(12).fill(0);

      yearTransactions.forEach((item) => {
        const monthIndex = Number(item.dt?.slice(5, 7)) - 1;
        if (monthIndex < 0 || monthIndex > 11) return;

        if (item.type === 'receita') receitasPorMes[monthIndex] += item.amount;
        if (item.type === 'despesa') despesasPorMes[monthIndex] += item.amount;
      });

      chartLinhaAnual.data.datasets[0].data = receitasPorMes.map((value) => Number(value.toFixed(2)));
      chartLinhaAnual.data.datasets[1].data = despesasPorMes.map((value) => Number(value.toFixed(2)));
      chartLinhaAnual.update();
    }
  }

  applyTheme();

  return {
    render,
    applyTheme,
  };
}
