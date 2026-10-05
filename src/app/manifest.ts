import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Josefinee — Bijoux et accessoires modernes",
    short_name: "Josefinee",
    description: "Bijoux et accessoires intemporels livrés partout en Algérie.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfd",
    theme_color: "#f1f3f5",
    lang: "fr-DZ",
    dir: "ltr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "64x64",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
