// DOM Elements
const radioSingle = document.querySelector('input[value="single"]');
const radioSeparate = document.querySelector('input[value="separate"]');
const uploadContainer2 = document.getElementById('uploadContainer2');
const labelImage1 = document.getElementById('labelImage1');

const fileUpload1 = document.getElementById('fileUpload1');
const fileUpload2 = document.getElementById('fileUpload2');
const previewContainer1 = document.getElementById('previewContainer1');
const previewContainer2 = document.getElementById('previewContainer2');

const analyzeBtn = document.getElementById('analyzeBtn');
const generateProblemsBtn = document.getElementById('generateProblemsBtn');
const printProblemsBtn = document.getElementById('printProblemsBtn');
const printAnswersBtn = document.getElementById('printAnswersBtn');

const subjectSelect = document.getElementById('subjectSelect');
const gradeSelect = document.getElementById('gradeSelect');

// Sections
const uploadSection = document.getElementById('uploadSection');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const problemsLoadingSection = document.getElementById('problemsLoadingSection');
const problemsSection = document.getElementById('problemsSection');

// API Key Modal
const settingsBtn = document.getElementById('settingsBtn');
const apiKeyModal = document.getElementById('apiKeyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const apiKeyInput = document.getElementById('apiKeyInput');

// State
let base64Images1 = [];
let base64Images2 = [];
let currentAnalysis = '';

// Initialize
function init() {
    // API Key Handling
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }

    settingsBtn.addEventListener('click', () => apiKeyModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => apiKeyModal.classList.add('hidden'));
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        apiKeyModal.classList.add('hidden');
    });

    // UI Toggles
    radioSingle.addEventListener('change', updateUploadUI);
    radioSeparate.addEventListener('change', updateUploadUI);

    // File Uploads
    setupFileDropzone('dropzone1', fileUpload1, previewContainer1, (arr) => base64Images1 = arr);
    setupFileDropzone('dropzone2', fileUpload2, previewContainer2, (arr) => base64Images2 = arr);

    // Action Buttons
    analyzeBtn.addEventListener('click', analyzeTest);
    generateProblemsBtn.addEventListener('click', generateProblems);
    
    // Print Handlers
    printProblemsBtn.addEventListener('click', () => {
        document.body.classList.remove('printing-answers');
        window.print();
    });
    
    printAnswersBtn.addEventListener('click', () => {
        document.body.classList.add('printing-answers');
        // copy answers to print container
        document.getElementById('answersContentPrint').innerHTML = document.getElementById('answersContent').innerHTML;
        window.print();
        // reset after a tiny delay so the print dialog captures it
        setTimeout(() => document.body.classList.remove('printing-answers'), 1000);
    });
}

function updateUploadUI() {
    if (radioSingle.checked) {
        uploadContainer2.classList.add('hidden');
        labelImage1.textContent = '答案用紙（問題付き）';
        base64Images2 = []; // Clear second image
        previewContainer2.innerHTML = '';
        previewContainer2.classList.add('hidden');
    } else {
        uploadContainer2.classList.remove('hidden');
        labelImage1.textContent = '答案用紙（採点済み）';
    }
}

function setupFileDropzone(dropzoneId, inputEl, containerEl, callback) {
    const dropzone = document.getElementById(dropzoneId);

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('bg-indigo-50', 'border-indigo-400');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('bg-indigo-50', 'border-indigo-400');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('bg-indigo-50', 'border-indigo-400');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            inputEl.files = e.dataTransfer.files;
            handleFiles(e.dataTransfer.files, containerEl, callback);
        }
    });

    dropzone.addEventListener('click', (e) => {
        // Prevent triggering if clicking exactly on the label or input to avoid double triggers
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL' && e.target.closest('label') === null) {
            inputEl.click();
        }
    });

    inputEl.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files, containerEl, callback);
        }
    });
}

function handleFiles(files, containerEl, callback) {
    containerEl.innerHTML = '';
    let validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        alert('画像ファイルを選択してください。');
        containerEl.classList.add('hidden');
        return;
    }

    containerEl.classList.remove('hidden');
    let results = [];
    let loadedCount = 0;

    validFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            results[index] = base64; // preserve order
            
            const img = document.createElement('img');
            img.src = base64;
            img.className = 'h-24 w-auto object-cover rounded shadow-sm border border-gray-200';
            containerEl.appendChild(img);
            
            loadedCount++;
            if (loadedCount === validFiles.length) {
                callback(results);
            }
        };
        reader.readAsDataURL(file);
    });
}

