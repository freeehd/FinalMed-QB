<?php
namespace WQB;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Handles session management for practice and mock tests.
 */
class Session_Manager {

    /**
     * Creates a new session for a user.
     */
    public static function create_session($user_id, $session_data) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        // Generate unique session ID
        $session_id = wp_generate_password(32, false);
        
        // Set expiration time (24 hours from now)
        $expires_at = date('Y-m-d H:i:s', strtotime('+24 hours'));
        
        $inserted = $wpdb->insert(
            $table_name,
            [
                'user_id' => $user_id,
                'session_id' => $session_id,
                'session_mode' => $session_data['mode'] ?? 'practice',
                'question_ids' => maybe_serialize($session_data['question_ids'] ?? []),
                'current_index' => $session_data['current_index'] ?? 0,
                'user_answers' => maybe_serialize($session_data['user_answers'] ?? []),
                'question_states' => maybe_serialize($session_data['question_states'] ?? []),
                'session_data' => maybe_serialize($session_data),
                'created_at' => current_time('mysql'),
                'updated_at' => current_time('mysql'),
                'expires_at' => $expires_at,
                'is_active' => 1
            ],
            ['%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%d']
        );
        
        if ($inserted === false) {
            error_log("WQB Error: Failed to create session for user ID {$user_id}. WPDB Error: " . $wpdb->last_error);
            return false;
        }
        
        return $session_id;
    }
    
    /**
     * Gets the active session for a user.
     */
    public static function get_active_session($user_id) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $session = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table_name} 
             WHERE user_id = %d 
             AND is_active = 1 
             AND expires_at > NOW() 
             ORDER BY updated_at DESC 
             LIMIT 1",
            $user_id
        ));
        
        if (!$session) {
            return false;
        }
        
        // Unserialize the data
        $session->question_ids = maybe_unserialize($session->question_ids);
        $session->user_answers = maybe_unserialize($session->user_answers);
        $session->question_states = maybe_unserialize($session->question_states);
        $session->session_data = maybe_unserialize($session->session_data);
        
        return $session;
    }

    /**
     * Gets a specific session by session_id for a user.
     */
    public static function get_session_by_id($user_id, $session_id) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $session = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$table_name} 
             WHERE user_id = %d 
             AND session_id = %s 
             AND is_active = 1 
             AND expires_at > NOW()",
            $user_id,
            $session_id
        ));
        
        if (!$session) {
            return false;
        }
        
        // Unserialize the data
        $session->question_ids = maybe_unserialize($session->question_ids);
        $session->user_answers = maybe_unserialize($session->user_answers);
        $session->question_states = maybe_unserialize($session->question_states);
        $session->session_data = maybe_unserialize($session->session_data);
        
        return $session;
    }
    
    /**
     * Updates an existing session.
     */
    public static function update_session($user_id, $session_id, $session_data) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $updated = $wpdb->update(
            $table_name,
            [
                'current_index' => $session_data['current_index'] ?? 0,
                'user_answers' => maybe_serialize($session_data['user_answers'] ?? []),
                'question_states' => maybe_serialize($session_data['question_states'] ?? []),
                'session_data' => maybe_serialize($session_data),
                'updated_at' => current_time('mysql')
            ],
            [
                'user_id' => $user_id,
                'session_id' => $session_id,
                'is_active' => 1
            ],
            ['%d', '%s', '%s', '%s', '%s'],
            ['%d', '%s', '%d']
        );
        
        if ($updated === false) {
            error_log("WQB Error: Failed to update session for user ID {$user_id}. WPDB Error: " . $wpdb->last_error);
            return false;
        }
        
        return true;
    }
    
    /**
     * Deactivates a session (marks as inactive).
     */
    public static function deactivate_session($user_id, $session_id = null) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $where = ['user_id' => $user_id, 'is_active' => 1];
        $where_format = ['%d', '%d'];
        
        if ($session_id) {
            $where['session_id'] = $session_id;
            $where_format[] = '%s';
        }
        
        $updated = $wpdb->update(
            $table_name,
            ['is_active' => 0],
            $where,
            ['%d'],
            $where_format
        );
        
        if ($updated === false) {
            error_log("WQB Error: Failed to deactivate session for user ID {$user_id}. WPDB Error: " . $wpdb->last_error);
            return false;
        }
        
        return true;
    }
    
    /**
     * Deactivates all sessions for a user.
     */
    public static function deactivate_all_user_sessions($user_id) {
        return self::deactivate_session($user_id);
    }
    
    /**
     * Cleans up expired sessions (called periodically).
     */
    public static function cleanup_expired_sessions() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        // Deactivate sessions that have expired
        $deactivated = $wpdb->update(
            $table_name,
            ['is_active' => 0],
            [
                'is_active' => 1,
                'expires_at < NOW()'
            ],
            ['%d'],
            ['%d', '%s']
        );
        
        // Delete old inactive sessions (older than 7 days)
        $deleted = $wpdb->query(
            "DELETE FROM {$table_name} 
             WHERE is_active = 0 
             AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        
        return [
            'deactivated' => $deactivated,
            'deleted' => $deleted
        ];
    }

    /**
     * Gets detailed session information for a user.
     */
    public static function get_user_sessions($user_id, $limit = 10) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $sessions = $wpdb->get_results($wpdb->prepare(
            "SELECT 
                session_id,
                session_mode,
                current_index,
                question_ids,
                user_answers,
                created_at,
                updated_at,
                expires_at,
                is_active
             FROM {$table_name} 
             WHERE user_id = %d 
             ORDER BY created_at DESC 
             LIMIT %d",
            $user_id,
            $limit
        ));
        
        foreach ($sessions as $session) {
            $session->question_ids = maybe_unserialize($session->question_ids);
            $session->user_answers = maybe_unserialize($session->user_answers);
            $session->total_questions = count($session->question_ids);
            $session->answered_count = count($session->user_answers);
        }
        
        return $sessions;
    }

    /**
     * Gets all active sessions for a user.
     */
    public static function get_all_active_sessions($user_id) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $sessions = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM {$table_name} 
             WHERE user_id = %d 
             AND is_active = 1 
             AND expires_at > NOW() 
             ORDER BY created_at DESC",
            $user_id
        ));
        
        if (empty($sessions)) {
            return [];
        }
        
        // Unserialize the data for each session
        foreach ($sessions as $session) {
            $session->question_ids = maybe_unserialize($session->question_ids);
            $session->user_answers = maybe_unserialize($session->user_answers);
            $session->question_states = maybe_unserialize($session->question_states);
            $session->session_data = maybe_unserialize($session->session_data);
            
            // Calculate progress
            $session->total_questions = count($session->question_ids);
            $session->answered_count = count($session->user_answers);
            $session->progress_percentage = $session->total_questions > 0 ? 
                round(($session->answered_count / $session->total_questions) * 100) : 0;
        }
        
        return $sessions;
    }

    /**
     * Gets session statistics for a user.
     */
    public static function get_user_session_stats($user_id) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        
        $stats = $wpdb->get_row($wpdb->prepare(
            "SELECT 
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN session_mode = 'practice' THEN 1 END) as practice_sessions,
                COUNT(CASE WHEN session_mode = 'mock' THEN 1 END) as mock_sessions,
                COUNT(CASE WHEN is_active = 1 AND expires_at > NOW() THEN 1 END) as active_sessions
             FROM {$table_name} 
             WHERE user_id = %d",
            $user_id
        ));
        
        return $stats;
    }
} 