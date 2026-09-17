import { i18n } from './i18n.js';
import { TextLabel, LabelDataType } from '../elements/TextLabel.js';

/**
 * LabelManagerDialog — Redesign moderno (2026)
 * Gerenciador de rótulos/variáveis do diagrama unifilar.
 *
 * Melhorias de UX/UI:
 *  - Card moderno (radius generoso, sombra suave, transições).
 *  - Busca instantânea filtrando variáveis por nome, agrupadas por elemento.
 *  - Seções colapsáveis por tipo de elemento, com contadores de ativas.
 *  - Checkboxes customizados com foco acessível e hover states.
 *  - Preview em tempo real com visual de "chip" por seção.
 *  - Mobile-first: fullscreen em <= 640px, touch targets >= 44px.
 *
 * Funcionalidade preservada: mesmos IDs de checkbox, precisão decimal,
 * limpeza de rótulos existentes e sincronização com model.textLabels.
 */
export class LabelManagerDialog {

    /** Definição declarativa das variáveis por grupo de elemento. */
    static get GROUPS() {
        return [
            {
                id: 'bus', title: 'Barras', icon: '▮',
                items: [
                    { id: 'chkBusName',  label: 'Nome da Barra',            sample: 'Barra 1' },
                    { id: 'chkBusV',     label: 'Tensão (V)',               sample: '1.060 p.u.' },
                    { id: 'chkBusAngle', label: 'Ângulo (θ)',               sample: '0.000°' },
                    { id: 'chkBusFault', label: 'Curto-circuito (Icc)',     sample: 'Icc = 12.450 kA', accent: 'warn' },
                    { id: 'chkBusFaultV',label: 'Tensão pós-falta (Vcc)',   sample: 'Vcc = 0.000 p.u.', accent: 'warn' },
                ]
            },
            {
                id: 'line', title: 'Linhas', icon: '⟿',
                items: [
                    { id: 'chkLineName', label: 'Nome da Linha',            sample: 'L 1-2' },
                    { id: 'chkLineP',    label: 'Potência ativa (P)',       sample: 'P = 32.100 MW' },
                    { id: 'chkLineQ',    label: 'Potência reativa (Q)',     sample: 'Q = 14.500 Mvar' },
                    { id: 'chkLineLoss', label: 'Perdas',                   sample: 'Perdas = 0.420 MW' },
                    { id: 'chkLineI',    label: 'Corrente',                 sample: '134.5 A' },
                    { id: 'chkLineFault',label: 'Contribuição de Falta (Icc ramo)', sample: 'Icc = 6.280 kA', accent: 'warn' },
                ]
            },
            {
                id: 'transf', title: 'Transformadores', icon: '⌘',
                items: [
                    { id: 'chkTransfName', label: 'Nome do Trafo',          sample: 'T 1-2' },
                    { id: 'chkTransfTap',  label: 'Tap (Fixo / OLTC)',      sample: 'Tap = 0.978 p.u.', accent: 'warn' },
                    { id: 'chkTransfP',    label: 'Potência ativa (P)',     sample: 'P = 45.200 MW' },
                    { id: 'chkTransfQ',    label: 'Potência reativa (Q)',   sample: '' },
                    { id: 'chkTransfLoss', label: 'Perdas',                 sample: 'Perdas = 0.350 MW' },
                    { id: 'chkTransfFault',label: 'Contribuição de Falta (Icc trafo)', sample: 'Icc = 4.120 kA', accent: 'warn' },
                ]
            },
            {
                id: 'gen', title: 'Geradores', icon: '⚡',
                items: [
                    { id: 'chkGenName', label: 'Nome do Gerador',   sample: 'Gen 1' },
                    { id: 'chkGenP',    label: 'Potência ativa (P)', sample: 'P = 100.000 MW' },
                    { id: 'chkGenQ',    label: 'Potência reativa (Q)', sample: 'Q = 25.000 Mvar' },
                ]
            },
            {
                id: 'load', title: 'Cargas', icon: '⤓',
                items: [
                    { id: 'chkLoadName', label: 'Nome da Carga',     sample: 'Load 1' },
                    { id: 'chkLoadP',    label: 'Potência ativa (P)', sample: 'P = 30.000 MW' },
                    { id: 'chkLoadQ',    label: 'Potência reativa (Q)', sample: 'Q = 15.000 Mvar' },
                ]
            },
            {
                id: 'relay', title: 'Relés de Proteção', icon: '🛡',
                items: [
                    { id: 'chkRelayTime', label: 'Tempo de Operação',        sample: 'Tempo = INST / 1.234s', accent: 'danger' },
                    { id: 'chkRelayI',    label: 'Corrente de Sensibilização', sample: 'I sensibilização = 1.234 kA', accent: 'danger' },
                ]
            },
        ];
    }

