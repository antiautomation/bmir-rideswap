// BMIR RideSwap Admin Interface
class AdminInterface {
    constructor() {
        this.db = null;
        this.auth = null;
        this.appId = null;
        this.posts = [];
        this.filteredPosts = [];
        this.editedPosts = new Map();
        this.currentTab = 'posts';
        this.isConnected = false;
        
        this.init();
    }
    
    async init() {
        try {
            await this.initializeFirebase();
            this.setupEventListeners();
            this.loadInitialData();
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('Failed to initialize admin interface:', error);
            this.updateConnectionStatus(false, error.message);
            this.showMessage('Failed to connect to Firebase. Please check your configuration.', 'error');
        }
    }
    
    async initializeFirebase() {
        // Check if Firebase is already loaded
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase not loaded. Please ensure config.js is properly configured.');
        }
        
        // Initialize Firebase if not already done
        if (!firebase.apps.length) {
            firebase.initializeApp(window.FIREBASE_CONFIG);
        }
        
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.appId = window.APP_CONFIG?.appId || 'bmir-rideshare';
        
        // Sign in anonymously
        await this.auth.signInAnonymously();
        console.log('Admin interface connected to Firebase');
    }
    
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Posts tab events
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadPosts());
        document.getElementById('savePostsBtn').addEventListener('click', () => this.savePosts());
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCsv());
        
        // Filters
        document.getElementById('typeFilter').addEventListener('change', () => this.filterPosts());
        document.getElementById('directionFilter').addEventListener('change', () => this.filterPosts());
        document.getElementById('statusFilter').addEventListener('change', () => this.filterPosts());
        document.getElementById('dateFilter').addEventListener('change', () => this.filterPosts());
        
        // Event settings
        document.getElementById('saveEventBtn').addEventListener('click', () => this.saveEventSettings());
        
        // Configuration
        document.getElementById('downloadConfigBtn').addEventListener('click', () => this.downloadConfig());
        
        // Private settings
        document.getElementById('savePrivateBtn').addEventListener('click', () => this.savePrivateSettings());
        
        // Modal events
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal' || e.target.classList.contains('modal-close')) {
                this.closeModal();
            }
        });
        
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
    }
    
    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        this.currentTab = tabName;
        
        // Load data for the tab
        if (tabName === 'posts') {
            this.loadPosts();
        } else if (tabName === 'events') {
            this.loadEventSettings();
        } else if (tabName === 'config') {
            this.loadConfig();
        } else if (tabName === 'private') {
            this.loadPrivateSettings();
        }
    }
    
    updateConnectionStatus(connected, errorMessage = '') {
        this.isConnected = connected;
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot error';
            statusText.textContent = errorMessage || 'Disconnected';
        }
    }
    
    showMessage(message, type = 'success') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        // Insert at top of current tab content
        const currentTab = document.querySelector('.tab-content.active');
        currentTab.insertBefore(messageDiv, currentTab.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
    
    // Posts Management
    async loadPosts() {
        try {
            const tbody = document.getElementById('postsTableBody');
            tbody.innerHTML = '<tr><td colspan="9" class="loading">Loading posts...</td></tr>';
            
            // Load both drivers and riders
            const [drivers, riders] = await Promise.all([
                window.firebase.getDocs(window.firebase.collection(this.db, `artifacts/${this.appId}/public/data/drivers`)),
                window.firebase.getDocs(window.firebase.collection(this.db, `artifacts/${this.appId}/public/data/riders`))
            ]);
            
            this.posts = [];
            
            drivers.forEach(doc => {
                this.posts.push({
                    id: doc.id,
                    type: 'driver',
                    ...doc.data()
                });
            });
            
            riders.forEach(doc => {
                this.posts.push({
                    id: doc.id,
                    type: 'rider',
                    ...doc.data()
                });
            });
            
            // Sort by timestamp (newest first)
            this.posts.sort((a, b) => {
                const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
                const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
                return timeB - timeA;
            });
            
            this.filteredPosts = [...this.posts];
            this.renderPosts();
            
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showMessage('Failed to load posts: ' + error.message, 'error');
        }
    }
    
    filterPosts() {
        const typeFilter = document.getElementById('typeFilter').value;
        const directionFilter = document.getElementById('directionFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;
        
        this.filteredPosts = this.posts.filter(post => {
            // Type filter
            if (typeFilter && post.type !== typeFilter) return false;
            
            // Direction filter
            if (directionFilter && post.direction !== directionFilter) return false;
            
            // Status filter
            if (statusFilter === 'active' && post.deleted) return false;
            if (statusFilter === 'deleted' && !post.deleted) return false;
            
            // Date filter
            if (dateFilter) {
                const postDate = post.date;
                if (postDate !== dateFilter) return false;
            }
            
            return true;
        });
        
        this.renderPosts();
    }
    
    renderPosts() {
        const tbody = document.getElementById('postsTableBody');
        
        if (this.filteredPosts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="loading">No posts found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.filteredPosts.map(post => {
            const timestamp = post.timestamp?.toDate?.() || new Date(post.timestamp);
            const contact = [post.email, post.phone].filter(Boolean).join(' / ');
            
            let rowClass = '';
            if (post.deleted) rowClass += ' deleted';
            if (post.flagged) rowClass += ' flagged';
            
            return `
                <tr class="${rowClass}" data-id="${post.id}" data-type="${post.type}">
                    <td>
                        <span class="status-badge ${post.type === 'driver' ? 'active' : 'info'}">
                            ${post.type === 'driver' ? '🚗 Driver' : '👤 Rider'}
                        </span>
                    </td>
                    <td>${this.escapeHtml(post.name)}</td>
                    <td>${this.escapeHtml(contact)}</td>
                    <td>${this.escapeHtml(post.location)}</td>
                    <td>${post.date}</td>
                    <td>${this.escapeHtml(post.timeSlot)}</td>
                    <td>${post.direction === 'to-brc' ? 'To BRC' : 'From BRC'}</td>
                    <td>
                        ${post.deleted ? '<span class="status-badge deleted">Deleted</span>' : ''}
                        ${post.flagged ? '<span class="status-badge flagged">Flagged</span>' : ''}
                        ${!post.deleted && !post.flagged ? '<span class="status-badge active">Active</span>' : ''}
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-small btn-secondary" onclick="admin.editPost('${post.id}', '${post.type}')">
                                ✏️ Edit
                            </button>
                            <button class="btn btn-small ${post.deleted ? 'btn-primary' : 'btn-danger'}" 
                                    onclick="admin.toggleDelete('${post.id}', '${post.type}', ${post.deleted})">
                                ${post.deleted ? '🔄 Restore' : '🗑️ Delete'}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    editPost(id, type) {
        const post = this.posts.find(p => p.id === id && p.type === type);
        if (!post) return;
        
        // Populate modal
        document.getElementById('editName').value = post.name || '';
        document.getElementById('editType').value = post.type;
        document.getElementById('editEmail').value = post.email || '';
        document.getElementById('editPhone').value = post.phone || '';
        document.getElementById('editLocation').value = post.location || '';
        document.getElementById('editDirection').value = post.direction || 'to-brc';
        document.getElementById('editDate').value = post.date || '';
        document.getElementById('editTimeSlot').value = post.timeSlot || '';
        document.getElementById('editDetails').value = post.details || '';
        document.getElementById('editDeleted').value = post.deleted ? 'true' : 'false';
        document.getElementById('editFlagged').value = post.flagged ? 'true' : 'false';
        
        // Store reference to post being edited
        this.editingPost = { id, type };
        
        // Show modal
        document.getElementById('editModal').classList.add('show');
    }
    
    closeModal() {
        document.getElementById('editModal').classList.remove('show');
        this.editingPost = null;
    }
    
    async saveEdit() {
        if (!this.editingPost) return;
        
        const formData = {
            name: document.getElementById('editName').value,
            type: document.getElementById('editType').value,
            email: document.getElementById('editEmail').value,
            phone: document.getElementById('editPhone').value,
            location: document.getElementById('editLocation').value,
            direction: document.getElementById('editDirection').value,
            date: document.getElementById('editDate').value,
            timeSlot: document.getElementById('editTimeSlot').value,
            details: document.getElementById('editDetails').value,
            deleted: document.getElementById('editDeleted').value === 'true',
            flagged: document.getElementById('editFlagged').value === 'true'
        };
        
        try {
            const collectionPath = `artifacts/${this.appId}/public/data/${this.editingPost.type}s`;
            await window.firebase.updateDoc(window.firebase.doc(this.db, collectionPath, this.editingPost.id), formData);
            
            // Update local data
            const postIndex = this.posts.findIndex(p => p.id === this.editingPost.id && p.type === this.editingPost.type);
            if (postIndex !== -1) {
                this.posts[postIndex] = { ...this.posts[postIndex], ...formData };
            }
            
            this.closeModal();
            this.filterPosts();
            this.showMessage('Post updated successfully');
            
        } catch (error) {
            console.error('Error updating post:', error);
            this.showMessage('Failed to update post: ' + error.message, 'error');
        }
    }
    
    async toggleDelete(id, type, currentlyDeleted) {
        try {
            const collectionPath = `artifacts/${this.appId}/public/data/${type}s`;
            await window.firebase.updateDoc(window.firebase.doc(this.db, collectionPath, id), {
                deleted: !currentlyDeleted
            });
            
            // Update local data
            const postIndex = this.posts.findIndex(p => p.id === id && p.type === type);
            if (postIndex !== -1) {
                this.posts[postIndex].deleted = !currentlyDeleted;
            }
            
            this.filterPosts();
            this.showMessage(`Post ${currentlyDeleted ? 'restored' : 'deleted'} successfully`);
            
        } catch (error) {
            console.error('Error toggling delete status:', error);
            this.showMessage('Failed to update post status: ' + error.message, 'error');
        }
    }
    
    async savePosts() {
        // This would be used for batch operations if needed
        this.showMessage('Individual post updates are saved immediately');
    }
    
    exportCsv() {
        const headers = ['Type', 'Name', 'Email', 'Phone', 'Location', 'Date', 'Time', 'Direction', 'Details', 'Status', 'Created'];
        const csvData = this.filteredPosts.map(post => [
            post.type,
            post.name,
            post.email || '',
            post.phone || '',
            post.location,
            post.date,
            post.timeSlot,
            post.direction,
            post.details || '',
            post.deleted ? 'Deleted' : (post.flagged ? 'Flagged' : 'Active'),
            post.timestamp?.toDate?.() || new Date(post.timestamp)
        ]);
        
        const csvContent = [headers, ...csvData]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bmir-posts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showMessage('CSV exported successfully');
    }
    
    // Event Settings Management
    async loadEventSettings() {
        try {
            const doc = await window.firebase.getDoc(window.firebase.doc(this.db, `artifacts/${this.appId}/public/data/appConfig`, 'current'));
            
            if (doc.exists) {
                const data = doc.data();
                
                document.getElementById('eventName').value = data.eventName || '';
                document.getElementById('eventLogoUrl').value = data.eventLogoUrl || '';
                document.getElementById('eventLogoDarkUrl').value = data.eventLogoDarkUrl || '';
                document.getElementById('eventStart').value = data.eventStart ? this.formatDateTimeForInput(data.eventStart) : '';
                document.getElementById('eventEnd').value = data.eventEnd ? this.formatDateTimeForInput(data.eventEnd) : '';
                document.getElementById('listingExpirationHours').value = data.listingExpirationHours || 12;
                document.getElementById('homeHero').value = data.eventCopy?.homeHero || '';
                document.getElementById('listingHint').value = data.eventCopy?.listingHint || '';
                document.getElementById('footerNote').value = data.eventCopy?.footerNote || '';
            }
        } catch (error) {
            console.error('Error loading event settings:', error);
            this.showMessage('Failed to load event settings: ' + error.message, 'error');
        }
    }
    
    async saveEventSettings() {
        try {
            const eventData = {
                eventName: document.getElementById('eventName').value,
                eventLogoUrl: document.getElementById('eventLogoUrl').value,
                eventLogoDarkUrl: document.getElementById('eventLogoDarkUrl').value,
                eventStart: document.getElementById('eventStart').value,
                eventEnd: document.getElementById('eventEnd').value,
                listingExpirationHours: parseInt(document.getElementById('listingExpirationHours').value) || 12,
                eventCopy: {
                    homeHero: document.getElementById('homeHero').value,
                    listingHint: document.getElementById('listingHint').value,
                    footerNote: document.getElementById('footerNote').value
                },
                updatedAt: window.firebase.serverTimestamp()
            };
            
            await window.firebase.setDoc(window.firebase.doc(this.db, `artifacts/${this.appId}/public/data/appConfig`, 'current'), eventData);
            
            this.showMessage('Event settings saved successfully');
            
        } catch (error) {
            console.error('Error saving event settings:', error);
            this.showMessage('Failed to save event settings: ' + error.message, 'error');
        }
    }
    
    // Configuration Management
    async loadConfig() {
        try {
            // Try to load current config.js
            const response = await fetch('../config.js');
            if (response.ok) {
                const configText = await response.text();
                this.parseConfigFile(configText);
            } else {
                // Load from example if config.js doesn't exist
                const response = await fetch('../config.js.example');
                if (response.ok) {
                    const configText = await response.text();
                    this.parseConfigFile(configText);
                }
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.showMessage('Could not load config.js. You may need to paste the content manually.', 'warning');
        }
    }
    
    parseConfigFile(configText) {
        // Simple regex-based parsing (for demo purposes)
        const patterns = {
            firebaseApiKey: /apiKey:\s*["']([^"']+)["']/,
            firebaseAuthDomain: /authDomain:\s*["']([^"']+)["']/,
            firebaseProjectId: /projectId:\s*["']([^"']+)["']/,
            firebaseStorageBucket: /storageBucket:\s*["']([^"']+)["']/,
            firebaseMessagingSenderId: /messagingSenderId:\s*["']([^"']+)["']/,
            firebaseAppId: /appId:\s*["']([^"']+)["']/,
            firebaseMeasurementId: /measurementId:\s*["']([^"']+)["']/,
            appId: /appId:\s*["']([^"']+)["']/,
            projectId: /projectId:\s*["']([^"']+)["']/,
            collectionPath: /collectionPath:\s*["']([^"']+)["']/,
            analyticsTrackingId: /trackingId:\s*["']([^"']+)["']/,
            analyticsGtagUrl: /gtagUrl:\s*["']([^"']+)["']/,
            recaptchaSiteKey: /siteKey:\s*["']([^"']+)["']/,
            recaptchaApiUrl: /apiUrl:\s*["']([^"']+)["']/
        };
        
        Object.entries(patterns).forEach(([field, pattern]) => {
            const match = configText.match(pattern);
            if (match) {
                const element = document.getElementById(field);
                if (element) {
                    element.value = match[1];
                }
            }
        });
    }
    
    downloadConfig() {
        const config = {
            firebaseApiKey: document.getElementById('firebaseApiKey').value,
            firebaseAuthDomain: document.getElementById('firebaseAuthDomain').value,
            firebaseProjectId: document.getElementById('firebaseProjectId').value,
            firebaseStorageBucket: document.getElementById('firebaseStorageBucket').value,
            firebaseMessagingSenderId: document.getElementById('firebaseMessagingSenderId').value,
            firebaseAppId: document.getElementById('firebaseAppId').value,
            firebaseMeasurementId: document.getElementById('firebaseMeasurementId').value,
            appId: document.getElementById('appId').value,
            projectId: document.getElementById('projectId').value,
            collectionPath: document.getElementById('collectionPath').value,
            analyticsTrackingId: document.getElementById('analyticsTrackingId').value,
            analyticsGtagUrl: document.getElementById('analyticsGtagUrl').value,
            recaptchaSiteKey: document.getElementById('recaptchaSiteKey').value,
            recaptchaApiUrl: document.getElementById('recaptchaApiUrl').value
        };
        
        const configContent = `// Secure Configuration File
// Copy this file to config.js and update with your project settings
// DO NOT commit config.js to version control

// Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "${config.firebaseApiKey}",
    authDomain: "${config.firebaseAuthDomain}",
    projectId: "${config.firebaseProjectId}",
    storageBucket: "${config.firebaseStorageBucket}",
    messagingSenderId: "${config.firebaseMessagingSenderId}",
    appId: "${config.firebaseAppId}",
    measurementId: "${config.firebaseMeasurementId}"
};

// App Configuration
const APP_CONFIG = {
    appId: "${config.appId}",
    projectId: "${config.projectId}",
    collectionPath: "${config.collectionPath}"
};

// Google Analytics Configuration
const ANALYTICS_CONFIG = {
    trackingId: "${config.analyticsTrackingId}",
    gtagUrl: "${config.analyticsGtagUrl}"
};

// reCAPTCHA Configuration
const RECAPTCHA_CONFIG = {
    siteKey: "${config.recaptchaSiteKey}",
    apiUrl: "${config.recaptchaApiUrl}"
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        FIREBASE_CONFIG, 
        APP_CONFIG, 
        ANALYTICS_CONFIG, 
        RECAPTCHA_CONFIG 
    };
} else {
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
    window.ANALYTICS_CONFIG = ANALYTICS_CONFIG;
    window.RECAPTCHA_CONFIG = RECAPTCHA_CONFIG;
}`;
        
        const blob = new Blob([configContent], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'config.js';
        a.click();
        URL.revokeObjectURL(url);
        
        this.showMessage('config.js downloaded successfully');
    }
    
    // Private Settings Management
    async loadPrivateSettings() {
        try {
            const response = await fetch('api/get-private-config.php');
            if (response.ok) {
                const data = await response.json();
                
                document.getElementById('serviceXApiKey').value = data.privateKeys?.serviceXApiKey || '';
                document.getElementById('serviceYApiKey').value = data.privateKeys?.serviceYApiKey || '';
                document.getElementById('adminEmail').value = data.adminEmail || '';
                document.getElementById('adminNotes').value = data.notes || '';
            }
        } catch (error) {
            console.error('Error loading private settings:', error);
            this.showMessage('Could not load private settings. They may not exist yet.', 'warning');
        }
    }
    
    async savePrivateSettings() {
        try {
            const privateData = {
                privateKeys: {
                    serviceXApiKey: document.getElementById('serviceXApiKey').value,
                    serviceYApiKey: document.getElementById('serviceYApiKey').value
                },
                adminEmail: document.getElementById('adminEmail').value,
                notes: document.getElementById('adminNotes').value,
                updatedAt: new Date().toISOString()
            };
            
            const response = await fetch('api/save-private-config.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(privateData)
            });
            
            if (response.ok) {
                this.showMessage('Private settings saved successfully');
            } else {
                throw new Error('Server returned ' + response.status);
            }
            
        } catch (error) {
            console.error('Error saving private settings:', error);
            this.showMessage('Failed to save private settings: ' + error.message, 'error');
        }
    }
    
    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDateTimeForInput(dateTime) {
        if (typeof dateTime === 'string') {
            return dateTime.replace('Z', '');
        }
        if (dateTime?.toDate) {
            return dateTime.toDate().toISOString().slice(0, 16);
        }
        return '';
    }
    
    loadInitialData() {
        // Load data for the current tab
        if (this.currentTab === 'posts') {
            this.loadPosts();
        } else if (this.currentTab === 'events') {
            this.loadEventSettings();
        } else if (this.currentTab === 'config') {
            this.loadConfig();
        } else if (this.currentTab === 'private') {
            this.loadPrivateSettings();
        }
    }
}

// Initialize admin interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminInterface();
});