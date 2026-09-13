import { Element } from './Element.js';

export const LoadModel = {
    CONST_POWER: 0,
    CONST_CURRENT: 1,
    CONST_IMPEDANCE: 2,
    ZIP: 3
};

export class Load extends Element {
    constructor(parentBus = null, x = 0, y = 0, name = 'Load') {
        super('Load', x, y);
        this.name = name;
        this.width = 30;
        this.height = 30;
        this.parentBus = parentBus;
        if (parentBus) this.parentBuses.push(parentBus);

        this.activePower = 30.0;    // MW
        this.reactivePower = 15.0;  // Mvar
        this.loadModel = LoadModel.CONST_POWER;

        this.results = {
            p: 30.0,
            q: 15.0,
            v: 1.0,
            i: 0.0
        };
    }

    /**
     * Returns bounding box for circuit breaker switch on load terminal lead
     * @returns {Array<{x: number, y: number, width: number, height: number, terminal: number, element: Load}>}
     */
    getSwitchBoxes() {
        if (!this.parentBus) return [];
        const rad = ((this.angle || 0) * Math.PI) / 180;
        const stemLength = 10;
        const termX = this.x + stemLength * Math.sin(rad);
        const termY = this.y - stemLength * Math.cos(rad);

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
