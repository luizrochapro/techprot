import { i18n } from './i18n.js';

export class FloatingToolbar {
    constructor(containerElement, canvas, app) {
        this.container = containerElement;
        this.canvas = canvas;
        this.app = app;
        this.visible = true;

        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="floating-toolbar-header" id="floatingToolbarHeader">
                <span class="toolbar-title"><span class="drag-icon">⋮⋮</span> <span data-i18n="floatingToolbar">${i18n.t('floatingToolbar')}</span></span>
                <button class="close-btn" id="closeFloatingToolbar" title="Fechar">✕</button>
            </div>
            <div class="floating-toolbar-tools">
                <button class="tool-btn active" data-tool="select" title="${i18n.t('tools.select')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5V2z"/></svg>
                    <span>${i18n.t('tools.select')}</span>
                </button>
                <div class="tool-separator"></div>
                <button class="tool-btn" data-tool="bus" title="${i18n.t('tools.bus')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="10" width="18" height="4" rx="1" fill="currentColor"/><circle cx="6" cy="12" r="2" fill="#fff"/><circle cx="18" cy="12" r="2" fill="#fff"/></svg>
                    <span>${i18n.t('tools.bus')}</span>
                </button>
                <button class="tool-btn" data-tool="line" title="${i18n.t('tools.line')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 18L20 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="4" cy="18" r="3" fill="currentColor"/><circle cx="20" cy="6" r="3" fill="currentColor"/></svg>
                    <span>${i18n.t('tools.line')}</span>
                </button>
                <button class="tool-btn" data-tool="transformer" title="${i18n.t('tools.transformer')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="8" r="5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="16" r="5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 19L17 5" stroke="#f59e0b" stroke-width="1.8"/></svg>
                    <span>${i18n.t('tools.transformer')}</span>
                </button>
                <button class="tool-btn" data-tool="generator" title="${i18n.t('tools.generator')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12c1-3 3-3 4 0s3 3 4 0" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                    <span>${i18n.t('tools.generator')}</span>
                </button>
                <button class="tool-btn" data-tool="load" title="${i18n.t('tools.load')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 4v10m-5 0l5 7 5-7z" stroke="currentColor" stroke-width="2" fill="currentColor"/></svg>
                    <span>${i18n.t('tools.load')}</span>
                </button>
                <button class="tool-btn" data-tool="capacitor" title="${i18n.t('tools.capacitor')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 10h12M6 14h12M12 4v6m0 4v6" stroke="currentColor" stroke-width="2"/></svg>
                    <span>${i18n.t('tools.capacitor')}</span>
                </button>
                <button class="tool-btn" data-tool="inductor" title="${i18n.t('tools.inductor')}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 12a4 4 0 0 1 5-3 4 4 0 0 1 6 0 4 4 0 0 1 5 3" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                    <span>${i18n.t('tools.inductor')}</span>
                </button>
                <button class="tool-btn" data-tool="relay" title="Relé 50/51 e 50N/51N (clique sobre um disjuntor)">
                    <svg viewBox="0 0 24 24" width="20" height="20"><rect x="2" y="7" width="6" height="6" fill="currentColor"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M14.6 10h1.4" stroke="currentColor" stroke-width="1.6"/><circle cx="19.5" cy="10" r="3.6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M17.6 8.6h3.8M17.6 10.2h3.8M17.6 11.8h3.8" stroke="currentColor" stroke-width="0.8"/></svg>
                    <span>Relé</span>
                </button>
            </div>
        `;

        // Tool button click handlers
        this.container.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.getAttribute('data-tool');
                this.setActiveTool(tool);
            });
        });

        // Close button
        this.container.querySelector('#closeFloatingToolbar').addEventListener('click', () => {
            this.setVisible(false);
        });

        // Draggable functionality
        this.initDragging();
    }

    setActiveTool(tool) {
        this.container.querySelectorAll('.tool-btn').forEach(btn => {
            if (btn.getAttribute('data-tool') === tool) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        this.canvas.setActiveTool(tool);
    }

    setVisible(visible) {
        this.visible = visible;
        this.container.style.display = visible ? 'flex' : 'none';
        if (this.app.onToolbarVisibilityChanged) {
            this.app.onToolbarVisibilityChanged(visible);
        }
    }

    initDragging() {
        const header = this.container.querySelector('#floatingToolbarHeader');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = this.container.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            this.container.style.left = `${Math.max(10, initialLeft + dx)}px`;
            this.container.style.top = `${Math.max(60, initialTop + dy)}px`;
            this.container.style.right = 'auto';
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
    }
}
