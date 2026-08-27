# ADR 0028: Atomically create pending memory records

After the current Derived memory and embedding are successfully generated, the backend creates the Check-in, Private entry, and Derived memory in one CockroachDB transaction before retrieval. Bedrock and Titan calls occur outside the database transaction; if the transaction fails, the request returns an explicit persistence failure and leaves no partial private record. The resulting record remains pending until the user submits an outcome.
