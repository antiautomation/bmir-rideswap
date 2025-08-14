// Global offline debugging utility
const OfflineDebugger = {
    isDevelopment: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    isOffline: false,
    debugMode: false,
    
    // Initialize offline debugging
    init() {
        this.isOffline = !navigator.onLine;
        this.updateOfflineStatus();
        
        window.addEventListener('online', () => {
            this.isOffline = false;
            this.updateOfflineStatus();
        });
        
        window.addEventListener('offline', () => {
            this.isOffline = true;
            this.updateOfflineStatus();
        });
    },
    
    // Update offline status - safe version that doesn't depend on FirebaseUtils
    updateOfflineStatus() {
        // Only update if FirebaseUtils exists
        if (typeof FirebaseUtils !== 'undefined') {
            FirebaseUtils.isOffline = this.isOffline;
        }
    },
    
    // Silent console logging for offline scenarios
    log(message, error = null, level = 'info') {
        if (this.isOffline && !this.isDevelopment) {
            // Suppress most logs in production when offline
            return;
        }
        
        if (this.isOffline && this.isDevelopment) {
            console.log(`[Offline] ${message}`, error || '');
            return;
        }
        
        switch (level) {
            case 'error':
                console.error(message, error);
                break;
            case 'warn':
                console.warn(message, error);
                break;
            default:
                console.log(message, error);
        }
    },
    
    // Enable debug mode for more verbose logging
    enableDebugMode() {
        this.debugMode = true;
    },
    
    // Disable debug mode
    disableDebugMode() {
        this.debugMode = false;
    }
};

