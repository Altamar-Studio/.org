let exercises = [];
let currentIndex = 0;
let correctOnFirstTry = 0;
let totalExercises = 0;
let hasFailedCurrent = false;
let currentAnswerState = null; // Used to track user's selected answer

const container = document.getElementById('exercise-container');
const btnCheck = document.getElementById('btn-check');
const btnContinue = document.getElementById('btn-continue');
const progressBar = document.getElementById('progress-bar');
const feedbackBar = document.getElementById('feedback-bar');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackIconContainer = document.getElementById('feedback-icon-container');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackSubtitle = document.getElementById('feedback-subtitle');
const modalGameOver = document.getElementById('modal-game-over');
const modalSuccess = document.getElementById('modal-success');

// --- SOUND FX SYNTHESIZER ---
const SoundFX = {
    ctx: null,
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
    },
    playTone(freq, type, duration, vol=0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    correct() {
        this.init();
        this.playTone(523.25, 'sine', 0.1); // C5
        setTimeout(() => this.playTone(659.25, 'sine', 0.2), 100); // E5
    },
    incorrect() {
        this.init();
        this.playTone(150, 'sawtooth', 0.2);
        setTimeout(() => this.playTone(130, 'sawtooth', 0.3), 150);
    },
    victory() {
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.2, 0.05), i * 150);
        });
    },
    gameOver() {
        this.init();
        const notes = [300, 280, 260, 200];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sawtooth', 0.3, 0.08), i * 200);
        });
    }
};
// ----------------------------

// URL params: ?lang=en&level=a1&unit=1&lesson=0&mode=normal
// If not provided, defaults to English A1 Unit 1 Lesson 0.
function getLessonParams() {
    const p = new URLSearchParams(window.location.search);
    return {
        lang:   p.get('lang')   || 'en',
        level:  p.get('level')  || 'a1',
        unit:   p.get('unit')   || '1',
        lesson: parseInt(p.get('lesson') || '0', 10),
        mode:   p.get('mode')   || 'normal'
    };
}

async function loadExercises() {
    const params = getLessonParams();

    if (params.mode === 'review') {
        await buildReviewLesson(params.lang);
        return;
    }

    const unitFile = `contenido/${params.lang}_${params.level}_u${params.unit}.json`;

    try {
        // ── Intentar cargar el JSON versionado generado por el pipeline ──
        const response = await fetch(unitFile);
        if (!response.ok) throw new Error(`No se encontró: ${unitFile}`);

        const data = await response.json();
        const lesson = data.lessons[params.lesson];

        if (!lesson) throw new Error(`Lección ${params.lesson} no existe en ${unitFile}`);

        exercises = lesson.exercises;
        totalExercises = exercises.length;

        // Actualizar el título en la página si hay un elemento para ello
        const titleEl = document.getElementById('lesson-title');
        if (titleEl) titleEl.textContent = lesson.title;

        renderExercise();
        updateProgress();

    } catch (e) {
        console.warn(`[leccion.js] ${e.message}. Usando datos de respaldo...`);

        // ── Fallback: leer del archivo original (placeholder) ──
        try {
            const fallback = await fetch('idiomas-ejercicios.json');
            const data = await fallback.json();
            exercises = data.unit1.lessons[0].exercises;
            totalExercises = exercises.length;
            renderExercise();
            updateProgress();
        } catch (e2) {
            console.error("Error cargando ejercicios:", e2);
            container.innerHTML = '<p class="text-center mt-10 opacity-60">Error al cargar los ejercicios.</p>';
        }
    }
}

