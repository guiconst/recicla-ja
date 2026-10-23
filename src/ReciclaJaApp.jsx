import React, { useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { enviarFoto } from './services/storage';

/* ------------------------------------------------------------------ */
/* Configurações                                                       */
/* ------------------------------------------------------------------ */
const PONTOS_POR_FOTO = 10;
const META_PONTOS = 100;            // 100 pontos = 10% de desconto
const CONFIANCA_MINIMA = 0.15;      // sobe esse valor para ficar mais rígido

// Cada cor representa uma lixeira (padrão CONAMA)
const MATERIAIS = {
  papel:    { nome: 'Papel',    lixeira: 'azul',     bg: 'bg-papel',    texto: 'text-white' },
  plastico: { nome: 'Plástico', lixeira: 'vermelha', bg: 'bg-plastico', texto: 'text-white' },
  vidro:    { nome: 'Vidro',    lixeira: 'verde',    bg: 'bg-vidro',    texto: 'text-white' },
  metal:    { nome: 'Metal',    lixeira: 'amarela',  bg: 'bg-metal',    texto: 'text-tinta' },
};

// O modelo devolve rótulos em inglês (ImageNet). Aqui dizemos quais valem como embalagem.
const REGRAS = [
  { teste: /wine bottle|beer bottle/,                                   item: 'Garrafa de vidro',  material: 'vidro' },
  { teste: /milk can|tin can|oil can/,                                  item: 'Lata',              material: 'metal' },
  { teste: /water bottle|pop bottle|pill bottle|water jug/,             item: 'Garrafa plástica',  material: 'plastico' },
  { teste: /soap dispenser|lotion|hair spray|sunscreen|plastic bag/,    item: 'Embalagem plástica', material: 'plastico' },
  { teste: /carton|envelope|newspaper|crate|packet/,                    item: 'Embalagem de papel', material: 'papel' },
  { teste: /bottle|jug/,                                                item: 'Garrafa',           material: 'plastico' },
];

/* ------------------------------------------------------------------ */
/* Verificação por IA no próprio celular (MobileNet via TensorFlow.js) */
/* ------------------------------------------------------------------ */
let modeloPromise = null;
function carregarModelo() {
  if (!modeloPromise) {
    modeloPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      const mobilenet = await import('@tensorflow-models/mobilenet');
      await tf.ready();
      return mobilenet.load({ version: 2, alpha: 1.0 });
    })().catch((e) => {
      modeloPromise = null; // permite tentar de novo
      throw e;
    });
  }
  return modeloPromise;
}

async function analisarImagem(url) {
  const modelo = await carregarModelo();
  const img = new Image();
  img.src = url;
  await img.decode();

  const previsoes = await modelo.classify(img, 5);
  for (const p of previsoes) {
    if (p.probability < CONFIANCA_MINIMA) continue;
    const regra = REGRAS.find((r) => r.teste.test(p.className.toLowerCase()));
    if (regra) return { ok: true, item: regra.item, material: regra.material };
  }
  return { ok: false };
}

