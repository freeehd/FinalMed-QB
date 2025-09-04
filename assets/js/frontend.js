const jQuery = window.jQuery;

jQuery(document).ready(($) => {
  const appRoot = $("#wqb-app-root");
  const ajaxUrl = window.wqb_data.ajax_url; // Declare wqb_data variable
  const nonce = window.wqb_data.nonce; // Declare wqb_data variable
  let sessionData = {};
  let sessionId = null; // NEW: Store session ID
  let timerInterval = null;
  let remainingSeconds = 0;

  // --- Lightweight client-side formatting helpers ---
  function hasHtmlMarkup(text) {
    if (typeof text !== "string") return false;
    return /<\/?[a-z][\s\S]*>/i.test(text);
  }

  function formatPromptText(text) {
    // Return early for empty or nullish text
    if (!text) {
      return "";
    }

    // If the text already contains HTML, return it as is to avoid double-encoding
    // (Note: This is a simple check; a more robust one might be needed for complex cases)
    if (/<[a-z][\s\S]*>/i.test(text)) {
      return text;
    }

    let formattedText = String(text);

    // 1. Bold text: **text** or *text*
    // Using a callback to avoid conflicts between single and double asterisks
    formattedText = formattedText.replace(
      /\*{1,2}(.*?)\*{1,2}/g,
      (match, p1) => {
        if (match.startsWith("**")) {
          return `<strong>${p1}</strong>`; // **bold**
        }
        return `<em>${p1}</em>`; // *italic*
      }
    );

    // 2. Inline code: `code`
    formattedText = formattedText.replace(/`(.*?)`/g, "<code>$1</code>");

    // 3. Line breaks: \n to <br>
    // This should be done last to avoid interfering with other patterns
    formattedText = formattedText.replace(/\r\n|\r|\n/g, "<br>");

    return formattedText;
  }

  function formatOptionText(text) {
    if (!text) return "";
    if (hasHtmlMarkup(text)) return text;
    return String(text).replace(/\r\n|\r|\n/g, " ");
  }
  function formatExplanationHtml(rawText) {
    if (!rawText || rawText.trim() === "") {
      return "No explanation available.";
    }

    const lines = rawText.split("\n").filter((line) => line.trim() !== "");
    let htmlOutput = "";

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (index === 0) {
        // This part for the correct answer works fine.
        const formattedLine = trimmedLine.replace(
          /(Correct answer: [A-E]\))/,
          "<strong>$1</strong>"
        );
        htmlOutput += `<div class="explanation-block correct-answer"><span class="explanation-icon">✅</span><div class="explanation-text">${formattedLine}</div></div>`;
      } else {
        // --- CORRECTED LOGIC ---
        // The regex now uses single backslashes for \s and \)
        const match = trimmedLine.match(/^(?:<p>)?(?:❌\s*)?([A-E]\))(.+)/);
        let formattedLine;

        if (match) {
          const choiceLetter = match[1]; // e.g., "A)"
          const explanationText = match[2]; // The rest of the text
          formattedLine = `<strong>${choiceLetter}</strong>${explanationText}`;
        } else {
          // Fallback if the line doesn't match the expected format
          formattedLine = trimmedLine.replace(/^❌\s*/, "");
        }

        htmlOutput += `<div class="explanation-block incorrect-answer"><span class="explanation-icon">❌</span><div class="explanation-text">${formattedLine}</div></div>`;
      }
    });

    return htmlOutput;
  }

  // Define how many question buttons to show in the overview at most
  function getMaxVisibleQuestions() {
    const isSmallMobile = window.innerWidth <= 480;
    const isMobile = window.innerWidth > 480 && window.innerWidth <= 768;
    const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
    const isDesktop = window.innerWidth > 1024;

    if (isSmallMobile) {
      return 5; // sm
    } else if (isMobile) {
      return 5; // md
    } else if (isTablet) {
      return 10; // lg
    } else {
      return 10; // xl and above
    }
  }

  // --- Event Handlers ---
  appRoot.on("click", "#wqb-start-practice", () =>
    handleStartSession("practice")
  );
  appRoot.on("click", "#wqb-start-mock-test", () => handleStartSession("mock"));
  appRoot.on("click", "#wqb-submit-answer", handleSubmitAnswer);
  appRoot.on("click", "#wqb-next-question", () => navigateToQuestion("next"));
  appRoot.on("click", "#wqb-prev-question", () => navigateToQuestion("prev"));
  appRoot.on("click", "#wqb-skip-question", () => navigateToQuestion("next"));
  appRoot.on(
    "click",
    "#wqb-return-to-lobby",
    () => (window.location.href = "/staging-area")
  );
  appRoot.on("click", ".wqb-question-nav-btn", handleQuestionNavigation);
  appRoot.on("change", ".wqb-system-checkbox", function () {
    $(this)
      .closest(".wqb-system")
      .find('.wqb-specialties input[type="checkbox"]')
      .prop("checked", $(this).prop("checked"));
  });
  appRoot.on("change", ".wqb-specialty-checkbox", function () {
    if (!$(this).prop("checked")) {
      $(this)
        .closest(".wqb-system")
        .find(".wqb-system-checkbox")
        .prop("checked", false);
    }
  });

  appRoot.on("click", ".wqb-category-toggle", function (e) {
    e.preventDefault();
    const toggle = $(this);
    const children = toggle
      .closest(".wqb-category-row")
      .siblings(".wqb-category-children");

    toggle.toggleClass("open");
    if (toggle.hasClass("open")) {
      toggle.text("-");
    } else {
      toggle.text("+");
    }
    children.slideToggle(200);
  });

  appRoot.on("change", ".wqb-category-checkbox-parent", function () {
    $(this)
      .closest(".wqb-category-item")
      .find('.wqb-category-children input[type="checkbox"]')
      .prop("checked", $(this).prop("checked"));
    updateSelectedQuestionsCounter();
  });

  // NEW: Select all categories checkbox handler
  appRoot.on("change", "#wqb-select-all-categories", function () {
    const isChecked = $(this).prop("checked");
    $(
      '.wqb-category-tree input[type="checkbox"]:not(#wqb-select-all-categories)'
    ).prop("checked", isChecked);
    updateSelectedQuestionsCounter();
  });

  // NEW: Individual category checkbox handler (excluding select all and parent checkboxes)
  appRoot.on(
    "change",
    '.wqb-category-tree input[type="checkbox"]:not(#wqb-select-all-categories):not(.wqb-category-checkbox-parent)',
    () => {
      updateSelectedQuestionsCounter();
    }
  );

  // NEW: Function to update the selected questions counter
  function updateSelectedQuestionsCounter() {
    const checkedBoxes = $(
      '.wqb-category-tree input[type="checkbox"]:checked:not(#wqb-select-all-categories)'
    );
    const selectedCategoryIds = checkedBoxes
      .map(function () {
        return Number.parseInt($(this).val());
      })
      .get();

    // Calculate total unsolved questions from selected categories
    let totalUnsolvedQuestions = 0;
    if (window.wqbCategoryTree) {
      totalUnsolvedQuestions = calculateUnsolvedQuestions(
        window.wqbCategoryTree,
        selectedCategoryIds
      );
    }

    // Update the counter display
    const counterElement = $("#wqb-selected-questions-counter");
    if (counterElement.length) {
      counterElement.text(
        `${totalUnsolvedQuestions.toLocaleString()} unsolved questions selected`
      );
    }

    // Update select all checkbox state
    const allCheckboxes = $(
      '.wqb-category-tree input[type="checkbox"]:not(#wqb-select-all-categories)'
    );
    const selectAllCheckbox = $("#wqb-select-all-categories");
    if (selectAllCheckbox.length) {
      if (checkedBoxes.length === 0) {
        selectAllCheckbox.prop("indeterminate", false).prop("checked", false);
      } else if (checkedBoxes.length === allCheckboxes.length) {
        selectAllCheckbox.prop("indeterminate", false).prop("checked", true);
      } else {
        selectAllCheckbox.prop("indeterminate", true).prop("checked", false);
      }
    }
  }

  // NEW: Function to calculate unsolved questions recursively
  function calculateUnsolvedQuestions(categories, selectedIds) {
    let totalUnsolved = 0;
    const processedCategories = new Set(); // Track processed categories to avoid double counting

    function processCategory(category) {
      if (processedCategories.has(category.id)) {
        return; // Skip if already processed
      }

      if (selectedIds.includes(category.id)) {
        // Only count unsolved questions if this category has no children (is a leaf category)
        // or if it has children but we're not counting parent categories
        const hasChildren = category.children && category.children.length > 0;
        if (!hasChildren) {
          // This is a leaf category (no children), so count its unsolved questions
          const unsolvedInCategory =
            category.total_questions - category.user_answered;
          totalUnsolved += unsolvedInCategory;
        }
        processedCategories.add(category.id);
      }

      // Recursively check children
      if (category.children && category.children.length > 0) {
        category.children.forEach((child) => processCategory(child));
      }
    }

    categories.forEach((category) => processCategory(category));

    return totalUnsolved;
  }

  appRoot.on("click", "#wqb-finish-test-btn", finishMockTest);
  appRoot.on("click", "#wqb-finish-session-btn", renderSessionComplete);

  // NEW: Feedback accordion toggle
  appRoot.on("click", ".wqb-feedback-toggle", function () {
    $(this)
      .toggleClass("active")
      .next(".wqb-feedback-content")
      .slideToggle(200);
  });

  // NEW: Submit feedback button click
  appRoot.on("click", "#wqb-submit-feedback", handleSubmitFeedback);

  // NEW: Session management buttons
  appRoot.on("click", "#wqb-resume-session", (e) => {
    e.preventDefault();
    handleResumeSession();
  });
  appRoot.on("click", "#wqb-start-new-session", handleStartNewSession);

  // NEW: Session management buttons for lobby
  appRoot.on("click", "#wqb-resume-session-lobby", (e) => {
    e.preventDefault();
    handleResumeSession();
  });

  // NEW: Session management buttons for multiple sessions
  appRoot.on("click", ".wqb-resume-session-btn", function (e) {
    e.preventDefault();
    const sessionId = $(this).data("session-id");
    handleResumeSpecificSession(sessionId);
  });

  appRoot.on("click", ".wqb-close-session-btn", function (e) {
    e.preventDefault();
    const sessionId = $(this).data("session-id");
    handleCloseSpecificSession(sessionId);
  });

  // End & Review event handler
  appRoot.on("click", "#wqb-end-review", handleEndAndReview);

  // Responsive question overview - update on window resize
  let resizeTimeout;
  $(window).on("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Only update if we're in a practice or mock test view
      const currentView = appRoot.find(
        ".wqb-practice-view, .wqb-mock-test-view"
      );
      if (currentView.length && sessionData.question_ids) {
        updateQuestionOverview();
      }
    }, 250); // Debounce resize events
  });

  // --- Core Logic ---

  // NEW: Check for active session on page load
  function checkActiveSession() {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_check_active_session",
        nonce: nonce,
      },
      dataType: "json",
      success: (response) => {
        if (response.success && response.data.has_active_session) {
          showSessionResumeDialog(response.data.session_data);
        } else {
          renderLobby();
        }
      },
      error: (xhr, status, error) => {
        renderLobby();
      },
    });
  }

  // NEW: Show session resume dialog
  function showSessionResumeDialog(sessionData) {
    const dialogHtml = `

      <div
class="wqb-session-resume-dialog">
        <div class="wqb-dialog-content">
          <h3>Resume Your Session</h3>
          <p>You have an active ${
            sessionData.mode === "mock" ? "mock test" : "practice"
          } session with ${sessionData.answered_count} of ${
      sessionData.total_questions
    } questions completed.</p>
          <div class="wqb-dialog-actions">
            <button id="wqb-resume-session" class="wqb-button-primary">Resume Session</button>
            <button id="wqb-start-new-session" class="wqb-button-secondary">Start New Session</button>
          </div>
        </div>
      </div>
    `;
    appRoot.html(dialogHtml);
  }

  // NEW: Handle resume session
  function handleResumeSession() {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_resume_session",
        nonce: nonce,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          sessionData = response.data.session_data;
          sessionId = response.data.session_id;

          const viewData = {
            question: response.data.question,
            current: response.data.current_index + 1,
            total: response.data.total_questions,
            is_attempted: response.data.is_attempted,
            user_answer: response.data.user_answer,
          };

          if (response.data.mode === "mock") {
            renderMockTestView(viewData);
            // Note: Timer would need to be recalculated based on session start time
          } else {
            renderPracticeView(viewData);
          }

          // If question was already attempted, show the answer
          if (response.data.is_attempted) {
            revealAnswer(
              {
                is_correct: response.data.is_correct,
                correct_index: response.data.correct_index,
                explanation: response.data.explanation,
                answer_distribution: response.data.answer_distribution, // Pass distribution data
                total_attempts: response.data.total_attempts, // Pass total attempts
              },
              response.data.user_answer,
              true
            );
          }
        } else {
          alert(response.data.message);
          renderLobby();
        }
      },
      error: (xhr, status, error) => {
        alert("Failed to resume session. Please try again.");
        renderLobby();
      },
    });
  }

  // NEW: Handle resume specific session
  function handleResumeSpecificSession(specificSessionId) {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_resume_session",
        session_id: specificSessionId,
        nonce: nonce,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          sessionData = response.data.session_data;
          sessionId = response.data.session_id;

          const viewData = {
            question: response.data.question,
            current: response.data.current_index + 1,
            total: response.data.total_questions,
            is_attempted: response.data.is_attempted,
            user_answer: response.data.user_answer,
          };

          if (response.data.mode === "mock") {
            renderMockTestView(viewData);
          } else {
            renderPracticeView(viewData);
          }

          // If question was already attempted, show the answer
          if (response.data.is_attempted) {
            revealAnswer(
              {
                is_correct: response.data.is_correct,
                correct_index: response.data.correct_index,
                explanation: response.data.explanation,
                answer_distribution: response.data.answer_distribution, // Pass distribution data
                total_attempts: response.data.total_attempts, // Pass total attempts
              },
              response.data.user_answer,
              true
            );
          }
        } else {
          alert(response.data.message);
          renderLobby();
        }
      },
      error: (xhr, status, error) => {
        alert("Failed to resume session. Please try again.");
        renderLobby();
      },
    });
  }

  // NEW: Handle close specific session
  function handleCloseSpecificSession(specificSessionId) {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_close_session",
        session_id: specificSessionId,
        nonce: nonce,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          // Remove the session item from the DOM
          $(
            `.wqb-active-session-item[data-session-id="${specificSessionId}"]`
          ).fadeOut(300, function () {
            $(this).remove();
            // If no more sessions, hide the container
            if ($(".wqb-active-session-item").length === 0) {
              $(".wqb-active-sessions-container").fadeOut(300);
            }
          });
        } else {
          alert(response.data.message);
        }
      },
      error: (xhr, status, error) => {
        alert("Failed to close session. Please try again.");
      },
    });
  }

  // NEW: Handle start new session
  function handleStartNewSession() {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_start_new_session",
        nonce: nonce,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          // This will trigger the normal start session flow
          renderLobby();
        } else {
          alert("Failed to start new session: " + response.data.message);
          renderLobby();
        }
      },
    });
  }

  function handleStartSession(mode = "practice") {
    sessionData = {
      correct: 0,
      attempted: 0,
      mode: mode,
      defaults: sessionData.defaults,
    };

    const categories = $('input[name="wqb_categories[]"]:checked')
      .map(function () {
        return $(this).val();
      })
      .get();
    const statusFilter = $("#wqb-status-filter").val();

    appRoot.html('<div class="wqb-loader">Building your session...</div>');

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_start_session",
        nonce: nonce,
        categories: categories,
        status_filter: statusFilter,
        mode: mode,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          sessionData = {
            ...sessionData,
            question_ids: response.data.session_data.question_ids,
            current_index: response.data.current_index,
            user_answers: response.data.session_data.user_answers,
            question_states: response.data.session_data.question_states || {},
            total: response.data.total_questions,
          };
          sessionId = response.data.session_id; // NEW: Store session ID

          const viewData = {
            question: response.data.question,
            current: response.data.current_index + 1,
            total: response.data.total_questions,
          };

          if (mode === "mock") {
            renderMockTestView(viewData);
            startTimer(sessionData.defaults.time_limit * 60);
          } else {
            renderPracticeView(viewData);
          }
        } else {
          let errorMessage = "An unknown error occurred. Please try again.";
          if (response.data && response.data.message) {
            errorMessage = response.data.message;
          } else if (typeof response.data === "string") {
            errorMessage = response.data;
          }
          alert(errorMessage);
          renderLobby();
        }
      },
    });
  }

  function handleSubmitAnswer() {
    const selectedOption = $('input[name="wqb_answer"]:checked');
    if (selectedOption.length === 0) {
      alert("Please select an answer.");
      return;
    }

    const answerIndex = selectedOption.val();
    const questionId = selectedOption
      .closest(".wqb-practice-view")
      .data("question-id");

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_submit_answer",
        nonce: nonce,
        question_id: questionId,
        answer_index: answerIndex,
        session_id: sessionId, // NEW: Include session ID
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          if (response.data.is_correct) {
            sessionData.correct++;
          }
          sessionData.attempted++;
          sessionData.user_answers[questionId] = Number.parseInt(answerIndex);
          // Update question_states with 'correct' or 'incorrect'
          sessionData.question_states[questionId] = response.data.is_correct
            ? "correct"
            : "incorrect";

          revealAnswer(response.data, answerIndex);
          updateQuestionOverview();
        } else {
          alert(response.data.message);
        }
      },
    });
  }

  // NEW: Function to handle submitting feedback
  function handleSubmitFeedback() {
    const questionId = $(".wqb-practice-view").data("question-id");
    const feedbackText = $("#wqb-feedback-text").val().trim();

    if (!feedbackText) {
      alert("Please enter your feedback before submitting.");
      return;
    }

    // Disable elements to prevent multiple submissions
    $("#wqb-submit-feedback").prop("disabled", true).text("Sending...");
    $("#wqb-feedback-text").prop("disabled", true);

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_submit_feedback",
        nonce: nonce,
        question_id: questionId,
        feedback_text: feedbackText,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          alert("Thank you for your feedback! It has been submitted.");
          $(".wqb-feedback-section").html(
            '<p class="wqb-feedback-submitted-message">Feedback submitted for this question.</p>'
          );
        } else {
          alert(
            "Failed to submit feedback: " +
              (response.data?.message || "Unknown error.")
          );
          // Re-enable elements on failure
          $("#wqb-submit-feedback")
            .prop("disabled", false)
            .text("Send Feedback");
          $("#wqb-feedback-text").prop("disabled", false);
        }
      },
      error: (xhr, status, error) => {
        console.error("AJAX Error submitting feedback:", {
          xhr,
          status,
          error,
        });
        alert(
          "A network error occurred while submitting feedback. Please try again."
        );
        // Re-enable elements on network error
        $("#wqb-submit-feedback").prop("disabled", false).text("Send Feedback");
        $("#wqb-feedback-text").prop("disabled", false);
      },
    });
  }

  function navigateToQuestion(direction) {
    let targetIndex = sessionData.current_index;

    if (direction === "next") {
      targetIndex++;
    } else if (direction === "prev") {
      targetIndex--;
    }

    // Check bounds
    if (targetIndex < 0 || targetIndex >= sessionData.total) {
      if (targetIndex >= sessionData.total) {
        // End of session
        if (sessionData.mode === "mock") {
          finishMockTest();
        } else {
          renderSessionComplete();
        }
        return;
      } else {
        return; // Can't go before first question
      }
    }

    loadQuestion(targetIndex);
  }

  function handleQuestionNavigation() {
    const targetIndex = Number.parseInt($(this).data("question-index"));
    loadQuestion(targetIndex);
  }

  function loadQuestion(targetIndex) {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_navigate_question",
        nonce: nonce,
        target_index: targetIndex,
        session_id: sessionId, // NEW: Include session ID
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          sessionData.current_index = response.data.current_index;
          sessionData.user_answers = response.data.session_data.user_answers;
          sessionData.question_states =
            response.data.session_data.question_states || {};

          const viewData = {
            question: response.data.question,
            current: response.data.current_index + 1,
            total: sessionData.total,
            is_attempted: response.data.is_attempted,
            user_answer: response.data.user_answer,
          };

          if (sessionData.mode === "mock") {
            renderMockTestView(viewData);
          } else {
            renderPracticeView(viewData);
          }

          // If question was already attempted, show the answer
          if (response.data.is_attempted) {
            revealAnswer(
              {
                is_correct: response.data.is_correct,
                correct_index: response.data.correct_index,
                explanation: response.data.explanation,
                answer_distribution: response.data.answer_distribution, // Pass distribution data
                total_attempts: response.data.total_attempts, // Pass total attempts
              },
              response.data.user_answer,
              true
            );
          }
        } else {
          alert(response.data.message);
        }
      },
    });
  }

  function startTimer(initialSeconds) {
    remainingSeconds = initialSeconds;

    if (timerInterval) {
      clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
      const min = Math.floor(remainingSeconds / 60);
      const sec = remainingSeconds % 60;
      $("#wqb-timer").text(
        `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      );

      if (--remainingSeconds < 0) {
        clearInterval(timerInterval);
        $("#wqb-timer").text("Time Up!");
        finishMockTest();
      }
    }, 1000);
  }

  function finishMockTest() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    appRoot.html('<div class="wqb-loader">Calculating your results...</div>');

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_finish_mock_test",
        nonce: nonce,
        session_id: sessionId, // NEW: Include session ID
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          renderMockTestResults(response.data);
        } else {
          alert(response.data.message);
          renderLobby();
        }
      },
    });
  }

  // NEW: Handle End and Review functionality
  function handleEndAndReview() {
    if (!sessionId) {
      alert("No active session found.");
      return;
    }

    // console.log("handleEndAndReview called with sessionData:", sessionData)

    // Ensure all required properties exist
    if (!sessionData.question_ids || !Array.isArray(sessionData.question_ids)) {
      console.error(
        "sessionData.question_ids is missing or not an array:",
        sessionData.question_ids
      );
      alert("Session data is incomplete. Please try again.");
      return;
    }

    if (
      !sessionData.user_answers ||
      typeof sessionData.user_answers !== "object"
    ) {
      console.error(
        "sessionData.user_answers is missing or not an object:",
        sessionData.user_answers
      );
      sessionData.user_answers = {};
    }

    if (
      !sessionData.question_states ||
      typeof sessionData.question_states !== "object"
    ) {
      console.error(
        "sessionData.question_states is missing or not an object:",
        sessionData.question_states
      );
      sessionData.question_states = {};
    }

    if (!sessionData.total || typeof sessionData.total !== "number") {
      console.error(
        "sessionData.total is missing or not a number:",
        sessionData.total
      );
      sessionData.total = sessionData.question_ids.length;
    }

    const attemptedQuestionIds = sessionData.question_ids.filter((questionId) =>
      sessionData.user_answers.hasOwnProperty(questionId)
    );

    // Create review data from current session
    const reviewData = {
      question_ids: attemptedQuestionIds, // Use filtered attempted questions only
      user_answers: sessionData.user_answers,
      question_states: sessionData.question_states,
      mode: sessionData.mode || "practice",
      total_questions: attemptedQuestionIds.length, // Use attempted count, not total session count
      current_index: 0, // Start from first question in review
    };

    // console.log("Review data to be stored:", reviewData)

    // Store review data in session storage for the review page
    sessionStorage.setItem("wqb_review_data", JSON.stringify(reviewData));

    // console.log("Review data stored in sessionStorage")

    // Close the current session before redirecting
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_close_session",
        nonce: nonce,
        session_id: sessionId,
      },
      dataType: "json",
      success: (response) => {
        // console.log("Session closed successfully, redirecting to review")
        // Clear session variables
        sessionId = null;
        sessionData = null;

        // Redirect to review page
        const reviewUrl = new URL(window.location.href);
        reviewUrl.searchParams.set("wqb_review", "1");
        window.location.href = reviewUrl.toString();
      },
      error: (xhr, status, error) => {
        console.error("Error closing session:", error);
        // Still redirect to review page even if session close fails
        const reviewUrl = new URL(window.location.href);
        reviewUrl.searchParams.set("wqb_review", "1");
        window.location.href = reviewUrl.toString();
      },
    });
  }

  // --- Rendering Functions ---
  function renderPracticeView({
    question,
    current,
    total,
    is_attempted = false,
    user_answer = null,
  }) {
    sessionData.current = current;
    sessionData.total = total;
    //                    // <div class="wqb-progress-tracker">Correct: ${sessionData.correct} / ${sessionData.attempted}</div>

    let questionHtml = `
            <div class="wqb-practice-view" data-question-id="${question.id}">
                <div class="wqb-practice-header">
                    <div class="wqb-question-counter">Question ${current} of ${total}</div>
                </div>
                
                <!-- NEW: Top Navigation Bar -->
                <div class="wqb-top-navigation">
                    <div class="wqb-nav-left">
                        <button class="wqb-breadcrumb-btn wqb-button-secondary" onclick="window.location.href='/staging-area'">
                            <span class="wqb-button-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </span>
                            Home
                        </button>
                        <div class="wqb-breadcrumb-separator">›</div>
                        <span class="wqb-breadcrumb-current">Practice Session</span>
                    </div>
                    <div class="wqb-nav-center">
                        <span class="wqb-nav-position">${current} of ${total}</span>
                    </div>
                    <div class="wqb-nav-right">
                        <button id="wqb-end-review" class="wqb-nav-btn wqb-nav-btn-review">End & Review</button>
                    </div>
                </div>
                
                ${renderQuestionOverview()}
                
                <div class="wqb-question-prompt">${formatPromptText(
                  question.prompt
                )}</div>
                <div class="wqb-answer-options">`;

    question.options.forEach((option, index) => {
      const isChecked = is_attempted && user_answer === index ? "checked" : "";
      const isDisabled = is_attempted ? "disabled" : "";
      questionHtml += `<label class="wqb-option">
                                <input type="radio" name="wqb_answer" value="${index}" ${isChecked} ${isDisabled}>
                                <span class="wqb-option-letter">${String.fromCharCode(
                                  65 + index
                                )}</span>
                                <span class="wqb-option-text">${formatOptionText(
                                  option
                                )}</span>
                                <div class="wqb-option-distribution">
                                  <div class="wqb-distribution-bar-container">
                                    <div class="wqb-distribution-bar" data-option="${index}"></div>
                                  </div>
                                  <span class="wqb-distribution-percentage" data-option="${index}"></span>
                                </div>
                             </label>`;
    });

    questionHtml += `</div>
                         <div class="wqb-practice-footer">
                            ${renderNavigationButtons(is_attempted)}
                         </div>
                      </div>`;
    appRoot.html(questionHtml);
  }

  function renderMockTestView({
    question,
    current,
    total,
    is_attempted = false,
    user_answer = null,
  }) {
    sessionData.current = current;
    sessionData.total = total;

    const min = Math.floor(remainingSeconds / 60);
    const sec = remainingSeconds % 60;
    const currentTime = `${min.toString().padStart(2, "0")}:${sec
      .toString()
      .padStart(2, "0")}`;

    let questionHtml = `
            <div class="wqb-practice-view wqb-mock-test-view" data-question-id="${
              question.id
            }">
                <div class="wqb-practice-header">
                    <div id="wqb-timer" class="wqb-timer-display">${currentTime}</div>
                    <div class="wqb-question-counter">Question ${current} of ${total}</div>
                </div>
                
                <!-- Top Navigation Bar for Mock Test -->
                <div class="wqb-top-navigation">
                    <div class="wqb-nav-left">
                        <button class="wqb-breadcrumb-btn wqb-button-secondary" onclick="window.location.href='/staging-area'">
                            <span class="wqb-button-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </span>
                            Home
                        </button>
                        <div class="wqb-breadcrumb-separator">›</div>
                        <span class="wqb-breadcrumb-current">Mock Test</span>
                    </div>
                    <div class="wqb-nav-center">
                        <span class="wqb-nav-position">${current} of ${total}</span>
                    </div>
                    <div class="wqb-nav-right">
                        <button id="wqb-end-review" class="wqb-nav-btn wqb-nav-btn-review">End & Review</button>
                    </div>
                </div>
                
                ${renderQuestionOverview()}
                
                <div class="wqb-question-prompt">${formatPromptText(
                  question.prompt
                )}</div>
                <div class="wqb-answer-options">`;

    question.options.forEach((option, index) => {
      const isChecked = is_attempted && user_answer === index ? "checked" : "";
      const isDisabled = is_attempted ? "disabled" : "";
      questionHtml += `<label class="wqb-option">
                                <input type="radio" name="wqb_answer" value="${index}" ${isChecked} ${isDisabled}>
                                <span class="wqb-option-letter">${String.fromCharCode(
                                  65 + index
                                )}</span>
                                <span class="wqb-option-text">${formatOptionText(
                                  option
                                )}</span>
                                <div class="wqb-option-distribution">
                                  <div class="wqb-distribution-bar-container">
                                    <div class="wqb-distribution-bar" data-option="${index}"></div>
                                  </div>
                                  <span class="wqb-distribution-percentage" data-option="${index}"></span>
                                </div>
                             </label>`;
    });

    questionHtml += `</div>
                         <div class="wqb-practice-footer">
                            ${renderNavigationButtons(is_attempted)}
                         </div>
                      </div>`;
    appRoot.html(questionHtml);
  }

  function renderNavigationButtons(is_attempted) {
    const isFirst = sessionData.current_index === 0;
    const isLast = sessionData.current_index === sessionData.total - 1;

    let buttonsHtml = '<div class="wqb-navigation-buttons">';

    // Previous button
    if (!isFirst) {
      buttonsHtml +=
        '<button id="wqb-prev-question" class="wqb-button-secondary">Previous</button>';
    }

    // Submit/Skip buttons
    if (!is_attempted) {
      buttonsHtml +=
        '<button id="wqb-submit-answer" class="wqb-button-primary">Submit Answer</button>';
      if (!isLast) {
        buttonsHtml +=
          '<button id="wqb-skip-question" class="wqb-button-secondary">Skip</button>';
      }
    } else {
      // Next button for attempted questions
      if (!isLast) {
        buttonsHtml +=
          '<button id="wqb-next-question" class="wqb-button-primary">Next Question</button>';
      } else {
        if (sessionData.mode === "mock") {
          buttonsHtml +=
            '<button id="wqb-finish-test-btn" class="wqb-button-primary">Finish Test</button>';
        } else {
          buttonsHtml +=
            '<button id="wqb-finish-session-btn" class="wqb-button-primary">Finish Session</button>';
        }
      }
    }

    buttonsHtml += "</div>";
    return buttonsHtml;
  }

  function renderQuestionOverview() {
    let overviewHtml =
      '<div class="wqb-question-overview"><div class="wqb-question-grid">';

    let startIndex = 0;
    let endIndex = sessionData.total - 1;

    // Get responsive max visible questions
    const maxVisibleQuestions = getMaxVisibleQuestions();

    // If total questions exceed the max visible, calculate a window
    if (sessionData.total > maxVisibleQuestions) {
      const halfVisible = Math.floor(maxVisibleQuestions / 2);
      startIndex = Math.max(0, sessionData.current_index - halfVisible);
      endIndex = Math.min(
        sessionData.total - 1,
        startIndex + maxVisibleQuestions - 1
      );

      // Adjust start if we hit the end boundary
      if (endIndex - startIndex + 1 < maxVisibleQuestions) {
        startIndex = Math.max(0, endIndex - maxVisibleQuestions + 1);
      }
    }

    // Add ellipsis at the beginning if questions are hidden
    if (startIndex > 0) {
      overviewHtml += `<span class="wqb-question-ellipsis">...</span>`;
    }

    for (let i = startIndex; i <= endIndex; i++) {
      const questionId = sessionData.question_ids[i];
      let statusClass = "unanswered"; // Default

      // Determine status based on question_states
      if (sessionData.question_states[questionId] === "correct") {
        statusClass = "correctly-answered";
      } else if (sessionData.question_states[questionId] === "incorrect") {
        statusClass = "incorrectly-answered";
      }
      // If it's not in question_states, it remains "unanswered"

      if (i === sessionData.current_index) {
        statusClass += " current";
      }

      // Example for a 'flagged' question, based on image. Not tied to logic.
      // if (i === 28) { // For question 29 (index 28)
      //   statusClass += " flagged";
      // }

      overviewHtml += `<button class="wqb-question-nav-btn ${statusClass}" data-question-index="${i}">${
        i + 1
      }</button>`;
    }

    // Add ellipsis at the end if questions are hidden
    if (endIndex < sessionData.total - 1) {
      overviewHtml += `<span class="wqb-question-ellipsis">...</span>`;
    }

    overviewHtml += "</div></div>";
    return overviewHtml;
  }

  function updateQuestionOverview() {
    // Re-render the entire overview to correctly update classes and visible range
    // This is simpler than trying to update individual buttons in a dynamic window
    const currentView = appRoot.find(".wqb-practice-view, .wqb-mock-test-view");
    if (currentView.length) {
      currentView
        .find(".wqb-question-overview")
        .replaceWith(renderQuestionOverview());
    }
  }

  function revealAnswer(data, userSelectionIndex, isReview = false) {
    $(".wqb-option input").prop("disabled", true);
    $(`.wqb-option input[value="${data.correct_index}"]`)
      .parent()
      .addClass("correct-answer");

    if (!data.is_correct) {
      $(`.wqb-option input[value="${userSelectionIndex}"]`)
        .parent()
        .addClass("incorrect-answer");
    }

    if (!isReview) {
      $(".wqb-progress-tracker").text(
        `Correct: ${sessionData.correct} / ${sessionData.attempted}`
      );
    }

    // Show all distribution overlays
    $(".wqb-option-distribution").css("display", "flex");

    // Fetch question analytics data if not already provided (e.g., on initial submit)
    // If data.answer_distribution is already present (from resume session), use it directly
    const questionId = $(".wqb-practice-view").data("question-id");
    const processAnalytics = (analyticsData) => {
      const distribution = analyticsData.answer_distribution;

      // Update the distribution bars within the answer options
      for (let i = 0; i < 5; i++) {
        // Assuming 5 options (A, B, C, D, E)
        const optionData = distribution[i] || {
          count: 0,
          correct_count: 0,
          percentage: 0,
        };
        const isCorrect = i === data.correct_index;
        const isUserAnswer = i === Number.parseInt(userSelectionIndex); // Ensure userSelectionIndex is number

        // Determine bar color based on correctness and user selection
        let barColor = "#6c757d"; // Default gray
        if (isCorrect) {
          barColor = "#28a745"; // Green for correct answer
        } else if (isUserAnswer && !isCorrect) {
          barColor = "#dc3545"; // Red for incorrect user answer
        }

        // Update the distribution bar
        $(`.wqb-distribution-bar[data-option="${i}"]`).css({
          width: `${optionData.percentage}%`,
          "background-color": barColor,
        });

        // Update the percentage text and apply classes for styling
        const $percentageSpan = $(
          `.wqb-distribution-percentage[data-option="${i}"]`
        );
        $percentageSpan.text(`${optionData.percentage}%`);

        // Remove previous state classes
        $percentageSpan.removeClass("correct incorrect");

        if (isCorrect) {
          $percentageSpan.addClass("correct");
        } else if (isUserAnswer && !isCorrect) {
          $percentageSpan.addClass("incorrect");
        }
      }
    };

    if (data.answer_distribution && data.total_attempts !== undefined) {
      // If analytics data is already available (e.g., from resume session), use it
      processAnalytics(data);
    } else {
      // Otherwise, fetch analytics data
      $.ajax({
        url: ajaxUrl,
        type: "POST",
        data: {
          action: "wqb_get_question_analytics",
          nonce: nonce,
          question_id: questionId,
        },
        dataType: "json",
        success: (response) => {
          if (response.success) {
            processAnalytics(response.data);
          } else {
            console.error(
              "Failed to fetch question analytics:",
              response.data.message
            );
          }
        },
        error: (xhr, status, error) => {
          console.error("AJAX Error fetching question analytics:", {
            xhr,
            status,
            error,
          });
        },
      });
    }

    // Extract option texts from the DOM for display in analysis
    const optionTexts = [];
    for (let i = 0; i < 5; i++) {
      const $label = $(`.wqb-option input[value="${i}"]`).closest(
        ".wqb-option"
      );
      const text = $label.find(".wqb-option-text").text().trim();
      optionTexts[i] = text;
    }

    const userAnswerDisplay =
      userSelectionIndex !== null
        ? `${String.fromCharCode(65 + Number.parseInt(userSelectionIndex))} – ${
            optionTexts[Number.parseInt(userSelectionIndex)] || ""
          }`
        : "Not answered";
    const correctAnswerDisplay = `${String.fromCharCode(
      65 + data.correct_index
    )} – ${optionTexts[data.correct_index] || ""}`;

    // Add answer analysis section after distribution
    const answerAnalysisHtml = `
      <div class="wqb-question-analytics">
          <h4>Answer Analysis</h4>
          <div class="wqb-analytics-grid">
              <div class="wqb-analytics-item">
                  <span class="wqb-analytics-label">Your Answer:</span>
                  <span class="wqb-analytics-value ${
                    data.is_correct ? "correct" : "incorrect"
                  }">${userAnswerDisplay}</span>
              </div>
              <div class="wqb-analytics-item">
                  <span class="wqb-analytics-label">Correct Answer:</span>
                  <span class="wqb-analytics-value correct">${correctAnswerDisplay}</span>
              </div>
              <div class="wqb-analytics-item wqb-analytics-full">
                  <span class="wqb-analytics-label">Explanation:</span>
<div class="wqb-analytics-explanation">${formatExplanationHtml(
      data.explanation
    )}</div>
              </div>
          </div>
      </div>
    `;
    $(".wqb-practice-view").append(answerAnalysisHtml);

    // Add feedback section after explanation
    const feedbackSectionHtml = `
      <div class="wqb-feedback-section">
          <button class="wqb-feedback-toggle wqb-button-secondary">Submit Feedback</button>
          <div class="wqb-feedback-content" style="display:none;">
              <textarea id="wqb-feedback-text" placeholder="Type your feedback here..." rows="4"></textarea>
              <button id="wqb-submit-feedback" class="wqb-button-primary">Send Feedback</button>
          </div>
      </div>
    `;
    $(".wqb-practice-view").append(feedbackSectionHtml);

    // Update navigation buttons
    const isLast = sessionData.current_index === sessionData.total - 1;
    let newButtonsHtml = '<div class="wqb-navigation-buttons">';

    if (sessionData.current_index > 0) {
      newButtonsHtml +=
        '<button id="wqb-prev-question" class="wqb-button-secondary">Previous</button>';
    }

    if (!isLast) {
      newButtonsHtml +=
        '<button id="wqb-next-question" class="wqb-button-primary">Next Question</button>';
    } else {
      if (sessionData.mode === "mock") {
        newButtonsHtml +=
          '<button id="wqb-finish-test-btn" class="wqb-button-primary">Finish Test</button>';
      } else {
        newButtonsHtml +=
          '<button id="wqb-finish-session-btn" class="wqb-button-primary">Finish Session</button>';
      }
    }

    newButtonsHtml += "</div>";
    $(".wqb-practice-footer").html(newButtonsHtml);
  }

  function renderMockTestResults(data) {
    const percentage =
      data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    let resultsHtml = `
            <div class="wqb-mock-results">
                <h2>Mock Test Results</h2>
                <div class="wqb-results-summary">
                    <p><strong>Overall Score:</strong> ${data.correct} / ${data.total} (${percentage}%)</p>
                    <ul>
                        <li>Correct: ${data.correct}</li>
                        <li>Incorrect: ${data.incorrect}</li>
                        <li>Unanswered: ${data.unanswered}</li>
                    </ul>
                </div>
                <h3>Performance by Specialty</h3>
                <table class="wqb-results-table">
                    <thead>
                        <tr>
                            <th>Specialty</th>
                            <th>Performance</th>
                        </tr>
                    </thead>
                    <tbody>`;
    for (const specialty in data.specialty_stats) {
      const stat = data.specialty_stats[specialty];
      const spec_percent =
        stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      resultsHtml += `<tr>
                                <td>${specialty}</td>
                                <td>${stat.correct} / ${stat.total} (${spec_percent}%)</td>
                            </tr>`;
    }
    resultsHtml += `</tbody>
                </table>
                <div class="wqb-actions">
                    <button id="wqb-return-to-lobby" class="wqb-button-primary">Return to Home</button>
                </div>
            </div>`;
    appRoot.html(resultsHtml);
  }

  function renderSessionComplete() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    // Close the session
    if (sessionId) {
      $.ajax({
        url: ajaxUrl,
        type: "POST",
        data: {
          action: "wqb_close_session",
          nonce: nonce,
          session_id: sessionId,
        },
        dataType: "json",
        success: (response) => {
          // Continue with showing results regardless of close success
          showSessionCompleteResults();
        },
        error: () => {
          // Continue with showing results even if close fails
          showSessionCompleteResults();
        },
      });
    } else {
      showSessionCompleteResults();
    }
  }

  function showSessionCompleteResults() {
    const percentage =
      sessionData.attempted > 0
        ? Math.round((sessionData.correct / sessionData.attempted) * 100)
        : 0;
    const completeHtml = `<div class="wqb-session-complete">
                                <h2>Session Complete!</h2>
                                <p>You scored ${sessionData.correct} out of ${sessionData.attempted} (${percentage}%).</p>
                                <button id="wqb-return-to-lobby" class="wqb-button-primary">Return to Home</button>
                            </div>`;
    appRoot.html(completeHtml);
  }

  // NEW: Reusable function to render active session dialog
  function renderActiveSessionDialog(
    activeSession,
    showNewSessionButton = true
  ) {
    if (!activeSession) {
      return "";
    }

    const newSessionButton = showNewSessionButton
      ? `
          <button id="wqb-start-new-session-lobby" class="wqb-button-secondary wqb-full-width">
            <span class="wqb-button-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            Start New Session
          </button>
    `
      : "";

    return `
      <div class="wqb-active-session-dialog">
        <div class="wqb-session-status">
          <span class="wqb-session-badge wqb-session-active">Active Session</span>
          <span class="wqb-session-mode">${
            activeSession.mode === "mock" ? "Mock Test" : "Practice"
          }</span>
        </div>
        <div class="wqb-session-progress">
          <div class="wqb-progress-info">
            <span class="wqb-progress-text">Progress: ${
              activeSession.answered_count
            } of ${activeSession.total_questions} questions</span>
            <span class="wqb-progress-percentage">${
              activeSession.progress_percentage
            }%</span>
          </div>
          <div class="wqb-progress-bar">
            <div class="wqb-progress-fill" style="width: ${
              activeSession.progress_percentage
            }%"></div>
          </div>
        </div>
        <div class="wqb-session-details">
          <span class="wqb-session-time">Started: ${new Date(
            activeSession.created_at
          ).toLocaleDateString()}</span>
          <span class="wqb-session-expires">Expires: ${new Date(
            activeSession.expires_at
          ).toLocaleDateString()}</span>
        </div>
        <div class="wqb-session-actions">
          <button class="wqb-resume-session-btn wqb-button-primary wqb-full-width" data-session-id="${
            activeSession.session_id
          }">
            <span class="wqb-button-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            Resume Session
          </button>
          ${newSessionButton}
        </div>
      </div>
    `;
  }

  function renderActiveSessionsList(activeSessions) {
    if (!activeSessions || activeSessions.length === 0) {
      return "";
    }

    const sessionsHtml = activeSessions
      .map(
        (session) => `
      <div class="wqb-active-session-item" data-session-id="${
        session.session_id
      }">
        <div class="wqb-session-header">
          <div class="wqb-session-info">
            <span class="wqb-session-badge wqb-session-active">Active Session</span>
            <span class="wqb-session-mode">${
              session.mode === "mock" ? "Mock Test" : "Practice"
            }</span>
          </div>
          <button class="wqb-close-session-btn" data-session-id="${
            session.session_id
          }" title="Close Session">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="wqb-session-progress">
          <div class="wqb-progress-info">
            <span class="wqb-progress-text">Progress: ${
              session.answered_count
            } of ${session.total_questions} questions</span>
            <span class="wqb-progress-percentage">${
              session.progress_percentage
            }%</span>
          </div>
          <div class="wqb-progress-bar">
            <div class="wqb-progress-fill" style="width: ${
              session.progress_percentage
            }%"></div>
          </div>
        </div>
        <div class="wqb-session-details">
          <span class="wqb-session-time">Started: ${new Date(
            session.created_at
          ).toLocaleDateString()}</span>
          <span class="wqb-session-expires">Expires: ${new Date(
            session.expires_at
          ).toLocaleDateString()}</span>
        </div>
        <div class="wqb-session-actions">
          <button class="wqb-resume-session-btn wqb-button-primary wqb-full-width" data-session-id="${
            session.session_id
          }">
            <span class="wqb-button-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            Resume Session
          </button>
        </div>
      </div>
    `
      )
      .join("");

    return `
      <div class="wqb-active-sessions-container">
        <h3>Active Sessions</h3>
        <div class="wqb-active-sessions-list">
          ${sessionsHtml}
        </div>
      </div>
    `;
  }

  function renderLobby() {
    if (timerInterval) clearInterval(timerInterval);

    // NEW: Reset session data when returning to lobby
    sessionData = {};
    sessionId = null;

    appRoot.html('<div class="wqb-loader">Loading Question Bank...</div>');

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: { action: "wqb_get_lobby_data", nonce: nonce },
      dataType: "json",
      success: (response) => {
        if (!response.success) {
          appRoot.html(
            '<p class="wqb-error">Could not load the question bank. Please try again later.</p>'
          );
          return;
        }

        const stats = response.data.stats;
        const categoryTree = response.data.category_tree;
        const heatmapData = response.data.heatmap_data; // NEW: Get heatmap data
        const activeSessions = response.data.active_sessions; // NEW: Get all active sessions data
        const isPremium = response.data.is_premium_user; // NEW: Get user status
        const allQuestionsAnswered = response.data.all_questions_answered // NEW: Get the completion flag

               // MODIFIED: Prioritize the completion modal over the standard upsell modal.
          if (!isPremium && allQuestionsAnswered) {
          window.WQBModalUtils.showCompletionModal();
        } else if (!isPremium) {
          window.WQBModalUtils.showUpsellModal();
        }

        // NEW: Store category tree globally for counter calculations
        window.wqbCategoryTree = categoryTree;

        // The rest of the function remains the same, building the lobby in the background.
        let upsellHtml = ""; // We are now using a modal, so the static banner is removed.

        function buildCategoryListItems(categories) {
          let html = "";
          if (!categories || categories.length === 0) {
            return "";
          }
          categories.forEach((cat) => {
            const hasChildren = cat.children && cat.children.length > 0;
            html += `<li class="wqb-category-item">
                                    <div class="wqb-category-row">
                                        ${
                                          hasChildren
                                            ? '<a href="#" class="wqb-category-toggle">+</a>'
                                            : '<span class="wqb-category-toggle-placeholder"></span>'
                                        }
                                        <label>
                                            <input type="checkbox" class="${
                                              hasChildren
                                                ? "wqb-category-checkbox-parent"
                                                : ""
                                            }" name="wqb_categories[]" value="${
              cat.id
            }">
                                            ${cat.name}
                                        </label>
                                        <span class="wqb-category-progress">${
                                          cat.user_answered
                                        } of ${cat.total_questions}</span>
                                    </div>`;
            if (hasChildren) {
              html += `<ul class="wqb-category-children">${buildCategoryListItems(
                cat.children
              )}</ul>`;
            }
            html += `</li>`;
          });
          return html;
        }

        const lobbyHtml = `
            <div class="wqb-lobby-redesigned">
                <div class="wqb-breadcrumb-navigation">
                    <div class="wqb-breadcrumb-container">
                        <button class="wqb-breadcrumb-btn wqb-button-secondary" onclick="window.location.href='/staging-area'">
                            <span class="wqb-button-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2 -2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </span>
                            Back to Home
                        </button>
                        <div class="wqb-breadcrumb-separator">›</div>
                        <span class="wqb-breadcrumb-current">Question Bank</span>
                    </div>
                </div>
                
                <div class="wqb-lobby-header">
                    <h1>Question bank</h1>
                    <p>Welcome to the main question bank.</p>
                    <div class="wqb-progress-bar-outer">
                        <div class="wqb-progress-bar-inner" style="width: ${
                          stats.user_average_score
                        }%;"></div>
                    </div>
                    <p class="wqb-summary-text">
                        You've answered ${
                          stats.user_total_answered
                        } questions with an average score of ${
          stats.user_average_score
        }%. 
                        <a href="/userdash">More</a>
                    </p>
                    <p class="wqb-summary-text">
                        Please select question categories you want to practice from and proceed by clicking the Start Practice button.
                    </p>
                    <p class="wqb-summary-text">
                        If no categories are selected, all questions will be included in the practice session by default.                           
                    </p>
                </div>

                ${upsellHtml} <div class="wqb-lobby-main">
                    <div class="wqb-total-questions-indicator">
                        ${stats.total_in_bank.toLocaleString()} questions in total
                    </div>
                    ${renderActiveSessionsList(activeSessions)}
                    <div class="wqb-activity-section wqb-lobby-heatmap-container">
                        <h2>Your Activity</h2>
                        <p class="wqb-section-description">Your question-answering activity over the last 6 months</p>
                        <div id="wqb-lobby-cal-heatmap"></div>
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
                    </div>
                    <div class="wqb-category-tree">
                        <div class="wqb-category-header">
                            <label class="wqb-select-all-label">
                                <input type="checkbox" id="wqb-select-all-categories">
                                <span>Select All Categories</span>
                            </label>
                            <div id="wqb-selected-questions-counter" class="wqb-selected-counter">0 unsolved questions selected</div>
                        </div>
                        <ul class="wqb-category-tree-root">
                            ${buildCategoryListItems(categoryTree)}
                        </ul>
                    </div>
                </div>

                <div class="wqb-lobby-footer">
                        <h2>Question Selection</h2>
                        <div class="wqb-filters">
                            <select name="wqb_status_filter" id="wqb-status-filter">
                                <option value="unattempted">Show All New Questions</option>
                                <option value="incorrect">Incorrect Only</option>
                            </select>
                        </div>
                        <div class="wqb-actions">
                            <button id="wqb-start-practice" class="wqb-button-primary">Start Practice</button>
                        </div>
                </div>
            </div>
                `;
        appRoot.html(lobbyHtml);
        initializeLobbyHeatmap(heatmapData); // NEW: Initialize heatmap
        updateSelectedQuestionsCounter(); // NEW: Initialize the selected questions counter
      },
    });
  }

  // if we want to add drop down opption for all questions, implementation is already done just need to add this to lobby Html
  // <option value="all">All Questions</option>

  // if we want to enable mock test mode add the below code to lobbyHtml
  //<button id="wqb-start-mock-test" class="wqb-button-secondary">Start Mock Test</button>



  // NEW: Function to initialize the heatmap for the lobby
  function initializeLobbyHeatmap(heatmapData) {
    if (
      window.WQBHeatmapUtils &&
      window.WQBHeatmapUtils.initializeLobbyHeatmap
    ) {
      window.WQBHeatmapUtils.initializeLobbyHeatmap(heatmapData)
        .then(() => {
          // console.log("Lobby heatmap initialized successfully")
          if (
            window.WQBHeatmapUtils &&
            window.WQBHeatmapUtils.reinitializeHeatmapOnResize
          ) {
            window.WQBHeatmapUtils.reinitializeHeatmapOnResize(
              "#wqb-lobby-cal-heatmap",
              heatmapData,
              {}
            );
          }
        })
        .catch((error) => {
          console.error("Failed to initialize lobby heatmap:", error);
        });
    } else {
      console.error("WQBHeatmapUtils not available");
    }
  }

  function init() {
    // Check for review mode parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const reviewMode = urlParams.get("wqb_review");
    const newSession = urlParams.get("new_session");

    if (reviewMode === "1") {
      // Don't initialize anything - the review page will handle its own initialization
      return;
    } else if (newSession === "1") {
      // Start a new session immediately
      handleStartNewSession();
    } else {
      // Go directly to lobby without popup
      renderLobby();
    }
  }
  init();
});
