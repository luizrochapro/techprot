/**
 * ControlBlock.js - Mathematical models of control elements for block diagrams
 * 
 * Supports:
 * - Input / Output ports
 * - Transfer Function (Tustin / State-Space integration)
 * - Gain, Sum, Limiter, RateLimiter, Constant, Multiplier
 * - Steady-state equilibrium initialization
 */

export const BlockType = {
    INPUT: 'input',
    OUTPUT: 'output',
    TRANSFER_FUNCTION: 'transfer_function',
    GAIN: 'gain',
    SUM: 'sum',
    LIMITER: 'limiter',
    RATE_LIMITER: 'rate_limiter',
    CONSTANT: 'constant',
    MULTIPLIER: 'multiplier'
};

export const InputSignalType = {
    TERMINAL_VOLTAGE: 'terminal_voltage',     // Vt (p.u.)
    VOLTAGE_REF: 'voltage_ref',               // Vref (p.u.)
    SPEED: 'speed',                           // w (p.u.)
    SPEED_DEVIATION: 'speed_deviation',       // dw = w - 1 (p.u.)
    SPEED_REF: 'speed_ref',                   // wref (p.u.)
    ACTIVE_POWER: 'active_power',             // Pe (MW or p.u.)
    REACTIVE_POWER: 'reactive_power'          // Qe (Mvar or p.u.)
};

export const OutputSignalType = {
    FIELD_VOLTAGE: 'field_voltage',           // Vfd (p.u.) - for AVR
    DELTA_FIELD_VOLTAGE: 'delta_vfd',         // dVfd (p.u.) - added to initial Efd0
    MECHANICAL_POWER: 'mechanical_power'      // Pm (p.u.) - for Speed Governor
};

export class ControlBlock {
    /**
     * @param {string} type - BlockType
     * @param {number} x - CAD x coordinate
     * @param {number} y - CAD y coordinate
     * @param {string} name - Block display name
     */
    constructor(type, x = 100, y = 100, name = '') {
        this.id = 'blk_' + Math.random().toString(36).substring(2, 9);
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 70;
        this.height = 46;
        this.name = name || this.getDefaultName(type);

        // Parameters by block type
        this.params = this.getDefaultParams(type);

        // Port definitions
        this.inPorts = [];  // [{ id: 'in0', label: '+', relX: 0, relY: 0.5 }]
        this.outPorts = []; // [{ id: 'out0', label: '', relX: 1, relY: 0.5 }]
        this.setupPorts();

        // State variables for dynamic simulation
        this.state = {
            output: 0.0,
            prevOutput: 0.0,
            prevInput: 0.0,
            states: [], // for higher-order state space
            initialized: false
        };
    }

    getDefaultName(type) {
        switch (type) {
            case BlockType.INPUT: return 'Entrada';
            case BlockType.OUTPUT: return 'Saída';
            case BlockType.TRANSFER_FUNCTION: return 'G(s)';
            case BlockType.GAIN: return 'Ganho';
            case BlockType.SUM: return 'Somador';
            case BlockType.LIMITER: return 'Limitador';
            case BlockType.RATE_LIMITER: return 'Taxa';
            case BlockType.CONSTANT: return 'Constante';
            case BlockType.MULTIPLIER: return 'Mult';
            default: return 'Bloco';
        }
    }

    getDefaultParams(type) {
        switch (type) {
            case BlockType.INPUT:
                return { signalType: InputSignalType.TERMINAL_VOLTAGE, customValue: 1.0 };
            case BlockType.OUTPUT:
                return { signalType: OutputSignalType.FIELD_VOLTAGE };
            case BlockType.TRANSFER_FUNCTION:
                return {
                    // Representation: G(s) = num / den
                    // Default: 1 / (1 + 0.05s) first order filter
                    numerator: [1.0],         // b_m ... b_0
                    denominator: [0.05, 1.0], // a_n ... a_0
                    // Human friendly formula
                    label: '1 / (1 + 0.05s)'
                };
            case BlockType.GAIN:
                return { gain: 20.0 };
            case BlockType.SUM:
                return { signs: ['+', '-'] }; // 2 inputs by default
            case BlockType.LIMITER:
                return { min: -5.0, max: 5.0 };
            case BlockType.RATE_LIMITER:
                return { upLimit: 10.0, downLimit: -10.0 };
            case BlockType.CONSTANT:
                return { value: 1.0 };
            case BlockType.MULTIPLIER:
                return {};
            default:
                return {};
        }
    }

