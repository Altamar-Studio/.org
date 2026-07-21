// ==========================================================
// Application State
// ==========================================================
let allQuestions = [];       // Full set of 90 questions loaded from JSON
let activeQuestions = [];    // The subset currently being answered (all or section)
let currentQuestionIndex = 0; // Index in the activeQuestions array

let userName = "Estudiante";
let examMode = "sim";        // "sim" (timed) or "practice" (immediate feedback)
let examRange = "all";       // "all", "s1" (1-30), "s2" (31-60), "s3" (61-90)

let userAnswers = {};        // Maps global question number -> selected option ("A", "B", "C")
let flaggedQuestions = new Set(); // Stores global question numbers that are flagged

// Timer state
let timerInterval = null;
let timeRemaining = 0;       // Seconds remaining
let totalDuration = 0;       // Total duration in seconds
let startTime = null;
let timeElapsed = 0;

let isReviewMode = false;

// ==========================================================
// DOM Element References
// ==========================================================
const welcomeScreen = document.getElementById("welcome-screen");
const examScreen = document.getElementById("exam-screen");
const resultsScreen = document.getElementById("results-screen");

// Setup Form Elements
const setupForm = document.getElementById("setup-form");
const studentNameInput = document.getElementById("student-name");
const examModeSelect = document.getElementById("exam-mode");
const examRangeSelect = document.getElementById("exam-range");
const infoReactivosCount = document.getElementById("info-reactivos-count");
const infoTimeLimit = document.getElementById("info-time-limit");

// Exam Header Elements
const displayStudentName = document.getElementById("display-student-name");
const displaySectionName = document.getElementById("display-section-name");
const timerContainer = document.getElementById("exam-timer");
const timerText = document.getElementById("timer-text");
const statAnswered = document.getElementById("stat-answered");
const statFlagged = document.getElementById("stat-flagged");
const btnFinishExam = document.getElementById("btn-finish-exam");

// Exam Content Elements
const examLayout = document.querySelector(".exam-layout");
const readingPanel = document.getElementById("reading-panel");
const readingTitle = document.getElementById("reading-title");
const readingBody = document.getElementById("reading-body");
const qNumberDisplay = document.getElementById("q-number-display");
const btnFlagQuestion = document.getElementById("btn-flag-question");
const questionText = document.getElementById("question-text");
const diagramContainer = document.getElementById("question-diagram-container");
const questionDiagram = document.getElementById("question-diagram");
const optionsContainer = document.getElementById("options-container");
const practiceFeedback = document.getElementById("practice-feedback");

// Exam Footer Navigation Elements
const btnPrevQuestion = document.getElementById("btn-prev-question");
const btnNextQuestion = document.getElementById("btn-next-question");
const btnShowGrid = document.getElementById("btn-show-grid");
const navDrawer = document.getElementById("nav-drawer");
const btnCloseDrawer = document.getElementById("btn-close-drawer");
const drawerGrid = document.getElementById("drawer-grid");

// Results Elements
const resultsStudentGreet = document.getElementById("results-student-greet");
const scoreCorrectFraction = document.getElementById("score-correct-fraction");
const scorePercentage = document.getElementById("score-percentage");
const scoreRingProgress = document.getElementById("score-ring-progress");
const resCorrect = document.getElementById("res-correct");
const resIncorrect = document.getElementById("res-incorrect");
const resUnanswered = document.getElementById("res-unanswered");
const cenevalScoreDisplay = document.getElementById("ceneval-score-display");
const cenevalPerformanceBadge = document.getElementById("ceneval-performance-badge");
const resTimeSpent = document.getElementById("res-time-spent");

// Section Breakdowns
const sec1ScoreText = document.getElementById("sec1-score-text");
const sec1ProgressFill = document.getElementById("sec1-progress-fill");
const sec2ScoreText = document.getElementById("sec2-score-text");
const sec2ProgressFill = document.getElementById("sec2-progress-fill");
const sec3ScoreText = document.getElementById("sec3-score-text");
const sec3ProgressFill = document.getElementById("sec3-progress-fill");

// Actions
const btnRestart = document.getElementById("btn-restart");
const btnReviewAnswers = document.getElementById("btn-review-answers");

