import { ControlDiagram } from '../control/ControlDiagram.js';
import { ControlBlock, BlockType, InputSignalType, OutputSignalType } from '../control/ControlBlock.js';
import { ControlPresets } from '../control/ControlPresets.js';

/**
 * ControlEditorDialog.js - Visual Block Diagram CAD Editor for Generator AVR and Speed Governors
 */
export class ControlEditorDialog {
    /**
     * Opens the visual block diagram editor modal
     * @param {ControlDiagram} diagram - Diagram to edit (will be cloned)
     * @param {'avr'|'speed_gov'} controlType - Type of control system
     * @param {Function} onSave - Callback receiving the updated ControlDiagram
     * @param {Object} [options] - Additional display options
     */
    static open(diagram, controlType = 'avr', onSave = null, options = {}) {
        const existing = document.getElementById('controlEditorModal');
        if (existing) existing.remove();

        // Clone diagram for safe editing without affecting element until saved
        const editDiagram = diagram ? diagram.clone() : (
            controlType === 'avr' ? ControlPresets.createIEEEType1AVR() : ControlPresets.createSteamGovernor()
        );

        const instance = new ControlEditorDialog(editDiagram, controlType, onSave, options);
        instance.render();
        return instance;
    }

    constructor(diagram, controlType, onSave, options = {}) {
        this.diagram = diagram;
        this.controlType = controlType;
        this.onSave = onSave;
        this.options = options;

        // Viewport pan & zoom
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;

        // Interaction state
        this.selectedBlock = null;
        this.selectedWire = null;
        this.dragBlock = null;
        this.dragOffset = { x: 0, y: 0 };
        this.dragWire = null; // { fromBlock, fromPort, currentX, currentY }
        this.hoverPort = null;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        this.showPreview = false;
        this.modal = null;
        this.canvas = null;
        this.ctx = null;
        this.previewCanvas = null;
        this.previewCtx = null;
    }

