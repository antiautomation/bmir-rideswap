// Test file to verify Universal Onboarding functionality
console.log('🧪 Testing Universal Onboarding functionality...');

// Wait for the app to fully initialize
function waitForUniversalOnboarding() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (typeof window.UniversalOnboarding !== 'undefined') {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 10000);
    });
}

// Run tests after initialization
waitForUniversalOnboarding().then(() => {
    console.log('🔍 Testing Universal Onboarding element availability...');
    
    const onboardingOverlay = document.getElementById('mobile-onboarding');
    const welcomeScreen = document.getElementById('onboarding-welcome');
    const directionScreen = document.getElementById('onboarding-direction');
    const formScreen = document.getElementById('onboarding-form');
    
    if (onboardingOverlay) {
        console.log('✅ Onboarding overlay exists');
        console.log('📋 Overlay classes:', onboardingOverlay.className);
    } else {
        console.log('❌ Onboarding overlay missing');
    }
    
    if (welcomeScreen) {
        console.log('✅ Welcome screen exists');
    } else {
        console.log('❌ Welcome screen missing');
    }
    
    if (directionScreen) {
        console.log('✅ Direction screen exists');
    } else {
        console.log('❌ Direction screen missing');
    }
    
    if (formScreen) {
        console.log('✅ Form screen exists');
    } else {
        console.log('❌ Form screen missing');
    }
    
    // Test 2: Check if UniversalOnboarding functions exist
    if (typeof window.UniversalOnboarding !== 'undefined') {
        console.log('✅ UniversalOnboarding object exists');
        
        if (typeof window.UniversalOnboarding.shouldShow === 'function') {
            console.log('✅ UniversalOnboarding.shouldShow function exists');
        } else {
            console.log('❌ UniversalOnboarding.shouldShow function missing');
        }
        
        if (typeof window.UniversalOnboarding.show === 'function') {
            console.log('✅ UniversalOnboarding.show function exists');
        } else {
            console.log('❌ UniversalOnboarding.show function missing');
        }
        
        if (typeof window.UniversalOnboarding.hide === 'function') {
            console.log('✅ UniversalOnboarding.hide function exists');
        } else {
            console.log('❌ UniversalOnboarding.hide function missing');
        }
    } else {
        console.log('❌ UniversalOnboarding object missing');
    }
    
    // Test 3: Check responsive design
    console.log('📱 Testing responsive design...');
    
    const viewportWidth = window.innerWidth;
    console.log(`📏 Current viewport width: ${viewportWidth}px`);
    
    if (viewportWidth < 768) {
        console.log('📱 Mobile/Tablet view detected');
    } else if (viewportWidth < 1440) {
        console.log('💻 Desktop view detected');
    } else if (viewportWidth < 1920) {
        console.log('🖥️ Large desktop view detected');
    } else {
        console.log('🖥️ Ultra-wide view detected');
    }
    
    // Test 4: Check if onboarding should show
    if (typeof window.UniversalOnboarding !== 'undefined' && typeof window.UniversalOnboarding.shouldShow === 'function') {
        const shouldShow = window.UniversalOnboarding.shouldShow();
        console.log(`🎯 Onboarding should show: ${shouldShow}`);
        
        if (shouldShow) {
            console.log('✅ Onboarding conditions met - should be visible');
        } else {
            console.log('ℹ️ Onboarding conditions not met - may be hidden');
        }
    }
    
    // Test 5: Check CSS classes and styling
    if (onboardingOverlay) {
        const computedStyle = window.getComputedStyle(onboardingOverlay);
        console.log('🎨 Onboarding overlay styles:');
        console.log(`  - Display: ${computedStyle.display}`);
        console.log(`  - Position: ${computedStyle.position}`);
        console.log(`  - Z-index: ${computedStyle.zIndex}`);
        console.log(`  - Background: ${computedStyle.background}`);
        
        if (onboardingOverlay.classList.contains('hidden')) {
            console.log('👁️ Onboarding is currently hidden');
        } else {
            console.log('👁️ Onboarding is currently visible');
        }
    }
    
    // Test 6: Check form elements
    const onboardingForm = document.getElementById('onboarding-ride-form');
    const nameInput = document.getElementById('onboarding-name');
    const emailInput = document.getElementById('onboarding-email');
    const phoneInput = document.getElementById('onboarding-phone');
    const locationInput = document.getElementById('onboarding-location');
    
    if (onboardingForm) {
        console.log('✅ Onboarding form exists');
    } else {
        console.log('❌ Onboarding form missing');
    }
    
    if (nameInput) {
        console.log('✅ Name input exists');
    } else {
        console.log('❌ Name input missing');
    }
    
    if (emailInput) {
        console.log('✅ Email input exists');
    } else {
        console.log('❌ Email input missing');
    }
    
    if (phoneInput) {
        console.log('✅ Phone input exists');
    } else {
        console.log('❌ Phone input missing');
    }
    
    if (locationInput) {
        console.log('✅ Location input exists');
    } else {
        console.log('❌ Location input missing');
    }
    
    // Test 7: Check button elements
    const needRideBtn = document.getElementById('need-ride-btn');
    const provideRideBtn = document.getElementById('provide-ride-btn');
    const browseListingsBtn = document.getElementById('browse-listings-btn');
    
    if (needRideBtn) {
        console.log('✅ Need ride button exists');
    } else {
        console.log('❌ Need ride button missing');
    }
    
    if (provideRideBtn) {
        console.log('✅ Provide ride button exists');
    } else {
        console.log('❌ Provide ride button missing');
    }
    
    if (browseListingsBtn) {
        console.log('✅ Browse listings button exists');
    } else {
        console.log('❌ Browse listings button missing');
    }
    
    console.log('🧪 Universal Onboarding functionality tests complete');
    
    // Test 8: Simulate showing onboarding (if conditions are met)
    if (typeof window.UniversalOnboarding !== 'undefined' && typeof window.UniversalOnboarding.show === 'function') {
        console.log('🎬 Testing onboarding show function...');
        try {
            window.UniversalOnboarding.show();
            console.log('✅ Onboarding show function executed successfully');
            
            // Hide it again after a short delay
            setTimeout(() => {
                if (typeof window.UniversalOnboarding.hide === 'function') {
                    window.UniversalOnboarding.hide();
                    console.log('✅ Onboarding hide function executed successfully');
                }
            }, 2000);
        } catch (error) {
            console.log('❌ Error showing onboarding:', error.message);
        }
    }
}); 