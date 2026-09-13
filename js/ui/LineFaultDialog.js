import { ShortCircuit } from '../simulation/ShortCircuit.js';

/**
 * LineFaultDialog.js - Popup para rodar curto-circuito no meio de uma linha
 * (acionado com Ctrl + botão direito sobre a linha). Permite escolher o
 * percentual da linha onde ocorre a falta e os parâmetros da falta.
 */
export class LineFaultDialog {
    static show(line, model, app) {
        const existing = document.getElementById('lineFaultModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'lineFaultModal';
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-card" style="max-width: 420px; width: 90%;">
                <div class="modal-header">
                    <h3>💥 Curto-Circuito na Linha ${line.name}</h3>
                    <button class="close-btn" id="lfClose">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <label>Posição na linha (%):</label>
                        <div style="display:flex; gap:8px; align-items:center; width:100%;">
                            <input type="range" id="lfPct" min="0" max="100" value="${line.results.faultPercent ?? 50}" step="1" style="flex:1;" class="form-control">
                            <span id="lfPctVal" style="min-width:36px; text-align:right; font-weight:bold;">${line.results.faultPercent ?? 50}%</span>
                        </div>
                    </div>
                    <div class="form-row">
                        <label>Tipo de Curto:</label>
                        <select id="lfType" class="form-control">
                            <option value="3phase" selected>Trifásico</option>
                            <option value="1phase-g">Monofásico a Terra</option>
                            <option value="2phase">Bifásico (Fase-Fase)</option>
                            <option value="2phase-g">Bifásico a Terra</option>
                        </select>
                    </div>
                    <div class="form-row" id="lfPhasesRow" style="display:none;">
                        <label>Fase(s):</label>
                        <select id="lfPhases" class="form-control"></select>
                    </div>
                    <div class="form-row">
                        <label>Resistência de Terra R (Ω):</label>
                        <input type="number" id="lfR" value="0.0" step="0.01" min="0" class="form-control">
                    </div>
                    <div class="form-row">
                        <label>Reatância de Terra X (Ω):</label>
                        <input type="number" id="lfX" value="0.0" step="0.01" min="0" class="form-control">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="lfCancel">Cancelar</button>
                    <button class="btn btn-primary" id="lfRun">⚡ Executar Curto-Circuito</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('#lfClose').addEventListener('click', close);
        modal.querySelector('#lfCancel').addEventListener('click', close);

        const pct = modal.querySelector('#lfPct');
        const pctVal = modal.querySelector('#lfPctVal');
        pct.addEventListener('input', () => { pctVal.textContent = pct.value + '%'; });

        const typeSel = modal.querySelector('#lfType');
        const phasesSel = modal.querySelector('#lfPhases');
        const phasesRow = modal.querySelector('#lfPhasesRow');
        const refreshPhases = () => {
            const v = typeSel.value;
            phasesRow.style.display = v === '3phase' ? 'none' : 'flex';
            if (v === '1phase-g') {
                phasesSel.innerHTML = ['A', 'B', 'C'].map(p => `<option value="${p}">Fase ${p}</option>`).join('');
            } else if (v === '2phase' || v === '2phase-g') {
                phasesSel.innerHTML = ['AB', 'BC', 'CA'].map(p => `<option value="${p}">Fases ${p}</option>`).join('');
            }
        };
        typeSel.addEventListener('change', refreshPhases);
        refreshPhases();

        modal.querySelector('#lfRun').addEventListener('click', () => {
            const p = parseFloat(pct.value) || 50;
            const ft = typeSel.value;
            const fp = phasesSel.value || 'ABC';
            const fr = parseFloat(modal.querySelector('#lfR').value) || 0;
            const fx = parseFloat(modal.querySelector('#lfX').value) || 0;

            const res = ShortCircuit.solveLineFault(model, line, p, ft, fp, fr, fx, 'ohm');
            model.updateAllLabels(); // atualiza rótulo Ic do ramo
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
