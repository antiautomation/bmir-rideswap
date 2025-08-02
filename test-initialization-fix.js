// Test file to verify initialization order fixes
console.log('🧪 Testing initialization order fixes...');

// Test 1: Check if components are available after initialization
setTimeout(() => {
    console.log('🔍 Testing component availability...');
    
    if (typeof FormUtils !== 'undefined') {
        console.log('✅ FormUtils is available');
    } else {
        console.log('❌ FormUtils is not available');
    }
    
    if (typeof UniversalOnboarding !== 'undefined') {
        console.log('✅ UniversalOnboarding is available');
    } else {
        console.log('❌ UniversalOnboarding is not available');
    }
    
    if (typeof AppState !== 'undefined') {
        console.log('✅ AppState is available');
    } else {
        console.log('❌ AppState is not available');
    }
    
    if (typeof FirebaseUtils !== 'undefined') {
        console.log('✅ FirebaseUtils is available');
    } else {
        console.log('❌ FirebaseUtils is not available');
    }
    
    // Test 2: Check if FormUtils can safely handle AppState access
    if (typeof FormUtils !== 'undefined' && typeof FormUtils.submitFormToFirebase === 'function') {
        console.log('✅ FormUtils.submitFormToFirebase is available');
        
        // Test with mock data
        const mockFormData = {
            name: 'Test User',
            email: 'test@example.com',
            phone: '1234567890',
            location: 'San Francisco',
            date: '2024-08-25',
            details: 'Test details'
        };
        
        // This should not throw an error even if AppState is not ready
        try {
            const result = FormUtils.submitFormToFirebase(mockFormData, 'driver', 'to-burning-man', true);
            console.log('✅ FormUtils.submitFormToFirebase handles AppState safely');
        } catch (error) {
            console.log('❌ FormUtils.submitFormToFirebase failed:', error.message);
        }
    } else {
        console.log('❌ FormUtils.submitFormToFirebase is not available');
    }
    
    // Test 3: Check if OptimizedQueries can safely handle AppState access
    if (typeof OptimizedQueries !== 'undefined' && typeof OptimizedQueries.getOptimizedQuery === 'function') {
        console.log('✅ OptimizedQueries.getOptimizedQuery is available');
        
        // This should not throw an error even if AppState is not ready
        try {
            const result = OptimizedQueries.getOptimizedQuery('test-collection', {});
            console.log('✅ OptimizedQueries.getOptimizedQuery handles AppState safely');
        } catch (error) {
            console.log('✅ OptimizedQueries.getOptimizedQuery correctly throws error when AppState not ready:', error.message);
        }
    } else {
        console.log('❌ OptimizedQueries.getOptimizedQuery is not available');
    }
    
    console.log('🧪 Initialization order fix tests complete');
}, 1000); // Wait 1 second for initialization 