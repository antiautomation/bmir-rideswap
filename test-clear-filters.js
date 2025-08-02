// Test file to verify Clear Filters functionality
console.log('🧪 Testing Clear Filters functionality...');

// Test 1: Check if Clear Filters buttons exist
setTimeout(() => {
    console.log('🔍 Testing Clear Filters button availability...');
    
    const clearFiltersMobile = document.getElementById('clear-filters-mobile');
    const clearFiltersDesktop = document.getElementById('clear-filters-desktop');
    const clearFiltersBtnMobile = document.getElementById('clear-filters-btn-mobile');
    const clearFiltersBtnDesktop = document.getElementById('clear-filters-btn-desktop');
    
    if (clearFiltersMobile) {
        console.log('✅ Clear filters mobile container exists');
    } else {
        console.log('❌ Clear filters mobile container missing');
    }
    
    if (clearFiltersDesktop) {
        console.log('✅ Clear filters desktop container exists');
    } else {
        console.log('❌ Clear filters desktop container missing');
    }
    
    if (clearFiltersBtnMobile) {
        console.log('✅ Clear filters mobile button exists');
    } else {
        console.log('❌ Clear filters mobile button missing');
    }
    
    if (clearFiltersBtnDesktop) {
        console.log('✅ Clear filters desktop button exists');
    } else {
        console.log('❌ Clear filters desktop button missing');
    }
    
    // Test 2: Check if functions exist
    if (typeof updateClearFiltersVisibility === 'function') {
        console.log('✅ updateClearFiltersVisibility function exists');
    } else {
        console.log('❌ updateClearFiltersVisibility function missing');
    }
    
    if (typeof clearAllFilters === 'function') {
        console.log('✅ clearAllFilters function exists');
    } else {
        console.log('❌ clearAllFilters function missing');
    }
    
    // Test 3: Check initial state (should be hidden when no filters active)
    if (clearFiltersMobile && clearFiltersMobile.style.display === 'none') {
        console.log('✅ Clear filters mobile button initially hidden (correct)');
    } else if (clearFiltersMobile && clearFiltersMobile.style.display === 'block') {
        console.log('⚠️ Clear filters mobile button initially visible (may have active filters)');
    } else {
        console.log('❌ Clear filters mobile button visibility unclear');
    }
    
    if (clearFiltersDesktop && clearFiltersDesktop.style.display === 'none') {
        console.log('✅ Clear filters desktop button initially hidden (correct)');
    } else if (clearFiltersDesktop && clearFiltersDesktop.style.display === 'block') {
        console.log('⚠️ Clear filters desktop button initially visible (may have active filters)');
    } else {
        console.log('❌ Clear filters desktop button visibility unclear');
    }
    
    // Test 4: Check filter state variables
    console.log('🔍 Checking filter state variables...');
    
    // These should be available in the global scope
    if (typeof currentDayFilter !== 'undefined') {
        console.log(`✅ currentDayFilter: ${currentDayFilter}`);
    } else {
        console.log('❌ currentDayFilter not available');
    }
    
    if (typeof currentLocationFilter !== 'undefined') {
        console.log(`✅ currentLocationFilter: ${currentLocationFilter}`);
    } else {
        console.log('❌ currentLocationFilter not available');
    }
    
    if (typeof showExpiredEntries !== 'undefined') {
        console.log(`✅ showExpiredEntries: ${showExpiredEntries}`);
    } else {
        console.log('❌ showExpiredEntries not available');
    }
    
    if (typeof showFavoritesOnly !== 'undefined') {
        console.log(`✅ showFavoritesOnly: ${showFavoritesOnly}`);
    } else {
        console.log('❌ showFavoritesOnly not available');
    }
    
    if (typeof showDriversOnly !== 'undefined') {
        console.log(`✅ showDriversOnly: ${showDriversOnly}`);
    } else {
        console.log('❌ showDriversOnly not available');
    }
    
    if (typeof showRidersOnly !== 'undefined') {
        console.log(`✅ showRidersOnly: ${showRidersOnly}`);
    } else {
        console.log('❌ showRidersOnly not available');
    }
    
    console.log('🧪 Clear Filters functionality tests complete');
}, 2000); // Wait 2 seconds for initialization 