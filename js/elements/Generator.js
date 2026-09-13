import { Element } from './Element.js';
import { ControlPresets } from '../control/ControlPresets.js';
import { ControlDiagram } from '../control/ControlDiagram.js';

export class Generator extends Element {
    constructor(parentBus = null, x = 0, y = 0, name = 'Gen') {
        super('Generator', x, y);
        this.name = name;
        this.width = 36;
        this.height = 36;
        this.parentBus = parentBus;
        if (parentBus) this.parentBuses.push(parentBus);

        // Power flow settings
        this.nominalPower = 100.0;    // MVA
        this.activePower = 50.0;      // MW
        this.reactivePower = 10.0;    // Mvar
        this.targetVoltage = 1.0;     // p.u.
        this.qMin = -50.0;            // Mvar
        this.qMax = 100.0;            // Mvar
        this.isSlack = false;

        // Dynamic / Stability / Short Circuit settings
        this.inertia = 5.0;           // H [s] (MW*s/MVA)
        this.damping = 0.0;           // D [p.u.]
        this.transXd = 0.25;          // X'd [p.u.] (transient reactance)
        this.syncXd = 1.2;            // Xd [p.u.] (synchronous d-axis)
        this.syncXq = 0.8;            // Xq [p.u.] (synchronous q-axis)
        this.transXq = 0.25;          // X'q [p.u.]
        this.transTd0 = 5.0;          // T'd0 [s] (open-circuit transient time constant)
        this.ra = 0.005;              // Ra [p.u.] (armature resistance)
        this.modelType = 1;           // 1 = Classical Model (E' = const), 2 = Transient Model (flux decay)
        this.useMachineBase = true;

        // Excitation System & AVR (Regulador Automático de Tensão)
        this.useAVR = false;
        this.avrDiagram = ControlPresets.createIEEEType1AVR();

        // Turbine & Speed Governor (Regulador de Velocidade)
        this.useSpeedGovernor = false;
        this.speedGovDiagram = ControlPresets.createSteamGovernor();

        // Legacy / Fault aliases
        this.xd = this.syncXd;
        this.xdp = this.transXd;
        this.xdpp = 0.2;              // p.u. (subtransient)

        this.results = {
            p: 50.0,
            q: 10.0,
            v: 1.0,
            faultCurrent: 0.0
        };

        // Stability time-series results
        this.stabilityResults = {
            time: [],
            delta: [],
            deltaCOI: [],
            speed: [],
            freq: [],
            pe: [],
            vt: [],
            vfd: [],
            pm: []
        };
    }

    /**
     * Returns bounding box for circuit breaker switch on generator terminal lead
     * @returns {Array<{x: number, y: number, width: number, height: number, terminal: number, element: Generator}>}
     */
    getSwitchBoxes() {
        if (!this.parentBus) return [];
        const r = 16;
        const rad = ((this.angle || 0) * Math.PI) / 180;
        const termX = this.x + r * Math.sin(rad);
        const termY = this.y - r * Math.cos(rad);
        const pBus = this.parentBus.getClosestPointOnBar(termX, termY);

        const swSize = 10;
        const d = Math.hypot(termX - pBus.x, termY - pBus.y);
        const off = Math.min(14, d / 2);
        const ux = d > 0 ? (termX - pBus.x) / d : 0;
        const uy = d > 0 ? (termY - pBus.y) / d : 1;
        const swX = pBus.x + ux * off;
        const swY = pBus.y + uy * off;

        return [{
            x: swX - swSize / 2,
            y: swY - swSize / 2,
            width: swSize,
            height: swSize,
            terminal: 0,
            element: this
        }];
    }
}
