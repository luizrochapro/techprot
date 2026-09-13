import { Complex } from '../core/Complex.js';
import { Matrix } from '../core/Matrix.js';
import { YBus } from './YBus.js';
import { BusType } from '../elements/Bus.js';

export class PowerFlow {
    /**
     * Solves AC Power Flow on the model using Newton-Raphson or Gauss-Seidel.
     * Includes full On-Load Tap Changer (OLTC) transformer voltage regulation.
     * @param {Model} model
     * @returns {{ success: boolean, iterations: number, maxMismatch: number, message: string }}
     */
    static solve(model) {
        const method = model.powerFlowSettings.method || 'Newton-Raphson';
        let res;
        if (method === 'Gauss-Seidel') {
            res = PowerFlow.solveGaussSeidel(model);
        } else {
            res = PowerFlow.solveNewtonRaphson(model);
        }
        model.hasSolution = !!res.success; // marca se há solução válida (para reexecução automática)
        if (model.hasSolution) model.updateAllLabels();
        return res;
    }

    /**
     * Marca como offline (isOnline=false) toda barra que não tem caminho elétrico
     * para a barra de referência (slack), usando apenas linhas e trafos fechados.
     * Isso evita rede ilhada na hora de montar a YBus e garante convergência.
     */
    static _markUnreachableBusesOffline(model) {
        // 1. Mapeia apenas barras online e ramos fechados (isOnline)
        const buses = model.buses.filter(b => b.isOnline);
        if (buses.length === 0) return;

        const slack = buses.find(b => b.isSlack);
        if (!slack) {
            // Nenhuma slack definida → usa a primeira barra online como referência
            buses[0].isSlack = true;
        }

        const adj = new Map();
        for (const b of buses) adj.set(b, new Set());

        const addEdge = (a, b) => {
            if (adj.has(a) && adj.has(b)) { adj.get(a).add(b); adj.get(b).add(a); }
        };

        for (const l of model.lines) {
            if (l.isEffectivelyOnline() && l.fromBus && l.toBus) addEdge(l.fromBus, l.toBus);
        }
        for (const t of model.transformers) {
            if (t.isEffectivelyOnline() && t.fromBus && t.toBus) addEdge(t.fromBus, t.toBus);
        }

        // 2. BFS a partir da slack
        const visited = new Set();
        const queue = [buses.find(b => b.isSlack)];
        while (queue.length) {
            const cur = queue.pop();
            if (visited.has(cur)) continue;
            visited.add(cur);
            for (const nb of adj.get(cur) || []) {
                if (!visited.has(nb)) queue.push(nb);
            }
        }

        // 3. Marca como offline as barras não alcançáveis
        for (const b of buses) {
            if (!visited.has(b)) {
                b.isOnline = false;
                // Também desliga geradores/cargas ligados a barra ilhada
                for (const g of model.generators) {
                    if (g.parentBus === b) g.isOnline = false;
                }
                for (const ld of model.loads) {
                    if (ld.parentBus === b) ld.isOnline = false;
                }
            }
        }
    }

