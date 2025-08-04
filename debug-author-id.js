// Debug script to check authorId vs AppState.userId
console.log('🔍 Debugging authorId vs AppState.userId issue...');

function debugAuthorIdIssue() {
    console.log('📋 Debug Results:');
    
    // Check current AppState
    console.log('1. Current AppState:');
    console.log('   - AppState.userId:', AppState?.userId);
    console.log('   - AppState.isGodMode:', AppState?.isGodMode);
    console.log('   - AppState.auth?.currentUser?.uid:', AppState?.auth?.currentUser?.uid);
    
    // Check global userId
    console.log('2. Global userId:', typeof userId !== 'undefined' ? userId : 'undefined');
    
    // Check all cards and their authorId values
    console.log('3. Checking all cards:');
    const allCards = document.querySelectorAll('[data-entry]');
    console.log('   - Total cards found:', allCards.length);
    
    let cardsWithEditButtons = 0;
    let cardsWithoutEditButtons = 0;
    
    allCards.forEach((card, index) => {
        try {
            const entry = JSON.parse(card.dataset.entry);
            const canEdit = entry.authorId === AppState?.userId || AppState?.isGodMode;
            const editButtons = card.querySelectorAll('.edit-btn, .delete-btn');
            
            console.log(`   - Card ${index + 1}:`);
            console.log(`     * authorId: "${entry.authorId}"`);
            console.log(`     * AppState.userId: "${AppState?.userId}"`);
            console.log(`     * Can edit: ${canEdit}`);
            console.log(`     * Edit buttons found: ${editButtons.length}`);
            
            if (editButtons.length > 0) {
                cardsWithEditButtons++;
            } else {
                cardsWithoutEditButtons++;
            }
            
            // Check if this is your post
            if (entry.authorId === AppState?.userId) {
                console.log(`     * 🎯 THIS IS YOUR POST!`);
            }
            
        } catch (e) {
            console.log(`   - Card ${index + 1} parse error:`, e.message);
        }
    });
    
    console.log('4. Summary:');
    console.log(`   - Cards with edit buttons: ${cardsWithEditButtons}`);
    console.log(`   - Cards without edit buttons: ${cardsWithoutEditButtons}`);
    
    // Check if any posts have 'anonymous' authorId
    const anonymousPosts = Array.from(allCards).filter(card => {
        try {
            const entry = JSON.parse(card.dataset.entry);
            return entry.authorId === 'anonymous';
        } catch (e) {
            return false;
        }
    });
    
    console.log(`   - Posts with 'anonymous' authorId: ${anonymousPosts.length}`);
    
    // Check if current user is 'anonymous'
    const isCurrentUserAnonymous = AppState?.userId === 'anonymous' || !AppState?.userId;
    console.log(`   - Current user is anonymous: ${isCurrentUserAnonymous}`);
    
    // Test the condition logic
    console.log('5. Testing condition logic:');
    console.log(`   - AppState.userId === 'anonymous': ${AppState?.userId === 'anonymous'}`);
    console.log(`   - AppState.userId === undefined: ${AppState?.userId === undefined}`);
    console.log(`   - AppState.userId === null: ${AppState?.userId === null}`);
    
    // Check if there are any posts that should show edit buttons
    const postsThatShouldShowEditButtons = Array.from(allCards).filter(card => {
        try {
            const entry = JSON.parse(card.dataset.entry);
            return entry.authorId === AppState?.userId;
        } catch (e) {
            return false;
        }
    });
    
    console.log(`   - Posts that should show edit buttons: ${postsThatShouldShowEditButtons.length}`);
    
    if (postsThatShouldShowEditButtons.length > 0) {
        console.log('   - These posts should show edit buttons:');
        postsThatShouldShowEditButtons.forEach((card, index) => {
            try {
                const entry = JSON.parse(card.dataset.entry);
                console.log(`     * Post ${index + 1}: authorId="${entry.authorId}", name="${entry.name}"`);
            } catch (e) {
                console.log(`     * Post ${index + 1}: parse error`);
            }
        });
    }
    
    console.log('🎯 Debug completed!');
}

// Run the debug
debugAuthorIdIssue();

// Provide a function to manually check a specific post
window.checkSpecificPost = function(postIndex = 0) {
    const allCards = document.querySelectorAll('[data-entry]');
    if (allCards[postIndex]) {
        try {
            const entry = JSON.parse(allCards[postIndex].dataset.entry);
            console.log(`🔍 Checking post ${postIndex}:`);
            console.log(`   - authorId: "${entry.authorId}"`);
            console.log(`   - name: "${entry.name}"`);
            console.log(`   - AppState.userId: "${AppState?.userId}"`);
            console.log(`   - Should show edit buttons: ${entry.authorId === AppState?.userId}`);
        } catch (e) {
            console.log(`❌ Error parsing post ${postIndex}:`, e.message);
        }
    } else {
        console.log(`❌ Post ${postIndex} not found`);
    }
};

console.log('💡 To check a specific post, run: checkSpecificPost(0)'); 