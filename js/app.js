/**
 * Beat Sequencer Application
 * Main application logic and UI control
 */

// Constants
const INSTRUMENTS = ['KICK', 'SNARE', 'HI-HAT', 'TOM', 'CLAP', 'RIM'];
let STEPS = 16; // Can be changed to 8, 16, or 32

// State
let audioEngine;
let isPlaying = false;
let currentStep = 0;
let tempo = 120;
let grid = [];

// Scheduler variables
let nextNoteTime = 0;
let currentStepRef = 0;
let timerID = null;
const lookahead = 25.0; // ms
const scheduleAheadTime = 0.1; // seconds

// Visualizer
let visualizerCanvas;
let visualizerCtx;
let animationFrameId;

/**
 * Initialize the application
 */
function init() {
    // Initialize audio engine
    audioEngine = new AudioEngine();

    // Initialize grid with default pattern
    initGrid();

    // Setup UI
    setupGrid();
    setupControls();
    setupVisualizer();
    setupTheme();

    // Load saved pattern if exists
    loadPattern();
}

/**
 * Initialize grid data with default pattern
 */
function initGrid() {
    grid = Array(INSTRUMENTS.length).fill().map(() => Array(STEPS).fill(false));

    // Create a simple default beat
    for (let i = 0; i < STEPS; i += 4) grid[0][i] = true; // Kick on 1, 5, 9, 13
    for (let i = 4; i < STEPS; i += 8) grid[1][i] = true; // Snare on 5, 13
    for (let i = 2; i < STEPS; i += 4) grid[2][i] = true; // Hi-Hat
}

/**
 * Setup the sequencer grid UI
 */
function setupGrid() {
    const gridContainer = document.getElementById('gridContainer');
    const stepNumbers = document.getElementById('stepNumbers');

    // Clear existing content
    gridContainer.innerHTML = '';
    stepNumbers.innerHTML = '';

    // Create grid rows
    INSTRUMENTS.forEach((instrument, rowIdx) => {
        const row = document.createElement('div');
        row.className = 'grid-row';

        // Instrument label
        const label = document.createElement('div');
        label.className = 'instrument-label';
        label.textContent = instrument;
        row.appendChild(label);

        // Steps container
        const stepsRow = document.createElement('div');
        stepsRow.className = 'steps-row';
        stepsRow.style.gridTemplateColumns = `repeat(${STEPS}, 1fr)`;

        // Create step buttons
        for (let colIdx = 0; colIdx < STEPS; colIdx++) {
            const step = document.createElement('div');
            step.className = 'step';
            step.dataset.row = rowIdx;
            step.dataset.col = colIdx;

            if (grid[rowIdx][colIdx]) {
                step.classList.add('active');
            }

            step.addEventListener('click', () => toggleStep(rowIdx, colIdx));
            stepsRow.appendChild(step);
        }

        row.appendChild(stepsRow);
        gridContainer.appendChild(row);
    });

    // Create step numbers
    stepNumbers.style.gridTemplateColumns = `repeat(${STEPS}, 1fr)`;
    for (let i = 0; i < STEPS; i++) {
        const number = document.createElement('div');
        number.className = 'step-number';
        number.textContent = i + 1;
        number.dataset.step = i;
        stepNumbers.appendChild(number);
    }
}

/**
 * Toggle a step on/off
 */
function toggleStep(row, col) {
    grid[row][col] = !grid[row][col];

    const step = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    step.classList.toggle('active');
}

/**
 * Setup control buttons and inputs
 */
