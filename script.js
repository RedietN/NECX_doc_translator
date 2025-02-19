// DOM Elements
const uploadScreen = document.getElementById('uploadScreen');
const viewScreen = document.getElementById('viewScreen');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const backButton = document.getElementById('backButton');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const lastModified = document.getElementById('lastModified');
const documentViewer = document.getElementById('documentViewer');
const languageButton = document.getElementById('languageButton');
const languageDropdown = document.getElementById('languageDropdown');
const selectedLanguage = document.getElementById('selectedLanguage');
const translateButton = document.getElementById('translateButton');
const downloadButton = document.getElementById('downloadButton');
const downloadText = document.getElementById('downloadText');

// State
let currentDocument = null;
let isTranslating = false;
let downloadStatus = 'idle';
let langDetected = "";

// Initialize
const list_of_languages = {
    "English": "en",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Italian": "it",
    "Portuguese": "pt"
};

// Update language dropdown excluding selected and detected languages
function updateLanguageDropdown() {
    // Clear existing options
    languageDropdown.innerHTML = '';
    
    // Get current selected language
    const currentSelected = selectedLanguage.textContent;
    
    // Add all languages except the detected and selected ones
    Object.keys(list_of_languages).forEach(lang => {
        if (lang !== currentSelected && list_of_languages[lang] !== langDetected) {
            const option = document.createElement('button');
            option.classList.add('language-option');
            option.dataset.language = lang;
            option.textContent = lang;
            languageDropdown.appendChild(option);
        }
    });
}

function detectLang(text) {
    for (const lang in list_of_languages) {
        const code = list_of_languages[lang];
        if (text === lang) {
            return code;
        } else if (text === code) {
            return lang;
        }
    }
    return "Unknown";
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

async function detectLanguage(text) {
    try {
        const response = await fetch('https://necx-translation.blackrock-67f1a185.eastus.azurecontainerapps.io/detect', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `q=${text}`
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        const language = data[0]?.language || "Unknown";
        langDetected = language;
        
        // Update dropdown with available languages
        updateLanguageDropdown();
        
        console.log("Detected Language:", language);
        return language;
    } catch (error) {
        console.error("Error detecting language:", error);
    }
}

// Event Handlers
async function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
        dropZone.classList.add('drag-active');
    } else if (e.type === "dragleave") {
        dropZone.classList.remove('drag-active');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-active');
    
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith('.docx')) {
        await processFile(file);
    }
}

async function processFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        currentDocument = {
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            content: result.value,
            file: new File([file], file.name, {
                type: file.type,
                lastModified: file.lastModified
            })
        };
        
        updateViewScreen();
        switchToViewScreen();
    } catch (error) {
        console.error('Error processing document:', error);
        alert('Error processing document. Please try again.');
    }
}

function updateViewScreen() {
    fileName.textContent = currentDocument.name;
    fileSize.textContent = `Size: ${formatFileSize(currentDocument.size)}`;
    lastModified.textContent = `Last Modified: ${formatDate(currentDocument.lastModified)}`;
    documentViewer.innerHTML = currentDocument.content;

    const documentText = documentViewer.textContent || '';
    console.log('Document Text:', documentText);
    detectLanguage(documentText);
}

function switchToViewScreen() {
    uploadScreen.classList.add('hidden');
    viewScreen.classList.remove('hidden');
}

function switchToUploadScreen() {
    viewScreen.classList.add('hidden');
    uploadScreen.classList.remove('hidden');
    currentDocument = null;
    documentViewer.innerHTML = '';
    selectedLanguage.textContent = 'Select a language';
    translateButton.disabled = true;
    langDetected = "";
}

async function translateFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', langDetected);
        formData.append('target', detectLang(selectedLanguage.textContent));
        
        const response = await fetch('https://necx-translation.blackrock-67f1a185.eastus.azurecontainerapps.io/translate_file', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data["translatedFileUrl"].replace("http://", "https://");;
    } catch (error) {
        console.error('Error translating file:', error);
        throw error;
    }
}

async function handleDownload() {
    if (downloadStatus === 'downloading' || !currentDocument?.file) return;
    
    downloadStatus = 'downloading';
    downloadButton.disabled = true;
    downloadButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Downloading...
    `;
    
    try {
        const blob = new Blob([await currentDocument.file.arrayBuffer()], 
            { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = currentDocument.name;
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        downloadStatus = 'success';
        downloadButton.classList.add('success');
        downloadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Downloaded!
        `;
        
        setTimeout(() => {
            downloadStatus = 'idle';
            downloadButton.disabled = false;
            downloadButton.classList.remove('success');
            downloadButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
            `;
        }, 2000);
    } catch (error) {
        console.error('Error downloading file:', error);
        downloadStatus = 'error';
        downloadButton.classList.add('error');
        downloadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Download Failed
        `;
        
        setTimeout(() => {
            downloadStatus = 'idle';
            downloadButton.disabled = false;
            downloadButton.classList.remove('error');
            downloadButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
            `;
        }, 3000);
    }
}

async function handleTranslate() {
    if (isTranslating) return;
    
    isTranslating = true;
    const originalText = translateButton.innerHTML;
    translateButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="loading-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Translating...
    `;
    translateButton.disabled = true;

    let translated_doc_url = await translateFile(currentDocument.file);
    console.log("Translated data: " + translated_doc_url);
    try {
        // Use a simple fetch without extra headers or mode options
        const response = await fetch(translated_doc_url,{
            method: 'GET',
            // mode: 'no-cors',
            // headers: {
            //     'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            // }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Directly obtain the arrayBuffer from the response
        const arrayBuffer = await response.arrayBuffer();
        
        // Convert the ArrayBuffer to HTML using Mammoth.js
        const result = await mammoth.convertToHtml({ arrayBuffer });
        
        // Determine target language from UI (e.g., "es" for Spanish)
        const targetLang = detectLang(selectedLanguage.textContent);
        
        // Update the current document with the translated content and new file
        currentDocument = {
            name: currentDocument.name.replace('.docx', `_${targetLang}.docx`),
            size: arrayBuffer.byteLength,
            lastModified: Date.now(),
            content: result.value,
            file: new File([arrayBuffer], currentDocument.name.replace('.docx', `_${targetLang}.docx`), {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                lastModified: Date.now()
            })
        };

        // Refresh the UI with the new document content
        updateViewScreen();
    } catch (error) {
        console.error('Error fetching translated document:', error);
        alert(`Error loading translated document: ${error.message}. Please try again.`);
    } finally {
        isTranslating = false;
        translateButton.innerHTML = originalText;
        translateButton.disabled = false;
    }
}

// Event Listeners
dropZone.addEventListener('dragenter', handleDrag);
dropZone.addEventListener('dragover', handleDrag);
dropZone.addEventListener('dragleave', handleDrag);
dropZone.addEventListener('drop', handleDrop);

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
        await processFile(file);
    }
});

backButton.addEventListener('click', switchToUploadScreen);

languageButton.addEventListener('click', () => {
    updateLanguageDropdown();
    languageDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!languageButton.contains(e.target)) {
        languageDropdown.classList.add('hidden');
    }
});

languageDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.language-option');
    if (option) {
        selectedLanguage.textContent = option.dataset.language;
        languageDropdown.classList.add('hidden');
        translateButton.disabled = false;
        updateLanguageDropdown();
    }
});

translateButton.addEventListener('click', handleTranslate);
downloadButton.addEventListener('click', handleDownload);