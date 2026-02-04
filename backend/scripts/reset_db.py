from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "app.db"
UPLOADS_DIR = ROOT / "public" / "uploads"


def main():
    if DB_PATH.exists():
        DB_PATH.unlink()
        print("Deleted app.db")
    else:
        print("app.db not found")

    if UPLOADS_DIR.exists():
        for item in UPLOADS_DIR.iterdir():
            if item.is_file() and item.name != ".gitkeep":
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
        print("Cleared uploads")
    else:
        print("uploads directory not found")


if __name__ == "__main__":
    main()