// Modals
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImg = document.getElementById("lightbox-img");
const btnCloseLightbox = document.getElementById("btn-close-lightbox");

const confirmModal = document.getElementById("confirm-modal");
const modalStatAnswered = document.getElementById("modal-stat-answered");
const modalStatUnanswered = document.getElementById("modal-stat-unanswered");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const btnConfirmModal = document.getElementById("btn-confirm-modal");

// ==========================================================
// Initialization & Database Load
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  // Theme initialization
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
  }

  // Theme toggle listener
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  // Load questions database
  fetchQuestions();

  // Welcome Form controls listener
  examRangeSelect.addEventListener("change", updateRangeDetails);
  setupForm.addEventListener("submit", validateAndStart);

  // Exam navigation listeners
  btnPrevQuestion.addEventListener("click", prevQuestion);
  btnNextQuestion.addEventListener("click", nextQuestion);
  btnFlagQuestion.addEventListener("click", toggleFlag);
  btnFinishExam.addEventListener("click", openConfirmModal);

  // Drawer events
  btnShowGrid.addEventListener("click", () => navDrawer.classList.add("open"));
  btnCloseDrawer.addEventListener("click", () => navDrawer.classList.remove("open"));

  // Lightbox Zoom events
  diagramContainer.addEventListener("click", () => openLightbox(questionDiagram.src));
  btnCloseLightbox.addEventListener("click", closeLightbox);
  lightboxModal.addEventListener("click", (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });

  // Modal events
  btnCancelModal.addEventListener("click", closeConfirmModal);
  btnConfirmModal.addEventListener("click", () => {
    closeConfirmModal();
    submitExam();
  });

  // Results screen actions
  btnRestart.addEventListener("click", restartExam);
  btnReviewAnswers.addEventListener("click", reviewAnswers);
});

// Fetch questions from the compiled JSON file
function fetchQuestions() {
  try {
    if (typeof allQuestionsData !== "undefined") {
      allQuestions = allQuestionsData;
      console.log(`Cargadas ${allQuestions.length} preguntas correctamente.`);
    } else {
      throw new Error("allQuestionsData is undefined");
    }
  } catch (error) {
    console.error("Error al leer simulador-uv-questions.js:", error);
    alert("Error al cargar la base de datos de preguntas. Verifica que simulador-uv-questions.js exista.");
  }
}

// Update Welcome UI depending on range selection
function updateRangeDetails() {
  const range = examRangeSelect.value;
  let qCount = 90;
  let timeLimit = "3h 00m";

  if (range === "s1" || range === "s2" || range === "s3") {
    qCount = 30;
    timeLimit = "1h 00m";
  }

  infoReactivosCount.textContent = qCount;
  infoTimeLimit.textContent = timeLimit;
}

// Theme toggler
function toggleTheme() {
  if (document.body.classList.contains("dark-theme")) {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
    localStorage.setItem("theme", "light");
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
    localStorage.setItem("theme", "dark");
  }
}

// ==========================================================
// Setup & Start Exam
// ==========================================================
function validateAndStart() {
  userName = studentNameInput.value.trim() || "Estudiante";
  examMode = examModeSelect.value;
  examRange = examRangeSelect.value;

  if (allQuestions.length === 0) {
    alert("Las preguntas aún no han cargado. Inténtalo de nuevo en unos segundos.");
    return;
  }

  // Filter questions based on selected range
  if (examRange === "all") {
    activeQuestions = [...allQuestions];
  } else if (examRange === "s1") {
    activeQuestions = allQuestions.filter(q => q.number >= 1 && q.number <= 30);
  } else if (examRange === "s2") {
    activeQuestions = allQuestions.filter(q => q.number >= 31 && q.number <= 60);
  } else if (examRange === "s3") {
    activeQuestions = allQuestions.filter(q => q.number >= 61 && q.number <= 90);
  }

  // Reset exam states
  userAnswers = {};
  flaggedQuestions.clear();
  currentQuestionIndex = 0;
  isReviewMode = false;

  // Set up timer duration
  if (examRange === "all") {
    totalDuration = 3 * 60 * 60; // 3 hours
  } else {
    totalDuration = 1 * 60 * 60; // 1 hour
  }
  timeRemaining = totalDuration;
  startTime = Date.now();

  // Populate Header UI
  displayStudentName.textContent = userName;
  document.querySelectorAll(".total-q-label").forEach(el => el.textContent = activeQuestions.length);

  // Set up grid sidebar
  buildDrawerGrid();

  // Show/Hide timer depending on Mode
  if (examMode === "practice") {
    timerContainer.style.display = "none";
  } else {
    timerContainer.style.display = "flex";
    timerContainer.classList.remove("warning");
    formatAndDisplayTimer();
    startTimerInterval();
  }

  // Transitions
  welcomeScreen.classList.remove("active");
  examScreen.classList.add("active");

  // Load first question
  renderQuestion(currentQuestionIndex);
  updateStats();
}

