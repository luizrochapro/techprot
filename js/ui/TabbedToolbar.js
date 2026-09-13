import { i18n } from './i18n.js';
import { TechProtSerializer } from '../io/TechProtSerializer.js';
import { TechProtParser } from '../io/TechProtParser.js';
import { PowerFlow } from '../simulation/PowerFlow.js';
import { ShortCircuit } from '../simulation/ShortCircuit.js';
import { Harmonics } from '../simulation/Harmonics.js';
import { StabilityDialog } from './StabilityDialog.js';
import { ReportDialog } from './ReportDialog.js';
import { LabelManagerDialog } from './LabelManagerDialog.js';
import { Dialogs } from './Dialogs.js';

export class TabbedToolbar {
    constructor(containerElement, app) {
        this.container = containerElement;
        this.app = app;
        this.activeTab = 'arquivo'; // Default = aba Arquivo ao abrir o sistema
        this.isCollapsed = false;

        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="ribbon-tabs-bar">
                <div class="ribbon-tabs-list" id="ribbonTabsList">
                    <button class="ribbon-tab-btn active" data-tab="arquivo">
                        <span class="ribbon-tab-icon">📁</span>
                        <span>Arquivo</span>
                    </button>
                    <button class="ribbon-tab-btn" data-tab="ferramentas">
                        <span class="ribbon-tab-icon">🛠️</span>
                        <span>Ferramentas</span>
                    </button>
                    <button class="ribbon-tab-btn" data-tab="simulacao">
                        <span class="ribbon-tab-icon">⚡</span>
                        <span>Simulação</span>
                    </button>
                </div>
                <div class="ribbon-tabs-right">
                    <span class="ribbon-system-badge" title="Potência Base do Sistema">Sbase: <strong>${this.app.model.basePower} MVA</strong></span>
                    <button class="ribbon-collapse-toggle" id="btnRibbonCollapse" title="Recolher / Expandir Barra de Ferramentas">
                        ▲
                    </button>
                </div>
            </div>

            <div class="ribbon-content-body" id="ribbonContentBody">
                <!-- ================= TAB 1: ARQUIVO ================= -->
                <div class="ribbon-pane" id="paneArquivo" style="display: flex;">
                    <!-- Grupo Projeto -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn" id="rbnNew" title="Criar Novo Projeto em Branco">
                                <span class="rbn-icon">📄</span>
                                <span class="rbn-label">Novo</span>
                            </button>
                            <label for="rbnFileInput" class="ribbon-btn" title="Abrir projeto .tp (compatível com .psp/.xml)">
                                <span class="rbn-icon">📂</span>
                                <span class="rbn-label">Abrir</span>
                            </label>
                            <input type="file" id="rbnFileInput" accept=".tp,.psp,.xml" style="display:none;">
                            <button class="ribbon-btn" id="rbnSave" title="Salvar Projeto (.tp)">
                                <span class="rbn-icon">💾</span>
                                <span class="rbn-label">Salvar</span>
                            </button>
                            <button class="ribbon-btn" id="rbnExportPng" title="Exportar Imagem do Diagrama">
                                <span class="rbn-icon">🖼️</span>
                                <span class="rbn-label">Exportar PNG</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Projeto</span>
                    </div>

                    <!-- Grupo Preferências -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn" id="rbnTheme" title="Alternar entre Tema Escuro e Claro">
                                <span class="rbn-icon">🌓</span>
                                <span class="rbn-label">Tema</span>
                            </button>
                            <button class="ribbon-btn" id="rbnLang" title="Alternar Idioma (Português / English)">
                                <span class="rbn-icon">🌐</span>
                                <span class="rbn-label">Idioma</span>
                            </button>
                            <button class="ribbon-btn" id="rbnAbout" title="Sobre o TechProt Web">
                                <span class="rbn-icon">ℹ️</span>
                                <span class="rbn-label">Sobre</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Ambiente</span>
                    </div>
                </div>

                <!-- ================= TAB 2: FERRAMENTAS ================= -->
                <div class="ribbon-pane" id="paneFerramentas" style="display: none;">
                    <!-- Grupo Manipulação CAD -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn rbn-tool-btn active" data-tool="select" id="rbnToolSelect" title="Selecionar e Mover Elementos">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5V2z"/></svg>
                                </span>
                                <span class="rbn-label">Selecionar</span>
                            </button>
                            <button class="ribbon-btn" id="rbnAlignGrid" title="Alinhar Elementos Selecionados à Grade">
                                <span class="rbn-icon">📐</span>
                                <span class="rbn-label">Alinhar</span>
                            </button>
                            <button class="ribbon-btn" id="rbnFitScreen" title="Ajustar Visualização ao Diagrama Completo">
                                <span class="rbn-icon">🔍</span>
                                <span class="rbn-label">Ajustar Tela</span>
                            </button>
                            <button class="ribbon-btn" id="rbnToggleGrid" title="Ligar / Desligar Grade do Diagrama">
                                <span class="rbn-icon">▦</span>
                                <span class="rbn-label">Grade</span>
                            </button>
                            <button class="ribbon-btn rbn-btn-danger" id="rbnDelete" title="Excluir Elementos Selecionados (Del)">
                                <span class="rbn-icon">🗑️</span>
                                <span class="rbn-label">Excluir</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Operações CAD</span>
                    </div>

                    <!-- Grupo Inserção de Elementos -->
                    <div class="ribbon-group ribbon-group-elements">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn rbn-tool-btn" data-tool="bus" id="rbnToolBus" title="Inserir Barra (Clique no diagrama para posicionar)">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><rect x="2" y="9" width="20" height="5" rx="1.5" fill="currentColor"/><circle cx="6" cy="11.5" r="1.5" fill="#fff"/><circle cx="18" cy="11.5" r="1.5" fill="#fff"/></svg>
                                </span>
                                <span class="rbn-label">Barra</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="line" id="rbnToolLine" title="Inserir Linha de Transmissão (Conectar entre barras)">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><path d="M4 18L20 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="4" cy="18" r="3" fill="currentColor"/><circle cx="20" cy="6" r="3" fill="currentColor"/></svg>
                                </span>
                                <span class="rbn-label">Linha</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="transformer" id="rbnToolTransf" title="Inserir Transformador de 2 Enrolamentos (com OLTC)">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><circle cx="12" cy="7" r="4.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="15" r="4.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 18L17 4" stroke="#f59e0b" stroke-width="1.8"/></svg>
                                </span>
                                <span class="rbn-label">Trafo</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="generator" id="rbnToolGen" title="Inserir Gerador Síncrono (com AVR e Gov)">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12c1-3 3-3 4 0s3 3 4 0" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                                </span>
                                <span class="rbn-label">Gerador</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="load" id="rbnToolLoad" title="Inserir Carga PQ">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><path d="M12 3v10m-5 0l5 7 5-7z" stroke="currentColor" stroke-width="2" fill="currentColor"/></svg>
                                </span>
                                <span class="rbn-label">Carga</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="capacitor" id="rbnToolCap" title="Inserir Banco de Capacitores Shunt">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><path d="M6 10h12M6 14h12M12 4v6m0 4v6" stroke="currentColor" stroke-width="2"/></svg>
                                </span>
                                <span class="rbn-label">Capacitor</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="inductor" id="rbnToolInd" title="Inserir Reator / Indutor Shunt">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><path d="M4 12a4 4 0 0 1 5-3 4 4 0 0 1 6 0 4 4 0 0 1 5 3" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                                </span>
                                <span class="rbn-label">Indutor</span>
                            </button>
                            <button class="ribbon-btn rbn-tool-btn" data-tool="relay" id="rbnToolRelay" title="Inserir Relé de Proteção 50/51 e 50N/51N (clique sobre um disjuntor)">
                                <span class="rbn-icon">
                                    <svg viewBox="0 0 24 24" width="22" height="20"><rect x="2" y="7" width="6" height="6" fill="currentColor"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M14.6 10h1.4" stroke="currentColor" stroke-width="1.6"/><circle cx="19.5" cy="10" r="3.6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M17.6 8.6h3.8M17.6 10.2h3.8M17.6 11.8h3.8" stroke="currentColor" stroke-width="0.8"/></svg>
                                </span>
                                <span class="rbn-label">Relé</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Inserir Elementos da Rede</span>
                    </div>

                    <!-- Grupo Rótulos e Visualização -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn" id="rbnLabelManager" title="Gerenciador Completo de Rótulos do Diagrama (F8)">
                                <span class="rbn-icon">🏷️</span>
                                <span class="rbn-label">Rótulos...</span>
                            </button>
                            <button class="ribbon-btn" id="rbnUpdateLabels" title="Recalcular e Atualizar Todos os TextLabels">
                                <span class="rbn-icon">🔄</span>
                                <span class="rbn-label">Atualizar</span>
                            </button>
                            <button class="ribbon-btn" id="rbnVoltColors" title="Configurar Paleta de Cores por Nível de Tensão">
                                <span class="rbn-icon">🎨</span>
                                <span class="rbn-label">Cores KV</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Rótulos & Diagrama</span>
                    </div>
                </div>

                <!-- ================= TAB 3: SIMULAÇÃO ================= -->
                <div class="ribbon-pane" id="paneSimulacao" style="display: none;">
                    <!-- Grupo Cálculos de Potência -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn rbn-btn-hero rbn-btn-powerflow" id="rbnPowerFlow" title="Executar Fluxo de Carga Newton-Raphson com OLTC (F5)">
                                <span class="rbn-icon-large">▶</span>
                                <div class="rbn-hero-text">
                                    <span class="rbn-hero-title">Fluxo de Carga</span>
                                    <span class="rbn-hero-sub">Newton-Raphson (F5)</span>
                                </div>
                            </button>
                            <button class="ribbon-btn rbn-btn-hero rbn-btn-fault" id="rbnShortCircuit" title="Calcular Curto-Circuito por Componentes Simétricas (F6)">
                                <span class="rbn-icon-large">💥</span>
                                <div class="rbn-hero-text">
                                    <span class="rbn-hero-title">Curto-Circuito</span>
                                    <span class="rbn-hero-sub">Falta & Ramos (F6)</span>
                                </div>
                            </button>
                            <button class="ribbon-btn" id="rbnHarmonics" title="Executar Análise de Harmônicos e THD (F7)">
                                <span class="rbn-icon">〰️</span>
                                <span class="rbn-label">Harmônicos</span>
                            </button>
                            <button class="ribbon-btn rbn-btn-hero rbn-btn-stability" id="rbnStability" title="Abrir Painel de Estabilidade Eletromecânica com AVR e Gov (F9)">
                                <span class="rbn-icon-large">📈</span>
                                <div class="rbn-hero-text">
                                    <span class="rbn-hero-title">Estabilidade</span>
                                    <span class="rbn-hero-sub">Transitórios (F9)</span>
                                </div>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Cálculos de Potência</span>
                    </div>

                    <!-- Grupo Relatórios & Resultados -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn" id="rbnReport" title="Abrir Relatório Geral de Resultados (F10)">
                                <span class="rbn-icon">📊</span>
                                <span class="rbn-label">Relatório</span>
                            </button>
                            <button class="ribbon-btn" id="rbnResetSol" title="Limpar Resultados das Simulações">
                                <span class="rbn-icon">🔄</span>
                                <span class="rbn-label">Redefinir</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Resultados</span>
                    </div>

                    <!-- Grupo Proteção (Sem falha do disjuntor) -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items" style="flex-direction: column; gap: 6px; padding: 4px 8px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; font-size: 12px; color: var(--text-primary);">
                                <input type="checkbox" id="cbNoBreakerFailure" style="width: 16px; height: 16px; accent-color: #22c55e; cursor: pointer;">
                                <span>Sem falha do disjuntor</span>
                            </label>
                            <span style="font-size: 10px; color: var(--text-secondary); line-height: 1.3; max-width: 180px;">
                                Ao operar, relé abre o disjuntor e isola o curto.
                            </span>
                        </div>
                        <span class="ribbon-group-title">Proteção</span>
                    </div>

                    <!-- Grupo Parâmetros -->
                    <div class="ribbon-group">
                        <div class="ribbon-group-items">
                            <button class="ribbon-btn" id="rbnSysOptions" title="Ajustar Base de Potência e Critérios de Convergência">
                                <span class="rbn-icon">⚙️</span>
                                <span class="rbn-label">Parâmetros</span>
                            </button>
                        </div>
                        <span class="ribbon-group-title">Ajustes</span>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    setTab(tabName) {
        this.activeTab = tabName;
        const tabs = this.container.querySelectorAll('.ribbon-tab-btn');
        tabs.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const pArquivo = this.container.querySelector('#paneArquivo');
        const pFerramentas = this.container.querySelector('#paneFerramentas');
        const pSimulacao = this.container.querySelector('#paneSimulacao');

        if (pArquivo) pArquivo.style.display = tabName === 'arquivo' ? 'flex' : 'none';
        if (pFerramentas) pFerramentas.style.display = tabName === 'ferramentas' ? 'flex' : 'none';
        if (pSimulacao) pSimulacao.style.display = tabName === 'simulacao' ? 'flex' : 'none';

        // If ribbon was collapsed, uncollapse on tab click
        if (this.isCollapsed) {
            this.setCollapsed(false);
        }
    }

    setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        const body = this.container.querySelector('#ribbonContentBody');
        const toggleBtn = this.container.querySelector('#btnRibbonCollapse');
        if (body) {
            body.style.display = collapsed ? 'none' : 'flex';
        }
        if (toggleBtn) {
            toggleBtn.textContent = collapsed ? '▼' : '▲';
            toggleBtn.title = collapsed ? 'Expandir Barra de Ferramentas' : 'Recolher Barra de Ferramentas';
        }

        // Notify canvas to resize immediately
        setTimeout(() => {
            if (this.app.canvas) this.app.canvas.resize();
        }, 50);
    }

