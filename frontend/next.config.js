/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',   // Docker 최적화
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'k.kakaocdn.net' },
      { protocol: 'https', hostname: 'ssl.pstatic.net' },
    ],
  },
};

module.exports = nextConfig;
