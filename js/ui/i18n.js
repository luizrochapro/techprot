/**
 * i18n.js - Multilingual translations (Portuguese and English)
 */
export const i18n = {
    lang: 'pt_BR', // 'pt_BR' or 'en_US'

    strings: {
        en_US: {
            appName: 'TechProt Web',
            newProject: 'New Project',
            openProject: 'Open .tp',
            saveProject: 'Save .tp',
            exportPng: 'Export PNG',
            file: 'File',
            edit: 'Edit',
            view: 'View',
            simulation: 'Simulation',
            labels: 'Variables',
            help: 'Help',
            runPowerFlow: 'Run Power Flow',
            runFault: 'Calculate Fault',
            runHarmonics: 'Harmonic Analysis',
            runStability: 'Electromechanical Stability',
            labelManager: 'Variable Manager',
            dataReport: 'Simulation Reports',
            options: 'Settings',
            alignGrid: 'Align to Grid',
            fitScreen: 'Fit to Screen',
            themeDark: 'Dark Theme',
            themeLight: 'Light Theme',
            showGrid: 'Show Grid',
            floatingToolbar: 'Floating Elements Toolbar',
            samples: 'Sample Networks',
            sampleIEEE14: 'IEEE 14 Bus System',
            sampleIEEE14Stab: 'IEEE 14 Bus (Transient Stability)',
            sampleIEEE9OLTC: 'IEEE 9 Bus (with OLTC)',
            tools: {
                select: 'Select & Move',
                bus: 'Insert Bus',
                line: 'Insert Transmission Line',
                transformer: 'Insert Transformer',
                generator: 'Insert Generator',
                load: 'Insert Load',
                capacitor: 'Insert Capacitor',
                inductor: 'Insert Inductor'
            },
            dialogs: {
                ok: 'OK',
                cancel: 'Cancel',
                apply: 'Apply',
                close: 'Close',
                delete: 'Delete',
                name: 'Name',
                nominalVoltage: 'Nominal Voltage (kV)',
                targetVoltage: 'Target Voltage (p.u.)',
                busType: 'Bus Type',
                slack: 'Slack Bus',
                pv: 'PV (Voltage Controlled)',
                pq: 'PQ (Load)',
                resistance: 'Resistance R (p.u.)',
                reactance: 'Reactance X (p.u.)',
                susceptance: 'Susceptance B (p.u.)',
                turnsRatio: 'Turns Ratio (Tap p.u.)',
                primaryV: 'Primary Voltage (kV)',
                secondaryV: 'Secondary Voltage (kV)',
                oltcGroup: 'On-Load Tap Changer (OLTC)',
                enableOLTC: 'Enable OLTC Voltage Control',
                controlledBus: 'Controlled Bus',
                deadband: 'Voltage Deadband (p.u.)',
                minTap: 'Minimum Tap (p.u.)',
                maxTap: 'Maximum Tap (p.u.)',
                tapStep: 'Tap Step Size (p.u.)',
                discreteStep: 'Use Discrete Steps',
                activePower: 'Active Power (MW)',
                reactivePower: 'Reactive Power (Mvar)',
                qMin: 'Minimum Q (Mvar)',
                qMax: 'Maximum Q (Mvar)'
            }
        },
        pt_BR: {
            appName: 'TechProt Web',
            newProject: 'Novo Projeto',
            openProject: 'Abrir .tp',
            saveProject: 'Salvar .tp',
            exportPng: 'Exportar PNG',
            file: 'Arquivo',
            edit: 'Editar',
            view: 'Exibir',
            simulation: 'Simulação',
            labels: 'Variáveis',
            help: 'Ajuda',
            runPowerFlow: 'Executar Fluxo de Carga',
            runFault: 'Calcular Curto-Circuito',
            runHarmonics: 'Análise Harmônica',
            runStability: 'Estabilidade Eletromecânica...',
            labelManager: 'Gerenciador de Variáveis',
            dataReport: 'Relatório de Resultados',
            options: 'Opções Gerais',
            alignGrid: 'Alinhar à Grade',
            fitScreen: 'Ajustar ao Diagrama',
            themeDark: 'Tema Escuro',
            themeLight: 'Tema Claro',
            showGrid: 'Exibir Grade',
            floatingToolbar: 'Barra Flutuante de Elementos',
            samples: 'Sistemas Exemplos',
            sampleIEEE14: 'Sistema IEEE 14 Barras',
            sampleIEEE14Stab: 'IEEE 14 Barras (Estabilidade Transitória)',
            sampleIEEE9OLTC: 'Sistema IEEE 9 Barras (com OLTC)',
            tools: {
                select: 'Selecionar e Mover',
                bus: 'Inserir Barra',
                line: 'Inserir Linha de Transmissão',
                transformer: 'Inserir Transformador',
                generator: 'Inserir Gerador',
                load: 'Inserir Carga',
                capacitor: 'Inserir Capacitor',
                inductor: 'Inserir Indutor'
            },
            dialogs: {
                ok: 'OK',
                cancel: 'Cancelar',
                apply: 'Aplicar',
                close: 'Fechar',
                delete: 'Excluir',
                name: 'Nome',
                nominalVoltage: 'Tensão Nominal (kV)',
                targetVoltage: 'Tensão de Referência (p.u.)',
                busType: 'Tipo de Barra',
                slack: 'Barra de Referência (Slack)',
                pv: 'Barra PV (Tensão Controlada)',
                pq: 'Barra PQ (Carga)',
                resistance: 'Resistência R (p.u.)',
                reactance: 'Reatância X (p.u.)',
                susceptance: 'Susceptância B (p.u.)',
                turnsRatio: 'Relação de Espiras (Tap p.u.)',
                primaryV: 'Tensão Primária (kV)',
                secondaryV: 'Tensão Secundária (kV)',
                oltcGroup: 'Comutador Sob Carga (OLTC)',
                enableOLTC: 'Habilitar comutador de tap sob carga (OLTC)',
                controlledBus: 'Barra Controlada',
                deadband: 'Banda Morta de Tensão (p.u.)',
                minTap: 'Tap Mínimo (p.u.)',
                maxTap: 'Tap Máximo (p.u.)',
                tapStep: 'Passo do Tap (p.u.)',
                discreteStep: 'Usar passos discretos de tap',
                activePower: 'Potência Ativa (MW)',
                reactivePower: 'Potência Reativa (Mvar)',
                qMin: 'Q Mínimo (Mvar)',
                qMax: 'Q Máximo (Mvar)'
            }
        }
    },

    t(key) {
        const parts = key.split('.');
        let val = this.strings[this.lang];
        for (const p of parts) {
            if (val && val[p] !== undefined) val = val[p];
            else return key;
        }
        return val;
    },

    setLanguage(lang) {
        if (this.strings[lang]) {
            this.lang = lang;
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const k = el.getAttribute('data-i18n');
                el.textContent = this.t(k);
            });
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const k = el.getAttribute('data-i18n-title');
                el.title = this.t(k);
            });
        }
    }
};
