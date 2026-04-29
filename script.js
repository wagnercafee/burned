// ------------------------- Mapa -------------------------
const map = L.map('map', {
    center: [-13.5, -38],
    zoom: 7,
    preferCanvas: true,
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    minZoom: 7,
    maxZoom: 7,
    attributionControl: false,
});

map.createPane('paneDiarios');
map.createPane('paneAtuais');
map.getPane('paneDiarios').style.zIndex = 450;
map.getPane('paneAtuais').style.zIndex = 460;

map.on('zoomend', () => {
    map.getPane('paneDiarios').style.zIndex = 450;
    map.getPane('paneAtuais').style.zIndex = 460;
});

L.control.attribution({
    position: 'bottomleft',
    prefix: 'Leaflet'
}).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &amp; CartoDB',
    subdomains: 'abcd', maxZoom: 19,
}).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    attribution: '', subdomains: 'abcd',
    maxZoom: 19, opacity: 0.8, pane: 'shadowPane',
}).addTo(map);

L.control.scale({
    metric: true,
    imperial: false,
    position: 'bottomleft'
}).addTo(map);

let bahiaGeoJSON = null;
let bahiaPoligono = null;
const carregarBahiaIBGE = () =>
    fetch('./br_ba.json')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(geojson => {
            bahiaGeoJSON = geojson;
            bahiaPoligono = turf.feature(geojson.features[0].geometry);
            L.geoJSON(geojson, {
                style: {
                    color: '#5c5a5a',
                    weight: 3,
                    opacity: 0.7,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                }
            }).addTo(map);
        });

/* 
    ------------------------- Focos diario do dia anterior -------------------------
*/
const BASE_URL_DIARIO = 'http://localhost:3001/queimadas/queimadas/focos/csv/diario/Brasil/';

const parsearCSV = (texto) => {
    const linhas = texto.trim().split('\n');
    const cabecalho = linhas[0].split(',').map(c => c.trim());
    return linhas.slice(1).map(linha => {
        const valores = linha.split(',');
        return Object.fromEntries(cabecalho.map((col, i) => [col, valores[i]?.trim()]));
    });
};

let layerFocosDiarios = L.layerGroup().addTo(map);
let focosDiariosFC = null;

const getFocosDiarios = async () => {

    //resetar
    layerFocosDiarios.clearLayers();
    focosDiariosFC = null

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const yyyy = ontem.getFullYear();
    const mm = String(ontem.getMonth() + 1).padStart(2, '0');
    const dd = String(ontem.getDate()).padStart(2, '0');

    const dataArquivo = `${yyyy}${mm}${dd}`;// '20260408'
    const dataFiltro = `${yyyy}-${mm}-${dd}`;// '2026-04-08'

    const url = `${BASE_URL_DIARIO}focos_diario_br_${dataArquivo}.csv`;

    console.log('Focos do dia anterior');
    console.log(`🔍 Buscando focos diarios da Bahia em: ${dataFiltro}`);

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Arquivo não encontrado (HTTP ${res.status})`);

        const registros = parsearCSV(await res.text());
        const daBahia = registros.filter(r =>
            r.data_hora_gmt?.startsWith(dataFiltro) &&
            r.estado?.toUpperCase() === 'BAHIA'
        );

        // Deduplicação por id
        const unique = [...new Map(daBahia.map(f => [f.id, f])).values()];

        console.log(unique.length > 0
            ? `📂 focos_diario_br_${dataArquivo}.csv → | ${unique.length} foco(s) na Bahia em ${dataFiltro}`
            : `📂 focos_diario_br_${dataArquivo}.csv → | Nenhum foco na Bahia em ${dataFiltro}`
        );

        return unique;

    } catch (err) {
        console.log(`⚠️ Erro: ${err.message}`);
        return [];
    }
};

const carregarFocosDiariosNoMapa = (focos) => {
    layerFocosDiarios.clearLayers();

    focosDiariosFC = turf.featureCollection(
        focos
            .filter(f => !isNaN(parseFloat(f.lat)) && !isNaN(parseFloat(f.lon)))
            .map(f => turf.point([parseFloat(f.lon), parseFloat(f.lat)]))
    );

    focos.forEach(f => {
        const lat = parseFloat(f.lat);
        const lon = parseFloat(f.lon);
        if (isNaN(lat) || isNaN(lon)) return;

        L.marker([lat, lon], {
            pane: 'paneDiarios',
            icon: L.divIcon({
                className: '',
                html: `<div style="
                    width: 16; height: 16;
                    border-left: 12px solid transparent;
                    border-right: 12px solid transparent;
                    border-bottom: 24px solid #9c11b8;
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 16],
            })
        }).addTo(layerFocosDiarios);
    });
};

