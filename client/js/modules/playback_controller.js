/**
 * PlaybackController - Controls timeline playback
 * 
 * Responsibilities:
 * - Forward/backward step-by-step playback
 * - Timeline scrubbing (seek to time)
 * - Play/pause/stop controls
 * - Interpolation-based preview
 */

class PlaybackController extends EventEmitter {
    /**
     * @param {Object} options
     * @param {TimelineManager} options.timelineManager
     * @param {SnapshotManager} options.snapshotManager
     * @param {Function} options.onRender - Callback to render a snapshot
     */
    constructor(options) {
        super();

        this.timelineManager = options.timelineManager;
        this.snapshotManager = options.snapshotManager;
        this.onRender = options.onRender || (() => { });

        this._currentStepIndex = -1;  // -1 = initial state
        this._currentTime = 0;
        this._isPlaying = false;
        this._playbackSpeed = 1.0;
        this._playDirection = 1;  // 1 = forward, -1 = backward

        this._animationFrame = null;
        this._playStartTime = null;
        this._playStartPosition = 0;
    }

    // ========================================
    // PLAYBACK CONTROLS
    // ========================================

    /**
     * Start playing forward
     */
    play() {
        if (this._isPlaying) return;

        this._isPlaying = true;
        this._playDirection = 1;
        this._playStartTime = performance.now();
        this._playStartPosition = this._currentTime;

        this.emit('play', { time: this._currentTime });
        this._playbackLoop();
    }

    /**
     * Start playing backward
     */
    playBackward() {
        if (this._isPlaying) return;

        this._isPlaying = true;
        this._playDirection = -1;
        this._playStartTime = performance.now();
        this._playStartPosition = this._currentTime;

        this.emit('playBackward', { time: this._currentTime });
        this._playbackLoop();
    }

    /**
     * Pause playback
     */
    pause() {
        if (!this._isPlaying) return;

        this._isPlaying = false;
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }

