let currentSet = null, currentIdx = 0, selectedAnswers = {};
let hiddenChoices = {};
let transcriptVisible = {};
let currentMode = 'mouse';
let activeColor  = '#ef4444';
let currentZoomElementId = null;

const toolSettings = {
    pen:         { size: 3,  opacity: 1.00 },
    highlighter: { size: 14, opacity: 0.35 },
    eraser:      { size: 18 }
};

let allStrokes = [];
let undoStack = [];
let redoStack = [];

let isDrawing  = false;
let currentPath = [];
let activeCanvas = null;

let zoomScale = 1, panX = 0, panY = 0;
let isPanning = false, panStartX = 0, panStartY = 0;
let spaceHeld = false;
let rightClickPanning = false;
let rightClickStartX = 0, rightClickStartY = 0;
let pinchStartDistance = 0, pinchStartScale = 1;

const zoomOverlay = document.getElementById('zoom-overlay');
const viewport    = document.getElementById('zoom-viewport');
const zoomCanvas  = document.getElementById('zoomCanvas');

let examScreens = [];
let explanationVisible = {};
let currentLayoutMode = 'vertical';
let carouselImages = [];
let previousTool = 'mouse';


function getNormalizedId(id) {
    if (!id) return '';
    return id.replace(/^img-\d+-/, 'img-');
}

window.onload = () => {
    renderExamDashboard();
    if (window.lucide) { lucide.createIcons(); }

    const zCvs = document.getElementById('zoomCanvas');
    if (zCvs) setupCanvasDrawing(zCvs);

    // === ป้องกันการคัดลอกและลากเมาส์คลุม ===
    // ปิด context menu (คลิกขวา)
    document.addEventListener('contextmenu', e => e.preventDefault());
    // ปิด copy / cut / paste
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('cut', e => e.preventDefault());
    document.addEventListener('paste', e => e.preventDefault());
    // ปิด drag ทั้งหมด
    document.addEventListener('dragstart', e => e.preventDefault());
    // ปิด text selection ด้วย CSS
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.MozUserSelect = 'none';
    document.body.style.msUserSelect = 'none';

    initViewportControls();

    document.getElementById('audio-player').addEventListener('ended', () => {
        resetAudioPlayer();
    });

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape' || e.code === 'Escape') setTool('mouse');
        if (e.code === 'Digit1') setTool('pen');
        if (e.code === 'Digit2') setTool('highlighter');
        if (e.code === 'Digit3') setTool('eraser');
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undo(); }
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); }
    });

        window.addEventListener('resize', () => {
            resizeAllActiveCanvases();
        });

        setupJumpSelect();


};

function startExam(setId) {
    console.log('startExam called with:', setId);
    currentSet = window.targetExamData.find(p => p.setId === setId) || window.targetExamData[0];
    console.log('currentSet:', currentSet);
    currentIdx = 0;
    selectedAnswers = {};
    hiddenChoices = {};
    transcriptVisible = {};
    explanationVisible = {};
    undoStack = [];
    redoStack = [];

    examScreens = [];
    let currentGroup = null;
    let currentScreen = [];

    currentSet.questions.forEach(q => {
        if (q.groupId) {
            if (currentGroup === q.groupId) {
                currentScreen.push(q);
            } else {
                if (currentScreen.length > 0) examScreens.push(currentScreen);
                currentGroup = q.groupId;
                currentScreen = [q];
            }
        } else {
            if (currentScreen.length > 0) examScreens.push(currentScreen);
            currentGroup = null;
            currentScreen = [q];
            examScreens.push(currentScreen);
            currentScreen = [];
        }
    });
    if (currentScreen.length > 0) examScreens.push(currentScreen);

        console.log('examScreens:', examScreens);
        loadStrokesFromStorage();
        document.getElementById('home-screen').classList.add('hidden');
        document.getElementById('tutor-screen').classList.remove('hidden');
        document.getElementById('toolbar').classList.remove('hidden');
        const layoutToggle = document.getElementById('layout-toggle'); if (layoutToggle) layoutToggle.classList.remove('hidden');
        document.body.className = "bg-slate-100 text-slate-800 min-h-screen flex flex-col justify-center items-center overflow-hidden font-sans antialiased";

        resetAudioPlayer();
        renderQuestion();
        if (window.lucide) { lucide.createIcons(); }
}
function renderExamDashboard() {
    const grid = document.getElementById('exam-sets-grid');
    grid.innerHTML = '';
    const data = (typeof examPackages !== 'undefined') ? examPackages
                 : (typeof examData   !== 'undefined') ? [{ setId:'default', setTitle:'TOEIC Practice Set', setCover:'', questions: examData.questions }]
                 : null;
    if (!data) { grid.innerHTML = `<div class="text-white col-span-3 text-center bg-slate-800 p-6 rounded-xl border border-slate-700">ไม่พบข้อมูลชุดข้อสอบ (examPackages)</div>`; return; }
    window.targetExamData = data;
    data.forEach(pkg => {
        const card = document.createElement('div');
        card.className = "bg-slate-800 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition flex flex-col justify-between";

        card.innerHTML = `
            <img src="${pkg.setCover||'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600'}" class="w-full h-44 object-cover">
            <div class="p-5 flex-1 flex flex-col justify-between">
                <div><h3 class="text-lg font-bold text-white mb-2">${pkg.setTitle}</h3>
                <p class="text-slate-400 text-xs mb-4">จำนวน: ${pkg.questions.length} ข้อ</p></div>
                <button onclick="startExam('${pkg.setId}')" class="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 group">
                    <span>Select</span>
                    <i data-lucide="arrow-right" class="w-4 h-4 transition-transform group-hover:translate-x-1"></i>
                </button>
            </div>`;
        grid.appendChild(card);
    });
}
function toggleAudio() {
    const audio = document.getElementById('audio-player');
    const icon = document.getElementById('audio-icon');
    const status = document.getElementById('audio-status');

    if (audio.paused) {
        audio.play();
        icon.setAttribute('data-lucide', 'pause');
        status.innerText = "Playing...";
    } else {
        audio.pause();
        icon.setAttribute('data-lucide', 'play');
        status.innerText = "Paused";
    }
    lucide.createIcons();
}
function resetAudioPlayer() {
    const audio = document.getElementById('audio-player');
    const icon = document.getElementById('audio-icon');
    const status = document.getElementById('audio-status');
    audio.pause();
    audio.currentTime = 0;
    icon.setAttribute('data-lucide', 'play');
    status.innerText = "Click to Play";
    lucide.createIcons();
}
function saveStrokesToStorage() {
    if (currentSet) {
        localStorage.setItem(`toeic_strokes_${currentSet.setId}`, JSON.stringify(allStrokes));
    }
}
function loadStrokesFromStorage() {
    if (currentSet) {
        const saved = localStorage.getItem(`toeic_strokes_${currentSet.setId}`);
        allStrokes = saved ? JSON.parse(saved) : [];
    }
}
function goHome() {
    document.getElementById('tutor-screen').classList.add('hidden');
    document.getElementById('toolbar').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
    const layoutToggle2 = document.getElementById('layout-toggle'); if (layoutToggle2) layoutToggle2.classList.add('hidden');
    document.body.className = "bg-slate-900 text-slate-800 min-h-screen flex flex-col justify-center items-center overflow-hidden font-sans antialiased";
    closeZoom();
    resetAudioPlayer();
    if (window.lucide) { lucide.createIcons(); }
    }

function getAutoLayoutMode(questionCount) {
    return questionCount <= 1 ? 'vertical' : 'horizontal';
}
function updateLayoutMode() {
    const screenQuestions = examScreens[currentIdx] || [];
    const numQuestions = screenQuestions.length;

    const hasImages = screenQuestions.some(q => q.images && q.images.length > 0);

    if (!hasImages) {
        currentLayoutMode = 'horizontal';
    } else {
        currentLayoutMode = numQuestions <= 1 ? 'vertical' : 'horizontal';
    }

    const tutorScreen = document.getElementById('tutor-screen');
    tutorScreen.classList.remove('layout-vertical', 'layout-horizontal');
    tutorScreen.classList.add(`layout-${currentLayoutMode}`);
}