    setupPorts() {
        this.inPorts = [];
        this.outPorts = [];

        if (this.type === BlockType.INPUT) {
            this.width = 64;
            this.height = 36;
            this.outPorts.push({ id: 'out0', label: '', relX: 1.0, relY: 0.5 });
        } else if (this.type === BlockType.OUTPUT) {
            this.width = 64;
            this.height = 36;
            this.inPorts.push({ id: 'in0', label: '', relX: 0.0, relY: 0.5 });
        } else if (this.type === BlockType.SUM) {
            this.width = 44;
            this.height = 44;
            const signs = this.params.signs || ['+', '-'];
            for (let i = 0; i < signs.length; i++) {
                const relY = (i + 1) / (signs.length + 1);
                this.inPorts.push({ id: `in${i}`, label: signs[i], relX: 0.0, relY });
            }
            this.outPorts.push({ id: 'out0', label: '', relX: 1.0, relY: 0.5 });
        } else if (this.type === BlockType.MULTIPLIER) {
            this.width = 44;
            this.height = 44;
            this.inPorts.push({ id: 'in0', label: '', relX: 0.0, relY: 0.3 });
            this.inPorts.push({ id: 'in1', label: '', relX: 0.0, relY: 0.7 });
            this.outPorts.push({ id: 'out0', label: '', relX: 1.0, relY: 0.5 });
        } else if (this.type === BlockType.CONSTANT) {
            this.width = 54;
            this.height = 36;
            this.outPorts.push({ id: 'out0', label: '', relX: 1.0, relY: 0.5 });
        } else if (this.type === BlockType.TRANSFER_FUNCTION) {
            this.width = 90;
            this.height = 50;
            this.inPorts.push({ id: 'in0', label: '', relX: 0.0, relY: 0.5 });
            this.outPorts.push({ id: 'out0', label: '', relX: 1.0, relY: 0.5 });
        } else {
            this.width = 64;
            this.height = 42;
            this.inPorts.push({ id: 'in0', label: '', relX: 0.0, relY: 0.5 });
            this.outPorts.push({ id: 'out0', label: '', relX: 1.0, relY: 0.5 });
        }
    }

    /**
     * Initializes internal dynamic states to steady state equilibrium.
     * @param {number[]} inputs - Array of input values at t = 0
     */
    initialize(inputs = [0.0]) {
        this.state.prevInput = inputs[0] || 0.0;
        this.state.initialized = true;

        if (this.type === BlockType.INPUT) {
            this.state.output = inputs[0] !== undefined ? inputs[0] : (this.params.customValue ?? 0.0);
        } else if (this.type === BlockType.CONSTANT) {
            this.state.output = Number(this.params.value) || 0.0;
        } else if (this.type === BlockType.GAIN) {
            this.state.output = (Number(this.params.gain) || 1.0) * (inputs[0] || 0.0);
        } else if (this.type === BlockType.SUM) {
            let sum = 0.0;
            const signs = this.params.signs || ['+', '-'];
            for (let i = 0; i < signs.length; i++) {
                const s = signs[i] === '-' ? -1.0 : 1.0;
                sum += s * (inputs[i] || 0.0);
            }
            this.state.output = sum;
        } else if (this.type === BlockType.LIMITER) {
            const val = inputs[0] || 0.0;
            this.state.output = Math.max(this.params.min, Math.min(this.params.max, val));
        } else if (this.type === BlockType.TRANSFER_FUNCTION) {
            // Steady state gain G(0) = num[last] / den[last]
            const num = this.params.numerator || [1.0];
            const den = this.params.denominator || [1.0];
            const b0 = num[num.length - 1];
            const a0 = den[den.length - 1];
            const dcGain = Math.abs(a0) > 1e-9 ? b0 / a0 : 1.0;
            
            const u0 = inputs[0] || 0.0;
            this.state.output = dcGain * u0;
            this.state.prevOutput = this.state.output;
            this.state.prevInput = u0;
            this.state.states = new Array(Math.max(1, den.length - 1)).fill(this.state.output);
        } else if (this.type === BlockType.MULTIPLIER) {
            this.state.output = (inputs[0] || 0.0) * (inputs[1] || 0.0);
        } else {
            this.state.output = inputs[0] || 0.0;
        }

        this.state.prevOutput = this.state.output;
        return this.state.output;
    }

