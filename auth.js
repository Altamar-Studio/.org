// auth.js - Versión simplificada sin base de datos ni autenticación
// Provee mocks vacíos para mantener compatibilidad hacia atrás en las páginas del sitio.

const SESSION_KEY = 'ea_session';

function getCurrentUser() {
    return null; 
}

function updateNavUI() {
    // Ya no hay base de datos. Remover botones de inicio de sesión de la barra si existen
    const loginBtn = document.querySelector('header nav a[href*="login"]');
    const regBtn = document.querySelector('header nav a[href*="registro"]');
    if (loginBtn) loginBtn.remove();
    if (regBtn) regBtn.remove();
    
    const mobileAuth = document.getElementById('mobile-drawer-auth');
    if (mobileAuth) mobileAuth.remove();
}

function logout() {}
function toggleProfileDropdown() {}
function openUserProfile() {}
function closeUserProfile() {}
function selectPresetAvatar() {}
function handleProfileImageUpload() {}
function saveUserProfile() {}
function togglePasswordVisibility() {}

function initMobileMenu() {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    const drawer = document.getElementById('mobile-menu-drawer');
    const closeBtn = document.getElementById('mobile-menu-close');

    if (toggleBtn && drawer) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            drawer.classList.remove('hidden');
            drawer.classList.add('flex');
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(() => {
                drawer.classList.remove('opacity-0');
                drawer.classList.add('opacity-100');
            });
        });

        const closeDrawer = () => {
            drawer.classList.remove('opacity-100');
            drawer.classList.add('opacity-0');
            document.body.style.overflow = '';
            setTimeout(() => {
                drawer.classList.remove('flex');
                drawer.classList.add('hidden');
            }, 300);
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeDrawer);
        }

        drawer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeDrawer);
        });

        drawer.addEventListener('click', (e) => {
            if (e.target === drawer) {
                closeDrawer();
            }
        });
    }
}

// Exponer funciones globales para compatibilidad
window.getCurrentUser = getCurrentUser;
window.updateNavUI = updateNavUI;
window.logout = logout;
window.toggleProfileDropdown = toggleProfileDropdown;
window.openUserProfile = openUserProfile;
window.closeUserProfile = closeUserProfile;
window.selectPresetAvatar = selectPresetAvatar;
window.handleProfileImageUpload = () => {};
window.saveUserProfile = saveUserProfile;
window.togglePasswordVisibility = togglePasswordVisibility;
window.initMobileMenu = initMobileMenu;

document.addEventListener('DOMContentLoaded', () => {
    updateNavUI();
    initMobileMenu();
});

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    updateNavUI();
    initMobileMenu();
}