/* ------------------------------------------------------------------ */
/* Permissões do Android                                               */
/* ------------------------------------------------------------------ */
async function garantirPermissoes() {
  let status = await Camera.checkPermissions();
  if (status.camera !== 'granted' && status.photos !== 'granted') {
    status = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  }
  return status.camera === 'granted' || status.photos === 'granted';
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */
export default function ReciclaJaApp() {
  const [fotoReciclavel, setFotoReciclavel] = useState(null);
  const [pontos, setPontos] = useState(0);
  const [etapa, setEtapa] = useState('idle'); // idle | analisando | aprovada | recusada
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [modelo, setModelo] = useState('carregando'); // carregando | pronto | erro
  const [toast, setToast] = useState(null);
  const [upload, setUpload] = useState('idle'); // idle | enviando | ok | erro
  const [urlNuvem, setUrlNuvem] = useState(null);

  // Pré-carrega o verificador assim que o app abre
  useEffect(() => {
    carregarModelo().then(() => setModelo('pronto')).catch(() => setModelo('erro'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const validarReciclagem = async () => {
    try {
      const permitido = await garantirPermissoes();
      if (!permitido) {
        setToast('Permissão negada. Ative câmera e fotos nas configurações do Android.');
        return;
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt, // Android pergunta: Câmera ou Galeria
      });

      setFotoReciclavel(image.webPath);
      setUrlNuvem(null);
      setUpload('idle');
      setResultado(null);
      setEtapa('analisando');

      let r = null;
      try {
        r = await analisarImagem(image.webPath);
        setResultado(r);
        if (r.ok) {
          setEtapa('aprovada');
          setPontos((p) => p + PONTOS_POR_FOTO);
        } else {
          setEtapa('recusada');
        }
      } catch (erroIA) {
        console.warn('Falha ao verificar a imagem:', erroIA);
        setEtapa('idle');
        setToast('Não consegui verificar a foto. Confira a internet e tente de novo.');
      }

      // Envia a foto para o Supabase Storage (pasta conforme o veredito)
      let fotoFinal = image.webPath;
      setUpload('enviando');
      try {
        const pasta = r ? (r.ok ? 'aprovadas' : 'recusadas') : 'nao-verificadas';
        const urlPublica = await enviarFoto(image.webPath, pasta);
        fotoFinal = urlPublica;
        setUrlNuvem(urlPublica);
        setUpload('ok');
      } catch (erroUpload) {
        console.warn('Falha no upload:', erroUpload);
        setUpload('erro');
        setToast('Foto não enviada para a nuvem. Confira a internet e o .env.');
      }

      if (r?.ok) {
        setHistorico((h) => [{ foto: fotoFinal, item: r.item, material: r.material }, ...h].slice(0, 5));
      }
    } catch (error) {
      // Escudo de resiliência: usuário cancelou (botão Voltar) ou houve falha
      console.warn('Ação cancelada pelo usuário:', error);
      const msg = String(error?.message || error).toLowerCase();
      setToast(
        msg.includes('permission') || msg.includes('denied')
          ? 'Permissão negada. Ative câmera e fotos nas configurações do Android.'
          : 'Ação cancelada. Nenhum ponto foi adicionado.'
      );
    }
  };

  const faltam = Math.max(META_PONTOS - pontos, 0);
  const segmentos = ['papel', 'plastico', 'vidro', 'metal'];
  const analisando = etapa === 'analisando';
  const ocupado = analisando || upload === 'enviando';

  return (
    <div className="min-h-screen bg-fundo text-tinta font-sans">
      {/* Topo: marca + progresso do desconto */}
      <header className="bg-floresta text-white px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-12">
        <div className="mx-auto max-w-md">
          <h1 className="text-4xl font-extrabold tracking-tight">Recicla Já</h1>
          <p className="mt-1 text-sm text-white/70">Separe, fotografe e ganhe desconto.</p>

          <div className="mt-7 flex items-end justify-between">
            <div>
              <span className="text-6xl font-extrabold leading-none tabular-nums">{pontos}</span>
              <span className="ml-1.5 text-white/70">/ {META_PONTOS} pts</span>
            </div>
            <span className="text-sm text-right text-white/80 max-w-[9rem] leading-tight">
              {faltam > 0 ? `faltam ${faltam} para 10% de desconto` : 'Desconto de 10% liberado!'}
            </span>
          </div>

          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {segmentos.map((m, i) => {
              const parte = Math.min(Math.max((pontos - i * 25) / 25, 0), 1);
              return (
                <div key={m} className="h-2.5 flex-1 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${MATERIAIS[m].bg} transition-[width] duration-500`}
                    style={{ width: `${parte * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="-mt-6 rounded-t-[2rem] bg-fundo px-5 pt-6 pb-28">
        <div className="mx-auto max-w-md space-y-5">
          {/* Visor */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-mata shadow-lg">
            {fotoReciclavel ? (
              <img src={urlNuvem || fotoReciclavel} alt="Embalagem fotografada" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/60">
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <p className="text-sm">Enquadre a embalagem bem à vista, sem outros objetos por perto.</p>
              </div>
            )}

            {/* cantos do visor */}
            {['top-3 left-3 border-t-2 border-l-2 rounded-tl-xl',
              'top-3 right-3 border-t-2 border-r-2 rounded-tr-xl',
              'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-xl',
              'bottom-3 right-3 border-b-2 border-r-2 rounded-br-xl'].map((c) => (
              <span key={c} className={`pointer-events-none absolute h-7 w-7 border-white/80 ${c}`} />
            ))}

            {/* status do upload */}
            {upload !== 'idle' && (
              <span className={`absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold shadow ${
                upload === 'ok' ? 'bg-vidro text-white' : upload === 'erro' ? 'bg-plastico text-white' : 'bg-white/90 text-tinta'
              }`}>
                {upload === 'enviando' ? 'Enviando para a nuvem…' : upload === 'ok' ? 'Salva na nuvem ✓' : 'Falha no envio'}
              </span>
            )}

            {/* veredito sobre a foto */}
            {etapa === 'aprovada' && resultado && (
              <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold shadow-lg ${MATERIAIS[resultado.material].bg} ${MATERIAIS[resultado.material].texto}`}>
                {resultado.item} · {MATERIAIS[resultado.material].nome}
              </div>
            )}
            {analisando && (
              <div className="absolute inset-0 flex items-center justify-center bg-mata/60">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              </div>
            )}
          </div>

          {/* Mensagem de resultado */}
          {etapa === 'aprovada' && resultado && (
            <p className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <strong>+{PONTOS_POR_FOTO} pontos!</strong> Descarte na lixeira{' '}
              <strong>{MATERIAIS[resultado.material].lixeira}</strong>.
            </p>
          )}
          {etapa === 'recusada' && (
            <p className="rounded-2xl bg-white p-4 text-sm shadow-sm">
              <strong>Isso não parece uma embalagem reciclável.</strong> Nenhum ponto foi adicionado.
              Tente de novo com a embalagem em primeiro plano.
            </p>
          )}
          {analisando && <p className="text-center text-sm text-tinta/70">Analisando embalagem…</p>}
          {modelo === 'carregando' && etapa === 'idle' && (
            <p className="text-center text-xs text-tinta/60">Preparando o verificador (precisa de internet na 1ª vez)…</p>
          )}
          {modelo === 'erro' && etapa === 'idle' && (
            <p className="text-center text-xs text-plastico">Verificador indisponível. Confira a internet.</p>
          )}

          {/* Botão principal */}
          <button
            onClick={validarReciclagem}
            disabled={ocupado}
            className="w-full rounded-2xl bg-metal px-4 py-4 text-lg font-extrabold text-tinta shadow-md active:scale-[0.98] transition disabled:opacity-60"
          >
            {analisando ? 'Analisando…' : upload === 'enviando' ? 'Enviando…' : 'Tirar Foto / Galeria'}
          </button>

          {/* Histórico */}
          {historico.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-tinta/70">Suas últimas reciclagens</h2>
              <ul className="space-y-2">
                {historico.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm">
                    <img src={h.foto} alt="" className="h-12 w-12 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold leading-tight">{h.item}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-tinta/70">
                        <span className={`h-2.5 w-2.5 rounded-full ${MATERIAIS[h.material].bg}`} />
                        Lixeira {MATERIAIS[h.material].lixeira}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-vidro">+{PONTOS_POR_FOTO}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Legenda das lixeiras */}
          <section>
            <h2 className="mb-2 text-sm font-bold text-tinta/70">Cada cor, uma lixeira</h2>
            <div className="grid grid-cols-4 gap-2">
              {Object.values(MATERIAIS).map((m) => (
                <div key={m.nome} className={`rounded-xl py-2 text-center text-xs font-bold ${m.bg} ${m.texto}`}>
                  {m.nome}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl bg-tinta px-4 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
