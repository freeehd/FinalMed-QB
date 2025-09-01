<?php
/**
 * Test Script for Session Management
 * 
 * This script can be run to test the session management functionality.
 * Place this file in the plugin directory and access it via browser.
 * 
 * WARNING: This is for testing purposes only. Remove in production.
 */

// Load WordPress
require_once('../../../wp-load.php');

// Ensure user is logged in
if (!is_user_logged_in()) {
    wp_die('Please log in to test session management.');
}

$user_id = get_current_user_id();

echo "<h1>Session Management Test</h1>";
echo "<p>Testing for user ID: {$user_id}</p>";

// Test 1: Check for active sessions
echo "<h2>Test 1: Check Active Sessions</h2>";
$active_session = \WQB\Session_Manager::get_active_session($user_id);
if ($active_session) {
    echo "<p>✅ Active session found:</p>";
    echo "<ul>";
    echo "<li>Session ID: {$active_session->session_id}</li>";
    echo "<li>Mode: {$active_session->session_mode}</li>";
    echo "<li>Current Index: {$active_session->current_index}</li>";
    echo "<li>Total Questions: " . count($active_session->question_ids) . "</li>";
    echo "<li>Answered: " . count($active_session->user_answers) . "</li>";
    echo "<li>Created: {$active_session->created_at}</li>";
    echo "<li>Expires: {$active_session->expires_at}</li>";
    echo "</ul>";
} else {
    echo "<p>❌ No active session found.</p>";
}

// Test 2: Get session statistics
echo "<h2>Test 2: Session Statistics</h2>";
$stats = \WQB\Session_Manager::get_user_session_stats($user_id);
if ($stats) {
    echo "<p>✅ Session statistics:</p>";
    echo "<ul>";
    echo "<li>Total Sessions: {$stats->total_sessions}</li>";
    echo "<li>Practice Sessions: {$stats->practice_sessions}</li>";
    echo "<li>Mock Sessions: {$stats->mock_sessions}</li>";
    echo "<li>Active Sessions: {$stats->active_sessions}</li>";
    echo "</ul>";
} else {
    echo "<p>❌ No session statistics found.</p>";
}

// Test 3: Get recent sessions
echo "<h2>Test 3: Recent Sessions</h2>";
$sessions = \WQB\Session_Manager::get_user_sessions($user_id, 5);
if ($sessions) {
    echo "<p>✅ Recent sessions:</p>";
    foreach ($sessions as $session) {
        echo "<div style='border: 1px solid #ccc; margin: 10px 0; padding: 10px;'>";
        echo "<strong>Session ID:</strong> {$session->session_id}<br>";
        echo "<strong>Mode:</strong> {$session->session_mode}<br>";
        echo "<strong>Status:</strong> " . ($session->is_active ? 'Active' : 'Inactive') . "<br>";
        echo "<strong>Progress:</strong> {$session->answered_count}/{$session->total_questions}<br>";
        echo "<strong>Created:</strong> {$session->created_at}<br>";
        echo "<strong>Updated:</strong> {$session->updated_at}<br>";
        echo "<strong>Expires:</strong> {$session->expires_at}<br>";
        echo "</div>";
    }
} else {
    echo "<p>❌ No recent sessions found.</p>";
}

// Test 4: Cleanup test
echo "<h2>Test 4: Cleanup Test</h2>";
$cleanup_result = \WQB\Session_Manager::cleanup_expired_sessions();
echo "<p>✅ Cleanup completed:</p>";
echo "<ul>";
echo "<li>Deactivated: {$cleanup_result['deactivated']} sessions</li>";
echo "<li>Deleted: {$cleanup_result['deleted']} old sessions</li>";
echo "</ul>";

// Test 5: Create a test session
echo "<h2>Test 5: Create Test Session</h2>";
$test_session_data = [
    'question_ids' => [1, 2, 3, 4, 5],
    'current_index' => 0,
    'user_answers' => [],
    'question_states' => [],
    'mode' => 'practice'
];

$session_id = \WQB\Session_Manager::create_session($user_id, $test_session_data);
if ($session_id) {
    echo "<p>✅ Test session created with ID: {$session_id}</p>";
    
    // Test updating the session
    $test_session_data['current_index'] = 2;
    $test_session_data['user_answers'][1] = 0;
    $test_session_data['question_states'][1] = 'correct';
    
    $updated = \WQB\Session_Manager::update_session($user_id, $session_id, $test_session_data);
    if ($updated) {
        echo "<p>✅ Test session updated successfully</p>";
    } else {
        echo "<p>❌ Failed to update test session</p>";
    }
    
    // Clean up test session
    $deactivated = \WQB\Session_Manager::deactivate_session($user_id, $session_id);
    if ($deactivated) {
        echo "<p>✅ Test session deactivated</p>";
    } else {
        echo "<p>❌ Failed to deactivate test session</p>";
    }
} else {
    echo "<p>❌ Failed to create test session</p>";
}

echo "<h2>Test Complete</h2>";
echo "<p><a href='javascript:location.reload()'>Refresh to run tests again</a></p>";
echo "<p><a href='" . admin_url() . "'>Back to Admin</a></p>";
?> 