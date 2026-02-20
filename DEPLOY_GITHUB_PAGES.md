# Deploy no GitHub Pages (Supabase)

## 1) Publicar no GitHub Pages
1. Suba este projeto para um repositório no GitHub.
2. Em `Settings > Pages`, configure:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main` (ou sua branch)
   - `Folder`: `/ (root)`
3. Aguarde a URL final, por exemplo:
   - `https://SEU_USUARIO.github.io/SEU_REPO/`

## 2) Configurar Supabase Auth para essa URL
No Supabase:
1. `Authentication > URL Configuration`
2. `Site URL`:
   - `https://SEU_USUARIO.github.io/SEU_REPO/`
3. `Redirect URLs`:
   - `https://SEU_USUARIO.github.io/SEU_REPO/*`

Sem essa configuração, login pode falhar em produção.

## 3) Banco e segurança
1. Execute `supabase.sql` no SQL Editor.
2. Isso cria tabelas, RLS/policies, perfis e usuário admin.

## 4) Chaves no front-end
- Use somente ANON key (nunca service_role).
- A ANON key é pública por natureza em apps front-end.

## 5) Configuração de runtime (opcional)
No `index.html` existe:

```html
<script>
  // window.__APP_CONFIG__ = {
  //   supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  //   supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  // };
  window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
</script>
```

Você pode descomentar e preencher para usar config por runtime.
Se não preencher, o app usa os valores definidos em `js/config.js`.

## 6) Checklist rápido de validação em produção
1. Abra a URL do GitHub Pages.
2. Faça login com admin.
3. Crie usuário `administrativo` em `Usuários`.
4. Teste com o `administrativo`:
   - consegue apenas `Lançamentos`.
5. Crie lançamento e valide dashboard/CSV no admin.
