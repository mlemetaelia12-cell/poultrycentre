import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "POULTRY CENTRE",
    short_name: "POULTRY CENTRE",
    description: "Veterinary business management workspace",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#14532d",
    icons: [
      { src: "/poultry-farm-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/poultry-farm-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
