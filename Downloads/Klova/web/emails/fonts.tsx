import { Font } from "react-email";

// DM Serif Display (headings) + Plus Jakarta Sans (body), the same two
// Google Fonts web/app/layout.tsx loads for the app itself. Most email
// clients strip the @import, so the <Font> entries below register the
// static TTF files directly as the real fallback; Arial/Georgia (set in
// emails/theme.ts's fontFamily stacks) is the final fallback if even those
// don't load.
export function KlovaEmailFonts() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');`,
        }}
      />
      <Font
        fontFamily="DM Serif Display"
        fallbackFontFamily={["Georgia", "serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/dmserifdisplay/v17/-nFnOHM81r4j6k0gjAW3mujVU2B2K_c.ttf",
          format: "truetype",
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Plus Jakarta Sans"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU7NSg.ttf",
          format: "truetype",
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Plus Jakarta Sans"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_m07NSg.ttf",
          format: "truetype",
        }}
        fontWeight={500}
        fontStyle="normal"
      />
      <Font
        fontFamily="Plus Jakarta Sans"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_d0nNSg.ttf",
          format: "truetype",
        }}
        fontWeight={600}
        fontStyle="normal"
      />
      <Font
        fontFamily="Plus Jakarta Sans"
        fallbackFontFamily={["Arial", "sans-serif"]}
        webFont={{
          url: "https://fonts.gstatic.com/s/plusjakartasans/v12/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_TknNSg.ttf",
          format: "truetype",
        }}
        fontWeight={700}
        fontStyle="normal"
      />
    </>
  );
}
