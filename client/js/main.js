// Initialize CSInterface
const csInterface = new CSInterface();

// DOM Elements
let generateBtn;
let animationType;
let duration;
let cardCount;
let statusMessage;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Get DOM elements
    generateBtn = document.getElementById('generateBtn');
    animationType = document.getElementById('animationType');
    duration = document.getElementById('duration');
    cardCount = document.getElementById('cardCount');
    statusMessage = document.getElementById('statusMessage');

    // Add event listeners
    generateBtn.addEventListener('click', handleGenerateAnimation);

    // Log initialization
    console.log('Autonim_Poker Extension Initialized');
    updateStatus('Ready to generate animations', 'default');
});

/**
 * Handle Generate Animation button click
 */
function handleGenerateAnimation() {
    // Get values from inputs
    const type = animationType.value;
    const dur = parseFloat(duration.value);
    const count = parseInt(cardCount.value);

    // Validate inputs
    if (isNaN(dur) || dur <= 0) {
        updateStatus('Error: Invalid duration value', 'error');
        return;
    }

    if (isNaN(count) || count <= 0 || count > 52) {
        updateStatus('Error: Card count must be between 1 and 52', 'error');
        return;
    }

    // Update UI
    generateBtn.disabled = true;
    updateStatus(`Generating ${type} animation...`, 'processing');

    // Prepare data to send to ExtendScript
    const animationData = {
        type: type,
        duration: dur,
        cardCount: count
    };

    // Call ExtendScript function
    csInterface.evalScript(
        `generatePokerAnimation(${JSON.stringify(animationData)})`,
        function (result) {
            // Re-enable button
            generateBtn.disabled = false;

            // Handle result
            if (result === 'EvalScript error.') {
                updateStatus('Error: Failed to execute script', 'error');
            } else {
                try {
                    const response = JSON.parse(result);
                    if (response.success) {
                        updateStatus(response.message || 'Animation generated successfully!', 'success');
                    } else {
                        updateStatus(response.message || 'Failed to generate animation', 'error');
                    }
                } catch (e) {
                    updateStatus('Animation completed', 'success');
                }
            }
        }
    );
}

/**
 * Update status message with styling
 * @param {string} message - The message to display
 * @param {string} type - Message type: 'default', 'success', 'error', 'processing'
 */
function updateStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';

    if (type === 'success') {
        statusMessage.classList.add('success');
    } else if (type === 'error') {
        statusMessage.classList.add('error');
    } else if (type === 'processing') {
        statusMessage.classList.add('processing');
    }
}

/**
 * Get system information (example of using CSInterface methods)
 */
function getSystemInfo() {
    const osInfo = csInterface.getOSInformation();
    const appInfo = csInterface.hostEnvironment;
    console.log('OS:', osInfo);
    console.log('Host App:', appInfo);
}
