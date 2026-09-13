import { Complex } from '../core/Complex.js';
import { Matrix } from '../core/Matrix.js';
import { YBus } from './YBus.js';
import { PowerFlow } from './PowerFlow.js';

/**
 * Stability.js - Electromechanical Transient Stability Simulation Engine (TechProt)
 * 
 * Simulates power system dynamics under major disturbances:
 * - Multi-machine swing equation integration (Modified-Euler / Heun predictor-corrector)
 * - Classical (constant E') and Two-Axis Transient (flux decay) generator models
 * - Dynamic network interface: constant impedance loads and Norton generator equivalents
 * - Full disturbance event timeline: 3-phase bus faults, line tripping/reclosing, generator trips, load shedding
 * - Center of Inertia (COI) coordinates and synchronism loss detector (transient stability margin)
 */
export class Stability {
    /**
     * Executes the electromechanical transient stability simulation.
     * @param {Model} model - Power system model
     * @param {Array<Object>} [customEvents] - Optional disturbance events list
     * @param {Object} [customSettings] - Optional stability simulation parameters
     * @returns {{ success: boolean, isStable: boolean, maxSpread: number, margin: number, message: string, time: number[], events: Array<Object>, generators: Array<Object>, buses: Array<Object> }}
     */
    static solve(model, customEvents = null, customSettings = null) {
        const tStart = performance.now();

        // 1. Configuration settings
        const settings = {
            simTime: 5.0,
            timeStep: 0.005,
            plotStep: 0.01,
            frequency: 60.0,
            tolerance: 1e-5,
            maxIterations: 50,
            useCOI: true,
            method: 'Modified-Euler',
            ...(model.stabilitySettings || {}),
            ...(customSettings || {})
        };

        const baseMVA = model.basePower || 100.0;
        const f0 = settings.frequency || 60.0;
        const w0 = 2.0 * Math.PI * f0;
        const dt = settings.timeStep || 0.005;
        const tTotal = settings.simTime || 5.0;
        const plotInterval = Math.max(dt, settings.plotStep || 0.01);

        // 2. Pre-fault AC Power Flow initialization (t = 0-)
        const pfResult = PowerFlow.solve(model);
        if (!pfResult.success) {
            return {
                success: false,
                isStable: false,
                maxSpread: 0,
                margin: 0,
                message: `Falha na convergência do fluxo de carga pré-falta: ${pfResult.message}`,
                time: [],
                events: [],
                generators: [],
                buses: []
            };
        }

        const onlineBuses = model.buses.filter(b => b.isOnline);
        const onlineGens = model.generators.filter(g => g.isOnline && g.parentBus && g.parentBus.isOnline);

        if (onlineGens.length === 0) {
            return {
                success: false,
                isStable: false,
                maxSpread: 0,
                margin: 0,
                message: 'Nenhum gerador síncrono em operação no sistema.',
                time: [],
                events: [],
                generators: [],
                buses: []
            };
        }

        const busIndexMap = new Map();
        onlineBuses.forEach((b, idx) => busIndexMap.set(b, idx));
        const numBuses = onlineBuses.length;

        // 3. Convert Loads to constant impedance admittances (YL = (PL - j QL) / |V|^2)
        const loadAdmittances = new Map();
        for (const load of model.loads) {
            if (!load.isOnline || !load.parentBus || !busIndexMap.has(load.parentBus)) continue;
            const b = load.parentBus;
            const vMag = Math.max(0.1, b.results?.v || b.voltageMagnitude || 1.0);
            const pPu = (load.activePower || 0.0) / baseMVA;
            const qPu = (load.reactivePower || 0.0) / baseMVA;
            const yLoad = new Complex(pPu / (vMag * vMag), -qPu / (vMag * vMag));
            
            const curY = loadAdmittances.get(b) || new Complex(0.0, 0.0);
            loadAdmittances.set(b, curY.add(yLoad));
        }

        // 4. Initialize Synchronous Generators dynamic states
        const genDynamics = [];
        let totalInertia = 0.0;

        for (const gen of onlineGens) {
            const bus = gen.parentBus;
            const busIdx = busIndexMap.get(bus);
            const vMag = bus.results?.v || bus.voltageMagnitude || 1.0;
            const vAngRad = ((bus.results?.angle ?? bus.voltageAngle ?? 0.0) * Math.PI) / 180.0;
            const Vt0 = Complex.fromPolar(vMag, vAngRad);

            // Active and Reactive power output from pre-fault power flow solution
            const pMW = (gen.results && gen.results.p !== undefined) ? gen.results.p : gen.activePower;
            const qMvar = (gen.results && gen.results.q !== undefined) ? gen.results.q : gen.reactivePower;
            const pPu = pMW / baseMVA;
            const qPu = qMvar / baseMVA;

            // Generator terminal current I0 = (S / Vt)*
            const conjS = new Complex(pPu, -qPu);
            const Ig0 = conjS.div(Vt0.conj());

            // Machine parameters
            let kBase = 1.0;
            if (gen.useMachineBase && gen.nominalPower > 0) {
                kBase = baseMVA / gen.nominalPower;
            }

            const H = Math.max(0.1, (gen.inertia ?? 5.0));
            const D = (gen.damping ?? 0.0);
            const Ra = (gen.ra ?? 0.005) * kBase;
            const Xdp = (gen.transXd ?? gen.xdp ?? 0.25) * kBase;
            const Xd = (gen.syncXd ?? gen.xd ?? 1.2) * kBase;
            const Xq = (gen.syncXq ?? 0.8) * kBase;
            const Td0p = (gen.transTd0 ?? 5.0);
            const modelType = gen.modelType ?? 1; // 1 = Classical, 2 = Transient (flux decay)

            // Internal voltage behind transient reactance: E' = Vt0 + (Ra + j X'd) * Ig0
            const Zg = new Complex(Ra, Xdp);
            const Ep0 = Vt0.add(Zg.mul(Ig0));

            const delta0 = Math.atan2(Ep0.im, Ep0.re);
            const EpMag0 = Ep0.abs();

            // Initial mechanical power Pm0 = Pe0 + Ra * |Ig0|^2
            const Pe0 = Vt0.re * Ig0.re + Vt0.im * Ig0.im + Ra * Ig0.absSq();
            const Pm0 = Pe0;

            // Norton equivalent admittance yG = 1 / (Ra + j X'd)
            const yNorton = Zg.inv();

            // Direct-axis and quadrature-axis components
            const Id0 = -Ig0.re * Math.sin(delta0) + Ig0.im * Math.cos(delta0);
            const Iq0 = Ig0.re * Math.cos(delta0) + Ig0.im * Math.sin(delta0);
            const Eqp0 = EpMag0;
            const Efd0 = Eqp0 + (Xd - Xdp) * Id0;

            totalInertia += H;

            // Control Systems: AVR (Exciter) and Speed Governor
            let avrSolver = null;
            let avrBaseOutput = 0.0;
            let effectiveModelType = modelType;

            if (gen.useAVR && gen.avrDiagram) {
                avrSolver = gen.avrDiagram.clone();
                avrBaseOutput = avrSolver.initialize({
                    terminal_voltage: Vt0.abs(),
                    voltage_ref: Vt0.abs(),
                    initial_efd: Efd0
                });
                effectiveModelType = 2; // AVR requires transient flux decay (E'q dynamic)
            }

            let govSolver = null;
            let govBaseOutput = 0.0;
            if (gen.useSpeedGovernor && gen.speedGovDiagram) {
                govSolver = gen.speedGovDiagram.clone();
                govBaseOutput = govSolver.initialize({
                    speed: 1.0,
                    speed_deviation: 0.0,
                    active_power: pPu,
                    initial_pm: Pm0
                });
            }

            genDynamics.push({
                element: gen,
                bus,
                busIdx,
                H,
                D,
                Ra,
                Xdp,
                Xd,
                Xq,
                Td0p,
                modelType: effectiveModelType,
                yNorton,
                avrSolver,
                avrBaseOutput,
                govSolver,
                govBaseOutput,
                Vt0,
                // Dynamic states
                delta: delta0,
                omegaPu: 1.0,
                Eqp: Eqp0,
                // Initial equilibrium
                delta0,
                omegaPu0: 1.0,
                Pm0,
                Pm: Pm0,
                Efd0,
                Efd: Efd0,
                currentVfd: Efd0,
                currentPm: Pm0,
                // Current step values
                Pe: Pe0,
                Vt: Vt0,
                Ig: Ig0,
                isTripped: false,
                // Recorded time series
                series: {
                    time: [],
                    deltaDeg: [],
                    deltaCOIDeg: [],
                    speedPu: [],
                    freqHz: [],
                    peMW: [],
                    vtPu: [],
                    vfdPu: [],
                    pmMW: []
                }
            });
        }

        // 5. Setup Disturbance Event Timeline
        const rawEvents = customEvents || model.stabilityEvents || [];
        const eventTimeline = [];

        // Check for bus-specific stability fault properties if not explicitly listed
        for (const bus of model.buses) {
            if (bus.stabHasFault && busIndexMap.has(bus)) {
                eventTimeline.push({
                    type: 'fault',
                    time: bus.stabFaultTime || 1.0,
                    duration: bus.stabFaultLength || 0.10,
                    targetBus: bus,
                    rFault: bus.stabFaultResistance || 0.0,
                    xFault: Math.max(1e-5, bus.stabFaultReactance || 0.0001),
                    description: `Curto-circuito trifásico na ${bus.name}`
                });
            }
        }

        for (const evt of rawEvents) {
            let target = evt.targetBus || evt.targetElement || evt.target;
            if (typeof target === 'string') {
                target = model.buses.find(b => b.name === target || b.id === target) ||
                         model.lines.find(l => l.name === target || l.id === target) ||
                         model.generators.find(g => g.name === target || g.id === target) ||
                         model.loads.find(ld => ld.name === target || ld.id === target) ||
                         target;
            }

            eventTimeline.push({
                type: evt.type, // 'fault', 'clear_fault', 'trip_line', 'close_line', 'trip_gen', 'load_shed'
                time: Number(evt.time) || 0.0,
                duration: Number(evt.duration) || 0.1,
                target,
                rFault: Number(evt.rFault || 0.0),
                xFault: Math.max(1e-5, Number(evt.xFault || 0.0001)),
                description: evt.description || `Evento em ${evt.time}s`
            });
        }

        // Expand faults into inception + clearing events
        const processedEvents = [];
        for (const evt of eventTimeline) {
            if (evt.type === 'fault') {
                const tInception = evt.time;
                const tClear = evt.time + (evt.duration || 0.10);
                processedEvents.push({
                    type: 'fault_apply',
                    time: tInception,
                    targetBus: evt.targetBus || evt.target,
                    rFault: evt.rFault,
                    xFault: evt.xFault,
                    description: evt.description || `Aplicação de curto-circuito (${tInception.toFixed(3)}s)`
                });
                processedEvents.push({
                    type: 'fault_clear',
                    time: tClear,
                    targetBus: evt.targetBus || evt.target,
                    rFault: evt.rFault,
                    xFault: evt.xFault,
                    description: `Eliminação do curto-circuito (${tClear.toFixed(3)}s)`
                });
            } else {
                processedEvents.push(evt);
            }
        }

        // Sort events chronologically
        processedEvents.sort((a, b) => a.time - b.time);

        // Visual markers for charts
        const chartMarkers = [];

        // 6. Network Admittance Builder & Solver
        let activeFaults = [];   // [{ bus, yFault }]
        let trippedLines = new Set();
        let trippedGens = new Set();
        let shedLoads = new Set();

        let currentZaug = null;
        let networkDirty = true;

        const rebuildAugmentedYBus = () => {
            // Build base Ybus with online elements
            const Y = Array.from({ length: numBuses }, () =>
                Array.from({ length: numBuses }, () => new Complex(0.0, 0.0))
            );

            // Transmission Lines
            for (const line of model.lines) {
                if (!line.isEffectivelyOnline() || trippedLines.has(line)) continue;
                if (!line.fromBus || !line.toBus) continue;
                const i = busIndexMap.get(line.fromBus);
                const j = busIndexMap.get(line.toBus);
                if (i === undefined || j === undefined || i === j) continue;

                const z = new Complex(line.resistance, line.indReactance);
                if (z.abs() < 1e-9) continue;
                const ySeries = z.inv();
                const bHalf = new Complex(0.0, (line.susceptance || 0.0) / 2.0);

                Y[i][i] = Y[i][i].add(ySeries).add(bHalf);
                Y[j][j] = Y[j][j].add(ySeries).add(bHalf);
                Y[i][j] = Y[i][j].sub(ySeries);
                Y[j][i] = Y[j][i].sub(ySeries);
            }

            // Transformers
            for (const transf of model.transformers) {
                if (!transf.isEffectivelyOnline() || !transf.fromBus || !transf.toBus) continue;
                const i = busIndexMap.get(transf.fromBus);
                const j = busIndexMap.get(transf.toBus);
                if (i === undefined || j === undefined || i === j) continue;

                const z = new Complex(transf.resistance, transf.indReactance);
                if (z.abs() < 1e-9) continue;
                const yT = z.inv();

                const a = transf.turnsRatio || 1.0;
                const phiRad = ((transf.phaseShift || 0.0) * Math.PI) / 180.0;
                const aC = Complex.fromPolar(a, phiRad);
                const aConj = Complex.fromPolar(a, -phiRad);

                Y[i][i] = Y[i][i].add(yT.div(a * a));
                Y[j][j] = Y[j][j].add(yT);
                Y[i][j] = Y[i][j].sub(yT.div(aConj));
                Y[j][i] = Y[j][i].sub(yT.div(aC));
            }

            // Shunt Capacitors / Inductors
            for (const cap of model.capacitors) {
                if (!cap.isOnline || !cap.parentBus) continue;
                const i = busIndexMap.get(cap.parentBus);
                if (i !== undefined) {
                    const bPu = (cap.reactivePower || 0.0) / baseMVA;
                    Y[i][i] = Y[i][i].add(new Complex(0.0, bPu));
                }
            }

            for (const ind of model.inductors) {
                if (!ind.isOnline || !ind.parentBus) continue;
                const i = busIndexMap.get(ind.parentBus);
                if (i !== undefined) {
                    const bPu = (ind.reactivePower || 0.0) / baseMVA;
                    Y[i][i] = Y[i][i].sub(new Complex(0.0, bPu));
                }
            }

            // Constant Impedance Loads
            for (const [bus, yLoad] of loadAdmittances.entries()) {
                if (shedLoads.has(bus)) continue;
                const i = busIndexMap.get(bus);
                if (i !== undefined) {
                    Y[i][i] = Y[i][i].add(yLoad);
                }
            }

            // Synchronous Generators Norton Equivalent Admittances
            for (const gDyn of genDynamics) {
                if (gDyn.isTripped || trippedGens.has(gDyn.element)) continue;
                const i = gDyn.busIdx;
                if (i !== undefined) {
                    Y[i][i] = Y[i][i].add(gDyn.yNorton);
                }
            }

            // Active Disturbance Faults
            for (const f of activeFaults) {
                const i = busIndexMap.get(f.bus);
                if (i !== undefined) {
                    Y[i][i] = Y[i][i].add(f.yFault);
                }
            }

            // Invert augmented admittance matrix: Zaug = Yaug^-1
            currentZaug = Matrix.invertComplexMatrix(Y);
            networkDirty = false;
        };

        // Initialize Zaug
        rebuildAugmentedYBus();

        // 7. Solve Network Voltages and Generator Powers given states
        const solveNetwork = (states) => {
            if (networkDirty) {
                rebuildAugmentedYBus();
            }

            // Injected currents vector (non-zero only at generator buses)
            const Iinj = Array.from({ length: numBuses }, () => new Complex(0.0, 0.0));

            for (let k = 0; k < genDynamics.length; k++) {
                const gDyn = genDynamics[k];
                if (gDyn.isTripped || trippedGens.has(gDyn.element)) continue;

                const st = states[k];
                const delta = st.delta;
                const Eqp = gDyn.modelType === 2 ? st.Eqp : gDyn.Eqp;

                // Generator internal voltage phasor: E' = |E'| * e^(j*delta)
                const Ep = Complex.fromPolar(Eqp, delta);

                const iGenInj = gDyn.yNorton.mul(Ep);
                Iinj[gDyn.busIdx] = Iinj[gDyn.busIdx].add(iGenInj);
            }

            // V = Zaug * Iinj
            const V = new Array(numBuses);
            for (let i = 0; i < numBuses; i++) {
                let vSum = new Complex(0.0, 0.0);
                const row = currentZaug[i];
                for (let j = 0; j < numBuses; j++) {
                    vSum = vSum.add(row[j].mul(Iinj[j]));
                }
                V[i] = vSum;
            }

            // Compute generator currents and electrical active powers
            const Pe = new Float64Array(genDynamics.length);
            const IgList = new Array(genDynamics.length);

            for (let k = 0; k < genDynamics.length; k++) {
                const gDyn = genDynamics[k];
                if (gDyn.isTripped || trippedGens.has(gDyn.element)) {
                    Pe[k] = 0.0;
                    IgList[k] = new Complex(0.0, 0.0);
                    continue;
                }

                const st = states[k];
                const delta = st.delta;
                const Eqp = gDyn.modelType === 2 ? st.Eqp : gDyn.Eqp;

                const Ep = Complex.fromPolar(Eqp, delta);
                const Vt = V[gDyn.busIdx];
                // Current flowing from internal EMF through (Ra + j X'd) into network:
                const Ig = Ep.sub(Vt).mul(gDyn.yNorton);
                IgList[k] = Ig;

                // Electrical active power delivered by machine: Pe = Re(Vt * Ig*) + Ra * |Ig|^2
                const peVal = Vt.re * Ig.re + Vt.im * Ig.im + gDyn.Ra * Ig.absSq();
                Pe[k] = peVal;
            }

            return { V, Pe, IgList };
        };

        // 8. Dynamic derivatives calculation
        const evaluateDerivatives = (states, Pe, IgList) => {
            const dDelta = new Float64Array(genDynamics.length);
            const dOmega = new Float64Array(genDynamics.length);
            const dEqp = new Float64Array(genDynamics.length);

            for (let k = 0; k < genDynamics.length; k++) {
                const gDyn = genDynamics[k];
                if (gDyn.isTripped || trippedGens.has(gDyn.element)) {
                    dDelta[k] = 0.0;
                    dOmega[k] = 0.0;
                    dEqp[k] = 0.0;
                    continue;
                }

                const st = states[k];
                // Swing Equation:
                // d(delta)/dt = w0 * (omega_pu - 1.0)
                dDelta[k] = w0 * (st.omegaPu - 1.0);

                // d(omega_pu)/dt = 1 / (2H) * [ Pm - Pe - D * (omega_pu - 1.0) ]
                const accelPower = gDyn.Pm - Pe[k] - gDyn.D * (st.omegaPu - 1.0);
                dOmega[k] = accelPower / (2.0 * gDyn.H);

                // Two-axis flux decay:
                if (gDyn.modelType === 2) {
                    const Ig = IgList[k];
                    const Id = -Ig.re * Math.sin(st.delta) + Ig.im * Math.cos(st.delta);
                    dEqp[k] = (gDyn.Efd - st.Eqp - (gDyn.Xd - gDyn.Xdp) * Id) / gDyn.Td0p;
                } else {
                    dEqp[k] = 0.0;
                }
            }

            return { dDelta, dOmega, dEqp };
        };

        // 9. Time Integration Loop (Modified Euler Predictor-Corrector)
        let tCurrent = 0.0;
        let lastPlotTime = -1.0;
        let eventIdx = 0;

        let curStates = genDynamics.map(g => ({
            delta: g.delta,
            omegaPu: g.omegaPu,
            Eqp: g.Eqp
        }));

        let maxAngleSpreadGlobal = 0.0;
        let isSystemStable = true;
        const unstableGenNames = new Set();

        const timeRecord = [];
        const busRecords = onlineBuses.map(b => ({
            bus: b,
            time: [],
            vPu: [],
            angleDeg: []
        }));

        while (tCurrent <= tTotal + 1e-7) {
            // Process any events occurring at tCurrent
            while (eventIdx < processedEvents.length && processedEvents[eventIdx].time <= tCurrent + 1e-6) {
                const evt = processedEvents[eventIdx];
                eventIdx++;

                if (evt.type === 'fault_apply') {
                    const zF = new Complex(evt.rFault, evt.xFault);
                    const yF = zF.inv();
                    activeFaults.push({ bus: evt.targetBus, yFault: yF });
                    networkDirty = true;
                    chartMarkers.push({
                        time: evt.time,
                        label: `Curto-circuito na ${evt.targetBus?.name || 'Barra'}`,
                        color: '#ef4444'
                    });
                } else if (evt.type === 'fault_clear') {
                    activeFaults = activeFaults.filter(f => f.bus !== evt.targetBus);
                    networkDirty = true;
                    chartMarkers.push({
                        time: evt.time,
                        label: `Curto eliminado na ${evt.targetBus?.name || 'Barra'}`,
                        color: '#10b981'
                    });
                } else if (evt.type === 'trip_line') {
                    trippedLines.add(evt.target);
                    networkDirty = true;
                    chartMarkers.push({
                        time: evt.time,
                        label: `Abertura LT ${evt.target?.name || ''}`,
                        color: '#f59e0b'
                    });
                } else if (evt.type === 'close_line') {
                    trippedLines.delete(evt.target);
                    networkDirty = true;
                    chartMarkers.push({
                        time: evt.time,
                        label: `Religamento LT ${evt.target?.name || ''}`,
                        color: '#06b6d4'
                    });
                } else if (evt.type === 'trip_gen') {
                    trippedGens.add(evt.target);
                    networkDirty = true;
                    chartMarkers.push({
                        time: evt.time,
                        label: `Desligamento Gerador ${evt.target?.name || ''}`,
                        color: '#ec4899'
                    });
                } else if (evt.type === 'load_shed') {
                    shedLoads.add(evt.target);
                    networkDirty = true;
                    chartMarkers.push({
                        time: evt.time,
                        label: `Alívio de Carga na ${evt.target?.name || ''}`,
                        color: '#8b5cf6'
                    });
                }
            }

            // Step 1: Solve network at current state x_n
            const sol1 = solveNetwork(curStates);

            // Step Control Loops (AVR & Speed Governor)
            for (let k = 0; k < genDynamics.length; k++) {
                const gDyn = genDynamics[k];
                if (gDyn.isTripped || trippedGens.has(gDyn.element)) continue;

                const st = curStates[k];
                const Vt = sol1.V[gDyn.busIdx];
                const vtMag = Vt ? Vt.abs() : 1.0;

                // 1. AVR Execution
                if (gDyn.avrSolver) {
                    const diagOut = gDyn.avrSolver.step({
                        terminal_voltage: vtMag,
                        voltage_ref: gDyn.Vt0.abs()
                    }, dt);
                    const dVfd = diagOut - gDyn.avrBaseOutput;
                    gDyn.currentVfd = Math.max(-4.0, Math.min(6.0, gDyn.Efd0 + dVfd));
                    gDyn.Efd = gDyn.currentVfd;
                } else {
                    gDyn.currentVfd = gDyn.Efd0;
                }

                // 2. Speed Governor Execution
                if (gDyn.govSolver) {
                    const dw = st.omegaPu - 1.0;
                    const diagOut = gDyn.govSolver.step({
                        speed: st.omegaPu,
                        speed_deviation: dw
                    }, dt);
                    const dPm = diagOut - gDyn.govBaseOutput;
                    gDyn.currentPm = Math.max(0.0, gDyn.Pm0 + dPm);
                    gDyn.Pm = gDyn.currentPm;
                } else {
                    gDyn.currentPm = gDyn.Pm0;
                }
            }

            // Record data if on plot interval
            if (tCurrent - lastPlotTime >= plotInterval - 1e-6 || tCurrent === 0.0) {
                lastPlotTime = tCurrent;
                timeRecord.push(tCurrent);

                // Compute Center of Inertia (COI)
                let coiDeltaSum = 0.0;
                let coiSpeedSum = 0.0;
                let activeHSum = 0.0;

                for (let k = 0; k < genDynamics.length; k++) {
                    const gDyn = genDynamics[k];
                    if (gDyn.isTripped || trippedGens.has(gDyn.element)) continue;
                    coiDeltaSum += gDyn.H * curStates[k].delta;
                    coiSpeedSum += gDyn.H * curStates[k].omegaPu;
                    activeHSum += gDyn.H;
                }

                const deltaCOI = activeHSum > 0 ? coiDeltaSum / activeHSum : 0.0;
                const speedCOI = activeHSum > 0 ? coiSpeedSum / activeHSum : 1.0;

                let minDelta = Infinity;
                let maxDelta = -Infinity;

                for (let k = 0; k < genDynamics.length; k++) {
                    const gDyn = genDynamics[k];
                    const deltaRad = curStates[k].delta;
                    const deltaDeg = (deltaRad * 180.0) / Math.PI;
                    const deltaCOIDeg = ((deltaRad - deltaCOI) * 180.0) / Math.PI;
                    const speedPu = curStates[k].omegaPu;
                    const freqHz = speedPu * f0;
                    const peMW = sol1.Pe[k] * baseMVA;
                    const vtPu = sol1.V[gDyn.busIdx]?.abs() || 1.0;

                    gDyn.series.time.push(tCurrent);
                    gDyn.series.deltaDeg.push(deltaDeg);
                    gDyn.series.deltaCOIDeg.push(deltaCOIDeg);
                    gDyn.series.speedPu.push(speedPu);
                    gDyn.series.freqHz.push(freqHz);
                    gDyn.series.peMW.push(peMW);
                    gDyn.series.vtPu.push(vtPu);
                    gDyn.series.vfdPu.push(gDyn.currentVfd);
                    gDyn.series.pmMW.push(gDyn.currentPm * baseMVA);

                    if (!gDyn.isTripped && !trippedGens.has(gDyn.element)) {
                        if (deltaDeg < minDelta) minDelta = deltaDeg;
                        if (deltaDeg > maxDelta) maxDelta = deltaDeg;
                    }
                }

                // Synchronism spread
                if (maxDelta > -Infinity && minDelta < Infinity) {
                    const spread = maxDelta - minDelta;
                    if (spread > maxAngleSpreadGlobal) maxAngleSpreadGlobal = spread;

                    // Loss of synchronism detection: angle spread exceeds 180 deg
                    if (spread > 180.0) {
                        isSystemStable = false;
                        for (let k = 0; k < genDynamics.length; k++) {
                            const gDyn = genDynamics[k];
                            const dDeg = (curStates[k].delta * 180.0) / Math.PI;
                            if (Math.abs(dDeg - ((deltaCOI * 180) / Math.PI)) > 120.0) {
                                unstableGenNames.add(gDyn.element.name);
                            }
                        }
                    }
                }

                // Record bus voltages
                for (let i = 0; i < numBuses; i++) {
                    const vC = sol1.V[i];
                    busRecords[i].time.push(tCurrent);
                    busRecords[i].vPu.push(vC.abs());
                    busRecords[i].angleDeg.push((vC.angle() * 180.0) / Math.PI);
                }
            }

            // Predictor step: k1 = f(x_n, t_n)
            const k1 = evaluateDerivatives(curStates, sol1.Pe, sol1.IgList);

            const predStates = curStates.map((st, k) => ({
                delta: st.delta + dt * k1.dDelta[k],
                omegaPu: st.omegaPu + dt * k1.dOmega[k],
                Eqp: st.Eqp + dt * k1.dEqp[k]
            }));

            // Step 2: Solve network at predicted state x_pred
            const sol2 = solveNetwork(predStates);
            const k2 = evaluateDerivatives(predStates, sol2.Pe, sol2.IgList);

            // Corrector step: x_{n+1} = x_n + dt/2 * (k1 + k2)
            curStates = curStates.map((st, k) => ({
                delta: st.delta + 0.5 * dt * (k1.dDelta[k] + k2.dDelta[k]),
                omegaPu: st.omegaPu + 0.5 * dt * (k1.dOmega[k] + k2.dOmega[k]),
                Eqp: st.Eqp + 0.5 * dt * (k1.dEqp[k] + k2.dEqp[k])
            }));

            tCurrent += dt;
        }

        // 10. Save results onto model elements
        for (const gDyn of genDynamics) {
            gDyn.element.stabilityResults = {
                time: gDyn.series.time,
                delta: gDyn.series.deltaDeg,
                deltaCOI: gDyn.series.deltaCOIDeg,
                speed: gDyn.series.speedPu,
                freq: gDyn.series.freqHz,
                pe: gDyn.series.peMW,
                vt: gDyn.series.vtPu,
                vfd: gDyn.series.vfdPu,
                pm: gDyn.series.pmMW
            };
        }

        for (const bRec of busRecords) {
            bRec.bus.stabilityResults = {
                time: bRec.time,
                v: bRec.vPu,
                angle: bRec.angleDeg
            };
        }

        const tEnd = performance.now();
        const execMs = (tEnd - tStart).toFixed(1);

        // Calculate stability index margin: eta = (360 - maxSpread) / (360 + maxSpread) * 100%
        const margin = Math.max(0, Math.min(100, ((360.0 - maxAngleSpreadGlobal) / (360.0 + maxAngleSpreadGlobal)) * 100.0));

        const resultSummary = {
            success: true,
            isStable: isSystemStable,
            maxSpread: Number(maxAngleSpreadGlobal.toFixed(2)),
            margin: Number(margin.toFixed(1)),
            unstableGenerators: Array.from(unstableGenNames),
            executionTimeMs: Number(execMs),
            message: isSystemStable 
                ? `Sistema ESTÁVEL. Sincronismo preservado (abertura máx. = ${maxAngleSpreadGlobal.toFixed(1)}°, margem = ${margin.toFixed(1)}%). Simulado em ${execMs} ms.`
                : `Sistema INSTÁVEL! Perda de sincronismo detectada (abertura máx. = ${maxAngleSpreadGlobal.toFixed(1)}° > 180° em ${Array.from(unstableGenNames).join(', ')}).`,
            time: timeRecord,
            events: chartMarkers,
            generators: genDynamics.map(g => ({
                name: g.element.name,
                busName: g.bus.name,
                H: g.H,
                Xdp: g.Xdp,
                hasAVR: !!g.avrSolver,
                hasGovernor: !!g.govSolver,
                series: g.series
            })),
            buses: busRecords.map(b => ({
                name: b.bus.name,
                series: {
                    time: b.time,
                    vPu: b.vPu,
                    angleDeg: b.angleDeg
                }
            }))
        };

        model.lastStabilityResult = resultSummary;
        return resultSummary;
    }
}
