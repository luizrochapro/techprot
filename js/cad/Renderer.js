/**
 * Renderer.js - Renders single-line electrical diagram elements on HTML5 Canvas
 */
export class Renderer {
    constructor() {
        this.theme = 'dark'; // 'dark' or 'light'
        // Flow animation state (configurado pelo Canvas a cada frame)
        this.animateFlow = true;        // toggle (menu Exibir)
        this.hasAnimatedArrows = false; // true se alguma seta animada foi desenhada no último render
        this.voltageColors = {
            500: '#1e88e5', // Blue
            230: '#e53935', // Red
            138: '#43a047', // Green
            69:  '#fb8c00', // Orange
            34.5:'#8e24aa', // Purple
            13.8:'#00acc1'  // Cyan
        };
    }

    getColors() {
        if (this.theme === 'light') {
            return {
                background: '#f8f9fa',
                grid: '#e0e0e0',
                gridMajor: '#cccccc',
                bus: '#1e293b',
                line: '#334155',
                selection: '#0284c7',
                selectionBox: 'rgba(2, 132, 199, 0.15)',
                text: '#0f172a',
                labelBg: 'rgba(255, 255, 255, 0.85)',
                labelBorder: '#cbd5e1',
                activeFlow: '#16a34a',
                hover: '#38bdf8'
            };
        }
        return {
            background: '#0f172a',
            grid: '#1e293b',
            gridMajor: '#334155',
            bus: '#f1f5f9',
            line: '#94a3b8',
            selection: '#38bdf8',
            selectionBox: 'rgba(56, 189, 248, 0.15)',
            text: '#f8fafc',
            labelBg: 'rgba(15, 23, 42, 0.85)',
            labelBorder: '#334155',
            activeFlow: '#22c55e',
            hover: '#7dd3fc'
        };
    }

    getBusColor(nominalVoltage, model = null) {
        if (model && typeof model.getBusColor === 'function') {
            return model.getBusColor(nominalVoltage);
        }
        const colors = this.getColors();
        const v = Math.round(nominalVoltage);
        return this.voltageColors[v] || colors.bus;
    }

    render(ctx, model, camera, showGrid = true, gridSize = 20, selectedElements = [], hoveredBreaker = null) {
        const colors = this.getColors();
        this.hasAnimatedArrows = false; // reavaliado a cada frame

        // 1. Draw Background
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Apply camera world transformation
        ctx.save();
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.scale, camera.scale);

        // 2. Draw Grid
        if (showGrid) {
            this.drawGrid(ctx, camera, gridSize, colors);
        }

        // 3. Draw Lines
        for (const line of model.lines) {
            this.drawLine(ctx, line, colors, selectedElements.includes(line), hoveredBreaker);
        }

        // 4. Draw Transformers
        for (const transf of model.transformers) {
            this.drawTransformer(ctx, transf, colors, selectedElements.includes(transf), hoveredBreaker);
        }

        // 5. Draw Buses
        for (const bus of model.buses) {
            this.drawBus(ctx, bus, colors, selectedElements.includes(bus), model);
        }

        // 6. Draw Generators
        for (const gen of model.generators) {
            this.drawGenerator(ctx, gen, colors, selectedElements.includes(gen), hoveredBreaker);
        }

        // 7. Draw Loads
        for (const ld of model.loads) {
            this.drawLoad(ctx, ld, colors, selectedElements.includes(ld), hoveredBreaker);
        }

        // 8. Draw Shunts
        for (const cap of model.capacitors) {
            this.drawCapacitor(ctx, cap, colors, selectedElements.includes(cap));
        }
        for (const ind of model.inductors) {
            this.drawInductor(ctx, ind, colors, selectedElements.includes(ind));
        }

        // 9. Draw Protection Relays (CT + 50/51/50N/51N circle)
        for (const relay of (model.relays || [])) {
            this.drawRelay(ctx, relay, colors, selectedElements.includes(relay));
        }

