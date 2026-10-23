import { supabase, supabaseConfigurado, BUCKET } from './supabase';

/**
 * Envia a foto capturada para o Supabase Storage e devolve a URL pública.
 * 1) URI/webPath -> Blob   2) upload()   3) getPublicUrl()
 */
export async function enviarFoto(webPath, pasta = 'fotos') {
  if (!supabaseConfigurado) {
    throw new Error('Supabase não configurado. Crie o arquivo .env (veja .env.example).');
  }

  // 1) Converte o caminho da foto em Blob (formato legível para a nuvem)
  const resposta = await fetch(webPath);
  const arquivoBlob = await resposta.blob();
  const tipo = arquivoBlob.type || 'image/jpeg';
  const extensao = (tipo.split('/')[1] || 'jpg').replace('jpeg', 'jpg');

  // 2) Nome único com timestamp: evita sobrescrever fotos com o mesmo nome
  const caminhoUnico = `${pasta}/${Date.now()}.${extensao}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminhoUnico, arquivoBlob, { contentType: tipo, upsert: false });
  if (error) throw error;

  // 3) Resgata a URL pública para renderizar no <img>
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminhoUnico);
  return data.publicUrl;
}
