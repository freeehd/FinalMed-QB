<?php
namespace WQB;

if ( ! defined( 'ABSPATH' ) ) { exit; }

// WP_List_Table is not loaded automatically, so we need to require it
if ( ! class_exists( 'WP_List_Table' ) ) {
    require_once( ABSPATH . 'wp-admin/includes/class-wp-list-table.php' );
}

class Feedback_List_Table extends \WP_List_Table {

    public function __construct() {
        parent::__construct([
            'singular' => 'Feedback',
            'plural'   => 'Feedback',
            'ajax'     => false
        ]);
    }

    /**
     * Get the table columns
     */
    public function get_columns() {
        return [
            'cb'            => '<input type="checkbox" />',
            'feedback_text' => 'Feedback',
            'user'          => 'Submitted By',
            'question'      => 'Question',
            'submitted_at'  => 'Date'
        ];
    }

    /**
     * Define which columns are sortable
     */
    public function get_sortable_columns() {
        return [
            'submitted_at' => ['submitted_at', false]
        ];
    }
  /**
     * NEW: Define the bulk actions
     */
    public function get_bulk_actions() {
        return [
            'delete' => 'Delete'
        ];
    }
       /**
     * NEW: Process the bulk delete action
     */
    public function process_bulk_action() {
        if ('delete' === $this->current_action()) {
            // Verify nonce
            $nonce = esc_attr($_REQUEST['_wpnonce']);
            if (!wp_verify_nonce($nonce, 'bulk-' . $this->_args['plural'])) {
                die('Go get a life script kiddies');
            }

            $ids = isset($_REQUEST['feedback_id']) ? array_map('intval', $_REQUEST['feedback_id']) : [];
            
            if (count($ids)) {
                global $wpdb;
                $table_feedback = $wpdb->prefix . 'wqb_feedback';
                $ids_placeholder = implode(',', array_fill(0, count($ids), '%d'));
                
                $wpdb->query($wpdb->prepare("DELETE FROM {$table_feedback} WHERE id IN ($ids_placeholder)", $ids));

                // Add an admin notice
                add_action('admin_notices', function() use ($ids) {
                    ?>
                    <div class="notice notice-success is-dismissible">
                        <p><?php echo count($ids); ?> feedback item(s) deleted.</p>
                    </div>
                    <?php
                });
            }
        }
    }

    /**
     * Prepare the items for the table to process
     */
    public function prepare_items() {
        global $wpdb;
        $table_feedback = $wpdb->prefix . 'wqb_feedback';
        $table_users = $wpdb->prefix . 'users';
        $table_posts = $wpdb->prefix . 'posts';

                $this->process_bulk_action();

                
        $per_page = 20;
        $columns = $this->get_columns();
        $hidden = [];
        $sortable = $this->get_sortable_columns();
        $this->_column_headers = [$columns, $hidden, $sortable];

        $paged = isset($_REQUEST['paged']) ? max(0, intval($_REQUEST['paged']) - 1) : 0;
        $orderby = (isset($_REQUEST['orderby']) && in_array($_REQUEST['orderby'], array_keys($this->get_sortable_columns()))) ? $_REQUEST['orderby'] : 'submitted_at';
        $order = (isset($_REQUEST['order']) && in_array(strtoupper($_REQUEST['order']), ['ASC', 'DESC'])) ? $_REQUEST['order'] : 'DESC';

        $offset = $paged * $per_page;

        $query = "SELECT f.*, u.display_name, p.post_title 
                  FROM {$table_feedback} f
                  LEFT JOIN {$table_users} u ON f.user_id = u.ID
                  LEFT JOIN {$table_posts} p ON f.question_id = p.ID
                  ORDER BY {$orderby} {$order}
                  LIMIT %d OFFSET %d";

        $this->items = $wpdb->get_results($wpdb->prepare($query, $per_page, $offset), ARRAY_A);
        
        $total_items = $wpdb->get_var("SELECT COUNT(id) FROM {$table_feedback}");
        
        $this->set_pagination_args([
            'total_items' => $total_items,
            'per_page'    => $per_page,
            'total_pages' => ceil($total_items / $per_page)
        ]);
    }

    /**
     * Default column rendering
     */
    public function column_default($item, $column_name) {
        return $item[$column_name];
    }

    /**
     * Renders the checkbox for bulk actions
     */
    public function column_cb($item) {
        return sprintf('<input type="checkbox" name="feedback_id[]" value="%s" />', $item['id']);
    }
    
    /**
     * Renders the Question column with a link to the edit screen
     */
    public function column_question($item) {
        $edit_link = get_edit_post_link($item['question_id']);
        return sprintf('<a href="%s">%s</a>', esc_url($edit_link), esc_html($item['post_title']));
    }
    
    /**
     * Renders the user's display name
     */
    public function column_user($item) {
        return esc_html($item['display_name']);
    }
}