    updateActiveTool(toolName) {
        const toolBtns = this.container.querySelectorAll('.rbn-tool-btn');
        toolBtns.forEach(btn => {
            if (btn.getAttribute('data-tool') === toolName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    bindEvents() {
        const app = this.app;
        const model = app.model;
        const canvas = app.canvas;

        // 1. Tab switches
        this.container.querySelectorAll('.ribbon-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.setTab(tab);
            });
        });

        // 2. Collapse button
        this.container.querySelector('#btnRibbonCollapse')?.addEventListener('click', () => {
            this.setCollapsed(!this.isCollapsed);
        });

        // ================= TAB ARQUIVO =================
        // Novo
        this.container.querySelector('#rbnNew')?.addEventListener('click', () => {
            if (confirm('Deseja criar um novo projeto? Todas as alterações não salvas serão perdidas.')) {
                model.clear();
                this.app.openedFileName = null;
                canvas.requestRender();
                app.showNotification('Novo projeto em branco criado!');
            }
        });

        // Abrir .tp (compatível com .psp/.xml legados)
        this.container.querySelector('#rbnFileInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const success = TechProtParser.parse(event.target.result, model);
                    if (success) {
                        // Guarda o nome original do arquivo para que Salvar re-use (mesma extensão/ícone)
                        this.app.openedFileName = file.name;
                        canvas.fitToScreen();
                        app.showNotification(`Projeto "${file.name}" carregado com sucesso!`, 'success');
                    } else {
                        app.showNotification('Erro ao processar arquivo .tp', 'error');
                    }
                } catch (err) {
                    app.showNotification(`Erro: ${err.message}`, 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        // Salvar .tp — reutiliza o nome original quando disponível
        this.container.querySelector('#rbnSave')?.addEventListener('click', () => {
            try {
                const xml = TechProtSerializer.serialize(model);
                const filename = this.app.openedFileName || `${model.name || 'projeto_techprot'}.tp`;
                TechProtSerializer.downloadFile(xml, filename);
                TechProtSerializer.downloadFile(xml, filename);
                app.showNotification(`Projeto salvo: ${filename}`, 'success');
            } catch (err) {
                app.showNotification(`Erro ao salvar: ${err.message}`, 'error');
            }
        });

        // Exportar PNG
        this.container.querySelector('#rbnExportPng')?.addEventListener('click', () => {
            const dataUrl = canvas.canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${model.name || 'diagrama_techprot'}.png`;
            a.click();
            app.showNotification('Diagrama unifilar exportado em PNG!');
        });

        // Preferências
        this.container.querySelector('#rbnTheme')?.addEventListener('click', () => {
            app.toggleTheme();
        });

        this.container.querySelector('#rbnLang')?.addEventListener('click', () => {
            app.toggleLanguage();
        });

        this.container.querySelector('#rbnAbout')?.addEventListener('click', () => {
            alert('TechProt Web v2.5\nPlataforma de Estudos em Sistemas Elétricos de Potência.\n\nRecursos: Fluxo de Carga AC com OLTC, Curto-Circuito por Componentes Simétricas, Análise Harmônica, Estabilidade Eletromecânica com diagramas de blocos de AVR e Regulador de Velocidade.');
        });

        // ================= TAB FERRAMENTAS =================
        // Tool buttons
        this.container.querySelectorAll('.rbn-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');
                if (tool) {
                    canvas.setActiveTool(tool);
                    this.updateActiveTool(tool);
                    if (app.floatingToolbar) app.floatingToolbar.setActiveTool(tool);
                }
            });
        });

        // Alinhar
        this.container.querySelector('#rbnAlignGrid')?.addEventListener('click', () => {
            canvas.alignSelectedToGrid();
            app.showNotification('Elementos alinhados à grade!');
        });

        // Ajustar tela
        this.container.querySelector('#rbnFitScreen')?.addEventListener('click', () => {
            canvas.fitToScreen();
        });

        // Grade on/off
        this.container.querySelector('#rbnToggleGrid')?.addEventListener('click', () => {
            canvas.showGrid = !canvas.showGrid;
            canvas.requestRender();
            app.showNotification(`Grade: ${canvas.showGrid ? 'Ativada' : 'Desativada'}`);
        });

        // Excluir
        this.container.querySelector('#rbnDelete')?.addEventListener('click', () => {
            canvas.deleteSelected();
        });

        // Gerenciador de Rótulos
        this.container.querySelector('#rbnLabelManager')?.addEventListener('click', () => {
            LabelManagerDialog.show(model, () => {
                canvas.requestRender();
                app.showNotification('Rótulos do diagrama atualizados com sucesso!');
            });
        });

        // Atualizar rótulos
        this.container.querySelector('#rbnUpdateLabels')?.addEventListener('click', () => {
            model.updateAllLabels();
            canvas.requestRender();
            app.showNotification('Rótulos recalculados!');
        });

        // Cores de níveis de tensão
        this.container.querySelector('#rbnVoltColors')?.addEventListener('click', () => {
            Dialogs.showVoltageLevelsModal(model, () => canvas.requestRender());
        });

        // ================= TAB SIMULAÇÃO =================
        // Checkbox "Sem falha do disjuntor"
        const cbNBF = this.container.querySelector('#cbNoBreakerFailure');
        if (cbNBF) {
            // Restaura estado persistido
            cbNBF.checked = localStorage.getItem('techprot_no_breaker_failure') === '1';
            app.noBreakerFailure = cbNBF.checked;
            cbNBF.addEventListener('change', (e) => {
                app.noBreakerFailure = e.target.checked;
                localStorage.setItem('techprot_no_breaker_failure', e.target.checked ? '1' : '0');
            });
        }

        // Fluxo de Carga (F5)
        const runPF = () => {
            const res = PowerFlow.solve(model);
            canvas.requestRender();
            app.showNotification(res.message, res.success ? 'success' : 'error');
        };
        this.container.querySelector('#rbnPowerFlow')?.addEventListener('click', runPF);

        // Curto-Circuito (F6)
        const runFault = () => {
            const res = ShortCircuit.solve(model);
            const { tripped } = app.evaluateRelays(true);  // sensibiliza relés, aplica abertura de disjuntor se ativo
            // Se algum relé abriu disjuntor e a flag está ativa, re-executa fluxo
            // para refletir a nova topologia (linha isolada pelo curto).
            if (tripped.length > 0 && app.noBreakerFailure) {
                const pfRes = PowerFlow.solve(model);
                app.showNotification(
                    `${res.message}\n⚙ ${tripped.length} relé(s) operaram — disjuntor(es) aberto(s). ${pfRes.message}`,
                    'success'
                );
            } else {
                app.showNotification(res.message, res.success ? 'success' : 'error');
            }
            canvas.requestRender();
        };
        this.container.querySelector('#rbnShortCircuit')?.addEventListener('click', runFault);

        // Harmônicos (F7)
        const runHarmonics = () => {
            const res = Harmonics.solve(model);
            canvas.requestRender();
            app.showNotification(res.message, res.success ? 'success' : 'error');
        };
        this.container.querySelector('#rbnHarmonics')?.addEventListener('click', runHarmonics);

        // Estabilidade (F9)
        const runStability = () => {
            StabilityDialog.show(model, app);
        };
        this.container.querySelector('#rbnStability')?.addEventListener('click', runStability);

        // Relatório (F10)
        const runReport = () => {
            ReportDialog.show(model);
        };
        this.container.querySelector('#rbnReport')?.addEventListener('click', runReport);

        // Redefinir Solução
        this.container.querySelector('#rbnResetSol')?.addEventListener('click', () => {
            for (const b of model.buses) {
                b.results.v = 1.0;
                b.results.angle = 0.0;
                b.results.faultCurrents = [0, 0, 0];
                b.results.faultCurrentKA = 0.0;
                b.results.faultMVA = 0.0;
                b.results.faultVoltage = 1.0;
            }
            for (const l of model.lines) {
                l.results.p12 = 0; l.results.q12 = 0;
                l.results.p21 = 0; l.results.q21 = 0;
                l.results.faultFlowKA = 0;
                l.results.faultDirection = 0;
            }
            for (const t of model.transformers) {
                t.results.p12 = 0; t.results.q12 = 0;
                t.results.p21 = 0; t.results.q21 = 0;
                t.results.faultFlowKA = 0;
                t.results.faultDirection = 0;
            }
            // Limpa estado de sensibilização dos relés
            for (const r of (model.relays || [])) {
                r.tripped = false;
                r.tripTime = null;
                r.tripCurrent = null;
                r.tripUnit = '';
            }
            // Restaura disjuntores abertos pelo sistema de proteção
            for (const l of model.lines) {
                if (typeof l.breakerFrom !== 'undefined') { l.breakerFrom = true; l.breakerTo = true; }
            }
            for (const t of model.transformers) {
                if (typeof t.breakerFrom !== 'undefined') { t.breakerFrom = true; t.breakerTo = true; }
            }
            for (const g of model.generators) { g.isOnline = true; }
            for (const ld of model.loads) { ld.isOnline = true; }
            model.updateAllLabels();
            canvas.requestRender();
            app.showNotification('Resultados de simulação redefinidos.');
        });

        // Parâmetros do Sistema
        this.container.querySelector('#rbnSysOptions')?.addEventListener('click', () => {
            const current = model.basePower || 100.0;
            const input = prompt('Potência Base do Sistema (MVA):', String(current));
            if (input !== null) {
                const val = parseFloat(input);
                if (val > 0) {
                    model.basePower = val;
                    const badge = this.container.querySelector('.ribbon-system-badge strong');
                    if (badge) badge.textContent = `${val} MVA`;
                    model.updateAllLabels();
                    canvas.requestRender();
                    app.showNotification(`Potência base alterada para ${val} MVA`);
                }
            }
        });

        // Keyboard shortcuts for F5, F6, F7, F8, F9, F10
        window.addEventListener('keydown', (e) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            if (e.key === 'F5') {
                e.preventDefault();
                runPF();
            } else if (e.key === 'F6') {
                e.preventDefault();
                this.setTab('simulacao');
                runFault();
            } else if (e.key === 'F7') {
                e.preventDefault();
                this.setTab('simulacao');
                runHarmonics();
            } else if (e.key === 'F8') {
                e.preventDefault();
                this.setTab('ferramentas');
                LabelManagerDialog.show(model, () => canvas.requestRender());
            } else if (e.key === 'F9') {
                e.preventDefault();
                this.setTab('simulacao');
                runStability();
            } else if (e.key === 'F10') {
                e.preventDefault();
                this.setTab('simulacao');
                runReport();
            }
        });
    }
}
