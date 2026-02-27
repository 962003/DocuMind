from app.services.ingestion import process_pdf_document_job
from app.worker.celery_app import celery_app


@celery_app.task(
    bind=True,
    name="ingestion.process_pdf_document",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def process_pdf_document_task(self, document_id: str, file_path: str) -> None:
    process_pdf_document_job(document_id=document_id, file_path=file_path)
