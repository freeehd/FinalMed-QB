// Cal-Heatmap, Tooltip, and other dependencies are globally available via CDN
// Only declare if not already declared
const jQuery = window.jQuery


jQuery(document).ready(($) => {
  const dashboardRoot = $("#wqb-dashboard-root")
  const wqb_data = window.wqb_data

  if (dashboardRoot.length === 0) {
    return // Exit if the dashboard element isn't on the page
  }

  function renderDashboard(data) {

     // NEW: Check user status and show modals
    const isPremium = data.is_premium_user;
    const allQuestionsAnswered = data.all_questions_answered;
    if (!isPremium && allQuestionsAnswered) {
      window.WQBModalUtils.showCompletionModal();
    } else if (!isPremium) {
      window.WQBModalUtils.showUpsellModal();
    }

    const stats = data.performance_stats
    const heatmapData = data.heatmap_data

    let dashboardHtml = `
            <div class="wqb-dashboard">
                <div class="wqb-breadcrumb-navigation">
                    <div class="wqb-breadcrumb-container">
                        <button class="wqb-breadcrumb-btn wqb-button-secondary" onclick="window.location.href='/staging-area'">
                            <span class="wqb-button-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <polyline points="9,22 9,12 15,12 15,22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </span>
                            Back to Home
                        </button>
                        <div class="wqb-breadcrumb-separator">›</div>
                        <span class="wqb-breadcrumb-current">Performance Dashboard</span>
                    </div>
                </div>
                
                <div class="wqb-dashboard-header">
                    <h1>Your Performance Dashboard</h1>
                    <p>Track your progress and identify areas for improvement</p>
                </div>

                <div class="wqb-stats-section">
                    <h2>Lifetime Statistics</h2>
                    <div class="wqb-stats-grid">
                        <div class="wqb-stat-card wqb-stat-primary">
                            <div class="wqb-stat-icon">📊</div>
                            <div class="wqb-stat-content">
                                <div class="wqb-stat-value">${stats.overall_percentage}%</div>
                                <div class="wqb-stat-label">Overall Accuracy</div>
                            </div>
                        </div>
                        <div class="wqb-stat-card wqb-stat-success">
                            <div class="wqb-stat-icon">✅</div>
                            <div class="wqb-stat-content">
                                <div class="wqb-stat-value">${stats.overall_correct}</div>
                                <div class="wqb-stat-label">Correct Answers</div>
                            </div>
                        </div>
                        <div class="wqb-stat-card wqb-stat-info">
                            <div class="wqb-stat-icon">📝</div>
                            <div class="wqb-stat-content">
                                <div class="wqb-stat-value">${stats.overall_total}</div>
                                <div class="wqb-stat-label">Total Answered</div>
                            </div>
                        </div>
                        <div class="wqb-stat-card wqb-stat-warning">
                            <div class="wqb-stat-icon">📈</div>
                            <div class="wqb-stat-content">
                                <div class="wqb-stat-value">${stats.overall_total - stats.overall_correct}</div>
                                <div class="wqb-stat-label">Incorrect Answers</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="wqb-specialty-section">
                    <h2>Performance by Specialty</h2>
                    <div class="wqb-table-container">
                        <table class="wqb-results-table wqb-results-tree">
                            <thead>
                                <tr>
                                    <th>Specialty</th>
                                    <th>Correct</th>
                                    <th>Total</th>
                                    <th>Accuracy %</th>
                                    <th>Accuracy</th>
                                </tr>
                            </thead>
                            <tbody>
                              ${buildSpecialtyRows(stats.specialties)}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="wqb-activity-section">
                    <h2>Recent Activity</h2>
                    <p class="wqb-section-description">Your question-answering activity over the last 30 days</p>
                    <div class="wqb-heatmap-container">
                        <div id="wqb-cal-heatmap"></div>
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

                <div class="wqb-reset-section">
                    <div class="wqb-accordion">
                        <button class="wqb-accordion-toggle" type="button">
                            <span class="wqb-accordion-icon">⚠️</span>
                            <span class="wqb-accordion-title">Resetting All User Progress</span>
                            <span class="wqb-accordion-arrow">▼</span>
                        </button>
                        <div class="wqb-accordion-content" style="display: none;">
                            <div class="wqb-reset-warning">
                                <div class="wqb-warning-icon">🚨</div>
                                <div class="wqb-warning-content">
                                    <h4>Warning: This action cannot be undone!</h4>
                                    <p>Clicking the reset button will permanently delete all your question progress, including:</p>
                                    <ul>
                                        <li>All correct and incorrect answer records</li>
                                        <li>Your performance statistics</li>
                                        <li>Activity heatmap data</li>
                                        <li>Progress tracking for all questions</li>
                                    </ul>
                                    <p><strong>This action is irreversible and will reset your account to a completely fresh state.</strong></p>
                                </div>
                            </div>
                            <div class="wqb-reset-actions">
                                <button id="wqb-reset-progress-btn" class="wqb-button-danger" type="button">
                                    <span class="wqb-button-icon">🗑️</span>
                                    Reset All Progress
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`

    dashboardRoot.html(dashboardHtml)

    // Initialize the heatmap with better configuration
    initializeHeatmap(heatmapData)
    
    // Initialize event handlers for accordion and reset functionality
    initializeEventHandlers()
  }

  function initializeHeatmap(heatmapData) {
    if (window.WQBHeatmapUtils && window.WQBHeatmapUtils.initializeDashboardHeatmap) {
      window.WQBHeatmapUtils.initializeDashboardHeatmap(heatmapData)
        .then(() => {
          // console.log("Dashboard heatmap initialized successfully")
          if (window.WQBHeatmapUtils && window.WQBHeatmapUtils.reinitializeHeatmapOnResize) {
            window.WQBHeatmapUtils.reinitializeHeatmapOnResize('#wqb-cal-heatmap', heatmapData, {})
          }
        })
        .catch((error) => {
          console.error("Failed to initialize dashboard heatmap:", error)
        })
    } else {
      console.error("WQBHeatmapUtils not available")
    }
  }

  // Build tree rows recursively
  function buildSpecialtyRows(nodes, level = 0) {
    if (!Array.isArray(nodes) || nodes.length === 0) return ''

    let html = ''
    nodes.forEach(node => {
      const indent = '&nbsp;'.repeat(level * 4)
      const hasChildren = Array.isArray(node.children) && node.children.length > 0
      const percent = node.total > 0 ? Math.round((node.correct / node.total) * 100) : 0
      const progressClass = percent >= 80 ? 'high' : percent >= 60 ? 'medium' : 'low'
      const toggle = hasChildren ? `<a href="#" class="wqb-tree-toggle" data-open="0">+</a>` : '<span class="wqb-tree-toggle-placeholder"></span>'

      html += `
        <tr class="wqb-tree-row" data-level="${level}">
          <td>
            <div class="wqb-tree-cell">
              ${indent}
              ${toggle}
              <span class="wqb-tree-name">${node.name}</span>
            </div>
          </td>
          <td class="wqb-stat-correct">${node.correct}</td>
          <td class="wqb-stat-total">${node.total}</td>
          <td class="wqb-stat-percent">${percent}%</td>
          <td class="wqb-progress-cell">
            <div class="wqb-progress-bar">
              <div class="wqb-progress-fill wqb-progress-${progressClass}" style="width: ${percent}%"></div>
            </div>
          </td>
        </tr>
      `

      // Render children rows inline, initially hidden, so column widths stay consistent
      if (hasChildren) {
        node.children.forEach(child => {
          const cPercent = child.total > 0 ? Math.round((child.correct / child.total) * 100) : 0
          const cProgressClass = cPercent >= 80 ? 'high' : cPercent >= 60 ? 'medium' : 'low'
          const cIndent = '&nbsp;'.repeat((level + 1) * 4)
          const cHasChildren = Array.isArray(child.children) && child.children.length > 0
          const cToggle = cHasChildren ? `<a href="#" class="wqb-tree-toggle" data-open="0">+</a>` : '<span class="wqb-tree-toggle-placeholder"></span>'
          html += `
            <tr class="wqb-tree-row child-of-level-${level}" data-level="${level + 1}" style="display:none;">
              <td>
                <div class="wqb-tree-cell">
                  ${cIndent}
                  ${cToggle}
                  <span class="wqb-tree-name">${child.name}</span>
                </div>
              </td>
              <td class="wqb-stat-correct">${child.correct}</td>
              <td class="wqb-stat-total">${child.total}</td>
              <td class="wqb-stat-percent">${cPercent}%</td>
              <td class="wqb-progress-cell">
                <div class="wqb-progress-bar">
                  <div class="wqb-progress-fill wqb-progress-${cProgressClass}" style="width: ${cPercent}%"></div>
                </div>
              </td>
            </tr>
          `
          if (cHasChildren) {
            html += buildSpecialtyRows([child], level + 1) // recursively inline deeper levels
          }
        })
      }
    })
    return html
  }

  // Event handlers for accordion and reset functionality
  function initializeEventHandlers() {
    // Toggle tree expand/collapse
    dashboardRoot.on('click', '.wqb-tree-toggle', function(e) {
      e.preventDefault()
      const toggle = $(this)
      const row = toggle.closest('tr')
      const currentLevel = parseInt(row.attr('data-level'), 10)
      // Toggle immediate children rows (those with data-level = current+1 until next sibling at same or lower level)
      const isOpen = toggle.attr('data-open') === '1'
      let $walker = row.next()
      while ($walker.length) {
        const walkerLevel = parseInt($walker.attr('data-level') || '-1', 10)
        if (isNaN(walkerLevel) || walkerLevel <= currentLevel) break
        if (walkerLevel === currentLevel + 1) {
          if (isOpen) {
            $walker.hide()
          } else {
            $walker.show()
          }
        }
        $walker = $walker.next()
      }
      toggle.attr('data-open', isOpen ? '0' : '1').text(isOpen ? '+' : '−')
    })
    // Accordion toggle
    dashboardRoot.on("click", ".wqb-accordion-toggle", function() {
      const toggle = $(this)
      const content = toggle.next(".wqb-accordion-content")
      const arrow = toggle.find(".wqb-accordion-arrow")
      
      toggle.toggleClass("active")
      content.slideToggle(200)
      
      if (toggle.hasClass("active")) {
        arrow.text("▲")
      } else {
        arrow.text("▼")
      }
    })

    // Reset progress button
    dashboardRoot.on("click", "#wqb-reset-progress-btn", function() {
      const button = $(this)
      const originalText = button.html()
      
      // Show confirmation dialog
      if (!confirm("⚠️ WARNING: This will permanently delete ALL your progress data!\n\nThis action cannot be undone. Are you absolutely sure you want to reset all your progress?")) {
        return
      }
      
      // Show second confirmation
      if (!confirm("🚨 FINAL WARNING: This will delete everything!\n\n• All correct/incorrect answers\n• All performance statistics\n• All activity data\n• All progress tracking\n\nThis is your last chance to cancel. Proceed with reset?")) {
        return
      }
      
      // Disable button and show loading state
      button.prop("disabled", true)
      button.html('<span class="wqb-button-icon">⏳</span> Resetting...')
      
      $.ajax({
        url: wqb_data.ajax_url,
        type: "POST",
        data: {
          action: "wqb_reset_user_progress",
          nonce: wqb_data.nonce
        },
        dataType: "json",
        success: (response) => {
          if (response.success) {
            // Show success message
            button.html('<span class="wqb-button-icon">✅</span> Reset Complete!')
            button.removeClass("wqb-button-danger").addClass("wqb-button-success")
            
            // Reload the dashboard after a short delay
            setTimeout(() => {
              location.reload()
            }, 2000)
          } else {
            // Show error message
            button.html('<span class="wqb-button-icon">❌</span> Reset Failed')
            button.removeClass("wqb-button-danger").addClass("wqb-button-error")
            
            // Reset button after delay
            setTimeout(() => {
              button.prop("disabled", false)
              button.html(originalText)
              button.removeClass("wqb-button-error").addClass("wqb-button-danger")
            }, 3000)
            
            alert("Failed to reset progress: " + (response.data?.message || "Unknown error"))
          }
        },
        error: (xhr, status, error) => {
          console.error("Reset progress error:", error)
          
          // Show error message
          button.html('<span class="wqb-button-icon">❌</span> Reset Failed')
          button.removeClass("wqb-button-danger").addClass("wqb-button-error")
          
          // Reset button after delay
          setTimeout(() => {
            button.prop("disabled", false)
            button.html(originalText)
            button.removeClass("wqb-button-error").addClass("wqb-button-danger")
          }, 3000)
          
          alert("Network error occurred while resetting progress. Please try again.")
        }
      })
    })
  }

  dashboardRoot.html(`
        <div class="wqb-dashboard-loading">
            <div class="wqb-loading-spinner"></div>
            <p>Loading your dashboard...</p>
        </div>
    `)

  $.ajax({
    url: wqb_data.ajax_url,
    type: "POST",
    data: { action: "wqb_get_dashboard_data", nonce: wqb_data.nonce },
    dataType: "json",
    success: (response) => {
      if (response.success) {
        renderDashboard(response.data)
      } else {
        dashboardRoot.html(`
                    <div class="wqb-dashboard-error">
                        <div class="wqb-error-icon">⚠️</div>
                        <h3>Unable to Load Dashboard</h3>
                        <p>Could not load dashboard data. Please try refreshing the page.</p>
                        <p>Error: ${response.data?.message || "Unknown error"}</p>
                    </div>
                `)
      }
    },
    error: (xhr, status, error) => {
      console.error("AJAX Error:", { xhr, status, error })
      dashboardRoot.html(`
                <div class="wqb-dashboard-error">
                    <div class="wqb-error-icon">🔌</div>
                    <h3>Connection Error</h3>
                    <p>A network error occurred. Please check your connection and try again.</p>
                    <p>Details: ${error}</p>
                </div>
            `)
    },
  })
})
