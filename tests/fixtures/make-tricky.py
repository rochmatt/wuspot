"""PDF uji untuk kasus sulit (hasil review): formulir XFA, PDF "Fast Web View"
berproteksi, isian formulir, daftar isi/tautan/lampiran yang hilang saat
rasterize, dan ruang warna CalGray/CalRGB.

Butuh pikepdf + Pillow. Jalankan setelah make-fixtures.mjs (memakai mixed.pdf).
Hasil: tests/fixtures/out/tricky-*.pdf
"""

import base64
import io
import os
import random
import zlib

import pikepdf
from pikepdf import Array, Dictionary, Name, Stream, String
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)
random.seed(7)


def out(name):
    return os.path.join(OUT, name)


def noisy(w, h, mode="RGB", quality=90):
    gray = Image.effect_noise((w, h), 60).convert("L")
    if mode == "RGB":
        img = Image.merge("RGB", (gray, gray.point(lambda v: 255 - v), gray))
    elif mode == "CMYK":
        img = Image.merge("CMYK", (gray, gray.point(lambda v: 255 - v), gray, Image.new("L", (w, h), 20)))
    else:
        img = gray
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return buf.getvalue()


def helvetica(pdf):
    return pdf.make_indirect(Dictionary(Type=Name.Font, Subtype=Name.Type1, BaseFont=Name.Helvetica))


# 1. Formulir XFA dinamis (seperti e-Form pajak): halaman hanya berisi teks
#    "Please wait...", isi formulirnya ada di XFA. Tidak boleh dirasterisasi.
def xfa():
    pdf = pikepdf.new()
    page = pdf.add_blank_page(page_size=(595, 842))
    page.Resources = Dictionary(Font=Dictionary(F1=helvetica(pdf)))
    page.Contents = pdf.make_stream(
        b"BT /F1 11 Tf 40 780 Td (Please wait... If this message is not eventually replaced by the proper contents "
        b"of the document, your PDF viewer may not be able to display this type of document.) Tj ET"
    )
    logo = base64.b64encode(noisy(1200, 900)).decode()
    template = (
        '<?xml version="1.0"?><template xmlns="http://www.xfa.org/schema/xfa-template/3.3/">'
        '<subform name="form1" layout="tb"><pageSet><pageArea name="P1">'
        '<contentArea x="0.25in" y="0.25in" w="8in" h="10.5in"/></pageArea></pageSet>'
        '<field name="NAMA" w="3in" h="0.3in"><ui><textEdit/></ui><value><text>BUDI SANTOSO</text></value></field>'
        '<draw name="logo" w="4in" h="3in"><value><image contentType="image/jpg">' + logo + "</image></value></draw>"
        "</subform></template>"
    )
    datasets = (
        b'<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data>'
        b"<form1><NAMA>BUDI SANTOSO</NAMA></form1></xfa:data></xfa:datasets>"
    )
    xfa = Array([String("template"), pdf.make_stream(template.encode()), String("datasets"), pdf.make_stream(datasets)])
    pdf.Root.AcroForm = pdf.make_indirect(Dictionary(Fields=Array([]), XFA=xfa))
    pdf.Root.NeedsRendering = True
    pdf.save(out("tricky-xfa.pdf"), compress_streams=False)


# 2. "Fast Web View" (linearized) + object stream + hanya password pemilik:
#    /Encrypt dan /Info hanya ada di stream xref halaman pertama.
def linear_protected():
    with pikepdf.open(out("mixed.pdf")) as pdf:
        pdf.docinfo[Name.Author] = "Budi Santoso"
        pdf.save(
            out("tricky-linear-protected.pdf"),
            linearize=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            encryption=pikepdf.Encryption(user="", owner="pemilik", R=4, aes=True),
        )


# 3. Teks + foto CMYK (tidak bisa dikompres tanpa rasterize) + daftar isi,
#    tautan, dan lampiran: semuanya hilang bila halaman diubah jadi gambar.
def outline_links():
    pdf = pikepdf.new()
    font = helvetica(pdf)
    photo = Stream(pdf, noisy(1600, 1200, "CMYK", 92))
    photo.Type = Name.XObject
    photo.Subtype = Name.Image
    photo.Width = 1600
    photo.Height = 1200
    photo.ColorSpace = Name.DeviceCMYK
    photo.BitsPerComponent = 8
    photo.Filter = Name.DCTDecode
    photo.Decode = Array([1, 0, 1, 0, 1, 0, 1, 0])
    ref = pdf.make_indirect(photo)
    pages = []
    for i in range(2):
        page = pdf.add_blank_page(page_size=(595, 842))
        page.Resources = Dictionary(Font=Dictionary(F1=font), XObject=Dictionary(Im0=ref))
        page.Contents = pdf.make_stream(
            f"BT /F1 18 Tf 72 780 Td (Bab {i + 1} Laporan Magang) Tj ET "
            f"q 450 0 0 340 72 400 cm /Im0 Do Q BT /F1 12 Tf 72 360 Td (Lihat contoh.go.id) Tj ET".encode()
        )
        pages.append(page)
    link = pdf.make_indirect(
        Dictionary(
            Type=Name.Annot,
            Subtype=Name.Link,
            Rect=Array([72, 355, 300, 375]),
            Border=Array([0, 0, 0]),
            A=Dictionary(S=Name.URI, URI=String("https://contoh.go.id")),
        )
    )
    pages[0].Annots = Array([link])
    first = pdf.make_indirect(Dictionary(Title=String("Bab 1"), Dest=Array([pages[0].obj, Name.Fit])))
    second = pdf.make_indirect(Dictionary(Title=String("Bab 2"), Dest=Array([pages[1].obj, Name.Fit])))
    root = pdf.make_indirect(Dictionary(Type=Name.Outlines, First=first, Last=second, Count=2))
    first.Parent = root
    second.Parent = root
    first.Next = second
    second.Prev = first
    pdf.Root.Outlines = root
    attached = pdf.make_stream(b"<data>12345</data>" * 50)
    attached.Type = Name.EmbeddedFile
    spec = pdf.make_indirect(
        Dictionary(Type=Name.Filespec, F=String("data.xml"), UF=String("data.xml"), EF=Dictionary(F=attached))
    )
    pdf.Root.Names = Dictionary(EmbeddedFiles=Dictionary(Names=Array([String("data.xml"), spec])))
    pdf.save(out("tricky-outline.pdf"))


