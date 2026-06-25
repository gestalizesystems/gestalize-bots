# Migração: whatsapp-web.js → WhatsApp Cloud API (oficial)

Este documento descreve a migração do bot para a **WhatsApp Cloud API** oficial da Meta.

> ✅ **O código já está implementado.** `npm start` sobe o servidor (painel + webhook do
> Cloud API). Falta só **configurar a Meta** e preencher as variáveis (passos abaixo).
> O modo antigo por QR code continua disponível para teste: `npm run start:webjs`.

---

## ✅ Como ativar (passo a passo)

**Na Meta (uma vez):**
1. Crie uma conta no **Meta Business** (business.facebook.com).
2. Em **developers.facebook.com** → *Criar app* → tipo **Empresa/Business**.
3. No app, adicione o produto **WhatsApp**.
4. Pegue o **Phone Number ID** (em *WhatsApp → Configuração da API*). Para testar, a Meta dá
   um **número de teste grátis**; depois você adiciona o número real da loja.
5. Gere um **token de acesso permanente** (crie um *Usuário do sistema* no Business Settings
   com permissão de WhatsApp e gere um token que não expira).

**No projeto / `.env`:**
```
WHATSAPP_TOKEN=<seu token permanente>
WHATSAPP_PHONE_ID=<seu Phone Number ID>
WHATSAPP_VERIFY_TOKEN=<uma senha que você inventa>
```

**Deploy + webhook:**
6. Faça o deploy (Railway) e pegue sua **URL pública** (ex.: `https://lecoland.up.railway.app`).
7. Na Meta → *WhatsApp → Configuração → Webhook*:
   - **Callback URL:** `https://SUA-URL/webhook`
   - **Verify token:** o mesmo `WHATSAPP_VERIFY_TOKEN`
   - Clique em *Verificar e salvar* e **assine o campo `messages`**.
8. No painel, **ligue o bot** (interruptor no rodapé do menu).
9. Mande uma mensagem para o número no WhatsApp — o bot responde. 🎉

> 🔒 Hardening opcional (depois): validar a assinatura `X-Hub-Signature-256` com o
> *App Secret* para recusar webhooks falsos.

---

## Por que migrar (e quando)

A versão atual (`whatsapp-web.js`) é ótima para **protótipo, baixo volume e uso interno**:
grátis, rápida de subir, sem burocracia. Mas é **não-oficial** e tem limitações.

**Vale migrar para o oficial quando aparecer pelo menos um destes:**
- Volume de mensagens crescendo.
- Número que você **não pode perder** (o número oficial da loja).
- Necessidade de **botões clicáveis, listas ou templates**.
- Uso comercial sério, que precisa de **estabilidade e suporte**.

**Principais contras de continuar no `whatsapp-web.js`:**
- ⚠️ **Risco de banimento do número** (viola os Termos de Uso do WhatsApp).
- Pode **quebrar** quando o WhatsApp Web é atualizado.
- Depende de um **celular vinculado** (precisa entrar online a cada ~14 dias).
- Roda um **navegador (Chromium)** por baixo — mais pesado e frágil.
- **Sem** botões/listas/templates oficiais (por isso usamos o menu numerado).
- Sem suporte oficial nem garantias; **escala limitada**.

---

## Diferença fundamental de arquitetura

| | **whatsapp-web.js (atual)** | **Cloud API (oficial)** |
|---|---|---|
| Conexão | QR code, roda no seu Mac | API REST hospedada pela Meta |
| Receber mensagem | Evento local (`client.on("message")`) | **Webhook**: a Meta faz um POST numa URL pública sua |
| Enviar mensagem | `msg.reply()` | **POST HTTP** para a Graph API da Meta |
| Onde roda | Computador ligado + Chromium | **Servidor público (HTTPS), no ar 24h** |
| Botões/templates | ❌ não funcionam | ✅ funcionam |
| Risco de ban | Alto | Nenhum (é oficial) |

> 👉 A maior mudança: a Cloud API **não** entrega mensagens por evento local. A Meta
> envia para um **webhook** (URL pública sua), e você responde via **chamada HTTP**.
> Por isso precisa de um servidor público — não dá pra rodar só no `localhost`.

---

## Passo a passo da migração

### 1. Criar as contas na Meta
1. Conta no **Meta for Developers** (developers.facebook.com).
2. Criar um **App** do tipo *Business* e adicionar o produto **WhatsApp**.
3. Ter uma **Conta Comercial do WhatsApp (WABA)**. A Meta pode exigir
   **verificação do negócio** (documentos da empresa) para liberar limites maiores.

