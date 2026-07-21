/**
 * auth.js
 * Maneja el inicio de sesión, registro, sesión activa y actualización del header/footer nav usando Firebase.
 */

// Evitar parpadeo visual (Layout Shift) al cargar la página si el usuario ya inició sesión
(function() {
    try {
        const session = localStorage.getItem('ea_session');
        if (session) {
            const style = document.createElement('style');
            style.id = 'ea-auth-anticipation-style';
            style.innerHTML = `
                header nav div.flex.items-center.gap-4 > a[href*="login"],
                header nav div.flex.items-center.gap-4 > a[href*="registro"],
                header nav div.flex.items-center.gap-4 > a.bg-black,
                header nav div.flex.items-center.gap-4 > a.text-sm { 
                    display: none !important; 
                }
            `;
            
            const dropdownStyle = document.createElement('style');
            dropdownStyle.id = 'ea-profile-dropdown-animation-style';
            dropdownStyle.innerHTML = `
                #profile-dropdown {
                    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    transform: translateY(8px);
                    opacity: 0;
                    pointer-events: none;
                }
                #profile-dropdown.show-dropdown {
                    transform: translateY(0);
                    opacity: 1;
                    pointer-events: auto;
                }
            `;
            
            document.documentElement.appendChild(style);
            document.documentElement.appendChild(dropdownStyle);
        } else {
            const dropdownStyle = document.createElement('style');
            dropdownStyle.id = 'ea-profile-dropdown-animation-style';
            dropdownStyle.innerHTML = `
                #profile-dropdown {
                    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    transform: translateY(8px);
                    opacity: 0;
                    pointer-events: none;
                }
                #profile-dropdown.show-dropdown {
                    transform: translateY(0);
                    opacity: 1;
                    pointer-events: auto;
                }
            `;
            document.documentElement.appendChild(dropdownStyle);
        }
    } catch (e) {
        console.error(e);
    }
})();

const SESSION_KEY = 'ea_session';

// Configuración de Firebase obtenida de tu consola
const firebaseConfig = {
  apiKey: "AIzaSyDLjIlaeUqIUGnyKhfGZSmGxf3u_gPl8-c",
  authDomain: "estudiandoando-6974d.firebaseapp.com",
  projectId: "estudiandoando-6974d",
  storageBucket: "estudiandoando-6974d.firebasestorage.app",
  messagingSenderId: "489035398287",
  appId: "1:489035398287:web:1228395c3508321f6044fa",
  measurementId: "G-48C2TNWX6D"
};

let firebasePromise = null;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

function ensureFirebase() {
    if (firebasePromise) return firebasePromise;
    
    firebasePromise = new Promise(async (resolve) => {
        if (window.firebase) {
            resolve();
            return;
        }
        try {
            await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
            await Promise.all([
                loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"),
                loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js")
            ]);
            window.firebase.initializeApp(firebaseConfig);
            
            // Listener para cambios de sesión de Firebase
            window.firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const doc = await window.firebase.firestore().collection("users").doc(user.uid).get();
                        if (doc.exists) {
                            const data = doc.data();
                            const sessionUser = {
                                username: data.username,
                                email: data.email || user.email,
                                university: data.university,
                                birthdate: data.birthdate,
                                age: data.age || calculateAge(data.birthdate),
                                avatar: data.avatar || user.photoURL || '',
                                bio: data.bio || '',
                                role: data.role || 'user',
                                uid: user.uid,
                                isLocal: false // Sesión del servidor de Firebase
                            };
                            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
                            updateNavUI();
                        }
                    } catch (e) {
                        console.error("Error sincronizando perfil:", e);
                    }
                } else {
                    // Solo cerrar sesión si no es una sesión local offline activa
                    const current = getCurrentUser();
                    if (current && !current.isLocal) {
                        localStorage.removeItem(SESSION_KEY);
                        updateNavUI();
                    }
                }
            });

            resolve();
        } catch (e) {
            console.error("Error al cargar Firebase:", e);
            resolve();
        }
    });
    return firebasePromise;
}

ensureFirebase();

