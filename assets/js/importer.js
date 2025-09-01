jQuery(document).ready(function($) {
    const form = $('#wqb-importer-form');
    const progressBarContainer = $('#wqb-progress-container');
    const progressBar = $('#wqb-progress-bar');
    const progressText = $('#wqb-progress-text');
    const statusLog = $('#wqb-status-log');
    const submitButton = form.find('input[type="submit"]');

    let totalRows = 0;
    let processedRows = 0;

    form.on('submit', function(e) {
        e.preventDefault();

        const fileInput = $('#wqb_csv_file')[0];
        if (fileInput.files.length === 0) {
            alert('Please select a file to import.');
            return;
        }

        // Improvement: File type validation
        const fileName = fileInput.files[0].name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        if (fileExtension !== 'csv') {
            alert('Error: Please select a valid .csv file.');
            return;
        }
        
        // Improvement: Confirmation prompt
        if (!confirm('Are you sure you want to import questions from "' + fileName + '"?')) {
            return;
        }

        submitButton.prop('disabled', true);
        progressBar.css('width', '0%');
        progressText.text('0%');
        statusLog.html('');
        progressBarContainer.show();
        statusLog.show();
        logMessage('Uploading file...', 'info');

        // NEW: Read and preprocess the CSV file for text formatting
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const csvContent = e.target.result;
            const processedContent = preprocessCSVContent(csvContent);
            
            // Create a new File object with processed content
            const processedFile = new File([processedContent], fileName, {
                type: 'text/csv',
                lastModified: file.lastModified
            });
            
            uploadProcessedFile(processedFile);
        };
        
        reader.onerror = function() {
            logMessage('Error reading file. Please try again.', 'error');
            submitButton.prop('disabled', false);
        };
        
        reader.readAsText(file, 'UTF-8');
    });

    // NEW: Function to preprocess CSV content for proper text formatting
    function preprocessCSVContent(csvContent) {
        logMessage('Preprocessing CSV content for text formatting...', 'info');
        
        // Split into lines while preserving quoted content
        const lines = parseCSVLines(csvContent);
        const processedLines = [];
        
        lines.forEach((line, index) => {
            if (index === 0) {
                // Keep header as-is
                processedLines.push(line);
                return;
            }
            
            // Parse the CSV line into fields
            const fields = parseCSVLine(line);
            
            if (fields.length >= 8) { // Ensure we have all required fields
                // Process each field for text formatting
                const processedFields = fields.map((field, fieldIndex) => {
                    return processTextField(field, fieldIndex);
                });
                
                // Reconstruct the CSV line
                const processedLine = processedFields.map(field => {
                    // Escape quotes and wrap in quotes if necessary
                    if (field.includes('"') || field.includes(',') || field.includes('\n') || field.includes('\r')) {
                        return '"' + field.replace(/"/g, '""') + '"';
                    }
                    return field;
                }).join(',');
                
                processedLines.push(processedLine);
            } else {
                // Keep malformed lines as-is for error handling
                processedLines.push(line);
            }
        });
        
        return processedLines.join('\n');
    }

    // NEW: Function to parse CSV lines while handling quoted content
    function parseCSVLines(csvContent) {
        const lines = [];
        let currentLine = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < csvContent.length) {
            const char = csvContent[i];
            const nextChar = csvContent[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentLine += '""';
                    i += 2;
                    continue;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                // End of line outside quotes
                if (currentLine.trim()) {
                    lines.push(currentLine);
                }
                currentLine = '';
                // Skip \r\n combinations
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                i++;
                continue;
            }
            
            currentLine += char;
            i++;
        }
        
        // Add the last line if it exists
        if (currentLine.trim()) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    // NEW: Function to parse a single CSV line into fields
    function parseCSVLine(line) {
        const fields = [];
        let currentField = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    currentField += '"';
                    i += 2;
                    continue;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                fields.push(currentField);
                currentField = '';
                i++;
                continue;
            } else {
                currentField += char;
            }
            
            i++;
        }
        
        // Add the last field
        fields.push(currentField);
        
        return fields;
    }
