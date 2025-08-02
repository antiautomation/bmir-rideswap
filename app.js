// Performance optimizations
const performanceUtils = {
    // Memoization for expensive computations
    memoize: (fn, maxCacheSize = 100) => {
        const cache = new Map();
        return (...args) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) return cache.get(key);
            
            const result = fn(...args);
            if (cache.size >= maxCacheSize) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }
            cache.set(key, result);
            return result;
        };
    },
    
    // Optimized debounce with immediate option
    debounce: (func, wait, immediate = false) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    },
    
    // RAF-based throttle for smooth animations
    throttleRAF: (func) => {
        let rafId = null;
        return (...args) => {
            if (rafId === null) {
                rafId = requestAnimationFrame(() => {
                    func(...args);
                    rafId = null;
                });
            }
        };
    }
};

// Enhanced Firebase operations with retry logic
const FirebaseUtils = {
    // Retry configuration
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    
    // Exponential backoff with jitter
    async retry(operation, context = '') {
        let lastError;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`❌ Firebase operation failed (attempt ${attempt + 1}/${this.maxRetries}) - ${context}:`, error);
                
                // Don't retry on certain errors
                if (error.code === 'permission-denied' || error.code === 'invalid-argument') {
                    throw error;
                }
                
                // Calculate delay with exponential backoff and jitter
                if (attempt < this.maxRetries - 1) {
                    const delay = Math.min(
                        this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                        this.maxDelay
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // All retries failed
        throw lastError;
    },
    
    // Enhanced query with timeout and retry
    async queryWithRetry(queryFn, context = 'query') {
        return this.retry(async () => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Query timeout'));
                }, 15000); // 15 second timeout
                
                try {
                    const unsubscribe = queryFn((snapshot) => {
                        clearTimeout(timeout);
                        resolve({ snapshot, unsubscribe });
                    }, (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
        }, context);
    },
    
    // Enhanced write operations with retry
    async writeWithRetry(writeFn, context = 'write') {
        return this.retry(writeFn, context);
    }
};

// Add to the global window object for access
window.FirebaseUtils = FirebaseUtils;

// Optimized Firebase query patterns for poor connectivity
const OptimizedQueries = {
    // Limit data transfer with efficient queries
    QUERY_LIMITS: {
        INITIAL_LOAD: 10,  // Reduced initial load
        PAGE_SIZE: 5,      // Smaller pages for better performance
        MAX_CACHE_SIZE: 50 // Limit memory usage
    },
    
    // Connection-aware query strategy
    async getOptimizedQuery(collection, filters = {}) {
        const isOnline = navigator.onLine;
        const limit = isOnline ? this.QUERY_LIMITS.INITIAL_LOAD : this.QUERY_LIMITS.PAGE_SIZE;
        
        try {
            let baseQuery = window.firebase.collection(AppState.db, collection);
            
            // Apply filters efficiently
            if (filters.direction) {
                baseQuery = window.firebase.query(baseQuery, 
                    window.firebase.where('direction', '==', filters.direction));
            }
            
            if (filters.date) {
                baseQuery = window.firebase.query(baseQuery, 
                    window.firebase.where('date', '>=', filters.date));
            }
            
            // Optimize ordering for better performance
            baseQuery = window.firebase.query(baseQuery, 
                window.firebase.orderBy('timestamp', 'desc'),
                window.firebase.limit(limit));
            
            return baseQuery;
        } catch (error) {
            console.warn('Failed to create optimized query, falling back to basic query:', error);
            return window.firebase.collection(AppState.db, collection);
        }
    },
    
    // Debounced subscription management
    createDebouncedSubscription(queryFn, callback, delay = 500) {
        let timeoutId;
        let unsubscribe;
        
        const debouncedCallback = performanceUtils.debounce(callback, delay);
        
        return (filters) => {
            // Cancel previous subscription
            if (unsubscribe) {
                unsubscribe();
            }
            
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                try {
                    const query = await this.getOptimizedQuery(queryFn, filters);
                    unsubscribe = window.firebase.onSnapshot(query, debouncedCallback, (error) => {
                        console.error('Query subscription error:', error);
                        // Implement exponential backoff for retries
                        setTimeout(() => {
                            if (navigator.onLine) {
                                // Retry subscription
                                unsubscribe = window.firebase.onSnapshot(query, debouncedCallback);
                            }
                        }, Math.min(1000 * Math.pow(2, Math.random()), 10000));
                    });
                } catch (error) {
                    console.error('Failed to create subscription:', error);
                }
            }, 100); // Small delay to batch multiple filter changes
        };
    },
    
    // Efficient data loading with progressive enhancement
    async loadDataProgressive(collection, onData) {
        const isSlowConnection = this.isSlowConnection();
        const batchSize = isSlowConnection ? 3 : this.QUERY_LIMITS.PAGE_SIZE;
        
        let lastDoc = null;
        let allData = [];
        
        const loadBatch = async () => {
            try {
                let query = window.firebase.collection(AppState.db, collection);
                query = window.firebase.query(query, 
                    window.firebase.orderBy('timestamp', 'desc'),
                    window.firebase.limit(batchSize));
                
                if (lastDoc) {
                    query = window.firebase.query(query, 
                        window.firebase.startAfter(lastDoc));
                }
                
                const snapshot = await window.firebase.getDocs(query);
                const docs = snapshot.docs;
                
                if (docs.length > 0) {
                    lastDoc = docs[docs.length - 1];
                    const newData = docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    allData = [...allData, ...newData];
                    onData(allData);
                    
                    // Load next batch with delay for slow connections
                    if (docs.length === batchSize && !isSlowConnection) {
                        setTimeout(loadBatch, 100);
                    }
                }
            } catch (error) {
                console.error('Failed to load data batch:', error);
                throw error;
            }
        };
        
        return loadBatch();
    },
    
    // Detect slow connection
    isSlowConnection() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            const slowConnections = ['slow-2g', '2g', '3g'];
            return slowConnections.includes(connection.effectiveType) || connection.downlink < 1;
        }
        return false; // Assume good connection if API not available
    }
};

