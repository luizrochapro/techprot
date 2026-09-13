import { Complex } from '../core/Complex.js';
import { Matrix } from '../core/Matrix.js';

export class Harmonics {
    /**
     * Calculates harmonic voltages and THD (Total Harmonic Distortion) across all buses.
     * @param {Model} model
     * @param {number[]} harmonicOrders - e.g. [3, 5, 7, 9, 11, 13]
     */
    static solve(model, harmonicOrders = [3, 5, 7, 9, 11, 13]) {
        const busList = model.buses.filter(b => b.isOnline);
        const n = busList.length;
        if (n === 0) return { success: false, message: 'No online buses' };

        const busIndexMap = new Map();
        busList.forEach((b, idx) => busIndexMap.set(b, idx));

        // Results storage
        const thdResults = new Map(); // Bus -> { thdPercent, spectrum: { h: vMag } }
        busList.forEach(b => thdResults.set(b, { thdPercent: 0.0, spectrum: {} }));

        for (const h of harmonicOrders) {
            // Build Ybus at harmonic order h
            const Yh = Array.from({ length: n }, () =>
                Array.from({ length: n }, () => new Complex(0.0, 0.0))
            );

            // Lines: R + j * h * X, shunt B * h
            for (const line of model.lines) {
                if (!line.isEffectivelyOnline() || !line.fromBus || !line.toBus) continue;
                const i = busIndexMap.get(line.fromBus);
                const j = busIndexMap.get(line.toBus);
                if (i === undefined || j === undefined) continue;

                const zh = new Complex(line.resistance, line.indReactance * h);
                const yh = zh.inv();
                const bHalf = new Complex(0.0, (line.susceptance * h) / 2.0);

                Yh[i][i] = Yh[i][i].add(yh).add(bHalf);
                Yh[j][j] = Yh[j][j].add(yh).add(bHalf);
                Yh[i][j] = Yh[i][j].sub(yh);
                Yh[j][i] = Yh[j][i].sub(yh);
            }

            // Transformers
            for (const transf of model.transformers) {
                if (!transf.isEffectivelyOnline() || !transf.fromBus || !transf.toBus) continue;
                const i = busIndexMap.get(transf.fromBus);
                const j = busIndexMap.get(transf.toBus);
                if (i === undefined || j === undefined) continue;

                const zh = new Complex(transf.resistance, transf.indReactance * h);
                const yh = zh.inv();
                const a = transf.turnsRatio || 1.0;

                Yh[i][i] = Yh[i][i].add(yh.div(a * a));
                Yh[j][j] = Yh[j][j].add(yh);
                Yh[i][j] = Yh[i][j].sub(yh.div(a));
                Yh[j][i] = Yh[j][i].sub(yh.div(a));
            }

            // Capacitors: B * h
            for (const cap of model.capacitors) {
                if (!cap.isOnline || !cap.parentBus) continue;
                const i = busIndexMap.get(cap.parentBus);
                if (i === undefined) continue;
                const bCap = (cap.nominalReactivePower / model.basePower) * h;
                Yh[i][i] = Yh[i][i].add(new Complex(0.0, bCap));
            }

            // Inductors: B / h
            for (const ind of model.inductors) {
                if (!ind.isOnline || !ind.parentBus) continue;
                const i = busIndexMap.get(ind.parentBus);
                if (i === undefined) continue;
                const bInd = (-ind.nominalReactivePower / model.basePower) / h;
                Yh[i][i] = Yh[i][i].add(new Complex(0.0, bInd));
            }

            // Injected harmonic currents: e.g. typical non-linear load harmonic spectrum
            // Ih ~ I1 / h
            const Ih = Array.from({ length: n }, () => new Complex(0.0, 0.0));
            for (const ld of model.loads) {
                if (!ld.isOnline || !ld.parentBus) continue;
                const i = busIndexMap.get(ld.parentBus);
                if (i === undefined) continue;
                const iFund = (ld.activePower / model.basePower);
                // Standard 6-pulse characteristic harmonics injection for 5th, 7th, 11th, 13th
                if (h === 5 || h === 7 || h === 11 || h === 13) {
                    const iHarm = (iFund / h) * 0.5;
                    Ih[i] = Ih[i].add(new Complex(0.0, -iHarm));
                }
            }

            // Solve Yh * Vh = Ih
            let Vh;
            try {
                Vh = Matrix.solveComplexSystem(Yh, Ih);
            } catch (e) {
                console.warn(`Singular matrix at harmonic order ${h}`);
                Vh = Array.from({ length: n }, () => new Complex(0, 0));
            }

            for (let i = 0; i < n; i++) {
                const bus = busList[i];
                const res = thdResults.get(bus);
                res.spectrum[h] = Vh[i].abs();
            }
        }

        // Compute THD: sqrt(sum(Vh^2)) / V1 * 100%
        for (const bus of busList) {
            const res = thdResults.get(bus);
            const v1 = bus.results?.v || 1.0;
            let sumSq = 0.0;
            for (const h of harmonicOrders) {
                const vh = res.spectrum[h] || 0.0;
                sumSq += vh * vh;
            }
            res.thdPercent = (Math.sqrt(sumSq) / v1) * 100.0;
            bus.results.thd = res.thdPercent;
        }

        model.updateAllLabels();

        return {
            success: true,
            thdResults,
            message: 'Harmonics and THD analysis completed.'
        };
    }
}
