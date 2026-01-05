/**
 * Audio Export Module
 * Handles recording and exporting beat patterns as audio files
 */

let exportModal;
let isExporting = false;

/**
 * Initialize export modal
 */
function initExportModal() {
    exportModal = document.getElementById('exportModal');
    const exportBtn = document.getElementById('exportBtn');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalExport = document.getElementById('modalExport');

    // Format radio buttons
    const formatRadios = document.querySelectorAll('input[name="format"]');
    const mp3QualityGroup = document.getElementById('mp3QualityGroup');

    // Loop count slider
    const loopCount = document.getElementById('loopCount');
    const loopCountValue = document.getElementById('loopCountValue');

    // MP3 quality slider
    const mp3Quality = document.getElementById('mp3Quality');
    const mp3QualityValue = document.getElementById('mp3QualityValue');

    // Open modal
    exportBtn.addEventListener('click', () => {
        exportModal.classList.add('active');
    });

    // Close modal
    const closeModal = () => {
        exportModal.classList.remove('active');
    };

    modalClose.addEventListener('click', closeModal);
    modalCancel.addEventListener('click', closeModal);

    // Click outside to close
    exportModal.addEventListener('click', (e) => {
        if (e.target === exportModal) {
            closeModal();
        }
    });

    // Format change - show/hide MP3 quality
    formatRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'mp3') {
                mp3QualityGroup.style.display = 'block';
            } else {
                mp3QualityGroup.style.display = 'none';
            }
        });
    });

    // Loop count slider
    loopCount.addEventListener('input', (e) => {
        loopCountValue.textContent = e.target.value;
    });

    // MP3 quality slider
    mp3Quality.addEventListener('input', (e) => {
        mp3QualityValue.textContent = `${e.target.value} kbps`;
    });

    // Export button
    modalExport.addEventListener('click', handleExport);
}

/**
 * Handle audio export
 */
async function handleExport() {
    if (isExporting) return;

    const format = document.querySelector('input[name="format"]:checked').value;
    const loops = parseInt(document.getElementById('loopCount').value);

    isExporting = true;
    const modalExport = document.getElementById('modalExport');
    const originalHTML = modalExport.innerHTML;
    modalExport.innerHTML = '<span>Exporting...</span>';
    modalExport.disabled = true;

    try {
        await exportAudio(format, loops);

        // Success feedback
        modalExport.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Done!';

        setTimeout(() => {
            exportModal.classList.remove('active');
            modalExport.innerHTML = originalHTML;
            modalExport.disabled = false;
            isExporting = false;
        }, 1500);
    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
        modalExport.innerHTML = originalHTML;
        modalExport.disabled = false;
        isExporting = false;
    }
}

/**
 * Export audio as WAV file
 */
async function exportAudio(format, loops) {
    const sampleRate = audioEngine.ctx.sampleRate;
    const secondsPerBeat = 60.0 / tempo;
    const secondsPerStep = secondsPerBeat * 0.25; // 16th notes
    const loopDuration = STEPS * secondsPerStep;
    const totalDuration = loopDuration * loops;
    const totalSamples = Math.ceil(totalDuration * sampleRate);

    // Create offline context for rendering
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

    // Create a temporary audio engine for offline rendering
    const offlineEngine = {
        ctx: offlineCtx,
        masterGain: offlineCtx.createGain(),
        playSound: audioEngine.playSound.bind({ ctx: offlineCtx, masterGain: offlineCtx.createGain() })
    };

    offlineEngine.masterGain.gain.value = 0.5;
    offlineEngine.masterGain.connect(offlineCtx.destination);

    // Schedule all notes for all loops
    for (let loop = 0; loop < loops; loop++) {
        const loopStartTime = loop * loopDuration;

        for (let step = 0; step < STEPS; step++) {
            const stepTime = loopStartTime + (step * secondsPerStep);

            grid.forEach((row, instrumentIndex) => {
                if (row[step]) {
                    scheduleOfflineNote(offlineEngine, INSTRUMENTS[instrumentIndex], stepTime);
                }
            });
        }
    }

    // Render audio
    const renderedBuffer = await offlineCtx.startRendering();

    // Convert to WAV and download
    if (format === 'wav') {
        downloadWAV(renderedBuffer);
    } else {
        // MP3 export would require additional library (e.g., lamejs)
        // For now, fallback to WAV
        console.warn('MP3 export not yet implemented, using WAV');
        downloadWAV(renderedBuffer);
    }
}

/**
 * Schedule a note in offline context
 */
function scheduleOfflineNote(engine, instrument, time) {
    const ctx = engine.ctx;
    const masterGain = engine.masterGain;

    switch (instrument) {
        case 'KICK':
            {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.setValueAtTime(150, time);
                osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
                gain.gain.setValueAtTime(1, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(time);
                osc.stop(time + 0.5);
            }
            break;
        case 'SNARE':
            {
                // Noise
                const bufferSize = ctx.sampleRate;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const noiseFilter = ctx.createBiquadFilter();
                noiseFilter.type = 'highpass';
                noiseFilter.frequency.value = 1000;
                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(1, time);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(masterGain);

                // Tone
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(100, time);
                const oscGain = ctx.createGain();
                oscGain.gain.setValueAtTime(0.5, time);
                oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                osc.connect(oscGain);
                oscGain.connect(masterGain);

                noise.start(time);
                osc.start(time);
                osc.stop(time + 0.2);
            }
            break;
        case 'HI-HAT':
            {
                const bufferSize = ctx.sampleRate * 0.1;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const bandpass = ctx.createBiquadFilter();
                bandpass.type = 'bandpass';
                bandpass.frequency.value = 10000;
                const highpass = ctx.createBiquadFilter();
                highpass.type = 'highpass';
                highpass.frequency.value = 7000;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.6, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
                noise.connect(bandpass);
                bandpass.connect(highpass);
                highpass.connect(gain);
                gain.connect(masterGain);
                noise.start(time);
            }
            break;
        case 'TOM':
            {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.setValueAtTime(200, time);
                osc.frequency.exponentialRampToValueAtTime(50, time + 0.4);
                gain.gain.setValueAtTime(0.8, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(time);
                osc.stop(time + 0.4);
            }
            break;
        case 'CLAP':
            {
                const bufferSize = ctx.sampleRate * 0.2;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1500;
                filter.Q.value = 1;
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.8, time + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(masterGain);
                noise.start(time);
            }
            break;
        case 'RIM':
            {
                const osc = ctx.createOscillator();
                osc.type = 'square';
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 800;
                osc.frequency.setValueAtTime(400, time);
                gain.gain.setValueAtTime(0.5, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(masterGain);
                osc.start(time);
                osc.stop(time + 0.05);
            }
            break;
    }
}

/**
 * Convert AudioBuffer to WAV and download
 */
function downloadWAV(buffer) {
    const wav = audioBufferToWav(buffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beat-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Convert AudioBuffer to WAV format
 */
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = buffer.getChannelData(channel)[i];
            const clampedSample = Math.max(-1, Math.min(1, sample));
            data.push(clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7FFF);
        }
    }

    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
        view.setInt16(offset, data[i], true);
        offset += 2;
    }

    return arrayBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