        this.emit('pause', { time: this._currentTime });
    }

    /**
     * Stop and return to beginning
     */
    stop() {
        this.pause();
        this._currentTime = 0;
        this._currentStepIndex = -1;

        // Render initial state
        const initial = this.snapshotManager.getInitialSnapshot();
        if (initial) {
            this.onRender(initial);
        }

        this.emit('stop');
        this.emit('timeUpdate', { time: 0 });
    }

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this._isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    // ========================================
    // STEP NAVIGATION
    // ========================================

    /**
     * Go to next step
     */
    stepForward() {
        const stepCount = this.timelineManager.getStepCount();

        if (this._currentStepIndex >= stepCount - 1) {
            // Already at last step
            return;
        }

        this._currentStepIndex++;

        // Get end snapshot of this step (snapshotIndex = stepIndex + 1)
        const snapshot = this.snapshotManager.getSnapshot(this._currentStepIndex + 1);
        if (snapshot) {
            this.onRender(snapshot);
        }

        // Update current time to end of step
        const step = this.timelineManager.getSteps()[this._currentStepIndex];
        if (step) {
            this._currentTime = step.endTime;
        }

        this.emit('stepChange', {
            stepIndex: this._currentStepIndex,
            direction: 'forward'
        });
        this.emit('timeUpdate', { time: this._currentTime });
    }

    /**
     * Go to previous step
     */
    stepBackward() {
        if (this._currentStepIndex < 0) {
            // Already at initial state
            return;
        }

        this._currentStepIndex--;

        // Get snapshot for this step
        const snapshot = this.snapshotManager.getSnapshot(this._currentStepIndex + 1);
        if (snapshot) {
            this.onRender(snapshot);
        } else if (this._currentStepIndex === -1) {
            // Return to initial state
            const initial = this.snapshotManager.getInitialSnapshot();
            if (initial) {
                this.onRender(initial);
            }
        }

        // Update current time
        if (this._currentStepIndex >= 0) {
            const step = this.timelineManager.getSteps()[this._currentStepIndex];
            if (step) {
                this._currentTime = step.endTime;
            }
        } else {
            this._currentTime = 0;
        }

        this.emit('stepChange', {
            stepIndex: this._currentStepIndex,
            direction: 'backward'
        });
        this.emit('timeUpdate', { time: this._currentTime });
    }

    /**
     * Jump directly to a step
     * @param {number} stepIndex - Target step index (-1 for initial)
     */
    jumpToStep(stepIndex) {
        const stepCount = this.timelineManager.getStepCount();

        if (stepIndex < -1 || stepIndex >= stepCount) {
            console.warn('[PlaybackController] Invalid step index:', stepIndex);
            return;
        }

        this._currentStepIndex = stepIndex;

        // Get and render snapshot
        const snapshot = this.snapshotManager.getSnapshot(stepIndex + 1);
        if (snapshot) {
            this.onRender(snapshot);
        } else if (stepIndex === -1) {
            const initial = this.snapshotManager.getInitialSnapshot();
            if (initial) {
                this.onRender(initial);
            }
        }

        // Update time
        if (stepIndex >= 0) {
            const step = this.timelineManager.getSteps()[stepIndex];
            if (step) {
                this._currentTime = step.endTime;
            }
        } else {
            this._currentTime = 0;
        }

        this.emit('stepChange', { stepIndex: this._currentStepIndex, direction: 'jump' });
        this.emit('timeUpdate', { time: this._currentTime });
    }

    // ========================================
    // TIME SEEKING
    // ========================================

    /**
     * Seek to a specific time
     * @param {number} time - Time in seconds
     */
    seekToTime(time) {
        const totalDuration = this.timelineManager.getTotalDuration();

        // Clamp time
        time = Math.max(0, Math.min(time, totalDuration));
        this._currentTime = time;

        // Find which step we're in
        const stepResult = this.timelineManager.getStepAtTime(time);
        if (stepResult) {
            this._currentStepIndex = stepResult.index;
        } else if (time === 0) {
            this._currentStepIndex = -1;
        }

        // Interpolate and render
        const steps = this.timelineManager.getSteps();
        const interpolated = this.snapshotManager.getStateAtTime(time, steps);
        this.onRender(interpolated);

        this.emit('seek', { time });
        this.emit('timeUpdate', { time });
    }

    /**
     * Set current time (alias for seekToTime)
     */
    setTime(time) {
        this.seekToTime(time);
    }

    // ========================================
    // STATE QUERIES
    // ========================================

    /**
     * Get current step index
     * @returns {number} -1 = initial, 0+ = step index
     */
    getCurrentStepIndex() {
        return this._currentStepIndex;
    }

    /**
     * Get current time in seconds
     * @returns {number}
     */
    getCurrentTime() {
        return this._currentTime;
    }

    /**
     * Check if currently playing
     * @returns {boolean}
     */
    isPlaying() {
        return this._isPlaying;
    }

    /**
     * Check if at start (initial state)
     * @returns {boolean}
     */
    isAtStart() {
        return this._currentStepIndex === -1 && this._currentTime === 0;
    }

    /**
     * Check if at end
     * @returns {boolean}
     */
    isAtEnd() {
        const totalDuration = this.timelineManager.getTotalDuration();
        return this._currentTime >= totalDuration && totalDuration > 0;
    }

    /**
     * Get playback speed
     * @returns {number}
     */
    getSpeed() {
        return this._playbackSpeed;
    }

    /**
     * Set playback speed
     * @param {number} speed - Speed multiplier (0.5, 1.0, 2.0, etc.)
     */
    setSpeed(speed) {
        this._playbackSpeed = Math.max(0.25, Math.min(4.0, speed));
        this.emit('speedChange', { speed: this._playbackSpeed });
    }

    // ========================================
    // PRIVATE METHODS
    // ========================================

    /**
     * Playback loop using requestAnimationFrame
     * @private
     */
    _playbackLoop() {
        if (!this._isPlaying) return;

        const now = performance.now();
        const elapsed = (now - this._playStartTime) / 1000;  // Convert to seconds
        const delta = elapsed * this._playbackSpeed * this._playDirection;

        this._currentTime = this._playStartPosition + delta;

        // Clamp and check bounds
        const totalDuration = this.timelineManager.getTotalDuration();
        let reachedEnd = false;

        if (this._playDirection === 1 && this._currentTime >= totalDuration) {
            this._currentTime = totalDuration;
            reachedEnd = true;
        } else if (this._playDirection === -1 && this._currentTime <= 0) {
            this._currentTime = 0;
            this._currentStepIndex = -1;
            reachedEnd = true;
        }

        // Update step index
        const stepResult = this.timelineManager.getStepAtTime(this._currentTime);
        if (stepResult) {
            const prevIndex = this._currentStepIndex;
            this._currentStepIndex = stepResult.index;

            if (prevIndex !== this._currentStepIndex) {
                this.emit('stepChange', {
                    stepIndex: this._currentStepIndex,
                    direction: this._playDirection === 1 ? 'forward' : 'backward'
                });
            }
        } else if (this._currentTime === 0) {
            this._currentStepIndex = -1;
        }

        // Render interpolated state
        const steps = this.timelineManager.getSteps();
        const interpolated = this.snapshotManager.getStateAtTime(this._currentTime, steps);
        this.onRender(interpolated);

        // Emit time update
        this.emit('timeUpdate', { time: this._currentTime });

        // If we reached the end, do final render/emit first, THEN pause and signal complete
        if (reachedEnd) {
            this.pause();
            this.emit('playbackComplete');
            return;
        }

        // Continue loop if still playing
        if (this._isPlaying) {
            this._animationFrame = requestAnimationFrame(() => this._playbackLoop());
        }
    }

    // ========================================
    // STATIC METHODS
    // ========================================

    /**
     * Run unit tests
     */
    static test() {
        console.log('[PlaybackController] Running tests...');

        // Mock dependencies
        const mockScenario = [
            { stepId: 1, startTime: 0, duration: 1.5, endTime: 1.5 },
            { stepId: 2, startTime: 1.5, duration: 1.0, endTime: 2.5 },
            { stepId: 3, startTime: 2.5, duration: 1.0, endTime: 3.5 }
        ];

        const mockSnapshots = [
            { card_A: { x: 100, y: 100 } },  // Initial
            { card_A: { x: 200, y: 200 } },  // After step 1
            { card_A: { x: 300, y: 300 } },  // After step 2
            { card_A: { x: 400, y: 400 } }   // After step 3
        ];

        // Create mock managers
        const mockTimelineManager = {
            getStepCount: () => mockScenario.length,
            getTotalDuration: () => 3.5,
            getSteps: () => mockScenario,
            getStepAtTime: (time) => {
                for (let i = 0; i < mockScenario.length; i++) {
                    if (time >= mockScenario[i].startTime && time <= mockScenario[i].endTime) {
                        return { step: mockScenario[i], index: i };
                    }
                }
                return null;
            }
        };

        const mockSnapshotManager = {
            getSnapshot: (index) => mockSnapshots[index] || null,
            getInitialSnapshot: () => mockSnapshots[0],
            getStateAtTime: (time, steps) => {
                // Simplified interpolation for test
                const stepIndex = Math.floor(time / 1.0);
                return mockSnapshots[Math.min(stepIndex, mockSnapshots.length - 1)];
            }
        };

        let lastRendered = null;
        const pc = new PlaybackController({
            timelineManager: mockTimelineManager,
            snapshotManager: mockSnapshotManager,
            onRender: (snapshot) => { lastRendered = snapshot; }
        });

        // Test 1: Initial state
        console.assert(
            pc.getCurrentStepIndex() === -1,
            'Test 1 failed: Should start at step -1'
        );
        console.assert(
            pc.getCurrentTime() === 0,
            'Test 1b failed: Should start at time 0'
        );

        // Test 2: Step forward
        pc.stepForward();
        console.assert(
            pc.getCurrentStepIndex() === 0,
            'Test 2 failed: Should be at step 0 after stepForward'
        );
        console.assert(
            lastRendered?.card_A?.x === 200,
            `Test 2b failed: Should render step 1 snapshot, got ${JSON.stringify(lastRendered)}`
        );

        // Test 3: Step backward
        pc.stepBackward();
        console.assert(
            pc.getCurrentStepIndex() === -1,
            'Test 3 failed: Should be at step -1 after stepBackward'
        );

        // Test 4: Jump to step
        pc.jumpToStep(2);
        console.assert(
            pc.getCurrentStepIndex() === 2,
            'Test 4 failed: Should be at step 2 after jump'
        );
        console.assert(
            pc.getCurrentTime() === 3.5,
            `Test 4b failed: Time should be 3.5, got ${pc.getCurrentTime()}`
        );

        // Test 5: Seek to time
        pc.seekToTime(1.0);
        console.assert(
            pc.getCurrentStepIndex() === 0,
            'Test 5 failed: Should be in step 0 at time 1.0'
        );

        // Test 6: Speed setting
        pc.setSpeed(2.0);
        console.assert(
            pc.getSpeed() === 2.0,
            'Test 6 failed: Speed should be 2.0'
        );

        console.log('[PlaybackController] All tests passed ✓');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaybackController;
}
