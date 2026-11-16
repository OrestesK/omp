# Local technical diagram style

These format-neutral defaults come from the local Excalidraw style profile's user-authored examples. Its numeric and native-scene defaults do not carry over to other renderers

Explicit user style, a supplied brand guide, or supplied visual references take precedence

- Inspect available raster and native forms for typography, shape grammar, fills, strokes, route geometry, spacing, annotations, and grouping
- Transfer established visual traits, not proprietary wording or unrelated architecture
- Do not generalize an incidental trait from one reference into a universal preference
    - A user-requested trait overrides the default even if only one reference shows it

## Quiet, technically precise grammar

- Use simple component and process shapes, with a distinct start, end, or decision shape only when it clarifies the meaning or matches a supplied reference
- Prefer one obvious left-to-right flow or top-to-bottom sequence
    - Use generous outer margins and broad gutters between domains
    - Fit a normal screen or README at the intended viewing size
    - Group through whitespace and containment before color
- Represent a real scope with a boundary and a clear label
    - Do not begin with a decorative background zone
- Use short, direct semantic connections between actual endpoints
    - Move nodes before routing around obstacles
    - Slight curves may separate parallel edges or match a reference
    - Avoid extreme curves, elbow mazes, decorative loops, perimeter returns, and unrelated-node crossings
- Put short nouns in components and short actions, protocols, payloads, or conditions on connections when a route needs a label
    - Put rationale, caveats, and long engineering inventories in restrained adjacent notes outside the primary route
    - Use direct labels instead of unexplained acronyms, metaphors, or an avoidable legend
- Treat monochrome as the baseline
    - When role recognition benefits from color, use sparse pale fills with matching darker strokes
    - Keep a role's color consistent across a scene and compared states
    - Never make color the sole carrier of a critical distinction
    - Avoid more than five accent families in an overview as a soft visual-economy preference, not an acceptance ceiling
    - Do not invent color categories simply because a palette is available

## Apply to the scope

- Make an overview tell one story at a glance
    - Put secondary mechanics in adjacent notes or focused detail views without concealing required meaning
    - No fixed node, arrow, callout, or feedback-loop ceiling replaces actual readability and scope
- Allow substantial detail in a technical deep dive
    - Divide it into coherent panels, lanes, or real domains, each with a local reading order
    - Reuse the narrow element grammar and keep cross-panel connectors few and explicit
    - Maintain legibility at the target scale. Element count alone is not a defect
- Unless requested or established by a reference, avoid decorative additions:
    - Colored canvas backgrounds, ribbons, currents, halos, and full-scene background rectangles
    - Giant perimeter loops, low-opacity semantic routes, and color-heavy categorical coding
    - River, delta, eddy, or harbor metaphors, needless legends, and unexplained shape vocabularies
    - Automatic or policy machinery made equal-weight flow nodes without semantic reason

These are defaults with exceptions, not bans on user-requested designs
