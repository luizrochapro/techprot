import { Element } from './Element.js';

export const LabelDataType = {
    DATA_NAME: 0,
    DATA_VOLTAGE: 1,
    DATA_ANGLE: 2,
    DATA_SC_CURRENT: 3,
    DATA_SC_VOLTAGE: 4,
    DATA_SC_POWER: 5,
    DATA_ACTIVE_POWER: 6,
    DATA_REACTIVE_POWER: 7,
    DATA_PF_ACTIVE: 8,
    DATA_PF_REACTIVE: 9,
    DATA_PF_LOSSES: 10,
    DATA_PF_CURRENT: 11,
    DATA_PQ_THD: 12,
    DATA_TRANSFORMER_TAP: 13,
    DATA_RELAY_TIME: 14,
    DATA_RELAY_CURRENT: 15
};

export class TextLabel extends Element {
    constructor(parentElement = null, dataType = LabelDataType.DATA_NAME, x = 0, y = 0) {
        super('TextLabel', x, y);
        this.parentElement = parentElement;
        this.dataType = dataType;
        this.unit = 'p.u.'; // 'p.u.', 'kV', 'MW', 'Mvar', 'A', 'kA', 'None'
        this.decimalPlaces = 3;
        this.direction = 0; // 0=from->to, 1=to->from
        this.fontSize = 12;
        this.text = '';

        this.updateText(100.0);
    }

    updateText(systemBasePower = 100.0) {
        if (!this.parentElement) {
            this.text = 'Label';
            return;
        }

        const el = this.parentElement;
        const dec = this.decimalPlaces;

        switch (this.dataType) {
            case LabelDataType.DATA_NAME:
                this.text = el.name || '';
                break;

            case LabelDataType.DATA_VOLTAGE: {
                const v = el.results?.v ?? el.voltageMagnitude ?? 1.0;
                if (this.unit === 'kV' && el.nominalVoltage) {
                    this.text = `${(v * el.nominalVoltage).toFixed(dec)} kV`;
                } else {
                    this.text = `${v.toFixed(dec)} p.u.`;
                }
                break;
            }

            case LabelDataType.DATA_ANGLE: {
                const theta = el.results?.angle ?? el.voltageAngle ?? 0.0;
                this.text = `${theta.toFixed(dec)}°`;
                break;
            }

            case LabelDataType.DATA_ACTIVE_POWER: {
                const p = el.results?.p ?? el.activePower ?? 0.0;
                this.text = `${p.toFixed(dec)} MW`;
                break;
            }

            case LabelDataType.DATA_REACTIVE_POWER: {
                const q = el.results?.q ?? el.reactivePower ?? 0.0;
                this.text = `${q.toFixed(dec)} Mvar`;
                break;
            }

            case LabelDataType.DATA_PF_ACTIVE: {
                const p = this.direction === 0 ? (el.results?.p12 ?? 0.0) : (el.results?.p21 ?? 0.0);
                this.text = `${p.toFixed(dec)} MW`;
                break;
            }

            case LabelDataType.DATA_PF_REACTIVE: {
                const q = this.direction === 0 ? (el.results?.q12 ?? 0.0) : (el.results?.q21 ?? 0.0);
                this.text = `${q.toFixed(dec)} Mvar`;
                break;
            }

            case LabelDataType.DATA_PF_LOSSES: {
                const pLoss = el.results?.pLoss ?? 0.0;
                if (this.unit === 'p.u.') {
                    this.text = `Loss: ${(pLoss / systemBasePower).toFixed(dec)} p.u.`;
                } else {
                    this.text = `Loss: ${pLoss.toFixed(dec)} MW`;
                }
                break;
            }

            case LabelDataType.DATA_PF_CURRENT: {
                const i = this.direction === 0 ? (el.results?.i12 ?? 0.0) : (el.results?.i21 ?? 0.0);
                this.text = `${i.toFixed(dec)} A`;
                break;
            }

            case LabelDataType.DATA_TRANSFORMER_TAP: {
                // Transformer tap ratio (works for both fixed tap and OLTC)
                const tap = el.results?.tap ?? el.turnsRatio ?? 1.0;
                if (this.unit === 'None') {
                    this.text = `Tap = ${tap.toFixed(dec)}`;
                } else {
                    this.text = `Tap = ${tap.toFixed(dec)} p.u.`;
                }
                break;
            }

            case LabelDataType.DATA_RELAY_TIME: {
                const t = el.tripTime;
                if (el.tripped) {
                    this.text = t === 0 ? 'INST' : `${t.toFixed(dec)} s`;
                } else {
                    this.text = '--';
                }
                this.text = `${el.tripUnit || '50/51'} ${this.text}`;
                break;
            }

            case LabelDataType.DATA_RELAY_CURRENT: {
                const i = el.tripCurrent ?? 0.0;
                this.text = el.tripped ? `${(i / 1000).toFixed(dec)} kA` : '--';
                break;
            }

            case LabelDataType.DATA_SC_CURRENT: {
                if (el.type === 'Bus' || (!el.fromBus && !el.toBus)) {
                    const ifault = el.results?.faultCurrentKA ?? (el.results?.faultCurrents?.[0] ?? 0.0);
                    this.text = `Icc = ${ifault.toFixed(dec)} kA`;
                } else {
                    // Branch fault contribution (Line or Transformer)
                    const iflow = el.results?.faultFlowKA ?? 0.0;
                    this.text = `Icc ramo = ${iflow.toFixed(dec)} kA`;
                }
                break;
            }

            case LabelDataType.DATA_SC_VOLTAGE: {
                const vcc = el.results?.faultVoltage ?? 1.0;
                if (this.unit === 'kV' && el.nominalVoltage) {
                    this.text = `Vcc = ${(vcc * el.nominalVoltage).toFixed(dec)} kV`;
                } else {
                    this.text = `Vcc = ${vcc.toFixed(dec)} p.u.`;
                }
                break;
            }

            case LabelDataType.DATA_SC_POWER: {
                const scc = el.results?.faultMVA ?? 0.0;
                this.text = `Scc = ${scc.toFixed(dec)} MVA`;
                break;
            }

            default:
                this.text = el.name || '';
                break;
        }
    }

    getBounds() {
        const w = this.width || 40;
        const h = this.height || 18;
        return {
            x: this.x - w / 2,
            y: this.y - h / 2,
            width: w,
            height: h
        };
    }

    containsPoint(px, py) {
        const pad = 5;
        const b = this.getBounds();
        return px >= b.x - pad && px <= b.x + b.width + pad &&
               py >= b.y - pad && py <= b.y + b.height + pad;
    }
}
