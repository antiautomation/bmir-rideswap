// Test file to verify initialization order fixes
console.log('🧪 Testing initialization order...');

// Test 1: Check if OfflineDebugger is available
if (typeof OfflineDebugger !== 'undefined') {
    console.log('✅ OfflineDebugger is available');
} else {
    console.log('❌ OfflineDebugger is not available');
}

// Test 2: Check if FirebaseUtils is available
if (typeof FirebaseUtils !== 'undefined') {
    console.log('✅ FirebaseUtils is available');
} else {
    console.log('❌ FirebaseUtils is not available');
}

// Test 3: Check if DOMCache is available
if (typeof DOMCache !== 'undefined') {
    console.log('✅ DOMCache is available');
} else {
    console.log('❌ DOMCache is not available');
}

// Test 4: Test session code functions
try {
    showSessionCodeInput();
    console.log('✅ showSessionCodeInput works');
} catch (error) {
    console.log('❌ showSessionCodeInput failed:', error.message);
}

try {
    hideSessionCodeInput();
    console.log('✅ hideSessionCodeInput works');
} catch (error) {
    console.log('❌ hideSessionCodeInput failed:', error.message);
}

try {
    enterSessionCode();
    console.log('✅ enterSessionCode works');
} catch (error) {
    console.log('❌ enterSessionCode failed:', error.message);
}

// Test 5: Test debug functions
if (typeof window.enableOfflineDebug === 'function') {
    console.log('✅ enableOfflineDebug is available');
} else {
    console.log('❌ enableOfflineDebug is not available');
}

if (typeof window.disableOfflineDebug === 'function') {
    console.log('✅ disableOfflineDebug is available');
} else {
    console.log('❌ disableOfflineDebug is not available');
}

console.log('🧪 Initialization tests complete'); 