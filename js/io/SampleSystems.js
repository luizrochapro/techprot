import { Bus, BusType } from '../elements/Bus.js';
import { Line } from '../elements/Line.js';
import { Transformer } from '../elements/Transformer.js';
import { Generator } from '../elements/Generator.js';
import { Load } from '../elements/Load.js';
import { Capacitor } from '../elements/Shunt.js';
import { TextLabel, LabelDataType } from '../elements/TextLabel.js';

export class SampleSystems {
    /**
     * Loads IEEE 14 Bus benchmark test system into model
     */
    static loadIEEE14(model) {
        model.clear();
        model.name = 'IEEE 14 Bus System';
        model.basePower = 100.0;

        // Buses
        const b1 = model.addBus(new Bus(120, 100, 'Bus 1'));
        b1.isSlack = true;
        b1.nominalVoltage = 138.0;
        b1.targetVoltage = 1.060;

        const b2 = model.addBus(new Bus(280, 100, 'Bus 2'));
        b2.isPV = true;
        b2.nominalVoltage = 138.0;
        b2.targetVoltage = 1.045;

        const b3 = model.addBus(new Bus(440, 100, 'Bus 3'));
        b3.isPV = true;
        b3.nominalVoltage = 138.0;
        b3.targetVoltage = 1.010;

        const b4 = model.addBus(new Bus(280, 240, 'Bus 4'));
        b4.nominalVoltage = 138.0;

        const b5 = model.addBus(new Bus(120, 240, 'Bus 5'));
        b5.nominalVoltage = 138.0;

        const b6 = model.addBus(new Bus(200, 360, 'Bus 6'));
        b6.isPV = true;
        b6.nominalVoltage = 13.8;
        b6.targetVoltage = 1.070;

        const b7 = model.addBus(new Bus(360, 360, 'Bus 7'));
        b7.nominalVoltage = 13.8;

        const b8 = model.addBus(new Bus(440, 360, 'Bus 8'));
        b8.isPV = true;
        b8.nominalVoltage = 13.8;
        b8.targetVoltage = 1.090;

        const b9 = model.addBus(new Bus(360, 480, 'Bus 9'));
        b9.nominalVoltage = 13.8;

        const b10 = model.addBus(new Bus(480, 480, 'Bus 10'));
        b10.nominalVoltage = 13.8;

        const b11 = model.addBus(new Bus(200, 480, 'Bus 11'));
        b11.nominalVoltage = 13.8;

        const b12 = model.addBus(new Bus(120, 600, 'Bus 12'));
        b12.nominalVoltage = 13.8;

        const b13 = model.addBus(new Bus(280, 600, 'Bus 13'));
        b13.nominalVoltage = 13.8;

        const b14 = model.addBus(new Bus(440, 600, 'Bus 14'));
        b14.nominalVoltage = 13.8;

        // Generators
        const g1 = model.addGenerator(new Generator(b1, 120, 40, 'Gen 1 (Slack)'));
        g1.isSlack = true;
        g1.activePower = 232.4;
        g1.targetVoltage = 1.060;

        const g2 = model.addGenerator(new Generator(b2, 280, 40, 'Gen 2'));
        g2.activePower = 40.0;
        g2.targetVoltage = 1.045;

        const g3 = model.addGenerator(new Generator(b3, 440, 40, 'Gen 3'));
        g3.activePower = 0.0;
        g3.targetVoltage = 1.010;

        const g6 = model.addGenerator(new Generator(b6, 200, 300, 'Gen 6'));
        g6.activePower = 0.0;
        g6.targetVoltage = 1.070;

        const g8 = model.addGenerator(new Generator(b8, 440, 300, 'Gen 8'));
        g8.activePower = 0.0;
        g8.targetVoltage = 1.090;

        // Loads
        model.addLoad(new Load(b2, 280, 150, 'Load 2')).activePower = 21.7;
        model.addLoad(new Load(b3, 440, 150, 'Load 3')).activePower = 94.2;
        model.addLoad(new Load(b4, 280, 290, 'Load 4')).activePower = 47.8;
        model.addLoad(new Load(b5, 120, 290, 'Load 5')).activePower = 7.6;
        model.addLoad(new Load(b6, 200, 410, 'Load 6')).activePower = 11.2;
        model.addLoad(new Load(b9, 360, 530, 'Load 9')).activePower = 29.5;
        model.addLoad(new Load(b10, 480, 530, 'Load 10')).activePower = 9.0;
        model.addLoad(new Load(b11, 200, 530, 'Load 11')).activePower = 3.5;
        model.addLoad(new Load(b12, 120, 650, 'Load 12')).activePower = 6.1;
        model.addLoad(new Load(b13, 280, 650, 'Load 13')).activePower = 13.5;
        model.addLoad(new Load(b14, 440, 650, 'Load 14')).activePower = 14.9;

        // Lines
        const addL = (f, t, r, x, b, name) => {
            const l = model.addLine(new Line(f, t, name));
            l.resistance = r;
            l.indReactance = x;
            l.susceptance = b;
            return l;
        };

        addL(b1, b2, 0.01938, 0.05917, 0.0528, 'L1-2');
        addL(b1, b5, 0.05403, 0.22304, 0.0492, 'L1-5');
        addL(b2, b3, 0.04699, 0.19797, 0.0438, 'L2-3');
        addL(b2, b4, 0.05811, 0.17632, 0.0340, 'L2-4');
        addL(b2, b5, 0.05695, 0.17388, 0.0346, 'L2-5');
        addL(b3, b4, 0.06701, 0.17103, 0.0128, 'L3-4');
        addL(b4, b5, 0.01335, 0.04211, 0.0, 'L4-5');
        addL(b6, b11, 0.09498, 0.19890, 0.0, 'L6-11');
        addL(b6, b12, 0.12291, 0.25581, 0.0, 'L6-12');
        addL(b6, b13, 0.06615, 0.13027, 0.0, 'L6-13');
        addL(b7, b8, 0.0, 0.17615, 0.0, 'L7-8');
        addL(b7, b9, 0.0, 0.11001, 0.0, 'L7-9');
        addL(b9, b10, 0.03181, 0.08450, 0.0, 'L9-10');
        addL(b9, b14, 0.12711, 0.27038, 0.0, 'L9-14');
        addL(b10, b11, 0.08205, 0.19207, 0.0, 'L10-11');
        addL(b12, b13, 0.22092, 0.19988, 0.0, 'L12-13');
        addL(b13, b14, 0.17093, 0.34802, 0.0, 'L13-14');

        // Transformers (including OLTC demonstration on T4-7)
        const t4_7 = model.addTransformer(new Transformer(b4, b7, 320, 300, 'T4-7'));
        t4_7.resistance = 0.0;
        t4_7.indReactance = 0.20912;
        t4_7.turnsRatio = 0.978;
        t4_7.nominalTurnsRatio = 0.978;
        t4_7.hasTapChanger = true;
        t4_7.oltcControlledBus = 1; // Control Bus 7
        t4_7.oltcTargetVoltage = 1.02;
        t4_7.oltcVoltageDeadband = 0.005;
        t4_7.oltcMinTap = 0.90;
        t4_7.oltcMaxTap = 1.10;

        const t4_9 = model.addTransformer(new Transformer(b4, b9, 320, 380, 'T4-9'));
        t4_9.resistance = 0.0;
        t4_9.indReactance = 0.55618;
        t4_9.turnsRatio = 0.969;
        t4_9.nominalTurnsRatio = 0.969;

        const t5_6 = model.addTransformer(new Transformer(b5, b6, 160, 300, 'T5-6'));
        t5_6.resistance = 0.0;
        t5_6.indReactance = 0.25202;
        t5_6.turnsRatio = 0.932;
        t5_6.nominalTurnsRatio = 0.932;

        // Add diagram labels
        for (const b of model.buses) {
            model.addTextLabel(new TextLabel(b, LabelDataType.DATA_NAME, b.x, b.y - 18));
        }

        model.addTextLabel(new TextLabel(t4_7, LabelDataType.DATA_TRANSFORMER_TAP, 370, 285));
        model.addTextLabel(new TextLabel(t4_9, LabelDataType.DATA_TRANSFORMER_TAP, 370, 370));
        model.addTextLabel(new TextLabel(t5_6, LabelDataType.DATA_TRANSFORMER_TAP, 115, 300));

        model.addTextLabel(new TextLabel(b1, LabelDataType.DATA_VOLTAGE, 175, 100));
        model.addTextLabel(new TextLabel(b2, LabelDataType.DATA_VOLTAGE, 335, 100));
        model.addTextLabel(new TextLabel(b3, LabelDataType.DATA_VOLTAGE, 495, 100));

        return model;
    }

