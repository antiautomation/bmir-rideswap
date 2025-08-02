// Test onboarding form submission
console.log('🧪 Testing onboarding form submission...');

// Test 1: Check if config is loaded
console.log('📋 Config check:');
console.log('  - window.FIREBASE_CONFIG:', !!window.FIREBASE_CONFIG);
console.log('  - window.APP_CONFIG:', !!window.APP_CONFIG);
console.log('  - window.ANALYTICS_CONFIG:', !!window.ANALYTICS_CONFIG);
console.log('  - window.RECAPTCHA_CONFIG:', !!window.RECAPTCHA_CONFIG);

// Test 2: Check AppState
console.log('📋 AppState check:');
console.log('  - AppState.appId:', AppState.appId);
console.log('  - AppState.db:', !!AppState.db);
console.log('  - AppState.auth:', !!AppState.auth);

// Test 3: Check Firebase functions
console.log('📋 Firebase functions check:');
console.log('  - window.addDoc:', typeof window.addDoc);
console.log('  - window.collection:', typeof window.collection);
console.log('  - window.db:', typeof window.db);

// Test 4: Check collection path construction
const testUserType = 'driver';
const testCollectionPath = `artifacts/${AppState.appId}/public/data/${testUserType}s`;
console.log('📋 Collection path test:');
console.log('  - Test collection path:', testCollectionPath);

// Test 5: Check if UniversalOnboarding is available
console.log('📋 UniversalOnboarding check:');
console.log('  - window.UniversalOnboarding:', !!window.UniversalOnboarding);
if (window.UniversalOnboarding) {
    console.log('  - shouldShow():', window.UniversalOnboarding.shouldShow());
}

// Test 6: Simulate form submission
async function testFormSubmission() {
    console.log('🧪 Testing form submission...');
    
    const testFormData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        date: '2025-08-03',
        timeSlot: 'Flexible Time',
        details: 'Test submission from onboarding'
    };
    
    try {
        const result = await FormUtils.submitFormToFirebase(
            testFormData,
            'driver',
            'to-burning-man',
            true // isOnboarding
        );
        
        console.log('✅ Test submission result:', result);
    } catch (error) {
        console.error('❌ Test submission failed:', error);
    }
}

// Run test after a delay to ensure everything is loaded
setTimeout(testFormSubmission, 2000);

console.log('🧪 Onboarding submission test ready - check console for results'); 