import { Relay } from '../elements/Relay.js';

/**
 * CoordogramDialog.js - Coordenograma tempo x corrente (TCC, escala log-log)
 * com as curvas das unidades 50/51 e 50N/51N dos relés do modelo.
 *
 * Abre em JANELA POPUP separada (window.open), sem dividir a tela do unifilar.
 */
export class CoordogramDialog {
    // Janela popup ativa (se houver)
    static _win = null;

    /** True se a janela popup do coordenograma está aberta. */
    static isOpen() {
        return !!(CoordogramDialog._win && !CoordogramDialog._win.closed);
    }

    /**
     * Abre (ou foca/atualiza) a janela popup do coordenograma.
     * @param {Model} model
     * @param {App} app
     * @param {Relay|null} focusRelay
     */
    static show(model, app, focusRelay = null) {
        const relays = (model.relays || []);

        // Garante que sempre haja algo para visualizar:
        // 1. o relé em foco entra automaticamente no coordenograma;
        // 2. se nenhum relé estiver marcado, marca todos (visão geral).
        if (focusRelay && !focusRelay.showInCoordogram) focusRelay.showInCoordogram = true;
        else if (relays.length > 0 && !relays.some(r => r.showInCoordogram)) {
            relays.forEach(r => { r.showInCoordogram = true; });
        }

        // Reusa a popup existente: redesenha o conteúdo nela
        let win = CoordogramDialog._win;
        if (win && !win.closed) {
            CoordogramDialog._renderHtml(win, model, app, focusRelay);
            win.focus();
            return;
        }

        // Abre nova janela popup
        win = window.open(
            '',
            'techprot_coordogram',
            'width=1100,height=750,resizable=yes,scrollbars=no,menubar=no,toolbar=no,status=no'
        );
        if (!win) {
            app?.showNotification?.('Não foi possível abrir a janela do coordenograma: popup bloqueado pelo navegador. Permita popups para esta página.', 'error');
            return;
        }
        CoordogramDialog._win = win;
        CoordogramDialog._renderHtml(win, model, app, focusRelay);
        win.focus();
    }

    /** Separa a renderização interna de todo o conteúdo da popup. */
    static _renderHtml(win, model, app, focusRelay) {
        const relays = (model.relays || []);
        const doc = win.document;

        const rows = relays.map(r => {
            const isFocus = focusRelay && r === focusRelay;
            return `
                <label style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; background: ${isFocus ? 'rgba(245,158,11,0.15)' : 'rgba(30,41,59,0.6)'}; border: 1px solid ${isFocus ? '#f59e0b' : '#334155'}; border-radius: 6px;">
                    <input type="checkbox" class="coord-relay-check" data-id="${r.id}" ${r.showInCoordogram ? 'checked' : ''}>
                    <span style="${isFocus ? 'color:#f59e0b; font-weight:bold;' : ''}">${r.name}</span>
                    <span style="color:#64748b; font-size:11px;">→ ${r.parentElement ? r.parentElement.name : '—'} (TC ${r.ct.primary}/${r.ct.secondary})</span>
                </label>
            `;
        }).join('') || '<div style="padding: 8px; color: #94a3b8; font-size: 12px;">Nenhum relé 50/51 cadastrado no momento. No unifilar: ferramenta 🛡 Relé → clique em um disjuntor; depois, botão direito no relé → "Adicionar Curva ao Coordenograma".</div>';

        doc.open();
        doc.write(`<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>TechProt — Coordenograma de Proteção (50/51 · 50N/51N)</title>
    <style>
        html, body { margin:0; padding:0; height:100%; background:#0f172a; color:#f1f5f9; font-family:Inter,-apple-system,Segoe UI,sans-serif; overflow:hidden; }
        .wrap { display:flex; flex-direction:column; height:100vh; }
        .hdr { padding:10px 16px; border-bottom:1px solid #334155; background:#1e293b; }
        .hdr h1 { font-size:16px; margin:0; }
        .hdr .sub { font-size:11px; color:#64748b; margin-top:2px; }
        .list { padding:8px 12px; border-bottom:1px solid #334155; display:flex; flex-wrap:wrap; gap:6px; max-height:110px; overflow-y:auto; background:#0f172a; }
        .plot { flex:1; position:relative; min-height:0; background:#0f172a; }
        .plot canvas { position:absolute; inset:0; width:100%; height:100%; }
        .foot { padding:5px 14px; font-size:10.5px; color:#64748b; border-top:1px solid #334155; background:#1e293b; display:flex; gap:14px; flex-wrap:wrap; }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="hdr">
            <h1>📈 Coordenograma — Curvas Tempo × Corrente (50/51 · 50N/51N)</h1>
            <div class="sub">Janela independente: mantenha o unifilar aberto enquanto compara relés</div>
        </div>
        <div class="list" id="coordRelayList">${rows}</div>
        <div class="plot"><canvas id="coordCanvas"></canvas></div>
        <div class="foot">
            <span><span style="color:#f59e0b;">▬▬</span> 51 (fase)</span>
            <span><span style="color:#a78bfa;">- - -</span> 51N (neutro 3I₀)</span>
            <span>▮ pickup 50/50N</span>
            <span>┇ linha vertical = Icc de curto-circuito simulado no disjuntor do relé</span>
            <span>correntes referidas ao PRIMÁRIO (A)</span>
        </div>
    </div>
    <script>
        // Comunicação invertida: a página pai injeta as funções de desenho na janela
        window.__coordRedraw = null;
        window.__coordRelays = [];
    <\/script>
</body>
</html>`);
        doc.close();

        const canvas = doc.getElementById('coordCanvas');

        const redraw = () => {
            const boxes = [...doc.querySelectorAll('.coord-relay-check')];
            const ids = new Set(boxes.filter(c => c.checked).map(c => parseInt(c.dataset.id, 10)));
            for (const r of relays) r.showInCoordogram = ids.has(r.id);
            CoordogramDialog._drawCurves(canvas, win, relays.filter(r => r.showInCoordogram), focusRelay);
        };

        doc.querySelectorAll('.coord-relay-check').forEach(cb => cb.addEventListener('change', redraw));

        // Redesenha ao redimensionar a popup
        win.addEventListener('resize', redraw);

        // Remove referência quando fechar
        win.addEventListener('beforeunload', () => { CoordogramDialog._win = null; });

        redraw();
    }

