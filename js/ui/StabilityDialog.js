import { i18n } from './i18n.js';
import { Stability } from '../simulation/Stability.js';
import { StabilityChart } from './StabilityChart.js';

/**
 * StabilityDialog.js - Interactive Electromechanical Transient Stability Modal (TechProt)
 */
export class StabilityDialog {
    static currentChart = null;
    static currentResult = null;
    static currentVariable = 'deltaCOI'; // 'deltaCOI', 'delta', 'speed', 'freq', 'pe', 'voltage'

    /**
     * Shows the transient stability analysis dialog.
     * @param {Model} model
     * @param {App} [app]
     */
    static show(model, app = null) {
        const existing = document.getElementById('stabilityModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'stabilityModal';
        modal.className = 'modal-backdrop';

        // Prepopulate default fault event on first load if empty
        if (!model.stabilityEvents || model.stabilityEvents.length === 0) {
            const defaultBus = model.buses.find(b => b.name === 'Bus 4') || model.buses[1] || model.buses[0];
            if (defaultBus) {
                model.addStabilityEvent({
                    id: 'evt_init_1',
                    type: 'fault',
                    time: 1.0,
                    duration: 0.10,
                    targetBus: defaultBus,
                    rFault: 0.0,
                    xFault: 0.0001,
                    description: `Curto-circuito trifásico na ${defaultBus.name} (100 ms)`
                });
            }
        }

        modal.innerHTML = `
            <div class="modal-card" style="width: 1060px; max-width: 96vw; height: 92vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">📈</span>
                        <h3 style="margin: 0; font-size: 16px;">Estabilidade Eletromecânica Transitória (TechProt)</h3>
                    </div>
                    <button class="close-btn" id="btnStabClose" style="font-size: 18px;">✕</button>
                </div>

                <!-- Tabs Header -->
                <div class="stab-tabs-bar" style="display: flex; gap: 4px; border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.15); padding: 6px 16px 0 16px;">
                    <button class="stab-tab-btn active" data-tab="tabSetup">⚙️ Configurações & Perturbações</button>
                    <button class="stab-tab-btn" data-tab="tabCharts" id="tabBtnCharts">📊 Gráficos de Resposta Dinâmica</button>
                    <button class="stab-tab-btn" data-tab="tabData">📑 Tabela de Dados & Exportação</button>
                </div>

                <!-- Tabs Content -->
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column;">
                    <!-- TAB 1: SETUP & EVENTS -->
                    <div id="tabSetup" class="stab-tab-pane active" style="display: flex; flex-direction: column; gap: 16px;">
                        <!-- Global Simulation Settings -->
                        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
                            <h4 style="font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--accent-color);">⏱️ Parâmetros da Simulação Temporal</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                <div>
                                    <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Tempo de Simulação (s):</label>
                                    <input type="number" id="stabSimTime" value="${model.stabilitySettings.simTime || 5.0}" step="0.5" min="0.5" max="60.0" class="form-control">
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Passo de Integração dt (s):</label>
                                    <input type="number" id="stabTimeStep" value="${model.stabilitySettings.timeStep || 0.005}" step="0.001" min="0.0005" max="0.05" class="form-control">
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Passo de Gravação (s):</label>
                                    <input type="number" id="stabPlotStep" value="${model.stabilitySettings.plotStep || 0.01}" step="0.005" min="0.001" max="0.1" class="form-control">
                                </div>
                                <div>
                                    <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Frequência Nominal (Hz):</label>
                                    <input type="number" id="stabFreq" value="${model.stabilitySettings.frequency || 60.0}" step="1.0" class="form-control">
                                </div>
                            </div>
                            <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                                <label class="checkbox-label" style="font-size: 12px; cursor: pointer;">
                                    <input type="checkbox" id="stabUseCOI" ${model.stabilitySettings.useCOI !== false ? 'checked' : ''}>
                                    Usar Referência no Centro de Inércia (COI)
                                </label>
                                <span style="font-size: 11px; color: var(--text-secondary);">Método Numérico: <strong>Euler Modificado (Predictor-Corrector 2ª Ordem)</strong></span>
                            </div>
                        </div>

                        <!-- Disturbance Event Timeline -->
                        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <h4 style="font-size: 13px; font-weight: 600; color: #f59e0b; margin: 0;">⚡ Cronograma de Distúrbios e Eventos do Sistema</h4>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" class="btn btn-secondary" id="btnStabPresetStable" style="font-size: 11px; padding: 4px 10px;">Preset: Curto 100ms (Estável)</button>
                                    <button type="button" class="btn btn-secondary" id="btnStabPresetUnstable" style="font-size: 11px; padding: 4px 10px;">Preset: Curto 450ms (Instável)</button>
                                </div>
                            </div>

                            <!-- Events Table -->
                            <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 12px;">
                                <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                    <thead>
                                        <tr style="background: rgba(0,0,0,0.2);">
                                            <th style="padding: 6px 10px; text-align: left;">Tempo</th>
                                            <th style="padding: 6px 10px; text-align: left;">Tipo de Distúrbio</th>
                                            <th style="padding: 6px 10px; text-align: left;">Elemento Alvo</th>
                                            <th style="padding: 6px 10px; text-align: left;">Duração / Parâmetros</th>
                                            <th style="padding: 6px 10px; text-align: center;">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="stabEventsTableBody">
                                        <!-- Populated dynamically -->
                                    </tbody>
                                </table>
                            </div>

                            <!-- Add New Event Form -->
                            <div style="background: rgba(0,0,0,0.15); border: 1px dashed var(--border-color); border-radius: 6px; padding: 10px;">
                                <div style="font-size: 11px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">+ Inserir Nova Perturbação:</div>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end;">
                                    <div style="flex: 1; min-width: 130px;">
                                        <label style="font-size: 10px; color: var(--text-secondary); display: block;">Tipo:</label>
                                        <select id="newEvtType" class="form-control" style="padding: 4px 8px; font-size: 11px;">
                                            <option value="fault">Curto-circuito Trifásico</option>
                                            <option value="trip_line">Abertura de Linha de Transmissão</option>
                                            <option value="close_line">Religamento de Linha</option>
                                            <option value="trip_gen">Desligamento de Gerador</option>
                                            <option value="load_shed">Alívio de Carga</option>
                                        </select>
                                    </div>
                                    <div style="flex: 1.2; min-width: 140px;">
                                        <label style="font-size: 10px; color: var(--text-secondary); display: block;">Elemento Alvo:</label>
                                        <select id="newEvtTarget" class="form-control" style="padding: 4px 8px; font-size: 11px;">
                                            <!-- Dynamically populated based on type -->
                                        </select>
                                    </div>
                                    <div style="width: 90px;">
                                        <label style="font-size: 10px; color: var(--text-secondary); display: block;">Tempo Início (s):</label>
                                        <input type="number" id="newEvtTime" value="1.0" step="0.05" class="form-control" style="padding: 4px 8px; font-size: 11px;">
                                    </div>
                                    <div style="width: 90px;" id="boxEvtDuration">
                                        <label style="font-size: 10px; color: var(--text-secondary); display: block;">Duração (s):</label>
                                        <input type="number" id="newEvtDuration" value="0.10" step="0.01" class="form-control" style="padding: 4px 8px; font-size: 11px;">
                                    </div>
                                    <button type="button" class="btn btn-primary" id="btnStabAddEvent" style="font-size: 11px; padding: 6px 14px; height: 32px;">
                                        + Adicionar Evento
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Action Bar -->
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <button type="button" class="btn btn-primary" id="btnRunStability" style="font-size: 13px; font-weight: 600; padding: 10px 24px; background: #0284c7;">
                                ▶ Executar Simulação Dinâmica
                            </button>
                        </div>
                    </div>

                    <!-- TAB 2: INTERACTIVE CHARTS -->
                    <div id="tabCharts" class="stab-tab-pane" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
                        <!-- Chart Toolbar & Indicators -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                            <!-- Variable Switcher -->
                            <div style="display: flex; gap: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 3px;">
                                <button class="btn-var-pill active" data-var="deltaCOI" title="Ângulo do rotor em relação ao Centro de Inércia">🔄 Ângulo δ (COI)</button>
                                <button class="btn-var-pill" data-var="delta" title="Ângulo absoluto do rotor">📐 Ângulo Absoluto</button>
                                <button class="btn-var-pill" data-var="freq" title="Frequência do rotor em Hertz">⚡ Frequência f (Hz)</button>
                                <button class="btn-var-pill" data-var="speed" title="Velocidade angular do rotor em p.u.">🏎️ Velocidade ω (p.u.)</button>
                                <button class="btn-var-pill" data-var="pe" title="Potência ativa elétrica acelerante em MW">🔌 Potência Pe (MW)</button>
                                <button class="btn-var-pill" data-var="voltage" title="Módulo de tensão nas barras">📊 Tensão V (p.u.)</button>
                                <button class="btn-var-pill" data-var="vfd" title="Tensão de campo da excitatriz / AVR em p.u.">⚡ Tensão Exc. Vfd (p.u.)</button>
                                <button class="btn-var-pill" data-var="pm" title="Potência mecânica modulada pelo Regulador de Velocidade em MW">⚙️ Potência Mec. Pm (MW)</button>
                            </div>

                            <!-- Verdict Badge -->
                            <div id="stabVerdictBadge" style="display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #1e293b; border: 1px solid #334155;">
                                <span>Simulação pendente</span>
                            </div>
                        </div>

                        <!-- Canvas Container -->
                        <div style="flex: 1; position: relative; min-height: 380px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                            <canvas id="stabCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
                        </div>

                        <!-- Legend & Series Visibility Bar -->
                        <div id="stabLegendContainer" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; padding: 6px 10px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px;">
                            <!-- Populated dynamically with toggleable pills -->
                        </div>
                    </div>

                    <!-- TAB 3: DATA TABLE & EXPORT -->
                    <div id="tabData" class="stab-tab-pane" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">Resultados numéricos interpolados da simulação:</span>
                            <button type="button" class="btn btn-secondary" id="btnStabExportCSV" style="font-size: 12px; padding: 6px 14px;">
                                📥 Exportar CSV (Excel)
                            </button>
                        </div>
                        <div style="flex: 1; overflow: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                            <table class="report-table" id="stabDataTable" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                <!-- Dynamic headers and rows -->
                            </table>
                        </div>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 10px 16px; border-top: 1px solid var(--border-color); justify-content: space-between;">
                    <div id="stabStatusText" style="font-size: 12px; color: var(--text-secondary);">
                        Pronto para simular.
                    </div>
                    <button type="button" class="btn btn-secondary" id="btnStabModalClose">Fechar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Chart instantiation
        const canvasEl = modal.querySelector('#stabCanvas');
        StabilityDialog.currentChart = new StabilityChart(canvasEl);

        // Populate events and targets
        StabilityDialog.populateTargetSelect(model, modal);
        StabilityDialog.renderEventsTable(model, modal);

        // Bind tab buttons
        modal.querySelectorAll('.stab-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.stab-tab-btn').forEach(b => b.classList.remove('active'));
                modal.querySelectorAll('.stab-tab-pane').forEach(p => {
                    p.style.display = 'none';
                    p.classList.remove('active');
                });

                btn.classList.add('active');
                const targetPane = modal.querySelector(`#${btn.getAttribute('data-tab')}`);
                if (targetPane) {
                    targetPane.style.display = 'flex';
                    targetPane.classList.add('active');
                }

                if (btn.getAttribute('data-tab') === 'tabCharts') {
                    setTimeout(() => {
                        StabilityDialog.currentChart.resize();
                        StabilityDialog.updateChartDisplay(model, modal);
                    }, 50);
                }
            });
        });

        // Bind variable switcher pills
        modal.querySelectorAll('.btn-var-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.btn-var-pill').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                StabilityDialog.currentVariable = btn.getAttribute('data-var');
                StabilityDialog.updateChartDisplay(model, modal);
            });
        });

        // Event type change adjusts target options
        modal.querySelector('#newEvtType').addEventListener('change', (e) => {
            const isFault = e.target.value === 'fault';
            modal.querySelector('#boxEvtDuration').style.display = isFault ? 'block' : 'none';
            StabilityDialog.populateTargetSelect(model, modal);
        });

        // Add event button
        modal.querySelector('#btnStabAddEvent').addEventListener('click', () => {
            const type = modal.querySelector('#newEvtType').value;
            const targetId = modal.querySelector('#newEvtTarget').value;
            const time = parseFloat(modal.querySelector('#newEvtTime').value) || 1.0;
            const duration = parseFloat(modal.querySelector('#newEvtDuration').value) || 0.10;

            const targetObj = model.getElementById(targetId) || model.buses.find(b => b.id === targetId || b.name === targetId);
            if (!targetObj) {
                alert('Selecione um elemento alvo para o evento.');
                return;
            }

            let desc = '';
            if (type === 'fault') desc = `Curto 3F na ${targetObj.name} (${(duration * 1000).toFixed(0)} ms)`;
            else if (type === 'trip_line') desc = `Abertura da linha ${targetObj.name}`;
            else if (type === 'close_line') desc = `Religamento da linha ${targetObj.name}`;
            else if (type === 'trip_gen') desc = `Desligamento do ${targetObj.name}`;
            else if (type === 'load_shed') desc = `Alívio da ${targetObj.name}`;

            model.addStabilityEvent({
                id: 'evt_' + Date.now(),
                type,
                targetBus: targetObj,
                targetElement: targetObj,
                time,
                duration,
                rFault: 0.0,
                xFault: 0.0001,
                description: desc
            });

            StabilityDialog.renderEventsTable(model, modal);
        });

        // Presets
        modal.querySelector('#btnStabPresetStable').addEventListener('click', () => {
            model.clearStabilityEvents();
            const b4 = model.buses.find(b => b.name === 'Bus 4') || model.buses[1];
            model.addStabilityEvent({
                id: 'evt_preset_1',
                type: 'fault',
                time: 1.0,
                duration: 0.10,
                targetBus: b4,
                description: `Curto-circuito 3F na ${b4.name} por 100 ms (Estável)`
            });
            StabilityDialog.renderEventsTable(model, modal);
        });

        modal.querySelector('#btnStabPresetUnstable').addEventListener('click', () => {
            model.clearStabilityEvents();
            const b2 = model.buses.find(b => b.name === 'Bus 2') || model.buses[0];
            model.addStabilityEvent({
                id: 'evt_preset_2',
                type: 'fault',
                time: 1.0,
                duration: 0.45,
                targetBus: b2,
                description: `Curto-circuito 3F na ${b2.name} por 450 ms (Instável)`
            });
            StabilityDialog.renderEventsTable(model, modal);
        });

        // Run simulation handler
        modal.querySelector('#btnRunStability').addEventListener('click', () => {
            StabilityDialog.executeSimulation(model, modal);
        });

        // Export CSV handler
        modal.querySelector('#btnStabExportCSV').addEventListener('click', () => {
            StabilityDialog.exportCSV(model);
        });

        // Close handlers
        const closeModal = () => modal.remove();
        modal.querySelector('#btnStabClose').addEventListener('click', closeModal);
        modal.querySelector('#btnStabModalClose').addEventListener('click', closeModal);

        // Auto-run on open if no result yet
        if (!model.lastStabilityResult) {
            StabilityDialog.executeSimulation(model, modal, false);
        } else {
            StabilityDialog.currentResult = model.lastStabilityResult;
            StabilityDialog.updateVerdictBadge(modal, model.lastStabilityResult);
            StabilityDialog.updateChartDisplay(model, modal);
            StabilityDialog.populateDataTable(modal, model.lastStabilityResult);
        }
    }

    static populateTargetSelect(model, modal) {
        const type = modal.querySelector('#newEvtType').value;
        const targetSelect = modal.querySelector('#newEvtTarget');
        targetSelect.innerHTML = '';

        if (type === 'fault') {
            for (const b of model.buses) {
                targetSelect.innerHTML += `<option value="${b.id}">${b.name} (${b.nominalVoltage} kV)</option>`;
            }
        } else if (type === 'trip_line' || type === 'close_line') {
            for (const l of model.lines) {
                targetSelect.innerHTML += `<option value="${l.id}">${l.name} (${l.fromBus?.name} - ${l.toBus?.name})</option>`;
            }
        } else if (type === 'trip_gen') {
            for (const g of model.generators) {
                targetSelect.innerHTML += `<option value="${g.id}">${g.name} (${g.parentBus?.name})</option>`;
            }
        } else if (type === 'load_shed') {
            for (const ld of model.loads) {
                targetSelect.innerHTML += `<option value="${ld.id}">${ld.name} (${ld.activePower} MW na ${ld.parentBus?.name})</option>`;
            }
        }
    }

    static renderEventsTable(model, modal) {
        const tbody = modal.querySelector('#stabEventsTableBody');
        const events = model.getStabilityEvents();

        if (events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 12px;">Nenhum distúrbio programado. O sistema operará em regime permanente.</td></tr>`;
            return;
        }

        let html = '';
        for (const evt of events) {
            const targetName = evt.targetBus?.name || evt.targetElement?.name || evt.target?.name || 'Sistema';
            let typeLabel = 'Curto-circuito';
            if (evt.type === 'trip_line') typeLabel = 'Abertura de Linha';
            else if (evt.type === 'close_line') typeLabel = 'Religamento de Linha';
            else if (evt.type === 'trip_gen') typeLabel = 'Desligamento Gerador';
            else if (evt.type === 'load_shed') typeLabel = 'Alívio de Carga';

            html += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 6px 10px; font-weight: 600;">${evt.time.toFixed(2)}s</td>
                    <td style="padding: 6px 10px;">${typeLabel}</td>
                    <td style="padding: 6px 10px;">${targetName}</td>
                    <td style="padding: 6px 10px; color: var(--text-secondary);">${evt.type === 'fault' ? `Duração: ${(evt.duration * 1000).toFixed(0)} ms` : '-'}</td>
                    <td style="padding: 6px 10px; text-align: center;">
                        <button type="button" class="btn-del-evt" data-evtid="${evt.id}" style="background:none; border:none; color: var(--danger-color); cursor: pointer; font-size: 13px;" title="Remover evento">🗑️</button>
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html;

        tbody.querySelectorAll('.btn-del-evt').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-evtid');
                model.removeStabilityEvent(id);
                StabilityDialog.renderEventsTable(model, modal);
            });
        });
    }

    static executeSimulation(model, modal, switchToCharts = true) {
        // Read global params from form
        model.stabilitySettings.simTime = parseFloat(modal.querySelector('#stabSimTime').value) || 5.0;
        model.stabilitySettings.timeStep = parseFloat(modal.querySelector('#stabTimeStep').value) || 0.005;
        model.stabilitySettings.plotStep = parseFloat(modal.querySelector('#stabPlotStep').value) || 0.01;
        model.stabilitySettings.frequency = parseFloat(modal.querySelector('#stabFreq').value) || 60.0;
        model.stabilitySettings.useCOI = modal.querySelector('#stabUseCOI').checked;

        modal.querySelector('#stabStatusText').innerHTML = `Calculando transitório eletromecânico...`;

        setTimeout(() => {
            const result = Stability.solve(model);
            StabilityDialog.currentResult = result;

            if (!result.success) {
                alert(`Erro na simulação: ${result.message}`);
                modal.querySelector('#stabStatusText').innerHTML = `<span style="color: var(--danger-color);">Erro: ${result.message}</span>`;
                return;
            }

            modal.querySelector('#stabStatusText').innerHTML = result.message;
            StabilityDialog.updateVerdictBadge(modal, result);
            StabilityDialog.populateDataTable(modal, result);

            if (switchToCharts) {
                // Switch to charts tab
                modal.querySelector('#tabBtnCharts').click();
            } else {
                StabilityDialog.updateChartDisplay(model, modal);
            }
        }, 30);
    }

    static updateVerdictBadge(modal, res) {
        const badge = modal.querySelector('#stabVerdictBadge');
        if (!badge || !res) return;

        if (res.isStable) {
            badge.style.background = 'rgba(16, 185, 129, 0.15)';
            badge.style.borderColor = '#10b981';
            badge.style.color = '#10b981';
            badge.innerHTML = `🟢 SISTEMA ESTÁVEL &nbsp;|&nbsp; Margem: ${res.margin}% &nbsp;|&nbsp; Δδ máx: ${res.maxSpread}°`;
        } else {
            badge.style.background = 'rgba(239, 68, 68, 0.15)';
            badge.style.borderColor = '#ef4444';
            badge.style.color = '#ef4444';
            badge.innerHTML = `🔴 SISTEMA INSTÁVEL (Perda de Sincronismo) &nbsp;|&nbsp; Δδ: ${res.maxSpread}° &gt; 180°`;
        }
    }

    static updateChartDisplay(model, modal) {
        const chart = StabilityDialog.currentChart;
        const res = StabilityDialog.currentResult;
        if (!chart || !res || !res.time) return;

        const variable = StabilityDialog.currentVariable;
        const PALETTE = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#a855f7', '#06b6d4', '#eab308', '#f43f5e', '#6366f1'];

        let seriesList = [];
        let yLabel = 'Ângulo δ (°)';
        let yUnit = '°';
        let title = 'Ângulo do Rotor Relativo ao Centro de Inércia (COI)';

        if (variable === 'deltaCOI') {
            title = 'Ângulo do Rotor Relativo ao Centro de Inércia (COI) [°]';
            yLabel = 'δ - δ_COI (°)';
            yUnit = '°';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name,
                color: PALETTE[idx % PALETTE.length],
                data: g.series.deltaCOIDeg,
                visible: true
            }));
        } else if (variable === 'delta') {
            title = 'Ângulo Absoluto do Rotor δ(t) [°]';
            yLabel = 'Ângulo δ (°)';
            yUnit = '°';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name,
                color: PALETTE[idx % PALETTE.length],
                data: g.series.deltaDeg,
                visible: true
            }));
        } else if (variable === 'freq') {
            title = 'Frequência do Rotor f(t) [Hz]';
            yLabel = 'Frequência (Hz)';
            yUnit = ' Hz';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name,
                color: PALETTE[idx % PALETTE.length],
                data: g.series.freqHz,
                visible: true
            }));
        } else if (variable === 'speed') {
            title = 'Velocidade Angular do Rotor ω(t) [p.u.]';
            yLabel = 'Velocidade (p.u.)';
            yUnit = ' p.u.';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name,
                color: PALETTE[idx % PALETTE.length],
                data: g.series.speedPu,
                visible: true
            }));
        } else if (variable === 'pe') {
            title = 'Potência Ativa Elétrica Injetada Pe(t) [MW]';
            yLabel = 'Potência Pe (MW)';
            yUnit = ' MW';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name,
                color: PALETTE[idx % PALETTE.length],
                data: g.series.peMW,
                visible: true
            }));
        } else if (variable === 'voltage') {
            title = 'Módulo da Tensão nas Barras V(t) [p.u.]';
            yLabel = 'Tensão V (p.u.)';
            yUnit = ' p.u.';
            seriesList = res.buses.slice(0, 10).map((b, idx) => ({
                name: b.name,
                color: PALETTE[idx % PALETTE.length],
                data: b.series.vPu,
                visible: true
            }));
        } else if (variable === 'vfd') {
            title = 'Tensão de Campo da Excitatriz / AVR Vfd(t) [p.u.]';
            yLabel = 'Tensão Vfd (p.u.)';
            yUnit = ' p.u.';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name + (g.hasAVR ? ' (AVR Ativo)' : ''),
                color: PALETTE[idx % PALETTE.length],
                data: g.series.vfdPu || [],
                visible: true
            }));
        } else if (variable === 'pm') {
            title = 'Potência Mecânica da Turbina / Governador Pm(t) [MW]';
            yLabel = 'Potência Pm (MW)';
            yUnit = ' MW';
            seriesList = res.generators.map((g, idx) => ({
                name: g.name + (g.hasGovernor ? ' (Gov Ativo)' : ''),
                color: PALETTE[idx % PALETTE.length],
                data: g.series.pmMW || [],
                visible: true
            }));
        }

        chart.setData(res.time, seriesList, res.events, { title, yLabel, yUnit });

        // Update Legend Pills
        const legContainer = modal.querySelector('#stabLegendContainer');
        if (legContainer) {
            legContainer.innerHTML = '';
            for (let i = 0; i < seriesList.length; i++) {
                const s = seriesList[i];
                const pill = document.createElement('div');
                pill.style.cssText = `
                    display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px;
                    border-radius: 4px; font-size: 11px; cursor: pointer; user-select: none;
                    background: rgba(255, 255, 255, 0.05); border: 1px solid ${s.color};
                    transition: opacity 0.15s;
                `;
                pill.innerHTML = `
                    <span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${s.color};"></span>
                    <span>${s.name}</span>
                `;

                pill.addEventListener('click', () => {
                    s.visible = !s.visible;
                    pill.style.opacity = s.visible ? '1' : '0.35';
                    chart.render();
                });

                legContainer.appendChild(pill);
            }
        }
    }

    static populateDataTable(modal, res) {
        const table = modal.querySelector('#stabDataTable');
        if (!table || !res || !res.time) return;

        let thHtml = `<tr><th style="padding: 6px 10px; text-align: left; position: sticky; top: 0; background: var(--bg-secondary);">Tempo (s)</th>`;
        for (const g of res.generators) {
            thHtml += `<th style="padding: 6px 10px; text-align: right; position: sticky; top: 0; background: var(--bg-secondary);">${g.name} δ (°)</th>`;
            thHtml += `<th style="padding: 6px 10px; text-align: right; position: sticky; top: 0; background: var(--bg-secondary);">${g.name} f (Hz)</th>`;
            thHtml += `<th style="padding: 6px 10px; text-align: right; position: sticky; top: 0; background: var(--bg-secondary);">${g.name} Pe (MW)</th>`;
            thHtml += `<th style="padding: 6px 10px; text-align: right; position: sticky; top: 0; background: var(--bg-secondary);">${g.name} Vfd (p.u.)</th>`;
            thHtml += `<th style="padding: 6px 10px; text-align: right; position: sticky; top: 0; background: var(--bg-secondary);">${g.name} Pm (MW)</th>`;
        }
        thHtml += `</tr>`;

        let tbHtml = '';
        // Sample every 5th or 10th point if too dense
        const step = Math.max(1, Math.floor(res.time.length / 100));

        for (let i = 0; i < res.time.length; i += step) {
            const t = res.time[i];
            tbHtml += `<tr style="border-bottom: 1px solid var(--border-color);">`;
            tbHtml += `<td style="padding: 4px 10px; font-family: monospace;">${t.toFixed(3)}</td>`;

            for (const g of res.generators) {
                const delta = g.series.deltaDeg[i] !== undefined ? g.series.deltaDeg[i].toFixed(2) : '-';
                const f = g.series.freqHz[i] !== undefined ? g.series.freqHz[i].toFixed(2) : '-';
                const pe = g.series.peMW[i] !== undefined ? g.series.peMW[i].toFixed(2) : '-';
                const vfd = g.series.vfdPu && g.series.vfdPu[i] !== undefined ? g.series.vfdPu[i].toFixed(3) : '-';
                const pm = g.series.pmMW && g.series.pmMW[i] !== undefined ? g.series.pmMW[i].toFixed(2) : '-';

                tbHtml += `<td style="padding: 4px 10px; text-align: right; font-family: monospace;">${delta}</td>`;
                tbHtml += `<td style="padding: 4px 10px; text-align: right; font-family: monospace;">${f}</td>`;
                tbHtml += `<td style="padding: 4px 10px; text-align: right; font-family: monospace;">${pe}</td>`;
                tbHtml += `<td style="padding: 4px 10px; text-align: right; font-family: monospace;">${vfd}</td>`;
                tbHtml += `<td style="padding: 4px 10px; text-align: right; font-family: monospace;">${pm}</td>`;
            }
            tbHtml += `</tr>`;
        }

        table.innerHTML = `<thead>${thHtml}</thead><tbody>${tbHtml}</tbody>`;
    }

    static exportCSV(model) {
        const res = StabilityDialog.currentResult;
        if (!res || !res.time || res.time.length === 0) {
            alert('Nenhum dado de simulação para exportar.');
            return;
        }

        let csv = 'Tempo (s)';
        for (const g of res.generators) {
            csv += `,${g.name} Delta_deg,${g.name} Delta_COI_deg,${g.name} Freq_Hz,${g.name} Pe_MW,${g.name} Vt_pu,${g.name} Vfd_pu,${g.name} Pm_MW`;
        }
        for (const b of res.buses) {
            csv += `,${b.name} V_pu`;
        }
        csv += '\n';

        for (let i = 0; i < res.time.length; i++) {
            const t = res.time[i];
            let row = `${t.toFixed(4)}`;
            for (const g of res.generators) {
                const d = g.series.deltaDeg[i]?.toFixed(3) ?? '';
                const dCOI = g.series.deltaCOIDeg[i]?.toFixed(3) ?? '';
                const f = g.series.freqHz[i]?.toFixed(3) ?? '';
                const pe = g.series.peMW[i]?.toFixed(3) ?? '';
                const vt = g.series.vtPu[i]?.toFixed(4) ?? '';
                const vfd = g.series.vfdPu ? (g.series.vfdPu[i]?.toFixed(4) ?? '') : '';
                const pm = g.series.pmMW ? (g.series.pmMW[i]?.toFixed(3) ?? '') : '';
                row += `,${d},${dCOI},${f},${pe},${vt},${vfd},${pm}`;
            }
            for (const b of res.buses) {
                const v = b.series.vPu[i]?.toFixed(4) ?? '';
                row += `,${v}`;
            }
            csv += row + '\n';
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `techprot_estabilidade_transitoria_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