async function buildReviewLesson(lang) {
    const weakVocab = getWeakestVocab(lang, 10);
    if (weakVocab.length === 0) {
        container.innerHTML = '<p class="text-center mt-10 opacity-60 font-bold text-xl">Aún no hay palabras suficientes para repasar. ¡Completa algunas lecciones primero!</p>';
        btnCheck.classList.add('hidden');
        return;
    }

    const weakWords = weakVocab.map(v => v.word);
    let allReviewExercises = [];
    
    // Scan locally available unit JSONs for these words (Assuming units 1-6 max for A1)
    for (let i = 1; i <= 6; i++) {
        try {
            const res = await fetch(`contenido/${lang}_a1_u${i}.json`);
            if (res.ok) {
                const data = await res.json();
                data.lessons.forEach(lesson => {
                    lesson.exercises.forEach(ex => {
                        const wordTarget = ex.target_vocab || (ex.vocab && ex.vocab.word);
                        if (wordTarget && weakWords.includes(wordTarget)) {
                            allReviewExercises.push(ex);
                        }
                    });
                });
            }
        } catch (e) {
            // Ignore missing files gracefully
        }
    }
    
    // Shuffle and pick 10
    allReviewExercises = allReviewExercises.sort(() => Math.random() - 0.5);
    
    // Deduplicate so we don't ask the exact same exercise ID twice
    const uniqueExercises = [];
    const seenIds = new Set();
    for (const ex of allReviewExercises) {
        if (!seenIds.has(ex.id)) {
            seenIds.add(ex.id);
            uniqueExercises.push(ex);
        }
    }

    exercises = uniqueExercises.slice(0, 7); // 7 questions per review
    
    if (exercises.length === 0) {
        container.innerHTML = '<p class="text-center mt-10 opacity-60 font-bold text-xl">No hay suficientes ejercicios generados para repasar.</p>';
        btnCheck.classList.add('hidden');
        return;
    }
    
    totalExercises = exercises.length;
    
    const titleEl = document.getElementById('lesson-title');
    if (titleEl) titleEl.textContent = 'Práctica Personalizada';
    
    renderExercise();
    updateProgress();
}


function updateProgress() {
    const percent = (currentIndex / exercises.length) * 100;
    progressBar.style.width = `${percent}%`;
}

function updateLives() {
    if (livesCounter) {
        livesCounter.textContent = lives + '/5';
    }
    if (lives <= 0) {
        SoundFX.gameOver();
        modalGameOver.classList.remove('hidden');
        modalGameOver.classList.add('flex');
    }
}

