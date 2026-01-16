/**
 * TimelineUI - DOM-based timeline visualization
 * 
 * Responsibilities:
 * - Render step blocks on timeline
 * - Handle user interactions (click, drag, resize)
 * - Display playhead
 * - Show step details on selection
 */

class TimelineUI extends EventEmitter {
    /**
     * @param {HTMLElement} container - Container element for timeline
     * @param {Object} options
     * @param {TimelineManager} options.timelineManager
     * @param {PlaybackController} options.playbackController
     * @param {Function} options.onStepSelect - Called when step is selected
     * @param {Function} options.onStepEdit - Called when edit is requested
     * @param {Function} options.onStepMove - Called when step is moved
     */
    constructor(container, options) {
        super();

        this.container = container;
        this.timelineManager = options.timelineManager;
        this.playbackController = options.playbackController;

        this.onStepSelect = options.onStepSelect || (() => { });
        this.onStepEdit = options.onStepEdit || (() => { });
        this.onStepMove = options.onStepMove || (() => { });

        // State
        this.selectedStepId = null;
        this.pixelsPerSecond = 80;
        this.minPixelsPerSecond = 30;
        this.maxPixelsPerSecond = 200;

        // Drag state
        this.dragState = null;

        // Elements
        this.trackEl = null;
        this.playheadEl = null;
        this.rulerEl = null;
        this.stepBlocksMap = new Map();

        // Initialize
        this._createElements();
        this._bindEvents();

        // Subscribe to playback events
        if (this.playbackController) {
            this.playbackController.on('timeUpdate', (data) => {
                this._updatePlayhead(data.time);
            });
            this.playbackController.on('stepChange', (data) => {
                this._highlightCurrentStep(data.stepIndex);
            });
        }
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    _createElements() {
        // Find existing timeline preview or create track
        const existingPreview = this.container.querySelector('#timelinePreview');

        if (existingPreview) {
            // Enhance existing element
            existingPreview.classList.add('timeline-track');
            this.trackEl = existingPreview;
        } else {
            // Create new track
            this.trackEl = document.createElement('div');
            this.trackEl.className = 'timeline-track';
            this.container.appendChild(this.trackEl);
        }

        // Create inner container
        this.trackInnerEl = document.createElement('div');
        this.trackInnerEl.className = 'timeline-track-inner';
        this.trackEl.innerHTML = '';
        this.trackEl.appendChild(this.trackInnerEl);

        // Create ruler
        this.rulerEl = document.createElement('div');
        this.rulerEl.className = 'timeline-ruler';
        this.trackInnerEl.appendChild(this.rulerEl);

        // Create playhead
        this.playheadEl = document.createElement('div');
        this.playheadEl.className = 'timeline-playhead';
        this.playheadEl.style.left = '0px';
        this.trackInnerEl.appendChild(this.playheadEl);

        // Create playback controls if not exist
        this._createPlaybackControls();
    }

    _createPlaybackControls() {
        const existingControls = this.container.querySelector('.timeline-playback-controls');
        if (existingControls) return;

        // Insert after timeline header
        const header = this.container.querySelector('.timeline-header');
        if (!header) return;

        const controlsEl = document.createElement('div');
        controlsEl.className = 'timeline-playback-controls';
        controlsEl.innerHTML = `
            <button class="btn btn-sm btn-icon" id="tlPrevBtn" title="Previous Step">⏮</button>
            <button class="btn btn-sm btn-icon" id="tlPlayBackwardBtn" title="Play Backward">◀◀</button>
            <button class="btn btn-sm btn-icon" id="tlStopBtn" title="Stop">⏹</button>
            <button class="btn btn-sm btn-icon btn-primary" id="tlPlayBtn" title="Play">▶</button>
            <button class="btn btn-sm btn-icon" id="tlNextBtn" title="Next Step">⏭</button>
            <div class="timeline-time-display">
                <span class="current-time" id="tlCurrentTime">0.0</span>s / 
                <span id="tlTotalTime">0.0</span>s
            </div>
        `;

        header.after(controlsEl);

        // Bind button events
        controlsEl.querySelector('#tlPrevBtn').addEventListener('click', () => {
            this.playbackController?.stepBackward();
        });
        controlsEl.querySelector('#tlPlayBackwardBtn').addEventListener('click', () => {
            this.playbackController?.playBackward();
        });
        controlsEl.querySelector('#tlStopBtn').addEventListener('click', () => {
            this.playbackController?.stop();
        });
        controlsEl.querySelector('#tlPlayBtn').addEventListener('click', () => {
            this.playbackController?.togglePlay();
        });
        controlsEl.querySelector('#tlNextBtn').addEventListener('click', () => {
            this.playbackController?.stepForward();
        });
    }

    _bindEvents() {
        this.trackEl.addEventListener('click', (e) => this._handleTrackClick(e));
        this.trackEl.addEventListener('mousedown', (e) => this._handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this._handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this._handleMouseUp(e));
        this.trackEl.addEventListener('contextmenu', (e) => this._handleContextMenu(e));
    }

    // ========================================
    // RENDERING
    // ========================================

    render() {
        if (!this.trackInnerEl) return;

        const steps = this.timelineManager.getSteps();
        const totalDuration = this.timelineManager.getTotalDuration() || 10;

        // Update total time display
        const totalTimeEl = document.getElementById('tlTotalTime');
        if (totalTimeEl) {
            totalTimeEl.textContent = totalDuration.toFixed(1);
        }

        // Calculate track width
        const trackWidth = Math.max(
            this.trackEl.clientWidth,
            totalDuration * this.pixelsPerSecond + 100
        );
        this.trackInnerEl.style.width = trackWidth + 'px';

        // Render ruler
        this._renderRuler(totalDuration, trackWidth);

        // Clear existing step blocks
        this.stepBlocksMap.forEach((el) => el.remove());
        this.stepBlocksMap.clear();

        // Render step blocks
        steps.forEach((step) => {
            this._renderStepBlock(step);
        });
    }

    _renderRuler(totalDuration, trackWidth) {
        if (!this.rulerEl) return;

        this.rulerEl.innerHTML = '';

        const interval = this._getTimeInterval();

        for (let t = 0; t <= totalDuration + interval; t += interval) {
            const x = t * this.pixelsPerSecond;
            if (x > trackWidth) break;

            const marker = document.createElement('div');
            marker.className = 'timeline-ruler-marker';
            marker.style.left = x + 'px';
            marker.textContent = t.toFixed(1) + 's';
            this.rulerEl.appendChild(marker);
        }
    }

    _getTimeInterval() {
        if (this.pixelsPerSecond > 100) return 0.5;
        if (this.pixelsPerSecond > 50) return 1.0;
        return 2.0;
    }

    _renderStepBlock(step) {
        const block = document.createElement('div');
        block.className = 'timeline-step-block';
        block.dataset.stepId = step.stepId;
        block.style.setProperty('--step-color', step.color || '#4CAF50');
        block.style.background = step.color || '#4CAF50';

        // Position and size
        const left = step.startTime * this.pixelsPerSecond;
        const width = step.duration * this.pixelsPerSecond;
        block.style.left = left + 'px';
        block.style.width = Math.max(width, 40) + 'px';  // Minimum width

        // Content
        block.innerHTML = `
            <div class="step-block-label">${step.label || 'Step ' + step.stepId}</div>
            <div class="step-block-info">${step.duration.toFixed(1)}s • ${step.actions?.length || 0} cards</div>
            <div class="step-resize-handle left"></div>
            <div class="step-resize-handle right"></div>
        `;

        // Selected state
        if (step.stepId === this.selectedStepId) {
            block.classList.add('selected');
        }

        this.trackInnerEl.appendChild(block);
        this.stepBlocksMap.set(step.stepId, block);
    }

    // ========================================
    // PLAYHEAD
    // ========================================

    _updatePlayhead(time) {
        if (!this.playheadEl) return;

        const x = time * this.pixelsPerSecond;
        this.playheadEl.style.left = x + 'px';

        // Update time display
        const currentTimeEl = document.getElementById('tlCurrentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = time.toFixed(1);
        }
    }

    _highlightCurrentStep(stepIndex) {
        // Remove playing class from all
        this.stepBlocksMap.forEach((el) => el.classList.remove('playing'));

        // Add to current
        if (stepIndex >= 0) {
            const steps = this.timelineManager.getSteps();
            const step = steps[stepIndex];
            if (step) {
                const block = this.stepBlocksMap.get(step.stepId);
                if (block) {
                    block.classList.add('playing');
                }
            }
        }
    }

    // ========================================
    // INTERACTIONS
    // ========================================

    _handleTrackClick(e) {
        const block = e.target.closest('.timeline-step-block');

        if (block) {
            // Step block clicked
            const stepId = parseInt(block.dataset.stepId);
            this.selectStep(stepId);
        } else if (e.target.closest('.timeline-ruler') || e.target === this.trackEl) {
            // Ruler or empty area clicked - move playhead
            const rect = this.trackInnerEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = x / this.pixelsPerSecond;
            this.playbackController?.seekToTime(Math.max(0, time));
        }
    }

    _handleMouseDown(e) {
        const block = e.target.closest('.timeline-step-block');
        if (!block) return;

        const stepId = parseInt(block.dataset.stepId);
        const handle = e.target.closest('.step-resize-handle');

        if (handle) {
            // Start resize
            this.dragState = {
                type: handle.classList.contains('left') ? 'resize-left' : 'resize-right',
                stepId: stepId,
                startX: e.clientX,
                startTime: null,
                startDuration: null
            };

            const stepInfo = this.timelineManager.getStepById(stepId);
            if (stepInfo) {
                this.dragState.startTime = stepInfo.step.startTime;
                this.dragState.startDuration = stepInfo.step.duration;
            }
        } else {
            // Start move
            this.dragState = {
                type: 'move',
                stepId: stepId,
                startX: e.clientX,
                startTime: null
            };

            const stepInfo = this.timelineManager.getStepById(stepId);
            if (stepInfo) {
                this.dragState.startTime = stepInfo.step.startTime;
            }

            block.classList.add('dragging');
        }

        e.preventDefault();
    }

    _handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = e.clientX - this.dragState.startX;
        const deltaTime = deltaX / this.pixelsPerSecond;

        const stepInfo = this.timelineManager.getStepById(this.dragState.stepId);
        if (!stepInfo) return;

        if (this.dragState.type === 'move') {
            // Move step
            const newStartTime = Math.max(0, this.dragState.startTime + deltaTime);
            this.timelineManager.updateStep(stepInfo.index, { startTime: newStartTime });
            this.render();
        } else if (this.dragState.type === 'resize-right') {
            // Resize duration
            const newDuration = Math.max(0.1, this.dragState.startDuration + deltaTime);
            this.timelineManager.updateStep(stepInfo.index, { duration: newDuration });
            this.render();
        } else if (this.dragState.type === 'resize-left') {
            // Resize from left (change start time, adjust duration)
            const newStartTime = Math.max(0, this.dragState.startTime + deltaTime);
            const endTime = this.dragState.startTime + this.dragState.startDuration;
            const newDuration = Math.max(0.1, endTime - newStartTime);
            this.timelineManager.updateStep(stepInfo.index, {
                startTime: newStartTime,
                duration: newDuration
            });
            this.render();
        }
    }