    /**
     * Loads IEEE 9 Bus System with OLTC transformers
     */
    static loadIEEE9OLTC(model) {
        model.clear();
        model.name = 'IEEE 9 Bus System with OLTC';
        model.basePower = 100.0;

        const b1 = model.addBus(new Bus(150, 100, 'Bus 1'));
        b1.isSlack = true;
        b1.nominalVoltage = 16.5;
        b1.targetVoltage = 1.040;

        const b2 = model.addBus(new Bus(500, 100, 'Bus 2'));
        b2.isPV = true;
        b2.nominalVoltage = 18.0;
        b2.targetVoltage = 1.025;

        const b3 = model.addBus(new Bus(325, 450, 'Bus 3'));
        b3.isPV = true;
        b3.nominalVoltage = 13.8;
        b3.targetVoltage = 1.025;

        const b4 = model.addBus(new Bus(150, 220, 'Bus 4'));
        b4.nominalVoltage = 230.0;

        const b5 = model.addBus(new Bus(150, 340, 'Bus 5'));
        b5.nominalVoltage = 230.0;

        const b6 = model.addBus(new Bus(325, 340, 'Bus 6'));
        b6.nominalVoltage = 230.0;

        const b7 = model.addBus(new Bus(500, 220, 'Bus 7'));
        b7.nominalVoltage = 230.0;

        const b8 = model.addBus(new Bus(325, 220, 'Bus 8'));
        b8.nominalVoltage = 230.0;

        const b9 = model.addBus(new Bus(500, 340, 'Bus 9'));
        b9.nominalVoltage = 230.0;

        // Generators
        model.addGenerator(new Generator(b1, 150, 40, 'Gen 1')).activePower = 71.6;
        model.addGenerator(new Generator(b2, 500, 40, 'Gen 2')).activePower = 163.0;
        model.addGenerator(new Generator(b3, 325, 510, 'Gen 3')).activePower = 85.0;

        // Loads
        model.addLoad(new Load(b5, 80, 340, 'Load A')).activePower = 125.0;
        model.addLoad(new Load(b6, 325, 390, 'Load B')).activePower = 90.0;
        model.addLoad(new Load(b8, 325, 170, 'Load C')).activePower = 100.0;

        // Transformers with OLTC
        const t1 = model.addTransformer(new Transformer(b1, b4, 150, 160, 'T1-4'));
        t1.indReactance = 0.0576;
        t1.turnsRatio = 1.0;
        t1.hasTapChanger = true;
        t1.oltcControlledBus = 1;
        t1.oltcTargetVoltage = 1.02;

        const t2 = model.addTransformer(new Transformer(b2, b7, 500, 160, 'T2-7'));
        t2.indReactance = 0.0625;
        t2.turnsRatio = 1.0;
        t2.hasTapChanger = true;
        t2.oltcControlledBus = 1;
        t2.oltcTargetVoltage = 1.015;

        const t3 = model.addTransformer(new Transformer(b3, b9, 410, 400, 'T3-9'));
        t3.indReactance = 0.0586;
        t3.turnsRatio = 1.0;
        t3.hasTapChanger = true;
        t3.oltcControlledBus = 1;
        t3.oltcTargetVoltage = 1.025;

        // Transmission lines
        const addL = (f, t, r, x, b, name) => {
            const l = model.addLine(new Line(f, t, name));
            l.resistance = r;
            l.indReactance = x;
            l.susceptance = b;
            return l;
        };

        addL(b4, b5, 0.010, 0.085, 0.176, 'L4-5');
        addL(b4, b6, 0.017, 0.092, 0.158, 'L4-6');
        addL(b5, b7, 0.032, 0.161, 0.306, 'L5-7');
        addL(b6, b9, 0.039, 0.170, 0.358, 'L6-9');
        addL(b7, b8, 0.0085, 0.072, 0.149, 'L7-8');
        addL(b8, b9, 0.0119, 0.1008, 0.209, 'L8-9');

        // Diagram Labels
        for (const b of model.buses) {
            model.addTextLabel(new TextLabel(b, LabelDataType.DATA_NAME, b.x, b.y - 18));
        }

        // Tap Labels on diagram
        model.addTextLabel(new TextLabel(t1, LabelDataType.DATA_TRANSFORMER_TAP, 200, 160));
        model.addTextLabel(new TextLabel(t2, LabelDataType.DATA_TRANSFORMER_TAP, 550, 160));
        model.addTextLabel(new TextLabel(t3, LabelDataType.DATA_TRANSFORMER_TAP, 460, 400));

        return model;
    }

