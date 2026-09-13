import { BusType } from '../elements/Bus.js';

export class TechProtSerializer {
    /**
     * Serializes model into .tp XML format
     * @param {Model} model
     * @returns {string} XML string
     */
    static serialize(model) {
        let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
        xml += '<Project>\n';
        xml += `\t<Name>${model.name || 'TechProt Project'}</Name>\n`;
        xml += '\t<Properties>\n';
        xml += '\t\t<SimulationProperties>\n';
        xml += '\t\t\t<General>\n';
        xml += `\t\t\t\t<BasePower UnitID="10">${model.basePower.toFixed(1)}</BasePower>\n`;
        xml += '\t\t\t</General>\n';
        xml += '\t\t\t<PowerFlow>\n';
        xml += `\t\t\t\t<SolutionMethod>${model.powerFlowSettings.method === 'Gauss-Seidel' ? 1 : 0}</SolutionMethod>\n`;
        xml += `\t\t\t\t<Tolerance>${model.powerFlowSettings.tolerance}</Tolerance>\n`;
        xml += `\t\t\t\t<MaxIterations>${model.powerFlowSettings.maxIterations}</MaxIterations>\n`;
        xml += '\t\t\t</PowerFlow>\n';
        if (model.stabilitySettings) {
            xml += '\t\t\t<Stability>\n';
            xml += `\t\t\t\t<TimeStep>${model.stabilitySettings.timeStep || 0.005}</TimeStep>\n`;
            xml += `\t\t\t\t<SimulationTime>${model.stabilitySettings.simTime || 5.0}</SimulationTime>\n`;
            xml += `\t\t\t\t<Frequency>${model.stabilitySettings.frequency || 60.0}</Frequency>\n`;
            xml += `\t\t\t\t<UseCOI>${model.stabilitySettings.useCOI ? 1 : 0}</UseCOI>\n`;
            xml += '\t\t\t</Stability>\n';
        }
        xml += '\t\t</SimulationProperties>\n';
        xml += '\t</Properties>\n';
        xml += '\t<Elements>\n';

        // 1. BusList
        xml += '\t\t<BusList>\n';
        model.buses.forEach((b, idx) => {
            xml += `\t\t\t<Bus ID="${b.id}">\n`;
            xml += '\t\t\t\t<CADProperties>\n';
            xml += `\t\t\t\t\t<Position><X>${b.x.toFixed(2)}</X><Y>${b.y.toFixed(2)}</Y></Position>\n`;
            xml += `\t\t\t\t\t<Size><Width>${b.width}</Width><Height>${b.height}</Height></Size>\n`;
            xml += `\t\t\t\t\t<Angle>${b.angle}</Angle>\n`;
            xml += '\t\t\t\t</CADProperties>\n';
            xml += '\t\t\t\t<ElectricalProperties>\n';
            xml += `\t\t\t\t\t<Name>${b.name}</Name>\n`;
            xml += `\t\t\t\t\t<NominalVoltage UnitID="2">${b.nominalVoltage}</NominalVoltage>\n`;
            xml += `\t\t\t\t\t<SlackBus>${b.isSlack ? 1 : 0}</SlackBus>\n`;
            xml += `\t\t\t\t\t<IsVoltageControlled>${b.isPV || b.isSlack ? 1 : 0}</IsVoltageControlled>\n`;
            xml += `\t\t\t\t\t<ControlledVoltage>${b.targetVoltage || 1.0}</ControlledVoltage>\n`;
            const fTypeMap = { '3phase': 0, '2phase': 1, '2phase-g': 2, '1phase-g': 3 };
            const fLocMap = { 'A': 0, 'B': 1, 'C': 2, 'AB': 0, 'BC': 1, 'CA': 2, 'ABC': 0 };
            xml += '\t\t\t\t\t<Fault>\n';
            xml += `\t\t\t\t\t\t<HasFault>${b.hasFault ? 1 : 0}</HasFault>\n`;
            xml += `\t\t\t\t\t\t<Type>${fTypeMap[b.faultType] ?? 0}</Type>\n`;
            xml += `\t\t\t\t\t\t<Location>${fLocMap[b.faultPhases] ?? 0}</Location>\n`;
            xml += `\t\t\t\t\t\t<Resistance>${b.faultResistance ?? 0.0}</Resistance>\n`;
            xml += `\t\t\t\t\t\t<Reactance>${b.faultReactance ?? 0.0}</Reactance>\n`;
            xml += '\t\t\t\t\t</Fault>\n';
            if (b.stabHasFault) {
                xml += '\t\t\t\t\t<Stability>\n';
                xml += `\t\t\t\t\t\t<HasFault>1</HasFault>\n`;
                xml += `\t\t\t\t\t\t<FaultTime>${b.stabFaultTime}</FaultTime>\n`;
                xml += `\t\t\t\t\t\t<FaultLength>${b.stabFaultLength}</FaultLength>\n`;
                xml += `\t\t\t\t\t\t<FaultResistance>${b.stabFaultResistance}</FaultResistance>\n`;
                xml += `\t\t\t\t\t\t<FaultReactance>${b.stabFaultReactance}</FaultReactance>\n`;
                xml += '\t\t\t\t\t</Stability>\n';
            }
            xml += '\t\t\t\t</ElectricalProperties>\n';
            xml += '\t\t\t</Bus>\n';
        });
        xml += '\t\t</BusList>\n';

        // 2. LineList
        xml += '\t\t<LineList>\n';
        model.lines.forEach((l, idx) => {
            xml += `\t\t\t<Line ID="${l.id}">\n`;
            xml += '\t\t\t\t<ParentIDList>\n';
            if (l.fromBus) xml += `\t\t\t\t\t<ID>${l.fromBus.id}</ID>\n`;
            if (l.toBus) xml += `\t\t\t\t\t<ID>${l.toBus.id}</ID>\n`;
            xml += '\t\t\t\t</ParentIDList>\n';
            xml += '\t\t\t\t<ElectricalProperties>\n';
            xml += `\t\t\t\t\t<Name>${l.name}</Name>\n`;
            xml += `\t\t\t\t\t<Resistance>${l.resistance}</Resistance>\n`;
            xml += `\t\t\t\t\t<IndReactance>${l.indReactance}</IndReactance>\n`;
            xml += `\t\t\t\t\t<Susceptance>${l.susceptance}</Susceptance>\n`;
            xml += `\t\t\t\t\t<Length>${l.length}</Length>\n`;
            xml += '\t\t\t\t</ElectricalProperties>\n';
            // Per-terminal breaker states
            xml += '\t\t\t\t<BreakerStates>\n';
            xml += `\t\t\t\t\t<BreakerFrom>${l.breakerFrom !== false ? 1 : 0}</BreakerFrom>\n`;
            xml += `\t\t\t\t\t<BreakerTo>${l.breakerTo !== false ? 1 : 0}</BreakerTo>\n`;
            xml += '\t\t\t\t</BreakerStates>\n';
            xml += '\t\t\t</Line>\n';
        });
        xml += '\t\t</LineList>\n';

        // 3. TransformerList
        xml += '\t\t<TransformerList>\n';
        model.transformers.forEach((t, idx) => {
            xml += `\t\t\t<Transformer ID="${t.id}">\n`;
            xml += '\t\t\t\t<CADProperties>\n';
            xml += `\t\t\t\t\t<Position><X>${t.x.toFixed(2)}</X><Y>${t.y.toFixed(2)}</Y></Position>\n`;
            xml += '\t\t\t\t</CADProperties>\n';
            xml += '\t\t\t\t<ParentIDList>\n';
            if (t.fromBus) xml += `\t\t\t\t\t<ID>${t.fromBus.id}</ID>\n`;
            if (t.toBus) xml += `\t\t\t\t\t<ID>${t.toBus.id}</ID>\n`;
            xml += '\t\t\t\t</ParentIDList>\n';
            xml += '\t\t\t\t<ElectricalProperties>\n';
            xml += `\t\t\t\t\t<Name>${t.name}</Name>\n`;
            xml += `\t\t\t\t\t<Resistance>${t.resistance}</Resistance>\n`;
            xml += `\t\t\t\t\t<IndReactance>${t.indReactance}</IndReactance>\n`;
            xml += `\t\t\t\t\t<TurnsRatio>${t.turnsRatio}</TurnsRatio>\n`;
            xml += `\t\t\t\t\t<PrimaryNominalVoltage>${t.primaryNominalVoltage}</PrimaryNominalVoltage>\n`;
            xml += `\t\t\t\t\t<SecondaryNominalVoltage>${t.secondaryNominalVoltage}</SecondaryNominalVoltage>\n`;
            xml += `\t\t\t\t\t<HasTapChanger>${t.hasTapChanger ? 1 : 0}</HasTapChanger>\n`;
            xml += `\t\t\t\t\t<OltcControlledBus>${t.oltcControlledBus}</OltcControlledBus>\n`;
            xml += `\t\t\t\t\t<OltcTargetVoltage>${t.oltcTargetVoltage}</OltcTargetVoltage>\n`;
            xml += `\t\t\t\t\t<OltcVoltageDeadband>${t.oltcVoltageDeadband}</OltcVoltageDeadband>\n`;
            xml += `\t\t\t\t\t<OltcMinTap>${t.oltcMinTap}</OltcMinTap>\n`;
            xml += `\t\t\t\t\t<OltcMaxTap>${t.oltcMaxTap}</OltcMaxTap>\n`;
            xml += `\t\t\t\t\t<OltcTapStep>${t.oltcTapStep}</OltcTapStep>\n`;
            xml += `\t\t\t\t\t<OltcIsDiscrete>${t.oltcIsDiscrete ? 1 : 0}</OltcIsDiscrete>\n`;
            xml += '\t\t\t\t</ElectricalProperties>\n';
            // Per-terminal breaker states for transformer
            xml += '\t\t\t\t<BreakerStates>\n';
            xml += `\t\t\t\t\t<BreakerFrom>${t.breakerFrom !== false ? 1 : 0}</BreakerFrom>\n`;
            xml += `\t\t\t\t\t<BreakerTo>${t.breakerTo !== false ? 1 : 0}</BreakerTo>\n`;
            xml += '\t\t\t\t</BreakerStates>\n';
            xml += '\t\t\t</Transformer>\n';
        });
        xml += '\t\t</TransformerList>\n';

        // 4. SyncGeneratorList
        xml += '\t\t<SyncGeneratorList>\n';
        model.generators.forEach((g, idx) => {
            xml += `\t\t\t<SyncGenerator ID="${g.id}">\n`;
            xml += '\t\t\t\t<CADProperties>\n';
            xml += `\t\t\t\t\t<Position><X>${g.x.toFixed(2)}</X><Y>${g.y.toFixed(2)}</Y></Position>\n`;
            xml += `\t\t\t\t\t<Angle>${g.angle || 0}</Angle>\n`;
            xml += '\t\t\t\t</CADProperties>\n';
            xml += '\t\t\t\t<ParentIDList>\n';
            if (g.parentBus) xml += `\t\t\t\t\t<ID>${g.parentBus.id}</ID>\n`;
            xml += '\t\t\t\t</ParentIDList>\n';
            xml += '\t\t\t\t<ElectricalProperties>\n';
            xml += `\t\t\t\t\t<Name>${g.name}</Name>\n`;
            xml += `\t\t\t\t\t<ActivePower>${g.activePower}</ActivePower>\n`;
            xml += `\t\t\t\t\t<ReactivePower>${g.reactivePower}</ReactivePower>\n`;
            xml += `\t\t\t\t\t<ControlledVoltage>${g.targetVoltage}</ControlledVoltage>\n`;
            xml += `\t\t\t\t\t<MinQ>${g.qMin}</MinQ>\n`;
            xml += `\t\t\t\t\t<MaxQ>${g.qMax}</MaxQ>\n`;
            xml += '\t\t\t\t\t<Stability>\n';
            xml += `\t\t\t\t\t\t<Inertia>${g.inertia ?? 5.0}</Inertia>\n`;
            xml += `\t\t\t\t\t\t<Damping>${g.damping ?? 0.0}</Damping>\n`;
            xml += `\t\t\t\t\t\t<TransXd>${g.transXd ?? g.xdp ?? 0.25}</TransXd>\n`;
            xml += `\t\t\t\t\t\t<SyncXd>${g.syncXd ?? g.xd ?? 1.2}</SyncXd>\n`;
            xml += `\t\t\t\t\t\t<SyncXq>${g.syncXq ?? 0.8}</SyncXq>\n`;
            xml += `\t\t\t\t\t\t<TransTd0>${g.transTd0 ?? 5.0}</TransTd0>\n`;
            xml += `\t\t\t\t\t\t<ArmResistance>${g.ra ?? 0.005}</ArmResistance>\n`;
            xml += `\t\t\t\t\t\t<UseAVR>${g.useAVR ? 1 : 0}</UseAVR>\n`;
            xml += `\t\t\t\t\t\t<UseSpeedGovernor>${g.useSpeedGovernor ? 1 : 0}</UseSpeedGovernor>\n`;
            if (g.avrDiagram) {
                xml += `\t\t\t\t\t\t<AVRDiagram>${encodeURIComponent(JSON.stringify(g.avrDiagram.toJSON()))}</AVRDiagram>\n`;
            }
            if (g.speedGovDiagram) {
                xml += `\t\t\t\t\t\t<SpeedGovDiagram>${encodeURIComponent(JSON.stringify(g.speedGovDiagram.toJSON()))}</SpeedGovDiagram>\n`;
            }
            xml += '\t\t\t\t\t</Stability>\n';
            xml += '\t\t\t\t</ElectricalProperties>\n';
            xml += '\t\t\t</SyncGenerator>\n';
        });
        xml += '\t\t</SyncGeneratorList>\n';

        // 5. LoadList
        xml += '\t\t<LoadList>\n';
        model.loads.forEach((ld, idx) => {
            xml += `\t\t\t<Load ID="${ld.id}">\n`;
            xml += '\t\t\t\t<CADProperties>\n';
            xml += `\t\t\t\t\t<Position><X>${ld.x.toFixed(2)}</X><Y>${ld.y.toFixed(2)}</Y></Position>\n`;
            xml += '\t\t\t\t</CADProperties>\n';
            xml += '\t\t\t\t<ParentIDList>\n';
            if (ld.parentBus) xml += `\t\t\t\t\t<ID>${ld.parentBus.id}</ID>\n`;
            xml += '\t\t\t\t</ParentIDList>\n';
            xml += '\t\t\t\t<ElectricalProperties>\n';
            xml += `\t\t\t\t\t<Name>${ld.name}</Name>\n`;
            xml += `\t\t\t\t\t<ActivePower>${ld.activePower}</ActivePower>\n`;
            xml += `\t\t\t\t\t<ReactivePower>${ld.reactivePower}</ReactivePower>\n`;
            xml += '\t\t\t\t</ElectricalProperties>\n';
            xml += '\t\t\t</Load>\n';
        });
        xml += '\t\t</LoadList>\n';

        // 7. RelayList (Protection relays 50/51 and 50N/51N + CT)
        xml += '\t\t<RelayList>\n';
        (model.relays || []).forEach((rel, idx) => {
            xml += `\t\t\t<Relay ID="${rel.id}">\n`;
            xml += '\t\t\t\t<CADProperties>\n';
            xml += `\t\t\t\t\t<Terminal>${rel.terminal ?? 0}</Terminal>\n`;
            xml += `\t\t\t\t\t<ShowInCoordogram>${rel.showInCoordogram ? 1 : 0}</ShowInCoordogram>\n`;
            xml += '\t\t\t\t</CADProperties>\n';
            xml += '\t\t\t\t<ParentIDList>\n';
            if (rel.parentElement) xml += `\t\t\t\t\t<ID>${rel.parentElement.id}</ID>\n`;
            xml += '\t\t\t\t</ParentIDList>\n';
            xml += '\t\t\t\t<ElectricalProperties>\n';
            xml += `\t\t\t\t\t<Name>${rel.name}</Name>\n`;
            xml += `\t\t\t\t\t<CTSettings>${encodeURIComponent(JSON.stringify(rel.ct || {}))}</CTSettings>\n`;
            xml += `\t\t\t\t\t<ProtectionSettings>${encodeURIComponent(JSON.stringify(rel.settings || {}))}</ProtectionSettings>\n`;
            xml += '\t\t\t\t</ElectricalProperties>\n';
            xml += '\t\t\t</Relay>\n';
        });
        xml += '\t\t</RelayList>\n';

        // 8. TextList
        xml += '\t\t<TextList>\n';
        model.textLabels.forEach((lbl, idx) => {
            xml += `\t\t\t<Text ID="${lbl.id}">\n`;
            xml += '\t\t\t\t<CADProperties>\n';
            xml += `\t\t\t\t\t<Position><X>${lbl.x.toFixed(2)}</X><Y>${lbl.y.toFixed(2)}</Y></Position>\n`;
            xml += `\t\t\t\t\t<DataType>${lbl.dataType}</DataType>\n`;
            if (lbl.parentElement) xml += `\t\t\t\t\t<ElementID>${lbl.parentElement.id}</ElementID>\n`;
            xml += '\t\t\t\t</CADProperties>\n';
            xml += '\t\t\t</Text>\n';
        });
        xml += '\t\t</TextList>\n';

        xml += '\t</Elements>\n';
        xml += '</Project>\n';

        return xml;
    }

    /**
     * Downloads XML file in user's browser
     */
    static downloadFile(xmlContent, fileName = 'project.tp') {
        const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
