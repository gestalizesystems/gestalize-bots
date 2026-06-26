// Memória de clientes (mini-CRM) do bot: nome, endereço e telefone, por contato.
// Guardado em data/clientes.json (no Volume do Railway, sobrevive a redeploys).

const fs = require("fs");
const path = require("path");

const DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const CAMINHO = path.join(DIR, "clientes.json");

let clientes = carregar();

function carregar() {
  try {
    return JSON.parse(fs.readFileSync(CAMINHO, "utf8"));
  } catch (_) {
    return {}; // ainda não há arquivo
  }
}

function persistir() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(CAMINHO, JSON.stringify(clientes, null, 2), "utf8");
  } catch (e) {
    console.error("Falha ao salvar clientes:", e.message);
  }
}

// Dados conhecidos de um contato (ou null).
function get(telefone) {
  return clientes[telefone] || null;
}

// Salva/atualiza só os campos informados (não apaga o que já existe).
function salvar(telefone, dados = {}) {
  if (!telefone) return null;
  const atual = clientes[telefone] || { telefone, criadoEm: Date.now() };
  if (dados.nome != null && String(dados.nome).trim()) atual.nome = String(dados.nome).trim();
  if (dados.endereco != null && String(dados.endereco).trim()) atual.endereco = String(dados.endereco).trim();
  atual.telefone = telefone;
  atual.atualizadoEm = Date.now();
  clientes[telefone] = atual;
  persistir();
  return atual;
}

// Edição manual pelo painel (sobrescreve, inclusive permitindo limpar um campo).
function definir(telefone, dados = {}) {
  if (!telefone) return null;
  const atual = clientes[telefone] || { telefone, criadoEm: Date.now() };
  ["nome", "endereco"].forEach((k) => {
    if (dados[k] != null) atual[k] = String(dados[k]).trim();
  });
  atual.telefone = telefone;
  atual.atualizadoEm = Date.now();
  clientes[telefone] = atual;
  persistir();
  return atual;
}

function remover(telefone) {
  delete clientes[telefone];
  persistir();
}

// Lista (mais recentes primeiro).
function listar() {
  return Object.values(clientes).sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
}

module.exports = { get, salvar, definir, remover, listar };
