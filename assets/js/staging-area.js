// Staging Area JavaScript
// Only declare if not already declared
const jQuery = window.jQuery

jQuery(document).ready(($) => {
  const stagingRoot = $("#wqb-staging-area-root")
  const wqb_data = window.wqb_data

  if (stagingRoot.length === 0) {
    return // Exit if the staging area element isn't on the page
  }

  // Motivational quotes for UMKLA exams
  const motivationalQuotes = [
    {
      quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
      author: "Winston Churchill"
    },
    {
      quote: "The only way to do great work is to love what you do.",
      author: "Steve Jobs"
    },
    {
      quote: "Believe you can and you're halfway there.",
      author: "Theodore Roosevelt"
    },
    {
      quote: "The future belongs to those who believe in the beauty of their dreams.",
      author: "Eleanor Roosevelt"
    },
    {
      quote: "Don't watch the clock; do what it does. Keep going.",
      author: "Sam Levenson"
    },
    {
      quote: "The expert in anything was once a beginner.",
      author: "Helen Hayes"
    },
    {
      quote: "Your time is limited, don't waste it living someone else's life.",
      author: "Steve Jobs"
    },
    {
      quote: "The only limit to our realization of tomorrow will be our doubts of today.",
      author: "Franklin D. Roosevelt"
    }
  ]

  function getRandomQuote() {
    return motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]
  }

  // Shared function to render active session dialog
  function renderActiveSessionDialog(activeSession, buttonIds = {}) {
    if (!activeSession) {
      return ''
    }
    
    const resumeId = buttonIds.resume || 'wqb-resume-session'
    const newSessionId = buttonIds.newSession || 'wqb-start-new-session'
    
    return `
      <div class="wqb-active-session-info">
        <div class="wqb-session-status">
          <span class="wqb-session-badge wqb-session-active">Active Session</span>
          <span class="wqb-session-mode">${activeSession.mode === 'mock' ? 'Mock Test' : 'Practice'}</span>
        </div>
        <div class="wqb-session-progress">
          <div class="wqb-progress-info">
            <span class="wqb-progress-text">Progress: ${activeSession.answered_count} of ${activeSession.total_questions} questions</span>
            <span class="wqb-progress-percentage">${activeSession.progress_percentage}%</span>
          </div>
          <div class="wqb-progress-bar">
            <div class="wqb-progress-fill" style="width: ${activeSession.progress_percentage}%"></div>
          </div>
        </div>
        <div class="wqb-session-details">
          <span class="wqb-session-time">Started: ${new Date(activeSession.created_at).toLocaleDateString()}</span>
          <span class="wqb-session-expires">Expires: ${new Date(activeSession.expires_at).toLocaleDateString()}</span>
        </div>
        <div class="wqb-session-actions">
          <button class="wqb-button-primary wqb-full-width padding-bottom-10" onclick="window.location.href='/questionbank'">
            <span class="wqb-button-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            Resume Session
          </button>
          <button class="wqb-button-secondary wqb-full-width" onclick="window.location.href='/questionbank?new_session=1'">
            <span class="wqb-button-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            Start New Session
          </button>
        </div>
      </div>
    `
  }

  function renderStagingArea(data) {
    const stats = data.performance_stats
    const heatmapData = data.heatmap_data
    const username = data.username
    const activeSession = data.active_session
    const quote = getRandomQuote()

    let stagingHtml = `
            <div class="wqb-staging-area">
                <div class="wqb-breadcrumb-navigation">
                    <div class="wqb-breadcrumb-container">
                        <span class="wqb-breadcrumb-current">Home</span>
                    </div>
                </div>
                
                <div class="wqb-staging-header">
                    <h1>Hi ${username}, welcome to the Finalmed Question Bank!</h1>
                    <p class="wqb-staging-subtitle">Your comprehensive preparation platform for UMKLA exams</p>
                </div>

             

                <div class="wqb-staging-cards-section">
                    <div class="wqb-staging-cards-grid">
                      <div class="wqb-staging-card wqb-quiz-card">
                            <div class="wqb-card-header">
                                <div class="wqb-card-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                        <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                                <h3>Start Practicing</h3>
                            </div>
                            <div class="wqb-card-content">
                                ${activeSession ? renderActiveSessionDialog(activeSession) : `
                                    <p>Ready to test your knowledge? Choose from practice sessions or mock exams to improve your skills.</p>
                                    <button class="wqb-button-secondary wqb-full-width" onclick="window.location.href='/questionbank'">
                                        <span class="wqb-button-icon">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                                <path d="M12 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </span>
                                        Go to Quiz Lobby
                                    </button>
                                `}
                            </div>
                        </div>
                        <div class="wqb-staging-card wqb-stats-card">
                            <div class="wqb-card-header">
                                <div class="wqb-card-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 3v18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M18 17V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M13 17V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M8 17v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                                <h3>Your Progress</h3>
                            </div>
                            <div class="wqb-card-content">
                                <div class="wqb-quick-stats">
                                    <div class="wqb-quick-stat">
                                        <span class="wqb-quick-stat-value">${stats.overall_percentage}%</span>
                                        <span class="wqb-quick-stat-label">Accuracy</span>
                                    </div>
                                    <div class="wqb-quick-stat">
                                        <span class="wqb-quick-stat-value">${stats.overall_total}</span>
                                        <span class="wqb-quick-stat-label">Questions</span>
                                    </div>
                                    <div class="wqb-quick-stat">
                                        <span class="wqb-quick-stat-value">${stats.overall_correct}</span>
                                        <span class="wqb-quick-stat-label">Correct</span>
                                    </div>
                                </div>
                                <button class="wqb-button-primary wqb-full-width" onclick="window.location.href='/dashboard'">
                                    <span class="wqb-button-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M3 3v18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M18 17V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M13 17V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M8 17v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </span>
                                    View Full Dashboard
                                </button>
                            </div>
                        </div>

                      
                    </div>
                </div>
   <div class="wqb-staging-heatmap-section">
                    <h2>Your Activity Overview</h2>
                    <p class="wqb-section-description">Track your study progress over the last 6 months</p>
                    <div class="wqb-heatmap-container">
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
                    </div>
                </div>
                <div class="wqb-staging-motivation-section">
                    <div class="wqb-motivation-card">
                        <div class="wqb-motivation-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div class="wqb-motivation-content">
                            <h3>Good luck with your UMKLA exams!</h3>
                            <blockquote class="wqb-motivation-quote">
                                "${quote.quote}"
                                <cite>— ${quote.author}</cite>
                            </blockquote>
                            <p class="wqb-motivation-message">
                                Remember, every question you practice brings you one step closer to success. 
                                Stay focused, stay confident, and trust in your preparation!
                            </p>
                        </div>
                    </div>
                </div>
            </div>`

    stagingRoot.html(stagingHtml)

    // Initialize the heatmap
    initializeStagingHeatmap(heatmapData)
  }

  function initializeStagingHeatmap(heatmapData) {
    if (window.WQBHeatmapUtils && window.WQBHeatmapUtils.initializeStandaloneHeatmap) {
      window.WQBHeatmapUtils.initializeStandaloneHeatmap(heatmapData)
        .then(() => {
          // console.log("Staging area heatmap initialized successfully")
          if (window.WQBHeatmapUtils && window.WQBHeatmapUtils.reinitializeHeatmapOnResize) {
            window.WQBHeatmapUtils.reinitializeHeatmapOnResize('#wqb-standalone-cal-heatmap', heatmapData, {})
          }
        })
        .catch((error) => {
          console.error("Failed to initialize staging area heatmap:", error)
        })
    } else {
      console.error("WQBHeatmapUtils not available")
    }
  }

  // Show loading state
  stagingRoot.html(`
        <div class="wqb-staging-loading">
            <div class="wqb-loading-spinner"></div>
            <p>Loading your staging area...</p>
        </div>
    `)

  // Fetch staging data
  $.ajax({
    url: wqb_data.ajax_url,
    type: "POST",
    data: { action: "wqb_get_staging_data", nonce: wqb_data.nonce },
    dataType: "json",
    success: (response) => {
      if (response.success) {
        renderStagingArea(response.data)
      } else {
        stagingRoot.html(`
                    <div class="wqb-staging-error">
                        <div class="wqb-error-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h3>Unable to Load Staging Area</h3>
                        <p>Could not load staging area data. Please try refreshing the page.</p>
                        <p>Error: ${response.data?.message || "Unknown error"}</p>
                    </div>
                `)
      }
    },
    error: (xhr, status, error) => {
      console.error("AJAX Error:", { xhr, status, error })
      stagingRoot.html(`
                <div class="wqb-staging-error">
                    <div class="wqb-error-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2"/>
                            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h3>Connection Error</h3>
                    <p>A network error occurred. Please check your connection and try again.</p>
                    <p>Details: ${error}</p>
                </div>
            `)
    },
  })
}) 