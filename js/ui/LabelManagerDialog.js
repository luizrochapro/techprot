import { i18n } from './i18n.js';
import { TextLabel, LabelDataType } from '../elements/TextLabel.js';

export class LabelManagerDialog {
    static show(model, onApply) {
        const existing = document.getElementById('labelManagerModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'labelManagerModal';
        modal.className = 'modal-backdrop';

        // Detect currently active labels in the model
        const hasType = (elements, dataType) => {
            return elements.length > 0 && elements.some(el => 
                model.textLabels.some(l => l.parentElement === el && l.dataType === dataType)
            );
        };

        const busNameChecked = hasType(model.buses, LabelDataType.DATA_NAME);
        const busVChecked = hasType(model.buses, LabelDataType.DATA_VOLTAGE);
        const busAngleChecked = hasType(model.buses, LabelDataType.DATA_ANGLE);
        const busFaultChecked = hasType(model.buses, LabelDataType.DATA_SC_CURRENT);
        const busFaultVChecked = hasType(model.buses, LabelDataType.DATA_SC_VOLTAGE);

        const lineNameChecked = hasType(model.lines, LabelDataType.DATA_NAME);
        const linePChecked = hasType(model.lines, LabelDataType.DATA_PF_ACTIVE);
        const lineQChecked = hasType(model.lines, LabelDataType.DATA_PF_REACTIVE);
        const lineLossChecked = hasType(model.lines, LabelDataType.DATA_PF_LOSSES);
        const lineIChecked = hasType(model.lines, LabelDataType.DATA_PF_CURRENT);
        const lineFaultChecked = hasType(model.lines, LabelDataType.DATA_SC_CURRENT);

        const transfNameChecked = hasType(model.transformers, LabelDataType.DATA_NAME);
        const transfTapChecked = hasType(model.transformers, LabelDataType.DATA_TRANSFORMER_TAP);
        const transfPChecked = hasType(model.transformers, LabelDataType.DATA_PF_ACTIVE);
        const transfQChecked = hasType(model.transformers, LabelDataType.DATA_PF_REACTIVE);
        const transfLossChecked = hasType(model.transformers, LabelDataType.DATA_PF_LOSSES);
        const transfFaultChecked = hasType(model.transformers, LabelDataType.DATA_SC_CURRENT);

        const genNameChecked = hasType(model.generators, LabelDataType.DATA_NAME);
        const genPChecked = hasType(model.generators, LabelDataType.DATA_ACTIVE_POWER);
        const genQChecked = hasType(model.generators, LabelDataType.DATA_REACTIVE_POWER);

        const loadNameChecked = hasType(model.loads, LabelDataType.DATA_NAME);
        const loadPChecked = hasType(model.loads, LabelDataType.DATA_ACTIVE_POWER);
        const loadQChecked = hasType(model.loads, LabelDataType.DATA_REACTIVE_POWER);

        const relayTimeChecked = hasType(model.relays, LabelDataType.DATA_RELAY_TIME);
        const relayIChecked = hasType(model.relays, LabelDataType.DATA_RELAY_CURRENT);

        modal.innerHTML = `
            <div class="modal-card" style="width: 580px; max-width: 95vw;">
                <div class="modal-header">
                    <h3>${i18n.t('labelManager')}</h3>
                    <button class="close-btn" id="modalClose">✕</button>
                </div>
                <div class="modal-body" style="display: flex; gap: 16px;">
                    <!-- Left: Category tabs & Options -->
                    <div style="flex: 1.2;">
                        <div class="tab-buttons" id="lmTabs">
                            <button class="tab-btn active" data-tab="bus">Barra</button>
                            <button class="tab-btn" data-tab="line">Linha</button>
                            <button class="tab-btn" data-tab="transf">Trafo</button>
                            <button class="tab-btn" data-tab="gen">Gerador</button>
                            <button class="tab-btn" data-tab="load">Carga</button>
                            <button class="tab-btn" data-tab="relay">Relé</button>
                        </div>
                        <div class="tab-content-container" style="border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; height: 190px; overflow-y: auto;">
                            <!-- Bus items -->
                            <div class="tab-pane" id="tabBus">
                                <label class="checkbox-label"><input type="checkbox" id="chkBusName" ${busNameChecked ? 'checked' : ''}> Nome da Barra</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkBusV" ${busVChecked ? 'checked' : ''}> Tensão (V)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkBusAngle" ${busAngleChecked ? 'checked' : ''}> Ângulo (θ)</label>
                                <label class="checkbox-label font-bold" style="color: #f59e0b;"><input type="checkbox" id="chkBusFault" ${busFaultChecked ? 'checked' : ''}> Curto-circuito (Icc)</label>
                                <label class="checkbox-label" style="color: #f59e0b;"><input type="checkbox" id="chkBusFaultV" ${busFaultVChecked ? 'checked' : ''}> Tensão pós-falta (Vcc)</label>
                            </div>
                            <!-- Line items -->
                            <div class="tab-pane" id="tabLine" style="display:none;">
                                <label class="checkbox-label"><input type="checkbox" id="chkLineName" ${lineNameChecked ? 'checked' : ''}> Nome da Linha</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkLineP" ${linePChecked ? 'checked' : ''}> Potência ativa (P)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkLineQ" ${lineQChecked ? 'checked' : ''}> Potência reativa (Q)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkLineLoss" ${lineLossChecked ? 'checked' : ''}> Perdas</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkLineI" ${lineIChecked ? 'checked' : ''}> Corrente</label>
                                <label class="checkbox-label font-bold" style="color: #f59e0b;"><input type="checkbox" id="chkLineFault" ${lineFaultChecked ? 'checked' : ''}> Contribuição de Falta (Icc ramo)</label>
                            </div>
                            <!-- Transformer items with TAP! -->
                            <div class="tab-pane" id="tabTransf" style="display:none;">
                                <label class="checkbox-label"><input type="checkbox" id="chkTransfName" ${transfNameChecked ? 'checked' : ''}> Nome do Trafo</label>
                                <label class="checkbox-label font-bold" style="color: #f59e0b;">
                                    <input type="checkbox" id="chkTransfTap" ${transfTapChecked ? 'checked' : ''}> Tap (Fixo / OLTC)
                                </label>
                                <label class="checkbox-label"><input type="checkbox" id="chkTransfP" ${transfPChecked ? 'checked' : ''}> Potência ativa (P)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkTransfQ" ${transfQChecked ? 'checked' : ''}> Potência reativa (Q)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkTransfLoss" ${transfLossChecked ? 'checked' : ''}> Perdas</label>
                                <label class="checkbox-label font-bold" style="color: #f59e0b;"><input type="checkbox" id="chkTransfFault" ${transfFaultChecked ? 'checked' : ''}> Contribuição de Falta (Icc trafo)</label>
                            </div>
                            <!-- Generator items -->
                            <div class="tab-pane" id="tabGen" style="display:none;">
                                <label class="checkbox-label"><input type="checkbox" id="chkGenName" ${genNameChecked ? 'checked' : ''}> Nome do Gerador</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkGenP" ${genPChecked ? 'checked' : ''}> Potência ativa (P)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkGenQ" ${genQChecked ? 'checked' : ''}> Potência reativa (Q)</label>
                            </div>
                            <!-- Load items -->
                            <div class="tab-pane" id="tabLoad" style="display:none;">
                                <label class="checkbox-label"><input type="checkbox" id="chkLoadName" ${loadNameChecked ? 'checked' : ''}> Nome da Carga</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkLoadP" ${loadPChecked ? 'checked' : ''}> Potência ativa (P)</label>
                                <label class="checkbox-label"><input type="checkbox" id="chkLoadQ" ${loadQChecked ? 'checked' : ''}> Potência reativa (Q)</label>
                            </div>
                            <!-- Relay items -->
                            <div class="tab-pane" id="tabRelay" style="display:none;">
                                <label class="checkbox-label" style="color:#ef4444;"><input type="checkbox" id="chkRelayTime" ${relayTimeChecked ? 'checked' : ''}> Tempo de Operação</label>
                                <label class="checkbox-label" style="color:#ef4444;"><input type="checkbox" id="chkRelayI" ${relayIChecked ? 'checked' : ''}> Corrente de Sensibilização</label>
                            </div>
                        </div>

                        <div class="form-row" style="margin-top: 12px;">
                            <label>Casas decimais:</label>
                            <input type="number" id="lmPrecision" value="3" min="0" max="6" style="width: 70px;" class="form-control">
                        </div>
                        <div class="form-row">
                            <label class="checkbox-label" style="color: var(--danger-color);">
                                <input type="checkbox" id="chkClearExisting">
                                Remover todos rótulos existentes
                            </label>
                        </div>
                    </div>

                    <!-- Right: Preview -->
                    <div style="flex: 0.8; display: flex; flex-direction: column;">
                        <label style="font-weight: bold; margin-bottom: 4px;">Pré-visualização no Diagrama:</label>
                        <div id="lmPreviewBox" style="flex: 1; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 11px; white-space: pre-wrap; overflow-y: auto;">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modalCancel">${i18n.t('dialogs.cancel')}</button>
                    <button class="btn btn-primary" id="modalApply">${i18n.t('dialogs.apply')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab switching
        const tabs = modal.querySelectorAll('#lmTabs .tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.getAttribute('data-tab');
                modal.querySelector('#tabBus').style.display = target === 'bus' ? 'block' : 'none';
                modal.querySelector('#tabLine').style.display = target === 'line' ? 'block' : 'none';
                modal.querySelector('#tabTransf').style.display = target === 'transf' ? 'block' : 'none';
                modal.querySelector('#tabGen').style.display = target === 'gen' ? 'block' : 'none';
                modal.querySelector('#tabLoad').style.display = target === 'load' ? 'block' : 'none';
                modal.querySelector('#tabRelay').style.display = target === 'relay' ? 'block' : 'none';
            });
        });

        // Dynamic preview update
        const updatePreview = () => {
            const previewBox = modal.querySelector('#lmPreviewBox');
            if (!previewBox) return;
            const lines = [];

            const bName = modal.querySelector('#chkBusName')?.checked;
            const bV = modal.querySelector('#chkBusV')?.checked;
            const bAng = modal.querySelector('#chkBusAngle')?.checked;
            const bF = modal.querySelector('#chkBusFault')?.checked;
            const bFV = modal.querySelector('#chkBusFaultV')?.checked;

            if (bName || bV || bAng || bF || bFV) {
                lines.push('--- [ Barra ] ---');
                if (bName) lines.push('Barra 1');
                if (bV) lines.push('1.060 p.u.');
                if (bAng) lines.push('0.000°');
                if (bF) lines.push('Icc = 12.450 kA');
                if (bFV) lines.push('Vcc = 0.000 p.u.');
            }

            const tName = modal.querySelector('#chkTransfName')?.checked;
            const tTap = modal.querySelector('#chkTransfTap')?.checked;
            const tP = modal.querySelector('#chkTransfP')?.checked;
            const tLoss = modal.querySelector('#chkTransfLoss')?.checked;
            const tF = modal.querySelector('#chkTransfFault')?.checked;

            if (tName || tTap || tP || tLoss || tF) {
                if (lines.length > 0) lines.push('');
                lines.push('--- [ Trafo ] ---');
                if (tName) lines.push('T 1-2');
                if (tTap) lines.push('Tap = 0.978 p.u.');
                if (tP) lines.push('P = 45.200 MW');
                if (tLoss) lines.push('Perdas = 0.350 MW');
                if (tF) lines.push('Icc = 4.120 kA');
            }

            const lName = modal.querySelector('#chkLineName')?.checked;
            const lP = modal.querySelector('#chkLineP')?.checked;
            const lQ = modal.querySelector('#chkLineQ')?.checked;
            const lLoss = modal.querySelector('#chkLineLoss')?.checked;
            const lI = modal.querySelector('#chkLineI')?.checked;
            const lF = modal.querySelector('#chkLineFault')?.checked;

            if (lName || lP || lQ || lLoss || lI || lF) {
                if (lines.length > 0) lines.push('');
                lines.push('--- [ Linha ] ---');
                if (lName) lines.push('L 1-2');
                if (lP) lines.push('P = 32.100 MW');
                if (lQ) lines.push('Q = 14.500 Mvar');
                if (lLoss) lines.push('Perdas = 0.420 MW');
                if (lI) lines.push('134.5 A');
                if (lF) lines.push('Icc = 6.280 kA');
            }

            const gName = modal.querySelector('#chkGenName')?.checked;
            const gP = modal.querySelector('#chkGenP')?.checked;
            const gQ = modal.querySelector('#chkGenQ')?.checked;

            if (gName || gP || gQ) {
                if (lines.length > 0) lines.push('');
                lines.push('--- [ Gerador ] ---');
                if (gName) lines.push('Gen 1');
                if (gP) lines.push('P = 100.000 MW');
                if (gQ) lines.push('Q = 25.000 Mvar');
            }

            const ldName = modal.querySelector('#chkLoadName')?.checked;
            const ldP = modal.querySelector('#chkLoadP')?.checked;
            const ldQ = modal.querySelector('#chkLoadQ')?.checked;

            if (ldName || ldP || ldQ) {
                if (lines.length > 0) lines.push('');
                lines.push('--- [ Carga ] ---');
                if (ldName) lines.push('Load 1');
                if (ldP) lines.push('P = 30.000 MW');
                if (ldQ) lines.push('Q = 15.000 Mvar');
            }

            const rTime = modal.querySelector('#chkRelayTime')?.checked;
            const rI = modal.querySelector('#chkRelayI')?.checked;

            if (rTime || rI) {
                if (lines.length > 0) lines.push('');
                lines.push('--- [ Relé de Proteção ] ---');
                if (rTime) lines.push('Tempo = INST / 1.234s');
                if (rI) lines.push('I sensilização = 1.234 kA');
            }

            previewBox.textContent = lines.join('\n') || '(Nenhum rótulo selecionado)';
        };

        modal.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', updatePreview);
        });
        updatePreview();

        const close = () => modal.remove();
        modal.querySelector('#modalClose').addEventListener('click', close);
        modal.querySelector('#modalCancel').addEventListener('click', close);

        // Apply action
        modal.querySelector('#modalApply').addEventListener('click', () => {
            const clearExisting = modal.querySelector('#chkClearExisting').checked;
            if (clearExisting) {
                model.textLabels = [];
            }

            const precision = parseInt(modal.querySelector('#lmPrecision').value, 10) || 3;

            // Helper to sync labels for a set of elements and dataType
            const syncLabels = (elements, dataType, isChecked, createFn) => {
                if (isChecked) {
                    for (const el of elements) {
                        if (!model.textLabels.some(l => l.parentElement === el && l.dataType === dataType)) {
                            const lbl = createFn(el);
                            lbl.decimalPlaces = precision;
                            model.addTextLabel(lbl);
                        }
                    }
                } else {
                    model.textLabels = model.textLabels.filter(l => !(elements.includes(l.parentElement) && l.dataType === dataType));
                }
            };

            // 1. Buses
            syncLabels(model.buses, LabelDataType.DATA_NAME, modal.querySelector('#chkBusName').checked, 
                (b) => new TextLabel(b, LabelDataType.DATA_NAME, b.x, b.y - 18)
            );
            syncLabels(model.buses, LabelDataType.DATA_VOLTAGE, modal.querySelector('#chkBusV').checked, 
                (b) => new TextLabel(b, LabelDataType.DATA_VOLTAGE, b.x + 35, b.y + 12)
            );
            syncLabels(model.buses, LabelDataType.DATA_ANGLE, modal.querySelector('#chkBusAngle').checked, 
                (b) => new TextLabel(b, LabelDataType.DATA_ANGLE, b.x + 35, b.y + 26)
            );
            syncLabels(model.buses, LabelDataType.DATA_SC_CURRENT, modal.querySelector('#chkBusFault').checked, 
                (b) => new TextLabel(b, LabelDataType.DATA_SC_CURRENT, b.x + 35, b.y + 40)
            );
            syncLabels(model.buses, LabelDataType.DATA_SC_VOLTAGE, modal.querySelector('#chkBusFaultV').checked, 
                (b) => new TextLabel(b, LabelDataType.DATA_SC_VOLTAGE, b.x + 35, b.y + 54)
            );

            // 2. Transformers
            syncLabels(model.transformers, LabelDataType.DATA_NAME, modal.querySelector('#chkTransfName').checked, 
                (t) => new TextLabel(t, LabelDataType.DATA_NAME, t.x + 40, t.y - 24)
            );
            syncLabels(model.transformers, LabelDataType.DATA_TRANSFORMER_TAP, modal.querySelector('#chkTransfTap').checked, 
                (t) => new TextLabel(t, LabelDataType.DATA_TRANSFORMER_TAP, t.x + 40, t.y - 10)
            );
            syncLabels(model.transformers, LabelDataType.DATA_PF_ACTIVE, modal.querySelector('#chkTransfP').checked, 
                (t) => new TextLabel(t, LabelDataType.DATA_PF_ACTIVE, t.x + 40, t.y + 4)
            );
            syncLabels(model.transformers, LabelDataType.DATA_PF_REACTIVE, modal.querySelector('#chkTransfQ').checked, 
                (t) => new TextLabel(t, LabelDataType.DATA_PF_REACTIVE, t.x + 40, t.y + 18)
            );
            syncLabels(model.transformers, LabelDataType.DATA_PF_LOSSES, modal.querySelector('#chkTransfLoss').checked, 
                (t) => new TextLabel(t, LabelDataType.DATA_PF_LOSSES, t.x + 40, t.y + 32)
            );
            syncLabels(model.transformers, LabelDataType.DATA_SC_CURRENT, modal.querySelector('#chkTransfFault').checked, 
                (t) => new TextLabel(t, LabelDataType.DATA_SC_CURRENT, t.x + 40, t.y + 46)
            );

            // 3. Lines
            const getLineMid = (l) => {
                const p1 = l.fromBus ? { x: l.fromBus.x, y: l.fromBus.y } : { x: 0, y: 0 };
                const p2 = l.toBus ? { x: l.toBus.x, y: l.toBus.y } : { x: 0, y: 0 };
                return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            };

            syncLabels(model.lines, LabelDataType.DATA_NAME, modal.querySelector('#chkLineName').checked, 
                (l) => { const mid = getLineMid(l); return new TextLabel(l, LabelDataType.DATA_NAME, mid.x + 15, mid.y - 24); }
            );
            syncLabels(model.lines, LabelDataType.DATA_PF_ACTIVE, modal.querySelector('#chkLineP').checked, 
                (l) => { const mid = getLineMid(l); return new TextLabel(l, LabelDataType.DATA_PF_ACTIVE, mid.x + 15, mid.y - 10); }
            );
            syncLabels(model.lines, LabelDataType.DATA_PF_REACTIVE, modal.querySelector('#chkLineQ').checked, 
                (l) => { const mid = getLineMid(l); return new TextLabel(l, LabelDataType.DATA_PF_REACTIVE, mid.x + 15, mid.y + 4); }
            );
            syncLabels(model.lines, LabelDataType.DATA_PF_LOSSES, modal.querySelector('#chkLineLoss').checked, 
                (l) => { const mid = getLineMid(l); return new TextLabel(l, LabelDataType.DATA_PF_LOSSES, mid.x + 15, mid.y + 18); }
            );
            syncLabels(model.lines, LabelDataType.DATA_PF_CURRENT, modal.querySelector('#chkLineI').checked, 
                (l) => { const mid = getLineMid(l); return new TextLabel(l, LabelDataType.DATA_PF_CURRENT, mid.x + 15, mid.y + 32); }
            );
            syncLabels(model.lines, LabelDataType.DATA_SC_CURRENT, modal.querySelector('#chkLineFault').checked, 
                (l) => { const mid = getLineMid(l); return new TextLabel(l, LabelDataType.DATA_SC_CURRENT, mid.x + 15, mid.y + 46); }
            );

            // 4. Generators
            syncLabels(model.generators, LabelDataType.DATA_NAME, modal.querySelector('#chkGenName').checked, 
                (g) => new TextLabel(g, LabelDataType.DATA_NAME, g.x, g.y - 26)
            );
            syncLabels(model.generators, LabelDataType.DATA_ACTIVE_POWER, modal.querySelector('#chkGenP').checked, 
                (g) => new TextLabel(g, LabelDataType.DATA_ACTIVE_POWER, g.x + 28, g.y - 8)
            );
            syncLabels(model.generators, LabelDataType.DATA_REACTIVE_POWER, modal.querySelector('#chkGenQ').checked, 
                (g) => new TextLabel(g, LabelDataType.DATA_REACTIVE_POWER, g.x + 28, g.y + 8)
            );

            // 5. Loads
            syncLabels(model.loads, LabelDataType.DATA_NAME, modal.querySelector('#chkLoadName').checked,
                (ld) => new TextLabel(ld, LabelDataType.DATA_NAME, ld.x, ld.y - 26)
            );
            syncLabels(model.loads, LabelDataType.DATA_ACTIVE_POWER, modal.querySelector('#chkLoadP').checked,
                (ld) => new TextLabel(ld, LabelDataType.DATA_ACTIVE_POWER, ld.x + 28, ld.y - 8)
            );
            syncLabels(model.loads, LabelDataType.DATA_REACTIVE_POWER, modal.querySelector('#chkLoadQ').checked,
                (ld) => new TextLabel(ld, LabelDataType.DATA_REACTIVE_POWER, ld.x + 28, ld.y + 8)
            );

            // 6. Relés
            syncLabels(model.relays, LabelDataType.DATA_RELAY_TIME, modal.querySelector('#chkRelayTime').checked,
                (r) => new TextLabel(r, LabelDataType.DATA_RELAY_TIME, r.circle?.x ?? 0, (r.circle?.y ?? 0) - 30)
            );
            syncLabels(model.relays, LabelDataType.DATA_RELAY_CURRENT, modal.querySelector('#chkRelayI').checked,
                (r) => new TextLabel(r, LabelDataType.DATA_RELAY_CURRENT, r.circle?.x ?? 0, (r.circle?.y ?? 0) - 50)
            );

            // Update decimal precision on all active labels
            for (const lbl of model.textLabels) {
                lbl.decimalPlaces = precision;
            }

            model.updateAllLabels();
            if (onApply) onApply();
            close();
        });
    }
}
