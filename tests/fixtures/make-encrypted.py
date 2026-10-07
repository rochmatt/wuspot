#!/usr/bin/env python3
"""Membuat tests/fixtures/out/encrypted.pdf dari mixed.pdf.

User password "rahasia" (wajib untuk membuka), owner password terpisah.
AES-256 (R6), seperti PDF terkunci yang dibuat aplikasi modern.
Jalankan setelah make-fixtures.mjs (npm run fixtures menjalankan keduanya).
"""

from pathlib import Path
import sys

try:
    import pikepdf
except ImportError:  # pragma: no cover - pesan untuk pengembang
    sys.exit("pikepdf belum terpasang: pip install pikepdf")

OUT = Path(__file__).resolve().parent / "out"
SOURCE = OUT / "mixed.pdf"
TARGET = OUT / "encrypted.pdf"
USER_PASSWORD = "rahasia"
OWNER_PASSWORD = "pemilik-wuspot"


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"{SOURCE} belum ada. Jalankan dulu: node tests/fixtures/make-fixtures.mjs")
    with pikepdf.open(SOURCE) as pdf:
        pdf.save(
            TARGET,
            encryption=pikepdf.Encryption(user=USER_PASSWORD, owner=OWNER_PASSWORD, R=6),
            # Tanpa /ID acak & tanggal baru supaya ukuran stabil antar pembuatan.
            static_id=True,
        )
    # Cek: tanpa password harus ditolak, dengan password harus terbuka.
    try:
        pikepdf.open(TARGET).close()
        sys.exit("encrypted.pdf ternyata bisa dibuka tanpa password")
    except pikepdf.PasswordError:
        pass
    with pikepdf.open(TARGET, password=USER_PASSWORD) as pdf:
        pages = len(pdf.pages)
    print(f"encrypted.pdf    {TARGET.stat().st_size / 1024:9.1f} KB  ({pages} halaman, password '{USER_PASSWORD}')")


if __name__ == "__main__":
    main()