    static solveNewtonRaphson(model) {
        const baseMVA = model.basePower;
        const tol = model.powerFlowSettings.tolerance || 1e-5;
        const maxIter = model.powerFlowSettings.maxIterations || 100;
        const enableOLTC = model.powerFlowSettings.enableOLTC !== false;

        // Desliga barras ilhadas antes de montar a YBus (rede sem caminho à slack)
        PowerFlow._markUnreachableBusesOffline(model);

        // Reset transformer taps to nominal before starting (if OLTC active)
        for (const t of model.transformers) {
            if (t.isOnline && t.hasTapChanger) {
                t.turnsRatio = t.nominalTurnsRatio || 1.0;
            }
        }

        let ybusData = YBus.build(model);
        let { Y, busIndexMap, busList } = ybusData;
        const n = busList.length;
        if (n === 0) return { success: false, iterations: 0, maxMismatch: 0, message: 'No online buses in system.' };

        // Check for slack bus
        const slackIndex = busList.findIndex(b => b.isSlack);
        if (slackIndex === -1) {
            // Default first bus to slack if none specified
            busList[0].isSlack = true;
        }

        // State vectors: V (magnitude) and Theta (angle in radians)
        const V = new Float64Array(n);
        const Theta = new Float64Array(n);

        // Specified net scheduled powers (Psp, Qsp in p.u.)
        const P_spec = new Float64Array(n);
        const Q_spec = new Float64Array(n);
        const busTypes = new Int32Array(n); // 0=PQ, 1=PV, 2=SLACK

        for (let i = 0; i < n; i++) {
            const bus = busList[i];
            busTypes[i] = bus.busType;
            V[i] = bus.targetVoltage || bus.voltageMagnitude || 1.0;
            Theta[i] = ((bus.voltageAngle || 0.0) * Math.PI) / 180.0;

            // Calculate net generation minus load connected to this bus
            let pNetMW = 0.0;
            let qNetMvar = 0.0;

            for (const gen of model.generators) {
                if (gen.isOnline && gen.parentBus === bus) {
                    pNetMW += gen.activePower;
                    qNetMvar += gen.reactivePower;
                    if (gen.isSlack) busTypes[i] = BusType.SLACK;
                    else if (busTypes[i] !== BusType.SLACK) {
                        busTypes[i] = BusType.PV;
                        V[i] = gen.targetVoltage || V[i];
                    }
                }
            }

            for (const ld of model.loads) {
                if (ld.isOnline && ld.parentBus === bus) {
                    pNetMW -= ld.activePower;
                    qNetMvar -= ld.reactivePower;
                }
            }

            P_spec[i] = pNetMW / baseMVA;
            Q_spec[i] = qNetMvar / baseMVA;

            if (busTypes[i] === BusType.SLACK) {
                Theta[i] = 0.0;
            }
        }

        let iteration = 0;
        let converged = false;
        let maxMismatch = 1.0;

        while (iteration < maxIter && !converged) {
            iteration++;

            // 1. Calculate Injected Active and Reactive Powers
            const P_calc = new Float64Array(n);
            const Q_calc = new Float64Array(n);

            for (let i = 0; i < n; i++) {
                let pSum = 0.0;
                let qSum = 0.0;
                for (let k = 0; k < n; k++) {
                    const G_ik = Y[i][k].re;
                    const B_ik = Y[i][k].im;
                    const theta_ik = Theta[i] - Theta[k];
                    pSum += V[k] * (G_ik * Math.cos(theta_ik) + B_ik * Math.sin(theta_ik));
                    qSum += V[k] * (G_ik * Math.sin(theta_ik) - B_ik * Math.cos(theta_ik));
                }
                P_calc[i] = V[i] * pSum;
                Q_calc[i] = V[i] * qSum;
            }

            // 2. Form Mismatch Vector [DeltaP, DeltaQ]
            const pBuses = []; // Non-slack indices
            const qBuses = []; // PQ indices

            for (let i = 0; i < n; i++) {
                if (busTypes[i] !== BusType.SLACK) pBuses.push(i);
                if (busTypes[i] === BusType.PQ) qBuses.push(i);
            }

            const numEqP = pBuses.length;
            const numEqQ = qBuses.length;
            const totalEq = numEqP + numEqQ;

            const deltaF = new Float64Array(totalEq);
            maxMismatch = 0.0;

            for (let idx = 0; idx < numEqP; idx++) {
                const i = pBuses[idx];
                const dP = P_spec[i] - P_calc[i];
                deltaF[idx] = dP;
                maxMismatch = Math.max(maxMismatch, Math.abs(dP));
            }

            for (let idx = 0; idx < numEqQ; idx++) {
                const i = qBuses[idx];
                const dQ = Q_spec[i] - Q_calc[i];
                deltaF[numEqP + idx] = dQ;
                maxMismatch = Math.max(maxMismatch, Math.abs(dQ));
            }

            if (maxMismatch < tol) {
                // Check OLTC Tap adjustments
                let tapChanged = false;
                if (enableOLTC) {
                    tapChanged = PowerFlow.adjustOLTCTaps(model, V, busIndexMap);
                    if (tapChanged) {
                        // Rebuild YBus with new taps and continue iterations
                        ybusData = YBus.build(model);
                        Y = ybusData.Y;
                        continue;
                    }
                }
                converged = true;
                break;
            }

            // 3. Assemble Jacobian Matrix: [ [H, N], [M, L] ]
            const J = Array.from({ length: totalEq }, () => new Float64Array(totalEq));

            // Submatrix H = dP / dTheta
            for (let r = 0; r < numEqP; r++) {
                const i = pBuses[r];
                for (let c = 0; c < numEqP; c++) {
                    const k = pBuses[c];
                    if (i === k) {
                        // H_ii = -Q_i - B_ii * V_i^2
                        J[r][c] = -Q_calc[i] - Y[i][i].im * V[i] * V[i];
                    } else {
                        // H_ik = V_i * V_k * (G_ik * sin(theta_ik) - B_ik * cos(theta_ik))
                        const th = Theta[i] - Theta[k];
                        J[r][c] = V[i] * V[k] * (Y[i][k].re * Math.sin(th) - Y[i][k].im * Math.cos(th));
                    }
                }
            }

            // Submatrix N = dP / dV * V
            for (let r = 0; r < numEqP; r++) {
                const i = pBuses[r];
                for (let c = 0; c < numEqQ; c++) {
                    const k = qBuses[c];
                    const col = numEqP + c;
                    if (i === k) {
                        // N_ii = P_i + G_ii * V_i^2
                        J[r][col] = (P_calc[i] + Y[i][i].re * V[i] * V[i]) / V[i];
                    } else {
                        const th = Theta[i] - Theta[k];
                        J[r][col] = V[i] * (Y[i][k].re * Math.cos(th) + Y[i][k].im * Math.sin(th));
                    }
                }
            }

            // Submatrix M = dQ / dTheta
            for (let r = 0; r < numEqQ; r++) {
                const i = qBuses[r];
                const row = numEqP + r;
                for (let c = 0; c < numEqP; c++) {
                    const k = pBuses[c];
                    if (i === k) {
                        // M_ii = P_i - G_ii * V_i^2
                        J[row][c] = P_calc[i] - Y[i][i].re * V[i] * V[i];
                    } else {
                        const th = Theta[i] - Theta[k];
                        J[row][c] = -V[i] * V[k] * (Y[i][k].re * Math.cos(th) + Y[i][k].im * Math.sin(th));
                    }
                }
            }

            // Submatrix L = dQ / dV * V
            for (let r = 0; r < numEqQ; r++) {
                const i = qBuses[r];
                const row = numEqP + r;
                for (let c = 0; c < numEqQ; c++) {
                    const k = qBuses[c];
                    const col = numEqP + c;
                    if (i === k) {
                        // L_ii = Q_i - B_ii * V_i^2
                        J[row][col] = (Q_calc[i] - Y[i][i].im * V[i] * V[i]) / V[i];
                    } else {
                        const th = Theta[i] - Theta[k];
                        J[row][col] = V[i] * (Y[i][k].re * Math.sin(th) - Y[i][k].im * Math.cos(th));
                    }
                }
            }

            // 4. Solve J * deltaX = deltaF
            const deltaX = Matrix.solveLinearSystem(
                Array.from(J, row => Array.from(row)),
                Array.from(deltaF)
            );

            // 5. Update State
            for (let idx = 0; idx < numEqP; idx++) {
                const i = pBuses[idx];
                Theta[i] += deltaX[idx];
            }
            for (let idx = 0; idx < numEqQ; idx++) {
                const i = qBuses[idx];
                V[i] += deltaX[numEqP + idx];
            }
        }

        // Post-processing: calculate final bus & branch flows and losses
        PowerFlow.updateResults(model, busList, busIndexMap, V, Theta, Y);
        model.updateAllLabels();

        return {
            success: converged,
            iterations: iteration,
            maxMismatch,
            message: converged 
                ? `Converged in ${iteration} iterations (Max mismatch: ${maxMismatch.toExponential(2)})`
                : `Did not converge after ${iteration} iterations (Max mismatch: ${maxMismatch.toExponential(2)})`
        };
    }

