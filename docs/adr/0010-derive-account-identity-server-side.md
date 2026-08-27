# Derive Personal account identity server-side

Backend requests will verify the Cognito identity token and derive the Personal account from its subject. The browser may submit the Check-in but may not choose the account identifier used for CockroachDB reads, writes, deletion, forgetting, or outcome recording.
