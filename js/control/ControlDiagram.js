import { ControlBlock, BlockType, InputSignalType, OutputSignalType } from './ControlBlock.js';

/**
 * ControlDiagram.js - Block Diagram Data Model and Numerical Solver Engine
 * 
 * Manages blocks and interconnecting wires, resolves execution order,
 * and integrates the control dynamics at each time-step.
 */
export class ControlDiagram {
    /**
     * @param {string} type - 'avr' or 'speed_gov'
     * @param {string} name - Diagram name (e.g. 'Regulador IEEE Type 1')
     */
    constructor(type = 'avr', name = '') {
        this.id = 'diag_' + Math.random().toString(36).substring(2, 9);
        this.type = type; // 'avr' or 'speed_gov'
        this.name = name || (type === 'avr' ? 'Regulador Automático de Tensão (AVR)' : 'Regulador de Velocidade (Governor)');
        
        this.blocks = [];
        this.wires = []; // [{ id, fromBlockId, fromPortId, toBlockId, toPortId }]

        this.executionOrder = [];
        this.isDirty = true;
    }

    addBlock(block) {
        this.blocks.push(block);
        this.isDirty = true;
        return block;
    }

    removeBlock(blockOrId) {
        const id = typeof blockOrId === 'string' ? blockOrId : blockOrId.id;
        const idx = this.blocks.findIndex(b => b.id === id);
        if (idx >= 0) {
            this.blocks.splice(idx, 1);
            // Remove connected wires
            this.wires = this.wires.filter(w => w.fromBlockId !== id && w.toBlockId !== id);
            this.isDirty = true;
            return true;
        }
        return false;
    }

    getBlockById(id) {
        return this.blocks.find(b => b.id === id);
    }

    addWire(fromBlockId, fromPortId, toBlockId, toPortId) {
        // Prevent duplicate or self-connections
        if (fromBlockId === toBlockId) return null;

        // Ensure no multiple wires into same input port (single driver rule)
        this.wires = this.wires.filter(w => !(w.toBlockId === toBlockId && w.toPortId === toPortId));

        const wire = {
            id: 'w_' + Math.random().toString(36).substring(2, 9),
            fromBlockId,
            fromPortId,
            toBlockId,
            toPortId
        };
        this.wires.push(wire);
        this.isDirty = true;
        return wire;
    }

    removeWire(wireOrId) {
        const id = typeof wireOrId === 'string' ? wireOrId : wireOrId.id;
        const idx = this.wires.findIndex(w => w.id === id);
        if (idx >= 0) {
            this.wires.splice(idx, 1);
            this.isDirty = true;
            return true;
        }
        return false;
    }

    /**
     * Resolves topological execution order for forward blocks
     */
    resolveExecutionOrder() {
        // Build dependency graph
        const inDegree = new Map();
        const adj = new Map();

        for (const b of this.blocks) {
            inDegree.set(b.id, 0);
            adj.set(b.id, []);
        }

        for (const w of this.wires) {
            if (adj.has(w.fromBlockId) && inDegree.has(w.toBlockId)) {
                adj.get(w.fromBlockId).push(w.toBlockId);
                inDegree.set(w.toBlockId, inDegree.get(w.toBlockId) + 1);
            }
        }

        // Kahn's algorithm
        const queue = [];
        for (const b of this.blocks) {
            // Input blocks, constants, or blocks with in-degree 0 start
            if (inDegree.get(b.id) === 0) {
                queue.push(b.id);
            }
        }

        const order = [];
        const visited = new Set();

        while (queue.length > 0) {
            const u = queue.shift();
            if (visited.has(u)) continue;
            visited.add(u);
            order.push(u);

            const neighbors = adj.get(u) || [];
            for (const v of neighbors) {
                inDegree.set(v, inDegree.get(v) - 1);
                if (inDegree.get(v) <= 0 && !visited.has(v)) {
                    queue.push(v);
                }
            }
        }

        // Add any remaining blocks (in feedback loops)
        for (const b of this.blocks) {
            if (!visited.has(b.id)) {
                order.push(b.id);
            }
        }

        this.executionOrder = order.map(id => this.getBlockById(id)).filter(Boolean);
        this.isDirty = false;
        return this.executionOrder;
    }

