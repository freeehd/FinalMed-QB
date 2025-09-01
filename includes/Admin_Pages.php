<?php
namespace WQB;

/**
 * Manages the creation of admin pages for the plugin.
 */
class Admin_Pages {

    const CHUNK_SIZE = 50; // Process 50 rows per AJAX request

    public function register() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_importer_assets']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_category_order_assets']);

        // AJAX handlers
        add_action('wp_ajax_wqb_handle_upload', [$this, 'ajax_handle_upload']);
        add_action('wp_ajax_wqb_process_chunk', [$this, 'ajax_process_chunk']);
        add_action('wp_ajax_wqb_cleanup_import', [$this, 'ajax_cleanup_import']);

        // Manage Data form handler
        add_action('admin_post_wqb_manage_data', [$this, 'handle_manage_data']);

        // Category Order form handler
        add_action('admin_post_wqb_save_category_order', [$this, 'handle_save_category_order']);
    }

    public function enqueue_importer_assets($hook) {
        // Only load our script on the importer page
        if ($hook !== 'question-bank_page_wqb-bulk-importer') {
            return;
        }
		$importer_js = 'assets/js/importer' . WQB_ASSET_SUFFIX . '.js';
		if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $importer_js)) { $importer_js = 'assets/js/importer.js'; }
		wp_enqueue_script('wqb-importer-js', WQB_PLUGIN_URL . $importer_js, ['jquery'], WQB_VERSION, true);
    }

    public function enqueue_category_order_assets($hook) {
        if ($hook !== 'question-bank_page_wqb-category-order') {
            return;
        }
        wp_enqueue_script('jquery-ui-sortable');
		$category_order_js = 'assets/js/category-order' . WQB_ASSET_SUFFIX . '.js';
		if (WQB_ASSET_SUFFIX === '.min' && !file_exists(WQB_PLUGIN_DIR . $category_order_js)) { $category_order_js = 'assets/js/category-order.js'; }
		wp_enqueue_script('wqb-category-order-js', WQB_PLUGIN_URL . $category_order_js, ['jquery', 'jquery-ui-sortable'], WQB_VERSION, true);
		$category_order_css = 'assets/css/category-order.min.css';
		if (!file_exists(WQB_PLUGIN_DIR . $category_order_css)) { $category_order_css = 'assets/css/category-order.css'; }
		wp_enqueue_style('wqb-category-order-css', WQB_PLUGIN_URL . $category_order_css, [], WQB_VERSION);
    }

    /**
     * Adds the top-level menu and submenus.
     */
    public function add_admin_menu() {
        add_menu_page(
            'Question Bank',
            'Question Bank',
            'manage_options',
            'wqb-question-bank',
            [ $this, 'render_settings_page' ],
            'dashicons-editor-help',
            25
        );

        add_submenu_page(
            'wqb-question-bank',
            'Settings',
            'Settings',
            'manage_options',
            'wqb-question-bank', // Make parent slug the same to use it as the main page
            [ $this, 'render_settings_page' ]
        );

        add_submenu_page(
            'wqb-question-bank',
            'User Feedback',
            'User Feedback',
            'manage_options',
            'wqb-user-feedback',
            [ $this, 'render_feedback_page' ]
        );

        add_submenu_page(
            'wqb-question-bank',
            'Bulk Import Questions',
            'Bulk Import',
            'manage_options',
            'wqb-bulk-importer',
            [ $this, 'render_importer_page' ]
        );

        add_submenu_page(
            'wqb-question-bank',
            'Manage Data',
            'Manage Data',
            'manage_options',
            'wqb-manage-data',
            [ $this, 'render_manage_data_page' ]
        );

        add_submenu_page(
            'wqb-question-bank',
            'Category Order',
            'Category Order',
            'manage_options',
            'wqb-category-order',
            [ $this, 'render_category_order_page' ]
        );
    }

    /**
     * Register the settings, sections, and fields for our settings page.
     */
    public function register_settings() {
        // Register the setting group
        register_setting(
            'wqb_settings_group', // Option group
            'wqb_settings',       // Option name
            [ $this, 'sanitize_settings' ] // Sanitize callback
        );

        // Add the settings section
        add_settings_section(
            'wqb_settings_section_main',    // ID
            'Default Test Settings',        // Title
            null,                           // Callback
            'wqb-question-bank'             // Page
        );

        // Add settings fields
        add_settings_field(
            'default_time_limit',           // ID
            'Default Time Limit (minutes)', // Title
            [ $this, 'render_time_limit_field' ], // Callback
            'wqb-question-bank',            // Page
            'wqb_settings_section_main'     // Section
        );

        add_settings_field(
            'default_question_count',
            'Default Question Count',
            [ $this, 'render_question_count_field' ],
            'wqb-question-bank',
            'wqb_settings_section_main'
        );

        add_settings_field(
            'feedback_email',
            'Feedback Notification Email',
            [ $this, 'render_email_field' ],
            'wqb-question-bank',
            'wqb_settings_section_main'
        );
    }
     /**
     * Renders the User Feedback list table page.
     */
    public function render_feedback_page() {
        if (!class_exists('WQB\Feedback_List_Table')) {
            require_once WQB_PLUGIN_DIR . 'includes/Feedback_List_Table.php';
        }
        $feedback_table = new \WQB\Feedback_List_Table();
        $feedback_table->prepare_items();
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline">User Feedback</h1>
            <form method="post">
                <?php
                $feedback_table->display();
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * Sanitize each setting field as needed.
     * @param array $input Contains all settings fields as array keys
     */
    public function sanitize_settings( $input ) {
        $new_input = [];
        if( isset( $input['default_time_limit'] ) ) {
            $new_input['default_time_limit'] = absint( $input['default_time_limit'] );
        }
        if( isset( $input['default_question_count'] ) ) {
            $new_input['default_question_count'] = absint( $input['default_question_count'] );
        }
        if( isset( $input['feedback_email'] ) ) {
            $new_input['feedback_email'] = sanitize_email( $input['feedback_email'] );
        }
        return $new_input;
    }

    /**
     * Render the input fields. These are the callback functions for add_settings_field.
     */
    public function render_time_limit_field() {
        $options = get_option( 'wqb_settings' );
        printf(
            '<input type="number" id="default_time_limit" name="wqb_settings[default_time_limit]" value="%s" />',
            isset( $options['default_time_limit'] ) ? esc_attr( $options['default_time_limit'] ) : ''
        );
    }

    public function render_question_count_field() {
        $options = get_option( 'wqb_settings' );
        printf(
            '<input type="number" id="default_question_count" name="wqb_settings[default_question_count]" value="%s" />',
            isset( $options['default_question_count'] ) ? esc_attr( $options['default_question_count'] ) : ''
        );
    }

    public function render_email_field() {
        $options = get_option( 'wqb_settings' );
        printf(
            '<input type="email" id="feedback_email" name="wqb_settings[feedback_email]" value="%s" class="regular-text" />',
            isset( $options['feedback_email'] ) ? esc_attr( $options['feedback_email'] ) : ''
        );
    }

    /**
     * Renders the HTML for the main settings page.
     */
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1>Question Bank Settings</h1>
            <form method="post" action="options.php">
                <?php
                // This prints out all hidden setting fields
                settings_fields( 'wqb_settings_group' );
                // This prints the sections and fields
                do_settings_sections( 'wqb-question-bank' );
                // This prints the submit button
                submit_button();
                echo '<a href="' . esc_url( admin_url('admin.php?page=wqb-manage-data') ) . '" class="button button-secondary" style="margin-left:8px;">Manage Plugin Data</a>';
                ?>
            </form>
        </div>
        <?php
    }


    /**
     * Renders the Manage Data admin page with deletion options.
     */
    public function render_manage_data_page() {
        if (!current_user_can('manage_options')) { return; }
        $deleted = isset($_GET['wqb_deleted']) ? sanitize_text_field($_GET['wqb_deleted']) : '';
        ?>
        <div class="wrap">
            <h1>Manage Question Bank Data</h1>
            <?php if ($deleted === '1'): ?>
                <div id="message" class="updated notice is-dismissible"><p>Selected data was deleted successfully.</p></div>
            <?php elseif ($deleted === '0'): ?>
                <div id="message" class="error notice is-dismissible"><p>No data was deleted or an error occurred.</p></div>
            <?php endif; ?>

            <div class="notice notice-warning" style="margin-top:15px;">
                <p><strong>Warning:</strong> These actions are irreversible. Consider taking a database backup before proceeding.</p>
            </div>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('wqb_manage_data', 'wqb_manage_data_nonce'); ?>
                <input type="hidden" name="action" value="wqb_manage_data" />

                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row">Questions</th>
                            <td>
                                <label><input type="checkbox" name="wqb_delete[questions]" value="1" /> Delete all Questions (custom post type <code>question</code>)</label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Question Categories</th>
                            <td>
                                <label><input type="checkbox" name="wqb_delete[categories]" value="1" /> Delete all Question Categories (taxonomy <code>question_category</code>)</label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">User Progress Data</th>
                            <td>
                                <label><input type="checkbox" name="wqb_delete[user_progress]" value="1" /> Delete all user progress (table <code>wqb_user_progress</code>)</label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Session Data</th>
                            <td>
                                <label><input type="checkbox" name="wqb_delete[sessions]" value="1" /> Delete all session data (table <code>wqb_user_sessions</code>)</label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">User Feedback</th>
                            <td>
                                <label><input type="checkbox" name="wqb_delete[feedback]" value="1" /> Delete all feedback (table <code>wqb_feedback</code>)</label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Plugin Settings & Transients</th>
                            <td>
                                <label><input type="checkbox" name="wqb_delete[settings]" value="1" /> Delete plugin settings/options and transients</label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Confirmation</th>
                            <td>
                                <label style="color:#b32d2e; font-weight:600;"><input type="checkbox" name="wqb_delete[confirm]" value="1" /> I understand this will permanently delete selected data.</label>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <?php submit_button('Delete Selected Data', 'delete'); ?>
            </form>
        </div>
        <?php
    }

    public function render_category_order_page() {
        if (!current_user_can('manage_options')) { return; }
        $order_map = get_option('wqb_category_order', []);

        $terms = get_terms([
            'taxonomy' => 'question_category',
            'hide_empty' => false,
        ]);
        $by_id = [];
        foreach ($terms as $t) {
            $by_id[$t->term_id] = [
                'id' => (int) $t->term_id,
                'name' => $t->name,
                'parent' => (int) $t->parent,
                'children' => [],
            ];
        }
        foreach ($by_id as $id => &$node) {
            if ($node['parent'] && isset($by_id[$node['parent']])) {
                $by_id[$node['parent']]['children'][] = &$node;
            }
        }
        unset($node);
        $roots = array_values(array_filter($by_id, function($n){ return $n['parent'] === 0; }));

        $applyOrder = function(array &$nodes, $parentId) use (&$applyOrder, $order_map) {
            if (isset($order_map[(string)$parentId]) && is_array($order_map[(string)$parentId])) {
                $seq = array_values(array_map('intval', $order_map[(string)$parentId]));
                usort($nodes, function($a, $b) use ($seq) {
                    $pa = array_search($a['id'], $seq, true);
                    $pb = array_search($b['id'], $seq, true);
                    $pa = $pa === false ? PHP_INT_MAX : $pa;
                    $pb = $pb === false ? PHP_INT_MAX : $pb;
                    if ($pa === $pb) { return strcasecmp($a['name'], $b['name']); }
                    return $pa - $pb;
                });
            } else {
                usort($nodes, function($a, $b){ return strcasecmp($a['name'], $b['name']); });
            }
            foreach ($nodes as &$n) {
                if (!empty($n['children'])) {
                    $applyOrder($n['children'], $n['id']);
                }
            }
            unset($n);
        };
        $applyOrder($roots, 0);

        $renderList = function(array $nodes) use (&$renderList) {
            echo '<ul class="wqb-sortable" id="wqb-category-root">';
            foreach ($nodes as $n) {
                echo '<li class="wqb-category-item" data-term-id="' . esc_attr($n['id']) . '">';
                echo '<div class="wqb-category-row"><span class="wqb-drag-handle">≡</span> ' . esc_html($n['name']) . '</div>';
                if (!empty($n['children'])) {
                    echo '<ul class="wqb-sortable">';
                    foreach ($n['children'] as $c) {
                        echo '<li class="wqb-category-item" data-term-id="' . esc_attr($c['id']) . '">';
                        echo '<div class="wqb-category-row"><span class="wqb-drag-handle">≡</span> ' . esc_html($c['name']) . '</div>';
                        if (!empty($c['children'])) {
                            echo '<ul class="wqb-sortable">';
                            foreach ($c['children'] as $gc) {
                                echo '<li class="wqb-category-item" data-term-id="' . esc_attr($gc['id']) . '">';
                                echo '<div class="wqb-category-row"><span class="wqb-drag-handle">≡</span> ' . esc_html($gc['name']) . '</div>';
                                echo '</li>';
                            }
                            echo '</ul>';
                        }
                        echo '</li>';
                    }
                    echo '</ul>';
                }
                echo '</li>';
            }
            echo '</ul>';
        };

        ?>
        <div class="wrap">
            <h1>Category Order</h1>
            <p>Drag and drop categories to set the display order in the Question Bank lobby. Reordering is supported within each level.</p>
            <form id="wqb-category-order-form" method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('wqb_save_category_order', 'wqb_category_order_nonce'); ?>
                <input type="hidden" name="action" value="wqb_save_category_order" />
                <input type="hidden" id="wqb-category-order-json" name="wqb_category_order_json" value="" />
                <div class="wqb-category-order-container">
                    <?php $renderList($roots); ?>
                </div>
                <?php submit_button('Save Order'); ?>
            </form>
        </div>
        <?php
    }

    public function handle_save_category_order() {
        if (!current_user_can('manage_options')) { wp_die('Unauthorized'); }
        if (!isset($_POST['wqb_category_order_nonce']) || !wp_verify_nonce($_POST['wqb_category_order_nonce'], 'wqb_save_category_order')) {
            wp_die('Security check failed');
        }

        $json = isset($_POST['wqb_category_order_json']) ? wp_unslash($_POST['wqb_category_order_json']) : '';
        $data = json_decode($json, true);
        $order_map = [];
        if (is_array($data)) {
            foreach ($data as $parent => $ids) {
                $parent_key = (string) intval($parent);
                $order_map[$parent_key] = array_values(array_filter(array_map('intval', (array)$ids), function($v){ return $v > 0; }));
            }
        }
        update_option('wqb_category_order', $order_map);

        $redirect_url = add_query_arg([
            'page' => 'wqb-category-order',
            'updated' => '1',
        ], admin_url('admin.php'));
        wp_safe_redirect($redirect_url);
        exit;
    }

    /**
     * Handles Manage Data form submission.
     */
    public function handle_manage_data() {
        if (!current_user_can('manage_options')) { wp_die('Unauthorized'); }
        if (!isset($_POST['wqb_manage_data_nonce']) || !wp_verify_nonce($_POST['wqb_manage_data_nonce'], 'wqb_manage_data')) {
            wp_die('Security check failed');
        }

        $choices = isset($_POST['wqb_delete']) && is_array($_POST['wqb_delete']) ? array_map('sanitize_text_field', wp_unslash($_POST['wqb_delete'])) : [];
        $did_anything = false;

        if (isset($choices['confirm'])) {
            // Questions
            if (!empty($choices['questions'])) { $did_anything = $this->delete_all_questions() || $did_anything; }
            // Categories
            if (!empty($choices['categories'])) { $did_anything = $this->delete_all_question_categories() || $did_anything; }
            // User progress table
            if (!empty($choices['user_progress'])) { $did_anything = $this->truncate_table('wqb_user_progress') || $did_anything; }
            // Sessions table
            if (!empty($choices['sessions'])) { $did_anything = $this->truncate_table('wqb_user_sessions') || $did_anything; }
            // Feedback table
            if (!empty($choices['feedback'])) { $did_anything = $this->truncate_table('wqb_feedback') || $did_anything; }
            // Settings & transients
            if (!empty($choices['settings'])) { $did_anything = $this->delete_settings_and_transients() || $did_anything; }
        }

        $redirect_url = add_query_arg([
            'page' => 'wqb-manage-data',
            'wqb_deleted' => $did_anything ? '1' : '0',
        ], admin_url('admin.php'));

        wp_safe_redirect($redirect_url);
        exit;
    }

    private function delete_all_questions() {
        $query = new \WP_Query([
            'post_type' => 'question',
            'posts_per_page' => -1,
            'fields' => 'ids',
            'post_status' => 'any',
            'no_found_rows' => true,
        ]);
        if (empty($query->posts)) { return false; }
        foreach ($query->posts as $post_id) {
            wp_delete_post($post_id, true);
        }
        return true;
    }

    private function delete_all_question_categories() {
        $terms = get_terms([
            'taxonomy' => 'question_category',
            'hide_empty' => false,
        ]);
        if (is_wp_error($terms) || empty($terms)) { return false; }

        // Delete children first by sorting by depth (parents later)
        usort($terms, function($a, $b) { return (int)$b->parent - (int)$a->parent; });
        foreach ($terms as $term) {
            wp_delete_term($term->term_id, 'question_category');
        }
        return true;
    }

    private function truncate_table($suffix) {
        global $wpdb;
        $table = $wpdb->prefix . $suffix;
        // Prefer TRUNCATE; fallback to DELETE if needed
        $result = $wpdb->query("TRUNCATE TABLE {$table}");
        if ($result === false) {
            $result = $wpdb->query("DELETE FROM {$table}");
        }
        return $result !== false;
    }

    private function delete_settings_and_transients() {
        // Options
        delete_option('wqb_settings');
        delete_option('wqb_db_version');

        // Known transients
        delete_transient('wqb_import_file_path');
        delete_transient('wqb_import_total_rows');
        delete_transient('wqb_flush_rewrite_rules');

        return true;
    }

    /**
     * Renders the HTML for the importer page.
     */
  public function render_importer_page() {
        ?>
        <style>
            #wqb-progress-container { width: 100%; background-color: #f3f3f3; border: 1px solid #ccc; margin-top: 20px; }
            #wqb-progress-bar { width: 0%; height: 30px; background-color: #4CAF50; text-align: center; line-height: 30px; color: white; }
            #wqb-status-log { height: 200px; overflow-y: scroll; background: #fafafa; border: 1px solid #ccc; padding: 10px; margin-top: 10px; }
            #wqb-status-log p { margin: 0; padding: 2px 0; border-bottom: 1px dotted #eee; }
            .log-error { color: #dc3232; }
            .log-success { color: #46b450; }
        </style>
        <div class="wrap">
            <h1>Bulk Import Questions (AJAX)</h1>
            <p>Upload a CSV file to import questions. The process will run in the background without timing out.</p>
            
            <div style="border: 1px solid #ccd0d4; padding: 15px; margin-bottom: 20px; background: #fff;">
                <h3>CSV Format Requirements</h3>
                <p>Your CSV file must have the following columns in this exact order:</p>
                <ul>
                    <li><strong>prompt</strong> - The question text</li>
                    <li><strong>categories</strong> - The main/parent category (e.g., "Cardiology")</li>
                    <li><strong>subcategories</strong> - The sub category (e.g., "Electrophysiology") - leave empty if no subcategory</li>
                    <li><strong>option_1</strong> through <strong>option_5</strong> - The answer choices</li>
                    <li><strong>correct_choice_index</strong> - Index of correct answer (0-4, where 0=option_1, 1=option_2, etc.)</li>
                    <li><strong>explanation</strong> - Explanation for the correct answer</li>
                </ul>
                <p><em>Note: The categories and subcategories will automatically create a hierarchical taxonomy structure.</em></p>
            </div>

            <form id="wqb-importer-form" method="post" enctype="multipart/form-data">
                <?php wp_nonce_field('wqb_csv_import', 'wqb_importer_nonce'); ?>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">Select CSV File</th>
                        <td><input type="file" id="wqb_csv_file" name="wqb_csv_file" accept=".csv" /></td>
                    </tr>
                </table>
                <?php submit_button('Import Questions'); ?>
            </form>

            <div id="wqb-progress-container" style="display: none;">
                <div id="wqb-progress-bar"><span id="wqb-progress-text">0%</span></div>
            </div>
            <div id="wqb-status-log" style="display: none;"></div>
        </div>
        <?php
    }

    /**
     * AJAX: Handles initial file upload and pre-processing.
     */
    public function ajax_handle_upload() {
        if (!check_ajax_referer('wqb_csv_import', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Permission denied.']);
        }
        if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
            wp_send_json_error(['message' => 'File upload error.']);
        }

        // Improvement: Validate CSV header
        $handle = fopen($_FILES['csv_file']['tmp_name'], 'r');
        $header = fgetcsv($handle);
        $expected_header = ['prompt', 'categories', 'subcategories', 'option_1', 'option_2', 'option_3', 'option_4', 'option_5', 'correct_choice_index', 'explanation'];

        if ($header !== $expected_header) {
            fclose($handle);
            wp_send_json_error(['message' => 'CSV format error. The header row does not match the expected format. Please check the column names and order.']);
        }

        // Now, count the remaining rows
        $total_rows = 0;
        while (fgetcsv($handle) !== false) {
            $total_rows++;
        }
        fclose($handle);

        $upload_dir = wp_upload_dir();
        $temp_path = $upload_dir['basedir'] . '/wqb-import.csv';
        if (!move_uploaded_file($_FILES['csv_file']['tmp_name'], $temp_path)) {
            wp_send_json_error(['message' => 'Failed to move uploaded file.']);
        }
        
        set_transient('wqb_import_file_path', $temp_path, DAY_IN_SECONDS);
        set_transient('wqb_import_total_rows', $total_rows, DAY_IN_SECONDS);

        wp_send_json_success(['total_rows' => $total_rows]);
    }

    /**
     * AJAX: Processes one chunk of the CSV file.
     */
        /**
     * AJAX: Processes one chunk of the CSV file.
     */
    public function ajax_process_chunk() {
        if (!check_ajax_referer('wqb_csv_import', 'nonce', false)) {
            wp_send_json_error(['message' => 'Security check failed.']);
        }

        $offset = isset($_POST['offset']) ? intval($_POST['offset']) : 0;
        $file_path = get_transient('wqb_import_file_path');
        if (!$file_path || !file_exists($file_path)) {
            wp_send_json_error(['message' => 'Import file not found. Please start over.']);
        }

        $handle = fopen($file_path, 'r');
        // Skip to the correct offset (+1 for header)
        for ($i = 0; $i <= $offset; $i++) {
            fgetcsv($handle);
        }

        $processed_count = 0;
        while ($processed_count < self::CHUNK_SIZE && ($data = fgetcsv($handle)) !== false) {
            // --- Start of Completed Logic ---

            // Prepare data from CSV columns
            // Preserve prompt formatting (line breaks) for storage in post_content
            $prompt = sanitize_textarea_field($data[0]);
            $category = sanitize_text_field($data[1]);
            $subcategory = sanitize_text_field($data[2]);
            $options = [
                sanitize_text_field($data[3]),
                sanitize_text_field($data[4]),
                sanitize_text_field($data[5]),
                sanitize_text_field($data[6]),
                sanitize_text_field($data[7]),
            ];
            $correct_choice = intval($data[8]);
            $explanation = sanitize_textarea_field($data[9]);

            // Create the post
            // Use a concise single-line title derived from the prompt for admin listing
            $single_line_prompt = preg_replace('/\s+/', ' ', $prompt);
            $short_prompt = function_exists('mb_substr') ? mb_substr($single_line_prompt, 0, 80) : substr($single_line_prompt, 0, 80);
            $derived_title = sanitize_text_field($short_prompt);
            $post_id = wp_insert_post([
                'post_title'   => $derived_title,
                'post_content' => $prompt, // Store full, formatted prompt here
                'post_type'    => 'question',
                'post_status'  => 'publish',
            ]);

            if ($post_id) {
                // Save meta data
                update_post_meta($post_id, 'question_options', $options);
                update_post_meta($post_id, 'correct_choice_index', $correct_choice);
                update_post_meta($post_id, 'question_purpose', $explanation);
                
                // Handle hierarchical category
                $cat_ids = $this->get_or_create_hierarchical_terms($category, $subcategory);
                if (!empty($cat_ids)) {
                    wp_set_post_terms($post_id, $cat_ids, 'question_category');
                }
            }
            
            // --- End of Completed Logic ---
            $processed_count++;
        }
        fclose($handle);
        
        $new_offset = $offset + $processed_count;
        $total_rows = get_transient('wqb_import_total_rows');
        $is_done = $new_offset >= $total_rows;

        wp_send_json_success([
            'processed_count' => $processed_count,
            'new_offset' => $new_offset,
            'is_done' => $is_done,
        ]);
    }

    /**
     * AJAX: Cleans up after the import is finished.
     */
    public function ajax_cleanup_import() {
        if (!check_ajax_referer('wqb_csv_import', 'nonce', false)) {
            return;
        }
        $file_path = get_transient('wqb_import_file_path');
        if ($file_path && file_exists($file_path)) {
            unlink($file_path);
        }
        delete_transient('wqb_import_file_path');
        delete_transient('wqb_import_total_rows');
        wp_send_json_success();
    }
    
    /**
     * Helper function to get or create hierarchical terms from separate category and subcategory columns.
     */
    private function get_or_create_hierarchical_terms($category, $subcategory) {
        $term_ids = [];
        $parent_id = 0;
        
        // Handle parent category
        if (!empty($category)) {
            $term = term_exists($category, 'question_category', 0);
            
            if ($term) {
                $parent_term_id = $term['term_id'];
            } else {
                $new_term = wp_insert_term($category, 'question_category', ['parent' => 0]);
                if (is_wp_error($new_term)) {
                    return []; // Failed to create term
                }
                $parent_term_id = $new_term['term_id'];
            }
            $term_ids[] = $parent_term_id;
            $parent_id = $parent_term_id;
        }
        
        // Handle subcategory
        if (!empty($subcategory)) {
            $term = term_exists($subcategory, 'question_category', $parent_id);
            
            if ($term) {
                $sub_term_id = $term['term_id'];
            } else {
                $new_term = wp_insert_term($subcategory, 'question_category', ['parent' => $parent_id]);
                if (is_wp_error($new_term)) {
                    return $term_ids; // Return parent term only if subcategory creation fails
                }
                $sub_term_id = $new_term['term_id'];
            }
            $term_ids[] = $sub_term_id;
        }
        
        return $term_ids;
    }
    
    /**
     * Legacy helper function to get or create hierarchical terms (kept for backward compatibility).
     */
    private function get_or_create_term( $category_str ) {
        $cat_parts = array_map('trim', explode('→', $category_str));
        $parent_id = 0;
        $term_ids = [];

        foreach ($cat_parts as $part) {
            $term = term_exists($part, 'question_category', $parent_id);

            if ($term) {
                $term_id = $term['term_id'];
            } else {
                $new_term = wp_insert_term($part, 'question_category', ['parent' => $parent_id]);
                if (is_wp_error($new_term)) {
                    return []; // Failed to create term
                }
                $term_id = $new_term['term_id'];
            }
            $parent_id = $term_id;
            $term_ids[] = $term_id;
        }

        return $term_ids;
    }
}