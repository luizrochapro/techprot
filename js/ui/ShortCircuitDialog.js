import { ShortCircuit } from '../simulation/ShortCircuit.js';
import { Relay } from '../elements/Relay.js';

/**
 * ShortCircuitDialog.js - Popup rápido para selecionar parâmetros do curto-circuito
 * diretamente na barra (acionado com Ctrl + botão direito na barra).
 */
export class ShortCircuitDialog {
    /**
     * @param {Bus} bus        Barra onde aplicar o curto
     * @param {Model} model
     * @param {App} app
     */
    static show(bus, model, app) {
        const existing = document.getElementById('scModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'scModal';
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-card" style="max-width: 420px; width: 90%;">
                <div class="modal-header">
                    <h3>💥 Curto-Circuito na Barra ${bus.name}</h3>
                    <button class="close-btn" id="scClose">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <label>Tipo de Curto:</label>
                        <select id="scType" class="form-control">
                            <option value="3phase" ${bus.faultType === '3phase' ? 'selected' : ''}>Trifásico</option>
                            <option value="1phase-g" ${bus.faultType === '1phase-g' ? 'selected' : ''}>Monofásico a Terra</option>
                            <option value="2phase" ${bus.faultType === '2phase' ? 'selected' : ''}>Bifásico (Fase-Fase)</option>
                            <option value="2phase-g" ${bus.faultType === '2phase-g' ? 'selected' : ''}>Bifásico a Terra</option>
                        </select>
                    </div>
                    <div class="form-row" id="scPhasesRow">
                        <label>Fase(s):</label>
                        <select id="scPhases" class="form-control"></select>
                    </div>
                    <div class="form-row">
                        <label>Resistência de Terra R (Ω):</label>
                        <input type="number" id="scR" value="${bus.faultResistance ?? 0.0}" step="0.01" min="0" class="form-control">
                    </div>
                    <div class="form-row">
                        <label>Reatância de Terra X (Ω):</label>
                        <input type="number" id="scX" value="${bus.faultReactance ?? 0.0}" step="0.01" min="0" class="form-control">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="scCancel">Cancelar</button>
                    <button class="btn btn-primary" id="scRun">⚡ Executar Curto-Circuito</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('#scClose').addEventListener('click', close);
        modal.querySelector('#scCancel').addEventListener('click', close);

        const typeSel = modal.querySelector('#scType');
        const phasesSel = modal.querySelector('#scPhases');
        const phasesRow = modal.querySelector('#scPhasesRow');

        const refreshPhases = () => {
            let opts = '';
            if (typeSel.value === '3phase') {
                opts = '<option value="ABC">ABC</option>';
                phasesRow.style.display = 'none';
            } else if (typeSel.value === '1phase-g') {
                opts = ['A', 'B', 'C'].map(p => `<option value="${p}" ${bus.faultPhases === p ? 'selected' : ''}>Fase ${p}</option>`).join('');
                phasesRow.style.display = 'flex';
            } else if (typeSel.value === '2phase' || typeSel.value === '2phase-g') {
                opts = ['AB', 'BC', 'CA'].map(p => `<option value="${p}" ${bus.faultPhases === p ? 'selected' : ''}>Fases ${p}</option>`).join('');
                phasesRow.style.display = 'flex';
            }
            phasesSel.innerHTML = opts;
        };
        typeSel.addEventListener('change', refreshPhases);
        refreshPhases();

        modal.querySelector('#scRun').addEventListener('click', () => {
            bus.hasFault = true;
            bus.faultType = typeSel.value;
            bus.faultPhases = phasesSel.value || 'ABC';
            bus.faultResistance = parseFloat(modal.querySelector('#scR').value) || 0.0;
            bus.faultReactance = parseFloat(modal.querySelector('#scX').value) || 0.0;

            const res = ShortCircuit.solve(model, bus, bus.faultType, bus.faultPhases, bus.faultResistance, bus.faultReactance, 'ohm');
            const { tripped } = app.evaluateRelays?.(true) || { tripped: [] };
            if (tripped.length > 0 && app.noBreakerFailure) {
                app.showNotification(
                    `${res.message}\n⚙ ${tripped.length} relé(s) operaram — disjuntor(es) aberto(s).`,
                    'success'
                );
            } else {
                app.showNotification(res.message, res.success ? 'success' : 'error');
            }
            app.canvas.requestRender();
            close();
        });
    }
}
