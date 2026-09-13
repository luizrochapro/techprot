import { Element } from './Element.js';

/**
 * Relay.js - Relé de proteção de sobrecorrente 50/51 (fase) e 50N/51N (neutro).
 *
 * O relé é SEMPRE vinculado a um disjuntor (breaker) de um elemento da rede
 * (Line, Transformer, Generator ou Load) e é desenhado como:
 *
 *   [DJ]──( TC )────( ⭕ relé )
 *     ^     ^          ^
 *  breaker  TC      círculo ANSI (clique abre os ajustes)
 *
 * A posição é derivada dinamicamente da posição do disjuntor (getSwitchBoxes),
 * portanto o relé acompanha automaticamente o elemento pai.
 */
export class Relay extends Element {
    constructor(parentElement = null, terminal = 0, name = 'Relay') {
        super('Relay', 0, 0);
        this.name = name;
        this.parentElement = parentElement; // Line | Transformer | Generator | Load
        this.terminal = terminal;           // 0 = disjuntor terminal 1 (from), 1 = terminal 2 (to)

        // Parâmetros do TC (Transformador de Corrente)
        this.ct = {
            primary: 600,      // A primário
            secondary: 5,      // A secundário (5 ou 1)
            ctClass: 'C100',   // Classe de exatidão (ex: 5P20, C100, 10B50)
            burdenVA: 25       // Carga do secundário (VA)
        };

        // Deslocamento manual do relé em relação à posição padrão
        // (permite arrastar o relé para qualquer lugar, sem perder a ligação ao breaker)
        this.offsetX = 0;
        this.offsetY = 0;

        // Ajustes das unidades ANSI (pickup em Ampères no PRIMÁRIO)
        this.settings = {
            unit50:  { enabled: true, pickup: 1200 },
            unit51:  { enabled: true, pickup: 800, curve: 'IEC_SI', tms: 0.30, definiteTime: 0.30 },
            unit50N: { enabled: true, pickup: 300 },
            unit51N: { enabled: true, pickup: 150, curve: 'IEC_SI', tms: 0.30, definiteTime: 0.50 }
        };

        this.results = {};

        // Se true, a curva deste relé aparece no coordenograma (comparação entre relés)
        this.showInCoordogram = false;

        // Estado após curto-circuito: se o relé foi sensibilizado
        this.tripped = false;
        this.tripTime = null;      // s (0 para instantâneo)
        this.tripCurrent = null;   // A (corrente que sensibilizou)
        this.tripUnit = '';        // '50' | '51' | '50N' | '51N'
    }

    /**
     * Avalia se o relé é sensibilizado por uma corrente de curto no
     * terminal supervisionado. Retorna objeto com resultado.
     */
    static evaluate(relay, faultCurrentA) {
        if (!(faultCurrentA > 0)) return null;
        const s = relay.settings || {};
        let best = null;

        // 50 (instantânea)
        if (s.unit50?.enabled && s.unit50.pickup > 0 && faultCurrentA >= s.unit50.pickup) {
            best = { tripTime: 0, tripCurrent: faultCurrentA, tripUnit: '50' };
        }
        // 51 (temporizada)
        if (s.unit51?.enabled) {
            const t = Relay.tripTime(s.unit51, faultCurrentA);
            if (Number.isFinite(t) && t >= 0) {
                if (!best || t < best.tripTime || best.tripUnit === '50')
                    best = { tripTime: t, tripCurrent: faultCurrentA, tripUnit: '51' };
            }
        }
        // 50N (neutro)
        if (s.unit50N?.enabled && s.unit50N.pickup > 0 && faultCurrentA >= s.unit50N.pickup) {
            const cand = { tripTime: 0, tripCurrent: faultCurrentA, tripUnit: '50N' };
            if (!best || cand.tripTime < best.tripTime) best = cand;
        }
        // 51N (neutro)
        if (s.unit51N?.enabled) {
            const t = Relay.tripTime(s.unit51N, faultCurrentA);
            if (Number.isFinite(t) && t >= 0) {
                if (!best || t < best.tripTime) best = { tripTime: t, tripCurrent: faultCurrentA, tripUnit: '51N' };
            }
        }
        return best || null;
    }

    /**
     * Corrente de curto-circuito simulada no disjuntor supervisionado (A, primário),
     * com base nos resultados de falta do elemento pai. Retorna 0 se não houver
     * simulação de curto-circuito disponível OU se o breaker do terminal está aberto.
     */
    getSimulatedFaultKA() {
        const res = this.parentElement?.results;
        if (!res) return 0;

        // If the parent element's terminal breaker is open, no current flows
        if (typeof this.parentElement.isTerminalOnline === 'function') {
            if (!this.parentElement.isTerminalOnline(this.terminal)) return 0;
        }

        const arr = (this.terminal === 1) ? res.faultCurrent21 : res.faultCurrent12;
        let kA = 0;
        if (Array.isArray(arr)) kA = Math.max(0, ...arr);
        if (!(kA > 0) && typeof res.faultFlowKA === 'number' && res.faultFlowKA > 0) {
            kA = res.faultFlowKA; // fallback para curto no meio da linha
        }
        return kA > 0 ? kA : 0;
    }

