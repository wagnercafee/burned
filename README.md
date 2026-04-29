# 🔥 Focos de Calor na Bahia - INPE

Monitor interativo de focos de calor na Bahia em tempo real, com dados do INPE atualizados a cada 10 minutos.

***

## 📋 Sobre a Aplicação

Exibe no mapa do estado da Bahia dois tipos de dados de focos de incêndio fornecidos pelo INPE:

- **Focos Diários** — snapshot do dia anterior, disponibilizado às ~09:00 BRT. Representados por triângulos roxos no mapa.
- **Focos Atuais (10min)** — dados acumulados do dia corrente, atualizados a cada 10 minutos. Representados por círculos coloridos por faixa horária:

| Cor | Faixa horária (local) |
|---|---|
| 🟡 Amarelo claro | 00:00 – 03:59 |
| 🟠 Âmbar | 04:00 – 07:59 |
| 🟠 Laranja | 08:00 – 11:59 |
| 🔴 Vermelho | 12:00 – 15:59 |
| 🔴 Vermelho escuro | 16:00 – 19:59 |
| 🟤 Marrom escuro | 20:00 – 23:59 |

Focos atuais que coincidem com um foco diário (raio de 3 km) recebem animação de pulso e borda destacada.

A aplicação roda indefinidamente sem intervenção: atualiza os focos atuais a cada 10 minutos e os focos diários automaticamente às 09:10 de cada dia. Na virada da meia-noite, os focos atuais são zerados e o ciclo recomeça.

***

## ✅ Pré-requisitos

- **Node.js v22 ou superior** — [nodejs.org/en/download](https://nodejs.org/en/download)
- **Visual Studio Code** com a extensão **Live Server** instalada
  - Instalar via marketplace: `ritwickdey.LiveServer`

***

## 🚀 Como Rodar

### 1. Clone ou baixe o projeto

```bash
git clone git@gitlab.saude.ba.gov.br:dma/focos-calor-frontend.git
cd focos-calor-frontend
```

### 2. Inicie o proxy no terminal do VS Code

Abra o terminal integrado do VS Code (`Ctrl + '`) e execute:

```bash
node ./proxy.js
```

O proxy ficará rodando em `http://localhost:3001` e é responsável por servir os arquivos CSV do INPE localmente.

> ⚠️ Mantenha o terminal aberto. Fechar o terminal encerra o proxy e a aplicação para de receber dados.

### 3. Abra o Live Server

Com o arquivo `index.html` aberto no VS Code, clique em **"Go Live"** na barra de status inferior direita, ou clique com o botão direito no arquivo e selecione **"Open with Live Server"**.

O browser abrirá automaticamente com a aplicação rodando.

***

## 📁 Estrutura do Projeto

```
├── index.html        # Página principal da aplicação
├── proxy.js          # Servidor proxy Node.js para os dados do INPE
├── br_ba.json        # GeoJSON do polígono do estado da Bahia (IBGE)
├── app.js            # Lógica principal do mapa e atualização dos focos
└── README.md
```

***

## ⚙️ Como Funciona

### Proxy (`proxy.js`)

Intermediário entre a aplicação e os servidores do INPE. Evita erros de CORS ao servir os CSVs localmente na porta `3001`.

### Focos Diários

- Buscados uma vez ao iniciar a aplicação
- Fonte: `focos_diario_br_YYYYMMDD.csv` (dia anterior)
- Atualizados automaticamente às **09:10** todos os dias
- Filtrados por estado `BAHIA` e deduplicados por `id`

### Focos Atuais (10 minutos)

- Ciclo de 24h começa às **03:00 UTC** (00:00 horário de Brasília)
- 144 slots de 10 minutos por ciclo
- O intervalo sincroniza com o próximo múltiplo de 10 minutos + 1 minuto de margem para o INPE publicar o arquivo
- Slots com falha no download são retentados automaticamente nas próximas verificações
- Na virada da meia-noite local, todos os dados e markers do dia anterior são limpos automaticamente

***

## 🗺️ Tecnologias Utilizadas

- [Leaflet.js](https://leafletjs.com/) — renderização do mapa interativo
- [Turf.js](https://turfjs.org/) — operações geoespaciais (ponto dentro do polígono, buffer)
- [CartoDB Basemaps](https://carto.com/basemaps/) — tiles do mapa base
- [Node.js](https://nodejs.org/) — proxy local para os dados do INPE
- [VS Code Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) — servidor de desenvolvimento

***

## 🔄 Ciclo de Atualização

```
Início
  └─ Carrega polígono da Bahia (IBGE)
  └─ Busca focos diários (dia anterior)
  └─ Plota focos diários no mapa
  └─ Agenda atualização diária às 09:10
  └─ Busca todos os focos atuais do dia até agora
  └─ Plota focos atuais no mapa
  └─ Agenda próxima verificação no próximo :X1:00

A cada 10 minutos
  └─ Verifica se o dia mudou → reseta se necessário
  └─ Busca slots novos ainda não carregados
  └─ Plota novos markers no mapa
  └─ Atualiza legenda

Todo dia às 09:10
  └─ Busca focos do novo dia anterior
  └─ Substitui markers diários no mapa
  └─ Reagenda para o dia seguinte
```