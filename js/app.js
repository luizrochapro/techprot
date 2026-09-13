import { Model } from './core/Model.js';
import { Canvas } from './cad/Canvas.js';
import { MenuBar } from './ui/MenuBar.js';
import { FloatingToolbar } from './ui/FloatingToolbar.js';
import { Dialogs } from './ui/Dialogs.js';
import { SampleSystems } from './io/SampleSystems.js';
import { PowerFlow } from './simulation/PowerFlow.js';
import { i18n } from './ui/i18n.js';
import { TextLabel, LabelDataType } from './elements/TextLabel.js';
import { StabilityDialog } from './ui/StabilityDialog.js';
import { ControlEditorDialog } from './ui/ControlEditorDialog.js';
import { ShortCircuit } from './simulation/ShortCircuit.js';
import { TabbedToolbar } from './ui/TabbedToolbar.js';
import { RelayDialog } from './ui/RelayDialog.js';
import { CoordogramDialog } from './ui/CoordogramDialog.js';
import { ShortCircuitDialog } from './ui/ShortCircuitDialog.js';
import { LineFaultDialog } from './ui/LineFaultDialog.js';
import { Relay } from './elements/Relay.js';

export class App {
    constructor() {
        this.model = new Model();
        this.theme = localStorage.getItem('techprot_theme') || 'dark';

        // Quando true, relés sensibilizados abrem seu disjuntor
        // (simula "Sem falha do disjuntor")
        this.noBreakerFailure = false;

        // Armazena o NOME ORIGINAL do arquivo aberto via input,
        // para que o botão Salvar re-use o mesmo nome sem criar "novo arquivo".
        this.openedFileName = null;

        this.init();
    }

    init() {
        this.applyTheme(this.theme);

        const canvasEl = document.getElementById('cadCanvas');
        this.canvas = new Canvas(canvasEl, this.model, this);
        this.canvas.renderer.theme = this.theme;

        const navEl = document.getElementById('mainNav');
        this.menuBar = new MenuBar(navEl, this);

        const tabbedToolbarEl = document.getElementById('tabbedToolbar');
        if (tabbedToolbarEl) {
            this.tabbedToolbar = new TabbedToolbar(tabbedToolbarEl, this);
        }

        const toolbarEl = document.getElementById('floatingToolbar');
        this.floatingToolbar = new FloatingToolbar(toolbarEl, this.canvas, this);

        // Carrega projeto em branco por padrão — não abre exemplo automaticamente.
        // Para carregar um exemplo, use o menu Arquivo > Abrir, ou importe um .tp/.psp.
        // (Para carregar o IEEE 14 como demonstração, você pode descomentar a linha abaixo:)
        // SampleSystems.loadIEEE14(this.model);

        // Fit to screen after initial render
        setTimeout(() => {
            this.canvas.resize();
            this.canvas.fitToScreen();
        }, 100);

        this.initContextMenu();
    }

    applyTheme(theme) {
        this.theme = theme;
        localStorage.setItem('techprot_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        if (this.canvas) {
            this.canvas.renderer.theme = theme;
            this.canvas.requestRender();
        }
    }

    toggleTheme() {
        const next = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        this.showNotification(`Tema alterado para: ${next === 'dark' ? 'Escuro' : 'Claro'}`);
    }

    toggleLanguage() {
        const next = i18n.lang === 'pt_BR' ? 'en_US' : 'pt_BR';
        i18n.setLanguage(next);
        this.showNotification(`Language: ${next === 'pt_BR' ? 'Português' : 'English'}`);
    }

