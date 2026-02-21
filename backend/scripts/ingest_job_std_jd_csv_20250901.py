from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select

from app.db.session import AsyncSessionLocal
from app.models import DocumentModel
from app.services.openai_service import OpenAIService
from app.utils.text import chunk_text

SOURCE_TYPE = 'JOB_STD_JD_CSV_20250901'
DEFAULT_CSV_PATH = '/mnt/data/한국고용정보원_구인표준직무기술서_20250901.csv'
ENCODING_CANDIDATES = ('euc-kr', 'cp949')
REQUIRED_COLS = {
    'occupation': '직종',
    'job_summary': '표준직무내용',
    'skills': '표준직무능력내용',
    'majors': '표준직무전공내용',
    'certs': '표준직무자격증내용',
}


@dataclass
class RowFailure:
    row_index: int
    doc_key: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            'row_index': self.row_index,
            'doc_key': self.doc_key,
            'reason': self.reason,
        }


@dataclass
class RowDoc:
    row_index: int
    source_id: str
    source_type: str
    title: str
    content: str
    metadata: dict[str, Any]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Ingest CSV(구인표준직무기술서) into documents table with embeddings.',
    )
    parser.add_argument('--csv-path', default=DEFAULT_CSV_PATH)
    parser.add_argument('--batch-size', type=int, default=300)
    parser.add_argument('--chunk-size', type=int, default=1800)
    parser.add_argument('--chunk-overlap', type=int, default=180)
    parser.add_argument('--max-items-per-section', type=int, default=40)
    parser.add_argument('--limit-rows', type=int, default=0)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--summary-path', default='')
    parser.add_argument('--failed-rows-path', default='')
    parser.add_argument('--verbose', action='store_true')
    return parser.parse_args()


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format='%(asctime)s %(levelname)s %(message)s',
    )
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)


def clean_text(value: Any) -> str:
    if value is None:
        return ''
    text = str(value)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def normalize_header(header: str) -> str:
    return clean_text(header).replace('\ufeff', '').replace(' ', '')


def resolve_csv_path(path_arg: str) -> Path:
    requested = Path(path_arg).expanduser()
    if requested.exists():
        return requested

    # Local fallback for this workspace.
    fallback = Path('/Users/orca/Downloads/한국고용정보원_구인표준직무기술서_20250901.csv')
    if fallback.exists():
        logging.warning('CSV path not found, falling back to %s', fallback)
        return fallback

    raise FileNotFoundError(f'CSV file not found: {requested}')


def load_csv_rows(csv_path: Path) -> tuple[list[dict[str, str]], str]:
    last_error: Exception | None = None
    for enc in ENCODING_CANDIDATES:
        try:
            with csv_path.open('r', encoding=enc, newline='') as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    raise ValueError('CSV header is missing')

                field_map = {normalize_header(name): name for name in reader.fieldnames if name}
                resolved_cols: dict[str, str] = {}
                for key, korean_name in REQUIRED_COLS.items():
                    norm = normalize_header(korean_name)
                    if norm not in field_map:
                        raise ValueError(f'Missing required column: {korean_name}')
                    resolved_cols[key] = field_map[norm]

                rows: list[dict[str, str]] = []
                for row in reader:
                    rows.append(
                        {
                            'occupation': clean_text(row.get(resolved_cols['occupation'])),
                            'job_summary': clean_text(row.get(resolved_cols['job_summary'])),
                            'skills': clean_text(row.get(resolved_cols['skills'])),
                            'majors': clean_text(row.get(resolved_cols['majors'])),
                            'certs': clean_text(row.get(resolved_cols['certs'])),
                        }
                    )
                return rows, enc
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            continue

    raise RuntimeError(f'Failed to read CSV with encodings {ENCODING_CANDIDATES}: {last_error}')


