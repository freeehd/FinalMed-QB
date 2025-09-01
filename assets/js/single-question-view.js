/**
 * ===================================================================
 *  Single Question Test View
 * ===================================================================
 * This script powers the [wqb_test_question] shortcode. It loads
 * and renders a single question for admin testing purposes.
 */
jQuery(document).ready(($) => {
  const appRoot = $("#wqb-single-question-root");
  const ajaxUrl = window.wqb_single_question_data.ajax_url;
  const nonce = window.wqb_single_question_data.nonce;
  const questionData = window.wqb_single_question_data.question;
  const sessionId = window.wqb_single_question_data.session_id;

  // Minimal session data needed for rendering functions
  let sessionData = {};

  // --- Event Handlers ---
  appRoot.on("click", "#wqb-submit-answer", handleSubmitAnswer);
  appRoot.on("click", "#wqb-return-to-lobby", () => (window.location.href = "/staging-area")); // Or any other admin page

  // --- Core Logic ---
  function init() {
    if (!questionData || !sessionId) {
      appRoot.html('<div class="wqb-error">Could not load question data.</div>');
      return;
    }

    // Set up the minimal session data required by the render function
    sessionData = {
      current_index: 0,
      total: 1,
      mode: 'practice',
    };

    const viewData = {
      question: questionData,
      current: 1,
      total: 1,
    };

    renderPracticeView(viewData);
  }

  function handleSubmitAnswer() {
    const selectedOption = $('input[name="wqb_answer"]:checked');
    if (selectedOption.length === 0) {
      alert("Please select an answer.");
      return;
    }

    const answerIndex = selectedOption.val();
    const questionId = questionData.id;

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_submit_answer",
        nonce: nonce,
        question_id: questionId,
        answer_index: answerIndex,
        session_id: sessionId,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          revealAnswer(response.data, answerIndex);
        } else {
          alert(response.data.message);
        }
      },
    });
  }

  // --- Rendering Functions (Copied and adapted from main frontend.js) ---
  function renderPracticeView({ question, current, total }) {
    let questionHtml = `
      <div class="wqb-practice-view" data-question-id="${question.id}" style="padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <div class="wqb-practice-header">
              <div class="wqb-question-counter">Testing Question ${question.id}</div>
          </div>
          <div class="wqb-question-prompt">${question.prompt}</div>
          <div class="wqb-answer-options">`;

    question.options.forEach((option, index) => {
      questionHtml += `<label class="wqb-option">
                          <input type="radio" name="wqb_answer" value="${index}">
                          <span class="wqb-option-letter">${String.fromCharCode(65 + index)}</span>
                          <span class="wqb-option-text">${option}</span>
                       </label>`;
    });

    questionHtml += `</div>
           <div class="wqb-practice-footer">
              ${renderNavigationButtons(false)}
           </div>
        </div>`;
    appRoot.html(questionHtml);
  }

  function renderNavigationButtons(is_attempted) {
    if (is_attempted) {
        return '<div class="wqb-navigation-buttons"><button id="wqb-return-to-lobby" class="wqb-button-secondary">Return</button></div>';
    } else {
        return '<div class="wqb-navigation-buttons"><button id="wqb-submit-answer" class="wqb-button-primary">Submit Answer</button></div>';
    }
  }

  function revealAnswer(data, userSelectionIndex) {
    $(".wqb-option input").prop("disabled", true);
    $(`.wqb-option input[value="${data.correct_index}"]`).parent().addClass("correct-answer");

    if (!data.is_correct) {
      $(`.wqb-option input[value="${userSelectionIndex}"]`).parent().addClass("incorrect-answer");
    }

    const answerAnalysisHtml = `
      <div class="wqb-question-analytics">
          <h4>Answer Analysis</h4>
          <div class="wqb-analytics-item wqb-analytics-full">
              <span class="wqb-analytics-label">Explanation:</span>
              <div class="wqb-analytics-explanation">${data.explanation}</div>
          </div>
      </div>`;
    $(".wqb-practice-view").append(answerAnalysisHtml);
    $(".wqb-practice-footer").html(renderNavigationButtons(true));
  }

  // --- Run the application ---
  init();
});