    /**
     * Draws log-log time-current curves on the given canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {Window} win - window da popup (para devicePixelRatio)
     * @param {Relay[]} relays
     * @param {Relay|null} focusRelay
     */
    static _drawCurves(canvas, win, relays, focusRelay) {
        const dpr = win.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(10, rect.width * dpr);
        canvas.height = Math.max(10, rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const W = rect.width, H = rect.height;
        const padL = 62, padR = 20, padT = 18, padB = 44;
        const plotW = W - padL - padR, plotH = H - padT - padB;

        const iMin = 10, iMax = 100000;       // A
        const tMin = 0.01, tMax = 1000;       // s
        const xOf = (I) => padL + (Math.log10(I) - Math.log10(iMin)) / (Math.log10(iMax) - Math.log10(iMin)) * plotW;
        const yOf = (t) => padT + (Math.log10(tMax) - Math.log10(t)) / (Math.log10(tMax) - Math.log10(tMin)) * plotH;

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        if (plotW <= 0 || plotH <= 0) return;

        // Grid (log decades)
        ctx.lineWidth = 1;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';

        for (let e = Math.ceil(Math.log10(iMin)); e <= Math.floor(Math.log10(iMax)); e++) {
            const x = xOf(Math.pow(10, e));
            ctx.strokeStyle = '#334155';
            ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText(`10${CoordogramDialog._sup(e)} A`, x, padT + plotH + 14);
            for (let m = 2; m < 10; m++) {
                const xm = xOf(m * Math.pow(10, e));
                if (xm < padL || xm > padL + plotW) continue;
                ctx.strokeStyle = '#1e293b';
                ctx.beginPath(); ctx.moveTo(xm, padT); ctx.lineTo(xm, padT + plotH); ctx.stroke();
            }
        }
        for (let e = Math.ceil(Math.log10(tMin)); e <= Math.floor(Math.log10(tMax)); e++) {
            const y = yOf(Math.pow(10, e));
            ctx.strokeStyle = '#334155';
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'right';
            ctx.fillText(e === 0 ? '1 s' : `10${CoordogramDialog._sup(e)} s`, padL - 6, y);
            for (let m = 2; m < 10; m++) {
                const ym = yOf(m * Math.pow(10, e));
                if (ym < padT || ym > padT + plotH) continue;
                ctx.strokeStyle = '#1e293b';
                ctx.beginPath(); ctx.moveTo(padL, ym); ctx.lineTo(padL + plotW, ym); ctx.stroke();
            }
        }

        // Frame
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(padL, padT, plotW, plotH);

        // ---- Curves
        const palettes = [
            ['#f59e0b', '#a78bfa'],
            ['#38bdf8', '#22c55e'],
            ['#ef4444', '#f472b6'],
            ['#eab308', '#2dd4bf'],
            ['#fb7185', '#818cf8'],
            ['#34d399', '#fbbf24'],
            ['#c084fc', '#4ade80']
        ];
        let legendY = padT + 10;
        ctx.save();
        ctx.beginPath();
        ctx.rect(padL, padT, plotW, plotH);
        ctx.clip();

        relays.forEach((relay, idx) => {
            const s = relay.settings || {};
            const pal = palettes[idx % palettes.length];
            const focused = focusRelay === relay || relays.length === 1;
            const lw = focused ? 2.4 : 1.4;

            CoordogramDialog._plotTimed(ctx, relay, s.unit51, pal[0], lw, false, xOf, yOf, iMin, iMax, tMin, tMax);
            CoordogramDialog._plotTimed(ctx, relay, s.unit51N, pal[1], lw, true, xOf, yOf, iMin, iMax, tMin, tMax);
            CoordogramDialog._plotInstant(ctx, s.unit50, pal[0], lw, false, xOf, yOf, tMin);
            CoordogramDialog._plotInstant(ctx, s.unit50N, pal[1], lw, true, xOf, yOf, tMin);

            const iccKA = relay.getSimulatedFaultKA();
            if (iccKA > 0) {
                CoordogramDialog._plotIccLine(ctx, iccKA * 1000, pal[0], idx, xOf, padT, plotH);
            }
        });
        ctx.restore();

        // ---- Legend
        relays.forEach((relay, idx) => {
            const pal = palettes[idx % palettes.length];
            const y = legendY + idx * 16;
            ctx.strokeStyle = pal[0]; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.moveTo(padL + 12, y); ctx.lineTo(padL + 30, y); ctx.stroke();
            ctx.strokeStyle = pal[1]; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(padL + 34, y); ctx.lineTo(padL + 52, y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = relay === focusRelay ? '#f59e0b' : '#e2e8f0';
            ctx.font = relay === focusRelay ? 'bold 11px Inter, sans-serif' : '11px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${relay.name} (51 · 51N)`, padL + 58, y);
        });
    }

    /**
     * Simulated short-circuit current at the relay's breaker: vertical dashed
     * line spanning the whole time axis with the Icc value labeled on top.
     * Labels are staggered per relay index to avoid overlapping.
     */
    static _plotIccLine(ctx, iccA, color, idx, xOf, padT, plotH) {
        if (!(iccA > 0)) return;
        const x = xOf(iccA);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Icc value label on top of the line (staggered height per relay)
        const labelY = padT + 6 + (idx % 4) * 13;
        const txt = `Icc ${(iccA / 1000).toFixed(2)} kA`;
        ctx.font = 'bold 10px Inter, sans-serif';
        const w = ctx.measureText(txt).width + 8;
        let bx = x - w / 2;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, labelY - 7, w, 14, 3);
        else ctx.rect(bx, labelY - 7, w, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, x, labelY);
        ctx.restore();
    }

    static _plotTimed(ctx, relay, unit, color, lw, dashed, xOf, yOf, iMin, iMax, tMin, tMax) {
        if (!unit || !unit.enabled || !(unit.pickup > 0)) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        if (dashed) ctx.setLineDash([6, 4]);
        ctx.beginPath();
        let started = false;
        const steps = 240;
        for (let i = 0; i <= steps; i++) {
            const logI = Math.log10(unit.pickup * 1.01) + (Math.log10(iMax) - Math.log10(unit.pickup * 1.01)) * (i / steps);
            const I = Math.pow(10, logI);
            const t = Relay.tripTime(unit, I);
            if (!Number.isFinite(t) || t <= 0) continue;
            const tC = Math.min(tMax, Math.max(tMin * 0.5, t));
            const x = xOf(I), y = yOf(tC);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    static _plotInstant(ctx, unit, color, lw, dashed, xOf, yOf, tMin) {
        if (!unit || !unit.enabled || !(unit.pickup > 0)) return;
        const x = xOf(unit.pickup);
        const yTop = yOf(tMin * 2);
        const yBot = yOf(Math.max(tMin * 20, 0.1));
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw + 0.6;
        if (dashed) ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, yBot);
        ctx.lineTo(x, yTop);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(x - 3, yBot - 2, 6, 6);
        ctx.setLineDash([]);
        ctx.restore();
    }

    static _sup(n) {
        const sup = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶' };
        return String(n).split('').map(c => sup[c] || c).join('');
    }
}