        // 10. Draw Diagram TextLabels
        for (const label of model.textLabels) {
            this.drawTextLabel(ctx, label, colors, selectedElements.includes(label));
        }

        ctx.restore();
    }

    drawGrid(ctx, camera, gridSize, colors) {
        const width = ctx.canvas.width / camera.scale;
        const height = ctx.canvas.height / camera.scale;
        const startX = Math.floor(-camera.x / camera.scale / gridSize) * gridSize;
        const endX = startX + width + gridSize * 2;
        const startY = Math.floor(-camera.y / camera.scale / gridSize) * gridSize;
        const endY = startY + height + gridSize * 2;

        ctx.lineWidth = 1.0 / camera.scale;

        // Draw dot or line grid
        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.strokeStyle = (x % (gridSize * 5) === 0) ? colors.gridMajor : colors.grid;
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.strokeStyle = (y % (gridSize * 5) === 0) ? colors.gridMajor : colors.grid;
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    drawBus(ctx, bus, colors, isSelected, model = null) {
        const bounds = bus.getBounds();
        ctx.save();

        const isOnline = bus.isOnline !== false;
        const busColor = !isOnline ? '#64748b' : this.getBusColor(bus.nominalVoltage, model);
        ctx.fillStyle = busColor;
        ctx.strokeStyle = isSelected ? colors.selection : (bus.hovered ? colors.hover : busColor);
        ctx.lineWidth = isSelected ? 3 : 1.5;

        // Draw busbar rectangle
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        if (isSelected || bus.hovered) {
            ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
        }

        // Draw resize handles at bar extremities when selected
        if (isSelected && typeof bus.getHandlePositions === 'function') {
            const handles = bus.getHandlePositions();
            const hs = 8; // handle size (px, world units)
            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#0c4a6e';
            ctx.lineWidth = 1.2;
            for (const key of ['start', 'end']) {
                const h = handles[key];
                ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
                ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
            }
        }

        // Draw fault indicator badge if bus has active fault or fault results
        if (bus.hasFault || (bus.results?.faultCurrentKA > 0.001)) {
            const faultText = (bus.results?.faultCurrentKA > 0.001)
                ? `⚡ Falta: ${bus.results.faultCurrentKA.toFixed(2)} kA`
                : '⚡ Falta';
            
            ctx.font = 'bold 10px Inter, sans-serif';
            const badgeW = ctx.measureText(faultText).width + 12;
            const badgeH = 18;
            const badgeX = bus.x - badgeW / 2;
            const badgeY = bounds.y - 28;

            // Glowing background badge
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#b91c1c';
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
            ctx.fill();
            ctx.stroke();

            // Text
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(faultText, bus.x, badgeY + badgeH / 2);
        }

        ctx.restore();
    }

    drawLine(ctx, line, colors, isSelected, hoveredBreaker = null) {
        let pts = line.pointList;
        if (!pts || pts.length < 2) {
            if (line.fromBus && line.toBus) {
                const p1 = line.fromBus.getClosestPointOnBar(line.toBus.x, line.toBus.y);
                const p2 = line.toBus.getClosestPointOnBar(line.fromBus.x, line.fromBus.y);
                pts = [p1, p2];
            } else return;
        }

        const isOnline = line.isOnline !== false && (line.breakerFrom !== false) && (line.breakerTo !== false);
        const lineColor = !isOnline ? '#64748b' : (isSelected ? colors.selection : (line.hovered ? colors.hover : colors.line));

        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();

        // Terminal connection dots
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, 3, 0, Math.PI * 2);
        ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Half-open terminal indicator: draw a small red "open gap" slash at the terminal
        // that has its breaker open. Only when exactly one breaker is open (half-open state).
        if (line.isOnline !== false && typeof line.isTerminalOnline === 'function') {
            const fromOpen = !line.isTerminalOnline(0);
            const toOpen = !line.isTerminalOnline(1);
            if (fromOpen && !toOpen) {
                this._drawOpenTerminalSlash(ctx, pts[0], pts[1] || pts[0], false);
            } else if (!fromOpen && toOpen) {
                this._drawOpenTerminalSlash(ctx, pts[pts.length - 1], pts[pts.length - 2] || pts[pts.length - 1], true);
            }
        }

        // Power flow arrow indicator (only if line is online and flow exists)
        if (isOnline && line.results && (line.results.p12 !== 0 || line.results.p21 !== 0)) {
            const midIndex = Math.floor(pts.length / 2);
            const pA = pts[midIndex - 1] || pts[0];
            const pB = pts[midIndex] || pts[pts.length - 1];
            const midX = (pA.x + pB.x) / 2;
            const midY = (pA.y + pB.y) / 2;
            let ang = Math.atan2(pB.y - pA.y, pB.x - pA.x);
            if (line.results.direction === 2) ang += Math.PI;

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(ang);
            if (this.animateFlow) {
                this.drawActiveFlowChevrons(ctx, line, colors);
                this.hasAnimatedArrows = true;
            } else {
                ctx.fillStyle = colors.activeFlow;
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(-4, -4);
                ctx.lineTo(-2, 0);
                ctx.lineTo(-4, 4);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        // Fault current flow contribution arrow
        if (isOnline && line.results && (line.results.faultFlowKA > 0.001)) {
            const midIndex = Math.floor(pts.length / 2);
            const pA = pts[midIndex - 1] || pts[0];
            const pB = pts[midIndex] || pts[pts.length - 1];
            const midX = (pA.x + pB.x) / 2;
            const midY = (pA.y + pB.y) / 2;
            let ang = Math.atan2(pB.y - pA.y, pB.x - pA.x);
            if (line.results.faultDirection === 2) ang += Math.PI;

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(ang);
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-5, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();

        // Draw Circuit Breakers at extremities
        const boxes = line.getSwitchBoxes ? line.getSwitchBoxes() : [];
        for (const box of boxes) {
            // Each breaker box is drawn with its own terminal state
            const termOnline = line.isTerminalOnline ? line.isTerminalOnline(box.terminal) : isOnline;
            this.drawBreaker(ctx, box, termOnline, hoveredBreaker?.element === line && hoveredBreaker?.box === box);
        }
    }

    /**
     * Fluxo animado de potência ativa: 3 chevrons (▸) deslocados ciclicamente
     * ao longo da direção do fluxo. Velocidade proporcional à magnitude do
     * fluxo (escala raiz quadrada, clampada em 8–32 unidades mundo/s).
     * Fade in/out suave nas bordas do ciclo. Deve ser chamado dentro de um
     * contexto já transladado ao ponto médio e rotacionado na direção do fluxo.
     */
    drawActiveFlowChevrons(ctx, line, colors) {
        const pMag = Math.max(
            Math.abs(line.results.p12 || 0),
            Math.abs(line.results.p21 || 0)
        );
        // Velocidade: 8*u/s (base) + 4*sqrt(|P|), limitada a 32 u/s.
        // Raiz quadrada comprime a faixa dinâmica (P em MW pode ir de 0.1 a 500+).
        const speed = Math.min(32, Math.max(8, 8 + 4 * Math.sqrt(pMag)));
        const spacing = 14;                 // distância entre chevrons (equivale ao período do ciclo)
        const window_ = spacing * 1.5;      // meia-largura da janela de visibilidade (fade)
        const offset = ((performance.now() / 1000) * speed) % spacing;

        ctx.fillStyle = colors.activeFlow;
        for (let i = -1; i <= 1; i++) {
            const x = i * spacing + offset - spacing * 0.0; // 3 chevrons: -s, 0, +s (+offset)
            if (Math.abs(x) > window_) continue;
            // Fade triangular: 1 no centro, 0 nas bordas da janela
            const alpha = Math.max(0, 1 - Math.abs(x) / window_);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(x + 6, 0);
            ctx.lineTo(x - 4, -4);
            ctx.lineTo(x - 2, 0);
            ctx.lineTo(x - 4, 4);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawTransformer(ctx, transf, colors, isSelected, hoveredBreaker = null) {
        const isOnline = transf.isOnline !== false && (transf.breakerFrom !== false) && (transf.breakerTo !== false);
        const strokeColor = !isOnline ? '#64748b' : (isSelected ? colors.selection : (transf.hovered ? colors.hover : colors.line));

        ctx.save();
        ctx.translate(transf.x, transf.y);
        ctx.rotate((transf.angle * Math.PI) / 180);

        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = isSelected ? colors.selectionBox : 'transparent';
        ctx.lineWidth = isSelected ? 2.5 : 2;

        const r = 14;
        const d = 10; // overlap distance

        // Circle 1 (Primary)
        ctx.beginPath();
        ctx.arc(0, -d, r, 0, Math.PI * 2);
        ctx.stroke();

        // Circle 2 (Secondary)
        ctx.beginPath();
        ctx.arc(0, d, r, 0, Math.PI * 2);
        ctx.stroke();

        // Terminals
        ctx.beginPath();
        ctx.moveTo(0, -d - r);
        ctx.lineTo(0, -d - r - 8);
        ctx.moveTo(0, d + r);
        ctx.lineTo(0, d + r + 8);
        ctx.stroke();

        // OLTC Indicator arrow (if hasTapChanger)
        if (transf.hasTapChanger) {
            const oltcColor = isOnline ? '#f59e0b' : '#64748b';
            ctx.strokeStyle = oltcColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-16, 12);
            ctx.lineTo(16, -12);
            ctx.stroke();

            // Arrow head on OLTC tap indicator
            ctx.fillStyle = oltcColor;
            ctx.beginPath();
            ctx.moveTo(16, -12);
            ctx.lineTo(11, -8);
            ctx.lineTo(12, -15);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        // If connected to buses, draw connecting leads
        if (transf.fromBus && transf.toBus) {
            const p1 = transf.fromBus.getClosestPointOnBar(transf.x, transf.y);
            const p2 = transf.toBus.getClosestPointOnBar(transf.x, transf.y);
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(transf.x, transf.y - 25);
            ctx.moveTo(transf.x, transf.y + 25);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.restore();
        }

        // Short-circuit fault contribution arrow for Transformer
        if (isOnline && transf.results && (transf.results.faultFlowKA > 0.001) && transf.fromBus && transf.toBus) {
            const p1 = transf.fromBus.getClosestPointOnBar(transf.x, transf.y);
            const p2 = transf.toBus.getClosestPointOnBar(transf.x, transf.y);
            let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            if (transf.results.faultDirection === 2) ang += Math.PI;

            ctx.save();
            ctx.translate(transf.x + 22, transf.y);
            ctx.rotate(ang);
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-5, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Draw Circuit Breakers at transformer extremities
        const boxes = transf.getSwitchBoxes ? transf.getSwitchBoxes() : [];
        for (const box of boxes) {
            const termOnline = transf.isTerminalOnline ? transf.isTerminalOnline(box.terminal) : isOnline;
            this.drawBreaker(ctx, box, termOnline, hoveredBreaker?.element === transf && hoveredBreaker?.box === box);
        }
    }

    drawGenerator(ctx, gen, colors, isSelected, hoveredBreaker = null) {
        const isOnline = gen.isOnline !== false;
        const strokeColor = !isOnline ? '#64748b' : (isSelected ? colors.selection : (gen.hovered ? colors.hover : colors.line));
        const r = 16;
        const rad = ((gen.angle || 0) * Math.PI) / 180;

        // Terminal lead to parent bus
        if (gen.parentBus) {
            // Rotated terminal on circle perimeter
            const termX = gen.x + r * Math.sin(rad);
            const termY = gen.y - r * Math.cos(rad);
            const pBus = gen.parentBus.getClosestPointOnBar(termX, termY);

            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(termX, termY);
            ctx.lineTo(pBus.x, pBus.y);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Generator symbol rotated by gen.angle
        ctx.save();
        ctx.translate(gen.x, gen.y);
        ctx.rotate(rad);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected ? 2.5 : 2;

        // Circle
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // Sine wave symbol inside (rotates together with generator)
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.bezierCurveTo(-4, -8, 0, -8, 0, 0);
        ctx.bezierCurveTo(0, 8, 4, 8, 8, 0);
        ctx.stroke();

        // Terminal stub pointing towards connection
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, -r - 5);
        ctx.stroke();

        ctx.restore();

        // Draw Generator circuit breaker
        const boxes = gen.getSwitchBoxes ? gen.getSwitchBoxes() : [];
        for (const box of boxes) {
            this.drawBreaker(ctx, box, isOnline, hoveredBreaker?.element === gen && hoveredBreaker?.box === box);
        }
    }

    drawBreaker(ctx, box, isOnline, isHovered = false) {
        ctx.save();
        // Breaker SCADA / TechProt colors:
        // Closed (in service / online): vibrant green (#22c55e)
        // Open (out of service / offline): vibrant red (#ef4444)
        const fillColor = isOnline ? '#22c55e' : '#ef4444';
        const borderColor = isHovered ? '#ffffff' : (isOnline ? '#15803d' : '#991b1b');

        if (isHovered) {
            ctx.shadowColor = isOnline ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
            ctx.shadowBlur = 6;
        }

        ctx.fillStyle = fillColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isHovered ? 2 : 1.2;

        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Open breaker "X" indicator
        if (!isOnline) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(box.x + 2, box.y + 2);
            ctx.lineTo(box.x + box.width - 2, box.y + box.height - 2);
            ctx.moveTo(box.x + box.width - 2, box.y + 2);
            ctx.lineTo(box.x + 2, box.y + box.height - 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Draws a small red "open gap" slash mark at a line terminal where the breaker is open.
     * This provides an additional visual indicator beyond the breaker box color, making
     * the half-open state visually clear on the line body itself.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x:number,y:number}} termPt - The open terminal point
     * @param {{x:number,y:number}} otherPt - The opposite terminal (for direction)
     * @param {boolean} isToTerminal - true if this is the "to" end (pts[last])
     */
    _drawOpenTerminalSlash(ctx, termPt, otherPt, isToTerminal) {
        // Direction unit vector from termPt toward otherPt
        const dx = otherPt.x - termPt.x;
        const dy = otherPt.y - termPt.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) return;
        const ux = dx / len;
        const uy = dy / len;

        // Perpendicular for the slash
        const px = -uy;
        const py = ux;

        const gapSize = 6; // distance from terminal point into the line
        const slashLen = 5; // half-length of the slash mark

        // Center of the gap mark
        const cx = termPt.x + ux * gapSize;
        const cy = termPt.y + uy * gapSize;

        ctx.save();
        ctx.strokeStyle = '#ef4444'; // red for open
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(cx + px * slashLen, cy + py * slashLen);
        ctx.lineTo(cx - px * slashLen, cy - py * slashLen);
        ctx.stroke();
        ctx.restore();
    }

    drawLoad(ctx, ld, colors, isSelected, hoveredBreaker = null) {
        const isOnline = ld.isOnline !== false;
        const strokeColor = !isOnline ? '#64748b' : (isSelected ? colors.selection : (ld.hovered ? colors.hover : colors.line));
        const rad = ((ld.angle || 0) * Math.PI) / 180;
        const stemLength = 10;
        const termX = ld.x + stemLength * Math.sin(rad);
        const termY = ld.y - stemLength * Math.cos(rad);

        // Connecting lead to parent bus
        if (ld.parentBus) {
            const p = ld.parentBus.getClosestPointOnBar(termX, termY);
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(termX, termY);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.restore();
        }

        // Inverted triangle arrow
        ctx.save();
        ctx.translate(ld.x, ld.y);
        ctx.rotate(rad);

        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = strokeColor;
        ctx.lineWidth = isSelected ? 2.5 : 2;

        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-8, 5);
        ctx.lineTo(8, 5);
        ctx.lineTo(0, 16);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Draw Circuit Breaker on load terminal lead
        const boxes = ld.getSwitchBoxes ? ld.getSwitchBoxes() : [];
        for (const box of boxes) {
            this.drawBreaker(ctx, box, isOnline, hoveredBreaker?.element === ld && hoveredBreaker?.box === box);
        }
    }

    drawCapacitor(ctx, cap, colors, isSelected) {
        const isOnline = cap.isOnline !== false;
        const strokeColor = !isOnline ? '#64748b' : (isSelected ? colors.selection : colors.line);

        ctx.save();
        ctx.translate(cap.x, cap.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;

        // Two parallel plates
        ctx.beginPath();
        ctx.moveTo(-10, -3);
        ctx.lineTo(10, -3);
        ctx.moveTo(-10, 3);
        ctx.lineTo(10, 3);
        ctx.stroke();

        // Ground/Lead
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.lineTo(0, 12);
        ctx.moveTo(-6, 12);
        ctx.lineTo(6, 12);
        ctx.moveTo(-3, 15);
        ctx.lineTo(3, 15);
        ctx.stroke();

        if (cap.parentBus) {
            const p = cap.parentBus.getClosestPointOnBar(cap.x, cap.y);
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.lineTo(p.x - cap.x, p.y - cap.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawInductor(ctx, ind, colors, isSelected) {
        const isOnline = ind.isOnline !== false;
        const strokeColor = !isOnline ? '#64748b' : (isSelected ? colors.selection : colors.line);

        ctx.save();
        ctx.translate(ind.x, ind.y);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;

        // Coil loops
        ctx.beginPath();
        ctx.arc(-6, 0, 4, Math.PI, 0);
        ctx.arc(0, 0, 4, Math.PI, 0);
        ctx.arc(6, 0, 4, Math.PI, 0);
        ctx.stroke();

        // Ground lead
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(10, 10);
        ctx.moveTo(6, 10);
        ctx.lineTo(14, 10);
        ctx.stroke();

        if (ind.parentBus) {
            const p = ind.parentBus.getClosestPointOnBar(ind.x, ind.y);
            ctx.beginPath();
            ctx.moveTo(-10, 0);
            ctx.lineTo(p.x - ind.x, p.y - ind.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Draws a protection relay bound to a circuit breaker:
     * CT symbol (two concentric circles) right after the breaker, a secondary
     * wire, and the relay circle containing the ANSI functions 50/51 50N/51N.
     */
    drawRelay(ctx, relay, colors, isSelected) {
        const g = relay.getGeometry ? relay.getGeometry() : null;
        if (!g) return;

        const isParentOnline = relay.parentElement
            ? (typeof relay.parentElement.isTerminalOnline === 'function'
                ? relay.parentElement.isTerminalOnline(relay.terminal)
                : relay.parentElement.isOnline !== false)
            : true;
        const accent = relay.tripped ? '#ef4444' : (isSelected ? colors.selection
            : (relay.hovered ? colors.hover : (isParentOnline ? '#f59e0b' : '#64748b')));

        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = isSelected ? 2.2 : 1.5;
        ctx.lineCap = 'round';

        // 1. Conductor from breaker right edge to CT left edge
        ctx.beginPath();
        ctx.moveTo(g.box.x + g.box.width, g.ct.y);
        ctx.lineTo(g.ct.x - g.ct.r, g.ct.y);
        ctx.stroke();

        // 2. CT symbol: two concentric circles (current transformer)
        ctx.beginPath();
        ctx.arc(g.ct.x, g.ct.y, g.ct.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(g.ct.x, g.ct.y, g.ct.r - 2.5, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Secondary wire with 90° bend: CT right → bend → down to relay circle top
        const circleTopY = g.circle.y - g.circle.r;
        ctx.beginPath();
        ctx.moveTo(g.ct.x + g.ct.r, g.ct.y);   // right edge of CT
        ctx.lineTo(g.bend.x, g.bend.y);         // horizontal segment
        ctx.lineTo(g.circle.x, circleTopY);      // vertical segment down to circle top
        ctx.stroke();

        // 4. Relay circle (ANSI 50/51 50N/51N)
        ctx.beginPath();
        ctx.arc(g.circle.x, g.circle.y, g.circle.r, 0, Math.PI * 2);
        if (isSelected) {
            ctx.fillStyle = colors.selectionBox;
            ctx.fill();
        }
        ctx.stroke();

        // ANSI functions inside the circle: fixed label "50/51"
        const s = relay.settings || {};
        const anyOn = s.unit50?.enabled || s.unit51?.enabled || s.unit50N?.enabled || s.unit51N?.enabled;
        ctx.fillStyle = anyOn ? accent : '#64748b';
        ctx.font = 'bold 8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('50/51', g.circle.x, g.circle.y);

        // Quando sensibilizado, exibe badge de operação abaixo do círculo
        if (relay.tripped) {
            const timeTxt = relay.tripTime === 0 ? 'INST' : `${relay.tripTime.toFixed(3)}s`;
            const infoTxt = `${relay.tripUnit} ${timeTxt} | ${(relay.tripCurrent / 1000).toFixed(2)} kA`;
            ctx.font = 'bold 8px Inter, sans-serif';
            const bw = ctx.measureText(infoTxt).width + 8;
            const bx = g.circle.x - bw / 2;
            const by = g.circle.y + g.circle.r + 6;
            ctx.fillStyle = 'rgba(127,29,29,0.9)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, bw, 14, 3);
            else ctx.rect(bx, by, bw, 14);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fca5a5';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(infoTxt, g.circle.x, by + 7);
        }

        ctx.restore();
    }

    drawTextLabel(ctx, label, colors, isSelected) {
        ctx.save();
        const isName = label.dataType === 0; // LabelDataType.DATA_NAME
        const font = isName ? 'bold 11px Inter, -apple-system, sans-serif' : '11px "JetBrains Mono", Consolas, monospace';
        ctx.font = font;

        const text = label.text || '';
        const metrics = ctx.measureText(text);
        const padding = 5;
        const w = Math.max(28, metrics.width + padding * 2);
        const h = 18;

        label.width = w;
        label.height = h;

        const isParentOffline = label.parentElement && label.parentElement.isOnline === false;

        // Badge background
        ctx.fillStyle = colors.labelBg;
        if (isSelected) {
            ctx.strokeStyle = colors.selection;
            ctx.lineWidth = 1.6;
        } else if (label.hovered) {
            ctx.strokeStyle = colors.hover;
            ctx.lineWidth = 1.3;
        } else {
            ctx.strokeStyle = isName ? 'rgba(0, 0, 0, 0.08)' : colors.labelBorder;
            ctx.lineWidth = 1;
        }

        ctx.beginPath();
        ctx.roundRect(label.x - w / 2, label.y - h / 2, w, h, 3);
        ctx.fill();
        ctx.stroke();

        // Text
        if (isParentOffline) {
            ctx.fillStyle = '#64748b';
        } else if (isSelected) {
            ctx.fillStyle = colors.selection;
        } else if (label.hovered) {
            ctx.fillStyle = colors.hover;
        } else {
            ctx.fillStyle = colors.text;
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, label.x, label.y);

        ctx.restore();
    }
}
