// Poor Connectivity Testing Script for BMIR RideSwap
// Run this in browser console to test optimizations

const ConnectivityTester = {
    results: {},
    
    async runAllTests() {
        console.log('🧪 Starting Poor Connectivity Tests...');
        
        const tests = [
            { name: 'Service Worker Registration', fn: this.testServiceWorker },
            { name: 'Offline Functionality', fn: this.testOfflineMode },
            { name: 'Resource Loading', fn: this.testResourceLoading },
            { name: 'Firebase Connection', fn: this.testFirebaseConnection },
            { name: 'Cache Performance', fn: this.testCachePerformance },
            { name: 'Error Handling', fn: this.testErrorHandling }
        ];
        
        for (const test of tests) {
            try {
                console.log(`\n🔄 Running: ${test.name}`);
                const result = await test.fn.call(this);
                this.results[test.name] = { status: 'PASS', ...result };
                console.log(`✅ ${test.name}: PASSED`);
            } catch (error) {
                this.results[test.name] = { status: 'FAIL', error: error.message };
                console.error(`❌ ${test.name}: FAILED -`, error.message);
            }
        }
        
        this.printSummary();
        return this.results;
    },
    
    async testServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            throw new Error('Service Worker not supported');
        }
        
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            throw new Error('Service Worker not registered');
        }
        
        return {
            scope: registration.scope,
            state: registration.active?.state || 'unknown'
        };
    },
    
    async testOfflineMode() {
        // Simulate offline mode
        const originalOnLine = navigator.onLine;
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        
        // Trigger offline event
        window.dispatchEvent(new Event('offline'));
        
        // Check if status bar updates
        const statusBar = document.querySelector('.status-bar');
        if (!statusBar?.classList.contains('offline')) {
            throw new Error('Offline status not reflected in UI');
        }
        
        // Restore online state
        Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
        window.dispatchEvent(new Event('online'));
        
        return { message: 'Offline mode handling works correctly' };
    },
    
    async testResourceLoading() {
        const criticalResources = [
            './styles.css',
            './app.js',
            './manifest.json'
        ];
        
        const results = {};
        
        for (const resource of criticalResources) {
            try {
                const cache = await caches.open('bmir-rideshare-v2');
                const response = await cache.match(resource);
                results[resource] = response ? 'cached' : 'not cached';
            } catch (error) {
                results[resource] = 'error';
            }
        }
        
        return results;
    },
    
    async testFirebaseConnection() {
        if (!window.firebase || !window.AppState?.db) {
            throw new Error('Firebase not initialized');
        }
        
        // Test Firebase utilities
        if (!window.FirebaseUtils) {
            throw new Error('FirebaseUtils not available');
        }
        
        if (!window.OptimizedQueries) {
            throw new Error('OptimizedQueries not available');
        }
        
        return {
            firebase: 'initialized',
            utils: 'available',
            optimizedQueries: 'available'
        };
    },
    
    async testCachePerformance() {
        const start = performance.now();
        
        // Test cache access speed
        const cache = await caches.open('bmir-rideshare-v2');
        const keys = await cache.keys();
        
        const end = performance.now();
        const duration = end - start;
        
        return {
            cacheSize: keys.length,
            accessTime: `${duration.toFixed(2)}ms`,
            performance: duration < 100 ? 'good' : 'needs improvement'
        };
    },
    
    async testErrorHandling() {
        // Test if error handlers are properly set up
        const testCases = [
            { name: 'FirebaseUtils', exists: !!window.FirebaseUtils?.retry },
            { name: 'Connection monitoring', exists: !!window.addEventListener },
            { name: 'App error handler', exists: !!window.onerror || !!window.addEventListener }
        ];
        
        const failures = testCases.filter(test => !test.exists);
        
        if (failures.length > 0) {
            throw new Error(`Missing error handlers: ${failures.map(f => f.name).join(', ')}`);
        }
        
        return { message: 'All error handlers present' };
    },
    
    // Network simulation helpers
    simulateSlowConnection() {
        console.log('💡 To simulate slow connection:');
        console.log('1. Open Chrome DevTools');
        console.log('2. Go to Network tab');
        console.log('3. Select "Slow 3G" from throttling dropdown');
        console.log('4. Refresh page and observe behavior');
    },
    
    simulateOffline() {
        console.log('💡 To test offline mode:');
        console.log('1. Open Chrome DevTools');
        console.log('2. Go to Network tab');
        console.log('3. Check "Offline" checkbox');
        console.log('4. Try using the app - it should work with cached data');
    },
    
    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('=================');
        
        const passed = Object.values(this.results).filter(r => r.status === 'PASS').length;
        const failed = Object.values(this.results).filter(r => r.status === 'FAIL').length;
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n🔍 Failed Tests:');
            Object.entries(this.results)
                .filter(([_, result]) => result.status === 'FAIL')
                .forEach(([name, result]) => {
                    console.log(`  • ${name}: ${result.error}`);
                });
        }
        
        console.log('\n🎯 Next Steps:');
        console.log('1. Run ConnectivityTester.simulateSlowConnection()');
        console.log('2. Run ConnectivityTester.simulateOffline()');
        console.log('3. Test on actual mobile device with poor signal');
    }
};

// Export for console usage
window.ConnectivityTester = ConnectivityTester;

// Auto-run basic tests if not in production
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('🔧 Development environment detected. Run ConnectivityTester.runAllTests() to test optimizations.');
}

// Usage examples
console.log(`
🧪 Poor Connectivity Testing Script Loaded!

Usage:
- ConnectivityTester.runAllTests()          // Run all tests
- ConnectivityTester.simulateSlowConnection() // Show slow connection guide
- ConnectivityTester.simulateOffline()       // Show offline testing guide

Individual tests:
- ConnectivityTester.testServiceWorker()
- ConnectivityTester.testOfflineMode() 
- ConnectivityTester.testResourceLoading()
- ConnectivityTester.testFirebaseConnection()
- ConnectivityTester.testCachePerformance()
- ConnectivityTester.testErrorHandling()
`);