    /**
     * Automatic On-Load Tap Changer (OLTC) tap adjustment logic
     * Adjusts transformer turns ratio to regulate voltage on the target bus.
     */
    static adjustOLTCTaps(model, V, busIndexMap) {
        let changed = false;

        for (const transf of model.transformers) {
            if (!transf.isEffectivelyOnline() || !transf.hasTapChanger || !transf.fromBus || !transf.toBus) continue;

            const controlledBus = transf.oltcControlledBus === 0 ? transf.fromBus : transf.toBus;
            const busIdx = busIndexMap.get(controlledBus);
            if (busIdx === undefined) continue;

            const vActual = V[busIdx];
            const vTarget = transf.oltcTargetVoltage || 1.0;
            const deadband = transf.oltcVoltageDeadband || 0.005;
            const minTap = transf.oltcMinTap || 0.90;
            const maxTap = transf.oltcMaxTap || 1.10;
            const step = transf.oltcTapStep || 0.00625;

            const diff = vActual - vTarget;

            if (Math.abs(diff) > deadband) {
                let currentTap = transf.turnsRatio || 1.0;
                let newTap = currentTap;

                // If controlled bus is secondary (bus 2):
                // V2 ~ V1 / tap. Higher tap lowers V2. Lower tap increases V2.
                // If V2 < target, we decrease tap. If V2 > target, we increase tap.
                if (transf.oltcControlledBus === 1) {
                    if (diff < 0) {
                        newTap -= step;
                    } else {
                        newTap += step;
                    }
                } else {
                    // Controlled bus is primary (bus 1)
                    if (diff < 0) {
                        newTap += step;
                    } else {
                        newTap -= step;
                    }
                }

                // If discrete mode, snap to nearest step
                if (transf.oltcIsDiscrete) {
                    const nominal = transf.nominalTurnsRatio || 1.0;
                    const stepsFromNominal = Math.round((newTap - nominal) / step);
                    newTap = nominal + stepsFromNominal * step;
                }

                newTap = Math.max(minTap, Math.min(maxTap, newTap));

                if (Math.abs(newTap - currentTap) > 1e-5) {
                    transf.turnsRatio = newTap;
                    transf.results.tap = newTap;
                    changed = true;
                }
            } else {
                transf.results.tap = transf.turnsRatio;
            }
        }

        return changed;
    }