/**
 * Formats the raw explanation text from a CSV into styled HTML.
 * @param {string} rawText The content of the processExplanation field.
 * @returns {string} A string of formatted HTML.
 */
function formatExplanationHtml(rawText) {
    // Return an empty string if the input is null or empty to avoid errors.
    if (!rawText || rawText.trim() === '') {
      return '';
    }
  
    // Split the text into lines and remove any empty lines.
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    let htmlOutput = '';
  
    // Process each line to build the HTML.
    lines.forEach((line, index) => {
      // The first line is always treated as the correct answer explanation.
      if (index === 0) {
        const formattedLine = line.replace(
          /(Correct answer: [A-E]\))/,
          '<strong>$1</strong>'
        );
        htmlOutput += `
          <div class="explanation-block correct-answer">
            <span class="explanation-icon">✅</span>
            <div class="explanation-text">${formattedLine}</div>
          </div>`;
      } else {
        // Subsequent lines are incorrect answers.
        const formattedLine = line.replace(
          /^([A-E]\))/, 
          '<strong>$1</strong>'
        );
        htmlOutput += `
          <div class="explanation-block incorrect-answer">
            <span class="explanation-icon">❌</span>
            <div class="explanation-text">${formattedLine}</div>
          </div>`;
      }
    });
  
    return htmlOutput;
  }
    // NEW: Function to process text fields for proper formatting
    function processTextField(field, fieldIndex) {
        // Field indices based on CSV schema:
        // 0: prompt, 1: categories, 2: subcategories, 3-7: options, 8: correct_choice_index, 9: explanation
        
        const textFields = [0, 3, 4, 5, 6, 7, 9]; // Fields that contain text content
        
        if (!textFields.includes(fieldIndex)) {
            return field; // Return non-text fields as-is
        }
        
        let processedField = field;
        
        // Handle different types of line breaks and formatting
        processedField = processedField
            // Convert literal \n to actual line breaks
            .replace(/\\n/g, '\n')
            // Convert literal \r\n to actual line breaks
            .replace(/\\r\\n/g, '\n')
            // Convert literal \r to actual line breaks
            .replace(/\\r/g, '\n')
            // Handle double line breaks for paragraph separation
            .replace(/\n\s*\n/g, '\n\n')
            // Preserve HTML entities
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            // Handle special characters that might be encoded
            .replace(/&nbsp;/g, ' ')
            // Clean up excessive whitespace but preserve intentional formatting
            .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
            .replace(/\n[ \t]+/g, '\n') // Remove leading whitespace after line breaks
            .replace(/[ \t]+\n/g, '\n') // Remove trailing whitespace before line breaks
            // Trim overall but preserve internal formatting
            .trim();
        
        // Special handling for explanation field (index 9)
        if (fieldIndex === 9) {
            processedField = processExplanationField(processedField);
        }
        
        return processedField;
    }

    // NEW: Special processing for explanation fields
    // NEW: Special processing for explanation fields