const buildLegendaDiarios = (focos) => {
    const legendaDiariaEl = document.getElementById('legenda-diaria-items');
    if (!legendaDiariaEl) return;

    legendaDiariaEl.innerHTML = `
        <div class="legenda-row">
            <div class="triangulo" style="border-bottom: 24px solid #9c11b8;"></div>
            <span class="nome-satelite">00:00–23:59</span>
            <span class="badge-qtd">${focos.length}</span>
        </div>`;
};

const logResumoDiario = (focos) => {
    console.log(`📊 Total: ${focos.length} focos diários na Bahia`);
    console.log('Finaliza Focos do dia anterior');
};

const agendarAtualizacaoDiaria = () => {
    const agora = new Date();
    const proxExecucao = new Date();

    proxExecucao.setHours(9, 10, 0, 0);

    // Se já passou das 09:10 hoje, agenda para amanhã
    if (agora >= proxExecucao) {
        proxExecucao.setDate(proxExecucao.getDate() + 1);
    }

    const msAteProxExecucao = proxExecucao - agora;

    console.log(`⏰ Próxima atualização de focos diários: ${proxExecucao.toLocaleString('pt-BR')}`);

    setTimeout(() => {
        console.log('🔄 Atualizando focos diários...');
        getFocosDiarios().then((focos) => {
            carregarFocosDiariosNoMapa(focos);
            buildLegendaDiarios(focos);
            logResumoDiario(focos);

            // Reagenda para o dia seguinte
            agendarAtualizacaoDiaria();
        });
    }, msAteProxExecucao);

    console.log('-'.repeat(70));
};


/* 
    ------------------------- Focos Atuais -------------------------
*/
const BASE_URL_DEZ_MINUTOS = 'http://localhost:3001/queimadas/queimadas/focos/csv/10min/';

const gerarSlotsHoje = () => {
    const agora = new Date();

    const fmt = (d) => ({
        yyyy: d.getFullYear(),
        mm: String(d.getMonth() + 1).padStart(2, '0'),
        dd: String(d.getDate()).padStart(2, '0'),
    });

    const hoje = fmt(agora);
    const amanha = new Date(agora);
    amanha.setDate(amanha.getDate() + 1);
    const prox = fmt(amanha);

    const dataHoje = `${hoje.yyyy}${hoje.mm}${hoje.dd}`;
    const dataAmanha = `${prox.yyyy}${prox.mm}${prox.dd}`;

    const slots = [];

    // 0300 → 2350 do dia atual (126 slots)
    for (let min = 180; min < 1440; min += 10) {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mi = String(min % 60).padStart(2, '0');
        slots.push(`${dataHoje}_${hh}${mi}`);
    }

    // 0000 → 0250 do dia seguinte (18 slots)
    for (let min = 0; min < 180; min += 10) {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mi = String(min % 60).padStart(2, '0');
        slots.push(`${dataAmanha}_${hh}${mi}`);
    }

    return slots;
};

