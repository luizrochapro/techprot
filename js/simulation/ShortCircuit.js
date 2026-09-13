import { Complex } from '../core/Complex.js';
import { Matrix } from '../core/Matrix.js';
import { YBus } from './YBus.js';
import { Bus } from '../elements/Bus.js';
import { Line } from '../elements/Line.js';

export class ShortCircuit {
    /**
     * Solves short circuit fault currents, bus post-fault voltages, and branch fault contributions.
     * @param {Model} model
     * @param {Bus|number|null} faultBus
     * @param {string|null} faultType - '3phase', '1phase-g', '2phase', '2phase-g'
     * @param {string|null} faultPhases - 'ABC', 'A', 'B', 'C', 'AB', 'BC', 'CA'
     * @param {number|null} faultR - Fault resistance (Ohms or p.u.)
     * @param {number|null} faultX - Fault reactance (Ohms or p.u.)
     * @param {string|null} faultUnit - 'ohm' or 'pu'
     */
    /**
     * Executa curto-circuito em ponto intermediário de uma linha de transmissão.
     * Cria temporariamente uma barra virtual no percentual informado, divide a
     * linha em dois segmentos proporcionais, roda a simulação normal e depois
     * restaura a linha original, gravando o resultado em line.results.faultFlowKA.
     */
    static solveLineFault(model, line, pct = 50, faultType = '3phase', faultPhases = 'ABC', faultR = 0, faultX = 0, faultUnit = 'ohm') {
        if (!line || !line.fromBus || !line.toBus) {
            return { success: false, message: 'Linha inválida para curto-circuito de meio.' };
        }

        const p = Math.min(Math.max(Number(pct) || 50, 0), 100) / 100;
        const origOnline = line.isOnline !== false;

        // 1. Cria barra virtual no ponto de falta (somente para o cálculo)
        const vx = line.fromBus.x + (line.toBus.x - line.fromBus.x) * p;
        const vy = line.fromBus.y + (line.toBus.y - line.fromBus.y) * p;
        const vbus = new Bus(vx, vy, `${line.name}_Falta`);
        vbus.nominalVoltage = line.fromBus.nominalVoltage || 138.0;
        vbus.hasFault = true;
        vbus.faultType = faultType;
        vbus.faultPhases = faultPhases;
        vbus.faultResistance = faultR;
        vbus.faultReactance = faultX;
        vbus.faultUnit = faultUnit;
        model.addBus(vbus);

        // 2. Divide a linha em dois segmentos proporcionais
        line.isOnline = false;

        const segA = new Line(line.fromBus, vbus, `${line.name}_A`);
        segA.resistance = line.resistance * p;
        segA.indReactance = line.indReactance * p;
        segA.susceptance = line.susceptance * p;
        segA.zeroResistance = (line.zeroResistance || line.resistance * 3) * p;
        segA.zeroIndReactance = (line.zeroIndReactance || line.indReactance * 3) * p;
        segA.zeroSusceptance = (line.zeroSusceptance ?? line.susceptance * 0.5) * p;
        segA.length = line.length * p;

        const segB = new Line(vbus, line.toBus, `${line.name}_B`);
        segB.resistance = line.resistance * (1 - p);
        segB.indReactance = line.indReactance * (1 - p);
        segB.susceptance = line.susceptance * (1 - p);
        segB.zeroResistance = (line.zeroResistance || line.resistance * 3) * (1 - p);
        segB.zeroIndReactance = (line.zeroIndReactance || line.indReactance * 3) * (1 - p);
        segB.zeroSusceptance = (line.zeroSusceptance ?? line.susceptance * 0.5) * (1 - p);
        segB.length = line.length * (1 - p);

        model.addLine(segA);
        model.addLine(segB);

        // 3. Executa o curto normalmente na barra virtual
        const res = ShortCircuit.solve(model, vbus, faultType, faultPhases, faultR, faultX, faultUnit);
        const iccKA = res.success ? res.faultCurrentKA : 0;

        // 4. Restaura a linha original e elimina a decomposição temporária
        model.removeElement(segA);
        model.removeElement(segB);
        model.removeElement(vbus);
        line.isOnline = origOnline;

        // 5. Armazena o resultado agregado na linha original
        line.results.faultFlowKA = iccKA;
        line.results.faultPercent = pct;

        return {
            success: res.success,
            faultCurrentKA: iccKA,
            message: res.success
                ? `Curto na linha ${line.name} a ${pct}%: Icc = ${iccKA.toFixed(3)} kA`
                : `Falha ao simular curto na linha ${line.name} a ${pct}%: ${res.message}`
        };
    }