// Shared Form Utilities for both onboarding and main application
const FormUtils = {
    // Helper function to remap old classification values to new ones
    remapBelongingsClassification(value) {
        if (!value) return value;
        
        const oldToNew = {
            // Old classifications that might exist in the database
            'low': 'minimal',
            'small': 'minimal',
            'basic': 'minimal',
            'none': 'minimal',
            
            'medium': 'standard',
            'normal': 'standard',
            'average': 'standard',
            
            'high': 'substantial',
            'large': 'substantial',
            'advanced': 'substantial',
            
            'very high': 'extensive',
            'very large': 'extensive',
            'maximum': 'extensive'
        };
        
        const lowerValue = value.toLowerCase().trim();
        return oldToNew[lowerValue] || value;
    },

    // Helper function to check if driver can accommodate rider belongings
    canDriverAccommodateBelongings(driverCargo, riderBelongings) {
        if (!driverCargo || !riderBelongings) return false;
        
        // Remap both values to ensure consistency
        const driverCargoRemapped = this.remapBelongingsClassification(driverCargo);
        const riderBelongingsRemapped = this.remapBelongingsClassification(riderBelongings);
        
        // Define hierarchy (higher index = more capacity)
        const hierarchy = ['minimal', 'standard', 'substantial', 'extensive'];
        
        const driverIndex = hierarchy.indexOf(driverCargoRemapped);
        const riderIndex = hierarchy.indexOf(riderBelongingsRemapped);
        
        // Driver can accommodate if their capacity is >= rider's belongings
        return driverIndex >= riderIndex;
    },

    // Helper function to check if driver matches belongings filter (hierarchical)
    driverMatchesBelongingsFilter(driverCargo, filterValue) {
        if (!filterValue || filterValue === 'all') return true;
        if (!driverCargo) return false;
        
        // Remap both values to ensure consistency
        const driverCargoRemapped = this.remapBelongingsClassification(driverCargo);
        const filterValueRemapped = this.remapBelongingsClassification(filterValue);
        
        // Define hierarchy (higher index = more capacity)
        const hierarchy = ['minimal', 'standard', 'substantial', 'extensive'];
        
        const driverIndex = hierarchy.indexOf(driverCargoRemapped);
        const filterIndex = hierarchy.indexOf(filterValueRemapped);
        
        // For drivers: show all drivers with capacity LESS THAN or EQUAL TO the filter
        // This means if filter is "extensive", show all drivers
        // If filter is "standard", show minimal and standard drivers
        return driverIndex <= filterIndex;
    },

    // Helper function to check if rider matches belongings filter (exact match)
    riderMatchesBelongingsFilter(riderBelongings, filterValue) {
        if (!filterValue || filterValue === 'all') return true;
        if (!riderBelongings) return false;
        
        // Remap both values to ensure consistency
        const riderBelongingsRemapped = this.remapBelongingsClassification(riderBelongings);
        const filterValueRemapped = this.remapBelongingsClassification(filterValue);
        
        // For riders: exact match only
        return riderBelongingsRemapped === filterValueRemapped;
    },

    // Production-ready data validation function
    validateEntry(data) {
        const errors = [];
        
        // Name validation
        if (!data.name || data.name.trim().length === 0) {
            errors.push("Name is required");
        } else if (data.name.length > 100) {
            errors.push("Name must be less than 100 characters");
        }
        
        // Contact validation
        if (!data.email && !data.phone) {
            errors.push("At least one contact method (email or phone) is required");
        }
        
        // Email validation
        if (data.email && data.email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                errors.push("Please enter a valid email address");
            }
            if (data.email.length > 100) {
                errors.push("Email must be less than 100 characters");
            }
        }
        
        // Phone validation
        if (data.phone && data.phone.trim()) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, '');
            if (!phoneRegex.test(cleanPhone)) {
                errors.push("Please enter a valid phone number");
            }
            if (data.phone.length > 20) {
                errors.push("Phone number must be less than 20 characters");
            }
        }
        
        // Location validation
        if (!data.location || data.location.trim().length === 0) {
            errors.push("Location is required");
        } else if (data.location.length > 100) {
            errors.push("Location must be less than 100 characters");
        }
        
        // Date validation
        if (!data.date) {
            errors.push("Date is required");
        } else {
            const selectedDate = new Date(data.date);
            const now = new Date();
            if (selectedDate < now.setDate(now.getDate() - 1)) {
                errors.push("Date cannot be in the past");
            }
            if (selectedDate > now.setDate(now.getDate() + 365)) {
                errors.push("Date cannot be more than 1 year in the future");
            }
        }
        
        // Details validation
        if (!data.details || data.details.trim().length === 0) {
            errors.push("Details are required");
        } else if (data.details.length > 1000) {
            errors.push("Details must be less than 1000 characters");
        }
        
        // Driver-specific required fields
        if (data.userType === 'driver') {
            // Passenger capacity validation
            if (!data.passengerSpace || data.passengerSpace.trim().length === 0) {
                errors.push("Passenger capacity is required for drivers");
            }
            
            // Cargo capacity validation
            if (!data.cargoSpace || data.cargoSpace.trim().length === 0) {
                errors.push("Cargo capacity is required for drivers");
            }
            
            // Route details validation
            if (!data.routeDetails || data.routeDetails.trim().length === 0) {
                errors.push("Route details are required for drivers");
            }
            
            // Camp info validation for "from-burning-man" drivers
            if (data.direction === 'from-burning-man') {
                if (!data.campInfo || data.campInfo.trim().length === 0) {
                    errors.push("Camp name and location is required for drivers coming from Burning Man");
                }
            }
        }
        
        // Rider-specific required fields
        if (data.userType === 'rider') {
            // Rider belongings validation
            if (!data.riderStuff || data.riderStuff.trim().length === 0) {
                errors.push("Amount of belongings is required for riders");
            }
            
            // Camp info validation for "from-burning-man" riders
            if (data.direction === 'from-burning-man') {
                if (!data.campInfo || data.campInfo.trim().length === 0) {
                    errors.push("Camp name and location is required for riders coming from Burning Man");
                }
            }
        }
        
        return errors;
    },
    
    // Date format validation
    validateDateFormat(dateString) {
        if (!dateString) return { valid: false, error: 'Date is required' };
        
        const dateParts = dateString.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const day = parseInt(dateParts[2]);
            
            // Check for European date format (DD-MM-YYYY) where month > 12
            if (month > 12) {
                return { 
                    valid: false, 
                    error: '⚠️ Date Format Error!\n\nIt looks like you entered the date in European format (DD/MM/YYYY) instead of US format (MM/DD/YYYY).\n\nPlease use the date picker or enter dates as MM/DD/YYYY (e.g., 08/03/2025 for August 3rd, 2025).'
                };
            }
            
            // Check for current year only
            const currentYear = new Date().getFullYear();
            if (year !== currentYear) {
                return { 
                    valid: false, 
                    error: `⚠️ Date Error!\n\nPlease enter a date for the current year (${currentYear}).`
                };
            }
        }
        
        return { valid: true };
    },
    
    // Standardize form data structure
    standardizeFormData(formData, userType, direction) {
        return {
            name: formData.name?.trim() || '',
            email: formData.email?.trim() || '',
            phone: formData.phone?.trim() || '',
            location: formData.location?.trim() || '',
            date: formData.date || '',
            timeSlot: formData.timeSlot || '',
            details: formData.details?.trim() || '',
            direction: direction === 'to-burning-man' ? 'to-brc' : 'from-brc',
            type: userType,
            timestamp: new Date(),
            deleted: false,
            flagged: false,
            favorites: [],
            
            // Driver-specific fields
            ...(userType === 'driver' && {
                passengerSpace: formData.passengerSpace?.trim() || '',
                cargoSpace: formData.cargoSpace?.trim() || '',
                routeDetails: formData.routeDetails?.trim() || '',
                campInfo: formData.campInfo?.trim() || ''
            }),
            
            // Rider-specific fields
            ...(userType === 'rider' && {
                riderStuff: formData.riderStuff?.trim() || '',
                campInfo: formData.campInfo?.trim() || ''
            })
        };
    },
    
    // Collect form data with consistent logic
    collectFormData(formPrefix = '', userType = null) {
        const baseData = {
            name: document.getElementById(`${formPrefix}name`)?.value?.trim() || '',
            email: document.getElementById(`${formPrefix}email`)?.value?.trim() || '',
            phone: document.getElementById(`${formPrefix}phone`)?.value?.trim() || '',
            location: document.getElementById(`${formPrefix}location`)?.value?.trim() || '',
            date: document.getElementById(`${formPrefix}date`)?.value || '',
            timeSlot: document.getElementById(`${formPrefix}time-slot` || `${formPrefix}time`)?.value || '',
            details: document.getElementById(`${formPrefix}details`)?.value?.trim() || '',
        };
        
        if (userType === 'driver') {
            return {
                ...baseData,
                passengerSpace: document.getElementById(`${formPrefix}passenger-space`)?.value?.trim() || '',
                cargoSpace: document.getElementById(`${formPrefix}cargo-space`)?.value?.trim() || '',
                routeDetails: document.getElementById(`${formPrefix}route-details`)?.value?.trim() || '',
                campInfo: document.getElementById(`${formPrefix}camp-info`)?.value?.trim() || ''
            };
        } else if (userType === 'rider') {
            return {
                ...baseData,
                riderStuff: document.getElementById(`${formPrefix}rider-stuff`)?.value?.trim() || '',
                campInfo: document.getElementById(`${formPrefix}camp-info`)?.value?.trim() || ''
            };
        }
        
        return baseData;
    },
    
    // Submit form to Firebase with consistent logic
    async submitFormToFirebase(formData, userType, direction, isOnboarding = false) {
        try {
            // Validate form data
            const validationErrors = this.validateEntry(formData);
            if (validationErrors.length > 0) {
                alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
                return { success: false, error: 'Validation failed' };
            }
            
            // Validate date format
            const dateValidation = this.validateDateFormat(formData.date);
            if (!dateValidation.valid) {
                alert(dateValidation.error);
                return { success: false, error: 'Date validation failed' };
            }
            
            // Safely access AppState
            if (typeof AppState === 'undefined') {
                console.error('AppState not available');
                return { success: false, error: 'Application state not initialized' };
            }
            
            // Ensure user is authenticated
            if (!AppState.auth?.currentUser) {
                console.log('User not authenticated, attempting to sign in anonymously...');
                
                // Check if Firebase auth is available
                if (!AppState.auth) {
                    console.log('⚠️ Firebase auth not initialized, using fallback...');
                    // For onboarding, we can proceed without authentication
                    // The form will be submitted with 'anonymous' authorId
                } else {
                    await window.firebase.signInAnonymously(AppState.auth);
                    console.log('Anonymous authentication completed');
                }
            }
            
            // Standardize the data structure
            const entryData = this.standardizeFormData(formData, userType, direction);
            
            // Use the correct user ID - prioritize AppState.userId since it's reliably set
            const userId = AppState.userId || 
                          AppState.auth?.currentUser?.uid || 
                          window.auth?.currentUser?.uid || 
                          'anonymous';
            
            entryData.authorId = userId;
            
            
            // Use the same collection path for both onboarding and main app
            // Use external config if available, otherwise fall back to AppState
            const appId = window.APP_CONFIG?.appId || AppState.appId;
            const collectionPath = `artifacts/${appId}/public/data/${userType}s`;
            
            console.log('Submitting to collection:', collectionPath);
            
            // Submit to Firebase
            
            
            if (!window.db || !window.auth) {
                console.log('⚠️ Firebase not initialized, attempting to wait for initialization...');
                
                // Try to wait for Firebase to be ready (max 10 seconds)
                let attempts = 0;
                const maxAttempts = 100; // 100 * 100ms = 10 seconds
                
                while (!window.db || !window.auth) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                    
                    if (attempts >= maxAttempts) {
                        console.log('⚠️ Firebase still not ready after 10 seconds, checking network status...');
                        
                        // Check if we're actually offline or just Firebase is slow
                        if (!navigator.onLine) {
                            console.log('⚠️ Network is offline, storing locally...');
                            // Store form data locally for later submission
                            const pendingSubmissions = JSON.parse(localStorage.getItem('bmir_pending_submissions') || '[]');
                            pendingSubmissions.push({
                                data: entryData,
                                timestamp: Date.now(),
                                collectionPath
                            });
                            localStorage.setItem('bmir_pending_submissions', JSON.stringify(pendingSubmissions));
                            
                            return { success: true, offline: true, message: 'Form saved locally - will sync when online' };
                        } else {
                            console.log('⚠️ Network is online but Firebase is slow, retrying...');
                            // Try one more time with a longer wait
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            if (!window.db || !window.auth) {
                                console.log('⚠️ Firebase still not ready, storing locally as fallback...');
                                const pendingSubmissions = JSON.parse(localStorage.getItem('bmir_pending_submissions') || '[]');
                                pendingSubmissions.push({
                                    data: entryData,
                                    timestamp: Date.now(),
                                    collectionPath
                                });
                                localStorage.setItem('bmir_pending_submissions', JSON.stringify(pendingSubmissions));
                                
                                return { success: true, offline: true, message: 'Form saved locally - will sync when online' };
                            }
                        }
                    }
                }
                
                console.log('✅ Firebase became ready after waiting');
            }
            
            // Debug: Check if Firebase functions are available
            
            
            const docRef = await FirebaseUtils.writeWithRetry(
                () => window.addDoc(window.collection(window.db, collectionPath), entryData),
                'form submission'
            );
            
            console.log('✅ Form submitted successfully:', docRef.id);
            
            // Update local state
            localStorage.setItem('bmir_has_submitted_ride', 'true');
            AppState.hasSubmittedRide = true;
            
            return { success: true, docId: docRef.id };
            
        } catch (error) {
            // Don't log expected offline errors
            if (!FirebaseUtils.isExpectedOfflineError(error)) {
                FirebaseUtils.logOffline('Error submitting form:', error);
                return { success: false, error: error.message };
            } else {
                return { success: false, error: 'Offline submission failed' };
            }
        }
    }
};

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

