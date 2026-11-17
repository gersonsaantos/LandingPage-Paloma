
/* ==========================================
   PALOMA LIMA BEAUTY
   SISTEMA DE AGENDAMENTO
   VERSÃO ATUALIZADA
========================================== */

document.addEventListener("DOMContentLoaded", function () {

    /* ======================================
       1. CONFIGURAÇÕES
    ====================================== */

    // COLE AQUI A URL DA IMPLANTACAO DO GOOGLE APPS SCRIPT.
    // Exemplo: https://script.google.com/macros/s/SEU_ID/exec
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwUbF_-HVYBS68Ljs8kBHHGstCNMVNdPuGWJbTiCOyHN-gHw1cL55E68MQDYy3MJDmiXQ/exec";

    // false = envia os agendamentos reais para o Google Planilhas.
    const MODO_DE_TESTE_SEM_PLANILHA = false;


    /* ======================================
       2. ELEMENTOS DO HTML
    ====================================== */

    const form = document.getElementById("bookingForm");

    const stepDados = document.getElementById("stepDados");
    const stepPessoas = document.getElementById("stepPessoas");
    const stepFinal = document.getElementById("stepFinal");

    const progressContainer =
        document.querySelector(".progress-container");

    const progressFill =
        document.getElementById("progressFill");

    const progressPercent =
        document.getElementById("progressPercent");

    const stepCounter =
        document.getElementById("stepCounter");

    const peopleTabs =
        document.getElementById("peopleTabs");

    const peopleForms =
        document.getElementById("peopleForms");

    const personTemplate =
        document.getElementById("personTemplate");

    const personNavigation =
        document.getElementById("personNavigation");

    const personCounter =
        document.getElementById("personCounter");

    const customQuantity =
        document.getElementById("customQuantity");

    const quantityInput =
        document.getElementById("quantidadeExata");

    const finishButton =
        document.querySelector(".btn-finish");

    const nomeResponsavel =
        document.getElementById("nomeResponsavel");

    const telefone =
        document.getElementById("telefone");

    const dataInput =
        document.getElementById("data");

    const horario =
        document.getElementById("horario");

    const localizacao =
        document.getElementById("localizacao");

    // Aceita tanto o ID novo quanto a classe usada no HTML anterior.
    const headerBackButton =
        document.getElementById("headerBackButton") ||
        document.querySelector(".back-button");

    // Campos de município e bairro.
    // O HTML deve usar id="municipio" e id="bairro".
    const municipioSelect =
        document.getElementById("municipio") ||
        document.getElementById("municipioSelect");

    const bairroInput =
        document.getElementById("bairro") ||
        document.getElementById("bairroInput");

    // Reutiliza o campo que já existe no agendamento.html.
    let municipioOutroInput =
        document.getElementById("outroMunicipio") ||
        document.getElementById("municipioOutro");

    let bairroOutroInput =
        document.getElementById("bairroOutro");

    // O HTML já possui <datalist id="listaBairros">.
    const BAIRRO_DATALIST_ID = "listaBairros";

    let municipiosDisponiveis = [];
    let bairrosMunicipioAtual = [];
    const bairrosCache = new Map();
    let localidadesCarregadas = false;
    let bairroRequestToken = 0;
    let jsonpSequence = 0;


    /* ======================================
       3. VERIFICAR ELEMENTOS
    ====================================== */

    const requiredElements = {
        bookingForm: form,
        stepDados,
        stepPessoas,
        stepFinal,
        progressContainer,
        progressFill,
        progressPercent,
        stepCounter,
        peopleTabs,
        peopleForms,
        personTemplate,
        personNavigation,
        personCounter,
        customQuantity,
        quantityInput,
        finishButton,
        nomeResponsavel,
        telefone,
        dataInput,
        horario,
        localizacao,
        headerBackButton
    };

    const missingElements = Object.entries(requiredElements)
        .filter(([name, element]) => !element)
        .map(([name]) => name);

    if (missingElements.length > 0) {

        console.error(
            "Elementos não encontrados:",
            missingElements
        );

        alert(
            "Erro ao carregar o formulário. Verifique o HTML."
        );

        return;

    }


    /* ======================================
       4. ESTADO DO SISTEMA
    ====================================== */

    let totalPeople = 0;

    let currentPersonIndex = 0;

    let currentStep = "dados";

    let submitting = false;

    // Mantém o mesmo código se for necessário repetir uma confirmação,
    // evitando criar outro agendamento caso o primeiro já tenha sido salvo.
    let payloadPendente = null;

    form.noValidate = true;


    /* ======================================
       5. DATA ATUAL
    ====================================== */

    function getToday() {

        const today = new Date();

        const year = today.getFullYear();

        const month = String(today.getMonth() + 1)
            .padStart(2, "0");

        const day = String(today.getDate())
            .padStart(2, "0");

        return `${year}-${month}-${day}`;

    }

    dataInput.min = getToday();


    /* ======================================
       6. INTEGRAÇÃO DE MUNICÍPIOS E BAIRROS
       API COMPATÍVEL COM O GOOGLE APPS SCRIPT:
       GET JSONP: ?action=municipios
       GET JSONP: ?action=bairros&municipio=São%20Luís
       A resposta de bairros contém objetos com a propriedade bairro.
    ====================================== */

    function normalizarTexto(texto) {

        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLocaleLowerCase("pt-BR");

    }


    function municipioEhOutros(valor) {

        const normalizado = normalizarTexto(valor);

        return [
            "__outros__",
            "outros",
            "outro",
            "outra cidade",
            "outro municipio",
            "outros municipios"
        ].includes(normalizado);

    }


    function criarStatusLocalidades() {

        if (document.getElementById("localidadesStatus")) {
            return document.getElementById("localidadesStatus");
        }

        const status = document.createElement("small");

        status.id = "localidadesStatus";
        status.className = "localidades-status";
        status.setAttribute("role", "status");
        status.style.display = "block";
        status.style.marginTop = "8px";
        status.style.fontSize = "12px";
        status.style.color = "#75635e";

        const referencia =
            bairroInput?.closest(".form-group") ||
            municipioSelect?.closest(".form-group");

        if (referencia) {
            referencia.appendChild(status);
        }

        return status;

    }


    function mostrarStatusLocalidades(mensagem, erro = false) {

        const status = criarStatusLocalidades();

        if (!status) return;

        status.textContent = mensagem;
        status.style.color = erro ? "#a32632" : "#75635e";

    }


    function criarCampoDinamico(id, textoLabel, placeholder, referencia) {

        let campo = document.getElementById(id);

        if (campo) return campo;

        const grupo = document.createElement("div");
        grupo.className = "form-group";
        grupo.id = `${id}Group`;

        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = textoLabel;

        const input = document.createElement("input");
        input.type = "text";
        input.id = id;
        input.name = id;
        input.placeholder = placeholder;
        input.autocomplete = "off";
        input.required = true;

        input.style.width = "100%";
        input.style.minHeight = "58px";
        input.style.padding = "16px 18px";
        input.style.background = "#ffffff";
        input.style.border = "1px solid #eadbd5";
        input.style.borderRadius = "13px";
        input.style.font = "inherit";
        input.style.fontSize = "14px";
        input.style.color = "#241b19";
        input.style.boxSizing = "border-box";

        grupo.appendChild(label);
        grupo.appendChild(input);

        if (referencia) {
            referencia.insertAdjacentElement("afterend", grupo);
        }

        return input;

    }


    function obterCampoMunicipioOutro() {

        if (!municipioSelect) return null;

        if (!municipioOutroInput) {

            const referencia =
                municipioSelect.closest(".form-group") ||
                municipioSelect.parentElement;

            municipioOutroInput = criarCampoDinamico(
                "municipioOutro",
                "Informe o município",
                "Digite o nome do município",
                referencia
            );

        }

        return municipioOutroInput;

    }


    function obterCampoBairroOutro() {

        if (!bairroInput) return null;

        if (!bairroOutroInput) {

            const referencia =
                bairroInput.closest(".form-group") ||
                bairroInput.parentElement;

            bairroOutroInput = criarCampoDinamico(
                "bairroOutro",
                "Informe o bairro",
                "Digite o nome do bairro",
                referencia
            );

        }

        return bairroOutroInput;

    }


    function obterMunicipioSelecionado() {

        if (!municipioSelect) return "";

        if (municipioEhOutros(municipioSelect.value)) {

            const campoOutro = obterCampoMunicipioOutro();
            return campoOutro ? campoOutro.value.trim() : "";

        }

        return municipioSelect.value.trim();

    }


    function obterBairroSelecionado() {

        if (!bairroInput) return "";

        if (
            municipioSelect &&
            municipioEhOutros(municipioSelect.value) &&
            bairroInput.tagName === "SELECT"
        ) {

            return bairroOutroInput
                ? bairroOutroInput.value.trim()
                : "";

        }

        return bairroInput.value.trim();

    }


    function obterCampoBairroParaValidacao() {

        if (!bairroInput) return null;

        if (
            municipioSelect &&
            municipioEhOutros(municipioSelect.value) &&
            bairroInput.tagName === "SELECT"
        ) {

            return obterCampoBairroOutro();

        }

        return bairroInput;

    }


    function preencherMunicipios() {

        if (!municipioSelect) return;

        municipioSelect.required = true;

        if (municipioSelect.tagName === "SELECT") {

            const valorAtual = municipioSelect.value;

            municipioSelect.replaceChildren();

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Selecione o município";
            municipioSelect.appendChild(placeholder);

            municipiosDisponiveis
                .filter(municipio => !municipioEhOutros(municipio))
                .forEach(municipio => {

                    const option = document.createElement("option");
                    option.value = municipio;
                    option.textContent = municipio;
                    municipioSelect.appendChild(option);

                });

            // Valor interno estável; o texto exibido continua amigável.
            const outros = document.createElement("option");
            outros.value = "__outros__";
            outros.textContent = "Outros municípios";
            municipioSelect.appendChild(outros);

            if (
                valorAtual &&
                [...municipioSelect.options].some(
                    option => option.value === valorAtual
                )
            ) {
                municipioSelect.value = valorAtual;
            }

        } else if (municipioSelect.tagName === "INPUT") {

            const datalistId = "municipioSuggestions";

            let datalist = document.getElementById(datalistId);

            if (!datalist) {
                datalist = document.createElement("datalist");
                datalist.id = datalistId;
                document.body.appendChild(datalist);
            }

            municipioSelect.setAttribute("list", datalistId);
            datalist.replaceChildren();

            [
                ...municipiosDisponiveis.filter(municipio => !municipioEhOutros(municipio)),
                "Outros municípios"
            ].forEach(municipio => {

                const option = document.createElement("option");
                option.value = municipio;
                datalist.appendChild(option);

            });

        }

    }


    // O Apps Script disponibilizado usa JSONP no doGet().
    // Isso permite consultar a API sem depender de CORS no navegador.
    function chamarApiJsonp(parametros, tempoLimite = 15000) {

        return new Promise((resolve, reject) => {

            if (
                !GOOGLE_SCRIPT_URL ||
                GOOGLE_SCRIPT_URL.includes("COLE_AQUI")
            ) {
                reject(new Error("Configure a URL da API no início do agendamento.js."));
                return;
            }

            const callbackName =
                `plbApiCallback_${Date.now()}_${++jsonpSequence}`;

            const url = new URL(GOOGLE_SCRIPT_URL);

            Object.entries(parametros).forEach(([chave, valor]) => {
                url.searchParams.set(chave, String(valor));
            });

            url.searchParams.set("callback", callbackName);
            url.searchParams.set("_", String(Date.now()));

            const script = document.createElement("script");

            let finalizado = false;

            const limpar = () => {

                if (finalizado) return;

                finalizado = true;

                clearTimeout(temporizador);

                script.remove();

                try {
                    delete window[callbackName];
                } catch {
                    window[callbackName] = undefined;
                }

            };

            const temporizador = setTimeout(() => {

                limpar();

                reject(new Error(
                    "A API demorou demais para responder. Verifique a implantação do Apps Script."
                ));

            }, tempoLimite);

            window[callbackName] = dados => {

                limpar();

                resolve(dados);

            };

            script.onerror = () => {

                limpar();

                reject(new Error(
                    "Não foi possível acessar a API de municípios e bairros."
                ));

            };

            script.src = url.toString();

            document.head.appendChild(script);

        });

    }


    async function buscarBairrosPorMunicipio(municipio) {

        const chave = normalizarTexto(municipio);

        if (bairrosCache.has(chave)) {
            return bairrosCache.get(chave);
        }

        const resposta = await chamarApiJsonp({
            action: "bairros",
            municipio: municipio
        });

        if (!resposta || resposta.success !== true) {
            throw new Error(
                resposta?.message ||
                `Não foi possível carregar os bairros de ${municipio}.`
            );
        }

        const bairros = Array.isArray(resposta.bairros)
            ? resposta.bairros
                .map(item => ({
                    id: item.id || "",
                    municipio: item.municipio || municipio,
                    bairro: String(item.bairro || "").trim(),
                    tipoReferencia: item.tipoReferencia || "",
                    taxaInicial: item.taxaInicial ?? null
                }))
                .filter(item => item.bairro)
            : [];

        bairrosCache.set(chave, bairros);

        return bairros;

    }


    function limparListaBairros(mensagem = "Selecione primeiro o município") {

        bairrosMunicipioAtual = [];

        if (!bairroInput) return;

        if (bairroInput.tagName === "SELECT") {

            bairroInput.replaceChildren();

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = mensagem;
            bairroInput.appendChild(placeholder);

            bairroInput.disabled = true;

        } else {

            bairroInput.value = "";
            bairroInput.disabled = true;
            bairroInput.placeholder = mensagem;

            const datalist = document.getElementById(BAIRRO_DATALIST_ID);

            if (datalist) datalist.replaceChildren();

        }

    }


    function exibirBairrosNoCampo(bairros, municipio, valorAnterior = "") {

        bairrosMunicipioAtual = bairros;

        const nomes = [...new Set(
            bairros.map(item => item.bairro).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "pt-BR"));

        if (bairroInput.tagName === "SELECT") {

            bairroInput.replaceChildren();

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = nomes.length
                ? "Selecione o bairro"
                : "Nenhum bairro cadastrado";
            bairroInput.appendChild(placeholder);

            nomes.forEach(nome => {

                const option = document.createElement("option");
                option.value = nome;
                option.textContent = nome;
                bairroInput.appendChild(option);

            });

            bairroInput.disabled = nomes.length === 0;
            bairroInput.required = true;

            if (nomes.includes(valorAnterior)) {
                bairroInput.value = valorAnterior;
            }

        } else {

            let datalist = document.getElementById(BAIRRO_DATALIST_ID);

            if (!datalist) {
                datalist = document.createElement("datalist");
                datalist.id = BAIRRO_DATALIST_ID;
                document.body.appendChild(datalist);
            }

            bairroInput.setAttribute("list", BAIRRO_DATALIST_ID);
            bairroInput.disabled = nomes.length === 0;
            bairroInput.required = true;
            bairroInput.placeholder = nomes.length
                ? "Digite ou selecione o bairro"
                : "Nenhum bairro cadastrado";

            datalist.replaceChildren();

            nomes.forEach(nome => {

                const option = document.createElement("option");
                option.value = nome;
                datalist.appendChild(option);

            });

            if (nomes.includes(valorAnterior)) {
                bairroInput.value = valorAnterior;
            } else {
                bairroInput.value = "";
            }

        }

        mostrarStatusLocalidades(
            nomes.length
                ? `${nomes.length} bairro(s) disponível(is) em ${municipio}. Digite para filtrar.`
                : `Nenhum bairro ativo foi encontrado para ${municipio}.`
        );

    }


    async function preencherBairrosDoMunicipio(limparSelecao = true) {

        if (!municipioSelect || !bairroInput) return;

        const municipioDigitado = municipioSelect.value.trim();
        const ehOutro = municipioEhOutros(municipioDigitado);

        const grupoBairro =
            bairroInput.closest(".form-group") ||
            bairroInput.parentElement;

        const campoMunicipioOutro = ehOutro
            ? obterCampoMunicipioOutro()
            : municipioOutroInput;

        if (campoMunicipioOutro) {
            const grupoOutro = campoMunicipioOutro.closest(".form-group");

            if (grupoOutro) grupoOutro.hidden = !ehOutro;

            campoMunicipioOutro.required = ehOutro;
            campoMunicipioOutro.disabled = !ehOutro;

            if (!ehOutro) {
                campoMunicipioOutro.value = "";
            }
        }

        if (ehOutro) {

            bairroRequestToken++;

            bairrosMunicipioAtual = [];

            if (bairroInput.tagName === "SELECT") {

                if (grupoBairro) grupoBairro.hidden = true;

                const campoOutro = obterCampoBairroOutro();
                const grupoOutro = campoOutro.closest(".form-group");

                if (grupoOutro) grupoOutro.hidden = false;

                campoOutro.required = true;
                campoOutro.disabled = false;

            } else {

                if (grupoBairro) grupoBairro.hidden = false;

                bairroInput.disabled = false;
                bairroInput.required = true;
                bairroInput.placeholder = "Digite o bairro";

                if (limparSelecao) bairroInput.value = "";

                const datalist = document.getElementById(BAIRRO_DATALIST_ID);

                if (datalist) datalist.replaceChildren();

            }

            mostrarStatusLocalidades(
                "Como você selecionou Outros, informe o município e o bairro manualmente."
            );

            return;

        }

        if (bairroOutroInput) {

            const grupoOutro =
                bairroOutroInput.closest(".form-group");

            if (grupoOutro) grupoOutro.hidden = true;

            bairroOutroInput.required = false;
            bairroOutroInput.value = "";

        }

        if (!municipioDigitado) {

            bairroRequestToken++;

            limparListaBairros();

            mostrarStatusLocalidades(
                "Selecione primeiro o município para carregar os bairros."
            );

            return;

        }

        // Se o município for um campo de digitação, só consulta quando
        // o texto corresponder exatamente a um município retornado pela API.
        const municipioEncontrado = municipiosDisponiveis.find(item =>
            normalizarTexto(item) === normalizarTexto(municipioDigitado)
        );

        if (!municipioEncontrado) {

            bairroRequestToken++;

            limparListaBairros("Selecione um município válido");

            if (municipioSelect.tagName === "INPUT") {
                mostrarStatusLocalidades(
                    "Digite e selecione um município da lista ou escolha Outros."
                );
            }

            return;

        }

        const valorAnterior = limparSelecao ? "" : bairroInput.value;
        const token = ++bairroRequestToken;

        bairroInput.disabled = true;

        if (bairroInput.tagName === "SELECT") {

            bairroInput.replaceChildren();

            const carregando = document.createElement("option");
            carregando.value = "";
            carregando.textContent = "Carregando bairros...";
            bairroInput.appendChild(carregando);

        } else {

            bairroInput.value = "";
            bairroInput.placeholder = "Carregando bairros...";

        }

        mostrarStatusLocalidades(
            `Carregando bairros de ${municipioEncontrado}...`
        );

        try {

            const bairros = await buscarBairrosPorMunicipio(municipioEncontrado);

            // Ignora respostas antigas caso a pessoa troque de município
            // enquanto a consulta anterior ainda estiver em andamento.
            if (
                token !== bairroRequestToken ||
                normalizarTexto(municipioSelect.value) !==
                    normalizarTexto(municipioEncontrado)
            ) {
                return;
            }

            exibirBairrosNoCampo(
                bairros,
                municipioEncontrado,
                valorAnterior
            );

        } catch (erro) {

            if (token !== bairroRequestToken) return;

            console.error("Erro ao carregar bairros:", erro);

            limparListaBairros("Não foi possível carregar os bairros");

            mostrarStatusLocalidades(
                erro.message || "Erro ao consultar os bairros.",
                true
            );

        }

    }


    async function carregarMunicipiosEBairros() {

        if (!municipioSelect || !bairroInput) {

            console.warn(
                "Campos de município/bairro não encontrados. " +
                'Confira se o HTML possui id="municipio" e id="bairro".'
            );

            return;

        }

        municipioSelect.required = true;
        bairroInput.required = true;

        if (
            !GOOGLE_SCRIPT_URL ||
            GOOGLE_SCRIPT_URL.includes("COLE_AQUI")
        ) {

            mostrarStatusLocalidades(
                "Configure a URL da API no início do agendamento.js.",
                true
            );

            return;

        }

        mostrarStatusLocalidades("Carregando municípios...");

        try {

            // Compatível com o doGet do Apps Script enviado:
            // ?action=municipios
            const resposta = await chamarApiJsonp({
                action: "municipios"
            });

            if (!resposta || resposta.success !== true) {
                throw new Error(
                    resposta?.message ||
                    "A API não conseguiu consultar os municípios."
                );
            }

            municipiosDisponiveis = Array.isArray(resposta.municipios)
                ? resposta.municipios
                    .map(item => String(item || "").trim())
                    .filter(item => Boolean(item) && !municipioEhOutros(item))
                : [];

            municipiosDisponiveis = [...new Set(municipiosDisponiveis)]
                .sort((a, b) => a.localeCompare(b, "pt-BR"));

            if (!municipiosDisponiveis.length) {
                throw new Error(
                    "A API respondeu, mas não encontrou municípios. " +
                    "Confira se existem bairros ativos na aba Deslocamentos."
                );
            }

            localidadesCarregadas = true;

            preencherMunicipios();

            // Se já houver um município selecionado no HTML,
            // carrega os bairros correspondentes.
            await preencherBairrosDoMunicipio(false);

            console.log(
                "Municípios carregados pela API:",
                municipiosDisponiveis
            );

        } catch (erro) {

            console.error("Erro ao carregar municípios:", erro);

            mostrarStatusLocalidades(
                erro.message ||
                "Não foi possível carregar os municípios. Confira a URL e a implantação da API.",
                true
            );

        }

    }


    if (municipioSelect) {

        municipioSelect.addEventListener("change", function () {

            if (municipioEhOutros(this.value)) {

                const campoOutro = obterCampoMunicipioOutro();
                const grupoOutro = campoOutro.closest(".form-group");

                if (grupoOutro) grupoOutro.hidden = false;

            } else if (municipioOutroInput) {

                const grupoOutro =
                    municipioOutroInput.closest(".form-group");

                if (grupoOutro) grupoOutro.hidden = true;

                municipioOutroInput.value = "";

            }

            preencherBairrosDoMunicipio(true);

        });

        municipioSelect.addEventListener("input", function () {

            if (municipioSelect.tagName === "INPUT") {
                preencherBairrosDoMunicipio(true);
            }

        });

    }


    if (bairroInput) {

        bairroInput.addEventListener("input", function () {

            this.setCustomValidity("");

        });

        bairroInput.addEventListener("change", function () {

            this.setCustomValidity("");

        });

    }


    // Carrega os dados da aba Deslocamentos ao abrir o formulário.
    carregarMunicipiosEBairros();


    /* ======================================
       7. MÁSCARA DO TELEFONE
    ====================================== */

    telefone.addEventListener("input", function () {

        let digits = this.value
            .replace(/\D/g, "")
            .slice(0, 11);

        if (digits.length <= 2) {

            this.value = digits
                ? `(${digits}`
                : "";

        } else if (digits.length <= 6) {

            this.value =
                `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

        } else if (digits.length <= 10) {

            this.value =
                `(${digits.slice(0, 2)}) ` +
                `${digits.slice(2, 6)}-${digits.slice(6)}`;

        } else {

            this.value =
                `(${digits.slice(0, 2)}) ` +
                `${digits.slice(2, 7)}-${digits.slice(7)}`;

        }

        this.setCustomValidity("");

    });


    /* ======================================
       7. QUANTIDADE DE PESSOAS
    ====================================== */

    form.addEventListener("change", function (event) {

        const target = event.target;

        if (target.name !== "quantidadePessoas") {
            return;
        }

        const isMore = target.value === "mais";

        customQuantity.hidden = !isMore;

        quantityInput.required = isMore;

        quantityInput.setCustomValidity("");

        form.querySelectorAll(
            'input[name="quantidadePessoas"]'
        ).forEach(radio => {

            radio.setCustomValidity("");

        });

        if (!isMore) {

            quantityInput.value = "";

        }

    });


    /* ======================================
       8. VALIDAR DADOS GERAIS
    ====================================== */

    function validateStepOne() {

        nomeResponsavel.setCustomValidity(
            nomeResponsavel.value.trim()
                ? ""
                : "Informe seu nome completo."
        );


        const digits = telefone.value.replace(/\D/g, "");

        if (![10, 11].includes(digits.length)) {

            telefone.setCustomValidity(
                "Informe um telefone válido com DDD."
            );

        } else {

            telefone.setCustomValidity("");

        }


        if (
            dataInput.value &&
            dataInput.value < getToday()
        ) {

            dataInput.setCustomValidity(
                "Escolha uma data igual ou posterior à data de hoje."
            );

        } else {

            dataInput.setCustomValidity("");

        }


        const fields = [
            nomeResponsavel,
            telefone,
            dataInput,
            horario,
            localizacao
        ];

        // Validar município.
        if (municipioSelect) {

            let municipioValido = Boolean(municipioSelect.value.trim());

            if (
                municipioValido &&
                municipioSelect.tagName === "INPUT" &&
                !municipioEhOutros(municipioSelect.value)
            ) {
                municipioValido = municipiosDisponiveis.some(item =>
                    normalizarTexto(item) ===
                    normalizarTexto(municipioSelect.value)
                );
            }

            municipioSelect.setCustomValidity(
                municipioValido
                    ? ""
                    : "Selecione um município da lista ou escolha Outros."
            );

            fields.push(municipioSelect);

            if (municipioEhOutros(municipioSelect.value)) {

                const campoOutro = obterCampoMunicipioOutro();

                const grupoOutro = campoOutro.closest(".form-group");

                if (grupoOutro) grupoOutro.hidden = false;

                campoOutro.required = true;

                campoOutro.setCustomValidity(
                    campoOutro.value.trim()
                        ? ""
                        : "Informe o município."
                );

                fields.push(campoOutro);

            }

        }

        // Validar bairro. Para município Outros, permitir digitação livre.
        if (bairroInput) {

            const campoBairro = obterCampoBairroParaValidacao();

            if (campoBairro) {

                campoBairro.required = true;

                let bairroValido = Boolean(obterBairroSelecionado());

                if (
                    bairroValido &&
                    !municipioEhOutros(municipioSelect?.value) &&
                    bairroInput.tagName !== "SELECT"
                ) {
                    bairroValido = bairrosMunicipioAtual.some(item =>
                        normalizarTexto(item.bairro) ===
                        normalizarTexto(bairroInput.value)
                    );
                }

                campoBairro.setCustomValidity(
                    bairroValido
                        ? ""
                        : "Selecione um bairro da lista ou informe o bairro manualmente em Outros."
                );

                fields.push(campoBairro);

            }

        }

        for (const field of fields) {

            if (!field.checkValidity()) {

                field.reportValidity();

                return false;

            }

        }


        const selectedQuantity = form.querySelector(
            'input[name="quantidadePessoas"]:checked'
        );

        if (!selectedQuantity) {

            alert(
                "Por favor, selecione a quantidade de pessoas."
            );

            return false;

        }


        if (selectedQuantity.value === "mais") {

            const quantity = Number(quantityInput.value);

            if (
                !Number.isSafeInteger(quantity) ||
                quantity < 6
            ) {

                quantityInput.setCustomValidity(
                    "Informe uma quantidade válida de pelo menos 6 pessoas."
                );

                quantityInput.reportValidity();

                return false;

            }

            quantityInput.setCustomValidity("");

        }

        return true;

    }


    /* ======================================
       9. OBTER QUANTIDADE
    ====================================== */

    function getSelectedQuantity() {

        const selected = form.querySelector(
            'input[name="quantidadePessoas"]:checked'
        );

        if (!selected) return 0;

        if (selected.value === "mais") {

            return Number(quantityInput.value);

        }

        return Number(selected.value);

    }


    /* ======================================
       10. CRIAR FORMULÁRIOS INDIVIDUAIS
    ====================================== */

    function renderPeople(quantity) {

        if (
            !Number.isSafeInteger(quantity) ||
            quantity < 1
        ) {
            return;
        }

        totalPeople = quantity;

        let cards = [
            ...peopleForms.querySelectorAll(".person-card")
        ];

        let tabs = [
            ...peopleTabs.querySelectorAll(".person-tab")
        ];


        // Remover pessoas excedentes

        while (cards.length > quantity) {

            cards.pop().remove();

            tabs.pop().remove();

        }


        // Criar novas pessoas

        while (cards.length < quantity) {

            const index = cards.length;

            const clone =
                personTemplate.content.cloneNode(true);

            const card =
                clone.querySelector(".person-card");

            card.dataset.personIndex = index;

            card.id = `person-${index + 1}`;


            card.querySelector(".person-title").textContent =
                `Pessoa ${index + 1}`;

            card.querySelector(".person-number").textContent =
                `CLIENTE ${index + 1}`;


            card.querySelectorAll("[data-group]").forEach(input => {

                const group = input.dataset.group;

                input.name = `${group}_${index + 1}`;

                input.required = group === "servico";

            });


            card.querySelector(
                '[data-field="nome"]'
            ).required = true;


            peopleForms.appendChild(card);

            cards.push(card);


            // Criar aba

            const tab = document.createElement("button");

            tab.type = "button";

            tab.className = "person-tab";

            tab.textContent = `Pessoa ${index + 1}`;

            tab.setAttribute("role", "tab");

            tab.setAttribute(
                "aria-controls",
                card.id
            );

            tab.setAttribute(
                "aria-selected",
                "false"
            );

            tab.dataset.personIndex = index;

            peopleTabs.appendChild(tab);

            tabs.push(tab);


            updatePersonPanels(card);

        }


        currentPersonIndex = Math.min(
            currentPersonIndex,
            quantity - 1
        );

        switchPerson(currentPersonIndex);

    }


    /* ======================================
       11. ALTERNAR ENTRE AS PESSOAS
    ====================================== */

    function switchPerson(index) {

        if (
            index < 0 ||
            index >= totalPeople
        ) {
            return;
        }

        currentPersonIndex = index;


        const cards = [
            ...peopleForms.querySelectorAll(".person-card")
        ];

        const tabs = [
            ...peopleTabs.querySelectorAll(".person-tab")
        ];


        cards.forEach((card, i) => {

            card.hidden = i !== index;

        });


        tabs.forEach((tab, i) => {

            const active = i === index;

            tab.classList.toggle("active", active);

            tab.setAttribute(
                "aria-selected",
                String(active)
            );

        });


        updatePersonNavigation();

        updateProgress();

        markCompletedTabs();

    }


    /* ======================================
       12. NAVEGAÇÃO ENTRE PESSOAS
    ====================================== */

    function updatePersonNavigation() {

        const previousButton =
            personNavigation.querySelector(
                '[data-action="previous-person"]'
            );

        const nextButton =
            personNavigation.querySelector(
                '[data-action="next-person"]'
            );


        personNavigation.hidden = totalPeople <= 1;

        previousButton.hidden =
            currentPersonIndex === 0;

        nextButton.hidden =
            currentPersonIndex === totalPeople - 1;


        personCounter.textContent =
            `Pessoa ${currentPersonIndex + 1} de ${totalPeople}`;

    }


    /* ======================================
       13. CONTROLAR ETAPAS
    ====================================== */

    function showStep(step) {

        const steps = {
            dados: stepDados,
            pessoas: stepPessoas,
            final: stepFinal
        };

        if (!steps[step]) {

            console.error("Etapa não encontrada:", step);

            return;

        }

        currentStep = step;


        Object.entries(steps).forEach(([name, element]) => {

            const active = name === step;

            element.hidden = !active;

            element.classList.toggle(
                "active",
                active
            );

        });


        progressContainer.hidden = false;

        updateProgress();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    /* ======================================
       14. BARRA DE PROGRESSO
    ====================================== */

    function updateProgress() {

        let percent = 10;


        if (currentStep === "dados") {

            percent = 10;

            stepCounter.textContent = "Etapa 1 de 2";

        }


        if (currentStep === "pessoas") {

            percent = Math.round(
                15 + (
                    75 *
                    (currentPersonIndex + 1) /
                    totalPeople
                )
            );

            stepCounter.textContent =
                `Etapa 2 de 2 · Pessoa ${currentPersonIndex + 1} de ${totalPeople}`;

        }


        if (currentStep === "final") {

            percent = 100;

            stepCounter.textContent =
                "Agendamento concluído";

        }


        progressFill.style.width =
            `${percent}%`;

        progressPercent.textContent =
            `${percent}%`;

        progressFill.parentElement.setAttribute(
            "aria-valuenow",
            percent
        );

    }


    /* ======================================
       15. PAINÉIS CONDICIONAIS
    ====================================== */

    function setPanel(card, panelName, visible) {

        const panel = card.querySelector(
            `[data-panel="${panelName}"]`
        );

        if (!panel) return;

        panel.hidden = !visible;

        panel.querySelectorAll(
            'input[type="radio"]'
        ).forEach(input => {

            input.required = visible;

        });

    }


    /* ======================================
       16. LIMPAR ESCOLHAS CONDICIONAIS
    ====================================== */

    function clearGroup(card, group) {

        card.querySelectorAll(
            `input[data-group="${group}"]`
        ).forEach(input => {

            input.checked = false;

            input.setCustomValidity("");

        });

    }


    function clearConditionalChoices(card) {

        const groups = [
            "tipoBabyliss",
            "tipoPenteado",
            "tamanhoCabelo",
            "autorizacaoImagem"
        ];

        groups.forEach(group => {

            clearGroup(card, group);

        });

    }


    /* ======================================
       17. LÓGICA DOS SERVIÇOS
    ====================================== */

    function updatePersonPanels(card) {

        const selectedService = card.querySelector(
            'input[data-group="servico"]:checked'
        );

        const service = selectedService
            ? selectedService.value
            : "";


        if (!service) {

            setPanel(card, "babyliss", false);

            setPanel(card, "penteado", false);

            setPanel(card, "tamanho", false);

            setPanel(card, "imagem", false);

            return;

        }


        const needsBabyliss = [
            "Babyliss",
            "Maquiagem + Babyliss"
        ].includes(service);


        const needsPenteado = [
            "Penteado",
            "Maquiagem + Penteado"
        ].includes(service);


        const needsHair =
            needsBabyliss || needsPenteado;


        const selectedBabyliss = card.querySelector(
            'input[data-group="tipoBabyliss"]:checked'
        );

        const selectedPenteado = card.querySelector(
            'input[data-group="tipoPenteado"]:checked'
        );

        const selectedSize = card.querySelector(
            'input[data-group="tamanhoCabelo"]:checked'
        );


        const styleSelected = needsBabyliss
            ? Boolean(selectedBabyliss)
            : needsPenteado
                ? Boolean(selectedPenteado)
                : false;


        setPanel(
            card,
            "babyliss",
            needsBabyliss
        );

        setPanel(
            card,
            "penteado",
            needsPenteado
        );

        setPanel(
            card,
            "tamanho",
            needsHair && styleSelected
        );


        const canShowImage =
            !needsHair ||
            (styleSelected && Boolean(selectedSize));


        setPanel(
            card,
            "imagem",
            canShowImage
        );

    }


    /* ======================================
       18. VALIDAR CLIENTE
    ====================================== */

    function validatePerson(card) {

        if (!card) return false;

        updatePersonPanels(card);


        const nameInput = card.querySelector(
            '[data-field="nome"]'
        );

        nameInput.setCustomValidity(
            nameInput.value.trim()
                ? ""
                : "Informe o nome completo desta cliente."
        );


        const requiredFields = [
            ...card.querySelectorAll("input[required]")
        ];


        for (const field of requiredFields) {

            if (!field.checkValidity()) {

                field.reportValidity();

                return false;

            }

        }

        return true;

    }


    /* ======================================
       19. VERIFICAR CLIENTE COMPLETA
    ====================================== */

    function isPersonComplete(card) {

        updatePersonPanels(card);


        const name = card.querySelector(
            '[data-field="nome"]'
        );

        if (!name.value.trim()) return false;


        const service = card.querySelector(
            'input[data-group="servico"]:checked'
        );

        if (!service) return false;


        const needsBabyliss = [
            "Babyliss",
            "Maquiagem + Babyliss"
        ].includes(service.value);


        const needsPenteado = [
            "Penteado",
            "Maquiagem + Penteado"
        ].includes(service.value);


        if (needsBabyliss) {

            if (!card.querySelector(
                'input[data-group="tipoBabyliss"]:checked'
            )) return false;

        }


        if (needsPenteado) {

            if (!card.querySelector(
                'input[data-group="tipoPenteado"]:checked'
            )) return false;

        }


        if (needsBabyliss || needsPenteado) {

            if (!card.querySelector(
                'input[data-group="tamanhoCabelo"]:checked'
            )) return false;

        }


        if (!card.querySelector(
            'input[data-group="autorizacaoImagem"]:checked'
        )) return false;


        return true;

    }


    /* ======================================
       20. MARCAR ABAS COMPLETAS
    ====================================== */

    function markCompletedTabs() {

        const cards = [
            ...peopleForms.querySelectorAll(".person-card")
        ];

        const tabs = [
            ...peopleTabs.querySelectorAll(".person-tab")
        ];


        cards.forEach((card, index) => {

            if (!tabs[index]) return;

            tabs[index].classList.toggle(
                "completed",
                isPersonComplete(card)
            );

        });

    }


    /* ======================================
       21. EVENTOS DAS ESCOLHAS
    ====================================== */

    peopleForms.addEventListener(
        "change",
        function (event) {

            const input = event.target;

            const card = input.closest(".person-card");

            if (!card || !input.dataset.group) {
                return;
            }

            const group = input.dataset.group;


            // Mudança de serviço

            if (group === "servico") {

                if (card.dataset.lastService !== input.value) {

                    clearConditionalChoices(card);

                    card.dataset.lastService = input.value;

                }

            }


            // Mudança de Babyliss ou penteado

            if (
                group === "tipoBabyliss" ||
                group === "tipoPenteado"
            ) {

                clearGroup(card, "tamanhoCabelo");

                clearGroup(card, "autorizacaoImagem");

            }


            // Mudança do tamanho do cabelo

            if (group === "tamanhoCabelo") {

                clearGroup(card, "autorizacaoImagem");

            }


            updatePersonPanels(card);

            markCompletedTabs();

            updateProgress();

        }
    );


    peopleForms.addEventListener(
        "input",
        function (event) {

            if (
                event.target.matches('[data-field="nome"]')
            ) {

                event.target.setCustomValidity("");

                markCompletedTabs();

            }

        }
    );


    /* ======================================
       22. CLICAR NAS ABAS
    ====================================== */

    peopleTabs.addEventListener(
        "click",
        function (event) {

            const tab = event.target.closest(".person-tab");

            if (!tab) return;

            switchPerson(
                Number(tab.dataset.personIndex)
            );

        }
    );


    /* ======================================
       23. BOTÃO CONTINUAR
    ====================================== */

    const nextButton = stepDados.querySelector(
        '[data-action="next"]'
    );

    if (!nextButton) {

        console.error("Botão Continuar não encontrado.");

        return;

    }


    nextButton.addEventListener("click", function () {

        if (!validateStepOne()) return;

        const quantity = getSelectedQuantity();

        if (
            !Number.isSafeInteger(quantity) ||
            quantity < 1
        ) {

            alert("Selecione uma quantidade válida de pessoas.");

            return;

        }


        renderPeople(quantity);

        showStep("pessoas");

    });


    /* ======================================
       24. BOTÃO VOLTAR DA ETAPA 2
    ====================================== */

    const backButton = stepPessoas.querySelector(
        '[data-action="back"]'
    );

    backButton.addEventListener("click", function () {

        showStep("dados");

    });


    /* ======================================
       25. SETA DO CABEÇALHO
    ====================================== */

    headerBackButton.addEventListener(
        "click",
        function (event) {

            // Impede que o link navegue antes de executar a lógica das etapas.
            event.preventDefault();

            // Se estiver na etapa de clientes,
            // voltar para os dados gerais.

            if (currentStep === "pessoas") {

                showStep("dados");

                return;

            }


            // Se estiver na conclusão,
            // voltar para os dados individuais.

            if (currentStep === "final") {

                showStep("pessoas");

                return;

            }


            // Se estiver na primeira etapa,
            // retornar à landing page.

            if (currentStep === "dados") {

                window.location.href = "index.html";

            }

        }
    );


    /* ======================================
       26. PESSOA ANTERIOR
    ====================================== */

    const previousPersonButton =
        personNavigation.querySelector(
            '[data-action="previous-person"]'
        );

    previousPersonButton.addEventListener(
        "click",
        function () {

            switchPerson(currentPersonIndex - 1);

        }
    );


    /* ======================================
       27. PRÓXIMA PESSOA
    ====================================== */

    const nextPersonButton =
        personNavigation.querySelector(
            '[data-action="next-person"]'
        );

    nextPersonButton.addEventListener(
        "click",
        function () {

            const currentCard = peopleForms.querySelector(
                `.person-card[data-person-index="${currentPersonIndex}"]`
            );

            if (!validatePerson(currentCard)) return;

            switchPerson(currentPersonIndex + 1);

        }
    );


    /* ======================================
       28. GERAR CÓDIGO DO AGENDAMENTO
    ====================================== */

    function generateBookingId() {

        const now = new Date();

        const year = now.getFullYear();

        const month = String(now.getMonth() + 1)
            .padStart(2, "0");

        const day = String(now.getDate())
            .padStart(2, "0");

        const datePart = `${year}${month}${day}`;

        const randomPart = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

        return `PLB-${datePart}-${randomPart}`;

    }


    /* ======================================
       29. COLETAR DADOS DAS CLIENTES
    ====================================== */

    function getPersonData(card, index) {

        const service = card.querySelector(
            'input[data-group="servico"]:checked'
        ).value;


        function getChoice(group) {

            const selected = card.querySelector(
                `input[data-group="${group}"]:checked`
            );

            return selected ? selected.value : "";

        }


        return {

            numeroPessoa: index + 1,

            nome: card.querySelector(
                '[data-field="nome"]'
            ).value.trim(),

            servico: service,

            tipoBabyliss: getChoice("tipoBabyliss"),

            tipoPenteado: getChoice("tipoPenteado"),

            tamanhoCabelo: getChoice("tamanhoCabelo"),

            autorizacaoImagem: getChoice("autorizacaoImagem")

        };

    }


    /* ======================================
       30. MONTAR DADOS GERAIS
    ====================================== */

    function buildBookingPayload() {

        const cards = [
            ...peopleForms.querySelectorAll(".person-card")
        ];


        return {

            bookingId: generateBookingId(),

            requestedAt: new Date().toISOString(),

            responsavel: nomeResponsavel.value.trim(),

            telefone: telefone.value,

            municipio: obterMunicipioSelecionado(),

            bairro: obterBairroSelecionado(),

            dataDesejada: dataInput.value,

            horarioDesejado: horario.value,

            localizacao: localizacao.value.trim(),

            quantidadePessoas: totalPeople,

            status: "Pendente de confirmação",

            clientes: cards.map((card, index) => {

                return getPersonData(card, index);

            })

        };

    }


    /* ======================================
       31. GOOGLE PLANILHAS
       ENVIO POST + CONFIRMAÇÃO REAL PELO STATUS
    ====================================== */

    /*
     * O formulário é enviado por um iframe oculto para evitar problemas de CORS.
     * Não dependemos do postMessage da resposta do Apps Script, pois essa mensagem
     * pode não chegar à página principal por causa dos frames intermediários do Google.
     *
     * Depois do POST, a confirmação é feita consultando action=status com o mesmo
     * bookingId. A tela de sucesso só aparece quando o ID estiver na planilha.
     */

    function enviarFormularioOcultoPorIframe(payload) {

        const nomeIframe =
            `plbEnvio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const iframe = document.createElement("iframe");
        iframe.name = nomeIframe;
        iframe.title = "Envio do agendamento";
        iframe.style.display = "none";
        iframe.setAttribute("aria-hidden", "true");

        const envioForm = document.createElement("form");
        envioForm.method = "POST";
        envioForm.action = GOOGLE_SCRIPT_URL;
        envioForm.target = nomeIframe;
        envioForm.acceptCharset = "UTF-8";
        envioForm.style.display = "none";

        const campoPayload = document.createElement("input");
        campoPayload.type = "hidden";
        campoPayload.name = "payload";
        campoPayload.value = JSON.stringify(payload);
        envioForm.appendChild(campoPayload);

        let finalizado = false;

        function limpar() {
            if (finalizado) return;
            finalizado = true;
            envioForm.remove();
            iframe.remove();
        }

        document.body.appendChild(iframe);
        document.body.appendChild(envioForm);

        try {
            // O Apps Script responde com JSON dentro do iframe.
            // A confirmação real será consultada separadamente pela API de status.
            envioForm.submit();
        } catch (erro) {
            limpar();

            throw new Error(
                "Não foi possível enviar os dados ao Google Planilhas: " +
                (erro.message || "erro de comunicação.")
            );
        }

        // Mantém o iframe ativo enquanto a consulta de status é realizada.
        return limpar;
    }


    async function aguardarConfirmacaoAgendamento(
        bookingId,
        tempoLimite = 45000,
        intervalo = 1500
    ) {

        const idEsperado = String(bookingId || "").trim();

        if (!idEsperado) {
            throw new Error("O código do agendamento não foi gerado.");
        }

        const inicio = Date.now();
        let ultimaMensagem = "";

        while (Date.now() - inicio < tempoLimite) {

            const tempoRestante = tempoLimite - (Date.now() - inicio);

            try {

                const resposta = await chamarApiJsonp(
                    {
                        action: "status",
                        bookingId: idEsperado
                    },
                    Math.min(12000, Math.max(1000, tempoRestante))
                );

                const idRetornado = String(
                    resposta?.bookingId || ""
                ).trim();

                const registrado =
                    resposta?.registrado === true ||
                    resposta?.registered === true;

                if (
                    resposta?.success === true &&
                    registrado &&
                    idRetornado === idEsperado
                ) {
                    return resposta;
                }

                if (resposta?.success === false) {
                    ultimaMensagem =
                        resposta.message ||
                        "A API não conseguiu consultar o registro.";
                } else if (
                    resposta?.success === true &&
                    idRetornado === idEsperado &&
                    !registrado
                ) {
                    ultimaMensagem =
                        "O agendamento ainda não apareceu na planilha.";
                } else {
                    ultimaMensagem =
                        "A API ainda não confirmou o código do agendamento.";
                }

            } catch (erro) {

                ultimaMensagem =
                    erro?.message ||
                    "Falha ao consultar a confirmação na planilha.";

            }

            const restanteAguardar =
                tempoLimite - (Date.now() - inicio);

            if (restanteAguardar > 0) {
                await new Promise(resolve =>
                    setTimeout(
                        resolve,
                        Math.min(intervalo, restanteAguardar)
                    )
                );
            }

        }

        throw new Error(
            "O formulário foi enviado, mas não foi possível confirmar " +
            "automaticamente o registro na planilha. " +
            "Código do agendamento: " + idEsperado + ". " +
            (ultimaMensagem
                ? "Último retorno: " + ultimaMensagem
                : "Verifique a planilha antes de iniciar um novo agendamento.")
        );
    }


    async function sendToGoogleSheets(payload) {

        if (
            !GOOGLE_SCRIPT_URL ||
            GOOGLE_SCRIPT_URL.includes("COLE_AQUI")
        ) {

            if (MODO_DE_TESTE_SEM_PLANILHA) {
                console.log("PRÉVIA DO AGENDAMENTO:", payload);

                return {
                    success: true,
                    demo: true
                };
            }

            throw new Error(
                "Google Planilhas ainda não foi conectado."
            );
        }

        let limparEnvio = null;

        try {

            // Envia uma única vez. A consulta de status confirma a gravação.
            limparEnvio = enviarFormularioOcultoPorIframe(payload);

            const resposta = await aguardarConfirmacaoAgendamento(
                payload.bookingId,
                45000,
                1500
            );

            console.log(
                "Agendamento gravado e confirmado pela API de status:",
                resposta
            );

            return {
                success: true,
                demo: false,
                respostaServidor: resposta
            };

        } catch (erro) {

            console.error(
                "Erro ao enviar ou confirmar agendamento no Google Planilhas:",
                erro
            );

            throw new Error(
                erro.message ||
                "Não foi possível confirmar o agendamento na planilha."
            );

        } finally {

            if (limparEnvio) {
                limparEnvio();
            }

        }
    }


    /* ======================================
       32. TELA DE SUCESSO
    ====================================== */

    function showSuccess(payload, demoMode = false) {

        function setText(id, value) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value == null ? "" : String(value);
            }
        }

        const dateParts = String(payload.dataDesejada || "").split("-");
        const formattedDate = dateParts.length === 3
            ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
            : (payload.dataDesejada || "");

        setText("successBookingId", payload.bookingId);
        setText("successResponsible", payload.responsavel);
        const quantidadeClientes = Array.isArray(payload.clientes)
            ? payload.clientes.length
            : Number(payload.quantidadePessoas || 0);

        setText(
            "successPeople",
            `${quantidadeClientes} ${
                quantidadeClientes === 1 ? "pessoa" : "pessoas"
            }`
        );
        setText("successDate", formattedDate);
        setText("successTime", payload.horarioDesejado);
        setText("successMunicipio", payload.municipio);
        setText("successBairro", payload.bairro);

        const status = document.getElementById("successStatus");
        const title = document.getElementById("successTitle");
        const message = document.getElementById("successMessage");
        const notice = document.getElementById("successNotice");

        if (demoMode) {
            if (title) title.textContent = "Prévia do agendamento";

            if (message) {
                message.textContent =
                    "A tela de conclusão está funcionando! " +
                    "Esta é uma demonstração do sistema.";
            }

            if (status) {
                status.textContent = "Modo de teste — não enviado";
                status.classList.add("demo");
            }

            if (notice) {
                notice.textContent =
                    "Atenção: esta solicitação ainda não foi salva. " +
                    "A conexão com o Google Planilhas será configurada na próxima etapa.";
            }
        } else {
            if (title) title.textContent = "Agendamento finalizado!";

            if (message) {
                message.textContent =
                    "Obrigada por escolher a Paloma Lima Beauty! " +
                    "Sua solicitação foi registrada com sucesso.";
            }

            if (status) {
                status.textContent = "Aguardando confirmação";
                status.classList.remove("demo");
            }

            if (notice) {
                notice.textContent =
                    "Nossa equipe entrará em contato para verificar " +
                    "a disponibilidade e confirmar o atendimento.";
            }
        }

        const clientsList = document.getElementById("successClients");

        if (clientsList) {
            clientsList.replaceChildren();

            (payload.clientes || []).forEach((client, index) => {
                const item = document.createElement("li");
                const name = document.createElement("strong");
                const service = document.createElement("span");

                name.textContent =
                    `Pessoa ${index + 1}: ${client.nome || "Cliente"}`;

                service.textContent = client.servico || "";

                item.appendChild(name);
                item.appendChild(service);
                clientsList.appendChild(item);
            });
        }

        showStep("final");
    }

    /* ======================================
       33. FINALIZAR AGENDAMENTO
    ====================================== */

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (
                currentStep !== "pessoas" ||
                submitting
            ) {
                return;
            }


            const cards = [
                ...peopleForms.querySelectorAll(".person-card")
            ];


            // Validar todas as clientes

            for (let i = 0; i < cards.length; i++) {

                switchPerson(i);

                if (!validatePerson(cards[i])) {

                    return;

                }

            }


            const payload = payloadPendente || buildBookingPayload();
            payloadPendente = payload;


            submitting = true;

            finishButton.disabled = true;

            finishButton.textContent = "Enviando...";


            try {

                const result =
                    await sendToGoogleSheets(payload);


                if (result.success) {

                    payloadPendente = null;

                    showSuccess(
                        payload,
                        result.demo
                    );

                }

            } catch (error) {

                console.error(
                    "Erro ao enviar agendamento:",
                    error
                );

                alert(
                    "Não foi possível confirmar seu agendamento.\n\n" +
                    (error.message || "Verifique sua conexão e tente novamente.")
                );

            } finally {

                submitting = false;

                finishButton.disabled = false;

                finishButton.innerHTML =
                    'Finalizar agendamento <span>&#10003;</span>';

            }

        }
    );


    /* ======================================
       34. INICIALIZAÇÃO
    ====================================== */

    updateProgress();

    console.log(
        "Paloma Lima Beauty: sistema carregado com sucesso!"
    );

    if (!municipioSelect || !bairroInput) {
        console.warn(
            'Para a integração de localidades, o HTML precisa conter ' +
            'os campos com id="municipio" e id="bairro".'
        );
    }

});