function setTool(mode) {
    currentMode = mode;

    document.querySelectorAll('.tool-btn').forEach(b => {
        b.className = 'tool-btn bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-full text-xs transition flex items-center gap-1.5';
    });
    const activeBtn = document.getElementById(`tool-${mode}`);
    if (activeBtn) activeBtn.className = 'tool-btn bg-blue-600 text-white font-bold px-3 py-1.5 rounded-full text-xs transition shadow-md shadow-blue-500/30 flex items-center gap-1.5';

    const sc = document.getElementById('stroke-controls');
    const cc = document.getElementById('color-controls-container'); // แผงควบคุมสีที่เราตั้ง ID ไว้ใน HTML
    const opacityWrap = document.getElementById('opacity-wrap');
    const sizeSlider = document.getElementById('size-slider');
    const opacitySlider = document.getElementById('opacity-slider');

    if (sc && sizeSlider && opacitySlider) {
        sc.style.opacity = '1';
        sc.style.pointerEvents = 'auto';
        sizeSlider.disabled = false;
        opacitySlider.disabled = false;
        if (opacityWrap) { opacityWrap.style.opacity = '1'; }
        if (cc) { cc.style.opacity = '1'; cc.style.pointerEvents = 'auto'; }

        if (mode === 'mouse') {
            sc.style.opacity = '0.35';
            sc.style.pointerEvents = 'none';
            sizeSlider.disabled = true;
            opacitySlider.disabled = true;
            if (cc) { cc.style.opacity = '0.35'; cc.style.pointerEvents = 'none'; }
        } else {
            const s = toolSettings[mode];
            sizeSlider.value = s.size;
            document.getElementById('size-val').innerText = s.size;

            if (mode === 'eraser') {
                opacitySlider.disabled = true;
                if (opacityWrap) { opacityWrap.style.opacity = '0.35'; }
                if (cc) { cc.style.opacity = '0.35'; cc.style.pointerEvents = 'none'; }
            } else {
                opacitySlider.value = Math.round(s.opacity * 100);
                document.getElementById('opacity-val').innerText = Math.round(s.opacity * 100) + '%';
            }
        }
    }

        updateCanvasesPointerEvents();
    if (window.lucide) { lucide.createIcons(); }
}
function updateCanvasesPointerEvents() {
    const drawingCanvas = document.getElementById('drawing-canvas');
    const customCursor = document.getElementById('canvas-custom-cursor');

    if (drawingCanvas) {
        drawingCanvas.style.pointerEvents = currentMode === 'mouse' ? 'none' : 'auto';
    }

    document.querySelectorAll('.gallery-canvas').forEach(cvs => {
        cvs.style.pointerEvents = currentMode === 'mouse' ? 'none' : 'auto';
    });

    // Answer canvas: รับ pointer events เมื่ออยู่ในโหมดวาด และแสดงอยู่
    document.querySelectorAll('.answer-canvas').forEach(cvs => {
        const isHidden = cvs.classList.contains('hidden');
        cvs.style.pointerEvents = (currentMode === 'mouse' || isHidden) ? 'none' : 'auto';
    });

    // Transcript canvas: รับ pointer events เมื่ออยู่ในโหมดวาด และแสดงอยู่
    document.querySelectorAll('.transcript-canvas').forEach(cvs => {
        const isHidden = cvs.classList.contains('hidden');
        const newPE = (currentMode === 'mouse' || isHidden) ? 'none' : 'auto';
        console.log('[updateCanvasesPointerEvents] transcript-canvas:', cvs.id, 'isHidden:', isHidden, 'currentMode:', currentMode, 'pointerEvents:', newPE);
        cvs.style.pointerEvents = newPE;
    });

    // Options canvas: รับ pointer events เมื่ออยู่ในโหมดวาด และแสดงอยู่
    document.querySelectorAll('.options-canvas').forEach(cvs => {
        const isHidden = cvs.classList.contains('hidden');
        cvs.style.pointerEvents = (currentMode === 'mouse' || isHidden) ? 'none' : 'auto';
    });

    // Global transcript canvas
    const globalTranscriptCanvas = document.getElementById('global-transcript-canvas');
    if (globalTranscriptCanvas) {
        const isHidden = globalTranscriptCanvas.classList.contains('hidden');
        globalTranscriptCanvas.style.pointerEvents = (currentMode === 'mouse' || isHidden) ? 'none' : 'auto';
    }

    const zoomCanv = document.getElementById('zoomCanvas');
    if (zoomCanv && !zoomOverlay.classList.contains('hidden')) {
        zoomCanv.style.pointerEvents = currentMode === 'mouse' ? 'none' : 'auto';
    }

    if (customCursor) {
        document.removeEventListener('mousemove', handleCustomCursorMove);
        if (currentMode !== 'mouse') {
            document.body.classList.add('drawing-mode');
            document.addEventListener('mousemove', handleCustomCursorMove);

            document.querySelectorAll('canvas').forEach(c => {
                c.style.cursor = 'none';
            });
        } else {
            document.body.classList.remove('drawing-mode');
            customCursor.classList.add('hidden');

            document.querySelectorAll('canvas').forEach(c => {
                c.style.cursor = '';
            });
        }
    }
}
function onSizeChange(v) {
    const n = parseInt(v);
    document.getElementById('size-val').innerText = n;
    if (toolSettings[currentMode]) toolSettings[currentMode].size = n;
}
function onOpacityChange(v) {
    const n = parseInt(v);
    document.getElementById('opacity-val').innerText = n + '%';
    if (toolSettings[currentMode]) toolSettings[currentMode].opacity = n / 100;
}
function positionCustomCursor(clientX, clientY, onCanvas) {
    const customCursor = document.getElementById('canvas-custom-cursor');
    if (!customCursor || currentMode === 'mouse') {
        if (customCursor) customCursor.classList.add('hidden');
        return;
    }

    if (onCanvas || isDrawing) {
        const s = toolSettings[currentMode] || { size: 3, opacity: 1 };

        if (currentMode === 'highlighter') {
            customCursor.style.backgroundColor = activeColor;
            customCursor.style.opacity = s.opacity || 0.35;
        } else if (currentMode === 'eraser') {
            customCursor.style.backgroundColor = "rgba(180, 180, 180, 0.45)";
            customCursor.style.opacity = "1";
        } else {
            customCursor.style.backgroundColor = activeColor;
            customCursor.style.opacity = s.opacity || 1;
        }
        customCursor.style.border = "none";

        const actualSize = (currentMode === 'highlighter') ? s.size * 2.2 : s.size;
        const displaySize = Math.max(actualSize, 6);

        customCursor.style.width  = `${displaySize}px`;
        customCursor.style.height = `${displaySize}px`;
        customCursor.style.left   = `${clientX}px`;
        customCursor.style.top    = `${clientY}px`;
        customCursor.classList.remove('hidden');
    } else {
        customCursor.classList.add('hidden');
    }
}
function handleCustomCursorMove(e) {
    const onCanvas = e.target && e.target.tagName.toLowerCase() === 'canvas';
    positionCustomCursor(e.clientX, e.clientY, onCanvas);
}
function selectColor(color, el) {
    activeColor = color;
    document.querySelectorAll('.color-dot').forEach(d => { d.classList.remove('scale-110','border-white','border-2'); d.style.borderColor='transparent'; });
    el.classList.add('scale-110','border-white','border-2');
}
function selectCustomColor(color) {
    activeColor = color;
    document.querySelectorAll('.color-dot').forEach(d => { d.classList.remove('scale-110','border-white','border-2'); d.style.borderColor='transparent'; });
}
function syncGalleryCanvasToImage(canvas) {
    if (!canvas) return null;

    const img = canvas.parentElement?.querySelector('img');
    if (!img) return null;

    const css = getCssLayoutRect(img);
    const width = css.width;
    const height = css.height;
    if (width <= 0 || height <= 0) return null;

    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.round(width * dpr);
    const nextHeight = Math.round(height * dpr);

    // Calculate img offset within parent in CSS layout pixels (undoing ancestor transforms)
    // Parent uses flex centering → img may not start at (0,0)
    const parentRect = canvas.parentElement.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Compute cumulative transform scale (same logic as getCssLayoutRect)
    let sx = 1, sy = 1;
    const zc = img.closest('#zoomable-content');
    if (zc && zc.clientWidth > 0 && zc.clientHeight > 0) {
        const zcr = zc.getBoundingClientRect();
        sx = Math.max(zcr.width / zc.clientWidth, 0.01);
        sy = Math.max(zcr.height / zc.clientHeight, 0.01);
    }
    const ztc = img.closest('#zoom-transform-container');
    if (ztc && ztc.clientWidth > 0 && ztc.clientHeight > 0) {
        const ztcr = ztc.getBoundingClientRect();
        sx *= Math.max(ztcr.width / ztc.clientWidth, 0.01);
        sy *= Math.max(ztcr.height / ztc.clientHeight, 0.01);
    }

    const cssLeft = (imgRect.left - parentRect.left) / sx;
    const cssTop = (imgRect.top - parentRect.top) / sy;

    if (canvas.width !== nextWidth || canvas.height !== nextHeight || canvas.style.width !== width + 'px' || canvas.style.height !== height + 'px' || canvas.style.left !== cssLeft + 'px' || canvas.style.top !== cssTop + 'px') {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        canvas.style.left = cssLeft + 'px';
        canvas.style.top = cssTop + 'px';
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { width, height };
}

function observeGalleryCanvasResize(canvas) {
    const img = canvas.parentElement?.querySelector('img');
    if (!img || img.__galleryCanvasObserver) return;

    const observer = new ResizeObserver(() => {
        syncGalleryCanvasToImage(canvas);
        redrawCanvas(canvas);
    });

    observer.observe(img);
    img.__galleryCanvasObserver = observer;
}

function resizeAllActiveCanvases() {
    const dpr = window.devicePixelRatio || 1;

    const galleryCanvases = document.querySelectorAll('.gallery-canvas');
    galleryCanvases.forEach(c => {
        if (c.id === 'zoomCanvas') return; // zoom canvas uses width:100% CSS, handled separately below
        const result = syncGalleryCanvasToImage(c);
        if (result) {
            redrawCanvas(c);
        }
    });

    // Resize options-canvas ตาม container ใหม่
    document.querySelectorAll('.options-canvas').forEach(cvs => {
        const container = cvs.parentElement.querySelector('[id^="options-container-"]');
        if (container && !container.classList.contains('hidden')) {
            const rect = getCssLayoutRect(container);
            const w = rect.width;
            const h = rect.height;
            if (w > 0 && h > 0) {
                cvs.width = Math.round(w * dpr);
                cvs.height = Math.round(h * dpr);
                cvs.style.width = w + 'px';
                cvs.style.height = h + 'px';
                const ctx = cvs.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                redrawCanvas(cvs);
            }
        }
    });

    // Resize answer-canvas ตาม box ใหม่
    document.querySelectorAll('.answer-canvas').forEach(cvs => {
        const box = cvs.parentElement.querySelector('[id^="explanation-box-"]');
        if (box && !box.classList.contains('hidden')) {
            const rect = getCssLayoutRect(box);
            const w = rect.width;
            const h = rect.height;
            if (w > 0 && h > 0) {
                cvs.width = Math.round(w * dpr);
                cvs.height = Math.round(h * dpr);
                cvs.style.width = w + 'px';
                cvs.style.height = h + 'px';
                const ctx = cvs.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                redrawCanvas(cvs);
            }
        }
    });

document.querySelectorAll('.transcript-canvas').forEach(cvs => {
        const box = cvs.parentElement.querySelector('[id^="transcript-box-"]');
        if (box && !box.classList.contains('hidden')) {
            const rect = getCssLayoutRect(box);
            const w = rect.width;
            const h = rect.height;
            if (w > 0 && h > 0) {
                cvs.width = Math.round(w * dpr);
                cvs.height = Math.round(h * dpr);
                cvs.style.width = w + 'px';
                cvs.style.height = h + 'px';
                const ctx = cvs.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                redrawCanvas(cvs);
            }
        }
    });

    // Global transcript canvas: size from parent (.relative.mt-3), not from box
    const globalTranscriptCanvas = document.getElementById('global-transcript-canvas');
    if (globalTranscriptCanvas && !globalTranscriptCanvas.classList.contains('hidden')) {
        const parent = globalTranscriptCanvas.parentElement;
        if (parent) {
            const rect = getCssLayoutRect(parent);
            const w = rect.width;
            const h = rect.height;
            if (w > 0 && h > 0) {
                globalTranscriptCanvas.width = Math.round(w * dpr);
                globalTranscriptCanvas.height = Math.round(h * dpr);
                globalTranscriptCanvas.style.width = w + 'px';
                globalTranscriptCanvas.style.height = h + 'px';
                const ctx = globalTranscriptCanvas.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                redrawCanvas(globalTranscriptCanvas);
            }
        }
    }

    // Zoom canvas: reset buffer to match current CSS display size × dpr
    if (!zoomOverlay.classList.contains('hidden')) {
        zoomCanvas.width = Math.round(zoomCanvas.clientWidth * dpr);
        zoomCanvas.height = Math.round(zoomCanvas.clientHeight * dpr);
        const zCtx = zoomCanvas.getContext('2d');
        zCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        redrawCanvas(zoomCanvas);
    }
}

function resizeQuestionPanelCanvas() {
    // redraw canvases ที่มีอยู่
    document.querySelectorAll('.options-canvas, .answer-canvas, .transcript-canvas').forEach(cvs => {
        redrawCanvas(cvs);
    });
}
function applyStrokeStyle(ctx, mode, color, size, opacity) {
    ctx.globalAlpha = opacity ?? 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth   = (mode === 'highlighter') ? size * 2.2 : size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
}

function getObjectContainRect(boxW, boxH, natW, natH) {
    const boxAspect = boxW / boxH;
    const imgAspect = natW / natH;
    let w, h;
    if (imgAspect > boxAspect) {
        w = boxW;
        h = boxW / imgAspect;
    } else {
        h = boxH;
        w = boxH * imgAspect;
    }
    return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

/**
 * Return the CSS layout dimensions of `element` with subpixel precision,
 * undoing any ancestor CSS transforms applied on #zoomable-content
 * or #zoom-transform-container.
 *
 * Why: getBoundingClientRect() includes ancestor transforms (e.g., viewport
 * zoom scale, image zoom scale), while layout properties like
 * clientWidth/clientHeight are transform-blind and integer-rounded.
 * This helper bridges the gap so all canvas sizing and redrawing code
 * uses the same transform-undone metric.
 */
function getCssLayoutRect(element) {
    const rect = element.getBoundingClientRect();
    let scaleX = 1;
    let scaleY = 1;

    // Undo #zoomable-content transform (viewport zoom/pan)
    const zc = element.closest('#zoomable-content');
    if (zc && zc.clientWidth > 0 && zc.clientHeight > 0) {
        const zcRect = zc.getBoundingClientRect();
        scaleX = Math.max(zcRect.width  / zc.clientWidth,  0.01);
        scaleY = Math.max(zcRect.height / zc.clientHeight, 0.01);
    }

    // Undo #zoom-transform-container transform (zoom overlay image zoom)
    const ztc = element.closest('#zoom-transform-container');
    if (ztc && ztc.clientWidth > 0 && ztc.clientHeight > 0) {
        const ztcRect = ztc.getBoundingClientRect();
        scaleX *= Math.max(ztcRect.width  / ztc.clientWidth,  0.01);
        scaleY *= Math.max(ztcRect.height / ztc.clientHeight, 0.01);
    }

    return {
        width:  rect.width  / scaleX,
        height: rect.height / scaleY
    };
}

function correctCoordinates(clientX, clientY, canvas) {
    const cRect = canvas.getBoundingClientRect();
    const css = getCssLayoutRect(canvas);
    const cssScaleX = cRect.width / css.width;
    const cssScaleY = cRect.height / css.height;
    const cssX = (clientX - cRect.left) / cssScaleX;
    const cssY = (clientY - cRect.top) / cssScaleY;

    const img = canvas.parentElement?.querySelector('img');
    let content = { x: 0, y: 0, w: css.width, h: css.height };
    if (img && img.naturalWidth && img.naturalHeight) {
        content = getObjectContainRect(css.width, css.height, img.naturalWidth, img.naturalHeight);
    }
    const normalizedX = (cssX - content.x) / content.w;
    const normalizedY = (cssY - content.y) / content.h;
    return { x: normalizedX, y: normalizedY };
}

function setupCanvasDrawing(canvas) {
    canvas.addEventListener('pointerdown', e => {
        if (currentMode === 'mouse') return;

        const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
        const targetButton = elementsUnderPointer.find(el => el.id && el.id.startsWith('btn-answer-'));

        if (targetButton) {
            targetButton.click();
            return;
        }

        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        isDrawing = true;
        activeCanvas = canvas;

        undoStack.push(JSON.stringify(allStrokes));
        redoStack = [];

        const corrected = correctCoordinates(e.clientX, e.clientY, canvas);
        const x = corrected.x;
        const y = corrected.y;
        const elementId = canvas.getAttribute('data-element-id');

        if (currentMode === 'eraser') {
            handleVectorEraser(canvas, elementId, x, y);
        } else {
            currentPath = [{ x: x, y: y }];
            redrawCanvas(canvas);
        }
    });

    canvas.addEventListener('pointermove', e => {
        positionCustomCursor(e.clientX, e.clientY, true);

        if (currentMode !== 'mouse' && !isDrawing) {
            const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);

            const isOverButton = elementsUnderPointer.some(el => el.id && el.id.startsWith('btn-answer-'));

            const customCursor = document.getElementById('canvas-custom-cursor');

            if (isOverButton) {
                canvas.style.cursor = 'pointer';
                if (customCursor) customCursor.classList.add('hidden');
            } else {
                canvas.style.cursor = 'none';
                if (customCursor) customCursor.classList.remove('hidden');
            }
        }

        if (!isDrawing || activeCanvas !== canvas || currentMode === 'mouse') return;

        const corrected = correctCoordinates(e.clientX, e.clientY, canvas);
        const x = corrected.x;
        const y = corrected.y;
        const elementId = canvas.getAttribute('data-element-id');

        if (currentMode === 'eraser') {
            handleVectorEraser(canvas, elementId, x, y);
            syncAllCanvasesById(elementId, canvas);
        } else {
            currentPath.push({ x: x, y: y });
            redrawCanvas(canvas);
            syncAllCanvasesById(elementId, canvas);
        }
    });

    const stopDrawing = e => {
        if (!isDrawing || activeCanvas !== canvas) return;
        isDrawing = false;
        const elementId = canvas.getAttribute('data-element-id');

        if (currentMode !== 'eraser' && currentPath.length > 0) {
            const s = toolSettings[currentMode];
            allStrokes.push({
                questionIdx: currentIdx,
                elementId: elementId,
                mode: currentMode,
                color: activeColor,
                size: s.size,
                opacity: s.opacity,
                points: [...currentPath]
            });
        }
        currentPath = [];
        redrawCanvas(canvas);
        saveStrokesToStorage();

        const customCursor = document.getElementById('canvas-custom-cursor');
        const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
        const isOverButton = elementsUnderPointer.some(el => el.id && el.id.startsWith('btn-answer-'));
        if (isOverButton) {
            canvas.style.cursor = 'pointer';
            if (customCursor) customCursor.classList.add('hidden');
        } else {
            canvas.style.cursor = 'none';
            if (customCursor) customCursor.classList.remove('hidden');
        }

        syncAllCanvasesById(elementId, canvas);
        try { canvas.releasePointerCapture(e.pointerId); } catch(_) {}
    };

    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
}

function redrawCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Save state & reset to identity so drawing is in device-pixel space
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // clearRect uses identity — full canvas buffer in device pixels
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const elementId = canvas.getAttribute('data-element-id');

    const img = canvas.parentElement?.querySelector('img');
    const css = getCssLayoutRect(canvas);
    let displayWidth = css.width;
    let displayHeight = css.height;
    let content = { x: 0, y: 0, w: displayWidth, h: displayHeight };

    if (img && img.naturalWidth && img.naturalHeight) {
        content = getObjectContainRect(displayWidth, displayHeight, img.naturalWidth, img.naturalHeight);
    }

    // Scale content dimensions by dpr for device-pixel drawing
    const dc = {
        x: content.x * dpr,
        y: content.y * dpr,
        w: content.w * dpr,
        h: content.h * dpr
    };

    const currentNormId = getNormalizedId(elementId);

    const filtered = allStrokes.filter(s => {
        if (s.questionIdx !== currentIdx) return false;
        return s.elementId === elementId || getNormalizedId(s.elementId) === currentNormId;
    });

    filtered.forEach(s => {
        if (s.points.length < 1) return;
        ctx.beginPath();
        applyStrokeStyle(ctx, s.mode, s.color, s.size * dpr, s.opacity);
        ctx.moveTo(dc.x + s.points[0].x * dc.w, dc.y + s.points[0].y * dc.h);
        for(let i = 1; i < s.points.length; i++) {
            ctx.lineTo(dc.x + s.points[i].x * dc.w, dc.y + s.points[i].y * dc.h);
        }
        ctx.stroke();
    });

    if (isDrawing && activeCanvas === canvas && currentPath.length > 0 && currentMode !== 'eraser') {
        ctx.beginPath();
        const s = toolSettings[currentMode];
        applyStrokeStyle(ctx, currentMode, activeColor, s.size * dpr, s.opacity);
        ctx.moveTo(dc.x + currentPath[0].x * dc.w, dc.y + currentPath[0].y * dc.h);
        for(let i = 1; i < currentPath.length; i++) {
            ctx.lineTo(dc.x + currentPath[i].x * dc.w, dc.y + currentPath[i].y * dc.h);
        }
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function redrawAllCanvasesOnScreen() {
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(c => redrawCanvas(c));
}

function clearAllCanvases() {
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(c => {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
    });
}

function syncAllCanvasesById(elementId, sourceCanvas) {
    const normId = getNormalizedId(elementId);
    document.querySelectorAll(`canvas[data-element-id]`).forEach(cvs => {
        if (cvs === sourceCanvas) return;
        const cId = cvs.getAttribute('data-element-id');
        if (cId === elementId || getNormalizedId(cId) === normId) {
            redrawCanvas(cvs);
        }
    });
}

function handleVectorEraser(canvas, elementId, ex, ey) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const radius = toolSettings.eraser.size;
    let isMutated = false;

    const getNormalizedId = (id) => id ? id.replace(/^img-\d+-/, 'img-') : '';
    const currentNormId = getNormalizedId(elementId);

    // ex, ey เป็น normalized coordinates (0-1) จาก correctCoordinates
    const absEx = ex * displayWidth;
    const absEy = ey * displayHeight;

    allStrokes = allStrokes.filter(s => {
        if (s.questionIdx !== currentIdx) return true;
        if (s.elementId !== elementId && getNormalizedId(s.elementId) !== currentNormId) return true;

        for (let i = 0; i < s.points.length - 1; i++) {
            const x1 = s.points[i].x * displayWidth;
            const y1 = s.points[i].y * displayHeight;
            const x2 = s.points[i+1].x * displayWidth;
            const y2 = s.points[i+1].y * displayHeight;
            if (getDistanceToSegment(absEx, absEy, x1, y1, x2, y2) < radius) {
                isMutated = true;
                return false;
            }
        }
        return true;
    });

    if (isMutated) {
        redrawCanvas(canvas);
        syncAllCanvasesById(elementId, canvas);
                saveStrokesToStorage();
            }
        }

        function getDistanceToSegment(x, y, x1, y1, x2, y2) {
    const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D, lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.hypot(x - xx, y - yy);
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(allStrokes));
    allStrokes = JSON.parse(undoStack.pop());
    redrawAllCanvasesOnScreen();
    saveStrokesToStorage();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(allStrokes));
    allStrokes = JSON.parse(redoStack.pop());
    redrawAllCanvasesOnScreen();
    saveStrokesToStorage();
}