function calculateAge(birthdateString) {
    if (!birthdateString) return 20;
    const today = new Date();
    const birthDate = new Date(birthdateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age || 20;
}

function getCurrentUser() {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch (e) {
        return null;
    }
}

// Funciones de Base de Datos Local Auxiliar (Fallback offline/expirado)
function getMockUsers() {
    try {
        return JSON.parse(localStorage.getItem('ea_mock_users') || '[]');
    } catch (e) {
        return [];
    }
}
function saveMockUser(user) {
    const users = getMockUsers();
    users.push(user);
    localStorage.setItem('ea_mock_users', JSON.stringify(users));
}

// Iniciar sesión (admite usuario o correo electrónico y auto-crea la cuenta Zahir si es necesario)
async function login(identifier, password) {
    const emailInput = identifier.trim().toLowerCase();
    
    // Soporte para la cuenta especial de administración Zahir con fallback offline
    if (emailInput === 'zahir' && password === 'Ea2026') {
        try {
            await ensureFirebase();
            const email = 'zahir@estudiandoando.org';
            const userCredential = await window.firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            const doc = await window.firebase.firestore().collection("users").doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                const sessionUser = {
                    username: data.username,
                    email: data.email,
                    university: data.university,
                    birthdate: data.birthdate,
                    age: data.age,
                    avatar: data.avatar || '',
                    bio: data.bio || '',
                    role: 'admin',
                    uid: user.uid
                };
                localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
                return { success: true };
            }
        } catch (e) {
            console.warn("Firebase Zahir login failed/database rules expired. Using local fallback admin session:", e);
            const localAdminUser = {
                username: 'Zahir',
                email: 'zahir@estudiandoando.org',
                university: 'UV',
                birthdate: '2006-07-20',
                age: 20,
                avatar: '',
                bio: '¡Hola! Soy Zahir, creador de EstudiandoAndo. (Modo Local)',
                role: 'admin',
                uid: 'mock-zahir-uid-admin',
                isLocal: true
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(localAdminUser));
            return { success: true };
        }
    }

    try {
        await ensureFirebase();
        let email = emailInput;
        
        // Inicio de sesión normal por usuario o correo
        if (!email.includes('@')) {
            const snapshot = await window.firebase.firestore().collection("users")
                .where("username_lowercase", "==", email)
                .limit(1).get();
                
            if (snapshot.empty) {
                // Verificar en usuarios locales primero como redundancia
                const mockUser = getMockUsers().find(u => u.username_lowercase === email && u.password === password);
                if (mockUser) {
                    const sessionUser = { ...mockUser, isLocal: true };
                    delete sessionUser.password;
                    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
                    return { success: true };
                }
                return { success: false, message: 'Usuario o contraseña incorrectos.' };
            }
            const userData = snapshot.docs[0].data();
            email = userData.email || (email + "@estudiandoando.org");
        }

        const userCredential = await window.firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const doc = await window.firebase.firestore().collection("users").doc(user.uid).get();
        if (!doc.exists) {
            return { success: false, message: 'Perfil no encontrado en el servidor.' };
        }
        
        const data = doc.data();
        const sessionUser = {
            username: data.username,
            email: data.email || email,
            university: data.university,
            birthdate: data.birthdate,
            age: data.age || calculateAge(data.birthdate),
            avatar: data.avatar || user.photoURL || '',
            bio: data.bio || '',
            role: data.role || 'user',
            uid: user.uid,
            isLocal: false
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true };
    } catch (e) {
        console.error("Error al iniciar sesión en Firebase:", e);
        
        // Si es un error de credenciales explícito en Firebase, NO conmutar a local (a menos que sea por red u offline)
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            return { success: false, message: 'Usuario/correo o contraseña incorrectos.' };
        } else if (e.code === 'auth/invalid-email') {
            return { success: false, message: 'El formato de correo no es válido.' };
        } else if (e.code === 'auth/user-disabled') {
            return { success: false, message: 'Esta cuenta de usuario ha sido inhabilitada.' };
        }
        
        // Si falló por red o inicialización, hacer fallback a la base de datos local
        console.warn("Fallo de infraestructura Firebase, conmutando a login local offline de respaldo.");
        const cleanId = emailInput;
        const mockUser = getMockUsers().find(u => 
            (u.username_lowercase === cleanId || u.email.toLowerCase() === cleanId) && u.password === password
        );
        if (mockUser) {
            const sessionUser = { ...mockUser, isLocal: true };
            delete sessionUser.password;
            localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
            return { success: true };
        }

        let msg = 'Usuario o contraseña incorrectos.';
        if (e.code === 'auth/network-request-failed') {
            msg = 'Error de red. Revisa tu conexión a internet.';
        }
        return { success: false, message: msg };
    }
}

