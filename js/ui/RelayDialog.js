import { Relay } from '../elements/Relay.js';

/**
 * RelayDialog.js - Diálogo de ajustes do relé de proteção 50/51 e 50N/51N
 * junto com os parâmetros do TC associado, em uma única janela.
 */
export class RelayDialog {
    /**
     * @param {Relay} relay   Relé a ser configurado
     * @param {Model} model   Modelo do sistema (para contexto)
     * @param {Function} onSave   Callback após salvar (re-render)
     * @param {Function} onDelete Callback para excluir o relé (opcional)
     */
    static show(relay, model, onSave, onDelete) {
        if (!(relay instanceof Relay)) return;

        const existing = document.getElementById('relayModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'relayModal';
        modal.className = 'modal-backdrop';

        const s = relay.settings;
        const ct = relay.ct;
        const curves = Relay.CURVES;

        const curveOptions = (sel) => Object.entries(curves).map(([key, c]) =>
            `<option value="${key}" ${sel === key ? 'selected' : ''}>${c.label}</option>`
        ).join('');

        const parentDesc = relay.parentElement
            ? `${relay.parentElement.name} (Disjuntor ${relay.terminal === 0 ? 1 : 2})`
            : '—';

        modal.innerHTML = `
            <div class="modal-card" style="max-width: 560px; width: 96%;">
                <div class="modal-header">
                    <h3>🛡️ Relé de Sobrecorrente: ${relay.name}</h3>
                    <button class="close-btn" id="rlClose">✕</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <div class="form-row">
                        <label>Nome:</label>
                        <input type="text" id="rlName" value="${relay.name}" class="form-control">
                    </div>
                    <div class="form-row">
                        <label>Protegendo:</label>
                        <input type="text" value="${parentDesc}" class="form-control" disabled style="opacity: 0.75;">
                    </div>

                    <!-- ================= TC ================= -->
                    <div class="fieldset-box" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.05);">
                        <div class="fieldset-legend" style="color: #38bdf8;">🔘 Transformador de Corrente (TC)</div>
                        <div class="form-row-2col">
                            <div>
                                <label>Ip (A primário):</label>
                                <input type="number" id="rlCtPrimary" value="${ct.primary}" step="1" min="1" class="form-control">
                            </div>
                            <div>
                                <label>Is (A secundário):</label>
                                <select id="rlCtSecondary" class="form-control">
                                    <option value="5" ${ct.secondary === 5 ? 'selected' : ''}>5 A</option>
                                    <option value="1" ${ct.secondary === 1 ? 'selected' : ''}>1 A</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>Classe de exatidão:</label>
                                <input type="text" id="rlCtClass" value="${ct.ctClass}" class="form-control" placeholder="ex.: 5P20, C100">
                            </div>
                            <div>
                                <label>Burden (VA):</label>
                                <input type="number" id="rlCtBurden" value="${ct.burdenVA}" step="0.5" min="0" class="form-control">
                            </div>
                        </div>
                        <div style="font-size: 11px; color: var(--text-muted, #94a3b8); margin-top: 2px;">
                            Relação de transformação: <strong id="rlCtRatio">${ct.primary}/${ct.secondary}</strong>
                        </div>
                    </div>

                    <!-- ================= 50/51 FASE ================= -->
                    <div class="fieldset-box" style="margin-top: 10px; border-color: #f59e0b; background: rgba(245, 158, 11, 0.05);">
                        <div class="fieldset-legend" style="color: #f59e0b;">⚡ Sobrecorrente de Fase (50/51)</div>

                        <div class="form-row" style="margin-bottom: 4px;">
                            <label class="checkbox-label font-bold">
                                <input type="checkbox" id="rl50Enabled" ${s.unit50.enabled ? 'checked' : ''}>
                                Unidade 50 — Instantânea
                            </label>
                        </div>
                        <div class="form-row">
                            <label>I&gt;&gt; pickup 50 (A prim.):</label>
                            <input type="number" id="rl50Pickup" value="${s.unit50.pickup}" step="1" min="0" class="form-control">
                        </div>

                        <div class="form-row" style="margin: 8px 0 4px 0;">
                            <label class="checkbox-label font-bold">
                                <input type="checkbox" id="rl51Enabled" ${s.unit51.enabled ? 'checked' : ''}>
                                Unidade 51 — Temporizada
                            </label>
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>I&gt; pickup 51 (A prim.):</label>
                                <input type="number" id="rl51Pickup" value="${s.unit51.pickup}" step="1" min="0" class="form-control">
                            </div>
                            <div>
                                <label>Curva:</label>
                                <select id="rl51Curve" class="form-control">${curveOptions(s.unit51.curve)}</select>
                            </div>
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>Multiplicador (TMS/dial):</label>
                                <input type="number" id="rl51Tms" value="${s.unit51.tms}" step="0.05" min="0.05" class="form-control">
                            </div>
                            <div>
                                <label>t definido (s) [TD]:</label>
                                <input type="number" id="rl51DefTime" value="${s.unit51.definiteTime}" step="0.05" min="0.02" class="form-control">
                            </div>
                        </div>
                    </div>

                    <!-- ================= 50N/51N NEUTRO ================= -->
                    <div class="fieldset-box" style="margin-top: 10px; border-color: #a78bfa; background: rgba(167, 139, 250, 0.06);">
                        <div class="fieldset-legend" style="color: #a78bfa;">🌐 Sobrecorrente de Neutro (50N/51N) — 3I₀</div>

                        <div class="form-row" style="margin-bottom: 4px;">
                            <label class="checkbox-label font-bold">
                                <input type="checkbox" id="rl50NEnabled" ${s.unit50N.enabled ? 'checked' : ''}>
                                Unidade 50N — Instantânea
                            </label>
                        </div>
                        <div class="form-row">
                            <label>I₀&gt;&gt; pickup 50N (A prim.):</label>
                            <input type="number" id="rl50NPickup" value="${s.unit50N.pickup}" step="1" min="0" class="form-control">
                        </div>

                        <div class="form-row" style="margin: 8px 0 4px 0;">
                            <label class="checkbox-label font-bold">
                                <input type="checkbox" id="rl51NEnabled" ${s.unit51N.enabled ? 'checked' : ''}>
                                Unidade 51N — Temporizada
                            </label>
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>I₀&gt; pickup 51N (A prim.):</label>
                                <input type="number" id="rl51NPickup" value="${s.unit51N.pickup}" step="1" min="0" class="form-control">
                            </div>
                            <div>
                                <label>Curva:</label>
                                <select id="rl51NCurve" class="form-control">${curveOptions(s.unit51N.curve)}</select>
                            </div>
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>Multiplicador (TMS/dial):</label>
                                <input type="number" id="rl51NTms" value="${s.unit51N.tms}" step="0.05" min="0.05" class="form-control">
                            </div>
                            <div>
                                <label>t definido (s) [TD]:</label>
                                <input type="number" id="rl51NDefTime" value="${s.unit51N.definiteTime}" step="0.05" min="0.02" class="form-control">
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 10px; padding: 8px; background: rgba(56, 189, 248, 0.08); border: 1px solid var(--border-color, #334155); border-radius: 4px; font-size: 11px; line-height: 1.5; color: var(--text-muted, #94a3b8);">
                        💡 <strong>50</strong> atua instantaneamente acima do ajuste; <strong>51</strong> segue a curva escolhida
                        (IEC SI/VI/EI ou tempo definido). <strong>50N/51N</strong> operam com a corrente residual 3I₀
                        (faltas fase-terra). Os valores de pickup são referidos ao lado primário do TC.
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" style="margin-right: auto;" id="rlDelete">🗑️ Excluir Relé</button>
                    <button class="btn btn-secondary" id="rlCancel">Cancelar</button>
                    <button class="btn btn-primary" id="rlSave">💾 Salvar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Live CT ratio feedback
        const updRatio = () => {
            const ip = parseFloat(modal.querySelector('#rlCtPrimary').value) || 0;
            const is = parseFloat(modal.querySelector('#rlCtSecondary').value) || 5;
            const lbl = modal.querySelector('#rlCtRatio');
            if (lbl) lbl.textContent = `${ip}/${is}`;
        };
        modal.querySelector('#rlCtPrimary')?.addEventListener('input', updRatio);
        modal.querySelector('#rlCtSecondary')?.addEventListener('change', updRatio);

        const close = () => modal.remove();
        modal.querySelector('#rlClose').addEventListener('click', close);
        modal.querySelector('#rlCancel').addEventListener('click', close);

        modal.querySelector('#rlDelete')?.addEventListener('click', () => {
            close();
            if (onDelete) onDelete(relay);
        });

        modal.querySelector('#rlSave').addEventListener('click', () => {
            const gv = (id) => modal.querySelector(id)?.value;
            const gn = (id, fallback) => {
                const v = parseFloat(gv(id));
                return Number.isFinite(v) ? v : fallback;
            };

            relay.name = (gv('#rlName') || relay.name).trim() || relay.name;

            // TC
            relay.ct.primary = Math.max(1, gn('#rlCtPrimary', relay.ct.primary));
            relay.ct.secondary = parseInt(gv('#rlCtSecondary'), 10) === 1 ? 1 : 5;
            relay.ct.ctClass = (gv('#rlCtClass') || relay.ct.ctClass).trim();
            relay.ct.burdenVA = Math.max(0, gn('#rlCtBurden', relay.ct.burdenVA));

            // 50/51 fase
            relay.settings.unit50.enabled = !!modal.querySelector('#rl50Enabled')?.checked;
            relay.settings.unit50.pickup = Math.max(0, gn('#rl50Pickup', relay.settings.unit50.pickup));
            relay.settings.unit51.enabled = !!modal.querySelector('#rl51Enabled')?.checked;
            relay.settings.unit51.pickup = Math.max(0, gn('#rl51Pickup', relay.settings.unit51.pickup));
            relay.settings.unit51.curve = gv('#rl51Curve') || relay.settings.unit51.curve;
            relay.settings.unit51.tms = Math.max(0.05, gn('#rl51Tms', relay.settings.unit51.tms));
            relay.settings.unit51.definiteTime = Math.max(0.02, gn('#rl51DefTime', relay.settings.unit51.definiteTime));

            // 50N/51N neutro
            relay.settings.unit50N.enabled = !!modal.querySelector('#rl50NEnabled')?.checked;
            relay.settings.unit50N.pickup = Math.max(0, gn('#rl50NPickup', relay.settings.unit50N.pickup));
            relay.settings.unit51N.enabled = !!modal.querySelector('#rl51NEnabled')?.checked;
            relay.settings.unit51N.pickup = Math.max(0, gn('#rl51NPickup', relay.settings.unit51N.pickup));
            relay.settings.unit51N.curve = gv('#rl51NCurve') || relay.settings.unit51N.curve;
            relay.settings.unit51N.tms = Math.max(0.05, gn('#rl51NTms', relay.settings.unit51N.tms));
            relay.settings.unit51N.definiteTime = Math.max(0.02, gn('#rl51NDefTime', relay.settings.unit51N.definiteTime));

            close();
            if (onSave) onSave(relay);
        });
    }
}
