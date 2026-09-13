import { i18n } from './i18n.js';
import { Bus, BusType } from '../elements/Bus.js';
import { Line } from '../elements/Line.js';
import { Transformer } from '../elements/Transformer.js';
import { Generator } from '../elements/Generator.js';
import { Load } from '../elements/Load.js';
import { ControlEditorDialog } from './ControlEditorDialog.js';
import { ShortCircuit } from '../simulation/ShortCircuit.js';

export class Dialogs {
    static showElementModal(element, model, onSave, onDelete) {
        // Remove existing modal if any
        const existing = document.getElementById('elementModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'elementModal';
        modal.className = 'modal-backdrop';

        let bodyHtml = '';
        let title = element.name;

        if (element instanceof Bus) {
            const busColor = model?.getBusColor ? model.getBusColor(element.nominalVoltage) : '#009b41';
            title = `${i18n.t('tools.bus')}: ${element.name}`;
            bodyHtml = `
                <div class="form-row">
                    <label>${i18n.t('dialogs.name')}:</label>
                    <input type="text" id="elName" value="${element.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.nominalVoltage')}:</label>
                    <div style="display: flex; gap: 8px; align-items: center; width: 65%;">
                        <input type="number" id="elNominalV" value="${element.nominalVoltage}" step="0.1" class="form-control" style="flex: 1;">
                        <span id="busColorBadge" style="display: inline-block; width: 24px; height: 24px; border-radius: 4px; background-color: ${busColor}; border: 1px solid #475569;" title="Cor da barra no diagrama"></span>
                    </div>
                </div>
                <div class="form-row" style="margin-top: -6px; margin-bottom: 8px; justify-content: flex-end;">
                    <a href="#" id="linkEditVoltColors" style="font-size: 11px; color: var(--accent-color, #38bdf8); text-decoration: none;">🎨 Configurar cores por nível de tensão...</a>
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.busType')}:</label>
                    <select id="elBusType" class="form-control">
                        <option value="0" ${element.busType === BusType.PQ ? 'selected' : ''}>${i18n.t('dialogs.pq')}</option>
                        <option value="1" ${element.busType === BusType.PV ? 'selected' : ''}>${i18n.t('dialogs.pv')}</option>
                        <option value="2" ${element.busType === BusType.SLACK ? 'selected' : ''}>${i18n.t('dialogs.slack')}</option>
                    </select>
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.targetVoltage')}:</label>
                    <input type="number" id="elTargetV" value="${element.targetVoltage || 1.0}" step="0.001" class="form-control">
                </div>
                <div class="form-row">
                    <label class="checkbox-label font-bold">
                        <input type="checkbox" id="elIsOnline" ${element.isOnline !== false ? 'checked' : ''}>
                        Barra Energizada / Em Operação
                    </label>
                </div>

                <div class="fieldset-box" style="margin-top: 10px; border-color: #f59e0b; background: rgba(245, 158, 11, 0.05);">
                    <div class="fieldset-legend" style="color: #f59e0b;">
                        <label class="checkbox-label font-bold">
                            <input type="checkbox" id="elHasFault" ${element.hasFault ? 'checked' : ''}>
                            💥 Inserir Falta / Curto-Circuito
                        </label>
                    </div>
                    <div id="busFaultSettingsGroup" style="display: ${element.hasFault ? 'block' : 'none'}; margin-top: 8px;">
                        <div class="form-row">
                            <label>Tipo de Falta:</label>
                            <select id="elFaultType" class="form-control">
                                <option value="3phase" ${(element.faultType || '3phase') === '3phase' ? 'selected' : ''}>Trifásica</option>
                                <option value="1phase-g" ${element.faultType === '1phase-g' ? 'selected' : ''}>Monofásica (Fase-Terra)</option>
                                <option value="2phase" ${element.faultType === '2phase' ? 'selected' : ''}>Bifásica (Fase-Fase)</option>
                                <option value="2phase-g" ${element.faultType === '2phase-g' ? 'selected' : ''}>Bifásica à Terra</option>
                            </select>
                        </div>
                        <div class="form-row" id="rowFaultPhases">
                            <label>Fases da Falta:</label>
                            <select id="elFaultPhases" class="form-control"></select>
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>Resistência Rf (Ω):</label>
                                <input type="number" id="elFaultR" value="${element.faultResistance ?? 0.0}" step="0.01" class="form-control">
                            </div>
                            <div>
                                <label>Reatância Xf (Ω):</label>
                                <input type="number" id="elFaultX" value="${element.faultReactance ?? 0.0}" step="0.01" class="form-control">
                            </div>
                        </div>
                        <div class="form-row" style="margin-top: 8px;">
                            <button type="button" id="btnRunFaultImmediate" class="btn btn-primary" style="width: 100%; background: #d97706; border-color: #b45309; padding: 6px 12px; font-weight: bold; cursor: pointer;">
                                ⚡ Simular Curto-Circuito Imediato
                            </button>
                        </div>
                        <div id="faultResultBadge" style="display: ${(element.results?.faultCurrentKA > 0) ? 'block' : 'none'}; margin-top: 8px; padding: 8px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 4px; font-size: 11px; line-height: 1.5;">
                            <div style="font-weight: bold; color: #f59e0b; margin-bottom: 2px;">📊 Resultados da Falta:</div>
                            Corrente Icc: <span id="lblFaultIcc" style="font-weight: bold;">${(element.results?.faultCurrentKA || 0).toFixed(3)}</span> kA | Potência Scc: <span id="lblFaultScc" style="font-weight: bold;">${(element.results?.faultMVA || 0).toFixed(1)}</span> MVA<br>
                            <span id="lblFaultPhases">Ia: ${(element.results?.faultCurrents?.[0] || 0).toFixed(3)} kA | Ib: ${(element.results?.faultCurrents?.[1] || 0).toFixed(3)} kA | Ic: ${(element.results?.faultCurrents?.[2] || 0).toFixed(3)} kA</span><br>
                            Tensão Pós-Falta Vcc: <span id="lblFaultVcc">${(element.results?.faultVoltage ?? 1.0).toFixed(3)}</span> p.u.
                        </div>
                    </div>
                </div>
            `;
        } else if (element instanceof Line) {
            title = `${i18n.t('tools.line')}: ${element.name}`;
            bodyHtml = `
                <div class="form-row">
                    <label>${i18n.t('dialogs.name')}:</label>
                    <input type="text" id="elName" value="${element.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.resistance')}:</label>
                    <input type="number" id="elR" value="${element.resistance}" step="0.001" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.reactance')}:</label>
                    <input type="number" id="elX" value="${element.indReactance}" step="0.001" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.susceptance')}:</label>
                    <input type="number" id="elB" value="${element.susceptance}" step="0.001" class="form-control">
                </div>
                <div class="form-row">
                    <label class="checkbox-label font-bold">
                        <input type="checkbox" id="elIsOnline" ${element.isOnline !== false ? 'checked' : ''}>
                        Disjuntores Fechados / Em Operação (Ligado)
                    </label>
                </div>
            `;
        } else if (element instanceof Transformer) {
            title = `${i18n.t('tools.transformer')}: ${element.name}`;
            bodyHtml = `
                <div class="form-row">
                    <label>${i18n.t('dialogs.name')}:</label>
                    <input type="text" id="elName" value="${element.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label>Orientação:</label>
                    <div style="display: flex; gap: 8px; align-items: center; width: 65%;">
                        <select id="elAngle" class="form-control" style="flex: 1;">
                            <option value="0" ${element.angle === 0 ? 'selected' : ''}>0° (Vertical)</option>
                            <option value="90" ${element.angle === 90 ? 'selected' : ''}>90° (Horizontal)</option>
                            <option value="180" ${element.angle === 180 ? 'selected' : ''}>180° (Vertical invertido)</option>
                            <option value="270" ${element.angle === 270 ? 'selected' : ''}>270° (Horizontal invertido)</option>
                        </select>
                        <button type="button" id="btnRotateEl" class="btn btn-secondary" style="padding: 4px 10px;" title="Girar 90°">🔄 Girar</button>
                    </div>
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.resistance')}:</label>
                    <input type="number" id="elR" value="${element.resistance}" step="0.001" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.reactance')}:</label>
                    <input type="number" id="elX" value="${element.indReactance}" step="0.001" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.turnsRatio')}:</label>
                    <input type="number" id="elTap" value="${element.turnsRatio}" step="0.001" class="form-control">
                </div>

                <div class="fieldset-box">
                    <div class="fieldset-legend">
                        <label class="checkbox-label font-bold">
                            <input type="checkbox" id="elHasOltc" ${element.hasTapChanger ? 'checked' : ''}>
                            ${i18n.t('dialogs.enableOLTC')}
                        </label>
                    </div>
                    <div id="oltcSettingsGroup" style="display: ${element.hasTapChanger ? 'block' : 'none'}; margin-top: 8px;">
                        <div class="form-row">
                            <label>${i18n.t('dialogs.controlledBus')}:</label>
                            <select id="elOltcBus" class="form-control">
                                <option value="0" ${element.oltcControlledBus === 0 ? 'selected' : ''}>${element.fromBus ? element.fromBus.name : 'Barra 1 (Primária)'}</option>
                                <option value="1" ${element.oltcControlledBus === 1 ? 'selected' : ''}>${element.toBus ? element.toBus.name : 'Barra 2 (Secundária)'}</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>${i18n.t('dialogs.targetVoltage')}:</label>
                            <input type="number" id="elOltcTargetV" value="${element.oltcTargetVoltage || 1.0}" step="0.005" class="form-control">
                        </div>
                        <div class="form-row">
                            <label>${i18n.t('dialogs.deadband')}:</label>
                            <input type="number" id="elOltcDeadband" value="${element.oltcVoltageDeadband || 0.005}" step="0.001" class="form-control">
                        </div>
                        <div class="form-row-2col">
                            <div>
                                <label>${i18n.t('dialogs.minTap')}:</label>
                                <input type="number" id="elOltcMin" value="${element.oltcMinTap || 0.90}" step="0.01" class="form-control">
                            </div>
                            <div>
                                <label>${i18n.t('dialogs.maxTap')}:</label>
                                <input type="number" id="elOltcMax" value="${element.oltcMaxTap || 1.10}" step="0.01" class="form-control">
                            </div>
                        </div>
                        <div class="form-row">
                            <label>${i18n.t('dialogs.tapStep')}:</label>
                            <input type="number" id="elOltcStep" value="${element.oltcTapStep || 0.00625}" step="0.001" class="form-control">
                        </div>
                        <div class="form-row">
                            <label class="checkbox-label">
                                <input type="checkbox" id="elOltcDiscrete" ${element.oltcIsDiscrete ? 'checked' : ''}>
                                ${i18n.t('dialogs.discreteStep')}
                            </label>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <label class="checkbox-label font-bold">
                        <input type="checkbox" id="elIsOnline" ${element.isOnline !== false ? 'checked' : ''}>
                        Disjuntores Fechados / Em Operação (Ligado)
                    </label>
                </div>
            `;
        } else if (element instanceof Generator) {
            title = `${i18n.t('tools.generator')}: ${element.name}`;
            bodyHtml = `
                <div class="form-row">
                    <label>${i18n.t('dialogs.name')}:</label>
                    <input type="text" id="elName" value="${element.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label>Orientação:</label>
                    <div style="display: flex; gap: 8px; align-items: center; width: 65%;">
                        <select id="elAngle" class="form-control" style="flex: 1;">
                            <option value="0" ${element.angle === 0 ? 'selected' : ''}>0° (Cima)</option>
                            <option value="90" ${element.angle === 90 ? 'selected' : ''}>90° (Direita)</option>
                            <option value="180" ${element.angle === 180 ? 'selected' : ''}>180° (Baixo)</option>
                            <option value="270" ${element.angle === 270 ? 'selected' : ''}>270° (Esquerda)</option>
                        </select>
                        <button type="button" id="btnRotateEl" class="btn btn-secondary" style="padding: 4px 10px;" title="Girar 90°">🔄 Girar</button>
                    </div>
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.activePower')}:</label>
                    <input type="number" id="elP" value="${element.activePower}" step="1.0" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.reactivePower')}:</label>
                    <input type="number" id="elQ" value="${element.reactivePower}" step="1.0" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.targetVoltage')}:</label>
                    <input type="number" id="elTargetV" value="${element.targetVoltage || 1.0}" step="0.005" class="form-control">
                </div>
                <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin: 8px 0; background: rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; font-weight: 600; color: var(--accent-color); margin-bottom: 8px;">📈 Estabilidade & Dinâmica da Máquina:</div>
                    <div class="form-row-2col">
                        <div>
                            <label style="font-size: 11px;">Inércia H (s):</label>
                            <input type="number" id="elInertia" value="${element.inertia ?? 5.0}" step="0.1" class="form-control">
                        </div>
                        <div>
                            <label style="font-size: 11px;">Reat. Transitória X'd (p.u.):</label>
                            <input type="number" id="elTransXd" value="${element.transXd ?? element.xdp ?? 0.25}" step="0.01" class="form-control">
                        </div>
                    </div>
                    <div class="form-row-2col" style="margin-top: 6px;">
                        <div>
                            <label style="font-size: 11px;">Amortecimento D (p.u.):</label>
                            <input type="number" id="elDamping" value="${element.damping ?? 0.0}" step="0.5" class="form-control">
                        </div>
                        <div>
                            <label style="font-size: 11px;">Tempo T'd0 (s):</label>
                            <input type="number" id="elTransTd0" value="${element.transTd0 ?? 5.0}" step="0.5" class="form-control">
                        </div>
                    </div>
                    <div class="form-row-2col" style="margin-top: 6px;">
                        <div>
                            <label style="font-size: 11px;">Reat. Síncrona Xd (p.u.):</label>
                            <input type="number" id="elSyncXd" value="${element.syncXd ?? element.xd ?? 1.2}" step="0.05" class="form-control">
                        </div>
                        <div>
                            <label style="font-size: 11px;">Reat. Quadratura Xq (p.u.):</label>
                            <input type="number" id="elSyncXq" value="${element.syncXq ?? 0.8}" step="0.05" class="form-control">
                        </div>
                    </div>
                    <div class="form-row" style="margin-top: 6px;">
                        <label style="font-size: 11px;">Modelo Dinâmico:</label>
                        <select id="elModelType" class="form-control" style="font-size: 11px;">
                            <option value="1" ${(element.modelType ?? 1) === 1 ? 'selected' : ''}>Modelo 1 (Clássico - E' constante)</option>
                            <option value="2" ${(element.modelType ?? 1) === 2 ? 'selected' : ''}>Modelo 2 (Transitório - Decaimento de Fluxo)</option>
                        </select>
                    </div>

                    <!-- AVR and Speed Governor Block Diagram Controls -->
                    <div style="margin-top: 10px; padding: 8px 10px; border: 1px solid var(--border-color); border-radius: 6px; background: rgba(56, 189, 248, 0.05);">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent-color); margin-bottom: 6px;">🎮 Controles Automáticos (Diagramas de Blocos):</div>
                        
                        <!-- AVR Row -->
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <label class="checkbox-label" style="font-size: 12px; font-weight: 500;">
                                <input type="checkbox" id="elUseAVR" ${element.useAVR ? 'checked' : ''}>
                                ⚡ Habilitar Regulador Tensão (AVR)
                            </label>
                            <button type="button" class="btn btn-secondary" id="btnEditAVR" style="font-size: 11px; padding: 3px 10px;" title="Abrir editor gráfico do diagrama de blocos do AVR">
                                ✏️ Editar AVR...
                            </button>
                        </div>

                        <!-- Speed Governor Row -->
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; margin-top: 4px;">
                            <label class="checkbox-label" style="font-size: 12px; font-weight: 500;">
                                <input type="checkbox" id="elUseGov" ${element.useSpeedGovernor ? 'checked' : ''}>
                                ⚙️ Habilitar Regulador Velocidade (Gov)
                            </label>
                            <button type="button" class="btn btn-secondary" id="btnEditGov" style="font-size: 11px; padding: 3px 10px;" title="Abrir editor gráfico do regulador de velocidade">
                                ✏️ Editar Gov...
                            </button>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <label class="checkbox-label font-bold">
                        <input type="checkbox" id="elIsOnline" ${element.isOnline !== false ? 'checked' : ''}>
                        Disjuntor Fechado / Em Operação (Ligado)
                    </label>
                </div>
            `;
        } else if (element instanceof Load) {
            title = `${i18n.t('tools.load')}: ${element.name}`;
            bodyHtml = `
                <div class="form-row">
                    <label>${i18n.t('dialogs.name')}:</label>
                    <input type="text" id="elName" value="${element.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.activePower')}:</label>
                    <input type="number" id="elP" value="${element.activePower}" step="1.0" class="form-control">
                </div>
                <div class="form-row">
                    <label>${i18n.t('dialogs.reactivePower')}:</label>
                    <input type="number" id="elQ" value="${element.reactivePower}" step="1.0" class="form-control">
                </div>
                <div class="form-row">
                    <label class="checkbox-label font-bold">
                        <input type="checkbox" id="elIsOnline" ${element.isOnline !== false ? 'checked' : ''}>
                        Em Operação (Ligado)
                    </label>
                </div>
            `;
        } else {
            title = element.name;
            bodyHtml = `
                <div class="form-row">
                    <label>${i18n.t('dialogs.name')}:</label>
                    <input type="text" id="elName" value="${element.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label class="checkbox-label font-bold">
                        <input type="checkbox" id="elIsOnline" ${element.isOnline !== false ? 'checked' : ''}>
                        Em Operação (Ligado)
                    </label>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-btn" id="modalClose">✕</button>
                </div>
                <div class="modal-body">
                    ${bodyHtml}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" id="modalDelete">${i18n.t('dialogs.delete')}</button>
                    <div style="flex: 1"></div>
                    <button class="btn btn-secondary" id="modalCancel">${i18n.t('dialogs.cancel')}</button>
                    <button class="btn btn-primary" id="modalSave">${i18n.t('dialogs.ok')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Rotation button listener
        const btnRotate = modal.querySelector('#btnRotateEl');
        const selAngle = modal.querySelector('#elAngle');
        if (btnRotate && selAngle) {
            btnRotate.addEventListener('click', () => {
                element.rotate();
                selAngle.value = String(element.angle);
                if (onSave) onSave(element);
            });
        }

        // Live nominal voltage color badge update
        const inputNominalV = modal.querySelector('#elNominalV');
        const colorBadge = modal.querySelector('#busColorBadge');
        if (inputNominalV && colorBadge) {
            inputNominalV.addEventListener('input', (e) => {
                const v = parseFloat(e.target.value) || 138;
                if (model?.getBusColor) {
                    colorBadge.style.backgroundColor = model.getBusColor(v);
                }
            });
        }

        // Voltage level colors link listener
        modal.querySelector('#linkEditVoltColors')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (model) {
                Dialogs.showVoltageLevelsModal(model, () => {
                    if (colorBadge && model.getBusColor) {
                        const v = parseFloat(inputNominalV?.value) || element.nominalVoltage;
                        colorBadge.style.backgroundColor = model.getBusColor(v);
                    }
                    if (onSave) onSave(element);
                });
            }
        });

        // Bus short circuit fault event listeners
        if (element instanceof Bus) {
            const hasFaultCheck = modal.querySelector('#elHasFault');
            const faultGroup = modal.querySelector('#busFaultSettingsGroup');
            const selFaultType = modal.querySelector('#elFaultType');
            const selFaultPhases = modal.querySelector('#elFaultPhases');
            const btnRunFault = modal.querySelector('#btnRunFaultImmediate');

            const updateFaultPhases = () => {
                if (!selFaultType || !selFaultPhases) return;
                const type = selFaultType.value;
                const currentPhase = element.faultPhases || 'ABC';
                selFaultPhases.innerHTML = '';

                if (type === '3phase') {
                    selFaultPhases.innerHTML = '<option value="ABC">Trifásica (Fases ABC)</option>';
                    selFaultPhases.disabled = true;
                } else if (type === '1phase-g') {
                    selFaultPhases.disabled = false;
                    selFaultPhases.innerHTML = `
                        <option value="A" ${currentPhase === 'A' ? 'selected' : ''}>Fase A</option>
                        <option value="B" ${currentPhase === 'B' ? 'selected' : ''}>Fase B</option>
                        <option value="C" ${currentPhase === 'C' ? 'selected' : ''}>Fase C</option>
                    `;
                } else { // 2phase or 2phase-g
                    selFaultPhases.disabled = false;
                    selFaultPhases.innerHTML = `
                        <option value="BC" ${currentPhase === 'BC' ? 'selected' : ''}>Fases BC</option>
                        <option value="CA" ${currentPhase === 'CA' ? 'selected' : ''}>Fases CA</option>
                        <option value="AB" ${currentPhase === 'AB' ? 'selected' : ''}>Fases AB</option>
                    `;
                }
            };

            if (hasFaultCheck && faultGroup) {
                hasFaultCheck.addEventListener('change', () => {
                    faultGroup.style.display = hasFaultCheck.checked ? 'block' : 'none';
                    if (hasFaultCheck.checked) updateFaultPhases();
                });
            }

            if (selFaultType) {
                selFaultType.addEventListener('change', updateFaultPhases);
                updateFaultPhases();
            }

            if (btnRunFault) {
                btnRunFault.addEventListener('click', () => {
                    element.hasFault = true;
                    if (hasFaultCheck) hasFaultCheck.checked = true;
                    if (selFaultType) element.faultType = selFaultType.value;
                    if (selFaultPhases) element.faultPhases = selFaultPhases.value;
                    element.faultResistance = parseFloat(modal.querySelector('#elFaultR')?.value) || 0.0;
                    element.faultReactance = parseFloat(modal.querySelector('#elFaultX')?.value) || 0.0;

                    const res = ShortCircuit.solve(model, element, element.faultType, element.faultPhases, element.faultResistance, element.faultReactance, 'ohm');
                    
                    const badge = modal.querySelector('#faultResultBadge');
                    const lblIcc = modal.querySelector('#lblFaultIcc');
                    const lblScc = modal.querySelector('#lblFaultScc');
                    const lblPhases = modal.querySelector('#lblFaultPhases');
                    const lblVcc = modal.querySelector('#lblFaultVcc');

                    if (badge) badge.style.display = 'block';
                    if (lblIcc) lblIcc.textContent = (element.results?.faultCurrentKA || 0).toFixed(3);
                    if (lblScc) lblScc.textContent = (element.results?.faultMVA || 0).toFixed(1);
                    if (lblPhases) {
                        const cur = element.results?.faultCurrents || [0, 0, 0];
                        lblPhases.textContent = `Ia: ${cur[0].toFixed(3)} kA | Ib: ${cur[1].toFixed(3)} kA | Ic: ${cur[2].toFixed(3)} kA`;
                    }
                    if (lblVcc) lblVcc.textContent = (element.results?.faultVoltage ?? 1.0).toFixed(3);

                    if (onSave) onSave(element);
                });
            }
        }

        // OLTC toggle listener
        const hasOltcCheck = modal.querySelector('#elHasOltc');
        const oltcGroup = modal.querySelector('#oltcSettingsGroup');
        if (hasOltcCheck && oltcGroup) {
            hasOltcCheck.addEventListener('change', () => {
                oltcGroup.style.display = hasOltcCheck.checked ? 'block' : 'none';
            });
        }

        // Generator AVR and Speed Governor edit button listeners
        if (element instanceof Generator) {
            modal.querySelector('#btnEditAVR')?.addEventListener('click', () => {
                ControlEditorDialog.open(element.avrDiagram, 'avr', (newDiag) => {
                    element.avrDiagram = newDiag;
                    element.useAVR = true;
                    const chk = modal.querySelector('#elUseAVR');
                    if (chk) chk.checked = true;
                }, { elementName: element.name });
            });

            modal.querySelector('#btnEditGov')?.addEventListener('click', () => {
                ControlEditorDialog.open(element.speedGovDiagram, 'speed_gov', (newDiag) => {
                    element.speedGovDiagram = newDiag;
                    element.useSpeedGovernor = true;
                    const chk = modal.querySelector('#elUseGov');
                    if (chk) chk.checked = true;
                }, { elementName: element.name });
            });
        }

        // Close/Cancel
        const close = () => modal.remove();
        modal.querySelector('#modalClose').addEventListener('click', close);
        modal.querySelector('#modalCancel').addEventListener('click', close);

        // Delete
        modal.querySelector('#modalDelete').addEventListener('click', () => {
            if (onDelete) onDelete(element);
            close();
        });

        // Save
        modal.querySelector('#modalSave').addEventListener('click', () => {
            const name = modal.querySelector('#elName')?.value;
            if (name) element.name = name;

            // Save angle if applicable
            if (modal.querySelector('#elAngle')) {
                element.angle = parseInt(modal.querySelector('#elAngle').value, 10) || 0;
            }

            // Save online state
            if (modal.querySelector('#elIsOnline')) {
                element.isOnline = modal.querySelector('#elIsOnline').checked;
                if (!element.isOnline && element.results) {
                    element.results.p12 = 0.0;
                    element.results.q12 = 0.0;
                    element.results.p21 = 0.0;
                    element.results.q21 = 0.0;
                    element.results.pLoss = 0.0;
                    element.results.qLoss = 0.0;
                    element.results.i12 = 0.0;
                    element.results.i21 = 0.0;
                    element.results.direction = 0;
                }
            }

            if (element instanceof Bus) {
                element.nominalVoltage = parseFloat(modal.querySelector('#elNominalV').value) || 138.0;
                element.busType = parseInt(modal.querySelector('#elBusType').value, 10);
                element.targetVoltage = parseFloat(modal.querySelector('#elTargetV').value) || 1.0;

                const hasFault = modal.querySelector('#elHasFault')?.checked || false;
                element.hasFault = hasFault;
                if (modal.querySelector('#elFaultType')) {
                    element.faultType = modal.querySelector('#elFaultType').value;
                    element.faultPhases = modal.querySelector('#elFaultPhases').value;
                    element.faultResistance = parseFloat(modal.querySelector('#elFaultR').value) || 0.0;
                    element.faultReactance = parseFloat(modal.querySelector('#elFaultX').value) || 0.0;
                }
                if (hasFault) {
                    ShortCircuit.solve(model, element, element.faultType, element.faultPhases, element.faultResistance, element.faultReactance, 'ohm');
                } else if (element.results) {
                    element.results.faultCurrents = [0, 0, 0];
                    element.results.faultCurrentKA = 0.0;
                    element.results.faultMVA = 0.0;
                }
            } else if (element instanceof Line) {
                element.resistance = parseFloat(modal.querySelector('#elR').value) || 0.02;
                element.indReactance = parseFloat(modal.querySelector('#elX').value) || 0.08;
                element.susceptance = parseFloat(modal.querySelector('#elB').value) || 0.02;
            } else if (element instanceof Transformer) {
                element.resistance = parseFloat(modal.querySelector('#elR').value) || 0.005;
                element.indReactance = parseFloat(modal.querySelector('#elX').value) || 0.05;
                element.turnsRatio = parseFloat(modal.querySelector('#elTap').value) || 1.0;
                element.nominalTurnsRatio = element.turnsRatio;

                element.hasTapChanger = modal.querySelector('#elHasOltc').checked;
                element.oltcControlledBus = parseInt(modal.querySelector('#elOltcBus').value, 10);
                element.oltcTargetVoltage = parseFloat(modal.querySelector('#elOltcTargetV').value) || 1.0;
                element.oltcVoltageDeadband = parseFloat(modal.querySelector('#elOltcDeadband').value) || 0.005;
                element.oltcMinTap = parseFloat(modal.querySelector('#elOltcMin').value) || 0.90;
                element.oltcMaxTap = parseFloat(modal.querySelector('#elOltcMax').value) || 1.10;
                element.oltcTapStep = parseFloat(modal.querySelector('#elOltcStep').value) || 0.00625;
                element.oltcIsDiscrete = modal.querySelector('#elOltcDiscrete').checked;
            } else if (element instanceof Generator) {
                element.activePower = parseFloat(modal.querySelector('#elP').value) || 50.0;
                element.reactivePower = parseFloat(modal.querySelector('#elQ').value) || 10.0;
                element.targetVoltage = parseFloat(modal.querySelector('#elTargetV').value) || 1.0;
                if (modal.querySelector('#elInertia')) {
                    element.inertia = parseFloat(modal.querySelector('#elInertia').value) || 5.0;
                    element.transXd = parseFloat(modal.querySelector('#elTransXd').value) || 0.25;
                    element.damping = parseFloat(modal.querySelector('#elDamping').value) || 0.0;
                    element.transTd0 = parseFloat(modal.querySelector('#elTransTd0').value) || 5.0;
                    element.syncXd = parseFloat(modal.querySelector('#elSyncXd').value) || 1.2;
                    element.syncXq = parseFloat(modal.querySelector('#elSyncXq').value) || 0.8;
                    element.modelType = parseInt(modal.querySelector('#elModelType').value, 10) || 1;
                    element.xdp = element.transXd;
                    element.xd = element.syncXd;
                }
                if (modal.querySelector('#elUseAVR')) {
                    element.useAVR = modal.querySelector('#elUseAVR').checked;
                }
                if (modal.querySelector('#elUseGov')) {
                    element.useSpeedGovernor = modal.querySelector('#elUseGov').checked;
                }
            } else if (element instanceof Load) {
                element.activePower = parseFloat(modal.querySelector('#elP').value) || 30.0;
                element.reactivePower = parseFloat(modal.querySelector('#elQ').value) || 15.0;
            }

            if (onSave) onSave(element);
            close();
        });
    }

    /**
     * General settings dialog (with floating toolbar checkbox toggle)
     */
    static showSettingsModal(model, app) {
        const existing = document.getElementById('settingsModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.className = 'modal-backdrop';

        modal.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">
                    <h3>${i18n.t('options')}</h3>
                    <button class="close-btn" id="modalClose">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <label>Potência Base do Sistema (MVA):</label>
                        <input type="number" id="setBasePower" value="${model.basePower}" class="form-control">
                    </div>
                    <div class="form-row">
                        <label>Método de Fluxo de Carga:</label>
                        <select id="setPfMethod" class="form-control">
                            <option value="Newton-Raphson" ${model.powerFlowSettings.method === 'Newton-Raphson' ? 'selected' : ''}>Newton-Raphson</option>
                            <option value="Gauss-Seidel" ${model.powerFlowSettings.method === 'Gauss-Seidel' ? 'selected' : ''}>Gauss-Seidel</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label>Tolerância de Convergência:</label>
                        <input type="text" id="setPfTol" value="${model.powerFlowSettings.tolerance}" class="form-control">
                    </div>
                    <div class="form-row">
                        <label>Máximo de Iterações:</label>
                        <input type="number" id="setPfMaxIter" value="${model.powerFlowSettings.maxIterations}" class="form-control">
                    </div>
                    <div class="form-row">
                        <label class="checkbox-label">
                            <input type="checkbox" id="setEnableOLTC" ${model.powerFlowSettings.enableOLTC ? 'checked' : ''}>
                            Habilitar comutadores de tap sob carga (OLTC) na simulação
                        </label>
                    </div>
                    <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 16px 0;">
                    <div class="form-row" style="margin-bottom: 12px;">
                        <button type="button" id="btnSettingsVoltageColors" class="btn btn-secondary" style="width: 100%; text-align: left; padding: 8px 12px;">
                            🎨 Configurar Cores dos Níveis de Tensão (Barras)...
                        </button>
                    </div>
                    <div class="form-row" style="justify-content: flex-end; margin-top: 10px;">
                        <label class="checkbox-label font-bold" style="color: var(--accent-color);">
                            <input type="checkbox" id="setShowToolbar" ${app.floatingToolbar?.visible ? 'checked' : ''}>
                            ${i18n.t('floatingToolbar')}
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modalCancel">${i18n.t('dialogs.cancel')}</button>
                    <button class="btn btn-primary" id="modalSave">${i18n.t('dialogs.ok')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#btnSettingsVoltageColors')?.addEventListener('click', () => {
            Dialogs.showVoltageLevelsModal(model, () => {
                app.canvas?.requestRender();
            });
        });

        const close = () => modal.remove();
        modal.querySelector('#modalClose').addEventListener('click', close);
        modal.querySelector('#modalCancel').addEventListener('click', close);

        modal.querySelector('#modalSave').addEventListener('click', () => {
            model.basePower = parseFloat(modal.querySelector('#setBasePower').value) || 100.0;
            model.powerFlowSettings.method = modal.querySelector('#setPfMethod').value;
            model.powerFlowSettings.tolerance = parseFloat(modal.querySelector('#setPfTol').value) || 1e-5;
            model.powerFlowSettings.maxIterations = parseInt(modal.querySelector('#setPfMaxIter').value, 10) || 100;
            model.powerFlowSettings.enableOLTC = modal.querySelector('#setEnableOLTC').checked;

            const showToolbar = modal.querySelector('#setShowToolbar').checked;
            app.floatingToolbar?.setVisible(showToolbar);

            close();
        });
    }

    /**
     * Dialog to configure voltage levels and busbar colors (TechProt compliant)
     * @param {Model} model
     * @param {Function} onSave
     */
    static showVoltageLevelsModal(model, onSave) {
        const existing = document.getElementById('voltageLevelsModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'voltageLevelsModal';
        modal.className = 'modal-backdrop';

        // Deep copy current voltage levels
        let levels = (model.voltageLevels || []).map(l => ({ ...l }));

        const renderTableRows = () => {
            return levels.map((lvl, index) => `
                <tr data-index="${index}" style="border-bottom: 1px solid var(--border-color, #334155);">
                    <td style="padding: 6px 8px;">
                        <input type="number" step="0.1" value="${lvl.voltage}" class="form-control lvl-voltage" style="width: 90px; padding: 4px 6px;">
                    </td>
                    <td style="padding: 6px 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="color" value="${lvl.color}" class="lvl-color-picker" style="width: 32px; height: 30px; padding: 1px; border-radius: 4px; border: 1px solid var(--border-color, #475569); cursor: pointer;">
                            <input type="text" value="${lvl.color}" class="form-control lvl-color-text" style="width: 80px; padding: 4px 6px; font-family: monospace; font-size: 11px;">
                        </div>
                    </td>
                    <td style="padding: 6px 8px; text-align: center;">
                        <div class="lvl-preview-bar" style="width: 65px; height: 12px; background-color: ${lvl.color}; border-radius: 2px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>
                    </td>
                    <td style="padding: 6px 8px;">
                        <input type="text" value="${lvl.name || `${lvl.voltage} kV`}" class="form-control lvl-name" style="width: 140px; padding: 4px 6px;">
                    </td>
                    <td style="padding: 6px 8px; text-align: center;">
                        <button type="button" class="btn btn-danger btn-del-lvl" data-idx="${index}" style="padding: 2px 8px; font-size: 12px;" title="Remover nível">✕</button>
                    </td>
                </tr>
            `).join('');
        };

        modal.innerHTML = `
            <div class="modal-card" style="max-width: 660px; width: 95%;">
                <div class="modal-header">
                    <h3>🎨 Níveis de Tensão (Cores das Barras)</h3>
                    <button class="close-btn" id="vlClose">✕</button>
                </div>
                <div class="modal-body" style="max-height: 65vh; overflow-y: auto;">
                    <p style="font-size: 12px; color: var(--text-muted, #94a3b8); margin-bottom: 12px;">
                        Defina as cores das barras por nível de tensão nominal (kV) conforme o padrão do TechProt. Barras com tensão próxima (tolerância de 15%) assumem a respectiva cor configurada.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color, #475569); text-align: left; color: var(--text-muted, #94a3b8);">
                                <th style="padding: 6px 8px;">Tensão (kV)</th>
                                <th style="padding: 6px 8px;">Cor</th>
                                <th style="padding: 6px 8px; text-align: center;">Amostra</th>
                                <th style="padding: 6px 8px;">Descrição</th>
                                <th style="padding: 6px 8px; text-align: center;">Excluir</th>
                            </tr>
                        </thead>
                        <tbody id="vlTableBody">
                            ${renderTableRows()}
                        </tbody>
                    </table>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
                        <button type="button" class="btn btn-secondary" id="vlAddLevel" style="font-size: 12px;">
                            ➕ Adicionar Nível de Tensão
                        </button>
                        <button type="button" class="btn btn-secondary" id="vlResetDefaults" style="font-size: 12px;" title="Restaurar valores padrão do TechProt">
                            🔄 Restaurar Padrões TechProt
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="vlCancel">Cancelar</button>
                    <button class="btn btn-primary" id="vlSave">💾 Salvar e Aplicar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const tbody = modal.querySelector('#vlTableBody');

        const attachRowEvents = () => {
            tbody.querySelectorAll('tr').forEach((row) => {
                const idx = parseInt(row.getAttribute('data-index'), 10);
                const picker = row.querySelector('.lvl-color-picker');
                const text = row.querySelector('.lvl-color-text');
                const bar = row.querySelector('.lvl-preview-bar');
                const vInput = row.querySelector('.lvl-voltage');
                const nameInput = row.querySelector('.lvl-name');
                const delBtn = row.querySelector('.btn-del-lvl');

                picker?.addEventListener('input', (e) => {
                    text.value = e.target.value;
                    bar.style.backgroundColor = e.target.value;
                    if (levels[idx]) levels[idx].color = e.target.value;
                });

                text?.addEventListener('input', (e) => {
                    const val = e.target.value.trim();
                    if (/^#[0-9A-F]{6}$/i.test(val)) {
                        picker.value = val;
                        bar.style.backgroundColor = val;
                        if (levels[idx]) levels[idx].color = val;
                    }
                });

                vInput?.addEventListener('input', (e) => {
                    if (levels[idx]) levels[idx].voltage = parseFloat(e.target.value) || 0;
                });

                nameInput?.addEventListener('input', (e) => {
                    if (levels[idx]) levels[idx].name = e.target.value;
                });

                delBtn?.addEventListener('click', () => {
                    levels.splice(idx, 1);
                    tbody.innerHTML = renderTableRows();
                    attachRowEvents();
                });
            });
        };

        attachRowEvents();

        // Add Level button
        modal.querySelector('#vlAddLevel')?.addEventListener('click', () => {
            levels.push({
                voltage: 13.8,
                color: '#00a5c3',
                name: 'Novo Nível'
            });
            tbody.innerHTML = renderTableRows();
            attachRowEvents();
        });

        // Reset to Defaults button
        modal.querySelector('#vlResetDefaults')?.addEventListener('click', () => {
            if (confirm('Deseja restaurar todas as cores dos níveis de tensão para os padrões do TechProt?')) {
                model.resetVoltageLevels();
                levels = model.voltageLevels.map(l => ({ ...l }));
                tbody.innerHTML = renderTableRows();
                attachRowEvents();
            }
        });

        const close = () => modal.remove();
        modal.querySelector('#vlClose')?.addEventListener('click', close);
        modal.querySelector('#vlCancel')?.addEventListener('click', close);

        // Save
        modal.querySelector('#vlSave')?.addEventListener('click', () => {
            model.saveVoltageLevels(levels);
            if (onSave) onSave();
            close();
        });
    }
}