// Enhanced Firebase operations with retry logic and offline handling
const FirebaseUtils = {
    // Retry configuration
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    isOffline: false,
    
    // Check if error is expected in offline mode
    isExpectedOfflineError(error) {
        const offlineErrors = [
            'network-error',
            'unavailable',
            'deadline-exceeded',
            'resource-exhausted',
            'failed-precondition',
            'aborted',
            'out-of-range',
            'unimplemented',
            'internal',
            'unavailable',
            'data-loss'
        ];
        
        return !navigator.onLine || 
               offlineErrors.some(code => error.code === code || error.message?.includes(code));
    },
    
    // Silent console logging for offline scenarios
    logOffline(message, error = null) {
        OfflineDebugger.log(message, error, 'warn');
    },
    
    // Exponential backoff with jitter
    async retry(operation, context = '') {
        let lastError;
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Don't log expected offline errors
                if (this.isExpectedOfflineError(error)) {
                    this.logOffline(`Firebase operation skipped (offline) - ${context}`);
                    throw error;
                }
                
                console.log(`❌ Firebase operation failed (attempt ${attempt + 1}/${this.maxRetries}) - ${context}:`, error);
                console.log(`❌ Error details:`, {
                    message: error.message,
                    code: error.code,
                    stack: error.stack,
                    name: error.name
                });
                this.logOffline(`❌ Firebase operation failed (attempt ${attempt + 1}/${this.maxRetries}) - ${context}:`, error);
                
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
    
    // Enhanced write with retry
    async writeWithRetry(writeFn, context = 'write') {
        return this.retry(async () => {
            return await writeFn();
        }, context);
    }
};

// Initialize OfflineDebugger after FirebaseUtils is defined
OfflineDebugger.init();

// Global offline debug functions for testing
window.enableOfflineDebug = () => {
    OfflineDebugger.enableDebugMode();
};

window.disableOfflineDebug = () => {
    OfflineDebugger.disableDebugMode();
};

// Add to window for global access
window.FirebaseUtils = FirebaseUtils;

// AppState configuration is handled by index.html

// Optimized query system with offline support
const OptimizedQueries = {
    QUERY_LIMITS: {
        PAGE_SIZE: 20,
        MAX_RETRIES: 3,
        TIMEOUT: 10000
    },
    
    // Enhanced query creation with offline handling
    async getOptimizedQuery(collection, filters = {}) {
        try {
            // Safely access AppState
            if (typeof AppState === 'undefined' || !AppState.db) {
                throw new Error('AppState or database not initialized');
            }
            
            let query = window.firebase.collection(AppState.db, collection);
            
            // Apply filters
            if (filters.direction && filters.direction !== 'all') {
                query = window.firebase.query(query, window.firebase.where('direction', '==', filters.direction));
            }
            if (filters.date && filters.date !== 'all') {
                query = window.firebase.query(query, window.firebase.where('date', '==', filters.date));
            }
            if (filters.location && filters.location !== 'all') {
                query = window.firebase.query(query, window.firebase.where('location', '==', filters.location));
            }
            
            query = window.firebase.query(query, 
                window.firebase.orderBy('timestamp', 'desc'),
                window.firebase.limit(this.QUERY_LIMITS.PAGE_SIZE));
            
            return query;
        } catch (error) {
            FirebaseUtils.logOffline('Failed to create optimized query, falling back to basic query:', error);
            throw error;
        }
    },
    
    // Enhanced subscription with offline handling
    createDebouncedSubscription(queryFn, callback, delay = 500) {
        let unsubscribe = null;
        let timeoutId = null;
        
        const debouncedCallback = performanceUtils.debounce(callback, delay);
        
        return (filters = {}) => {
            if (unsubscribe) {
                unsubscribe();
            }
            
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                try {
                    const query = await this.getOptimizedQuery(queryFn, filters);
                    unsubscribe = window.firebase.onSnapshot(query, debouncedCallback, (error) => {
                        // Only log unexpected errors
                        if (!FirebaseUtils.isExpectedOfflineError(error)) {
                            FirebaseUtils.logOffline('Query subscription error:', error);
                        }
                        
                        // Implement exponential backoff for retries only when online
                        if (navigator.onLine) {
                            setTimeout(() => {
                                if (navigator.onLine) {
                                    // Retry subscription
                                    unsubscribe = window.firebase.onSnapshot(query, debouncedCallback);
                                }
                            }, Math.min(1000 * Math.pow(2, Math.random()), 10000));
                        }
                    });
                } catch (error) {
                    if (!FirebaseUtils.isExpectedOfflineError(error)) {
                        FirebaseUtils.logOffline('Failed to create subscription:', error);
                    }
                }
            }, 100); // Small delay to batch multiple filter changes
        };
    },
    
    // Efficient data loading with progressive enhancement and offline handling
    async loadDataProgressive(collection, onData) {
        const isSlowConnection = this.isSlowConnection();
        const batchSize = isSlowConnection ? 3 : this.QUERY_LIMITS.PAGE_SIZE;
        
        let lastDoc = null;
        let allData = [];
        
        const loadBatch = async () => {
            try {
                // Safely access AppState
                if (typeof AppState === 'undefined' || !AppState.db) {
                    throw new Error('AppState or database not initialized');
                }
                
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
                if (!FirebaseUtils.isExpectedOfflineError(error)) {
                    FirebaseUtils.logOffline('Failed to load data batch:', error);
                }
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

// Code splitting and lazy loading utilities with offline handling
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
            // Don't log expected offline errors for module loading
            if (!FirebaseUtils.isExpectedOfflineError(error)) {
                FirebaseUtils.logOffline(`Failed to load module ${identifier}:`, error);
            }
            throw error;
        }
    },
    
    // Load Firebase modules with offline handling
    async loadFirebaseModules() {
        const modules = [
            { url: 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js', name: 'firebase-app' },
            { url: 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js', name: 'firebase-firestore' },
            { url: 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js', name: 'firebase-auth' },
            { url: 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js', name: 'firebase-app-check' }
        ];
        
        const loadPromises = modules.map(module => 
            this.loadModule(module.url, module.name)
                .catch(err => FirebaseUtils.logOffline('Optional module failed to load:', err))
        );
        
        return Promise.allSettled(loadPromises);
    },
    
    // Preload critical resources on user interaction
    preloadOnInteraction() {
        const handleInteraction = () => {
            // Preload non-critical resources
            this.loadFirebaseModules();
            
            // Remove listeners after first interaction
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('mousedown', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
        
        document.addEventListener('touchstart', handleInteraction, { once: true });
        document.addEventListener('mousedown', handleInteraction, { once: true });
        document.addEventListener('keydown', handleInteraction, { once: true });
    }
};

// Add to window for access
window.LazyLoader = LazyLoader;

// Firebase configuration is handled by index.html

// Global variables with better organization
const AppState = {
    db: null,
    auth: null,
    userId: null,
    appId: 'YOUR_APP_ID',
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

// Common cities are handled by index.html

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
            return new Date(flexibleEndTime.getTime() + (3 * 60 * 60 * 1000));
        }
        
        const timeSlot = entry.timeSlot;
        if (timeSlot && timeSlot !== 'Flexible Time') {
            const endTimeMatch = timeSlot.match(/(\d{2}):(\d{2})\s*$/);
            if (endTimeMatch) {
                const hours = parseInt(endTimeMatch[1]);
                const minutes = parseInt(endTimeMatch[2]);
                const entryEndTime = new Date(entryDate);
                entryEndTime.setHours(hours, minutes, 0, 0);
                return new Date(entryEndTime.getTime() + (3 * 60 * 60 * 1000));
            }
        }
        
        const endOfDay = new Date(entryDate);
        endOfDay.setHours(23, 59, 59, 999);
        return new Date(endOfDay.getTime() + (3 * 60 * 60 * 1000));
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
                <button class="btn btn-gray" ${currentPage === 0 ? 'disabled' : ''} onclick="window.changePage(-1, '${type}')">
                    ← Previous
                </button>
                <span style="color: #6b7280; font-size: 0.875rem;">
                    Page ${currentPage + 1} of ${totalPages} (${totalItems} total)
                </span>
                <button class="btn btn-gray" ${currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="window.changePage(1, '${type}')">
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
        
        // Check if user can message this listing
        const canMessage = entry.authorId !== (AppState.userId || 'anonymous') && 
                          typeof MessagingSystem !== 'undefined' && 
                          MessagingSystem.messagingEnabled &&
                          AppState.hasSubmittedRide; // User must have created a listing
        
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
                    ${canMessage ? `
                    <div class="tooltip">
                        <button class="message-btn" onclick="MessagingSystem.startConversation('${entry.id}', '${entry.authorId}', '${entry.name}')">
                            💬
                        </button>
                        <span class="tooltiptext">Message this user</span>
                    </div>
                    ` : ''}
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
        return hoursUntilExpiration > 0 && hoursUntilExpiration <= 1;
    }
};

// Optimized debounced rendering
const debouncedRender = performanceUtils.debounce(() => {
    if (typeof window.renderFilteredLists === 'function') {
        window.renderFilteredLists();
    }
}, 150); // Reduced debounce time for better responsiveness



function setupApp() {
    console.log('🔧 setupApp() called');
    
    // Initialize universal onboarding for all users
    console.log('🎯 About to initialize universal onboarding...');
    if (typeof window.initializeUniversalOnboarding === 'function') {
        window.initializeUniversalOnboarding();
    }
    console.log('🎯 Universal onboarding initialization complete');
}



// Universal Onboarding System (available to all users, not just mobile)
const UniversalOnboarding = {
    // Add debugging to see if object is created
    _debug: true,
    currentScreen: 'welcome',
    userType: null, // 'driver' or 'rider'
    direction: null, // 'to-burning-man' or 'from-burning-man'
    
    // Check if user should see onboarding (now for all users)
    shouldShow() {
        // Check if user has completed onboarding before
        const hasCompletedOnboarding = localStorage.getItem('bmir_onboarding_completed');
        if (hasCompletedOnboarding) return false;
        
        // Check if user has submitted any ride requests or offerings
        const hasSubmittedRide = localStorage.getItem('bmir_has_submitted_ride');
        if (hasSubmittedRide) return false;
        return true;
    },
    
    show() {
        // Try to find the overlay element with retry
        const findOverlay = () => {
            return document.getElementById('universal-onboarding');
        };
        
        let overlay = findOverlay();
        
        // If not found, retry a few times
        if (!overlay) {
            let attempts = 0;
            const maxAttempts = 10;
            
            const retry = () => {
                attempts++;
                overlay = findOverlay();
                
                if (overlay) {
                    showOverlay();
                } else if (attempts < maxAttempts) {
                    setTimeout(retry, 100);
                } else {
                    console.error('❌ Universal onboarding overlay element not found after retries!');
                }
            };
            
            setTimeout(retry, 100);
            return;
        }
        
        showOverlay();
        
        function showOverlay() {
            overlay.classList.remove('hidden');
        }
    },
    
    hide() {
        const overlay = document.getElementById('universal-onboarding');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        // Mark onboarding as completed
        localStorage.setItem('bmir_onboarding_completed', 'true');
        
        // Show session code display after onboarding is completed
        const sessionCodeDisplay = document.getElementById('session-code-display');
        const sessionCodeText = document.getElementById('session-code-text');
        if (sessionCodeDisplay && sessionCodeText && AppState.sessionCode) {
            sessionCodeDisplay.style.display = 'flex';
            sessionCodeText.textContent = AppState.sessionCode;

        }
    },
    
    navigateToScreen(screenId) {
        
        // Map screen IDs to actual element IDs
        const screenIdMap = {
            'welcome': 'onboarding-welcome',
            'direction': 'onboarding-direction',
            'form': 'onboarding-form'
        };
        
        const currentElementId = screenIdMap[this.currentScreen];
        const newElementId = screenIdMap[screenId];
        
        console.log('  - Current element ID:', currentElementId);
        console.log('  - New element ID:', newElementId);
        
        // Hide current screen
        const currentScreen = document.getElementById(currentElementId);
        console.log('  - Current screen element found:', !!currentScreen);
        if (currentScreen) {
            currentScreen.classList.remove('active');
            console.log('  - Current screen deactivated');
        }
        
        // Show new screen
        const newScreen = document.getElementById(newElementId);
        console.log('  - New screen element found:', !!newScreen);
        if (newScreen) {
            newScreen.classList.add('active');
            this.currentScreen = screenId;

        } else {
            console.error('❌ New screen element not found for:', screenId, 'with element ID:', newElementId);
        }
    },
    
    goBack() {
        const screens = ['welcome', 'direction', 'form'];
        const currentIndex = screens.indexOf(this.currentScreen);
        if (currentIndex > 0) {
            this.navigateToScreen(screens[currentIndex - 1]);
        }
    },
    
    selectUserType(type) {
        this.userType = type;
        this.navigateToScreen('direction');
    },
    
    selectDirection(direction) {
        this.direction = direction;
        this.navigateToScreen('form');
        // Setup form and populate time slots when form screen becomes active
        setTimeout(() => {
            this.setupForm();
            this.populateTimeSlots();
        }, 100);
    },
    
    setupForm() {
        // Show/hide fields based on user type
        const driverFields = document.getElementById('driver-specific-fields');
        const riderFields = document.getElementById('rider-specific-fields');
        const campInfoSection = document.getElementById('camp-info-section');
        
        // Helper function to manage required attributes for hidden fields
        const manageRequiredAttributes = (container, isVisible) => {
            if (!container) return;
            
            const requiredFields = container.querySelectorAll('[required]');
            requiredFields.forEach(field => {
                if (isVisible) {
                    // Restore required attribute if it was temporarily removed
                    if (field.hasAttribute('data-was-required')) {
                        field.setAttribute('required', '');
                        field.removeAttribute('data-was-required');
                    }
                } else {
                    // Temporarily remove required attribute to prevent browser validation warnings
                    if (field.hasAttribute('required')) {
                        field.setAttribute('data-was-required', 'true');
                        field.removeAttribute('required');
                    }
                }
            });
        };
        
        if (this.userType === 'driver') {
            if (driverFields) {
                driverFields.style.display = 'block';
                manageRequiredAttributes(driverFields, true);
            }
            if (riderFields) {
                riderFields.style.display = 'none';
                manageRequiredAttributes(riderFields, false);
            }
        } else if (this.userType === 'rider') {
            if (driverFields) {
                driverFields.style.display = 'none';
                manageRequiredAttributes(driverFields, false);
            }
            if (riderFields) {
                riderFields.style.display = 'block';
                manageRequiredAttributes(riderFields, true);
            }
        }
        
        // Show/hide camp info section for both drivers and riders based on direction
        if (campInfoSection) {
            if (this.direction === 'from-burning-man') {
                campInfoSection.style.display = 'block';
                manageRequiredAttributes(campInfoSection, true);
            } else {
                campInfoSection.style.display = 'none';
                manageRequiredAttributes(campInfoSection, false);
            }
        }
        
        // Set default direction if not already set
        if (!this.direction) {
            this.direction = 'to-burning-man';
        }
        
        // Update form labels based on direction
        const directionLabel = this.direction === 'to-burning-man' ? 'to Burning Man' : 'from Burning Man';
        const userTypeLabel = this.userType === 'driver' ? 'Driver' : 'Rider';
        
        const formTitle = document.querySelector('.onboarding-form-title');
        if (formTitle) {
            formTitle.textContent = `${userTypeLabel} ${directionLabel}`;
        }
    },
    
    populateTimeSlots() {
        const timeSelect = document.getElementById('onboarding-time');
        if (!timeSelect) {

            return;
        }
        

        timeSelect.innerHTML = '';
        
        // Add Flexible Time option first as default
        const flexibleOption = document.createElement('option');
        flexibleOption.value = 'Flexible Time';
        flexibleOption.textContent = 'Flexible Time';
        flexibleOption.selected = true;
        timeSelect.appendChild(flexibleOption);
        
        // Add time-specific options (matching main app exactly)
        for (let i = 0; i < 24; i += 3) {
            const start = i.toString().padStart(2, '0');
            const end = (i + 3).toString().padStart(2, '0');
            const option = document.createElement('option');
            option.value = `${start}:00 - ${end}:00`;
            option.textContent = `${start}:00 - ${end}:00`;
            timeSelect.appendChild(option);
        }
        

    },
    
    async submitForm(formData) {
        try {
            // Add validation before submission
            const validationErrors = FormUtils.validateEntry(formData);
            if (validationErrors.length > 0) {
                alert('Please fix the following errors:\n\n' + validationErrors.join('\n'));
                return;
            }
            
            // Use shared FormUtils for validation and submission
            const result = await FormUtils.submitFormToFirebase(
                formData, 
                this.userType, 
                this.direction, 
                true // isOnboarding = true
            );
            
            if (result.success) {
                if (result.offline) {
                    alert('Your submission has been saved locally and will sync when you reconnect.');
                } else {
                    alert('Your ride has been posted successfully!');
                }
                
                // Hide onboarding completely
                this.hide();
                
                // Mark onboarding as completed
                localStorage.setItem('bmir_onboarding_completed', 'true');
                localStorage.setItem('bmir_has_submitted_ride', 'true');
                
                // Refresh the main app to show the new listing
                if (typeof setupListeners === 'function') {
                    setupListeners();
                }
                
                // Show session code modal after a short delay to ensure onboarding is hidden
                setTimeout(() => {
                    if (typeof showSessionCodeModal === 'function') {
                        const userId = AppState.auth?.currentUser?.uid || 'anonymous';
                        showSessionCodeModal(userId);
                    }
                }, 500);
            } else {
                alert('Failed to submit form. Please try again.');
            }
            
        } catch (error) {
            FirebaseUtils.logOffline('Error submitting onboarding form:', error);
            alert('Failed to submit form. Please try again.');
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

// Real-Time Messaging System
const MessagingSystem = {
    // State management
    currentConversation: null,
    conversations: new Map(),
    messageListeners: new Map(),
    fcmToken: null,
    messagingEnabled: true,
    
    // Initialize messaging system
    async init() {
        try {
            console.log('🔧 Initializing messaging system...');
            
            // Ensure user has a profile
            await this.ensureUserProfile();
            
            // Initialize FCM if available
            await this.initializeFCM();
            
            // Load user's messaging preference
            await this.loadMessagingPreference();
            
            // Set up conversation listeners
            await this.setupConversationListeners();
            
            console.log('✅ Messaging system initialized');
        } catch (error) {
            console.error('❌ Failed to initialize messaging system:', error);
        }
    },
    
    // Ensure user has a profile in the users collection
    async ensureUserProfile() {
        try {
            const userId = AppState.userId || 'anonymous';
            const userRef = window.firebase.doc(AppState.db, 'users', userId);
            const userDoc = await window.firebase.getDoc(userRef);
            
            if (!userDoc.exists()) {
                // Create user profile with default settings
                await window.firebase.setDoc(userRef, {
                    displayName: 'Anonymous User',
                    messagingEnabled: true,
                    createdAt: window.firebase.serverTimestamp(),
                    updatedAt: window.firebase.serverTimestamp()
                });
                console.log('✅ Created user profile for:', userId);
            }
        } catch (error) {
            console.error('❌ Failed to ensure user profile:', error);
        }
    },
    
    // Initialize Firebase Cloud Messaging
    async initializeFCM() {
        try {
            // Check if FCM is available
            if (!window.firebase.messaging || !window.FCM_CONFIG?.vapidKey) {
                console.log('⚠️ FCM not available, skipping push notifications');
                return;
            }
            
            const messaging = window.firebase.messaging();
            
            // Request notification permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // Get FCM token
                this.fcmToken = await messaging.getToken({
                    vapidKey: window.FCM_CONFIG.vapidKey
                });
                
                // Save token to user profile
                await this.updateNotificationToken(this.fcmToken);
                
                // Set up foreground message handler
                messaging.onMessage((payload) => {
                    this.handleForegroundMessage(payload);
                });
                
                console.log('✅ FCM initialized with token:', this.fcmToken.substring(0, 20) + '...');
            } else {
                console.log('⚠️ Notification permission denied');
            }
        } catch (error) {
            console.error('❌ Failed to initialize FCM:', error);
        }
    },
    
    // Update notification token in user profile
    async updateNotificationToken(token) {
        try {
            const userId = AppState.userId || 'anonymous';
            const userRef = window.firebase.doc(AppState.db, 'users', userId);
            
            await window.firebase.updateDoc(userRef, {
                notificationTokens: window.firebase.arrayUnion(token),
                updatedAt: window.firebase.serverTimestamp()
            });
        } catch (error) {
            console.error('❌ Failed to update notification token:', error);
        }
    },
    
    // Handle foreground messages
    handleForegroundMessage(payload) {
        try {
            const { title, body, data } = payload.notification || {};
            
            // Show in-app notification if conversation is not active
            if (data?.conversationId !== this.currentConversation?.id) {
                this.showInAppNotification(title, body, data);
            }
        } catch (error) {
            console.error('❌ Failed to handle foreground message:', error);
        }
    },
    
    // Show in-app notification
    showInAppNotification(title, body, data) {
        try {
            const notification = document.createElement('div');
            notification.className = 'in-app-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <h4>${title}</h4>
                    <p>${body}</p>
                    <button onclick="MessagingSystem.openConversation('${data.conversationId}')">Open</button>
                    <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        } catch (error) {
            console.error('❌ Failed to show in-app notification:', error);
        }
    },
    
    // Load user's messaging preference
    async loadMessagingPreference() {
        try {
            const userId = AppState.userId || 'anonymous';
            const userRef = window.firebase.doc(AppState.db, 'users', userId);
            const userDoc = await window.firebase.getDoc(userRef);
            
            if (userDoc.exists()) {
                this.messagingEnabled = userDoc.data().messagingEnabled !== false;
            }
        } catch (error) {
            console.error('❌ Failed to load messaging preference:', error);
        }
    },
    
    // Set up conversation listeners
    async setupConversationListeners() {
        try {
            const userId = AppState.userId || 'anonymous';
            const conversationsRef = window.firebase.collection(AppState.db, 'conversations');
            const q = window.firebase.query(
                conversationsRef,
                window.firebase.where('participantIds', 'array-contains', userId),
                window.firebase.orderBy('lastMessageAt', 'desc')
            );
            
            const unsubscribe = window.firebase.onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const conversation = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === 'added' || change.type === 'modified') {
                        this.conversations.set(conversation.id, conversation);
                    } else if (change.type === 'removed') {
                        this.conversations.delete(conversation.id);
                    }
                });
                
                // Update UI if conversation list is visible
                this.updateConversationList();
            });
            
            // Store unsubscribe function
            this.messageListeners.set('conversations', unsubscribe);
        } catch (error) {
            console.error('❌ Failed to setup conversation listeners:', error);
        }
    },
    
    // Start conversation from listing
    async startConversation(listingId, recipientId, recipientName) {
        try {
            // Check if messaging system is initialized
            if (!this.messagingEnabled) {
                alert('You have disabled messaging. Please enable it in settings to message others.');
                return;
            }
            
            // Create or get conversation
            const conversationId = await this.createConversation(listingId, recipientId, recipientName);
            
            // Open the conversation
            await this.openConversation(conversationId);
            
        } catch (error) {
            console.error('❌ Failed to start conversation:', error);
            alert(error.message || 'Failed to start conversation. Please try again.');
        }
    },
    
    // Create or get conversation
    async createConversation(listingId, recipientId, recipientName) {
        try {
            const userId = AppState.userId || 'anonymous';
            
            // Check if user has any listings
            const hasListings = await this.userHasListings(userId);
            if (!hasListings) {
                throw new Error('You need to create a listing before you can message others.');
            }
            
            // Check if recipient has messaging enabled
            const recipientCanMessage = await this.canUserMessage(recipientId);
            if (!recipientCanMessage) {
                throw new Error('This user is not accepting messages.');
            }
            
            // Create deterministic conversation ID
            const participantIds = [userId, recipientId].sort();
            const conversationId = this.generateConversationId(listingId, participantIds);
            
            // Check if conversation already exists
            const conversationRef = window.firebase.doc(AppState.db, 'conversations', conversationId);
            const conversationDoc = await window.firebase.getDoc(conversationRef);
            
            if (!conversationDoc.exists()) {
                // Create new conversation
                await window.firebase.setDoc(conversationRef, {
                    listingId,
                    participantIds,
                    participantDisplay: {
                        [userId]: 'You',
                        [recipientId]: recipientName
                    },
                    messagingEnabledSnapshot: {
                        [userId]: this.messagingEnabled,
                        [recipientId]: true
                    },
                    lastMessage: '',
                    lastMessageAt: window.firebase.serverTimestamp(),
                    createdAt: window.firebase.serverTimestamp(),
                    createdBy: userId
                });
                
                // Auto-favorite the listing
                await this.autoFavoriteListing(listingId);
            }
            
            return conversationId;
        } catch (error) {
            console.error('❌ Failed to create conversation:', error);
            throw error;
        }
    },
    
    // Generate deterministic conversation ID
    generateConversationId(listingId, participantIds) {
        const sortedParticipants = participantIds.sort();
        const hashInput = `${listingId}-${sortedParticipants.join('-')}`;
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            const char = hashInput.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return `conv_${Math.abs(hash).toString(36)}`;
    },
    
    // Check if user has any listings
    async userHasListings(userId) {
        try {
            const driversRef = window.firebase.collection(AppState.db, 'artifacts/bmir-rideshare/public/data/drivers');
            const ridersRef = window.firebase.collection(AppState.db, 'artifacts/bmir-rideshare/public/data/riders');
            
            const [driversQuery, ridersQuery] = await Promise.all([
                window.firebase.getDocs(window.firebase.query(driversRef, window.firebase.where('authorId', '==', userId))),
                window.firebase.getDocs(window.firebase.query(ridersRef, window.firebase.where('authorId', '==', userId)))
            ]);
            
            return !driversQuery.empty || !ridersQuery.empty;
        } catch (error) {
            console.error('❌ Failed to check user listings:', error);
            return false;
        }
    },
    
    // Check if user can receive messages
    async canUserMessage(userId) {
        try {
            const userRef = window.firebase.doc(AppState.db, 'users', userId);
            const userDoc = await window.firebase.getDoc(userRef);
            
            if (!userDoc.exists()) {
                return true; // Default to allowing messages
            }
            
            return userDoc.data().messagingEnabled !== false;
        } catch (error) {
            console.error('❌ Failed to check if user can message:', error);
            return true; // Default to allowing messages
        }
    },
    
    // Auto-favorite listing on first contact
    async autoFavoriteListing(listingId) {
        try {
            const userId = AppState.userId || 'anonymous';
            const favoriteId = `${userId}_${listingId}`;
            const favoriteRef = window.firebase.doc(AppState.db, 'favorites', favoriteId);
            
            // Check if already favorited
            const favoriteDoc = await window.firebase.getDoc(favoriteRef);
            if (!favoriteDoc.exists()) {
                await window.firebase.setDoc(favoriteRef, {
                    userId,
                    listingId,
                    createdAt: window.firebase.serverTimestamp()
                });
                console.log('✅ Auto-favorited listing:', listingId);
            }
        } catch (error) {
            console.error('❌ Failed to auto-favorite listing:', error);
        }
    },
    
    // Send message
    async sendMessage(conversationId, body) {
        try {
            const userId = AppState.userId || 'anonymous';
            const conversation = this.conversations.get(conversationId);
            
            if (!conversation) {
                throw new Error('Conversation not found');
            }
            
            // Find recipient
            const recipientId = conversation.participantIds.find(id => id !== userId);
            if (!recipientId) {
                throw new Error('Recipient not found');
            }
            
            // Create message
            const messageRef = window.firebase.collection(AppState.db, 'conversations', conversationId, 'messages');
            const messageDoc = await window.firebase.addDoc(messageRef, {
                fromUserId: userId,
                toUserId: recipientId,
                body: body.trim(),
                sentAt: window.firebase.serverTimestamp(),
                deliveredAt: null,
                readAt: null
            });
            
            // Update conversation last message
            const conversationRef = window.firebase.doc(AppState.db, 'conversations', conversationId);
            await window.firebase.updateDoc(conversationRef, {
                lastMessage: body.trim(),
                lastMessageAt: window.firebase.serverTimestamp()
            });
            
            return messageDoc.id;
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            throw error;
        }
    },
    
    // Mark message as delivered
    async markMessageDelivered(messageId, conversationId) {
        try {
            const messageRef = window.firebase.doc(AppState.db, 'conversations', conversationId, 'messages', messageId);
            await window.firebase.updateDoc(messageRef, {
                deliveredAt: window.firebase.serverTimestamp()
            });
        } catch (error) {
            console.error('❌ Failed to mark message as delivered:', error);
        }
    },
    
    // Mark message as read
    async markMessageRead(messageId, conversationId) {
        try {
            const userId = AppState.userId || 'anonymous';
            const messageRef = window.firebase.doc(AppState.db, 'conversations', conversationId, 'messages', messageId);
            const messageDoc = await window.firebase.getDoc(messageRef);
            
            if (messageDoc.exists() && messageDoc.data().toUserId === userId) {
                await window.firebase.updateDoc(messageRef, {
                    readAt: window.firebase.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('❌ Failed to mark message as read:', error);
        }
    },
    
    // Open conversation
    async openConversation(conversationId) {
        try {
            this.currentConversation = this.conversations.get(conversationId);
            if (!this.currentConversation) {
                throw new Error('Conversation not found');
            }
            
            // Set up message listener for this conversation
            await this.setupMessageListener(conversationId);
            
            // Show conversation UI
            this.showConversationView();
            
            // Mark messages as read
            await this.markConversationAsRead(conversationId);
        } catch (error) {
            console.error('❌ Failed to open conversation:', error);
        }
    },
    
    // Set up message listener for a conversation
    async setupMessageListener(conversationId) {
        try {
            // Unsubscribe from previous listener if exists
            if (this.messageListeners.has(conversationId)) {
                this.messageListeners.get(conversationId)();
            }
            
            const messagesRef = window.firebase.collection(AppState.db, 'conversations', conversationId, 'messages');
            const q = window.firebase.query(messagesRef, window.firebase.orderBy('sentAt', 'asc'));
            
            const unsubscribe = window.firebase.onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const message = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === 'added') {
                        this.addMessageToUI(message);
                        
                        // Mark as delivered if we're the recipient
                        const userId = AppState.userId || 'anonymous';
                        if (message.toUserId === userId && !message.deliveredAt) {
                            this.markMessageDelivered(message.id, conversationId);
                        }
                    } else if (change.type === 'modified') {
                        this.updateMessageInUI(message);
                    }
                });
            });
            
            this.messageListeners.set(conversationId, unsubscribe);
        } catch (error) {
            console.error('❌ Failed to setup message listener:', error);
        }
    },
    
    // Mark all messages in conversation as read
    async markConversationAsRead(conversationId) {
        try {
            const userId = AppState.userId || 'anonymous';
            const messagesRef = window.firebase.collection(AppState.db, 'conversations', conversationId, 'messages');
            const q = window.firebase.query(
                messagesRef,
                window.firebase.where('toUserId', '==', userId),
                window.firebase.where('readAt', '==', null)
            );
            
            const unreadMessages = await window.firebase.getDocs(q);
            const updatePromises = unreadMessages.docs.map(doc => 
                this.markMessageRead(doc.id, conversationId)
            );
            
            await Promise.all(updatePromises);
        } catch (error) {
            console.error('❌ Failed to mark conversation as read:', error);
        }
    },
    
    // Toggle messaging preference
    async toggleMessagingPreference() {
        try {
            this.messagingEnabled = !this.messagingEnabled;
            
            const userId = AppState.userId || 'anonymous';
            const userRef = window.firebase.doc(AppState.db, 'users', userId);
            
            await window.firebase.updateDoc(userRef, {
                messagingEnabled: this.messagingEnabled,
                updatedAt: window.firebase.serverTimestamp()
            });
            
            console.log('✅ Messaging preference updated:', this.messagingEnabled);
        } catch (error) {
            console.error('❌ Failed to toggle messaging preference:', error);
            this.messagingEnabled = !this.messagingEnabled; // Revert on error
        }
    },
    
    // UI Methods
    showConversationView() {
        const container = document.getElementById('messaging-container');
        if (!container) return;
        
        container.innerHTML = this.buildConversationView();
        container.style.display = 'block';
        
        // Focus on message input
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.focus();
        }
    },
    
    buildConversationView() {
        if (!this.currentConversation) return '';
        
        const recipientId = this.currentConversation.participantIds.find(id => id !== (AppState.userId || 'anonymous'));
        const recipientName = this.currentConversation.participantDisplay[recipientId] || 'Unknown User';
        
        return `
            <div class="conversation-header">
                <button onclick="MessagingSystem.closeConversation()" class="back-btn">←</button>
                <div class="conversation-info">
                    <h3>${recipientName}</h3>
                    <a href="#listing-${this.currentConversation.listingId}" class="listing-link">View Original Listing</a>
                </div>
            </div>
            <div class="messages-container" id="messages-container">
                <!-- Messages will be populated here -->
            </div>
            <div class="message-input-container">
                <input type="text" id="message-input" placeholder="Type your message..." maxlength="1000">
                <button onclick="MessagingSystem.sendMessageFromUI()" class="send-btn">Send</button>
            </div>
        `;
    },
    
    closeConversation() {
        const container = document.getElementById('messaging-container');
        if (container) {
            container.style.display = 'none';
        }
        this.currentConversation = null;
    },
    
    addMessageToUI(message) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        
        const messageElement = this.createMessageElement(message);
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    },
    
    updateMessageInUI(message) {
        const messageElement = document.getElementById(`message-${message.id}`);
        if (messageElement) {
            messageElement.innerHTML = this.buildMessageContent(message);
        }
    },
    
    createMessageElement(message) {
        const element = document.createElement('div');
        element.id = `message-${message.id}`;
        element.className = `message ${message.fromUserId === (AppState.userId || 'anonymous') ? 'sent' : 'received'}`;
        element.innerHTML = this.buildMessageContent(message);
        return element;
    },
    
    buildMessageContent(message) {
        const isSent = message.fromUserId === (AppState.userId || 'anonymous');
        const timestamp = message.sentAt ? new Date(message.sentAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        let statusIndicator = '';
        if (isSent) {
            if (message.readAt) {
                statusIndicator = '<span class="status read">✓✓</span>';
            } else if (message.deliveredAt) {
                statusIndicator = '<span class="status delivered">✓✓</span>';
            } else {
                statusIndicator = '<span class="status sent">✓</span>';
            }
        }
        
        return `
            <div class="message-content">
                <p>${message.body}</p>
                <div class="message-meta">
                    <span class="timestamp">${timestamp}</span>
                    ${statusIndicator}
                </div>
            </div>
        `;
    },
    
    async sendMessageFromUI() {
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message || !this.currentConversation) return;
        
        try {
            input.value = '';
            await this.sendMessage(this.currentConversation.id, message);
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            alert('Failed to send message. Please try again.');
        }
    },
    
    updateConversationList() {
        const container = document.getElementById('conversations-list');
        if (!container) return;
        
        const conversations = Array.from(this.conversations.values());
        
        if (conversations.length === 0) {
            container.innerHTML = '<p class="no-conversations">No conversations yet</p>';
            return;
        }
        
        container.innerHTML = conversations.map(conversation => {
            const otherParticipantId = conversation.participantIds.find(id => id !== (AppState.userId || 'anonymous'));
            const otherParticipantName = conversation.participantDisplay[otherParticipantId] || 'Unknown User';
            
            return `
                <div class="conversation-item" onclick="MessagingSystem.openConversation('${conversation.id}')">
                    <div class="conversation-info">
                        <h4>${otherParticipantName}</h4>
                        <p class="last-message">${conversation.lastMessage || 'No messages yet'}</p>
                    </div>
                    <div class="conversation-meta">
                        <a href="#listing-${conversation.listingId}" class="listing-link">View Listing</a>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    showMessagingHome() {
        const container = document.getElementById('messaging-container');
        if (!container) return;
        
        container.innerHTML = `
            <div class="messaging-header">
                <h2>Messages</h2>
                <button onclick="MessagingSystem.closeMessaging()" class="close-btn">×</button>
            </div>
            <div class="conversations-list" id="conversations-list">
                <!-- Conversations will be populated here -->
            </div>
            <div class="messaging-settings">
                <label>
                    <input type="checkbox" ${this.messagingEnabled ? 'checked' : ''} 
                           onchange="MessagingSystem.toggleMessagingPreference()">
                    Allow others to message me
                </label>
            </div>
        `;
        
        container.style.display = 'block';
        this.updateConversationList();
    },
    
    closeMessaging() {
        const container = document.getElementById('messaging-container');
        if (container) {
            container.style.display = 'none';
        }
    }
};

// Universal onboarding initialization is handled by index.html

// Session code generation is handled by index.html

// Add remaining components to window after all are defined
window.FormUtils = FormUtils;
window.UniversalOnboarding = UniversalOnboarding;
window.LazyLoader = LazyLoader;
window.AppState = AppState;
window.MessagingSystem = MessagingSystem;

console.log('🔧 Exposing components to window...');
console.log('  - FormUtils available:', typeof window.FormUtils);
console.log('  - MessagingSystem available:', typeof window.MessagingSystem);


// App initialization is handled by index.html