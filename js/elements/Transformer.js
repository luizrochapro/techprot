import { Element } from './Element.js';

export class Transformer extends Element {
    constructor(fromBus = null, toBus = null, x = 0, y = 0, name = 'Transformer') {
        super('Transformer', x, y);
        this.name = name;
        this.width = 44;
        this.height = 44;
        this.fromBus = fromBus;
        this.toBus = toBus;
        if (fromBus) this.parentBuses.push(fromBus);
        if (toBus) this.parentBuses.push(toBus);

        // Electrical parameters
        this.primaryNominalVoltage = 138.0;   // kV
        this.secondaryNominalVoltage = 13.8;  // kV
        this.nominalPower = 100.0;            // MVA
        this.resistance = 0.005;              // R (p.u.)
        this.indReactance = 0.05;             // X (p.u.)
        this.turnsRatio = 1.0;                // Current tap ratio (p.u.)
        this.nominalTurnsRatio = 1.0;         // Nominal tap ratio (p.u.)
        this.phaseShift = 0.0;                // Degrees
        this.connection = 'GWYE_GWYE';

        // On-Load Tap Changer (OLTC / Comutador sob carga)
        this.hasTapChanger = false;
        this.oltcControlledBus = 1;          // 0 = Primary (Bus 1), 1 = Secondary (Bus 2)
        this.oltcTargetVoltage = 1.0;        // Target voltage in p.u.
        this.oltcVoltageDeadband = 0.005;     // Voltage deadband in p.u.
        this.oltcMinTap = 0.90;              // Minimum tap in p.u.
        this.oltcMaxTap = 1.10;              // Maximum tap in p.u.
        this.oltcTapStep = 0.00625;          // Tap step size (5/8% = 0.00625 p.u.)
        this.oltcIsDiscrete = false;         // Discrete vs continuous

        // Zero sequence for fault calculations
        this.zeroResistance = 0.005;
        this.zeroIndReactance = 0.05;

        // Per-terminal circuit breaker states (terminal 0 = fromBus, 1 = toBus)
        // true = closed (fechado), false = open (aberto)
        this.breakerFrom = true;
        this.breakerTo = true;

        // Terminal connection points and routing points
        this.pointList = [];

        // Simulation Results
        this.results = {
            p12: 0.0,
            q12: 0.0,
            p21: 0.0,
            q21: 0.0,
            pLoss: 0.0,
            qLoss: 0.0,
            i12: 0.0,
            i21: 0.0,
            tap: 1.0, // Converged tap value in p.u.
            faultCurrent12: [0, 0, 0], // Ia, Ib, Ic in kA
            faultCurrent21: [0, 0, 0], // Ia, Ib, Ic in kA
            faultFlowKA: 0.0,
            faultDirection: 0 // 0=none, 1=1->2, 2=2->1
        };
    }

    /**
     * Gets current tap value (either fixed turnsRatio or OLTC converged tap)
     */
    getCurrentTap() {
        return this.turnsRatio;
    }

    /**
     * Effective online state: transformer conducts ONLY when master switch is online
     * AND both terminal breakers are closed.
     */
    isEffectivelyOnline() {
        return this.isOnline !== false
            && this.breakerFrom !== false
            && this.breakerTo !== false;
    }

    get isHalfOpen() {
        if (this.isOnline === false) return false;
        return (this.breakerFrom !== false) !== (this.breakerTo !== false);
    }

    isTerminalOnline(terminal) {
        if (this.isOnline === false) return false;
        return terminal === 0 ? this.breakerFrom !== false : this.breakerTo !== false;
    }

    /**
     * Returns bounding boxes for circuit breaker switches at transformer terminals
     * @returns {Array<{x: number, y: number, width: number, height: number, terminal: number, element: Transformer}>}
     */
    getSwitchBoxes() {
        const boxes = [];
        const swSize = 10;

        if (this.fromBus && this.toBus) {
            const p1 = this.fromBus.getClosestPointOnBar(this.x, this.y);
            const p2 = this.toBus.getClosestPointOnBar(this.x, this.y);

            // Primary lead: from p1 to (this.x, this.y - 25)
            const target1X = this.x;
            const target1Y = this.y - 25;
            const d1 = Math.hypot(target1X - p1.x, target1Y - p1.y);
            const off1 = Math.min(15, d1 / 2);
            const u1x = d1 > 0 ? (target1X - p1.x) / d1 : 0;
            const u1y = d1 > 0 ? (target1Y - p1.y) / d1 : 1;
            const sw1X = p1.x + u1x * off1;
            const sw1Y = p1.y + u1y * off1;

            boxes.push({
                x: sw1X - swSize / 2,
                y: sw1Y - swSize / 2,
                width: swSize,
                height: swSize,
                terminal: 0,
                element: this
            });

            // Secondary lead: from (this.x, this.y + 25) to p2
            const start2X = this.x;
            const start2Y = this.y + 25;
            const d2 = Math.hypot(start2X - p2.x, start2Y - p2.y);
            const off2 = Math.min(15, d2 / 2);
            const u2x = d2 > 0 ? (start2X - p2.x) / d2 : 0;
            const u2y = d2 > 0 ? (start2Y - p2.y) / d2 : -1;
            const sw2X = p2.x + u2x * off2;
            const sw2Y = p2.y + u2y * off2;

            boxes.push({
                x: sw2X - swSize / 2,
                y: sw2Y - swSize / 2,
                width: swSize,
                height: swSize,
                terminal: 1,
                element: this
            });
        } else {
            boxes.push({
                x: this.x - swSize / 2,
                y: this.y - 30 - swSize / 2,
                width: swSize,
                height: swSize,
                terminal: 0,
                element: this
            });
            boxes.push({
                x: this.x - swSize / 2,
                y: this.y + 30 - swSize / 2,
                width: swSize,
                height: swSize,
                terminal: 1,
                element: this
            });
        }

        return boxes;
    }
}