const estaNaBahia = (lat, lon) => {
    if (!bahiaPoligono) return false;
    return turf.booleanPointInPolygon(turf.point([lon, lat]), bahiaPoligono);
};

const temFocoDiarioProximo = (lat, lon) => {
    if (!focosDiariosFC || focosDiariosFC.features.length === 0) return false;
    const bbox = turf.buffer(turf.point([lon, lat]), 3, { units: 'kilometers' });
    return focosDiariosFC.features.some(f => turf.booleanPointInPolygon(f, bbox));
};

const getProximoSlotUTC = () => {
    const agora = new Date();
    const totalMin = agora.getUTCHours() * 60 + agora.getUTCMinutes();
    // Próximo slot = slot atual + 10min
    const proximoMin = (Math.floor(totalMin / 10) + 1) * 10;

    const cursor = new Date(agora);
    cursor.setUTCHours(Math.floor(proximoMin / 60), proximoMin % 60, 0, 0);

    const yyyy = cursor.getUTCFullYear();
    const mm = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cursor.getUTCDate()).padStart(2, '0');
    const hh = String(cursor.getUTCHours()).padStart(2, '0');
    const mi = String(cursor.getUTCMinutes()).padStart(2, '0');

    return `${yyyy}${mm}${dd}_${hh}${mi}`;
};

const coresFocosAtuais = [
    { fill: '#fbbf24', opacity: 1 }, // [0] 00:00–03:59
    { fill: '#f59e0b', opacity: 1 }, // [1] 04:00–07:59
    { fill: '#f97316', opacity: 1 }, // [2] 08:00–11:59
    { fill: '#ef4444', opacity: 1 }, // [3] 12:00–15:59
    { fill: '#dc2626', opacity: 1 }, // [4] 16:00–19:59
    { fill: '#7f1d1d', opacity: 1 }, // [5] 20:00–23:59
];

const getCorFaixaHoraria = (slot) => {
    // slot ex: "20260409_1340" → pega só "1340"
    const hora = slot.split('_')[1];
    if (!hora || hora.length < 4) return coresFocosAtuais[0];

    const h = parseInt(hora.substring(0, 2));
    if (isNaN(h)) return coresFocosAtuais[0];

    // slot em UTC → faixa em horário local da Bahia (UTC-3)
    if (h >= 3 && h <= 6) return coresFocosAtuais[0];  // 00:00–03:59
    if (h >= 7 && h <= 10) return coresFocosAtuais[1]; // 04:00–07:59
    if (h >= 11 && h <= 14) return coresFocosAtuais[2]; // 08:00–11:59
    if (h >= 15 && h <= 18) return coresFocosAtuais[3]; // 12:00–15:59
    if (h >= 19 && h <= 22) return coresFocosAtuais[4]; // 16:00–19:59
    return coresFocosAtuais[5]; // 20:00–23:59
};

const slotsCarregados = new Set();
let layerFocosAtuais = L.layerGroup().addTo(map);
let diaAtual = new Date().toLocaleDateString('pt-BR');

