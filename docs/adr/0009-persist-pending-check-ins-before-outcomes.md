# Persist pending Check-ins before Pivot outcomes

When a person has consented and enabled saving, the backend will persist the Check-in, Private entry, and Derived memory before recommendation delivery, with selected Pivot and outcome fields initially empty. Retrieval will ignore records without a helpful outcome; completing or abandoning the flow updates or removes the pending record respectively.
