# ADR 0022: Hide vector similarity scores from the model

The backend uses vector similarity scores to filter and rank retrieved memories but does not expose the numeric scores to Nova Lite. The model receives only the ordered, thresholded Derived memory results and their allowed metadata. This keeps ranking and relevance policy application-owned and prevents the recommendation prompt from depending on database-specific scoring details.