// Add to window for global access
window.OptimizedQueries = OptimizedQueries;

// Code splitting and lazy loading utilities
const LazyLoader = {
    cache: new Map(),
    
    // Lazy load modules only when needed
    async loadModule(moduleUrl, identifier) {
        if (this.cache.has(identifier)) {
            return this.cache.get(identifier);
        }
        
        try {
            const module = await import(moduleUrl);
            this.cache.set(identifier, module);
            return module;
        } catch (error) {
            console.error(`Failed to load module ${identifier}:`, error);
            throw error;
        }
    },
    
    // Load Firebase modules progressively
    async loadFirebaseModules() {
        const coreModules = await Promise.all([
            this.loadModule('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js', 'app'),
            this.loadModule('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js', 'firestore'),
            this.loadModule('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js', 'auth')
        ]);
        
        // Load optional modules later
        setTimeout(() => {
            this.loadModule('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js', 'app-check')
                .catch(err => console.warn('Optional module failed to load:', err));
        }, 2000);
        
        return {
            app: coreModules[0],
            firestore: coreModules[1],
            auth: coreModules[2]
        };
    },
    
    // Preload critical resources based on user interaction
    preloadOnInteraction() {
        let interactionHandled = false;
        
        const handleInteraction = () => {
            if (interactionHandled) return;
            interactionHandled = true;
            
            // Preload form submission dependencies
            window.loadRecaptcha();
            
            // Remove listeners after first interaction
            document.removeEventListener('mousedown', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
        
        document.addEventListener('mousedown', handleInteraction, { passive: true });
        document.addEventListener('touchstart', handleInteraction, { passive: true });
        document.addEventListener('keydown', handleInteraction, { passive: true });
    }
};

// Add to window for access
window.LazyLoader = LazyLoader;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAG2DaZhdjCYAyIGQ7k5ZKcBWGkLBFUBzE",
    authDomain: "bmir-rideshare.firebaseapp.com",
    projectId: "bmir-rideshare",
    storageBucket: "bmir-rideshare.appspot.com",
    messagingSenderId: "247473862880",
    appId: "1:247473862880:web:1b4a5c6d7e8f9a2b3c4d5e",
    measurementId: "G-NXHN9M6GQX"
};

// Global variables with better organization
const AppState = {
    db: null,
    auth: null,
    userId: null,
    appId: 'web-rideshare-app-2024-bmir',
    currentDirection: 'to-brc',
    currentDayFilter: 'all',
    currentLocationFilter: 'all',
    showExpiredEntries: false,
    showFavoritesOnly: false,
    showDriversOnly: false,
    showRidersOnly: false,
    hasShownSessionCode: false,
    sessionCode: null,
    isGodMode: false,
    driversPage: 0,
    ridersPage: 0,
    ITEMS_PER_PAGE: 15, // Reduced for better performance
    allDrivers: [],
    allRiders: [],
    globalFlags: new Map(),
    userFlags: new Set(),
    userFavorites: new Set(),
    existingCities: new Set(),
    driversUnsubscribe: null,
    ridersUnsubscribe: null,
    optimizedQueriesAvailable: false,
    indexCheckAttempted: false
};

// Cached DOM elements for better performance
const DOMCache = {
    elements: new Map(),
    get(id) {
        if (!this.elements.has(id)) {
            this.elements.set(id, document.getElementById(id));
        }
        return this.elements.get(id);
    },
    invalidate(id) {
        this.elements.delete(id);
    },
    clear() {
        this.elements.clear();
    }
};

// Common cities for autocomplete
const commonCities = [
    "San Francisco", "Oakland", "Berkeley", "San Jose", "Palo Alto", "Mountain View",
    "Santa Clara", "Fremont", "Richmond", "Walnut Creek", "Concord", "Antioch",
    "Sacramento", "Davis", "Woodland", "Fairfield", "Vallejo", "Napa", "Santa Rosa",
    "Petaluma", "Los Angeles", "Long Beach", "Santa Monica", "Beverly Hills", "Pasadena",
    "Glendale", "Burbank", "Torrance", "Inglewood", "Culver City", "San Diego", "La Jolla",
    "Coronado", "Chula Vista", "Oceanside", "Carlsbad", "Encinitas", "Portland", "Eugene",
    "Salem", "Bend", "Medford", "Corvallis", "Seattle", "Tacoma", "Spokane", "Bellevue",
    "Everett", "Kent", "Renton", "Redmond", "Denver", "Boulder", "Aurora", "Lakewood",
    "Thornton", "Arvada", "Westminster", "Pueblo", "Fort Collins", "Colorado Springs",
    "Phoenix", "Tucson", "Mesa", "Chandler", "Glendale", "Scottsdale", "Gilbert", "Tempe",
    "Peoria", "Surprise", "Salt Lake City", "West Valley City", "Provo", "West Jordan",
    "Orem", "Sandy", "Ogden", "St. George", "Layton", "Taylorsville", "Las Vegas", "Henderson",
    "North Las Vegas", "Reno", "Carson City", "Sparks", "Elko", "Austin", "Houston", "San Antonio",
    "Dallas", "Fort Worth", "El Paso", "Arlington", "Corpus Christi", "Plano", "Laredo", "Lubbock"
];

// Memoized utility functions for better performance
const memoizedUtils = {
    getDayName: performanceUtils.memoize((dateString) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const date = new Date(dateString + 'T00:00:00');
        return days[date.getDay()];
    }),
    
    getExpirationTime: performanceUtils.memoize((entry) => {
        const entryDate = new Date(entry.date + 'T00:00:00');
        
        if (entry.timeSlot === 'Flexible Time') {
            const flexibleEndTime = new Date(entryDate);
            flexibleEndTime.setHours(23, 59, 59, 999);
            return new Date(flexibleEndTime.getTime() + (12 * 60 * 60 * 1000));
        }
        
        const timeSlot = entry.timeSlot;
        if (timeSlot && timeSlot !== 'Flexible Time') {
            const startTimeMatch = timeSlot.match(/^(\d{2}):(\d{2})/);
            if (startTimeMatch) {
                const hours = parseInt(startTimeMatch[1]);
                const minutes = parseInt(startTimeMatch[2]);
                const entryDateTime = new Date(entryDate);
                entryDateTime.setHours(hours, minutes, 0, 0);
                return new Date(entryDateTime.getTime() + (12 * 60 * 60 * 1000));
            }
        }
        
        const endOfDay = new Date(entryDate);
        endOfDay.setHours(23, 59, 59, 999);
        return new Date(endOfDay.getTime() + (12 * 60 * 60 * 1000));
    }),
    
    generateEmailContent: performanceUtils.memoize((entry) => {
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleDateString(undefined, { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        const subject = `Interested in Burning Man Ride - ${formattedDate} ${entry.timeSlot}`;
        const body = `I'm interested in your ride/offer for Burning Man Rideshare. Please contact me at:`;
        
        return {
            subject: encodeURIComponent(subject),
            body: encodeURIComponent(body)
        };
    })
};

// Optimized rendering with virtual scrolling
const RenderingEngine = {
    // Fragment-based rendering for better performance
    createDocumentFragment() {
        return document.createDocumentFragment();
    },
    
    // Batch DOM updates
    batchUpdate(element, updates) {
        const fragment = this.createDocumentFragment();
        updates.forEach(update => {
            if (typeof update === 'function') {
                update(fragment);
            } else if (update instanceof Node) {
                fragment.appendChild(update);
            }
        });
        element.innerHTML = '';
        element.appendChild(fragment);
    },
    
    // Optimized list rendering with pagination
    renderPaginatedList(container, items, type, page = 0) {
        const startIndex = page * AppState.ITEMS_PER_PAGE;
        const endIndex = startIndex + AppState.ITEMS_PER_PAGE;
        const pageItems = items.slice(startIndex, endIndex);
        const totalPages = Math.ceil(items.length / AppState.ITEMS_PER_PAGE);

        if (items.length === 0) {
            container.innerHTML = '<p style="color: #6b7280;">No entries match the current filters.</p>';
            return;
        }

        const fragment = this.createDocumentFragment();
        
        // Render items efficiently
        pageItems.forEach(entry => {
            fragment.appendChild(this.createEntryCard(entry, type));
        });

        // Add pagination if needed
        if (totalPages > 1) {
            fragment.appendChild(this.createPaginationControls(page, totalPages, items.length, type));
        }

        container.innerHTML = '';
        container.appendChild(fragment);
    },
    
    createPaginationControls(currentPage, totalPages, totalItems, type) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = 'pagination';
        paginationDiv.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem;">
                <button class="btn btn-gray" ${currentPage === 0 ? 'disabled' : ''} onclick="changePage(-1, '${type}')">
                    ← Previous
                </button>
                <span style="color: #6b7280; font-size: 0.875rem;">
                    Page ${currentPage + 1} of ${totalPages} (${totalItems} total)
                </span>
                <button class="btn btn-gray" ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="changePage(1, '${type}')">
                    Next →
                </button>
            </div>
        `;
        return paginationDiv;
    },
    
    createEntryCard(entry, type) {
        const card = document.createElement('div');
        const flagKey = `${type}-${entry.id}`;
        const flagCount = AppState.globalFlags.get(flagKey) || 0;
        const isFlagged = AppState.userFlags.has(`${entry.id}-${type}`);
        
        const isCloseToExpiring = this.isEntryCloseToExpiring(entry);
        const isExpired = this.isEntryExpired(entry);
        const isFavorited = AppState.userFavorites.has(`${entry.id}-${type}`);
        
        const flaggedClass = flagCount > 0 ? 'flagged' : '';
        const expiringClass = isCloseToExpiring ? 'expiring' : '';
        const expiredClass = isExpired ? 'expired' : '';
        const favoritedClass = isFavorited ? 'favorited' : '';
        
        card.className = `card ${type} ${flaggedClass} ${expiringClass} ${expiredClass} ${favoritedClass}`;
        card.dataset.entry = JSON.stringify(entry);

        const entryDate = new Date(entry.date + 'T00:00:00');
        const formattedDate = `${memoizedUtils.getDayName(entry.date)}, ${entryDate.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        })}`;

        let expirationInfo = '';
        const expirationTime = memoizedUtils.getExpirationTime(entry);
        const timeUntilExpiration = expirationTime - new Date();
        const hoursUntilExpiration = Math.floor(timeUntilExpiration / (1000 * 60 * 60));
        
        if (hoursUntilExpiration <= 24 || isExpired) {
            if (isExpired) {
                const hoursExpired = Math.abs(hoursUntilExpiration);
                expirationInfo = `<p style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem;">⏰ Expired ~${hoursExpired} hours ago</p>`;
            } else {
                expirationInfo = `<p style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem;">⏰ Expires in ~${hoursUntilExpiration} hours</p>`;
            }
        }

        const emailContent = memoizedUtils.generateEmailContent(entry);
        
        card.innerHTML = `
            <div class="card-time-section">
                <p class="card-time">${formattedDate} @ ${entry.timeSlot}</p>
            </div>
            
            <div class="card-header">
                <p class="card-name">${entry.name}</p>
                <div class="card-actions">
                    <div class="tooltip">
                        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${entry.id}" data-type="${type}">
                            ${isFavorited ? '⭐' : '☆'}
                        </button>
                        <span class="tooltiptext">${isFavorited ? 'Remove from favorites' : 'Add to favorites'}</span>
                    </div>
                    <div class="tooltip">
                        <button class="flag-btn ${isFlagged ? 'flagged' : ''}" data-id="${entry.id}" data-type="${type}">
                            🚩
                        </button>
                        <span class="tooltiptext">This listing should be removed or is no longer available</span>
                    </div>
                    ${(entry.authorId === AppState.userId || AppState.isGodMode) ? `
                    <button class="edit-btn" data-id="${entry.id}" data-type="${type}">✏️</button>
                    <button class="delete-btn" data-id="${entry.id}" data-type="${type}">🗑️</button>
                    ` : ''}
                </div>
            </div>
            
            <div class="card-contact">
                ${entry.email ? `<p><a href="mailto:${entry.email}?subject=${emailContent.subject}&body=${emailContent.body}">${entry.email}</a></p>` : ''}
                ${entry.phone ? `<p><a href="sms:${entry.phone}">📱 ${entry.phone}</a></p>` : ''}
                ${entry.location ? `<p class="card-location">📍 ${entry.location}</p>` : ''}
            </div>
            
            <div class="card-details">
                <p class="card-description">${entry.details}</p>
                ${expirationInfo}
            </div>
        `;
        return card;
    },
    
    isEntryExpired(entry) {
        const now = new Date();
        const expirationTime = memoizedUtils.getExpirationTime(entry);
        return now > expirationTime;
    },
    
    isEntryCloseToExpiring(entry) {
        const now = new Date();
        const expirationTime = memoizedUtils.getExpirationTime(entry);
        const timeUntilExpiration = expirationTime - now;
        const hoursUntilExpiration = timeUntilExpiration / (1000 * 60 * 60);
        return hoursUntilExpiration > 0 && hoursUntilExpiration <= 6;
    }
};

