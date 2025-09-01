/**
 * Enhanced Responsive Heatmap Utility Functions
 * Container-aware sizing with seamless mobile experience
 */

// Global references
const CalHeatmap = window.CalHeatmap
const dayjs = window.dayjs

// Instance tracking to prevent multiple heatmaps
const heatmapInstances = new Map()
const activeResizeHandlers = new Map()
const containerObservers = new Map()

/**
 * Wait for fonts to load (with fallback)
 */
function waitForFontsReady() {
  if (document.fonts?.ready) {
    return document.fonts.ready.catch(() => {})
  }
  return Promise.resolve()
}

/**
 * Enhanced stable width detection with container focus
 */
function waitForStableWidth(element, timeout = 1000) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    let lastWidth = 0
    let lastHeight = 0
    let stableCount = 0
    const requiredStableChecks = 3

    const check = () => {
      const rect = element.getBoundingClientRect()
      const width = rect.width || element.clientWidth || 0
      const height = rect.height || element.clientHeight || 0

      if (width > 0 && Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) {
        stableCount++
      } else {
        stableCount = 0
      }

      lastWidth = width
      lastHeight = height

      if (stableCount >= requiredStableChecks || Date.now() - startTime > timeout) {
        resolve({ width, height })
        return
      }

      requestAnimationFrame(check)
    }

    requestAnimationFrame(check)
  })
}

/**
 * Container-aware responsive configuration
 */
function getResponsiveConfig(containerWidth, viewportWidth) {
    const effectiveWidth = Math.min(containerWidth || viewportWidth, viewportWidth)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const isPortrait = window.innerHeight > window.innerWidth

    const optimalCellSize = Math.max(12, Math.min(28, Math.floor((effectiveWidth - 20) / (7 * 4))))

    // Mobile portrait
    if (isMobile && isPortrait && effectiveWidth <= 480) {
        const mobileCellSize = Math.floor((effectiveWidth * 0.95) / (7 * 2.5));
        return {
            monthsToShow: Math.max(2, Math.floor(effectiveWidth / 140)),
            subDomainWidth: Math.max(14, Math.min(20, mobileCellSize)),
            subDomainHeight: Math.max(14, Math.min(20, mobileCellSize)),
            subDomainRadius: 2,
            subDomainGutter: Math.max(2, Math.floor(mobileCellSize * 0.15)),
            domainLabelText: "MMM",
            tooltipCompact: true,
            breakpoint: "mobile-portrait",
        }
    }

    // Mobile landscape
    if (isMobile && !isPortrait && effectiveWidth <= 850) {
        const landscapeCellSize = Math.floor((effectiveWidth * 0.95) / (7 * 4));
        return {
            monthsToShow: Math.max(3, Math.floor(effectiveWidth / 120)),
            subDomainWidth: Math.max(12, Math.min(18, landscapeCellSize)),
            subDomainHeight: Math.max(12, Math.min(18, landscapeCellSize)),
            subDomainRadius: 2,
            subDomainGutter: Math.max(2, Math.floor(landscapeCellSize * 0.15)),
            domainLabelText: "MMM",
            tooltipCompact: true,
            breakpoint: "mobile-landscape",
        }
    }

    // Desktop breakpoints
    if (effectiveWidth <= 480) {
        return { monthsToShow: 3, subDomainWidth: 16, subDomainHeight: 16, subDomainRadius: 2, subDomainGutter: 2, domainLabelText: "MMM", tooltipCompact: true, breakpoint: "sm" };
    } else if (effectiveWidth <= 768) {
        return { monthsToShow: 4, subDomainWidth: 16, subDomainHeight: 16, subDomainRadius: 2, subDomainGutter: 3, domainLabelText: "MMM", tooltipCompact: true, breakpoint: "md" };
    } else if (effectiveWidth <= 1024) {
        return { monthsToShow: 5, subDomainWidth: 18, subDomainHeight: 18, subDomainRadius: 3, subDomainGutter: 3, domainLabelText: "MMM YYYY", tooltipCompact: false, breakpoint: "lg" };
    } else {
        return { monthsToShow: Math.min(6, Math.floor(effectiveWidth / 180)), subDomainWidth: 20, subDomainHeight: 20, subDomainRadius: 3, subDomainGutter: 4, domainLabelText: "MMM YYYY", tooltipCompact: false, breakpoint: "xl" };
    }
}

/**
 * Add today's highlight to heatmap
 */