    /**
     * Alternative Gauss-Seidel solver for power flow
     */
    static solveGaussSeidel(model) {
        const baseMVA = model.basePower;
        const tol = model.powerFlowSettings.tolerance || 1e-5;
        const maxIter = model.powerFlowSettings.maxIterations || 1000;
        const acc = model.powerFlowSettings.accFactor || 1.0;

        const ybusData = YBus.build(model);
        const { Y, busIndexMap, busList } = ybusData;
        const n = busList.length;
        if (n === 0) return { success: false, iterations: 0, maxMismatch: 0, message: 'No online buses.' };

        const V = busList.map(b => Complex.fromPolar(b.targetVoltage || 1.0, ((b.voltageAngle || 0) * Math.PI) / 180));
        const P_spec = new Float64Array(n);
        const Q_spec = new Float64Array(n);

        for (let i = 0; i < n; i++) {
            const bus = busList[i];
            let pMW = 0, qMvar = 0;
            for (const g of model.generators) {
                if (g.isOnline && g.parentBus === bus) { pMW += g.activePower; qMvar += g.reactivePower; }
            }
            for (const ld of model.loads) {
                if (ld.isOnline && ld.parentBus === bus) { pMW -= ld.activePower; qMvar -= ld.reactivePower; }
            }
            P_spec[i] = pMW / baseMVA;
            Q_spec[i] = qMvar / baseMVA;
        }

        let iter = 0;
        let maxDiff = 1.0;

        while (iter < maxIter && maxDiff > tol) {
            iter++;
            maxDiff = 0.0;

            for (let i = 0; i < n; i++) {
                const bus = busList[i];
                if (bus.isSlack) continue;

                if (bus.isPV) {
                    // Update Q for PV bus
                    let sum = new Complex(0, 0);
                    for (let j = 0; j < n; j++) {
                        sum = sum.add(Y[i][j].mul(V[j]));
                    }
                    const S = V[i].mul(sum.conj());
                    Q_spec[i] = -S.im;
                }

                const sConj = new Complex(P_spec[i], -Q_spec[i]);
                let sumYV = new Complex(0, 0);
                for (let j = 0; j < n; j++) {
                    if (j !== i) sumYV = sumYV.add(Y[i][j].mul(V[j]));
                }

                const Vnew = sConj.div(V[i].conj()).sub(sumYV).div(Y[i][i]);
                const V_acc = V[i].add(Vnew.sub(V[i]).mul(acc));

                if (bus.isPV) {
                    // Keep magnitude fixed
                    const targetMag = bus.targetVoltage || 1.0;
                    V[i] = Complex.fromPolar(targetMag, V_acc.arg());
                } else {
                    maxDiff = Math.max(maxDiff, V_acc.sub(V[i]).abs());
                    V[i] = V_acc;
                }
            }
        }

        const vMag = new Float64Array(n);
        const theta = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            vMag[i] = V[i].abs();
            theta[i] = V[i].arg();
        }

