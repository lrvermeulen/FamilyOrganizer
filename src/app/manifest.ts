import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gezinsplanner",
    short_name: "Gezin",
    description: "Taken, agenda en de verdeling van de mentale last in jullie gezin",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#0f766e",
    lang: "nl",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