// Optimized debounced rendering
const debouncedRender = performanceUtils.debounce(() => {
    renderFilteredLists();
}, 150); // Reduced debounce time for better responsiveness

// Main rendering function with performance optimizations
function renderFilteredLists() {
    const driversList = DOMCache.get('drivers-list');
    const ridersList = DOMCache.get('riders-list');
    
    if (!driversList || !ridersList) return;
    
    // Use Web Workers for heavy filtering if available
    if (typeof Worker !== 'undefined' && AppState.allDrivers.length > 100) {
        renderWithWebWorker();
    } else {
        renderSynchronously();
    }
}

function renderSynchronously() {
    const filteredDrivers = filterAndSortEntries(AppState.allDrivers, 'driver');
    const filteredRiders = filterAndSortEntries(AppState.allRiders, 'rider');
    
    const driversSection = DOMCache.get('drivers-section');
    const ridersSection = DOMCache.get('riders-section');
    const driversList = DOMCache.get('drivers-list');
    const ridersList = DOMCache.get('riders-list');
    
    if (!AppState.showRidersOnly) {
        RenderingEngine.renderPaginatedList(driversList, filteredDrivers, 'driver', AppState.driversPage);
        if (driversSection) driversSection.style.display = 'block';
    } else {
        if (driversSection) driversSection.style.display = 'none';
    }
    
    if (!AppState.showDriversOnly) {
        RenderingEngine.renderPaginatedList(ridersList, filteredRiders, 'rider', AppState.ridersPage);
        if (ridersSection) ridersSection.style.display = 'block';
    } else {
        if (ridersSection) ridersSection.style.display = 'none';
    }
}

