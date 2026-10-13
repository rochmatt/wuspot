import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

// Kertas + map coklat + wordmark. Huruf bawaan ImageResponse sudah cukup.
// Dipakai gambar bagikan bawaan (src/app/opengraph-image.tsx) dan tiap halaman
// ukuran (mis. "Kompres PDF ke 200 KB"), supaya pratinjau WhatsApp menyebut ukurannya.
export function renderOgImage({
  title = ["Kompres PDF", "sampai ukuran KB", "yang kamu mau."],
  after = "187 KB",
}: {
  /** Baris judul besar di kiri. */
  title?: string[];
  /** Angka "Sesudah" di lembar contoh. */
  after?: string;
} = {}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#F4EFE6",
          padding: "64px 72px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* map coklat di kanan */}
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 120,
            width: 420,
            height: 440,
            display: "flex",
            background: "#C4A072",
            borderRadius: "0 18px 18px 18px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -44,
              height: 44,
              padding: "0 22px",
              display: "flex",
              alignItems: "center",
              background: "#C4A072",
              borderRadius: "16px 16px 0 0",
              color: "#2A1E0D",
              fontSize: 20,
              letterSpacing: 2,
            }}
          >
            MAP 01 · KOMPRES PDF
          </div>
          <div
            style={{
              position: "absolute",
              left: 40,
              right: 36,
              top: 34,
              bottom: 22,
              display: "flex",
              flexDirection: "column",
              background: "#FFFFFF",
              borderLeft: "3px solid #E9A79D",
              padding: "28px 30px",
              transform: "rotate(-2deg)",
            }}
          >
            <div style={{ display: "flex", fontSize: 22, color: "#665E50" }}>Sebelum</div>
            <div style={{ display: "flex", fontSize: 44, color: "#665E50", textDecoration: "line-through" }}>
              2,4 MB
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#665E50", marginTop: 18 }}>Sesudah</div>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#1D1A16", letterSpacing: -3 }}>
              {after}
            </div>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-end",
                marginTop: 10,
                padding: "8px 18px",
                border: "5px solid #B23526",
                borderRadius: 8,
                color: "#B23526",
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: 6,
                transform: "rotate(-8deg)",
              }}
            >
              BERES
            </div>
          </div>
        </div>

        {/* teks di kiri */}
        <div style={{ display: "flex", flexDirection: "column", width: 620 }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 64, fontWeight: 800, color: "#1D1A16", letterSpacing: -2 }}>
            wusp
            <div style={{ width: 32, height: 32, borderRadius: 16, background: "#B23526", margin: "14px 3px 0 4px" }} />t
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 84,
              fontSize: 62,
              lineHeight: 1.08,
              color: "#1D1A16",
              letterSpacing: -1.5,
            }}
          >
            {title.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#4F483D" }}>
            Langsung di HP. Gratis. File nggak di-upload.
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
