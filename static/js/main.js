document.addEventListener('DOMContentLoaded', function() {
    const scanForm = document.getElementById('scanForm');
    const urlInput = document.getElementById('urlInput');
    const scanButton = document.getElementById('scanButton');
    const spinnerIcon = document.getElementById('spinnerIcon');
    const resultsContainer = document.getElementById('resultsContainer');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');

    scanForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous results
        resultsContainer.innerHTML = '';
        errorAlert.classList.add('d-none');
        
        // Get URLs from textarea, split by newline and remove empty lines
        const urls = urlInput.value.split('\n')
            .map(url => url.trim())
            .filter(url => url !== '');
        
        if (urls.length === 0) {
            showError('Please enter at least one URL');
            return;
        }

        // Show loading state
        setLoadingState(true);
        
        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ urls: urls })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                showError(data.error || 'Failed to scan URLs');
                return;
            }
            
            displayResults(data.results);
        } catch (error) {
            showError('An error occurred while scanning: ' + error.message);
        } finally {
            setLoadingState(false);
        }
    });

    function setLoadingState(isLoading) {
        if (isLoading) {
            scanButton.disabled = true;
            spinnerIcon.classList.remove('d-none');
        } else {
            scanButton.disabled = false;
            spinnerIcon.classList.add('d-none');
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorAlert.classList.remove('d-none');
    }

    function displayResults(results) {
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<div class="alert alert-info">No results to display</div>';
            return;
        }

        const resultsHTML = results.map(result => {
            const isSuccess = result.status === 'success';
            const cardClass = isSuccess ? 'border-success' : 'border-danger';
            const statusBadgeClass = isSuccess ? 'bg-success' : 'bg-danger';
            
            // Create header rows
            let headersHTML = '';
            if (isSuccess) {
                if (Object.keys(result.headers).length > 0) {
                    headersHTML = Object.entries(result.headers).map(([name, value]) => `
                        <tr>
                            <td class="header-name present-header">${escapeHtml(name)}</td>
                            <td>${escapeHtml(value)}</td>
                        </tr>
                    `).join('');
                }
                
                // Add missing headers
                if (result.missing_headers && result.missing_headers.length > 0) {
                    headersHTML += result.missing_headers.map(header => `
                        <tr>
                            <td class="header-name missing-header">${escapeHtml(header)}</td>
                            <td><span class="badge bg-danger">Missing</span></td>
                        </tr>
                    `).join('');
                }
            }

            return `
                <div class="card url-card ${cardClass}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">${escapeHtml(result.url)}</h5>
                        <span class="badge ${statusBadgeClass}">
                            ${isSuccess ? (result.status_code || 'Success') : 'Failed'}
                        </span>
                    </div>
                    <div class="card-body">
                        ${isSuccess ? `
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>Header Name</th>
                                            <th>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${headersHTML || '<tr><td colspan="2">No headers found</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="alert alert-danger">
                                ${escapeHtml(result.error || 'Unknown error')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHTML;
    }

    // Helper function to escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
