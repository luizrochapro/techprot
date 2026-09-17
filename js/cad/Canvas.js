import { Renderer } from './Renderer.js';
import { Bus } from '../elements/Bus.js';
import { Line } from '../elements/Line.js';
import { Transformer } from '../elements/Transformer.js';
import { Generator } from '../elements/Generator.js';
import { Load } from '../elements/Load.js';
import { Capacitor, Inductor } from '../elements/Shunt.js';
import { TextLabel, LabelDataType } from '../elements/TextLabel.js';
import { Relay } from '../elements/Relay.js';

export class Canvas {
    constructor(canvasElement, model, app) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.model = model;
        this.app = app;
        this.renderer = new Renderer();

        this.camera = {
            x: 100,
            y: 100,
            scale: 1.0
        };

        this.gridSize = 20;
        this.showGrid = true;
        this.snapEnabled = true;

        // Interaction state
        this.activeTool = 'select'; // 'select', 'bus', 'line', 'transformer', 'generator', 'load', 'capacitor', 'inductor'
        this.selectedElements = [];
        this.hoveredElement = null;
        this.hoveredBreaker = null;
        this.isPanning = false;
        this.isDragging = false;
        this.isSelectingBox = false;
        this.dragStart = { x: 0, y: 0 };
        this.selectionBox = { x1: 0, y1: 0, x2: 0, y2: 0 };

        // Touch drag delay: não iniciar arraste até o dedo se mover além do limiar (8px)
        // Impede que o primeiro toque mova o elemento antes do double-tap
        this._dragPending = null; // { startSX, startSY, items: [{el, dx, dy}] }

        // Wiring state
        this.wiringStartBus = null;
        this.wiringCurrentPoint = null;

