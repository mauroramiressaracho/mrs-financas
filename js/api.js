import { supabase } from './supabaseClient.js';

const ACCOUNT_DEFAULTS = [
  { name: 'Dinheiro', kind: 'dinheiro' },
  { name: 'Pix', kind: 'pix' },
  { name: 'Débito', kind: 'debito' },
  { name: 'Cartão Bradesco', kind: 'cartao' },
  { name: 'Cartão Nubank', kind: 'cartao' },
];

const CATEGORY_DEFAULTS = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Assinaturas',
  'Contas Fixas',
  'Outros',
];

function ensureClient() {
  if (!supabase) {
    throw new Error('Supabase não configurado.');
  }
}

function monthRange(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
  };
}

function normalizeRelation(value) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getMyProfile(userId) {
  ensureClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,email,role,created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listUsers() {
  ensureClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id,email,role,created_at')
    .order('email', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createUserByAdmin(payload) {
  ensureClient();
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_email: payload.email,
    p_password: payload.password,
    p_role: payload.role,
  });

  if (error) throw error;
  return data;
}

export async function updateUserRole(userId, role) {
  ensureClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('user_id', userId);

  if (error) throw error;
}

export async function listAccounts() {
  ensureClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('id,name,kind,created_at')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createAccount(userId, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: payload.name,
      kind: payload.kind,
    })
    .select('id,name,kind,created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccount(id, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from('accounts')
    .update({
      name: payload.name,
      kind: payload.kind,
    })
    .eq('id', id)
    .select('id,name,kind,created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAccount(id) {
  ensureClient();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createDefaultAccounts(userId) {
  ensureClient();
  const rows = ACCOUNT_DEFAULTS.map((item) => ({
    user_id: userId,
    name: item.name,
    kind: item.kind,
  }));

  const { error } = await supabase
    .from('accounts')
    .upsert(rows, { onConflict: 'user_id,name' });

  if (error) throw error;
}

export async function listCategories() {
  ensureClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id,name,created_at')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCategory(userId, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: userId,
      name: payload.name,
    })
    .select('id,name,created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function updateCategory(id, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from('categories')
    .update({ name: payload.name })
    .eq('id', id)
    .select('id,name,created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  ensureClient();
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createDefaultCategories(userId) {
  ensureClient();
  const rows = CATEGORY_DEFAULTS.map((name) => ({ user_id: userId, name }));
  const { error } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'user_id,name' });

  if (error) throw error;
}

export async function listTransactionsByMonth(monthKey) {
  ensureClient();
  const { start, end } = monthRange(monthKey);

  const { data, error } = await supabase
    .from('transactions')
    .select('id,user_id,dt,type,amount,description,note,category_id,account_id,categories(name),accounts(name,kind)')
    .gte('dt', start)
    .lte('dt', end)
    .order('dt', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const category = normalizeRelation(row.categories);
    const account = normalizeRelation(row.accounts);

    return {
      id: row.id,
      user_id: row.user_id,
      dt: row.dt,
      type: row.type,
      amount: Number(row.amount ?? 0),
      description: row.description,
      note: row.note ?? '',
      category_id: row.category_id,
      account_id: row.account_id,
      category_name: category?.name ?? 'Sem categoria',
      account_name: account?.name ?? 'Sem conta',
      account_kind: account?.kind ?? 'outros',
    };
  });
}

export async function createTransaction(userId, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      dt: payload.dt,
      type: payload.type,
      amount: payload.amount,
      description: payload.description,
      category_id: payload.category_id || null,
      account_id: payload.account_id || null,
      note: payload.note || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(id, payload) {
  ensureClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({
      dt: payload.dt,
      type: payload.type,
      amount: payload.amount,
      description: payload.description,
      category_id: payload.category_id || null,
      account_id: payload.account_id || null,
      note: payload.note || null,
    })
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  ensureClient();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
