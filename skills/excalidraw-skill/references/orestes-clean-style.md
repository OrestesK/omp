# Excalidraw technical diagram style profile

Use this profile with the [shared local style guide](../../diagram-design/references/orestes-clean-style.md) for Excalidraw diagrams. These renderer-specific defaults were inferred from three user-authored native scenes, not from explicit approval of each numeric value:
- `Security Assignment.excalidraw`: restrained semantic pastels in a wide architecture strip
- `Queue Benchmarks.excalidraw`: monochrome exploratory flow with adjacent engineering notes
- `Federated Learning.excalidraw`: monochrome sequence and architecture panels

## Native shape and layout defaults

- Use a white canvas, black or near-black (`#1e1e1e`) linework, and roughness `1`
- Use transparent rounded rectangles for components and processes by default
    - A start or end usually remains a rectangle, but use an ellipse when a supplied reference makes it clearer
    - Use an ordinary labeled branch or rectangle for a decision unless a diamond clarifies a genuine yes/no distinction
- Place a free-text title at the upper left at 30–36px
    - Body labels are normally 20px
    - Boundary and arrow annotations are 16–20px, not below 16px under this default
- Use at least 40px between nearby objects
- Represent a real scope with a large transparent rounded rectangle and a light-gray dashed stroke
    - Keep its label free-standing near the top rather than centered inside the boundary
- Use short, direct, black, solid, 2px, roughness-1 semantic arrows bound to their endpoints
    - Prefer two-point routes
    - Follow the [tool reference](cheatsheet.md) for binding and genuine annotation pointers
