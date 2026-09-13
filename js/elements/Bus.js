import { Element } from './Element.js';

export const BusType = {
    PQ: 0,
    PV: 1,
    SLACK: 2
};

export class Bus extends Element {
    constructor(x = 0, y = 0, name = 'Bus') {
        super('Bus', x, y);
        this.name = name;
        this.width = 120;
        this.height = 8;
        this.angle = 0; // 0 = horizontal bar, 90 = vertical bar
        
        // Electrical parameters
        this.nominalVoltage = 138.0; // kV
        this.busType = BusType.PQ; // 0=PQ, 1=PV, 2=SLACK
        this.targetVoltage = 1.0;  // p.u.
        this.voltageMagnitude = 1.0; // p.u.
        this.voltageAngle = 0.0;     // degrees
        this.qMin = -999.0;          // Mvar
        this.qMax = 999.0;           // Mvar
        
        // Net injected power or loads attached directly
        this.pGen = 0.0; // MW
        this.qGen = 0.0; // Mvar
        this.pLoad = 0.0; // MW
        this.qLoad = 0.0; // Mvar
        this.gShunt = 0.0; // p.u.
        this.bShunt = 0.0; // p.u.
        
        // Sequence impedance for fault calculation
        this.r0 = 0.0;
        this.x0 = 0.0;

        // Short-circuit / Fault attributes
        this.hasFault = false;
        this.faultType = '3phase';        // '3phase', '1phase-g', '2phase', '2phase-g'
        this.faultPhases = 'ABC';         // 'ABC', 'A', 'B', 'C', 'AB', 'BC', 'CA'
        this.faultResistance = 0.0;       // Fault resistance [Ohms]
        this.faultReactance = 0.0;        // Fault reactance [Ohms]
        this.faultUnit = 'ohm';           // 'ohm' or 'pu'

        // Dynamic / Electromechanical Stability Fault attributes
        this.stabHasFault = false;
        this.stabFaultTime = 1.0;          // Time of fault inception [s]
        this.stabFaultLength = 0.10;       // Fault duration [s]
        this.stabFaultResistance = 0.0;    // Fault resistance [p.u.]
        this.stabFaultReactance = 0.0001;  // Fault reactance [p.u.]

        // Results
        this.results = {
            v: 1.0,
            angle: 0.0,
            pGen: 0.0,
            qGen: 0.0,
            pLoad: 0.0,
            qLoad: 0.0,
            pNet: 0.0,
            qNet: 0.0,
            faultCurrents: [0, 0, 0],     // [Ia, Ib, Ic] in kA
            faultVoltages: [1.0, 1.0, 1.0], // [Va, Vb, Vc] in p.u.
            faultCurrentKA: 0.0,          // Max phase fault current in kA
            faultMVA: 0.0,                // Short circuit power in MVA
            faultVoltage: 1.0             // Post-fault voltage in p.u.
        };

        // Stability time-series results
        this.stabilityResults = {
            time: [],
            v: [],
            angle: [],
            freq: []
        };
    }

    get isSlack() {
        return this.busType === BusType.SLACK;
    }

    set isSlack(val) {
        if (val) this.busType = BusType.SLACK;
        else if (this.busType === BusType.SLACK) this.busType = BusType.PQ;
    }

    get isPV() {
        return this.busType === BusType.PV;
    }

    set isPV(val) {
        if (val) this.busType = BusType.PV;
        else if (this.busType === BusType.PV) this.busType = BusType.PQ;
    }

    getBounds() {
        if (this.angle === 90 || this.angle === 270) {
            return {
                x: this.x - this.height / 2,
                y: this.y - this.width / 2,
                width: this.height,
                height: this.width
            };
        }
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Returns the world positions of the resize handles at both
     * extremities of the bar along its main axis.
     * 'start' = left (horizontal) or top (vertical), 'end' = right/bottom.
     */
    getHandlePositions() {
        const half = this.width / 2;
        if (this.angle === 90 || this.angle === 270) {
            return {
                start: { x: this.x, y: this.y - half },
                end: { x: this.x, y: this.y + half }
            };
        }
        return {
            start: { x: this.x - half, y: this.y },
            end: { x: this.x + half, y: this.y }
        };
    }

    /**
     * Hit-tests the resize handles. Returns 'start', 'end' or null.
     */
    hitTestHandle(wx, wy, tolerance = 6) {
        const handles = this.getHandlePositions();
        for (const key of ['start', 'end']) {
            const h = handles[key];
            if (Math.abs(wx - h.x) <= tolerance && Math.abs(wy - h.y) <= tolerance) {
                return key;
            }
        }
        return null;
    }

    /**
     * Resizes the bar by moving one extremity to the given world point
     * (projected on the bar axis). The opposite extremity stays fixed
     * and the center (x, y) is recalculated. Enforces a minimum length.
     * @param {'start'|'end'} handle Which extremity is being dragged.
     * @param {number} wx New world X of the dragged extremity.
     * @param {number} wy New world Y of the dragged extremity.
     * @param {number} minLength Minimum bar length.
     * @returns {{dx: number, dy: number}} The resulting center shift.
     */
    resizeFromHandle(handle, wx, wy, minLength = 40) {
        const oldX = this.x;
        const oldY = this.y;
        const handles = this.getHandlePositions();
        const fixed = handle === 'start' ? handles.end : handles.start;
        const isVertical = (this.angle === 90 || this.angle === 270);

        if (isVertical) {
            let dir = wy >= fixed.y ? 1 : -1;
            let len = Math.abs(wy - fixed.y);
            if (len < minLength) len = minLength;
            this.width = len;
            this.y = fixed.y + dir * len / 2;
        } else {
            let dir = wx >= fixed.x ? 1 : -1;
            let len = Math.abs(wx - fixed.x);
            if (len < minLength) len = minLength;
            this.width = len;
            this.x = fixed.x + dir * len / 2;
        }
        return { dx: this.x - oldX, dy: this.y - oldY };
    }

    /**
     * Gets the closest point along the busbar for a given (px, py).
     */
    getClosestPointOnBar(px, py) {
        const bounds = this.getBounds();
        if (this.angle === 90 || this.angle === 270) {
            const clampedY = Math.max(bounds.y, Math.min(bounds.y + bounds.height, py));
            return { x: this.x, y: clampedY };
        } else {
            const clampedX = Math.max(bounds.x, Math.min(bounds.x + bounds.width, px));
            return { x: clampedX, y: this.y };
        }
    }
}
