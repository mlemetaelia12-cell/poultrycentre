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
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
