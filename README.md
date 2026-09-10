# Winsig MCP Server

Hub [MCP](https://modelcontextprotocol.io) multi-sistema que liga modelos de IA (Claude, ChatGPT, Gemini ou qualquer cliente compatível com o protocolo) a vários sistemas de gestão — hoje o **Cegid PHC CS** e o **Factorial** (RH), amanhã Sage, Primavera, SAP, Odoo ou outra solução Winsig — com autenticação por integração, permissões granulares e auditoria de cada pedido, num único ponto de entrada.

Inspirado no posicionamento do [TOTAL MCP Server da Totalsoft](https://totalsoft.pt/total-mcp-server.html) — a IA nunca acede diretamente à base de dados do ERP, só através deste hub — mas desenhado desde a base para **não ficar preso a um único fornecedor**: um hub, muitos sistemas ligados, um só modelo de segurança. É essa a principal diferenciação que estamos a construir.

> **Onde é que isto está "alojado"?** Em lado nenhum, por agora. Isto é código-fonte neste repositório (branch `claude/total-mcp-server-improved-j4auhb`) — não há nenhum servidor público a correr. Para o testares, corres o hub na tua própria máquina (ou num servidor que controles) seguindo as instruções abaixo. Isso é também intencional: um dos pontos de venda deste tipo de produto é que corre dentro da infraestrutura da empresa, nunca num serviço externo.

## Teste rápido (± 5 minutos, sem experiência de programação)

Isto arranca o servidor e abre uma página no browser com botões para cada ferramenta — não precisas de saber usar `curl` nem `git`.

**Passo 1 — Instalar o Node.js** (só uma vez, se ainda não tiveres)
Vai a [nodejs.org](https://nodejs.org), descarrega a versão **LTS** para o teu sistema e instala-a como qualquer outro programa (Seguinte → Seguinte → Concluir).

**Passo 2 — Descarregar o código deste projeto**
No GitHub, abre este repositório, muda para o branch `claude/total-mcp-server-improved-j4auhb` (menu à esquerda onde diz "main"), clica no botão verde **Code** e escolhe **Download ZIP**. Descompacta o ficheiro `.zip` — vais ter uma pasta chamada algo como `WIN-MCP-JO-claude-total-mcp-server-improved-j4auhb`.

**Passo 3 — Abrir um terminal nessa pasta**
- **Windows:** abre a pasta no Explorador de Ficheiros, clica na barra de endereço no topo, escreve `cmd` e carrega Enter.
- **Mac:** abre o Terminal (Spotlight: `Cmd+Espaço`, escreve "Terminal", Enter), escreve `cd ` (com um espaço a seguir) e depois arrasta a pasta do projeto para dentro da janela do Terminal — o caminho preenche-se sozinho — e carrega Enter.

**Passo 4 — Correr estes comandos, um de cada vez** (copia e cola, Enter a seguir a cada um)

```bash
npm install
```
Copia o ficheiro de configuração de demonstração (já vem com uma chave de teste pronta a usar):
```bash
# Mac/Linux:
cp config/integrations.demo.json config/integrations.json
# Windows (cmd):
copy config\integrations.demo.json config\integrations.json
```
Depois:
```bash
npm run build
npm run dev:http
```
Vais ver algo como `Hub HTTP a correr em http://127.0.0.1:3000/mcp`. **Deixa este terminal aberto** — é o servidor a correr.

**Passo 5 — Abrir a consola de testes**
Abre o browser em **http://localhost:3000**. No campo "API key da integração" escreve:

```
chave-demo-teste
```

Clica **Ligar** e depois experimenta os botões: "Listar clientes" (pesquisa por `ferragens`, por exemplo), "Consultar cliente" (código `C0001`), "Criar encomenda" (cliente `C0001`, artigo `ART001`, quantidade `2`) — e também a secção **Factorial (RH)**, um segundo sistema ligado ao mesmo hub, com "Listar colaboradores" (pesquisa por `engenharia`, por exemplo). Cada pedido e resposta aparece no painel preto em baixo.

> ⚠️ A chave `chave-demo-teste` e o ficheiro `integrations.demo.json` são só para este teste local — nunca usar em produção. Para criar as tuas próprias integrações/chaves, ver a secção "Como correr localmente" abaixo.

Para parar o servidor, volta ao terminal onde ele ficou a correr e carrega `Ctrl+C`.

## Porquê esta arquitetura

> **Nota importante:** ainda não há acesso à API do PHC Web / PHC CS (nem à API do Factorial) neste projeto. Por isso, todo o acesso a dados passa por interfaces abstratas (`PhcConnector`, `FactorialConnector`) com implementações **mock** que devolvem dados fictícios realistas. Isto permite construir e testar o hub completo — auth, permissões, auditoria, ferramentas MCP, múltiplos conectores — já, e trocar cada mock pela integração real à medida que o acesso a cada sistema for ficando disponível, sem tocar nas outras camadas.

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
              2. Permissões  → requireScope() — scopes prefixados por sistema
              3. Ferramentas → um ConnectorModule por sistema ligado
                     ├── phc.*        (5 ferramentas, scope "phc:...")
                     └── factorial.*  (2 ferramentas, scope "factorial:...")
              4. Auditoria   → AuditSink (partilhado, todos os sistemas)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  PhcConnector              FactorialConnector
  (mock por agora)          (mock por agora)
        │                         │
        ▼                         ▼
  Cegid PHC CS /             Factorial
  API PHC Web                (API real)
```

Nenhuma ferramenta MCP fala diretamente com um sistema de gestão: passa sempre por `requireScope` (permissões) e é sempre registada no `AuditSink` (auditoria), com sucesso ou falha. No transporte HTTP, cada sessão autentica-se com a sua própria API key e fica isolada das restantes — mas todas partilham os mesmos conectores (as mesmas fontes de dados) e o mesmo `auditSink` (o mesmo registo de auditoria), tal como um hub multi-integração real.

O hub em si (`server.ts`) **não sabe nada sobre PHC ou Factorial especificamente** — só sabe iterar uma lista de `ConnectorModule`. Ver a secção "Arquitetura multi-conector" abaixo para o que isso significa na prática ao adicionar Sage, Primavera, SAP ou Odoo.

## Estrutura do projeto

```
src/
  auth/              Credenciais por integração (API key → identidade + scopes + attributes)
  permissions/       Scopes agregados de todos os conectores, perfis (roles.ts) + verificação de acesso
  audit/             Registo append-only de cada pedido
  tools/helpers.ts   runTool/textResult/errorResult — genéricos, usados por qualquer conector
  connectors/
    registry.ts      ConnectorModule — o "plugue" que qualquer sistema tem de implementar
    phc/             Conector Cegid PHC CS
      types.ts             Tipos de domínio + interface PhcConnector
      mockConnector.ts     MockPhcConnector (dados fictícios)
      sqlConfig.ts         Configuração segura de ligação ao SQL Server real (a partir de env vars)
      sqlServerConnector.ts PhcSqlServerConnector — conector real (ver "Ligar ao PHC real")
      inspectSchemaCli.ts  Script de introspeção do esquema real (só catálogo, nunca dados)
      scopes.ts            PHC_SCOPES ("phc:clients:read", "phc:orders:write", ...)
      tools/               Ferramentas MCP (phc.list_clients, phc.create_order, ...)
      module.ts            Junta tudo num ConnectorModule
    factorial/       Conector Factorial (RH) — mesmo padrão do PHC, prova o conceito
      types.ts, mockConnector.ts, scopes.ts, rowLevel.ts, tools/, module.ts
  modules.ts         Escolhe mock vs. real (WINSIG_PHC_MODE) e lista os conectores ligados ao hub
  server.ts          Monta o McpServer (identidade + lista de módulos + auditSink)
  index.ts           Ponto de entrada — transporte stdio (1 processo = 1 integração)
  httpServer.ts      Hub HTTP multi-tenant (Streamable HTTP) — várias integrações
                      em simultâneo, cada uma com a sua sessão e a sua API key
  httpIndex.ts       Ponto de entrada — transporte HTTP
public/
  console.html       Consola de testes servida em GET / pelo hub HTTP
config/
  integrations.example.json   Modelo de configuração (a preencher com as tuas chaves)
  integrations.demo.json      Configuração de demonstração para o "Teste rápido"
.env.example         Modelo de variáveis de ambiente (ligação ao SQL Server real, etc.)
test/                Testes unitários e de integração (node:test, via tsx)
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

Cada cliente autentica-se com `Authorization: Bearer <api-key>` no pedido `initialize`; a partir daí usa o `mcp-session-id` que o servidor devolve. Três formas de testar:

- **Consola no browser** (a mais simples): abre `http://127.0.0.1:3000` — é a página usada no "Teste rápido" acima.
- **`curl`**: ver a secção "Como testar o hub HTTP com curl" abaixo.
- **MCP Inspector**: `npx @modelcontextprotocol/inspector`, escolhe "Streamable HTTP", cola o URL (`http://127.0.0.1:3000/mcp`) e o header `Authorization: Bearer <api-key>`.

### Variáveis de ambiente

| Variável | Transporte | Obrigatória | Default | Descrição |
|---|---|---|---|---|
| `WINSIG_MCP_API_KEY` | stdio | Sim | — | API key desta integração (texto plano; só o hash é comparado) |
| `WINSIG_MCP_INTEGRATIONS_FILE` | ambos | Não | `config/integrations.json` | Caminho para o ficheiro de credenciais |
| `WINSIG_MCP_AUDIT_LOG_FILE` | ambos | Não | `logs/audit.log` | Caminho para o log de auditoria (JSON Lines) |
| `WINSIG_MCP_HTTP_PORT` | HTTP | Não | `3000` | Porta onde o hub HTTP escuta |
| `WINSIG_MCP_HTTP_HOST` | HTTP | Não | `127.0.0.1` | Endereço onde o hub HTTP escuta |
| `WINSIG_PHC_MODE` | ambos | Não | `mock` | `mock` (dados fictícios) ou `real` (SQL Server real — ver "Ligar ao PHC real") |
| `WINSIG_PHC_DB_HOST`, `WINSIG_PHC_DB_NAME`, `WINSIG_PHC_DB_USER`, `WINSIG_PHC_DB_PASSWORD` | ambos | Só se `WINSIG_PHC_MODE=real` | — | Ligação ao SQL Server do PHC — ver `.env.example` |
| `WINSIG_PHC_ALLOW_WRITES` | ambos | Não | `false` | Interruptor de segurança para escritas reais (ex: `phc.create_order`) |

Variáveis podem vir de um ficheiro `.env` na raiz do projeto (copia `.env.example`) em vez de exportadas manualmente — carregado automaticamente (`dotenv`).

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
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"phc.list_clients","arguments":{"search":"ferragens"}}}'
```

Abre um segundo terminal e repete os passos 2-5 com uma **API key diferente** (com scopes diferentes) para veres duas sessões em simultâneo, isoladas uma da outra — é exatamente isto que o teste automático `test/httpServer.test.ts` verifica.

Isto foi validado de ponta a ponta neste ambiente (sessão, `notifications/initialized`, `tools/list`, `tools/call`, com o pedido a aparecer no `logs/audit.log`).

## Testes

```bash
npm test
```

Cobre: resolução e revogação de credenciais, perfis (roles) e restrição ao nível da linha, verificação de permissões (incluindo scopes de conectores diferentes), o `MockPhcConnector`, o registo de auditoria (sucesso e falha), o fluxo completo de uma ferramenta (`runTool`) — incluindo o caso de pedido negado por falta de scope — e o hub HTTP de ponta a ponta: autenticação por sessão, duas sessões concorrentes com scopes diferentes isoladas uma da outra, os conectores partilhados a manter estado entre sessões independentes, um segundo conector (Factorial) a funcionar lado a lado com o PHC no mesmo hub, e dois colaboradores diferentes a só conseguirem ver o seu próprio registo de RH, nunca o um do outro.

## Perfis de utilizador (roles)

Definidos em `src/permissions/roles.ts` — pacotes nomeados de scopes, para não teres de listar scopes um a um em cada integração. Uma integração usa `"role": "..."` em vez de (ou a somar a) `"scopes": [...]` em `config/integrations.json`:

| Perfil | Scopes | O que significa |
|---|---|---|
| `consultor` | `phc:clients:read`, `phc:stock:read` | Vê clientes e stocks; **sem acesso a vendas** (faturas/encomendas) nem a RH |
| `vendas` | `phc:clients:read`, `phc:stock:read`, `phc:invoices:read`, `phc:orders:write` | Acesso completo às operações comerciais do PHC |
| `rh-admin` | `factorial:employees:read` | Vê a ficha de qualquer colaborador |
| `colaborador` | `factorial:employees:read:self` | Só vê o seu **próprio** registo — ver secção seguinte |

Ver `config/integrations.example.json` para os seis exemplos completos (um por perfil, mais um caso com scopes explícitos sem perfil).

## Scopes disponíveis e restrição ao nível da linha

Agregados em `src/permissions/scopes.ts` a partir de cada conector — sempre prefixados com o id do sistema, para nunca colidirem entre si:

**Cegid PHC CS** (`src/connectors/phc/scopes.ts`)
- `phc:clients:read` — consultar clientes
- `phc:stock:read` — consultar stocks/artigos
- `phc:invoices:read` — consultar faturas
- `phc:orders:write` — criar encomendas

**Factorial** (`src/connectors/factorial/scopes.ts`)
- `factorial:employees:read` — consultar **qualquer** colaborador
- `factorial:employees:read:self` — consultar **só o próprio** registo (restrição ao nível da linha, não só ao nível da ferramenta)

O scope `:self` é diferente dos outros: não basta ter ou não ter a ferramenta — o resultado é filtrado por quem está a perguntar. Uma integração com este scope tem um `attributes.factorialEmployeeId` (ver `config/integrations.example.json`, integrações `colaborador-ana`/`colaborador-bruno`) que identifica o seu próprio registo; `phc.list_employees`/`phc.get_employee` usam-no para: (1) nunca devolver a lista completa, só o próprio registo, e (2) recusar um pedido a `get_employee` por um código que não seja o seu. Isto está implementado em `src/connectors/factorial/tools/` (não no conector — o mock/real de dados nem sabe que esta regra existe) e testado em `test/httpServer.test.ts` com dois colaboradores diferentes.

Cada integração (cada API key) só usa as ferramentas cujo scope tenha atribuído em `config/integrations.json` — de um ou de vários sistemas ao mesmo tempo, se fizer sentido (ex: uma integração com `phc:clients:read` + `factorial:employees:read`). Um pedido sem o scope necessário é recusado **e continua a ficar registado na auditoria**, com o motivo da recusa.

## Ferramentas MCP disponíveis

| Ferramenta | Scope | Descrição |
|---|---|---|
| `phc.list_clients` | `phc:clients:read` | Lista clientes, com filtro por nome/NIF/código |
| `phc.get_client` | `phc:clients:read` | Ficha de um cliente por código |
| `phc.list_stock` | `phc:stock:read` | Lista artigos e quantidades disponíveis |
| `phc.list_invoices` | `phc:invoices:read` | Lista faturas, com filtro por cliente |
| `phc.create_order` | `phc:orders:write` | Cria uma encomenda de cliente (valida cliente e artigos) |
| `factorial.list_employees` | `factorial:employees:read` **ou** `factorial:employees:read:self` | Lista colaboradores — todos, ou só o próprio, consoante o scope |
| `factorial.get_employee` | `factorial:employees:read` **ou** `factorial:employees:read:self` | Ficha de um colaborador — com `:self`, só a do próprio |

## Arquitetura multi-conector — como adicionar um novo sistema

Isto é o que diferencia este hub de um MCP-por-ERP: **o servidor não sabe nada sobre nenhum sistema em concreto.** `server.ts` só percorre uma lista de `ConnectorModule` (`src/connectors/registry.ts`) e pede a cada um para registar as suas ferramentas. O PHC e o Factorial são dois exemplos desse padrão — não casos especiais.

Para ligar um sistema novo (Sage, Primavera, SAP, Odoo, ou outro), a receita é sempre a mesma — usar `src/connectors/factorial/` como modelo, por ser o mais pequeno:

1. **`types.ts`** — tipos de domínio (ex: `Product`, `Order`) + uma interface abstrata (ex: `SageConnector`) com os métodos que queres expor.
2. **`mockConnector.ts`** — uma implementação com dados fictícios, para desenvolver e testar sem acesso à API real do sistema. Mais tarde, um `SageApiConnector` que implemente a mesma interface substitui-o sem tocar em mais nada.
3. **`scopes.ts`** — os scopes deste sistema, sempre prefixados com o seu id (ex: `sage:invoices:read`).
4. **`tools/*.ts`** — uma ferramenta MCP por operação, cada uma a chamar `runTool(...)` de `src/tools/helpers.ts` (o mesmo helper genérico que o PHC e o Factorial já usam — verifica o scope e regista na auditoria automaticamente).
5. **`module.ts`** — junta tudo num `ConnectorModule { id, label, registerTools }`.
6. Acrescentar o novo módulo à lista em **`src/modules.ts`**.
7. Juntar os novos scopes aos existentes em **`src/permissions/scopes.ts`** (uma linha).

Nenhum destes passos mexe em auth, permissões, auditoria, nos transportes (stdio/HTTP) ou na consola de testes — todos continuam genéricos e já funcionam com qualquer número de conectores.

## Ligar ao PHC real (SQL Server)

> ⚠️ Isto liga o hub a uma base de dados PHC verdadeira. Lê este guia todo antes de correr o que quer que seja, e faz o primeiro teste contra uma **cópia/backup** da base de dados, não a produção viva — sobretudo antes de ativares escrita.

### Modelo de segurança

- **Ligação cifrada por default** (`encrypt: true`). `trustServerCertificate` só fica ligado se pedires explicitamente — necessário para um SQL Server local de teste com certificado autoassinado, mas nunca em produção.
- **Credenciais nunca no código nem no git** — vêm de `.env` (que está no `.gitignore`) ou de variáveis de ambiente do sistema. Usa `.env.example` como modelo.
- **Login SQL dedicado, nunca `sa` ou o admin do PHC.** Pede a quem administra o SQL Server para criar um login só de leitura (ou leitura + escrita nas tabelas específicas, se e quando ativares escrita), algo como:
  ```sql
  CREATE LOGIN winsig_mcp_readonly WITH PASSWORD = 'uma-password-forte-aqui';
  USE NomeDaBaseDeDadosDoPHC;
  CREATE USER winsig_mcp_readonly FOR LOGIN winsig_mcp_readonly;
  GRANT SELECT ON dbo.cl TO winsig_mcp_readonly;   -- clientes
  GRANT SELECT ON dbo.st TO winsig_mcp_readonly;   -- stocks
  GRANT SELECT ON dbo.ft TO winsig_mcp_readonly;   -- faturas (cabeçalho)
  GRANT SELECT ON dbo.fi TO winsig_mcp_readonly;   -- faturas (linhas)
  -- (nomes de tabela a confirmar — ver "Descobrir o esquema real" abaixo)
  ```
- **Escritas desligadas por default** (`WINSIG_PHC_ALLOW_WRITES=false`). Mesmo ligadas, `phc.create_order` recusa-se a correr (`WriteNotImplementedError`) até alguém confirmar as regras reais de numeração/documentos do PHC — ver "Sobre a escrita" abaixo.
- **Queries sempre parametrizadas** (`request.input(...)`, nunca concatenação de texto do utilizador) — o de sempre contra SQL injection.
- **Auditoria já cobre isto sem mudanças** — cada pedido a `phc.*` continua a ficar registado em `logs/audit.log`, agora com dados reais em vez de mock.

### Passo 1 — Configurar a ligação

```bash
cp .env.example .env
```
Edita o `.env`: `WINSIG_PHC_MODE=real`, mais `WINSIG_PHC_DB_HOST`, `WINSIG_PHC_DB_NAME`, `WINSIG_PHC_DB_USER`, `WINSIG_PHC_DB_PASSWORD` (ver comentários no próprio ficheiro — inclui notas sobre porta vs. instância nomeada, e sobre PHC estar noutra máquina da rede se este hub correr num Mac/Linux).

### Passo 2 — Descobrir o esquema real (obrigatório antes de confiares em resultados)

```bash
npm run inspect-phc-schema                    # lista todas as tabelas
npm run inspect-phc-schema -- cl              # colunas da tabela "cl" (ex: clientes)
```
Isto só lê o catálogo do SQL Server (nomes/tipos) — nunca uma linha de dados de negócio. `src/connectors/phc/sqlServerConnector.ts` tem uma melhor tentativa de mapeamento (tabelas `cl`/`st`/`ft`/`fi`, convenção comum do PHC CS) marcada com comentários `// PHC:` — confirma/ajusta esses nomes contra o que a introspeção mostrar antes de confiar nos resultados.

### Passo 3 — Testar leitura

```bash
npm run build
npm run dev:http
```
Usa a consola (`http://localhost:3000`) ou o `curl` como já fizeste com os dados mock — agora com uma API key real de `config/integrations.json` (`WINSIG_PHC_MODE=real` não muda nada na autenticação/scopes/perfis, só a fonte dos dados).

### Sobre a escrita (`phc.create_order`)

Deliberadamente **não implementei** a query de escrita real. Ler dados errados é um problema recuperável (repara-se); escrever numa tabela errada, ou sem respeitar a numeração/triggers que o PHC normalmente garante, pode corromper dados reais de forma não trivial de reverter. Antes de implementar:

1. Confirma com quem administra o PHC como são criados documentos de venda (tabela de tipos de documento, sequência de numeração, triggers de atualização de stock).
2. Testa a query de escrita contra uma **cópia/backup**, nunca a produção, primeiro.
3. Só depois preencher `PhcSqlServerConnector.createOrder()` e ativar `WINSIG_PHC_ALLOW_WRITES=true`.

## Roteiro / próximos passos

1. ~~Conector real do PHC (leitura)~~ — feito: `PhcSqlServerConnector` liga por SQL Server direto (`WINSIG_PHC_MODE=real`); queries por confirmar contra o esquema real com `npm run inspect-phc-schema`. Falta ainda: `FactorialApiConnector` real, e a escrita real de `phc.create_order` (ver "Sobre a escrita" acima).
2. ~~Transporte HTTP multi-tenant~~ — feito: `src/httpServer.ts` (Streamable HTTP), uma sessão por ligação, identidade resolvida por `Authorization: Bearer` no `initialize`.
3. ~~Arquitetura multi-conector~~ — feito: `ConnectorModule` (`src/connectors/registry.ts`), PHC e Factorial como dois conectores independentes no mesmo hub, com scopes e ferramentas prefixados.
4. ~~Perfis de utilizador + restrição ao nível da linha~~ — feito: `src/permissions/roles.ts` (consultor/vendas/rh-admin/colaborador) e o scope `factorial:employees:read:self` (um colaborador só vê o seu próprio registo).
5. **Mais conectores** — Sage, Primavera, SAP, Odoo, seguindo a receita acima. Cada um é trabalho isolado; não há dependências entre conectores.
6. **Deploy real** — hoje só corre localmente (`npm run dev:http`). Falta empacotar (Docker), colocar atrás de TLS/reverse proxy, e decidir onde corre dentro da infraestrutura Winsig/cliente.
7. **Mapeamento aos perfis reais de cada sistema** — hoje os perfis (`roles.ts`) são definidos manualmente; o objetivo é herdá-los diretamente dos perfis e permissões já configurados em cada ERP/plataforma (ex: perfis do PHC CS, grupos do Factorial).
8. **Restrição ao nível da linha noutros conectores** — o padrão `:self` do Factorial (scope + `identity.attributes` + filtragem dentro da ferramenta) é reutilizável para qualquer dado "pessoal" — ex: um vendedor só ver as suas próprias faturas no PHC.
9. **Ferramentas que atravessam conectores** — ex: "cria a despesa no Factorial e concilia com a fatura no PHC"; só é possível porque ambos já correm no mesmo hub, com a mesma auditoria.
10. **Aprovação humana para escritas sensíveis** — um nível extra de confiança que os concorrentes de ERP único não oferecem: ex. encomendas acima de X€ ficam pendentes até confirmação humana.
11. **Armazenamento de credenciais e auditoria em base de dados própria** — trocar o ficheiro JSON e o log local por uma base de dados dedicada ao hub, com consola de administração para emitir/revogar credenciais e consultar auditoria.
12. **Expiração/renovação de sessões HTTP** — hoje as sessões ficam em memória sem limite de tempo; adicionar um timeout de inatividade.
