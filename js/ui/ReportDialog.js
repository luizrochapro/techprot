import { i18n } from './i18n.js';

export class ReportDialog {
    static show(model) {
        const existing = document.getElementById('reportModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'reportModal';
        modal.className = 'modal-backdrop';

        // 1. Bus Rows
        let busRows = '';
        for (const b of model.buses) {
            const vPu = b.results?.v ?? 1.0;
            const vKV = (vPu * b.nominalVoltage).toFixed(2);
            const ang = (b.results?.angle ?? 0.0).toFixed(2);
            const pNet = (b.results?.pNet ?? 0.0).toFixed(2);
            const qNet = (b.results?.qNet ?? 0.0).toFixed(2);
            const typeStr = b.isSlack ? 'Slack' : (b.isPV ? 'PV' : 'PQ');

            busRows += `
                <tr>
                    <td class="font-bold">${b.name}</td>
                    <td>${typeStr}</td>
                    <td>${b.nominalVoltage} kV</td>
                    <td>${vPu.toFixed(4)}</td>
                    <td>${vKV}</td>
                    <td>${ang}°</td>
                    <td>${pNet}</td>
                    <td>${qNet}</td>
                </tr>
            `;
        }

        // 2. Line Rows
        let lineRows = '';
        for (const l of model.lines) {
            const p12 = (l.results?.p12 ?? 0.0).toFixed(2);
            const q12 = (l.results?.q12 ?? 0.0).toFixed(2);
            const p21 = (l.results?.p21 ?? 0.0).toFixed(2);
            const q21 = (l.results?.q21 ?? 0.0).toFixed(2);
            const pLoss = (l.results?.pLoss ?? 0.0).toFixed(3);
            const qLoss = (l.results?.qLoss ?? 0.0).toFixed(3);
            const i12 = (l.results?.i12 ?? 0.0).toFixed(1);

            lineRows += `
                <tr>
                    <td class="font-bold">${l.name}</td>
                    <td>${l.fromBus?.name || '-'}</td>
                    <td>${l.toBus?.name || '-'}</td>
                    <td>${p12}</td>
                    <td>${q12}</td>
                    <td>${p21}</td>
                    <td>${q21}</td>
                    <td>${pLoss}</td>
                    <td>${qLoss}</td>
                    <td>${i12}</td>
                </tr>
            `;
        }

        // 3. Transformer Rows (With TAP & OLTC Info!)
        let transfRows = '';
        for (const t of model.transformers) {
            const p12 = (t.results?.p12 ?? 0.0).toFixed(2);
            const q12 = (t.results?.q12 ?? 0.0).toFixed(2);
            const pLoss = (t.results?.pLoss ?? 0.0).toFixed(3);
            const currentTap = (t.results?.tap ?? t.turnsRatio ?? 1.0).toFixed(4);
            const nominalTap = (t.nominalTurnsRatio ?? 1.0).toFixed(4);
            const oltcStatus = t.hasTapChanger ? `<span class="badge badge-warning">OLTC Ativo (Barra ${t.oltcControlledBus === 0 ? '1' : '2'})</span>` : '<span class="badge badge-secondary">Fixo</span>';

            transfRows += `
                <tr>
                    <td class="font-bold">${t.name}</td>
                    <td>${t.fromBus?.name || '-'}</td>
                    <td>${t.toBus?.name || '-'}</td>
                    <td class="font-bold text-accent">${currentTap} p.u.</td>
                    <td>${nominalTap} p.u.</td>
                    <td>${oltcStatus}</td>
                    <td>${p12}</td>
                    <td>${q12}</td>
                    <td>${pLoss}</td>
                </tr>
            `;
        }

        modal.innerHTML = `
            <div class="modal-card" style="width: 860px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <h3>${i18n.t('dataReport')}</h3>
                    <button class="close-btn" id="modalClose">✕</button>
                </div>
                <div class="tab-buttons" id="reportTabs" style="margin: 12px 16px 0 16px;">
                    <button class="tab-btn active" data-tab="repBuses">Barras (${model.buses.length})</button>
                    <button class="tab-btn" data-tab="repLines">Linhas (${model.lines.length})</button>
                    <button class="tab-btn" data-tab="repTransf">Transformadores (${model.transformers.length})</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 12px 16px;">
                    <!-- Buses table -->
                    <div id="repBuses" class="report-table-pane">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Barra</th><th>Tipo</th><th>Vnom</th><th>V (p.u.)</th><th>V (kV)</th><th>Ângulo</th><th>P (MW)</th><th>Q (Mvar)</th>
                                </tr>
                            </thead>
                            <tbody>${busRows || '<tr><td colspan="8">Sem dados</td></tr>'}</tbody>
                        </table>
                    </div>

                    <!-- Lines table -->
                    <div id="repLines" class="report-table-pane" style="display: none;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Linha</th><th>De</th><th>Para</th><th>P (i→j)</th><th>Q (i→j)</th><th>P (j→i)</th><th>Q (j→i)</th><th>Perda P</th><th>Perda Q</th><th>I (A)</th>
                                </tr>
                            </thead>
                            <tbody>${lineRows || '<tr><td colspan="10">Sem dados</td></tr>'}</tbody>
                        </table>
                    </div>

                    <!-- Transformers table -->
                    <div id="repTransf" class="report-table-pane" style="display: none;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Transformador</th><th>De</th><th>Para</th><th>Tap Atual</th><th>Tap Nom.</th><th>OLTC</th><th>P (MW)</th><th>Q (Mvar)</th><th>Perdas</th>
                                </tr>
                            </thead>
                            <tbody>${transfRows || '<tr><td colspan="9">Sem dados</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="btnExportCsv">Exportar CSV</button>
                    <div style="flex: 1;"></div>
                    <button class="btn btn-primary" id="modalCloseBtn">${i18n.t('dialogs.close')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab switches
        const tabs = modal.querySelectorAll('#reportTabs .tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.getAttribute('data-tab');
                modal.querySelector('#repBuses').style.display = target === 'repBuses' ? 'block' : 'none';
                modal.querySelector('#repLines').style.display = target === 'repLines' ? 'block' : 'none';
                modal.querySelector('#repTransf').style.display = target === 'repTransf' ? 'block' : 'none';
            });
        });

        const close = () => modal.remove();
        modal.querySelector('#modalClose').addEventListener('click', close);
        modal.querySelector('#modalCloseBtn').addEventListener('click', close);

        // Export CSV
        modal.querySelector('#btnExportCsv').addEventListener('click', () => {
            let csv = 'ELEMENT;TYPE;FROM;TO;V_PU;V_KV;ANGLE_DEG;P_MW;Q_MVAR;TAP_PU;OLTC\n';
            for (const b of model.buses) {
                csv += `${b.name};BUS;-;-;${b.results?.v || 1.0};${((b.results?.v || 1.0) * b.nominalVoltage).toFixed(2)};${b.results?.angle || 0};${b.results?.pNet || 0};${b.results?.qNet || 0};-;\n`;
            }
            for (const t of model.transformers) {
                csv += `${t.name};TRANSFORMER;${t.fromBus?.name || ''};${t.toBus?.name || ''};-;-;-;${t.results?.p12 || 0};${t.results?.q12 || 0};${t.results?.tap || t.turnsRatio || 1.0};${t.hasTapChanger ? 'OLTC' : 'FIXED'}\n`;
            }
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${model.name}_results.csv`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}
