// Cliente da WhatsApp Cloud API (oficial da Meta).
// Envia mensagens via Graph API. Precisa de WHATSAPP_TOKEN e WHATSAPP_PHONE_ID no .env.

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERSAO = process.env.WHATSAPP_API_VERSION || "v21.0";

function configurado() {
  return !!(TOKEN && PHONE_ID);
}

async function enviar(payload) {
  if (!configurado()) throw new Error("WhatsApp Cloud API não configurado (WHATSAPP_TOKEN/WHATSAPP_PHONE_ID).");
  const url = `https://graph.facebook.com/${VERSAO}/${PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`WhatsApp API ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

async function enviarTexto(para, texto) {
  return enviar({ to: para, type: "text", text: { preview_url: false, body: String(texto).slice(0, 4096) } });
}

async function enviarImagem(para, link, legenda) {
  const image = { link };
  if (legenda) image.caption = String(legenda).slice(0, 1024);
  return enviar({ to: para, type: "image", image });
}

module.exports = { configurado, enviarTexto, enviarImagem };
