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
<title>Halaman ini sudah tidak ada · wuspot</title>
<style>
  body { font: 16px/1.6 system-ui, sans-serif; margin: 0; padding: 12vh 20px; color: #222; background: #fafaf7; }
  main { max-width: 34rem; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 .5rem; }
  a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>Halaman ini sudah dihapus.</h1>
  <p>Alamat ini milik wuspot versi lama dan isinya memang sudah tidak ada lagi.</p>
  <p>wuspot sekarang berisi alat-alat online gratis. <a href="/">Lihat yang ada sekarang &rarr;</a></p>
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
