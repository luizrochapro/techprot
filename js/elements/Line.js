import { Element } from './Element.js';

export class Line extends Element {
    constructor(fromBus = null, toBus = null, name = 'Line') {
        super('Line', 0, 0);
        this.name = name;
        this.fromBus = fromBus;
        this.toBus = toBus;
        if (fromBus) this.parentBuses.push(fromBus);
        if (toBus) this.parentBuses.push(toBus);

        // Per-terminal circuit breaker states (terminal 0 = fromBus, 1 = toBus)
        // true = closed (fechado), false = open (aberto). Line conducts ONLY
        // when isOnline && breakerFrom && breakerTo.
        this.breakerFrom = true;
        this.breakerTo = true;
        
        // Electrical parameters (p.u. on system base)
        this.resistance = 0.02;     // R (p.u.)
        this.indReactance = 0.08;   // X (p.u.)
        this.susceptance = 0.02;    // B (total line charging p.u.)
        this.length = 50.0;         // km
        this.nominalPower = 100.0;  // MVA thermal rating
        
        // Sequence parameters for fault calculation
        this.zeroResistance = 0.06;
        this.zeroIndReactance = 0.24;
        this.zeroSusceptance = 0.01;

        // Waypoints for drawing
        this.pointList = []; // [{x, y}, ...]

        // Results
        this.results = {
            p12: 0.0, // MW from bus1 to bus2
            q12: 0.0, // Mvar
            p21: 0.0, // MW from bus2 to bus1
            q21: 0.0, // Mvar
            pLoss: 0.0,
            qLoss: 0.0,
            i12: 0.0, // p.u. or A
            i21: 0.0,
            direction: 0, // 0=none, 1=1->2, 2=2->1
            faultCurrent12: [0, 0, 0], // Ia, Ib, Ic in kA
            faultCurrent21: [0, 0, 0], // Ia, Ib, Ic in kA
            faultFlowKA: 0.0,
            faultDirection: 0 // 0=none, 1=1->2, 2=2->1
        };
    }

    /**
     * Effective online state: line conducts ONLY when master switch is online
     * AND both terminal breakers are closed. When exactly one breaker is open
     * the line is "half-open" (meia-aberta).
     * @returns {boolean}
     */
    isEffectivelyOnline() {
        return this.isOnline !== false
            && this.breakerFrom !== false
            && this.breakerTo !== false;
    }

    /**
     * True when exactly one terminal breaker is open (meia-aberta):
     * visually one end open (red slash), the other closed (green square).
     */
    get isHalfOpen() {
        if (this.isOnline === false) return false;
        return (this.breakerFrom !== false) !== (this.breakerTo !== false);
    }

    /**
     * Online state of a specific terminal breaker (0 = fromBus, 1 = toBus),
     * combined with the master isOnline switch.
     */
    isTerminalOnline(terminal) {
        if (this.isOnline === false) return false;
        return terminal === 0 ? this.breakerFrom !== false : this.breakerTo !== false;
    }

    getBounds() {
        if (!this.pointList || this.pointList.length < 2) {
            if (this.fromBus && this.toBus) {
                return {
                    x: Math.min(this.fromBus.x, this.toBus.x),
                    y: Math.min(this.fromBus.y, this.toBus.y),
                    width: Math.abs(this.fromBus.x - this.toBus.x) || 20,
                    height: Math.abs(this.fromBus.y - this.toBus.y) || 20
                };
            }
            return super.getBounds();
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pt of this.pointList) {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
        }
        return {
            x: minX,
            y: minY,
            width: maxX - minX || 20,
            height: maxY - minY || 20
        };
    }

    containsPoint(px, py, tolerance = 8) {
        if (!this.pointList || this.pointList.length < 2) return false;
        for (let i = 0; i < this.pointList.length - 1; i++) {
            const p1 = this.pointList[i];
            const p2 = this.pointList[i + 1];
            const dist = Line.distToSegment({ x: px, y: py }, p1, p2);
            if (dist <= tolerance) return true;
        }
        return false;
    }

    static distToSegment(p, v, w) {
        const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    /**
     * Returns bounding boxes for circuit breaker switches at line terminals
     * @returns {Array<{x: number, y: number, width: number, height: number, terminal: number, element: Line}>}
     */
    getSwitchBoxes() {
        let pts = this.pointList;
        if (!pts || pts.length < 2) {
            if (this.fromBus && this.toBus) {
                const p1 = this.fromBus.getClosestPointOnBar(this.toBus.x, this.toBus.y);
                const p2 = this.toBus.getClosestPointOnBar(this.fromBus.x, this.fromBus.y);
                pts = [p1, p2];
            } else {
                return [];
            }
        }

        const boxes = [];
        const swSize = 10;

        // Breaker near fromBus (pts[0])
        const p0 = pts[0];
        const p1 = pts[1];
        const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const offset1 = Math.min(15, d1 / 2);
        const u1x = d1 > 0 ? (p1.x - p0.x) / d1 : 1;
        const u1y = d1 > 0 ? (p1.y - p0.y) / d1 : 0;
        const sw1X = p0.x + u1x * offset1;
        const sw1Y = p0.y + u1y * offset1;

        boxes.push({
            x: sw1X - swSize / 2,
            y: sw1Y - swSize / 2,
            width: swSize,
            height: swSize,
            terminal: 0,
            element: this
        });

        // Breaker near toBus (pts[n - 1])
        const n = pts.length;
        const pn = pts[n - 1];
        const pn1 = pts[n - 2];
        const d2 = Math.hypot(pn1.x - pn.x, pn1.y - pn.y);
        const offset2 = Math.min(15, d2 / 2);
        const u2x = d2 > 0 ? (pn1.x - pn.x) / d2 : 1;
        const u2y = d2 > 0 ? (pn1.y - pn.y) / d2 : 0;
        const sw2X = pn.x + u2x * offset2;
        const sw2Y = pn.y + u2y * offset2;

        boxes.push({
            x: sw2X - swSize / 2,
            y: sw2Y - swSize / 2,
            width: swSize,
            height: swSize,
            terminal: 1,
            element: this
        });

        return boxes;
    }
}
