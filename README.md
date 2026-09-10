# Winsig MCP Server

Servidor [MCP](https://modelcontextprotocol.io) que liga modelos de IA (Claude, ChatGPT, Gemini ou qualquer cliente compatível com o protocolo) ao **Cegid PHC CS** e, no futuro, a outras soluções do ecossistema **Winsig** — com autenticação por integração, permissões granulares e auditoria de cada pedido.

Inspirado no posicionamento do [TOTAL MCP Server da Totalsoft](https://totalsoft.pt/total-mcp-server.html): a IA nunca acede diretamente à base de dados do ERP, só através deste hub.

## Porquê esta arquitetura

> **Nota importante:** ainda não há acesso à API do PHC Web / PHC CS neste projeto. Por isso, todo o acesso a dados passa por uma interface abstrata (`PhcConnector`) com uma implementação **mock** (`MockPhcConnector`) que devolve dados fictícios realistas. Isto permite construir e testar o hub completo — auth, permissões, auditoria, ferramentas MCP — já, e trocar apenas essa peça quando a API real estiver disponível.

```
Modelo de IA (Claude, ChatGPT, ...)
        │  MCP (stdio, e futuramente HTTP)
        ▼
┌────────────────────────────────────────┐
│           Winsig MCP Server             │
│                                          │
│  1. Auth        → CredentialStore       │
│  2. Permissões  → requireScope()        │
│  3. Ferramentas → src/tools/*           │
│  4. Auditoria   → AuditSink (log)       │
│  5. Conector    → PhcConnector          │
└──────────────────┬───────────────────────┘
                    │ (mock por agora)
                    ▼
            Cegid PHC CS / API PHC Web
```

Nenhuma ferramenta MCP fala diretamente com o PHC: passa sempre por `requireScope` (permissões) e é sempre registada no `AuditSink` (auditoria), com sucesso ou falha.

## Estrutura do projeto

```
src/
  auth/            Credenciais por integração (API key → identidade + scopes)
  permissions/      Scopes disponíveis e verificação de acesso
  audit/            Registo append-only de cada pedido
  connectors/phc/   Interface PhcConnector + MockPhcConnector (dados fictícios)
  tools/            Ferramentas MCP expostas (list_clients, get_client, list_stock,
                     list_invoices, create_order)
  server.ts         Monta o McpServer e regista as ferramentas
  index.ts          Ponto de entrada (transporte stdio)
config/
  integrations.example.json   Modelo de configuração de integrações
test/               Testes unitários (node:test, via tsx)
```

## Como correr localmente

```bash
npm install

# 1. Criar a configuração de integrações a partir do exemplo
cp config/integrations.example.json config/integrations.json

# 2. Gerar o hash de uma API key à escolha e colocá-lo no ficheiro acima
npm run hash-key -- "uma-api-key-secreta-para-esta-integracao"

# 3. Arrancar o servidor (uma integração = uma API key = um processo, por agora)
WINSIG_MCP_API_KEY="uma-api-key-secreta-para-esta-integracao" npm run dev
```

O servidor comunica por **stdio** — é assim que a generalidade dos clientes MCP (Claude Desktop, etc.) arranca servidores locais. Para inspecionar interativamente as ferramentas disponíveis, usa o [MCP Inspector](https://modelcontextprotocol.io/legacy/tools/inspector):

```bash
npx @modelcontextprotocol/inspector -- node dist/index.js
```
(corre `npm run build` primeiro, ou aponta o Inspector para `tsx src/index.ts`)

### Variáveis de ambiente

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `WINSIG_MCP_API_KEY` | Sim | — | API key desta integração (texto plano; só o hash é comparado) |
| `WINSIG_MCP_INTEGRATIONS_FILE` | Não | `config/integrations.json` | Caminho para o ficheiro de credenciais |
| `WINSIG_MCP_AUDIT_LOG_FILE` | Não | `logs/audit.log` | Caminho para o log de auditoria (JSON Lines) |

## Testes

```bash
npm test
```

Cobre: resolução e revogação de credenciais, verificação de permissões, o `MockPhcConnector`, o registo de auditoria (sucesso e falha) e o fluxo completo de uma ferramenta (`runTool`) — incluindo o caso de pedido negado por falta de scope.

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
2. **Transporte HTTP multi-tenant** — hoje o servidor corre um processo por integração (stdio, credencial fixa no arranque). Para funcionar como hub central para várias integrações em simultâneo, adicionar um transporte HTTP (Streamable HTTP) que resolva a identidade por pedido a partir de um header de autenticação.
3. **Mapeamento aos perfis reais do PHC** — hoje os scopes são definidos manualmente; o objetivo é herdar diretamente os perfis e permissões já configurados no PHC CS.
4. **Outros conectores Winsig** — o padrão `Connector` + ferramentas + scopes é reutilizável: outras soluções Winsig podem expor o seu próprio conector e o seu próprio conjunto de ferramentas/scopes, plugados no mesmo hub.
5. **Armazenamento de credenciais e auditoria em base de dados própria** — trocar o ficheiro JSON e o log local por uma base de dados dedicada ao hub, com consola de administração para emitir/revogar credenciais e consultar auditoria.
