# Product and interface references

Researched September 23, 2026. The release UI uses original code, icons, copy, and colors. These products informed the layout and flow.

## Primary reference: Jam

[Jam for GitHub](https://jam.dev/integrations/github) is the closest direct comparison: capture a screenshot or recording, keep technical context with it, and create a GitHub issue in the same flow. Its public product screens guided the image-first workbench, side-by-side issue composer, small connection status, and single prominent submission action. Pindart keeps a narrower region-to-issue workflow and does not claim Jam's recordings, logs, or AI features.

Local captures from Jam's public site are in `C:\repo\screenshot-to-issue-workspace\qa\reference`:

| Capture | What we studied |
| --- | --- |
| `jam-app-visual.png` | Screenshot and issue content shown together |
| `jam-capture.png` | Capture as the first, direct action |
| `jam-ai-summary.png` | Content hierarchy around issue details |
| `jam-technical-context.png` | Technical details presented as supporting context |
| `jam-routing.png` | Destination choice near submission |
| `jam-report-preview.png` | Image prominence in the report |

## Other comparable tools

| Product | Relevant pattern | Different emphasis |
| --- | --- | --- |
| [Marker.io](https://marker.io/github-bug-tracking) | Click, annotate, send to GitHub with technical details | Website feedback widget and team/client reporting |
| [Userback](https://support.userback.io/en/articles/5322214-installing-the-userback-browser-extension) | Selected-area capture, arrows and drawing, then feedback form | Multiple capture modes, project feedback management |
| [Jam](https://jam.dev/integrations/github) | Capture and GitHub issue creation with rich context | Recording, logs, AI issue drafting, team workflows |

## Investor portfolio check

[YC's TesterArmy](https://www.ycombinator.com/companies/testerarmy) creates screenshot and recording based bug reports through automated testing. [YC's Meticulous](https://www.ycombinator.com/companies/meticulous) focuses on recorded sessions and visual regression testing. Both are adjacent, but neither was a stronger interface model for this capture-to-issue composer than Jam. No directly comparable a16z portfolio product was verified in this research, so the design does not claim an investor affiliation.

## Decisions for Pindart

- Put the image at the center of the workbench and retain it beside the issue fields.
- Keep connection status and captured metadata visible but visually quiet.
- Make repository search and the final GitHub action obvious.
- Keep capture and markup in one focused flow; avoid features the first release cannot deliver.
