// Alternativa de TESTE: conecta via QR code (whatsapp-web.js, NÃO-oficial).
// Útil para testar rápido com um chip de teste. Em produção, use o Cloud API (npm start).
// Rode com: npm run start:webjs

require("dotenv").config();

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const { iniciarAdmin } = require("./admin");
const conversa = require("./conversa");
const estado = require("./estado");

const ADMIN_PORT = process.env.ADMIN_PORT || 4500;

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Falta a variável GEMINI_API_KEY (chave do Google Gemini).");
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

// As respostas saem pelo whatsapp-web.js.
conversa.configurar((para, texto) => client.sendMessage(para, texto));

client.on("qr", (qr) => {
  console.log("\n📲 Escaneie o QR code no WhatsApp (Aparelhos conectados → Conectar aparelho):\n");
  qrcode.generate(qr, { small: true });
});
client.on("authenticated", () => console.log("🔐 Autenticado."));
client.on("ready", () => { estado.whatsappConectado = true; console.log("✅ Bot da Lecoland conectado e pronto!"); });
client.on("auth_failure", (msg) => { estado.whatsappConectado = false; console.error("❌ Falha de autenticação:", msg); });
client.on("disconnected", (reason) => { estado.whatsappConectado = false; console.warn("⚠️  Desconectado:", reason); });

client.on("message", async (msg) => {
  try {
    if (msg.from.endsWith("@g.us") || msg.isStatus) return;
    if (msg.type !== "chat" || !msg.body) return;
    await conversa.processar(msg.from, msg.body);
  } catch (err) {
    console.error("Erro ao processar mensagem:", err);
  }
});

iniciarAdmin(ADMIN_PORT)
  .then(() => client.initialize())
  .catch((err) => { console.error("Erro ao iniciar o painel:", err); client.initialize(); });

process.on("SIGINT", async () => {
  console.log("\n👋 Encerrando o bot...");
  await client.destroy();
  process.exit(0);
});
