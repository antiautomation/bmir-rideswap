// Test file to verify onboarding and session code interaction
console.log('🧪 Testing onboarding and session code interaction...');

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
    console.log('🔍 Testing onboarding and session code interaction...');
    
    const onboardingOverlay = document.getElementById('mobile-onboarding');
    const sessionCodeDisplay = document.getElementById('session-code-display');
    const sessionCodeText = document.getElementById('session-code-text');
    
    // Test 1: Check initial state
    console.log('📋 Initial state:');
    console.log(`  - Onboarding overlay exists: ${!!onboardingOverlay}`);
    console.log(`  - Onboarding visible: ${onboardingOverlay ? !onboardingOverlay.classList.contains('hidden') : 'N/A'}`);
    console.log(`  - Session code display exists: ${!!sessionCodeDisplay}`);
    console.log(`  - Session code display visible: ${sessionCodeDisplay ? sessionCodeDisplay.style.display === 'flex' : 'N/A'}`);
    
    // Test 2: Check if onboarding should show
    if (typeof window.UniversalOnboarding !== 'undefined' && typeof window.UniversalOnboarding.shouldShow === 'function') {
        const shouldShow = window.UniversalOnboarding.shouldShow();
        console.log(`🎯 Onboarding should show: ${shouldShow}`);
        
        if (shouldShow) {
            console.log('✅ Onboarding conditions met - should be visible');
            console.log('📝 This means session code modal should be suppressed');
        } else {
            console.log('ℹ️ Onboarding conditions not met - may be hidden');
            console.log('📝 This means session code modal can be shown');
        }
    }
    
    // Test 3: Check session code functions
    if (typeof showSessionCodeModal === 'function') {
        console.log('✅ showSessionCodeModal function exists');
    } else {
        console.log('❌ showSessionCodeModal function missing');
    }
    
    if (typeof enterSessionCode === 'function') {
        console.log('✅ enterSessionCode function exists');
    } else {
        console.log('❌ enterSessionCode function missing');
    }
    
    if (typeof hideSessionCodeInput === 'function') {
        console.log('✅ hideSessionCodeInput function exists');
    } else {
        console.log('❌ hideSessionCodeInput function missing');
    }
    
    // Test 4: Check localStorage state
    const onboardingCompleted = localStorage.getItem('bmir_onboarding_completed');
    const hasSubmittedRide = localStorage.getItem('bmir_has_submitted_ride');
    console.log('💾 LocalStorage state:');
    console.log(`  - Onboarding completed: ${onboardingCompleted}`);
    console.log(`  - Has submitted ride: ${hasSubmittedRide}`);
    
    // Test 5: Check session code state
    const userId = 'test-user-id';
    const sessionCodeKey = `bmir_session_code_${userId}`;
    const savedSessionCode = localStorage.getItem(sessionCodeKey);
    console.log(`  - Saved session code: ${savedSessionCode || 'none'}`);
    
    // Test 6: Simulate onboarding completion
    if (typeof window.UniversalOnboarding !== 'undefined' && typeof window.UniversalOnboarding.hide === 'function') {
        console.log('🎬 Testing onboarding completion...');
        
        // First show onboarding
        if (typeof window.UniversalOnboarding.show === 'function') {
            window.UniversalOnboarding.show();
            console.log('✅ Onboarding shown');
            
            // Check if session code display is hidden during onboarding
            setTimeout(() => {
                if (sessionCodeDisplay) {
                    const isHidden = sessionCodeDisplay.style.display !== 'flex';
                    console.log(`📋 Session code display during onboarding: ${isHidden ? 'hidden' : 'visible'}`);
                    if (isHidden) {
                        console.log('✅ Session code display correctly hidden during onboarding');
                    } else {
                        console.log('⚠️ Session code display should be hidden during onboarding');
                    }
                }
                
                // Now hide onboarding to test completion
                window.UniversalOnboarding.hide();
                console.log('✅ Onboarding hidden');
                
                // Check if session code display is shown after onboarding
                setTimeout(() => {
                    if (sessionCodeDisplay) {
                        const isVisible = sessionCodeDisplay.style.display === 'flex';
                        console.log(`📋 Session code display after onboarding: ${isVisible ? 'visible' : 'hidden'}`);
                        if (isVisible) {
                            console.log('✅ Session code display correctly shown after onboarding');
                        } else {
                            console.log('ℹ️ Session code display not shown (may be normal if no session code exists)');
                        }
                    }
                }, 1000);
            }, 1000);
        }
    }
    
    console.log('🧪 Onboarding and session code interaction tests complete');
}); 