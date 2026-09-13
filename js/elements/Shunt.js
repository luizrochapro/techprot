import { Element } from './Element.js';

export class Capacitor extends Element {
    constructor(parentBus = null, x = 0, y = 0, name = 'Cap') {
        super('Capacitor', x, y);
        this.name = name;
        this.width = 28;
        this.height = 28;
        this.parentBus = parentBus;
        if (parentBus) this.parentBuses.push(parentBus);

        this.nominalReactivePower = 10.0; // Mvar (generated capacitive)
        this.nominalVoltage = 138.0;       // kV

        this.results = {
            q: 10.0,
            v: 1.0
        };
    }
}

export class Inductor extends Element {
    constructor(parentBus = null, x = 0, y = 0, name = 'Ind') {
        super('Inductor', x, y);
        this.name = name;
        this.width = 28;
        this.height = 28;
        this.parentBus = parentBus;
        if (parentBus) this.parentBuses.push(parentBus);

        this.nominalReactivePower = 10.0; // Mvar (absorbed inductive)
        this.nominalVoltage = 138.0;       // kV

        this.results = {
            q: 10.0,
            v: 1.0
        };
    }
}
