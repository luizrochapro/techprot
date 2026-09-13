import { Bus } from '../elements/Bus.js';
import { Line } from '../elements/Line.js';
import { Transformer } from '../elements/Transformer.js';
import { Generator } from '../elements/Generator.js';
import { Load } from '../elements/Load.js';
import { Capacitor, Inductor } from '../elements/Shunt.js';
import { TextLabel } from '../elements/TextLabel.js';
import { Relay } from '../elements/Relay.js';

export const DEFAULT_VOLTAGE_LEVELS = [
    { voltage: 500,  color: '#005adc', name: '500 kV' },
    { voltage: 440,  color: '#a0522d', name: '440 kV' },
    { voltage: 345,  color: '#be6e32', name: '345 kV' },
    { voltage: 230,  color: '#dc2323', name: '230 kV' },
    { voltage: 138,  color: '#009b41', name: '138 kV' },
    { voltage: 69,   color: '#9128cd', name: '69 kV' },
    { voltage: 34.5, color: '#d72387', name: '34.5 kV' },
    { voltage: 13.8, color: '#00a5c3', name: '13.8 kV' },
    { voltage: 4.16, color: '#cd960f', name: '4.16 kV' },
    { voltage: 0.38, color: '#787d87', name: '0.38 kV (380 V)' }
];

export class Model {
    constructor() {
        this.name = 'New Network';
        this.basePower = 100.0; // MVA
        this.frequency = 60.0;  // Hz

        // Voltage Level Colours (TechProt compatible)
        this.voltageLevels = this.loadVoltageLevels();

        // Element collections
        this.buses = [];
        this.lines = [];
        this.transformers = [];
        this.generators = [];
        this.loads = [];
        this.capacitors = [];
        this.inductors = [];
        this.relays = [];
        this.textLabels = [];

        // Simulation parameters
        this.hasSolution = false; // true após fluxo de carga convergido
        this.powerFlowSettings = {
            method: 'Newton-Raphson', // 'Newton-Raphson' or 'Gauss-Seidel'
            tolerance: 1e-5,
            maxIterations: 100,
            accFactor: 1.0,
            enforceQLimits: true,
            enableOLTC: true
        };

        this.faultSettings = {
            faultBusId: null,
            faultType: '3phase', // '3phase', '1phase-g', '2phase', '2phase-g'
            faultResistance: 0.0,
            faultReactance: 0.0
        };

        // Electromechanical Stability Settings & Event List
        this.stabilitySettings = {
            simTime: 5.0,             // Simulation duration [s]
            timeStep: 0.005,          // Time step dt [s] (5 ms)
            plotStep: 0.01,           // Recording interval [s] (10 ms)
            frequency: 60.0,          // Base frequency [Hz]
            tolerance: 1e-5,          // Non-linear convergence tolerance
            maxIterations: 50,        // Max iteration count
            useCOI: true,             // Center of Inertia reference frame
            method: 'Modified-Euler'  // 'Modified-Euler' or 'Heun'
        };

        this.stabilityEvents = [];

        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
    }

    loadVoltageLevels() {
        try {
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('techprot_voltage_levels');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load voltage levels from localStorage', e);
        }
        return DEFAULT_VOLTAGE_LEVELS.map(l => ({ ...l }));
    }

