import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "exceljs", "pdfkit", "docx"],
};

export default nextConfig;
