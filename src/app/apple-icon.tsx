import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Ikon layar utama iPhone: map coklat dengan titik tinta stempel.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#C4A072",
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: "52% 48% 50% 50% / 50% 54% 46% 50%",
            background: "#B23526",
          }}
        />
      </div>
    ),
    size,
  );
}