function renderExercise() {
    container.classList.remove('animate-fade-in');
    void container.offsetWidth; // trigger reflow
    container.classList.add('animate-fade-in');

    if (currentIndex >= exercises.length) {
        // Win state
        
        updateProgress();
        
        // Calculate XP, Accuracy and Stars
        const accuracy = Math.round((correctOnFirstTry / totalExercises) * 100);
        const xpEarned = 10 + (correctOnFirstTry * 2); // 10 base + 2 per perfect answer
        
        let starsEarned = 1;
        if (accuracy >= 90) starsEarned = 3;
        else if (accuracy >= 60) starsEarned = 2;
        
        // Save to Profile (XP, streak, achievements)
        const result = recordLessonCompletion(xpEarned, accuracy);

        const params = getLessonParams();
        if (params.mode !== 'review') {
            // Mark this specific lesson as completed and save stars
            recordLessonCompleted(params.lang, params.level, params.unit, params.lesson, starsEarned);
        }

        // Populate Summary UI
        const summaryXpEl = document.getElementById('summary-xp');
        if (summaryXpEl) summaryXpEl.textContent = `+${xpEarned}`;
        
        const summaryAccuracyEl = document.getElementById('summary-accuracy');
        if (summaryAccuracyEl) summaryAccuracyEl.textContent = `${accuracy}%`;
        
        const summaryStreakEl = document.getElementById('summary-streak');
        if (summaryStreakEl) summaryStreakEl.textContent = `${result.newStreak} Días`;
        
        // Show achievements if any
        if (result.newAchievements.length > 0) {
            const achContainer = document.getElementById('achievements-container');
            const achList = document.getElementById('achievements-list');
            achContainer.classList.remove('hidden');
            result.newAchievements.forEach(ach => {
                achList.innerHTML += `
                    <div class="flex items-center gap-3 bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 p-3 rounded-xl shadow-sm animate-pop">
                        <span class="text-2xl">${ach.icon}</span>
                        <div class="text-left">
                            <span class="block font-bold text-sm text-ea-dark dark:text-white">${ach.name}</span>
                            <span class="text-xs opacity-60">${ach.desc}</span>
                        </div>
                    </div>
                `;
            });
        }

        // Celebrate Confetti logic using canvas-confetti
        if (window.confetti) {
            var duration = 3000;
            var end = Date.now() + duration;
            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
                });
                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
        
        SoundFX.victory();

        modalSuccess.classList.remove('hidden');
        modalSuccess.classList.add('flex');
        
        // Animate stars
        const starIcons = document.querySelectorAll('#success-stars-container .star-icon');
        starIcons.forEach((el, idx) => {
            if (idx < starsEarned) {
                setTimeout(() => {
                    el.classList.remove('grayscale', 'opacity-30');
                    el.classList.add('animate-star-pop', 'text-yellow-400');
                }, 400 + (idx * 300));
            }
        });
        
        return;

    }

    const ex = exercises[currentIndex];
    currentAnswerState = null;
    hasFailedCurrent = false;
    disableCheckBtn();
    hideFeedback();

    // Use 'prompt' (new schema) with fallback to 'question' (legacy placeholder)
    const questionText = ex.question || ex.prompt || '';
    let html = `<div class="mb-8">
        <h2 class="text-2xl sm:text-3xl font-bold text-ea-dark dark:text-white">${questionText}</h2>`;
    
    if (ex.spanish_translation) {
        html += `<p class="text-sm font-medium text-gray-500 dark:text-neutral-400 mt-2">${ex.spanish_translation}</p>`;
    }
    
    html += `</div>`;

    if (ex.image) {
        html += `<div class="mb-6 w-full max-w-sm mx-auto rounded-3xl overflow-hidden shadow-sm border border-black/5"><img src="${ex.image}" alt="Imagen del ejercicio" class="w-full h-auto object-cover"/></div>`;
    }

    if (ex.type === 'multiple_choice') {
        
        // New schema: answer + distractors. Legacy: options array.
        const correctAnswer = ex.correct_answer || ex.answer;
        const mcOptions = ex.options && ex.options.length
            ? ex.options
            : [correctAnswer, ...(ex.distractors || [])].sort(() => Math.random() - 0.5);
            
        html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">`;
        mcOptions.forEach((opt) => {
            html += `<button class="opt-btn bg-white dark:bg-neutral-900 border-2 border-black/10 dark:border-white/10 rounded-2xl p-4 sm:p-6 text-lg font-medium text-center shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-blue-300 dark:hover:border-blue-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" data-val="${opt}" aria-label="Opción: ${opt}">${opt}</button>`;
        });
        html += `</div>`;
    } 
    else if (ex.type === 'fill_in_blank') {
        // New schema: blank is inside ex.prompt as "_______". Legacy: ex.phrase with '_____'.
        const blankSource = ex.phrase || ex.prompt || '';
        // Normalize any sequence of underscores to a single marker
        const normalized = blankSource.replace(/_{3,}/g, '_____');
        const parts = normalized.includes('_____') ? normalized.split('_____') : ['', ''];
        html += `<div class="text-2xl sm:text-3xl font-medium mb-8 flex flex-wrap items-center gap-2">`;
        html += `<span>${parts[0]}</span>`;
        html += `<button id="dropzone" aria-label="Espacio para completar, presiona para vaciar" class="border-b-4 border-dashed border-gray-400 dark:border-gray-600 min-w-[8rem] h-10 mx-2 flex items-center justify-center text-blue-600 font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"></button>`;
        html += `<span>${parts[1] || ''}</span>`;
        html += `</div>`;
        // Word bank: use options (both schemas agree on this field)
        const fibOptions = ex.options && ex.options.length ? ex.options : [ex.correct_answer || ex.answer];
        html += `<div class="flex flex-wrap gap-4" id="word-bank">`;
        fibOptions.forEach(opt => {
            html += `<button class="word-btn border-2 border-black/10 dark:border-white/10 rounded-xl px-6 py-3 font-bold text-lg shadow-sm hover:shadow-md hover:-translate-y-1 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500" data-val="${opt}" aria-label="Palabra: ${opt}">${opt}</button>`;
        });
        html += `</div>`;
    }
    else if (ex.type === 'translate') {
        // New schema: the phrase to translate is in ex.prompt (e.g. "Traduce: 'I am Ana.'")
        // Extract text in quotes if present, otherwise use the whole prompt as the phrase.
        const phraseMatch = (ex.question || ex.prompt || '').match(/['“«](.+?)['”»]/);
        const displayPhrase = ex.phrase || (phraseMatch ? phraseMatch[1] : (ex.question || ex.prompt)) || '';
        html += `<div class="flex items-start gap-4 mb-8">
                    <div class="border-2 border-black/10 dark:border-white/10 rounded-3xl p-5 font-medium text-xl bg-white dark:bg-neutral-900 shadow-sm relative w-full text-center">
                        ${displayPhrase}
                    </div>
                 </div>`;
        html += `<textarea id="translate-input" aria-label="Escribe tu traducción aquí" class="w-full bg-gray-50 dark:bg-neutral-900 border-2 border-black/10 dark:border-white/10 rounded-2xl p-4 text-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-inner resize-none" rows="3" placeholder="Escribe tu traducción..."></textarea>`;
        
        // Teclado virtual si aplica
        const p = getLessonParams();
        if (p.lang === 'fr') {
            const chars = ['é', 'è', 'ç', 'à', 'ù', 'â', 'ê', 'î', 'ô', 'û'];
            html += `<div class="flex flex-wrap gap-2 mt-4 justify-center" id="virtual-keyboard">`;
            chars.forEach(c => html += `<button class="vk-btn focus:outline-none focus:ring-2 focus:ring-blue-500" data-char="${c}">${c}</button>`);
            html += `</div>`;
        } else if (p.lang === 'ja') {
            // Ejemplo reducido para A1
            const chars = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'ー', '。', '、'];
            html += `<div class="flex flex-wrap gap-2 mt-4 justify-center" id="virtual-keyboard">`;
            chars.forEach(c => html += `<button class="vk-btn focus:outline-none focus:ring-2 focus:ring-blue-500" data-char="${c}">${c}</button>`);
            html += `</div>`;
        }
    }
    else if (ex.type === 'order_words') {
        // New schema uses 'options' for the shuffled word bank; legacy used 'words'.
        const wordBank = ex.word_bank || ex.options || ex.words || [];
        // Shuffle to avoid showing words in the correct order
        const shuffled = [...wordBank].sort(() => Math.random() - 0.5);
        html += `<div id="dropzone" role="list" aria-label="Oración formada" class="border-b-2 border-black/10 dark:border-white/10 min-h-[60px] mb-8 flex flex-wrap gap-2 pb-2"></div>`;
        html += `<div class="flex flex-wrap gap-2" id="word-bank">`;
        shuffled.forEach(w => {
            html += `<button class="order-word-btn border-2 border-black/10 dark:border-white/10 rounded-xl px-4 py-2 font-bold text-md shadow-sm hover:shadow-md transition-all bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500" data-val="${w}" aria-label="Palabra: ${w}">${w}</button>`;
        });
        html += `</div>`;
    }
    else if (ex.type === 'match_pairs') {
        let allItems = [];
        ex.pairs.forEach(p => {
            allItems.push({ val: p.left || p.a, type: 'a' });
            allItems.push({ val: p.right || p.b, type: 'b' });
        });
        allItems = allItems.sort(() => Math.random() - 0.5);
        html += `<div class="grid grid-cols-2 gap-4">`;
        allItems.forEach(item => {
            html += `<button class="match-btn border-2 border-black/10 dark:border-white/10 rounded-2xl p-4 font-medium text-lg hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" data-val="${item.val}" aria-label="Opción: ${item.val}">${item.val}</button>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
    attachExerciseEvents(ex);
}

function attachExerciseEvents(ex) {
    if (ex.type === 'multiple_choice') {
        const btns = container.querySelectorAll('.opt-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => {
                    b.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                    b.classList.add('border-black/10', 'dark:border-white/10');
                });
                btn.classList.remove('border-black/10', 'dark:border-white/10');
                btn.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
                currentAnswerState = btn.dataset.val;
                enableCheckBtn();
            });
        });
    } 
    else if (ex.type === 'fill_in_blank') {
        const btns = container.querySelectorAll('.word-btn');
        const dropzone = document.getElementById('dropzone');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Return previous word to bank
                if (currentAnswerState) {
                    const prevBtn = document.querySelector(`.word-btn[data-val="${currentAnswerState}"]`);
                    if(prevBtn) prevBtn.classList.remove('opacity-0', 'pointer-events-none');
                }
                currentAnswerState = btn.dataset.val;
                dropzone.textContent = currentAnswerState;
                dropzone.classList.remove('border-dashed', 'border-gray-400');
                dropzone.classList.add('border-solid', 'border-blue-500');
                btn.classList.add('opacity-0', 'pointer-events-none'); // Hide from bank
                enableCheckBtn();
            });
        });
        dropzone.addEventListener('click', () => {
            if (currentAnswerState) {
                const prevBtn = document.querySelector(`.word-btn[data-val="${currentAnswerState}"]`);
                if(prevBtn) prevBtn.classList.remove('opacity-0', 'pointer-events-none');
                currentAnswerState = null;
                dropzone.textContent = '';
                dropzone.classList.add('border-dashed', 'border-gray-400');
                dropzone.classList.remove('border-solid', 'border-blue-500');
                disableCheckBtn();
            }
        });
    }
    else if (ex.type === 'translate') {
        const input = document.getElementById('translate-input');
        input.addEventListener('input', () => {
            currentAnswerState = input.value.trim();
            if (currentAnswerState.length > 0) enableCheckBtn();
            else disableCheckBtn();
        });
        
        const vkBtns = container.querySelectorAll('.vk-btn');
        vkBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                input.value += btn.dataset.char;
                input.focus();
                currentAnswerState = input.value.trim();
                enableCheckBtn();
                
                btn.classList.remove('animate-pop');
                void btn.offsetWidth;
                btn.classList.add('animate-pop');
            });
        });
    }
    else if (ex.type === 'order_words') {
        const btns = container.querySelectorAll('.order-word-btn');
        const dropzone = document.getElementById('dropzone');
        const bank = document.getElementById('word-bank');
        let selectedWords = [];
        
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.remove('animate-pop');
                void btn.offsetWidth;
                btn.classList.add('animate-pop');

                if(btn.parentElement.id === 'word-bank') {
                    dropzone.appendChild(btn);
                    selectedWords.push(btn.dataset.val);
                } else {
                    bank.appendChild(btn);
                    selectedWords = selectedWords.filter(w => w !== btn.dataset.val);
                }
                currentAnswerState = selectedWords;
                if(selectedWords.length > 0) enableCheckBtn();
                else disableCheckBtn();
            });
        });
    }
    else if (ex.type === 'match_pairs') {
        const btns = container.querySelectorAll('.match-btn');
        let selectedA = null;
        let matchedPairsCount = 0;
        
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                if(btn.classList.contains('opacity-0')) return; // Already matched
                
                if(!selectedA) {
                    selectedA = btn;
                    btn.classList.add('border-blue-500', 'bg-blue-50');
                } else if(selectedA === btn) {
                    selectedA = null;
                    btn.classList.remove('border-blue-500', 'bg-blue-50');
                } else {
                    // Check if match
                    let isMatch = false;
                    ex.pairs.forEach(p => {
                        const leftVal = p.left || p.a;
                        const rightVal = p.right || p.b;
                        if ((leftVal === selectedA.dataset.val && rightVal === btn.dataset.val) ||
                            (rightVal === selectedA.dataset.val && leftVal === btn.dataset.val)) {
                            isMatch = true;
                        }
                    });
                    
                    if(isMatch) {
                        btn.classList.add('border-green-500', 'bg-green-50');
                        selectedA.classList.remove('border-blue-500', 'bg-blue-50');
                        selectedA.classList.add('border-green-500', 'bg-green-50');
                        
                        setTimeout(() => {
                            btn.classList.add('opacity-0', 'pointer-events-none');
                            selectedA.classList.add('opacity-0', 'pointer-events-none');
                            selectedA = null;
                            matchedPairsCount++;
                            if(matchedPairsCount === ex.pairs.length) {
                                currentAnswerState = "done";
                                enableCheckBtn();
                                // Auto check
                                checkAnswer();
                            }
                        }, 500);
                    } else {
                        // Wrong match shake
                        btn.classList.add('animate-shake', 'border-red-500');
                        selectedA.classList.add('animate-shake', 'border-red-500');
                        setTimeout(() => {
                            btn.classList.remove('animate-shake', 'border-red-500');
                            selectedA.classList.remove('animate-shake', 'border-red-500', 'border-blue-500', 'bg-blue-50');
                            selectedA = null;
                        }, 500);}
                }
            });
        });
    }
}

function enableCheckBtn() {
    btnCheck.classList.remove('bg-gray-200', 'text-gray-400', 'dark:bg-neutral-800', 'dark:text-neutral-500', 'cursor-not-allowed');
    btnCheck.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
}

function disableCheckBtn() {
    btnCheck.classList.add('bg-gray-200', 'text-gray-400', 'dark:bg-neutral-800', 'dark:text-neutral-500', 'cursor-not-allowed');
    btnCheck.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
}

btnCheck.addEventListener('click', () => {
    if(btnCheck.classList.contains('cursor-not-allowed')) return;
    checkAnswer();
});

function checkAnswer() {
    const ex = exercises[currentIndex];
    let isCorrect = false;
    let correctAnswerStr = "";
    
    const correctAnswer = ex.correct_answer || ex.answer;

    if (ex.type === 'multiple_choice' || ex.type === 'fill_in_blank') {
        isCorrect = (currentAnswerState === correctAnswer);
        correctAnswerStr = correctAnswer;
    } 
    else if (ex.type === 'translate') {
        let normInput = currentAnswerState.toLowerCase().replace(/[.,!?¿¡]/g, '');
        let accepted = [correctAnswer.toLowerCase().replace(/[.,!?¿¡]/g, '')];
        const acceptedList = ex.accepted_answers || ex.accepted || [];
        acceptedList.forEach(a => accepted.push(a.toLowerCase().replace(/[.,!?¿¡]/g, '')));
        isCorrect = accepted.includes(normInput);
        correctAnswerStr = correctAnswer;
    }
    else if (ex.type === 'order_words') {
        const correctArr = typeof correctAnswer === 'string' ? correctAnswer.split(' ') : correctAnswer;
        isCorrect = JSON.stringify(currentAnswerState) === JSON.stringify(correctArr);
        correctAnswerStr = Array.isArray(correctAnswer) ? correctAnswer.join(" ") : correctAnswer;
    }
    else if (ex.type === 'match_pairs') {
        isCorrect = true; // Auto checked during interactions
    }

    if (isCorrect) {
        if (!hasFailedCurrent) correctOnFirstTry++;
        showFeedback(true);
    } else {
        hasFailedCurrent = true;// Animar el ícono de corazón roto
        const heartIcon = document.getElementById('ui-heart-icon');
        if (heartIcon) {
            heartIcon.classList.remove('animate-heart-break');
            void heartIcon.offsetWidth;
            heartIcon.classList.add('animate-heart-break');
            setTimeout(() => {
                heartIcon.classList.remove('animate-heart-break');}, 600);
        } else {}
        
        container.classList.add('animate-shake');
        setTimeout(() => container.classList.remove('animate-shake'), 400);
        showFeedback(false, correctAnswerStr);
    }
    
    // TRACKING MASTERY
    const wordTarget = ex.target_vocab || (ex.vocab && ex.vocab.word);
    if (wordTarget) {
        const params = getLessonParams();
        if (typeof recordVocabAttempt === 'function') {
            if (!ex._masteryRecorded) {
                recordVocabAttempt(params.lang, wordTarget, isCorrect);
                ex._masteryRecorded = true;
            }
        }
    }
}

function showFeedback(isCorrect, correctStr = "") {
    const checkBar = document.getElementById('check-bar');

    feedbackBar.classList.remove('hidden',
        'bg-green-500', 'dark:bg-green-700',
        'bg-red-500', 'dark:bg-red-700',
        'text-white');
    btnContinue.classList.remove('bg-white', 'text-green-700', 'bg-white', 'text-red-700');

    if (isCorrect) {
        SoundFX.correct();
        // Screen Flash Green
        document.body.classList.add('flash-green');
        setTimeout(() => document.body.classList.remove('flash-green'), 300);
        
        feedbackBar.classList.add('bg-green-500', 'dark:bg-green-700', 'text-white');
        btnContinue.classList.add('bg-white', 'text-green-700');
        feedbackIconContainer.className = 'w-12 h-12 rounded-full flex items-center justify-center bg-white/20 shrink-0';
        feedbackIcon.textContent = 'check';
        feedbackTitle.textContent = '¡Correcto!';
        feedbackSubtitle.classList.add('hidden');
    } else {
        SoundFX.incorrect();
        // Screen Shake and Flash Red
        const mainContainer = document.querySelector('main');
        if(mainContainer) {
            mainContainer.classList.add('shake-horizontal');
            setTimeout(() => mainContainer.classList.remove('shake-horizontal'), 500);
        }
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 300);

        feedbackBar.classList.add('bg-red-500', 'dark:bg-red-700', 'text-white');
        btnContinue.classList.add('bg-white', 'text-red-700');
        feedbackIconContainer.className = 'w-12 h-12 rounded-full flex items-center justify-center bg-white/20 shrink-0';
        feedbackIcon.textContent = 'close';
        feedbackTitle.textContent = 'Respuesta incorrecta';
        feedbackSubtitle.textContent = `Solución: ${correctStr}`;
        feedbackSubtitle.classList.remove('hidden');
    }

    feedbackBar.classList.add('flex', 'show');
    if (checkBar) checkBar.classList.add('hidden');
}

function hideFeedback() {
    const checkBar = document.getElementById('check-bar');
    feedbackBar.classList.remove('flex', 'show');
    feedbackBar.classList.add('hidden');
    if (checkBar) checkBar.classList.remove('hidden');
}

btnContinue.addEventListener('click', () => {
    // If correct, move next. If wrong, we can just move next for this demo, or re-push to end of queue.
    // Duolingo pushes wrong answers to the end. Let's do that.
    if(feedbackTitle.textContent === 'Respuesta incorrecta') {
        const failedEx = exercises.splice(currentIndex, 1)[0];
        exercises.push(failedEx);
        // Do not increment currentIndex, so we render the next one in the queue
    } else {
        currentIndex++;
    }
    renderExercise();
    updateProgress();
});

// Init
loadExercises();


document.addEventListener(keydown, (e) => {
    if(e.key === Enter) {
        if(!feedbackBar.classList.contains(hidden)) {
            btnContinue.click();
        } else if(!btnCheck.classList.contains(cursor-not-allowed)) {
            // Check if focus is on textarea, to avoid submitting when pressing enter in textarea
            if(document.activeElement && document.activeElement.tagName === TEXTAREA) return;
            btnCheck.click();
        }
    }
});