    render() {
        const modal = document.createElement('div');
        modal.id = 'controlEditorModal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 600;';

        const isAVR = this.controlType === 'avr';
        const titleText = isAVR 
            ? `Regulador Automático de Tensão (AVR) ${this.options.elementName ? `- ${this.options.elementName}` : ''}`
            : `Regulador de Velocidade (Speed Governor) ${this.options.elementName ? `- ${this.options.elementName}` : ''}`;

        modal.innerHTML = `
            <div class="modal-card" style="width: 1080px; max-width: 96vw; height: 720px; max-height: 94vh; display: flex; flex-direction: column; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow); overflow: hidden;">
                <!-- Header -->
                <div class="modal-header" style="padding: 10px 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.15);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">${isAVR ? '⚡' : '⚙️'}</span>
                        <h3 style="font-size: 14px; font-weight: 600; margin: 0;">Editor de Diagrama de Blocos: ${titleText}</h3>
                    </div>
                    <button type="button" class="btn-close" id="btnCtrlClose" style="background: none; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer;">✕</button>
                </div>

                <!-- Toolbar -->
                <div style="padding: 8px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: rgba(0,0,0,0.08);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">Predefinições:</label>
                        <select id="ctrlPresetSelect" class="form-control" style="font-size: 12px; padding: 4px 8px; height: 28px;">
                            ${isAVR ? `
                                <option value="ieee1">AVR IEEE Tipo 1 (DC1A)</option>
                                <option value="st1a">AVR Estático Rápido (ST1A)</option>
                                <option value="blank">Diagrama em Branco</option>
                            ` : `
                                <option value="steam">Turbina a Vapor com Estatismo (Steam Gov)</option>
                                <option value="hydro">Turbina Hidráulica com Compensação (Hydro Gov)</option>
                                <option value="blank">Diagrama em Branco</option>
                            `}
                        </select>
                        <button type="button" class="btn btn-secondary" id="btnCtrlLoadPreset" style="font-size: 11px; padding: 4px 10px; height: 28px;">Carregar</button>
                        
                        <div style="width: 1px; height: 20px; background: var(--border-color); margin: 0 4px;"></div>
                        
                        <button type="button" class="btn btn-secondary" id="btnCtrlZoomFit" style="font-size: 11px; padding: 4px 10px; height: 28px;" title="Ajustar todos os blocos na tela">🔍 Ajustar Vista</button>
                        <button type="button" class="btn btn-secondary" id="btnCtrlClear" style="font-size: 11px; padding: 4px 10px; height: 28px; color: var(--danger-color);" title="Limpar todos os blocos">🗑️ Limpar</button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn btn-secondary" id="btnCtrlTogglePreview" style="font-size: 11px; padding: 4px 12px; height: 28px;">
                            📈 Testar Resposta ao Degrau
                        </button>
                        <button type="button" class="btn btn-primary" id="btnCtrlSave" style="font-size: 12px; font-weight: 600; padding: 5px 16px; height: 28px; background: #059669; border-color: #059669;">
                            💾 Salvar e Aplicar
                        </button>
                    </div>
                </div>

                <!-- Body Area (Palette Sidebar + Canvas) -->
                <div style="flex: 1; display: flex; position: relative; min-height: 0;">
                    <!-- Left Sidebar: Palette -->
                    <div style="width: 180px; border-right: 1px solid var(--border-color); background: var(--bg-primary); display: flex; flex-direction: column; padding: 10px; gap: 6px; overflow-y: auto;">
                        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 4px;">
                            Paleta de Blocos
                        </div>

                        <div style="font-size: 10px; color: var(--accent-color); font-weight: 600; margin-top: 4px;">SINAIS</div>
                        <button type="button" class="btn-palette" data-type="${BlockType.INPUT}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            📥 Sinal de Entrada
                        </button>
                        <button type="button" class="btn-palette" data-type="${BlockType.OUTPUT}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            📤 Sinal de Saída
                        </button>
                        <button type="button" class="btn-palette" data-type="${BlockType.CONSTANT}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            🔢 Constante K0
                        </button>

                        <div style="font-size: 10px; color: var(--accent-color); font-weight: 600; margin-top: 6px;">OPERAÇÕES</div>
                        <button type="button" class="btn-palette" data-type="${BlockType.TRANSFER_FUNCTION}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            ➗ Função Transf. G(s)
                        </button>
                        <button type="button" class="btn-palette" data-type="${BlockType.GAIN}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            ✖ Ganho Escalar K
                        </button>
                        <button type="button" class="btn-palette" data-type="${BlockType.SUM}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            ➕ Somador / Comparador
                        </button>
                        <button type="button" class="btn-palette" data-type="${BlockType.MULTIPLIER}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            ✖ Multiplicador (u1×u2)
                        </button>

                        <div style="font-size: 10px; color: var(--accent-color); font-weight: 600; margin-top: 6px;">NÃO-LINEARIDADES</div>
                        <button type="button" class="btn-palette" data-type="${BlockType.LIMITER}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            🎚 Limitador [Min, Max]
                        </button>
                        <button type="button" class="btn-palette" data-type="${BlockType.RATE_LIMITER}" style="text-align: left; padding: 5px 8px; font-size: 11px; border: 1px solid var(--border-color); background: var(--bg-secondary); border-radius: 4px; color: var(--text-primary); cursor: pointer;">
                            ⚡ Limitador de Taxa
                        </button>

                        <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-color); font-size: 10px; color: var(--text-secondary); line-height: 1.4;">
                            💡 <b>Dicas:</b><br>
                            • Clique duplo para editar parâmetros<br>
                            • Arraste da porta direita para a esquerda para ligar fios<br>
                            • Tecla Delete para excluir
                        </div>
                    </div>

                    <!-- Center: Interactive Diagram Canvas -->
                    <div style="flex: 1; position: relative; overflow: hidden; background: #0b1120;">
                        <canvas id="controlCanvas" style="width: 100%; height: 100%; display: block;"></canvas>

                        <!-- Step Response Preview Drawer (Collapsible) -->
                        <div id="ctrlPreviewDrawer" style="display: none; position: absolute; bottom: 0; left: 0; right: 0; height: 180px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(4px); border-top: 2px solid var(--accent-color); padding: 8px 12px; flex-direction: column;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 11px; font-weight: 700; color: var(--accent-color);">📈 SIMULAÇÃO DE RESPOSTA AO DEGRAU EM MALHA FECHADA</span>
                                    <span id="ctrlPreviewMetrics" style="font-size: 11px; color: var(--text-secondary);"></span>
                                </div>
                                <button type="button" id="btnCtrlClosePreview" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px;">✕</button>
                            </div>
                            <div style="flex: 1; position: relative; min-height: 0;">
                                <canvas id="ctrlPreviewCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer Status Bar -->
                <div style="padding: 6px 14px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-secondary); background: var(--bg-primary);">
                    <div id="ctrlStatusBar">
                        ${this.diagram.blocks.length} blocos, ${this.diagram.wires.length} conexões.
                    </div>
                    <div>
                        Roda do mouse: Zoom | Clique e arraste no fundo: Panorâmica
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;
        this.canvas = modal.querySelector('#controlCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewCanvas = modal.querySelector('#ctrlPreviewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        this.bindEvents();
        this.resize();
        this.centerDiagram();
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
        this.draw();

        if (this.showPreview && this.previewCanvas) {
            const pRect = this.previewCanvas.getBoundingClientRect();
            this.previewCanvas.width = Math.floor(pRect.width * dpr);
            this.previewCanvas.height = Math.floor(pRect.height * dpr);
            this.previewCtx.resetTransform();
            this.previewCtx.scale(dpr, dpr);
            this.previewWidth = pRect.width;
            this.previewHeight = pRect.height;
            this.renderStepResponse();
        }
    }

    centerDiagram() {
        if (this.diagram.blocks.length === 0) {
            this.scale = 1.0;
            this.panX = this.width / 2;
            this.panY = this.height / 2;
            this.draw();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const b of this.diagram.blocks) {
            minX = Math.min(minX, b.x - b.width / 2);
            minY = Math.min(minY, b.y - b.height / 2);
            maxX = Math.max(maxX, b.x + b.width / 2);
            maxY = Math.max(maxY, b.y + b.height / 2);
        }

        const diagW = Math.max(100, maxX - minX + 100);
        const diagH = Math.max(100, maxY - minY + 100);
        const scaleX = (this.width - 60) / diagW;
        const scaleY = (this.height - 60) / diagH;
        this.scale = Math.max(0.4, Math.min(1.2, Math.min(scaleX, scaleY)));

        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        this.panX = this.width / 2 - midX * this.scale;
        this.panY = this.height / 2 - midY * this.scale;

        this.draw();
    }

    toCanvasCoords(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        return {
            x: (screenX - this.panX) / this.scale,
            y: (screenY - this.panY) / this.scale
        };
    }

    toScreenCoords(diagX, diagY) {
        return {
            x: diagX * this.scale + this.panX,
            y: diagY * this.scale + this.panY
        };
    }

    bindEvents() {
        const modal = this.modal;

        // Close & Save
        const closeModal = () => modal.remove();
        modal.querySelector('#btnCtrlClose').addEventListener('click', closeModal);

        modal.querySelector('#btnCtrlSave').addEventListener('click', () => {
            this.diagram.resolveExecutionOrder();
            if (this.onSave) {
                this.onSave(this.diagram);
            }
            closeModal();
        });

        // Presets
        modal.querySelector('#btnCtrlLoadPreset').addEventListener('click', () => {
            const val = modal.querySelector('#ctrlPresetSelect').value;
            if (val === 'ieee1') this.diagram = ControlPresets.createIEEEType1AVR();
            else if (val === 'st1a') this.diagram = ControlPresets.createFastStaticAVR();
            else if (val === 'steam') this.diagram = ControlPresets.createSteamGovernor();
            else if (val === 'hydro') this.diagram = ControlPresets.createHydroGovernor();
            else if (val === 'blank') this.diagram = new ControlDiagram(this.controlType, 'Novo Diagrama');
            
            this.selectedBlock = null;
            this.selectedWire = null;
            this.centerDiagram();
            this.updateStatusBar();
            if (this.showPreview) this.renderStepResponse();
        });

        // Zoom fit & Clear
        modal.querySelector('#btnCtrlZoomFit').addEventListener('click', () => this.centerDiagram());
        modal.querySelector('#btnCtrlClear').addEventListener('click', () => {
            if (confirm('Deseja realmente limpar todos os blocos do diagrama?')) {
                this.diagram.blocks = [];
                this.diagram.wires = [];
                this.selectedBlock = null;
                this.selectedWire = null;
                this.draw();
                this.updateStatusBar();
                if (this.showPreview) this.renderStepResponse();
            }
        });

        // Step response preview drawer
        const previewDrawer = modal.querySelector('#ctrlPreviewDrawer');
        modal.querySelector('#btnCtrlTogglePreview').addEventListener('click', () => {
            this.showPreview = !this.showPreview;
            previewDrawer.style.display = this.showPreview ? 'flex' : 'none';
            if (this.showPreview) {
                setTimeout(() => this.resize(), 30);
            }
        });
        modal.querySelector('#btnCtrlClosePreview').addEventListener('click', () => {
            this.showPreview = false;
            previewDrawer.style.display = 'none';
        });

        // Palette buttons
        modal.querySelectorAll('.btn-palette').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                const center = this.toCanvasCoords(this.canvas.getBoundingClientRect().left + this.width / 2, this.canvas.getBoundingClientRect().top + this.height / 2);
                // Slight jitter to avoid overlapping existing blocks
                const x = center.x + (Math.random() - 0.5) * 40;
                const y = center.y + (Math.random() - 0.5) * 40;
                const newBlock = new ControlBlock(type, Math.round(x / 10) * 10, Math.round(y / 10) * 10);
                
                // Set sensible default signal for input/output according to control type
                if (type === BlockType.INPUT) {
                    newBlock.params.signalType = this.controlType === 'avr' ? InputSignalType.TERMINAL_VOLTAGE : InputSignalType.SPEED_DEVIATION;
                    newBlock.name = this.controlType === 'avr' ? 'Vt' : 'Δω';
                } else if (type === BlockType.OUTPUT) {
                    newBlock.params.signalType = this.controlType === 'avr' ? OutputSignalType.FIELD_VOLTAGE : OutputSignalType.MECHANICAL_POWER;
                    newBlock.name = this.controlType === 'avr' ? 'Vfd' : 'ΔPm';
                }

                this.diagram.addBlock(newBlock);
                this.selectedBlock = newBlock;
                this.selectedWire = null;
                this.draw();
                this.updateStatusBar();
                if (this.showPreview) this.renderStepResponse();
            });
        });

        // Mouse canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Don't delete if focused in an input field
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
                    return;
                }
                if (this.selectedBlock) {
                    this.diagram.removeBlock(this.selectedBlock);
                    this.selectedBlock = null;
                    this.draw();
                    this.updateStatusBar();
                    if (this.showPreview) this.renderStepResponse();
                } else if (this.selectedWire) {
                    this.diagram.removeWire(this.selectedWire);
                    this.selectedWire = null;
                    this.draw();
                    this.updateStatusBar();
                    if (this.showPreview) this.renderStepResponse();
                }
            }
        });

        window.addEventListener('resize', () => this.resize());
    }

    findPortAt(coords) {
        const radius = 8 / this.scale;
        for (const b of this.diagram.blocks) {
            // Check out ports
            for (const p of b.outPorts) {
                const px = b.x + (p.relX - 0.5) * b.width;
                const py = b.y + (p.relY - 0.5) * b.height;
                if (Math.hypot(coords.x - px, coords.y - py) <= radius) {
                    return { block: b, port: p, isOut: true, x: px, y: py };
                }
            }
            // Check in ports
            for (const p of b.inPorts) {
                const px = b.x + (p.relX - 0.5) * b.width;
                const py = b.y + (p.relY - 0.5) * b.height;
                if (Math.hypot(coords.x - px, coords.y - py) <= radius) {
                    return { block: b, port: p, isOut: false, x: px, y: py };
                }
            }
        }
        return null;
    }

    findBlockAt(coords) {
        // Iterate in reverse so topmost block is selected
        for (let i = this.diagram.blocks.length - 1; i >= 0; i--) {
            const b = this.diagram.blocks[i];
            const halfW = b.width / 2;
            const halfH = b.height / 2;
            if (coords.x >= b.x - halfW && coords.x <= b.x + halfW &&
                coords.y >= b.y - halfH && coords.y <= b.y + halfH) {
                return b;
            }
        }
        return null;
    }

    findWireAt(coords) {
        const threshold = 6 / this.scale;
        for (const w of this.diagram.wires) {
            const srcBlock = this.diagram.getBlockById(w.fromBlockId);
            const dstBlock = this.diagram.getBlockById(w.toBlockId);
            if (!srcBlock || !dstBlock) continue;

            const srcPort = srcBlock.outPorts.find(p => p.id === w.fromPortId) || { relX: 1, relY: 0.5 };
            const dstPort = dstBlock.inPorts.find(p => p.id === w.toPortId) || { relX: 0, relY: 0.5 };

            const p1 = { x: srcBlock.x + (srcPort.relX - 0.5) * srcBlock.width, y: srcBlock.y + (srcPort.relY - 0.5) * srcBlock.height };
            const p2 = { x: dstBlock.x + (dstPort.relX - 0.5) * dstBlock.width, y: dstBlock.y + (dstPort.relY - 0.5) * dstBlock.height };

            // Distance to cubic bezier curve approximation (sampled along curve)
            const midX = (p1.x + p2.x) / 2;
            for (let t = 0; t <= 1; t += 0.1) {
                // Bezier points: p1, c1(midX, p1.y), c2(midX, p2.y), p2
                const cx = Math.pow(1 - t, 3) * p1.x + 3 * Math.pow(1 - t, 2) * t * midX + 3 * (1 - t) * t * t * midX + Math.pow(t, 3) * p2.x;
                const cy = Math.pow(1 - t, 3) * p1.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * t * t * p2.y + Math.pow(t, 3) * p2.y;
                if (Math.hypot(coords.x - cx, coords.y - cy) <= threshold) {
                    return w;
                }
            }
        }
        return null;
    }

    onMouseDown(e) {
        if (e.button === 1 || e.altKey || (e.button === 0 && e.spaceKey)) {
            // Pan
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            return;
        }

        if (e.button !== 0) return;

        const coords = this.toCanvasCoords(e.clientX, e.clientY);

        // 1. Check if clicking on a Port
        const portInfo = this.findPortAt(coords);
        if (portInfo) {
            // Start wire connection
            this.dragWire = {
                fromBlock: portInfo.block,
                fromPort: portInfo.port,
                isOut: portInfo.isOut,
                currentX: coords.x,
                currentY: coords.y
            };
            return;
        }

        // 2. Check if clicking on a Block
        const block = this.findBlockAt(coords);
        if (block) {
            this.selectedBlock = block;
            this.selectedWire = null;
            this.dragBlock = block;
            this.dragOffset = { x: coords.x - block.x, y: coords.y - block.y };
            this.draw();
            return;
        }

        // 3. Check if clicking on a Wire
        const wire = this.findWireAt(coords);
        if (wire) {
            this.selectedWire = wire;
            this.selectedBlock = null;
            this.draw();
            return;
        }

        // Clicking empty space -> start panning or clear selection
        this.selectedBlock = null;
        this.selectedWire = null;
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.draw();
    }

    onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.panX += dx;
            this.panY += dy;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.draw();
            return;
        }

        const coords = this.toCanvasCoords(e.clientX, e.clientY);

        if (this.dragWire) {
            this.dragWire.currentX = coords.x;
            this.dragWire.currentY = coords.y;
            this.hoverPort = this.findPortAt(coords);
            this.draw();
            return;
        }

        if (this.dragBlock) {
            // Grid snap to 10px
            this.dragBlock.x = Math.round((coords.x - this.dragOffset.x) / 10) * 10;
            this.dragBlock.y = Math.round((coords.y - this.dragOffset.y) / 10) * 10;
            this.draw();
            return;
        }

        // Port hover highlight
        const hovered = this.findPortAt(coords);
        if (hovered !== this.hoverPort) {
            this.hoverPort = hovered;
            this.draw();
        }
    }

    onMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
        }

        if (this.dragBlock) {
            this.dragBlock = null;
            if (this.showPreview) this.renderStepResponse();
        }

        if (this.dragWire) {
            const coords = this.toCanvasCoords(e.clientX, e.clientY);
            const target = this.findPortAt(coords);

            if (target && target.block !== this.dragWire.fromBlock) {
                // Must connect Out -> In or In -> Out
                if (this.dragWire.isOut && !target.isOut) {
                    this.diagram.addWire(this.dragWire.fromBlock.id, this.dragWire.fromPort.id, target.block.id, target.port.id);
                } else if (!this.dragWire.isOut && target.isOut) {
                    this.diagram.addWire(target.block.id, target.port.id, this.dragWire.fromBlock.id, this.dragWire.fromPort.id);
                }
                this.updateStatusBar();
                if (this.showPreview) this.renderStepResponse();
            }

            this.dragWire = null;
            this.draw();
        }
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newScale = Math.max(0.3, Math.min(2.5, this.scale * zoomFactor));
        this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
        this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
        this.scale = newScale;

        this.draw();
    }

    onDoubleClick(e) {
        const coords = this.toCanvasCoords(e.clientX, e.clientY);
        const block = this.findBlockAt(coords);
        if (block) {
            this.openBlockParamsDialog(block);
        }
    }

    openBlockParamsDialog(block) {
        const existing = document.getElementById('blockParamsModal');
        if (existing) existing.remove();

        const pModal = document.createElement('div');
        pModal.id = 'blockParamsModal';
        pModal.className = 'modal-backdrop';
        pModal.style.cssText = 'z-index: 700; display: flex; align-items: center; justify-content: center;';

        let fieldsHtml = '';

        if (block.type === BlockType.TRANSFER_FUNCTION) {
            fieldsHtml = `
                <div class="form-row">
                    <label style="font-size: 12px;">Título / Etiqueta:</label>
                    <input type="text" id="blkLabel" value="${block.params.label || block.name}" class="form-control">
                </div>
                <div class="form-row">
                    <label style="font-size: 12px;">Coeficientes Numerador (da maior para a menor potência s):</label>
                    <input type="text" id="blkNum" value="${(block.params.numerator || [1.0]).join(', ')}" class="form-control" placeholder="ex: 40 ou 0.08, 1">
                    <span style="font-size: 10px; color: var(--text-secondary);">ex: "40" para ganho 40, ou "0.08, 1" para (0.08s + 1)</span>
                </div>
                <div class="form-row">
                    <label style="font-size: 12px;">Coeficientes Denominador (da maior para a menor potência s):</label>
                    <input type="text" id="blkDen" value="${(block.params.denominator || [0.05, 1.0]).join(', ')}" class="form-control" placeholder="ex: 0.05, 1">
                    <span style="font-size: 10px; color: var(--text-secondary);">ex: "0.05, 1" para (0.05s + 1), ou "0.5, 1" para (0.5s + 1)</span>
                </div>
            `;
        } else if (block.type === BlockType.GAIN) {
            fieldsHtml = `
                <div class="form-row">
                    <label style="font-size: 12px;">Ganho Escalar K:</label>
                    <input type="number" id="blkGain" value="${block.params.gain ?? 20.0}" step="0.5" class="form-control">
                </div>
            `;
        } else if (block.type === BlockType.SUM) {
            const signsStr = (block.params.signs || ['+', '-']).join(' ');
            fieldsHtml = `
                <div class="form-row">
                    <label style="font-size: 12px;">Sinais das Entradas (separados por espaço):</label>
                    <input type="text" id="blkSigns" value="${signsStr}" class="form-control" placeholder="+ -">
                    <span style="font-size: 10px; color: var(--text-secondary);">ex: "+ -" para comparador (in0 - in1), ou "+ +" para somador</span>
                </div>
            `;
        } else if (block.type === BlockType.LIMITER) {
            fieldsHtml = `
                <div class="form-row-2col">
                    <div>
                        <label style="font-size: 12px;">Limite Mínimo:</label>
                        <input type="number" id="blkMin" value="${block.params.min ?? -5.0}" step="0.1" class="form-control">
                    </div>
                    <div>
                        <label style="font-size: 12px;">Limite Máximo:</label>
                        <input type="number" id="blkMax" value="${block.params.max ?? 5.0}" step="0.1" class="form-control">
                    </div>
                </div>
            `;
        } else if (block.type === BlockType.RATE_LIMITER) {
            fieldsHtml = `
                <div class="form-row-2col">
                    <div>
                        <label style="font-size: 12px;">Taxa Descida (Down Limit):</label>
                        <input type="number" id="blkDown" value="${block.params.downLimit ?? -10.0}" step="0.5" class="form-control">
                    </div>
                    <div>
                        <label style="font-size: 12px;">Taxa Subida (Up Limit):</label>
                        <input type="number" id="blkUp" value="${block.params.upLimit ?? 10.0}" step="0.5" class="form-control">
                    </div>
                </div>
            `;
        } else if (block.type === BlockType.CONSTANT) {
            fieldsHtml = `
                <div class="form-row">
                    <label style="font-size: 12px;">Valor Constante:</label>
                    <input type="number" id="blkVal" value="${block.params.value ?? 1.0}" step="0.1" class="form-control">
                </div>
            `;
        } else if (block.type === BlockType.INPUT) {
            fieldsHtml = `
                <div class="form-row">
                    <label style="font-size: 12px;">Tipo de Sinal de Entrada:</label>
                    <select id="blkSigType" class="form-control" style="font-size: 12px;">
                        <option value="${InputSignalType.TERMINAL_VOLTAGE}" ${block.params.signalType === InputSignalType.TERMINAL_VOLTAGE ? 'selected' : ''}>Tensão Terminal Vt (p.u.)</option>
                        <option value="${InputSignalType.VOLTAGE_REF}" ${block.params.signalType === InputSignalType.VOLTAGE_REF ? 'selected' : ''}>Referência de Tensão Vref (p.u.)</option>
                        <option value="${InputSignalType.SPEED_DEVIATION}" ${block.params.signalType === InputSignalType.SPEED_DEVIATION ? 'selected' : ''}>Desvio de Velocidade Δω (p.u.)</option>
                        <option value="${InputSignalType.SPEED}" ${block.params.signalType === InputSignalType.SPEED ? 'selected' : ''}>Velocidade Angular ω (p.u.)</option>
                        <option value="${InputSignalType.ACTIVE_POWER}" ${block.params.signalType === InputSignalType.ACTIVE_POWER ? 'selected' : ''}>Potência Ativa Pe</option>
                        <option value="custom" ${block.params.signalType === 'custom' ? 'selected' : ''}>Personalizado / Fixo</option>
                    </select>
                </div>
                <div class="form-row">
                    <label style="font-size: 12px;">Valor Padrão / Setpoint Inicial:</label>
                    <input type="number" id="blkCustomVal" value="${block.params.customValue ?? 1.0}" step="0.05" class="form-control">
                </div>
            `;
        } else if (block.type === BlockType.OUTPUT) {
            fieldsHtml = `
                <div class="form-row">
                    <label style="font-size: 12px;">Tipo de Sinal de Saída:</label>
                    <select id="blkOutSigType" class="form-control" style="font-size: 12px;">
                        <option value="${OutputSignalType.FIELD_VOLTAGE}" ${block.params.signalType === OutputSignalType.FIELD_VOLTAGE ? 'selected' : ''}>Tensão de Campo Vfd (p.u.) [AVR]</option>
                        <option value="${OutputSignalType.MECHANICAL_POWER}" ${block.params.signalType === OutputSignalType.MECHANICAL_POWER ? 'selected' : ''}>Potência Mecânica Pm / ΔPm [Regulador Velocidade]</option>
                    </select>
                </div>
            `;
        }

        pModal.innerHTML = `
            <div class="modal-card" style="width: 420px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; box-shadow: var(--shadow);">
                <div class="modal-header" style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="font-size: 13px; font-weight: 600; margin: 0;">Parâmetros do Bloco: ${block.name}</h4>
                    <button type="button" id="btnParamClose" style="background:none; border:none; color: var(--text-secondary); cursor:pointer;">✕</button>
                </div>
                <div class="modal-body" style="padding: 14px;">
                    <div class="form-row" style="margin-bottom: 12px;">
                        <label style="font-size: 12px;">Nome do Bloco:</label>
                        <input type="text" id="blkName" value="${block.name}" class="form-control">
                    </div>
                    ${fieldsHtml}
                </div>
                <div class="modal-footer" style="padding: 10px 14px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 8px;">
                    <button type="button" class="btn btn-secondary" id="btnParamCancel" style="font-size: 12px; padding: 5px 14px;">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="btnParamSave" style="font-size: 12px; font-weight: 600; padding: 5px 16px;">Salvar</button>
                </div>
            </div>
        `;

        document.body.appendChild(pModal);

        const closePModal = () => pModal.remove();
        pModal.querySelector('#btnParamClose').addEventListener('click', closePModal);
        pModal.querySelector('#btnParamCancel').addEventListener('click', closePModal);

        pModal.querySelector('#btnParamSave').addEventListener('click', () => {
            const name = pModal.querySelector('#blkName')?.value;
            if (name) block.name = name;

            if (block.type === BlockType.TRANSFER_FUNCTION) {
                const label = pModal.querySelector('#blkLabel')?.value;
                if (label) block.params.label = label;
                const numStr = pModal.querySelector('#blkNum')?.value || '1';
                const denStr = pModal.querySelector('#blkDen')?.value || '1';
                block.params.numerator = numStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
                block.params.denominator = denStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
                if (block.params.numerator.length === 0) block.params.numerator = [1.0];
                if (block.params.denominator.length === 0) block.params.denominator = [1.0];
            } else if (block.type === BlockType.GAIN) {
                block.params.gain = parseFloat(pModal.querySelector('#blkGain').value) || 1.0;
            } else if (block.type === BlockType.SUM) {
                const signsStr = pModal.querySelector('#blkSigns').value;
                const signs = signsStr.trim().split(/\s+/).filter(s => s === '+' || s === '-');
                block.params.signs = signs.length > 0 ? signs : ['+', '-'];
                block.setupPorts();
            } else if (block.type === BlockType.LIMITER) {
                block.params.min = parseFloat(pModal.querySelector('#blkMin').value) || -5.0;
                block.params.max = parseFloat(pModal.querySelector('#blkMax').value) || 5.0;
            } else if (block.type === BlockType.RATE_LIMITER) {
                block.params.downLimit = parseFloat(pModal.querySelector('#blkDown').value) || -10.0;
                block.params.upLimit = parseFloat(pModal.querySelector('#blkUp').value) || 10.0;
            } else if (block.type === BlockType.CONSTANT) {
                block.params.value = parseFloat(pModal.querySelector('#blkVal').value) || 0.0;
            } else if (block.type === BlockType.INPUT) {
                block.params.signalType = pModal.querySelector('#blkSigType').value;
                block.params.customValue = parseFloat(pModal.querySelector('#blkCustomVal').value) || 1.0;
            } else if (block.type === BlockType.OUTPUT) {
                block.params.signalType = pModal.querySelector('#blkOutSigType').value;
            }

            closePModal();
            this.draw();
            if (this.showPreview) this.renderStepResponse();
        });
    }

    updateStatusBar() {
        const bar = this.modal?.querySelector('#ctrlStatusBar');
        if (bar) {
            bar.innerHTML = `${this.diagram.blocks.length} blocos, ${this.diagram.wires.length} conexões.`;
        }
    }

    draw() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Draw Grid
        this.drawGrid(ctx);

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.scale, this.scale);

        // 2. Draw Wires
        for (const wire of this.diagram.wires) {
            this.drawWire(ctx, wire, wire === this.selectedWire);
        }

        // Draw active drag wire
        if (this.dragWire) {
            this.drawActiveDragWire(ctx, this.dragWire);
        }

        // 3. Draw Blocks
        for (const block of this.diagram.blocks) {
            this.drawBlock(ctx, block, block === this.selectedBlock);
        }

        ctx.restore();
    }

    drawGrid(ctx) {
        const gridSize = 20 * this.scale;
        const startX = (this.panX % gridSize);
        const startY = (this.panY % gridSize);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = startX; x < this.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
        }
        for (let y = startY; y < this.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
        }
        ctx.stroke();
    }

    drawBlock(ctx, block, isSelected) {
        ctx.save();
        ctx.translate(block.x, block.y);

        const w = block.width;
        const h = block.height;
        const halfW = w / 2;
        const halfH = h / 2;

        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;

        // Block Body Background
        if (block.type === BlockType.SUM) {
            // Circle for Sum
            ctx.beginPath();
            ctx.arc(0, 0, halfW, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? '#1e293b' : '#1e293b';
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = isSelected ? '#38bdf8' : '#64748b';
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();

            // Inner cross
            ctx.beginPath();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.2;
            const r = halfW * 0.7;
            ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
            ctx.moveTo(0, -r); ctx.lineTo(0, r);
            ctx.stroke();

            // Block Label below
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(block.name, 0, halfH + 14);

        } else {
            // Rounded Rectangle for standard blocks
            ctx.beginPath();
            const rad = 6;
            ctx.roundRect(-halfW, -halfH, w, h, rad);
            
            if (block.type === BlockType.INPUT) {
                ctx.fillStyle = '#0f3a4e';
            } else if (block.type === BlockType.OUTPUT) {
                ctx.fillStyle = '#1c3d2e';
            } else {
                ctx.fillStyle = '#1e293b';
            }
            ctx.fill();

            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = isSelected ? '#38bdf8' : '#475569';
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();

            // Block Text Content
            ctx.fillStyle = '#f8fafc';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (block.type === BlockType.TRANSFER_FUNCTION) {
                ctx.font = '600 11px JetBrains Mono, monospace';
                const label = block.params.label || `${block.params.numerator?.[0] || 1}/(s)`;
                ctx.fillText(label, 0, 0);
                
                // Name above
                ctx.fillStyle = '#94a3b8';
                ctx.font = '9px Inter, sans-serif';
                ctx.fillText(block.name, 0, -halfH - 8);

            } else if (block.type === BlockType.GAIN) {
                ctx.font = '600 12px Inter, sans-serif';
                ctx.fillText(`K = ${block.params.gain ?? 1}`, 0, 0);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '9px Inter, sans-serif';
                ctx.fillText(block.name, 0, -halfH - 8);

            } else if (block.type === BlockType.LIMITER) {
                ctx.font = '600 10px JetBrains Mono, monospace';
                ctx.fillText(`[${block.params.min}, ${block.params.max}]`, 0, 0);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '9px Inter, sans-serif';
                ctx.fillText(block.name, 0, -halfH - 8);

            } else if (block.type === BlockType.CONSTANT) {
                ctx.font = '600 12px JetBrains Mono, monospace';
                ctx.fillText(`${block.params.value ?? 1}`, 0, 0);

            } else if (block.type === BlockType.INPUT || block.type === BlockType.OUTPUT) {
                ctx.font = '700 11px Inter, sans-serif';
                ctx.fillText(block.name, 0, 0);

            } else {
                ctx.font = '600 11px Inter, sans-serif';
                ctx.fillText(block.name, 0, 0);
            }
        }

        // Draw In-Ports
        for (const p of block.inPorts) {
            const px = (p.relX - 0.5) * w;
            const py = (p.relY - 0.5) * h;
            const isHover = this.hoverPort && this.hoverPort.block === block && this.hoverPort.port === p;

            ctx.beginPath();
            ctx.arc(px, py, isHover ? 5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = isHover ? '#38bdf8' : '#94a3b8';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // If sum, display sign (+/-)
            if (block.type === BlockType.SUM && p.label) {
                ctx.fillStyle = '#cbd5e1';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(p.label, px - 6, py);
            }
        }

        // Draw Out-Ports
        for (const p of block.outPorts) {
            const px = (p.relX - 0.5) * w;
            const py = (p.relY - 0.5) * h;
            const isHover = this.hoverPort && this.hoverPort.block === block && this.hoverPort.port === p;

            ctx.beginPath();
            ctx.arc(px, py, isHover ? 5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = isHover ? '#10b981' : '#64748b';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();
    }

    drawWire(ctx, wire, isSelected) {
        const srcBlock = this.diagram.getBlockById(wire.fromBlockId);
        const dstBlock = this.diagram.getBlockById(wire.toBlockId);
        if (!srcBlock || !dstBlock) return;

        const srcPort = srcBlock.outPorts.find(p => p.id === wire.fromPortId) || { relX: 1, relY: 0.5 };
        const dstPort = dstBlock.inPorts.find(p => p.id === wire.toPortId) || { relX: 0, relY: 0.5 };

        const p1 = { x: srcBlock.x + (srcPort.relX - 0.5) * srcBlock.width, y: srcBlock.y + (srcPort.relY - 0.5) * srcBlock.height };
        const p2 = { x: dstBlock.x + (dstPort.relX - 0.5) * dstBlock.width, y: dstBlock.y + (dstPort.relY - 0.5) * dstBlock.height };

        ctx.save();
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#0284c7';
        ctx.lineWidth = isSelected ? 2.5 : 1.8;

        // Smooth cubic bezier with horizontal control arms
        const deltaX = Math.abs(p2.x - p1.x);
        const handleOffset = Math.max(30, deltaX * 0.5);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(p1.x + handleOffset, p1.y, p2.x - handleOffset, p2.y, p2.x, p2.y);
        ctx.stroke();

        // Direction arrow head at destination port
        ctx.fillStyle = isSelected ? '#38bdf8' : '#0284c7';
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - 7, p2.y - 4);
        ctx.lineTo(p2.x - 7, p2.y + 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawActiveDragWire(ctx, dragWire) {
        const b = dragWire.fromBlock;
        const p = dragWire.fromPort;
        const p1 = { x: b.x + (p.relX - 0.5) * b.width, y: b.y + (p.relY - 0.5) * b.height };
        const p2 = { x: dragWire.currentX, y: dragWire.currentY };

        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;

        const deltaX = Math.abs(p2.x - p1.x);
        const handleOffset = Math.max(30, deltaX * 0.5);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(p1.x + handleOffset, p1.y, p2.x - handleOffset, p2.y, p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
    }

    renderStepResponse() {
        const canvas = this.previewCanvas;
        const ctx = this.previewCtx;
        if (!canvas || !ctx) return;

        const w = this.previewWidth || canvas.width;
        const h = this.previewHeight || canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Run transient step response simulation
        const simTime = 4.0;
        const dt = 0.005;
        const diagCopy = this.diagram.clone();

        const isAVR = this.controlType === 'avr';
        diagCopy.initialize({
            terminal_voltage: 1.0,
            voltage_ref: 1.0,
            speed: 1.0,
            speed_deviation: 0.0
        });

        const timePts = [];
        const outPts = [];
        let maxVal = -Infinity;
        let minVal = Infinity;

        for (let t = 0; t <= simTime; t += dt) {
            timePts.push(t);
            // Apply 5% terminal voltage sag at t = 0.5s for AVR, or 1% speed deviation for Governor
            const vt = (isAVR && t >= 0.5) ? 0.95 : 1.0;
            const dw = (!isAVR && t >= 0.5) ? -0.01 : 0.0;

            const val = diagCopy.step({
                terminal_voltage: vt,
                voltage_ref: 1.0,
                speed: 1.0 + dw,
                speed_deviation: dw
            }, dt);

            outPts.push(val);
            if (val > maxVal) maxVal = val;
            if (val < minVal) minVal = val;
        }

        const initialVal = outPts[0] || 0.0;
        const finalVal = outPts[outPts.length - 1] || 0.0;
        const overshoot = Math.max(0, ((maxVal - finalVal) / (Math.abs(finalVal) > 1e-4 ? Math.abs(finalVal) : 1.0)) * 100);

        const metricsEl = this.modal?.querySelector('#ctrlPreviewMetrics');
        if (metricsEl) {
            metricsEl.innerHTML = `| Regime Permanente: <b>${finalVal.toFixed(3)}</b> | Pico: <b>${maxVal.toFixed(3)}</b> | Sobressinal: <b>${overshoot.toFixed(1)}%</b>`;
        }

        // Plot axes
        const pad = { left: 45, right: 20, top: 15, bottom: 25 };
        const plotW = w - pad.left - pad.right;
        const plotH = h - pad.top - pad.bottom;

        const yRange = Math.max(0.1, (maxVal - minVal) * 1.25);
        const yMid = (maxVal + minVal) / 2;
        const yMin = yMid - yRange / 2;
        const yMax = yMid + yRange / 2;

        // Background & grid
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(pad.left, pad.top, plotW, plotH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let t = 0; t <= simTime; t += 1.0) {
            const x = pad.left + (t / simTime) * plotW;
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, pad.top + plotH);
        }
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (i / 4) * plotH;
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + plotW, y);
        }
        ctx.stroke();

        // Disturbance marker at t = 0.5s
        const xDist = pad.left + (0.5 / simTime) * plotW;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(xDist, pad.top);
        ctx.lineTo(xDist, pad.top + plotH);
        ctx.stroke();
        ctx.restore();

        // Step response curve
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let i = 0; i < timePts.length; i++) {
            const t = timePts[i];
            const v = outPts[i];
            const x = pad.left + (t / simTime) * plotW;
            const y = pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Y-axis ticks
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(yMax.toFixed(2), pad.left - 6, pad.top);
        ctx.fillText(yMid.toFixed(2), pad.left - 6, pad.top + plotH / 2);
        ctx.fillText(yMin.toFixed(2), pad.left - 6, pad.top + plotH);

        // X-axis ticks
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let t = 0; t <= simTime; t += 1.0) {
            const x = pad.left + (t / simTime) * plotW;
            ctx.fillText(`${t}s`, x, pad.top + plotH + 4);
        }
    }
}