function setupControls() {
    // Play/Stop button
    const playBtn = document.getElementById('playBtn');
    playBtn.addEventListener('click', togglePlayback);

    // Step selector (radio buttons)
    const stepRadios = document.querySelectorAll('input[name="steps"]');
    stepRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const wasPlaying = isPlaying;
            if (wasPlaying) {
                togglePlayback(); // Stop playback
            }

            STEPS = parseInt(e.target.value);
            initGrid();
            setupGrid();

            if (wasPlaying) {
                togglePlayback(); // Resume playback
            }
        });
    });

    // Tempo slider
    const tempoSlider = document.getElementById('tempoSlider');
    const tempoValue = document.getElementById('tempoValue');
    tempoSlider.addEventListener('input', (e) => {
        tempo = parseInt(e.target.value);
        tempoValue.textContent = tempo;
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', clearGrid);

    // Random button
    document.getElementById('randomBtn').addEventListener('click', randomizeGrid);

    // Save button
    document.getElementById('saveBtn').addEventListener('click', savePattern);

    // Load button
    document.getElementById('loadBtn').addEventListener('click', loadPattern);
}

/**
 * Toggle playback
 */
function togglePlayback() {
    isPlaying = !isPlaying;
    const playBtn = document.getElementById('playBtn');
    const btnText = playBtn.querySelector('.btn-text');

    if (isPlaying) {
        audioEngine.resume();
        playBtn.classList.add('playing');
        btnText.textContent = 'STOP';
        startScheduler();
    } else {
        playBtn.classList.remove('playing');
        btnText.textContent = 'PLAY';
        stopScheduler();
    }
}

/**
 * Start the audio scheduler
 */
function startScheduler() {
    nextNoteTime = audioEngine.ctx.currentTime + 0.05;
    currentStepRef = 0;
    currentStep = 0;
    updateCurrentStep();
    scheduler();
}

/**
 * Stop the audio scheduler
 */
function stopScheduler() {
    if (timerID) {
        clearTimeout(timerID);
        timerID = null;
    }
    currentStep = 0;
    updateCurrentStep();
}

/**
 * Audio scheduler - schedules notes ahead of time
 */
function scheduler() {
    while (nextNoteTime < audioEngine.ctx.currentTime + scheduleAheadTime) {
        scheduleNote(currentStepRef, nextNoteTime);
        nextNote();
    }
    timerID = setTimeout(scheduler, lookahead);
}

/**
 * Schedule a note to play
 */
function scheduleNote(stepNumber, time) {
    grid.forEach((row, instrumentIndex) => {
        if (row[stepNumber]) {
            audioEngine.playSound(INSTRUMENTS[instrumentIndex], time);
        }
    });
}

/**
 * Move to next note
 */
function nextNote() {
    const secondsPerBeat = 60.0 / tempo;
    nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
    currentStepRef = (currentStepRef + 1) % STEPS;
    currentStep = currentStepRef;
    updateCurrentStep();
}

/**
 * Update UI to show current step
 */
function updateCurrentStep() {
    // Update step cells
    document.querySelectorAll('.step').forEach(step => {
        const col = parseInt(step.dataset.col);
        if (col === currentStep) {
            step.classList.add('current');
        } else {
            step.classList.remove('current');
        }
    });

    // Update step numbers
    document.querySelectorAll('.step-number').forEach(number => {
        const stepNum = parseInt(number.dataset.step);
        if (stepNum === currentStep) {
            number.classList.add('current');
        } else {
            number.classList.remove('current');
        }
    });
}

/**
 * Clear the grid
 */
function clearGrid() {
    grid = Array(INSTRUMENTS.length).fill().map(() => Array(STEPS).fill(false));
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
}

/**
 * Randomize the grid
 */
function randomizeGrid() {
    grid = grid.map(row => row.map(() => Math.random() > 0.8));

    document.querySelectorAll('.step').forEach(step => {
        const row = parseInt(step.dataset.row);
        const col = parseInt(step.dataset.col);

        if (grid[row][col]) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

/**
 * Save pattern to localStorage
 */
function savePattern() {
    const data = JSON.stringify({ grid, tempo });
    localStorage.setItem('beatSequencerPattern', data);

    // Visual feedback
    const saveBtn = document.getElementById('saveBtn');
    const originalHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    saveBtn.style.color = '#10b981';

    setTimeout(() => {
        saveBtn.innerHTML = originalHTML;
        saveBtn.style.color = '';
    }, 1500);
}

/**
 * Load pattern from localStorage
 */
function loadPattern() {
    const data = localStorage.getItem('beatSequencerPattern');
    if (data) {
        const parsed = JSON.parse(data);
        if (parsed.grid) {
            grid = parsed.grid;
            setupGrid();
        }
        if (parsed.tempo) {
            tempo = parsed.tempo;
            document.getElementById('tempoSlider').value = tempo;
            document.getElementById('tempoValue').textContent = tempo;
        }
    }
}

/**
 * Setup the visualizer
 */
function setupVisualizer() {
    visualizerCanvas = document.getElementById('visualizer');
    visualizerCtx = visualizerCanvas.getContext('2d');

    drawVisualizer();
}

/**
 * Draw the visualizer
 */
function drawVisualizer() {
    animationFrameId = requestAnimationFrame(drawVisualizer);

    const dataArray = new Uint8Array(audioEngine.analyser.frequencyBinCount);
    audioEngine.analyser.getByteTimeDomainData(dataArray);

    // Get theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        !document.documentElement.getAttribute('data-theme');

    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const lineColor = isDark ? '#8b5cf6' : '#7c3aed';

    visualizerCtx.fillStyle = bgColor;
    visualizerCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    visualizerCtx.lineWidth = 3;
    visualizerCtx.strokeStyle = lineColor;
    visualizerCtx.beginPath();

    const sliceWidth = visualizerCanvas.width / audioEngine.analyser.frequencyBinCount;
    let x = 0;

    for (let i = 0; i < audioEngine.analyser.frequencyBinCount; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * visualizerCanvas.height / 2;

        if (i === 0) {
            visualizerCtx.moveTo(x, y);
        } else {
            visualizerCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    visualizerCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
    visualizerCtx.stroke();
}

/**
 * Setup theme toggle
 */
function setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'dark';

    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
