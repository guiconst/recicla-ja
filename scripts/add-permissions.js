// Adiciona as permissões de câmera/armazenamento no AndroidManifest.xml
import fs from 'node:fs';

const caminho = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(caminho)) {
  console.error('AndroidManifest.xml não encontrado. Rode antes: npx cap add android');
  process.exit(1);
}

let xml = fs.readFileSync(caminho, 'utf8');
const permissoes = [
  'android.permission.CAMERA',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
];

const faltando = permissoes.filter((p) => !xml.includes(p));
if (faltando.length === 0) {
  console.log('Permissões já estavam no manifesto.');
  process.exit(0);
}

const linhas = faltando
  .map((p) => `    <uses-permission android:name="${p}" />`)
  .join('\n');

xml = xml.replace('</manifest>', `\n    <!-- Permissões Obrigatórias de Hardware -->\n${linhas}\n</manifest>`);
fs.writeFileSync(caminho, xml);
console.log('Permissões adicionadas:', faltando.join(', '));