def split_items(text: str, max_items: int) -> tuple[list[str], int]:
    if not text:
        return [], 0
    raw_items = [clean_text(item) for item in text.split(',')]
    filtered = [item for item in raw_items if item]
    if len(filtered) <= max_items or max_items <= 0:
        return filtered, 0
    kept = filtered[:max_items]
    omitted = len(filtered) - max_items
    return kept, omitted


def build_doc_key(source_type: str, occupation: str, job_summary: str) -> tuple[str, str]:
    raw = f'{source_type}:{occupation}:{job_summary}'
    digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    source_id = f'{source_type}:{digest}'
    return source_id, raw


def build_row_doc(
    *,
    row_index: int,
    row: dict[str, str],
    file_name: str,
    max_items_per_section: int,
) -> RowDoc:
    occupation = row['occupation']
    job_summary = row['job_summary']
    if not occupation or not job_summary:
        raise ValueError('occupation/job_summary is empty')

    source_id, raw_doc_key = build_doc_key(SOURCE_TYPE, occupation, job_summary)
    title = f'{occupation} / {job_summary}'

    skill_items, skill_omitted = split_items(row['skills'], max_items_per_section)
    major_items, major_omitted = split_items(row['majors'], max_items_per_section)
    cert_items, cert_omitted = split_items(row['certs'], max_items_per_section)

    lines: list[str] = []
    lines.append(title)
    lines.append('')

    lines.append('표준직무능력내용:')
    if skill_items:
        lines.extend(f'- {item}' for item in skill_items)
        if skill_omitted > 0:
            lines.append(f'- (외 {skill_omitted}개)')
    else:
        lines.append('- 정보 없음')
    lines.append('')

    lines.append('표준직무전공내용:')
    if major_items:
        lines.extend(f'- {item}' for item in major_items)
        if major_omitted > 0:
            lines.append(f'- (외 {major_omitted}개)')
    else:
        lines.append('- 정보 없음')
    lines.append('')

    lines.append('표준직무자격증내용:')
    if cert_items:
        lines.extend(f'- {item}' for item in cert_items)
        if cert_omitted > 0:
            lines.append(f'- (외 {cert_omitted}개)')
    else:
        lines.append('- 정보 없음')

    content = '\n'.join(lines).strip()
    metadata = {
        'source_type': SOURCE_TYPE,
        'doc_key_raw': raw_doc_key,
        'occupation': occupation,
        'job_summary': job_summary,
        'row_index': row_index,
        'file_name': file_name,
        'ingested_at': datetime.now(timezone.utc).isoformat(),
    }
    return RowDoc(
        row_index=row_index,
        source_id=source_id,
        source_type=SOURCE_TYPE,
        title=title,
        content=content,
        metadata=metadata,
    )


def chunked(items: list[RowDoc], size: int) -> list[list[RowDoc]]:
    if size <= 0:
        size = 300
    return [items[i : i + size] for i in range(0, len(items), size)]