    /**
     * Executes one time-step evaluation of the block
     * @param {number[]} inputs - Array of input values from connected wires
     * @param {number} dt - Time step in seconds
     * @returns {number} Output value
     */
    evaluate(inputs = [0.0], dt = 0.005) {
        const u = inputs[0] || 0.0;

        switch (this.type) {
            case BlockType.INPUT:
                this.state.output = inputs[0] !== undefined ? inputs[0] : (this.params.customValue || 0.0);
                break;

            case BlockType.OUTPUT:
                this.state.output = u;
                break;

            case BlockType.CONSTANT:
                this.state.output = Number(this.params.value) || 0.0;
                break;

            case BlockType.GAIN:
                this.state.output = (Number(this.params.gain) || 1.0) * u;
                break;

            case BlockType.SUM: {
                let sum = 0.0;
                const signs = this.params.signs || ['+', '-'];
                for (let i = 0; i < signs.length; i++) {
                    const s = signs[i] === '-' ? -1.0 : 1.0;
                    sum += s * (inputs[i] || 0.0);
                }
                this.state.output = sum;
                break;
            }

            case BlockType.MULTIPLIER:
                this.state.output = (inputs[0] || 0.0) * (inputs[1] || 0.0);
                break;

            case BlockType.LIMITER:
                this.state.output = Math.max(this.params.min, Math.min(this.params.max, u));
                break;

            case BlockType.RATE_LIMITER: {
                const diff = u - this.state.prevOutput;
                const maxDeltaUp = (this.params.upLimit || 10.0) * dt;
                const maxDeltaDown = (this.params.downLimit || -10.0) * dt;
                const clampedDiff = Math.max(maxDeltaDown, Math.min(maxDeltaUp, diff));
                this.state.output = this.state.prevOutput + clampedDiff;
                break;
            }

            case BlockType.TRANSFER_FUNCTION: {
                // Bilinear Tustin transform for 1st order / Lead-Lag, or Trapezoidal state-space
                const num = this.params.numerator || [1.0];
                const den = this.params.denominator || [0.05, 1.0];

                if (den.length === 2 && num.length === 1) {
                    // First order lag: G(s) = K / (1 + s T)
                    const T = Math.max(1e-5, den[0]);
                    const K = num[0];
                    const alpha = dt / (2.0 * T + dt);
                    this.state.output = (1.0 - 2.0 * alpha) * this.state.prevOutput + alpha * K * (u + this.state.prevInput);
                } else if (den.length === 2 && num.length === 2) {
                    // Lead-Lag compensator: G(s) = (1 + s T1) / (1 + s T2) or (b1 s + b0) / (a1 s + a0)
                    const b1 = num[0], b0 = num[1];
                    const a1 = den[0], a0 = den[1];
                    const denT = 2.0 * a1 + a0 * dt;
                    if (Math.abs(denT) > 1e-9) {
                        const c0 = (2.0 * b1 + b0 * dt) / denT;
                        const c1 = (b0 * dt - 2.0 * b1) / denT;
                        const d1 = (a0 * dt - 2.0 * a1) / denT;
                        this.state.output = c0 * u + c1 * this.state.prevInput - d1 * this.state.prevOutput;
                    } else {
                        this.state.output = u;
                    }
                } else if (den.length === 2 && den[1] === 0.0) {
                    // Pure integrator: G(s) = K / s
                    const K = num[0] || 1.0;
                    this.state.output = this.state.prevOutput + 0.5 * dt * K * (u + this.state.prevInput);
                } else {
                    // Higher-order fallback: 1st order approximation
                    const T = Math.max(1e-4, den[0] || 0.05);
                    const K = num[num.length - 1] / (den[den.length - 1] || 1.0);
                    const alpha = dt / (T + dt);
                    this.state.output = (1.0 - alpha) * this.state.prevOutput + alpha * K * u;
                }
                break;
            }

            default:
                this.state.output = u;
                break;
        }

        this.state.prevInput = u;
        this.state.prevOutput = this.state.output;
        return this.state.output;
    }

    /**
     * Serializes block to JSON object
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            params: JSON.parse(JSON.stringify(this.params))
        };
    }

    /**
     * Recreates block from serialized JSON
     */
    static fromJSON(json) {
        const blk = new ControlBlock(json.type, json.x, json.y, json.name);
        blk.id = json.id || blk.id;
        blk.width = json.width || blk.width;
        blk.height = json.height || blk.height;
        blk.params = json.params || blk.params;
        blk.setupPorts();
        return blk;
    }
}