// Iniciar sesión / Registro rápido con GOOGLE
async function loginWithGoogle() {
    await ensureFirebase();
    const provider = new window.firebase.auth.GoogleAuthProvider();
    try {
        const result = await window.firebase.auth().signInWithPopup(provider);
        const user = result.user;
        
        const docRef = window.firebase.firestore().collection("users").doc(user.uid);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            const baseUsername = user.displayName || user.email.split('@')[0];
            const userData = {
                username: baseUsername,
                username_lowercase: baseUsername.toLowerCase(),
                email: user.email,
                university: 'UV',
                birthdate: '2006-01-01',
                age: 20,
                avatar: user.photoURL || '',
                bio: '¡Hola! Me uní a la comunidad mediante Google.',
                role: 'user',
                createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };
            await docRef.set(userData);
        }
        
        const finalDoc = await docRef.get();
        const data = finalDoc.data();
        const sessionUser = {
            username: data.username,
            email: data.email || user.email,
            university: data.university,
            birthdate: data.birthdate,
            age: data.age || 20,
            avatar: data.avatar || user.photoURL || '',
            bio: data.bio || '',
            role: data.role || 'user',
            uid: user.uid
        };
        
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true };
    } catch (e) {
        console.error("Error autenticación Google:", e);
        let msg = 'No se pudo iniciar sesión con Google.';
        if (e.code === 'auth/popup-closed-by-user') {
            msg = 'Cancelaste el inicio de sesión con Google.';
        }
        return { success: false, message: msg };
    }
}

// Registrar usuario con Formulario
async function register(username, email, password, university, birthdate) {
    const cleanUsername = username.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : (cleanUsername.toLowerCase() + "@estudiandoando.org");
    const age = calculateAge(birthdate);
    
    const localUser = {
        username: cleanUsername,
        username_lowercase: cleanUsername.toLowerCase(),
        email: cleanEmail,
        password: password,
        university: university,
        birthdate: birthdate,
        age: age,
        avatar: '',
        bio: '',
        role: 'user',
        uid: 'mock-uid-' + Date.now()
    };

    try {
        await ensureFirebase();

        const snapshot = await window.firebase.firestore().collection("users")
            .where("username_lowercase", "==", cleanUsername.toLowerCase())
            .limit(1).get();
            
        if (!snapshot.empty) {
            return { success: false, message: 'El nombre de usuario ya está registrado.' };
        }
        
        const userCredential = await window.firebase.auth().createUserWithEmailAndPassword(cleanEmail, password);
        const user = userCredential.user;
        
        const userData = { ...localUser };
        delete userData.password;
        userData.uid = user.uid;
        
        await window.firebase.firestore().collection("users").doc(user.uid).set(userData);
        
        // Guardar localmente para redundancia
        saveMockUser(localUser);
        return { success: true };
    } catch (e) {
        console.error("Error al registrar en Firebase:", e);
        
        // Si es un error de validación de Firebase Auth, reportarlo directamente
        if (e.code === 'auth/email-already-in-use') {
            return { success: false, message: 'El correo electrónico ya está registrado por otra cuenta.' };
        } else if (e.code === 'auth/invalid-email') {
            return { success: false, message: 'El formato del correo electrónico no es válido.' };
        } else if (e.code === 'auth/weak-password') {
            return { success: false, message: 'La contraseña es muy débil. Debe tener al menos 6 caracteres.' };
        } else if (e.code === 'auth/operation-not-allowed') {
            return { success: false, message: 'El registro por correo y contraseña no está habilitado en tu consola de Firebase.' };
        }
        
        // Si es un error de infraestructura, red o reglas bloqueadas, hacer fallback local
        console.warn("Fallo de infraestructura Firebase, conmutando a registro local offline de respaldo.");
        
        const existsLocally = getMockUsers().some(u => u.username_lowercase === cleanUsername.toLowerCase());
        if (existsLocally) {
            return { success: false, message: 'El nombre de usuario ya está registrado localmente.' };
        }
        
        saveMockUser(localUser);
        
        // Iniciar sesión inmediatamente en modo local
        const sessionUser = { ...localUser, isLocal: true };
        delete sessionUser.password;
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        return { success: true };
    }
}

