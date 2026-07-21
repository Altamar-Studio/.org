/**
 * userProfile.js
 * Maneja la persistencia y lógica de gamificación local (XP, Rachas, Logros).
 * 
 * TODO [BACKEND SYNC]: 
 * - En el futuro, reemplazar las lecturas/escrituras de localStorage con llamadas fetch() a una API REST o Supabase.
 * - Sincronizar el estado local con la base de datos remota tras completar lecciones.
 */

const PROFILE_KEY = 'ea_user_profile';

const DEFAULT_PROFILE = {
    xp: 0,
    streak: 0,
    lastActiveDate: null,
    activeDays: [], // Track all days active for calendar
    achievements: [],
    completedLessons: [],
    lessonStars: {}, // "en_a1_u1_l0": 3
    vocabMastery: {}
    // TODO [BACKEND]: completedLessons y vocabMastery deberían sincronizarse con la BD para
    // que el progreso no se pierda si el usuario borra su localStorage.
};



const AVAILABLE_ACHIEVEMENTS = {
    'first_lesson': { id: 'first_lesson', name: 'Primer Paso', icon: '🐣', desc: 'Completaste tu primera lección' },
    'perfect_score': { id: 'perfect_score', name: 'Perfección', icon: '🎯', desc: '100% de aciertos en una lección' },
    'streak_3': { id: 'streak_3', name: 'En Racha', icon: '🔥', desc: 'Alcanzaste 3 días de racha' },
    'streak_7': { id: 'streak_7', name: 'Fuego Semanal', icon: '☄️', desc: 'Alcanzaste 7 días de racha' },
    'streak_30': { id: 'streak_30', name: 'Imparable', icon: '🌋', desc: 'Alcanzaste 30 días de racha' },
    'xp_100': { id: 'xp_100', name: 'Estudioso', icon: '🧠', desc: 'Acumulaste 100 XP' }
};

function getProfile() {
    const data = localStorage.getItem(PROFILE_KEY);
    if (!data) return DEFAULT_PROFILE;
    
    let parsed = JSON.parse(data);
    // Backward compatibility for old profiles saved before completedLessons was added
    if (!parsed.completedLessons) parsed.completedLessons = [];
    if (!parsed.achievements) parsed.achievements = [];
    if (!parsed.vocabMastery) parsed.vocabMastery = {};
    if (!parsed.activeDays) parsed.activeDays = parsed.lastActiveDate ? [parsed.lastActiveDate] : [];
    if (!parsed.lessonStars) parsed.lessonStars = {};
    return parsed;
}

function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // TODO [BACKEND SYNC]: Aquí se encolaría la actualización hacia el servidor.
}

// Inicializa o repara el perfil, maneja la pérdida de racha y recarga vidas offline
function initProfile() {
    let profile = getProfile();
    const today = new Date().toISOString().split('T')[0];
    
    // Check lives recharge
    if (profile.lives < 5) {
        const now = Date.now();
        const diff = now - profile.lastLivesUpdate;
        const livesToAdd = Math.floor(diff / LIFE_RECHARGE_MS);
        if (livesToAdd > 0) {
            profile.lives = Math.min(5, profile.lives + livesToAdd);
            // Advance the timer by the amount of full chunks processed
            profile.lastLivesUpdate += livesToAdd * LIFE_RECHARGE_MS;
        }
    }
    
    // Check streak
    if (profile.lastActiveDate) {
        const lastDate = new Date(profile.lastActiveDate);
        const currentDate = new Date(today);
        
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
            profile.streak = 0; // Streak broken
        }
    }
    
    saveProfile(profile);
    updateUIHeaders();
}

function startLivesTimer() {
    setInterval(() => {
        let profile = getProfile();
        if (profile.lives < 5) {
            const now = Date.now();
            const diff = now - profile.lastLivesUpdate;
            if (diff >= LIFE_RECHARGE_MS) {
                profile.lives = Math.min(5, profile.lives + 1);
                profile.lastLivesUpdate += LIFE_RECHARGE_MS;
                saveProfile(profile);
                updateUIHeaders();
            } else {
                updateUIHeaders(); // To refresh the visible timer
            }
        }
    }, 1000);
}

// Registra actividad (suma XP, actualiza racha, revisa logros)
function recordLessonCompletion(xpEarned, accuracy) {
    let profile = getProfile();
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Actualizar Racha y Calendario
    if (profile.lastActiveDate !== today) {
        profile.streak += 1;
        profile.lastActiveDate = today;
        if (!profile.activeDays.includes(today)) {
            profile.activeDays.push(today);
        }
    }
    
    // 2. Sumar XP
    profile.xp += xpEarned;
    
    // 3. Revisar Logros (Devuelve los nuevos desbloqueados para mostrarlos)
    let newUnlocks = [];
    
    function unlock(id) {
        if (!profile.achievements.includes(id)) {
            profile.achievements.push(id);
            newUnlocks.push(AVAILABLE_ACHIEVEMENTS[id]);
        }
    }
    
    unlock('first_lesson');
    if (accuracy === 100) unlock('perfect_score');
    if (profile.streak >= 3) unlock('streak_3');
    if (profile.streak >= 7) unlock('streak_7');
    if (profile.streak >= 30) unlock('streak_30');
    if (profile.xp >= 100) unlock('xp_100');
    
    saveProfile(profile);
    
    // TODO [BACKEND SYNC]: Enviar resumen de sesión al servidor
    
    return {
        newTotalXp: profile.xp,
        newStreak: profile.streak,
        newAchievements: newUnlocks
    };
}