    _handleMouseUp(e) {
        if (!this.dragState) return;

        // Remove dragging class
        const block = this.stepBlocksMap.get(this.dragState.stepId);
        if (block) {
            block.classList.remove('dragging');
        }

        // Emit move event
        const stepInfo = this.timelineManager.getStepById(this.dragState.stepId);
        if (stepInfo) {
            this.onStepMove(stepInfo.step);
            this.emit('stepMoved', stepInfo.step);
        }

        this.dragState = null;
    }

    _handleContextMenu(e) {
        const block = e.target.closest('.timeline-step-block');
        if (!block) return;

        e.preventDefault();

        const stepId = parseInt(block.dataset.stepId);
        this.selectStep(stepId);

        // Show context menu
        this._showContextMenu(e.clientX, e.clientY, stepId);
    }

    // ========================================
    // SELECTION
    // ========================================

    selectStep(stepId) {
        // Deselect previous
        if (this.selectedStepId !== null) {
            const prevBlock = this.stepBlocksMap.get(this.selectedStepId);
            if (prevBlock) {
                prevBlock.classList.remove('selected');
            }
        }

        this.selectedStepId = stepId;

        // Select new
        const block = this.stepBlocksMap.get(stepId);
        if (block) {
            block.classList.add('selected');
        }

        // Get step info and notify
        const stepInfo = this.timelineManager.getStepById(stepId);
        if (stepInfo) {
            this.onStepSelect(stepInfo.step, stepInfo.index);
            this.emit('stepSelected', stepInfo);
        }
    }