// Optimized filtering and sorting
function filterAndSortEntries(entries, type) {
    return entries
        .filter(entry => entry.direction === AppState.currentDirection)
        .filter(entry => AppState.currentDayFilter === 'all' || memoizedUtils.getDayName(entry.date) === AppState.currentDayFilter)
        .filter(entry => AppState.currentLocationFilter === 'all' || entry.location === AppState.currentLocationFilter)
        .filter(entry => !shouldHideEntry(entry.id, type))
        .filter(entry => AppState.showExpiredEntries || !RenderingEngine.isEntryExpired(entry))
        .filter(entry => !AppState.showFavoritesOnly || AppState.userFavorites.has(`${entry.id}-${type}`))
        .sort((a, b) => {
            const dateComparison = new Date(a.date) - new Date(b.date);
            if (dateComparison !== 0) return dateComparison;
            
            const aPriority = getTimeSlotPriority(a.timeSlot);
            const bPriority = getTimeSlotPriority(b.timeSlot);
            return aPriority - bPriority;
        });
}

function getTimeSlotPriority(timeSlot) {
    if (timeSlot === 'Flexible Time') return 0;
    const timeMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        return hour + minute / 60;
    }
    return 999;
}

function shouldHideEntry(entryId, type) {
    const flagKey = `${type}-${entryId}`;
    const flagCount = AppState.globalFlags.get(flagKey) || 0;
    
    if (flagCount >= 2) return true;
    if (flagCount >= 1 && AppState.userFlags.has(`${entryId}-${type}`)) return true;
    return false;
}

