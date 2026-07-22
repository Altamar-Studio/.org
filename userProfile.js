// userProfile.js - Progreso local del usuario y gamificación (XP, racha, logros)
// Recreado para mantener la funcionalidad de estudio interactivo sin bases de datos online.

const LESSONS_PER_UNIT = 5; // Valor por defecto de lecciones por unidad

function getProgressObject() {
    try {
        const data = localStorage.getItem('ea_progress');
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

function saveProgressObject(obj) {
    try {
        localStorage.setItem('ea_progress', JSON.stringify(obj));
    } catch (e) {}
}

// Obtener cuántas lecciones se han completado en una unidad
function getUnitProgress(lang, level, unitId, totalLessons) {
    const progress = getProgressObject();
    if (!progress[lang] || !progress[lang][level] || !progress[lang][level][unitId]) {
        return 0;
    }
    const completedLessons = Object.keys(progress[lang][level][unitId]).length;
    return Math.min(completedLessons, totalLessons);
}

// Guardar una lección como completada
function recordLessonCompleted(lang, level, unitId, lessonId, stars) {
    const progress = getProgressObject();
    if (!progress[lang]) progress[lang] = {};
    if (!progress[lang][level]) progress[lang][level] = {};
    if (!progress[lang][level][unitId]) progress[lang][level][unitId] = {};
    
    progress[lang][level][unitId][lessonId] = stars;
    saveProgressObject(progress);
}

// Guardar progreso general y gamificación (XP y racha)
function recordLessonCompletion(xpEarned, accuracy) {
    let profile = { xp: 0, streak: 0, lastActive: null, achievements: [] };
    try {
        const saved = localStorage.getItem('ea_local_profile');
        if (saved) profile = JSON.parse(saved);
    } catch (e) {}

    profile.xp = (profile.xp || 0) + xpEarned;

    const today = new Date().toDateString();
    let newStreak = profile.streak || 0;
    
    if (profile.lastActive) {
        const lastDate = new Date(profile.lastActive);
        const diffTime = Math.abs(new Date(today) - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            newStreak += 1;
        } else if (diffDays > 1) {
            newStreak = 1;
        }
    } else {
        newStreak = 1;
    }
    profile.streak = newStreak;
    profile.lastActive = today;

    const newAchievements = [];
    if (profile.xp >= 100 && !profile.achievements.includes('xp_100')) {
        profile.achievements.push('xp_100');
        newAchievements.push('Estudiante de Bronce (100 XP)');
    }
    if (profile.xp >= 500 && !profile.achievements.includes('xp_500')) {
        profile.achievements.push('xp_500');
        newAchievements.push('Estudiante de Plata (500 XP)');
    }
    if (profile.streak >= 3 && !profile.achievements.includes('streak_3')) {
        profile.achievements.push('streak_3');
        newAchievements.push('Constancia de Hierro (3 días de racha)');
    }

    try {
        localStorage.setItem('ea_local_profile', JSON.stringify(profile));
    } catch (e) {}

    return {
        newStreak: newStreak,
        newAchievements: newAchievements
    };
}

// Exponer las funciones globalmente
window.getUnitProgress = getUnitProgress;
window.recordLessonCompleted = recordLessonCompleted;
window.recordLessonCompletion = recordLessonCompletion;