// Cerrar sesión
async function logout() {
    await ensureFirebase();
    try {
        await window.firebase.auth().signOut();
    } catch (e) {
        console.error("Error cerrando sesión en Firebase:", e);
    }
    localStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

function updateNavUI() {
    const user = getCurrentUser();
    
    const navLinksContainer = document.querySelector('header nav .hidden.md\\:flex');
    if (navLinksContainer) {
        let forosLink = navLinksContainer.querySelector('a[href="foros.html"]');
        if (user) {
            if (!forosLink) {
                const a = document.createElement('a');
                a.className = 'hover:opacity-100 transition-opacity';
                a.href = 'foros.html';
                a.id = 'nav-foros-link';
                a.innerText = 'Foros';
                
                if (window.location.pathname.includes('foros.html')) {
                    a.className = 'text-black dark:text-white font-bold opacity-100 transition-colors';
                }
                navLinksContainer.appendChild(a);
            }
        } else {
            if (forosLink) {
                forosLink.remove();
            }
        }
    }

    const mobileNav = document.querySelector('nav.fixed.bottom-6') || document.querySelector('nav.fixed.bottom-0');
    if (mobileNav) {
        let mobileForosLink = mobileNav.querySelector('a[href="foros.html"]');
        if (user) {
            if (!mobileForosLink) {
                const a = document.createElement('a');
                a.href = 'foros.html';
                a.className = 'flex flex-col items-center gap-0.5 opacity-40 hover:opacity-100 transition-opacity';
                if (window.location.pathname.includes('foros.html')) {
                    a.className = 'flex flex-col items-center gap-0.5 opacity-100 text-black dark:text-white transition-opacity';
                }
                a.innerHTML = `
                    <span class="material-symbols-outlined text-[20px]">forum</span>
                    <span class="text-[9px] font-bold tracking-tight">Foros</span>
                `;
                mobileNav.appendChild(a);
            }
        } else {
            if (mobileForosLink) {
                mobileForosLink.remove();
            }
        }
    }

    const mobileDrawer = document.getElementById('mobile-menu-drawer');
    if (mobileDrawer) {
        let mobileForosLink = mobileDrawer.querySelector('#mobile-foros-link');
        if (user) {
            if (mobileForosLink) mobileForosLink.classList.remove('hidden');
        } else {
            if (mobileForosLink) mobileForosLink.classList.add('hidden');
        }
        
        const mobileAuthContainer = mobileDrawer.querySelector('#mobile-drawer-auth');
        if (mobileAuthContainer) {
            if (user) {
                mobileAuthContainer.innerHTML = `
                    <div class="flex items-center gap-3 p-3 bg-white/10 rounded-2xl mb-2">
                        <div class="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                            ${user.avatar ? `<img src="${user.avatar}" class="w-10 h-10 rounded-full object-cover w-full h-full" />` : user.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="text-left flex-grow">
                            <span class="block text-sm font-bold text-white leading-tight">${user.username}</span>
                            <span class="text-[10px] text-white/60 font-bold uppercase tracking-wider">${user.university}</span>
                        </div>
                    </div>
                    <button onclick="openUserProfile()" class="w-full text-center py-3 rounded-full text-white font-medium bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">person</span> Ver Perfil
                    </button>
                    <button onclick="logout()" class="w-full text-center py-3 rounded-full text-red-400 font-bold bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 mt-1">
                        <span class="material-symbols-outlined text-[18px]">logout</span> Cerrar sesión
                    </button>
                `;
            } else {
                mobileAuthContainer.innerHTML = `
                    <a class="w-full text-center py-3 rounded-full text-white font-medium bg-white/10 hover:bg-white/20 transition-colors block" href="login.html">Iniciar sesión</a>
                    <a class="w-full text-center py-3 rounded-full text-black bg-white font-bold hover:bg-gray-200 transition-colors block" href="registro.html">Registrarse</a>
                `;
            }
        }
    }

    const rightNavContainer = document.getElementById('nav-right-buttons') || 
                              document.querySelector('header nav div.flex.items-center.gap-3') ||
                              document.querySelector('header nav div.flex.items-center.gap-4') ||
                              document.querySelector('header nav div.flex.items-center');
                              
    if (rightNavContainer) {
        const existingProfileMenu = document.getElementById('profile-menu-container');
        if (existingProfileMenu) {
            existingProfileMenu.remove();
        }

        if (user) {
            const authElements = rightNavContainer.querySelectorAll('a');
            authElements.forEach(el => {
                const txt = el.innerText.toLowerCase();
                if (txt.includes('iniciar') || txt.includes('registrar') || el.href.includes('login') || el.href.includes('registro')) {
                    el.remove();
                }
            });

            const profileDiv = document.createElement('div');
            profileDiv.id = 'profile-menu-container';
            profileDiv.className = 'relative flex items-center gap-2.5';
            
            profileDiv.innerHTML = `
                <button onclick="toggleProfileDropdown()" class="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer">
                    <div class="w-8 h-8 rounded-full relative flex-shrink-0 flex items-center justify-center">
                        ${user.avatar 
                            ? `<img src="${user.avatar}" class="w-8 h-8 rounded-full object-cover shadow-sm" />` 
                            : `<div class="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white font-bold flex items-center justify-center text-sm shadow-sm">${user.username.charAt(0).toUpperCase()}</div>`
                        }
                        <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full"></span>
                    </div>
                    
                    <div class="text-left hidden md:block">
                        <span class="block text-xs font-bold text-ea-dark dark:text-white leading-none">${user.username}</span>
                        <div class="flex items-center gap-1 mt-0.5">
                            <span class="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase opacity-80 leading-none text-blue-600 dark:text-blue-400">${user.university}</span>
                            <span class="text-[9px] opacity-40 font-bold">${user.age} años</span>
                        </div>
                    </div>
                    
                    <span class="material-symbols-outlined text-[16px] opacity-40">keyboard_arrow_down</span>
                </button>
                
                <div id="profile-dropdown" class="absolute right-0 top-12 w-64 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-[24px] p-5 shadow-xl flex flex-col gap-4 z-50">
                    <div class="border-b border-black/5 dark:border-white/5 pb-3">
                        <span class="block text-[10px] font-bold uppercase tracking-widest opacity-40">Perfil de Estudiante</span>
                        <span class="block font-serif text-xl font-bold text-ea-dark dark:text-white mt-1">${user.username}</span>
                        <div class="flex flex-wrap items-center gap-2 mt-2">
                            <span class="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">${user.university}</span>
                            <span class="bg-black/5 dark:bg-white/10 text-[9px] font-bold px-2 py-0.5 rounded-full dark:text-neutral-300">${user.age} Años</span>
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <button onclick="openUserProfile()" class="w-full flex items-center justify-between py-2 px-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all font-bold text-xs text-ea-dark dark:text-white text-left active:scale-[0.98] cursor-pointer">
                            <span class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">person</span>
                                Ver mi Perfil
                            </span>
                            <span class="material-symbols-outlined text-[16px] opacity-40">chevron_right</span>
                        </button>
                    </div>
                    
                    <div class="border-t border-black/5 dark:border-white/5 pt-3 mt-1">
                        <button onclick="logout()" class="w-full flex items-center justify-between text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer">
                            <span>Cerrar sesión</span>
                            <span class="material-symbols-outlined text-[16px]">logout</span>
                        </button>
                    </div>
                </div>
            `;
            
            rightNavContainer.appendChild(profileDiv);

        } else {
            let loginLink = rightNavContainer.querySelector('a[href*="login"]');
            if (!loginLink) {
                loginLink = document.createElement('a');
                loginLink.href = 'login.html';
                loginLink.className = 'text-xs sm:text-sm font-bold opacity-75 sm:opacity-60 hover:opacity-100 transition-opacity';
                loginLink.innerText = 'Iniciar sesión';
                const regBtn = rightNavContainer.querySelector('a[href*="registro"]');
                if (regBtn) {
                    rightNavContainer.insertBefore(loginLink, regBtn);
                } else {
                    rightNavContainer.appendChild(loginLink);
                }
            }
            
            let registerLink = rightNavContainer.querySelector('a[href*="registro"]');
            if (!registerLink) {
                registerLink = document.createElement('a');
                registerLink.href = 'registro.html';
                registerLink.className = 'bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-sm hover:bg-neutral-800 dark:hover:bg-gray-200 transition-colors';
                registerLink.innerText = 'Registrarse';
                rightNavContainer.appendChild(registerLink);
            }
        }
    }

    const allForosLinks = document.querySelectorAll('a[href="foros.html"], a[href*="foros"]');
    allForosLinks.forEach(link => {
        if (!user) {
            link.onclick = (e) => {
                e.preventDefault();
                alert("La sección de Foros está reservada para estudiantes registrados. Por favor, inicia sesión o crea una cuenta para charlar con la comunidad.");
                window.location.href = 'login.html';
            };
        } else {
            link.onclick = null;
        }
    });
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show-dropdown');
    }
}