function clearCurrentCanvas() {
    undoStack.push(JSON.stringify(allStrokes));
    redoStack = [];
    allStrokes = allStrokes.filter(s => s.questionIdx !== currentIdx);
    redrawAllCanvasesOnScreen();
    saveStrokesToStorage();

    // Reset zoom/pan state ไปด้วยในตัว
    clearTimeout(wheelResizeTimeout);
    pinchStartDistance = 0;
    zoomScale = 1;
    panX = 0;
    panY = 0;
    viewportApplyTransform();
    viewportWorkspace.classList.remove('panning');
    requestAnimationFrame(() => {
        resizeAllActiveCanvases();
    });
}

function setupPan() {
    viewport.addEventListener('mousedown', e => {
        if (currentMode !== 'mouse') return;
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
        viewport.style.cursor = 'grabbing';
    });

    viewport.addEventListener('mousemove', e => {
        if (isPanning) {
            e.preventDefault();
            panX = e.clientX - panStartX;
            panY = e.clientY - panStartY;
            updateZoomTransform();
        }
    });

    viewport.addEventListener('mouseup', () => {
        isPanning = false;
        viewport.style.cursor = 'grab';
    });

    viewport.addEventListener('mouseleave', () => {
        isPanning = false;
        viewport.style.cursor = 'grab';
    });
}