    /**
     * Curvas normalizadas IEC 60255-151 (componente temporizado 51/51N).
     * t = TMS * a / (M^p - 1), com M = I / Ipickup.
     */
    static get CURVES() {
        return {
            IEC_SI: { a: 0.14, p: 0.02, label: 'IEC Normal Inversa (SI)' },
            IEC_VI: { a: 13.5, p: 1.0,  label: 'IEC Muito Inversa (VI)' },
            IEC_EI: { a: 80.0, p: 2.0,  label: 'IEC Extremamente Inversa (EI)' },
            DT:     { a: 0.0,  p: 0.0,  label: 'Tempo Definido (TD)' }
        };
    }

    /**
     * Tempo de operação (s) de uma unidade temporizada 51/51N para corrente I no primário.
     * Retorna Infinity se não houver pickup/atuacao.
     */
    static tripTime(unit, currentA) {
        if (!unit || !unit.enabled) return Infinity;
        if (!unit.pickup || unit.pickup <= 0) return Infinity;
        const M = currentA / unit.pickup;
        if (M <= 1.0) return Infinity;
        if (unit.curve === 'DT') return unit.definiteTime ?? 0.3;
        const c = Relay.CURVES[unit.curve] || Relay.CURVES.IEC_SI;
        const tms = unit.tms ?? 0.3;
        return tms * c.a / (Math.pow(M, c.p) - 1.0);
    }

    /**
     * Indica se a unidade instantânea 50/50N atua para a corrente informada.
     */
    static instantOperates(unit, currentA) {
        return !!(unit && unit.enabled && unit.pickup > 0 && currentA >= unit.pickup);
    }

    /** Relação de transformação do TC (ex.: 600/5 => 120). */
    get ctRatio() {
        const sec = this.ct.secondary || 5;
        return sec > 0 ? (this.ct.primary / sec) : 1;
    }

    // ------------------------------------------------------------------
    // Geometria — derivada do disjuntor (breaker box) do elemento pai
    // ------------------------------------------------------------------
    getBreakerBox() {
        const boxes = this.parentElement && typeof this.parentElement.getSwitchBoxes === 'function'
            ? this.parentElement.getSwitchBoxes()
            : [];
        return boxes[this.terminal] || null;
    }

    /**
     * Geometria calculada do conjunto:
     *  - box: caixa do disjuntor
     *  - ct: círculo do TC (logo à direita do disjuntor)
     *  - circle: círculo do relé à direita do TC, ligado por um "fio"
     */
    getGeometry() {
        const box = this.getBreakerBox();
        if (!box) return null;
        const ctR = 7;      // raio do TC
        const relR = 14;    // raio do círculo do relé
        const gapCT = 5;    // distância entre disjuntor e TC
        const stub = 14;    // comprimento do segmento horizontal após o TC
        const drop  = 28;   // comprimento do segmento vertical até o relé
        const anchorY = box.y + box.height / 2;

        // Posição-base + deslocamento manual (arrasto do usuário)
        const ctX   = box.x + box.width + gapCT + ctR + this.offsetX;
        const ctY   = anchorY + this.offsetY;
        const bendX = ctX + ctR + stub;
        const relX  = bendX;
        const relY  = ctY + drop;

        return {
            box,
            ct:   { x: ctX,   y: ctY,      r: ctR },
            bend: { x: bendX, y: ctY },
            circle: { x: relX, y: relY,     r: relR }
        };
    }

    getBounds() {
        const g = this.getGeometry();
        if (!g) return { x: this.x - 10, y: this.y - 10, width: 20, height: 20 };
        const minX = Math.min(g.box.x, g.ct.x - g.ct.r, g.bend.x, g.circle.x - g.circle.r);
        const maxX = Math.max(g.box.x + g.box.width, g.ct.x + g.ct.r, g.bend.x, g.circle.x + g.circle.r);
        const minY = Math.min(g.box.y, g.ct.y - g.ct.r, g.circle.y - g.circle.r);
        const maxY = Math.max(g.box.y + g.box.height, g.ct.y + g.ct.r, g.circle.y + g.circle.r);
        return { x: minX - 2, y: minY - 2, width: (maxX - minX) + 4, height: (maxY - minY) + 4 };
    }

    containsPoint(px, py) {
        const b = this.getBounds();
        return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
    }

    /** Hit-test do círculo do relé (região clicável que abre os ajustes). */
    hitTestCircle(px, py) {
        const g = this.getGeometry();
        if (!g) return false;
        return Math.hypot(px - g.circle.x, py - g.circle.y) <= g.circle.r + 3;
    }

    // O relé é ancorado ao disjuntor mas permite deslocamento manual (arrasto).
    move(dx, dy) {
        this.offsetX += dx;
        this.offsetY += dy;
    }
    rotate() { /* símbolo fixo à direita do disjuntor */ }
    snapToGrid() {}
}
