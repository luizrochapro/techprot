import { i18n } from './i18n.js';
import { TechProtSerializer } from '../io/TechProtSerializer.js';
import { TechProtParser } from '../io/TechProtParser.js';
import { SampleSystems } from '../io/SampleSystems.js';
import { PowerFlow } from '../simulation/PowerFlow.js';
import { ShortCircuit } from '../simulation/ShortCircuit.js';
import { Harmonics } from '../simulation/Harmonics.js';
import { LabelManagerDialog } from './LabelManagerDialog.js';
import { ReportDialog } from './ReportDialog.js';
import { StabilityDialog } from './StabilityDialog.js';
import { Dialogs } from './Dialogs.js';
import { CloudPersistence } from '../io/CloudPersistence.js';

export class MenuBar {
    constructor(navElement, app) {
        this.nav = navElement;
        this.app = app;
        this.init();
    }

    init() {
        this.nav.innerHTML = `
            <div class="menu-bar-container">
                <button class="menu-hamburger" id="menuHamburger" aria-label="Abrir menu principal" aria-controls="menuItems" aria-expanded="false">
                    <span class="hamburger-bar"></span>
                    <span class="hamburger-bar"></span>
                    <span class="hamburger-bar"></span>
                </button>
                <div class="menu-backdrop" id="menuBackdrop"></div>
                <div class="brand">
                    <span class="brand-logo">⚡</span>
                    <span class="brand-name">TechProt <span class="brand-badge">Web</span></span>
                </div>

                <div class="menu-items" id="menuItems" role="menubar">
                    <!-- Arquivo -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="file">${i18n.t('file')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuNew"><span class="menu-icon">📄</span> <span data-i18n="newProject">${i18n.t('newProject')}</span></a>
                            <a href="#" id="menuCloudOpen"><span class="menu-icon">☁️</span> Abrir da Nuvem…</a>
                            <a href="#" id="menuCloudSave"><span class="menu-icon">☁️</span> Salvar na Nuvem…</a>
                            <a href="#" id="menuCloudDelete"><span class="menu-icon">☁️</span> Excluir da Nuvem…</a>
                            <label for="fileInputOpen" class="dropdown-file-label"><span class="menu-icon">📂</span> <span data-i18n="openProject">${i18n.t('openProject')}</span></label>
                            <input type="file" id="fileInputOpen" accept=".tp,.psp,.xml" style="display:none;">
                            <a href="#" id="menuSave"><span class="menu-icon">💾</span> <span data-i18n="saveProject">${i18n.t('saveProject')}</span></a>
                            <div class="menu-divider"></div>
                            <a href="#" id="menuExportPng"><span class="menu-icon">🖼️</span> <span data-i18n="exportPng">${i18n.t('exportPng')}</span></a>
                        </div>
                    </div>

                    <!-- Editar -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="edit">${i18n.t('edit')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuAlignGrid"><span class="menu-icon">📐</span> <span data-i18n="alignGrid">${i18n.t('alignGrid')}</span></a>
                            <a href="#" id="menuDelete"><span class="menu-icon">🗑️</span> <span data-i18n="dialogs.delete">${i18n.t('dialogs.delete')}</span></a>
                            <div class="menu-divider"></div>
                            <a href="#" id="menuOptions"><span class="menu-icon">⚙️</span> <span data-i18n="options">${i18n.t('options')}</span></a>
                        </div>
                    </div>

                    <!-- Exibir -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="view">${i18n.t('view')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuToggleGrid"><span class="menu-icon">▦</span> <span data-i18n="showGrid">${i18n.t('showGrid')}</span> ✓</a>
                            <a href="#" id="menuToggleToolbar"><span class="menu-icon">🎛️</span> <span data-i18n="floatingToolbar">${i18n.t('floatingToolbar')}</span> ✓</a>
                            <a href="#" id="menuToggleFlowAnim"><span class="menu-icon">➡️</span> <span>Animar Fluxo</span> ${localStorage.getItem('techprot_animate_flow') !== '0' ? '✓' : ''}</a>
                            <a href="#" id="menuFitScreen"><span class="menu-icon">🔍</span> <span data-i18n="fitScreen">${i18n.t('fitScreen')}</span></a>
                            <div class="menu-divider"></div>
                            <a href="#" id="menuVoltageLevels"><span class="menu-icon">🎨</span> Cores dos Níveis de Tensão...</a>
                            <div class="menu-divider"></div>
                            <a href="#" id="menuTheme"><span class="menu-icon">🌓</span> Alternar Tema (Escuro/Claro)</a>
                            <a href="#" id="menuLang"><span class="menu-icon">🌐</span> Idioma: PT-BR / EN</a>
                        </div>
                    </div>

                    <!-- Simulação -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="simulation">${i18n.t('simulation')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuPowerFlow"><span class="menu-icon">⚡</span> <span data-i18n="runPowerFlow">${i18n.t('runPowerFlow')}</span> (F5)</a>
                            <a href="#" id="menuFault"><span class="menu-icon">💥</span> <span data-i18n="runFault">${i18n.t('runFault')}</span></a>
                            <a href="#" id="menuHarmonics" style="display:none"><span class="menu-icon">〰️</span> <span data-i18n="runHarmonics">${i18n.t('runHarmonics')}</span></a>
                            <a href="#" id="menuStability" style="display:none"><span class="menu-icon">📈</span> Estabilidade Eletromecânica...</a>
                            <div class="menu-divider"></div>
                            <a href="#" id="menuReport"><span class="menu-icon">📊</span> <span data-i18n="dataReport">${i18n.t('dataReport')}</span></a>
                        </div>
                    </div>

                    <!-- Rótulos -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="labels">${i18n.t('labels')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuLabelManager"><span class="menu-icon">🏷️</span> <span data-i18n="labelManager">${i18n.t('labelManager')}</span></a>
                            <a href="#" id="menuUpdateLabels"><span class="menu-icon">🔄</span> Atualizar Variáveis</a>
                        </div>
                    </div>

                    <!-- Exemplos -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="samples">${i18n.t('samples')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuSample14"><span class="menu-icon">⚡</span> <span data-i18n="sampleIEEE14">${i18n.t('sampleIEEE14')}</span></a>
                            <a href="#" id="menuSample14Stab" style="display:none"><span class="menu-icon">📈</span> IEEE 14 Barras (Estabilidade Transitória)</a>
                            <a href="#" id="menuSample9"><span class="menu-icon">🎚️</span> <span data-i18n="sampleIEEE9OLTC">${i18n.t('sampleIEEE9OLTC')}</span></a>
                        </div>
                    </div>

                    <!-- Ajuda -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" aria-haspopup="true" aria-expanded="false" data-i18n="help">${i18n.t('help')}</button>
                        <div class="dropdown-content">
                            <a href="#" id="menuAbout"><span class="menu-icon">ℹ️</span> Sobre o TechProt Web</a>
                        </div>
                    </div>
                </div>

                <!-- Quick Action Buttons -->
                <div class="quick-actions">
                    <button class="btn btn-action" id="btnQuickPF" title="Executar Fluxo de Carga (F5)">
                        ▶ <span data-i18n="runPowerFlow">${i18n.t('runPowerFlow')}</span>
                    </button>
                    <button class="btn btn-icon" id="btnQuickFlowAnim" title="Animar Fluxo de Potência (setas)">
                        ➡️
                    </button>
                    <button class="btn btn-icon" id="btnQuickStability" title="Estabilidade Eletromecânica" style="display:none">
                        📈
                    </button>
                    <button class="btn btn-icon" id="btnQuickReport" title="Relatórios">
                        📊
                    </button>
                    <button class="btn btn-icon" id="btnQuickAlign" title="Alinhar Seleção à Grade">
                        📐
                    </button>
                </div>
            </div>
        `;

        this.setupMenuInteractions();
        this.bindEvents();
    }