# 4. Scan + kolom isian formulir yang sudah diisi. Isiannya hilang (jadi
#    gambar) kalau halaman dirasterisasi, jadi level Sedang tidak boleh.
def form():
    w, h = 1240, 1754
    img = Image.effect_noise((w, h), 25).point(lambda v: min(255, v + 150)).convert("RGB")
    draw = ImageDraw.Draw(img)
    for y in range(80, h, 160):
        draw.text((80, y), "FORMULIR PENDAFTARAN", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    pdf = pikepdf.new()
    font = helvetica(pdf)
    scan = pdf.make_indirect(
        Stream(
            pdf,
            buf.getvalue(),
            Type=Name.XObject,
            Subtype=Name.Image,
            Width=w,
            Height=h,
            ColorSpace=Name.DeviceRGB,
            BitsPerComponent=8,
            Filter=Name.DCTDecode,
        )
    )
    page = pdf.add_blank_page(page_size=(595, 842))
    page.Resources = Dictionary(XObject=Dictionary(Im0=scan), Font=Dictionary(Helv=font))
    page.Contents = pdf.make_stream(b"q 595 0 0 842 0 0 cm /Im0 Do Q")
    appearance = pdf.make_stream(
        b"/Tx BMC q BT /Helv 16 Tf 0 0 0 rg 4 8 Td (BUDI SANTOSO) Tj ET Q EMC",
        Type=Name.XObject,
        Subtype=Name.Form,
        BBox=Array([0, 0, 260, 30]),
        Resources=Dictionary(Font=Dictionary(Helv=font)),
    )
    field = pdf.make_indirect(
        Dictionary(
            Type=Name.Annot,
            Subtype=Name.Widget,
            FT=Name.Tx,
            T=String("nama"),
            V=String("BUDI SANTOSO"),
            F=4,
            Rect=Array([200, 500, 460, 530]),
            DA=String("/Helv 16 Tf 0 g"),
            AP=Dictionary(N=appearance),
            P=page.obj,
        )
    )
    page.obj.Annots = Array([field])
    pdf.Root.AcroForm = Dictionary(Fields=Array([field]), DA=String("/Helv 0 Tf 0 g"), DR=Dictionary(Font=Dictionary(Helv=font)))
    pdf.save(out("tricky-form.pdf"))


# 5. CalGray bergamma 1,0 (tidak boleh diubah ke DeviceRGB: nadanya bergeser)
#    dan CalRGB (boleh, ruang warnanya harus tetap CalRGB).
def calibrated():
    w, h = 1600, 1200
    ramp = bytes((x * 255) // (w - 1) for x in range(w)) * h
    rgb = bytearray()
    for y in range(h):
        for x in range(w):
            rgb += bytes(((x * 255) // (w - 1), (y * 255) // (h - 1), random.randrange(256)))
    pdf = pikepdf.new()
    white = Array([0.9505, 1.0, 1.089])
    gray = pdf.make_indirect(
        Stream(
            pdf,
            zlib.compress(ramp),
            Type=Name.XObject,
            Subtype=Name.Image,
            Width=w,
            Height=h,
            ColorSpace=Array([Name.CalGray, Dictionary(WhitePoint=white)]),
            BitsPerComponent=8,
            Filter=Name.FlateDecode,
        )
    )
    color = pdf.make_indirect(
        Stream(
            pdf,
            zlib.compress(bytes(rgb)),
            Type=Name.XObject,
            Subtype=Name.Image,
            Width=w,
            Height=h,
            ColorSpace=Array([Name.CalRGB, Dictionary(WhitePoint=white, Gamma=Array([1.8, 1.8, 1.8]))]),
            BitsPerComponent=8,
            Filter=Name.FlateDecode,
        )
    )
    page = pdf.add_blank_page(page_size=(595, 842))
    page.Resources = Dictionary(XObject=Dictionary(G=gray, C=color), Font=Dictionary(F1=helvetica(pdf)))
    page.Contents = pdf.make_stream(
        b"BT /F1 14 Tf 60 800 Td (Kalibrasi warna) Tj ET q 475 0 0 356 60 420 cm /G Do Q q 475 0 0 356 60 40 cm /C Do Q"
    )
    pdf.save(out("tricky-calibrated.pdf"))


if __name__ == "__main__":
    xfa()
    linear_protected()
    outline_links()
    form()
    calibrated()
    print("tricky fixtures OK")
