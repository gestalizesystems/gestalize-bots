// Lógica de conversa do bot (triagem, menus, IA, handoff), separada do transporte de mensagens.
// O envio é injetado via configurar(fn), onde fn(para, texto) entrega a mensagem (Cloud API).

const { triar } = require("./triage");
const { responder, limparHistorico } = require("./ai");
const config = require("./config");

let enviar = async () => {}; // definido pelo ponto de entrada (Cloud API ou web.js)
function configurar(fn) {
  enviar = fn;
}

// ===== Estado por contato (em memória) =====
const pausados = new Map(); // contactId -> { timer, ultimaMsg }
const aguardandoFecho = new Map(); // contactId -> { timer }
const menuContexto = new Map(); // contactId -> opções do menu atual

const PAUSA_SILENCIO_MS = 60 * 60 * 1000; // 1h de silêncio do cliente → "posso ajudar?"
const SEM_RESPOSTA_MS = 2 * 60 * 60 * 1000; // sem resposta em 2h → finaliza
const LIMITE_REENGAJAR_MS = 24 * 60 * 60 * 1000; // não reengaja conversas paradas há +24h

const FECHO_PALAVRAS = ["nao", "no", "obrigado", "obrigada", "obg", "vlw", "valeu", "era so isso", "so isso", "so isso mesmo", "era isso", "isso mesmo", "tudo certo", "ok", "blz", "beleza", "nada mais", "agradecido", "grato", "grata", "por enquanto so"];

function normaliza(t) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function ehFecho(t) {
  const n = normaliza(t);
  if (!n || n.length > 28) return false;
  return FECHO_PALAVRAS.some((p) => n === p || n.includes(p));
}

function pausar(contactId) {
  const atual = pausados.get(contactId);
  if (atual && atual.timer) clearTimeout(atual.timer);
  const timer = setTimeout(() => aoSilenciar(contactId), PAUSA_SILENCIO_MS);
  pausados.set(contactId, { timer, ultimaMsg: Date.now() });
}

async function aoSilenciar(contactId) {
  const p = pausados.get(contactId);
  pausados.delete(contactId);
  if (!p || Date.now() - p.ultimaMsg > LIMITE_REENGAJAR_MS) return;
  try {
    await enviar(contactId, "Posso te ajudar em mais alguma coisa? 😊");
    const timer = setTimeout(() => finalizar(contactId, true), SEM_RESPOSTA_MS);
    aguardandoFecho.set(contactId, { timer });
  } catch (e) {
    console.error("Falha ao reengajar:", e.message);
  }
}

async function finalizar(contactId, enviarDespedida) {
  const f = aguardandoFecho.get(contactId);
  if (f && f.timer) clearTimeout(f.timer);
  aguardandoFecho.delete(contactId);
  menuContexto.delete(contactId);
  limparHistorico(contactId);
  if (enviarDespedida) {
    try {
      await enviar(contactId, "Atendimento finalizado, qualquer coisa é só chamar! 🐾");
    } catch (e) {
      console.error("Falha ao finalizar:", e.message);
    }
  }
}

// Processa uma mensagem recebida do cliente.
async function processar(from, texto) {
  // Bot desligado no painel → não responde nada.
  if (!config.get().botAtivo) return;

  // Atendimento humano em andamento: fica quieto e reinicia o cronômetro de silêncio.
  if (pausados.has(from)) {
    pausar(from);
    return;
  }

  // Resposta ao "Posso te ajudar em mais alguma coisa?".
  if (aguardandoFecho.has(from)) {
    if (ehFecho(texto)) {
      await finalizar(from, false);
      await enviar(from, "Atendimento finalizado, qualquer coisa é só chamar! 🐾");
      return;
    }
    await finalizar(from, false); // trouxe algo novo → começa um atendimento novo
  }

  const ctx = menuContexto.get(from) || null;
  const r = triar(texto, ctx);
  if ("novoContexto" in r) {
    if (r.novoContexto && r.novoContexto.length) menuContexto.set(from, r.novoContexto);
    else menuContexto.delete(from);
  }

  if (r.tipo === "atendente") {
    await enviar(from, r.resposta);
    pausar(from);
    return;
  }

  if (r.resposta) {
    await enviar(from, r.resposta);
    return;
  }

  // tipo === "ia": pergunta livre.
  const resp = await responder(from, texto);
  await enviar(from, resp.texto);
  if (resp.encaminhar) pausar(from); // a IA pediu um atendente humano
}

module.exports = { configurar, processar };
