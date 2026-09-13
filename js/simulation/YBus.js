import { Complex } from '../core/Complex.js';

export class YBus {
    /**
     * Constructs the nodal admittance matrix Ybus for a power system model.
     * @param {Model} model - Network model
     * @returns {{ Y: Complex[][], busIndexMap: Map<Bus, number>, busList: Bus[] }}
     */
    static build(model) {
        const busList = model.buses.filter(b => b.isOnline);
        const n = busList.length;
        const busIndexMap = new Map();
        busList.forEach((bus, idx) => busIndexMap.set(bus, idx));

        // Initialize NxN complex zero matrix
        const Y = Array.from({ length: n }, () =>
            Array.from({ length: n }, () => new Complex(0.0, 0.0))
        );

        // 1. Transmission Lines
        for (const line of model.lines) {
            if (!line.isEffectivelyOnline() || !line.fromBus || !line.toBus) continue;
            const i = busIndexMap.get(line.fromBus);
            const j = busIndexMap.get(line.toBus);
            if (i === undefined || j === undefined || i === j) continue;

            const z = new Complex(line.resistance, line.indReactance);
            if (z.abs() < 1e-9) continue;
            const ySeries = z.inv();
            const bHalf = new Complex(0.0, (line.susceptance || 0.0) / 2.0);

            // Diagonal
            Y[i][i] = Y[i][i].add(ySeries).add(bHalf);
            Y[j][j] = Y[j][j].add(ySeries).add(bHalf);

            // Off-diagonal
            Y[i][j] = Y[i][j].sub(ySeries);
            Y[j][i] = Y[j][i].sub(ySeries);
        }

        // 1b. Half-open lines: line disconnected at one end but still
        // energized from the other end. The open line behaves as a shunt
        // capacitor (line charging) at the still-connected bus:
        // the full susceptance B is injected there.
        for (const line of model.lines) {
            if (!line.isHalfOpen || !line.fromBus || !line.toBus) continue;
            const bCharging = line.susceptance || 0.0;
            if (Math.abs(bCharging) < 1e-12) continue;
            // Terminal closed side is the one still connected to the network
            const connBus = line.breakerFrom !== false ? line.fromBus : line.toBus;
            const i = busIndexMap.get(connBus);
            if (i === undefined) continue;
            Y[i][i] = Y[i][i].add(new Complex(0.0, bCharging));
        }

        // 2. Transformers with tap ratio 'a' and phase shift 'phi'
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
            const aComplex = Complex.fromPolar(a, phiRad);
            const aConj = Complex.fromPolar(a, -phiRad);

            // Standard transformer pi-model:
            // Y_ii += yT / a^2
            // Y_jj += yT
            // Y_ij -= yT / a*
            // Y_ji -= yT / a
            const yii = yT.div(a * a);
            const yjj = yT;
            const yij = yT.div(aConj).neg();
            const yji = yT.div(aComplex).neg();

            Y[i][i] = Y[i][i].add(yii);
            Y[j][j] = Y[j][j].add(yjj);
            Y[i][j] = Y[i][j].add(yij);
            Y[j][i] = Y[j][i].add(yji);
        }

        // 3. Shunts (Capacitors & Inductors)
        for (const cap of model.capacitors) {
            if (!cap.isOnline || !cap.parentBus) continue;
            const i = busIndexMap.get(cap.parentBus);
            if (i === undefined) continue;
            // Q (Mvar) = V^2 * B -> at 1.0 p.u., B (p.u.) = Q / BasePower
            const bCap = cap.nominalReactivePower / model.basePower;
            Y[i][i] = Y[i][i].add(new Complex(0.0, bCap));
        }

        for (const ind of model.inductors) {
            if (!ind.isOnline || !ind.parentBus) continue;
            const i = busIndexMap.get(ind.parentBus);
            if (i === undefined) continue;
            const bInd = -ind.nominalReactivePower / model.basePower;
            Y[i][i] = Y[i][i].add(new Complex(0.0, bInd));
        }

        // Bus direct shunt terms if any
        for (const bus of busList) {
            const i = busIndexMap.get(bus);
            if (bus.gShunt || bus.bShunt) {
                Y[i][i] = Y[i][i].add(new Complex(bus.gShunt || 0.0, bus.bShunt || 0.0));
            }
        }

        return { Y, busIndexMap, busList };
    }
}
