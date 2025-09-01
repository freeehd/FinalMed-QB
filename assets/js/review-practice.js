const jQuery = window.jQuery

jQuery(document).ready(($) => {
  const appRoot = $("#wqb-review-practice-root")
  const ajaxUrl = window.wqb_data.ajax_url
  const nonce = window.wqb_data.nonce

  // console.log('Review practice page initializing...')
  // console.log('App root found:', appRoot.length > 0)

  const reviewData = {
    questions: [],
    userAnswers: {},
    questionStates: {},
    totalQuestions: 0,
    expandedQuestions: new Set() // Track which questions are expanded
  }


  //Format Helpers

  function formatExplanationHtml(rawText) {
    if (!rawText || rawText.trim() === '') {
      return 'No explanation available.';
    }
  
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    let htmlOutput = '';
  
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (index === 0) {
        // This part for the correct answer works fine.
        const formattedLine = trimmedLine.replace(
          /(Correct answer: [A-E]\))/,
          '<strong>$1</strong>'
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
          formattedLine = trimmedLine.replace(/^❌\s*/, '');
        }
  
        htmlOutput += `<div class="explanation-block incorrect-answer"><span class="explanation-icon">❌</span><div class="explanation-text">${formattedLine}</div></div>`;
      }
    });
  
    return htmlOutput;
  }

  // --- Event Handlers ---
  appRoot.on("click", "#wqb-review-return-lobby", () => {
    window.location.href = '/staging-area' // Return to staging area
  })

  appRoot.on("click", ".wqb-review-question-btn", function() {
    const questionIndex = $(this).data('question-index')
    toggleQuestionExpansion(questionIndex)
  })

  // --- Core Logic ---
  function initReviewPage() {
    // console.log('Initializing review page...')
    // Check if we have review data in session storage
    const storedReviewData = sessionStorage.getItem('wqb_review_data')
    // console.log('Stored review data:', storedReviewData ? 'Found' : 'Not found')
    
    if (!storedReviewData) {
      // console.log('No review data found, showing no data message')
      renderNoReviewData()
      return
    }

    try {
      const data = JSON.parse(storedReviewData)
       console.log('Parsed review data:', data)
      
      reviewData.questions = data.question_ids || []
      reviewData.userAnswers = data.user_answers || {}
      reviewData.questionStates = data.question_states || {}
      reviewData.totalQuestions = data.total_questions || reviewData.questions.length

       console.log('Review data loaded:', {
        questionsCount: reviewData.questions.length,
        totalQuestions: reviewData.totalQuestions,
        userAnswersCount: Object.keys(reviewData.userAnswers).length,
        questionStatesCount: Object.keys(reviewData.questionStates).length
       })

      // Check if there are any attempted questions
      const attemptedQuestions = reviewData.questions.filter(questionId => 
        reviewData.userAnswers.hasOwnProperty(questionId)
      )
      
      // console.log('Attempted questions count:', attemptedQuestions.length)

      if (attemptedQuestions.length === 0) {
        // console.log('No attempted questions found in review data')
        renderNoReviewData()
        return
      }

      // console.log('Rendering review page layout...')
      renderReviewPageLayout()
    } catch (error) {
      console.error('Error parsing review data:', error)
      renderNoReviewData()
    }
  }

  function renderNoReviewData() {
    // console.log('renderNoReviewData called')
    const html = `
      <div class="wqb-review-empty">
        <h2>No Review Data Available</h2>
        <p>No practice test data found for review. Please complete a practice test first.</p>
        <button id="wqb-review-return-lobby" class="wqb-button-primary">Return to Home</button>
      </div>
    `
    // console.log('Setting no review data HTML')
    appRoot.html(html)
  }

  function renderReviewPageLayout() {
    // console.log('renderReviewPageLayout called')
    
    const html = `
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
            <span class="wqb-breadcrumb-current">Practice Review</span>
          </div>
        </div>
        
        <div class="wqb-review-header">
          <h2>Practice Test Review</h2>
          <p>Review your answers and explanations</p>
          <button id="wqb-review-return-lobby" class="wqb-button-secondary">Return to Home</button>
        </div>
        <div class="wqb-review-questions-list">
          <!-- Questions list will be populated here -->
        </div>
      </div>
    `
    // console.log('Setting app root HTML')
    appRoot.html(html)
    renderQuestionsList()
  }

  function renderQuestionsList() {
    // Only show questions that were actually attempted
    const attemptedQuestions = reviewData.questions.filter(questionId => 
      reviewData.userAnswers.hasOwnProperty(questionId)
    )
    
    // console.log('Total questions in session:', reviewData.questions.length)
    // console.log('Attempted questions:', attemptedQuestions.length)
    
    const questionsList = attemptedQuestions.map((questionId, index) => {
      const userAnswer = reviewData.userAnswers[questionId]
      const questionState = reviewData.questionStates[questionId]
      const isExpanded = reviewData.expandedQuestions.has(index)
      
      let statusClass = ''
      let statusText = ''
      if (questionState === 'correct') {
        statusClass = 'correct'
        statusText = 'Correct'
      } else if (questionState === 'incorrect') {
        statusClass = 'incorrect'
        statusText = 'Incorrect'
      }

      return `
        <div class="wqb-review-question-item" data-question-id="${questionId}" data-question-index="${index}">
          <div class="wqb-question-summary">
            <div class="wqb-question-info">
              <span class="wqb-question-number">Question ${index + 1}</span>
              <span class="wqb-question-preview">Loading question preview...</span>
              <span class="wqb-question-status ${statusClass}">${statusText}</span>
            </div>
            <button class="wqb-review-question-btn" data-question-index="${index}">
              ${isExpanded ? 'Hide Details' : 'Review'}
            </button>
          </div>
          <div class="wqb-question-details ${isExpanded ? 'expanded' : ''}" style="display: ${isExpanded ? 'block' : 'none'};">
            <div class="wqb-question-loading">Loading question details...</div>
          </div>
        </div>
      `
    }).join('')

    const html = `
      <div class="wqb-review-questions-container">
        ${questionsList}
      </div>
    `
    appRoot.find('.wqb-review-questions-list').html(html)

    // Load question previews for all questions
    loadQuestionPreviews()
  }

  function loadQuestionPreviews() {
    const attemptedQuestions = reviewData.questions.filter(questionId => 
      reviewData.userAnswers.hasOwnProperty(questionId)
    )

    attemptedQuestions.forEach((questionId, index) => {
      $.ajax({
        url: ajaxUrl,
        type: "POST",
        data: {
          action: "wqb_get_practice_review_question",
          nonce: nonce,
          question_id: questionId
        },
        dataType: "json",
        success: (response) => {
          if (response.success) {
            updateQuestionPreview(index, response.data)
          } else {
            console.error('Error loading question preview:', response.data.message)
          }
        },
        error: (xhr, status, error) => {
          console.error('AJAX error loading question preview:', error)
        }
      })
    })
  }

  function updateQuestionPreview(index, data) {
    const questionPreview = data.question.prompt.substring(0, 100) + (data.question.prompt.length > 100 ? '...' : '')
    const questionElement = appRoot.find(`[data-question-index="${index}"]`)
    
    if (questionElement.length) {
      questionElement.find('.wqb-question-preview').text(questionPreview)
    }
  }

  function toggleQuestionExpansion(questionIndex) {
    const isExpanded = reviewData.expandedQuestions.has(questionIndex)
    const questionElement = appRoot.find(`[data-question-index="${questionIndex}"]`)
    const detailsElement = questionElement.find('.wqb-question-details')
    const buttonElement = questionElement.find('.wqb-review-question-btn')

    if (isExpanded) {
      // Collapse
      reviewData.expandedQuestions.delete(questionIndex)
      detailsElement.slideUp(300)
      buttonElement.text('Review')
    } else {
      // Expand
      reviewData.expandedQuestions.add(questionIndex)
      buttonElement.text('Hide Details')
      
      // Load full question details if not already loaded
      if (detailsElement.find('.wqb-question-loading').length > 0) {
        loadQuestionDetails(questionIndex)
      } else {
        detailsElement.slideDown(300)
      }
    }
  }

  function loadQuestionDetails(questionIndex) {
    const attemptedQuestions = reviewData.questions.filter(questionId => 
      reviewData.userAnswers.hasOwnProperty(questionId)
    )
    
    if (questionIndex < 0 || questionIndex >= attemptedQuestions.length) {
      // console.log('Invalid question index:', questionIndex)
      return
    }

    const questionId = attemptedQuestions[questionIndex]
    const questionElement = appRoot.find(`[data-question-index="${questionIndex}"]`)
    const detailsElement = questionElement.find('.wqb-question-details')

    $.ajax({
      url: ajaxUrl,
      type: "POST",
      data: {
        action: "wqb_get_practice_review_question",
        nonce: nonce,
        question_id: questionId
      },
      dataType: "json",
      success: (response) => {
        // console.log('AJAX response received for question details:', response)
        if (response.success) {
          renderQuestionDetails(response.data, questionIndex, detailsElement)
        } else {
          console.error('Error loading question details:', response.data.message)
          detailsElement.html('<div class="wqb-question-error">Error loading question details</div>')
        }
      },
      error: (xhr, status, error) => {
        console.error('AJAX error loading question details:', error)
        detailsElement.html('<div class="wqb-question-error">Error loading question details</div>')
      }
    })
  }





  function renderQuestionDetails(data, index, detailsElement) {
    const userAnswer = parseInt(data.user_answer_index, 10)
    const isCorrect = data.is_correct
    const correctAnswer = parseInt(data.correct_choice_index, 10)
    
    // Only use real distribution data from backend
    const distribution = data.answer_distribution

    // Compose readable displays with option texts
    const optionTexts = Array.isArray(data.question.options) ? data.question.options : []
    const userAnswerDisplay = Number.isInteger(userAnswer)
      ? `${String.fromCharCode(65 + userAnswer)} – ${optionTexts[userAnswer] || ''}`
      : 'Not answered'
    const correctAnswerDisplay = `${String.fromCharCode(65 + correctAnswer)} – ${optionTexts[correctAnswer] || ''}`

    let questionHtml = `
      <div class="wqb-question-full-content">
        <div class="wqb-question-prompt">${data.question.prompt}</div>
        <div class="wqb-answer-options">`

    data.question.options.forEach((option, optionIndex) => {
      let optionClass = 'wqb-option'
      if (optionIndex === correctAnswer) {
        optionClass += ' correct-answer'
      } else if (optionIndex === userAnswer && !isCorrect) {
        optionClass += ' incorrect-answer'
      }

      questionHtml += `
        <label class="${optionClass}">
          <input type="radio" disabled ${optionIndex === userAnswer ? 'checked' : ''}>
          <span class="wqb-option-letter">${String.fromCharCode(65 + optionIndex)}</span>
          <span class="wqb-option-text">${option}</span>
          <div class="wqb-option-distribution">
            <div class="wqb-distribution-bar-container">
              <div class="wqb-distribution-bar" data-option="${optionIndex}"></div>
            </div>
            <span class="wqb-distribution-percentage" data-option="${optionIndex}"></span>
          </div>
        </label>
      `
    })

    questionHtml += `</div>
      
      <div class="wqb-question-analytics">
        <h4>Your Answer Analysis</h4>
        <div class="wqb-analytics-grid">
          <div class="wqb-analytics-item">
            <span class="wqb-analytics-label">Your Answer:</span>
            <span class="wqb-analytics-value ${isCorrect ? 'correct' : 'incorrect'}">${userAnswerDisplay}</span>
          </div>
          <div class="wqb-analytics-item">
            <span class="wqb-analytics-label">Correct Answer:</span>
            <span class="wqb-analytics-value correct">${correctAnswerDisplay}</span>
          </div>
          <div class="wqb-analytics-item wqb-analytics-full">
            <span class="wqb-analytics-label">Explanation:</span>
<div class="wqb-analytics-explanation">${formatExplanationHtml(data.explanation)}</div>
          </div>
        </div>
      </div>
    </div>`

    detailsElement.html(questionHtml)
    
    // Process and update distribution data (matching frontend.js implementation)
    if (distribution && Object.keys(distribution).length > 0) {
      // Show all distribution overlays
      detailsElement.find(".wqb-option-distribution").css("display", "flex")
      
      // Update the distribution bars within the answer options
      for (let i = 0; i < 5; i++) {
        // Assuming 5 options (A, B, C, D, E)
        const optionData = distribution[i] || { count: 0, correct_count: 0, percentage: 0 }
        const isCorrectOption = i === correctAnswer
        const isUserAnswerOption = i === userAnswer

        // Determine bar color based on correctness and user selection
        let barColor = "#6c757d" // Default gray
        if (isCorrectOption) {
          barColor = "#28a745" // Green for correct answer
        } else if (isUserAnswerOption && !isCorrect) {
          barColor = "#dc3545" // Red for incorrect user answer
        }

        // Update the distribution bar
        detailsElement.find(`.wqb-distribution-bar[data-option="${i}"]`).css({
          width: `${optionData.percentage}%`,
          "background-color": barColor,
        })

        // Update the percentage text and apply classes for styling
        const $percentageSpan = detailsElement.find(`.wqb-distribution-percentage[data-option="${i}"]`)
        $percentageSpan.text(`${optionData.percentage}%`)

        // Remove previous state classes
        $percentageSpan.removeClass("correct incorrect")

        if (isCorrectOption) {
          $percentageSpan.addClass("correct")
        } else if (isUserAnswerOption && !isCorrect) {
          $percentageSpan.addClass("incorrect")
        }
      }
    }
    
    detailsElement.slideDown(300)
  }

  // Initialize the review page
  initReviewPage()
}) 