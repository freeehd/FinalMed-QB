<?php
namespace WQB;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Handles all frontend logic and shortcodes.
 */
class Frontend
{

    /**
     * Registers all the necessary WordPress hooks.
     */
    public function register()
    {
        add_shortcode('question_bank_interface', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);

        // Register all AJAX handlers for the frontend application
        add_action('wp_ajax_wqb_get_lobby_data', [$this, 'ajax_get_lobby_data']);
        add_action('wp_ajax_wqb_start_session', [$this, 'ajax_start_session']);
        add_action('wp_ajax_wqb_submit_answer', [$this, 'ajax_submit_answer']);
        add_action('wp_ajax_wqb_get_question', [$this, 'ajax_get_question']); // NEW: Get specific question
        add_action('wp_ajax_wqb_navigate_question', [$this, 'ajax_navigate_question']); // NEW: Navigate to question
        add_action('wp_ajax_wqb_finish_mock_test', [$this, 'ajax_finish_mock_test']);

        add_shortcode('wqb_dashboard', [$this, 'render_dashboard_shortcode']);
        add_action('wp_ajax_wqb_get_dashboard_data', [$this, 'ajax_get_dashboard_data']);

        // NEW: Review Incorrect Questions
        add_shortcode('wqb_review_incorrect', [$this, 'render_review_incorrect_shortcode']);
        add_action('wp_ajax_wqb_get_incorrect_questions', [$this, 'ajax_get_incorrect_questions']);
        add_action('wp_ajax_wqb_get_review_categories', [$this, 'ajax_get_review_categories']);

        // NEW: Practice Test Review
        add_shortcode('wqb_review_practice', [$this, 'render_review_practice_shortcode']);
        add_action('wp_ajax_wqb_get_practice_review_question', [$this, 'ajax_get_practice_review_question']);
        add_action('wp_ajax_wqb_get_question_analytics', [$this, 'ajax_get_question_analytics']);

        // NEW: Reset User Progress
        add_action('wp_ajax_wqb_reset_user_progress', [$this, 'ajax_reset_user_progress']);

        // NEW: Submit Feedback
        add_action('wp_ajax_wqb_submit_feedback', [$this, 'ajax_submit_feedback']);

        // NEW: Standalone User Heatmap Shortcode
        add_shortcode('wqb_user_heatmap', [$this, 'render_user_heatmap_shortcode']);

        // NEW: Staging Area Shortcode
        add_shortcode('wqb_staging_area', [$this, 'render_staging_area_shortcode']);
        add_action('wp_ajax_wqb_get_staging_data', [$this, 'ajax_get_staging_data']);

        // NEW: Session Management
        add_action('wp_ajax_wqb_check_active_session', [$this, 'ajax_check_active_session']);
        add_action('wp_ajax_wqb_resume_session', [$this, 'ajax_resume_session']);
        add_action('wp_ajax_wqb_close_session', [$this, 'ajax_close_session']);
        add_action('wp_ajax_wqb_start_new_session', [$this, 'ajax_start_new_session']);
    }
    /**
     * NEW: Central helper function to check for MemberPress access.
     */
    private function is_user_authorized()
    {
        if (!is_user_logged_in() || !class_exists('MeprUser')) {
            return false;
        }
        $mepr_user = new \MeprUser(get_current_user_id());
        return $mepr_user->is_active();
    }
    /**
     * NEW: Enhanced text formatting function for question content
     */
    private function format_question_text($text, $context = 'general')
    {
        if (empty($text)) {
            return '';
        }

        // First, handle any remaining literal escape sequences that might have been missed
        $text = str_replace(['\\n', '\\r\\n', '\\r'], "\n", $text);

        // Handle different contexts
        switch ($context) {
            case 'prompt':
                // Question prompts - preserve medical formatting, convert line breaks to <br>
                $text = $this->format_medical_text($text);
                break;

            case 'option':
                // Answer options - usually single line, but handle any line breaks
                $text = $this->format_option_text($text);
                break;

            case 'explanation':
                // Explanations - full paragraph formatting with medical content
                $text = $this->format_explanation_text($text);
                break;

            default:
                // General text formatting
                $text = wpautop($text);
                break;
        }

        // Final cleanup - preserve line breaks and paragraphs; just normalize excessive <br>
        $text = preg_replace('/\s*<br\s*\/?>\s*(<br\s*\/?>\s*)+/', '<br><br>', $text);
        $text = trim($text);

        return $text;
    }

    /**
     * NEW: Format medical/academic text content
     */
    private function format_medical_text($text)
    {
        // Convert line breaks to HTML breaks for medical content
        $text = nl2br($text);

        // Preserve medical measurements and units
        $text = preg_replace('/(\d+)\s*(mg|ml|cm|mm|kg|g|L|dL|mL|mcg|μg|°C|°F)/', '$1$2', $text);

        // Preserve percentages
        $text = preg_replace('/(\d+)\s*%/', '$1%', $text);

        // Handle option references (A, B, C, D, E)
        $text = preg_replace('/\bOption\s+([A-E])\b/', '<strong>Option $1</strong>', $text);

        return $text;
    }

    /**
     * NEW: Format answer option text
     */
    private function format_option_text($text)
    {
        // Options are usually single line, but handle any line breaks as spaces
        $text = str_replace(["\n", "\r"], ' ', $text);

        // Preserve medical formatting
        $text = preg_replace('/(\d+)\s*(mg|ml|cm|mm|kg|g|L|dL|mL|mcg|μg|°C|°F)/', '$1$2', $text);
        $text = preg_replace('/(\d+)\s*%/', '$1%', $text);

        return trim($text);
    }

    /**
     * NEW: Format explanation text with full paragraph support
     */
    private function format_explanation_text($text)
    {
        // Use wpautop for paragraph formatting
        $text = wpautop($text);

        // Enhance medical content formatting
        $text = preg_replace('/(\d+)\s*(mg|ml|cm|mm|kg|g|L|dL|mL|mcg|μg|°C|°F)/', '$1$2', $text);
        $text = preg_replace('/(\d+)\s*%/', '$1%', $text);

        // Format option references
        $text = preg_replace('/\bOption\s+([A-E])\b/', '<strong>Option $1</strong>', $text);

        // Handle bullet points and lists
        $text = preg_replace('/^\s*[•·*-]\s+/m', '• ', $text);
        $text = preg_replace('/^\s*(\d+)\.\s+/m', '$1. ', $text);

        // Handle medical abbreviations (make them stand out)
        $text = preg_replace('/\b([A-Z]{2,})\b/', '<abbr>$1</abbr>', $text);

        // Handle NICE, CKS, and other guideline references
        $text = preg_replace('/\b(NICE|CKS|WHO|FDA|BNF)\b/', '<strong>$1</strong>', $text);

        return $text;
    }

    /**
     * Renders the shortcode for the user dashboard.
     */
    public function render_dashboard_shortcode($atts)
    {
        // MODIFIED: Check if user is logged in, not if they are a premium member.
        if (!is_user_logged_in()) {
            $memberships_url = get_option('memberpress_product_list_url', home_url('/all-courses'));
            return sprintf(
                '<div class="wqb-access-denied">
                    <div class="wqb-access-denied-icon">🔒</div>
                    <h2>Login Required</h2>
                    <p>You must be logged in to view your dashboard.</p>
                    <a href="%s" class="wqb-button-primary">Login or Register</a>
                </div>',
                esc_url(wp_login_url(get_permalink()))
            );
        }
        return '<div id="wqb-dashboard-root"></div>';
    }