function setupGlobalZoom() {
    zoomOverlay.onwheel = null;

    zoomOverlay.addEventListener('wheel', e => {
            e.preventDefault();
            e.stopPropagation();

                let delta = 0;
                if (e.deltaY !== 0) {
                    const absDelta = Math.abs(e.deltaY);
                    const factor = absDelta > 50 ? 0.1 : 0.03;
                    delta = e.deltaY > 0 ? -factor : factor;
                }

            if (delta !== 0) {
                const newZoom = Math.min(Math.max(zoomScale + delta, 1), 4);
                handleZoomSlider(newZoom);
            }
        }, { passive: false });

    let initialDistance = 0;
    let initialZoom = 1;

    zoomOverlay.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = zoomScale;
        }
    }, { passive: false });

    zoomOverlay.addEventListener('touchmove', e => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (initialDistance > 0) {
                const scale = currentDistance / initialDistance;
                const newZoom = Math.min(Math.max(initialZoom * scale, 1), 4);
                handleZoomSlider(newZoom);
            }
        }
    }, { passive: false });

    zoomOverlay.addEventListener('touchend', () => {
        initialDistance = 0;
    });
}
function openZoom(imgUrl, elementId) {
    currentZoomElementId = elementId;
    const zoomedImg = document.getElementById('zoomed-image');
    document.getElementById('minimap-img').src = imgUrl;
    zoomScale = 1.5; panX = 0; panY = 0;
    document.getElementById('zoom-slider').value = 1.5;
    document.getElementById('zoom-val').innerText = '1.5x';
    document.getElementById('mini-map-container').classList.remove('hidden');
    updateZoomTransform();

    zoomCanvas.setAttribute('data-element-id', elementId);

    zoomedImg.src = imgUrl;

    const setupZoomCanvas = () => {
        // Guard: ป้องกันการเรียกซ้ำ
        if (zoomCanvas.dataset.zoomSetup === '1') return;
        zoomCanvas.dataset.zoomSetup = '1';

        // 1. ใช้ขนาดดั้งเดิมของภาพเสมอ เพื่อป้องกันความเพี้ยนจากการที่ภาพกำลังถูกซูมอยู่
        const w = zoomedImg.naturalWidth;
        const h = zoomedImg.naturalHeight;

        // หากรูปยังโหลดขนาดดั้งเดิมไม่เสร็จ ให้รอแล้วเรียกใหม่
        if (!w || !h) {
            delete zoomCanvas.dataset.zoomSetup;
            setTimeout(setupZoomCanvas, 30);
            return;
        }

        // 2. ตั้งค่า CSS size ให้ canvas ครอบทับรูปภาพเป๊ะๆ
        zoomCanvas.style.width = '100%';
        zoomCanvas.style.height = '100%';

        // 3. เปิด overlay ก่อน เพื่อให้ browser คำนวณ layout แล้วค่อยอ่าน clientWidth
        document.body.classList.add('zoom-open');
        zoomOverlay.classList.remove('hidden');

        // force layout recalculation — offsetWidth บังคับให้ browser layout ทันที
        void zoomCanvas.offsetWidth;

        // 4. ตั้งค่า buffer = CSS display size × dpr (ไม่ใช่ naturalWidth × dpr)
        //    เพราะ redrawCanvas() ใช้ clientWidth/clientHeight ในการวาด
        //    ถ้า buffer ใหญ่กว่า CSS display → browser scale ลง → เส้นผิดตำแหน่ง!
        const dpr = window.devicePixelRatio || 1;
        zoomCanvas.width = Math.round(zoomCanvas.clientWidth * dpr);
        zoomCanvas.height = Math.round(zoomCanvas.clientHeight * dpr);

        const ctx = zoomCanvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // 5. วาดเส้นเก่าลงไป
        redrawCanvas(zoomCanvas);
        
        updateCanvasesPointerEvents();
    };

    zoomedImg.onload = () => {
        setTimeout(setupZoomCanvas, 60);
    };

    if (zoomedImg.complete) {
        setTimeout(setupZoomCanvas, 60);
    }

    hideViewportControls();
    if (!viewport._panSetup) {
        setupPan();
        viewport._panSetup = true;
    }
    if (!zoomOverlay._globalZoomSetup) {
        setupGlobalZoom();
        zoomOverlay._globalZoomSetup = true;
    }
}
function closeZoom() {
    zoomOverlay.classList.add('hidden');
    document.body.classList.remove('zoom-open');
    currentZoomElementId = null;
    delete zoomCanvas.dataset.zoomSetup;
    redrawAllCanvasesOnScreen();
    updateCanvasesPointerEvents();

    if (document.getElementById('tutor-screen').classList.contains('hidden') === false) {
        const layoutToggle = document.getElementById('layout-toggle'); if (layoutToggle) layoutToggle.classList.remove('hidden');
        document.getElementById('toolbar').classList.remove('hidden');
        showViewportControls();
        viewportReset();
    }
}
function handleZoomSlider(val) {
    zoomScale = parseFloat(val);
    const slider = document.getElementById('zoom-slider');
    if (slider) slider.value = zoomScale;
    document.getElementById('zoom-val').innerText = zoomScale.toFixed(1) + 'x';
    if (zoomScale === 1) { panX = 0; panY = 0; document.getElementById('mini-map-container').classList.add('hidden'); }
    else document.getElementById('mini-map-container').classList.remove('hidden');
    updateZoomTransform();
}
function updateZoomTransform() {
    document.getElementById('zoom-transform-container').style.transform = `translate(${panX}px,${panY}px) scale(${zoomScale})`;
    if (zoomCanvas) {
        requestAnimationFrame(() => {
            syncGalleryCanvasToImage(zoomCanvas);
            redrawCanvas(zoomCanvas);
        });
    }
    updateMinimapViewer();
}
function updateMinimapViewer() {
    const viewer = document.getElementById('minimap-viewer');
    if (zoomScale <= 1) { viewer.style.cssText = 'width:100%;height:100%;left:0;top:0'; return; }
    const w = 100/zoomScale, h = 100/zoomScale;
    const l = Math.max(0, Math.min(100-w, 50 - w/2 - (panX / window.innerWidth  * 100 / zoomScale)));
    const t = Math.max(0, Math.min(100-h, 50 - h/2 - (panY / window.innerHeight * 100 / zoomScale)));
    viewer.style.cssText = `width:${w}%;height:${h}%;left:${l}%;top:${t}%`;
}
function renderQuestion() {
    console.log('renderQuestion called, currentIdx:', currentIdx, 'examScreens.length:', examScreens.length);
    if (!currentSet || examScreens.length === 0) { console.log('renderQuestion early return'); return; }
    const screenQuestions = examScreens[currentIdx];
    const totalScreens = examScreens.length;
    const num = currentIdx + 1;

    // Clear ทุก canvas ก่อน render หน้าใหม่ ป้องกันเส้นเก่าค้าง
    clearAllCanvases();

    updateLayoutMode();
    const isHorizontal = currentLayoutMode === 'horizontal';

    document.getElementById('question-counter').innerText = `Page ${num} of ${totalScreens}`;
    document.getElementById('progress-percent').innerText = `${Math.round(num/totalScreens*100)}%`;
    document.getElementById('progress-bar').style.width = `${Math.round(num/totalScreens*100)}%`;

    const ap = document.getElementById('audio-player');
    const ac = document.getElementById('audio-container');
    // ใช้ข้อมูลจาก question แรกใน group สำหรับโหมด horizontal
    const refQ = screenQuestions[0];
    const qAudio = refQ?.audioUrl?.trim() ? refQ : screenQuestions.find(q => q.audioUrl?.trim());
    if (qAudio) { ap.src = qAudio.audioUrl; ac.classList.remove('hidden'); ap.load(); }
    else { ac.classList.add('hidden'); }

    let allImages = [];
    if (isHorizontal) {
        // โหมด horizontal: รับรูปจาก question แรกใน group เท่านั้น
        if (refQ?.images?.length) allImages = [...new Set(refQ.images)];
    } else {
        allImages = [...new Set(screenQuestions.flatMap(q => q.images || []))];
    }
    carouselImages = allImages;

    const gallery = document.getElementById('image-gallery');
    const imagesArea = document.getElementById('images-area');

                const renderImage = (url, i) => {
                const elementId = `img-${currentIdx}-${i}`;
                return `
                    <div class="relative rounded-xl bg-white border border-slate-200 shadow-sm ${isHorizontal ? 'flex-shrink-0 flex items-center justify-center' : 'w-full mb-4'}">
                        <img src="${url}" class="${isHorizontal ? 'h-[400px] w-auto' : 'w-full max-h-[65vh]'} object-contain block select-none pointer-events-none">
                        <canvas data-element-id="${elementId}" class="gallery-canvas absolute inset-0 w-full h-full z-10"></canvas>
                        <div class="absolute top-2 right-2 z-[99999]">
                            <button onclick="openZoom('${url}', '${elementId}')" class="zoom-btn bg-slate-900/90 text-white p-2 rounded-lg hover:bg-slate-800" style="position:relative;z-index:150">
                                <i data-lucide="zoom-in" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>`;
    };

    const globalTranscriptArea = document.getElementById('global-transcript-area');

    if (isHorizontal) {
        gallery.innerHTML = '';
        imagesArea.innerHTML = allImages.map(renderImage).join('');
        imagesArea.classList.remove('hidden');
        imagesArea.style.display = 'flex';
        if (allImages.length === 1) {
            imagesArea.classList.add('single-image');
        } else {
            imagesArea.classList.remove('single-image');
        }

        // Global transcript: find first question with transcript
        const firstTranscriptQ = screenQuestions.find(q => q.transcript?.trim());
        if (firstTranscriptQ) {
            const isOn = !!transcriptVisible[firstTranscriptQ.id];
            const btnLabel = isOn ? 'Hide Transcript' : 'Show Transcript';
            const btnIcon = isOn ? 'eye-off' : 'eye';
            globalTranscriptArea.innerHTML = `
                <div class="px-6 py-3">
                    <button id="btn-global-transcript" onpointerdown="event.stopPropagation(); event.preventDefault(); toggleGlobalTranscript()" class="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2" style="position:relative;z-index:110;pointer-events:auto">
                        <i data-lucide="${btnIcon}" class="w-4 h-4"></i> ${btnLabel}
                    </button>
                    <div class="relative mt-3">
                        <div id="global-transcript-box" class="${isOn ? '' : 'hidden'} bg-yellow-50 border border-slate-200 p-4 rounded-2xl text-slate-700 text-base whitespace-pre-line text-center relative">${firstTranscriptQ.transcript}</div>
                        <canvas id="global-transcript-canvas" data-element-id="transcript-global-${firstTranscriptQ.id}" class="transcript-canvas absolute top-0 left-0 w-full h-full z-20 ${isOn ? '' : 'hidden'}"></canvas>
                    </div>
                </div>
            `;
            globalTranscriptArea.classList.toggle('hidden', false);
        } else {
            globalTranscriptArea.classList.add('hidden');
            globalTranscriptArea.innerHTML = '';
        }
    } else {
        gallery.innerHTML = allImages.map(renderImage).join('');
        if (allImages.length > 1) {
            gallery.classList.add('multi-image');
        } else {
            gallery.classList.remove('multi-image');
        }
        imagesArea.classList.add('hidden');
        imagesArea.innerHTML = '';
        imagesArea.style.display = 'none';
        globalTranscriptArea.classList.add('hidden');
        globalTranscriptArea.innerHTML = '';
    }




    allImages.forEach((url, i) => {
        const elementId = `img-${currentIdx}-${i}`;
        document.querySelectorAll(`canvas[data-element-id="${elementId}"]`).forEach(cvs => {
            const img = cvs.parentElement.querySelector('img');
            const setup = () => {
                syncGalleryCanvasToImage(cvs);
                observeGalleryCanvasResize(cvs);
                setupCanvasDrawing(cvs);
                redrawCanvas(cvs);
            };
            if (img.complete) setup();
            else img.addEventListener('load', setup, { once: true });
        });
    });

    const wrapper = document.getElementById('questions-wrapper');
    wrapper.innerHTML = '';

    const numQuestions = screenQuestions.length;

    // Initialize hiddenChoices for questions with hideOptions so options start hidden
    screenQuestions.forEach(q => {
        if (q.hideOptions && hiddenChoices[q.id] === undefined) {
            hiddenChoices[q.id] = true;
        }
    });

    screenQuestions.forEach(q => {
        const isOptionsHidden = q.hideOptions && hiddenChoices[q.id] !== false;

        const col = document.createElement('div');
        if (isHorizontal) {
            col.className = 'question-column';
            if (numQuestions <= 3) {
                col.style.flex = '1 1 0';
                col.style.minWidth = '0';
            } else {
                col.style.flex = '0 0 320px';
            }
        }
        col.innerHTML = generateQuestionHTML(q);
        wrapper.appendChild(col);
        if (explanationVisible[q.id]) setTimeout(() => checkAnswer(q.id, true), 50);
    });

    // Setup canvases สำหรับแต่ละ question (เฉพาะที่ visible)
    screenQuestions.forEach(q => {
        if (explanationVisible[q.id]) setupAnswerCanvas(q.id);
        if (q.transcript && transcriptVisible[q.id]) setupTranscriptCanvas(q.id);
        // Setup options canvas เมื่อ options แสดงอยู่ (ไม่ใช่ซ่อน)
        // ทำงานทั้ง question ที่มี hideOptions และไม่มี hideOptions
        const isOptionsHidden = q.hideOptions && hiddenChoices[q.id];
        if (!isOptionsHidden) {
            setupOptionsCanvas(q.id);
        }
    });

    // Setup global transcript canvas สำหรับ horizontal layout
    if (isHorizontal) {
        const firstTranscriptQ = screenQuestions.find(q => q.transcript?.trim());
        if (firstTranscriptQ) {
            setupGlobalTranscriptCanvas(firstTranscriptQ.id);
        }
    }

    if (isHorizontal && numQuestions <= 3) {
        wrapper.style.overflowX = 'visible';
        wrapper.style.justifyContent = 'center';
    } else if (isHorizontal) {
        wrapper.style.overflowX = 'auto';
        wrapper.style.justifyContent = 'flex-start';
    }

    document.getElementById('btn-prev').style.visibility = currentIdx === 0 ? 'hidden' : 'visible';
    document.getElementById('btn-next').style.visibility = currentIdx === totalScreens - 1 ? 'hidden' : 'visible';

    populateJumpDropdown();

    if (window.lucide) lucide.createIcons();
}
function setupDrawingCanvas() {
    const canvas = document.getElementById('drawing-canvas');
    const tutorScreen = document.getElementById('tutor-screen');
    if (canvas && tutorScreen) {
        canvas.width = tutorScreen.clientWidth;
        canvas.height = tutorScreen.clientHeight;
        canvas.setAttribute('data-element-id', `drawing-${currentIdx}`);
        setupCanvasDrawing(canvas);
        redrawCanvas(canvas);
    }
}