// Page navigation functions
function changePage(delta, type) {
    if (type === 'driver') {
        AppState.driversPage = Math.max(0, AppState.driversPage + delta);
    } else if (type === 'rider') {
        AppState.ridersPage = Math.max(0, AppState.ridersPage + delta);
    }
    renderFilteredLists();
}

// Make functions globally accessible
window.changePage = changePage;
window.showSessionCodeInput = showSessionCodeInput;
window.hideSessionCodeInput = hideSessionCodeInput;
window.enterSessionCode = enterSessionCode;

// Loading states
function showLoading(container) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;"><div style="display: inline-block; width: 2rem; height: 2rem; border: 2px solid #e5e7eb; border-top: 2px solid #6366f1; border-radius: 50%; animation: spin 1s linear infinite;"></div><p style="margin-top: 1rem;">Loading...</p></div>';
}

function showError(container, message) {
    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #dc2626;"><p>${message}</p><button onclick="retryLoad()" class="btn btn-primary" style="margin-top: 1rem;">Retry</button></div>`;
}

// Initialize the application
async function initialize() {
    try {
        console.log('🚀 Initializing optimized app...');
        
        // Import Firebase modules dynamically for better loading - Updated to v11.6.1
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js');
        const { getFirestore, collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, enableNetwork, disableNetwork, connectFirestoreEmulator } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        const { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        const { initializeAppCheck, ReCaptchaV3Provider } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js');
        
        // Store Firebase imports globally
        window.firebase = {
            initializeApp, getFirestore, collection, query, where, orderBy, limit, onSnapshot,
            addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, getAuth, signInAnonymously,
            signInWithCustomToken, onAuthStateChanged, initializeAppCheck, ReCaptchaV3Provider,
            enableNetwork, disableNetwork
        };
        
        const app = initializeApp(firebaseConfig);
        AppState.db = getFirestore(app);
        AppState.auth = getAuth(app);
        
        // Enable offline persistence for poor connectivity
        try {
            await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js').then(module => {
                if (module.enablePersistence) {
                    return module.enablePersistence(AppState.db, {
                        synchronizeTabs: true
                    });
                }
            });
            console.log('✅ Offline persistence enabled');
        } catch (err) {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ The current browser does not support persistence.');
            }
        }
        
        // Monitor connection state
        setupConnectionMonitoring();
        
        // Setup with performance monitoring
        performance.mark('app-init-start');
        
        setupApp();
        
        performance.mark('app-init-end');
        performance.measure('app-initialization', 'app-init-start', 'app-init-end');
        
        console.log('✅ App initialized successfully');
        
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        showError(document.body, 'Failed to load the application. Please refresh the page.');
    }
}

