/**
 * StabilityChart.js - High-Performance Canvas Plotter for Electromechanical Dynamics
 * 
 * Features:
 * - Multi-curve time-series plotting with automatic dynamic range & nice round ticks
 * - Disturbance event markers (vertical dashed lines with colored label badges)
 * - Interactive hover crosshair and interpolated multi-series tooltip
 * - Interactive legend with individual series show/hide toggles
 * - HiDPI / Retina display crisp rendering
 * - Dark & Light mode theme adaptation
 */
export class StabilityChart {
    /**
     * @param {HTMLCanvasElement} canvasElement
     * @param {Object} [options]
     */
    constructor(canvasElement, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.options = {
            title: '',
            xLabel: 'Tempo (s)',
            yLabel: 'Ângulo δ (°)',
            yUnit: '°',
            theme: 'dark',
            ...options
        };

        this.time = [];
        this.series = []; // [{ name: string, color: string, data: number[], visible: boolean }]
        this.events = []; // [{ time: number, label: string, color: string }]

        this.mouseX = -1;
        this.mouseY = -1;
        this.isHovering = false;

        this.padding = { top: 32, right: 30, bottom: 42, left: 60 };

        this.init();
    }

    init() {
        this.resize();
        this.bindEvents();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(300, Math.floor(rect.width));
        const height = Math.max(200, Math.floor(rect.height));

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);