    /**
     * Initializes all blocks in diagram to steady state equilibrium at t = 0
     * @param {Object} inputSignals - { terminal_voltage, speed, speed_deviation, etc. }
     */
    initialize(inputSignals = {}) {
        if (this.isDirty || this.executionOrder.length !== this.blocks.length) {
            this.resolveExecutionOrder();
        }

        // Pre-populate input blocks
        for (const b of this.blocks) {
            if (b.type === BlockType.INPUT) {
                const sigType = b.params.signalType;
                let val = 1.0;
                if (sigType === InputSignalType.TERMINAL_VOLTAGE) val = inputSignals.terminal_voltage ?? 1.0;
                else if (sigType === InputSignalType.VOLTAGE_REF) val = inputSignals.voltage_ref ?? (inputSignals.terminal_voltage ?? 1.0);
                else if (sigType === InputSignalType.SPEED) val = inputSignals.speed ?? 1.0;
                else if (sigType === InputSignalType.SPEED_DEVIATION) val = (inputSignals.speed ?? 1.0) - 1.0;
                else if (sigType === InputSignalType.ACTIVE_POWER) val = inputSignals.active_power ?? 1.0;
                else val = b.params.customValue ?? 1.0;
                b.initialize([val]);
            }
        }

        // Iterate a couple of times to settle algebraic loops & steady-state values
        for (let iter = 0; iter < 4; iter++) {
            for (const b of this.executionOrder) {
                if (b.type === BlockType.INPUT) continue;

                // Gather inputs from incoming wires
                const inputs = [];
                for (let i = 0; i < b.inPorts.length; i++) {
                    const port = b.inPorts[i];
                    const wire = this.wires.find(w => w.toBlockId === b.id && w.toPortId === port.id);
                    if (wire) {
                        const srcBlock = this.getBlockById(wire.fromBlockId);
                        inputs.push(srcBlock ? srcBlock.state.output : 0.0);
                    } else {
                        inputs.push(0.0);
                    }
                }

                b.initialize(inputs);
            }
        }

        // Return initial output
        return this.getOutputValue();
    }

    /**
     * Evaluates the block diagram for one simulation time step
     * @param {Object} inputSignals - { terminal_voltage, speed, etc. }
     * @param {number} dt - Time step in seconds
     * @returns {number} Primary control output
     */
    step(inputSignals = {}, dt = 0.005) {
        if (this.isDirty || this.executionOrder.length !== this.blocks.length) {
            this.resolveExecutionOrder();
        }

        // 1. Update inputs
        for (const b of this.blocks) {
            if (b.type === BlockType.INPUT) {
                const sigType = b.params.signalType;
                let val = 1.0;
                if (sigType === InputSignalType.TERMINAL_VOLTAGE) val = inputSignals.terminal_voltage ?? 1.0;
                else if (sigType === InputSignalType.VOLTAGE_REF) val = inputSignals.voltage_ref ?? (inputSignals.terminal_voltage ?? 1.0);
                else if (sigType === InputSignalType.SPEED) val = inputSignals.speed ?? 1.0;
                else if (sigType === InputSignalType.SPEED_DEVIATION) val = (inputSignals.speed ?? 1.0) - 1.0;
                else if (sigType === InputSignalType.ACTIVE_POWER) val = inputSignals.active_power ?? 1.0;
                else val = b.params.customValue ?? 1.0;
                b.evaluate([val], dt);
            }
        }

        // 2. Evaluate all other blocks in topological order
        for (const b of this.executionOrder) {
            if (b.type === BlockType.INPUT) continue;

            // Gather inputs from incoming wires
            const inputs = [];
            for (let i = 0; i < b.inPorts.length; i++) {
                const port = b.inPorts[i];
                const wire = this.wires.find(w => w.toBlockId === b.id && w.toPortId === port.id);
                if (wire) {
                    const srcBlock = this.getBlockById(wire.fromBlockId);
                    inputs.push(srcBlock ? srcBlock.state.output : 0.0);
                } else {
                    inputs.push(0.0);
                }
            }

            b.evaluate(inputs, dt);
        }

        return this.getOutputValue();
    }

    /**
     * Finds and returns the primary output value of the diagram
     */
    getOutputValue() {
        const outBlock = this.blocks.find(b => b.type === BlockType.OUTPUT);
        if (outBlock) {
            return outBlock.state.output;
        }
        // If no explicit output block, take last evaluated block output
        if (this.executionOrder.length > 0) {
            return this.executionOrder[this.executionOrder.length - 1].state.output;
        }
        return 0.0;
    }

    /**
     * Serializes diagram to JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            blocks: this.blocks.map(b => b.toJSON()),
            wires: this.wires.map(w => ({ ...w }))
        };
    }

    /**
     * Reconstitutes diagram from JSON
     */
    static fromJSON(json) {
        if (!json) return null;
        const diag = new ControlDiagram(json.type, json.name);
        diag.id = json.id || diag.id;

        if (Array.isArray(json.blocks)) {
            for (const bJson of json.blocks) {
                diag.addBlock(ControlBlock.fromJSON(bJson));
            }
        }

        if (Array.isArray(json.wires)) {
            for (const w of json.wires) {
                diag.addWire(w.fromBlockId, w.fromPortId, w.toBlockId, w.toPortId);
            }
        }

        diag.resolveExecutionOrder();
        return diag;
    }

    /**
     * Creates an identical deep copy of this diagram
     */
    clone() {
        return ControlDiagram.fromJSON(this.toJSON());
    }
}