document.addEventListener('click', (e) => {
    const container = document.getElementById('profile-menu-container');
    const dropdown = document.getElementById('profile-dropdown');
    if (container && dropdown && dropdown.classList.contains('show-dropdown')) {
        if (!container.contains(e.target)) {
            dropdown.classList.remove('show-dropdown');
        }
    }
});

let selectedAvatarDataUrl = '';

function injectUserProfileModal() {
    if (document.getElementById('user-profile-modal')) return;
    
    const modalHTML = `
    <div id="user-profile-modal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 p-6 sm:p-8 rounded-[32px] shadow-2xl max-w-md w-full animate-pop text-left relative flex flex-col max-h-[90vh]">
            <button onclick="closeUserProfile()" class="absolute top-5 right-5 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors">
                <span class="material-symbols-outlined text-[18px] text-ea-dark dark:text-white">close</span>
            </button>
            
            <h3 class="font-serif text-2xl font-bold text-ea-dark dark:text-white mb-6">Mi Perfil</h3>
            
            <div class="overflow-y-auto no-scrollbar flex-grow space-y-6">
                <div class="bg-black/5 dark:bg-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div id="profile-modal-avatar-preview" class="w-16 h-16 rounded-full relative flex items-center justify-center text-white font-bold text-2xl shadow-md bg-blue-600 dark:bg-blue-500 overflow-hidden flex-shrink-0">
                        Z
                    </div>
                    <div class="text-left flex-grow">
                        <span id="profile-modal-username" class="block font-serif text-xl font-bold text-ea-dark dark:text-white leading-tight">Zahir</span>
                        <div class="flex flex-wrap items-center gap-2 mt-1">
                            <span id="profile-modal-uni" class="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">UV</span>
                            <span id="profile-modal-age" class="bg-black/5 dark:bg-white/10 text-[9px] font-bold px-2 py-0.5 rounded-full dark:text-neutral-300">20 Años</span>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-3">
                    <label class="block text-xs font-bold uppercase tracking-widest opacity-60 text-ea-dark dark:text-white">Foto de Perfil</label>
                    <div class="flex flex-col gap-3">
                        <div class="grid grid-cols-6 gap-2 w-full">
                            <button onclick="selectPresetAvatar('avatar1')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 1">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Felix" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar2')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 2">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar3')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 3">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Jack" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar4')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 4">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Liam" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar5')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 5">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Buster" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar6')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 6">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Milo" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar7')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 7">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Bella" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar8')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 8">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Sasha" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar9')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 9">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar10')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 10">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Chloe" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar11')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 11">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Loki" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar12')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 12">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Lily" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar13')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 13">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Mia" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar14')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 14">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Leo" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar15')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 15">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Maya" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar16')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 16">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Ryan" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar17')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 17">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Luna" class="w-full h-full object-cover" />
                            </button>
                            <button onclick="selectPresetAvatar('avatar18')" class="avatar-preset-btn w-11 h-11 rounded-full border-2 border-transparent hover:scale-105 active:scale-95 transition-all overflow-hidden bg-neutral-100 dark:bg-neutral-800" title="Avatar Estudioso 18">
                                <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Max" class="w-full h-full object-cover" />
                            </button>
                        </div>
                        <div class="w-full flex items-center justify-between gap-4 mt-1 border-t border-black/5 pt-3">
                            <span class="text-xs opacity-60 text-ea-dark dark:text-neutral-300">O sube una imagen personalizada:</span>
                            <label class="bg-black dark:bg-white text-white dark:text-black text-xs font-bold py-1.5 px-3 rounded-xl cursor-pointer hover:opacity-90 transition-all text-center">
                                Explorar
                                <input type="file" id="profile-upload-input" accept="image/*" class="hidden" onchange="handleProfileImageUpload(event)" />
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-2">
                    <label for="profile-modal-bio" class="block text-xs font-bold uppercase tracking-widest opacity-60 text-ea-dark dark:text-white">Descripción Breve</label>
                    <textarea id="profile-modal-bio" maxlength="160" placeholder="Escribe algo sobre ti... (máx. 160 caracteres)" class="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none h-24 text-ea-dark dark:text-white placeholder:opacity-50"></textarea>
                    <div class="text-right text-[10px] opacity-40" id="bio-char-count">0/160</div>
                </div>
            </div>
            
            <div class="border-t border-black/5 pt-4 mt-6 flex justify-end gap-3">
                <button onclick="closeUserProfile()" class="bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-ea-dark dark:text-white transition-colors">
                    Cancelar
                </button>
                <button onclick="saveUserProfile()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
                    Guardar Cambios
                </button>
            </div>
        </div>
    </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);
    
    const bioTextarea = document.getElementById('profile-modal-bio');
    if (bioTextarea) {
        bioTextarea.addEventListener('input', (e) => {
            const count = e.target.value.length;
            document.getElementById('bio-char-count').innerText = `${count}/160`;
        });
    }
}

function openUserProfile() {
    injectUserProfileModal();
    
    const user = getCurrentUser();
    if (!user) return;
    
    document.getElementById('profile-modal-username').innerText = user.username;
    document.getElementById('profile-modal-uni').innerText = user.university;
    document.getElementById('profile-modal-age').innerText = `${user.age || 20} Años`;
    
    const bioTextarea = document.getElementById('profile-modal-bio');
    bioTextarea.value = user.bio || '';
    document.getElementById('bio-char-count').innerText = `${bioTextarea.value.length}/160`;
    
    selectedAvatarDataUrl = user.avatar || '';
    updateModalAvatarPreview(user.username, selectedAvatarDataUrl);
    highlightPresetAvatar(selectedAvatarDataUrl);
    
    const modal = document.getElementById('user-profile-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function closeUserProfile() {
    const modal = document.getElementById('user-profile-modal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

function updateModalAvatarPreview(username, avatar) {
    const preview = document.getElementById('profile-modal-avatar-preview');
    if (!preview) return;
    if (avatar) {
        preview.innerHTML = `<img src="${avatar}" class="w-full h-full object-cover" />`;
    } else {
        preview.innerHTML = username.charAt(0).toUpperCase();
    }
}

function selectPresetAvatar(presetName) {
    const presets = {
        avatar1: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
        avatar2: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
        avatar3: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
        avatar4: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Liam',
        avatar5: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Buster',
        avatar6: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Milo',
        avatar7: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bella',
        avatar8: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sasha',
        avatar9: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver',
        avatar10: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chloe',
        avatar11: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Loki',
        avatar12: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lily',
        avatar13: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia',
        avatar14: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo',
        avatar15: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Maya',
        avatar16: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ryan',
        avatar17: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
        avatar18: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Max'
    };
    
    const avatarUrl = presets[presetName];
    if (avatarUrl) {
        selectedAvatarDataUrl = avatarUrl;
        const user = getCurrentUser();
        updateModalAvatarPreview(user ? user.username : 'Z', selectedAvatarDataUrl);
        highlightPresetAvatar(selectedAvatarDataUrl);
    }
}

function highlightPresetAvatar(avatarUrl) {
    const presetButtons = document.querySelectorAll('.avatar-preset-btn');
    const presets = {
        avatar1: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
        avatar2: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka',
        avatar3: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
        avatar4: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Liam',
        avatar5: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Buster',
        avatar6: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Milo',
        avatar7: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bella',
        avatar8: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sasha',
        avatar9: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver',
        avatar10: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chloe',
        avatar11: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Loki',
        avatar12: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lily',
        avatar13: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia',
        avatar14: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo',
        avatar15: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Maya',
        avatar16: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ryan',
        avatar17: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
        avatar18: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Max'
    };
    
    presetButtons.forEach((btn, idx) => {
        const key = `avatar${idx + 1}`;
        if (presets[key] === avatarUrl) {
            btn.classList.add('border-blue-600', 'scale-105');
        } else {
            btn.classList.remove('border-blue-600', 'scale-105');
        }
    });
}

function handleProfileImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 1024 * 1024) {
        alert('La imagen es demasiado grande. Elige una de menos de 1 MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        selectedAvatarDataUrl = e.target.result;
        const user = getCurrentUser();
        updateModalAvatarPreview(user ? user.username : 'Z', selectedAvatarDataUrl);
        highlightPresetAvatar('');
    };
    reader.readAsDataURL(file);
}

async function saveUserProfile() {
    const user = getCurrentUser();
    if (!user) return;
    
    const bioText = document.getElementById('profile-modal-bio').value;
    
    await ensureFirebase();
    let savedOnServer = false;
    try {
        if (window.firebase && window.firebase.apps.length) {
            const currentUser = window.firebase.auth().currentUser;
            if (currentUser) {
                await window.firebase.firestore().collection("users").doc(currentUser.uid).update({
                    avatar: selectedAvatarDataUrl,
                    bio: bioText
                });
                savedOnServer = true;
            }
        }
    } catch (e) {
        console.warn("Error al guardar perfil en Firebase, usando guardado local:", e);
    }
    
    // Guardar cambios en el almacenamiento local siempre
    user.avatar = selectedAvatarDataUrl;
    user.bio = bioText;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    
    // Actualizar también en la lista ea_mock_users
    try {
        const localUsers = JSON.parse(localStorage.getItem('ea_mock_users') || '[]');
        const updatedUsers = localUsers.map(u => {
            if (u.username === user.username) {
                return { ...u, avatar: selectedAvatarDataUrl, bio: bioText };
            }
            return u;
        });
        localStorage.setItem('ea_mock_users', JSON.stringify(updatedUsers));
    } catch (err) {
        console.error("Error al actualizar la lista local de usuarios:", err);
    }
    
    closeUserProfile();
    updateNavUI();
    
    window.dispatchEvent(new CustomEvent('profileUpdated'));
}

// Función para alternar visibilidad de contraseña
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input || !btn) return;
    const icon = btn.querySelector('.material-symbols-outlined');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.innerText = 'visibility_off';
    } else {
        input.type = 'password';
        if (icon) icon.innerText = 'visibility';
    }
}

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

// Exponer funciones globales para compatibilidad de los HTML antiguos
window.getCurrentUser = getCurrentUser;
window.login = login;
window.loginWithGoogle = loginWithGoogle;
window.register = register;
window.logout = logout;
window.updateNavUI = updateNavUI;
window.toggleProfileDropdown = toggleProfileDropdown;
window.openUserProfile = openUserProfile;
window.closeUserProfile = closeUserProfile;
window.selectPresetAvatar = selectPresetAvatar;
window.handleProfileImageUpload = handleProfileImageUpload;
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
