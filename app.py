import os
import logging
import requests
import json
from flask import Flask, request, jsonify, render_template
from jsonschema import validate, ValidationError
from urllib.parse import urlparse
from schema import url_list_schema

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET")

# List of common security headers to check for
SECURITY_HEADERS = [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "Referrer-Policy",
    "Permissions-Policy",
    "Access-Control-Allow-Origin",
    "Cache-Control",
    "Set-Cookie",  # Check for secure flags in cookies
    "Feature-Policy",
    "Expect-CT"
]

@app.route('/')
def index():
    """Render the main page with UI for URL submission."""
    return render_template('index.html')

@app.route('/api/scan', methods=['POST'])
def scan_urls():
    """
    Process a list of URLs and check their security headers.
    
    Expects a JSON payload with a list of URLs in the format:
    {
        "urls": ["https://example.com", "https://example.org"]
    }
    """
    try:
        # Get and validate request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate the schema of the input
        validate(instance=data, schema=url_list_schema)
        
        urls = data.get('urls', [])
        if not urls:
            return jsonify({"error": "No URLs provided"}), 400
        
        # Process each URL and collect headers
        results = []
        for url in urls:
            result = process_url(url)
            results.append(result)
        
        return jsonify({"results": results}), 200
    
    except ValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": "Invalid request format", "details": str(e)}), 400
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Server error", "details": str(e)}), 500

def process_url(url):
    """
    Process a URL by making a GET request and extracting security headers.
    
    Args:
        url (str): The URL to check
        
    Returns:
        dict: A dictionary containing the URL and its security headers
    """
    result = {
        "url": url,
        "status": "success",
        "status_code": None,
        "headers": {},
        "missing_headers": [],
        "error": None
    }
    
    try:
        # Validate URL format
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            result["status"] = "error"
            result["error"] = "Invalid URL format"
            return result
        
        # Make the request with a reasonable timeout
        response = requests.get(url, timeout=10, allow_redirects=True, 
                               headers={'User-Agent': 'Security Header Scanner/1.0'})
        result["status_code"] = response.status_code
        
        # Process security headers
        found_headers = {}
        missing_headers = []
        
        for header in SECURITY_HEADERS:
            if header.lower() in {k.lower() for k in response.headers.keys()}:
                # Find the actual header name with original case
                header_key = next((k for k in response.headers.keys() if k.lower() == header.lower()), None)
                found_headers[header_key] = response.headers[header_key]
            else:
                missing_headers.append(header)
        
        result["headers"] = found_headers
        result["missing_headers"] = missing_headers
        
    except requests.exceptions.Timeout:
        result["status"] = "error"
        result["error"] = "Request timed out"
    
    except requests.exceptions.ConnectionError:
        result["status"] = "error"
        result["error"] = "Connection error"
    
    except requests.exceptions.RequestException as e:
        result["status"] = "error"
        result["error"] = f"Request failed: {str(e)}"
    
    except Exception as e:
        result["status"] = "error"
        result["error"] = f"Unexpected error: {str(e)}"
        logger.error(f"Error processing URL {url}: {str(e)}")
    
    return result

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