function setupAnswerCanvas(qId) {
    const canvas = document.getElementById(`answer-canvas-${qId}`);
    const box = document.getElementById(`explanation-box-${qId}`);
    if (!canvas || !box) return;

    // ใช้ requestAnimationFrame เพื่อให้ DOM render เสร็จก่อน
    requestAnimationFrame(() => {
        const rect = getCssLayoutRect(box);
        const dpr = window.devicePixelRatio || 1;
        // ขนาด canvas = ขนาดจริงที่แสดงผล x devicePixelRatio
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        // CSS size คงที่ตามขนาดจริง
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        // Scale context ตาม dpr
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!canvas.dataset.drawingSetup) {
            setupCanvasDrawing(canvas);
            canvas.dataset.drawingSetup = '1';
        }
        redrawCanvas(canvas);
        updateCanvasesPointerEvents();
    });
}

function setupOptionsCanvas(qId) {
    const canvas = document.getElementById(`options-canvas-${qId}`);
    const container = document.getElementById(`options-container-${qId}`);
    if (!canvas || !container) return;

    requestAnimationFrame(() => {
        const rect = getCssLayoutRect(container);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!canvas.dataset.drawingSetup) {
            setupCanvasDrawing(canvas);
            canvas.dataset.drawingSetup = '1';
        }
        redrawCanvas(canvas);
        updateCanvasesPointerEvents();
    });
}