    static show(model, onApply) {
        const existing = document.getElementById('labelManagerModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'labelManagerModal';
        modal.className = 'modal-backdrop lm-backdrop';

        // Detect currently active labels in the model
        const hasType = (elements, dataType) => {
            return elements.length > 0 && elements.some(el =>
                model.textLabels.some(l => l.parentElement === el && l.dataType === dataType)
            );
        };

        const checkedState = {
            chkBusName:  hasType(model.buses, LabelDataType.DATA_NAME),
            chkBusV:     hasType(model.buses, LabelDataType.DATA_VOLTAGE),
            chkBusAngle: hasType(model.buses, LabelDataType.DATA_ANGLE),
            chkBusFault: hasType(model.buses, LabelDataType.DATA_SC_CURRENT),
            chkBusFaultV: hasType(model.buses, LabelDataType.DATA_SC_VOLTAGE),

            chkLineName: hasType(model.lines, LabelDataType.DATA_NAME),
            chkLineP:    hasType(model.lines, LabelDataType.DATA_PF_ACTIVE),
            chkLineQ:    hasType(model.lines, LabelDataType.DATA_PF_REACTIVE),
            chkLineLoss: hasType(model.lines, LabelDataType.DATA_PF_LOSSES),
            chkLineI:    hasType(model.lines, LabelDataType.DATA_PF_CURRENT),
            chkLineFault: hasType(model.lines, LabelDataType.DATA_SC_CURRENT),

            chkTransfName: hasType(model.transformers, LabelDataType.DATA_NAME),
            chkTransfTap:  hasType(model.transformers, LabelDataType.DATA_TRANSFORMER_TAP),
            chkTransfP:    hasType(model.transformers, LabelDataType.DATA_PF_ACTIVE),
            chkTransfQ:    hasType(model.transformers, LabelDataType.DATA_PF_REACTIVE),
            chkTransfLoss: hasType(model.transformers, LabelDataType.DATA_PF_LOSSES),
            chkTransfFault: hasType(model.transformers, LabelDataType.DATA_SC_CURRENT),

            chkGenName: hasType(model.generators, LabelDataType.DATA_NAME),
            chkGenP:    hasType(model.generators, LabelDataType.DATA_ACTIVE_POWER),
            chkGenQ:    hasType(model.generators, LabelDataType.DATA_REACTIVE_POWER),

            chkLoadName: hasType(model.loads, LabelDataType.DATA_NAME),
            chkLoadP:    hasType(model.loads, LabelDataType.DATA_ACTIVE_POWER),
            chkLoadQ:    hasType(model.loads, LabelDataType.DATA_REACTIVE_POWER),

            chkRelayTime: hasType(model.relays, LabelDataType.DATA_RELAY_TIME),
            chkRelayI:    hasType(model.relays, LabelDataType.DATA_RELAY_CURRENT),
        };

        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

        // --- Build group sections HTML ---
        const sectionsHtml = this.GROUPS.map(group => {
            const rows = group.items.map(item => `
                <label class="lm-item ${item.accent ? 'lm-item-' + item.accent : ''}"
                       data-search="${norm(group.title + ' ' + item.label)}"
                       title="${item.label}">
                    <input type="checkbox" id="${item.id}" ${checkedState[item.id] ? 'checked' : ''}>
                    <span class="lm-check" aria-hidden="true"></span>
                    <span class="lm-item-text">${item.label}</span>
                </label>
            `).join('');
            return `
                <section class="lm-group" data-group="${group.id}">
                    <button type="button" class="lm-group-header" data-group-toggle="${group.id}" aria-expanded="true">
                        <span class="lm-group-icon" aria-hidden="true">${group.icon}</span>
                        <span class="lm-group-title">${group.title}</span>
                        <span class="lm-group-count" data-group-count="${group.id}"></span>
                        <span class="lm-group-chevron" aria-hidden="true">▾</span>
                    </button>
                    <div class="lm-group-body" data-group-body="${group.id}">${rows}</div>
                </section>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-card lm-card" role="dialog" aria-modal="true" aria-labelledby="lmTitle">
                <div class="lm-header">
                    <div class="lm-header-text">
                        <h3 id="lmTitle">${i18n.t('labelManager')}</h3>
                        <p class="lm-subtitle">Escolha as variáveis exibidas junto a cada elemento do diagrama</p>
                    </div>
                    <button class="lm-close" id="modalClose" aria-label="Fechar">✕</button>
                </div>

                <div class="lm-search-row">
                    <div class="lm-search-wrap">
                        <span class="lm-search-icon" aria-hidden="true">⌕</span>
                        <input type="search" id="lmSearch" class="lm-search" placeholder="Buscar variável…"
                               autocomplete="off" aria-label="Buscar variável">
                    </div>
                    <div class="lm-precision">
                        <label for="lmPrecision">Casas decimais</label>
                        <input type="number" id="lmPrecision" value="3" min="0" max="6" inputmode="numeric">
                    </div>
                </div>

                <div class="lm-body">
                    <div class="lm-list" id="lmList">
                        ${sectionsHtml}
                        <div class="lm-empty" id="lmEmpty" hidden>Nenhuma variável encontrada para a busca.</div>
                    </div>
                    <aside class="lm-preview-panel">
                        <div class="lm-preview-title">Pré-visualização</div>
                        <div id="lmPreviewBox" class="lm-preview-box" aria-live="polite"></div>
                    </aside>
                </div>

                <div class="lm-footer">
                    <label class="lm-item lm-item-danger lm-clear">
                        <input type="checkbox" id="chkClearExisting">
                        <span class="lm-check" aria-hidden="true"></span>
                        <span class="lm-item-text">Remover todos os rótulos existentes</span>
                    </label>
                    <div class="lm-footer-actions">
                        <button class="btn btn-secondary lm-btn" id="modalCancel">${i18n.t('dialogs.cancel')}</button>
                        <button class="btn btn-primary lm-btn" id="modalApply">${i18n.t('dialogs.apply')}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // --- Group collapse/expand ---
        modal.querySelectorAll('[data-group-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-group-toggle');
                const body = modal.querySelector(`[data-group-body="${id}"]`);
                const collapsed = body.classList.toggle('collapsed');
                btn.setAttribute('aria-expanded', String(!collapsed));
            });
        });

        // --- Group counters ---
        const updateCounts = () => {
            this.GROUPS.forEach(g => {
                const total = g.items.length;
                const active = g.items.filter(it => modal.querySelector('#' + it.id)?.checked).length;
                const badge = modal.querySelector(`[data-group-count="${g.id}"]`);
                if (badge) {
                    badge.textContent = `${active}/${total}`;
                    badge.classList.toggle('has-active', active > 0);
                }
            });
        };

        // --- Dynamic preview update ---
        const updatePreview = () => {
            const previewBox = modal.querySelector('#lmPreviewBox');
            if (!previewBox) return;
            const blocks = [];

            this.GROUPS.forEach(group => {
                const activeSamples = group.items
                    .filter(it => modal.querySelector('#' + it.id)?.checked && it.sample)
                    .map(it => it.sample);
                if (activeSamples.length > 0) {
                    blocks.push(
                        `<div class="lm-preview-block">` +
                        `<span class="lm-preview-group">${group.title}</span>` +
                        activeSamples.map(s => `<span class="lm-chip">${s}</span>`).join('') +
                        `</div>`
                    );
                }
            });

            previewBox.innerHTML = blocks.length
                ? blocks.join('')
                : '<span class="lm-preview-empty">Nenhum rótulo selecionado</span>';
        };

        // --- Instant search filter ---
        const searchInput = modal.querySelector('#lmSearch');
        const applyFilter = () => {
            const q = norm(searchInput.value.trim());
            let anyVisible = false;
            this.GROUPS.forEach(g => {
                let groupVisible = 0;
                g.items.forEach(it => {
                    const row = modal.querySelector('#' + it.id)?.closest('.lm-item[data-search]');
                    if (!row) return;
                    const show = !q || row.getAttribute('data-search').includes(q);
                    row.style.display = show ? '' : 'none';
                    if (show) groupVisible++;
                });
                const section = modal.querySelector(`[data-group="${g.id}"]`);
                if (section) section.style.display = groupVisible > 0 ? '' : 'none';
                if (groupVisible > 0) anyVisible = true;
            });
            modal.querySelector('#lmEmpty').hidden = anyVisible;
        };
        searchInput.addEventListener('input', applyFilter);

        modal.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', () => { updatePreview(); updateCounts(); });
        });
        updatePreview();
        updateCounts();

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
