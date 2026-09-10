# Winsig MCP Server

Servidor [MCP](https://modelcontextprotocol.io) que liga modelos de IA (Claude, ChatGPT, Gemini ou qualquer cliente compatível com o protocolo) ao **Cegid PHC CS** e, no futuro, a outras soluções do ecossistema **Winsig** — com autenticação por integração, permissões granulares e auditoria de cada pedido.

Inspirado no posicionamento do [TOTAL MCP Server da Totalsoft](https://totalsoft.pt/total-mcp-server.html): a IA nunca acede diretamente à base de dados do ERP, só através deste hub.

> **Onde é que isto está "alojado"?** Em lado nenhum, por agora. Isto é código-fonte neste repositório (branch `claude/total-mcp-server-improved-j4auhb`) — não há nenhum servidor público a correr. Para o testares, corres o hub na tua própria máquina (ou num servidor que controles) seguindo as instruções abaixo. Isso é também intencional: um dos pontos de venda deste tipo de produto é que corre dentro da infraestrutura da empresa, nunca num serviço externo.

## Porquê esta arquitetura

> **Nota importante:** ainda não há acesso à API do PHC Web / PHC CS neste projeto. Por isso, todo o acesso a dados passa por uma interface abstrata (`PhcConnector`) com uma implementação **mock** (`MockPhcConnector`) que devolve dados fictícios realistas. Isto permite construir e testar o hub completo — auth, permissões, auditoria, ferramentas MCP — já, e trocar apenas essa peça quando a API real estiver disponível.

```
Modelo de IA A ──┐                          Modelo de IA B ──┐
  (stdio, 1      │                            (HTTP, sessão  │
  integração)    ▼                            própria)       ▼
          ┌───────────────────┐        ┌───────────────────┐
          │  processo stdio   │        │  sessão HTTP B     │
          │  (identidade fixa)│        │  (identidade B)    │
          └─────────┬─────────┘        └─────────┬─────────┘
                     │                            │
                     ▼                            ▼
              1. Auth        → CredentialStore (por sessão/processo)
              2. Permissões  → requireScope()
              3. Ferramentas → src/tools/*
              4. Auditoria   → AuditSink (partilhado)
              5. Conector    → PhcConnector (partilhado)
                     │
                     ▼ (mock por agora)
            Cegid PHC CS / API PHC Web
```

Nenhuma ferramenta MCP fala diretamente com o PHC: passa sempre por `requireScope` (permissões) e é sempre registada no `AuditSink` (auditoria), com sucesso ou falha. No transporte HTTP, cada sessão autentica-se com a sua própria API key e fica isolada das restantes — mas todas partilham o mesmo `connector` (a mesma fonte de dados) e o mesmo `auditSink` (o mesmo registo de auditoria), tal como um hub multi-integração real.

## Estrutura do projeto

```
src/
  auth/            Credenciais por integração (API key → identidade + scopes)
  permissions/      Scopes disponíveis e verificação de acesso
  audit/            Registo append-only de cada pedido
  connectors/phc/   Interface PhcConnector + MockPhcConnector (dados fictícios)
  tools/            Ferramentas MCP expostas (list_clients, get_client, list_stock,
                     list_invoices, create_order)
  server.ts         Monta o McpServer (identidade + connector + auditSink → ferramentas)
  index.ts          Ponto de entrada — transporte stdio (1 processo = 1 integração)
  httpServer.ts     Hub HTTP multi-tenant (Streamable HTTP) — várias integrações
                     em simultâneo, cada uma com a sua sessão e a sua API key
  httpIndex.ts      Ponto de entrada — transporte HTTP
config/
  integrations.example.json   Modelo de configuração de integrações
test/               Testes unitários e de integração (node:test, via tsx)
```

## Como correr localmente

```bash
npm install

# 1. Criar a configuração de integrações a partir do exemplo
cp config/integrations.example.json config/integrations.json

# 2. Gerar o hash de uma API key à escolha e colocá-lo no ficheiro acima
npm run hash-key -- "uma-api-key-secreta-para-esta-integracao"
```

Há dois transportes — usa o que fizer sentido para o que estás a testar:

### Opção A — stdio (um processo por integração)

É assim que clientes MCP locais como o Claude Desktop arrancam servidores: lançam um processo com uma API key fixa no ambiente.

```bash
WINSIG_MCP_API_KEY="uma-api-key-secreta-para-esta-integracao" npm run dev
```

Para inspecionar interativamente as ferramentas, usa o [MCP Inspector](https://modelcontextprotocol.io/legacy/tools/inspector):

```bash
npm run build
npx @modelcontextprotocol/inspector -- node dist/index.js
```

### Opção B — HTTP (hub multi-tenant, várias integrações em simultâneo)

```bash
npm run dev:http
# [winsig-mcp-server] Hub HTTP a correr em http://127.0.0.1:3000/mcp
```

Cada cliente autentica-se com `Authorization: Bearer <api-key>` no pedido `initialize`; a partir daí usa o `mcp-session-id` que o servidor devolve. Ver a secção **"Como testar o hub HTTP"** abaixo para um passo-a-passo completo com `curl`, e o `Inspector` também suporta este modo (escolhe "Streamable HTTP" e cola o URL + o header de autenticação).

### Variáveis de ambiente

| Variável | Transporte | Obrigatória | Default | Descrição |
|---|---|---|---|---|
| `WINSIG_MCP_API_KEY` | stdio | Sim | — | API key desta integração (texto plano; só o hash é comparado) |
| `WINSIG_MCP_INTEGRATIONS_FILE` | ambos | Não | `config/integrations.json` | Caminho para o ficheiro de credenciais |
| `WINSIG_MCP_AUDIT_LOG_FILE` | ambos | Não | `logs/audit.log` | Caminho para o log de auditoria (JSON Lines) |
| `WINSIG_MCP_HTTP_PORT` | HTTP | Não | `3000` | Porta onde o hub HTTP escuta |
| `WINSIG_MCP_HTTP_HOST` | HTTP | Não | `127.0.0.1` | Endereço onde o hub HTTP escuta |

## Como testar o hub HTTP com `curl`

Depois de `npm run build` e `npm run dev:http` (ou `node dist/httpIndex.js`) num terminal:

```bash
# 1. Verificação de saúde (sem autenticação)
curl http://127.0.0.1:3000/healthz
# {"status":"ok","activeSessions":0}

# 2. Abrir sessão — envia "initialize" com a API key no header
curl -i -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer uma-api-key-secreta-para-esta-integracao" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-demo","version":"0.0.1"}}}'
# A resposta traz o header "mcp-session-id: <uuid>" — guarda esse valor.

# 3. Confirmar a inicialização (obrigatório antes de chamar ferramentas)
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer uma-api-key-secreta-para-esta-integracao" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <uuid-do-passo-2>" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 4. Listar ferramentas disponíveis
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer uma-api-key-secreta-para-esta-integracao" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <uuid-do-passo-2>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 5. Chamar uma ferramenta
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer uma-api-key-secreta-para-esta-integracao" \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <uuid-do-passo-2>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_clients","arguments":{"search":"ferragens"}}}'
```

Abre um segundo terminal e repete os passos 2-5 com uma **API key diferente** (com scopes diferentes) para veres duas sessões em simultâneo, isoladas uma da outra — é exatamente isto que o teste automático `test/httpServer.test.ts` verifica.

Isto foi validado de ponta a ponta neste ambiente (sessão, `notifications/initialized`, `tools/list`, `tools/call`, com o pedido a aparecer no `logs/audit.log`).

## Testes

```bash
npm test
```

Cobre: resolução e revogação de credenciais, verificação de permissões, o `MockPhcConnector`, o registo de auditoria (sucesso e falha), o fluxo completo de uma ferramenta (`runTool`) — incluindo o caso de pedido negado por falta de scope — e o hub HTTP de ponta a ponta: autenticação por sessão, duas sessões concorrentes com scopes diferentes isoladas uma da outra, e o `connector` partilhado a manter estado entre sessões independentes.

## Scopes disponíveis

Definidos em `src/permissions/scopes.ts`:

- `clients:read` — consultar clientes
- `stock:read` — consultar stocks/artigos
- `invoices:read` — consultar faturas
- `orders:write` — criar encomendas

Cada integração (cada API key) só usa as ferramentas cujo scope tenha atribuído em `config/integrations.json`. Um pedido sem o scope necessário é recusado **e continua a ficar registado na auditoria**, com o motivo da recusa.

## Ferramentas MCP disponíveis

| Ferramenta | Scope | Descrição |
|---|---|---|
| `list_clients` | `clients:read` | Lista clientes, com filtro por nome/NIF/código |
| `get_client` | `clients:read` | Ficha de um cliente por código |
| `list_stock` | `stock:read` | Lista artigos e quantidades disponíveis |
| `list_invoices` | `invoices:read` | Lista faturas, com filtro por cliente |
| `create_order` | `orders:write` | Cria uma encomenda de cliente (valida cliente e artigos) |

## Roteiro / próximos passos

1. **Conector real do PHC Web** — implementar `PhcWebApiConnector` (mesma interface `PhcConnector`) assim que houver acesso à API/documentação do PHC Web / PHC CS. Nenhuma outra camada muda.
2. ~~Transporte HTTP multi-tenant~~ — feito: `src/httpServer.ts` (Streamable HTTP), uma sessão por ligação, identidade resolvida por `Authorization: Bearer` no `initialize`.
3. **Deploy real** — hoje só corre localmente (`npm run dev:http`). Falta empacotar (Docker), colocar atrás de TLS/reverse proxy, e decidir onde corre dentro da infraestrutura Winsig/cliente.
4. **Mapeamento aos perfis reais do PHC** — hoje os scopes são definidos manualmente; o objetivo é herdar diretamente os perfis e permissões já configurados no PHC CS.
5. **Outros conectores Winsig** — o padrão `Connector` + ferramentas + scopes é reutilizável: outras soluções Winsig podem expor o seu próprio conector e o seu próprio conjunto de ferramentas/scopes, plugados no mesmo hub.
6. **Armazenamento de credenciais e auditoria em base de dados própria** — trocar o ficheiro JSON e o log local por uma base de dados dedicada ao hub, com consola de administração para emitir/revogar credenciais e consultar auditoria.
7. **Expiração/renovação de sessões HTTP** — hoje as sessões ficam em memória sem limite de tempo; adicionar um timeout de inatividade.
