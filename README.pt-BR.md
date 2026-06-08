[English](README.md) | [Português](README.pt-BR.md)

# Automação de Documentos de Transporte SAP

Um motor de RPA dirigido por chat para logística de exportação no SAP. Um planejador digita um
comando curto em um canal do **Microsoft Teams**, o **Power Automate** transforma isso em jobs, e
um watcher local os executa no SAP dirigindo o **SAP GUI**. Ele cria remessas e documentos de
transporte, troca transportadoras e divide remessas grandes em **comboios** balanceados de dois
caminhões.

> **Contexto.** Esta é uma destilação anonimizada e autocontida de um sistema que construí e opero
> em produção para uma operação real de exportação. O original dirige um SAP GUI ao vivo via SAP
> GUI Scripting (que não roda sem SAP), então aqui a camada SAP é substituída por um
> `MockSapDriver` em memória atrás da mesma interface, e **o pipeline inteiro roda e é demonstrável
> com `node demo.js`**. Todas as transportadoras, códigos, identificadores SAP e documentos são
> fictícios. Nenhum dado real.

## O problema

Criar a documentação de transporte no SAP é repetitivo, rígido e propenso a erro. Para cada carga
o planejador precisa criar a remessa, definir pesos, liberá-la, criar o documento de transporte
(DT) e atribuir a transportadora certa com o tipo de transporte certo, em quatro transações SAP. E
quando uma carga é grande demais para um caminhão, dividi-la em dois **à mão**, balanceando pallets
e peso entre ambos. Fazer isso dezenas de vezes por dia é lento, e os erros custam caro.

Este sistema permite ao planejador disparar tudo a partir de uma mensagem no Teams.

## Arquitetura

```
 Microsoft Teams              Power Automate            Watcher local            SAP GUI
 (planejador @menciona  →  (parseia a tabela em  →  (roteia cada job para  →  (VL10B / VL02N /
  o bot + uma tabela        uma fila de jobs JSON)    o handler certo)          VT01N / VT02N)
  com um #comando)                                          │
        ▲                                                   ▼
        └───────────  resultado postado de volta no Teams ◀── JSON de resultado
```

A ligação original vai Teams → Power Automate (tabela HTML para JSON) → uma pasta de fila no
OneDrive → um watcher local Node/WSH → SAP GUI Scripting → arquivo de resultado → Power Automate
posta o desfecho de volta no tópico. Este repositório reproduz cada parte **exceto** o GUI
scripting em si, que fica atrás de uma interface de driver.

### Decisão de design: inversão de dependência

Os handlers nunca falam com o SAP diretamente; eles conversam com uma interface `SapDriver`. O
backend real a implementa com SAP GUI Scripting; o `MockSapDriver` a implementa em memória e
registra cada passo. Esse desacoplamento é o que torna a automação frágil de UI **testável** e a
lógica de negócio reaproveitável.

```
job → handler → SapDriver (interface) → [ MockSapDriver | driver real de GUI-scripting ]
```

## O que faz

| Comando (no Teams) | Fluxo | Transações SAP |
| --- | --- | --- |
| `#convoy` | divide uma remessa grande em um comboio balanceado de 2 caminhões + 2 DTs | VL02N, VL10B, VT01N |
| `#createdt` | libera uma remessa e cria seu documento de transporte | VL02N, VT01N |
| `#changecarrier` | troca a transportadora em um DT existente | VT02N |
| `#unlinkdt` | desvincula uma remessa de um DT | VT02N |

### O otimizador de comboio (o carro-chefe)

Uma remessa acima dos limites de um caminhão embarca como dois. Cada caminhão tem dois limites
rígidos, **28 posições de pallet** e um **teto de peso**, e os dois caminhões devem ficar
**balanceados**. O otimizador:

1. mantém todo SKU inteiro, exceto o mais pesado, que pode ser dividido;
2. testa por força bruta toda forma de dividir esse SKU pesado entre os dois caminhões;
3. coloca gulosamente os SKUs inteiros restantes no caminhão mais leve;
4. mantém o arranjo viável mais balanceado (balanço de pallets primeiro, balanço de peso como
   desempate), respeitando um override de peso por país.

Na demo, uma remessa de 40 pallets é dividida em um limpo **20 + 20**.

### Robustez embutida (anti-erro humano)

- **Auto-correção de campos.** Operadores colam as colunas da tabela fora de ordem, então cada
  célula é classificada pelo seu formato (pedido / remessa / DT / transportadora) e atribuída ao
  campo certo, independentemente da posição.
- **Sufixo `x`/`v` na transportadora.** Uma letra ao final do nome força o tipo de transporte para
  ZA09, um atalho do operador para outra rota.
- **Um job que falha nunca aborta o lote.**

## Como rodar

```bash
node demo.js
```

Ele executa os quatro comandos contra o SAP em memória e imprime, para cada um, a mensagem do
Teams, o que o Power Automate parseou, os passos SAP exatos realizados e a mensagem postada de
volta no Teams.

## Estrutura do projeto

```
src/config.js              Transportadoras, identificadores SAP, limites de comboio, padrões de doc
src/carriers.js            Resolução de transportadora + a regra do sufixo x/v
src/jobParser.js           Mensagem do Teams -> jobs (o papel do Power Automate) + auto-correção
src/convoySplit.js         O otimizador de split 28+28 balanceado por peso
src/palletization.js       Quantidades -> pallets + peso (tabela de apoio)
src/sap/SapDriver.js       A interface do driver (o contrato)
src/sap/MockSapDriver.js   SAP em memória usado pela demo/testes
src/handlers/*.js          createDt, convoy, changeCarrier, unlinkDt
src/watcher.js             Roteamento de jobs + a mensagem de resultado
src/sampleData.js          Mundo SAP sintético + tabela de apoio de produtos
demo.js                    Execução de ponta a ponta
```

## Tecnologias e conceitos

JavaScript (módulos ES, zero dependências) · RPA e automação de SAP GUI (modelada) · inversão de
dependência (driver interface + mock) · chat-ops via Microsoft Teams e Power Automate ·
orquestração por fila de jobs · constrained bin-packing (split de comboio) · processamento de lote
tolerante a falhas.

## Observações

- O sistema real roda em Windows via SAP GUI Scripting (WSH/JScript) e uma fila de arquivos no
  OneDrive. Um `SapGuiDriver` real implementaria `SapDriver` contra o GUI ao vivo. Os handlers, o
  parser, o otimizador e o roteamento permanecem os mesmos.

## Licença

MIT