    static solve(model, faultBus = null, faultType = null, faultPhases = null, faultR = null, faultX = null, faultUnit = null) {
        const busList = model.buses.filter(b => b.isOnline);
        const n = busList.length;
        if (n === 0) return { success: false, message: 'Nenhuma barra conectada no sistema.' };

        // 1. Determine target fault bus
        let targetBus = faultBus;
        if (typeof faultBus === 'number') {
            targetBus = model.buses.find(b => b.id === faultBus) || null;
        }
        if (!targetBus) {
            targetBus = model.buses.find(b => b.hasFault && b.isOnline) || busList[0];
        }

        const busIndexMap = new Map();
        busList.forEach((b, idx) => busIndexMap.set(b, idx));
        const k = busIndexMap.get(targetBus);
        if (k === undefined) return { success: false, message: 'Barra da falta não encontrada.' };

        // 2. Read fault parameters
        const fType = faultType || targetBus.faultType || '3phase';
        let fPhases = faultPhases || targetBus.faultPhases || 'ABC';
        let fR = (faultR !== null && faultR !== undefined) ? faultR : (targetBus.faultResistance ?? 0.0);
        let fX = (faultX !== null && faultX !== undefined) ? faultX : (targetBus.faultReactance ?? 0.0);
        const fUnit = faultUnit || targetBus.faultUnit || 'ohm';

        // Normalize phase selection according to fault type
        if (fType === '3phase') {
            fPhases = 'ABC';
        } else if (fType === '1phase-g') {
            if (!['A', 'B', 'C'].includes(fPhases)) fPhases = 'A';
        } else if (fType === '2phase' || fType === '2phase-g') {
            if (!['AB', 'BC', 'CA'].includes(fPhases)) fPhases = 'BC';
        }

        const vNomKV = targetBus.nominalVoltage || 138.0;
        const sBaseMVA = model.basePower || 100.0;
        const zBaseOhm = (vNomKV * vNomKV) / sBaseMVA;
        const iBaseKA = sBaseMVA / (Math.sqrt(3.0) * vNomKV);

        // Convert fault impedance to p.u. if entered in Ohms
        let r_pu = fR;
        let x_pu = fX;
        if (fUnit === 'ohm' && zBaseOhm > 1e-6) {
            r_pu = fR / zBaseOhm;
            x_pu = fX / zBaseOhm;
        }
        const Zf = new Complex(Math.max(0.0, r_pu), Math.max(0.0, x_pu));

        // 3. Build Sequence Admittance Matrices: Y1, Y2, Y0
        // 3.1 Positive Sequence Y1
        const yData = YBus.build(model);
        const Y1 = yData.Y.map(row => row.map(c => c.clone()));

        // Add generator subtransient admittances to positive sequence diagonal
        for (const gen of model.generators) {
            if (!gen.isOnline || !gen.parentBus) continue;
            const idx = busIndexMap.get(gen.parentBus);
            if (idx === undefined) continue;
            const xdpp = gen.xdpp || gen.transXd || 0.20;
            const ra = gen.ra || 0.01;
            const yGen = new Complex(ra, xdpp).inv();
            Y1[idx][idx] = Y1[idx][idx].add(yGen);
        }

        // 3.2 Negative Sequence Y2 (typically identical to Y1 for static network, machine negative seq)
        const Y2 = Y1.map(row => row.map(c => c.clone()));

        // 3.3 Zero Sequence Y0
        const Y0 = Array.from({ length: n }, () =>
            Array.from({ length: n }, () => new Complex(0.0, 0.0))
        );

        // Zero sequence lines
        for (const line of model.lines) {
            if (!line.isEffectivelyOnline() || !line.fromBus || !line.toBus) continue;
            const i = busIndexMap.get(line.fromBus);
            const j = busIndexMap.get(line.toBus);
            if (i === undefined || j === undefined || i === j) continue;

            const r0 = line.zeroResistance || (line.resistance * 3.0) || 0.06;
            const x0 = line.zeroIndReactance || (line.indReactance * 3.0) || 0.24;
            const b0 = (line.zeroSusceptance !== undefined) ? line.zeroSusceptance : ((line.susceptance || 0.0) * 0.5);

            const z0 = new Complex(r0, x0);
            if (z0.abs() < 1e-9) continue;
            const y0Series = z0.inv();
            const b0Half = new Complex(0.0, b0 / 2.0);

            Y0[i][i] = Y0[i][i].add(y0Series).add(b0Half);
            Y0[j][j] = Y0[j][j].add(y0Series).add(b0Half);
            Y0[i][j] = Y0[i][j].sub(y0Series);
            Y0[j][i] = Y0[j][i].sub(y0Series);
        }

        // Zero sequence transformers
        for (const transf of model.transformers) {
            if (!transf.isEffectivelyOnline() || !transf.fromBus || !transf.toBus) continue;
            const i = busIndexMap.get(transf.fromBus);
            const j = busIndexMap.get(transf.toBus);
            if (i === undefined || j === undefined || i === j) continue;

            const r0 = transf.zeroResistance || transf.resistance || 0.005;
            const x0 = transf.zeroIndReactance || transf.indReactance || 0.05;
            const z0 = new Complex(r0, x0);
            if (z0.abs() < 1e-9) continue;
            const y0 = z0.inv();
            const a = transf.turnsRatio || 1.0;

            const conn = transf.connection || 'GWYE_GWYE';
            switch (conn) {
                case 'GWYE_GWYE':
                    Y0[i][i] = Y0[i][i].add(y0.div(a * a));
                    Y0[j][j] = Y0[j][j].add(y0);
                    Y0[i][j] = Y0[i][j].sub(y0.div(a));
                    Y0[j][i] = Y0[j][i].sub(y0.div(a));
                    break;
                case 'GWYE_DELTA':
                    // Primary (i) is grounded wye, secondary (j) is delta
                    Y0[i][i] = Y0[i][i].add(y0.div(a * a));
                    break;
                case 'DELTA_GWYE':
                    // Primary (i) delta, secondary (j) grounded wye
                    Y0[j][j] = Y0[j][j].add(y0);
                    break;
                default:
                    // DELTA_DELTA: no zero sequence path through transformer
                    break;
            }
        }

        // Zero sequence generators (grounded neutral)
        for (const gen of model.generators) {
            if (!gen.isOnline || !gen.parentBus) continue;
            const idx = busIndexMap.get(gen.parentBus);
            if (idx === undefined) continue;
            const r0Gen = 0.01;
            const x0Gen = 0.10;
            const y0Gen = new Complex(r0Gen, x0Gen).inv();
            Y0[idx][idx] = Y0[idx][idx].add(y0Gen);
        }

        // Regularize zero sequence diagonal slightly to prevent singular matrix inversion on floating nodes
        for (let idx = 0; idx < n; idx++) {
            Y0[idx][idx] = Y0[idx][idx].add(new Complex(1e-5, 1e-5));
        }

        // 4. Invert Y-bus to obtain Z-bus
        const Z1 = Matrix.invertComplexMatrix(Y1);
        const Z2 = Matrix.invertComplexMatrix(Y2);
        let Z0;
        try {
            Z0 = Matrix.invertComplexMatrix(Y0);
        } catch (e) {
            // Fallback estimation if zero-sequence is strictly disconnected
            Z0 = Z1.map(row => row.map(c => c.mul(3.0)));
        }

        const Zkk1 = Z1[k][k];
        const Zkk2 = Z2[k][k];
        const Zkk0 = Z0[k][k];

        // Complex operator 'a' = e^(j 120°)
        const a = new Complex(-0.5, 0.8660254037844386);
        const a2 = new Complex(-0.5, -0.8660254037844386);

        // Pre-fault voltage at faulted bus k
        const vPrefaultMag = targetBus.results?.v || 1.0;
        const vPrefaultAng = ((targetBus.results?.angle || 0.0) * Math.PI) / 180.0;
        const PrefaultV = Complex.fromPolar(vPrefaultMag, vPrefaultAng);

        let If1 = new Complex(0, 0);
        let If2 = new Complex(0, 0);
        let If0 = new Complex(0, 0);

        // 5. Sequence Fault Currents calculation
        if (fType === '3phase') {
            // Symmetrical 3-phase fault
            const denom = Zkk1.add(Zf);
            If1 = PrefaultV.div(denom);
            If2 = new Complex(0, 0);
            If0 = new Complex(0, 0);
        } else if (fType === '1phase-g') {
            // Single line-to-ground fault
            const denom = Zkk1.add(Zkk2).add(Zkk0).add(Zf.mul(3.0));
            const I0 = PrefaultV.div(denom);

            if (fPhases === 'A') {
                If1 = I0;
                If2 = I0;
                If0 = I0;
            } else if (fPhases === 'B') {
                If1 = I0;
                If2 = a.mul(I0);
                If0 = a2.mul(I0);
            } else { // Phase C
                If1 = I0;
                If2 = a2.mul(I0);
                If0 = a.mul(I0);
            }
        } else if (fType === '2phase') {
            // Line-to-line fault
            const denom = Zkk1.add(Zkk2).add(Zf);
            If1 = PrefaultV.div(denom);
            If0 = new Complex(0, 0);

            if (fPhases === 'BC') {
                If2 = a2.neg().mul(If1);
            } else if (fPhases === 'CA') {
                If2 = If1.neg();
            } else { // Fases AB
                If2 = a.neg().mul(If1);
            }
        } else {
            // Double line-to-ground fault (2phase-g)
            const zf3 = Zf.mul(3.0);
            const zPar = Zkk2.mul(Zkk0.add(zf3)).div(Zkk2.add(Zkk0).add(zf3));
            If1 = PrefaultV.div(Zkk1.add(zPar));
            const Vk1 = PrefaultV.sub(Zkk1.mul(If1));

            if (fPhases === 'BC') {
                If2 = a2.neg().mul(Vk1.div(Zkk2));
                If0 = a.neg().mul(Vk1.div(Zkk0.add(zf3)));
            } else if (fPhases === 'CA') {
                If2 = Vk1.div(Zkk2).neg();
                If0 = Vk1.div(Zkk0.add(zf3)).neg();
            } else { // Fases AB
                If2 = a.neg().mul(Vk1.div(Zkk2));
                If0 = a2.neg().mul(Vk1.div(Zkk0.add(zf3)));
            }
        }

        // Sequence to phase currents: [Iabc] = [A] * [I012]
        const IfA = If0.add(If1).add(If2);
        const IfB = If0.add(a2.mul(If1)).add(a.mul(If2));
        const IfC = If0.add(a.mul(If1)).add(a2.mul(If2));

        const ifAKa = IfA.abs() * iBaseKA;
        const ifBKa = IfB.abs() * iBaseKA;
        const ifCKa = IfC.abs() * iBaseKA;
        const faultCurrents = [ifAKa, ifBKa, ifCKa];
        const maxFaultCurrentKA = Math.max(ifAKa, ifBKa, ifCKa);
        const faultMVA = Math.sqrt(3.0) * vNomKV * maxFaultCurrentKA;

        // 6. Post-fault sequence & phase voltages at all buses
        const vPosList = [];
        const vNegList = [];
        const vZeroList = [];

        for (let i = 0; i < n; i++) {
            const bus = busList[i];
            const vPrefault_i = Complex.fromPolar(
                bus.results?.v || 1.0,
                ((bus.results?.angle || 0.0) * Math.PI) / 180.0
            );

            const vPos = vPrefault_i.sub(Z1[i][k].mul(If1));
            const vNeg = Z2[i][k].mul(If2).neg();
            const vZero = Z0[i][k].mul(If0).neg();

            vPosList.push(vPos);
            vNegList.push(vNeg);
            vZeroList.push(vZero);

            // Phase voltages
            const vA = vZero.add(vPos).add(vNeg);
            const vB = vZero.add(a2.mul(vPos)).add(a.mul(vNeg));
            const vC = vZero.add(a.mul(vPos)).add(a2.mul(vNeg));

            bus.results.faultVoltages = [vA.abs(), vB.abs(), vC.abs()];
            bus.results.faultVoltage = Math.min(vA.abs(), vB.abs(), vC.abs());

            if (i === k) {
                bus.results.faultCurrents = faultCurrents;
                bus.results.faultCurrentKA = maxFaultCurrentKA;
                bus.results.faultMVA = faultMVA;
            } else {
                bus.results.faultCurrents = [0, 0, 0];
                bus.results.faultCurrentKA = 0.0;
                bus.results.faultMVA = 0.0;
            }
        }

        // 7. Calculate Branch Fault Contributions (Lines and Transformers)
        // 7.1 Transmission Lines
        for (const line of model.lines) {
            if (!line.isEffectivelyOnline() || !line.fromBus || !line.toBus) {
                line.results.faultCurrent12 = [0, 0, 0];
                line.results.faultCurrent21 = [0, 0, 0];
                line.results.faultFlowKA = 0.0;
                line.results.faultDirection = 0;
                continue;
            }

            const n1 = busIndexMap.get(line.fromBus);
            const n2 = busIndexMap.get(line.toBus);
            if (n1 === undefined || n2 === undefined) continue;

            const vPos1 = vPosList[n1], vPos2 = vPosList[n2];
            const vNeg1 = vNegList[n1], vNeg2 = vNegList[n2];
            const vZero1 = vZeroList[n1], vZero2 = vZeroList[n2];

            const zPos = new Complex(line.resistance, line.indReactance);
            const bHalfPos = new Complex(0.0, (line.susceptance || 0.0) / 2.0);

            const r0 = line.zeroResistance || (line.resistance * 3.0) || 0.06;
            const x0 = line.zeroIndReactance || (line.indReactance * 3.0) || 0.24;
            const b0 = (line.zeroSusceptance !== undefined) ? line.zeroSusceptance : ((line.susceptance || 0.0) * 0.5);
            const zZero = new Complex(r0, x0);
            const bHalfZero = new Complex(0.0, b0 / 2.0);

            // Forward currents (1 -> 2)
            const I12_pos = vPos1.sub(vPos2).div(zPos).add(vPos1.mul(bHalfPos));
            const I12_neg = vNeg1.sub(vNeg2).div(zPos).add(vNeg1.mul(bHalfPos));
            const I12_zero = vZero1.sub(vZero2).div(zZero).add(vZero1.mul(bHalfZero));

            const I12_A = I12_zero.add(I12_pos).add(I12_neg);
            const I12_B = I12_zero.add(a2.mul(I12_pos)).add(a.mul(I12_neg));
            const I12_C = I12_zero.add(a.mul(I12_pos)).add(a2.mul(I12_neg));

            // Reverse currents (2 -> 1)
            const I21_pos = vPos2.sub(vPos1).div(zPos).add(vPos2.mul(bHalfPos));
            const I21_neg = vNeg2.sub(vNeg1).div(zPos).add(vNeg2.mul(bHalfPos));
            const I21_zero = vZero2.sub(vZero1).div(zZero).add(vZero2.mul(bHalfZero));

            const I21_A = I21_zero.add(I21_pos).add(I21_neg);
            const I21_B = I21_zero.add(a2.mul(I21_pos)).add(a.mul(I21_neg));
            const I21_C = I21_zero.add(a.mul(I21_pos)).add(a2.mul(I21_neg));

            const iBase1 = sBaseMVA / (Math.sqrt(3.0) * (line.fromBus.nominalVoltage || 138.0));
            const iBase2 = sBaseMVA / (Math.sqrt(3.0) * (line.toBus.nominalVoltage || 138.0));

            const i12_kA = [I12_A.abs() * iBase1, I12_B.abs() * iBase1, I12_C.abs() * iBase1];
            const i21_kA = [I21_A.abs() * iBase2, I21_B.abs() * iBase2, I21_C.abs() * iBase2];

            const max12 = Math.max(...i12_kA);
            const max21 = Math.max(...i21_kA);

            line.results.faultCurrent12 = i12_kA;
            line.results.faultCurrent21 = i21_kA;
            line.results.faultFlowKA = Math.max(max12, max21);
            line.results.faultDirection = max12 >= max21 ? 1 : 2;
        }

        // 7.2 Transformers
        for (const transf of model.transformers) {
            if (!transf.isEffectivelyOnline() || !transf.fromBus || !transf.toBus) {
                transf.results.faultCurrent12 = [0, 0, 0];
                transf.results.faultCurrent21 = [0, 0, 0];
                transf.results.faultFlowKA = 0.0;
                transf.results.faultDirection = 0;
                continue;
            }

            const n1 = busIndexMap.get(transf.fromBus);
            const n2 = busIndexMap.get(transf.toBus);
            if (n1 === undefined || n2 === undefined) continue;

            const vPos1 = vPosList[n1], vPos2 = vPosList[n2];
            const vNeg1 = vNegList[n1], vNeg2 = vNegList[n2];
            const vZero1 = vZeroList[n1], vZero2 = vZeroList[n2];

            const zPos = new Complex(transf.resistance, transf.indReactance);
            const zZero = new Complex(transf.zeroResistance || transf.resistance, transf.zeroIndReactance || transf.indReactance);
            const aTap = transf.turnsRatio || 1.0;

            const IT12_pos = vPos1.div(aTap).sub(vPos2).div(zPos).div(aTap);
            const IT12_neg = vNeg1.div(aTap).sub(vNeg2).div(zPos).div(aTap);
            const IT21_pos = vPos2.sub(vPos1.div(aTap)).div(zPos);
            const IT21_neg = vNeg2.sub(vNeg1.div(aTap)).div(zPos);

            let IT12_zero = new Complex(0, 0);
            let IT21_zero = new Complex(0, 0);

            const conn = transf.connection || 'GWYE_GWYE';
            if (conn === 'GWYE_GWYE') {
                IT12_zero = vZero1.div(aTap).sub(vZero2).div(zZero).div(aTap);
                IT21_zero = vZero2.sub(vZero1.div(aTap)).div(zZero);
            } else if (conn === 'GWYE_DELTA') {
                IT12_zero = vZero1.div(zZero);
                IT21_zero = new Complex(0, 0);
            } else if (conn === 'DELTA_GWYE') {
                IT12_zero = new Complex(0, 0);
                IT21_zero = vZero2.div(zZero);
            }

            const IT12_A = IT12_zero.add(IT12_pos).add(IT12_neg);
            const IT12_B = IT12_zero.add(a2.mul(IT12_pos)).add(a.mul(IT12_neg));
            const IT12_C = IT12_zero.add(a.mul(IT12_pos)).add(a2.mul(IT12_neg));

            const IT21_A = IT21_zero.add(IT21_pos).add(IT21_neg);
            const IT21_B = IT21_zero.add(a2.mul(IT21_pos)).add(a.mul(IT21_neg));
            const IT21_C = IT21_zero.add(a.mul(IT21_pos)).add(a2.mul(IT21_neg));

            const iBase1 = sBaseMVA / (Math.sqrt(3.0) * (transf.fromBus.nominalVoltage || 138.0));
            const iBase2 = sBaseMVA / (Math.sqrt(3.0) * (transf.toBus.nominalVoltage || 138.0));

            const i12_kA = [IT12_A.abs() * iBase1, IT12_B.abs() * iBase1, IT12_C.abs() * iBase1];
            const i21_kA = [IT21_A.abs() * iBase2, IT21_B.abs() * iBase2, IT21_C.abs() * iBase2];

            const max12 = Math.max(...i12_kA);
            const max21 = Math.max(...i21_kA);

            transf.results.faultCurrent12 = i12_kA;
            transf.results.faultCurrent21 = i21_kA;
            transf.results.faultFlowKA = Math.max(max12, max21);
            transf.results.faultDirection = max12 >= max21 ? 1 : 2;
        }

        // 8. Update all text labels
        model.updateAllLabels();

        const typeLabels = {
            '3phase': 'Trifásica',
            '1phase-g': `Monofásica (Fase ${fPhases})`,
            '2phase': `Bifásica (Fases ${fPhases})`,
            '2phase-g': `Bifásica à Terra (Fases ${fPhases})`
        };

        return {
            success: true,
            faultBusName: targetBus.name,
            faultType: fType,
            faultPhases: fPhases,
            faultTypeName: typeLabels[fType] || fType,
            faultCurrentKA: maxFaultCurrentKA,
            faultMVA,
            phaseCurrents: faultCurrents,
            message: `Curto-Circuito ${typeLabels[fType] || fType} em ${targetBus.name}: Icc = ${maxFaultCurrentKA.toFixed(3)} kA (Scc = ${faultMVA.toFixed(1)} MVA)`
        };
    }
}