function highlightToday(container) {
  const svg = container?.querySelector("svg")
  if (!svg) return

  const todayIso = (dayjs ? dayjs() : new Date()).toISOString().split("T")[0]
  const selectors = [
    `rect[data-iso-date="${todayIso}"]`,
    `rect[data-date="${todayIso}"]`,
    `rect[aria-label*="${todayIso}"]`,
  ]

  for (const selector of selectors) {
    const todayCell = svg.querySelector(selector)
    if (todayCell) {
      todayCell.classList.add("wqb-today")
      return
    }
  }
}

/**
 * Create tooltip content
 */
function createTooltipContent(date, heatmapData, isCompact = false) {
  const dateToFormat = dayjs ? dayjs(date) : new Date(date)
  const dateStr = dayjs
    ? isCompact
      ? dateToFormat.format("MMM D, YYYY")
      : dateToFormat.format("dddd, MMMM D, YYYY")
    : dateToFormat.toLocaleDateString()

  const dayData = heatmapData.find((item) => {
    const itemDate = dayjs ? dayjs(item.date) : new Date(item.date)
    return dayjs ? itemDate.isSame(dateToFormat, "day") : itemDate.toDateString() === dateToFormat.toDateString()
  })

  const total = dayData?.total || 0
  const correct = dayData?.correct || 0
  const incorrect = dayData?.incorrect || 0
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  if (total === 0) {
    return `<div class="wqb-tooltip-content">
              <div class="wqb-tooltip-header">${dateStr}</div>
              <div class="wqb-tooltip-no-activity">No activity</div>
            </div>`
  }

  const compactClass = isCompact ? "wqb-tooltip-compact" : ""
  const statsHtml = isCompact
    ? `<div class="wqb-tooltip-stat"><span class="wqb-tooltip-icon">📊</span> ${total}</div>
       <div class="wqb-tooltip-stat wqb-tooltip-correct"><span class="wqb-tooltip-icon">✅</span> ${correct}</div>
       <div class="wqb-tooltip-stat wqb-tooltip-incorrect"><span class="wqb-tooltip-icon">❌</span> ${incorrect}</div>
       <div class="wqb-tooltip-stat"><span class="wqb-tooltip-icon">📈</span> ${accuracy}%</div>`
    : `<div class="wqb-tooltip-stat"><span class="wqb-tooltip-icon">📊</span> Total: <span class="wqb-tooltip-value">${total}</span></div>
       <div class="wqb-tooltip-stat wqb-tooltip-correct"><span class="wqb-tooltip-icon">✅</span> Correct: <span class="wqb-tooltip-value">${correct}</span></div>
       <div class="wqb-tooltip-stat wqb-tooltip-incorrect"><span class="wqb-tooltip-icon">❌</span> Incorrect: <span class="wqb-tooltip-value">${incorrect}</span></div>
       <div class="wqb-tooltip-stat"><span class="wqb-tooltip-icon">📈</span> Accuracy: <span class="wqb-tooltip-value">${accuracy}%</span></div>`

  return `<div class="wqb-tooltip-content ${compactClass}">
            <div class="wqb-tooltip-header">${dateStr}</div>
            <div class="wqb-tooltip-stats">${statsHtml}</div>
          </div>`
}


/**
 * Enhanced cleanup function with ResizeObserver support
 */
function cleanupExistingInstance(itemSelector) {
  const instance = heatmapInstances.get(itemSelector)
  if (instance) {
    try {
      instance.cal?.destroy()
      instance.cleanup?.()
    } catch (error) {
      console.warn("Error cleaning up heatmap instance:", error)
    }
    heatmapInstances.delete(itemSelector)
  }

  const observer = containerObservers.get(itemSelector)
  if (observer) {
    observer.disconnect()
    containerObservers.delete(itemSelector)
  }

  const container = document.querySelector(itemSelector)
  if (container) {
    container.innerHTML = ""
    container.style.opacity = "0"
  }
}

/**
 * Main heatmap initialization with container-aware sizing
 */
