/**
 * Units.js - Electrical engineering units conversions and base calculations
 */
export const Units = {
    // Electrical Unit constants
    UNIT_NONE: 0,
    UNIT_V: 1,
    UNIT_kV: 2,
    UNIT_W: 3,
    UNIT_kW: 4,
    UNIT_MW: 5,
    UNIT_var: 6,
    UNIT_kvar: 7,
    UNIT_Mvar: 8,
    UNIT_VA: 9,
    UNIT_kVA: 10,
    UNIT_MVA: 11,
    UNIT_A: 12,
    UNIT_kA: 13,
    UNIT_OHM: 14,
    UNIT_PU: 15,
    UNIT_DEGREE: 16,
    UNIT_RADIAN: 17,

    /**
     * Calculates base values for a bus given system base power and bus nominal voltage.
     * @param {number} basePowerMVA - System base power (MVA)
     * @param {number} nominalVoltageKV - Bus nominal line-to-line voltage (kV)
     */
    getBaseValues(basePowerMVA, nominalVoltageKV) {
        const Sb = basePowerMVA * 1e6; // VA
        const Vb = nominalVoltageKV * 1e3; // V
        const Zb = (Vb * Vb) / Sb; // Ohm
        const Ib = Sb / (Math.sqrt(3.0) * Vb); // A
        return {
            Sb,
            Vb,
            Zb,
            Ib,
            IbKA: Ib / 1e3,
            VbKV: nominalVoltageKV
        };
    },

    /**
     * Converts a per-unit value to a formatted string with engineering unit
     */
    formatPower(puValue, basePowerMVA, unit = 'MW', precision = 2) {
        let val = puValue * basePowerMVA;
        if (unit === 'p.u.') return `${puValue.toFixed(precision)} p.u.`;
        if (unit === 'W' || unit === 'var' || unit === 'VA') val *= 1e6;
        else if (unit === 'kW' || unit === 'kvar' || unit === 'kVA') val *= 1e3;
        return `${val.toFixed(precision)} ${unit}`;
    },

    formatVoltage(puValue, nominalVoltageKV, unit = 'p.u.', precision = 3) {
        if (unit === 'p.u.') return `${puValue.toFixed(precision)} p.u.`;
        let val = puValue * nominalVoltageKV;
        if (unit === 'V') val *= 1e3;
        return `${val.toFixed(precision)} ${unit}`;
    },

    formatCurrent(puValue, baseCurrentA, unit = 'A', precision = 2) {
        if (unit === 'p.u.') return `${puValue.toFixed(precision)} p.u.`;
        let val = puValue * baseCurrentA;
        if (unit === 'kA') val /= 1e3;
        return `${val.toFixed(precision)} ${unit}`;
    }
};