    /**
     * Loads IEEE 14 Bus benchmark with electromechanical stability dynamic parameters and fault event
     */
    static loadIEEE14Stability(model) {
        SampleSystems.loadIEEE14(model);
        model.name = 'IEEE 14 Barras - Estabilidade Transitória';

        // Synchronous Machine Dynamic Data (matching IEEE 14 stability benchmark)
        const g1 = model.generators.find(g => g.name.includes('Gen 1'));
        if (g1) {
            g1.inertia = 5.148;
            g1.transXd = 0.2995;
            g1.syncXd = 0.8979;
            g1.syncXq = 0.6460;
            g1.transTd0 = 7.40;
            g1.damping = 2.0;
            g1.useAVR = true;
            g1.useSpeedGovernor = true;
        }

        const g2 = model.generators.find(g => g.name.includes('Gen 2'));
        if (g2) {
            g2.inertia = 6.540;
            g2.transXd = 0.1850;
            g2.syncXd = 1.0500;
            g2.syncXq = 0.9800;
            g2.transTd0 = 6.10;
            g2.damping = 2.0;
            g2.useAVR = true;
            g2.useSpeedGovernor = true;
        }

        const g3 = model.generators.find(g => g.name.includes('Gen 3'));
        if (g3) {
            g3.inertia = 6.540;
            g3.transXd = 0.1850;
            g3.syncXd = 1.0500;
            g3.syncXq = 0.9800;
            g3.transTd0 = 6.10;
            g3.damping = 2.0;
        }

        const g6 = model.generators.find(g => g.name.includes('Gen 6'));
        if (g6) {
            g6.inertia = 5.060;
            g6.transXd = 0.2320;
            g6.syncXd = 1.2500;
            g6.syncXq = 1.2200;
            g6.transTd0 = 4.80;
            g6.damping = 2.0;
        }

        const g8 = model.generators.find(g => g.name.includes('Gen 8'));
        if (g8) {
            g8.inertia = 5.060;
            g8.transXd = 0.2320;
            g8.syncXd = 1.2500;
            g8.syncXq = 1.2200;
            g8.transTd0 = 4.80;
            g8.damping = 2.0;
        }

        // Configure stability settings
        model.stabilitySettings = {
            simTime: 5.0,
            timeStep: 0.005,
            plotStep: 0.01,
            frequency: 60.0,
            tolerance: 1e-5,
            maxIterations: 50,
            useCOI: true,
            method: 'Modified-Euler'
        };

        // Program a default 3-phase fault disturbance on Bus 4 (100 ms duration)
        model.clearStabilityEvents();
        const b4 = model.buses.find(b => b.name === 'Bus 4') || model.buses[3];
        if (b4) {
            model.addStabilityEvent({
                id: 'evt_sample_1',
                type: 'fault',
                time: 1.0,
                duration: 0.10,
                targetBus: b4,
                rFault: 0.0,
                xFault: 0.0001,
                description: `Curto-circuito trifásico na Barra 4 por 100 ms (t=1.0s a 1.1s)`
            });
        }

        return model;
    }
}
