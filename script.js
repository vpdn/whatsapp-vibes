// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileSelectBtn = document.getElementById('file-select-btn');
const uploadSection = document.getElementById('upload-section');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const newAnalysisBtn = document.getElementById('new-analysis-btn');
const tryAgainBtn = document.getElementById('try-again-btn');
const exportModal = document.getElementById('export-modal');
const howToExportLink = document.getElementById('how-to-export');
const closeModalBtn = document.querySelector('.close-modal');

// Chart instance
let emojiChart = null;

// Event Listeners
fileSelectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
newAnalysisBtn.addEventListener('click', resetAnalysis);
tryAgainBtn.addEventListener('click', resetAnalysis);
howToExportLink.addEventListener('click', showExportModal);
closeModalBtn.addEventListener('click', hideExportModal);
window.addEventListener('click', (e) => {
    if (e.target === exportModal) hideExportModal();
});

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        processZipFile(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        processTextFile(file);
    } else {
        showError('Please upload a valid ZIP or TXT file');
    }
}

function handleDragOver(event) {
    event.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    
    const file = event.dataTransfer.files[0];
    if (!file) return;
    
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        processZipFile(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        processTextFile(file);
    } else {
        showError('Please upload a valid ZIP or TXT file');
    }
}

// Process ZIP file
async function processZipFile(file) {
    showLoading();
    
    try {
        // Import zip.js
        const zip = window.zip;
        
        // Create a reader for the ZIP file
        const reader = new zip.ZipReader(new zip.BlobReader(file));
        
        // Get all entries
        const entries = await reader.getEntries();
        
        // Find text files
        let chatContent = '';
        for (const entry of entries) {
            if (entry.filename.endsWith('.txt') && !entry.filename.startsWith('__MACOSX')) {
                // Extract text content
                const textWriter = new zip.TextWriter();
                chatContent = await entry.getData(textWriter);
                break;
            }
        }
        
        // Close the reader
        await reader.close();
        
        if (!chatContent) {
            throw new Error('No chat text file found in the archive');
        }
        
        // Parse and analyze emojis
        const emojiData = analyzeEmojis(chatContent);
        
        // Display results
        displayResults(emojiData);
        
    } catch (error) {
        console.error('Error processing file:', error);
        showError(error.message || 'Failed to process the ZIP file');
    }
}

// Process text file directly
async function processTextFile(file) {
    showLoading();
    
    try {
        const chatContent = await file.text();
        console.log('Processing text file:', file.name);
        
        if (!chatContent) {
            throw new Error('File is empty');
        }
        
        // Parse and analyze emojis
        const emojiData = analyzeEmojis(chatContent);
        
        // Display results
        displayResults(emojiData);
        
    } catch (error) {
        console.error('Error processing text file:', error);
        showError(error.message || 'Failed to process the text file');
    }
}

// Analyze emojis in chat content
function analyzeEmojis(chatContent) {
    console.log('Analyzing content length:', chatContent.length);
    console.log('First 200 chars:', chatContent.substring(0, 200));
    
    // Use Intl.Segmenter to properly segment text including complex emoji sequences
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(chatContent));
    
    // Extract only emoji segments using Unicode property escapes
    const emojiSegments = segments.filter(segment => 
        /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(segment.segment) &&
        !/^\d$/.test(segment.segment) // Exclude single digits
    );
    
    // Count emoji occurrences
    const emojiCount = {};
    emojiSegments.forEach(segment => {
        const emoji = segment.segment;
        emojiCount[emoji] = (emojiCount[emoji] || 0) + 1;
    });
    
    // Sort emojis by count - show all emojis
    const sortedEmojis = Object.entries(emojiCount)
        .sort((a, b) => b[1] - a[1]);
    
    console.log('Total emojis found:', emojiSegments.length);
    console.log('Unique emojis:', Object.keys(emojiCount).length);
    console.log('Top 5 emojis:', sortedEmojis.slice(0, 5));
    
    return {
        totalEmojis: emojiSegments.length,
        uniqueEmojis: Object.keys(emojiCount).length,
        topEmoji: sortedEmojis[0] || ['-', 0],
        emojiList: sortedEmojis
    };
}

// Display results
function displayResults(emojiData) {
    // Update stats
    document.getElementById('total-emojis').textContent = emojiData.totalEmojis.toLocaleString();
    document.getElementById('unique-emojis').textContent = emojiData.uniqueEmojis.toLocaleString();
    document.getElementById('top-emoji').textContent = emojiData.topEmoji[0];
    
    // Create chart with top 20 emojis
    createChart(emojiData.emojiList.slice(0, 20));
    
    // Create emoji list with all emojis
    createEmojiList(emojiData.emojiList);
    
    // Show results
    hideAll();
    resultsSection.classList.remove('hidden');
}

// Create chart using Chart.js
function createChart(emojiList) {
    const ctx = document.getElementById('emoji-chart').getContext('2d');
    
    // Destroy existing chart if any
    if (emojiChart) {
        emojiChart.destroy();
    }
    
    // Reset canvas styles for top 20 chart
    const canvas = document.getElementById('emoji-chart');
    const wrapper = document.querySelector('.chart-wrapper');
    canvas.style.width = '100%';
    wrapper.style.width = '100%';
    
    // Prepare data
    const labels = emojiList.map(item => item[0]);
    const data = emojiList.map(item => item[1]);
    
    // Create new chart
    emojiChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Count',
                data: data,
                backgroundColor: '#25D366',
                borderColor: '#128C7E',
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Top 20 Most Used Emojis',
                    font: {
                        size: 18,
                        weight: '600'
                    },
                    color: '#075E54'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 20
                        }
                    }
                }
            }
        }
    });
}

// Create emoji list display
function createEmojiList(emojiList) {
    const emojiListContainer = document.getElementById('emoji-list');
    emojiListContainer.innerHTML = `<h3 style="margin-bottom: 20px; color: #075E54;">All Emojis (${emojiList.length} total)</h3>`;
    
    const maxCount = emojiList[0] ? emojiList[0][1] : 1;
    
    emojiList.forEach((item, index) => {
        const [emoji, count] = item;
        const percentage = (count / maxCount) * 100;
        
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-weight: 600; color: #667781; min-width: 30px;">#${index + 1}</span>
                <span class="emoji-char">${emoji}</span>
            </div>
            <div class="emoji-count">
                <div class="count-bar" style="width: ${percentage}px;"></div>
                <span class="count-number">${count.toLocaleString()}</span>
            </div>
        `;
        
        emojiListContainer.appendChild(emojiItem);
    });
}

// UI state management
function showLoading() {
    hideAll();
    loadingSection.classList.remove('hidden');
}

function showError(message) {
    hideAll();
    errorMessage.textContent = message;
    errorSection.classList.remove('hidden');
}

function hideAll() {
    uploadSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}

function resetAnalysis() {
    hideAll();
    uploadSection.classList.remove('hidden');
    fileInput.value = '';
    if (emojiChart) {
        emojiChart.destroy();
        emojiChart = null;
    }
}

// Modal functions
function showExportModal(event) {
    event.preventDefault();
    exportModal.classList.remove('hidden');
}

function hideExportModal() {
    exportModal.classList.add('hidden');
}