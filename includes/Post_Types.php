<?php
namespace WQB;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Handles the registration of Custom Post Types and Taxonomies.
 */
class Post_Types {
    
    /**
     * Registers the WordPress hooks.
     */
    public function register() {
        add_action( 'init', [ $this, 'register_cpt_question' ] );
        add_action( 'init', [ $this, 'register_taxonomy_category' ] );
    }

    /**
     * Registers the "Question" Custom Post Type.
     */
    public function register_cpt_question() {
        $labels = [
            'name'                  => _x( 'Questions', 'Post type general name', 'wqb' ),
            'singular_name'         => _x( 'Question', 'Post type singular name', 'wqb' ),
            'menu_name'             => _x( 'Questions', 'Admin Menu text', 'wqb' ),
            'name_admin_bar'        => _x( 'Question', 'Add New on Toolbar', 'wqb' ),
            'add_new'               => __( 'Add New', 'wqb' ),
            'add_new_item'          => __( 'Add New Question', 'wqb' ),
            'new_item'              => __( 'New Question', 'wqb' ),
            'edit_item'             => __( 'Edit Question', 'wqb' ),
            'view_item'             => __( 'View Question', 'wqb' ),
            'all_items'             => __( 'All Questions', 'wqb' ),
            'search_items'          => __( 'Search Questions', 'wqb' ),
            'parent_item_colon'     => __( 'Parent Questions:', 'wqb' ),
            'not_found'             => __( 'No questions found.', 'wqb' ),
            'not_found_in_trash'    => __( 'No questions found in Trash.', 'wqb' ),
        ];

        $args = [
            'labels'             => $labels,
            'public'             => false,  // Make it private by default
            'publicly_queryable' => false,  // Block all direct URL access
                        'exclude_from_search'=> true,   // Hide from WordPress's frontend search
                                    'has_archive'        => false,  // Disable the /questions/ archive page
                                    
            'show_ui'            => true,
            'show_in_menu'       => true,
            'query_var'          => true,
            'rewrite'            => [ 'slug' => 'questions' ],
            'capability_type'    => 'post',
            'has_archive'        => true,
            'hierarchical'       => false,
            'menu_position'      => 20, // Puts it below "Pages"
            'menu_icon'          => 'dashicons-editor-help',
            'supports'           => [ 'title', 'custom-fields' ],
            'show_in_rest'       => true, // Enable Block Editor support
        ];

        register_post_type( 'question', $args );
    }

    /**
     * Registers the "Category" taxonomy for the "Question" CPT.
     */
    public function register_taxonomy_category() {
        $labels = [
            'name'              => _x( 'Categories', 'taxonomy general name', 'wqb' ),
            'singular_name'     => _x( 'Category', 'taxonomy singular name', 'wqb' ),
            'search_items'      => __( 'Search Categories', 'wqb' ),
            'all_items'         => __( 'All Categories', 'wqb' ),
            'parent_item'       => __( 'Parent Category', 'wqb' ),
            'parent_item_colon' => __( 'Parent Category:', 'wqb' ),
            'edit_item'         => __( 'Edit Category', 'wqb' ),
            'update_item'       => __( 'Update Category', 'wqb' ),
            'add_new_item'      => __( 'Add New Category', 'wqb' ),
            'new_item_name'     => __( 'New Category Name', 'wqb' ),
            'menu_name'         => __( 'Categories', 'wqb' ),
        ];

        $args = [
            'hierarchical'      => true, // This makes it work like post categories (parent/child)
            'labels'            => $labels,
            'show_ui'           => true,
            'show_admin_column' => true,
            'query_var'         => true,
            'rewrite'           => [ 'slug' => 'question-category' ],
            'show_in_rest'      => true, // Enable Block Editor support
        ];

        // The second argument associates this taxonomy with our 'question' CPT.
        register_taxonomy( 'question_category', [ 'question' ], $args );
    }
}