function setupTranscriptCanvas(qId) {
    const canvas = document.getElementById(`transcript-canvas-${qId}`);
    const box = document.getElementById(`transcript-box-${qId}`);
    if (!canvas || !box) return;

    requestAnimationFrame(() => {
        const rect = getCssLayoutRect(box);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!canvas.dataset.drawingSetup) {
            setupCanvasDrawing(canvas);
            canvas.dataset.drawingSetup = '1';
        }
        redrawCanvas(canvas);
        console.log('[setupTranscriptCanvas] calling updateCanvasesPointerEvents, currentMode:', currentMode);
        updateCanvasesPointerEvents();
    });
}

function setupGlobalTranscriptCanvas(qId) {
    const canvas = document.getElementById('global-transcript-canvas');
    const box = document.getElementById('global-transcript-box');
    if (!canvas || !box) return;

    // The canvas uses absolute inset-0 w-full h-full — its display size
    // must match the parent (.relative.mt-3), not the box inside it.
    const parent = canvas.parentElement;
    if (!parent) return;

    requestAnimationFrame(() => {
        const rect = getCssLayoutRect(parent);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!canvas.dataset.drawingSetup) {
            setupCanvasDrawing(canvas);
            canvas.dataset.drawingSetup = '1';
        }
        redrawCanvas(canvas);
        updateCanvasesPointerEvents();
    });
}
function generateQuestionHTML(q) {
    const isH = currentLayoutMode === 'horizontal';
    const selected = (qId, i) => selectedAnswers[qId] === i;
    const hideChoices = q.hideOptions && hiddenChoices[q.id];
    const showingHiddenOptions = q.hideOptions && !hiddenChoices[q.id];
    const optionsMarkup = q.options.map((opt, i) => {
        const isSelected = selected(q.id, i);
        const defaultClass = showingHiddenOptions
            ? (isSelected ? 'bg-slate-200 border-slate-400 text-slate-700' : 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-500')
            : (isSelected ? 'bg-blue-50 border-2 border-blue-500 text-blue-800' : 'bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-700');
        const badgeClass = showingHiddenOptions
            ? 'w-6 h-6 rounded-md bg-slate-200 shadow-sm border border-slate-300 flex items-center justify-center font-bold text-sm text-slate-500'
            : 'w-6 h-6 rounded-md bg-white shadow-sm border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-500';

        return `
                <button onclick="if(currentMode!=='mouse')return;selectOption(${q.id},${i})" class="${defaultClass} w-full text-left ${isH ? 'p-4' : 'p-5'} rounded-xl text-base font-medium transition flex items-center gap-3" style="position:relative;z-index:1">
                    <span class="${badgeClass}">${String.fromCharCode(65+i)}</span>
                    <span class="flex-1">${opt}</span>
                </button>
            `;
    }).join('');
    const transcriptShown = !!q.transcript && transcriptVisible[q.id];
    const transcriptToggleLabel = transcriptShown ? 'Hide Transcript' : 'Show Transcript';
    const transcriptToggleIcon = transcriptShown ? 'eye-off' : 'eye';
    const transcriptToggleClass = transcriptShown
        ? `w-full bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 font-medium ${isH ? 'text-sm px-4 py-3' : 'text-base px-5 py-3'} rounded-xl transition flex items-center gap-1 border border-amber-200`
        : `w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold ${isH ? 'text-sm px-4 py-3' : 'text-base px-5 py-3'} rounded-xl transition flex items-center gap-1`;
    const toggleLabel = hideChoices ? 'Show Options' : 'Hide Options';
    const toggleIcon = hideChoices ? 'eye' : 'eye-off';
    const toggleClass = hideChoices
        ? `w-full bg-red-600 hover:bg-red-700 text-white font-bold ${isH ? 'text-sm px-4 py-3' : 'text-base px-5 py-3'} rounded-xl transition flex items-center gap-1`
        : `w-full bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-medium ${isH ? 'text-sm px-4 py-3' : 'text-base px-5 py-3'} rounded-xl transition flex items-center gap-1 border border-rose-200`;

    const btnGap = isH ? 'gap-2' : 'gap-3';
    const optionsBtnHTML = q.hideOptions ? `<button id="btn-options-${q.id}" onpointerdown="event.stopPropagation(); event.preventDefault(); toggleOptions(${q.id});" class="${toggleClass}" style="position:relative;z-index:110;pointer-events:auto"><i data-lucide="${toggleIcon}" class="w-4 h-4"></i> ${toggleLabel}</button>` : '';
    // In horizontal mode, transcript is shown globally above questions, not per-question
    const showTranscriptPerQuestion = q.transcript && !isH;
    const transcriptBtnHTML = showTranscriptPerQuestion ? `<button id="btn-transcript-${q.id}" onpointerdown="event.stopPropagation(); event.preventDefault(); console.log('TRANSCRIPT BTN CLICKED qId=${q.id}'); toggleTranscript(${q.id});" class="${transcriptToggleClass}" style="position:relative;z-index:110;pointer-events:auto"><i data-lucide="${transcriptToggleIcon}" class="w-4 h-4"></i> ${transcriptToggleLabel}</button>` : '';
    console.log('[generateQuestionHTML] q.id:', q.id, 'showTranscriptPerQuestion:', showTranscriptPerQuestion, 'hasTranscript:', !!q.transcript);
    const answerBtnHTML = `<button id="btn-answer-${q.id}" onpointerdown="event.stopPropagation(); event.preventDefault(); checkAnswer(${q.id});" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold ${isH ? 'text-sm px-4 py-3' : 'text-base px-5 py-3'} rounded-xl transition flex items-center gap-1" style="position:relative;z-index:110;pointer-events:auto"><i data-lucide="check-check" class="w-4 h-4"></i> Show Answer</button>`;

    return `
        <div class="${isH ? 'text-base' : 'text-lg'} font-bold text-slate-800 leading-snug mb-3">${q.questionText}</div>
        ${showTranscriptPerQuestion ? `
        <div class="flex flex-col ${btnGap} mb-2">
            ${transcriptBtnHTML}
        </div>
        <div class="relative mt-1 mb-3">
            <div id="transcript-box-${q.id}" class="${transcriptShown ? '' : 'hidden'} bg-yellow-50 border border-slate-200 p-4 rounded-2xl text-slate-700 text-base whitespace-pre-line relative">${q.transcript}</div>
            <canvas id="transcript-canvas-${q.id}" data-element-id="transcript-${q.id}" class="transcript-canvas absolute top-0 left-0 w-full h-full z-10"></canvas>
        </div>` : ''}
        <div class="flex flex-col ${btnGap} mb-2">
            ${optionsBtnHTML}
        </div>
        <div id="options-wrapper-${q.id}" class="mb-2" style="position:relative">
            <div id="options-container-${q.id}" class="flex flex-col ${isH ? 'gap-3' : 'gap-3'} ${hideChoices ? 'hidden' : ''}">
                ${optionsMarkup}
            </div>
            <canvas id="options-canvas-${q.id}" data-element-id="options-${q.id}" class="options-canvas absolute top-0 left-0 w-full h-full z-10"></canvas>
        </div>
        <div class="flex flex-col ${btnGap} mb-2">
            ${answerBtnHTML}
        </div>
        <div class="relative mt-1">
            <div id="explanation-box-${q.id}" class="${explanationVisible[q.id] ? '' : 'hidden'} bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl text-emerald-800 text-base leading-relaxed shadow-sm relative"></div>
            <canvas id="answer-canvas-${q.id}" data-element-id="answer-${q.id}" class="answer-canvas absolute top-0 left-0 w-full h-full z-10"></canvas>
        </div>
    `;
}
        function selectOption(qId, optIdx) {
            if (hiddenChoices[qId]) return;
            selectedAnswers[qId] = optIdx;
            const container = document.getElementById(`options-container-${qId}`);
            if (!container) return;
            const buttons = container.getElementsByTagName('button');
            Array.from(buttons).forEach((btn, i) => {
                const isSelected = (i === optIdx);
                btn.className = isSelected
                    ? "w-full text-left bg-blue-50 border-2 border-blue-500 p-5 rounded-xl text-base font-semibold text-blue-800 shadow-sm flex items-center gap-3"
                    : "w-full text-left bg-slate-50 hover:bg-slate-100/80 border border-slate-200 p-5 rounded-xl text-base font-medium transition flex items-center gap-3";
            });
        }
        function checkAnswer(qId, forceShow = false) {
                    const q = currentSet.questions.find(x => x.id === qId);
                    if (!q) return;

                    const box = document.getElementById(`explanation-box-${qId}`);
                    const answerCanvas = document.getElementById(`answer-canvas-${qId}`);
                    const container = document.getElementById(`options-container-${qId}`);
                    const btn = document.getElementById(`btn-answer-${qId}`);

                    if (explanationVisible[qId] && !forceShow) {
                        // ซ่อนเฉลย
                        explanationVisible[qId] = false;
                        box.classList.add('hidden');
                        if (answerCanvas) answerCanvas.classList.add('hidden');

                        if (btn) {
                            // Show Answer state: emerald solid
                            const showClasses = new Set('w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl text-base transition flex items-center gap-1'.split(/\s+/));
                            const hideClasses = new Set('w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 font-medium px-5 py-3 rounded-xl text-base transition flex items-center gap-1 border border-emerald-200'.split(/\s+/));
                            const showOnly = [...showClasses].filter(c => !hideClasses.has(c));
                            const hideOnly = [...hideClasses].filter(c => !showClasses.has(c));
                            hideOnly.forEach(c => btn.classList.remove(c));
                            showOnly.forEach(c => btn.classList.add(c));
                            const iconI = btn.querySelector('i[data-lucide]');
                            if (iconI && window.lucide) {
                                const newIcon = lucide.createElement('check-check');
                                newIcon.setAttribute('class', 'w-4 h-4');
                                iconI.replaceChildren(newIcon);
                            }
                            const lastNode = btn.childNodes[btn.childNodes.length - 1];
                            if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
                                lastNode.textContent = ' Show Answer';
                            }
                        }

                        resizeQuestionPanelCanvas();

                        if (container) {
                            const buttons = container.getElementsByTagName('button');
                            if (buttons[q.correctAnswer]) {
                                const isSelected = selectedAnswers[qId] === q.correctAnswer;
                                buttons[q.correctAnswer].className = isSelected
                                    ? "w-full text-left bg-blue-50 border-2 border-blue-500 p-5 rounded-xl text-base font-semibold text-blue-800 shadow-sm flex items-center gap-3"
                                    : "w-full text-left bg-slate-50 hover:bg-slate-100/80 border border-slate-200 p-5 rounded-xl text-base font-medium transition flex items-center gap-3";

                                const badge = buttons[q.correctAnswer].querySelector('span');
                                if (badge) badge.className = "w-6 h-6 rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-500";
                            }
                        }
                    }
                    else {
                        // แสดงเฉลย
                        explanationVisible[qId] = true;
                        const correctOptionText = q.options ? q.options[q.correctAnswer] : '';
                        box.innerHTML = `<div><strong class="text-emerald-700 text-base">เฉลย: ${String.fromCharCode(65+q.correctAnswer)} ${correctOptionText}</strong></div><div class="mt-1 text-slate-600">${q.explanation}</div>`;
                        box.classList.remove('hidden');
                        if (answerCanvas) answerCanvas.classList.remove('hidden');

                        if (btn) {
                            // Hide Answer state: emerald muted (matches explanation box)
                            const showClasses = new Set('w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-3 rounded-xl text-base shadow-md shadow-emerald-200 transition flex items-center gap-1'.split(/\s+/));
                            const hideClasses = new Set('w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 font-medium px-5 py-3 rounded-xl text-base transition flex items-center gap-1 border border-emerald-200'.split(/\s+/));
                            const showOnly = [...showClasses].filter(c => !hideClasses.has(c));
                            const hideOnly = [...hideClasses].filter(c => !showClasses.has(c));
                            showOnly.forEach(c => btn.classList.remove(c));
                            hideOnly.forEach(c => btn.classList.add(c));
                            const iconI = btn.querySelector('i[data-lucide]');
                            if (iconI && window.lucide) {
                                const newIcon = lucide.createElement('eye-off');
                                newIcon.setAttribute('class', 'w-4 h-4');
                                iconI.replaceChildren(newIcon);
                            }
                            const lastNode = btn.childNodes[btn.childNodes.length - 1];
                            if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
                                lastNode.textContent = ' Hide Answer';
                            }
                        }

                        resizeQuestionPanelCanvas();

                        // Setup answer canvas หลังจาก box แสดงผลแล้ว
                        setTimeout(() => { setupAnswerCanvas(qId); updateCanvasesPointerEvents(); }, 50);

                        if (container) {
                            const buttons = container.getElementsByTagName('button');
                            if (buttons[q.correctAnswer]) {
                                buttons[q.correctAnswer].className = "w-full text-left bg-emerald-50 border-2 border-emerald-500 p-5 rounded-xl text-base font-semibold text-emerald-800 shadow-sm flex items-center gap-3";
                                const badge = buttons[q.correctAnswer].querySelector('span');
                                if (badge) badge.className = "w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-sm";
                            }
                        }
                    }
        }
