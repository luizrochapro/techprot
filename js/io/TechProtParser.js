import { Bus, BusType } from '../elements/Bus.js';
import { Line } from '../elements/Line.js';
import { Transformer } from '../elements/Transformer.js';
import { Generator } from '../elements/Generator.js';
import { Load } from '../elements/Load.js';
import { Capacitor, Inductor } from '../elements/Shunt.js';
import { TextLabel, LabelDataType } from '../elements/TextLabel.js';
import { ControlDiagram } from '../control/ControlDiagram.js';
import { Relay } from '../elements/Relay.js';
import { Element } from '../elements/Element.js';

export class TechProtParser {
    /**
     * Parses a .tp XML string and populates the model.
     * @param {string} xmlText
     * @param {Model} model
     */
    static parse(xmlText, model) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML Parse Error: ' + parserError.textContent);
        }

        model.clear();

        // Reseta o contador global de IDs para que o arquivo salvo mantenha
        // os mesmos IDs originais (ex.: linha id=3 continua id=3 ao reabrir),
        // evitando relés órfãos por referência de ID inválida.
        if (typeof Element.resetIdCounter === 'function') Element.resetIdCounter(1);

        // 1. General Project Properties
        const nameNode = doc.querySelector('Project > Name');
        if (nameNode) model.name = nameNode.textContent.trim();

        const basePowerNode = doc.querySelector('Properties BasePower');
        if (basePowerNode) {
            model.basePower = parseFloat(basePowerNode.textContent) || 100.0;
        }

        const stabNode = doc.querySelector('Properties Stability');
        if (stabNode) {
            model.stabilitySettings = {
                timeStep: parseFloat(stabNode.querySelector('TimeStep')?.textContent) || 0.005,
                simTime: parseFloat(stabNode.querySelector('SimulationTime')?.textContent) || 5.0,
                frequency: parseFloat(stabNode.querySelector('Frequency')?.textContent) || 60.0,
                useCOI: stabNode.querySelector('UseCOI')?.textContent === '1'
            };
        }

        const busIdMap = new Map(); // Desktop XML ID -> Web Bus object

        // 2. Parse Buses
        const busNodes = doc.querySelectorAll('Elements > BusList > Bus');
        busNodes.forEach(node => {
            const id = node.getAttribute('ID');
            const posX = parseFloat(node.querySelector('CADProperties > Position > X')?.textContent) || 0;
            const posY = parseFloat(node.querySelector('CADProperties > Position > Y')?.textContent) || 0;
            const width = parseFloat(node.querySelector('CADProperties > Size > Width')?.textContent) || 120;
            const height = parseFloat(node.querySelector('CADProperties > Size > Height')?.textContent) || 8;
            const angle = parseFloat(node.querySelector('CADProperties > Angle')?.textContent) || 0;

            const name = node.querySelector('ElectricalProperties > Name')?.textContent || `Bus_${id}`;
            const vNom = parseFloat(node.querySelector('ElectricalProperties > NominalVoltage')?.textContent) || 138.0;
            const isSlack = node.querySelector('ElectricalProperties > SlackBus')?.textContent === '1';
            const isControlled = node.querySelector('ElectricalProperties > IsVoltageControlled')?.textContent === '1';
            const vTarget = parseFloat(node.querySelector('ElectricalProperties > ControlledVoltage')?.textContent) || 1.0;

            const bus = new Bus(posX, posY, name);
            bus.width = width;
            bus.height = height;
            bus.angle = (angle === 90 || angle === 270) ? 90 : 0;
            bus.nominalVoltage = vNom;
            bus.targetVoltage = vTarget;
            bus.isSlack = isSlack;
            if (isControlled && !isSlack) bus.isPV = true;

            const faultNode = node.querySelector('ElectricalProperties > Fault');
            if (faultNode) {
                bus.hasFault = faultNode.querySelector('HasFault')?.textContent === '1';
                const fTypeIdx = parseInt(faultNode.querySelector('Type')?.textContent || '0', 10);
                const fLocIdx = parseInt(faultNode.querySelector('Location')?.textContent || '0', 10);
                const typeReverse = ['3phase', '2phase', '2phase-g', '1phase-g'];
                bus.faultType = typeReverse[fTypeIdx] || '3phase';
                if (bus.faultType === '1phase-g') {
                    bus.faultPhases = ['A', 'B', 'C'][fLocIdx] || 'A';
                } else if (bus.faultType === '3phase') {
                    bus.faultPhases = 'ABC';
                } else {
                    bus.faultPhases = ['AB', 'BC', 'CA'][fLocIdx] || 'BC';
                }
                bus.faultResistance = parseFloat(faultNode.querySelector('Resistance')?.textContent) || 0.0;
                bus.faultReactance = parseFloat(faultNode.querySelector('Reactance')?.textContent) || 0.0;
            }

            const stabFaultNode = node.querySelector('ElectricalProperties > Stability');
            if (stabFaultNode) {
                bus.stabHasFault = stabFaultNode.querySelector('HasFault')?.textContent === '1';
                bus.stabFaultTime = parseFloat(stabFaultNode.querySelector('FaultTime')?.textContent) || 1.0;
                bus.stabFaultLength = parseFloat(stabFaultNode.querySelector('FaultLength')?.textContent) || 0.10;
                bus.stabFaultResistance = parseFloat(stabFaultNode.querySelector('FaultResistance')?.textContent) || 0.0;
                bus.stabFaultReactance = parseFloat(stabFaultNode.querySelector('FaultReactance')?.textContent) || 0.0001;
            }

            model.addBus(bus);
            busIdMap.set(id, bus);
        });

        // 3. Parse Lines
        const lineNodes = doc.querySelectorAll('Elements > LineList > Line');
        lineNodes.forEach(node => {
            const name = node.querySelector('ElectricalProperties > Name')?.textContent || 'Line';
            const r = parseFloat(node.querySelector('ElectricalProperties > Resistance')?.textContent) || 0.02;
            const x = parseFloat(node.querySelector('ElectricalProperties > IndReactance')?.textContent) || 0.08;
            const b = parseFloat(node.querySelector('ElectricalProperties > Susceptance')?.textContent) || 0.02;
            const length = parseFloat(node.querySelector('ElectricalProperties > Length')?.textContent) || 50.0;

            // Parents
            const parentIds = Array.from(node.querySelectorAll('ParentIDList > ID')).map(n => n.textContent.trim());
            const bus1 = busIdMap.get(parentIds[0]);
            const bus2 = busIdMap.get(parentIds[1]);

            const line = new Line(bus1, bus2, name);
            line.resistance = r;
            line.indReactance = x;
            line.susceptance = b;
            line.length = length;

            // Route points if present
            const nodePts = node.querySelectorAll('NodeList > Point');
            if (nodePts.length >= 2) {
                line.pointList = Array.from(nodePts).map(p => ({
                    x: parseFloat(p.querySelector('X')?.textContent) || 0,
                    y: parseFloat(p.querySelector('Y')?.textContent) || 0
                }));
            }

            model.addLine(line);

            // Per-terminal breaker states (backward compatible: default = closed)
            const bsNode = node.querySelector(':scope > BreakerStates');
            if (bsNode) {
                line.breakerFrom = bsNode.querySelector('BreakerFrom')?.textContent !== '0';
                line.breakerTo = bsNode.querySelector('BreakerTo')?.textContent !== '0';
            }
        });

        // 4. Parse Transformers
        const transfNodes = doc.querySelectorAll('Elements > TransformerList > Transformer');
        transfNodes.forEach(node => {
            const name = node.querySelector('ElectricalProperties > Name')?.textContent || 'Transformer';
            const posX = parseFloat(node.querySelector('CADProperties > Position > X')?.textContent) || 0;
            const posY = parseFloat(node.querySelector('CADProperties > Position > Y')?.textContent) || 0;

            const r = parseFloat(node.querySelector('ElectricalProperties > Resistance')?.textContent) || 0.005;
            const x = parseFloat(node.querySelector('ElectricalProperties > IndReactance')?.textContent) || 0.05;
            const tap = parseFloat(node.querySelector('ElectricalProperties > TurnsRatio')?.textContent) || 1.0;
            const v1 = parseFloat(node.querySelector('ElectricalProperties > PrimaryNominalVoltage')?.textContent) || 138.0;
            const v2 = parseFloat(node.querySelector('ElectricalProperties > SecondaryNominalVoltage')?.textContent) || 13.8;

            // OLTC properties
            const hasOltc = node.querySelector('ElectricalProperties > HasTapChanger')?.textContent === '1';
            const oltcBus = parseInt(node.querySelector('ElectricalProperties > OltcControlledBus')?.textContent || '1', 10);
            const oltcVTarget = parseFloat(node.querySelector('ElectricalProperties > OltcTargetVoltage')?.textContent) || 1.0;
            const oltcDeadband = parseFloat(node.querySelector('ElectricalProperties > OltcVoltageDeadband')?.textContent) || 0.005;
            const oltcMin = parseFloat(node.querySelector('ElectricalProperties > OltcMinTap')?.textContent) || 0.90;
            const oltcMax = parseFloat(node.querySelector('ElectricalProperties > OltcMaxTap')?.textContent) || 1.10;
            const oltcStep = parseFloat(node.querySelector('ElectricalProperties > OltcTapStep')?.textContent) || 0.00625;
            const oltcDiscrete = node.querySelector('ElectricalProperties > OltcIsDiscrete')?.textContent === '1';

            const parentIds = Array.from(node.querySelectorAll('ParentIDList > ID')).map(n => n.textContent.trim());
            const bus1 = busIdMap.get(parentIds[0]);
            const bus2 = busIdMap.get(parentIds[1]);

            const transf = new Transformer(bus1, bus2, posX, posY, name);
            transf.resistance = r;
            transf.indReactance = x;
            transf.turnsRatio = tap;
            transf.nominalTurnsRatio = tap;
            transf.primaryNominalVoltage = v1;
            transf.secondaryNominalVoltage = v2;

            transf.hasTapChanger = hasOltc;
            transf.oltcControlledBus = oltcBus;
            transf.oltcTargetVoltage = oltcVTarget;
            transf.oltcVoltageDeadband = oltcDeadband;
            transf.oltcMinTap = oltcMin;
            transf.oltcMaxTap = oltcMax;
            transf.oltcTapStep = oltcStep;
            transf.oltcIsDiscrete = oltcDiscrete;

            model.addTransformer(transf);

            // Per-terminal breaker states (backward compatible: default = closed)
            const bsNodeT = node.querySelector(':scope > BreakerStates');
            if (bsNodeT) {
                transf.breakerFrom = bsNodeT.querySelector('BreakerFrom')?.textContent !== '0';
                transf.breakerTo = bsNodeT.querySelector('BreakerTo')?.textContent !== '0';
            }
        });

        // 5. Parse Generators
        const genNodes = doc.querySelectorAll('Elements > SyncGeneratorList > SyncGenerator');
        genNodes.forEach(node => {
            const name = node.querySelector('ElectricalProperties > Name')?.textContent || 'Gen';
            const posX = parseFloat(node.querySelector('CADProperties > Position > X')?.textContent) || 0;
            const posY = parseFloat(node.querySelector('CADProperties > Position > Y')?.textContent) || 0;

            const p = parseFloat(node.querySelector('ElectricalProperties > ActivePower')?.textContent) || 50.0;
            const q = parseFloat(node.querySelector('ElectricalProperties > ReactivePower')?.textContent) || 10.0;
            const vTarget = parseFloat(node.querySelector('ElectricalProperties > ControlledVoltage')?.textContent) || 1.0;
            const qMin = parseFloat(node.querySelector('ElectricalProperties > MinQ')?.textContent) || -999.0;
            const qMax = parseFloat(node.querySelector('ElectricalProperties > MaxQ')?.textContent) || 999.0;

            const parentId = node.querySelector('ParentIDList > ID')?.textContent?.trim();
            const parentBus = busIdMap.get(parentId);

            const gen = new Generator(parentBus, posX, posY, name);
            gen.activePower = p;
            gen.reactivePower = q;
            gen.targetVoltage = vTarget;
            gen.qMin = qMin;
            gen.qMax = qMax;

            const angle = parseFloat(node.querySelector('CADProperties > Angle')?.textContent);
            if (!isNaN(angle)) gen.angle = angle;

            const stabGenNode = node.querySelector('ElectricalProperties > Stability');
            if (stabGenNode) {
                gen.inertia = parseFloat(stabGenNode.querySelector('Inertia')?.textContent) || 5.0;
                gen.transXd = parseFloat(stabGenNode.querySelector('TransXd')?.textContent) || 0.25;
                gen.syncXd = parseFloat(stabGenNode.querySelector('SyncXd')?.textContent) || 1.2;
                gen.syncXq = parseFloat(stabGenNode.querySelector('SyncXq')?.textContent) || 0.8;
                gen.transTd0 = parseFloat(stabGenNode.querySelector('TransTd0')?.textContent) || 5.0;
                gen.damping = parseFloat(stabGenNode.querySelector('Damping')?.textContent) || 0.0;
                gen.ra = parseFloat(stabGenNode.querySelector('ArmResistance')?.textContent) || 0.005;
                gen.xdp = gen.transXd;
                gen.xd = gen.syncXd;

                const useAVRNode = stabGenNode.querySelector('UseAVR');
                if (useAVRNode) gen.useAVR = useAVRNode.textContent === '1';

                const useGovNode = stabGenNode.querySelector('UseSpeedGovernor');
                if (useGovNode) gen.useSpeedGovernor = useGovNode.textContent === '1';

                const avrDiagNode = stabGenNode.querySelector('AVRDiagram');
                if (avrDiagNode && avrDiagNode.textContent) {
                    try {
                        const json = JSON.parse(decodeURIComponent(avrDiagNode.textContent));
                        const restored = ControlDiagram.fromJSON(json);
                        if (restored) gen.avrDiagram = restored;
                    } catch(e) {}
                }

                const govDiagNode = stabGenNode.querySelector('SpeedGovDiagram');
                if (govDiagNode && govDiagNode.textContent) {
                    try {
                        const json = JSON.parse(decodeURIComponent(govDiagNode.textContent));
                        const restored = ControlDiagram.fromJSON(json);
                        if (restored) gen.speedGovDiagram = restored;
                    } catch(e) {}
                }
            }

            if (parentBus && parentBus.isSlack) gen.isSlack = true;

            model.addGenerator(gen);
        });

        // 6. Parse Loads
        const loadNodes = doc.querySelectorAll('Elements > LoadList > Load');
        loadNodes.forEach(node => {
            const name = node.querySelector('ElectricalProperties > Name')?.textContent || 'Load';
            const posX = parseFloat(node.querySelector('CADProperties > Position > X')?.textContent) || 0;
            const posY = parseFloat(node.querySelector('CADProperties > Position > Y')?.textContent) || 0;

            const p = parseFloat(node.querySelector('ElectricalProperties > ActivePower')?.textContent) || 30.0;
            const q = parseFloat(node.querySelector('ElectricalProperties > ReactivePower')?.textContent) || 15.0;

            const parentId = node.querySelector('ParentIDList > ID')?.textContent?.trim();
            const parentBus = busIdMap.get(parentId);

            const ld = new Load(parentBus, posX, posY, name);
            ld.activePower = p;
            ld.reactivePower = q;

            model.addLoad(ld);
        });

        // 7. Parse Capacitors & Inductors
        const capNodes = doc.querySelectorAll('Elements > CapacitorList > Capacitor');
        capNodes.forEach(node => {
            const name = node.querySelector('ElectricalProperties > Name')?.textContent || 'Cap';
            const posX = parseFloat(node.querySelector('CADProperties > Position > X')?.textContent) || 0;
            const posY = parseFloat(node.querySelector('CADProperties > Position > Y')?.textContent) || 0;
            const q = parseFloat(node.querySelector('ElectricalProperties > ReactivePower')?.textContent) || 10.0;
            const parentId = node.querySelector('ParentIDList > ID')?.textContent?.trim();
            const cap = new Capacitor(busIdMap.get(parentId), posX, posY, name);
            cap.nominalReactivePower = q;
            model.addCapacitor(cap);
        });

        // 8. Parse Protection Relays (RelayList)
        const relayNodes = doc.querySelectorAll('Elements > RelayList > Relay');
        relayNodes.forEach(node => {
            const name = node.querySelector('ElectricalProperties > Name')?.textContent || 'Relay';
            const terminal = parseInt(node.querySelector('CADProperties > Terminal')?.textContent || '0', 10);            const parentId = node.querySelector('ParentIDList > ID')?.textContent?.trim();
            const parentEl = model.getElementById(parseInt(parentId, 10));
            if (!parentEl) return; // parent element not found -> skip orphan relay

            const relay = new Relay(parentEl, terminal, name);
            relay.showInCoordogram = node.querySelector('CADProperties > ShowInCoordogram')?.textContent === '1';

            const ctNode = node.querySelector('ElectricalProperties > CTSettings');
            if (ctNode && ctNode.textContent) {
                try {
                    const json = JSON.parse(decodeURIComponent(ctNode.textContent));
                    if (json && typeof json === 'object') Object.assign(relay.ct, json);
                } catch (e) {}
            }

            const psNode = node.querySelector('ElectricalProperties > ProtectionSettings');
            if (psNode && psNode.textContent) {
                try {
                    const json = JSON.parse(decodeURIComponent(psNode.textContent));
                    if (json && typeof json === 'object') {
                        for (const key of ['unit50', 'unit51', 'unit50N', 'unit51N']) {
                            if (json[key]) Object.assign(relay.settings[key], json[key]);
                        }
                    }
                } catch (e) {}
            }

            model.addRelay(relay);
        });

        // 9. Parse Diagram Labels (TextList)
        const textNodes = doc.querySelectorAll('Elements > TextList > Text');
        textNodes.forEach(node => {
            const posX = parseFloat(node.querySelector('CADProperties > Position > X')?.textContent) || 0;
            const posY = parseFloat(node.querySelector('CADProperties > Position > Y')?.textContent) || 0;
            const dataType = parseInt(node.querySelector('CADProperties > DataType')?.textContent || '0', 10);
            const parentId = node.querySelector('CADProperties > ElementID')?.textContent?.trim();
            const parentEl = model.getElementById(parseInt(parentId, 10)) || model.buses[0];

            const lbl = new TextLabel(parentEl, dataType, posX, posY);
            model.addTextLabel(lbl);
        });

        // Ensure all buses have their name label if none was in file
        for (const b of model.buses) {
            if (!model.textLabels.some(l => l.parentElement === b && l.dataType === LabelDataType.DATA_NAME)) {
                model.addTextLabel(new TextLabel(b, LabelDataType.DATA_NAME, b.x, b.y - 18));
            }
        }

        model.updateAllLabels();

        // Após todo o parse, ajusta o próximo ID para evitar colisões
        // com elementos adicionados manualmente depois (novas barras, relés, etc.)
        const maxId = Math.max(0, ...model.getAllElements().map(e => e.id || 0));
        if (typeof Element.resetIdCounter === 'function') Element.resetIdCounter(maxId + 1);

        return model;
    }
}
