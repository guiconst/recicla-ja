# Recicla Já

Aulas 12 e 13 - Programação para Dispositivos Móveis II.
React + Vite + Tailwind + Capacitor (@capacitor/camera) + Supabase Storage.

## O que o app faz
- "Tirar Foto / Galeria": o Android pergunta Câmera ou Galeria (CameraSource.Prompt)
- Verifica/pede permissões (checkPermissions / requestPermissions)
- Uma IA no celular (MobileNet) confere se a foto é de uma embalagem reciclável
- Soma pontos de desconto (+10 por embalagem aprovada)
- Converte a foto em Blob e envia ao Supabase Storage (`upload`)
- Pega a URL pública (`getPublicUrl`) e renderiza no `<img>`
- try/catch: cancelar a câmera ou falha de rede não trava o app

## Como rodar

1. Instalar dependências
   npm install

2. Configurar o Supabase
   - Crie um projeto em supabase.com
   - No SQL Editor, rode o arquivo `supabase/setup-storage.sql` (cria o bucket `fotos-camera` e as políticas)
   - Copie `.env.example` para `.env` e preencha URL e chave (Project Settings > API)

3. Rodar no navegador
   npm run dev

4. Rodar no Android
   npm run build
   npx cap add android          # só na primeira vez
   npm run android:permissoes
   npx cap sync android
   npx cap run android

## Variáveis de ambiente
O `.env` NÃO vai para o GitHub (está no .gitignore). Use `.env.example` como modelo.

## APK pelo GitHub Actions
No repositório: Settings > Secrets and variables > Actions > New repository secret.
Crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Depois, o workflow "Build APK"
gera o `app-debug.apk` em Actions > Artifacts.
