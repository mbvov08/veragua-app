import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Por defecto Next.js limita el body de un Server Action a 1MB — muy poco para
    // el acta de entrega/devolución del módulo Vehículo, que manda de una sola vez
    // 7 fotos comprimidas (hasta 1600px, JPEG) + 2 firmas. Con el límite por defecto
    // el envío falla silenciosamente en el navegador ("Load failed").
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