    setupMenuInteractions() {
        const hamburger = this.nav.querySelector('#menuHamburger');
        const backdrop = this.nav.querySelector('#menuBackdrop');
        const menuItems = this.nav.querySelector('#menuItems');
        const dropdowns = Array.from(this.nav.querySelectorAll('.menu-dropdown'));

        const closeAllDropdowns = () => {
            dropdowns.forEach(dd => {
                dd.classList.remove('open');
                const btn = dd.querySelector('.menu-btn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });
        };

        const closeMobileMenu = () => {
            menuItems.classList.remove('mobile-open');
            backdrop.classList.remove('visible');
            hamburger.setAttribute('aria-expanded', 'false');
        };

        const toggleMobileMenu = () => {
            const open = !menuItems.classList.contains('mobile-open');
            menuItems.classList.toggle('mobile-open', open);
            backdrop.classList.toggle('visible', open);
            hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (!open) closeAllDropdowns();
        };

        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });
        backdrop.addEventListener('pointerdown', closeMobileMenu);

        // Abrir/fechar dropdowns por clique/toque (não depende de :hover)
        dropdowns.forEach(dd => {
            const btn = dd.querySelector('.menu-btn');
            if (!btn) return;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wasOpen = dd.classList.contains('open');
                closeAllDropdowns();
                if (!wasOpen) {
                    dd.classList.add('open');
                    btn.setAttribute('aria-expanded', 'true');
                }
            });
        });