// Build Sidebar Navigator Grid
function buildDrawerGrid() {
  drawerGrid.innerHTML = "";
  activeQuestions.forEach((q, idx) => {
    const btn = document.createElement("button");
    btn.className = "grid-btn w-full aspect-square rounded-xl border border-black/10 dark:border-white/10 text-xs font-bold transition-all flex items-center justify-center bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700";
    btn.id = `grid-btn-${idx}`;
    btn.textContent = q.number;
    btn.addEventListener("click", () => {
      currentQuestionIndex = idx;
      renderQuestion(idx);
      navDrawer.classList.remove("open");
    });
    drawerGrid.appendChild(btn);
  });
}

// ==========================================================
// Timer Logic
// ==========================================================
function startTimerInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeRemaining--;
    formatAndDisplayTimer();

    // 15 Minutes Warning
    if (timeRemaining <= 900) {
      timerContainer.classList.add("warning");
    }

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      alert("¡El tiempo límite ha terminado! Tu examen se enviará automáticamente.");
      submitExam();
    }
  }, 1000);
}

function formatAndDisplayTimer() {
  const h = Math.floor(timeRemaining / 3600);
  const m = Math.floor((timeRemaining % 3600) / 60);
  const s = timeRemaining % 60;
  
  const paddedH = String(h).padStart(2, "0");
  const paddedM = String(m).padStart(2, "0");
  const paddedS = String(s).padStart(2, "0");

  timerText.textContent = `${paddedH}:${paddedM}:${paddedS}`;
}