// Funciones utilitarias para las Vidas (Lives)
function getLives() {
    return getProfile().lives;
}

function decrementLife() {
    let profile = getProfile();
    if (profile.lives > 0) {
        profile.lives--;
        profile.lastLivesUpdate = Date.now();
        saveProfile(profile);
    }
    return profile.lives;
}

// Marca una lección como completada y guarda las estrellas.
function recordLessonCompleted(lang, level, unit, lessonIdx, stars) {
    let profile = getProfile();
    const key = `${lang}_${level}_u${unit}_l${lessonIdx}`;
    if (!profile.completedLessons.includes(key)) {
        profile.completedLessons.push(key);
    }
    // Update stars only if it's higher than previous
    const prevStars = profile.lessonStars[key] || 0;
    if (stars > prevStars) {
        profile.lessonStars[key] = stars;
    }
    
    saveProfile(profile);
    return lessonIdx + 1;
}

// Devuelve el estado de una lección: 'completed' | 'active' | 'locked'
function getLessonState(lang, level, unit, lessonIdx, totalLessons) {
    const profile = getProfile();
    const key = `${lang}_${level}_u${unit}_l${lessonIdx}`;
    if (profile.completedLessons.includes(key)) return 'completed';
    // La lección es activa si la anterior está completada (o es la primera)
    const prevKey = `${lang}_${level}_u${unit}_l${lessonIdx - 1}`;
    if (lessonIdx === 0 || profile.completedLessons.includes(prevKey)) return 'active';
    return 'locked';
}

// Devuelve cuántas lecciones de una unidad están completadas
function getUnitProgress(lang, level, unit, totalLessons) {
    const profile = getProfile();
    let count = 0;
    for (let i = 0; i < totalLessons; i++) {
        if (profile.completedLessons.includes(`${lang}_${level}_u${unit}_l${i}`)) count++;
    }
    return count;
}

// Actualiza los elementos visuales del header en idiomas.html y curso-ingles.html
function updateUIHeaders() {
    const profile = getProfile();
    const streakEl = document.getElementById('ui-streak');
    const xpEl = document.getElementById('ui-xp');
    const livesEl = document.getElementById('ui-lives');
    
    // Elementos adicionales para gamificación
    const streakIcon = document.getElementById('ui-streak-icon');
    const livesTimer = document.getElementById('ui-lives-timer'); // Elemento a inyectar en HTML para el timer

    if (streakEl) streakEl.textContent = profile.streak;
    if (xpEl) xpEl.textContent = profile.xp.toLocaleString();
    
    if (livesEl) {
        if (profile.lives >= 5) {
            livesEl.textContent = '5/5';
            if(livesTimer) livesTimer.classList.add('hidden');
        } else {
            livesEl.textContent = profile.lives + '/5';
            if (livesTimer) {
                const now = Date.now();
                const diff = now - profile.lastLivesUpdate;
                const msLeft = Math.max(0, LIFE_RECHARGE_MS - diff);
                const mins = Math.floor(msLeft / 60000);
                const secs = Math.floor((msLeft % 60000) / 1000);
                livesTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                livesTimer.classList.remove('hidden');
            }
        }
    }
    
    // Escalar la llama según la racha (max scale 1.5)
    if (streakIcon) {
        const scale = Math.min(1.5, 1 + (profile.streak * 0.05));
        streakIcon.style.transform = `scale(${scale})`;
        if (profile.streak > 0) {
            streakIcon.classList.add('drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]');
        }
    }
}

// ---- MASTERY TRACKING (Spaced Repetition) ----
function recordVocabAttempt(lang, vocabWord, isCorrect) {
    let profile = getProfile();
    if (!profile.vocabMastery) profile.vocabMastery = {};
    
    const key = `${lang}_${vocabWord}`;
    if (!profile.vocabMastery[key]) {
        profile.vocabMastery[key] = { correct: 0, incorrect: 0, lastSeen: 0, masteryLevel: 0 };
    }
    
    const record = profile.vocabMastery[key];
    if (isCorrect) {
        record.correct++;
    } else {
        record.incorrect++;
    }
    record.lastSeen = Date.now();
    
    const total = record.correct + record.incorrect;
    record.masteryLevel = record.correct / total;
    
    saveProfile(profile);
}

function getWeakestVocab(lang, limit = 10) {
    const profile = getProfile();
    if (!profile.vocabMastery) return [];
    
    const entries = Object.entries(profile.vocabMastery)
        .filter(([key]) => key.startsWith(`${lang}_`))
        .map(([key, data]) => ({ word: key.replace(`${lang}_`, ''), ...data }));
        
    entries.sort((a, b) => {
        if (a.masteryLevel === b.masteryLevel) {
            return a.lastSeen - b.lastSeen;
        }
        return a.masteryLevel - b.masteryLevel;
    });
    
    return entries.slice(0, limit);
}

// Ejecutar init al cargar cualquier página que lo incluya
document.addEventListener('DOMContentLoaded', initProfile);