const resumoAcumulado = {};
let primeiraExecucao = true;
const getFocosAtuais = async () => {
    const diaAgora = new Date().toLocaleDateString('pt-BR');
    if (diaAgora !== diaAtual) {
        console.log(`🔄 Dia mudou (${diaAtual} → ${diaAgora}), resetando focos atuais...`);

        layerFocosAtuais.clearLayers();
        Object.keys(resumoAcumulado).forEach(k => delete resumoAcumulado[k]);
        slotsCarregados.clear();
        primeiraExecucao = true;
        diaAtual = diaAgora;
    }

    const proximoSlot = getProximoSlotUTC();
    const slots = gerarSlotsHoje().filter(s => s < proximoSlot);
    const novos = slots.filter(s => !slotsCarregados.has(s));

    // Só loga detalhes na primeira carga
    if (primeiraExecucao && novos.length > 0) {
        console.log('Focos atuais');
        console.log(`📅 Slots gerados: ${slots.length} | ${slots[0]} → ${slots.at(-1)}`);
        primeiraExecucao = false;
    }

    if (novos.length === 0) {
        console.log('⏳ Nenhum slot novo para carregar');
        return;
    }

    console.log(`🔍 Buscando focos atuais...`);

    let totalNaBahia = 0;

    for (const slot of novos) {
        const url = `${BASE_URL_DEZ_MINUTOS}focos_10min_${slot}.csv`;

        try {
            const res = await fetch(url);

            if (!res.ok) {
                continue;
            }

            slotsCarregados.add(slot);

            const registros = parsearCSV(await res.text());

            const focosNaBahia = registros.filter(r => {
                const lat = parseFloat(r.lat);
                const lon = parseFloat(r.lon);
                return !isNaN(lat) && !isNaN(lon) && estaNaBahia(lat, lon);
            });

            resumoAcumulado[slot] = {
                focos: focosNaBahia.length,
                satelites: [...new Set(focosNaBahia.map(f => f.satelite))],
                coords: focosNaBahia.map(f => ({ lat: parseFloat(f.lat), lon: parseFloat(f.lon) }))
            };

            focosNaBahia.forEach(f => {
                const lat = parseFloat(f.lat);
                const lon = parseFloat(f.lon);
                const faixa = getCorFaixaHoraria(slot);
                const coincide = temFocoDiarioProximo(lat, lon);

                L.marker([lat, lon], {
                    pane: 'paneAtuais',
                    icon: L.divIcon({
                        className: '',
                        html: `<div class="${coincide ? 'foco-pulse' : ''}" style="
                            width: 24px;
                            height: 24px;
                            background: ${faixa.fill};
                            opacity: ${faixa.opacity};
                            border-radius: 50%;
                            border: ${coincide ? '2px solid #dc2626' : '1px solid rgba(0,0,0,0.3)'};
                            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
                        "></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8],
                    })
                }).addTo(layerFocosAtuais);
            });


            if (focosNaBahia.length > 0) {
                totalNaBahia += focosNaBahia.length;
            }

        } catch (err) {
            console.warn(`⚠️ ${slot}: ${err.message}`);
        }
    }
    console.log(`📂 focos atuais na Bahia:`, resumoAcumulado);

    console.log(`📊 Processados ${slotsCarregados.size} dos 144 slots possiveis`);
    if (!primeiraExecucao) {
        console.log(`🔥 Total de ${totalNaBahia} focos atuais ativos na Bahia até ${new Date().toLocaleTimeString('pt-BR')}`);
    } else {
        console.log(`🔥 Total de ${totalNaBahia} novos foco(s) ativos na Bahia na ultima verificação`);
    }

    buildLegendaAtuais()

};

const agendarAtualizacaoAtuais = () => {
    const agora = new Date();
    const ms = agora.getTime();

    // Próximo múltiplo de 10min + 60s de margem
    const INTERVALO = 10 * 60 * 1000;
    const MARGEM = 60 * 1000;

    const proximoMultiplo = Math.ceil((ms + 1) / INTERVALO) * INTERVALO;
    const delay = (proximoMultiplo - ms) + MARGEM;

    const proximaHora = new Date(proximoMultiplo + MARGEM);
    console.log(`⏰ Próxima atualização de focos atuais: ${proximaHora.toLocaleTimeString('pt-BR')}`);

    // Aguarda até o próximo :X0:05, depois dispara a cada 10min
    setTimeout(() => {
        console.log(`🕐 [${new Date().toLocaleTimeString('pt-BR')}] Verificando slots pendentes dos focos atuais...`);
        getFocosAtuais();

        // A partir daqui, bate certinho a cada 10min
        setInterval(() => {
            console.log(`🕐 [${new Date().toLocaleTimeString('pt-BR')}] Verificando slots pendentes dos focos atuais...`);
            getFocosAtuais();
        }, INTERVALO);

    }, delay);

    console.log('Finaliza Focos atuais')
    console.log('='.repeat(70));
}

const FAIXAS_HORARIAS = [
    { label: '00:00–03:59', hSlots: [3, 4, 5, 6], hFaixaMin: 0, hFaixaMax: 3, ...coresFocosAtuais[0] },
    { label: '04:00–07:59', hSlots: [7, 8, 9, 10], hFaixaMin: 4, hFaixaMax: 7, ...coresFocosAtuais[1] },
    { label: '08:00–11:59', hSlots: [11, 12, 13, 14], hFaixaMin: 8, hFaixaMax: 11, ...coresFocosAtuais[2] },
    { label: '12:00–15:59', hSlots: [15, 16, 17, 18], hFaixaMin: 12, hFaixaMax: 15, ...coresFocosAtuais[3] },
    { label: '16:00–19:59', hSlots: [19, 20, 21, 22], hFaixaMin: 16, hFaixaMax: 19, ...coresFocosAtuais[4] },
    { label: '20:00–23:59', hSlots: [23, 0, 1, 2], hFaixaMin: 20, hFaixaMax: 23, ...coresFocosAtuais[5] },
];

const getFaixaDoSlot = (slot) => {
    const hora = slot.split('_')[1];
    if (!hora) return -1;

    const h = parseInt(hora.substring(0, 2));
    if (isNaN(h)) return -1;

    return FAIXAS_HORARIAS.findIndex(f => f.hSlots.includes(h));
};

const getFaixaAtualLocal = () => {
    const h = new Date().getHours();
    return FAIXAS_HORARIAS.findIndex(f => h >= f.hFaixaMin && h <= f.hFaixaMax);
};

const buildLegendaAtuais = () => {
    const el = document.getElementById('legenda-atuais-items');
    if (!el) return;

    const contagemPorFaixa = new Array(FAIXAS_HORARIAS.length).fill(0);
    for (const [slot, dados] of Object.entries(resumoAcumulado)) {
        const idx = getFaixaDoSlot(slot);
        if (idx >= 0) contagemPorFaixa[idx] += dados.focos;
    }

    const faixaAtual = getFaixaAtualLocal();
    const hAtual = new Date().getHours();

    el.innerHTML = [...FAIXAS_HORARIAS].reverse().map((faixa, i) => {
        const idxOriginal = FAIXAS_HORARIAS.length - 1 - i;
        const isAtual = idxOriginal === faixaAtual;
        const isFuturo = !isAtual && hAtual < faixa.hFaixaMin;

        const count = contagemPorFaixa[idxOriginal];

        return `
            <div class="legenda-faixa ${isAtual ? 'atual' : ''} ${isFuturo ? 'futuro' : ''}">
                <div class="legenda-bolinha" style="background:${faixa.fill}; opacity:${faixa.opacity};"></div>
                <div class="legenda-intervalo-grupo">
                    <span class="legenda-intervalo">${faixa.label}</span>
                    ${isAtual ? '<span class="legenda-agora">←agora</span>' : ''}
                </div>
                <span class="legenda-count ${count > 0 ? 'tem-focos' : 'sem-focos'}">${count}</span>
            </div>`;
    }).join('');

    const dataEl = document.getElementById('legenda-atual-data');
    if (dataEl) {
        dataEl.textContent = new Date().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }
};

/* 
    ------------------------- Executa os scripts -------------------------
*/
carregarBahiaIBGE().then(() => {
    getFocosDiarios().then((focos) => {
        // diarios
        carregarFocosDiariosNoMapa(focos);
        buildLegendaDiarios(focos);
        logResumoDiario(focos);
        // Agenda atualização diária às 09:10
        agendarAtualizacaoDiaria();
    }).then(() => {
        // atuais
        getFocosAtuais().then(() => {
            agendarAtualizacaoAtuais();
        })
    })

})