function processExplanationField(explanation) {
    return explanation
    .replace(/\n{3,}/g, '\n\n') // Clean up multiple consecutive line breaks
    .trim();
}

    // NEW: Upload the processed file
    function uploadProcessedFile(processedFile) {
        const formData = new FormData();
        formData.append('action', 'wqb_handle_upload');
        formData.append('nonce', $('#wqb_importer_nonce').val());
        formData.append('csv_file', processedFile);
        formData.append('preserve_formatting', '1'); // Flag to indicate formatting should be preserved

        // 1. Initial Upload
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    totalRows = response.data.total_rows;
                    logMessage(`File processed and uploaded successfully. Found ${totalRows} questions to import.`, 'success');
                    logMessage('Text formatting has been preserved for proper display.', 'info');
                    logMessage('Starting import process...', 'info');
                    processChunk(0);
                } else {
                    logMessage('Error: ' + response.data.message, 'error');
                    submitButton.prop('disabled', false);
                }
            },
            error: function(xhr, status, error) {
                logMessage('An error occurred during upload: ' + error, 'error');
                submitButton.prop('disabled', false);
            }
        });
    }

    // 2. Process Chunks (Enhanced with formatting validation)
    function processChunk(offset) {
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'wqb_process_chunk',
                nonce: $('#wqb_importer_nonce').val(),
                offset: offset,
                preserve_formatting: '1' // Ensure formatting is preserved in processing
            },
            dataType: 'json',
            success: function(response) {
                if (response.success) {
                    processedRows += response.data.processed_count;
                    const percentage = totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 100;

                    progressBar.css('width', percentage + '%');
                    progressText.text(percentage + '%');
                    
                    let statusMessage = `Processed ${response.data.processed_count} rows. Total processed: ${processedRows}/${totalRows}.`;
                    
                    // NEW: Add formatting validation feedback
                    if (response.data.formatting_preserved) {
                        statusMessage += ' Text formatting preserved.';
                    }
                    
                    logMessage(statusMessage, 'info');

                    if (response.data.is_done) {
                        logMessage('Import complete! All questions imported with proper text formatting.', 'success');
                        logMessage('Questions are now ready for use in practice tests, reviews, and mock tests.', 'success');
                        cleanupImport();
                    } else {
                        processChunk(response.data.new_offset);
                    }
                } else {
                    logMessage('Error: ' + response.data.message, 'error');
                    submitButton.prop('disabled', false);
                }
            },
            error: function(xhr, status, error) {
                logMessage('A critical error occurred while processing a chunk: ' + error, 'error');
                submitButton.prop('disabled', false);
            }
        });
    }

    // 3. Cleanup (Enhanced with formatting validation)
    function cleanupImport() {
        $.post(ajaxurl, { 
            action: 'wqb_cleanup_import', 
            nonce: $('#wqb_importer_nonce').val(),
            validate_formatting: '1' // Request formatting validation
        }, function(response) {
            if (response && response.success && response.data && response.data.formatting_validated) {
                logMessage('Import cleanup completed. Text formatting validated across all views.', 'success');
            }
        });
        submitButton.prop('disabled', false);
    }

    // Enhanced logging with formatting indicators
    function logMessage(message, type) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `<p class="log-${type}"><span class="log-timestamp">[${timestamp}]</span> ${message}</p>`;
        statusLog.append(logEntry);
        statusLog.scrollTop(statusLog[0].scrollHeight);
    }

    // NEW: Add validation for common formatting issues
    function validateFormattingIntegrity(csvContent) {
        const issues = [];
        
        // Check for unescaped quotes in text content
        const unescapedQuotes = csvContent.match(/[^"]"[^",\n\r]/g);
        if (unescapedQuotes) {
            issues.push(`Found ${unescapedQuotes.length} potentially unescaped quotes`);
        }
        
        // Check for malformed line breaks
        const malformedBreaks = csvContent.match(/[^\\]\\n[^\\]/g);
        if (malformedBreaks) {
            issues.push(`Found ${malformedBreaks.length} potentially malformed line breaks`);
        }
        
        // Check for incomplete CSV rows
        const lines = csvContent.split('\n');
        const expectedFields = 10; // Based on schema
        let incompleteRows = 0;
        
        lines.forEach((line, index) => {
            if (index === 0) return; // Skip header
            if (line.trim() === '') return; // Skip empty lines
            
            const fields = parseCSVLine(line);
            if (fields.length < expectedFields) {
                incompleteRows++;
            }
        });
        
        if (incompleteRows > 0) {
            issues.push(`Found ${incompleteRows} rows with missing fields`);
        }
        
        return issues;
    }

    // NEW: Preview function for testing formatting (optional enhancement)
    function previewFormattedContent(content, maxLength = 200) {
        const preview = content.length > maxLength ? 
            content.substring(0, maxLength) + '...' : 
            content;
        
        return preview
            .replace(/\n/g, '↵') // Show line breaks visually
            .replace(/\t/g, '→'); // Show tabs visually
    }
});
