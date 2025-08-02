// Test file to verify form refactoring
console.log('🧪 Testing form refactoring...');

// Test 1: Check if FormUtils is available
if (typeof FormUtils !== 'undefined') {
    console.log('✅ FormUtils is available');
} else {
    console.log('❌ FormUtils is not available');
}

// Test 2: Check if UniversalOnboarding is available
if (typeof UniversalOnboarding !== 'undefined') {
    console.log('✅ UniversalOnboarding is available');
} else {
    console.log('❌ UniversalOnboarding is not available');
}

// Test 3: Test FormUtils validation
if (typeof FormUtils.validateEntry === 'function') {
    console.log('✅ FormUtils.validateEntry is available');
    
    // Test validation with valid data
    const validData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        location: 'San Francisco',
        date: '2024-08-25',
        details: 'Test details'
    };
    
    const validErrors = FormUtils.validateEntry(validData);
    if (validErrors.length === 0) {
        console.log('✅ FormUtils validation works with valid data');
    } else {
        console.log('❌ FormUtils validation failed with valid data:', validErrors);
    }
    
    // Test validation with invalid data
    const invalidData = {
        name: '',
        email: 'invalid-email',
        phone: '',
        location: '',
        date: '',
        details: ''
    };
    
    const invalidErrors = FormUtils.validateEntry(invalidData);
    if (invalidErrors.length > 0) {
        console.log('✅ FormUtils validation correctly identifies invalid data');
        console.log('Validation errors:', invalidErrors);
    } else {
        console.log('❌ FormUtils validation failed to identify invalid data');
    }
} else {
    console.log('❌ FormUtils.validateEntry is not available');
}

// Test 4: Test date format validation
if (typeof FormUtils.validateDateFormat === 'function') {
    console.log('✅ FormUtils.validateDateFormat is available');
    
    // Test valid date
    const validDate = FormUtils.validateDateFormat('2024-08-25');
    if (validDate.valid) {
        console.log('✅ Date format validation works with valid date');
    } else {
        console.log('❌ Date format validation failed with valid date:', validDate.error);
    }
    
    // Test invalid date (European format)
    const invalidDate = FormUtils.validateDateFormat('25-08-2024');
    if (!invalidDate.valid) {
        console.log('✅ Date format validation correctly identifies European format');
    } else {
        console.log('❌ Date format validation failed to identify European format');
    }
} else {
    console.log('❌ FormUtils.validateDateFormat is not available');
}

// Test 5: Test form data standardization
if (typeof FormUtils.standardizeFormData === 'function') {
    console.log('✅ FormUtils.standardizeFormData is available');
    
    const testFormData = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        location: 'San Francisco',
        date: '2024-08-25',
        timeSlot: '10:00 - 12:00',
        details: 'Test details',
        passengerSpace: '3 seats',
        cargoSpace: 'Large trunk'
    };
    
    const standardized = FormUtils.standardizeFormData(testFormData, 'driver', 'to-burning-man');
    if (standardized.name && standardized.direction === 'to-brc' && standardized.type === 'driver') {
        console.log('✅ Form data standardization works');
    } else {
        console.log('❌ Form data standardization failed');
    }
} else {
    console.log('❌ FormUtils.standardizeFormData is not available');
}

// Test 6: Test UniversalOnboarding shouldShow
if (typeof UniversalOnboarding.shouldShow === 'function') {
    console.log('✅ UniversalOnboarding.shouldShow is available');
    
    // Clear localStorage for testing
    const originalOnboarding = localStorage.getItem('bmir_onboarding_completed');
    const originalRide = localStorage.getItem('bmir_has_submitted_ride');
    
    localStorage.removeItem('bmir_onboarding_completed');
    localStorage.removeItem('bmir_has_submitted_ride');
    
    const shouldShow = UniversalOnboarding.shouldShow();
    console.log('Should show onboarding (with cleared localStorage):', shouldShow);
    
    // Restore original values
    if (originalOnboarding) localStorage.setItem('bmir_onboarding_completed', originalOnboarding);
    if (originalRide) localStorage.setItem('bmir_has_submitted_ride', originalRide);
} else {
    console.log('❌ UniversalOnboarding.shouldShow is not available');
}

console.log('🧪 Form refactoring tests complete'); 