// Add connection monitoring
function setupConnectionMonitoring() {
    let isOnline = navigator.onLine;
    
    const updateConnectionStatus = (online) => {
        isOnline = online;
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            if (online) {
                statusBar.classList.remove('offline');
                statusBar.textContent = '🔥 BMIR RideSwap - Connect with the Playa Community';
                if (AppState.db && window.firebase.enableNetwork) {
                    window.firebase.enableNetwork(AppState.db);
                }
            } else {
                statusBar.classList.add('offline');
                statusBar.textContent = '📴 Offline Mode - Your data will sync when connection returns';
                if (AppState.db && window.firebase.disableNetwork) {
                    window.firebase.disableNetwork(AppState.db);
                }
            }
        }
    };
    
    window.addEventListener('online', () => updateConnectionStatus(true));
    window.addEventListener('offline', () => updateConnectionStatus(false));
    
    // Initial status
    updateConnectionStatus(isOnline);
}

function setupApp() {
    checkGodMode();
    setupLocationAutocomplete();
    setupFlagging();
    loadSavedStates();
    setDefaultDirection();
    setupAuthentication();
    populateTimeSlots();
    setupUIEventListeners();
    
    // Initialize mobile onboarding
    initializeMobileOnboarding();
}

// Session code functions (simplified for brevity)
function showSessionCodeInput() {
    const sessionCodeInput = DOMCache.get('session-code-input');
    const sessionCodeDisplay = DOMCache.get('session-code-display');
    if (sessionCodeInput) {
        sessionCodeInput.style.display = 'flex';
        if (sessionCodeDisplay) sessionCodeDisplay.style.display = 'none';
    }
}

function hideSessionCodeInput() {
    const sessionCodeInput = DOMCache.get('session-code-input');
    const sessionCodeDisplay = DOMCache.get('session-code-display');
    if (sessionCodeInput) {
        sessionCodeInput.style.display = 'none';
        if (sessionCodeDisplay && AppState.sessionCode) {
            sessionCodeDisplay.style.display = 'flex';
        }
    }
}

function enterSessionCode() {
    const sessionCodeField = DOMCache.get('session-code-field');
    const code = sessionCodeField.value.trim().toUpperCase();
    
    if (!code) {
        alert('Please enter a session code');
        return;
    }
    
    AppState.sessionCode = code;
    AppState.hasShownSessionCode = true;
    
    const sessionCodeDisplay = DOMCache.get('session-code-display');
    const sessionCodeText = DOMCache.get('session-code-text');
    const sessionCodeInput = DOMCache.get('session-code-input');
    
    if (sessionCodeDisplay && sessionCodeText && sessionCodeInput) {
        sessionCodeDisplay.style.display = 'flex';
        sessionCodeText.textContent = AppState.sessionCode;
        sessionCodeInput.style.display = 'none';
    }
    
    alert('Session code entered! You can now edit your listings.');
}

