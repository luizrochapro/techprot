import { ControlDiagram } from './ControlDiagram.js';
import { ControlBlock, BlockType, InputSignalType, OutputSignalType } from './ControlBlock.js';

/**
 * ControlPresets.js - Factory of standard IEEE AVR and Speed Governor models
 */
export class ControlPresets {
    /**
     * Creates standard IEEE Type 1 (DC1A) AVR diagram
     * @returns {ControlDiagram}
     */
    static createIEEEType1AVR() {
        const diag = new ControlDiagram('avr', 'AVR IEEE Tipo 1 (DC1A)');

        // 1. Reference Input (Vref)
        const bVref = diag.addBlock(new ControlBlock(BlockType.INPUT, 60, 90, 'Vref'));
        bVref.params.signalType = InputSignalType.VOLTAGE_REF;
        bVref.params.customValue = 1.0;

        // 2. Terminal Voltage Input (Vt)
        const bVt = diag.addBlock(new ControlBlock(BlockType.INPUT, 60, 170, 'Vt'));
        bVt.params.signalType = InputSignalType.TERMINAL_VOLTAGE;

        // 3. Error Comparator Sum (Vref - Vt)
        const bSum = diag.addBlock(new ControlBlock(BlockType.SUM, 170, 130, 'Erro ΔV'));
        bSum.params.signs = ['+', '-'];
        bSum.setupPorts();

        // 4. Voltage Regulator Amplifier: Ka / (1 + s Ta)
        const bAmp = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 290, 130, 'Regulador Ka/(1+sTa)'));
        bAmp.params.numerator = [40.0];
        bAmp.params.denominator = [0.05, 1.0];
        bAmp.params.label = '40 / (1 + 0.05s)';

        // 5. Exciter Output Voltage Limiter
        const bLim = diag.addBlock(new ControlBlock(BlockType.LIMITER, 430, 130, 'Limites [Vmin, Vmax]'));
        bLim.params.min = -3.5;
        bLim.params.max = 5.0;

        // 6. Exciter Transfer Function: 1 / (Ke + s Te)
        const bExc = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 570, 130, 'Excitatriz 1/(Ke+sTe)'));
        bExc.params.numerator = [1.0];
        bExc.params.denominator = [0.5, 1.0];
        bExc.params.label = '1 / (1 + 0.5s)';

        // 7. Field Voltage Output (Vfd)
        const bOut = diag.addBlock(new ControlBlock(BlockType.OUTPUT, 710, 130, 'Vfd'));
        bOut.params.signalType = OutputSignalType.FIELD_VOLTAGE;

        // Connections
        diag.addWire(bVref.id, 'out0', bSum.id, 'in0');
        diag.addWire(bVt.id, 'out0', bSum.id, 'in1');
        diag.addWire(bSum.id, 'out0', bAmp.id, 'in0');
        diag.addWire(bAmp.id, 'out0', bLim.id, 'in0');
        diag.addWire(bLim.id, 'out0', bExc.id, 'in0');
        diag.addWire(bExc.id, 'out0', bOut.id, 'in0');

        diag.resolveExecutionOrder();
        return diag;
    }

    /**
     * Creates Fast Static Excitation System (IEEE ST1A)
     * @returns {ControlDiagram}
     */
    static createFastStaticAVR() {
        const diag = new ControlDiagram('avr', 'AVR Estático Rápido (ST1A)');

        const bVref = diag.addBlock(new ControlBlock(BlockType.INPUT, 60, 90, 'Vref'));
        bVref.params.signalType = InputSignalType.VOLTAGE_REF;

        const bVt = diag.addBlock(new ControlBlock(BlockType.INPUT, 60, 170, 'Vt'));
        bVt.params.signalType = InputSignalType.TERMINAL_VOLTAGE;

        const bSum = diag.addBlock(new ControlBlock(BlockType.SUM, 180, 130, 'ΔV'));
        bSum.params.signs = ['+', '-'];
        bSum.setupPorts();

        const bLeadLag = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 310, 130, 'Compensador Lead-Lag'));
        bLeadLag.params.numerator = [0.08, 1.0];
        bLeadLag.params.denominator = [0.02, 1.0];
        bLeadLag.params.label = '(1 + 0.08s)/(1 + 0.02s)';

        const bGain = diag.addBlock(new ControlBlock(BlockType.GAIN, 450, 130, 'Ganho Ka'));
        bGain.params.gain = 150.0;

        const bLim = diag.addBlock(new ControlBlock(BlockType.LIMITER, 570, 130, 'Limites Tensão'));
        bLim.params.min = -4.0;
        bLim.params.max = 6.0;

        const bOut = diag.addBlock(new ControlBlock(BlockType.OUTPUT, 700, 130, 'Vfd'));
        bOut.params.signalType = OutputSignalType.FIELD_VOLTAGE;

        diag.addWire(bVref.id, 'out0', bSum.id, 'in0');
        diag.addWire(bVt.id, 'out0', bSum.id, 'in1');
        diag.addWire(bSum.id, 'out0', bLeadLag.id, 'in0');
        diag.addWire(bLeadLag.id, 'out0', bGain.id, 'in0');
        diag.addWire(bGain.id, 'out0', bLim.id, 'in0');
        diag.addWire(bLim.id, 'out0', bOut.id, 'in0');

        diag.resolveExecutionOrder();
        return diag;
    }

    /**
     * Creates Standard Steam Turbine Speed Governor
     * @returns {ControlDiagram}
     */
    static createSteamGovernor() {
        const diag = new ControlDiagram('speed_gov', 'Regulador de Velocidade a Vapor (Steam Gov)');

        // 1. Rotor Speed Deviation Input: dw = w - 1.0 (p.u.)
        const bDw = diag.addBlock(new ControlBlock(BlockType.INPUT, 60, 130, 'Δω'));
        bDw.params.signalType = InputSignalType.SPEED_DEVIATION;

        // 2. Droop Gain (1/R) with negative sign (R = 5% => 1/R = 20)
        const bDroop = diag.addBlock(new ControlBlock(BlockType.GAIN, 190, 130, 'Estatismo 1/R'));
        bDroop.params.gain = -20.0;

        // 3. Valve Servomotor actuator: 1 / (1 + s Tsv)
        const bAct = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 330, 130, 'Válvula 1/(1+sTsv)'));
        bAct.params.numerator = [1.0];
        bAct.params.denominator = [0.10, 1.0];
        bAct.params.label = '1 / (1 + 0.1s)';

        // 4. Valve opening limiter: [-0.5, 0.5] delta power
        const bLim = diag.addBlock(new ControlBlock(BlockType.LIMITER, 470, 130, 'Limites Válvula'));
        bLim.params.min = -0.5;
        bLim.params.max = 0.5;

        // 5. Steam Chest / Reheater transfer function: 1 / (1 + s Tch)
        const bTurb = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 600, 130, 'Turbina 1/(1+sTch)'));
        bTurb.params.numerator = [1.0];
        bTurb.params.denominator = [0.30, 1.0];
        bTurb.params.label = '1 / (1 + 0.3s)';

        // 6. Mechanical Power Modulation Output (ΔPm)
        const bOut = diag.addBlock(new ControlBlock(BlockType.OUTPUT, 730, 130, 'ΔPm'));
        bOut.params.signalType = OutputSignalType.MECHANICAL_POWER;

        diag.addWire(bDw.id, 'out0', bDroop.id, 'in0');
        diag.addWire(bDroop.id, 'out0', bAct.id, 'in0');
        diag.addWire(bAct.id, 'out0', bLim.id, 'in0');
        diag.addWire(bLim.id, 'out0', bTurb.id, 'in0');
        diag.addWire(bTurb.id, 'out0', bOut.id, 'in0');

        diag.resolveExecutionOrder();
        return diag;
    }

    /**
     * Creates Hydro Turbine Speed Governor with transient droop compensation
     * @returns {ControlDiagram}
     */
    static createHydroGovernor() {
        const diag = new ControlDiagram('speed_gov', 'Regulador Hidráulico com Estatismo Transitório');

        const bDw = diag.addBlock(new ControlBlock(BlockType.INPUT, 60, 130, 'Δω'));
        bDw.params.signalType = InputSignalType.SPEED_DEVIATION;

        // Permanent droop gain
        const bDroop = diag.addBlock(new ControlBlock(BlockType.GAIN, 180, 130, '1/R (25x)'));
        bDroop.params.gain = -25.0;

        // Transient droop reset / water inertia compensation: (1 + s Tr) / (1 + s 3Tr)
        const bComp = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 320, 130, 'Compensador (1+sTr)'));
        bComp.params.numerator = [5.0, 1.0];
        bComp.params.denominator = [0.6, 1.0];
        bComp.params.label = '(1 + 5s)/(1 + 0.6s)';

        // Gate servomotor: 1 / (1 + s Tg)
        const bGate = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 470, 130, 'Atuador Portão'));
        bGate.params.numerator = [1.0];
        bGate.params.denominator = [0.20, 1.0];
        bGate.params.label = '1 / (1 + 0.2s)';

        // Hydro turbine water column column inertia: (1 - s Tw) / (1 + 0.5 s Tw)
        const bTurb = diag.addBlock(new ControlBlock(BlockType.TRANSFER_FUNCTION, 610, 130, 'Coluna D\'água'));
        bTurb.params.numerator = [-1.0, 1.0];
        bTurb.params.denominator = [0.5, 1.0];
        bTurb.params.label = '(1 - s)/(1 + 0.5s)';

        const bOut = diag.addBlock(new ControlBlock(BlockType.OUTPUT, 750, 130, 'ΔPm'));
        bOut.params.signalType = OutputSignalType.MECHANICAL_POWER;

        diag.addWire(bDw.id, 'out0', bDroop.id, 'in0');
        diag.addWire(bDroop.id, 'out0', bComp.id, 'in0');
        diag.addWire(bComp.id, 'out0', bGate.id, 'in0');
        diag.addWire(bGate.id, 'out0', bTurb.id, 'in0');
        diag.addWire(bTurb.id, 'out0', bOut.id, 'in0');

        diag.resolveExecutionOrder();
        return diag;
    }
}