### 2. Conseguir o número e as credenciais
1. A Meta fornece um **número de teste gratuito** + um **token temporário (24h)**
   para começar sem custo.
2. Para produção: registrar um **número dedicado** (não pode estar em uso no app
   comum/Business) e gerar um **token permanente** (via "System User").
3. Anotar e guardar com segurança:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Access Token**
   - **App Secret** (para validar a assinatura do webhook)
   - **Verify Token** (uma senha que você inventa para o handshake do webhook)

### 3. Ter um servidor público (webhook)
- **Desenvolvimento:** usar um túnel como **ngrok** ou **cloudflared** que cria uma
  URL pública apontando para o seu Mac.
- **Produção:** hospedar em **Render, Railway, Fly.io** ou um **VPS**. O bot precisa
  ficar no ar mesmo com o computador desligado.

### 4. Configurar o webhook no painel da Meta
1. Em *WhatsApp → Configuration*, informar a **URL do webhook**
   (ex.: `https://seu-servidor.com/webhook`) e o **Verify Token**.
2. A Meta faz uma chamada de **verificação** (handshake): seu servidor precisa
   responder devolvendo o `hub.challenge`.
3. **Assinar o campo `messages`** para receber as mensagens dos clientes.

### 5. Receber e responder mensagens
1. Cliente manda mensagem → a Meta faz um **POST no seu webhook** com o texto e o
   número do remetente.
2. Você **envia a resposta** com um **POST** para:
   `https://graph.facebook.com/v<versão>/<Phone-Number-ID>/messages`
   usando seu **Access Token** no cabeçalho.

---

## O que mudaria neste projeto

**A boa notícia: quase tudo é reaproveitado.** Só muda a "porta de entrada/saída"
das mensagens — a lógica do bot fica intacta.

**Continua igual (sem mudanças):**
- `src/triage.js` — triagem por palavra-chave e menu numerado.
- `src/ai.js` — respostas livres via Google Gemini.
- `src/config.js` + `data/config.json` — configuração.
- `src/admin.js` + `public/admin.html` — o painel de administração.

**O que mudaria:**
- `src/index.js`: em vez de `whatsapp-web.js` + QR, um **servidor Express** (já temos
  por causa do painel!) com duas rotas:
  - `GET /webhook` → responde à verificação da Meta (devolve o `hub.challenge`).
  - `POST /webhook` → recebe a mensagem, chama `triar()` / `responder()` (igual a hoje)
    e **envia a resposta via HTTP** para a Graph API (no lugar do `msg.reply()`).
- **Sai** do projeto: `puppeteer`, o QR code e a pasta `.wwebjs_auth`.
- **Entra** no `.env`: `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`,
  `META_VERIFY_TOKEN`, `META_APP_SECRET`.

> Como a triagem (`triar`) já devolve a resposta em texto, basta trocar **quem entrega**
> essa resposta: hoje é o `msg.reply()`; na Cloud API seria um POST para a Meta.

---

## Regras e custos da Cloud API (atenção)

- ✅ **Botões/listas interativos passam a funcionar** e o número **não corre risco de
  bloqueio**.
- ⏰ **Janela de 24h:** você só pode enviar mensagens "livres" até 24h após a última
  mensagem do cliente. Como o bot **responde a quem escreveu**, normalmente está dentro
  da janela. Mensagens **proativas** (iniciadas por você) exigem **templates aprovados**.
- 📝 **Templates:** mensagens fora da janela ou iniciadas por você precisam ser
  cadastradas e **aprovadas pela Meta** antes do uso.
- 💰 **Custo:** a Cloud API é **paga por mensagem/conversa** (a cobrança recai
  principalmente sobre mensagens iniciadas por você/templates; conversas iniciadas pelo
  cliente costumam ter isenção ou volume gratuito). **Confira os valores atuais** na
  documentação da Meta — eles mudam com o tempo.
- 🏢 **Verificação do negócio** pode ser exigida para sair do número de teste e aumentar
  o limite de mensagens.

---

## Resumo em uma frase

Migrar é, na prática: **(1)** abrir conta/app na Meta e pegar as credenciais →
**(2)** hospedar o bot numa URL pública → **(3)** trocar a camada de WhatsApp
(QR → webhook + Graph API), **mantendo toda a lógica de negócio e o painel como estão**.

---

## Links úteis (referência)

- Meta for Developers: https://developers.facebook.com/
- Documentação Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- Primeiros passos (Get Started): https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Preços do WhatsApp Business: https://developers.facebook.com/docs/whatsapp/pricing
