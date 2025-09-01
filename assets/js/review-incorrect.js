const jQuery = window.jQuery

jQuery(document).ready(($) => {
  const appRoot = $("#wqb-review-incorrect-root")
  const ajaxUrl = window.wqb_data.ajax_url
  const nonce = window.wqb_data.nonce

  const reviewData = {
    questions: [],
    currentIndex: 0,
    totalQuestions: 0,
    selectedCategories: [], // NEW: To store selected category IDs
  }

  // --- Event Handlers ---
  appRoot.on("click", "#wqb-review-next", () => navigateReviewQuestion("next"))
  appRoot.on("click", "#wqb-review-prev", () => navigateReviewQuestion("prev"))
  appRoot.on("click", "#wqb-review-return-dashboard", () => {
    window.location.href = "/staging-area" // Return to staging area
  })
  appRoot.on("click", ".wqb-category-toggle", function (e) {
    e.preventDefault()
    const toggle = $(this)
    const children = toggle.closest(".wqb-category-row").siblings(".wqb-category-children")

    toggle.toggleClass("open")
    if (toggle.hasClass("open")) {
      toggle.text("-")
    } else {
      toggle.text("+")
    }
    children.slideToggle(200)
  })
  appRoot.on("change", ".wqb-category-checkbox-parent, .wqb-category-checkbox-child", function () {
    const changedCheckbox = $(this)
    const isParent = changedCheckbox.hasClass("wqb-category-checkbox-parent")
    const isChecked = changedCheckbox.prop("checked")

    if (isParent) {
      // Check/uncheck all children
      changedCheckbox
        .closest(".wqb-category-item")
        .find('.wqb-category-children input[type="checkbox"]')
        .prop("checked", isChecked)
    } else {
      // If a child is unchecked, uncheck its parent
      if (!isChecked) {
        changedCheckbox
          .closest(".wqb-category-children")
          .siblings(".wqb-category-row")
          .find(".wqb-category-checkbox-parent")
          .prop("checked", false)
      }
      // If all children are checked, check the parent
      const parentChildren = changedCheckbox.closest(".wqb-category-children").find(".wqb-category-checkbox-child")
      const allChildrenChecked = parentChildren.length > 0 && parentChildren.get().every((el) => $(el).prop("checked"))
      if (allChildrenChecked) {
        changedCheckbox
          .closest(".wqb-category-children")
          .siblings(".wqb-category-row")
          .find(".wqb-category-checkbox-parent")
          .prop("checked", true)
      }
    }
    updateSelectedCategoriesAndFetch()
  })

  // NEW: Event handler for reset progress button
  appRoot.on("click", "#wqb-reset-progress", handleResetProgress)

  // --- Core Logic ---
  function fetchIncorrectQuestions() {
    // IMPORTANT FIX: Target the .wqb-review-view for the loader, not the whole main content.
    // This ensures the .wqb-review-view element itself is not removed from the DOM.
    appRoot
      .find(".wqb-review-main-content .wqb-review-view")
      .html('<div class="wqb-loader">Loading incorrectly answered questions...</div>')

    // console.log("Fetching incorrect questions with categories:", reviewData.selectedCategories)

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_get_incorrect_questions",
        nonce: nonce,
        categories: reviewData.selectedCategories, // Pass selected categories
      },
      dataType: "json",
      success: (response) => {
        // console.log("Response from wqb_get_incorrect_questions:", response)
        if (response.success && response.data.questions && response.data.questions.length > 0) {
          reviewData.questions = response.data.questions
          reviewData.totalQuestions = response.data.questions.length
          reviewData.currentIndex = 0 // Start from the first question

          renderReviewQuestion(reviewData.currentIndex) // Then render the question
        } else {
          // If no questions, display the empty message in the .wqb-review-view area
          appRoot.find(".wqb-review-main-content .wqb-review-view").html(`
                      <div class="wqb-review-empty">
                          <h2>No Incorrect Questions Found</h2>
                          <p>It looks like you haven't answered any questions incorrectly yet, or no questions match your selected categories.</p>
                          <button id="wqb-review-return-dashboard" class="wqb-button-primary">Return to Dashboard</button>
                      </div>
                  `)
        }
      },
      error: (xhr, status, error) => {
        console.error("AJAX Error fetching incorrect questions:", { xhr, status, error })
        appRoot.find(".wqb-review-main-content .wqb-review-view").html(`
                  <div class="wqb-error">
                      <h3>Error Loading Questions</h3>
                      <p>There was a problem fetching your incorrect questions. Please try again later.</p>
                      <button id="wqb-review-return-dashboard" class="wqb-button-primary">Return to Dashboard</button>
                  </div>
              `)
      },
    })
  }

  function fetchCategoriesAndRenderFilter() {
    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_get_review_categories",
        nonce: nonce,
      },
      dataType: "json",
      success: (response) => {
        if (response.success) {
          const categoryTree = response.data.category_tree
          // console.log("Categories fetched:", response.data.category_tree)
          renderReviewPageLayout() // <--- MOVED THIS LINE
          renderCategoryFilter(categoryTree)
          // After rendering categories, fetch questions
          fetchIncorrectQuestions()
        } else {
          console.error("Failed to fetch categories:", response.data.message)
          // Fallback to fetching questions without category filter if categories fail
          fetchIncorrectQuestions()
        }
      },
      error: (xhr, status, error) => {
        console.error("AJAX Error fetching categories:", { xhr, status, error })
        // Fallback to fetching questions without category filter if categories fail
        fetchIncorrectQuestions()
      },
    })
  }

  function updateSelectedCategoriesAndFetch() {
    reviewData.selectedCategories = []
    appRoot.find('.wqb-category-filter input[type="checkbox"]:checked').each(function () {
      reviewData.selectedCategories.push(Number.parseInt($(this).val()))
    })
    fetchIncorrectQuestions() // Re-fetch questions with new filter
  }

  function renderReviewPageLayout() {
    const layoutHtml = `
          <div class="wqb-review-page-container">
              <div class="wqb-breadcrumb-navigation">
                  <div class="wqb-breadcrumb-container">
                      <button class="wqb-breadcrumb-btn wqb-button-secondary" onclick="window.location.href='/staging-area'">
                          <span class="wqb-button-icon">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                  <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                          </span>
                          Home
                      </button>
                      <div class="wqb-breadcrumb-separator">›</div>
                      <span class="wqb-breadcrumb-current">Incorrect Questions Review</span>
                  </div>
              </div>
              
              <div class="wqb-review-sidebar">
                  <div class="wqb-review-sidebar-header">
                      <h3>Filter by Category</h3>
                  </div>
                  <div id="wqb-category-filter" class="wqb-category-filter">
                      <!-- Categories will be rendered here -->
                  </div>
                  <div class="wqb-review-sidebar-footer">
                      <button id="wqb-review-return-dashboard" class="wqb-button-secondary">Return to Home</button>
                      <button id="wqb-reset-progress" class="wqb-button-danger">Reset All Progress</button>
                  </div>
              </div>
              <div class="wqb-review-main-content">
                  <div class="wqb-review-view">
                      <!-- Question content will be rendered here -->
                  </div>
              </div>
          </div>
      `
    appRoot.html(layoutHtml)
  }

  function renderCategoryFilter(categoryTree) {
    // console.log("Rendering categories:", categoryTree)
    function buildCategoryListItems(categories, level = 0) {
      let html = `<ul class="wqb-category-tree-level-${level}">`
      if (!categories || categories.length === 0) {
        return ""
      }
      categories.forEach((cat) => {
        const hasChildren = cat.children && cat.children.length > 0
        const isChecked = reviewData.selectedCategories.includes(cat.id) ? "checked" : "" // Maintain checked state
        html += `<li class="wqb-category-item">
                              <div class="wqb-category-row">
                                  ${hasChildren ? '<a href="#" class="wqb-category-toggle">+</a>' : '<span class="wqb-category-toggle-placeholder"></span>'}
                                  <label>
                                      <input type="checkbox" class="${hasChildren ? "wqb-category-checkbox-parent" : "wqb-category-checkbox-child"}" name="wqb_categories[]" value="${cat.id}" ${isChecked}>
                                      ${cat.name}
                                  </label>
                              </div>`
        if (hasChildren) {
          html += `<div class="wqb-category-children">${buildCategoryListItems(cat.children, level + 1)}</div>`
        }
        html += `</li>`
      })
      html += `</ul>`
      return html
    }
    const html = buildCategoryListItems(categoryTree)
    // console.log("Generated category HTML:", html)
    $("#wqb-category-filter").html(html)

    // Expand parents if any child is selected
    appRoot.find(".wqb-category-checkbox-child:checked").each(function () {
      $(this)
        .closest(".wqb-category-children")
        .show()
        .siblings(".wqb-category-row")
        .find(".wqb-category-toggle")
        .addClass("open")
        .text("-")
    })
  }

  function renderReviewQuestion(index) {
    // console.log("Attempting to render question at index:", index)
    if (index < 0 || index >= reviewData.totalQuestions) {
      console.error("Invalid question index for review:", index)
      return
    }

    reviewData.currentIndex = index
    const question = reviewData.questions[index]

    // Compose readable displays with option texts
    const optionTexts = Array.isArray(question.options) ? question.options : []
    const userAnswer = Number.isInteger(question.user_answer_index) ? question.user_answer_index : null
    const correctAnswer = Number.isInteger(question.correct_choice_index) ? question.correct_choice_index : null
    const isCorrect = userAnswer !== null && correctAnswer !== null && userAnswer === correctAnswer
    const userAnswerDisplay =
      userAnswer !== null
        ? `${String.fromCharCode(65 + userAnswer)} – ${optionTexts[userAnswer] || ""}`
        : "Not answered"
    const correctAnswerDisplay =
      correctAnswer !== null ? `${String.fromCharCode(65 + correctAnswer)} – ${optionTexts[correctAnswer] || ""}` : ""

    let questionHtml = `
          <div class="wqb-review-header">
              <h2>Review Incorrect Questions</h2>
              <div class="wqb-question-counter">Question ${index + 1} of ${reviewData.totalQuestions}</div>
          </div>
          
          <div class="wqb-question-prompt">${question.prompt}</div>
          <div class="wqb-answer-options">`

    question.options.forEach((option, optIndex) => {
      let optionClass = "wqb-option"
      if (optIndex === question.correct_choice_index) {
        optionClass += " correct-answer"
      } else if (optIndex === question.user_answer_index) {
        optionClass += " incorrect-answer"
      }

      questionHtml += `<div class="${optionClass}">
                              <input type="radio" disabled ${optIndex === question.user_answer_index ? "checked" : ""}>
                              <span class="wqb-option-letter">${String.fromCharCode(65 + optIndex)}</span>
                              <span class="wqb-option-text">${option}</span>
                          </div>`
    })

    questionHtml += `</div>
                      <div class="wqb-question-analytics">
                        <h4>Your Answer Analysis</h4>
                        <div class="wqb-analytics-grid">
                          <div class="wqb-analytics-item">
                            <span class="wqb-analytics-label">Your Answer:</span>
                            <span class="wqb-analytics-value ${isCorrect ? "correct" : "incorrect"}">${userAnswerDisplay}</span>
                          </div>
                          <div class="wqb-analytics-item">
                            <span class="wqb-analytics-label">Correct Answer:</span>
                            <span class="wqb-analytics-value correct">${correctAnswerDisplay}</span>
                          </div>
                          <div class="wqb-analytics-item wqb-analytics-full">
                            <span class="wqb-analytics-label">Explanation:</span>
                            <div class="wqb-analytics-explanation">${question.explanation}</div>
                          </div>
                        </div>
                      </div>
                      <div class="wqb-review-footer">
                          ${renderReviewNavigationButtons()}
                      </div>
                  </div>`

    // console.log("Generated question HTML:", questionHtml)
    // Target the specific .wqb-review-view element within the main content
    appRoot.find(".wqb-review-main-content .wqb-review-view").html(questionHtml)
  }

  function renderReviewNavigationButtons() {
    const isFirst = reviewData.currentIndex === 0
    const isLast = reviewData.currentIndex === reviewData.totalQuestions - 1

    let buttonsHtml = '<div class="wqb-navigation-buttons">'

    if (!isFirst) {
      buttonsHtml += '<button id="wqb-review-prev" class="wqb-button-secondary">Previous</button>'
    } else {
      buttonsHtml += '<button class="wqb-button-secondary" disabled>Previous</button>'
    }

    if (!isLast) {
      buttonsHtml += '<button id="wqb-review-next" class="wqb-button-primary">Next</button>'
    } else {
      buttonsHtml += '<button id="wqb-review-return-dashboard" class="wqb-button-primary">Return to Home</button>'
    }

    buttonsHtml += "</div>"
    return buttonsHtml
  }

  function navigateReviewQuestion(direction) {
    let newIndex = reviewData.currentIndex
    if (direction === "next") {
      newIndex++
    } else if (direction === "prev") {
      newIndex--
    }

    if (newIndex >= 0 && newIndex < reviewData.totalQuestions) {
      renderReviewQuestion(newIndex)
    } else if (newIndex >= reviewData.totalQuestions) {
      // If it's the last question and user clicks next, offer to finish review
      $("#wqb-review-return-dashboard").click()
    }
  }

  // NEW: Function to handle resetting user progress
  function handleResetProgress() {
    const confirmReset = confirm(
      "WARNING: This will permanently delete ALL your question progress data (correct/incorrect answers) for all questions. This action cannot be undone. Are you absolutely sure you want to proceed?",
    )

    if (confirmReset) {
      appRoot
        .find(".wqb-review-main-content .wqb-review-view")
        .html('<div class="wqb-loader">Resetting your progress...</div>')
      $.ajax({
        url: ajaxUrl,
        type: "POST",
        data: {
          action: "wqb_reset_user_progress",
          nonce: nonce,
        },
        dataType: "json",
        success: (response) => {
          if (response.success) {
            alert("Your progress has been successfully reset!")
            window.location.reload() // Reload the page to reflect changes
          } else {
            alert("Failed to reset progress: " + (response.data?.message || "Unknown error."))
            // Re-fetch questions to restore the view if reset failed
            fetchIncorrectQuestions()
          }
        },
        error: (xhr, status, error) => {
          console.error("AJAX Error resetting progress:", { xhr, status, error })
          alert("A network error occurred while trying to reset progress. Please try again.")
          // Re-fetch questions to restore the view if reset failed
          fetchIncorrectQuestions()
        },
      })
    }
  }

  // Initialize the review page
  fetchCategoriesAndRenderFilter() // Start by fetching categories
})