function _togglePanel(stateMap, qId, boxId, btnId, cfg) {
    stateMap[qId] = !stateMap[qId];
    const isOn  = stateMap[qId];
    const box   = document.getElementById(boxId);
    const btn   = document.getElementById(btnId);
    if (box) box.classList.toggle('hidden', !isOn);
    if (btn) {
        // Collect all unique classes from both states
        const sz = btn.className.includes('text-sm') ? 'text-sm px-4 py-3' : 'text-base px-5 py-3';
        const onClasses  = new Set(cfg.classOn.replace('{sz}', sz).split(/\s+/).filter(Boolean));
        const offClasses = new Set(cfg.classOff.replace('{sz}', sz).split(/\s+/).filter(Boolean));
        // Classes common to both states — never touch these
        const common = [...onClasses].filter(c => offClasses.has(c));
        // Classes that differ — swap them
        const onOnly  = [...onClasses].filter(c => !offClasses.has(c));
        const offOnly = [...offClasses].filter(c => !onClasses.has(c));
        if (isOn) {
            offOnly.forEach(c => btn.classList.remove(c));
            onOnly.forEach(c => btn.classList.add(c));
        } else {
            onOnly.forEach(c => btn.classList.remove(c));
            offOnly.forEach(c => btn.classList.add(c));
        }
        // Update icon: replace only the SVG inside the <i> tag (no full re-render)
        const iconI = btn.querySelector('i[data-lucide]');
        if (iconI && window.lucide) {
            const newIcon = lucide.createElement(isOn ? cfg.iconOn : cfg.iconOff);
            newIcon.setAttribute('class', 'w-4 h-4');
            iconI.replaceChildren(newIcon);
        }
        // Update only the trailing text node (preserve icon element)
        const lastNode = btn.childNodes[btn.childNodes.length - 1];
        if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
            lastNode.textContent = ' ' + (isOn ? cfg.labelOn : cfg.labelOff);
        }
    }
        }
        function toggleOptions(qId) {
    const q = currentSet?.questions.find(x => x.id === qId);
    if (!q || !q.hideOptions) return;
    const note = document.getElementById(`options-hidden-note-${qId}`);
    // hiddenChoices เก็บสถานะ "ซ่อน" (true = ซ่อน, false = แสดง)
    // สลับสถานะ: ถ้าตอนนี้ซ่อนอยู่ → แสดง, ถ้าแสดงอยู่ → ซ่อน
    const wasHidden = hiddenChoices[qId];
    hiddenChoices[qId] = !wasHidden;
    const box = document.getElementById(`options-container-${qId}`);
    const btn = document.getElementById(`btn-options-${qId}`);
    if (box) box.classList.toggle('hidden', !wasHidden);  // ถ้าเคยซ่อน → แสดง (remove hidden), ถ้าเคยแสดง → ซ่อน (add hidden)
    if (btn) {
        const sz = btn.className.includes('text-sm') ? 'text-sm px-4 py-3' : 'text-base px-5 py-3';
        if (wasHidden) {
            // กำลังแสดง options → ปุ่มเป็น "Hide Options" (สีอ่อน)
            btn.className = `w-full bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-medium ${sz} rounded-xl transition flex items-center gap-1 mb-2 border border-rose-200`;
            const iconI = btn.querySelector('i[data-lucide]');
            if (iconI && window.lucide) {
                const newIcon = lucide.createElement('eye-off');
                newIcon.setAttribute('class', 'w-4 h-4');
                iconI.replaceChildren(newIcon);
            }
            const lastNode = btn.childNodes[btn.childNodes.length - 1];
            if (lastNode && lastNode.nodeType === Node.TEXT_NODE) lastNode.textContent = ' Hide Options';
        } else {
            // กำลังซ่อน options → ปุ่มเป็น "Show Options" (สีแดงเข้ม)
            btn.className = `w-full bg-red-600 hover:bg-red-700 text-white font-bold ${sz} rounded-xl transition flex items-center gap-1 mb-2`;
            const iconI = btn.querySelector('i[data-lucide]');
            if (iconI && window.lucide) {
                const newIcon = lucide.createElement('eye');
                newIcon.setAttribute('class', 'w-4 h-4');
                iconI.replaceChildren(newIcon);
            }
            const lastNode = btn.childNodes[btn.childNodes.length - 1];
            if (lastNode && lastNode.nodeType === Node.TEXT_NODE) lastNode.textContent = ' Show Options';
        }
    }
    if (note) note.style.display = hiddenChoices[qId] ? 'none' : 'block';
    // ซ่อน/แสดง options canvas ด้วย
    const optionsCanvas = document.getElementById(`options-canvas-${qId}`);
    if (optionsCanvas) optionsCanvas.classList.toggle('hidden', hiddenChoices[qId]);
    // Setup canvas หลังแสดง options
    if (!hiddenChoices[qId]) setTimeout(() => { setupOptionsCanvas(qId); updateCanvasesPointerEvents(); }, 50);
        }
        function toggleTranscript(qId) {
    const q = currentSet?.questions.find(x => x.id === qId);
    if (!q || !q.transcript) return;
    const isOn = !transcriptVisible[qId];
    _togglePanel(transcriptVisible, qId,
        `transcript-box-${qId}`,
        `btn-transcript-${qId}`,
        {
            labelOn:  'Hide Transcript', labelOff: 'Show Transcript',
            iconOn:   'eye-off',         iconOff:  'eye',
            classOn:  'w-full bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 font-medium {sz} rounded-xl transition flex items-center gap-1 mb-2 border border-amber-200',
            classOff: 'w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold {sz} rounded-xl transition flex items-center gap-1 mb-2',
        }
    );
    // ซ่อน/แสดง transcript canvas ด้วย
    const transcriptCanvas = document.getElementById(`transcript-canvas-${qId}`);
    if (transcriptCanvas) transcriptCanvas.classList.toggle('hidden', !isOn);
    // Setup canvas หลังแสดงผล
    console.log('[toggleTranscript] isOn:', isOn, 'currentMode:', currentMode);
    if (isOn) setTimeout(() => setupTranscriptCanvas(qId), 50);
        }
        function toggleGlobalTranscript() {
    const screenQuestions = examScreens[currentIdx];
    const firstTranscriptQ = screenQuestions.find(q => q.transcript?.trim());
    if (!firstTranscriptQ) return;
    const qId = firstTranscriptQ.id;
    transcriptVisible[qId] = !transcriptVisible[qId];
    const isOn = transcriptVisible[qId];
    const box = document.getElementById('global-transcript-box');
    const btn = document.getElementById('btn-global-transcript');
    const transcriptCanvas = document.getElementById('global-transcript-canvas');
    if (box) box.classList.toggle('hidden', !isOn);
    if (transcriptCanvas) transcriptCanvas.classList.toggle('hidden', !isOn);
    if (btn) {
        // Swap classes instead of rebuilding innerHTML
        const onClasses  = new Set('w-full bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 font-medium text-sm px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 border border-amber-200'.split(/\s+/));
        const offClasses = new Set('w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2'.split(/\s+/));
        const onOnly  = [...onClasses].filter(c => !offClasses.has(c));
        const offOnly = [...offClasses].filter(c => !onClasses.has(c));
        if (isOn) {
            offOnly.forEach(c => btn.classList.remove(c));
            onOnly.forEach(c => btn.classList.add(c));
        } else {
            onOnly.forEach(c => btn.classList.remove(c));
            offOnly.forEach(c => btn.classList.add(c));
        }
        // Update icon: replace only the SVG inside the <i> tag (no full re-render)
        const iconI = btn.querySelector('i[data-lucide]');
        if (iconI && window.lucide) {
            const newIcon = lucide.createElement(isOn ? 'eye-off' : 'eye');
            newIcon.setAttribute('class', 'w-4 h-4');
            iconI.replaceChildren(newIcon);
        }
        // Update label text node only
        const lastNode = btn.childNodes[btn.childNodes.length - 1];
        if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
            lastNode.textContent = ' ' + (isOn ? 'Hide Transcript' : 'Show Transcript');
        }
    }
    // Setup canvas หลังแสดงผล
    if (isOn) setTimeout(() => setupGlobalTranscriptCanvas(qId), 50);
        }
        function jumpToQuestion(index) {
            const idx = parseInt(index);
            if (idx >= 0 && idx < examScreens.length) {
                currentIdx = idx;
                renderQuestion();
                document.getElementById('question-panel').scrollTop = 0;
            }
        }
        function setupJumpSelect() {
            const select = document.getElementById('jump-select');
            if (!select) return;
            select.addEventListener('change', function(e) {
                const selected = this.value;
                if (selected) {
                    jumpToQuestion(selected);
                    this.blur(); // ปิด dropdown หลังจากเลือก
                }
            });
        }
        function populateJumpDropdown() {
            const grid = document.getElementById('jump-grid');
            if (!grid) return;
            grid.innerHTML = '';

            let globalQNum = 0;
            examScreens.forEach((screen, idx) => {
                screen.forEach((q, qIdx) => {
                    globalQNum++;
                    const btn = document.createElement('button');
                    btn.textContent = globalQNum;
                    btn.dataset.screenIdx = idx;
                    btn.className = 'w-7 h-7 text-xs font-medium rounded-md transition flex items-center justify-center';

                    if (idx === currentIdx) {
                        btn.className += ' bg-blue-500 text-white shadow-sm';
                    } else {
                        btn.className += ' bg-slate-50 hover:bg-blue-100 text-slate-600 border border-slate-200';
                    }

                    btn.onclick = function() {
                        jumpToQuestion(parseInt(this.dataset.screenIdx));
                        closeJumpDropdown();
                    };
                    grid.appendChild(btn);
                });
            });
        }
        function toggleJumpDropdown() {
            const dropdown = document.getElementById('jump-dropdown');
            if (dropdown.classList.contains('hidden')) {
                dropdown.classList.remove('hidden');
                populateJumpDropdown();
            } else {
                closeJumpDropdown();
            }
        }
        function closeJumpDropdown() {
            const dropdown = document.getElementById('jump-dropdown');
            dropdown.classList.add('hidden');
        }

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('jump-dropdown');
    const btn = document.getElementById('jump-btn');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            closeJumpDropdown();
        }
    }
});

