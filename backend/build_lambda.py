from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
HANDLER = Path(__file__).with_name("handler.py")
OUTPUT = ROOT / "dist" / "brukiz-contacts-lambda.zip"

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
    archive.write(HANDLER, "handler.py")

print(f"Lambda Python ZIP generado: {OUTPUT}")
