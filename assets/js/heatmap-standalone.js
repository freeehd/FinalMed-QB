// Only declare if not already declared
const jQuery = window.jQuery


jQuery(document).ready(($) => {
  const heatmapRoot = $("#wqb-user-heatmap-container")
  // wqb_heatmap_data is localized from Frontend.php
  const heatmapData = window.wqb_heatmap_data ? window.wqb_heatmap_data.data : []

  if (heatmapRoot.length === 0) {
    return // Exit if the heatmap element isn't on the page
  }

  initializeStandaloneHeatmap(heatmapData)

  function initializeStandaloneHeatmap(heatmapData) {
    if (window.WQBHeatmapUtils && window.WQBHeatmapUtils.initializeStandaloneHeatmap) {
      window.WQBHeatmapUtils.initializeStandaloneHeatmap(heatmapData)
        .then(() => {
          // After initial paint, ensure container alignment remains centered
          const container = document.getElementById('wqb-standalone-cal-heatmap')
          if (container) {
            container.style.textAlign = 'center'
          }
          // Ensure dynamic reflow on resize and iOS viewport changes
          if (window.WQBHeatmapUtils && window.WQBHeatmapUtils.reinitializeHeatmapOnResize) {
            window.WQBHeatmapUtils.reinitializeHeatmapOnResize('#wqb-standalone-cal-heatmap', heatmapData, {})
          }
        })
        .catch((error) => {
          console.error("Failed to initialize standalone heatmap:", error)
        })
    } else {
      console.error("WQBHeatmapUtils not available")
    }
  }
})