        // Animação das setas de fluxo (persistida)
        this.animateFlow = localStorage.getItem('techprot_animate_flow') !== '0';
        this._animRAF = null;
        this._windowFocused = true;

        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Pausar animação quando a aba fica oculta ou perde o foco
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._stopFlowAnimation();
            else this.requestRender(); // retoma (o loop reinicia se houver setas)
        });
        window.addEventListener('blur', () => {
            this._windowFocused = false;
            this._stopFlowAnimation();
        });
        window.addEventListener('focus', () => {
            this._windowFocused = true;
            this.requestRender();
        });
    }

    _shouldAnimateFlow() {
        return this.animateFlow &&
               this.renderer.hasAnimatedArrows &&
               !document.hidden &&
               this._windowFocused;
    }

    _startFlowAnimationLoop() {
        if (this._animRAF !== null) return;
        const loop = () => {
            this._animRAF = null;
            if (!this._shouldAnimateFlow()) return;
            this.render(); // render já agenda o próximo frame se ainda houver setas
        };
        this._animRAF = requestAnimationFrame(loop);
    }

    _stopFlowAnimation() {
        if (this._animRAF !== null) {
            cancelAnimationFrame(this._animRAF);
            this._animRAF = null;
        }
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.resetTransform?.();
        this.ctx.scale(dpr, dpr);
        this.requestRender();
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.camera.x) / this.camera.scale,
            y: (sy - this.camera.y) / this.camera.scale
        };
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.camera.scale + this.camera.x,
            y: wy * this.camera.scale + this.camera.y
        };
    }

    snap(val) {
        if (!this.snapEnabled) return val;
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    initEvents() {
        const el = this.canvas;
        // Pointer Events unificam mouse/touch/pen — corrige arraste no celular (t-touch-1)
        this._activePointers = new Map();
        this._pinch = null;
        // Double-tap manual para touch (sem depender de dblclick nativo)
        this._lastTap = 0;
        this._lastTapPos = null;
        this._tapDownPos = null;

        el.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
        window.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
        window.addEventListener('pointerup', (e) => this.onPointerUp(e), { passive: false });
        window.addEventListener('pointercancel', (e) => this.onPointerCancel(e), { passive: false });
        // Fallback mouse para navegadores sem PointerEvent (evita duplo disparo quando PointerEvent existe)
        el.addEventListener('mousedown', (e) => { if (window.PointerEvent) return; this.onMouseDown(e); });
        window.addEventListener('mousemove', (e) => { if (window.PointerEvent) return; this.onMouseMove(e); });
        window.addEventListener('mouseup', (e) => { if (window.PointerEvent) return; this.onMouseUp(e); });
        el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        el.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        el.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    // ——— Pointer helpers (unificam mouse/touch/pen) ———
    _getCanvasScreenPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { sx: e.clientX - rect.left, sy: e.clientY - rect.top, rect };
    }

    _getPinchState() {
        if (this._activePointers.size < 2) return null;
        const pts = [...this._activePointers.values()];
        const p0 = pts[0], p1 = pts[1];
        const dx = p0.x - p1.x, dy = p0.y - p1.y;
        return {
            dist: Math.hypot(dx, dy),
            centerX: (p0.x + p1.x) / 2,
            centerY: (p0.y + p1.y) / 2
        };
    }

    onPointerDown(e) {
        const isTouch = e.pointerType === 'touch';
        this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}

        const count = this._activePointers.size;
        // Double-tap: segundo dedo cancela sequência de taps (gesto multi-toque não é tap)
        if (isTouch && count > 1) {
            this._lastTap = 0;
            this._lastTapPos = null;
        }
        if (isTouch && count === 1) {
            // Guarda posição do down para distinguir tap de arraste/pan
            this._tapDownPos = { x: e.clientX, y: e.clientY };
        }
        if (isTouch && count === 2) {
            const pinchNow = this._getPinchState();
            if (pinchNow) {
                this._pinch = { prevDist: pinchNow.dist, prevCenterX: pinchNow.centerX, prevCenterY: pinchNow.centerY };
            }
            if (this.isDragging || this.isPanning || this.isResizing) {
                this._endDragAndSnap();
                this.isPanning = false;
                this.isResizing = false;
                this.resizeTarget = null;
                this.resizeHandle = null;
            }
            if (this.isSelectingBox) { this.isSelectingBox = false; }
            e.preventDefault();
            return;
        }
        if (isTouch && count > 2) { e.preventDefault(); return; }

        const { sx, sy } = this._getCanvasScreenPos(e);
        const worldPos = this.screenToWorld(sx, sy);
        const pointerType = e.pointerType || 'mouse';

        if (!isTouch) {
            if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
                this.isPanning = true;
                this.dragStart = { x: sx, y: sy };
                this.canvas.style.cursor = 'grab';
                return;
            }
            if (e.button !== 0) return;
        } else {
            e.preventDefault();
        }

        if (this.activeTool !== 'select') {
            this.handleToolClick(worldPos);
            return;
        }

        const breakerHit = this.hitTestBreaker(worldPos.x, worldPos.y);
        if (breakerHit) {
            const el = breakerHit.element;
            const terminal = breakerHit.box.terminal ?? 0;
            if (el.type === 'Line' || el.type === 'Transformer') {
                if (terminal === 0) el.breakerFrom = el.breakerFrom === false ? true : false;
                else el.breakerTo = el.breakerTo === false ? true : false;
            } else {
                el.isOnline = !el.isOnline;
            }
            const isTerminalClosed = (el.type === 'Line' || el.type === 'Transformer')
                ? (terminal === 0 ? el.breakerFrom !== false : el.breakerTo !== false)
                : el.isOnline;
            if (el.results && el.type === 'Line' && !el.isEffectivelyOnline()) {
                el.results.p12 = 0.0; el.results.q12 = 0.0; el.results.p21 = 0.0; el.results.q21 = 0.0;
                el.results.pLoss = 0.0; el.results.qLoss = 0.0; el.results.i12 = 0.0; el.results.i21 = 0.0;
                el.results.direction = 0; el.results.faultFlowKA = 0.0; el.results.faultDirection = 0;
                el.results.faultCurrent12 = [0, 0, 0]; el.results.faultCurrent21 = [0, 0, 0];
            } else if (el.results && el.type === 'Transformer' && !el.isEffectivelyOnline()) {
                el.results.p12 = 0.0; el.results.q12 = 0.0; el.results.p21 = 0.0; el.results.q21 = 0.0;
                el.results.pLoss = 0.0; el.results.qLoss = 0.0; el.results.i12 = 0.0; el.results.i21 = 0.0;
                el.results.faultFlowKA = 0.0; el.results.faultDirection = 0;
                el.results.faultCurrent12 = [0, 0, 0]; el.results.faultCurrent21 = [0, 0, 0];
            } else if (el.results && !el.isOnline) {
                el.results.p12 = 0.0; el.results.q12 = 0.0; el.results.p21 = 0.0; el.results.q21 = 0.0;
                el.results.pLoss = 0.0; el.results.qLoss = 0.0; el.results.i12 = 0.0; el.results.i21 = 0.0;
                el.results.direction = 0; el.results.p = 0.0; el.results.q = 0.0;
            }
            this.model.updateAllLabels();
            this.app.rerunPowerFlowIfNeeded();
            this.requestRender();
            if (this.app.showMessage) {
                const termLabel = terminal === 0 ? 'Primário' : 'Secundário';
                let statusStr;
                if (el.type === 'Line' || el.type === 'Transformer') {
                    if (el.isHalfOpen) statusStr = `DJ ${termLabel}: ABERTO (meia-aberta — um terminal aberto)`;
                    else statusStr = isTerminalClosed ? `DJ ${termLabel}: FECHADO` : `DJ ${termLabel}: ABERTO`;
                } else statusStr = el.isOnline ? 'LIGADO (em operação)' : 'DESLIGADO (fora de operação)';
                this.app.showMessage(`${el.name}: ${statusStr}`);
            }
            return;
        }

        const handleHit = this.hitTestSelectedBusHandles(worldPos.x, worldPos.y, pointerType);
        if (handleHit) {
            this.isResizing = true;
            this.resizeTarget = handleHit.bus;
            this.resizeHandle = handleHit.handle;
            this.canvas.style.cursor = this.getResizeCursor(handleHit.bus);
            if (isTouch) e.preventDefault();
            return;
        }

        const hit = this.hitTest(worldPos.x, worldPos.y);
        if (hit instanceof Relay) {
            if (!this.selectedElements.includes(hit)) {
                this.clearSelection();
                this.selectedElements = [hit];
                hit.selected = true;
            }
            if (isTouch) {
                // Touch: adiar drag até dedo mover além do limiar (8px screen)
                this._dragPending = { startSX: sx, startSY: sy };
            } else {
                this.isDragging = true;
                this.dragStart = { x: worldPos.x, y: worldPos.y };
            }
            if (isTouch) e.preventDefault();
            this.requestRender();
            return;
        }
        if (hit) {
            const modKey = e.shiftKey || e.ctrlKey || e.metaKey;
            if (modKey && !isTouch) {
                const idx = this.selectedElements.indexOf(hit);
                if (idx >= 0) { this.selectedElements.splice(idx, 1); hit.selected = false; }
                else { this.selectedElements.push(hit); hit.selected = true; }
            } else {
                if (!this.selectedElements.includes(hit)) {
                    this.clearSelection();
                    this.selectedElements = [hit];
                    hit.selected = true;
                }
            }
            if (isTouch) {
                // Touch: adiar drag até dedo mover além do limiar
                this._dragPending = { startSX: sx, startSY: sy };
            } else {
                this.isDragging = true;
                this.dragStart = { x: worldPos.x, y: worldPos.y };
            }
            if (isTouch) e.preventDefault();
        } else {
            if (isTouch) {
                this.isPanning = true;
                this.dragStart = { x: sx, y: sy };
                this.canvas.style.cursor = 'grabbing';
            } else {
                if (!e.shiftKey && !e.ctrlKey) this.clearSelection();
                this.isSelectingBox = true;
                this.selectionBox = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y };
            }
        }
        this.requestRender();
    }

    onPointerMove(e) {
        if (this._activePointers.has(e.pointerId)) {
            this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        const isTouch = e.pointerType === 'touch';
        const count = this._activePointers.size;

        if (isTouch && count >= 2) {
            const pinchNow = this._getPinchState();
            if (pinchNow && this._pinch) {
                const prevDist = this._pinch.prevDist;
                const prevCX = this._pinch.prevCenterX;
                const prevCY = this._pinch.prevCenterY;
                const curDist = pinchNow.dist;
                const curCX = pinchNow.centerX;
                const curCY = pinchNow.centerY;
                const rect = this.canvas.getBoundingClientRect();
                const prevCXs = prevCX - rect.left, prevCYs = prevCY - rect.top;
                const curCXs = curCX - rect.left, curCYs = curCY - rect.top;
                const dCX = curCXs - prevCXs, dCY = curCYs - prevCYs;
                if (dCX !== 0 || dCY !== 0) {
                    this.camera.x += dCX;
                    this.camera.y += dCY;
                }
                if (prevDist > 0.5 && curDist > 0.5) {
                    const factor = curDist / prevDist;
                    const oldScale = this.camera.scale;
                    const newScale = Math.max(0.2, Math.min(4.0, oldScale * factor));
                    if (newScale !== oldScale) {
                        this.camera.x = curCXs - (curCXs - this.camera.x) * (newScale / oldScale);
                        this.camera.y = curCYs - (curCYs - this.camera.y) * (newScale / oldScale);
                        this.camera.scale = newScale;
                    }
                }
                this._pinch.prevDist = curDist;
                this._pinch.prevCenterX = curCX;
                this._pinch.prevCenterY = curCY;
                this.requestRender();
            } else if (pinchNow) {
                this._pinch = { prevDist: pinchNow.dist, prevCenterX: pinchNow.centerX, prevCenterY: pinchNow.centerY };
            }
            e.preventDefault();
            return;
        }

        const needsPrevent = this.isDragging || this.isPanning || this.isResizing || this.isSelectingBox || this._pinch || this._dragPending;
        if (isTouch && needsPrevent) e.preventDefault();

        if (!this._activePointers.has(e.pointerId) && isTouch && count === 0) return;
        // Use pointer's screen position when available; fallback to stored map single pointer
        let sx, sy;
        if (typeof e.clientX === 'number') {
            const pos = this._getCanvasScreenPos(e);
            sx = pos.sx; sy = pos.sy;
        } else if (count === 1) {
            const pt = [...this._activePointers.values()][0];
            const rect = this.canvas.getBoundingClientRect();
            sx = pt.x - rect.left; sy = pt.y - rect.top;
        } else return;
        const worldPos = this.screenToWorld(sx, sy);

        if (this.isPanning) {
            this.camera.x += sx - this.dragStart.x;
            this.camera.y += sy - this.dragStart.y;
            this.dragStart = { x: sx, y: sy };
            this.requestRender();
            return;
        }
        if (this.isResizing && this.resizeTarget) {
            const bus = this.resizeTarget;
            const isVertical = (bus.angle === 90 || bus.angle === 270);
            const snappedX = this.snap(worldPos.x);
            const snappedY = this.snap(worldPos.y);
            const wx = isVertical ? bus.x : snappedX;
            const wy = isVertical ? snappedY : bus.y;
            const shift = bus.resizeFromHandle(this.resizeHandle, wx, wy, 40);
            if ((shift.dx !== 0 || shift.dy !== 0) && this.model.textLabels) {
                for (const lbl of this.model.textLabels) {
                    if (lbl.parentElement === bus && !this.selectedElements.includes(lbl)) lbl.move(shift.dx, shift.dy);
                }
            }
            this.updateBusConnections(bus);
            this.requestRender();
            return;
        }
        // Touch drag delay: promover _dragPending → isDragging quando dedo se move além do limiar (8px screen)
        if (this._dragPending && isTouch) {
            const dp = this._dragPending;
            const moveDx = sx - dp.startSX;
            const moveDy = sy - dp.startSY;
            if (Math.hypot(moveDx, moveDy) > 8) {
                // Dedo se-moveu além do limiar → iniciar drag real
                this._dragPending = null;
                this.isDragging = true;
                this.dragStart = { x: worldPos.x, y: worldPos.y };
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
            }
            // Ainda dentro do limiar — não fazer nada (tap aguardando第二个toque)
        }
        if (this.isDragging) {
            const dx = worldPos.x - this.dragStart.x;
            const dy = worldPos.y - this.dragStart.y;
            const busesBeingDraggedDirectly = new Set();
            for (const item of this.selectedElements) if (item instanceof Bus) busesBeingDraggedDirectly.add(item);
            const movedItems = new Set();
            for (const item of this.selectedElements) {
                if (!movedItems.has(item)) { item.move(dx, dy); movedItems.add(item); }
                if (item.type !== 'TextLabel') {
                    for (const lbl of this.model.textLabels) {
                        if (lbl.parentElement === item && !this.selectedElements.includes(lbl) && !movedItems.has(lbl)) { lbl.move(dx, dy); movedItems.add(lbl); }
                    }
                }
            }
            const linesMoved = new Set();
            for (const item of movedItems) if (item instanceof Line) linesMoved.add(item);
            for (const bus of busesBeingDraggedDirectly) {
                for (const line of this.model.lines) {
                    if (!line.pointList || line.pointList.length < 2) continue;
                    const fromMovedRigidly = linesMoved.has(line);
                    if (line.fromBus === bus && !fromMovedRigidly) {
                        const ref = line.toBus || line.pointList[line.pointList.length - 1];
                        line.pointList[0] = bus.getClosestPointOnBar(ref.x, ref.y);
                    }
                    if (line.toBus === bus && !fromMovedRigidly) {
                        const ref = line.fromBus || line.pointList[0];
                        line.pointList[line.pointList.length - 1] = bus.getClosestPointOnBar(ref.x, ref.y);
                    }
                }
            }
            for (const line of linesMoved) {
                if (!line.pointList || line.pointList.length < 2) continue;
                if (line.fromBus && !busesBeingDraggedDirectly.has(line.fromBus)) line.pointList[0] = line.fromBus.getClosestPointOnBar(line.pointList[0].x, line.pointList[0].y);
                if (line.toBus && !busesBeingDraggedDirectly.has(line.toBus)) line.pointList[line.pointList.length - 1] = line.toBus.getClosestPointOnBar(line.pointList[line.pointList.length - 1].x, line.pointList[line.pointList.length - 1].y);
            }
            this.dragStart = { x: worldPos.x, y: worldPos.y };
            this.requestRender();
            return;
        }
        if (this.isSelectingBox) {
            this.selectionBox.x2 = worldPos.x;
            this.selectionBox.y2 = worldPos.y;
            this.requestRender();
            return;
        }
        if (this.wiringStartBus) { this.wiringCurrentPoint = worldPos; this.requestRender(); return; }
        if (this.activeTool === 'select') {
            const handleHit = this.hitTestSelectedBusHandles(worldPos.x, worldPos.y, e.pointerType || 'mouse');
            if (handleHit) {
                const cursor = this.getResizeCursor(handleHit.bus);
                if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;
                return;
            }
            if (this.canvas.style.cursor === 'ew-resize' || this.canvas.style.cursor === 'ns-resize') this.canvas.style.cursor = 'default';
        }
        const breakerHit = this.hitTestBreaker(worldPos.x, worldPos.y);
        if (breakerHit) {
            if (this.hoveredBreaker?.box !== breakerHit.box) {
                this.hoveredBreaker = breakerHit;
                this.canvas.style.cursor = 'pointer';
                const el = breakerHit.element;
                const terminal = breakerHit.box.terminal ?? 0;
                let st;
                if (el.type === 'Line' || el.type === 'Transformer') {
                    const termOnline = el.isTerminalOnline ? el.isTerminalOnline(terminal) : el.isOnline;
                    st = termOnline ? 'Fechado (Ligado)' : 'Aberto (Desligado)';
                    const termLabel = terminal === 0 ? 'Primário' : 'Secundário';
                    this.canvas.title = `Disjuntor ${termLabel} (${el.name}): ${st} - Clique para alternar`;
                } else { st = el.isOnline ? 'Fechado (Ligado)' : 'Aberto (Desligado)'; this.canvas.title = `Disjuntor (${el.name}): ${st} - Clique para alternar`; }
                this.requestRender();
            }
            return;
        } else if (this.hoveredBreaker) { this.hoveredBreaker = null; this.canvas.title = ''; this.requestRender(); }
        const hit = this.hitTest(worldPos.x, worldPos.y);
        if (this.hoveredElement !== hit) {
            if (this.hoveredElement) this.hoveredElement.hovered = false;
            this.hoveredElement = hit;
            if (this.hoveredElement) this.hoveredElement.hovered = true;
            this.canvas.style.cursor = hit ? 'pointer' : (this.activeTool === 'select' ? 'default' : 'crosshair');
            this.requestRender();
        }
    }

    _endDragAndSnap() {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.snapEnabled) {
            const labelShifts = new Map();
            const snappedBuses = [];
            for (const item of this.selectedElements) {
                if (item.type !== 'TextLabel') {
                    const oldX = item.x, oldY = item.y;
                    item.snapToGrid(this.gridSize);
                    const shiftX = item.x - oldX, shiftY = item.y - oldY;
                    if (shiftX !== 0 || shiftY !== 0) { labelShifts.set(item, { shiftX, shiftY }); if (item instanceof Bus) snappedBuses.push(item); }
                } else { const fineGrid = Math.min(this.gridSize, 5); item.snapToGrid(fineGrid); }
            }
            for (const [parentEl, shift] of labelShifts.entries()) {
                for (const lbl of this.model.textLabels) if (lbl.parentElement === parentEl && !this.selectedElements.includes(lbl)) lbl.move(shift.shiftX, shift.shiftY);
            }
            const selectedSet = new Set(this.selectedElements);
            for (const bus of snappedBuses) {
                for (const line of this.model.lines) {
                    if (!line.pointList || line.pointList.length < 2) continue;
                    const lineAlsoSnapped = selectedSet.has(line);
                    if (line.fromBus === bus && !lineAlsoSnapped) { const ref = line.toBus || line.pointList[line.pointList.length - 1]; line.pointList[0] = bus.getClosestPointOnBar(ref.x, ref.y); }
                    if (line.toBus === bus && !lineAlsoSnapped) { const ref = line.fromBus || line.pointList[0]; line.pointList[line.pointList.length - 1] = bus.getClosestPointOnBar(ref.x, ref.y); }
                }
            }
            for (const line of this.model.lines) {
                if (!selectedSet.has(line)) continue;
                if (!line.pointList || line.pointList.length < 2) continue;
                if (line.fromBus && !selectedSet.has(line.fromBus)) { const ref = line.toBus || line.pointList[line.pointList.length - 1]; line.pointList[0] = line.fromBus.getClosestPointOnBar(ref.x, ref.y); }
                if (line.toBus && !selectedSet.has(line.toBus)) { const ref = line.fromBus || line.pointList[0]; line.pointList[line.pointList.length - 1] = line.toBus.getClosestPointOnBar(ref.x, ref.y); }
            }
        }
        this.requestRender();
    }

    onPointerUp(e) {
        const wasTouch = e.pointerType === 'touch';
        const wasPinch = !!this._pinch;
        this._activePointers.delete(e.pointerId);
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        if (wasTouch && this._activePointers.size >= 2) {
            const pinchNow = this._getPinchState();
            if (pinchNow) this._pinch = { prevDist: pinchNow.dist, prevCenterX: pinchNow.centerX, prevCenterY: pinchNow.centerY };
            return;
        }
        if (wasTouch && this._pinch && this._activePointers.size < 2) this._pinch = null;
        // Se terminou um gesto de pinch, descarta sequência de tap e não avalia double-tap
        const endedPinch = wasTouch && wasPinch;
        if (endedPinch) {
            this._lastTap = 0;
            this._lastTapPos = null;
            this._tapDownPos = null;
        }
        if (this.isPanning) { this.isPanning = false; this.canvas.style.cursor = 'default'; }
        if (this.isResizing) { this.isResizing = false; this.resizeTarget = null; this.resizeHandle = null; this.canvas.style.cursor = 'default'; this.requestRender(); }
        if (this.isDragging) this._endDragAndSnap();
        // Touch: dedo levantou sem mover além do limiar → era um tap, não drag
        if (wasTouch && this._dragPending) { this._dragPending = null; }
        if (this.isSelectingBox) {
            this.isSelectingBox = false;
            this.isResizing = false;
            this.resizeTarget = null;
            this.resizeHandle = null;
            const sb = this.selectionBox;
            const minX = Math.min(sb.x1, sb.x2), maxX = Math.max(sb.x1, sb.x2), minY = Math.min(sb.y1, sb.y2), maxY = Math.max(sb.y1, sb.y2);
            const all = [...this.model.getAllElements(), ...this.model.textLabels];
            for (const item of all) if (item.intersectsBox(minX, minY, maxX, maxY)) if (!this.selectedElements.includes(item)) { this.selectedElements.push(item); item.selected = true; }
            this.requestRender();
        }

        // ——— Detecção manual de double-tap para touch (sem depender de dblclick nativo) ———
        if (wasTouch && !endedPinch && this._activePointers.size === 0 && this.activeTool === 'select' && this._tapDownPos) {
            const TAP_MOVE_MAX = 15; // px: movimento máximo dentro de um tap (ampliado para touch)
            const DOUBLE_TAP_DIST = 30; // px: distância máxima entre dois taps
            const DOUBLE_TAP_TIME = 500; // ms (ampliado para dedos mais lentos)
            const dxMove = e.clientX - this._tapDownPos.x;
            const dyMove = e.clientY - this._tapDownPos.y;
            const moveDist = Math.hypot(dxMove, dyMove);
            const isTap = moveDist <= TAP_MOVE_MAX;
            if (isTap) {
                const now = Date.now();
                if (this._lastTapPos) {
                    const dxTap = e.clientX - this._lastTapPos.x;
                    const dyTap = e.clientY - this._lastTapPos.y;
                    const tapDist = Math.hypot(dxTap, dyTap);
                    const dt = now - this._lastTap;
                    if (tapDist < DOUBLE_TAP_DIST && dt < DOUBLE_TAP_TIME) {
                        // Double-tap detectado → dispara mesma ação do dblclick nativo
                        this._lastTap = 0;
                        this._lastTapPos = null;
                        this._tapDownPos = null;
                        this.onDoubleClick({ clientX: e.clientX, clientY: e.clientY });
                        return;
                    }
                }
                this._lastTap = now;
                this._lastTapPos = { x: e.clientX, y: e.clientY };
            } else {
                // Movimento grande (pan/drag/box) quebra sequência de double-tap
                this._lastTap = 0;
                this._lastTapPos = null;
            }
            this._tapDownPos = null;
        } else if (wasTouch && this._activePointers.size === 0) {
            // Levantou dedo mas não foi tap válido (ex: pinch, pan longo) → limpa referência de down
            this._tapDownPos = null;
        }
    }

    onPointerCancel(e) { this._activePointers.delete(e.pointerId); if (this._activePointers.size < 2) this._pinch = null; this.isDragging = false; this.isPanning = false; this.isResizing = false; this.isSelectingBox = false; this.resizeTarget = null; this.resizeHandle = null; this.canvas.style.cursor = 'default'; try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {} }

    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'r' || e.key === 'R') {
            if (this.selectedElements.length > 0) {
                e.preventDefault();
                for (const item of this.selectedElements) {
                    item.rotate();
                }
                this.requestRender();
                if (this.app.showMessage) {
                    this.app.showMessage('Elemento(s) rotacionado(s) 90°');
                }
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedElements.length > 0) {
                e.preventDefault();
                this.deleteSelected();
            }
        }
    }

    hitTestBreaker(wx, wy) {
        const elements = [...this.model.lines, ...this.model.transformers, ...this.model.generators, ...this.model.loads];
        const pad = 4;
        for (const el of elements) {
            if (typeof el.getSwitchBoxes === 'function') {
                const boxes = el.getSwitchBoxes();
                for (const box of boxes) {
                    if (wx >= box.x - pad && wx <= box.x + box.width + pad &&
                        wy >= box.y - pad && wy <= box.y + box.height + pad) {
                        return { element: el, box };
                    }
                }
            }
        }
        return null;
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const worldPos = this.screenToWorld(sx, sy);

        // Middle click or Space + Left click -> Pan
        if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
            this.isPanning = true;
            this.dragStart = { x: sx, y: sy };
            this.canvas.style.cursor = 'grab';
            return;
        }

        if (e.button === 0) { // Left click
            // Tool insertion check
            if (this.activeTool !== 'select') {
                this.handleToolClick(worldPos);
                return;
            }

            // Check click on breaker switch first
            const breakerHit = this.hitTestBreaker(worldPos.x, worldPos.y);
            if (breakerHit) {
                const el = breakerHit.element;
                const terminal = breakerHit.box.terminal ?? 0;

                // Per-terminal breaker toggle for Line and Transformer
                if (el.type === 'Line' || el.type === 'Transformer') {
                    if (terminal === 0) {
                        el.breakerFrom = el.breakerFrom === false ? true : false;
                    } else {
                        el.breakerTo = el.breakerTo === false ? true : false;
                    }
                } else {
                    // Generator, Load, etc. — master switch only
                    el.isOnline = !el.isOnline;
                }

                const isTerminalClosed = (el.type === 'Line' || el.type === 'Transformer')
                    ? (terminal === 0 ? el.breakerFrom !== false : el.breakerTo !== false)
                    : el.isOnline;

                // Clear results if the line/transformer is no longer effectively online
                if (el.results && el.type === 'Line' && !el.isEffectivelyOnline()) {
                    el.results.p12 = 0.0;
                    el.results.q12 = 0.0;
                    el.results.p21 = 0.0;
                    el.results.q21 = 0.0;
                    el.results.pLoss = 0.0;
                    el.results.qLoss = 0.0;
                    el.results.i12 = 0.0;
                    el.results.i21 = 0.0;
                    el.results.direction = 0;
                    el.results.faultFlowKA = 0.0;
                    el.results.faultDirection = 0;
                    el.results.faultCurrent12 = [0, 0, 0];
                    el.results.faultCurrent21 = [0, 0, 0];
                } else if (el.results && el.type === 'Transformer' && !el.isEffectivelyOnline()) {
                    el.results.p12 = 0.0;
                    el.results.q12 = 0.0;
                    el.results.p21 = 0.0;
                    el.results.q21 = 0.0;
                    el.results.pLoss = 0.0;
                    el.results.qLoss = 0.0;
                    el.results.i12 = 0.0;
                    el.results.i21 = 0.0;
                    el.results.faultFlowKA = 0.0;
                    el.results.faultDirection = 0;
                    el.results.faultCurrent12 = [0, 0, 0];
                    el.results.faultCurrent21 = [0, 0, 0];
                } else if (el.results && !el.isOnline) {
                    el.results.p12 = 0.0;
                    el.results.q12 = 0.0;
                    el.results.p21 = 0.0;
                    el.results.q21 = 0.0;
                    el.results.pLoss = 0.0;
                    el.results.qLoss = 0.0;
                    el.results.i12 = 0.0;
                    el.results.i21 = 0.0;
                    el.results.direction = 0;
                    el.results.p = 0.0;
                    el.results.q = 0.0;
                }

                this.model.updateAllLabels();
                // Se já havia solução anterior, roda o fluxo de novo com a nova topologia
                this.app.rerunPowerFlowIfNeeded();
                this.requestRender();
                if (this.app.showMessage) {
                    const termLabel = terminal === 0 ? 'Primário' : 'Secundário';
                    let statusStr;
                    if (el.type === 'Line' || el.type === 'Transformer') {
                        const effOnline = typeof el.isEffectivelyOnline === 'function' ? el.isEffectivelyOnline() : el.isOnline;
                        if (el.isHalfOpen) {
                            statusStr = `DJ ${termLabel}: ABERTO (meia-aberta — um terminal aberto)`;
                        } else {
                            statusStr = isTerminalClosed ? `DJ ${termLabel}: FECHADO` : `DJ ${termLabel}: ABERTO`;
                        }
                    } else {
                        statusStr = el.isOnline ? 'LIGADO (em operação)' : 'DESLIGADO (fora de operação)';
                    }
                    this.app.showMessage(`${el.name}: ${statusStr}`);
                }
                return;
            }

            // Check resize handles on selected buses (priority over dragging)
            const handleHit = this.hitTestSelectedBusHandles(worldPos.x, worldPos.y);
            if (handleHit) {
                this.isResizing = true;
                this.resizeTarget = handleHit.bus;
                this.resizeHandle = handleHit.handle;
                this.canvas.style.cursor = this.getResizeCursor(handleHit.bus);
                return;
            }

            const hit = this.hitTest(worldPos.x, worldPos.y);

            // Click on a relay circle: just select for drag; double-click (handled
            // in onDoubleClick) opens relay + CT settings dialog.
            if (hit instanceof Relay) {
                if (!this.selectedElements.includes(hit)) {
                    this.clearSelection();
                    this.selectedElements = [hit];
                    hit.selected = true;
                }
                this.isDragging = true;
                this.dragStart = { x: worldPos.x, y: worldPos.y };
                this.requestRender();
                return;
            }

            if (hit) {
                if (e.shiftKey || e.ctrlKey) {
                    // Toggle selection
                    const idx = this.selectedElements.indexOf(hit);
                    if (idx >= 0) {
                        this.selectedElements.splice(idx, 1);
                        hit.selected = false;
                    } else {
                        this.selectedElements.push(hit);
                        hit.selected = true;
                    }
                } else {
                    if (!this.selectedElements.includes(hit)) {
                        this.clearSelection();
                        this.selectedElements = [hit];
                        hit.selected = true;
                    }
                }
                this.isDragging = true;
                this.dragStart = { x: worldPos.x, y: worldPos.y };
            } else {
                // Clicked on empty space -> start selection box
                if (!e.shiftKey && !e.ctrlKey) {
                    this.clearSelection();
                }
                this.isSelectingBox = true;
                this.selectionBox = { x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y };
            }
            this.requestRender();
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const worldPos = this.screenToWorld(sx, sy);

        if (this.isPanning) {
            this.camera.x += sx - this.dragStart.x;
            this.camera.y += sy - this.dragStart.y;
            this.dragStart = { x: sx, y: sy };
            this.requestRender();
            return;
        }

        if (this.isResizing && this.resizeTarget) {
            const bus = this.resizeTarget;
            const isVertical = (bus.angle === 90 || bus.angle === 270);

            // Project cursor on the bar axis and snap to grid
            const snappedX = this.snap(worldPos.x);
            const snappedY = this.snap(worldPos.y);
            const wx = isVertical ? bus.x : snappedX;
            const wy = isVertical ? snappedY : bus.y;

            const shift = bus.resizeFromHandle(this.resizeHandle, wx, wy, 40);

            // Keep attached labels at the same relative offset to the bus center
            if ((shift.dx !== 0 || shift.dy !== 0) && this.model.textLabels) {
                for (const lbl of this.model.textLabels) {
                    if (lbl.parentElement === bus && !this.selectedElements.includes(lbl)) {
                        lbl.move(shift.dx, shift.dy);
                    }
                }
            }

            this.updateBusConnections(bus);
            this.requestRender();
            return;
        }

        if (this.isDragging) {
            const dx = worldPos.x - this.dragStart.x;
            const dy = worldPos.y - this.dragStart.y;

            // Build set of buses that WILL move directly (selected) so we know
            // which lines SHOULD NOT be re-anchored to them (they move rigidly).
            const busesBeingDraggedDirectly = new Set();
            for (const item of this.selectedElements) {
                if (item instanceof Bus) busesBeingDraggedDirectly.add(item);
            }

            const movedItems = new Set();

            for (const item of this.selectedElements) {
                if (!movedItems.has(item)) {
                    item.move(dx, dy);
                    movedItems.add(item);
                }

                // If this element has child/attached text labels, move them along so they maintain relative position
                if (item.type !== 'TextLabel') {
                    for (const lbl of this.model.textLabels) {
                        if (lbl.parentElement === item && !this.selectedElements.includes(lbl) && !movedItems.has(lbl)) {
                            lbl.move(dx, dy);
                            movedItems.add(lbl);
                        }
                    }
                }
            }

            // Re-anchor line endpoints onto moved buses so connection pins
            // follow the bars. Skip a bus if the line itself is also moving
            // rigidly along (both bus and line selected), because its endpoints
            // already shifted by (dx, dy).
            const linesMoved = new Set();
            for (const item of movedItems) if (item instanceof Line) linesMoved.add(item);

            for (const bus of busesBeingDraggedDirectly) {
                for (const line of this.model.lines) {
                    if (!line.pointList || line.pointList.length < 2) continue;
                    const fromMovedRigidly = linesMoved.has(line);
                    // Re-anchor endpoints where this bus is parent AND the line
                    // is not rigidly translating with it.
                    if (line.fromBus === bus && !fromMovedRigidly) {
                        const ref = line.toBus || line.pointList[line.pointList.length - 1];
                        line.pointList[0] = bus.getClosestPointOnBar(ref.x, ref.y);
                    }
                    if (line.toBus === bus && !fromMovedRigidly) {
                        const ref = line.fromBus || line.pointList[0];
                        line.pointList[line.pointList.length - 1] = bus.getClosestPointOnBar(ref.x, ref.y);
                    }
                }
            }

            // If a line body is being dragged without one of its parent buses,
            // keep that terminal pinned to the bus (line stretches, doesn't detach).
            for (const line of linesMoved) {
                if (!line.pointList || line.pointList.length < 2) continue;
                if (line.fromBus && !busesBeingDraggedDirectly.has(line.fromBus))
                    line.pointList[0] = line.fromBus.getClosestPointOnBar(line.pointList[0].x, line.pointList[0].y);
                if (line.toBus && !busesBeingDraggedDirectly.has(line.toBus))
                    line.pointList[line.pointList.length - 1] = line.toBus.getClosestPointOnBar(line.pointList[line.pointList.length - 1].x, line.pointList[line.pointList.length - 1].y);
            }

            this.dragStart = { x: worldPos.x, y: worldPos.y };
            this.requestRender();
            return;
        }

        if (this.isSelectingBox) {
            this.selectionBox.x2 = worldPos.x;
            this.selectionBox.y2 = worldPos.y;
            this.requestRender();
            return;
        }

        if (this.wiringStartBus) {
            this.wiringCurrentPoint = worldPos;
            this.requestRender();
            return;
        }

        // Resize handle hover test (cursor feedback)
        if (this.activeTool === 'select') {
            const handleHit = this.hitTestSelectedBusHandles(worldPos.x, worldPos.y);
            if (handleHit) {
                const cursor = this.getResizeCursor(handleHit.bus);
                if (this.canvas.style.cursor !== cursor) {
                    this.canvas.style.cursor = cursor;
                }
                return;
            }
            // Leaving a handle: reset cursor if it was a resize cursor
            if (this.canvas.style.cursor === 'ew-resize' || this.canvas.style.cursor === 'ns-resize') {
                this.canvas.style.cursor = 'default';
            }
        }

        // Breaker hover test
        const breakerHit = this.hitTestBreaker(worldPos.x, worldPos.y);
        if (breakerHit) {
            if (this.hoveredBreaker?.box !== breakerHit.box) {
                this.hoveredBreaker = breakerHit;
                this.canvas.style.cursor = 'pointer';
                const el = breakerHit.element;
                const terminal = breakerHit.box.terminal ?? 0;
                let st;
                if (el.type === 'Line' || el.type === 'Transformer') {
                    const termOnline = el.isTerminalOnline ? el.isTerminalOnline(terminal) : el.isOnline;
                    st = termOnline ? 'Fechado (Ligado)' : 'Aberto (Desligado)';
                    const termLabel = terminal === 0 ? 'Primário' : 'Secundário';
                    this.canvas.title = `Disjuntor ${termLabel} (${el.name}): ${st} - Clique para alternar`;
                } else {
                    st = el.isOnline ? 'Fechado (Ligado)' : 'Aberto (Desligado)';
                    this.canvas.title = `Disjuntor (${el.name}): ${st} - Clique para alternar`;
                }
                this.requestRender();
            }
            return;
        } else if (this.hoveredBreaker) {
            this.hoveredBreaker = null;
            this.canvas.title = '';
            this.requestRender();
        }

        // Element hover test
        const hit = this.hitTest(worldPos.x, worldPos.y);
        if (this.hoveredElement !== hit) {
            if (this.hoveredElement) this.hoveredElement.hovered = false;
            this.hoveredElement = hit;
            if (this.hoveredElement) this.hoveredElement.hovered = true;
            this.canvas.style.cursor = hit ? 'pointer' : (this.activeTool === 'select' ? 'default' : 'crosshair');
            this.requestRender();
        }
    }

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeTarget = null;
            this.resizeHandle = null;
            this.canvas.style.cursor = 'default';
            this.requestRender();
        }

        if (this.isDragging) {
            this.isDragging = false;
            // Snap dragged elements to grid
            if (this.snapEnabled) {
                const labelShifts = new Map();
                const snappedBuses = [];

                for (const item of this.selectedElements) {
                    if (item.type !== 'TextLabel') {
                        const oldX = item.x;
                        const oldY = item.y;
                        item.snapToGrid(this.gridSize);
                        const shiftX = item.x - oldX;
                        const shiftY = item.y - oldY;
                        if (shiftX !== 0 || shiftY !== 0) {
                            labelShifts.set(item, { shiftX, shiftY });
                            if (item instanceof Bus) snappedBuses.push(item);
                        }
                    } else {
                        // Fine 5px snap for standalone dragged labels
                        const fineGrid = Math.min(this.gridSize, 5);
                        item.snapToGrid(fineGrid);
                    }
                }

                // Apply snapping shifts to attached labels to strictly preserve relative placement
                for (const [parentEl, shift] of labelShifts.entries()) {
                    for (const lbl of this.model.textLabels) {
                        if (lbl.parentElement === parentEl && !this.selectedElements.includes(lbl)) {
                            lbl.move(shift.shiftX, shift.shiftY);
                        }
                    }
                }

                // After snapping, re-anchor connected line endpoints onto buses
                // so they follow the bus to its final snapped location.
                const selectedSet = new Set(this.selectedElements);
                for (const bus of snappedBuses) {
                    for (const line of this.model.lines) {
                        if (!line.pointList || line.pointList.length < 2) continue;
                        const lineAlsoSnapped = selectedSet.has(line);
                        if (line.fromBus === bus && !lineAlsoSnapped) {
                            const ref = line.toBus || line.pointList[line.pointList.length - 1];
                            line.pointList[0] = bus.getClosestPointOnBar(ref.x, ref.y);
                        }
                        if (line.toBus === bus && !lineAlsoSnapped) {
                            const ref = line.fromBus || line.pointList[0];
                            line.pointList[line.pointList.length - 1] = bus.getClosestPointOnBar(ref.x, ref.y);
                        }
                    }
                }

                // If a line was dragged alone (without its buses), re-anchor its
                // terminal points back onto their parent buses so the connection
                // pins follow the bus rather than drifting away.
                for (const line of this.model.lines) {
                    if (!selectedSet.has(line)) continue;
                    if (!line.pointList || line.pointList.length < 2) continue;
                    if (line.fromBus && !selectedSet.has(line.fromBus)) {
                        const ref = line.toBus || line.pointList[line.pointList.length - 1];
                        line.pointList[0] = line.fromBus.getClosestPointOnBar(ref.x, ref.y);
                    }
                    if (line.toBus && !selectedSet.has(line.toBus)) {
                        const ref = line.fromBus || line.pointList[0];
                        line.pointList[line.pointList.length - 1] = line.toBus.getClosestPointOnBar(ref.x, ref.y);
                    }
                }
            }
            this.requestRender();
        }

        if (this.isSelectingBox) {
        this.isSelectingBox = false;
        this.isResizing = false;
        this.resizeTarget = null;   // Bus being resized
        this.resizeHandle = null;   // 'start' | 'end'
            const sb = this.selectionBox;
            const minX = Math.min(sb.x1, sb.x2);
            const maxX = Math.max(sb.x1, sb.x2);
            const minY = Math.min(sb.y1, sb.y2);
            const maxY = Math.max(sb.y1, sb.y2);

            // Select elements inside box
            const all = [...this.model.getAllElements(), ...this.model.textLabels];
            for (const item of all) {
                if (item.intersectsBox(minX, minY, maxX, maxY)) {
                    if (!this.selectedElements.includes(item)) {
                        this.selectedElements.push(item);
                        item.selected = true;
                    }
                }
            }
            this.requestRender();
        }
    }

    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newScale = Math.max(0.2, Math.min(4.0, this.camera.scale * zoomFactor));

        // Zoom toward mouse position
        this.camera.x = mouseX - (mouseX - this.camera.x) * (newScale / this.camera.scale);
        this.camera.y = mouseY - (mouseY - this.camera.y) * (newScale / this.camera.scale);
        this.camera.scale = newScale;

        this.requestRender();
    }

    onDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const hit = this.hitTest(worldPos.x, worldPos.y);
        if (hit && this.app.showElementDialog) {
            this.app.showElementDialog(hit);
        }
    }

    onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const worldPos = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const hit = this.hitTest(worldPos.x, worldPos.y);

        // Ctrl + botão direito na barra: popup dedicado de curto na barra
        if (e.ctrlKey && hit && hit.type === 'Bus' && this.app.showShortCircuitDialog) {
            this.app.showShortCircuitDialog(hit);
            return;
        }

        // Ctrl + botão direito na LINHA: popup dedicado de curto no meio da linha
        if (e.ctrlKey && hit && hit.type === 'Line' && this.app.showLineFaultDialog) {
            this.app.showLineFaultDialog(hit);
            return;
        }

        if (hit && this.app.showContextMenu) {
            this.app.showContextMenu(e.clientX, e.clientY, hit);
        }
    }

    handleToolClick(worldPos) {
        const snappedX = this.snap(worldPos.x);
        const snappedY = this.snap(worldPos.y);

        if (this.activeTool === 'bus') {
            const bus = new Bus(snappedX, snappedY, `Bus_${this.model.buses.length + 1}`);
            this.model.addBus(bus);
            const lbl = new TextLabel(bus, LabelDataType.DATA_NAME, bus.x, bus.y - 18);
            this.model.addTextLabel(lbl);
            this.setActiveTool('select');
        } else if (this.activeTool === 'line') {
            const hitBus = this.hitTestBus(worldPos.x, worldPos.y);
            if (!this.wiringStartBus) {
                if (hitBus) {
                    this.wiringStartBus = hitBus;
                }
            } else {
                if (hitBus && hitBus !== this.wiringStartBus) {
                    const line = new Line(this.wiringStartBus, hitBus, `Line_${this.model.lines.length + 1}`);
                    const p1 = this.wiringStartBus.getClosestPointOnBar(snappedX, snappedY);
                    const p2 = hitBus.getClosestPointOnBar(snappedX, snappedY);
                    line.pointList = [p1, p2];
                    this.model.addLine(line);
                    this.wiringStartBus = null;
                    this.wiringCurrentPoint = null;
                    this.setActiveTool('select');
                }
            }
        } else if (this.activeTool === 'transformer') {
            const hitBus = this.hitTestBus(worldPos.x, worldPos.y);
            if (!this.wiringStartBus) {
                if (hitBus) {
                    this.wiringStartBus = hitBus;
                }
            } else {
                if (hitBus && hitBus !== this.wiringStartBus) {
                    const midX = (this.wiringStartBus.x + hitBus.x) / 2;
                    const midY = (this.wiringStartBus.y + hitBus.y) / 2;
                    const transf = new Transformer(this.wiringStartBus, hitBus, midX, midY, `T_${this.model.transformers.length + 1}`);
                    this.model.addTransformer(transf);
                    this.wiringStartBus = null;
                    this.wiringCurrentPoint = null;
                    this.setActiveTool('select');
                }
            }
        } else if (this.activeTool === 'generator') {
            const hitBus = this.hitTestBus(worldPos.x, worldPos.y);
            const gen = new Generator(hitBus, snappedX, snappedY, `Gen_${this.model.generators.length + 1}`);
            this.model.addGenerator(gen);
            this.setActiveTool('select');
        } else if (this.activeTool === 'load') {
            const hitBus = this.hitTestBus(worldPos.x, worldPos.y);
            const ld = new Load(hitBus, snappedX, snappedY, `Load_${this.model.loads.length + 1}`);
            this.model.addLoad(ld);
            this.setActiveTool('select');
        } else if (this.activeTool === 'capacitor') {
            const hitBus = this.hitTestBus(worldPos.x, worldPos.y);
            const cap = new Capacitor(hitBus, snappedX, snappedY, `Cap_${this.model.capacitors.length + 1}`);
            this.model.addCapacitor(cap);
            this.setActiveTool('select');
        } else if (this.activeTool === 'inductor') {
            const hitBus = this.hitTestBus(worldPos.x, worldPos.y);
            const ind = new Inductor(hitBus, snappedX, snappedY, `Ind_${this.model.inductors.length + 1}`);
            this.model.addInductor(ind);
            this.setActiveTool('select');
        } else if (this.activeTool === 'relay') {
            // Relé de proteção: deve ser solto sobre um DISJUNTOR de linha/trafo/gerador/carga,
            // ficando à direita do disjuntor (TC + círculo do relé).
            const breakerHit = this.hitTestBreaker(worldPos.x, worldPos.y);
            if (!breakerHit) {
                if (this.app.showMessage) {
                    this.app.showMessage('Relé: clique sobre um DISJUNTOR (quadrado verde/vermelho) de uma linha, trafo, gerador ou carga.');
                }
                return;
            }
            const parent = breakerHit.element;
            const terminal = breakerHit.box.terminal ?? 0;

            // Avoid duplicate relay on the same breaker
            const exists = (this.model.relays || []).some(r => r.parentElement === parent && r.terminal === terminal);
            if (exists) {
                if (this.app.showMessage) {
                    this.app.showMessage(`${parent.name}: já existe um relé neste disjuntor. Clique no círculo do relé para editar os ajustes.`);
                }
                return;
            }

            const relay = new Relay(parent, terminal, `Relay_${(this.model.relays?.length || 0) + 1}`);
            this.model.addRelay(relay);
            this.clearSelection();
            this.selectedElements = [relay];
            relay.selected = true;
            if (this.app.showMessage) {
                this.app.showMessage(`${relay.name} (50/51 e 50N/51N) associado ao disjuntor de ${parent.name}. Clique no círculo para ajustar.`);
            }
            this.setActiveTool('select');
        }

        this.requestRender();
    }

    setActiveTool(tool) {
        this.activeTool = tool;
        this.wiringStartBus = null;
        this.wiringCurrentPoint = null;
        this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
        if (this.app.onToolChanged) this.app.onToolChanged(tool);
    }

    hitTest(wx, wy) {
        // Test labels first (highest z-index)
        for (let i = this.model.textLabels.length - 1; i >= 0; i--) {
            const lbl = this.model.textLabels[i];
            if (lbl.containsPoint(wx, wy)) return lbl;
        }

        // Test non-line elements
        const elements = this.model.getAllElements();
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (!(el instanceof Line) && el.containsPoint(wx, wy)) return el;
        }

        // Test lines
        for (const line of this.model.lines) {
            if (line.containsPoint(wx, wy)) return line;
        }

        return null;
    }

    hitTestBus(wx, wy) {
        for (const bus of this.model.buses) {
            if (bus.containsPoint(wx, wy)) return bus;
        }
        return null;
    }

    /**
     * Hit-tests resize handles of any currently selected bus.
     * Returns { bus, handle } or null. Touch uses expanded hit area (>=24px screen per skill 2.2).
     */
    hitTestSelectedBusHandles(wx, wy, pointerType = 'mouse') {
        if (this.activeTool !== 'select') return null;
        const isTouch = pointerType === 'touch';
        const tol = isTouch ? (24 / Math.max(0.2, this.camera.scale)) : 6;
        for (const item of this.selectedElements) {
            if (item instanceof Bus && typeof item.hitTestHandle === 'function') {
                const handle = item.hitTestHandle(wx, wy, tol);
                if (handle) return { bus: item, handle };
            }
        }
        return null;
    }

    getResizeCursor(bus) {
        return (bus.angle === 90 || bus.angle === 270) ? 'ns-resize' : 'ew-resize';
    }

    /**
     * Re-anchors line endpoints onto a resized bus so connections
     * remain attached to the bar after its extremities moved.
     */
    updateBusConnections(bus) {
        for (const line of this.model.lines) {
            if (!line.pointList || line.pointList.length < 2) continue;
            if (line.fromBus === bus) {
                const ref = line.toBus || line.pointList[line.pointList.length - 1];
                line.pointList[0] = bus.getClosestPointOnBar(ref.x, ref.y);
            }
            if (line.toBus === bus) {
                const ref = line.fromBus || line.pointList[0];
                line.pointList[line.pointList.length - 1] = bus.getClosestPointOnBar(ref.x, ref.y);
            }
        }
    }

    clearSelection() {
        for (const item of this.selectedElements) {
            item.selected = false;
        }
        this.selectedElements = [];
    }

    alignSelectedToGrid() {
        this.model.snapAllToGrid(this.gridSize);
        this.requestRender();
    }

    deleteSelected() {
        for (const item of this.selectedElements) {
            this.model.removeElement(item);
        }
        this.selectedElements = [];
        this.requestRender();
    }

    fitToScreen() {
        const elements = this.model.getAllElements();
        if (elements.length === 0) {
            this.camera = { x: 100, y: 100, scale: 1.0 };
            this.requestRender();
            return;
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const el of elements) {
            const b = el.getBounds();
            minX = Math.min(minX, b.x);
            maxX = Math.max(maxX, b.x + b.width);
            minY = Math.min(minY, b.y);
            maxY = Math.max(maxY, b.y + b.height);
        }

        const padding = 60;
        const w = maxX - minX + padding * 2;
        const h = maxY - minY + padding * 2;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / w;
        const scaleY = rect.height / h;
        const scale = Math.min(scaleX, scaleY, 1.5);

        this.camera.scale = scale;
        this.camera.x = rect.width / 2 - ((minX + maxX) / 2) * scale;
        this.camera.y = rect.height / 2 - ((minY + maxY) / 2) * scale;

        this.requestRender();
    }

    requestRender() {
        if (!this.renderRequested) {
            this.renderRequested = true;
            requestAnimationFrame(() => {
                this.renderRequested = false;
                this.render();
            });
        }
    }

    render() {
        const ctx = this.ctx;
        this.renderer.animateFlow = this.animateFlow;
        this.renderer.render(
            ctx,
            this.model,
            this.camera,
            this.showGrid,
            this.gridSize,
            this.selectedElements,
            this.hoveredBreaker
        );

        // Draw active selection box if any
        if (this.isSelectingBox) {
            const p1 = this.worldToScreen(this.selectionBox.x1, this.selectionBox.y1);
            const p2 = this.worldToScreen(this.selectionBox.x2, this.selectionBox.y2);
            ctx.save();
            ctx.strokeStyle = this.renderer.getColors().selection;
            ctx.fillStyle = this.renderer.getColors().selectionBox;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);
            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            ctx.restore();
        }

        // Draw wiring preview line if in line/transformer mode
        if (this.wiringStartBus && this.wiringCurrentPoint) {
            const p1 = this.worldToScreen(this.wiringStartBus.x, this.wiringStartBus.y);
            const p2 = this.worldToScreen(this.wiringCurrentPoint.x, this.wiringCurrentPoint.y);
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.restore();
        }

        // Loop de animação: só renderiza continuamente enquanto houver setas
        // animadas visíveis; caso contrário, volta ao modo sob demanda.
        if (this._shouldAnimateFlow()) {
            this._startFlowAnimationLoop();
        }
    }
}