    onToolChanged(tool) {
        if (this.tabbedToolbar) {
            this.tabbedToolbar.updateActiveTool(tool);
        }
        if (this.floatingToolbar) {
            this.floatingToolbar.container.querySelectorAll('.tool-btn').forEach(btn => {
                if (btn.getAttribute('data-tool') === tool) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }
    }

    showElementDialog(element) {
        // Relé de proteção abre diálogo dedicado (ajustes do relé + TC)
        if (element instanceof Relay) {
            const refreshCoord = () => {
                if (document.getElementById('coordogramPanel')) {
                    CoordogramDialog.show(this.model, this, this.model.relays.includes(element) ? element : null);
                }
            };
            RelayDialog.show(
                element,
                this.model,
                () => {
                    this.model.updateAllLabels();
                    this.canvas.requestRender();
                    refreshCoord();
                },
                (el) => {
                    this.model.removeElement(el);
                    this.canvas.requestRender();
                    this.showNotification(`${el.name} excluído.`);
                    refreshCoord();
                }
            );
            return;
        }
        Dialogs.showElementModal(
            element,
            this.model,
            () => {
                this.model.updateAllLabels();
                // Recalcula fluxo após edição de parâmetros (R/X/B, etc.)
                this.rerunPowerFlowIfNeeded();
                this.canvas.requestRender();
            },
            (el) => {
                this.model.removeElement(el);
                this.canvas.requestRender();
            }
        );
    }

    initContextMenu() {
        const menu = document.getElementById('contextMenu');
        window.addEventListener('click', () => {
            if (menu) menu.style.display = 'none';
        });
    }

    showMessage(msg) {
        this.showNotification(msg, 'info');
    }

    /** Roda fluxo de carga de novo caso já haja solução convergida (topologia alterada). */
    rerunPowerFlowIfNeeded() {
        if (this.model.hasSolution) {
            const res = PowerFlow.solve(this.model);
            this.canvas.requestRender();
            return res;
        }
        return null;
    }

    /** Avalia todos os relés contra a falta recém-calculada e atualiza seus estados.
     *  Se applyBreakerTrips=true e a flag noBreakerFailure estiver ativa,
     *  abre o disjuntor do terminal supervisionado de cada relé sensibilizado.
     *  @returns {{ tripped: Array<{relay, element, terminal}> }} relés que operaram
     */
    evaluateRelays(applyBreakerTrips = false) {
        const tripped = [];
        for (const relay of (this.model.relays || [])) {
            const faultA = relay.getSimulatedFaultKA() * 1000;   // kA → A
            const res = Relay.evaluate(relay, faultA);
            if (res) {
                relay.tripped = true;
                relay.tripTime = res.tripTime;
                relay.tripCurrent = res.tripCurrent;
                relay.tripUnit = res.tripUnit;
                tripped.push(relay);
            } else {
                relay.tripped = false;
                relay.tripTime = null;
                relay.tripCurrent = null;
                relay.tripUnit = '';
            }
        }

        // Se a flag "Sem falha do disjuntor" está ativa, abre o disjuntor
        // do terminal supervisionado de cada relé que operou.
        if (applyBreakerTrips && this.noBreakerFailure) {
            for (const relay of tripped) {
                const el = relay.parentElement;
                if (!el) continue;
                const term = relay.terminal;
                if (typeof el.breakerFrom !== 'undefined') {
                    if (term === 0) el.breakerFrom = false;
                    else el.breakerTo = false;
                } else {
                    // Para elementos sem breakerFrom/breakerTo (Generator, Load),
                    // desliga o elemento inteiro
                    el.isOnline = false;
                }
            }
        }
        return { tripped };
    }

    /** Abre o popup dedicado de configuração de curto-circuito na barra. */
    showShortCircuitDialog(bus) {
        ShortCircuitDialog.show(bus, this.model, this);
    }

    /** Abre popup de curto no meio de uma linha (com percentual). */
    showLineFaultDialog(line) {
        LineFaultDialog.show(line, this.model, this);
    }

    showContextMenu(screenX, screenY, element) {
        const menu = document.getElementById('contextMenu');
        if (!menu) return;

        let itemsHtml = `
            <div class="context-item" id="cmEdit">✏️ Editar Propriedades</div>
            <div class="context-item" id="cmRotate">🔄 Rotacionar (90°)</div>
        `;

        if (element.getSwitchBoxes || element.type === 'Line' || element.type === 'Transformer' || element.type === 'Generator') {
            itemsHtml += `
                <div class="context-item" id="cmToggleBreaker">⚡ ${element.isOnline !== false ? 'Desligar (Abrir Disjuntor)' : 'Ligar (Fechar Disjuntor)'}</div>
            `;
        }

        if (element instanceof Relay) {
            const coordLabel = element.showInCoordogram ? '📉 Remover Curva do Coordenograma' : '📊 Adicionar Curva ao Coordenograma';
            itemsHtml += `
                <div class="context-item" id="cmToggleCoordCurve">${coordLabel}</div>
                <div class="context-item" id="cmCoordogram" style="color: #f59e0b; font-weight: bold;">📈 Abrir Coordenograma (Curvas 50/51 · 50N/51N)</div>
            `;
        } else if (element.type === 'Transformer') {
            itemsHtml += `
                <div class="context-item" id="cmAddTap">🏷️ Adicionar Rótulo Tap</div>
                <div class="context-item" id="cmAddBranchFault">🏷️ Adicionar Rótulo Contribuição de Falta (Icc)</div>
            `;
        } else if (element.type === 'Line') {
            itemsHtml += `
                <div class="context-item" id="cmAddBranchFault">🏷️ Adicionar Rótulo Contribuição de Falta (Icc)</div>
            `;
        } else if (element.type === 'Bus') {
            const hasNameLbl = this.model.textLabels.some(l => l.parentElement === element && l.dataType === LabelDataType.DATA_NAME);
            itemsHtml += `
                <div class="context-item" id="cmToggleBusName">🏷️ ${hasNameLbl ? 'Ocultar Rótulo do Nome' : 'Mostrar Rótulo do Nome'}</div>
                <div class="context-item" id="cmAddV">🏷️ Adicionar Rótulo Tensão</div>
                <div class="context-item" id="cmAddAngle">🏷️ Adicionar Rótulo Ângulo (θ)</div>
                <div class="context-item" id="cmAddBusFault">🏷️ Adicionar Rótulo Corrente de Falta (Icc)</div>
                <div class="context-item" id="cmAddBusFaultV">🏷️ Adicionar Rótulo Tensão Falta (Vcc)</div>
                <div class="context-item" id="cmRunFault" style="color: #f59e0b; font-weight: bold;">⚡ Simular Curto-Circuito nesta Barra (Ctrl+Clique)</div>
                <div class="context-item" id="cmVoltColors">🎨 Cores dos Níveis de Tensão...</div>
                <div class="context-item" id="cmStabFault">📈 Simulação de Estabilidade (Curto nesta Barra)...</div>
            `;
        } else if (element.type === 'Generator') {
            itemsHtml += `
                <div class="context-item" id="cmAddGenP">🏷️ Adicionar Rótulo Potência Ativa</div>
                <div class="context-item" id="cmEditAVR">⚡ Diagrama de Blocos do AVR...</div>
                <div class="context-item" id="cmEditGov">⚙️ Diagrama do Regulador de Velocidade...</div>
            `;
        }

        itemsHtml += `
            <div class="context-divider"></div>
            <div class="context-item text-danger" id="cmDelete">🗑️ Excluir Elemento</div>
        `;

        menu.innerHTML = itemsHtml;
        menu.style.display = 'block';
        menu.style.left = `${screenX}px`;
        menu.style.top = `${screenY}px`;

        menu.querySelector('#cmEdit')?.addEventListener('click', () => {
            this.showElementDialog(element);
        });

        menu.querySelector('#cmRotate')?.addEventListener('click', () => {
            element.rotate();
            this.canvas.requestRender();
            this.showNotification(`${element.name} rotacionado (${element.angle}°)!`);
        });

        menu.querySelector('#cmToggleCoordCurve')?.addEventListener('click', () => {
            element.showInCoordogram = !element.showInCoordogram;
            this.showNotification(element.showInCoordogram
                ? `Curva de ${element.name} adicionada ao coordenograma.`
                : `Curva de ${element.name} removida do coordenograma.`);
            // refresh panel if open
            const panel = document.getElementById('coordogramPanel');
            if (panel) CoordogramDialog.show(this.model, this, element);
        });

        menu.querySelector('#cmCoordogram')?.addEventListener('click', () => {
            CoordogramDialog.show(this.model, this, element);
        });

        menu.querySelector('#cmToggleBreaker')?.addEventListener('click', () => {
            element.isOnline = !element.isOnline;
            if (!element.isOnline && element.results) {
                element.results.p12 = 0; element.results.q12 = 0;
                element.results.p21 = 0; element.results.q21 = 0;
                element.results.direction = 0;
                element.results.p = 0; element.results.q = 0;
            }
            this.model.updateAllLabels();
            this.rerunPowerFlowIfNeeded();
            this.canvas.requestRender();
            this.showNotification(`${element.name}: Disjuntor ${element.isOnline ? 'LIGADO' : 'DESLIGADO'}`);
        });

        menu.querySelector('#cmVoltColors')?.addEventListener('click', () => {
            Dialogs.showVoltageLevelsModal(this.model, () => this.canvas.requestRender());
        });

        menu.querySelector('#cmStabFault')?.addEventListener('click', () => {
            this.model.clearStabilityEvents();
            this.model.addStabilityEvent({
                id: 'evt_ctx_' + Date.now(),
                type: 'fault',
                time: 1.0,
                duration: 0.10,
                targetBus: element,
                rFault: 0.0,
                xFault: 0.0001,
                description: `Curto-circuito trifásico na ${element.name} (100 ms)`
            });
            StabilityDialog.show(this.model, this);
        });

        menu.querySelector('#cmAddTap')?.addEventListener('click', () => {
            const lbl = new TextLabel(element, LabelDataType.DATA_TRANSFORMER_TAP, element.x + 40, element.y - 10);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
        });

        menu.querySelector('#cmAddBranchFault')?.addEventListener('click', () => {
            const midX = element.fromBus && element.toBus ? (element.fromBus.x + element.toBus.x) / 2 : element.x;
            const midY = element.fromBus && element.toBus ? (element.fromBus.y + element.toBus.y) / 2 : element.y;
            const lbl = new TextLabel(element, LabelDataType.DATA_SC_CURRENT, midX + 20, midY + 14);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
            this.showNotification(`Rótulo de Contribuição de Falta (Icc) adicionado ao ramo ${element.name}`);
        });

        menu.querySelector('#cmToggleBusName')?.addEventListener('click', () => {
            const existing = this.model.textLabels.find(l => l.parentElement === element && l.dataType === LabelDataType.DATA_NAME);
            if (existing) {
                this.model.removeElement(existing);
                this.showNotification(`Rótulo do nome da barra ${element.name} ocultado.`);
            } else {
                const lbl = new TextLabel(element, LabelDataType.DATA_NAME, element.x, element.y - 18);
                this.model.addTextLabel(lbl);
                this.showNotification(`Rótulo do nome da barra ${element.name} adicionado.`);
            }
            this.canvas.requestRender();
        });

        menu.querySelector('#cmAddV')?.addEventListener('click', () => {
            const lbl = new TextLabel(element, LabelDataType.DATA_VOLTAGE, element.x + 35, element.y + 12);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
        });

        menu.querySelector('#cmAddAngle')?.addEventListener('click', () => {
            const lbl = new TextLabel(element, LabelDataType.DATA_ANGLE, element.x + 35, element.y + 26);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
            this.showNotification(`Rótulo de Ângulo (θ) adicionado à barra ${element.name}`);
        });

        menu.querySelector('#cmAddBusFault')?.addEventListener('click', () => {
            const lbl = new TextLabel(element, LabelDataType.DATA_SC_CURRENT, element.x + 35, element.y + 26);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
            this.showNotification(`Rótulo de Corrente de Curto (Icc) adicionado à barra ${element.name}`);
        });

        menu.querySelector('#cmAddBusFaultV')?.addEventListener('click', () => {
            const lbl = new TextLabel(element, LabelDataType.DATA_SC_VOLTAGE, element.x + 35, element.y + 40);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
            this.showNotification(`Rótulo de Tensão de Falta (Vcc) adicionado à barra ${element.name}`);
        });

        menu.querySelector('#cmRunFault')?.addEventListener('click', () => {
            element.hasFault = true;
            const res = ShortCircuit.solve(this.model, element, element.faultType || '3phase', element.faultPhases || 'ABC', element.faultResistance || 0.0, element.faultReactance || 0.0, 'ohm');
            const { tripped } = this.evaluateRelays(true);
            if (tripped.length > 0 && this.noBreakerFailure) {
                this.showNotification(
                    `${res.message}\n⚙ ${tripped.length} relé(s) operaram — disjuntor(es) aberto(s).`,
                    'success'
                );
            } else {
                this.showNotification(res.message, res.success ? 'success' : 'error');
            }
            this.canvas.requestRender();
        });

        menu.querySelector('#cmAddGenP')?.addEventListener('click', () => {
            const lbl = new TextLabel(element, LabelDataType.DATA_ACTIVE_POWER, element.x + 35, element.y + 12);
            this.model.addTextLabel(lbl);
            this.canvas.requestRender();
        });

        menu.querySelector('#cmEditAVR')?.addEventListener('click', () => {
            ControlEditorDialog.open(element.avrDiagram, 'avr', (newDiag) => {
                element.avrDiagram = newDiag;
                element.useAVR = true;
                this.showNotification(`AVR de ${element.name} atualizado e ativado!`);
            }, { elementName: element.name });
        });

        menu.querySelector('#cmEditGov')?.addEventListener('click', () => {
            ControlEditorDialog.open(element.speedGovDiagram, 'speed_gov', (newDiag) => {
                element.speedGovDiagram = newDiag;
                element.useSpeedGovernor = true;
                this.showNotification(`Regulador de Velocidade de ${element.name} atualizado e ativado!`);
            }, { elementName: element.name });
        });

        menu.querySelector('#cmDelete')?.addEventListener('click', () => {
            this.model.removeElement(element);
            this.canvas.requestRender();
        });
    }

    showNotification(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        const container = document.getElementById('toastContainer');
        if (container) {
            container.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }
}

// Instantiate application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.techProtApp = new App();
});
