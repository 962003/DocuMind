import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_elasticsearch import ElasticsearchStore

from config import *
from rag.embeddings import embeddings


def ingest_pdf(file_path: str):
    # 1️⃣ Load PDF
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    if not documents:
        return 0

    # 2️⃣ Chunk
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )

    chunks = splitter.split_documents(documents)

    # 3️⃣ Store in Elasticsearch
    ElasticsearchStore.from_documents(
        documents=chunks,
        embedding=embeddings,
        index_name=INDEX_NAME,
        es_url=ELASTIC_URL,
        es_user=ELASTIC_USER,
        es_password=ELASTIC_PASSWORD,
    )

    return len(chunks)