function moveQuestion(step) {
    const next = currentIdx + step;
    if (next >= 0 && next < examScreens.length) {
        currentIdx = next;
        resetAudioPlayer();
        renderQuestion();
        document.getElementById('question-panel').scrollTop = 0;
    }
}

// ===== Viewport Control (Zoom & Pan) =====

const viewportWorkspace = document.getElementById('viewport-workspace');
const zoomableContent = document.getElementById('zoomable-content');
const viewportControls = document.getElementById('viewport-controls');
let wheelResizeTimeout = null;

function viewportApplyTransform() {
    zoomableContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}

function viewportSetScale(newScale) {
    zoomScale = Math.min(Math.max(newScale, 0.5), 4);
    viewportApplyTransform();
}

function viewportZoomIn() {
    viewportSetScale(zoomScale + 0.2);
}

function viewportZoomOut() {
    viewportSetScale(zoomScale - 0.2);
}

function viewportReset() {
    zoomScale = 1; panX = 0; panY = 0;
    viewportApplyTransform();
}

function initViewportControls() {
    if (!viewportWorkspace) return;

    // เหลือไว้แค่ระบบ Spacebar สำหรับสลับเครื่องมือเมาส์/ปากกา (เพื่อไม่ให้กระทบตอนวาดเขียน)
    document.addEventListener('keydown', e => {
        if (e.code === 'Space' && !spaceHeld && document.activeElement.tagName !== 'INPUT') {
            spaceHeld = true;
            if (currentMode !== 'mouse') {
                previousTool = currentMode;
                setTool('mouse');
            }
        }
    });

    document.addEventListener('keyup', e => {
        if (e.code === 'Space') {
            spaceHeld = false;
        }
    });

    viewportWorkspace.addEventListener('contextmenu', e => {
        e.preventDefault();
    });
}

function showViewportControls() {
    if (viewportControls) viewportControls.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function hideViewportControls() {
    if (viewportControls) viewportControls.classList.add('hidden');
}