    deselectStep() {
        if (this.selectedStepId !== null) {
            const block = this.stepBlocksMap.get(this.selectedStepId);
            if (block) {
                block.classList.remove('selected');
            }
        }
        this.selectedStepId = null;
    }

    // ========================================
    // CONTEXT MENU
    // ========================================

    _showContextMenu(x, y, stepId) {
        // Remove existing menu
        this._hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'step-context-menu visible';
        menu.id = 'stepContextMenu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        menu.innerHTML = `
            <button class="step-context-item" data-action="edit">✏️ Edit Step</button>
            <button class="step-context-item" data-action="insert">➕ Insert After</button>
            <button class="step-context-item" data-action="duplicate">📋 Duplicate</button>
            <div class="step-context-divider"></div>
            <button class="step-context-item danger" data-action="delete">🗑️ Delete</button>
        `;

        document.body.appendChild(menu);

        // Handle menu clicks
        menu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (!action) return;

            this._hideContextMenu();
            this._handleContextAction(action, stepId);
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this._hideContextMenu.bind(this), { once: true });
        }, 0);
    }

    _hideContextMenu() {
        const menu = document.getElementById('stepContextMenu');
        if (menu) {
            menu.remove();
        }
    }

    _handleContextAction(action, stepId) {
        const stepInfo = this.timelineManager.getStepById(stepId);
        if (!stepInfo) return;

        switch (action) {
            case 'edit':
                this.onStepEdit(stepInfo.step, stepInfo.index);
                this.emit('stepEditRequested', stepInfo);
                break;

            case 'insert':
                this.emit('stepInsertRequested', stepInfo);
                break;

            case 'duplicate':
                const newStep = JSON.parse(JSON.stringify(stepInfo.step));
                delete newStep.stepId;  // Will be regenerated
                this.timelineManager.insertStepAfter(stepInfo.index, newStep);
                this.render();
                break;

            case 'delete':
                if (confirm(`Delete Step ${stepInfo.step.stepId}?`)) {
                    this.timelineManager.deleteStep(stepInfo.index);
                    this.render();
                    this.emit('stepDeleted', stepInfo);
                }
                break;
        }
    }

    // ========================================
    // ZOOM
    // ========================================

    zoomIn() {
        this.pixelsPerSecond = Math.min(this.maxPixelsPerSecond, this.pixelsPerSecond * 1.5);
        this.render();
    }

    zoomOut() {
        this.pixelsPerSecond = Math.max(this.minPixelsPerSecond, this.pixelsPerSecond / 1.5);
        this.render();
    }

    zoomToFit() {
        const trackWidth = this.trackEl.clientWidth - 50;
        const totalDuration = this.timelineManager.getTotalDuration() || 10;
        this.pixelsPerSecond = Math.max(
            this.minPixelsPerSecond,
            Math.min(this.maxPixelsPerSecond, trackWidth / totalDuration)
        );
        this.render();
    }

    // ========================================
    // CLEANUP
    // ========================================

    destroy() {
        this.stepBlocksMap.clear();
        if (this.trackEl) {
            this.trackEl.innerHTML = '';
        }
        this.off();  // Remove all event listeners
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimelineUI;
}
