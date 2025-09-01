<?php
namespace WQB;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Handles creating meta boxes and saving their data.
 */
class Meta_Boxes {

    /**
     * Registers the WordPress hooks.
     */
    public function register() {
        add_action( 'add_meta_boxes', [ $this, 'add_question_meta_box' ] );
        add_action( 'save_post', [ $this, 'save_meta_data' ] );
    }

    /**
     * Adds the meta box to the 'question' post type screen.
     */
    public function add_question_meta_box() {
        add_meta_box(
            'wqb_question_details',          // Unique ID
            'Question Details',              // Box title
            [ $this, 'render_meta_box' ],    // Content callback
            'question',                      // Post type
            'normal',                        // Context
            'high'                           // Priority
        );
    }

    /**
     * Renders the HTML for the meta box.
     *
     * @param \WP_Post $post The post object.
     */
    public function render_meta_box( $post ) {
        // Add a nonce field for security
        wp_nonce_field( 'wqb_save_question_details', 'wqb_nonce' );

        // Get existing meta data
        $options      = get_post_meta( $post->ID, 'question_options', true );
        $correct_choice = get_post_meta( $post->ID, 'correct_choice_index', true );
        $explanation  = get_post_meta( $post->ID, 'question_purpose', true );

        // Set defaults for new questions
        $options      = is_array( $options ) ? $options : array_fill( 0, 5, '' );
        $explanation  = $explanation ?: '';
        ?>
        <style>
            .wqb-meta-box-grid { display: grid; grid-template-columns: 50px 1fr; gap: 10px; align-items: center; margin-bottom: 15px; }
            .wqb-meta-box-grid label { font-weight: bold; }
            .wqb-meta-box-grid input[type="text"], .wqb-meta-box-grid textarea { width: 100%; }
            .wqb-options-header { margin-bottom: 10px; }
        </style>

        <h4>Answer Options & Correct Choice</h4>
        <p>Enter the 5 answer options below and select the radio button for the correct answer.</p>
        <div class="wqb-options-header">
            <strong>Correct?</strong>
        </div>
        <?php for ( $i = 0; $i < 5; $i++ ) : ?>
            <div class="wqb-meta-box-grid">
                <div>
                    <input type="radio" name="wqb_correct_choice" value="<?php echo $i; ?>" <?php checked( $correct_choice, $i ); ?>>
                </div>
                <div>
                    <input type="text" name="wqb_options[]" value="<?php echo esc_attr( $options[ $i ] ); ?>" placeholder="Option <?php echo $i + 1; ?>" required>
                </div>
            </div>
        <?php endfor; ?>

        <h4>Answer Explanation</h4>
        <p>Provide a detailed explanation for why the correct answer is correct.</p>
        <div class="wqb-meta-box-grid">
            <label for="wqb_explanation">Explanation</label>
            <textarea id="wqb_explanation" name="wqb_explanation" rows="5"><?php echo esc_textarea( $explanation ); ?></textarea>
        </div>
        <?php
    }

    /**
     * Saves the custom meta data when a post is saved.
     *
     * @param int $post_id The post ID.
     */
    public function save_meta_data( $post_id ) {
        // Verify nonce
        if ( ! isset( $_POST['wqb_nonce'] ) || ! wp_verify_nonce( $_POST['wqb_nonce'], 'wqb_save_question_details' ) ) {
            return;
        }

        // Check if it's an autosave
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
            return;
        }

        // Check the user's permissions
        if ( ! current_user_can( 'edit_post', $post_id ) ) {
            return;
        }

        // --- Save Answer Options ---
        if ( isset( $_POST['wqb_options'] ) && is_array( $_POST['wqb_options'] ) ) {
            $sanitized_options = array_map( 'sanitize_text_field', $_POST['wqb_options'] );
            update_post_meta( $post_id, 'question_options', $sanitized_options );
        }

        // --- Save Correct Choice ---
        if ( isset( $_POST['wqb_correct_choice'] ) ) {
            $correct_choice = intval( $_POST['wqb_correct_choice'] );
            update_post_meta( $post_id, 'correct_choice_index', $correct_choice );
        }

        // --- Save Explanation ---
        if ( isset( $_POST['wqb_explanation'] ) ) {
            $sanitized_explanation = sanitize_textarea_field( $_POST['wqb_explanation'] );
            update_post_meta( $post_id, 'question_purpose', $sanitized_explanation );
        }
    }
}