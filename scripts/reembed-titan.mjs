import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import pg from "pg";

const { Pool } = pg;
const modelId = process.env.BEDROCK_EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0";
if (modelId !== "amazon.titan-embed-text-v2:0") {
  throw new Error(`Unapproved embedding model: ${modelId}`);
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2
});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

try {
  const result = await pool.query(
    `SELECT memory_id, derived_context
     FROM derived_memories
     WHERE embedding IS NULL
     ORDER BY created_at`
  );

  for (const row of result.rows) {
    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(
          JSON.stringify({ inputText: row.derived_context, dimensions: 1024, normalize: true })
        )
      })
    );
    const body = JSON.parse(new TextDecoder().decode(response.body));
    if (!Array.isArray(body.embedding) || body.embedding.length !== 1024) {
      throw new Error(`Unexpected embedding for ${row.memory_id}`);
    }

    const vector = `[${body.embedding.join(",")}]`;
    await pool.query(
      `UPDATE derived_memories SET embedding = $2::VECTOR(1024) WHERE memory_id = $1`,
      [row.memory_id, vector]
    );
    console.log(`re-embedded ${row.memory_id}`);
  }
} finally {
  await pool.end();
}
