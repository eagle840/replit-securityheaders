# Schema definition for request validation

# Schema for the URL list request
url_list_schema = {
    "type": "object",
    "properties": {
        "urls": {
            "type": "array",
            "items": {
                "type": "string",
                "format": "uri"
            },
            "minItems": 1
        }
    },
    "required": ["urls"]
}