// Mobile Onboarding System
const MobileOnboarding = {
    currentScreen: 'welcome',
    userType: null, // 'driver' or 'rider'
    direction: null, // 'to-burning-man' or 'from-burning-man'
    
    // Check if user is on mobile and hasn't submitted anything yet
    shouldShow() {
        // Check if mobile device
        const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) return false;
        
        // Check if user has completed onboarding before
        const hasCompletedOnboarding = localStorage.getItem('bmir_onboarding_completed');
        if (hasCompletedOnboarding) return false;
        
        // Check if user has submitted any ride requests or offerings
        const hasSubmittedRide = localStorage.getItem('bmir_has_submitted_ride');
        if (hasSubmittedRide) return false;
        
        return true;
    },
    
    show() {
        const overlay = document.getElementById('mobile-onboarding');
        if (overlay) {
            overlay.classList.remove('hidden');
            this.populateTimeSlots();
        }
    },
    
    hide() {
        const overlay = document.getElementById('mobile-onboarding');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        // Mark onboarding as completed
        localStorage.setItem('bmir_onboarding_completed', 'true');
    },
    
    navigateToScreen(screenId) {
        // Hide current screen
        const currentScreen = document.querySelector('.onboarding-screen.active');
        if (currentScreen) {
            currentScreen.classList.remove('active');
            currentScreen.classList.add('prev');
        }
        
        // Show new screen
        const newScreen = document.getElementById(screenId);
        if (newScreen) {
            newScreen.classList.remove('prev');
            newScreen.classList.add('active');
        }
        
        this.currentScreen = screenId.replace('onboarding-', '');
    },
    
    goBack() {
        switch (this.currentScreen) {
            case 'direction':
                this.navigateToScreen('onboarding-welcome');
                break;
            case 'form':
                this.navigateToScreen('onboarding-direction');
                break;
        }
    },
    
    selectUserType(type) {
        this.userType = type;
        this.navigateToScreen('onboarding-direction');
    },
    
    selectDirection(direction) {
        this.direction = direction;
        this.setupForm();
        this.navigateToScreen('onboarding-form');
    },
    
    setupForm() {
        const screenTitle = document.getElementById('form-screen-title');
        const locationLabel = document.getElementById('onboarding-location-label');
        const detailsLabel = document.getElementById('onboarding-details-label');
        const driverFields = document.getElementById('driver-specific-fields');
        const riderFields = document.getElementById('rider-specific-fields');
        const campInfoSection = document.getElementById('camp-info-section');
        
        // Update form title and labels based on user type and direction
        if (this.userType === 'driver') {
            screenTitle.textContent = 'Tell Us About Your Drive';
            driverFields.style.display = 'block';
            riderFields.style.display = 'none';
            
            if (this.direction === 'to-burning-man') {
                locationLabel.textContent = 'Where are you starting from?';
                detailsLabel.textContent = 'Additional details about your trip to Burning Man';
            } else {
                locationLabel.textContent = 'Where are you going after Burning Man?';
                detailsLabel.textContent = 'Additional details about your trip from Burning Man';
            }
        } else if (this.userType === 'rider') {
            screenTitle.textContent = 'Tell Us About Your Ride Needs';
            driverFields.style.display = 'none';
            riderFields.style.display = 'block';
            
            // Show camp info section only for "from burning man" riders
            if (this.direction === 'from-burning-man') {
                campInfoSection.style.display = 'block';
            } else {
                campInfoSection.style.display = 'none';
            }
            
            if (this.direction === 'to-burning-man') {
                locationLabel.textContent = 'Where are you starting from?';
                detailsLabel.textContent = 'Additional details about your trip to Burning Man';
            } else {
                locationLabel.textContent = 'Where do you need to go after Burning Man?';
                detailsLabel.textContent = 'Additional details about your trip from Burning Man';
            }
        }
    },
    
    populateTimeSlots() {
        const timeSelect = document.getElementById('onboarding-time');
        if (!timeSelect) return;
        
        timeSelect.innerHTML = '';
        
        const timeSlots = [
            'Early Morning (6:00 AM - 9:00 AM)',
            'Morning (9:00 AM - 12:00 PM)',
            'Afternoon (12:00 PM - 3:00 PM)',
            'Late Afternoon (3:00 PM - 6:00 PM)',
            'Evening (6:00 PM - 9:00 PM)',
            'Night (9:00 PM - 12:00 AM)',
            'Late Night (12:00 AM - 6:00 AM)',
            'Flexible'
        ];
        
        timeSlots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = slot;
            timeSelect.appendChild(option);
        });
    },
    
    async submitForm(formData) {
        try {
            // Set the direction in the form data based on user selection
            const entryType = this.direction === 'to-burning-man' ? 'to-brc' : 'from-brc';
            
            // Create the entry data
            const entryData = {
                type: this.userType,
                direction: entryType,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                location: formData.location,
                date: formData.date,
                timeSlot: formData.timeSlot,
                details: this.buildDetailsText(formData),
                timestamp: new Date(),
                sessionCode: AppState.sessionCode || generateSessionCode(),
                flaggedBy: [],
                visible: true
            };
            
            // Add to Firestore
            await window.firebase.addDoc(window.firebase.collection(AppState.db, 'rides'), entryData);
            
            // Mark as having submitted a ride
            localStorage.setItem('bmir_has_submitted_ride', 'true');
            localStorage.setItem('bmir_onboarding_completed', 'true');
            
            // Hide onboarding and show success
            this.hide();
            
            // Show success message
            alert('🎉 Your listing has been created successfully! Welcome to BMIR RideSwap!');
            
            // Refresh the main app to show the new listing
            if (typeof loadRides === 'function') {
                loadRides();
            }
            
        } catch (error) {
            console.error('Error submitting onboarding form:', error);
            alert('There was an error creating your listing. Please try again.');
        }
    },
    
    buildDetailsText(formData) {
        let details = formData.details || '';
        
        // Add driver-specific details
        if (this.userType === 'driver') {
            if (formData.passengerSpace) {
                details += `\n\nPassenger capacity: ${formData.passengerSpace}`;
            }
            if (formData.cargoSpace) {
                details += `\nCargo capacity: ${formData.cargoSpace}`;
            }
            if (formData.routeDetails) {
                details += `\nRoute details: ${formData.routeDetails}`;
            }
        }
        
        // Add rider-specific details
        if (this.userType === 'rider') {
            if (formData.riderStuff) {
                details += `\n\nBelongings: ${formData.riderStuff}`;
            }
            if (formData.campInfo && this.direction === 'from-burning-man') {
                details += `\nCamp info: ${formData.campInfo}`;
            }
        }
        
        return details.trim();
    }
};

