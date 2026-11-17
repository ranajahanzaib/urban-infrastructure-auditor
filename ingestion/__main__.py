"""
CLI Entrypoint for Data Ingestion:
  python -m ingestion import construction
  python -m ingestion import green-infrastructure
  python -m ingestion import all
  python -m ingestion status
  python -m ingestion retry-failed
"""

import sys
import argparse
import json
from ingestion.cli.importer import DatasetImporter, DEFAULT_DB_URL

def main():
    parser = argparse.ArgumentParser(description="Urban Infrastructure Auditor Data Ingestion CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Import command
    import_parser = subparsers.add_parser("import", help="Import dataset records into the platform")
    import_parser.add_argument("dataset", choices=["construction", "green-infrastructure", "all"], help="Dataset to import")
    import_parser.add_argument("--limit", type=int, default=None, help="Maximum number of rows to import")
    import_parser.add_argument("--batch-size", type=int, default=1000, help="Batch insertion size")
    import_parser.add_argument("--feature", action="append", dest="features", help="Filter by feature label")
    import_parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="PostgreSQL connection string")
    import_parser.add_argument("--storage-dir", default="data/storage", help="Local image storage directory")
    import_parser.add_argument("--force", action="store_true", help="Force reimport existing records")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show ingestion statistics and database counts")
    status_parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="PostgreSQL connection string")

    # Retry failed command
    retry_parser = subparsers.add_parser("retry-failed", help="Retry failed records or image resolutions")
    retry_parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="PostgreSQL connection string")

    args = parser.parse_args()
    importer = DatasetImporter(db_url=args.db_url, storage_dir=getattr(args, "storage_dir", "data/storage"))

    if args.command == "import":
        target_datasets = []
        if args.dataset == "all":
            target_datasets = ["construction", "green-infrastructure"]
        else:
            target_datasets = [args.dataset]

        for ds in target_datasets:
            print(f"=== Running import for: {ds} (limit={args.limit}) ===")
            result = importer.run_import(
                dataset_key=ds,
                limit=args.limit,
                batch_size=args.batch_size,
                feature_filter=args.features,
                force=args.force
            )
            print(json.dumps(result, indent=2))

    elif args.command == "status":
        stats = importer.get_status()
        print("=== Urban Infrastructure Ingestion Status ===")
        print(f"Total Observations: {stats['total_observations']}")
        print("\nDatasets:")
        for d in stats["datasets"]:
            print(f"  - {d['display_name']} ({d['id']}):")
            print(f"      Imported: {d['imported_records']} | Images available: {d['image_records']}")
            print(f"      SigLIP embeddings: {d['siglip_embedded_count']} | DINOv2 embeddings: {d['dinov2_embedded_count']}")
            print(f"      Quarantined: {d['quarantined_count']} | Analyst reviewed: {d['reviewed_count']}")
        print("\nRecent Import Jobs:")
        for job in stats["recent_jobs"]:
            print(f"  - Job {job['id']} [{job['dataset_id']}]: {job['status']} ({job['imported_rows']} rows, {job['images_resolved']} images)")

    elif args.command == "retry-failed":
        print("Retrying failed image resolution checks...")
        stats = importer.get_status()
        print(f"Current total observations: {stats['total_observations']}")

if __name__ == "__main__":
    main()
