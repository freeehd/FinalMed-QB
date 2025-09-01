<?php
namespace WQB;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Handles database operations for the plugin.
 */
class Database {

    public function create_tables() {
        $this->createUserProgressTable();
        $this->createFeedbackTable();
        $this->createUserSessionsTable(); // NEW: Add user sessions table
        $this->migrate_existing_data(); // NEW: Migrate existing data
        // NEW: Update the stored DB version to match our constant.
        update_option( 'wqb_db_version', WQB_DB_VERSION );
    }

    /**
     * Creates the custom user progress table.
     */
    private function createUserProgressTable() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_progress';
        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE {$table_name} (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) UNSIGNED NOT NULL,
            question_id bigint(20) UNSIGNED NOT NULL,
            status varchar(10) NOT NULL,
            user_answer_index INT DEFAULT -1, -- NEW: Column to store the user's selected answer index
            is_reattempt tinyint(1) NOT NULL DEFAULT 0, -- NEW: Track if this is a reattempt
            last_updated timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY user_question (user_id,question_id)
        ) $charset_collate;";
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        dbDelta( $sql );
    }
        
    /**
     * Creates the custom feedback table.
     */
    private function createFeedbackTable() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_feedback';
        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE {$table_name} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) UNSIGNED NOT NULL,
            question_id bigint(20) UNSIGNED NOT NULL,
            feedback_text text NOT NULL,
            submitted_at datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
            PRIMARY KEY  (id)
        ) $charset_collate;";
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        dbDelta( $sql );
    }

    /**
     * NEW: Creates the custom user sessions table.
     */
    private function createUserSessionsTable() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_sessions';
        $charset_collate = $wpdb->get_charset_collate();
        $sql = "CREATE TABLE {$table_name} (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            user_id bigint(20) UNSIGNED NOT NULL,
            session_id varchar(32) NOT NULL,
            session_mode varchar(10) NOT NULL DEFAULT 'practice',
            question_ids longtext NOT NULL,
            current_index int(11) NOT NULL DEFAULT 0,
            user_answers longtext,
            question_states longtext,
            session_data longtext,
            created_at datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
            updated_at datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
            expires_at datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
            is_active tinyint(1) NOT NULL DEFAULT 1,
            PRIMARY KEY  (id),
            UNIQUE KEY user_session (user_id,session_id),
            KEY user_id (user_id),
            KEY session_id (session_id),
            KEY is_active (is_active),
            KEY expires_at (expires_at)
        ) $charset_collate;";
        require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
        dbDelta( $sql );
    }

    /**
     * NEW: Migrate existing data to add is_reattempt column and remove unique constraint
     */
    private function migrate_existing_data() {
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_progress';
        
        // Check if is_reattempt column exists
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM {$table_name} LIKE 'is_reattempt'");
        
        if (empty($column_exists)) {
            // Add the is_reattempt column
            $wpdb->query("ALTER TABLE {$table_name} ADD COLUMN is_reattempt tinyint(1) NOT NULL DEFAULT 0");
            
            // Update existing records to mark them as non-reattempts (original attempts)
            $wpdb->query("UPDATE {$table_name} SET is_reattempt = 0 WHERE is_reattempt IS NULL");
        }
        
        // Check if unique constraint exists and remove it to allow multiple records per user-question
        $constraints = $wpdb->get_results("SHOW INDEX FROM {$table_name} WHERE Key_name = 'user_question'");
        if (!empty($constraints)) {
            // Remove the unique constraint to allow multiple records for reattempts
            $wpdb->query("ALTER TABLE {$table_name} DROP INDEX user_question");
        }
    }
}
