import { NextResponse } from "next/server";

// URL peninggalan wuspot versi lama (2015–2016) dan pemilik domain sebelumnya
// (2019). Dijawab "410 Gone" supaya Google cepat melupakannya, bukan 404 biasa
// dan bukan dialihkan ke beranda (dianggap soft 404).
const GONE_PAGE = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>Halaman ini sudah nggak ada · wuspot</title>
<style>
  :root { --bg: #f4efe6; --ink: #1d1a16; --ink2: #4f483d; --dot: #b23526; --pen: #1f3d9e; }
  @media (prefers-color-scheme: dark) { :root { --bg: #171512; --ink: #eee7da; --ink2: #c7bdab; --dot: #ee7a6b; --pen: #93aaf4; } }
  body { margin: 0; padding: 12vh 20px; font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
  main { max-width: 34rem; margin: 0 auto; }
  .mark { font-weight: 800; font-size: 26px; letter-spacing: -0.04em; }
  .mark i { display: inline-block; width: .5em; height: .5em; margin: 0 .04em; border-radius: 50%; background: var(--dot); }
  h1 { margin: 28px 0 8px; font-size: 1.6rem; line-height: 1.2; letter-spacing: -0.02em; }
  p { margin: 0 0 12px; color: var(--ink2); }
  a { color: var(--pen); font-weight: 650; text-underline-offset: 3px; }
</style>
</head>
<body>
<main>
  <div class="mark" aria-label="wuspot">wusp<i></i>t</div>
  <h1>Halaman ini sudah nggak ada.</h1>
  <p>Alamat ini berasal dari isi lama domain ini, dan isinya memang sudah dihapus.</p>
  <p>wuspot sekarang berisi alat online gratis buat beresin berkas. <a href="/">Lihat yang ada sekarang &rarr;</a></p>
</main>
</body>
</html>`;

export function proxy() {
  return new NextResponse(GONE_PAGE, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=86400",
    },
  });
}

export const config = {
  matcher: [
    "/cari/:path*",
    "/channel.php",
    "/channel/:path*",
    "/channels",
    "/admin/:path*",
    "/cgi-sys/:path*",
    // pola spam 2019, mis. /08365/1217.html dan /25082/653.html
    "/(\\d+)/(\\d+)\\.html",
  ],
};