// Gemini API Call
async function callGemini(messages) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        alert('右上の設定アイコンからGemini APIキーを設定してください。');
        return null;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: messages })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('API Error:', data);
            alert(`エラーが発生しました: ${data.error?.message || '不明なエラー'}`);
            return null;
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Fetch Error:', error);
        alert('通信エラーが発生しました。ネットワーク接続を確認してください。');
        return null;
    }
}

// 1. Analyze Test
async function analyzeTest() {
    if (base64Images1.length === 0) {
        alert('答案用紙の画像をアップロードしてください。');
        return;
    }
    if (radioSeparate.checked && base64Images2.length === 0) {
        alert('問題用紙の画像もアップロードしてください。');
        return;
    }

    const subject = subjectSelect.options[subjectSelect.selectedIndex].text;
    const grade = gradeSelect.options[gradeSelect.selectedIndex].text;

    // UI state
    analyzeBtn.disabled = true;
    uploadSection.style.opacity = '0.5';
    loadingSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    problemsSection.classList.add('hidden');

    // Build Payload
    const parts = [
        { text: `あなたはプロの塾講師です。生徒（${grade}・科目：${subject}）のテスト結果を分析してください。画像から問題と生徒の解答を読み取り、間違えた箇所を中心に「どの単元でつまずいているか」「どのようなミス（計算ミス、文法理解不足など）が多いか」を分析し、生徒への温かいアドバイスと弱点（3つ程度）をマークダウン形式でまとめてください。` }
    ];

    // Helper to strip data:image/jpeg;base64, prefix
    const getBase64Data = (dataUrl) => dataUrl.split(',')[1];
    const getMimeType = (dataUrl) => dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));

    base64Images1.forEach(img => {
        parts.push({
            inline_data: {
                mime_type: getMimeType(img),
                data: getBase64Data(img)
            }
        });
    });

    if (radioSeparate.checked) {
        base64Images2.forEach(img => {
            parts.push({
                inline_data: {
                    mime_type: getMimeType(img),
                    data: getBase64Data(img)
                }
            });
        });
    }

    const messages = [{ role: 'user', parts: parts }];
    
    const resultText = await callGemini(messages);

    // Reset UI
    analyzeBtn.disabled = false;
    uploadSection.style.opacity = '1';
    loadingSection.classList.add('hidden');

    if (resultText) {
        currentAnalysis = resultText;
        document.getElementById('analysisContent').innerHTML = marked.parse(resultText);
        resultSection.classList.remove('hidden');
        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 2. Generate Problems
async function generateProblems() {
    const subject = subjectSelect.options[subjectSelect.selectedIndex].text;
    const grade = gradeSelect.options[gradeSelect.selectedIndex].text;

    // UI state
    generateProblemsBtn.disabled = true;
    problemsLoadingSection.classList.remove('hidden');
    problemsSection.classList.add('hidden');

    const promptText = `
先ほどの分析結果に基づき、この生徒（${grade}・${subject}）の弱点を克服するための専用の「類似問題プリント」を作成してください。
以下のフォーマットに厳密に従って、マークダウンで出力してください。

# 構成
必ず「---」という水平線で問題部分と解答部分を区切ってください。

## 問題パート（水平線より上）
- 5〜10問程度の問題を作成してください。
- 問題文のみを記載し、解答は書かないでください。
- 生徒が印刷して書き込めるように、適度な余白を想定したレイアウトにしてください。

---

## 解答・解説パート（水平線より下）
- 各問題の「解答」と、なぜそうなるのかという丁寧な「解説」を記述してください。

==============================
【分析結果】
${currentAnalysis}
==============================
`;

    const messages = [
        { role: 'user', parts: [{ text: promptText }] }
    ];

    const resultText = await callGemini(messages);

    generateProblemsBtn.disabled = false;
    problemsLoadingSection.classList.add('hidden');

    if (resultText) {
        // Split by HR '---'
        const parts = resultText.split(/\n---\n|\n\*\*\*\n|\n___\n/);
        
        let problemsText = parts[0];
        let answersText = parts.length > 1 ? parts.slice(1).join('\n---\n') : "解答が見つかりませんでした。";

        // Fallback split if horizontal rule wasn't used properly by AI
        if (parts.length === 1) {
            const answerKeywords = ['## 解答', '# 解答', '【解答', '解答と解説'];
            for (let kw of answerKeywords) {
                const idx = resultText.indexOf(kw);
                if (idx !== -1) {
                    problemsText = resultText.substring(0, idx);
                    answersText = resultText.substring(idx);
                    break;
                }
            }
        }

        document.getElementById('problemsContent').innerHTML = marked.parse(problemsText);
        document.getElementById('answersContent').innerHTML = marked.parse(answersText);
        
        problemsSection.classList.remove('hidden');
        problemsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
