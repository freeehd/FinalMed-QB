<?php
/**
 * Plugin Name:       WordPress Question Bank
 * Plugin URI:        https://example.com/
 * Description:       A comprehensive plugin to create, manage, and deliver a large-scale question bank for registered users.
 * Version:           3.0.2
 * Author:            Final Med
 * Author URI:        https://example.com/
 * License:           GPL v2 or later
 * Text Domain:       wqb
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
    die;
}

// Require the Composer autoloader.
require_once plugin_dir_path( __FILE__ ) . 'vendor/autoload.php';

/**
 * Main Question Bank Plugin Class
 */
final class WQB_Question_Bank {

    /**
     * The single instance of the class.
     * @var WQB_Question_Bank
     */
    private static $instance = null;

    /**
     * Plugin version.
     * @var string
     */
    public $version = '1.0.0';

    /**
     * Ensures only one instance of the class can be created.
     * @return WQB_Question_Bank - Main instance.
     */
    public static function instance() {
        if ( is_null( self::$instance ) ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor for the main plugin class.
     */
    private function __construct() {
        $this->define_constants();
        $this->setup_hooks();
        $this->init_classes(); // This line is crucial
    }

    /**
     * Define Plugin Constants.
     */
    private function define_constants() {
define( 'WQB_VERSION', '1.0.0' );
define( 'WQB_DB_VERSION', '1.3' ); // <-- Updated for session management
define( 'WQB_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WQB_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'WQB_ASSET_SUFFIX', ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ) ? '' : '.min' );
    }

    /**
     * Setup the core hooks for the plugin.
     */
    private function setup_hooks() {
        register_activation_hook( __FILE__, [ $this, 'activate' ] );
        register_deactivation_hook( __FILE__, [ $this, 'deactivate' ] );
        
        // NEW: Hook to run on every page load to check for DB updates
        add_action( 'plugins_loaded', [ $this, 'check_db_version' ] );
                
        // NEW: Safely flush rewrite rules when needed.
        add_action('init', [$this, 'maybe_flush_rewrite_rules']);
    }
    
    /**
     * Instantiate plugin classes.
     */
    public function init_classes() {
        // We use the full namespace here.
          if ( class_exists( 'WQB\\Post_Types' ) ) {
            $post_types = new \WQB\Post_Types();
            $post_types->register();
        }

        if ( class_exists( 'WQB\\Meta_Boxes' ) ) {
            $meta_boxes = new \WQB\Meta_Boxes();
            $meta_boxes->register();
        }
          if ( class_exists( 'WQB\\Admin_Pages' ) ) {
            $admin_pages = new \WQB\Admin_Pages();
            $admin_pages->register();
        }
            if ( class_exists( 'WQB\\Frontend' ) ) {
            $frontend = new \WQB\Frontend();
            $frontend->register();
        }
    }

     /**
     * NEW: Check if the database needs to be updated.
     */
  public function check_db_version() {
        if (get_option('wqb_db_version') != WQB_DB_VERSION) {
            // If versions don't match, ONLY run the database update.
            if (class_exists('WQB\\Database')) {
                $database = new \WQB\Database();
                $database->create_tables();
            }
            // Set a flag to flush rewrite rules on the next 'init' action.
            set_transient('wqb_flush_rewrite_rules', true, 30);
        }
    }

        /**
     * NEW: Checks for our transient and flushes rules if it exists.
     * This is the safe way to flush rules without running it on every page load.
     */
    public function maybe_flush_rewrite_rules() {
        if (get_transient('wqb_flush_rewrite_rules')) {
            flush_rewrite_rules();
            delete_transient('wqb_flush_rewrite_rules');
        }
    }
      /**
     * Runs all activation logic.
     * Moved from activate() so it can be called on demand.
     */
    private function run_activation_logic() {
        if ( class_exists( 'WQB\\Database' ) ) {
            $database = new \WQB\Database();
            $database->create_tables();
        }
        if ( class_exists( 'WQB\\Post_Types' ) ) {
            $post_types = new \WQB\Post_Types();
            $post_types->register_cpt_question();
            $post_types->register_taxonomy_category();
        }
        flush_rewrite_rules();
    }
    
      public function activate() {
        $this->run_activation_logic();
    }

    public function deactivate() {
        flush_rewrite_rules();
    }
}

/**
 * Begins execution of the plugin.
 */
function wqb_run_question_bank() {
    return WQB_Question_Bank::instance();
}

// Let's get this party started!
wqb_run_question_bank();
function wqb_protect_rest_api( $args, $post_type ) {
    if ( 'question' === $post_type ) {
        // The permission_callback determines who can access the CPT via the REST API.
        // 'edit_posts' is a capability that only logged-in authors, editors, and admins have.
        // This will effectively block the public from seeing questions at /wp-json/wp/v2/questions
        $args['permission_callback'] = function () {
            return current_user_can( 'edit_posts' );
        };
    }
    return $args;
}
add_filter( 'register_post_type_args', 'wqb_protect_rest_api', 10, 2 );