    saveVoltageLevels(levels) {
        this.voltageLevels = levels.map(l => ({
            voltage: Number(l.voltage),
            color: l.color,
            name: l.name || `${l.voltage} kV`
        })).sort((a, b) => b.voltage - a.voltage);

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('techprot_voltage_levels', JSON.stringify(this.voltageLevels));
            }
        } catch (e) {
            console.warn('Failed to save voltage levels to localStorage', e);
        }
    }

    resetVoltageLevels() {
        this.voltageLevels = DEFAULT_VOLTAGE_LEVELS.map(l => ({ ...l }));
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('techprot_voltage_levels');
            }
        } catch (e) {
            console.warn('Failed to clear voltage levels from localStorage', e);
        }
    }

    /**
     * Determines busbar color based on nominal voltage (kV) using TechProt algorithm:
     * 1. Finds closest configured level within 15% tolerance (min 0.5 kV)
     * 2. Range match (descending order)
     * 3. Fallback to default
     */
    getBusColor(nominalVoltage) {
        const v_kV = Number(nominalVoltage) || 138.0;
        const levels = this.voltageLevels;
        if (!levels || levels.length === 0) return '#009b41';

        // 1. Find closest configured level within 15% tolerance
        let minDiff = Infinity;
        let bestIdx = -1;
        for (let i = 0; i < levels.length; i++) {
            const diff = Math.abs(v_kV - levels[i].voltage);
            if (diff < minDiff) {
                minDiff = diff;
                bestIdx = i;
            }
        }

        if (bestIdx >= 0) {
            const tol = Math.max(levels[bestIdx].voltage * 0.15, 0.5);
            if (minDiff <= tol) {
                return levels[bestIdx].color;
            }
            // 2. Range match (assuming ordered descending)
            for (let i = 0; i < levels.length; i++) {
                if (v_kV >= levels[i].voltage * 0.9) {
                    return levels[i].color;
                }
            }
            return levels[levels.length - 1].color;
        }

        return '#009b41';
    }

    clear() {
        this.buses = [];
        this.lines = [];
        this.transformers = [];
        this.generators = [];
        this.loads = [];
        this.capacitors = [];
        this.inductors = [];
        this.relays = [];
        this.textLabels = [];
        this.stabilityEvents = [];
    }

    addStabilityEvent(evt) {
        if (!evt.id) {
            evt.id = 'evt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        }
        this.stabilityEvents.push(evt);
        this.stabilityEvents.sort((a, b) => (a.time || 0) - (b.time || 0));
        return evt;
    }

    removeStabilityEvent(id) {
        const idx = this.stabilityEvents.findIndex(e => e.id === id);
        if (idx >= 0) {
            this.stabilityEvents.splice(idx, 1);
            return true;
        }
        return false;
    }

    clearStabilityEvents() {
        this.stabilityEvents = [];
    }

    getStabilityEvents() {
        return this.stabilityEvents;
    }

    getAllElements() {
        return [
            ...this.buses,
            ...this.lines,
            ...this.transformers,
            ...this.generators,
            ...this.loads,
            ...this.capacitors,
            ...this.inductors,
            ...this.relays
        ];
    }

    getElementById(id) {
        return this.getAllElements().find(e => e.id === id) || 
               this.textLabels.find(t => t.id === id);
    }

    addBus(bus) {
        this.buses.push(bus);
        return bus;
    }

    addLine(line) {
        this.lines.push(line);
        return line;
    }

    addTransformer(transf) {
        this.transformers.push(transf);
        return transf;
    }

    addGenerator(gen) {
        this.generators.push(gen);
        return gen;
    }

    addLoad(load) {
        this.loads.push(load);
        return load;
    }

    addCapacitor(cap) {
        this.capacitors.push(cap);
        return cap;
    }

    addInductor(ind) {
        this.inductors.push(ind);
        return ind;
    }

    addRelay(relay) {
        this.relays.push(relay);
        return relay;
    }

    addTextLabel(label) {
        this.textLabels.push(label);
        return label;
    }

    removeElement(element) {
        const removeFromArray = (arr) => {
            const idx = arr.indexOf(element);
            if (idx >= 0) arr.splice(idx, 1);
        };

        removeFromArray(this.buses);
        removeFromArray(this.lines);
        removeFromArray(this.transformers);
        removeFromArray(this.generators);
        removeFromArray(this.loads);
        removeFromArray(this.capacitors);
        removeFromArray(this.inductors);
        removeFromArray(this.relays);
        removeFromArray(this.textLabels);

        // Remove relays attached to the removed element
        this.relays = this.relays.filter(r => r.parentElement !== element);

        // If a bus was removed, remove or detach connected elements and labels
        if (element instanceof Bus) {
            this.lines = this.lines.filter(l => l.fromBus !== element && l.toBus !== element);
            this.transformers = this.transformers.filter(t => t.fromBus !== element && t.toBus !== element);
            this.generators = this.generators.filter(g => g.parentBus !== element);
            this.loads = this.loads.filter(ld => ld.parentBus !== element);
            this.capacitors = this.capacitors.filter(c => c.parentBus !== element);
            this.inductors = this.inductors.filter(i => i.parentBus !== element);
            // Remove relays whose parent element was itself removed
            this.relays = this.relays.filter(r => r.parentElement && this.getAllElements().includes(r.parentElement));
        }

        // Remove labels pointing to this element
        this.textLabels = this.textLabels.filter(tl => tl.parentElement !== element);
    }

    updateAllLabels() {
        for (const label of this.textLabels) {
            label.updateText(this.basePower);
        }
    }

    snapAllToGrid(gridSize = 20) {
        for (const el of this.getAllElements()) {
            if (el.selected) {
                const oldX = el.x;
                const oldY = el.y;
                el.snapToGrid(gridSize);
                const dx = el.x - oldX;
                const dy = el.y - oldY;
                if (dx !== 0 || dy !== 0) {
                    for (const lbl of this.textLabels) {
                        if (lbl.parentElement === el && !lbl.selected) {
                            lbl.move(dx, dy);
                        }
                    }
                }
            }
        }
        for (const lbl of this.textLabels) {
            if (lbl.selected) {
                lbl.snapToGrid(Math.min(gridSize, 5));
            }
        }
    }
}