    /**
     * AJAX: Fetches all data needed for the analytics dashboard.
     */
    public function ajax_get_dashboard_data()
    {
        // MODIFIED: Check if user is logged in, not if they are a premium member.
        if (!is_user_logged_in() || !check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Authorization failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

         // NEW: Get user status and completion status
        $is_premium = $this->is_user_authorized();
        $all_questions_answered = $this->check_if_all_questions_answered($user_id, $is_premium);

        wp_send_json_success([
            'performance_stats' => $this->get_user_performance_stats($user_id),
            'heatmap_data'      => $this->get_user_activity_heatmap_data($user_id),
            'is_premium_user'   => $is_premium, // NEW
            'all_questions_answered' => $all_questions_answered, // NEW
        ]);
    }

    /**
     * Gets lifetime and per-specialty performance stats for a user.
     */
    private function get_user_performance_stats($user_id)
    {
        global $wpdb;

        // NEW: Determine if user is premium and create SQL clauses for filtering
        $tier_join_clause = '';
        $tier_where_clause = '';
        if (!$this->is_user_authorized()) {
            $tier_join_clause = "
                JOIN {$wpdb->term_relationships} AS tr_tier ON p.ID = tr_tier.object_id
                JOIN {$wpdb->term_taxonomy} AS tt_tier ON tr_tier.term_taxonomy_id = tt_tier.term_taxonomy_id
                JOIN {$wpdb->terms} AS t_tier ON tt_tier.term_id = t_tier.term_id
            ";
            $tier_where_clause = " AND tt_tier.taxonomy = 'access_tier' AND t_tier.slug = 'free' ";
        }

        $progress_table = $wpdb->prefix . 'wqb_user_progress';

        // Overall Stats (excluding reattempts)
        $overall_query = $wpdb->prepare(
            "SELECT 
                SUM(CASE WHEN prog.status = 'correct' THEN 1 ELSE 0 END) as correct, 
                COUNT(prog.id) as total 
             FROM {$progress_table} AS prog
             JOIN {$wpdb->posts} AS p ON prog.question_id = p.ID
             {$tier_join_clause}
             WHERE prog.user_id = %d AND prog.is_reattempt = 0 {$tier_where_clause}",
            $user_id
        );
        $overall = $wpdb->get_row($overall_query);
        $overall_percentage = ($overall && $overall->total > 0) ? round(($overall->correct / $overall->total) * 100) : 0;

        // Per-Specialty Stats (excluding reattempts)
        $specialty_query = $wpdb->prepare(
            "SELECT 
                t.term_id as term_id,
                t.name as specialty,
                SUM(CASE WHEN prog.status = 'correct' THEN 1 ELSE 0 END) as correct, 
                COUNT(prog.id) as total
            FROM {$progress_table} prog
            JOIN {$wpdb->posts} p ON prog.question_id = p.ID
            JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
            JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
            WHERE prog.user_id = %d AND tt.taxonomy = 'question_category' AND prog.is_reattempt = 0
            GROUP BY t.term_id, t.name",
            $user_id
        );
        $flat_specs = $wpdb->get_results($specialty_query);

        // Build category tree keyed by term_id
        $all_terms = get_terms([
            'taxonomy' => 'question_category',
            'hide_empty' => false,
        ]);

        $terms_map = [];
        foreach ($all_terms as $term) {
            $terms_map[$term->term_id] = [
                'id' => $term->term_id,
                'name' => $term->name,
                'parent' => $term->parent,
                'correct' => 0,
                'total' => 0,
                'children' => [],
                // sets to prevent double counting when aggregating
                '_q_total_ids' => [],
                '_q_correct_ids' => [],
            ];
        }

        // Populate per-term sets of questions the user answered (unique), and correct ones
        $term_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT tt.term_id, prog.question_id, prog.status
             FROM {$progress_table} prog
             JOIN {$wpdb->posts} p ON prog.question_id = p.ID
             JOIN {$wpdb->term_relationships} tr ON p.ID = tr.object_id
             JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
             {$tier_join_clause}
             WHERE prog.user_id = %d AND tt.taxonomy = 'question_category' AND prog.is_reattempt = 0 {$tier_where_clause}",
            $user_id
        ));

        foreach ($term_rows as $row) {
            $tid = (int) $row->term_id;
            $qid = (int) $row->question_id;
            if (!isset($terms_map[$tid])) {
                continue;
            }
            $terms_map[$tid]['_q_total_ids'][$qid] = true;
            if ($row->status === 'correct') {
                $terms_map[$tid]['_q_correct_ids'][$qid] = true;
            }
        }

        // Initialize leaf counts from sets
        foreach ($terms_map as $tid => &$nodeInit) {
            $nodeInit['total'] = count($nodeInit['_q_total_ids']);
            $nodeInit['correct'] = count($nodeInit['_q_correct_ids']);
        }
        unset($nodeInit);

        // Build tree
        foreach ($terms_map as &$node) {
            if ($node['parent'] && isset($terms_map[$node['parent']])) {
                $terms_map[$node['parent']]['children'][] = &$node;
            }
        }
        unset($node);

        // Aggregate using set union to avoid double counting when posts are assigned to both parent and child terms
        $aggregateFn = function (&$node, &$visited = []) use (&$aggregateFn) {
            if (isset($visited[$node['id']])) {
                // Cycle detected, stop recursion to prevent a crash.
                return;
            }
            $visited[$node['id']] = true;

            if (!empty($node['children'])) {
                foreach ($node['children'] as &$child) {
                    $aggregateFn($child, $visited);
                    foreach ($child['_q_total_ids'] as $qid => $_) {
                        $node['_q_total_ids'][$qid] = true;
                    }
                    foreach ($child['_q_correct_ids'] as $qid => $_) {
                        $node['_q_correct_ids'][$qid] = true;
                    }
                }
                unset($child);
            }
            $node['total'] = count($node['_q_total_ids']);
            $node['correct'] = count($node['_q_correct_ids']);
        };

        $spec_tree = [];
        foreach ($terms_map as $node) {
            if ($node['parent'] == 0) {
                // Aggregate before pushing
                $visited = []; // Reset for each top-level tree
                $aggregateFn($node, $visited);
                $spec_tree[] = $node;
            }
        }