        // Fechar dropdowns/menu ao tocar fora da barra
        document.addEventListener('pointerdown', (e) => {
            if (!this.nav.contains(e.target)) {
                closeAllDropdowns();
                closeMobileMenu();
            }
        });

        // Fechar com Esc
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllDropdowns();
                closeMobileMenu();
            }
        });

        // Após acionar item de menu, fecha dropdown e gaveta mobile
        this.nav.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown-content a, .dropdown-content .dropdown-file-label');
            if (item) {
                closeAllDropdowns();
                closeMobileMenu();
            }
        });

        // Sincroniza modo mobile/desktop ao redimensionar (debounced).
        // Deve casar com o breakpoint CSS: @media (max-width: 1024px).
        const MOBILE_BP = 1024;
        let lastIsMobile = window.innerWidth <= MOBILE_BP;
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const isMobile = window.innerWidth <= MOBILE_BP;
                if (isMobile !== lastIsMobile) {
                    // Cruzou o breakpoint: fecha gaveta e dropdowns e
                    // ressincroniza aria-expanded (backdrop sai junto).
                    closeAllDropdowns();
                    closeMobileMenu();
                    lastIsMobile = isMobile;
                }
            }, 150);
        });
    }

    bindEvents() {
        const app = this.app;
        const model = app.model;
        const canvas = app.canvas;

        // Novo
        this.nav.querySelector('#menuNew').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Deseja iniciar um novo projeto? As alterações não salvas serão perdidas.')) {
                model.clear();
                app.openedFileName = null;
                canvas.requestRender();
            }
        });

        // Abrir .tp (compatível com .psp/.xml legados)
        this.nav.querySelector('#fileInputOpen').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    TechProtParser.parse(event.target.result, model);
                    app.openedFileName = file.name;  // mantém nome original para Salvar
                    canvas.fitToScreen();
                    app.showNotification(`Projeto "${model.name}" carregado com sucesso!`);
                } catch (err) {
                    alert('Erro ao abrir arquivo .tp: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        // Abrir da Nuvem (Cloud Persistence)
        this.nav.querySelector('#menuCloudOpen').addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const networks = await CloudPersistence.listNetworks();
                if (!networks || networks.length === 0) {
                    alert('Nenhuma rede salva na nuvem.');
                    return;
                }
                const list = networks.map((n, i) => `${i}: ${n.name || '(sem nome)'} (${n._id})`).join('\n');
                const index = prompt('Redes salvas na nuvem:\n' + list + '\n\nDigite o número (0-based) para abrir:');
                if (index === null) return;
                const idx = parseInt(index, 10);
                if (isNaN(idx) || idx < 0 || idx >= networks.length) {
                    alert('Índice inválido.');
                    return;
                }
                const network = await CloudPersistence.getNetwork(networks[idx]._id);
                TechProtParser.parse(network.xml, model);
                app.cloudId = networks[idx]._id;
                app.openedFileName = `cloud:${app.cloudId}`;
                canvas.fitToScreen();
                app.showNotification(`Projeto "${model.name}" carregado da nuvem!`);
            } catch (err) {
                alert('Erro ao abrir da nuvem: ' + (err.message || err));
            }
        });

        // Salvar na Nuvem (Cloud Persistence)
        this.nav.querySelector('#menuCloudSave').addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const xml = TechProtSerializer.serialize(model);
                let name = model.name || '';
                let id = app.cloudId || null;
                if (!id) {
                    name = prompt('Nome do projeto para salvar na nuvem:', name);
                    if (name === null) return;
                    if (!name.trim()) { alert('Nome é obrigatório.'); return; }
                }
                const result = await CloudPersistence.saveNetwork({ id, name: name.trim(), xml });
                app.cloudId = result;
                app.openedFileName = `cloud:${result}`;
                app.showNotification(`Projeto "${name}" salvo na nuvem!`);
            } catch (err) {
                alert('Erro ao salvar na nuvem: ' + (err.message || err));
            }
        });

        // Excluir da Nuvem (Cloud Persistence)
        this.nav.querySelector('#menuCloudDelete').addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                let id = app.cloudId;
                if (!id) {
                    const input = prompt('Digite o ID do projeto para excluir da nuvem:');
                    if (!input) return;
                    id = input.trim();
                }
                if (!confirm('Tem certeza que deseja excluir este projeto da nuvem?')) return;
                await CloudPersistence.deleteNetwork(id);
                if (app.cloudId === id) {
                    app.cloudId = null;
                    app.openedFileName = null;
                }
                app.showNotification('Projeto excluído da nuvem com sucesso!');
            } catch (err) {
                alert('Erro ao excluir da nuvem: ' + (err.message || err));
            }
        });

        // Salvar .tp — reutiliza o nome original quando disponível
        this.nav.querySelector('#menuSave').addEventListener('click', (e) => {
            e.preventDefault();
            const xml = TechProtSerializer.serialize(model);
            const filename = app.openedFileName || `${model.name || 'projeto'}.tp`;
            TechProtSerializer.downloadFile(xml, filename);
            app.showNotification(`Projeto baixado como arquivo ${filename}!`);
        });

        // Exportar PNG
        this.nav.querySelector('#menuExportPng').addEventListener('click', (e) => {
            e.preventDefault();
            const dataUrl = canvas.canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${model.name || 'diagrama'}.png`;
            a.click();
        });

        // Alinhar
        const alignAction = (e) => {
            if (e) e.preventDefault();
            canvas.alignSelectedToGrid();
            app.showNotification('Elementos selecionados alinhados à grade!');
        };
        this.nav.querySelector('#menuAlignGrid').addEventListener('click', alignAction);
        this.nav.querySelector('#btnQuickAlign').addEventListener('click', alignAction);

        // Deletar
        this.nav.querySelector('#menuDelete').addEventListener('click', (e) => {
            e.preventDefault();
            canvas.deleteSelected();
        });

        // Opções
        this.nav.querySelector('#menuOptions').addEventListener('click', (e) => {
            e.preventDefault();
            Dialogs.showSettingsModal(model, app);
        });

        // Grade
        this.nav.querySelector('#menuToggleGrid').addEventListener('click', (e) => {
            e.preventDefault();
            canvas.showGrid = !canvas.showGrid;
            canvas.requestRender();
            e.target.innerHTML = `<span class="menu-icon">▦</span> <span data-i18n="showGrid">${i18n.t('showGrid')}</span> ${canvas.showGrid ? '✓' : ''}`;
        });

        // Barra flutuante
        this.nav.querySelector('#menuToggleToolbar').addEventListener('click', (e) => {
            e.preventDefault();
            const newVis = !app.floatingToolbar.visible;
            app.floatingToolbar.setVisible(newVis);
            e.target.innerHTML = `<span class="menu-icon">🎛️</span> <span data-i18n="floatingToolbar">${i18n.t('floatingToolbar')}</span> ${newVis ? '✓' : ''}`;
        });

        // Animar fluxo de potência (setas) — toggle centralizado, sincroniza
        // menu Exibir + quick-action + localStorage (chave techprot_animate_flow).
        const flowAnimMenuItem = this.nav.querySelector('#menuToggleFlowAnim');
        const flowAnimBtn = this.nav.querySelector('#btnQuickFlowAnim');
        const setAnimateFlow = (on) => {
            canvas.animateFlow = !!on;
            localStorage.setItem('techprot_animate_flow', canvas.animateFlow ? '1' : '0');
            canvas.requestRender();
            flowAnimMenuItem.innerHTML = `<span class="menu-icon">➡️</span> <span>Animar Fluxo</span> ${canvas.animateFlow ? '✓' : ''}`;
            flowAnimBtn.classList.toggle('active', canvas.animateFlow);
            flowAnimBtn.title = canvas.animateFlow
                ? 'Animar Fluxo de Potência: ATIVO (clique para pausar)'
                : 'Animar Fluxo de Potência: PAUSADO (clique para ativar)';
        };
        flowAnimMenuItem.addEventListener('click', (e) => {
            e.preventDefault();
            setAnimateFlow(!canvas.animateFlow);
        });
        flowAnimBtn.addEventListener('click', (e) => {
            e.preventDefault();
            setAnimateFlow(!canvas.animateFlow);
        });
        // Estado inicial do botão conforme preferência persistida
        flowAnimBtn.classList.toggle('active', canvas.animateFlow !== false);
        flowAnimBtn.title = canvas.animateFlow !== false
            ? 'Animar Fluxo de Potência: ATIVO (clique para pausar)'
            : 'Animar Fluxo de Potência: PAUSADO (clique para ativar)';

        // Ajustar
        this.nav.querySelector('#menuFitScreen').addEventListener('click', (e) => {
            e.preventDefault();
            canvas.fitToScreen();
        });

        // Cores dos Níveis de Tensão
        this.nav.querySelector('#menuVoltageLevels')?.addEventListener('click', (e) => {
            e.preventDefault();
            Dialogs.showVoltageLevelsModal(model, () => canvas.requestRender());
        });

        // Tema
        this.nav.querySelector('#menuTheme').addEventListener('click', (e) => {
            e.preventDefault();
            app.toggleTheme();
        });

        // Idioma
        this.nav.querySelector('#menuLang').addEventListener('click', (e) => {
            e.preventDefault();
            app.toggleLanguage();
        });

        // Fluxo de Carga
        const runPF = (e) => {
            if (e) e.preventDefault();
            const res = PowerFlow.solve(model);
            canvas.requestRender();
            app.showNotification(res.message, res.success ? 'success' : 'error');
            if (res.success) {
                // Auto-open report if desired or user can click report
            }
        };
        this.nav.querySelector('#menuPowerFlow').addEventListener('click', runPF);
        this.nav.querySelector('#btnQuickPF').addEventListener('click', runPF);

        // Curto-circuito
        this.nav.querySelector('#menuFault').addEventListener('click', (e) => {
            e.preventDefault();
            const res = ShortCircuit.solve(model);
            canvas.requestRender();
            app.showNotification(res.message, res.success ? 'success' : 'error');
        });

        // Harmônicos
        this.nav.querySelector('#menuHarmonics').addEventListener('click', (e) => {
            e.preventDefault();
            const res = Harmonics.solve(model);
            canvas.requestRender();
            app.showNotification(res.message, res.success ? 'success' : 'error');
        });

        // Estabilidade Eletromecânica
        const showStability = (e) => {
            if (e) e.preventDefault();
            StabilityDialog.show(model, app);
        };
        this.nav.querySelector('#menuStability').addEventListener('click', showStability);
        this.nav.querySelector('#btnQuickStability').addEventListener('click', showStability);

        // Relatório
        const showRep = (e) => {
            if (e) e.preventDefault();
            ReportDialog.show(model);
        };
        this.nav.querySelector('#menuReport').addEventListener('click', showRep);
        this.nav.querySelector('#btnQuickReport').addEventListener('click', showRep);

        // Gerenciador de Variáveis
        this.nav.querySelector('#menuLabelManager').addEventListener('click', (e) => {
            e.preventDefault();
            LabelManagerDialog.show(model, () => canvas.requestRender());
        });

        this.nav.querySelector('#menuUpdateLabels').addEventListener('click', (e) => {
            e.preventDefault();
            model.updateAllLabels();
            canvas.requestRender();
            app.showNotification('Variáveis do diagrama atualizadas!');
        });

        // Exemplos
        this.nav.querySelector('#menuSample14').addEventListener('click', (e) => {
            e.preventDefault();
            SampleSystems.loadIEEE14(model);
            PowerFlow.solve(model);
            canvas.fitToScreen();
            app.showNotification('Sistema IEEE 14 Barras carregado com sucesso!');
        });

        this.nav.querySelector('#menuSample14Stab').addEventListener('click', (e) => {
            e.preventDefault();
            SampleSystems.loadIEEE14Stability(model);
            PowerFlow.solve(model);
            canvas.fitToScreen();
            app.showNotification('Sistema IEEE 14 Barras (Estabilidade) carregado com distúrbio na Barra 4!');
            StabilityDialog.show(model, app);
        });

        this.nav.querySelector('#menuSample9').addEventListener('click', (e) => {
            e.preventDefault();
            SampleSystems.loadIEEE9OLTC(model);
            PowerFlow.solve(model);
            canvas.fitToScreen();
            app.showNotification('Sistema IEEE 9 Barras com OLTC carregado com sucesso!');
        });

        // Sobre
        this.nav.querySelector('#menuAbout').addEventListener('click', (e) => {
            e.preventDefault();
            alert('TechProt Web v1.0\nPlataforma para Estudos de Sistemas Elétricos de Potência (Versão Web)\nSuporta Fluxo de Carga (NR e GS), Controle por Comutador de Tap Sob Carga (OLTC), Curto-Circuito, Harmônicos e compatibilidade total com arquivos .tp (e legados .psp).');
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F5') {
                e.preventDefault();
                runPF();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (document.activeElement.tagName !== 'INPUT') {
                    canvas.deleteSelected();
                }
            } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                const xml = TechProtSerializer.serialize(model);
                const filename = app.openedFileName || `${model.name || 'projeto'}.tp`;
                TechProtSerializer.downloadFile(xml, filename);
            }
        });
    }
}
