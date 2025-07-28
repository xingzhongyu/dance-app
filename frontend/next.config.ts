import type { NextConfig } from "next";
const isProd = process.env.NODE_ENV === 'production';
const nextConfig: NextConfig = {
  basePath: '/dance',
  reactStrictMode: true,
  
  // ↓↓↓ 添加这个关键配置 ↓↓↓
  // assetPrefix 负责静态资源 (JS, CSS, images) 的 URL 前缀
  // 在生产环境中, 我们把它设置为 basePath
  assetPrefix: isProd ? '/dance' : undefined,

  // 如果你使用了 output: 'export' (静态导出), 下面这个配置也可能需要
  // images: {
  //   unoptimized: true,
  // },
};

export default nextConfig;