// ==========================================================
// Renderer: Render Question
// ==========================================================
function renderQuestion(index) {
  if (index < 0 || index >= activeQuestions.length) return;
  const q = activeQuestions[index];

  // 1. Update active states in Sidebar Grid
  document.querySelectorAll(".grid-btn").forEach((btn, idx) => {
    btn.classList.remove("current");
    if (idx === index) btn.classList.add("current");
  });

  // 2. Question Info Header
  qNumberDisplay.textContent = q.number;
  displaySectionName.textContent = q.section;

  // 3. Flag Status Button
  const spans = btnFlagQuestion.querySelectorAll("span");
  const textSpan = spans.length > 1 ? spans[1] : spans[0];
  
  if (flaggedQuestions.has(q.number)) {
    btnFlagQuestion.classList.add("flagged");
    textSpan.textContent = "Marcada";
  } else {
    btnFlagQuestion.classList.remove("flagged");
    textSpan.textContent = "Marcar";
  }

  // 4. Reading Panel Toggle
  if (q.reading_text && q.reading_title) {
    examLayout.classList.add("with-reading");
    readingPanel.style.display = "block";
    readingTitle.textContent = q.reading_title;
    
    // Format text replacing double-newlines with paragraph tags for clean layout
    const formattedParagraphs = q.reading_text
      .split("\n\n")
      .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    readingBody.innerHTML = formattedParagraphs;
    // Scroll reading to top
    readingBody.scrollTop = 0;
  } else {
    examLayout.classList.remove("with-reading");
    readingPanel.style.display = "none";
  }

  // 5. Question Text
  function renderMarkdownText(text) {
    if (!text.includes('|---|') && !text.includes('|--- |')) return text.replace(/\n/g, "<br>");
    const lines = text.split('\n');
    let inTable = false;
    let html = '';
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.trim().startsWith('|') && line.includes('|')) {
            if (line.includes('|---|') || line.includes('|---')) continue;
            const cells = line.split('|').map(c => c.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length-1] === '') cells.pop();
            
            if (!inTable) {
                html += '<div class="overflow-x-auto my-4 w-full"><table class="w-full text-sm text-left border border-black/10 rounded-lg overflow-hidden">';
                html += '<thead class="bg-neutral-100 font-bold"><tr>' + cells.map(c => `<th class="px-4 py-2 border-b border-black/10">${c}</th>`).join('') + '</tr></thead><tbody class="divide-y divide-black/5">';
                inTable = true;
            } else {
                html += '<tr>' + cells.map(c => `<td class="px-4 py-2">${c}</td>`).join('') + '</tr>';
            }
        } else {
            if (inTable) {
                html += '</tbody></table></div>';
                inTable = false;
            }
            html += line + '<br>';
        }
    }
    if (inTable) html += '</tbody></table></div>';
    return html;
  }
  questionText.innerHTML = renderMarkdownText(q.text);

  // 6. Question Diagrams (including secondary diagram if present)
  // Clear any dynamic/extra elements inside diagramContainer first
  diagramContainer.querySelectorAll(".dynamic-diagram").forEach(el => el.remove());
  
  if (q.diagram) {
    diagramContainer.classList.remove("hidden");
    questionDiagram.src = `cropped_assets/${q.diagram}`;
    
    // Check if there is a secondary option_diagram or multi-curves diagram (e.g. Q90)
    if (q.option_diagrams && q.option_diagrams.all_curves) {
      const secWrapper = document.createElement("div");
      secWrapper.className = "diagram-zoom-wrapper dynamic-diagram";
      secWrapper.style.marginTop = "0.75rem";
      
      const secImg = document.createElement("img");
      secImg.src = `cropped_assets/${q.option_diagrams.all_curves}`;
      secImg.alt = "Diagrama secundario";
      
      secWrapper.appendChild(secImg);
      secWrapper.addEventListener("click", () => openLightbox(secImg.src));
      
      // Insert before the caption
      diagramContainer.insertBefore(secWrapper, diagramContainer.querySelector(".diagram-caption"));
    }
  } else {
    diagramContainer.classList.add("hidden");
    questionDiagram.src = "";
  }

  // 7. Render Options (A, B, C)
  optionsContainer.innerHTML = "";
  const isAnswered = userAnswers[q.number] !== undefined;
  const selectedAns = userAnswers[q.number];

  for (const [letter, optVal] of Object.entries(q.options)) {
    const card = document.createElement("button");
    card.className = "option-card border border-black/10 dark:border-white/10 p-4 rounded-2xl cursor-pointer flex items-center gap-4 bg-white dark:bg-neutral-900 text-left w-full disabled:opacity-80 transition-colors";
    card.id = `opt-${letter}`;

    if (q.options_are_images) {
      card.classList.add("flex-col", "items-start");
      card.innerHTML = `
        <span class="option-letter w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors">${letter}</span>
        <div class="w-full mt-2 flex justify-center">
          <img src="cropped_assets/${optVal}" alt="Opción ${letter}" class="max-h-32 object-contain bg-white rounded-md">
        </div>
      `;
    } else {
      card.innerHTML = `
        <span class="option-letter w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors">${letter}</span>
        <span class="text-sm sm:text-base font-medium flex-1">${optVal}</span>
      `;
    }

    // Interactions
    if (!isReviewMode) {
      // Normal state or Practice mode
      if (examMode === "practice" && isAnswered) {
        // In practice mode, lock choices once answered
        card.disabled = true;
      } else {
        card.addEventListener("click", () => selectOption(letter));
      }
    } else {
      // Review mode: disable clicks
      card.disabled = true;
    }

    // Styling selection/feedback states
    if (selectedAns === letter) {
      card.classList.add("selected");
    }

    if (isReviewMode) {
      // Highlight correct choice in Green
      if (q.correct_answer === letter) {
        card.classList.remove("selected");
        card.classList.add("correct");
      }
      // Highlight user's incorrect choice in Red
      if (selectedAns === letter && selectedAns !== q.correct_answer) {
        card.classList.remove("selected");
        card.classList.add("incorrect");
      }
    } else if (examMode === "practice" && isAnswered) {
      // Highlight immediately in practice mode
      if (q.correct_answer === letter) {
        card.classList.remove("selected");
        card.classList.add("correct");
      }
      if (selectedAns === letter && selectedAns !== q.correct_answer) {
        card.classList.remove("selected");
        card.classList.add("incorrect");
      }
    }

    optionsContainer.appendChild(card);
  }

  // 8. Practice Mode feedback box display
  if (examMode === "practice" && isAnswered) {
    practiceFeedback.classList.remove("hidden");
    const isCorrect = selectedAns === q.correct_answer;
    
    if (isCorrect) {
      practiceFeedback.className = "mt-6 p-4 rounded-2xl border text-sm font-medium flex items-start gap-3 bg-emerald-50 text-emerald-800 border-emerald-200";
      practiceFeedback.innerHTML = `
        <span class="material-symbols-outlined text-emerald-600">check_circle</span>
        <div><strong>¡Correcto!</strong> Tu respuesta es la correcta de acuerdo con el simulacro oficial de la UV.</div>
      `;
    } else {
      practiceFeedback.className = "mt-6 p-4 rounded-2xl border text-sm font-medium flex items-start gap-3 bg-red-50 text-red-800 border-red-200";
      practiceFeedback.innerHTML = `
        <span class="material-symbols-outlined text-red-600">cancel</span>
        <div><strong>Incorrecto.</strong> Tu respuesta fue la ${selectedAns}. La respuesta correcta es la <strong>${q.correct_answer}</strong>.</div>
      `;
    }
  } else {
    practiceFeedback.classList.add("hidden");
  }

  // Update progress bar
  const progressBarFill = document.getElementById("progressBarFill");
  if (progressBarFill) {
    progressBarFill.style.width = `${((index + 1) / activeQuestions.length) * 100}%`;
  }

  // 9. Navigation buttons enabling
  btnPrevQuestion.disabled = index === 0;
  
  if (index === activeQuestions.length - 1) {
    btnNextQuestion.querySelector("span").textContent = isReviewMode ? "Finalizar Revisión" : "Finalizar Examen";
    btnNextQuestion.classList.add("btn-finish-style");
  } else {
    btnNextQuestion.querySelector("span").textContent = "Siguiente";
    btnNextQuestion.classList.remove("btn-finish-style");
  }
}

