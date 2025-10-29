-- Create table to support retrieval augmented generation vector index
CREATE TABLE IF NOT EXISTS vector_index (
  doc_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (doc_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS vector_index_doc_id_idx ON vector_index (doc_id);
