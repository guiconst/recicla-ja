# ♻️ Recicla Já

App mobile que incentiva a reciclagem: o usuário fotografa uma embalagem, uma IA no próprio celular confere se ela é reciclável e o app soma pontos de desconto.

> Aulas 12 e 13 — Programação para Dispositivos Móveis II.

## Tecnologias

React 19 · Vite · Tailwind CSS · Capacitor (`@capacitor/camera`) · Supabase Storage · TensorFlow.js (MobileNet)

## Funcionalidades

- **Tirar Foto / Galeria:** o Android pergunta se o usuário quer Câmera ou Galeria.
- **Permissões:** verifica e solicita acesso à câmera quando necessário.
- **IA no dispositivo:** o MobileNet confere se a foto é de uma embalagem reciclável.
- **Pontos:** +10 por embalagem aprovada.
- **Upload:** a foto é enviada ao Supabase Storage e exibida via URL pública.
- **Tratamento de erros:** cancelar a câmera ou falha de rede não trava o app.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 22+
- Conta gratuita no [Supabase](https://supabase.com)
- Para rodar no Android: Android Studio e Java 21

## Como rodar

### 1. Clonar e instalar

```bash
git clone https://github.com/guiconst/recicla-ja.git
cd recicla-ja
npm install
```

### 2. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o conteúdo de `supabase/setup-storage.sql` (cria o bucket `fotos-camera` e as políticas de acesso).
3. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public*.

### 3. Criar o arquivo `.env`

Na raiz do projeto, crie um arquivo `.env` com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 4. Rodar no navegador

```bash
npm run dev
```

### 5. Rodar no Android

```bash
npm run build
npx cap add android          # somente na primeira vez
npm run android:permissoes   # adiciona as permissões no AndroidManifest
npx cap sync android
npx cap run android
```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (acessível na rede local) |
| `npm run build` | Gera a build web em `dist/` |
| `npm run preview` | Visualiza a build localmente |
| `npm run android:permissoes` | Adiciona as permissões no AndroidManifest |
| `npm run android:sync` | Build + sincroniza com o projeto Android |
| `npm run android:run` | Build + sincroniza + executa no Android |

## 🔒 Segurança e variáveis de ambiente

- **Nunca suba o `.env` para o GitHub.** Ele já está no `.gitignore` — confira com `git status` antes de cada commit.
- Não coloque chaves, URLs privadas ou senhas no código nem em commits, issues ou prints.
- Se uma chave vazar por engano, **gere uma nova** no Supabase (Project Settings > API) e atualize o `.env`; apagar o commit não basta, pois ele continua no histórico.
- Use somente a chave `anon` no app. A chave `service_role` **nunca** deve ir para o front-end.

## APK pelo GitHub Actions

As chaves ficam como *secrets* do repositório, fora do código:

1. No repositório: **Settings > Secrets and variables > Actions > New repository secret**.
2. Crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Rode o workflow **Build APK** (automático a cada push na `main`, ou manualmente em *Actions*).
4. Baixe o `app-debug.apk` em **Actions > (execução) > Artifacts**.