// ==========================================================
// Option Selection & Flagging
// ==========================================================
function selectOption(letter) {
  const q = activeQuestions[currentQuestionIndex];
  userAnswers[q.number] = letter;

  // Update visual markers
  updateStats();
  updateGridBtnState(currentQuestionIndex, "answered");

  // Re-render to show selection / practice feedback immediately
  renderQuestion(currentQuestionIndex);

  // In normal exam mode, auto-advance with a tiny smooth delay
  if (examMode === "sim" && currentQuestionIndex < activeQuestions.length - 1) {
    setTimeout(() => {
      // Double check index hasn't changed in the interval
      if (userAnswers[q.number] === letter) {
        nextQuestion();
      }
    }, 450);
  }
}

function toggleFlag() {
  const q = activeQuestions[currentQuestionIndex];
  if (flaggedQuestions.has(q.number)) {
    flaggedQuestions.delete(q.number);
    updateGridBtnState(currentQuestionIndex, "unflagged");
  } else {
    flaggedQuestions.add(q.number);
    updateGridBtnState(currentQuestionIndex, "flagged");
  }
  
  // Re-render button state
  renderQuestion(currentQuestionIndex);
  updateStats();
}

function updateGridBtnState(idx, action) {
  const btn = document.getElementById(`grid-btn-${idx}`);
  if (!btn) return;
  const q = activeQuestions[idx];

  btn.classList.remove("answered", "flagged");
  
  if (flaggedQuestions.has(q.number)) {
    btn.classList.add("flagged");
  }
  if (userAnswers[q.number] !== undefined) {
    btn.classList.add("answered");
  }
}

// Update counters in Header
function updateStats() {
  let answeredCount = 0;
  activeQuestions.forEach(q => {
    if (userAnswers[q.number] !== undefined) answeredCount++;
  });

  statAnswered.textContent = answeredCount;
  statFlagged.textContent = flaggedQuestions.size;
}

// ==========================================================
// Navigation Actions
// ==========================================================
function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    renderQuestion(currentQuestionIndex);
  }
}

