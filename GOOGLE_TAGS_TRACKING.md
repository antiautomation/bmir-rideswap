# Google Tags Tracking Implementation

This document outlines all the Google Tags tracking events implemented in the RideFinder app to help track user engagement and conversion goals.

## Overview

The app uses Google Analytics 4 (GA4) tracking with two main tracking functions:
- `trackOnboardingEvent()` - For onboarding flow events
- `trackMainAppEvent()` - For main application events

## Tracking Goals

### 1. New User Listing Completion Goal
**Event:** `new_user_listing_completed`
- **Category:** `conversion`
- **Triggered when:** A new user (first-time visitor) successfully creates a listing
- **Labels:** `driver` or `rider`
- **Value:** `1`

### 2. New User Onboarding Completion Goal
**Event:** `new_user_onboarding_completed`
- **Category:** `conversion`
- **Triggered when:** A new user completes the onboarding flow
- **Labels:** `driver_to-burning-man`, `driver_from-burning-man`, `rider_to-burning-man`, `rider_from-burning-man`
- **Value:** `1`

### 3. Filter Usage Tracking
**Event:** `filter_used`
- **Category:** `engagement`
- **Triggered when:** Users interact with any filter
- **Labels:** `day_filter`, `location_filter`, `belongings_filter`
- **Custom Parameter:** `custom_parameter_1` contains the selected filter value
- **Value:** `1`

### 4. Toggle Usage Tracking
**Event:** `toggle_used`
- **Category:** `engagement`
- **Triggered when:** Users interact with any toggle
- **Labels:** `show_expired_entries`, `show_favorites_only`, `show_drivers_only`, `show_riders_only`, `show_recent_posts`
- **Custom Parameter:** `custom_parameter_1` contains `enabled` or `disabled`
- **Value:** `1`

## Detailed Event Tracking

### Onboarding Flow Events

#### User Type Selection
- **Event:** `onboarding_user_type_selected`
- **Labels:** `rider`, `driver`
- **Triggered when:** User selects their role in the onboarding flow

#### Direction Selection
- **Event:** `onboarding_direction_selected`
- **Labels:** `to-burning-man`, `from-burning-man`
- **Triggered when:** User selects their travel direction

#### Browse Listings Selection
- **Event:** `onboarding_browse_listings_selected`
- **Triggered when:** User chooses to browse listings instead of creating one

#### Back Button Usage
- **Event:** `onboarding_back_button_clicked`
- **Labels:** `direction_screen`, `form_screen`
- **Triggered when:** User uses back buttons in onboarding

#### Form Submission
- **Event:** `onboarding_form_submitted`
- **Labels:** `driver_to-burning-man`, `driver_from-burning-man`, `rider_to-burning-man`, `rider_from-burning-man`
- **Triggered when:** User submits the onboarding form

#### Onboarding Cancellation
- **Event:** `new_user_onboarding_cancelled`
- **Category:** `engagement`
- **Labels:** `browse_listings`
- **Triggered when:** New user cancels onboarding

#### Onboarding Exit Attempts
- **Event:** `new_user_onboarding_exit_attempt`
- **Category:** `engagement`
- **Labels:** `direction_back_button`, `form_back_button`
- **Triggered when:** New user attempts to exit onboarding

### Main Application Events

#### Entry Creation/Update
- **Event:** `entry_saved`
- **Category:** `engagement`
- **Labels:** `driver`, `rider`
- **Triggered when:** User successfully saves a listing

#### Direction Changes
- **Event:** `direction_changed`
- **Category:** `navigation`
- **Labels:** `to-brc`, `from-brc`
- **Triggered when:** User changes the direction filter

#### Modal Interactions
- **Event:** `modal_opened`
- **Category:** `engagement`
- **Labels:** `driver`, `rider`
- **Triggered when:** User opens the add listing modal

#### Help Modal Usage
- **Event:** `help_modal_opened`
- **Category:** `engagement`
- **Labels:** `how_app_works`
- **Triggered when:** User opens the help modal

#### Session Code Usage
- **Event:** `session_code_entered`
- **Category:** `engagement`
- **Labels:** `regular_session_code`
- **Triggered when:** User enters a session code

#### God Mode Activation
- **Event:** `god_mode_activated`
- **Category:** `engagement`
- **Labels:** `admin_access`
- **Triggered when:** Admin activates god mode

#### Filter Clearing
- **Event:** `filters_cleared`
- **Category:** `engagement`
- **Labels:** `all_filters`
- **Triggered when:** User clears all filters

#### Post-Onboarding Listing Completion
- **Event:** `listing_completed_after_cancelled_onboarding`
- **Labels:** `driver`, `rider`
- **Triggered when:** User completes a listing after previously cancelling onboarding

## Implementation Details

### Tracking Functions

```javascript
// Onboarding events
window.trackOnboardingEvent = function(action, label = null, value = null) {
    // Checks for station mode (local development)
    // Sends event with 'onboarding_' prefix
}

// Main app events
window.trackMainAppEvent = function(action, label = null, value = null) {
    // Checks for station mode (local development)
    // Sends event with 'main_app_' prefix
}
```

### Station Mode Detection
Tracking is automatically disabled in local development (station mode) to prevent test data from affecting analytics.

### New User Detection
The app uses localStorage to track returning users:
- `bmir_returning_user` - Set to 'true' after first interaction
- New user events only fire for users without this flag

### Event Categories
- `conversion` - Goal completion events
- `engagement` - User interaction events
- `navigation` - Navigation-related events

## Google Analytics 4 Goals Setup

### Recommended Goals in GA4

1. **New User Listing Completion**
   - Event: `new_user_listing_completed`
   - Type: Custom Event

2. **New User Onboarding Completion**
   - Event: `new_user_onboarding_completed`
   - Type: Custom Event

3. **Filter Engagement**
   - Event: `filter_used`
   - Type: Custom Event

4. **Toggle Engagement**
   - Event: `toggle_used`
   - Type: Custom Event

### Custom Dimensions (Optional)
Consider setting up custom dimensions for:
- `custom_parameter_1` - Filter/toggle values
- User type (driver/rider)
- Direction (to/from Burning Man)

## Testing

### Local Development
- All tracking is disabled in station mode (localhost/file://)
- Console logs show what events would be sent
- Use production URL for testing tracking

### Production Testing
1. Open browser developer tools
2. Go to Network tab
3. Filter by "google-analytics" or "gtag"
4. Interact with the app
5. Verify events are being sent

### Event Validation
Check that events include:
- Correct event names
- Proper categories and labels
- Appropriate values
- Custom parameters where applicable

## Maintenance

### Adding New Events
1. Use existing tracking functions
2. Add appropriate category and label
3. Update this documentation
4. Test in production environment

### Modifying Events
1. Update tracking code
2. Update this documentation
3. Consider impact on existing goals
4. Test thoroughly

### Monitoring
- Regularly check GA4 reports
- Monitor goal conversion rates
- Track user engagement patterns
- Identify areas for improvement