        PowerFlow.updateResults(model, busList, busIndexMap, vMag, theta, Y);
        model.updateAllLabels();

        return {
            success: maxDiff <= tol,
            iterations: iter,
            maxMismatch: maxDiff,
            message: `Gauss-Seidel: ${iter} iterations, max diff ${maxDiff.toExponential(2)}`
        };
    }

    /**
     * Compute and store branch flows, losses, and bus net dispatches
     */
    static updateResults(model, busList, busIndexMap, V, Theta, Y) {
        const baseMVA = model.basePower;

        // 1. Bus results
        for (let i = 0; i < busList.length; i++) {
            const bus = busList[i];
            const v = V[i];
            const angDeg = (Theta[i] * 180.0) / Math.PI;
            bus.results.v = v;
            bus.results.angle = angDeg;

            // Injected active & reactive powers
            let pInj = 0.0;
            let qInj = 0.0;
            for (let k = 0; k < busList.length; k++) {
                const th = Theta[i] - Theta[k];
                pInj += v * V[k] * (Y[i][k].re * Math.cos(th) + Y[i][k].im * Math.sin(th));
                qInj += v * V[k] * (Y[i][k].re * Math.sin(th) - Y[i][k].im * Math.cos(th));
            }
            bus.results.pNet = pInj * baseMVA;
            bus.results.qNet = qInj * baseMVA;
        }

        // 2. Line Flows & Losses
        for (const line of model.lines) {
            // Half-open line: one breaker open, other still closed.
            // The line acts as a shunt capacitor (charging) on the connected
            // bus; compute the reactive flow injected at the connected end.
            if (line.isHalfOpen && line.isOnline !== false && line.fromBus && line.toBus) {
                const connBus = line.breakerFrom !== false ? line.fromBus : line.toBus;
                const idxConn = busIndexMap.get(connBus);
                const bTotal = line.susceptance || 0.0;
                // S into the line from bus: S = V * conj(V * jB) = -j * B * V^2
                // i.e. pure capacitive reactive flow (line exports vars to grid)
                const vConn = idxConn !== undefined ? V[idxConn] : (connBus.results?.v || 1.0);
                const qCharge = -bTotal * vConn * vConn * baseMVA; // Mvar (negative = supplying)

                if (line.breakerFrom !== false) {
                    // from-terminal still connected: show flow at end 1
                    line.results.p12 = 0.0;
                    line.results.q12 = qCharge;
                    line.results.p21 = 0.0;
                    line.results.q21 = 0.0;
                } else {
                    line.results.p12 = 0.0;
                    line.results.q12 = 0.0;
                    line.results.p21 = 0.0;
                    line.results.q21 = qCharge;
                }
                line.results.pLoss = 0.0;
                line.results.qLoss = 0.0;
                const vBaseKV2 = connBus.nominalVoltage || 138.0;
                const iBaseA2 = (baseMVA * 1e3) / (Math.sqrt(3.0) * vBaseKV2);
                const iChg = Math.abs(bTotal) * vConn * iBaseA2;
                line.results.i12 = line.breakerFrom !== false ? iChg : 0.0;
                line.results.i21 = line.breakerTo !== false ? iChg : 0.0;
                line.results.direction = 0; // no active power direction
                continue;
            }

            if (!line.isEffectivelyOnline() || !line.fromBus || !line.toBus) {
                if (line.results) {
                    line.results.p12 = 0.0;
                    line.results.q12 = 0.0;
                    line.results.p21 = 0.0;
                    line.results.q21 = 0.0;
                    line.results.pLoss = 0.0;
                    line.results.qLoss = 0.0;
                    line.results.i12 = 0.0;
                    line.results.i21 = 0.0;
                    line.results.direction = 0;
                }
                continue;
            }
            const i = busIndexMap.get(line.fromBus);
            const j = busIndexMap.get(line.toBus);
            if (i === undefined || j === undefined) continue;

            const Vi = Complex.fromPolar(V[i], Theta[i]);
            const Vj = Complex.fromPolar(V[j], Theta[j]);
            const zSeries = new Complex(line.resistance, line.indReactance);
            const ySeries = zSeries.inv();
            const bHalf = new Complex(0.0, (line.susceptance || 0.0) / 2.0);

            // Current I_ij = (Vi - Vj) * ySeries + Vi * (jB/2)
            const I_12 = Vi.sub(Vj).mul(ySeries).add(Vi.mul(bHalf));
            const I_21 = Vj.sub(Vi).mul(ySeries).add(Vj.mul(bHalf));

            // Complex Power S_12 = Vi * I_12*
            const S_12 = Vi.mul(I_12.conj()).mul(baseMVA);
            const S_21 = Vj.mul(I_21.conj()).mul(baseMVA);

            line.results.p12 = S_12.re;
            line.results.q12 = S_12.im;
            line.results.p21 = S_21.re;
            line.results.q21 = S_21.im;
            line.results.pLoss = Math.abs(S_12.re + S_21.re);
            line.results.qLoss = Math.abs(S_12.im + S_21.im);

            const vBaseKV = line.fromBus.nominalVoltage || 138.0;
            const iBaseA = (baseMVA * 1e3) / (Math.sqrt(3.0) * vBaseKV);
            line.results.i12 = I_12.abs() * iBaseA;
            line.results.i21 = I_21.abs() * iBaseA;
            line.results.direction = S_12.re >= 0 ? 1 : 2;
        }

        // 3. Transformer Flows, Losses & Tap
        for (const transf of model.transformers) {
            if (!transf.isEffectivelyOnline() || !transf.fromBus || !transf.toBus) {
                if (transf.results) {
                    transf.results.p12 = 0.0;
                    transf.results.q12 = 0.0;
                    transf.results.p21 = 0.0;
                    transf.results.q21 = 0.0;
                    transf.results.pLoss = 0.0;
                    transf.results.qLoss = 0.0;
                    transf.results.i12 = 0.0;
                    transf.results.i21 = 0.0;
                }
                continue;
            }
            const i = busIndexMap.get(transf.fromBus);
            const j = busIndexMap.get(transf.toBus);
            if (i === undefined || j === undefined) continue;

            const Vi = Complex.fromPolar(V[i], Theta[i]);
            const Vj = Complex.fromPolar(V[j], Theta[j]);
            const zT = new Complex(transf.resistance, transf.indReactance);
            const yT = zT.inv();

            const a = transf.turnsRatio || 1.0;
            const phiRad = ((transf.phaseShift || 0.0) * Math.PI) / 180.0;
            const aComplex = Complex.fromPolar(a, phiRad);
            const aConj = Complex.fromPolar(a, -phiRad);

            // S_12 = Vi * (Vi * yT / a^2 - Vj * yT / a*)*
            const I_12 = Vi.mul(yT.div(a * a)).sub(Vj.mul(yT.div(aConj)));
            const I_21 = Vj.mul(yT).sub(Vi.mul(yT.div(aComplex)));

            const S_12 = Vi.mul(I_12.conj()).mul(baseMVA);
            const S_21 = Vj.mul(I_21.conj()).mul(baseMVA);

            transf.results.p12 = S_12.re;
            transf.results.q12 = S_12.im;
            transf.results.p21 = S_21.re;
            transf.results.q21 = S_21.im;
            transf.results.pLoss = Math.abs(S_12.re + S_21.re);
            transf.results.qLoss = Math.abs(S_12.im + S_21.im);
            transf.results.tap = a; // Ensure tap is stored in results!

            const vBaseKV = transf.fromBus.nominalVoltage || 138.0;
            const iBaseA = (baseMVA * 1e3) / (Math.sqrt(3.0) * vBaseKV);
            transf.results.i12 = I_12.abs() * iBaseA;
            transf.results.i21 = I_21.abs() * iBaseA;
        }

        // 4. Generator Dispatches
        for (const gen of model.generators) {
            if (!gen.isOnline || !gen.parentBus) {
                if (gen.results) {
                    gen.results.p = 0.0;
                    gen.results.q = 0.0;
                    gen.results.v = 0.0;
                }
                continue;
            }
            const bus = gen.parentBus;
            const pNet = bus.results?.pNet || 0.0;
            const qNet = bus.results?.qNet || 0.0;

            let pLoadTotal = 0.0;
            let qLoadTotal = 0.0;
            for (const ld of model.loads) {
                if (ld.isOnline && ld.parentBus === bus) {
                    pLoadTotal += ld.activePower || 0.0;
                    qLoadTotal += ld.reactivePower || 0.0;
                }
            }

            if (gen.isSlack) {
                gen.results.p = pNet + pLoadTotal;
                gen.results.q = qNet + qLoadTotal;
            } else {
                gen.results.p = gen.activePower;
                gen.results.q = qNet + qLoadTotal;
            }
            gen.results.v = bus.results?.v || 1.0;
        }

        // 5. Load Results
        for (const ld of model.loads) {
            if (!ld.isOnline || !ld.parentBus) {
                if (ld.results) {
                    ld.results.p = 0.0;
                    ld.results.q = 0.0;
                    ld.results.v = 0.0;
                    ld.results.i = 0.0;
                }
                continue;
            }
            const bus = ld.parentBus;
            const vPu = bus.results?.v || 1.0;
            const vBaseKV = bus.nominalVoltage || 138.0;
            ld.results.p = ld.activePower;
            ld.results.q = ld.reactivePower;
            ld.results.v = vPu;
            const sMVA = Math.hypot(ld.activePower, ld.reactivePower);
            const vActualKV = vPu * vBaseKV;
            ld.results.i = vActualKV > 0 ? (sMVA * 1e3) / (Math.sqrt(3.0) * vActualKV) : 0.0;
        }
    }
}