        return [
            'overall_correct' => (int) $overall->correct,
            'overall_total' => (int) $overall->total,
            'overall_percentage' => $overall_percentage,
            'specialties' => $spec_tree
        ];
    }

    /**
     * Gets data for the 30-day activity heatmap.
     */
    private function get_user_activity_heatmap_data($user_id)
    {
        global $wpdb;
        $progress_table = $wpdb->prefix . 'wqb_user_progress';

        $six_months_ago = date('Y-m-d H:i:s', strtotime('-6 months', current_time('timestamp'))); // Changed to 6 months

        $query = $wpdb->prepare(
            "SELECT 
                DATE(last_updated) as date,
                COUNT(id) as total,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct,
                SUM(CASE WHEN status = 'incorrect' THEN 1 ELSE 0 END) as incorrect
            FROM {$progress_table} 
            WHERE user_id = %d AND last_updated >= %s
            GROUP BY DATE(last_updated)
            ORDER BY date ASC",
            $user_id,
            $six_months_ago // Use 6 months ago
        );

        $data = $wpdb->get_results($query);

        foreach ($data as $key => $row) {
            $data[$key]->total = (int) $row->total;
            $data[$key]->correct = (int) $row->correct;
            $data[$key]->incorrect = (int) $row->incorrect;
            $data[$key]->date = date('Y-m-d', strtotime($row->date));
        }

        return $data;
    }

    /**
     * NEW: AJAX: Fetches data for the staging area.
     */
    public function ajax_get_staging_data()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        $user = get_userdata($user_id);
        $username = $user ? $user->display_name : 'Student';

        // Check for active session
        $active_session = \WQB\Session_Manager::get_active_session($user_id);
        $session_info = null;

        if ($active_session) {
            $answered_count = count($active_session->user_answers);
            $total_questions = count($active_session->question_ids);
            $progress_percentage = $total_questions > 0 ? round(($answered_count / $total_questions) * 100) : 0;

            $session_info = [
                'session_id' => $active_session->session_id,
                'mode' => $active_session->session_mode,
                'current_index' => $active_session->current_index,
                'total_questions' => $total_questions,
                'answered_count' => $answered_count,
                'progress_percentage' => $progress_percentage,
                'created_at' => $active_session->created_at,
                'expires_at' => $active_session->expires_at
            ];
        }
    // NEW: Get user status and completion status
        $is_premium = $this->is_user_authorized();
        $all_questions_answered = $this->check_if_all_questions_answered($user_id, $is_premium);

        wp_send_json_success([
            'username' => $username,
            'performance_stats' => $this->get_user_performance_stats($user_id),
            'heatmap_data' => $this->get_user_activity_heatmap_data($user_id),
            'active_session' => $session_info,
            'is_premium_user' => $is_premium, // NEW
            'all_questions_answered' => $all_questions_answered, // NEW
        ]);
    }

    /**
     * Renders the main question bank interface shortcode.
     */
    public function render_shortcode($atts)
    {
        // Security: Check if user is logged in, not if they are a premium member.
        if (!is_user_logged_in()) {
            $memberships_url = get_option('memberpress_product_list_url', home_url('/all-courses'));
            return sprintf(
                '<div class="wqb-access-denied">
                    <div class="wqb-access-denied-icon">🔒</div>
                    <h2>Login Required</h2>
                    <p>You must be logged in to access the question bank.</p>
                    <a href="%s" class="wqb-button-primary">Login or Register</a>
                </div>',
                esc_url(wp_login_url(get_permalink())) // Link to login page
            );
        }

        // Check if we're in review mode
        if (isset($_GET['wqb_review']) && $_GET['wqb_review'] === '1') {
            return '<div id="wqb-review-practice-root"></div>';
        }

        return '<div id="wqb-app-root"></div>';
    }

    /**
     * NEW: Renders the root HTML element for the incorrect questions review page.
     */
    public function render_review_incorrect_shortcode($atts)
    {
        if (!is_user_logged_in()) {
            $redirect_url = home_url('/registration-2');
            return '
                <div class="wqb-access-denied">
                    <div class="wqb-error-icon">🔒</div>
                    <h3>Access Denied</h3>
                    <p>You must be logged in to review incorrect questions.</p>
                    <p>Redirecting to registration page...</p>
                    <script type="text/javascript">
                        setTimeout(function() {
                            window.location.href = "' . esc_url($redirect_url) . '";
                        }, 3000); // Redirect after 3 seconds
                    </script>
                </div>
            ';
        }
        return '<div id="wqb-review-incorrect-root"></div>';
    }

    /**
     * NEW: Renders the root HTML element for the practice test review page.
     */
    public function render_review_practice_shortcode($atts)
    {
        if (!is_user_logged_in()) {
            $redirect_url = home_url('/registration-2');
            return '
                <div class="wqb-access-denied">
                    <div class="wqb-error-icon">🔒</div>
                    <h3>Access Denied</h3>
                    <p>You must be logged in to review your practice test.</p>
                    <p>Redirecting to registration page...</p>
                    <script type="text/javascript">
                        setTimeout(function() {
                            window.location.href = "' . esc_url($redirect_url) . '";
                        }, 3000); // Redirect after 3 seconds
                    </script>
                </div>
            ';
        }
        return '<div id="wqb-review-practice-root"></div>';
    }

    /**
     * NEW: Renders a standalone user activity heatmap.
     */
    public function render_user_heatmap_shortcode($atts)
    {
        if (!is_user_logged_in()) {
            $redirect_url = home_url('/registration-2');
            return '
                <div class="wqb-access-denied">
                    <div class="wqb-error-icon">🔒</div>
                    <h3>Access Denied</h3>
                    <p>You must be logged in to view your activity heatmap.</p>
                    <p>Redirecting to registration page...</p>
                    <script type="text/javascript">
                        setTimeout(function() {
                            window.location.href = "' . esc_url($redirect_url) . '";
                        }, 3000); // Redirect after 3 seconds
                    </script>
                </div>
            ';
        }
        $user_id = get_current_user_id();
        $heatmap_data = $this->get_user_activity_heatmap_data($user_id);

        // Localize script with heatmap data
        wp_localize_script('wqb-standalone-heatmap-js', 'wqb_heatmap_data', [
            'data' => $heatmap_data,
            'nonce' => wp_create_nonce('wqb_frontend_nonce')
        ]);

        // Return the container for the heatmap
        return '<div id="wqb-user-heatmap-container" class="wqb-heatmap-container">
                    <h2>Your Activity</h2>
                    <p class="wqb-section-description">Your question-answering activity over the last 6 months</p>
                    <div id="wqb-standalone-cal-heatmap"></div>
                    <div class="wqb-heatmap-legend">
                        <span class="wqb-legend-label">Less</span>
                        <div class="wqb-legend-scale">
                            <div class="wqb-legend-box" style="background-color: #ebedf0;"></div>
                            <div class="wqb-legend-box" style="background-color: #c6e48b;"></div>
                            <div class="wqb-legend-box" style="background-color: #7bc96f;"></div>
                            <div class="wqb-legend-box" style="background-color: #239a3b;"></div>
                            <div class="wqb-legend-box" style="background-color: #196127;"></div>
                        </div>
                        <span class="wqb-legend-label">More</span>
                    </div>
                </div>';
    }



     /**
     * NEW: A dedicated helper function to reliably check if a user has answered all
     * questions available to them (free or premium).
     *
     * @param int $user_id The ID of the user to check.
     * @param bool $is_premium Whether the user has a premium subscription.
     * @return bool True if all available questions have been answered, false otherwise.
     */
    private function check_if_all_questions_answered($user_id, $is_premium) {
        global $wpdb;

        // First, get a clean list of all unique, PUBLISHED questions the user has attempted.
        $progress_table = $wpdb->prefix . 'wqb_user_progress';
        $user_progress_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT DISTINCT prog.question_id
             FROM {$progress_table} AS prog
             JOIN {$wpdb->posts} AS p ON prog.question_id = p.ID
             WHERE prog.user_id = %d
             AND prog.is_reattempt = 0
             AND p.post_status = 'publish'",
            $user_id
        ));
        $all_answered_qids_int = array_map('intval', wp_list_pluck($user_progress_raw, 'question_id'));

        // Now, get the list of questions available to this user.
        if ($is_premium) {
            // For premium users, compare against the total count of all published questions.
            $total_questions_in_bank = wp_count_posts('question')->publish;
            return (count($all_answered_qids_int) >= $total_questions_in_bank);
        } else {
            // For free users, we must do a direct set comparison.
            $tier_query_args = [
                'post_type' => 'question',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'post_status' => 'publish',
                'tax_query' => [['taxonomy' => 'access_tier', 'field' => 'slug', 'terms' => 'free']]
            ];
            $free_qids_from_db = get_posts($tier_query_args);

            // If there are no free questions, they can't have completed them.
            if (empty($free_qids_from_db)) {
                return false;
            }
            $all_free_qids_int = array_map('intval', $free_qids_from_db);

            // Find which free questions are NOT in the user's answered list.
            $unanswered_free_qids = array_diff($all_free_qids_int, $all_answered_qids_int);

            // If the list of unanswered free questions is empty, the user is done.
            return empty($unanswered_free_qids);
        }
    }




    /**
     * NEW: Renders the staging area shortcode.
     */
    public function render_staging_area_shortcode($atts)
    {
        // MODIFIED: Check if user is logged in, not if they are a premium member.
        if (!is_user_logged_in()) {
            $memberships_url = get_option('memberpress_product_list_url', home_url('/all-courses'));
            return sprintf(
                '<div class="wqb-access-denied">
                    <div class="wqb-access-denied-icon">🔒</div>
                    <h2>Login Required</h2>
                    <p>You must be logged in to access the question bank.</p>
                    <a href="%s" class="wqb-button-primary">Login or Register</a>
                </div>',
                esc_url(wp_login_url(get_permalink()))
            );
        }

        return '<div id="wqb-staging-area-root"></div>';
    }

    /**
     * Enqueues the necessary CSS and JavaScript files for the frontend.
     */
    public function enqueue_assets()
    {
        global $post;
        // Check if $post is an object and has post_content property
        if (is_a($post, 'WP_Post') && property_exists($post, 'post_content')) {
            // Enqueue for main question bank interface
            if (has_shortcode($post->post_content, 'question_bank_interface')) {
                $frontend_css = 'assets/css/frontend.min.css';
                if (!file_exists(WQB_PLUGIN_DIR . $frontend_css)) {
                    $frontend_css = 'assets/css/frontend.css';
                }
                wp_enqueue_style('wqb-frontend-css', WQB_PLUGIN_URL . $frontend_css, [], WQB_VERSION);

                // Check if we're in review mode
                if (isset($_GET['wqb_review']) && $_GET['wqb_review'] === '1') {
                    // Enqueue review practice assets
                    $review_practice_js = 'assets/js/review-practice' . WQB_ASSET_SUFFIX . '.js';
                    if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $review_practice_js)) {
                        $review_practice_js = 'assets/js/review-practice.js';
                    }
                    wp_enqueue_script('wqb-review-practice-js', WQB_PLUGIN_URL . $review_practice_js, ['jquery'], WQB_VERSION, true);
                    wp_localize_script('wqb-review-practice-js', 'wqb_data', [
                        'ajax_url' => admin_url('admin-ajax.php'),
                        'nonce' => wp_create_nonce('wqb_frontend_nonce')
                    ]);
                } else {
                    // Enqueue Cal-Heatmap and its dependencies for the lobby page
                    wp_enqueue_script('popper', 'https://unpkg.com/@popperjs/core@2', [], null, true);
                    wp_enqueue_script('dayjs', 'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js', [], null, true);
                    wp_enqueue_script('d3', 'https://d3js.org/d3.v7.min.js', [], null, true);
                    wp_enqueue_script('cal-heatmap', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.js', ['d3'], null, true);
                    wp_enqueue_style('cal-heatmap-css', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.css');
                    wp_enqueue_script('cal-heatmap-tooltip', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/plugins/Tooltip.min.js', ['cal-heatmap', 'popper', 'dayjs'], null, true);

                    // Enqueue heatmap utilities
                    $heatmap_utils_js = 'assets/js/heatmap-utils' . WQB_ASSET_SUFFIX . '.js';
                    if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $heatmap_utils_js)) {
                        $heatmap_utils_js = 'assets/js/heatmap-utils.js';
                    }
                    $frontend_js = 'assets/js/frontend' . WQB_ASSET_SUFFIX . '.js';
                    if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $frontend_js)) {
                        $frontend_js = 'assets/js/frontend.js';
                    }
                    wp_enqueue_script('wqb-heatmap-utils', WQB_PLUGIN_URL . $heatmap_utils_js, ['jquery', 'cal-heatmap-tooltip'], WQB_VERSION, true);

                    wp_enqueue_script('wqb-frontend-js', WQB_PLUGIN_URL . $frontend_js, ['jquery', 'cal-heatmap-tooltip', 'wqb-heatmap-utils'], WQB_VERSION, true);
                    wp_localize_script('wqb-frontend-js', 'wqb_data', [
                        'ajax_url' => admin_url('admin-ajax.php'),
                        'nonce' => wp_create_nonce('wqb_frontend_nonce')
                    ]);
                }
            }

            // Enqueue for dashboard
            if (has_shortcode($post->post_content, 'wqb_dashboard')) {
                $frontend_css = 'assets/css/frontend.min.css';
                if (!file_exists(WQB_PLUGIN_DIR . $frontend_css)) {
                    $frontend_css = 'assets/css/frontend.css';
                }
                wp_enqueue_style('wqb-frontend-css', WQB_PLUGIN_URL . $frontend_css, [], WQB_VERSION);

                wp_enqueue_script('popper', 'https://unpkg.com/@popperjs/core@2', [], null, true);
                wp_enqueue_script('dayjs', 'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js', [], null, true);
                wp_enqueue_script('d3', 'https://d3js.org/d3.v7.min.js', [], null, true);
                wp_enqueue_script('cal-heatmap', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.js', ['d3'], null, true);
                wp_enqueue_style('cal-heatmap-css', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.css');
                wp_enqueue_script('cal-heatmap-tooltip', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/plugins/Tooltip.min.js', ['cal-heatmap', 'popper', 'dayjs'], null, true);

                // Enqueue heatmap utilities
                $heatmap_utils_js = 'assets/js/heatmap-utils' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $heatmap_utils_js)) {
                    $heatmap_utils_js = 'assets/js/heatmap-utils.js';
                }
                $dashboard_js = 'assets/js/dashboard' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $dashboard_js)) {
                    $dashboard_js = 'assets/js/dashboard.js';
                }
                wp_enqueue_script('wqb-heatmap-utils', WQB_PLUGIN_URL . $heatmap_utils_js, ['jquery', 'cal-heatmap-tooltip'], WQB_VERSION, true);

                wp_enqueue_script('wqb-dashboard-js', WQB_PLUGIN_URL . $dashboard_js, ['jquery', 'cal-heatmap-tooltip', 'wqb-heatmap-utils'], WQB_VERSION, true);

                wp_localize_script('wqb-dashboard-js', 'wqb_data', [
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('wqb_frontend_nonce')
                ]);
            }

            // Enqueue assets for the incorrect questions review page
            if (has_shortcode($post->post_content, 'wqb_review_incorrect')) {
                $frontend_css = 'assets/css/frontend.min.css';
                if (!file_exists(WQB_PLUGIN_DIR . $frontend_css)) {
                    $frontend_css = 'assets/css/frontend.css';
                }
                $review_incorrect_js = 'assets/js/review-incorrect' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $review_incorrect_js)) {
                    $review_incorrect_js = 'assets/js/review-incorrect.js';
                }
                wp_enqueue_style('wqb-frontend-css', WQB_PLUGIN_URL . $frontend_css, [], WQB_VERSION);
                wp_enqueue_script('wqb-review-incorrect-js', WQB_PLUGIN_URL . $review_incorrect_js, ['jquery'], WQB_VERSION, true);
                wp_localize_script('wqb-review-incorrect-js', 'wqb_data', [
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('wqb_frontend_nonce')
                ]);
            }

            // NEW: Enqueue assets for the practice test review page
            if (has_shortcode($post->post_content, 'wqb_review_practice')) {
                $frontend_css = 'assets/css/frontend.min.css';
                if (!file_exists(WQB_PLUGIN_DIR . $frontend_css)) {
                    $frontend_css = 'assets/css/frontend.css';
                }
                $review_practice_js = 'assets/js/review-practice' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $review_practice_js)) {
                    $review_practice_js = 'assets/js/review-practice.js';
                }
                wp_enqueue_style('wqb-frontend-css', WQB_PLUGIN_URL . $frontend_css, [], WQB_VERSION);
                wp_enqueue_script('wqb-review-practice-js', WQB_PLUGIN_URL . $review_practice_js, ['jquery'], WQB_VERSION, true);
                wp_localize_script('wqb-review-practice-js', 'wqb_data', [
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('wqb_frontend_nonce')
                ]);
            }

            // NEW: Enqueue assets for the standalone heatmap
            if (has_shortcode($post->post_content, 'wqb_user_heatmap')) {
                $frontend_css = 'assets/css/frontend.min.css';
                if (!file_exists(WQB_PLUGIN_DIR . $frontend_css)) {
                    $frontend_css = 'assets/css/frontend.css';
                }
                wp_enqueue_style('wqb-frontend-css', WQB_PLUGIN_URL . $frontend_css, [], WQB_VERSION);
                wp_enqueue_script('popper', 'https://unpkg.com/@popperjs/core@2', [], null, true);
                wp_enqueue_script('dayjs', 'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js', [], null, true);
                wp_enqueue_script('d3', 'https://d3js.org/d3.v7.min.js', [], null, true);
                wp_enqueue_script('cal-heatmap', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.js', ['d3'], null, true);
                wp_enqueue_style('cal-heatmap-css', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.css');
                wp_enqueue_script('cal-heatmap-tooltip', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/plugins/Tooltip.min.js', ['cal-heatmap', 'popper', 'dayjs'], null, true);

                // Enqueue heatmap utilities
                $heatmap_utils_js = 'assets/js/heatmap-utils' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $heatmap_utils_js)) {
                    $heatmap_utils_js = 'assets/js/heatmap-utils.js';
                }
                $heatmap_standalone_js = 'assets/js/heatmap-standalone' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $heatmap_standalone_js)) {
                    $heatmap_standalone_js = 'assets/js/heatmap-standalone.js';
                }
                wp_enqueue_script('wqb-heatmap-utils', WQB_PLUGIN_URL . $heatmap_utils_js, ['jquery', 'cal-heatmap-tooltip'], WQB_VERSION, true);

                wp_enqueue_script('wqb-standalone-heatmap-js', WQB_PLUGIN_URL . $heatmap_standalone_js, ['jquery', 'cal-heatmap-tooltip', 'wqb-heatmap-utils'], WQB_VERSION, true);
                // Data is localized in render_user_heatmap_shortcode
            }

            // NEW: Enqueue assets for the staging area
            if (has_shortcode($post->post_content, 'wqb_staging_area')) {
                $frontend_css = 'assets/css/frontend.min.css';
                if (!file_exists(WQB_PLUGIN_DIR . $frontend_css)) {
                    $frontend_css = 'assets/css/frontend.css';
                }
                wp_enqueue_style('wqb-frontend-css', WQB_PLUGIN_URL . $frontend_css, [], WQB_VERSION);

                wp_enqueue_script('popper', 'https://unpkg.com/@popperjs/core@2', [], null, true);
                wp_enqueue_script('dayjs', 'https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js', [], null, true);
                wp_enqueue_script('d3', 'https://d3js.org/d3.v7.min.js', [], null, true);
                wp_enqueue_script('cal-heatmap', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.js', ['d3'], null, true);
                wp_enqueue_style('cal-heatmap-css', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/cal-heatmap.min.css');
                wp_enqueue_script('cal-heatmap-tooltip', 'https://cdn.jsdelivr.net/npm/cal-heatmap@4.2.2/dist/plugins/Tooltip.min.js', ['cal-heatmap', 'popper', 'dayjs'], null, true);

                // Enqueue heatmap utilities
                $heatmap_utils_js = 'assets/js/heatmap-utils' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $heatmap_utils_js)) {
                    $heatmap_utils_js = 'assets/js/heatmap-utils.js';
                }
                $staging_area_js = 'assets/js/staging-area' . WQB_ASSET_SUFFIX . '.js';
                if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $staging_area_js)) {
                    $staging_area_js = 'assets/js/staging-area.js';
                }
                wp_enqueue_script('wqb-heatmap-utils', WQB_PLUGIN_URL . $heatmap_utils_js, ['jquery', 'cal-heatmap-tooltip'], WQB_VERSION, true);

                wp_enqueue_script('wqb-staging-area-js', WQB_PLUGIN_URL . $staging_area_js, ['jquery', 'cal-heatmap-tooltip', 'wqb-heatmap-utils'], WQB_VERSION, true);
                wp_localize_script('wqb-staging-area-js', 'wqb_data', [
                    'ajax_url' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('wqb_frontend_nonce')
                ]);
            }
        }
    }

    /**
     * AJAX: Fetches the data needed to build the session setup lobby.
     */
    public function ajax_get_lobby_data()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }
        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'User not logged in.']);
        }

        $user_id = get_current_user_id();
        global $wpdb;

        // NEW: Determine if user is premium and set up query args for filtering
        $is_premium = $this->is_user_authorized();
        $tier_query_args = [];
        if (!$is_premium) {
            $tier_query_args = [
                'tax_query' => [
                    [
                        'taxonomy' => 'access_tier',
                        'field' => 'slug',
                        'terms' => 'free',
                    ],
                ],
            ];
        }

        // --- MODIFIED LOGIC: Get the correct set of categories ---
        if ($is_premium) {
            // Premium users see all categories.
            $all_categories = get_terms([
                'taxonomy' => 'question_category',
                'hide_empty' => false,
            ]);
        } else {
            // Free users only see categories (and their parents) that contain free questions.
            $free_question_ids = get_posts(array_merge(
                ['post_type' => 'question', 'posts_per_page' => -1, 'fields' => 'ids'],
                $tier_query_args
            ));

            if (empty($free_question_ids)) {
                $all_categories = [];
            } else {
                $term_ids = wp_get_object_terms($free_question_ids, 'question_category', ['fields' => 'ids']);
                $ancestor_ids = [];
                foreach ($term_ids as $term_id) {
                    $ancestors = get_ancestors($term_id, 'question_category', 'taxonomy');
                    if (!empty($ancestors)) {
                        $ancestor_ids = array_merge($ancestor_ids, $ancestors);
                    }
                }
                $all_relevant_ids = array_unique(array_merge($term_ids, $ancestor_ids));

                if (empty($all_relevant_ids)) {
                    $all_categories = [];
                } else {
                    $all_categories = get_terms([
                        'taxonomy' => 'question_category',
                        'include' => $all_relevant_ids,
                        'hide_empty' => false,
                    ]);
                }
            }
        }
        // --- END MODIFIED LOGIC ---
        $progress_table = $wpdb->prefix . 'wqb_user_progress';

         $user_progress_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT prog.question_id, prog.status FROM {$progress_table} AS prog JOIN {$wpdb->posts} AS p ON prog.question_id = p.ID WHERE prog.user_id = %d AND prog.is_reattempt = 0 AND p.post_status = 'publish'",
            $user_id
        ));


        $progress_by_question_id = [];
        foreach ($user_progress_raw as $progress) {
            $progress_by_question_id[$progress->question_id] = $progress->status;
        }
        $total_answered = count($progress_by_question_id);
        $total_correct = count(array_filter($progress_by_question_id, function ($status) {
            return $status === 'correct';
        }));

        $category_list = [];
        foreach ($all_categories as $category) {
            // Build a query that includes posts in this category and all its descendants
            $args = array_merge([
                'post_type' => 'question',
                'posts_per_page' => -1,
                'fields' => 'ids',
                'tax_query' => [
                    [
                        'taxonomy' => 'question_category',
                        'field' => 'term_id',
                        'terms' => [$category->term_id],
                        'include_children' => true,
                    ],
                ],
                'no_found_rows' => true,
                'update_post_meta_cache' => false,
                'update_post_term_cache' => false,
            ], $tier_query_args);
            $questions_in_cat = get_posts($args);

            // Count only non-reattempt answers for category progress
            $user_answered_in_cat = count(array_intersect($questions_in_cat, array_keys($progress_by_question_id)));

            $category_list[$category->term_id] = [
                'id' => $category->term_id,
                'name' => $category->name,
                'parent' => $category->parent,
                // Total questions including descendants (use query result to be exact)
                'total_questions' => count($questions_in_cat),
                'user_answered' => $user_answered_in_cat,
                'children' => []
            ];
        }

        $category_tree = [];
        foreach ($category_list as &$category) {
            if ($category['parent'] != 0 && isset($category_list[$category['parent']])) {
                $category_list[$category['parent']]['children'][] = &$category;
            }
        }
        unset($category);
        foreach ($category_list as $category) {
            if ($category['parent'] == 0) {
                $category_tree[] = $category;
            }
        }

        // Apply admin-defined ordering if present
        $order_map = get_option('wqb_category_order', []);
        $applyOrder = function (array &$nodes, $parentId) use (&$applyOrder, $order_map) {
            if (isset($order_map[(string) $parentId]) && is_array($order_map[(string) $parentId])) {
                $seq = array_values(array_map('intval', $order_map[(string) $parentId]));
                usort($nodes, function ($a, $b) use ($seq) {
                    $pa = array_search($a['id'], $seq, true);
                    $pb = array_search($b['id'], $seq, true);
                    $pa = $pa === false ? PHP_INT_MAX : $pa;
                    $pb = $pb === false ? PHP_INT_MAX : $pb;
                    if ($pa === $pb) {
                        return strcasecmp($a['name'], $b['name']);
                    }
                    return $pa - $pb;
                });
            } else {
                usort($nodes, function ($a, $b) {
                    return strcasecmp($a['name'], $b['name']);
                });
            }
            foreach ($nodes as &$n) {
                if (!empty($n['children'])) {
                    $applyOrder($n['children'], $n['id']);
                }
            }
            unset($n);
        };
        $applyOrder($category_tree, 0);

         if ($is_premium) {
            $total_questions_in_bank = wp_count_posts('question')->publish;
        } else {
            $free_query = new \WP_Query(array_merge(['post_type' => 'question', 'posts_per_page' => -1, 'fields' => 'ids'], $tier_query_args));
            $total_questions_in_bank = $free_query->post_count;
        }


        $average_score = $total_answered > 0 ? round(($total_correct / $total_answered) * 100, 1) : 0;

                $all_questions_answered = $this->check_if_all_questions_answered($user_id, $is_premium);


        // Check for all active sessions
        $active_sessions = \WQB\Session_Manager::get_all_active_sessions($user_id);
        $sessions_info = [];

        foreach ($active_sessions as $session) {
            $sessions_info[] = [
                'session_id' => $session->session_id,
                'mode' => $session->session_mode,
                'current_index' => $session->current_index,
                'total_questions' => $session->total_questions,
                'answered_count' => $session->answered_count,
                'progress_percentage' => $session->progress_percentage,
                'created_at' => $session->created_at,
                'expires_at' => $session->expires_at
            ];
        }

       wp_send_json_success([
            'category_tree' => $category_tree,
            'stats' => ['total_in_bank' => (int) $total_questions_in_bank, 'user_total_answered' => $total_answered, 'user_average_score' => $average_score],
            'heatmap_data' => $this->get_user_activity_heatmap_data($user_id),
            'active_sessions' => $sessions_info,
            'is_premium_user' => $is_premium,
            'all_questions_answered' => $all_questions_answered, // This key is now correctly included.
        ]);
    }

    /**
     * AJAX: Starts a new quiz session based on user selections.
     */
    public function ajax_start_session()
    {
        // MODIFIED: The authorization check is now more granular inside the function
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        if (!is_user_logged_in()) {
            wp_send_json_error(['message' => 'You must be logged in to start a session.']);
        }

        $categories = isset($_POST['categories']) ? array_map('intval', $_POST['categories']) : [];
        $status_filter = isset($_POST['status_filter']) ? sanitize_text_field($_POST['status_filter']) : 'all';
        $mode = isset($_POST['mode']) ? sanitize_text_field($_POST['mode']) : 'practice';
        $user_id = get_current_user_id();

        $settings = get_option('wqb_settings', []);
        $args = ['post_type' => 'question', 'posts_per_page' => -1, 'fields' => 'ids'];

        if ($mode === 'mock') {
            $args['posts_per_page'] = isset($settings['default_question_count']) ? intval($settings['default_question_count']) : 50;
            $args['orderby'] = 'rand';
        }

        // NEW: Check user authorization and modify the query for free users
        if (!$this->is_user_authorized()) {
            // This is a free user, so restrict them to the "Free" tier questions
            $args['tax_query'] = [
                'relation' => 'AND', // Ensures both conditions are met
                [
                    'taxonomy' => 'access_tier',
                    'field' => 'slug',
                    'terms' => 'free',
                ]
            ];
        }

        if (!empty($categories)) {
            // Add the category filter to the existing tax_query
            $args['tax_query'][] = ['taxonomy' => 'question_category', 'field' => 'term_id', 'terms' => $categories, 'include_children' => true];
        }

        $query = new \WP_Query($args);
        $question_ids = $query->posts;

        if ($status_filter !== 'all' && !empty($question_ids)) {
            global $wpdb;
            $progress_table = $wpdb->prefix . 'wqb_user_progress';
            $ids_placeholder = implode(',', array_fill(0, count($question_ids), '%d'));
            if ($status_filter === 'incorrect') {
                $filtered_ids = $wpdb->get_col($wpdb->prepare(
                    "SELECT DISTINCT p1.question_id 
                     FROM {$progress_table} p1
                     WHERE p1.user_id = %d 
                     AND p1.status = 'incorrect' 
                     AND p1.is_reattempt = 0 
                     AND p1.question_id IN ($ids_placeholder)
                     AND NOT EXISTS (
                         SELECT 1 FROM {$progress_table} p2 
                         WHERE p2.user_id = %d 
                         AND p2.question_id = p1.question_id 
                         AND p2.is_reattempt = 1 
                         AND p2.status = 'correct'
                     )",
                    array_merge([$user_id], $question_ids, [$user_id])
                ));
                $question_ids = array_intersect($question_ids, $filtered_ids);
            } elseif ($status_filter === 'unattempted') {
                $answered_qids = $wpdb->get_col($wpdb->prepare("SELECT question_id FROM {$progress_table} WHERE user_id = %d AND question_id IN ($ids_placeholder)", array_merge([$user_id], $question_ids)));
                $question_ids = array_diff($question_ids, $answered_qids);
            }
        }

        if (empty($question_ids)) {
            wp_send_json_error(['message' => 'No questions found matching your criteria.']);
        }
        if ($mode !== 'mock') {
            shuffle($question_ids);
        }

        $session_data = [
            'question_ids' => $question_ids,
            'current_index' => 0,
            'user_answers' => [],
            'question_states' => [],
            'mode' => $mode
        ];

        $session_id = \WQB\Session_Manager::create_session($user_id, $session_data);

        if (!$session_id) {
            wp_send_json_error(['message' => 'Failed to create session.']);
        }

        $first_question = $this->get_question_data($question_ids[0]);

        wp_send_json_success([
            'question' => $first_question,
            'total_questions' => count($question_ids),
            'current_index' => 0,
            'session_id' => $session_id,
            'session_data' => $session_data
        ]);
    }
    /**
     * AJAX: Processes a user's answer submission.
     */
    public function ajax_submit_answer()
    {
        // MODIFIED: Changed the check from is_user_authorized() to is_user_logged_in()
        if (!is_user_logged_in() || !check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Authorization failed.']);
        }

        $question_id = isset($_POST['question_id']) ? intval($_POST['question_id']) : 0;
        $user_answer_index = isset($_POST['answer_index']) ? intval($_POST['answer_index']) : -1;
        $session_id = isset($_POST['session_id']) ? sanitize_text_field($_POST['session_id']) : '';
        $user_id = get_current_user_id();

        if (!$question_id || $user_answer_index < 0 || $user_answer_index > 4 || empty($session_id)) {
            wp_send_json_error(['message' => 'Invalid data provided.']);
        }

        // NEW: Get session data from database
        $active_session = \WQB\Session_Manager::get_active_session($user_id);
        if (!$active_session || $active_session->session_id !== $session_id) {
            wp_send_json_error(['message' => 'Session not found or expired.']);
        }

        // Update session data
        $session_data = $active_session->session_data;
        $session_data['user_answers'][$question_id] = $user_answer_index;
        $correct_choice_index = get_post_meta($question_id, 'correct_choice_index', true);
        $is_correct = ($user_answer_index == $correct_choice_index);
        $status = $is_correct ? 'correct' : 'incorrect';
        $session_data['question_states'][$question_id] = $status;

        // Update session in database
        \WQB\Session_Manager::update_session($user_id, $session_id, $session_data);

        // Check if this is a reattempt (user has answered this question before)
        global $wpdb;
        $table_name = $wpdb->prefix . 'wqb_user_progress';
        $existing_record = $wpdb->get_row($wpdb->prepare(
            "SELECT id, status FROM {$table_name} WHERE user_id = %d AND question_id = %d AND is_reattempt = 0",
            $user_id,
            $question_id
        ));

        $is_reattempt = $existing_record !== null;

        // Update user progress
        $data = [
            'user_id' => $user_id,
            'question_id' => $question_id,
            'status' => $status,
            'user_answer_index' => $user_answer_index,
            'is_reattempt' => $is_reattempt ? 1 : 0
        ];

        if ($is_reattempt) {
            // For reattempts, create a new record with a unique ID to avoid constraint violation
            $inserted = $wpdb->insert($table_name, $data, ['%d', '%d', '%s', '%d', '%d']);
            if (false === $inserted) {
                error_log("WQB Error: Failed to insert reattempt progress. WPDB Error: " . $wpdb->last_error);
                wp_send_json_error(['message' => 'Failed to save reattempt progress: ' . $wpdb->last_error]);
            }
        } else {
            // For original attempts, use replace to handle potential duplicates
            $replaced = $wpdb->replace($table_name, $data, ['%d', '%d', '%s', '%d', '%d']);
            if (false === $replaced) {
                error_log("WQB Error: Failed to update user progress. WPDB Error: " . $wpdb->last_error);
                wp_send_json_error(['message' => 'Failed to save progress: ' . $wpdb->last_error]);
            }
        }

        $stats = get_post_meta($question_id, 'answer_distribution_stats', true);
        if (empty($stats) || !is_array($stats)) {
            $stats = array_fill(0, 5, 0);
        }
        $stats[$user_answer_index]++;
        update_post_meta($question_id, 'answer_distribution_stats', $stats);

        $explanation = get_post_meta($question_id, 'question_purpose', true);
        wp_send_json_success([
            'is_correct' => $is_correct,
            'correct_index' => intval($correct_choice_index),
            'explanation' => $this->format_question_text($explanation, 'explanation'), // ENHANCED: Use new formatting function
            'session_data' => $session_data
        ]);
    }

    /**
     * NEW: AJAX: Navigate to a specific question by index
     */
    public function ajax_navigate_question()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $target_index = isset($_POST['target_index']) ? intval($_POST['target_index']) : 0;
        $session_id = isset($_POST['session_id']) ? sanitize_text_field($_POST['session_id']) : '';
        $user_id = get_current_user_id();

        // NEW: Get session data from database
        $active_session = \WQB\Session_Manager::get_active_session($user_id);
        if (!$active_session || $active_session->session_id !== $session_id) {
            wp_send_json_error(['message' => 'Your session has expired.']);
        }

        if ($target_index < 0 || $target_index >= count($active_session->question_ids)) {
            wp_send_json_error(['message' => 'Invalid question index.']);
        }

        // Update session data
        $session_data = $active_session->session_data;
        $session_data['current_index'] = $target_index;
        \WQB\Session_Manager::update_session($user_id, $session_id, $session_data);

        $question_id = $active_session->question_ids[$target_index];
        $question = $this->get_question_data($question_id);

        // Check if this question was already attempted
        $user_answer = isset($active_session->user_answers[$question_id]) ? $active_session->user_answers[$question_id] : null;
        $is_attempted = $user_answer !== null;

        $response_data = [
            'question' => $question,
            'current_index' => $target_index,
            'is_attempted' => $is_attempted,
            'user_answer' => $user_answer,
            'session_data' => $session_data
        ];

        // If attempted, include the correct answer and explanation
        if ($is_attempted) {
            $correct_choice_index = get_post_meta($question_id, 'correct_choice_index', true);
            $explanation = get_post_meta($question_id, 'question_purpose', true);
            $response_data['correct_index'] = intval($correct_choice_index);
            $response_data['explanation'] = $this->format_question_text($explanation, 'explanation'); // ENHANCED: Use new formatting function
            $response_data['is_correct'] = ($user_answer == $correct_choice_index);
        }

        wp_send_json_success($response_data);
    }

    /**
     * AJAX: Grades a completed mock test and returns the results.
     */
    public function ajax_finish_mock_test()
    {
        // MODIFIED: Changed the check from is_user_authorized() to is_user_logged_in()
        if (!is_user_logged_in() || !check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Authorization failed.']);
        }


        $user_id = get_current_user_id();
        $session_id = isset($_POST['session_id']) ? sanitize_text_field($_POST['session_id']) : '';

        // NEW: Get session data from database
        $active_session = \WQB\Session_Manager::get_active_session($user_id);
        if (!$active_session || $active_session->session_id !== $session_id) {
            wp_send_json_error(['message' => 'Your session has expired or could not be found.']);
        }

        $results = ['total' => count($active_session->question_ids), 'correct' => 0, 'incorrect' => 0, 'unanswered' => 0, 'specialty_stats' => []];

        foreach ($active_session->question_ids as $question_id) {
            $correct_answer = get_post_meta($question_id, 'correct_choice_index', true);
            $user_answer = isset($active_session->user_answers[$question_id]) ? $active_session->user_answers[$question_id] : null;
            $terms = wp_get_post_terms($question_id, 'question_category', ['fields' => 'names']);

            foreach ($terms as $term) {
                if (!isset($results['specialty_stats'][$term])) {
                    $results['specialty_stats'][$term] = ['correct' => 0, 'total' => 0];
                }
                $results['specialty_stats'][$term]['total']++;
            }

            if ($user_answer !== null) {
                if (intval($user_answer) === intval($correct_answer)) {
                    $results['correct']++;
                    foreach ($terms as $term) {
                        $results['specialty_stats'][$term]['correct']++;
                    }
                } else {
                    $results['incorrect']++;
                }
            } else {
                $results['unanswered']++;
            }
        }

        // NEW: Deactivate session in database
        \WQB\Session_Manager::deactivate_session($user_id, $session_id);
        wp_send_json_success($results);
    }

    /**
     * NEW: AJAX: Fetches all incorrectly answered questions for the current user.
     */
    public function ajax_get_incorrect_questions()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        $categories = isset($_POST['categories']) ? array_map('intval', $_POST['categories']) : []; // NEW: Get selected categories

        global $wpdb;
        $progress_table = $wpdb->prefix . 'wqb_user_progress';
        $posts_table = $wpdb->posts;
        $term_relationships_table = $wpdb->term_relationships;
        $term_taxonomy_table = $wpdb->term_taxonomy;

        $query = "
            SELECT 
                prog.question_id, 
                prog.user_answer_index 
            FROM {$progress_table} prog
            JOIN {$posts_table} p ON prog.question_id = p.ID
            WHERE prog.user_id = %d 
            AND prog.status = 'incorrect'
            AND prog.is_reattempt = 0
            AND NOT EXISTS (
                SELECT 1 FROM {$progress_table} prog2 
                WHERE prog2.user_id = %d 
                AND prog2.question_id = prog.question_id 
                AND prog2.is_reattempt = 1 
                AND prog2.status = 'correct'
            )
        ";
        $params = [$user_id, $user_id];

        if (!empty($categories)) {
            $category_placeholders = implode(',', array_fill(0, count($categories), '%d'));
            $query .= "
                AND p.ID IN (
                    SELECT tr.object_id
                    FROM {$term_relationships_table} tr
                    JOIN {$term_taxonomy_table} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
                    WHERE tt.taxonomy = 'question_category' AND tt.term_id IN ({$category_placeholders})
                )
            ";
            $params = array_merge($params, $categories);
        }

        $query .= " ORDER BY prog.last_updated DESC";

        $incorrect_progress = $wpdb->get_results($wpdb->prepare($query, $params));

        $questions_data = [];
        foreach ($incorrect_progress as $progress) {
            $question_id = $progress->question_id;
            $user_answer_index = (int) $progress->user_answer_index; // Ensure integer type

            $question_post = get_post($question_id);
            if (!$question_post) {
                continue; // Skip if question post doesn't exist
            }

            $options = get_post_meta($question_id, 'question_options', true);
            $correct_choice_index = (int) get_post_meta($question_id, 'correct_choice_index', true); // Ensure integer type
            $explanation = get_post_meta($question_id, 'question_purpose', true);

            // ENHANCED: Format options and explanation properly
            $formatted_options = [];
            if (is_array($options)) {
                foreach ($options as $option) {
                    $formatted_options[] = $this->format_question_text($option, 'option');
                }
            }

            // Prefer post_content for full prompt; fallback to post_title
            $raw_prompt = !empty($question_post->post_content) ? $question_post->post_content : $question_post->post_title;
            $questions_data[] = [
                'id' => $question_id,
                'prompt' => $this->format_question_text($raw_prompt, 'prompt'), // ENHANCED: Format prompt
                'options' => $formatted_options, // ENHANCED: Format options
                'user_answer_index' => $user_answer_index,
                'correct_choice_index' => $correct_choice_index,
                'explanation' => $this->format_question_text($explanation, 'explanation'), // ENHANCED: Format explanation
            ];
        }

        if (empty($questions_data)) {
            wp_send_json_error(['message' => 'No incorrectly answered questions found matching your criteria.']);
        }

        wp_send_json_success(['questions' => $questions_data]);
    }

    /**
     * NEW: AJAX: Fetches the category tree for the review page.
     */
    public function ajax_get_review_categories()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $all_categories = get_terms([
            'taxonomy' => 'question_category',
            'hide_empty' => false,
        ]);

        $category_list = [];
        foreach ($all_categories as $category) {
            $category_list[$category->term_id] = [
                'id' => $category->term_id,
                'name' => $category->name,
                'parent' => $category->parent,
                'children' => []
            ];
        }

        $category_tree = [];
        foreach ($category_list as &$category) {
            if ($category['parent'] != 0 && isset($category_list[$category['parent']])) {
                $category_list[$category['parent']]['children'][] = &$category;
            }
        }
        // Important: break the reference to avoid side effects in subsequent foreach loops
        unset($category);
        foreach ($category_list as $category) {
            if ($category['parent'] == 0) {
                $category_tree[] = $category;
            }
        }

        // Apply admin-defined ordering if present (for review categories)
        $order_map = get_option('wqb_category_order', []);
        $applyOrder = function (array &$nodes, $parentId) use (&$applyOrder, $order_map) {
            if (isset($order_map[(string) $parentId]) && is_array($order_map[(string) $parentId])) {
                $seq = array_values(array_map('intval', $order_map[(string) $parentId]));
                usort($nodes, function ($a, $b) use ($seq) {
                    $pa = array_search($a['id'], $seq, true);
                    $pb = array_search($b['id'], $seq, true);
                    $pa = $pa === false ? PHP_INT_MAX : $pa;
                    $pb = $pb === false ? PHP_INT_MAX : $pb;
                    if ($pa === $pb) {
                        return strcasecmp($a['name'], $b['name']);
                    }
                    return $pa - $pb;
                });
            } else {
                usort($nodes, function ($a, $b) {
                    return strcasecmp($a['name'], $b['name']);
                });
            }
            foreach ($nodes as &$n) {
                if (!empty($n['children'])) {
                    $applyOrder($n['children'], $n['id']);
                }
            }
            unset($n);
        };
        $applyOrder($category_tree, 0);

        wp_send_json_success(['category_tree' => $category_tree]);
    }

    /**
     * NEW: AJAX: Resets all user progress data for the current user.
     */
    public function ajax_reset_user_progress()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        global $wpdb;
        $progress_table = $wpdb->prefix . 'wqb_user_progress';

        // Delete all progress records for the current user
        $deleted = $wpdb->delete(
            $progress_table,
            ['user_id' => $user_id],
            ['%d']
        );

        if ($deleted === false) {
            error_log("WQB Error: Failed to reset user progress for user ID {$user_id}. WPDB Error: " . $wpdb->last_error);
            wp_send_json_error(['message' => 'Database error: Could not reset progress.']);
        } else {
            wp_send_json_success(['message' => 'User progress reset successfully.']);
        }
    }

    /**
     * NEW: AJAX: Submits user feedback for a question.
     */
    public function ajax_submit_feedback()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        $question_id = isset($_POST['question_id']) ? intval($_POST['question_id']) : 0;
        $feedback_text = isset($_POST['feedback_text']) ? sanitize_textarea_field($_POST['feedback_text']) : '';

        if (empty($user_id) || empty($question_id) || empty($feedback_text)) {
            wp_send_json_error(['message' => 'Missing required feedback data.']);
        }

        global $wpdb;
        $feedback_table = $wpdb->prefix . 'wqb_feedback';

        $inserted = $wpdb->insert(
            $feedback_table,
            [
                'user_id' => $user_id,
                'question_id' => $question_id,
                'feedback_text' => $feedback_text,
                'submitted_at' => current_time('mysql'),
            ],
            ['%d', '%d', '%s', '%s']
        );

        if ($inserted === false) {
            error_log("WQB Error: Failed to insert feedback. WPDB Error: " . $wpdb->last_error);
            wp_send_json_error(['message' => 'Failed to save feedback: ' . $wpdb->last_error]);
        } else {
            wp_send_json_success(['message' => 'Feedback submitted successfully.']);
        }
    }

    /**
     * NEW: AJAX: Gets a specific question for practice test review.
     */
    public function ajax_get_practice_review_question()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }


        $question_id = isset($_POST['question_id']) ? intval($_POST['question_id']) : 0;
        if (!$question_id) {
            wp_send_json_error(['message' => 'Question ID is required.']);
        }

        // Get question data
        $question = $this->get_question_data($question_id);
        if (!$question) {
            wp_send_json_error(['message' => 'Question not found.']);
        }

        // Get user's answer for this question
        global $wpdb;
        $progress_table = $wpdb->prefix . 'wqb_user_progress';
        $user_progress = $wpdb->get_row($wpdb->prepare(
            "SELECT user_answer_index, status FROM {$progress_table} 
             WHERE user_id = %d AND question_id = %d 
             ORDER BY last_updated DESC LIMIT 1",
            $user_id,
            $question_id
        ));

        // Get answer distribution for this question
        $analytics = $wpdb->get_results($wpdb->prepare(
            "SELECT 
                user_answer_index,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct_count
             FROM {$progress_table} 
             WHERE question_id = %d AND user_answer_index IS NOT NULL
             GROUP BY user_answer_index
             ORDER BY user_answer_index",
            $question_id
        ));

        // Get total attempts
        $total_attempts = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT user_id) FROM {$progress_table} WHERE question_id = %d",
            $question_id
        ));

        // Format the answer distribution data - ensure all 5 options (A-E) are included
        $answer_distribution = [];
        // Initialize all 5 options with zero values
        for ($i = 0; $i < 5; $i++) {
            $answer_distribution[$i] = [
                'count' => 0,
                'correct_count' => 0,
                'percentage' => 0
            ];
        }
        // Fill in actual data
        foreach ($analytics as $row) {
            $answer_distribution[$row->user_answer_index] = [
                'count' => intval($row->count),
                'correct_count' => intval($row->correct_count),
                'percentage' => $total_attempts > 0 ? round(($row->count / $total_attempts) * 100, 1) : 0
            ];
        }

        $explanation = get_post_meta($question_id, 'question_purpose', true);

        $response_data = [
            'question' => $question,
            'user_answer_index' => $user_progress ? $user_progress->user_answer_index : null,
            'is_correct' => $user_progress ? ($user_progress->status === 'correct') : null,
            'correct_choice_index' => intval(get_post_meta($question_id, 'correct_choice_index', true)),
            'explanation' => $this->format_question_text($explanation, 'explanation'), // ENHANCED: Use new formatting function
            'answer_distribution' => $answer_distribution,
            'total_attempts' => intval($total_attempts)
        ];

        wp_send_json_success($response_data);
    }

    /**
     * NEW: AJAX: Gets question analytics data showing answer distribution.
     */
    public function ajax_get_question_analytics()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $question_id = isset($_POST['question_id']) ? intval($_POST['question_id']) : 0;
        if (!$question_id) {
            wp_send_json_error(['message' => 'Question ID is required.']);
        }

        global $wpdb;
        $progress_table = $wpdb->prefix . 'wqb_user_progress';

        // Get answer distribution for this question
        $analytics = $wpdb->get_results($wpdb->prepare(
            "SELECT 
                user_answer_index,
                COUNT(*) as count,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) as correct_count
             FROM {$progress_table} 
             WHERE question_id = %d AND user_answer_index IS NOT NULL
             GROUP BY user_answer_index
             ORDER BY user_answer_index",
            $question_id
        ));

        // Get total attempts
        $total_attempts = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT user_id) FROM {$progress_table} WHERE question_id = %d",
            $question_id
        ));

        // Format the data - ensure all 5 options (A-E) are included
        $answer_distribution = [];
        // Initialize all 5 options with zero values
        for ($i = 0; $i < 5; $i++) {
            $answer_distribution[$i] = [
                'count' => 0,
                'correct_count' => 0,
                'percentage' => 0
            ];
        }
        // Fill in actual data
        foreach ($analytics as $row) {
            $answer_distribution[$row->user_answer_index] = [
                'count' => intval($row->count),
                'correct_count' => intval($row->correct_count),
                'percentage' => $total_attempts > 0 ? round(($row->count / $total_attempts) * 100, 1) : 0
            ];
        }

        $response_data = [
            'total_attempts' => intval($total_attempts),
            'answer_distribution' => $answer_distribution
        ];

        wp_send_json_success($response_data);
    }

    /**
     * Helper function to retrieve all necessary data for a single question.
     * ENHANCED: Now includes proper text formatting
     */
    private function get_question_data($post_id)
    {
        $post = get_post($post_id);
        if (!$post) {
            return null;
        }

        $options = get_post_meta($post->ID, 'question_options', true);
        $formatted_options = [];

        if (is_array($options)) {
            foreach ($options as $option) {
                $formatted_options[] = $this->format_question_text($option, 'option');
            }
        }

        // Prefer full prompt stored in post_content (preserves line breaks); fallback to post_title
        $raw_prompt = !empty($post->post_content) ? $post->post_content : $post->post_title;
        return [
            'id' => $post->ID,
            'prompt' => $this->format_question_text($raw_prompt, 'prompt'), // ENHANCED: Format prompt
            'options' => $formatted_options // ENHANCED: Format options
        ];
    }

    /**
     * NEW: AJAX: Checks if user has an active session.
     */
    public function ajax_check_active_session()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        $active_session = \WQB\Session_Manager::get_active_session($user_id);

        if ($active_session) {
            wp_send_json_success([
                'has_active_session' => true,
                'session_data' => [
                    'session_id' => $active_session->session_id,
                    'mode' => $active_session->session_mode,
                    'current_index' => $active_session->current_index,
                    'total_questions' => count($active_session->question_ids),
                    'answered_count' => count($active_session->user_answers),
                    'created_at' => $active_session->created_at,
                    'expires_at' => $active_session->expires_at
                ]
            ]);
        } else {
            wp_send_json_success([
                'has_active_session' => false
            ]);
        }
    }

    /**
     * NEW: AJAX: Resumes an active session.
     */
    public function ajax_resume_session()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        // Check if a specific session_id was provided
        $session_id = isset($_POST['session_id']) ? sanitize_text_field($_POST['session_id']) : null;

        if ($session_id) {
            // Get the specific session
            $active_session = \WQB\Session_Manager::get_session_by_id($user_id, $session_id);
        } else {
            // Get the first active session (backward compatibility)
            $active_session = \WQB\Session_Manager::get_active_session($user_id);
        }

        if (!$active_session) {
            wp_send_json_error(['message' => 'No active session found.']);
        }

        $current_question_id = $active_session->question_ids[$active_session->current_index];
        $question = $this->get_question_data($current_question_id);

        // Check if question exists
        if (!$question) {
            wp_send_json_error(['message' => 'Question not found. Session may be corrupted.']);
        }

        // Check if current question was already attempted
        $user_answer = isset($active_session->user_answers[$current_question_id]) ? $active_session->user_answers[$current_question_id] : null;
        $is_attempted = $user_answer !== null;

        $response_data = [
            'question' => $question,
            'current_index' => $active_session->current_index,
            'total_questions' => count($active_session->question_ids),
            'is_attempted' => $is_attempted,
            'user_answer' => $user_answer,
            'session_id' => $active_session->session_id,
            'mode' => $active_session->session_mode,
            'session_data' => [
                'question_ids' => $active_session->question_ids,
                'current_index' => $active_session->current_index,
                'user_answers' => $active_session->user_answers,
                'question_states' => $active_session->question_states,
                'session_data' => $active_session->session_data,
                'mode' => $active_session->session_mode,
                'created_at' => $active_session->created_at,
                'expires_at' => $active_session->expires_at
            ]
        ];

        // If attempted, include the correct answer and explanation
        if ($is_attempted) {
            $correct_choice_index = get_post_meta($current_question_id, 'correct_choice_index', true);
            $explanation = get_post_meta($current_question_id, 'question_purpose', true);
            $response_data['correct_index'] = intval($correct_choice_index);
            $response_data['explanation'] = $this->format_question_text($explanation, 'explanation'); // ENHANCED: Use new formatting function
            $response_data['is_correct'] = ($user_answer == $correct_choice_index);
        }

        wp_send_json_success($response_data);
    }

    /**
     * NEW: AJAX: Closes an active session.
     */
    public function ajax_close_session()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        $session_id = isset($_POST['session_id']) ? sanitize_text_field($_POST['session_id']) : null;

        $deactivated = \WQB\Session_Manager::deactivate_session($user_id, $session_id);

        if ($deactivated) {
            wp_send_json_success(['message' => 'Session closed successfully.']);
        } else {
            wp_send_json_error(['message' => 'Failed to close session.']);
        }
    }

    /**
     * NEW: AJAX: Starts a new session (closes existing one first).
     */
    public function ajax_start_new_session()
    {
        if (!check_ajax_referer('wqb_frontend_nonce', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $user_id = get_current_user_id();
        if (empty($user_id)) {
            wp_send_json_error(['message' => 'User not found.']);
        }

        // Close any existing active sessions
        \WQB\Session_Manager::deactivate_all_user_sessions($user_id);

        // Start the new session using the existing logic
        $this->ajax_start_session();
    }
}
