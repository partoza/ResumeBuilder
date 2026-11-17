# Resume Builder

A frontend-only resume builder for Philippine job seekers. Fill in the form on one side, see a live A4 preview on the other, and download a polished PDF. No account, no backend, no database — nothing leaves the browser.

## Features

- **Split 50/50 layout** — form and live preview side by side (swap sides with one click); Edit / Preview tabs on mobile.
- **Clean, minimal UI** — Inter font, black-and-white design, light and dark themes.
- **Resume sections** — Header (with optional 2×2 photo), Summary Statement, Skills, Experience (Work, OJT, Apprenticeship, School Projects) with Job Responsibilities and Accomplishments, Education, and Certifications & Licenses.
- **No discriminatory personal data** — age, birthdate, sex, religion, civil status and nationality are intentionally left out.
- **Built-in coaching** — flags weak bullet openers ("Responsible for…", "Helped…"), accomplishments without numbers, summaries outside 2–3 sentences, and invalid ZIP / phone / email formats.
- **2-page limit indicator** — shows the real PDF page count and warns when the resume runs over.
- **ATS-readable PDF** — generated with jsPDF using embedded Inter; every word is real, selectable text that applicant tracking systems can parse. The design matches the on-screen preview exactly.
- **Cover Letter Builder** — a second tab for a standard block-format business letter (date, recipient, Re: line, salutation, opening / body / closing, sign-off, enclosure note), with a 1-page indicator and word count. The salutation fills itself in ("Dear Ms. Lim:" or "Dear Hiring Manager:").

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Build for production:

```bash
npm run build
```

The static site is output to `dist/` and can be hosted anywhere (Vercel, Netlify, GitHub Pages).

## Tech stack

React 18 · Vite 5 · jsPDF · Inter (via @fontsource/inter and @expo-google-fonts/inter)

## Project structure

```
src/
  App.jsx                 Layout, preview scaling, download, theme
  data.js                 Form schema and sample data
  coach.js                Resume-writing checks shown under fields
  model.js                Normalizes form data for preview + PDF
  letterData.js           Cover letter schema, sample data and model
  exportPdf.js            Draws the resume and cover letter PDFs with jsPDF
  components/
    FormSection.jsx       Collapsible form cards and repeatable entries
    Field.jsx             Input / select / textarea with coaching hints
    ResumePreview.jsx     The on-screen A4 resume
    LetterPreview.jsx     The on-screen A4 cover letter
    ConfirmDialog.jsx     In-app confirmation modal
```

---

Developed by [John Rex Partoza](https://portfolio.partoza.dev)
