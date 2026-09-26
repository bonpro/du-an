    const GEMINI_API_KEY = 'AQ.Ab8RN6KaFoCMNvJbpoU7fAV_hxPRSbMI023uSy5zDJ5zXfy7fw';

    const video = document.getElementById('webcam');
    const imagePreview = document.getElementById('image-preview');
    const placeholder = document.getElementById('screen-placeholder');
    const scanLine = document.getElementById('scan-line');
    const startBtn = document.getElementById('start-btn');
    const captureBtn = document.getElementById('capture-btn');
    const fileInput = document.getElementById('file-input');
    const resultContent = document.getElementById('result-content');
    const loading = document.getElementById('loading');
    const userQuestion = document.getElementById('user-question');
    const askBtn = document.getElementById('ask-btn');
    const micBtn = document.getElementById('mic-btn');
    const voiceStatus = document.getElementById('voice-status');

    let currentBase64Image = null;

    // ==========================================
    // 1. BỘ PHÁT GIỌNG NÓI TIẾNG VIỆT CHUẨN
    // ==========================================
    function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Dừng câu nói trước đó

    // Làm sạch văn bản để giọng đọc mượt mà
    let cleanText = text
        .replace(/\(.*?\)/g, '') 
        .replace(/[*#_\-`]/g, '') 
        .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));
    if (viVoice) utterance.voice = viVoice;

    window.speechSynthesis.speak(utterance);
    }

    if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
    }

    // ==========================================
    // 2. BỘ NHẬN DIỆN GIỌNG NÓI NGƯỜI DÙNG (STT)
    // ==========================================
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        micBtn.classList.add('recording');
        micBtn.innerText = '🔴 ĐANG NGHE...';
        if (voiceStatus) voiceStatus.innerText = 'Đang lắng nghe câu hỏi của bạn...';
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userQuestion.value = transcript;
        if (voiceStatus) voiceStatus.innerText = `Đã nghe: "${transcript}"`;
        handleUserQuestion();
    };

    recognition.onerror = (event) => {
        if (voiceStatus) voiceStatus.innerText = 'Lỗi nhận diện giọng nói: ' + event.error;
        stopMic();
    };

    recognition.onend = () => {
        stopMic();
    };
    } else {
    if (micBtn) micBtn.style.display = 'none';
    }

    function stopMic() {
    if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.innerText = '🎤 NÓI';
    }
    }

    if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            recognition.stop();
        }
        }
    });
    }

    // ==========================================
    // 3. XỬ LÝ CAMERA & TẢI ẢNH
    // ==========================================
    startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = stream;
        video.style.display = 'block';
        imagePreview.style.display = 'none';
        placeholder.style.display = 'none';
        captureBtn.disabled = false;
        startBtn.innerText = 'CAMERA ACTIVE';
    } catch (err) {
        alert('Không thể mở Camera: ' + err.message);
    }
    });

    function getCameraBase64() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    imagePreview.src = canvas.toDataURL('image/jpeg');
    imagePreview.style.display = 'block';
    video.style.display = 'none';
    
    return canvas.toDataURL('image/jpeg').split(',')[1];
    }

    captureBtn.addEventListener('click', () => {
    currentBase64Image = getCameraBase64();
    processScanning(currentBase64Image);
    });

    fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
        imagePreview.src = event.target.result;
        imagePreview.style.display = 'block';
        video.style.display = 'none';
        placeholder.style.display = 'none';
        
        const base64Raw = event.target.result;
        currentBase64Image = base64Raw.includes(',') ? base64Raw.split(',')[1] : base64Raw;
        
        processScanning(currentBase64Image);
        };
        reader.readAsDataURL(file);
    }
    });

    // ==========================================
    // 4. QUÉT ẢNH BAN ĐẦU & NÓI THÔNG BÁO
    // ==========================================
    async function processScanning(base64Data) {
    scanLine.style.display = 'block';
    loading.style.display = 'flex';
    resultContent.innerHTML = '';
    toggleInputs(false);

    const quickPrompt = "Xác định tên tiếng Việt chính xác của đối tượng trong ảnh. Trả lời cực kỳ ngắn gọn dưới 15 từ.";
    
    // Cập nhật model thành gemini-3.8-flash chuẩn
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
            role: "user",
            parts: [
                { text: quickPrompt },
                { inline_data: { mime_type: "image/jpeg", data: base64Data } }
            ]
            }]
        })
        });

        const data = await response.json();

        if (data.error) {
        resultContent.innerHTML = `<p style="color:var(--danger-glow)"><strong>Lỗi Google API:</strong> ${data.error.message}</p>`;
        return;
        }

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const resultText = data.candidates[0].content.parts[0].text.trim();
        
        resultContent.innerHTML = marked.parse(`### ĐÃ NHẬN DIỆN THÀNH CÔNG\n\n**Đối tượng:** ${resultText}\n\n*Hệ thống đã sẵn sàng lắng nghe câu hỏi của bạn.*`);

        speakText("Tôi đã quét xong. Bạn cần hỏi gì về hình ảnh này?");

        toggleInputs(true);
        } else {
        resultContent.innerHTML = '<p style="color:var(--danger-glow)">Không thể nhận diện hình ảnh. Vui lòng tải lại ảnh.</p>';
        }
    } catch (err) {
        resultContent.innerHTML = `<p style="color:var(--danger-glow)">Lỗi kết nối: ${err.message}</p>`;
    } finally {
        scanLine.style.display = 'none';
        loading.style.display = 'none';
    }
    }

    // ==========================================
    // 5. TRẢ LỜI CÂU HỎI BẰNG GIỌNG NÓI CỦA AI
    // ==========================================
    async function handleUserQuestion() {
    const question = userQuestion.value.trim();
    if (!question || !currentBase64Image) return;

    loading.style.display = 'flex';
    toggleInputs(false);

    // Cập nhật model thành gemini-3.8-flash chuẩn
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
            role: "user",
            parts: [
                { text: `Dựa vào hình ảnh này, trả lời câu hỏi sau bằng tiếng Việt tự nhiên, cô đọng để đọc ra loa (dưới 60 từ): ${question}` },
                { inline_data: { mime_type: "image/jpeg", data: currentBase64Image } }
            ]
            }]
        })
        });

        const data = await response.json();

        if (data.error) {
        alert("Lỗi API: " + data.error.message);
        return;
        }

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const answer = data.candidates[0].content.parts[0].text;
        
        resultContent.innerHTML += marked.parse(`\n---\n**🗣️ Hỏi:** ${question}\n\n**🤖 Trả lời:** ${answer}`);
        resultContent.scrollTop = resultContent.scrollHeight;

        speakText(answer);
        
        userQuestion.value = '';
        }
    } catch (err) {
        alert("Lỗi khi gửi câu hỏi: " + err.message);
    } finally {
        loading.style.display = 'none';
        toggleInputs(true);
    }
    }

    function toggleInputs(enable) {
    userQuestion.disabled = !enable;
    askBtn.disabled = !enable;
    if (micBtn) micBtn.disabled = !enable;
    }

    askBtn.addEventListener('click', handleUserQuestion);
    userQuestion.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserQuestion();
    });