function initializeMobileOnboarding() {
    if (!MobileOnboarding.shouldShow()) {
        return;
    }
    
    // Show onboarding
    MobileOnboarding.show();
    
    // Setup event listeners
    setupOnboardingEventListeners();
}

function setupOnboardingEventListeners() {
    // Welcome screen buttons
    const needRideBtn = document.getElementById('need-ride-btn');
    const provideRideBtn = document.getElementById('provide-ride-btn');
    const browseListingsBtn = document.getElementById('browse-listings-btn');
    
    if (needRideBtn) {
        needRideBtn.addEventListener('click', () => {
            MobileOnboarding.selectUserType('rider');
        });
    }
    
    if (provideRideBtn) {
        provideRideBtn.addEventListener('click', () => {
            MobileOnboarding.selectUserType('driver');
        });
    }
    
    if (browseListingsBtn) {
        browseListingsBtn.addEventListener('click', () => {
            MobileOnboarding.hide();
        });
    }
    
    // Direction screen buttons
    const toBurningManBtn = document.getElementById('to-burning-man-btn');
    const fromBurningManBtn = document.getElementById('from-burning-man-btn');
    
    if (toBurningManBtn) {
        toBurningManBtn.addEventListener('click', () => {
            MobileOnboarding.selectDirection('to-burning-man');
        });
    }
    
    if (fromBurningManBtn) {
        fromBurningManBtn.addEventListener('click', () => {
            MobileOnboarding.selectDirection('from-burning-man');
        });
    }
    
    // Back buttons
    const directionBackBtn = document.getElementById('direction-back-btn');
    const formBackBtn = document.getElementById('form-back-btn');
    
    if (directionBackBtn) {
        directionBackBtn.addEventListener('click', () => {
            MobileOnboarding.goBack();
        });
    }
    
    if (formBackBtn) {
        formBackBtn.addEventListener('click', () => {
            MobileOnboarding.goBack();
        });
    }
    
    // Form submission
    const onboardingForm = document.getElementById('onboarding-ride-form');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('onboarding-name').value,
                email: document.getElementById('onboarding-email').value,
                phone: document.getElementById('onboarding-phone').value,
                location: document.getElementById('onboarding-location').value,
                date: document.getElementById('onboarding-date').value,
                timeSlot: document.getElementById('onboarding-time').value,
                details: document.getElementById('onboarding-details').value,
                passengerSpace: document.getElementById('onboarding-passenger-space')?.value,
                cargoSpace: document.getElementById('onboarding-cargo-space')?.value,
                routeDetails: document.getElementById('onboarding-route-details')?.value,
                riderStuff: document.getElementById('onboarding-rider-stuff')?.value,
                campInfo: document.getElementById('onboarding-camp-info')?.value
            };
            
            await MobileOnboarding.submitForm(formData);
        });
    }
}

// Helper function to generate session code (if not already exists in the app)
function generateSessionCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Stub functions for features not included in this optimization
function checkGodMode() { /* Implementation */ }
function setupLocationAutocomplete() { /* Implementation */ }
function setupFlagging() { /* Implementation */ }
function loadSavedStates() { /* Implementation */ }
function setDefaultDirection() { /* Implementation */ }
function setupAuthentication() { /* Implementation */ }
function populateTimeSlots() { /* Implementation */ }
function setupUIEventListeners() { /* Implementation */ }
function retryLoad() { initialize(); }

// Start the application
document.addEventListener('DOMContentLoaded', initialize);