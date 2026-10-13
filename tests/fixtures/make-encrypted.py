#!/usr/bin/env python3
"""Membuat fixture turunan mixed.pdf yang butuh pikepdf.

- encrypted.pdf : user password "rahasia" (wajib untuk membuka), owner password
                  terpisah. AES-256 (R6), seperti PDF terkunci aplikasi modern.
- protected.pdf : hanya owner password (bisa dibuka tanpa password, tapi salin/
                  edit dibatasi). AES-128 (R4), umum di PDF dari portal/instansi.
- signed.pdf    : punya field tanda tangan digital yang sudah terisi (/V), seperti
                  PDF ber-e-meterai. Tanda tangannya palsu; cukup untuk dideteksi.
- legacy.pdf    : gambar dibungkus ASCII85 ([/ASCII85Decode /DCTDecode] dan
                  [/ASCII85Decode /FlateDecode]), seperti keluaran reportlab/xhtml2pdf.
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
PROTECTED = OUT / "protected.pdf"
SIGNED = OUT / "signed.pdf"
LEGACY = OUT / "legacy.pdf"
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

    with pikepdf.open(SOURCE) as pdf:
        pdf.save(
            PROTECTED,
            encryption=pikepdf.Encryption(
                user="",
                owner=OWNER_PASSWORD,
                R=4,
                aes=True,
                allow=pikepdf.Permissions(extract=False, modify_other=False, modify_annotation=False),
            ),
            static_id=True,
        )
    with pikepdf.open(PROTECTED) as pdf:
        assert pdf.is_encrypted, "protected.pdf harus terenkripsi"
        pages = len(pdf.pages)
    print(f"protected.pdf    {PROTECTED.stat().st_size / 1024:9.1f} KB  ({pages} halaman, tanpa password pembuka)")

    make_signed()
    make_legacy()


def make_signed() -> None:
    from pikepdf import Array, Dictionary, Name, String

    with pikepdf.open(SOURCE) as pdf:
        sig = pdf.make_indirect(
            Dictionary(
                Type=Name.Sig,
                Filter=Name("/Adobe.PPKLite"),
                SubFilter=Name("/adbe.pkcs7.detached"),
                ByteRange=Array([0, 0, 0, 0]),
                Contents=String(b"\x00" * 64),
                Name=String("Contoh e-meterai"),
            )
        )
        page = pdf.pages[0].obj
        field = pdf.make_indirect(
            Dictionary(
                Type=Name.Annot,
                Subtype=Name.Widget,
                FT=Name.Sig,
                T=String("Tanda tangan"),
                V=sig,
                Rect=Array([0, 0, 0, 0]),
                F=132,
                P=page,
            )
        )
        page.Annots = Array([field])
        pdf.Root.AcroForm = Dictionary(Fields=Array([field]), SigFlags=3)
        pdf.save(SIGNED, static_id=True)
    print(f"signed.pdf       {SIGNED.stat().st_size / 1024:9.1f} KB  (field tanda tangan terisi)")



def make_legacy() -> None:
    import base64

    from pikepdf import Array, Name

    with pikepdf.open(SOURCE) as pdf:
        wrapped = 0
        for obj in pdf.objects:
            if not isinstance(obj, pikepdf.Stream) or obj.get("/Subtype") != Name.Image:
                continue
            filt = obj.get("/Filter")
            name = filt[0] if isinstance(filt, Array) and len(filt) == 1 else filt
            if name not in (Name.DCTDecode, Name.FlateDecode):
                continue
            raw = obj.read_raw_bytes()
            parms = obj.get("/DecodeParms")
            if isinstance(parms, Array):
                parms = parms[0] if len(parms) else None
            obj.write(
                base64.a85encode(raw) + b"~>",
                filter=Array([Name.ASCII85Decode, name]),
                decode_parms=Array([None, parms]) if parms is not None else None,
            )
            wrapped += 1
        assert wrapped >= 2, "legacy.pdf harus punya gambar ASCII85"
        # Tanpa ini qpdf membuka lagi rantai ASCII85+Flate saat menyimpan.
        pdf.save(LEGACY, static_id=True, compress_streams=False, stream_decode_level=pikepdf.StreamDecodeLevel.none)
    print(f"legacy.pdf       {LEGACY.stat().st_size / 1024:9.1f} KB  ({wrapped} gambar dibungkus ASCII85)")

if __name__ == "__main__":
    main()