function nextQuestion() {
  if (currentQuestionIndex < activeQuestions.length - 1) {
    currentQuestionIndex++;
    renderQuestion(currentQuestionIndex);
  } else {
    // Last question clicked "Next/Finish"
    if (isReviewMode) {
      // Go back to results
      examScreen.classList.remove("active");
      resultsScreen.classList.add("active");
    } else {
      openConfirmModal();
    }
  }
}

// ==========================================================
// Modals Controls
// ==========================================================
function openLightbox(src) {
  lightboxImg.src = src;
  lightboxModal.classList.remove("hidden");
}

function closeLightbox() {
  lightboxModal.classList.add("hidden");
  lightboxImg.src = "";
}

function openConfirmModal() {
  let answeredCount = 0;
  activeQuestions.forEach(q => {
    if (userAnswers[q.number] !== undefined) answeredCount++;
  });
  const unansweredCount = activeQuestions.length - answeredCount;

  modalStatAnswered.textContent = answeredCount;
  modalStatUnanswered.textContent = unansweredCount;

  if (unansweredCount === 0) {
    document.getElementById("confirm-modal-warning-text").textContent = "Has contestado todos los reactivos. ¿Deseas guardar tus respuestas y calcular tu puntaje final del examen?";
  } else {
    document.getElementById("confirm-modal-warning-text").textContent = "Aún tienes preguntas sin responder y tiempo disponible en el simulador. ¿Deseas finalizar tu simulacro ahora?";
  }

  confirmModal.classList.remove("hidden");
}

function closeConfirmModal() {
  confirmModal.classList.add("hidden");
}

// ==========================================================
// Results Submission & Calculation
// ==========================================================
function submitExam() {
  if (timerInterval) clearInterval(timerInterval);
  
  // Calculate time elapsed
  timeElapsed = Math.floor((Date.now() - startTime) / 1000);
  if (examMode === "practice") {
    // Use manual elapsed time
    timeElapsed = Math.floor((Date.now() - startTime) / 1000);
  } else {
    timeElapsed = totalDuration - timeRemaining;
  }

  // Calculate scores
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  // Breakdown metrics
  let sec1Correct = 0, sec1Total = 0;
  let sec2Correct = 0, sec2Total = 0;
  let sec3Correct = 0, sec3Total = 0;

  activeQuestions.forEach(q => {
    const userAns = userAnswers[q.number];
    const isCorrect = userAns === q.correct_answer;

    // Global counts
    if (userAns === undefined) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    // Section metrics
    if (q.number >= 1 && q.number <= 30) {
      sec1Total++;
      if (isCorrect) sec1Correct++;
    } else if (q.number >= 31 && q.number <= 60) {
      sec2Total++;
      if (isCorrect) sec2Correct++;
    } else if (q.number >= 61 && q.number <= 90) {
      sec3Total++;
      if (isCorrect) sec3Correct++;
    }
  });

  const totalQuestions = activeQuestions.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  // CENEVAL Score Calculation (Range 700 to 1300 points)
  const cenevalScore = 700 + Math.round((correctCount / totalQuestions) * 600);

  // Populate Results UI
  resultsStudentGreet.textContent = `Felicidades ${userName}, has completado el simulacro.`;
  scoreCorrectFraction.textContent = `${correctCount}/${totalQuestions}`;
  scorePercentage.textContent = `${percentage}%`;
  
  // Radial Progress Ring Animation
  const ringOffset = 534 - (534 * percentage) / 100;
  scoreRingProgress.style.strokeDashoffset = ringOffset;

  resCorrect.textContent = correctCount;
  resIncorrect.textContent = incorrectCount;
  resUnanswered.textContent = unansweredCount;

  // CENEVAL Score Details
  cenevalScoreDisplay.innerHTML = `${cenevalScore} <span class="score-max">/ 1300</span>`;
  
  // Ceneval Classification
  let performance = "Insuficiente";
  let perfClass = "insufficient";

  if (cenevalScore >= 1200) {
    performance = "Desempeño Sobresaliente";
    perfClass = "outstanding";
  } else if (cenevalScore >= 1000) {
    performance = "Desempeño Satisfactorio";
    perfClass = "satisfactory";
  } else if (cenevalScore >= 900) {
    performance = "Desempeño Satisfactorio Mínimo";
    perfClass = "satisfactory-light";
  } else {
    performance = "Desempeño Insuficiente";
    perfClass = "insufficient";
  }

  cenevalPerformanceBadge.textContent = performance;
  cenevalPerformanceBadge.className = `perf-badge ${perfClass}`;

  // Time formatting
  const h = Math.floor(timeElapsed / 3600);
  const m = Math.floor((timeElapsed % 3600) / 60);
  const s = timeElapsed % 60;
  resTimeSpent.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  // Update Section Breakdowns Progress
  updateSectionProgress(sec1ScoreText, sec1ProgressFill, sec1Correct, sec1Total);
  updateSectionProgress(sec2ScoreText, sec2ProgressFill, sec2Correct, sec2Total);
  updateSectionProgress(sec3ScoreText, sec3ProgressFill, sec3Correct, sec3Total);

  // Transitions
  examScreen.classList.remove("active");
  resultsScreen.classList.add("active");
}