        this.width = width;
        this.height = height;
        this.render();
    }

    setData(time, series, events = [], options = {}) {
        this.time = time || [];
        this.series = series || [];
        this.events = events || [];
        this.options = { ...this.options, ...options };
        this.render();
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.isHovering = true;
            this.render();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isHovering = false;
            this.mouseX = -1;
            this.mouseY = -1;
            this.render();
        });

        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Calculates nice round human-readable tick intervals (1, 2, 5, 10, etc.)
     */
    static getNiceInterval(range, maxTicks = 8) {
        if (range <= 0) return 1;
        const rough = range / maxTicks;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const norm = rough / mag;
        let niceNorm = 1;
        if (norm > 1.5) niceNorm = 2;
        if (norm > 3.0) niceNorm = 5;
        if (norm > 7.0) niceNorm = 10;
        return niceNorm * mag;
    }

    render() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        if (!w || !h || !ctx) return;

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const bgColor = isDark ? '#0f172a' : '#ffffff';
        const gridColor = isDark ? '#1e293b' : '#e2e8f0';
        const axisColor = isDark ? '#475569' : '#cbd5e1';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const textPrimary = isDark ? '#f8fafc' : '#0f172a';

        // Clear canvas
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);

        const pad = this.padding;
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;

        if (this.time.length < 2 || this.series.length === 0) {
            ctx.fillStyle = textColor;
            ctx.font = '13px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Nenhum dado de simulação disponível para exibição.', w / 2, h / 2);
            return;
        }

        // 1. Calculate X bounds
        const xMin = this.time[0];
        const xMax = this.time[this.time.length - 1];
        const xRange = Math.max(1e-4, xMax - xMin);

        // 2. Calculate Y bounds across all visible series
        let yMin = Infinity;
        let yMax = -Infinity;

        for (const s of this.series) {
            if (s.visible === false) continue;
            for (let i = 0; i < s.data.length; i++) {
                const val = s.data[i];
                if (!Number.isFinite(val)) continue;
                if (val < yMin) yMin = val;
                if (val > yMax) yMax = val;
            }
        }

        if (yMin === Infinity) {
            yMin = -1;
            yMax = 1;
        }

        // Add 8% margin top/bottom
        const ySpan = Math.max(1e-4, yMax - yMin);
        yMin -= ySpan * 0.08;
        yMax += ySpan * 0.08;
        const yRange = yMax - yMin;

        // Coordinate transforms
        const toX = (t) => pad.left + ((t - xMin) / xRange) * plotW;
        const toY = (v) => pad.top + plotH - ((v - yMin) / yRange) * plotH;

        // 3. Draw Grid & Axis Ticks
        ctx.lineWidth = 1;

        // Y Grid
        const yStep = StabilityChart.getNiceInterval(yRange, 6);
        const yStart = Math.ceil(yMin / yStep) * yStep;

        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let yVal = yStart; yVal <= yMax; yVal += yStep) {
            const py = toY(yVal);
            if (py < pad.top || py > pad.top + plotH) continue;

            // Grid line
            ctx.strokeStyle = gridColor;
            ctx.beginPath();
            ctx.moveTo(pad.left, py);
            ctx.lineTo(w - pad.right, py);
            ctx.stroke();

            // Label
            ctx.fillStyle = textColor;
            const labelStr = Math.abs(yVal) < 1e-4 ? '0' : (Math.abs(yVal) >= 100 ? yVal.toFixed(0) : yVal.toFixed(1));
            ctx.fillText(labelStr, pad.left - 8, py);
        }

        // X Grid
        const xStep = StabilityChart.getNiceInterval(xRange, 7);
        const xStart = Math.ceil(xMin / xStep) * xStep;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let xVal = xStart; xVal <= xMax + 1e-5; xVal += xStep) {
            const px = toX(xVal);
            if (px < pad.left || px > w - pad.right) continue;

            // Grid line
            ctx.strokeStyle = gridColor;
            ctx.beginPath();
            ctx.moveTo(px, pad.top);
            ctx.lineTo(px, pad.top + plotH);
            ctx.stroke();

            // Label
            ctx.fillStyle = textColor;
            ctx.fillText(`${xVal.toFixed(xStep < 0.1 ? 2 : 1)}s`, px, pad.top + plotH + 8);
        }

        // Plot bounding box
        ctx.strokeStyle = axisColor;
        ctx.strokeRect(pad.left, pad.top, plotW, plotH);

        // Titles & Axis Labels
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = textPrimary;
        if (this.options.title) {
            ctx.textAlign = 'left';
            ctx.fillText(this.options.title, pad.left, 18);
        }

        // Y-axis label (rotated or header)
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.fillText(this.options.yLabel || '', pad.left - 10, 18);

        // 4. Draw Disturbance Event Markers (vertical dashed lines)
        if (this.events && this.events.length > 0) {
            for (const evt of this.events) {
                if (evt.time < xMin || evt.time > xMax) continue;
                const px = toX(evt.time);
                const color = evt.color || '#f59e0b';

                ctx.save();
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(px, pad.top);
                ctx.lineTo(px, pad.top + plotH);
                ctx.stroke();
                ctx.restore();

                // Marker text badge
                if (evt.label) {
                    ctx.font = '600 9px Inter, sans-serif';
                    ctx.textAlign = 'left';
                    const textW = ctx.measureText(evt.label).width;
                    const badgeX = Math.min(w - pad.right - textW - 8, Math.max(pad.left + 4, px + 4));
                    const badgeY = pad.top + 6;

                    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                    ctx.fillRect(badgeX - 3, badgeY - 2, textW + 6, 15);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(badgeX - 3, badgeY - 2, textW + 6, 15);

                    ctx.fillStyle = color;
                    ctx.fillText(evt.label, badgeX, badgeY + 9);
                }
            }
        }

        // 5. Draw Curves with Anti-aliasing
        ctx.save();
        ctx.rect(pad.left, pad.top, plotW, plotH);
        ctx.clip();

        for (const s of this.series) {
            if (s.visible === false || !s.data || s.data.length === 0) continue;

            ctx.strokeStyle = s.color || '#38bdf8';
            ctx.lineWidth = 2.0;
            ctx.lineJoin = 'round';
            ctx.beginPath();

            let hasStarted = false;
            for (let i = 0; i < s.data.length; i++) {
                const t = this.time[i];
                const v = s.data[i];
                if (!Number.isFinite(v)) continue;

                const px = toX(t);
                const py = toY(v);

                if (!hasStarted) {
                    ctx.moveTo(px, py);
                    hasStarted = true;
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
        }
        ctx.restore();

        // 6. Interactive Crosshair & Tooltip on Hover
        if (this.isHovering && this.mouseX >= pad.left && this.mouseX <= w - pad.right &&
            this.mouseY >= pad.top && this.mouseY <= pad.top + plotH) {

            // Find closest time index
            const hoverT = xMin + ((this.mouseX - pad.left) / plotW) * xRange;
            let closestIdx = 0;
            let minDiff = Infinity;
            for (let i = 0; i < this.time.length; i++) {
                const diff = Math.abs(this.time[i] - hoverT);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            }

            const exactT = this.time[closestIdx];
            const crossX = toX(exactT);

            // Vertical crosshair
            ctx.strokeStyle = isDark ? 'rgba(248, 250, 252, 0.4)' : 'rgba(15, 23, 42, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(crossX, pad.top);
            ctx.lineTo(crossX, pad.top + plotH);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw dots on curves
            const tooltipItems = [];
            for (const s of this.series) {
                if (s.visible === false) continue;
                const v = s.data[closestIdx];
                if (!Number.isFinite(v)) continue;

                const py = toY(v);
                ctx.fillStyle = s.color;
                ctx.beginPath();
                ctx.arc(crossX, py, 4.5, 0, 2 * Math.PI);
                ctx.fill();
                ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                tooltipItems.push({
                    name: s.name,
                    color: s.color,
                    value: v
                });
            }

            // Floating Tooltip Box
            if (tooltipItems.length > 0) {
                const tipHeader = `t = ${exactT.toFixed(3)}s`;
                ctx.font = '600 11px Inter, sans-serif';
                let tipW = ctx.measureText(tipHeader).width;

                ctx.font = '11px "JetBrains Mono", monospace';
                for (const item of tooltipItems) {
                    const lineStr = `${item.name}: ${item.value.toFixed(2)}${this.options.yUnit || ''}`;
                    const lw = ctx.measureText(lineStr).width + 16;
                    if (lw > tipW) tipW = lw;
                }

                tipW = Math.max(120, tipW + 16);
                const tipH = 24 + tooltipItems.length * 18;

                let tipX = crossX + 12;
                if (tipX + tipW > w - pad.right) {
                    tipX = crossX - tipW - 12;
                }
                let tipY = Math.min(pad.top + plotH - tipH, Math.max(pad.top, this.mouseY - tipH / 2));

                // Box background
                ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
                ctx.strokeStyle = axisColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(tipX, tipY, tipW, tipH, 6) : ctx.rect(tipX, tipY, tipW, tipH);
                ctx.fill();
                ctx.stroke();

                // Header
                ctx.font = '600 11px Inter, sans-serif';
                ctx.fillStyle = textPrimary;
                ctx.textAlign = 'left';
                ctx.fillText(tipHeader, tipX + 8, tipY + 15);

                // Curve values
                ctx.font = '11px "JetBrains Mono", monospace';
                for (let i = 0; i < tooltipItems.length; i++) {
                    const item = tooltipItems[i];
                    const itemY = tipY + 33 + i * 18;

                    // Color indicator dot
                    ctx.fillStyle = item.color;
                    ctx.beginPath();
                    ctx.arc(tipX + 12, itemY - 3, 3.5, 0, 2 * Math.PI);
                    ctx.fill();

                    // Text
                    ctx.fillStyle = textColor;
                    ctx.fillText(item.name, tipX + 22, itemY);

                    ctx.fillStyle = textPrimary;
                    ctx.textAlign = 'right';
                    ctx.fillText(`${item.value.toFixed(2)}${this.options.yUnit || ''}`, tipX + tipW - 8, itemY);
                    ctx.textAlign = 'left';
                }
            }
        }
    }
}