async def upsert_batch(
    *,
    batch_docs: list[RowDoc],
    chunk_size: int,
    chunk_overlap: int,
    dry_run: bool,
    openai_service: OpenAIService,
) -> tuple[int, int, int, list[RowFailure]]:
    inserted = 0
    updated = 0
    succeeded = 0
    failures: list[RowFailure] = []

    async with AsyncSessionLocal() as db:
        source_ids = [doc.source_id for doc in batch_docs]
        existing_q = select(DocumentModel.source_id).where(
            DocumentModel.source_type == SOURCE_TYPE,
            DocumentModel.source_id.in_(source_ids),
        )
        existing_rows = (await db.execute(existing_q)).scalars().all()
        existing_ids = set(existing_rows)

        if dry_run:
            for doc in batch_docs:
                if doc.source_id in existing_ids:
                    updated += 1
                else:
                    inserted += 1
                succeeded += 1
            return succeeded, inserted, updated, failures

        for doc in batch_docs:
            try:
                async with db.begin_nested():
                    was_existing = doc.source_id in existing_ids
                    await db.execute(
                        delete(DocumentModel).where(
                            DocumentModel.source_type == SOURCE_TYPE,
                            DocumentModel.source_id == doc.source_id,
                        )
                    )

                    chunks = chunk_text(doc.content, chunk_size=chunk_size, chunk_overlap=chunk_overlap) or [
                        doc.content
                    ]
                    for chunk_idx, chunk in enumerate(chunks):
                        emb = await openai_service.create_embedding(chunk)
                        db.add(
                            DocumentModel(
                                source_id=doc.source_id,
                                source_type=doc.source_type,
                                title=doc.title if chunk_idx == 0 else f'{doc.title} [part {chunk_idx + 1}]',
                                chunk_index=chunk_idx,
                                content=chunk,
                                metadata_json={
                                    **doc.metadata,
                                    'chunk_index': chunk_idx,
                                    'chunk_total': len(chunks),
                                },
                                embedding=emb,
                            )
                        )

                    if was_existing:
                        updated += 1
                    else:
                        inserted += 1
                    succeeded += 1
            except Exception as exc:  # noqa: BLE001
                failures.append(
                    RowFailure(
                        row_index=doc.row_index,
                        doc_key=doc.source_id,
                        reason=f'{type(exc).__name__}: {exc}',
                    )
                )
                continue

        await db.commit()

    return succeeded, inserted, updated, failures


async def run_ingestion(args: argparse.Namespace) -> dict[str, Any]:
    started_at = time.perf_counter()
    csv_path = resolve_csv_path(args.csv_path)
    file_name = os.path.basename(csv_path)
    rows, encoding_used = load_csv_rows(csv_path)
    if args.limit_rows and args.limit_rows > 0:
        rows = rows[: args.limit_rows]

    prepared_docs: list[RowDoc] = []
    failures: list[RowFailure] = []

    for idx, row in enumerate(rows, start=1):
        try:
            doc = build_row_doc(
                row_index=idx,
                row=row,
                file_name=file_name,
                max_items_per_section=args.max_items_per_section,
            )
            prepared_docs.append(doc)
        except Exception as exc:  # noqa: BLE001
            failures.append(
                RowFailure(
                    row_index=idx,
                    doc_key='',
                    reason=f'row_parse_error: {type(exc).__name__}: {exc}',
                )
            )

    openai_service = OpenAIService()
    total_success = 0
    total_inserted = 0
    total_updated = 0

    for batch in chunked(prepared_docs, args.batch_size):
        succ, ins, upd, batch_failures = await upsert_batch(
            batch_docs=batch,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
            dry_run=args.dry_run,
            openai_service=openai_service,
        )
        total_success += succ
        total_inserted += ins
        total_updated += upd
        failures.extend(batch_failures)

    elapsed_sec = round(time.perf_counter() - started_at, 3)
    summary = {
        'source_type': SOURCE_TYPE,
        'dry_run': bool(args.dry_run),
        'csv_path': str(csv_path),
        'encoding_used': encoding_used,
        'total_rows': len(rows),
        'prepared_rows': len(prepared_docs),
        'success_rows': total_success,
        'inserted_rows': total_inserted,
        'updated_rows': total_updated,
        'failed_rows': len(failures),
        'duration_sec': elapsed_sec,
        'failures': [f.to_dict() for f in failures],
    }
    return summary


def main() -> None:
    args = parse_args()
    setup_logging(args.verbose)
    summary = asyncio.run(run_ingestion(args))

    if args.summary_path:
        summary_path = Path(args.summary_path).expanduser().resolve()
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
        logging.info('Summary written: %s', summary_path)

    if args.failed_rows_path and summary.get('failures'):
        failed_path = Path(args.failed_rows_path).expanduser().resolve()
        failed_path.write_text(
            json.dumps(summary['failures'], ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        logging.info('Failed rows written: %s', failed_path)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