function updateSectionProgress(scoreTextEl, fillEl, correct, total) {
  if (total === 0) {
    // If the section was not part of the active questions
    scoreTextEl.textContent = "No evaluado";
    fillEl.style.width = "0%";
    fillEl.parentElement.parentElement.style.opacity = "0.5";
  } else {
    scoreTextEl.textContent = `${correct} / ${total}`;
    const pct = Math.round((correct / total) * 100);
    fillEl.style.width = `${pct}%`;
    fillEl.parentElement.parentElement.style.opacity = "1";
  }
}

// ==========================================================
// Results Review & Restart
// ==========================================================
function reviewAnswers() {
  isReviewMode = true;
  currentQuestionIndex = 0;

  // Toggle Header states in review mode
  timerContainer.style.display = "none";
  btnFinishExam.style.display = "none";
  
  // Create a Review indicator button or element if not already present
  let reviewPill = document.getElementById("review-indicator-pill");
  if (!reviewPill) {
    reviewPill = document.createElement("button");
    reviewPill.id = "review-indicator-pill";
    reviewPill.className = "btn-secondary";
    reviewPill.style.padding = "0.5rem 1rem";
    reviewPill.style.borderRadius = "0.5rem";
    reviewPill.style.fontSize = "0.85rem";
    reviewPill.style.border = "1px solid var(--success-color)";
    reviewPill.style.color = "var(--success-color)";
    reviewPill.innerHTML = "<span>Resultados</span>";
    reviewPill.addEventListener("click", () => {
      examScreen.classList.remove("active");
      resultsScreen.classList.add("active");
    });
    // Add before finish exam button
    btnFinishExam.parentNode.insertBefore(reviewPill, btnFinishExam);
  } else {
    reviewPill.style.display = "inline-flex";
  }

  // Populate navigation grid with correct answer indicators
  activeQuestions.forEach((q, idx) => {
    const btn = document.getElementById(`grid-btn-${idx}`);
    if (btn) {
      btn.classList.remove("answered", "flagged", "current");
      const userAns = userAnswers[q.number];
      
      if (userAns === q.correct_answer) {
        btn.style.backgroundColor = "var(--success-bg)";
        btn.style.borderColor = "var(--success-color)";
        btn.style.color = "var(--success-color)";
      } else if (userAns !== undefined) {
        btn.style.backgroundColor = "var(--danger-bg)";
        btn.style.borderColor = "var(--danger-color)";
        btn.style.color = "var(--danger-color)";
      } else {
        // Unanswered
        btn.style.backgroundColor = "transparent";
        btn.style.borderColor = "var(--border-color)";
        btn.style.color = "var(--text-secondary)";
      }
    }
  });

  resultsScreen.classList.remove("active");
  examScreen.classList.add("active");

  renderQuestion(currentQuestionIndex);
}

function restartExam() {
  // Clear any review styles on grid buttons
  document.querySelectorAll(".grid-btn").forEach(btn => {
    btn.removeAttribute("style");
  });

  // Hide review pill
  const reviewPill = document.getElementById("review-indicator-pill");
  if (reviewPill) reviewPill.style.display = "none";
  btnFinishExam.style.display = "block";

  resultsScreen.classList.remove("active");
  welcomeScreen.classList.add("active");
}