async function initializeHeatmap(options) {
  const {
    itemSelector,
    heatmapData = [],
    colorDomain = [1, 20, 50, 100],
    forceResponsive = true,
    useContainerSize = true,
  } = options

  if (!CalHeatmap) throw new Error("CalHeatmap library not loaded")
  const container = document.querySelector(itemSelector)
  if (!container) throw new Error(`Container not found: ${itemSelector}`)

  cleanupExistingInstance(itemSelector)

  container.style.minHeight = "150px"

  await waitForFontsReady()
  const { width: containerWidth } = await waitForStableWidth(container)

  const config = forceResponsive ? getResponsiveConfig(containerWidth, window.innerWidth) : {}
  
  const today = dayjs().startOf("day")
  const startDate = dayjs().subtract(config.monthsToShow || 6, "month").startOf("day")

  const cal = new CalHeatmap()
  const calConfig = {
    itemSelector,
    domain: { type: "month", label: { text: config.domainLabelText, textAlign: "start", position: "top" } },
    subDomain: { type: "ghDay", radius: config.subDomainRadius, width: config.subDomainWidth, height: config.subDomainHeight, gutter: config.subDomainGutter },
    data: { source: heatmapData, x: "date", y: "total" },
    date: { 
        start: startDate.toDate(), 
        end: today.toDate(),
        highlight: [dayjs().toDate()],
        locale: "en" 
    },
    range: (config.monthsToShow || 6) + 1,
    scale: { color: { type: "threshold", range: ["#ebedf0", "#c6e48b", "#7bc96f", "#23a3b", "#196127"], domain: colorDomain } },
  }

  const plugins = []
  if (window.Tooltip && window.Popper && dayjs) {
      plugins.push([
          window.Tooltip,
          {
              text: (date, value, dayjsDate) => createTooltipContent(dayjsDate || date, heatmapData, config.tooltipCompact)
          }
      ]);
  }

  await cal.paint(calConfig, plugins)
  
  requestAnimationFrame(() => {
    const svg = container.querySelector("svg")
    if (svg) {
        try {
            const bbox = svg.getBBox()
            if (bbox.width && bbox.height) {
                // FIX: Add a vertical buffer to the viewBox to prevent clipping at the top and bottom.
                // The -5 y-offset adds space at the top, and height + 10 ensures space at the bottom.
                svg.setAttribute("viewBox", `0 -5 ${bbox.width} ${bbox.height + 10}`)
                svg.removeAttribute("width")
                svg.removeAttribute("height")
            }
        } catch(e) {
            console.warn("Could not get BBox of SVG.", e);
        }
    }
    highlightToday(container)
    container.style.transition = "opacity 0.3s ease-in-out"
    container.style.opacity = "1"
  });

  const cleanup = setupResponsiveHandlers(itemSelector, heatmapData, options)
  heatmapInstances.set(itemSelector, { cal, cleanup, config, lastWidth: containerWidth })
  
  return heatmapInstances.get(itemSelector)
}

/**
 * Setup both ResizeObserver and traditional resize handlers
 */
function setupResponsiveHandlers(itemSelector, heatmapData, options = {}) {
  const container = document.querySelector(itemSelector)
  if (!container) return () => {}

  let resizeTimeout
  let isHandling = false

  const handleResize = () => {
    if (isHandling) return;

    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      const storedInstance = heatmapInstances.get(itemSelector)
      if (!storedInstance) return;

      const newWidth = container.getBoundingClientRect().width;
      const widthChange = Math.abs(newWidth - storedInstance.lastWidth);
      const newConfig = getResponsiveConfig(newWidth, window.innerWidth);
      
      // Re-initialize if the breakpoint changes or a significant resize occurs
      if (newConfig.breakpoint !== storedInstance.config.breakpoint || widthChange > 100) {
        isHandling = true;
        initializeHeatmap({ itemSelector, heatmapData, ...options })
            .catch(err => console.error("Error re-initializing heatmap", err))
            .finally(() => { isHandling = false; });
      }
    }, 300) // Debounce resize events for smoother experience
  }

  const resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(container)
  containerObservers.set(itemSelector, resizeObserver)

  const cleanup = () => {
    resizeObserver.disconnect()
    containerObservers.delete(itemSelector)
    clearTimeout(resizeTimeout)
  }

  activeResizeHandlers.set(itemSelector, cleanup)
  return cleanup
}

/**
 * Global cleanup function for all heatmap instances
 */
function cleanupAllHeatmaps() {
  heatmapInstances.forEach((_, selector) => cleanupExistingInstance(selector))
}

/**
 * Safe heatmap initializer factory
 */
function createHeatmapInitializer(selector) {
  return (heatmapData) => {
    return initializeHeatmap({
      itemSelector: selector,
      heatmapData,
      forceResponsive: true,
      useContainerSize: true,
    })
  }
}

// Export enhanced API
window.WQBHeatmapUtils = {
  initializeHeatmap,
  cleanupAllHeatmaps,
  initializeDashboardHeatmap: createHeatmapInitializer("#wqb-cal-heatmap"),
  initializeLobbyHeatmap: createHeatmapInitializer("#wqb-lobby-cal-heatmap"),
  initializeStandaloneHeatmap: createHeatmapInitializer("#wqb-standalone-cal-heatmap"),
}

// Cleanup on page unload
window.addEventListener("beforeunload", cleanupAllHeatmaps)